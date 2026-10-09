import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, push, redo, undo } from '../js/history.js';

test('undo with no past returns null', () => {
  assert.equal(undo(createHistory(), 'now'), null);
});

test('push + undo returns the previous state and keeps the current one for redo', () => {
  let h = push(createHistory(), 'A');
  const back = undo(h, 'B');
  assert.equal(back.state, 'A');
  const forward = redo(back.history, 'A');
  assert.equal(forward.state, 'B');
});

test('push clears the future', () => {
  let h = push(createHistory(), 'A');
  h = undo(h, 'B').history;
  h = push(h, 'C');
  assert.equal(redo(h, 'C'), null);
});

test('the past is capped', () => {
  let h = createHistory(3);
  for (const s of ['1', '2', '3', '4']) h = push(h, s);
  assert.deepEqual(h.past, ['2', '3', '4']);
});

test('multiple undos walk the past in reverse order', () => {
  let h = createHistory();
  h = push(h, 'A');
  h = push(h, 'B');
  const first = undo(h, 'C');
  assert.equal(first.state, 'B');
  const second = undo(first.history, 'B');
  assert.equal(second.state, 'A');
  assert.equal(undo(second.history, 'A'), null);
});
