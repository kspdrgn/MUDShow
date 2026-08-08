# Tauri Window and Webview Behavior

## Purpose
Describe the desktop-shell behavior that matters for pop-outs, control windows, and webview-backed windows.

## Window Shells
- Native windows are allowed to exist as plain desktop shells with no special app content.
- A plain native window is useful as a control test because it proves the window lifecycle works even when no webview content is attached.
- Webview-backed windows are separate from plain native windows and should be treated as a different kind of shell.

## Windows Webview Environment
- On Windows, a secondary webview window that loads app content must share the main webview's WebView2 environment.
- The app should obtain the opener or main webview handle and pass its environment into the new window builder.
- The documented pattern is to read the platform webview through `WebviewWindow::with_webview(...)` and then call `WebviewWindowBuilder::with_environment(...)` with that environment.
- If this environment is not shared, the window can appear to open and then vanish, or it can stay visible while the webview never finishes attaching or stops responding to webview messages.

## Debugging Guidance
- When diagnosing pop-out behavior, trace both the native window lifecycle and the webview lifecycle separately.
- Native window success does not guarantee webview success.
- Helpful early lifecycle hooks include navigation, page-load, title-change, and window-event tracing.
