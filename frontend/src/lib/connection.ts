import { invoke, listen } from './tauri';

type Handlers = {
  onOpen: () => void;
  onMessage: (text: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

type ConnectionTarget = {
  host: string;
  port: number;
  tls: boolean;
  verifyCertificate: boolean;
};

type ConnectionEvent =
  | { connectionId: string; kind: 'opened' }
  | { connectionId: string; kind: 'data'; text: string }
  | { connectionId: string; kind: 'closed'; reason: string }
  | { connectionId: string; kind: 'error'; message: string };

export class MudConnection {
  constructor(private readonly connectionId: string) {}

  private sessionToken = 0;
  private connected = false;
  private opened = false;
  private unlistenEvents: (() => void) | null = null;

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

  send(text: string): void {
    if (!this.connected) {
      return;
    }

    void invoke('send_mud', { connectionId: this.connectionId, text }).catch(() => undefined);
  }

  async close(): Promise<void> {
    this.sessionToken += 1;
    this.connected = false;

    if (this.unlistenEvents) {
      const unlisten = this.unlistenEvents;
      this.unlistenEvents = null;
      unlisten();
    }

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

      this.connected = false;
      void this.close();

      if (payload.kind === 'closed') {
        handlers.onClose();
      } else {
        handlers.onError(payload.message);
      }
    });

    if (this.sessionToken !== token) {
      unlisten();
      return;
    }

    this.unlistenEvents = unlisten;
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
