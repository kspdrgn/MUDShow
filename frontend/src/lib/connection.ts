import { invoke } from './tauri';

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
};

type ConnectionEvent =
  | { kind: 'data'; text: string }
  | { kind: 'closed'; reason: string }
  | { kind: 'error'; message: string };

export class MudConnection {
  private sessionToken = 0;
  private connected = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async connect(target: ConnectionTarget, handlers: Handlers): Promise<void> {
    await this.close();

    const token = ++this.sessionToken;
    this.connected = false;

    try {
      await invoke('connect_mud', target);
      if (this.sessionToken === token) {
        this.connected = true;
        handlers.onOpen();
        this.startPolling(token, handlers);
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

    void invoke('send_mud', { text }).catch(() => undefined);
  }

  async close(): Promise<void> {
    this.sessionToken += 1;
    this.connected = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    await invoke('disconnect_mud').catch(() => undefined);
  }

  private startPolling(token: number, handlers: Handlers): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      void this.pollOnce(token, handlers);
    }, 100);
  }

  private async pollOnce(token: number, handlers: Handlers): Promise<void> {
    if (this.sessionToken !== token) {
      return;
    }

    try {
      const events = await invoke<ConnectionEvent[]>('poll_mud');
      if (this.sessionToken !== token) {
        return;
      }

      for (const event of events) {
        if (event.kind === 'data') {
          handlers.onMessage(event.text);
        } else if (event.kind === 'closed') {
          this.connected = false;
          await this.close();
          handlers.onClose();
          return;
        } else {
          this.connected = false;
          await this.close();
          handlers.onError(event.message);
          return;
        }
      }
    } catch {
      if (this.sessionToken === token) {
        this.connected = false;
        await this.close();
        handlers.onError('Connection polling failed.');
      }
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
