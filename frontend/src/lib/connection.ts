import { invoke, listen } from './tauri.js';
import { bumpDebugConsoleCache } from './debug-console-cache.js';
import { appendDebugConsoleEntry, type DebugConsoleDirection } from './debug-console.js';
import type { WorldSessionDebugConsole } from './world-session-debug-console.js';

type Handlers = {
  onOpen: () => void;
  onRawMessage: (text: string) => void;
  onMessage: (text: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
  onStructured?: (event: StructuredConnectionEvent) => void;
  onSnapshot?: (snapshot: ConnectionSnapshot) => void;
  onDiagnostic?: (message: string) => void;
};

export const CONNECTION_EVENT_CONTRACT_VERSION = 1;

export interface MudConnectionDescriptor {
  connectionId: string;
  sessionId: number;
  worldId: string | null;
  characterId: string | null;
  host: string;
  port: number;
  tls: boolean;
  verifyCertificate: boolean;
  status: string;
  lastError: string | null;
  lastSequence: number;
}

export type ConnectionDiagnostic = MudConnectionDescriptor;

export function acceptsConnectionSequence(previous: number, next: number | undefined): boolean {
  return next === undefined || next > previous;
}

export function acceptsConnectionSnapshot(previous: number, snapshotSequence: number): boolean {
  return snapshotSequence >= previous;
}


type ConnectionTarget = {
  host: string;
  port: number;
  tls: boolean;
  verifyCertificate: boolean;
  worldId?: string;
  characterId?: string | null;
};

type ConnectionEventBase = {
  connectionId: string;
  sessionId?: number;
  sequence?: number;
  contractVersion?: number;
};

type ConnectionEvent =
  | (ConnectionEventBase & { kind: 'opened' })
  | (ConnectionEventBase & { kind: 'raw'; text: string })
  | (ConnectionEventBase & { kind: 'data'; text: string })
  | (ConnectionEventBase & { kind: 'closed'; reason: string })
  | (ConnectionEventBase & { kind: 'error'; message: string })
  | StructuredConnectionEvent;

export type StructuredConnectionEvent = ConnectionEventBase & {
  kind: 'structured';
  protocol: 'telnet' | 'mcp' | 'gmcp' | 'mcmp';
  eventType: string;
  direction: 'incoming' | 'outgoing';
  payload: unknown;
  parseStatus: 'parsed' | 'malformed' | 'unsupported';
  error: string | null;
};

type ReplayEvent =
  | { sequence: number; sessionId?: number; kind: 'opened' }
  | { sequence: number; sessionId?: number; kind: 'raw'; text: string }
  | { sequence: number; sessionId?: number; kind: 'data'; text: string }
  | { sequence: number; sessionId?: number; kind: 'closed'; reason: string }
  | { sequence: number; sessionId?: number; kind: 'error'; message: string }
  | (Omit<StructuredConnectionEvent, 'connectionId'> & { sequence: number; sessionId?: number; connectionId?: string });

export type AttachResponse = {
  contractVersion: number;
  runtimeId: string;
  connectionId: string;
  sessionId: number;
  snapshotRevision: number;
  eventSequence: number;
  snapshot: ConnectionSnapshot['snapshot'];
  events: ReplayEvent[];
};

export type ConnectionSnapshot = {
  contractVersion: number;
  runtimeId: string;
  connectionId: string;
  sessionId: number;
  sequence: number;
  snapshotRevision: number;
  snapshot: {
    connectionStatus: string;
    lastError: string | null;
    negotiatedCapabilities: string[];
    protocolState: unknown;
    diagnostics: string[];
  };
};

export class MudConnection {
  constructor(
    private readonly connectionId: string,
    private readonly debugConsole: WorldSessionDebugConsole | null = null,
  ) {}

  private sessionToken = 0;
  private connected = false;
  private opened = false;
  private unlistenEvents: (() => void) | null = null;
  private lastSequence = 0;
  private attachPending = false;
  private pendingEvents: ReplayEvent[] = [];
  private sessionId: number | null = null;

  async connect(target: ConnectionTarget, handlers: Handlers): Promise<void> {
    await this.close();

    const token = ++this.sessionToken;
    this.connected = false;
    this.opened = false;
    this.attachPending = false;
    this.pendingEvents = [];

    try {
      await this.startListening(token, handlers);
      await invoke('connect_mud', { connectionId: this.connectionId, ...target });
      if (this.sessionToken === token && !this.opened) {
        this.connected = true;
        handlers.onOpen();
      }
    } catch (error) {
      if (this.sessionToken === token) {
        await this.close();
        this.connected = false;
        handlers.onError(formatError(error));
      }
    }
  }

  /** Detach frontend listeners without terminating the backend socket. */
  async detach(gracePeriodMs = 30_000, preserveBackend = true): Promise<void> {
    this.sessionToken += 1;
    this.connected = false;
    this.opened = false;
    this.lastSequence = 0;
    this.sessionId = null;
    this.attachPending = false;
    this.pendingEvents = [];

    if (this.unlistenEvents) {
      const unlisten = this.unlistenEvents;
      this.unlistenEvents = null;
      unlisten();
    }

    if (preserveBackend) {
      await invoke('detach_mud_connection', {
        connectionId: this.connectionId,
        gracePeriodMs,
      }).catch(() => undefined);
    }
  }

  async attach(handlers: Handlers): Promise<void> {
    // The non-preserving detach path only invalidates the old listener and
    // removes it synchronously. Do not await it here: yielding before
    // startListening would create a window where attach-time events are lost.
    void this.detach(0, false);
    const token = ++this.sessionToken;
    this.lastSequence = 0;
    this.sessionId = null;
    this.attachPending = true;
    this.pendingEvents = [];

    try {
      await this.startListening(token, handlers);
      const attach = await invoke<AttachResponse>('attach_mud_connection', {
        connectionId: this.connectionId,
      });

      if (this.sessionToken !== token) {
        return;
      }

      const snapshot: ConnectionSnapshot = {
        contractVersion: attach.contractVersion,
        runtimeId: attach.runtimeId,
        connectionId: attach.connectionId,
        sessionId: attach.sessionId,
        sequence: attach.eventSequence,
        snapshotRevision: attach.snapshotRevision,
        snapshot: attach.snapshot,
      };
      this.sessionId = attach.sessionId;
      this.connected = snapshot.snapshot.connectionStatus === 'connected';
      this.opened = this.connected;
      if (acceptsConnectionSnapshot(this.lastSequence, snapshot.sequence)) {
        handlers.onSnapshot?.(snapshot);
      } else {
        handlers.onDiagnostic?.(
          `[frontend attach snapshot was stale at sequence ${snapshot.sequence}; live state is already at sequence ${this.lastSequence}]`,
        );
      }
      if (this.connected) {
        handlers.onOpen();
      }

      this.lastSequence = Math.max(this.lastSequence, attach.eventSequence);
      this.attachPending = false;
      const events = new Map<number, ReplayEvent>();
      [...attach.events, ...this.pendingEvents].forEach((event) => {
        if (event.sessionId !== undefined && event.sessionId !== this.sessionId) {
          return;
        }
        events.set(event.sequence, event);
      });
      this.pendingEvents = [];
      for (const event of [...events.values()].sort((left, right) => left.sequence - right.sequence)) {
        this.dispatchEvent({ ...event, connectionId: this.connectionId }, token, handlers);
      }
    } catch (error) {
      if (this.sessionToken === token) {
        this.attachPending = false;
        handlers.onError(formatError(error));
      }
    }
  }

  async getSnapshot(): Promise<ConnectionSnapshot> {
    return invoke<ConnectionSnapshot>('get_mud_connection_snapshot', {
      connectionId: this.connectionId,
    });
  }

  send(text: string): void {
    if (!this.connected) {
      return;
    }

    if (this.debugConsole && text) {
      const sourceLabel = this.debugConsole.sourceLabel ?? 'world session';
      this.debugConsole.entries = appendDebugConsoleEntry(this.debugConsole.entries, {
        direction: 'outgoing' satisfies DebugConsoleDirection,
        sourceLabel,
        text,
      });
      bumpDebugConsoleCache();
    }

    void invoke('send_mud', { connectionId: this.connectionId, text }).catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.detach(0, false);

    await invoke('disconnect_mud', { connectionId: this.connectionId }).catch(() => undefined);
  }

  private async startListening(token: number, handlers: Handlers): Promise<void> {
    const unlisten = await listen<ConnectionEvent>('mud://event', ({ payload }) => {
      if (payload.connectionId !== this.connectionId) {
        return;
      }

      if (this.sessionToken !== token) {
        return;
      }

      if (!acceptsConnectionSequence(this.lastSequence, payload.sequence)) {
        return;
      }
      if (this.sessionId !== null && payload.sessionId !== undefined && payload.sessionId !== this.sessionId) {
        return;
      }
      if (this.attachPending && payload.sequence !== undefined) {
        this.pendingEvents.push({
          ...payload,
          sequence: payload.sequence,
        } as ReplayEvent);
        return;
      }

      if (payload.sequence !== undefined) {
        this.lastSequence = payload.sequence;
      }

      if (payload.kind === 'raw') {
        handlers.onRawMessage(payload.text);
        return;
      }

      if (payload.kind === 'data') {
        handlers.onMessage(payload.text);
        return;
      }

      if (payload.kind === 'structured') {
        handlers.onStructured?.(payload);
        return;
      }

      this.dispatchEvent(payload, token, handlers);
    });

    if (this.sessionToken !== token) {
      unlisten();
      return;
    }

    this.unlistenEvents = unlisten;
  }

  private dispatchEvent(payload: ConnectionEvent, token: number, handlers: Handlers): void {
    if (this.sessionToken !== token) {
      return;
    }
    if (this.sessionId !== null && payload.sessionId !== undefined && payload.sessionId !== this.sessionId) {
      return;
    }

    if (payload.kind === 'opened') {
      if (this.opened && this.connected) {
        return;
      }

      this.sessionId = payload.sessionId ?? this.sessionId;
      this.opened = true;
      this.connected = true;
      handlers.onOpen();
      return;
    }

    if (payload.kind === 'data') {
      handlers.onMessage(payload.text);
      return;
    }

    if (payload.kind === 'raw') {
      handlers.onRawMessage(payload.text);
      return;
    }

    if (payload.kind === 'structured') {
      handlers.onStructured?.(payload);
      return;
    }

    this.connected = false;

    if (payload.kind === 'closed') {
      handlers.onClose();
    } else {
      handlers.onError(payload.message);
    }
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || 'Unknown connection error';
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return 'Unknown connection error';
}
