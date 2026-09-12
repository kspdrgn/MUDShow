export interface WorldSessionService {
  load?(): Promise<unknown>;
  flush?(): Promise<void>;
  dispose?(): Promise<void> | void;
}

export interface WorldSessionServiceKey<T extends WorldSessionService> {
  readonly id: string;
  readonly __service?: T;
}

export interface WorldSessionServiceHost {
  get<T extends WorldSessionService>(key: WorldSessionServiceKey<T>): T | null;
  register<T extends WorldSessionService>(key: WorldSessionServiceKey<T>, service: T): T;
  load(): Promise<void>;
  close(): Promise<void>;
}

export interface WorldSessionServiceHostOptions {
  flushTimeoutMs?: number;
}

export const WORLD_SESSION_SERVICE_FLUSH_TIMEOUT_MS = 5_000;

export function createWorldSessionServiceKey<T extends WorldSessionService>(
  id: string,
): WorldSessionServiceKey<T> {
  return { id };
}

export function createWorldSessionServiceHost({
  flushTimeoutMs = WORLD_SESSION_SERVICE_FLUSH_TIMEOUT_MS,
}: WorldSessionServiceHostOptions = {}): WorldSessionServiceHost {
  const services = new Map<string, WorldSessionService>();
  let closed = false;

  async function load(): Promise<void> {
    if (closed) {
      return;
    }

    await Promise.all([...services.entries()].map(async ([id, service]) => {
      try {
        await service.load?.();
      } catch (error) {
        console.error(`[session-services] failed to load ${id}`, error);
      }
    }));
  }

  async function flush(id: string, service: WorldSessionService): Promise<void> {
    if (!service.flush) {
      return;
    }

    let timedOut = false;
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const operation = Promise.resolve().then(() => service.flush?.());
    await new Promise<void>((resolve) => {
      const finish = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        resolve();
      };

      timeoutHandle = setTimeout(() => {
        timedOut = true;
        console.error(`[session-services] timed out flushing ${id}`);
        finish();
      }, flushTimeoutMs);

      operation.then(
        () => {
          if (timedOut) {
            console.info(`[session-services] late flush completed for ${id}`);
          }
          finish();
        },
        (error) => {
          console.error(
            `[session-services] ${timedOut ? 'late ' : ''}flush failed for ${id}`,
            error,
          );
          finish();
        },
      );
    });
  }

  async function close(): Promise<void> {
    if (closed) {
      return;
    }

    closed = true;
    await Promise.all([...services.entries()].map(([id, service]) => flush(id, service)));
    await Promise.all([...services.entries()].map(async ([id, service]) => {
      try {
        await service.dispose?.();
      } catch (error) {
        console.error(`[session-services] failed to dispose ${id}`, error);
      }
    }));
    services.clear();
  }

  return {
    get<T extends WorldSessionService>(key: WorldSessionServiceKey<T>): T | null {
      return (services.get(key.id) as T | undefined) ?? null;
    },
    register<T extends WorldSessionService>(key: WorldSessionServiceKey<T>, service: T): T {
      if (closed) {
        throw new Error(`cannot register closed world session service host: ${key.id}`);
      }
      services.set(key.id, service);
      return service;
    },
    load,
    close,
  };
}
