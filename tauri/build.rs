use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    tauri_build::build();
    copy_spellbook_dictionary().expect("failed to prepare spellbook dictionary assets");
}

fn copy_spellbook_dictionary() -> Result<(), String> {
    let source_dir = find_spellbook_dictionary_dir().ok_or_else(|| {
        String::from("could not locate the spellbook en_US dictionary in the local Cargo registry")
    })?;
    let out_dir = PathBuf::from(
        env::var("OUT_DIR").map_err(|error| format!("OUT_DIR is unavailable: {error}"))?,
    );

    copy_file(
        &source_dir.join("en_US.aff"),
        &out_dir.join("spellbook-en_US.aff"),
    )?;
    copy_file(
        &source_dir.join("en_US.dic"),
        &out_dir.join("spellbook-en_US.dic"),
    )?;

    println!("cargo:rerun-if-changed={}", source_dir.join("en_US.aff").display());
    println!("cargo:rerun-if-changed={}", source_dir.join("en_US.dic").display());
    Ok(())
}

fn copy_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::copy(source, destination).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    Ok(())
}

fn find_spellbook_dictionary_dir() -> Option<PathBuf> {
    let cargo_home = env::var_os("CARGO_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(|value| PathBuf::from(value).join(".cargo")))
        .or_else(|| env::var_os("HOME").map(|value| PathBuf::from(value).join(".cargo")))?;

    let registry_src = cargo_home.join("registry").join("src");
    let entries = fs::read_dir(registry_src).ok()?;

    for entry in entries.flatten() {
        let candidate = entry.path().join("spellbook-0.4.2").join("vendor").join("en_US");
        if candidate.join("en_US.aff").is_file() && candidate.join("en_US.dic").is_file() {
            return Some(candidate);
        }
    }

    None
}
