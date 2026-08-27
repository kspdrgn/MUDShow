/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDemoTreeDataWindowModel,
} from '../components/tree-data/tree-data-demo-fixture.js';
import {
  createInitialTreeDataWindowViewState,
  createTreeDataViewControllerRegistry,
  reconcileTreeDataWindowViewState,
  reduceTreeDataWindowViewState,
} from '../components/tree-data/tree-data-controller.js';

test('tree data controller creates a root-selected initial view state', () => {
  const viewState = createInitialTreeDataWindowViewState('root-node');

  assert.deepEqual(viewState, {
    selectedNodeId: 'root-node',
    expandedNodeIds: ['root-node'],
  });
});

test('tree data controller updates selection and expansion from typed commands', () => {
  const model = createDemoTreeDataWindowModel();
  const initial = createInitialTreeDataWindowViewState(model.root.id);

  const selected = reduceTreeDataWindowViewState(initial, {
    type: 'nodeSelected',
    nodeId: 'tree-demo-root-page',
  }, model);

  assert.equal(selected.selectedNodeId, 'tree-demo-root-page');

  const expanded = reduceTreeDataWindowViewState(selected, {
    type: 'nodeExpansionToggled',
    nodeId: 'tree-demo-root-page',
  }, model);

  assert.equal(expanded.expandedNodeIds.includes('tree-demo-root-page'), true);

  const collapsed = reduceTreeDataWindowViewState(expanded, {
    type: 'collapseAllRequested',
  }, model);

  assert.deepEqual(collapsed, {
    selectedNodeId: model.root.id,
    expandedNodeIds: [],
  });
});

test('tree data controller can collapse and expand the root again', () => {
  const model = createDemoTreeDataWindowModel();
  const initial = createInitialTreeDataWindowViewState(model.root.id);

  const collapsed = reduceTreeDataWindowViewState(initial, {
    type: 'nodeExpansionToggled',
    nodeId: model.root.id,
  }, model);

  assert.deepEqual(collapsed.expandedNodeIds, []);

  const expanded = reduceTreeDataWindowViewState(collapsed, {
    type: 'nodeExpansionToggled',
    nodeId: model.root.id,
  }, model);

  assert.deepEqual(expanded.expandedNodeIds, [model.root.id]);
});

test('tree data controller reconciles invalid selection back to root', () => {
  const model = createDemoTreeDataWindowModel();
  const reconciled = reconcileTreeDataWindowViewState(
    {
      selectedNodeId: 'missing-node',
      expandedNodeIds: ['missing-node', model.root.id],
    },
    model,
  );

  assert.deepEqual(reconciled, {
    selectedNodeId: model.root.id,
    expandedNodeIds: [model.root.id],
  });
});

test('tree data view controller registry keeps per-window view state isolated', () => {
  const model = createDemoTreeDataWindowModel();
  const registry = createTreeDataViewControllerRegistry();

  const left = registry.ensure('left-window', model.root.id);
  const right = registry.ensure('right-window', model.root.id);

  assert.deepEqual(left, {
    selectedNodeId: model.root.id,
    expandedNodeIds: [model.root.id],
  });
  assert.deepEqual(right, {
    selectedNodeId: model.root.id,
    expandedNodeIds: [model.root.id],
  });

  const updatedLeft = registry.update('left-window', model, {
    type: 'nodeSelected',
    nodeId: 'tree-demo-root-page',
  });

  assert.equal(updatedLeft.selectedNodeId, 'tree-demo-root-page');
  assert.equal(registry.get('right-window')?.selectedNodeId, model.root.id);

  const removed = registry.clear('left-window');

  assert.equal(removed, true);
  assert.equal(registry.get('left-window'), null);
  assert.equal(registry.get('right-window')?.selectedNodeId, model.root.id);
});
