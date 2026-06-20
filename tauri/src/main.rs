use std::{
  process::{Child, Command, Stdio},
  sync::Mutex,
};

use tauri::{AppHandle, Manager, RunEvent, Runtime, State};

#[derive(Default)]
struct SidecarProcess(Mutex<Option<Child>>);

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(not(debug_assertions)) {
        let child = start_sidecar(app.handle())?;
        app.manage(SidecarProcess(Mutex::new(Some(child))));
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building MUDShow")
    .run(|app_handle, event| match event {
      RunEvent::ExitRequested { .. } | RunEvent::Exit => {
        if cfg!(not(debug_assertions)) {
          stop_sidecar(&app_handle.state::<SidecarProcess>());
        }
      }
      _ => {}
    });
}

fn start_sidecar<R: Runtime>(app_handle: &AppHandle<R>) -> Result<Child, Box<dyn std::error::Error>> {
  let resource_dir = app_handle.path().resource_dir()?;
  let node_path = resource_dir.join("node.exe");
  let proxy_path = resource_dir.join("backend").join("proxy.js");

  if !node_path.exists() {
    return Err(format!("Missing packaged Node runtime at {}", node_path.display()).into());
  }

  if !proxy_path.exists() {
    return Err(format!("Missing packaged proxy at {}", proxy_path.display()).into());
  }

  let child = Command::new(node_path)
    .arg(proxy_path)
    .env("MUDSHOW_DISABLE_HTTP", "1")
    .stdout(Stdio::inherit())
    .stderr(Stdio::inherit())
    .spawn()?;

  Ok(child)
}

fn stop_sidecar(state: &State<'_, SidecarProcess>) {
  if let Ok(mut guard) = state.0.lock() {
    if let Some(mut child) = guard.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}
