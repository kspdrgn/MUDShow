import {
  type TreeDataNodePatch,
  setTreeDataDescendantsExpansion,
  toggleTreeDataNodeExpansion,
  type TreeDataNode,
  type TreeDataWindowModel,
} from './tree-data-view';

export interface TreeDataWindowState {
  model: TreeDataWindowModel;
  selectedNodeId: string | null;
}

export interface TreeDataDemoLoadRequest {
  knownToHaveChildren: boolean;
}

const TREE_DATA_DEMO_LOAD_DELAY_MS = 220;
const DEMO_DIRECTORY_NAMES = [
  'archive',
  'boxers',
  'cache',
  'cinder',
  'copper',
  'ember',
  'glyph',
  'moss',
  'pants',
  'ridge',
  'signal',
  'velvet',
];
const DEMO_VALUE_TEXTS = [
  'quietly humming',
  'dust and rain',
  'narrow corridor',
  'blue and bright',
  'warm and heavy',
  'softly glowing',
  'freshly polished',
  'low gravity',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pickDemoItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createDemoChildId(parentId: string, suffix: string): string {
  return `${parentId}-${suffix}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDemoTreeDataWindowModel(): TreeDataWindowModel {
  return {
    title: 'me',
    description: undefined,
    root: {
      id: 'tree-demo-root',
      title: '/',
      subtitle: 'root directory listing',
      badge: 'root',
      kind: 'branch',
      valueState: 'loaded',
      childrenState: 'loaded',
      expanded: true,
      children: [
        {
          id: 'tree-demo-root-dir',
          title: '/_/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'unknown',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-page',
          title: '/_page/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'unknown',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-prefs',
          title: '/_prefs/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'unknown',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-scent',
          title: '/_scent',
          subtitle: 'Smells like the dragons she lives with, of exercise and school and play.',
          badge: 'str',
          kind: 'leaf',
          valueState: 'loaded',
          childrenState: 'missing',
        },
        {
          id: 'tree-demo-root-morph',
          title: '/morph#/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'unknown',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-redesc',
          title: '/redesc#/',
          subtitle: '7',
          badge: 'str',
          kind: 'branch',
          valueState: 'loaded',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-ride',
          title: '/ride/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'loaded',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-sex',
          title: '/sex',
          subtitle: 'girl',
          badge: 'str',
          kind: 'leaf',
          valueState: 'loaded',
          childrenState: 'missing',
        },
        {
          id: 'tree-demo-root-species',
          title: '/species',
          subtitle: 'drgn',
          badge: 'str',
          kind: 'leaf',
          valueState: 'loaded',
          childrenState: 'missing',
        },
        {
          id: 'tree-demo-morph-children',
          title: '/morph#/',
          subtitle: 'child listing',
          badge: 'dir',
          kind: 'branch',
          valueState: 'unknown',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-ride-mode',
          title: '/ride/_mode',
          subtitle: 'walk',
          badge: 'str',
          kind: 'leaf',
          valueState: 'loaded',
          childrenState: 'missing',
        },
      ],
    },
  };
}

export function createDemoTreeDataWindowState(): TreeDataWindowState {
  const model = createDemoTreeDataWindowModel();
  return {
    model,
    selectedNodeId: model.root.id,
  };
}

export async function loadDemoTreeDataWindowNode(
  nodeId: string,
  request: TreeDataDemoLoadRequest,
): Promise<TreeDataNodePatch> {
  await delay(TREE_DATA_DEMO_LOAD_DELAY_MS);

  if (request.knownToHaveChildren) {
    const childPrefix = createDemoChildId(nodeId, 'dir');
    const childTitle = pickDemoItem(DEMO_DIRECTORY_NAMES);

    return {
      kind: 'branch',
      badge: 'dir',
      valueState: 'loaded',
      childrenState: 'loaded',
      expanded: true,
      subtitle: pickDemoItem(DEMO_VALUE_TEXTS),
      children: [
        {
          id: createDemoChildId(childPrefix, 'child-dir'),
          title: `${childTitle}/`,
          badge: 'dir',
          kind: 'branch',
          valueState: 'unknown',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: createDemoChildId(childPrefix, 'child-leaf'),
          title: pickDemoItem(DEMO_DIRECTORY_NAMES),
          subtitle: pickDemoItem(DEMO_VALUE_TEXTS),
          badge: 'str',
          kind: 'leaf',
          valueState: 'loaded',
          childrenState: 'missing',
        },
      ],
    };
  }

  return {
    kind: 'leaf',
    badge: 'str',
    valueState: 'loaded',
    childrenState: 'missing',
    expanded: null,
    children: null,
    subtitle: pickDemoItem(DEMO_VALUE_TEXTS),
  };
}

export function updateDemoTreeDataWindowSelection(
  state: TreeDataWindowState,
  nodeId: string,
): TreeDataWindowState {
  return {
    ...state,
    selectedNodeId: nodeId,
  };
}

export function toggleDemoTreeDataWindowNode(
  state: TreeDataWindowState,
  nodeId: string,
): TreeDataWindowState {
  return {
    ...state,
    model: {
      ...state.model,
      root: toggleTreeDataNodeExpansion(state.model.root, nodeId),
    },
  };
}

export function expandAllDemoTreeDataWindowNodes(state: TreeDataWindowState): TreeDataWindowState {
  return {
    ...state,
    model: {
      ...state.model,
      root: setTreeDataDescendantsExpansion(state.model.root, true),
    },
  };
}

export function collapseAllDemoTreeDataWindowNodes(state: TreeDataWindowState): TreeDataWindowState {
  return {
    model: {
      ...state.model,
      root: setTreeDataDescendantsExpansion(state.model.root, false),
    },
    selectedNodeId: state.model.root.id,
  };
}
