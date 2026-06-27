use std::{
    io,
    sync::{
        atomic::{AtomicBool, Ordering},
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

#[derive(Default)]
pub struct ConnectionManager(Mutex<Option<ConnectionHandle>>);

impl ConnectionManager {
    pub fn disconnect(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut handle) = guard.take() {
                handle.stop();
            }
        }
    }

    fn replace(&self, mut handle: ConnectionHandle) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut existing) = guard.take() {
                existing.stop();
            }

            handle.mark_active();
            *guard = Some(handle);
        }
    }

    fn send(&self, bytes: &[u8]) -> Result<(), String> {
        let guard = self
            .0
            .lock()
            .map_err(|_| "Connection state is unavailable".to_string())?;
        let handle = guard
            .as_ref()
            .ok_or_else(|| "No active connection".to_string())?;
        handle.send(bytes)
    }
}

#[tauri::command]
pub async fn connect_mud(
    app: AppHandle,
    state: State<'_, ConnectionManager>,
    host: String,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<(), String> {
    let handle = open_connection(app, &host, port, tls, verify_certificate).await?;
    state.replace(handle);
    Ok(())
}

#[tauri::command]
pub fn send_mud(state: State<'_, ConnectionManager>, text: String) -> Result<(), String> {
    state.send(text.as_bytes())
}

#[tauri::command]
pub fn disconnect_mud(state: State<'_, ConnectionManager>) {
    state.disconnect();
}

async fn open_connection(
    app: AppHandle,
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

    tauri::async_runtime::spawn(async move {
        run_connection(stream, outgoing_rx, stop_rx, worker_active, worker_app).await;
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
                                ConnectionEvent::Error {
                                    message: format!("Failed to send data: {error}"),
                                },
                            );
                            return;
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
                            ConnectionEvent::Closed {
                                reason: "Remote host closed the connection".to_string(),
                            },
                        );
                        return;
                    }
                    Ok(bytes_read) => {
                        let cleaned = strip_telnet(&buffer[..bytes_read]);
                        if !cleaned.is_empty() {
                            let text = String::from_utf8_lossy(&cleaned).replace("\r\n", "\n");
                            emit_event(&app, ConnectionEvent::Data { text });
                        }
                    }
                    Err(error) => {
                        active.store(false, Ordering::SeqCst);
                        emit_event(
                            &app,
                            ConnectionEvent::Error {
                                message: format!("Connection error: {error}"),
                            },
                        );
                        return;
                    }
                }
            }
        }
    }

    active.store(false, Ordering::SeqCst);
}

fn emit_event(app: &AppHandle, event: ConnectionEvent) {
    let _ = app.emit(MUD_EVENT_NAME, event);
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
