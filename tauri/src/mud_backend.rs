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
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use crate::protocol_decoder::{DecodedEvent, TelnetDecoder};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    sync::{mpsc as async_mpsc, watch},
    time::{sleep, Duration},
};
use tokio_native_tls::TlsConnector as TokioTlsConnector;

const MUD_EVENT_NAME: &str = "mud://event";
pub const CONNECTION_EVENT_CONTRACT_VERSION: u16 = 1;

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
                frontend_delivery_buffer: VecDeque::new(),
                frontend_delivery_buffer_bytes: 0,
                attachment_generation: 0,
                attached: true,
                next_sequence: 0,
                snapshot_revision: 0,
                snapshot: StructuredConnectionSnapshot::default(),
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
        if !session_matches(entry.session_id, session_id) {
            return None;
        }

        update_authoritative_snapshot(entry, &event);
        entry.next_sequence += 1;
        let sequence = entry.next_sequence;
        let replay_event = ReplayEvent { sequence, session_id, event };
        if is_attachment_replayable(&replay_event.event) {
            let event_bytes = replayable_event_bytes(&replay_event.event);
            if event_bytes <= MAX_FRONTEND_DELIVERY_BUFFER_BYTES {
                entry.frontend_delivery_buffer.push_back(replay_event.clone());
                entry.frontend_delivery_buffer_bytes += event_bytes;
            }
            while entry.frontend_delivery_buffer_bytes > MAX_FRONTEND_DELIVERY_BUFFER_BYTES {
                if let Some(evicted) = entry.frontend_delivery_buffer.pop_front() {
                    entry.frontend_delivery_buffer_bytes = entry
                        .frontend_delivery_buffer_bytes
                        .saturating_sub(replayable_event_bytes(&evicted.event));
                } else {
                    break;
                }
            }
        }
        entry.descriptor.last_sequence = sequence;
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

    fn snapshot(&self, connection_id: &str) -> Result<ConnectionSnapshotResponse, String> {
        let guard = self
            .connections
            .lock()
            .map_err(|_| "Connection state is unavailable".to_string())?;
        let entry = guard
            .get(connection_id)
            .ok_or_else(|| "No active connection".to_string())?;

        Ok(ConnectionSnapshotResponse {
            contract_version: CONNECTION_EVENT_CONTRACT_VERSION,
            runtime_id: self.runtime_id.clone(),
            connection_id: connection_id.to_string(),
            session_id: entry.session_id,
            sequence: entry.next_sequence,
            snapshot_revision: entry.snapshot_revision,
            snapshot: entry.snapshot.clone(),
        })
    }

    fn attach(&self, connection_id: &str) -> Result<AttachResponse, String> {
        let mut guard = self
            .connections
            .lock()
            .map_err(|_| "Connection state is unavailable".to_string())?;
        let entry = guard
            .get_mut(connection_id)
            .ok_or_else(|| "No active connection".to_string())?;
        entry.attached = true;
        entry.attachment_generation = entry.attachment_generation.wrapping_add(1);
        let events = entry
            .frontend_delivery_buffer
            .iter()
            .cloned()
            .collect();

        Ok(AttachResponse {
            contract_version: CONNECTION_EVENT_CONTRACT_VERSION,
            runtime_id: self.runtime_id.clone(),
            connection_id: connection_id.to_string(),
            session_id: entry.session_id,
            snapshot_revision: entry.snapshot_revision,
            event_sequence: entry.next_sequence,
            snapshot: entry.snapshot.clone(),
            events,
        })
    }

    fn detach(&self, connection_id: String, grace_period_ms: u64) -> Result<(), String> {
        let generation = {
            let mut guard = self
                .connections
                .lock()
                .map_err(|_| "Connection state is unavailable".to_string())?;
            let entry = guard
                .get_mut(&connection_id)
                .ok_or_else(|| "No active connection".to_string())?;
            entry.attached = false;
            entry.attachment_generation = entry.attachment_generation.wrapping_add(1);
            entry.attachment_generation
        };

        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_millis(grace_period_ms)).await;
            manager.expire_detached(&connection_id, generation);
        });
        Ok(())
    }

    fn expire_detached(&self, connection_id: &str, generation: u64) {
        if let Ok(mut guard) = self.connections.lock() {
            let should_remove = guard
                .get(connection_id)
                .map(|entry| !entry.attached && entry.attachment_generation == generation)
                .unwrap_or(false);
            if should_remove {
                if let Some(entry) = guard.remove(connection_id) {
                    let mut handle = entry.handle;
                    handle.stop();
                }
            }
        }
    }
}

const MAX_FRONTEND_DELIVERY_BUFFER_BYTES: usize = 1024 * 1024;

fn session_matches(current: u64, incoming: u64) -> bool {
    current == incoming
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
pub fn attach_mud_connection(
    state: State<'_, ConnectionManager>,
    connection_id: String,
) -> Result<AttachResponse, String> {
    state.attach(&connection_id)
}

#[tauri::command]
pub fn get_mud_connection_snapshot(
    state: State<'_, ConnectionManager>,
    connection_id: String,
) -> Result<ConnectionSnapshotResponse, String> {
    state.snapshot(&connection_id)
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
    let mut decoder = TelnetDecoder::default();

    loop {
        tokio::select! {
            biased;
            _ = stop_rx.changed() => {
                flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                emit_decoded_event(&manager, &app, &connection_id, session_id, decoder.flush(), &mut line_buffer);
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
                        emit_decoded_event(&manager, &app, &connection_id, session_id, decoder.flush(), &mut line_buffer);
                        break;
                    }
                }
            }
            result = stream.read(&mut buffer) => {
                match result {
                    Ok(0) => {
                        flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                        emit_decoded_event(&manager, &app, &connection_id, session_id, decoder.flush(), &mut line_buffer);
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
                        let raw_text = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
                        manager.emit_event(&app, &connection_id, session_id, ConnectionEvent::Raw { text: raw_text });
                        for event in decoder.feed(&buffer[..bytes_read]) {
                            emit_decoded_event(&manager, &app, &connection_id, session_id, Some(event), &mut line_buffer);
                        }
                    }
                    Err(error) => {
                        flush_line_buffer(&manager, &app, &connection_id, session_id, &mut line_buffer);
                        emit_decoded_event(&manager, &app, &connection_id, session_id, decoder.flush(), &mut line_buffer);
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
            contract_version: CONNECTION_EVENT_CONTRACT_VERSION,
            connection_id: connection_id.to_string(),
            session_id,
            sequence,
            event,
        },
    );
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
    frontend_delivery_buffer: VecDeque<ReplayEvent>,
    frontend_delivery_buffer_bytes: usize,
    attachment_generation: u64,
    attached: bool,
    next_sequence: u64,
    snapshot_revision: u64,
    snapshot: StructuredConnectionSnapshot,
}

#[tauri::command]
pub fn detach_mud_connection(
    state: State<'_, ConnectionManager>,
    connection_id: String,
    grace_period_ms: u64,
) -> Result<(), String> {
    state.detach(connection_id, grace_period_ms)
}

fn is_attachment_replayable(event: &ConnectionEvent) -> bool {
    matches!(event, ConnectionEvent::Data { .. })
}

fn replayable_event_bytes(event: &ConnectionEvent) -> usize {
    match event {
        ConnectionEvent::Data { text } => text.len(),
        _ => 0,
    }
}

fn update_authoritative_snapshot(entry: &mut ConnectionEntry, event: &ConnectionEvent) {
    let changed = match event {
        ConnectionEvent::Opened => {
            entry.snapshot.connection_status = "connected".to_string();
            entry.snapshot.last_error = None;
            true
        }
        ConnectionEvent::Closed { reason } => {
            entry.snapshot.connection_status = "closed".to_string();
            entry.snapshot.last_error = None;
            push_diagnostic(&mut entry.snapshot, reason);
            true
        }
        ConnectionEvent::Error { message } => {
            entry.snapshot.connection_status = "error".to_string();
            entry.snapshot.last_error = Some(message.clone());
            push_diagnostic(&mut entry.snapshot, message);
            true
        }
        ConnectionEvent::Structured { protocol, event_type, parse_status, error, .. } => {
            entry.snapshot.protocol_state = serde_json::json!({
                "protocol": format!("{protocol:?}"),
                "eventType": event_type,
                "parseStatus": format!("{parse_status:?}"),
            });
            if let Some(error) = error {
                push_diagnostic(&mut entry.snapshot, error);
            }
            true
        }
        ConnectionEvent::Raw { .. } | ConnectionEvent::Data { .. } => false,
    };
    if changed {
        entry.snapshot_revision += 1;
    }
}

fn push_diagnostic(snapshot: &mut StructuredConnectionSnapshot, message: &str) {
    snapshot.diagnostics.push(message.to_string());
    if snapshot.diagnostics.len() > MAX_SNAPSHOT_DIAGNOSTICS {
        snapshot.diagnostics.remove(0);
    }
}

const MAX_SNAPSHOT_DIAGNOSTICS: usize = 32;

fn emit_decoded_event(
    manager: &ConnectionManager,
    app: &AppHandle,
    connection_id: &str,
    session_id: u64,
    event: Option<DecodedEvent>,
    line_buffer: &mut LineBuffer,
) {
    let Some(event) = event else { return };
    match event {
        DecodedEvent::Text(bytes) => {
            for text in line_buffer.push(&bytes) {
                manager.emit_event(app, connection_id, session_id, ConnectionEvent::Data { text });
            }
        }
        DecodedEvent::Structured(event) => manager.emit_event(app, connection_id, session_id, event),
        DecodedEvent::Reply(bytes) => {
            manager.emit_event(
                app,
                connection_id,
                session_id,
                ConnectionEvent::Structured {
                    protocol: ProtocolFamily::Telnet,
                    event_type: "automatic-reply".to_string(),
                    direction: TrafficDirection::Outgoing,
                    payload: serde_json::json!({ "bytes": bytes.clone() }),
                    parse_status: ParseStatus::Parsed,
                    error: None,
                },
            );
            let _ = manager.send(connection_id, &bytes);
        }
    }
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
    Structured {
        protocol: ProtocolFamily,
        event_type: String,
        direction: TrafficDirection,
        payload: Value,
        parse_status: ParseStatus,
        error: Option<String>,
    },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProtocolFamily {
    Telnet,
    // Reserved for the protocol adapters tracked in PLAN_PROTOCOLS.md.
    #[allow(dead_code)]
    Mcp,
    #[allow(dead_code)]
    Gmcp,
    #[allow(dead_code)]
    Mcmp,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TrafficDirection {
    Incoming,
    Outgoing,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ParseStatus {
    Parsed,
    Malformed,
    // Reserved for protocol adapters that recognize but decline a message.
    #[allow(dead_code)]
    Unsupported,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionEventMessage {
    contract_version: u16,
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
            })
            .unwrap();
    }

    #[test]
    fn stale_worker_events_cannot_mutate_a_replacement() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 11);
        manager.record_event("world", 11, ConnectionEvent::Data { text: "old".into() });
        manager.replace("world".into(), 12, test_handle(), manager.list()[0].clone()).unwrap();

        assert!(manager.record_event("world", 11, ConnectionEvent::Data { text: "stale".into() }).is_none());
    }

    #[test]
    fn disconnect_removes_connection_and_stops_sending() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);
        manager.disconnect("world");

        assert!(manager.send("world", b"look").is_err());
    }

    #[test]
    fn detached_line_processing_keeps_order_and_flushes_partial_text() {
        let mut lines = LineBuffer::default();
        assert_eq!(lines.push(b"one\r\ntwo\nthree"), vec!["one\n", "two\n"]);
        assert_eq!(lines.flush(), vec!["three"]);
    }

    #[test]
    fn session_protection_rejects_stale_workers() {
        assert!(session_matches(4, 4));
        assert!(!session_matches(4, 5));
    }

    #[test]
    fn structured_snapshot_is_bounded_and_versioned_by_response() {
        let snapshot = StructuredConnectionSnapshot::default();
        assert!(snapshot.negotiated_capabilities.is_empty());
        assert_eq!(CONNECTION_EVENT_CONTRACT_VERSION, 1);
    }

    #[test]
    fn attachment_buffer_stores_incoming_data_but_not_status_events() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);
        manager.connections.lock().unwrap().get_mut("world").unwrap().attached = false;

        manager.record_event("world", 1, ConnectionEvent::Opened);
        manager.record_event("world", 1, ConnectionEvent::Data { text: "hello".into() });
        manager.record_event("world", 1, ConnectionEvent::Error { message: "old error".into() });

        let attach = manager.attach("world").unwrap();
        assert_eq!(attach.events.len(), 1);
        assert!(matches!(attach.events[0].event, ConnectionEvent::Data { .. }));
        assert_eq!(attach.snapshot.connection_status, "error");
        assert!(attach.snapshot_revision > 0);
    }

    #[test]
    fn attachment_buffer_uses_a_fixed_byte_budget() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);
        manager.connections.lock().unwrap().get_mut("world").unwrap().attached = false;

        manager.record_event("world", 1, ConnectionEvent::Data { text: "kept".into() });
        manager.record_event(
            "world",
            1,
            ConnectionEvent::Data { text: "x".repeat(MAX_FRONTEND_DELIVERY_BUFFER_BYTES + 1) },
        );

        let attach = manager.attach("world").unwrap();
        assert_eq!(attach.events.len(), 1);
    }

    #[test]
    fn attach_barrier_reports_event_sequence_after_retained_events() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);

        assert_eq!(manager.record_event("world", 1, ConnectionEvent::Data { text: "one".into() }), Some(1));
        assert_eq!(manager.record_event("world", 1, ConnectionEvent::Data { text: "two".into() }), Some(2));

        let attach = manager.attach("world").unwrap();
        assert_eq!(attach.event_sequence, 2);
        assert_eq!(attach.events.iter().map(|event| event.sequence).collect::<Vec<_>>(), vec![1, 2]);
    }

    #[test]
    fn replacement_session_starts_with_a_clean_attachment_buffer() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);
        manager.record_event("world", 1, ConnectionEvent::Data { text: "old".into() });

        let descriptor = manager.list().into_iter().next().unwrap();
        manager.replace("world".into(), 2, test_handle(), descriptor).unwrap();

        let attach = manager.attach("world").unwrap();
        assert_eq!(attach.session_id, 2);
        assert!(attach.events.is_empty());
        assert_eq!(attach.event_sequence, 0);
    }

    #[tokio::test]
    async fn reattach_cancels_grace_expiry_and_timeout_removes_connection() {
        let manager = ConnectionManager::default();
        install(&manager, "world", 1);

        manager.detach("world".into(), 10).unwrap();
        manager.attach("world").unwrap();
        sleep(Duration::from_millis(25)).await;
        assert!(manager.attach("world").is_ok());

        manager.detach("world".into(), 10).unwrap();
        sleep(Duration::from_millis(25)).await;
        assert!(manager.attach("world").is_err());
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
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayEvent {
    pub sequence: u64,
    pub session_id: u64,
    #[serde(flatten)]
    pub event: ConnectionEvent,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachResponse {
    pub contract_version: u16,
    pub runtime_id: String,
    pub connection_id: String,
    pub session_id: u64,
    pub snapshot_revision: u64,
    pub event_sequence: u64,
    pub snapshot: StructuredConnectionSnapshot,
    pub events: Vec<ReplayEvent>,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StructuredConnectionSnapshot {
    pub connection_status: String,
    pub last_error: Option<String>,
    pub negotiated_capabilities: Vec<String>,
    pub protocol_state: Value,
    pub diagnostics: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSnapshotResponse {
    pub contract_version: u16,
    pub runtime_id: String,
    pub connection_id: String,
    pub session_id: u64,
    pub sequence: u64,
    pub snapshot_revision: u64,
    pub snapshot: StructuredConnectionSnapshot,
}
