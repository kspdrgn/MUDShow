use std::{
    collections::HashMap,
    io,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};

use native_tls::TlsConnector;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    sync::{mpsc as async_mpsc, watch},
};
use tokio_native_tls::TlsConnector as TokioTlsConnector;

const MUD_EVENT_NAME: &str = "mud://event";

#[derive(Clone)]
pub struct ConnectionManager {
    connections: Arc<Mutex<HashMap<String, ConnectionEntry>>>,
    next_session_id: Arc<AtomicU64>,
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            next_session_id: Arc::new(AtomicU64::new(1)),
        }
    }
}

impl ConnectionManager {
    pub fn reserve_session_id(&self) -> u64 {
        self.next_session_id.fetch_add(1, Ordering::SeqCst)
    }

    pub fn disconnect(&self, connection_id: &str) {
        if let Ok(mut guard) = self.connections.lock() {
            if let Some(entry) = guard.remove(connection_id) {
                let mut handle = entry.handle;
                handle.stop();
            }
        }
    }

    pub fn disconnect_all(&self) {
        if let Ok(mut guard) = self.connections.lock() {
            for entry in guard.drain().map(|(_, entry)| entry) {
                let mut handle = entry.handle;
                handle.stop();
            }
        }
    }

    fn replace(
        &self,
        connection_id: String,
        session_id: u64,
        mut handle: ConnectionHandle,
    ) -> Result<(), String> {
        let mut guard = match self.connections.lock() {
            Ok(guard) => guard,
            Err(_) => {
                handle.stop();
                return Err("Connection state is unavailable".to_string());
            }
        };

        if let Some(existing) = guard.remove(&connection_id) {
            let mut existing_handle = existing.handle;
            existing_handle.stop();
        }

        handle.mark_active();
        guard.insert(
            connection_id,
            ConnectionEntry {
                session_id,
                handle,
            },
        );

        Ok(())
    }

    fn remove_if_match(&self, connection_id: &str, session_id: u64) {
        if let Ok(mut guard) = self.connections.lock() {
            let should_remove = guard
                .get(connection_id)
                .map(|entry| entry.session_id == session_id)
                .unwrap_or(false);

            if should_remove {
                if let Some(entry) = guard.remove(connection_id) {
                    let mut handle = entry.handle;
                    handle.stop();
                }
            }
        }
    }

    fn send(&self, connection_id: &str, bytes: &[u8]) -> Result<(), String> {
        let guard = self
            .connections
            .lock()
            .map_err(|_| "Connection state is unavailable".to_string())?;
        let entry = guard
            .get(connection_id)
            .ok_or_else(|| "No active connection".to_string())?;
        entry.handle.send(bytes)
    }
}

#[tauri::command]
pub async fn connect_mud(
    app: AppHandle,
    state: State<'_, ConnectionManager>,
    connection_id: String,
    host: String,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<(), String> {
    let session_id = state.reserve_session_id();
    let handle = open_connection(
        app,
        state.inner().clone(),
        connection_id.clone(),
        session_id,
        &host,
        port,
        tls,
        verify_certificate,
    )
    .await?;

    state.replace(connection_id, session_id, handle)?;
    Ok(())
}

#[tauri::command]
pub fn send_mud(
    state: State<'_, ConnectionManager>,
    connection_id: String,
    text: String,
) -> Result<(), String> {
    state.send(&connection_id, text.as_bytes())
}

#[tauri::command]
pub fn disconnect_mud(state: State<'_, ConnectionManager>, connection_id: String) {
    state.disconnect(&connection_id);
}

async fn open_connection(
    app: AppHandle,
    manager: ConnectionManager,
    connection_id: String,
    session_id: u64,
    host: &str,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<ConnectionHandle, String> {
    let stream = connect_stream(host, port, tls, verify_certificate).await?;
    let (outgoing_tx, outgoing_rx) = async_mpsc::unbounded_channel();
    let (stop_tx, stop_rx) = watch::channel(false);

    let active = Arc::new(AtomicBool::new(true));
    let worker_active = Arc::clone(&active);
    let worker_app = app.clone();
    let worker_manager = manager.clone();
    let worker_connection_id = connection_id.clone();

    tauri::async_runtime::spawn(async move {
        run_connection(
            stream,
            outgoing_rx,
            stop_rx,
            worker_active,
            worker_app,
            worker_manager,
            worker_connection_id,
            session_id,
        )
        .await;
    });

    Ok(ConnectionHandle {
        active,
        stop_tx,
        outgoing_tx: Some(outgoing_tx),
    })
}

async fn connect_stream(
    host: &str,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<ConnectionStream, String> {
    let host = normalize_connect_host(host);
    let address = format!("{host}:{port}");

    let tcp = TcpStream::connect(&address)
        .await
        .map_err(|error| format!("Failed to connect to {address}: {error}"))?;
    tcp.set_nodelay(true)
        .map_err(|error| format!("Failed to configure TCP socket: {error}"))?;

    if tls {
        let mut builder = TlsConnector::builder();
        builder.danger_accept_invalid_certs(!verify_certificate);
        let connector = builder
            .build()
            .map_err(|error| format!("Failed to initialize TLS connector: {error}"))?;
        let connector = TokioTlsConnector::from(connector);
        let stream = connector
            .connect(host, tcp)
            .await
            .map_err(|error| format!("Failed to establish TLS connection to {address}: {error}"))?;
        return Ok(ConnectionStream::Tls(stream));
    }

    Ok(ConnectionStream::Plain(tcp))
}

fn normalize_connect_host(host: &str) -> &str {
    match host {
        "0.0.0.0" | "::" => "127.0.0.1",
        _ => host,
    }
}

async fn run_connection(
    mut stream: ConnectionStream,
    mut outgoing_rx: async_mpsc::UnboundedReceiver<Vec<u8>>,
    mut stop_rx: watch::Receiver<bool>,
    active: Arc<AtomicBool>,
    app: AppHandle,
    manager: ConnectionManager,
    connection_id: String,
    session_id: u64,
) {
    let mut buffer = [0u8; 8192];

    loop {
        tokio::select! {
            biased;
            _ = stop_rx.changed() => {
                break;
            }
            maybe_bytes = outgoing_rx.recv() => {
                match maybe_bytes {
                    Some(bytes) => {
                        if let Err(error) = stream.write_all(&bytes).await {
                            active.store(false, Ordering::SeqCst);
                            emit_event(
                                &app,
                                &connection_id,
                                ConnectionEvent::Error {
                                    message: format!("Failed to send data: {error}"),
                                },
                            );
                            break;
                        }
                    }
                    None => {
                        break;
                    }
                }
            }
            result = stream.read(&mut buffer) => {
                match result {
                    Ok(0) => {
                        active.store(false, Ordering::SeqCst);
                        emit_event(
                            &app,
                            &connection_id,
                            ConnectionEvent::Closed {
                                reason: "Remote host closed the connection".to_string(),
                            },
                        );
                        break;
                    }
                    Ok(bytes_read) => {
                        let cleaned = strip_telnet(&buffer[..bytes_read]);
                        if !cleaned.is_empty() {
                            let text = String::from_utf8_lossy(&cleaned).replace("\r\n", "\n");
                            emit_event(&app, &connection_id, ConnectionEvent::Data { text });
                        }
                    }
                    Err(error) => {
                        active.store(false, Ordering::SeqCst);
                        emit_event(
                            &app,
                            &connection_id,
                            ConnectionEvent::Error {
                                message: format!("Connection error: {error}"),
                            },
                        );
                        break;
                    }
                }
            }
        }
    }

    active.store(false, Ordering::SeqCst);
    manager.remove_if_match(&connection_id, session_id);
}

fn emit_event(app: &AppHandle, connection_id: &str, event: ConnectionEvent) {
    let _ = app.emit(
        MUD_EVENT_NAME,
        ConnectionEventMessage {
            connection_id: connection_id.to_string(),
            event,
        },
    );
}

fn strip_telnet(buf: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(buf.len());
    let mut index = 0;

    while index < buf.len() {
        if buf[index] == 0xff {
            if index + 1 >= buf.len() {
                break;
            }

            let cmd = buf[index + 1];

            if (0xfb..=0xfe).contains(&cmd) {
                index += 3;
            } else if cmd == 0xf0 {
                index += 2;
            } else if cmd == 0xfa {
                index += 2;

                while index + 1 < buf.len() && !(buf[index] == 0xff && buf[index + 1] == 0xf0) {
                    index += 1;
                }

                if index + 1 < buf.len() {
                    index += 2;
                }
            } else {
                index += 2;
            }
        } else {
            out.push(buf[index]);
            index += 1;
        }
    }

    out
}

struct ConnectionEntry {
    session_id: u64,
    handle: ConnectionHandle,
}

struct ConnectionHandle {
    active: Arc<AtomicBool>,
    stop_tx: watch::Sender<bool>,
    outgoing_tx: Option<async_mpsc::UnboundedSender<Vec<u8>>>,
}

impl ConnectionHandle {
    fn mark_active(&mut self) {
        self.active.store(true, Ordering::SeqCst);
    }

    fn stop(&mut self) {
        self.active.store(false, Ordering::SeqCst);
        let _ = self.stop_tx.send(true);
        self.outgoing_tx.take();
    }

    fn send(&self, bytes: &[u8]) -> Result<(), String> {
        if !self.active.load(Ordering::SeqCst) {
            return Err("No active connection".to_string());
        }

        let sender = self
            .outgoing_tx
            .as_ref()
            .ok_or_else(|| "No active connection".to_string())?;

        sender
            .send(bytes.to_vec())
            .map_err(|_| "No active connection".to_string())
    }
}

enum ConnectionStream {
    Plain(TcpStream),
    Tls(tokio_native_tls::TlsStream<TcpStream>),
}

impl ConnectionStream {
    async fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        match self {
            ConnectionStream::Plain(stream) => stream.read(buffer).await,
            ConnectionStream::Tls(stream) => stream.read(buffer).await,
        }
    }

    async fn write_all(&mut self, bytes: &[u8]) -> io::Result<()> {
        match self {
            ConnectionStream::Plain(stream) => stream.write_all(bytes).await,
            ConnectionStream::Tls(stream) => stream.write_all(bytes).await,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ConnectionEvent {
    Data { text: String },
    Closed { reason: String },
    Error { message: String },
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionEventMessage {
    connection_id: String,
    #[serde(flatten)]
    event: ConnectionEvent,
}
