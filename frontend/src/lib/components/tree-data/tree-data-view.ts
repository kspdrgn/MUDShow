export type TreeDataNodeKind = 'branch' | 'leaf';
export type TreeDataNodeState = 'unknown' | 'loading' | 'loaded' | 'missing';

export interface TreeDataNode {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  kind: TreeDataNodeKind;
  valueState: TreeDataNodeState;
  childrenState: TreeDataNodeState;
  expanded?: boolean;
  children?: TreeDataNode[];
}

export interface TreeDataWindowModel {
  title: string;
  description?: string;
  root: TreeDataNode;
}

export interface TreeDataVisibleNode {
  node: TreeDataNode;
  depth: number;
  hasChildren: boolean;
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

export function flattenVisibleTreeDataNodes(root: TreeDataNode): TreeDataVisibleNode[] {
  const rows: TreeDataVisibleNode[] = [];

  function visit(node: TreeDataNode, depth: number): void {
    rows.push({
      node,
      depth,
      hasChildren: node.kind === 'branch' && node.childrenState !== 'missing',
    });

    if (!node.expanded) {
      return;
    }

    for (const child of node.children ?? []) {
      visit(child, depth + 1);
    }
  }

  visit(root, 0);
  return rows;
}

export function toggleTreeDataNodeExpansion(root: TreeDataNode, nodeId: string): TreeDataNode {
  return updateTreeDataNode(root, nodeId, (node) => {
    if (node.kind !== 'branch') {
      return node;
    }

    return {
      ...node,
      expanded: !node.expanded,
    };
  });
}

export function setTreeDataNodeExpansion(root: TreeDataNode, nodeId: string, expanded: boolean): TreeDataNode {
  return updateTreeDataNode(root, nodeId, (node) => {
    if (node.kind !== 'branch') {
      return node;
    }

    return {
      ...node,
      expanded,
    };
  });
}

export function setTreeDataDescendantsExpansion(root: TreeDataNode, expanded: boolean): TreeDataNode {
  return {
    ...root,
    expanded: true,
    children: root.children?.map((child) => setTreeDataNodeExpansionRecursive(child, expanded)) ?? [],
  };
}

export function findTreeDataNode(root: TreeDataNode, nodeId: string): TreeDataNode | null {
  if (root.id === nodeId) {
    return root;
  }

  for (const child of root.children ?? []) {
    const match = findTreeDataNode(child, nodeId);
    if (match) {
      return match;
    }
  }

  return null;
}

function setTreeDataNodeExpansionRecursive(node: TreeDataNode, expanded: boolean): TreeDataNode {
  const nextChildren = node.children?.map((child) => setTreeDataNodeExpansionRecursive(child, expanded)) ?? [];

  if (nextChildren.length === 0) {
    return {
      ...node,
      expanded: false,
      children: nextChildren,
    };
  }

  return {
    ...node,
    expanded,
    children: nextChildren,
  };
}

function updateTreeDataNode(
  root: TreeDataNode,
  nodeId: string,
  updater: (node: TreeDataNode) => TreeDataNode,
): TreeDataNode {
  if (root.id === nodeId) {
    return updater(root);
  }

  const nextChildren = root.children?.map((child) => updateTreeDataNode(child, nodeId, updater)) ?? [];
  const changed = nextChildren.some((child, index) => child !== root.children?.[index]);

  if (!changed) {
    return root;
  }

  return {
    ...root,
    children: nextChildren,
  };
}
