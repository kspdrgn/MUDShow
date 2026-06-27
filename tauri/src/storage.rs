use std::env;
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;

const STORAGE_FILE_NAME: &str = "mudshow-data.json";
const STORAGE_TEMP_FILE_NAME: &str = "mudshow-data.json.tmp";

fn storage_path() -> Result<PathBuf, String> {
    let executable = env::current_exe().map_err(|error| format!("failed to locate executable: {error}"))?;
    let directory = executable
        .parent()
        .ok_or_else(|| String::from("failed to determine executable directory"))?;

    Ok(directory.join(STORAGE_FILE_NAME))
}

fn temp_storage_path() -> Result<PathBuf, String> {
    let executable = env::current_exe().map_err(|error| format!("failed to locate executable: {error}"))?;
    let directory = executable
        .parent()
        .ok_or_else(|| String::from("failed to determine executable directory"))?;

    Ok(directory.join(STORAGE_TEMP_FILE_NAME))
}

#[tauri::command]
pub fn load_app_storage() -> Result<String, String> {
    let path = storage_path()?;

    match fs::read_to_string(&path) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(String::from(
            r#"{"characters":[],"highlights":[],"notes":{}}"#,
        )),
        Err(error) => Err(format!(
            "failed to read storage file {}: {error}",
            path.display()
        )),
    }
}

#[tauri::command]
pub fn save_app_storage(json: String) -> Result<(), String> {
    let path = storage_path()?;
    let temp_path = temp_storage_path()?;

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
