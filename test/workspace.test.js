import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCard, createInitialState } from '../js/state.js';
import {
  activeBoard,
  addBoard,
  createWorkspace,
  deleteBoard,
  isValidWorkspace,
  migrate,
  renameBoard,
  setActive,
  setWip,
  updateActive,
} from '../js/workspace.js';

test('migrate wraps a v1 state without losing cards', () => {
  const v1 = createInitialState();
  const ws = migrate(v1);
  assert.equal(ws.version, 2);
  assert.equal(activeBoard(ws).state, v1);
  assert.equal(isValidWorkspace(ws), true);
});

test('migrate keeps a valid workspace as is and rejects junk', () => {
  const ws = createWorkspace();
  assert.equal(migrate(ws), ws);
  assert.equal(migrate({ hola: 1 }), null);
  assert.equal(migrate(null), null);
});

test('updateActive only changes the active board', () => {
  let ws = createWorkspace();
  ws = addBoard(ws, 'Otro');
  const other = ws.boards[0];
  const next = updateActive(ws, (s) => addCard(s, 'Nueva', 'todo'));
  assert.equal(next.boards[0], other);
  assert.equal(activeBoard(next).state.cards.length, 1);
  assert.equal(updateActive(ws, (s) => s), ws);
});

test('addBoard creates an empty board and activates it', () => {
  const ws = addBoard(createWorkspace(), '  Personal ');
  assert.equal(ws.boards.length, 2);
  assert.equal(activeBoard(ws).name, 'Personal');
  assert.equal(activeBoard(ws).state.cards.length, 0);
});

test('renameBoard and setActive', () => {
  let ws = addBoard(createWorkspace(), 'B');
  const first = ws.boards[0].id;
  ws = renameBoard(ws, first, 'Trabajo');
  assert.equal(ws.boards[0].name, 'Trabajo');
  assert.equal(renameBoard(ws, first, '   '), ws);
  ws = setActive(ws, first);
  assert.equal(ws.activeId, first);
  assert.equal(setActive(ws, 'nope'), ws);
});

test('deleteBoard keeps the last board and activates a neighbor', () => {
  const single = createWorkspace();
  assert.equal(deleteBoard(single, single.activeId), single);
  let ws = addBoard(single, 'B');
  ws = deleteBoard(ws, ws.activeId);
  assert.equal(ws.boards.length, 1);
  assert.equal(ws.activeId, ws.boards[0].id);
});

test('setWip validates the limit', () => {
  const ws = createWorkspace();
  assert.equal(activeBoard(setWip(ws, 3)).wip, 3);
  assert.equal(activeBoard(setWip(setWip(ws, 3), null)).wip, null);
  assert.equal(setWip(ws, 0), ws);
  assert.equal(setWip(ws, 2.5), ws);
});

test('isValidWorkspace rejects a missing activeId or invalid boards', () => {
  const ws = createWorkspace();
  assert.equal(isValidWorkspace({ ...ws, activeId: 'x' }), false);
  assert.equal(isValidWorkspace({ ...ws, boards: [] }), false);
  assert.equal(isValidWorkspace({ ...ws, boards: [{ ...ws.boards[0], state: { version: 1 } }] }), false);
});
