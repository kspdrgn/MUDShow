# World Session DI

This document describes the dependency injection shape for world-session scoped state and services.

## Scope

A world session is identified by a `WorldSessionKey`, made from:

- `worldId`
- `characterId`

The registry also supports lookup by `tabId`, because each world tab has a unique world session and several tab-level flows still start from the tab id.

## Shape

The world-session DI registry is the owner of the world session container for each active world tab.

It is organized into namespaces for different systems:

- `container` for registry management and world-session identity
- `connection` for connection ownership and command delivery

The container should hold the session-scoped connection object rather than exposing `MudConnection` through the session shell.

## Usage

- Use `container` methods to create, attach, detach, and remove world-session records.
- Use `connection` methods to resolve, connect, close, release, or send through the session-owned connection.
- Prefer `tabId` access when the caller already starts from a world tab.
- Prefer `WorldSessionKey` access when the caller is operating from world and character identity.
- Send commands through the container instead of passing raw connection objects around.
- Keep session-shell code thin. It may coordinate tabs and higher-level flows, but it should not become the owner of connection state.

## Intended Direction

The DI container is the place where future world-session services should live when they are scoped to a specific world tab or to a specific world and character pair.

The goal is to let the rest of the app depend on stable session-scoped services, while the container handles the tab-to-session mapping internally.
