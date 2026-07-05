mod mud_backend;
mod storage;

use tauri::{Manager, Window};

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

fn main() {
    tauri::Builder::default()
        .manage(mud_backend::ConnectionManager::default())
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            mud_backend::connect_mud,
            mud_backend::send_mud,
            mud_backend::disconnect_mud,
            storage::load_app_storage,
            storage::save_app_storage,
        ])
        .build(tauri::generate_context!())
        .expect("error while building MUDShow")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                app_handle
                    .state::<mud_backend::ConnectionManager>()
                    .disconnect();
            }
            _ => {}
        });
}
