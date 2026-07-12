mod mud_backend;
mod storage;

use std::process::Command;

use tauri::{Manager, Window};
use tauri_runtime::ResizeDirection;

#[tauri::command]
fn window_minimize(window: Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: Window) {
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
    let _ = window.close();
}

#[tauri::command]
fn window_start_dragging(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_start_resize_dragging(window: Window, direction: String) -> Result<(), String> {
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

fn main() {
    tauri::Builder::default()
        .manage(mud_backend::ConnectionManager::default())
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_dragging,
            window_start_resize_dragging,
            open_external_url,
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
            storage::append_session_log,
            storage::rename_session_log,
            storage::reveal_session_log_file,
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
