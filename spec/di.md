# Dependency Injection

This document describes the dependency injection shape for app-wide and world-session scoped state and services.

## App Scope DI

The app-wide DI registry is the owner of services and shared app state that are used across multiple parts of the UI.

It is organized into namespaces for different systems:

- `storage` for persistence, file location management, and app data loading/saving
- `settings` for app settings state, normalization, and updates
- `style` for resolving the current app style from the default style and app-level overrides, plus the font shelf and OS font lookup used by style editing
- `spellcheck` for shared spellcheck configuration and request helpers
- `windowAttention` for app-level attention and unseen-activity coordination

The app-wide registry should hold long-lived services rather than forcing the app shell to pass storage, settings, or spellcheck callbacks through many component layers.
The registry should expose stable service methods and shared state accessors so feature modules can depend on a small number of named app services.
The registry should keep UI-local state out of shared services unless that state must survive across components or coordinate app-wide behavior.
The app style service should own the app-level style editor, the resolved app style, the font shelf, and OS font lookup / validation used by the style editor, then expose those through the app registry.

### App Usage

- Use `storage` methods to load, save, and move persisted app data.
- Use `settings` methods to read, update, and persist app settings.
- Use `style` methods to resolve and persist the current app style, read or update the font shelf, and ask for installed system fonts when building style choices.
- Use `spellcheck` methods to normalize ignored words and perform shared spellcheck requests.
- Use `windowAttention` methods to track focus state, unseen activity, and attention requests.
- Prefer the app-wide registry when a caller needs a cross-cutting service that is used in more than one feature area.
- Keep the app shell thin. It may coordinate registry setup and high-level flows, but it should not become the owner of storage, settings, spellcheck, or attention service state.

### App Intended Direction

The app-wide DI registry is the place where future global services should live when they are shared across the whole application.

The goal is to reduce callback plumbing and make app-wide behavior available through stable service boundaries, while still keeping feature-local UI state and world/session-specific behavior in their own modules.

The app style service is the app-level layer for default style values, app overrides, and style editor state. A future world-session style service can compose on top of it to account for world-scoped or character-scoped style overrides without moving the app-wide style concerns out of the app registry.

## World Session Scope DI

A world session is identified by a `WorldSessionKey`, made from:

- `worldId`
- `characterId`

The registry itself is keyed only by `WorldSessionKey`. Tab-to-session translation lives in the session layer or in callers that already have the tab record.

### Shape

The world-session DI registry is the owner of the world session container for each active world session.

It is organized into namespaces for different systems:

- `container` for registry management and world-session identity
- `connection` for connection ownership and creation
- `debugConsole` for per-session debug console state and entries
- `style` for world-session style resolution that composes on top of the app style service

The container should hold the session-scoped connection object rather than exposing `MudConnection` through the session shell.
The container should not own a separate connection id field when the tab record or connection object already carries that identity.
The container should also own the per-session debug console state so the session shell only coordinates visibility and rendering.

### Usage

- Use `container` methods to create, retrieve, replace, and remove world-session records.
- Use `connection` methods to resolve or create the session-owned connection.
- Use `debugConsole` methods to resolve and update the session-owned debug console.
- Use `style` methods to resolve the effective style for the active world session.
- Prefer `WorldSessionKey` access when the caller is operating from world and character identity.
- Prefer tab-derived key helpers in session-level code when the caller starts from a world tab.
- Keep session-shell code thin. It may coordinate tabs and higher-level flows, but it should not become the owner of connection state, connection metadata, or debug console state.

### Intended Direction

The DI container is the place where future world-session services should live when they are scoped to a specific world and character pair.

The goal is to let the rest of the app depend on stable session-scoped services, while the container handles the tab-to-session mapping internally.
The future world-session style service should consume the app style service and add world- or character-specific style selection on top of it.
