import {
  parseWorldSurfaceCommand,
  type WorldSurfaceCommand,
  type WorldSurfaceJsonObject,
  type WorldSurfaceOpenRequest,
} from '../world-surface-protocol.js';
import type { SurfaceTransportSession } from './surface-transport.js';

export interface WorldSurfaceController<Model extends WorldSurfaceJsonObject, Command extends WorldSurfaceJsonObject = WorldSurfaceJsonObject> {
  open(request: WorldSurfaceOpenRequest): void | Promise<void>;
  snapshot(): Model;
  handleCommand(command: WorldSurfaceCommand & { payload?: Command }): void | Promise<void>;
  dispose(reason?: string): void | Promise<void>;
}

export interface SurfaceControllerBinding {
  dispose(): void;
  publish(): void;
}

/**
 * Connect one controller to one transport session. The binding is the only
 * adapter a feature needs to know about; it does not need to know whether the
 * session is rendered in Dockview or a native webview.
 */
export function bindWorldSurfaceController<
  Model extends WorldSurfaceJsonObject,
  Command extends WorldSurfaceJsonObject,
>(
  session: SurfaceTransportSession<Command, Model>,
  request: WorldSurfaceOpenRequest,
  controller: WorldSurfaceController<Model, Command>,
): SurfaceControllerBinding {
  let disposed = false;
  const unlistenCommand = session.onCommand((rawCommand) => {
    const command = parseWorldSurfaceCommand(rawCommand);
    if (!command || command.surfaceId !== request.surface.surfaceId || command.instanceId !== request.instanceId) {
      return;
    }

    void Promise.resolve(controller.handleCommand(command as WorldSurfaceCommand & { payload?: Command }))
      .then(() => {
        if (!disposed) {
          session.publishSnapshot(controller.snapshot());
        }
      })
      .catch(() => {
        session.publishError({
          code: 'controller-error',
          message: 'surface controller failed to handle a command',
          requestId: command.requestId,
        });
      });
  });

  const unlistenLifecycle = session.onLifecycle((event) => {
    if (disposed || event.type !== 'resyncRequested') {
      return;
    }
    session.publishSnapshot(controller.snapshot());
  });

  void Promise.resolve(controller.open(request)).then(() => {
    if (!disposed) {
      session.publishSnapshot(controller.snapshot());
    }
  });

  return {
    publish() {
      if (!disposed) {
        session.publishSnapshot(controller.snapshot());
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      unlistenCommand();
      unlistenLifecycle();
      void controller.dispose('surface binding disposed');
      session.close('surface controller disposed');
    },
  };
}
