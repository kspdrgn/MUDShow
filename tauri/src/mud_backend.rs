use std::{
    io::{self, Read, Write},
    net::TcpStream,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, Sender, TryRecvError},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use native_tls::{TlsConnector, TlsStream};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

// Keep outbound sends wake-on-send while letting idle reads sleep longer to save power.
const READ_TIMEOUT: Duration = Duration::from_millis(250);
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
pub fn connect_mud(
    app: AppHandle,
    state: State<'_, ConnectionManager>,
    host: String,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<(), String> {
    let handle = open_connection(app, &host, port, tls, verify_certificate)?;
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

fn open_connection(
    app: AppHandle,
    host: &str,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<ConnectionHandle, String> {
    let stream = connect_stream(host, port, tls, verify_certificate)?;
    let (outgoing_tx, outgoing_rx) = mpsc::channel();

    let stop_requested = Arc::new(AtomicBool::new(false));
    let active = Arc::new(AtomicBool::new(true));

    let worker_stop = Arc::clone(&stop_requested);
    let worker_active = Arc::clone(&active);
    let worker_app = app.clone();
    let worker = thread::spawn(move || {
        run_connection(stream, outgoing_rx, worker_stop, worker_active, worker_app);
    });

    Ok(ConnectionHandle {
        stop_requested,
        active,
        outgoing_tx: Some(outgoing_tx),
        worker: Some(worker),
    })
}

fn connect_stream(
    host: &str,
    port: u16,
    tls: bool,
    verify_certificate: bool,
) -> Result<ConnectionStream, String> {
    let host = normalize_connect_host(host);
    let address = format!("{host}:{port}");
    let tcp = TcpStream::connect(&address)
        .map_err(|error| format!("Failed to connect to {address}: {error}"))?;
    tcp.set_nodelay(true)
        .map_err(|error| format!("Failed to configure TCP socket: {error}"))?;
    tcp.set_read_timeout(Some(READ_TIMEOUT))
        .map_err(|error| format!("Failed to configure connection timeout: {error}"))?;

    if tls {
        let mut builder = TlsConnector::builder();
        builder.danger_accept_invalid_certs(!verify_certificate);
        let connector = builder
            .build()
            .map_err(|error| format!("Failed to initialize TLS connector: {error}"))?;
        let stream = connector
            .connect(host, tcp)
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

fn run_connection(
    mut stream: ConnectionStream,
    outgoing_rx: Receiver<Vec<u8>>,
    stop_requested: std::sync::Arc<AtomicBool>,
    active: std::sync::Arc<AtomicBool>,
    app: AppHandle,
) {
    let mut buffer = [0u8; 8192];

    while !stop_requested.load(Ordering::SeqCst) {
        loop {
            match outgoing_rx.try_recv() {
                Ok(bytes) => {
                    if let Err(error) = stream.write_all(&bytes) {
                        active.store(false, Ordering::SeqCst);
                        if !stop_requested.load(Ordering::SeqCst) {
                            emit_event(
                                &app,
                                ConnectionEvent::Error {
                                    message: format!("Failed to send data: {error}"),
                                },
                            );
                        }
                        return;
                    }
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => break,
            }
        }

        let result = stream.read(&mut buffer);

        match result {
            Ok(0) => {
                active.store(false, Ordering::SeqCst);
                if !stop_requested.load(Ordering::SeqCst) {
                    emit_event(
                        &app,
                        ConnectionEvent::Closed {
                            reason: "Remote host closed the connection".to_string(),
                        },
                    );
                }
                return;
            }
            Ok(bytes_read) => {
                let cleaned = strip_telnet(&buffer[..bytes_read]);
                if !cleaned.is_empty() {
                    let text = String::from_utf8_lossy(&cleaned).replace("\r\n", "\n");
                    emit_event(&app, ConnectionEvent::Data { text });
                }
            }
            Err(error)
                if error.kind() == io::ErrorKind::WouldBlock
                    || error.kind() == io::ErrorKind::TimedOut => {}
            Err(error) => {
                active.store(false, Ordering::SeqCst);
                if !stop_requested.load(Ordering::SeqCst) {
                    emit_event(
                        &app,
                        ConnectionEvent::Error {
                            message: format!("Connection error: {error}"),
                        },
                    );
                }
                return;
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
    stop_requested: std::sync::Arc<AtomicBool>,
    active: std::sync::Arc<AtomicBool>,
    outgoing_tx: Option<Sender<Vec<u8>>>,
    worker: Option<JoinHandle<()>>,
}

impl ConnectionHandle {
    fn mark_active(&mut self) {
        self.stop_requested.store(false, Ordering::SeqCst);
        self.active.store(true, Ordering::SeqCst);
    }

    fn stop(&mut self) {
        self.stop_requested.store(true, Ordering::SeqCst);
        self.active.store(false, Ordering::SeqCst);

        self.outgoing_tx.take();

        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
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
    Tls(TlsStream<TcpStream>),
}

impl ConnectionStream {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        match self {
            ConnectionStream::Plain(stream) => stream.read(buffer),
            ConnectionStream::Tls(stream) => stream.read(buffer),
        }
    }

    fn write_all(&mut self, bytes: &[u8]) -> io::Result<()> {
        match self {
            ConnectionStream::Plain(stream) => stream.write_all(bytes),
            ConnectionStream::Tls(stream) => stream.write_all(bytes),
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
