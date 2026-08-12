import {
  setTreeDataDescendantsExpansion,
  toggleTreeDataNodeExpansion,
  type TreeDataWindowModel,
} from './tree-data-view';

export interface TreeDataWindowState {
  model: TreeDataWindowModel;
  selectedNodeId: string | null;
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
          valueState: 'loaded',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-page',
          title: '/_page/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'loaded',
          childrenState: 'unknown',
          expanded: false,
        },
        {
          id: 'tree-demo-root-prefs',
          title: '/_prefs/',
          badge: 'dir',
          kind: 'branch',
          valueState: 'loaded',
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
          valueState: 'loaded',
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
          childrenState: 'loaded',
          expanded: true,
          children: [
            {
              id: 'tree-demo-redesc-1',
              title: '/redesc#/1',
              subtitle: 'Kayol is a strange fox, an unusual wolf, and an even stranger jackal. His heritage is a mix amongst the three, though heavy on the wolf and light on the fox. His frontside is a soft muddy grey and the rest of him varies from dark grey to black. His back is a ruddy charcoal with black scorch marks almost like a GSD.',
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
            {
              id: 'tree-demo-redesc-2',
              title: '/redesc#/2',
              subtitle: 'He stands around 5\'5" on plantigrade paws, though unusually long ears make him appear taller, thanks to the bit of jackal in his family line.',
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
            {
              id: 'tree-demo-redesc-3',
              title: '/redesc#/3',
              subtitle: "He wears snug fitting and tough looking dark bluish grey cargos with integral kneepads and a sturdy metal waistline that betrays the pants to be half of a Suit. His hips, thighs, and calves are decorated with small pockets both functional and numerous, but don't obscure his slender legs beneath. The cuffs of his pants are linked to rugged voidwalker boots over plantigrade feet.",
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
            {
              id: 'tree-demo-redesc-4',
              title: '/redesc#/4',
              subtitle: 'Hiding his torso is an open grey vest over a partially transparent black cling tee. His arms past the tee are bare and show dark grey fur and then the subdued shadow of a fox\'s gloves wrapping his forearms. Well worn black fingerless actual gloves protect his hands while leaving his fingertips free for delicate work.',
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
            {
              id: 'tree-demo-redesc-5',
              title: '/redesc#/5',
              subtitle: 'The tight shirt across his torso reveals the shape of a very slim and shapely jackal. Beneath the short dark fur there is tone revealing his wiry muscles are quite strong from working frequently with heavy things in low gravity. The tone keeps him from looking scrawny, which might be easy because his tight shirt reveals no fat.',
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
            {
              id: 'tree-demo-redesc-6',
              title: '/redesc#/6',
              subtitle: "His tail shows the same ghosted shadows from his fox ancestry along its tip, while the fur is a bit thicker than a wolf's, but not quite bushy enough to be called a fox's.",
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
            {
              id: 'tree-demo-redesc-7',
              title: '/redesc#/7',
              subtitle: 'The wolf wears blue tinted goggles, sometimes pushed up onto his forehead\'s short natural headfur to reveal striking amber eyes.',
              badge: 'str',
              kind: 'leaf',
              valueState: 'loaded',
              childrenState: 'missing',
            },
          ],
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
          valueState: 'loaded',
          childrenState: 'loaded',
          expanded: true,
          children: [
            {
              id: 'tree-demo-morph-boxers',
              title: '/morph#/boxers#/',
              badge: 'dir',
              kind: 'branch',
              valueState: 'loaded',
              childrenState: 'missing',
              expanded: false,
            },
            {
              id: 'tree-demo-morph-pants',
              title: '/morph#/pants#/',
              badge: 'dir',
              kind: 'branch',
              valueState: 'loaded',
              childrenState: 'missing',
              expanded: false,
            },
          ],
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
