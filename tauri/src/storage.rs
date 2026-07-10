use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;

use tauri::Manager;

const STORAGE_FILE_NAME: &str = "mudshow-data.json";
const STORAGE_TEMP_FILE_NAME: &str = "mudshow-data.json.tmp";

fn storage_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve app local data directory: {error}"))
}

fn storage_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    Ok(storage_dir(app)?.join(STORAGE_FILE_NAME))
}

fn temp_storage_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    Ok(storage_dir(app)?.join(STORAGE_TEMP_FILE_NAME))
}

#[tauri::command]
pub fn get_app_storage_path<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<String, String> {
    let path = storage_path(&app)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn load_app_storage<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    let path = storage_path(&app)?;

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
    app: tauri::AppHandle<R>,
    json: String,
) -> Result<(), String> {
    let path = storage_path(&app)?;
    let temp_path = temp_storage_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("failed to prepare storage directory {}: {error}", parent.display())
        })?;
    }

    fs::write(&temp_path, json).map_err(|error| {
        format!(
            "failed to write temporary storage file {}: {error}",
            temp_path.display()
        )
    })?;

    if path.exists() {
        fs::remove_file(&path).map_err(|error| {
            format!(
                "failed to replace storage file {}: {error}",
                path.display()
            )
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
