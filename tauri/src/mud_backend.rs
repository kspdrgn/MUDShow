use std::{
    collections::{HashMap, VecDeque},
    io,
    time::{SystemTime, UNIX_EPOCH},
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
    runtime_id: String,
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            next_session_id: Arc::new(AtomicU64::new(1)),
            runtime_id: format!(
                "runtime-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_nanos())
                    .unwrap_or_default()
            ),
        }
    }
}

impl ConnectionManager {
    pub fn reserve_session_id(&self) -> u64 {
        self.next_session_id.fetch_add(1, Ordering::SeqCst)
    }

    pub fn runtime_id(&self) -> &str {
        &self.runtime_id
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
        descriptor: ConnectionDescriptor,
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
                descriptor,
                replay: VecDeque::new(),
                next_sequence: 0,
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

    fn record_event(&self, connection_id: &str, session_id: u64, event: ConnectionEvent) -> Option<u64> {
        let mut guard = self.connections.lock().ok()?;
        let entry = guard.get_mut(connection_id)?;
        if entry.session_id != session_id {
            return None;
        }

        entry.next_sequence += 1;
        let sequence = entry.next_sequence;
        entry.replay.push_back(ReplayEvent { sequence, event });
        while entry.replay.len() > MAX_REPLAY_EVENTS {
            entry.replay.pop_front();
        }
        entry.descriptor.last_sequence = sequence;
        entry.descriptor.oldest_replay_sequence = entry.replay.front().map(|item| item.sequence).unwrap_or(sequence);
        Some(sequence)
    }

    fn emit_event(&self, app: &AppHandle, connection_id: &str, session_id: u64, event: ConnectionEvent) {
        if let Some(sequence) = self.record_event(connection_id, session_id, event.clone()) {
            emit_event(app, connection_id, session_id, sequence, event);
        }
    }

    fn list(&self) -> Vec<ConnectionDescriptor> {
        self.connections
            .lock()
            .map(|guard| guard.values().map(|entry| entry.descriptor.clone()).collect())
            .unwrap_or_default()
    }

    fn replay(&self, connection_id: &str, after_sequence: u64) -> Result<ReplayResponse, String> {
        let guard = self
            .connections
            .lock()
            .map_err(|_| "Connection state is unavailable".to_string())?;
        let entry = guard
            .get(connection_id)
            .ok_or_else(|| "No active connection".to_string())?;
        let oldest_sequence = entry.replay.front().map(|item| item.sequence).unwrap_or(entry.next_sequence + 1);
        let events = entry
            .replay
            .iter()
            .filter(|item| item.sequence > after_sequence)
            .cloned()
            .collect();

        Ok(ReplayResponse {
            events,
            oldest_sequence,
            newest_sequence: entry.next_sequence,
            has_gap: after_sequence.saturating_add(1) < oldest_sequence,
        })
    }
}

const MAX_REPLAY_EVENTS: usize = 1000;

#[tauri::command]
pub async fn connect_mud(
    app: AppHandle,
    state: State<'_, ConnectionManager>,
    connection_id: String,
    host: String,
    port: u16,
    tls: bool,
    verify_certificate: bool,
    world_id: Option<String>,
    character_id: Option<String>,
) -> Result<(), String> {
    let session_id = state.reserve_session_id();
    let (handle, worker) = open_connection(
        app.clone(),
        state.inner().clone(),
        connection_id.clone(),
        session_id,
        &host,
        port,
        tls,
        verify_certificate,
    )
    .await?;

    state.replace(
        connection_id.clone(),
        session_id,
        handle,
        ConnectionDescriptor {
            connection_id: connection_id.clone(),
            session_id,
            world_id,
            character_id,
            host,
            port,
            tls,
            verify_certificate,
            status: "connected".to_string(),
            last_error: None,
            last_sequence: 0,
            oldest_replay_sequence: 1,
        },
    )?;
    state.emit_event(&app, &connection_id, session_id, ConnectionEvent::Opened);
    worker.spawn();
    Ok(())
}

#[tauri::command]
pub fn get_connection_runtime_id(state: State<'_, ConnectionManager>) -> String {
    state.runtime_id().to_string()
}

#[tauri::command]
pub fn list_mud_connections(state: State<'_, ConnectionManager>) -> Vec<ConnectionDescriptor> {
    state.list()
}

#[tauri::command]
pub fn get_mud_connection_events(
    state: State<'_, ConnectionManager>,
    connection_id: String,
    after_sequence: u64,
) -> Result<ReplayResponse, String> {
    state.replay(&connection_id, after_sequence)
}

#[tauri::command]
pub fn attach_mud_connection(
    state: State<'_, ConnectionManager>,
    connection_id: String,
    after_sequence: u64,
) -> Result<ReplayResponse, String> {
    state.replay(&connection_id, after_sequence)
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
) -> Result<(ConnectionHandle, ConnectionWorker), String> {
    let stream = connect_stream(host, port, tls, verify_certificate).await?;
    let (outgoing_tx, outgoing_rx) = async_mpsc::unbounded_channel();
    let (stop_tx, stop_rx) = watch::channel(false);

    let active = Arc::new(AtomicBool::new(true));
    let worker = ConnectionWorker {
        stream,
        outgoing_rx,
        stop_rx,
        active: Arc::clone(&active),
        app,
        manager,
        connection_id,
        session_id,
    };

    Ok((
        ConnectionHandle {
            active,
            stop_tx,
            outgoing_tx: Some(outgoing_tx),
        },
        worker,
    ))
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
    let mut line_buffer = LineBuffer::default();

    loop {
        tokio::select! {
            biased;
            _ = stop_rx.changed() => {
                flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                break;
            }
            maybe_bytes = outgoing_rx.recv() => {
                match maybe_bytes {
                    Some(bytes) => {
                        if let Err(error) = stream.write_all(&bytes).await {
                            active.store(false, Ordering::SeqCst);
                            manager.emit_event(
                                &app,
                                &connection_id,
                                session_id,
                                ConnectionEvent::Error {
                                    message: format!("Failed to send data: {error}"),
                                },
                            );
                            break;
                        }
                    }
                    None => {
                        flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                        break;
                    }
                }
            }
            result = stream.read(&mut buffer) => {
                match result {
                    Ok(0) => {
                        flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                        active.store(false, Ordering::SeqCst);
                        manager.emit_event(
                            &app,
                            &connection_id,
                            session_id,
                            ConnectionEvent::Closed {
                                reason: "Remote host closed the connection".to_string(),
                            },
                        );
                        break;
                    }
                    Ok(bytes_read) => {
                        let cleaned = strip_telnet(&buffer[..bytes_read]);
                        if !cleaned.is_empty() {
                            let raw_text = String::from_utf8_lossy(&cleaned).to_string();
                            manager.emit_event(&app, &connection_id, session_id, ConnectionEvent::Raw { text: raw_text });
                            for text in line_buffer.push(&cleaned) {
                                manager.emit_event(&app, &connection_id, session_id, ConnectionEvent::Data { text });
                            }
                        }
                    }
                    Err(error) => {
                        flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                        active.store(false, Ordering::SeqCst);
                        manager.emit_event(
                            &app,
                            &connection_id,
                            session_id,
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

fn flush_line_buffer(
    manager: &ConnectionManager,
    app: &AppHandle,
    connection_id: &str,
    session_id: u64,
    line_buffer: &mut LineBuffer,
) {
    for text in line_buffer.flush() {
        manager.emit_event(app, connection_id, session_id, ConnectionEvent::Data { text });
    }
}

fn emit_event(app: &AppHandle, connection_id: &str, session_id: u64, sequence: u64, event: ConnectionEvent) {
    let _ = app.emit(
        MUD_EVENT_NAME,
        ConnectionEventMessage {
            connection_id: connection_id.to_string(),
            session_id,
            sequence,
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

#[derive(Default)]
struct LineBuffer {
    bytes: Vec<u8>,
}

impl LineBuffer {
    fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        let mut completed = Vec::new();
        for &byte in bytes {
            if byte == b'\r' {
                continue;
            }

            if byte == b'\n' {
                completed.push(self.take_pending(true));
                continue;
            }

            self.bytes.push(byte);
        }
        completed
    }

    fn flush(&mut self) -> Vec<String> {
        if self.bytes.is_empty() {
            return Vec::new();
        }

        let text = String::from_utf8_lossy(&self.bytes).to_string();
        self.bytes.clear();
        vec![text]
    }

    fn take_pending(&mut self, with_newline: bool) -> String {
        let text = String::from_utf8_lossy(&self.bytes).to_string();
        self.bytes.clear();
        if with_newline { format!("{text}\n") } else { text }
    }
}

struct ConnectionEntry {
    session_id: u64,
    handle: ConnectionHandle,
    descriptor: ConnectionDescriptor,
    replay: VecDeque<ReplayEvent>,
    next_sequence: u64,
}

struct ConnectionWorker {
    stream: ConnectionStream,
    outgoing_rx: async_mpsc::UnboundedReceiver<Vec<u8>>,
    stop_rx: watch::Receiver<bool>,
    active: Arc<AtomicBool>,
    app: AppHandle,
    manager: ConnectionManager,
    connection_id: String,
    session_id: u64,
}

impl ConnectionWorker {
    fn spawn(self) {
        tauri::async_runtime::spawn(async move {
            run_connection(
                self.stream,
                self.outgoing_rx,
                self.stop_rx,
                self.active,
                self.app,
                self.manager,
                self.connection_id,
                self.session_id,
            )
            .await;
        });
    }
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
    Opened,
    Raw { text: String },
    Data { text: String },
    Closed { reason: String },
    Error { message: String },
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionEventMessage {
    connection_id: String,
    session_id: u64,
    sequence: u64,
    #[serde(flatten)]
    event: ConnectionEvent,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_handle() -> ConnectionHandle {
        let (stop_tx, _stop_rx) = watch::channel(false);
        let (outgoing_tx, _outgoing_rx) = async_mpsc::unbounded_channel();
        ConnectionHandle {
            active: Arc::new(AtomicBool::new(false)),
            stop_tx,
            outgoing_tx: Some(outgoing_tx),
        }
    }

    fn install(manager: &ConnectionManager, id: &str, session_id: u64) {
        manager
            .replace(id.to_string(), session_id, test_handle(), ConnectionDescriptor {
                connection_id: id.to_string(),
                session_id,
                world_id: None,
                character_id: None,
                host: "localhost".to_string(),
                port: 4201,
                tls: false,
                verify_certificate: false,
                status: "connected".to_string(),
                last_error: None,
                last_sequence: 0,
                oldest_replay_sequence: 1,
            })
            .unwrap();
    }

    #[test]
    fn replay_is_bounded_and_reports_a_gap_after_trimming() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);

        for index in 0..(MAX_REPLAY_EVENTS + 7) {
            assert!(manager.record_event(
                "world",
                1,
                ConnectionEvent::Data { text: index.to_string() },
            ).is_some());
        }

        let replay = manager.replay("world", 0).unwrap();
        assert_eq!(replay.events.len(), MAX_REPLAY_EVENTS);
        assert_eq!(replay.oldest_sequence, 8);
        assert_eq!(replay.newest_sequence, (MAX_REPLAY_EVENTS + 7) as u64);
        assert!(replay.has_gap);
    }

    #[test]
    fn stale_worker_events_cannot_mutate_a_replacement() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 11);
        manager.record_event("world", 11, ConnectionEvent::Data { text: "old".into() });
        manager.replace("world".into(), 12, test_handle(), manager.list()[0].clone()).unwrap();

        assert!(manager.record_event("world", 11, ConnectionEvent::Data { text: "stale".into() }).is_none());
        assert_eq!(manager.replay("world", 0).unwrap().events.len(), 0);
    }

    #[test]
    fn disconnect_removes_connection_and_stops_sending() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);
        manager.disconnect("world");

        assert!(manager.send("world", b"look").is_err());
        assert!(manager.replay("world", 0).is_err());
    }

    #[test]
    fn detached_line_processing_keeps_order_and_flushes_partial_text() {
        let mut lines = LineBuffer::default();
        assert_eq!(lines.push(b"one\r\ntwo\nthree"), vec!["one\n", "two\n"]);
        assert_eq!(lines.flush(), vec!["three"]);
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionDescriptor {
    pub connection_id: String,
    pub session_id: u64,
    pub world_id: Option<String>,
    pub character_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub tls: bool,
    pub verify_certificate: bool,
    pub status: String,
    pub last_error: Option<String>,
    pub last_sequence: u64,
    pub oldest_replay_sequence: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayEvent {
    pub sequence: u64,
    #[serde(flatten)]
    pub event: ConnectionEvent,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayResponse {
    pub events: Vec<ReplayEvent>,
    pub oldest_sequence: u64,
    pub newest_sequence: u64,
    pub has_gap: bool,
}
