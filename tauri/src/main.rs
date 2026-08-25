#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fonts;
mod mud_backend;
mod storage;
mod spellcheck;

use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Listener, Manager, State, UserAttentionType, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowBuilder};
use tauri_runtime::ResizeDirection;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowHostPoint {
    x: f64,
    y: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowHostSize {
    width: f64,
    height: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowHostRecord {
    id: String,
    kind: String,
    surface_id: String,
    title: String,
    is_modal: bool,
    placement: String,
    position: WindowHostPoint,
    size: WindowHostSize,
    can_backdrop_dismiss: bool,
    can_escape_dismiss: bool,
    can_pop_out: bool,
    can_move_in_app: bool,
}

#[derive(Default)]
struct WindowHostRegistry {
    records: Mutex<HashMap<String, WindowHostRecord>>,
}

#[derive(Default)]
struct PlainWindowRegistry {
    windows: Mutex<HashMap<String, Window>>,
}

#[derive(Default)]
struct PlainWebviewWindowRegistry {
    windows: Mutex<HashMap<String, WebviewWindow>>,
}

static PLAIN_WEBVIEW_WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(1);

fn create_window_label(window_id: &str) -> String {
    format!("window-host-{window_id}")
}

#[tauri::command]
fn window_host_get_record(
    registry: State<'_, WindowHostRegistry>,
    window_id: String,
) -> Option<WindowHostRecord> {
    eprintln!("[window-action] host get record requested: {window_id}");
    registry
        .records
        .lock()
        .ok()
        .and_then(|records| records.get(&window_id).cloned())
}

#[tauri::command]
async fn window_host_pop_out(
    app: AppHandle,
    registry: State<'_, WindowHostRegistry>,
    window_record: WindowHostRecord,
) -> Result<(), String> {
    let window_id = window_record.id.clone();
    let label = create_window_label(&window_id);
    let label_for_log = label.clone();
    eprintln!(
        "[window-action] host pop out requested: id={} label={} title={}",
        window_id, label, window_record.title
    );

    {
        let mut records = registry
            .records
            .lock()
            .map_err(|_| String::from("window host registry is unavailable"))?;
        records.insert(window_record.id.clone(), window_record.clone());
    }

    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let main_webview = app
        .get_webview_window("main")
        .ok_or_else(|| String::from("main webview window not found"))?;
    let webview_url = WebviewUrl::App(
        format!("index.html?windowMode=popout&windowId={}", window_record.id).into(),
    );

    let attach_app = app.clone();
    let attach_label = label.clone();
    let attach_window_id = window_id.clone();
    main_webview
        .with_webview(move |platform_webview| {
            eprintln!(
                "[window-action] host pop out attach callback started: id={} label={}",
                attach_window_id, attach_label
            );

            let builder = WebviewWindowBuilder::new(&attach_app, &attach_label, webview_url)
                .on_page_load(|webview_window, payload| match payload.event() {
                    PageLoadEvent::Started => {
                        eprintln!(
                            "[window-event] page load started: window={} url={}",
                            webview_window.label(),
                            payload.url()
                        );
                    }
                    PageLoadEvent::Finished => {
                        eprintln!(
                            "[window-event] page load finished: window={} url={}",
                            webview_window.label(),
                            payload.url()
                        );
                    }
                })
                .title(window_record.title)
                .inner_size(window_record.size.width, window_record.size.height)
                .position(window_record.position.x, window_record.position.y)
                .closable(true)
                .decorations(true)
                .visible(true);

            #[cfg(target_os = "windows")]
            let builder = builder.with_environment(platform_webview.environment());

            #[cfg(not(target_os = "windows"))]
            let builder = builder;

            if let Err(error) = builder.build() {
                eprintln!(
                    "[window-action] host pop out build failed: id={} label={} error={error}",
                    attach_window_id, attach_label
                );
            }
        })
        .map_err(|error| error.to_string())?;

    eprintln!(
        "[window-action] host pop out completed: id={} label={}",
        window_id, label_for_log
    );
    Ok(())
}

#[tauri::command]
async fn window_open_plain_native_window(app: AppHandle) -> Result<(), String> {
    let label = "plain-native-window";
    eprintln!("[window-action] plain native window requested: label={label}");

    if app.get_webview_window(label).is_some() {
        eprintln!("[window-action] plain native window already open: label={label}");
        return Ok(());
    }

    let window = WindowBuilder::new(&app, label)
        .title("plain native window")
        .inner_size(640.0, 360.0)
        .visible(true)
        .build()
        .map_err(|error| error.to_string())?;

    {
        let plain_label = label.to_string();
        window.on_window_event(move |event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                eprintln!(
                    "[window-event] plain native window close requested: label={}",
                    plain_label
                );
            }
            tauri::WindowEvent::Destroyed => {
                eprintln!(
                    "[window-event] plain native window destroyed: label={}",
                    plain_label
                );
            }
            tauri::WindowEvent::Focused(focused) => {
                eprintln!(
                    "[window-event] plain native window focused: label={} focused={focused}",
                    plain_label
                );
            }
            _ => {}
        });
    }

    eprintln!(
        "[window-action] plain native window initial state: label={label} visible={:?} focused={:?}",
        window.is_visible(),
        window.is_focused()
    );

    if let Some(registry) = app.try_state::<PlainWindowRegistry>() {
        let mut windows = registry
            .windows
            .lock()
            .map_err(|_| String::from("plain native window registry is unavailable"))?;
        windows.insert(label.to_string(), window.clone());
        eprintln!("[window-action] plain native window retained in registry: label={label}");
    } else {
        eprintln!("[window-action] plain native window registry missing: label={label}");
    }

    {
        let trace_app = app.clone();
        let trace_label = label.to_string();
        std::thread::spawn(move || {
            for delay_ms in [50_u64, 250, 1000] {
                std::thread::sleep(Duration::from_millis(delay_ms));
                let state = trace_app
                    .state::<PlainWindowRegistry>()
                    .windows
                    .lock()
                    .ok()
                    .and_then(|windows| windows.get(&trace_label).cloned());
                match state {
                    Some(trace_window) => {
                        let visible = trace_window.is_visible();
                        let focused = trace_window.is_focused();
                        eprintln!(
                            "[window-action] plain native window delayed state: label={} delay_ms={} visible={:?} focused={:?}",
                            trace_label,
                            delay_ms,
                            visible,
                            focused
                        );
                    }
                    None => {
                        eprintln!(
                            "[window-action] plain native window delayed state: label={} delay_ms={} window_missing",
                            trace_label,
                            delay_ms
                        );
                    }
                }
            }
        });
    }

    eprintln!("[window-action] plain native window completed: label={label}");
    Ok(())
}

#[tauri::command]
async fn window_open_plain_webview_window(app: AppHandle) -> Result<(), String> {
    let window_index = PLAIN_WEBVIEW_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let window_label = format!("plain-webview-window-{window_index}");
    eprintln!("[window-action] plain webview window requested: label={window_label}");

    if app.get_webview_window(&window_label).is_some() {
        eprintln!("[window-action] plain webview window already open: label={window_label}");
        return Ok(());
    }

    let main_webview = app
        .get_webview_window("main")
        .ok_or_else(|| String::from("main webview window not found"))?;

    let attach_app = app.clone();
    let attach_window_label = window_label.clone();
    main_webview
        .with_webview(move |platform_webview| {
            eprintln!(
                "[window-action] plain webview attach callback started: window={}",
                attach_window_label
            );

            let builder = WebviewWindowBuilder::new(
                &attach_app,
                &attach_window_label,
                WebviewUrl::App("/plain-webview.html".into()),
            )
            .title("plain webview window")
            .inner_size(640.0, 360.0)
            .visible(true)
            .on_document_title_changed(|webview_window, title| {
                eprintln!(
                    "[window-event] plain webview document title changed: window={} title={}",
                    webview_window.label(),
                    title
                );
            })
            .on_navigation(|url| {
                eprintln!("[window-event] plain webview navigation requested: url={url}");
                true
            })
            .on_new_window(|url, _features| {
                eprintln!("[window-event] plain webview new window requested: url={url}");
                NewWindowResponse::Deny
            })
            .on_download(|webview, event| {
                match event {
                    DownloadEvent::Requested { url, destination } => {
                        eprintln!(
                            "[window-event] plain webview download requested: webview={} url={} destination={:?}",
                            webview.label(),
                            url,
                            destination
                        );
                    }
                    DownloadEvent::Finished { url, path, success } => {
                        eprintln!(
                            "[window-event] plain webview download finished: webview={} url={} path={:?} success={}",
                            webview.label(),
                            url,
                            path,
                            success
                        );
                    }
                    _ => {}
                }
                true
            })
            .on_page_load(|webview_window, payload| match payload.event() {
                PageLoadEvent::Started => {
                    eprintln!(
                        "[window-event] plain webview page load started: window={} url={}",
                        webview_window.label(),
                        payload.url()
                    );
                }
                PageLoadEvent::Finished => {
                    eprintln!(
                        "[window-event] plain webview page load finished: window={} url={}",
                        webview_window.label(),
                        payload.url()
                    );
                }
            })
            .on_web_resource_request(|request, response| {
                eprintln!(
                    "[window-event] plain webview web resource request: uri={}",
                    request.uri()
                );
                if let Some(content_type) = response.headers().get("content-type") {
                    eprintln!(
                        "[window-event] plain webview web resource response: content-type={:?}",
                        content_type
                    );
                }
            })
            .initialization_script(
                r#"
                  console.log('[window-action] plain webview init script boot', {
                    href: window.location.href,
                    readyState: document.readyState,
                  });
                "#,
            )
            .initialization_script_for_all_frames(
                r#"
                  console.log('[window-action] plain webview init script all frames boot', {
                    href: window.location.href,
                    readyState: document.readyState,
                  });
                "#,
            );

            #[cfg(target_os = "windows")]
            let builder = builder.with_environment(platform_webview.environment());

            #[cfg(not(target_os = "windows"))]
            let builder = builder;

            let webview_window = match builder.build() {
                Ok(webview_window) => webview_window,
                Err(error) => {
                    eprintln!(
                        "[window-action] plain webview build failed: label={} error={error}",
                        attach_window_label
                    );
                    return;
                }
            };

            if let Some(registry) = attach_app.try_state::<PlainWebviewWindowRegistry>() {
                if let Ok(mut windows) = registry.windows.lock() {
                    windows.insert(attach_window_label.clone(), webview_window.clone());
                    eprintln!(
                        "[window-action] plain webview window retained in registry: label={}",
                        attach_window_label
                    );
                } else {
                    eprintln!(
                        "[window-action] plain webview registry lock failed: label={}",
                        attach_window_label
                    );
                }
            }

            match webview_window.url() {
                Ok(url) => {
                    eprintln!(
                        "[window-action] plain webview attached url: label={} url={url}",
                        attach_window_label
                    );
                }
                Err(error) => {
                    eprintln!(
                        "[window-action] plain webview attached url failed: label={} error={error}",
                        attach_window_label
                    );
                }
            }

            if let Err(error) = webview_window.eval(
                "console.log('[window-action] plain webview rust eval probe', { href: window.location.href, readyState: document.readyState, visibilityState: document.visibilityState });",
            ) {
                eprintln!(
                    "[window-action] plain webview eval probe failed: label={} error={error}",
                    attach_window_label
                );
            } else {
                eprintln!(
                    "[window-action] plain webview eval probe scheduled: label={}",
                    attach_window_label
                );
            }

            {
                let window_label = attach_window_label.clone();
                webview_window.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { .. } => {
                        eprintln!(
                            "[window-event] plain webview window close requested: label={}",
                            window_label
                        );
                    }
                    tauri::WindowEvent::Destroyed => {
                        eprintln!(
                            "[window-event] plain webview window destroyed: label={}",
                            window_label
                        );
                    }
                    tauri::WindowEvent::Focused(focused) => {
                        eprintln!(
                            "[window-event] plain webview window focused: label={} focused={focused}",
                            window_label
                        );
                    }
                    _ => {}
                });
            }

            {
                let webview_label = attach_window_label.clone();
                webview_window.on_webview_event(move |event| {
                    eprintln!(
                        "[window-event] plain webview webview event: label={} event={:?}",
                        webview_label,
                        event
                    );
                });
            }

            let probe_webview = webview_window.clone();
            let probe_label = attach_window_label.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(100));
                match probe_webview.url() {
                    Ok(url) => {
                        eprintln!(
                            "[window-action] plain webview delayed attached url: label={} url={}",
                            probe_label,
                            url
                        );
                    }
                    Err(error) => {
                        eprintln!(
                            "[window-action] plain webview delayed url failed: label={} error={error}",
                            probe_label
                        );
                    }
                }
            });
        })
        .map_err(|error| error.to_string())?;

    eprintln!(
        "[window-action] plain webview initial state: label={window_label} visible={:?} focused={:?}",
        app.get_webview_window(&window_label)
            .map(|webview_window| webview_window.is_visible()),
        app.get_webview_window(&window_label)
            .map(|webview_window| webview_window.is_focused())
    );

    {
        let trace_app = app.clone();
        let trace_label = window_label.clone();
        std::thread::spawn(move || {
            for delay_ms in [25_u64, 100, 250, 1000] {
                std::thread::sleep(Duration::from_millis(delay_ms));
                let state = trace_app.get_webview_window(&trace_label);
                match state {
                    Some(trace_window) => {
                        let visible = trace_window.is_visible();
                        let focused = trace_window.is_focused();
                        eprintln!(
                            "[window-action] plain webview delayed state: label={} delay_ms={} visible={:?} focused={:?}",
                            trace_label,
                            delay_ms,
                            visible,
                            focused
                        );
                    }
                    None => {
                        eprintln!(
                            "[window-action] plain webview delayed state: label={} delay_ms={} window_missing",
                            trace_label,
                            delay_ms
                        );
                    }
                }
            }
        });
    }

    eprintln!("[window-action] plain webview window completed: label={window_label}");
    Ok(())
}

#[tauri::command]
fn window_host_pop_in(
    app: AppHandle,
    window: Window,
    registry: State<'_, WindowHostRegistry>,
    window_id: String,
) -> Result<(), String> {
    eprintln!(
        "[window-action] host pop in requested: id={window_id} from window={}",
        window.label()
    );
    if let Ok(mut records) = registry.records.lock() {
        records.remove(&window_id);
    }

    app.emit("window-host:pop-in-requested", window_id.clone())
        .map_err(|error| error.to_string())?;

    eprintln!(
        "[window-action] host pop in closing native window: id={window_id} window={}",
        window.label()
    );
    let close_result = window.close();
    eprintln!(
        "[window-action] host pop in close result: id={window_id} window={} result={:?}",
        window.label(),
        close_result
    );
    eprintln!("[window-action] host pop in completed: id={window_id}");
    Ok(())
}

#[tauri::command]
fn window_host_discard(
    app: AppHandle,
    registry: State<'_, WindowHostRegistry>,
    window_id: String,
) -> Result<(), String> {
    eprintln!("[window-action] host discard requested: id={window_id}");
    {
        let mut records = registry
            .records
            .lock()
            .map_err(|_| String::from("window host registry is unavailable"))?;
        records.remove(&window_id);
    }

    let label = create_window_label(&window_id);
    if let Some(webview_window) = app.get_webview_window(&label) {
        eprintln!("[window-action] destroying discarded native window: id={window_id} label={label}");
        if let Err(error) = webview_window.destroy() {
            eprintln!("[window-action] discarded native window destroy failed: id={window_id} error={error}");
        }
    }

    app.emit("window-host:discarded", window_id.clone())
        .map_err(|error| error.to_string())?;
    eprintln!("[window-action] host discard completed: id={window_id}");
    Ok(())
}

#[tauri::command]
fn window_minimize(window: Window) {
    eprintln!("[window-action] minimize requested: window={}", window.label());
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: Window) {
    eprintln!(
        "[window-action] toggle maximize requested: window={}",
        window.label()
    );
    #[cfg(target_os = "macos")]
    {
        let _ = window.zoom();
        return;
    }

    #[cfg(not(target_os = "macos"))]
    match window.is_maximized() {
        Ok(true) => {
            let _ = window.unmaximize();
        }
        Ok(false) => {
            let _ = window.maximize();
        }
        Err(error) => {
            eprintln!("failed to read window state: {error}");
        }
    }
}

#[tauri::command]
fn window_close(window: Window) {
    eprintln!("[window-action] close requested: window={}", window.label());
    let close_result = window.close();
    eprintln!(
        "[window-action] close result: window={} result={:?}",
        window.label(),
        close_result
    );
}

#[tauri::command]
fn window_request_attention(window: Window, enabled: bool) -> Result<(), String> {
    let request_type = enabled.then_some(UserAttentionType::Informational);
    eprintln!(
        "[window-action] request attention: window={} enabled={enabled}",
        window.label()
    );
    window
        .request_user_attention(request_type)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn window_start_dragging(window: Window) -> Result<(), String> {
    eprintln!(
        "[window-action] start dragging requested: window={}",
        window.label()
    );
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_start_resize_dragging(window: Window, direction: String) -> Result<(), String> {
    eprintln!(
        "[window-action] start resize dragging requested: window={} direction={direction}",
        window.label()
    );
    let direction = match direction.as_str() {
        "east" => ResizeDirection::East,
        "north" => ResizeDirection::North,
        "northeast" => ResizeDirection::NorthEast,
        "northwest" => ResizeDirection::NorthWest,
        "south" => ResizeDirection::South,
        "southeast" => ResizeDirection::SouthEast,
        "southwest" => ResizeDirection::SouthWest,
        "west" => ResizeDirection::West,
        _ => {
            return Err(format!("unsupported resize direction: {direction}"));
        }
    };

    window
        .start_resize_dragging(direction)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(String::from("only http and https URLs can be opened"));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|error| format!("failed to open the external URL: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|error| format!("failed to open the external URL: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|error| format!("failed to open the external URL: {error}"))?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = url;
        Err(String::from(
            "opening external URLs is not supported on this platform",
        ))
    }
}

#[cfg(any(debug_assertions, feature = "devtools"))]
#[tauri::command]
fn window_open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    eprintln!("[window-action] open devtools requested: target=main");
    let webview_window = app
        .get_webview_window("main")
        .ok_or_else(|| String::from("main webview window not found"))?;

    webview_window.open_devtools();
    eprintln!("[window-action] open devtools completed: target=main");
    Ok(())
}

#[cfg(not(any(debug_assertions, feature = "devtools")))]
#[tauri::command]
fn window_open_devtools() -> Result<(), String> {
    Err(String::from(
        "the web inspector is only available in debug builds or when the devtools feature is enabled",
    ))
}

fn main() {
    tauri::Builder::default()
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                eprintln!(
                    "[window-event] close requested: window={}",
                    window.label()
                );
            }
            tauri::WindowEvent::Destroyed => {
                eprintln!("[window-event] destroyed: window={}", window.label());
            }
            tauri::WindowEvent::Focused(focused) => {
                eprintln!(
                    "[window-event] focused: window={} focused={focused}",
                    window.label()
                );
            }
            _ => {}
        })
        .setup(|app| {
            app.listen_any("tauri://window-created", |event| {
                eprintln!(
                    "[window-event] tauri window created: id={} payload={}",
                    event.id(),
                    event.payload()
                );
            });
            app.listen_any("tauri://webview-created", |event| {
                eprintln!(
                    "[window-event] tauri webview created: id={} payload={}",
                    event.id(),
                    event.payload()
                );
            });
            app.listen_any("tauri://error", |event| {
                eprintln!(
                    "[window-event] tauri error: id={} payload={}",
                    event.id(),
                    event.payload()
                );
            });
            app.listen_any("tauri://created", |event| {
                eprintln!(
                    "[window-event] tauri created: id={} payload={}",
                    event.id(),
                    event.payload()
                );
            });
            Ok(())
        })
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(mud_backend::ConnectionManager::default())
        .manage(spellcheck::SpellcheckManager::default())
        .setup(|app| {
            let default_storage_path = match storage::default_storage_path(app.handle()) {
                Ok(path) => path,
                Err(error) => {
                    return Err(Box::new(tauri::Error::Setup(
                        Box::<dyn std::error::Error>::from(std::io::Error::other(error)).into(),
                    )));
                }
            };
            app.manage(storage::StorageLocationState::new(default_storage_path));
            app.manage(WindowHostRegistry::default());
            app.manage(PlainWindowRegistry::default());
            app.manage(PlainWebviewWindowRegistry::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_request_attention,
            window_start_dragging,
            window_start_resize_dragging,
            window_open_devtools,
            window_open_plain_native_window,
            window_open_plain_webview_window,
            window_host_get_record,
            window_host_pop_out,
            window_host_pop_in,
            window_host_discard,
            open_external_url,
            fonts::list_system_fonts,
            fonts::validate_system_font,
            mud_backend::connect_mud,
            mud_backend::send_mud,
            mud_backend::disconnect_mud,
            storage::set_app_storage_path,
            storage::get_app_storage_path,
            storage::load_app_storage,
            storage::save_app_storage,
            storage::reveal_app_storage_file,
            storage::pick_app_storage_file,
            storage::move_app_storage_file,
            storage::move_default_log_folder,
            storage::reveal_default_log_folder,
            storage::resolve_default_log_folder,
            storage::get_default_log_folder,
            storage::create_session_log,
            storage::path_exists,
            storage::append_session_log,
            storage::rename_session_log,
            storage::reveal_session_log_file,
            spellcheck::spellcheck_check,
            spellcheck::spellcheck_suggest,
            spellcheck::spellcheck_add,
        ])
        .build(tauri::generate_context!())
        .expect("error while building MUDShow")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                app_handle
                    .state::<mud_backend::ConnectionManager>()
                    .disconnect_all();
            }
            _ => {}
        });
}
