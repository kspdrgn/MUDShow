# World Session DI

This document describes the dependency injection shape for world-session scoped state and services.

## Scope

A world session is identified by a `WorldSessionKey`, made from:

- `worldId`
- `characterId`

The registry itself is keyed only by `WorldSessionKey`. Tab-to-session translation lives in the session layer or in callers that already have the tab record.

## Shape

The world-session DI registry is the owner of the world session container for each active world session.

It is organized into namespaces for different systems:

- `container` for registry management and world-session identity
- `connection` for connection ownership and creation

The container should hold the session-scoped connection object rather than exposing `MudConnection` through the session shell.
The container should not own a separate connection id field when the tab record or connection object already carries that identity.

## Usage

- Use `container` methods to create, retrieve, replace, and remove world-session records.
- Use `connection` methods to resolve or create the session-owned connection.
- Prefer `WorldSessionKey` access when the caller is operating from world and character identity.
- Prefer tab-derived key helpers in session-level code when the caller starts from a world tab.
- Keep session-shell code thin. It may coordinate tabs and higher-level flows, but it should not become the owner of connection state or connection metadata.

## Intended Direction

The DI container is the place where future world-session services should live when they are scoped to a specific world and character pair.

The goal is to let the rest of the app depend on stable session-scoped services, while the container handles the tab-to-session mapping internally.
