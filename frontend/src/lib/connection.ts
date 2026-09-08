import { invoke, listen } from './tauri';
import { bumpDebugConsoleCache } from './debug-console-cache';
import { appendDebugConsoleEntry, type DebugConsoleDirection } from './debug-console';
import type { WorldSessionDebugConsole } from './world-session-debug-console';

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
  oldestReplaySequence: number;
}

export function acceptsConnectionSequence(previous: number, next: number | undefined): boolean {
  return next === undefined || next > previous;
}

export function acceptsConnectionSnapshot(previous: number, snapshotSequence: number): boolean {
  return snapshotSequence >= previous;
}

export function classifyReplayGap(hasGap: boolean, gapReason: string | null | undefined): 'none' | 'replay-trimmed' | 'unknown' {
  if (!hasGap) {
    return 'none';
  }
  return gapReason === 'replay-trimmed' ? 'replay-trimmed' : 'unknown';
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
  | { sequence: number; sessionId: number; kind: 'opened' }
  | { sequence: number; sessionId: number; kind: 'raw'; text: string }
  | { sequence: number; sessionId: number; kind: 'data'; text: string }
  | { sequence: number; sessionId: number; kind: 'closed'; reason: string }
  | { sequence: number; sessionId: number; kind: 'error'; message: string }
  | (Omit<StructuredConnectionEvent, 'connectionId'> & { sequence: number; sessionId: number; connectionId?: string });

type ReplayResponse = {
  contractVersion: number;
  events: ReplayEvent[];
  oldestSequence: number;
  newestSequence: number;
  hasGap: boolean;
  gapReason: 'replay-trimmed' | null;
};

export type ConnectionSnapshot = {
  contractVersion: number;
  runtimeId: string;
  connectionId: string;
  sessionId: number;
  sequence: number;
  snapshot: {
    protocolStatus: string;
    negotiatedCapabilities: string[];
    mcpState: unknown;
    gmcpState: unknown;
    mcmpState: unknown;
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

  async connect(target: ConnectionTarget, handlers: Handlers): Promise<void> {
    await this.close();

    const token = ++this.sessionToken;
    this.connected = false;
    this.opened = false;

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
  detach(): void {
    this.sessionToken += 1;
    this.connected = false;
    this.opened = false;
    this.lastSequence = 0;

    if (this.unlistenEvents) {
      const unlisten = this.unlistenEvents;
      this.unlistenEvents = null;
      unlisten();
    }
  }

  async attach(handlers: Handlers, afterSequence = 0): Promise<void> {
    this.detach();
    const token = ++this.sessionToken;
    this.lastSequence = afterSequence;

    try {
      await this.startListening(token, handlers);
      const replay = await invoke<ReplayResponse>('attach_mud_connection', {
        connectionId: this.connectionId,
        afterSequence,
      });

      if (this.sessionToken !== token) {
        return;
      }

      if (replay.hasGap) {
        const snapshot = await this.getSnapshot();
        if (this.sessionToken === token) {
          if (acceptsConnectionSnapshot(this.lastSequence, snapshot.sequence)) {
            this.lastSequence = snapshot.sequence;
            handlers.onSnapshot?.(snapshot);
          } else {
            handlers.onDiagnostic?.(
              `[frontend reload snapshot was stale at sequence ${snapshot.sequence}; live state is already at sequence ${this.lastSequence}]`,
            );
          }
        }
        handlers.onDiagnostic?.(
          `[frontend reload missed earlier output; replay starts at sequence ${replay.oldestSequence} (${classifyReplayGap(replay.hasGap, replay.gapReason)})]`,
        );
      }

      for (const event of replay.events) {
        this.dispatchEvent({ ...event, connectionId: this.connectionId }, token, handlers);
      }
    } catch (error) {
      if (this.sessionToken === token) {
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
    this.detach();

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

    if (payload.kind === 'opened') {
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
