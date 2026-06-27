mod mud_backend;
mod storage;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(mud_backend::ConnectionManager::default())
        .invoke_handler(tauri::generate_handler![
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
