import type { DebugConsoleWindowCommand, DebugConsoleWindowSnapshot } from '../debug-console/debug-console-transport';
import type { NotesWindowCommand, NotesWindowSnapshot } from '../notes/notes-transport';
import type { TreeDataWindowSnapshot } from '../tree-data/tree-data-transport';
import type { TreeDataWindowCommand } from '../tree-data/tree-data-controller';
import type { TreeDataWindowViewState } from '../tree-data/tree-data-view';
import type { DockviewPanelPlacement } from './dockview-panel-types';
import type { SurfaceEdge } from '../../surfaces/surface-registry';

export interface DockviewDebugConsolePanelDefinition {
  kind: 'debug-console';
  instanceId: string;
  title: string;
  model: DebugConsoleWindowSnapshot['model'];
  onCommand: (command: DebugConsoleWindowCommand) => void;
  getPreviousDockedEdge: () => SurfaceEdge | undefined;
  onClose: () => void;
  onPopOutNative: () => void;
  onPlacementChange: (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void;
  onBoundsChange: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
  initialPlacement: DockviewPanelPlacement;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface DockviewNotesPanelDefinition {
  kind: 'notes';
  instanceId: string;
  title: string;
  model: NotesWindowSnapshot['model'];
  onCommand: (command: NotesWindowCommand) => void;
  getPreviousDockedEdge: () => SurfaceEdge | undefined;
  onClose: () => void;
  onPopOutNative: () => void;
  onPlacementChange: (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void;
  onBoundsChange: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
  initialPlacement: DockviewPanelPlacement;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface DockviewTreeDataPanelDefinition {
  kind: 'tree-data';
  instanceId: string;
  title: string;
  model: TreeDataWindowSnapshot['model'];
  viewState: TreeDataWindowViewState;
  onCommand: (command: TreeDataWindowCommand) => void;
  getPreviousDockedEdge: () => SurfaceEdge | undefined;
  onClose: () => void;
  onPopOutNative: () => void;
  onPlacementChange: (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void;
  onBoundsChange: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
  initialPlacement: DockviewPanelPlacement;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface DockviewDummyWindowPanelDefinition {
  kind: 'dummy-window';
  instanceId: string;
  title: string;
  eyebrow: string;
  description: string;
  tone: 'workspace' | 'accent' | 'muted' | 'warning';
  getPreviousDockedEdge: () => SurfaceEdge | undefined;
  onClose: () => void;
  onPopOutNative: () => void;
  onPlacementChange: (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => void;
  onBoundsChange: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
  initialPlacement: DockviewPanelPlacement;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}
