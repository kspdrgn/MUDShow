import type { SurfaceTransportSession } from '../../surfaces/surface-transport';
import type { TreeDataWindowCommand } from './tree-data-controller';
import type { TreeDataWindowModel, TreeDataWindowViewState } from './tree-data-view';

export interface TreeDataWindowSnapshot {
  model: TreeDataWindowModel;
  viewState: TreeDataWindowViewState;
}

export type TreeDataWindowTransportSession = SurfaceTransportSession<
  TreeDataWindowCommand,
  TreeDataWindowSnapshot
>;

