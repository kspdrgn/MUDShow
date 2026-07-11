use std::ffi::OsString;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

const STORAGE_FILE_NAME: &str = "mudshow-data.json";

pub struct StorageLocationState {
    path: Mutex<PathBuf>,
}

impl StorageLocationState {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path: Mutex::new(path),
        }
    }

    fn current_path(&self) -> Result<PathBuf, String> {
        self.path
            .lock()
            .map(|guard| guard.clone())
            .map_err(|_| String::from("failed to read storage path state"))
    }

    fn set_path(&self, path: PathBuf) -> Result<(), String> {
        self.path
            .lock()
            .map(|mut guard| {
                *guard = path;
            })
            .map_err(|_| String::from("failed to update storage path state"))
    }
}

pub fn default_storage_path<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let storage_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve app local data directory: {error}"))?;
    Ok(storage_dir.join(STORAGE_FILE_NAME))
}

fn storage_path<R: tauri::Runtime>(
    app: &AppHandle<R>,
    storage: &State<'_, StorageLocationState>,
) -> Result<PathBuf, String> {
    let current = storage.current_path()?;
    if current.is_file() {
        return Ok(current);
    }

    let default_path = default_storage_path(app)?;
    if current != default_path {
        storage.set_path(default_path.clone())?;
    }

    Ok(default_path)
}

fn temp_storage_path(path: &Path) -> PathBuf {
    let mut temp_name: OsString = path.as_os_str().to_os_string();
    temp_name.push(".tmp");
    PathBuf::from(temp_name)
}

fn storage_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(STORAGE_FILE_NAME)
        .to_string()
}

fn storage_dir_from_path(path: &Path) -> PathBuf {
    path.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."))
}

fn set_storage_path_from_setting<R: tauri::Runtime>(
    app: &AppHandle<R>,
    storage: &State<'_, StorageLocationState>,
    path: Option<String>,
) -> Result<String, String> {
    let candidate = path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);

    let resolved = match candidate {
        Some(path) if path.is_file() => path,
        _ => default_storage_path(app)?,
    };

    storage.set_path(resolved.clone())?;
    Ok(resolved.display().to_string())
}

fn create_parent_dirs(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to prepare storage directory {}: {error}",
                parent.display()
            )
        })?;
    }

    Ok(())
}

fn reveal_file_in_file_manager(path: &Path) -> Result<(), String> {
    let parent = storage_dir_from_path(path);

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(|error| format!("failed to open file explorer: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|error| format!("failed to open Finder: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let file_uri = path_to_file_uri(path);
        let attempts = [
            (
                "dbus-send",
                vec![
                    String::from("--session"),
                    String::from("--dest=org.freedesktop.FileManager1"),
                    String::from("--type=method_call"),
                    String::from("/org/freedesktop/FileManager1"),
                    String::from("org.freedesktop.FileManager1.ShowItems"),
                    format!("array:string:{file_uri}"),
                    String::from("string:"),
                ],
            ),
            (
                "nautilus",
                vec![String::from("--select"), path.display().to_string()],
            ),
            (
                "dolphin",
                vec![String::from("--select"), path.display().to_string()],
            ),
            ("nemo", vec![path.display().to_string()]),
            ("xdg-open", vec![parent.display().to_string()]),
        ];

        for (program, args) in attempts {
            if Command::new(program).args(args).spawn().is_ok() {
                return Ok(());
            }
        }

        return Err(String::from(
            "failed to open the storage file location in a file manager",
        ));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = path;
        Err(String::from(
            "revealing the storage file location is not supported on this platform",
        ))
    }
}

fn path_to_file_uri(path: &Path) -> String {
    let mut uri = String::from("file://");
    #[cfg(windows)]
    {
        uri.push('/');
    }

    for byte in path.to_string_lossy().bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' | b':' => {
                uri.push(byte as char)
            }
            _ => {
                use std::fmt::Write as _;
                let _ = write!(&mut uri, "%{byte:02X}");
            }
        }
    }

    uri
}

fn choose_storage_destination<R: tauri::Runtime>(
    app: &AppHandle<R>,
    current_path: &Path,
) -> Result<Option<PathBuf>, String> {
    let default_directory = storage_dir_from_path(current_path);
    let default_file_name = storage_file_name(current_path);

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.InitialDirectory = '{directory}'
$dialog.FileName = '{file_name}'
$dialog.Filter = 'JSON file (*.json)|*.json|All files (*.*)|*.*'
$dialog.OverwritePrompt = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
  Write-Output $dialog.FileName
}}
"#,
            directory = escape_powershell_string(default_directory.display().to_string()),
            file_name = escape_powershell_string(default_file_name),
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-STA", "-Command"])
            .arg(&script)
            .output()
            .map_err(|error| format!("failed to open the save file dialog: {error}"))?;

        if !output.status.success() {
            return Err(String::from("the save file dialog could not be opened"));
        }

        let selected = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(if selected.is_empty() {
            None
        } else {
            Some(PathBuf::from(selected))
        });
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"
try
  set chosenFile to choose file name default name "{file_name}" default location POSIX file "{directory}"
  return POSIX path of chosenFile
on error number -128
  return ""
end try
"#,
            directory = escape_applescript_string(default_directory.display().to_string()),
            file_name = escape_applescript_string(default_file_name),
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|error| format!("failed to open the save file dialog: {error}"))?;

        if !output.status.success() {
            return Err(String::from("the save file dialog could not be opened"));
        }

        let selected = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(if selected.is_empty() {
            None
        } else {
            Some(PathBuf::from(selected))
        });
    }

    #[cfg(target_os = "linux")]
    {
        let default_path = default_directory.join(default_file_name);

        let zenity_output = Command::new("zenity")
            .arg("--file-selection")
            .arg("--save")
            .arg("--confirm-overwrite")
            .arg("--filename")
            .arg(default_path.to_string_lossy().as_ref())
            .output();

        match zenity_output {
            Ok(output) if output.status.success() => {
                let selected = String::from_utf8_lossy(&output.stdout).trim().to_string();
                return Ok(if selected.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(selected))
                });
            }
            Ok(_) | Err(_) => {}
        }

        let kdialog_output = Command::new("kdialog")
            .arg("--getsavefilename")
            .arg(default_path.to_string_lossy().as_ref())
            .arg("JSON files (*.json)")
            .output();

        match kdialog_output {
            Ok(output) if output.status.success() => {
                let selected = String::from_utf8_lossy(&output.stdout).trim().to_string();
                return Ok(if selected.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(selected))
                });
            }
            Ok(_) | Err(_) => {}
        }

        let _ = app;
        return Err(String::from(
            "no supported save file dialog was found on this platform",
        ));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = app;
        let _ = current_path;
        Err(String::from(
            "moving the storage file is not supported on this platform",
        ))
    }
}

#[cfg(target_os = "windows")]
fn escape_powershell_string(value: String) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: String) -> String {
    value.replace('"', "\\\"")
}

#[tauri::command]
pub fn set_app_storage_path<R: tauri::Runtime>(
    app: AppHandle<R>,
    storage: State<'_, StorageLocationState>,
    path: Option<String>,
) -> Result<String, String> {
    set_storage_path_from_setting(&app, &storage, path)
}

#[tauri::command]
pub fn get_app_storage_path<R: tauri::Runtime>(
    app: AppHandle<R>,
    storage: State<'_, StorageLocationState>,
) -> Result<String, String> {
    let path = storage_path(&app, &storage)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn load_app_storage<R: tauri::Runtime>(
    app: AppHandle<R>,
    storage: State<'_, StorageLocationState>,
) -> Result<String, String> {
    let path = storage_path(&app, &storage)?;

    match fs::read_to_string(&path) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(String::from(
            r#"{"schemaVersion":1,"worlds":[],"characters":[],"highlights":[],"history":{},"notes":{}}"#,
        )),
        Err(error) => Err(format!(
            "failed to read storage file {}: {error}",
            path.display()
        )),
    }
}

#[tauri::command]
pub fn save_app_storage<R: tauri::Runtime>(
    app: AppHandle<R>,
    storage: State<'_, StorageLocationState>,
    json: String,
) -> Result<(), String> {
    let path = storage_path(&app, &storage)?;
    let temp_path = temp_storage_path(&path);

    create_parent_dirs(&path)?;

    fs::write(&temp_path, json).map_err(|error| {
        format!(
            "failed to write temporary storage file {}: {error}",
            temp_path.display()
        )
    })?;

    if path.exists() {
        fs::remove_file(&path).map_err(|error| {
            format!("failed to replace storage file {}: {error}", path.display())
        })?;
    }

    fs::rename(&temp_path, &path).map_err(|error| {
        format!(
            "failed to move temporary storage file into place at {}: {error}",
            path.display()
        )
    })?;

    Ok(())
}

#[tauri::command]
pub fn reveal_app_storage_file<R: tauri::Runtime>(
    app: AppHandle<R>,
    storage: State<'_, StorageLocationState>,
) -> Result<(), String> {
    let path = storage_path(&app, &storage)?;
    reveal_file_in_file_manager(&path)
}

#[tauri::command]
pub fn move_app_storage_file<R: tauri::Runtime>(
    app: AppHandle<R>,
    storage: State<'_, StorageLocationState>,
) -> Result<Option<String>, String> {
    let current_path = storage_path(&app, &storage)?;
    let Some(next_path) = choose_storage_destination(&app, &current_path)? else {
        return Ok(None);
    };

    if next_path == current_path {
        storage.set_path(next_path.clone())?;
        return Ok(Some(next_path.display().to_string()));
    }

    create_parent_dirs(&next_path)?;

    let bytes_copied = fs::copy(&current_path, &next_path).map_err(|error| {
        format!(
            "failed to copy storage file from {} to {}: {error}",
            current_path.display(),
            next_path.display()
        )
    })?;

    let source_len = fs::metadata(&current_path)
        .map_err(|error| {
            format!(
                "failed to verify the source storage file {}: {error}",
                current_path.display()
            )
        })?
        .len();

    let target_len = fs::metadata(&next_path)
        .map_err(|error| {
            format!(
                "failed to verify the new storage file {}: {error}",
                next_path.display()
            )
        })?
        .len();

    if bytes_copied != source_len || target_len != source_len {
        return Err(format!(
            "storage file copy verification failed between {} and {}",
            current_path.display(),
            next_path.display()
        ));
    }

    match fs::remove_file(&current_path) {
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            eprintln!(
                "failed to remove the previous storage file {}: {error}",
                current_path.display()
            );
        }
    }

    storage.set_path(next_path.clone())?;
    Ok(Some(next_path.display().to_string()))
}
