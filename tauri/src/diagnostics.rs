//! Reserved home for crash reporting and telemetry integration.
//!
//! This module intentionally records nothing and sends nothing yet. Keeping the
//! state in the native shell gives future diagnostics code a place to attach
//! without coupling it to the frontend lifecycle.

#[derive(Default)]
pub struct DiagnosticsState;
