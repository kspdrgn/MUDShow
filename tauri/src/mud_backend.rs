use std::{
    io::{self, Read, Write},
    net::{Shutdown, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread::{self, JoinHandle},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

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
) -> Result<(), String> {
    let handle = open_connection(app, &host, port, tls)?;
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
) -> Result<ConnectionHandle, String> {
    let stream = connect_stream(host, port, tls)?;
    let reader_stream = stream
        .try_clone()
        .map_err(|error| format!("Failed to clone connection stream: {error}"))?;
    reader_stream
        .set_read_timeout(Some(READ_TIMEOUT))
        .map_err(|error| format!("Failed to configure connection timeout: {error}"))?;

    let stop_requested = std::sync::Arc::new(AtomicBool::new(false));
    let active = std::sync::Arc::new(AtomicBool::new(true));

    let reader_stop = std::sync::Arc::clone(&stop_requested);
    let reader_active = std::sync::Arc::clone(&active);
    let reader_app = app.clone();
    let reader = thread::spawn(move || {
        read_connection(reader_stream, reader_stop, reader_active, reader_app);
    });

    Ok(ConnectionHandle {
        stop_requested,
        active,
        stream,
        reader: Some(reader),
    })
}

fn connect_stream(host: &str, port: u16, tls: bool) -> Result<TcpStream, String> {
    if tls {
        return Err("TLS connections are not supported in the native Rust backend yet".to_string());
    }

    let host = normalize_connect_host(host);
    let address = format!("{host}:{port}");
    let tcp = TcpStream::connect(&address)
        .map_err(|error| format!("Failed to connect to {address}: {error}"))?;
    tcp.set_nodelay(true)
        .map_err(|error| format!("Failed to configure TCP socket: {error}"))?;

    Ok(tcp)
}

fn normalize_connect_host(host: &str) -> &str {
    match host {
        "0.0.0.0" | "::" => "127.0.0.1",
        _ => host,
    }
}

fn read_connection(
    mut stream: TcpStream,
    stop_requested: std::sync::Arc<AtomicBool>,
    active: std::sync::Arc<AtomicBool>,
    app: AppHandle,
) {
    let mut buffer = [0u8; 8192];

    while !stop_requested.load(Ordering::SeqCst) {
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
    stream: TcpStream,
    reader: Option<JoinHandle<()>>,
}

impl ConnectionHandle {
    fn mark_active(&mut self) {
        self.stop_requested.store(false, Ordering::SeqCst);
        self.active.store(true, Ordering::SeqCst);
    }

    fn stop(&mut self) {
        self.stop_requested.store(true, Ordering::SeqCst);
        self.active.store(false, Ordering::SeqCst);

        let _ = self.stream.shutdown(Shutdown::Both);

        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }

    fn send(&self, bytes: &[u8]) -> Result<(), String> {
        if !self.active.load(Ordering::SeqCst) {
            return Err("No active connection".to_string());
        }

        (&self.stream)
            .write_all(bytes)
            .map_err(|error| format!("Failed to send data: {error}"))
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ConnectionEvent {
    Data { text: String },
    Closed { reason: String },
    Error { message: String },
}
