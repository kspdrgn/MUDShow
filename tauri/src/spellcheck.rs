use std::collections::HashSet;
use std::sync::{Arc, Mutex, OnceLock};

use spellbook::Dictionary;
use tauri::State;

const FALLBACK_AFF: &str = "SET UTF-8\nTRY etaoinshrdlcumwfgypbvkjxqz\n";

static FALLBACK_WORDS: OnceLock<Vec<String>> = OnceLock::new();

pub struct SpellcheckManager {
    runtime: Mutex<SpellcheckRuntime>,
}

impl Default for SpellcheckManager {
    fn default() -> Self {
        Self {
            runtime: Mutex::new(SpellcheckRuntime::default()),
        }
    }
}

#[derive(Default)]
struct SpellcheckRuntime {
    language: Option<String>,
    dictionary: Option<Arc<Dictionary>>,
    custom_words: HashSet<String>,
}

fn normalize_spellcheck_word(word: &str) -> String {
    word.trim()
        .trim_matches(|character: char| {
            !(character.is_ascii_alphanumeric() || character == '\'' || character == '-')
        })
        .trim_matches(|character: char| character == '\'' || character == '-')
        .to_string()
}

fn lowercase_word(word: &str) -> String {
    word.to_lowercase()
}

fn is_title_case(word: &str) -> bool {
    let mut characters = word.chars();
    let Some(first) = characters.next() else {
        return false;
    };

    first.is_uppercase() && characters.all(|character| !character.is_ascii_alphabetic() || character.is_lowercase())
}

fn apply_case_pattern(original: &str, suggestion: &str) -> String {
    if original.chars().all(|character| !character.is_ascii_alphabetic() || character.is_uppercase()) {
        suggestion.to_uppercase()
    } else if is_title_case(original) {
        let mut characters = suggestion.chars();
        match characters.next() {
            Some(first) => first.to_uppercase().collect::<String>() + characters.as_str(),
            None => String::new(),
        }
    } else {
        suggestion.to_string()
    }
}

fn split_ignored_words(raw: &str) -> HashSet<String> {
    let mut words = HashSet::new();

    for part in raw.split(',') {
        let normalized = lowercase_word(&normalize_spellcheck_word(part));
        if !normalized.is_empty() {
            words.insert(normalized);
        }
    }

    words
}

fn add_words_from_text(text: &str, words: &mut HashSet<String>) {
    let mut current = String::new();

    let flush_current = |current: &mut String, words: &mut HashSet<String>| {
        let normalized = normalize_spellcheck_word(current);
        current.clear();
        if normalized.len() < 2 {
            return;
        }

        let lowered = lowercase_word(&normalized);
        if lowered.chars().any(|character| character.is_ascii_alphabetic()) {
            words.insert(lowered);
        }
    };

    for character in text.chars() {
        if character.is_ascii_alphanumeric() || character == '\'' || character == '-' {
            current.push(character);
        } else if !current.is_empty() {
            flush_current(&mut current, words);
        }
    }

    if !current.is_empty() {
        flush_current(&mut current, words);
    }
}

fn fallback_word_list() -> &'static [String] {
    FALLBACK_WORDS.get_or_init(|| {
        let mut words = HashSet::new();

        for text in [
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../README.md")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../PLAN_SPELLING.md")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../spec/spec.md")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../spec/input.md")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../spec/settings.md")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/src/App.svelte")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/src/lib/components/play/InputBars.svelte")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/src/lib/components/play/NotesPanel.svelte")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/src/lib/components/play/PlayScreen.svelte")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/src/lib/components/play/SpellcheckContextMenu.svelte")),
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/src/lib/components/settings/SettingsPage.svelte")),
        ] {
            add_words_from_text(text, &mut words);
        }

        let mut words: Vec<String> = words.into_iter().collect();
        words.sort_unstable();
        words
    })
}

fn build_dictionary() -> Result<Dictionary, String> {
    let words = fallback_word_list();
    if words.is_empty() {
        return Err(String::from("no spellcheck words were available to build the fallback dictionary"));
    }

    let mut dic = String::new();
    dic.push_str(&words.len().to_string());
    dic.push('\n');
    for word in words {
        dic.push_str(word);
        dic.push('\n');
    }

    Dictionary::new(FALLBACK_AFF, &dic).map_err(|error| format!("failed to initialize spellcheck dictionary: {error}"))
}

async fn ensure_dictionary(state: &State<'_, SpellcheckManager>, language: &str) -> Result<Arc<Dictionary>, String> {
    {
        let runtime = state
            .runtime
            .lock()
            .map_err(|_| String::from("spellcheck state is unavailable"))?;

        if let (Some(current_language), Some(dictionary)) = (&runtime.language, &runtime.dictionary) {
            if current_language == language {
                return Ok(Arc::clone(dictionary));
            }
        }
    }

    let loaded = tauri::async_runtime::spawn_blocking(build_dictionary)
        .await
        .map_err(|error| format!("spellcheck dictionary initialization failed: {error}"))??;
    let loaded = Arc::new(loaded);

    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| String::from("spellcheck state is unavailable"))?;
    runtime.language = Some(language.to_string());
    runtime.dictionary = Some(Arc::clone(&loaded));
    Ok(loaded)
}

fn is_known_word(
    dictionary: &Dictionary,
    custom_words: &HashSet<String>,
    word: &str,
    ignored_words: &HashSet<String>,
) -> bool {
    let normalized = lowercase_word(&normalize_spellcheck_word(word));
    if normalized.is_empty() {
        return true;
    }

    if ignored_words.contains(&normalized) || custom_words.contains(&normalized) {
        return true;
    }

    dictionary.check(&normalized) || dictionary.check(&normalized.to_uppercase())
}

#[tauri::command]
pub async fn spellcheck_check(
    state: State<'_, SpellcheckManager>,
    language: String,
    ignored_words: String,
    minimum_word_length: usize,
    word: String,
) -> Result<bool, String> {
    let normalized = normalize_spellcheck_word(&word);
    if normalized.is_empty() || normalized.chars().count() < minimum_word_length {
        return Ok(true);
    }

    let ignored_words = split_ignored_words(&ignored_words);
    let dictionary = ensure_dictionary(&state, &language).await?;
    let runtime = state
        .runtime
        .lock()
        .map_err(|_| String::from("spellcheck state is unavailable"))?;

    Ok(is_known_word(
        &dictionary,
        &runtime.custom_words,
        &normalized,
        &ignored_words,
    ))
}

#[tauri::command]
pub async fn spellcheck_suggest(
    state: State<'_, SpellcheckManager>,
    language: String,
    ignored_words: String,
    minimum_word_length: usize,
    suggestion_limit: usize,
    word: String,
) -> Result<Vec<String>, String> {
    let normalized = normalize_spellcheck_word(&word);
    if normalized.is_empty() || normalized.chars().count() < minimum_word_length {
        return Ok(Vec::new());
    }

    let ignored_words = split_ignored_words(&ignored_words);
    let dictionary = ensure_dictionary(&state, &language).await?;
    let runtime = state
        .runtime
        .lock()
        .map_err(|_| String::from("spellcheck state is unavailable"))?;

    if is_known_word(
        &dictionary,
        &runtime.custom_words,
        &normalized,
        &ignored_words,
    ) {
        return Ok(Vec::new());
    }

    let query = lowercase_word(&normalized);
    let mut suggestions = Vec::new();
    dictionary.suggest(&query, &mut suggestions);

    let mut deduped = Vec::new();
    let mut seen = HashSet::new();
    for suggestion in suggestions {
        let adjusted = apply_case_pattern(&normalized, suggestion.trim());
        let key = lowercase_word(&adjusted);

        if adjusted.is_empty() || key == lowercase_word(&normalized) || ignored_words.contains(&key) || runtime.custom_words.contains(&key) {
            continue;
        }

        if seen.insert(key) {
            deduped.push(adjusted);
        }

        if deduped.len() >= suggestion_limit {
            break;
        }
    }

    Ok(deduped)
}

#[tauri::command]
pub async fn spellcheck_add(
    state: State<'_, SpellcheckManager>,
    language: String,
    word: String,
) -> Result<bool, String> {
    let normalized = normalize_spellcheck_word(&word);
    if normalized.is_empty() {
        return Err(String::from("a word is required"));
    }

    let _ = ensure_dictionary(&state, &language).await?;
    let mut runtime = state
        .runtime
        .lock()
        .map_err(|_| String::from("spellcheck state is unavailable"))?;
    Ok(runtime.custom_words.insert(lowercase_word(&normalized)))
}
