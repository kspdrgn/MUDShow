use std::collections::BTreeMap;

use fontdb::{Database, Family, Query, Stretch, Style, Weight};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontFace {
    pub family: String,
    pub style_name: String,
    pub weight: u16,
    pub italic: bool,
    pub stretch: String,
    pub postscript_name: String,
    pub display_name: String,
    pub monospaced: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontFamily {
    pub family: String,
    pub faces: Vec<SystemFontFace>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontValidationRequest {
    pub family: String,
    pub weight: Option<u16>,
    pub italic: Option<bool>,
    pub stretch: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontValidationResult {
    pub family: String,
    pub available: bool,
    pub matched_face: Option<SystemFontFace>,
}

#[tauri::command]
pub fn list_system_fonts() -> Vec<SystemFontFamily> {
    let mut database = Database::new();
    database.load_system_fonts();

    let mut families = BTreeMap::<String, Vec<SystemFontFace>>::new();

    for face in database.faces() {
        let Some((family, _language)) = face.families.first() else {
            continue;
        };

        let family = family.trim();
        if family.is_empty() {
            continue;
        }

        families
            .entry(family.to_string())
            .or_default()
            .push(face_to_option(family, face));
    }

    families
        .into_iter()
        .map(|(family, mut faces)| {
            faces.sort_by(|left, right| {
                left.weight
                    .cmp(&right.weight)
                    .then(left.italic.cmp(&right.italic))
                    .then(left.stretch.cmp(&right.stretch))
                    .then(left.postscript_name.cmp(&right.postscript_name))
            });
            faces.dedup_by(|left, right| {
                left.weight == right.weight
                    && left.italic == right.italic
                    && left.stretch == right.stretch
                    && left.postscript_name == right.postscript_name
            });
            SystemFontFamily { family, faces }
        })
        .collect()
}

#[tauri::command]
pub fn validate_system_font(request: SystemFontValidationRequest) -> SystemFontValidationResult {
    let family = request.family.trim().to_string();
    if family.is_empty() {
        return SystemFontValidationResult {
            family,
            available: false,
            matched_face: None,
        };
    }

    let mut database = Database::new();
    database.load_system_fonts();

    let families = [Family::Name(family.as_str())];
    let query = Query {
        families: &families,
        weight: Weight(request.weight.unwrap_or(Weight::NORMAL.0)),
        stretch: parse_stretch(request.stretch.as_deref()).unwrap_or_default(),
        style: if request.italic == Some(true) {
            Style::Italic
        } else {
            Style::Normal
        },
    };

    let matched_face = database
        .query(&query)
        .and_then(|id| database.face(id))
        .and_then(|face| {
            let (matched_family, _language) = face.families.first()?;
            if !matched_family.eq_ignore_ascii_case(&family) {
                return None;
            }

            Some(face_to_option(matched_family, face))
        });

    SystemFontValidationResult {
        family,
        available: matched_face.is_some(),
        matched_face,
    }
}

fn face_to_option(family: &str, face: &fontdb::FaceInfo) -> SystemFontFace {
    let style_name = style_label(face.style, face.weight.0, face.stretch);
    let display_name = format!("{family} {style_name}");

    SystemFontFace {
        family: family.to_string(),
        style_name,
        weight: face.weight.0,
        italic: matches!(face.style, Style::Italic | Style::Oblique),
        stretch: stretch_label(face.stretch).to_string(),
        postscript_name: face.post_script_name.clone(),
        display_name,
        monospaced: face.monospaced,
    }
}

fn style_label(style: Style, weight: u16, stretch: Stretch) -> String {
    let mut parts = Vec::<&'static str>::new();
    let stretch = stretch_label(stretch);

    if stretch != "normal" {
        parts.push(stretch);
    }

    match weight {
        100 => parts.push("thin"),
        200 => parts.push("extra light"),
        300 => parts.push("light"),
        400 => {}
        500 => parts.push("medium"),
        600 => parts.push("semibold"),
        700 => parts.push("bold"),
        800 => parts.push("extra bold"),
        900 => parts.push("black"),
        _ => {}
    }

    match style {
        Style::Normal => {}
        Style::Italic => parts.push("italic"),
        Style::Oblique => parts.push("oblique"),
    }

    if parts.is_empty() {
        String::from("regular")
    } else {
        parts.join(" ")
    }
}

fn parse_stretch(value: Option<&str>) -> Option<Stretch> {
    match value?.trim().to_ascii_lowercase().as_str() {
        "ultra condensed" | "ultra-condensed" => Some(Stretch::UltraCondensed),
        "extra condensed" | "extra-condensed" => Some(Stretch::ExtraCondensed),
        "condensed" => Some(Stretch::Condensed),
        "semi condensed" | "semi-condensed" => Some(Stretch::SemiCondensed),
        "normal" => Some(Stretch::Normal),
        "semi expanded" | "semi-expanded" => Some(Stretch::SemiExpanded),
        "expanded" => Some(Stretch::Expanded),
        "extra expanded" | "extra-expanded" => Some(Stretch::ExtraExpanded),
        "ultra expanded" | "ultra-expanded" => Some(Stretch::UltraExpanded),
        _ => None,
    }
}

fn stretch_label(stretch: Stretch) -> &'static str {
    match stretch {
        Stretch::UltraCondensed => "ultra condensed",
        Stretch::ExtraCondensed => "extra condensed",
        Stretch::Condensed => "condensed",
        Stretch::SemiCondensed => "semi condensed",
        Stretch::Normal => "normal",
        Stretch::SemiExpanded => "semi expanded",
        Stretch::Expanded => "expanded",
        Stretch::ExtraExpanded => "extra expanded",
        Stretch::UltraExpanded => "ultra expanded",
    }
}
