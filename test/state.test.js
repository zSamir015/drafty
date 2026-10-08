import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TITLE_LENGTH,
  PRIORITIES,
  addCard,
  createInitialState,
  deleteCard,
  editCard,
  formatCode,
  getColumnCards,
  isOverdue,
  isValidState,
  matchesQuery,
  moveCard,
  progress,
  updateCard,
} from '../js/state.js';

const empty = () => ({ version: 1, cards: [], nextSeq: 1, revision: 0 });
const titles = (s, column) => getColumnCards(s, column).map((c) => c.title);

/** todo: A, B · doing: C */
function board() {
  let s = empty();
  s = addCard(s, 'A', 'todo');
  s = addCard(s, 'B', 'todo');
  s = addCard(s, 'C', 'doing');
  return s;
}

test('addCard agrega al final, sube seq y revision', () => {
  const s = addCard(empty(), 'Hola', 'todo');
  assert.equal(s.cards.length, 1);
  assert.equal(s.cards[0].seq, 1);
  assert.equal(s.nextSeq, 2);
  assert.equal(s.revision, 1);
});

test('addCard ignora títulos vacíos y columnas inválidas (misma referencia)', () => {
  const s = empty();
  assert.equal(addCard(s, '   ', 'todo'), s);
  assert.equal(addCard(s, 'X', 'nope'), s);
});

test('addCard recorta espacios y limita la longitud', () => {
  const s = addCard(empty(), `  ${'x'.repeat(300)}  `, 'todo');
  assert.equal(s.cards[0].title.length, MAX_TITLE_LENGTH);
});

test('editCard cambia el título; igual o vacío devuelve el mismo estado', () => {
  const s = board();
  const id = s.cards[0].id;
  assert.equal(titles(editCard(s, id, 'Nuevo'), 'todo')[0], 'Nuevo');
  assert.equal(editCard(s, id, 'A'), s);
  assert.equal(editCard(s, id, '  '), s);
  assert.equal(editCard(s, 'no-existe', 'Z'), s);
});

test('deleteCard elimina; id desconocido devuelve el mismo estado', () => {
  const s = board();
  assert.deepEqual(titles(deleteCard(s, s.cards[0].id), 'todo'), ['B']);
  assert.equal(deleteCard(s, 'no-existe'), s);
});

test('moveCard reordena dentro de la columna', () => {
  const s = board();
  const a = s.cards[0].id;
  assert.deepEqual(titles(moveCard(s, a, 'todo', 1), 'todo'), ['B', 'A']);
});

test('moveCard entre columnas inserta en el índice pedido', () => {
  const s = board();
  const a = s.cards[0].id;
  const moved = moveCard(s, a, 'doing', 0);
  assert.deepEqual(titles(moved, 'doing'), ['A', 'C']);
  assert.deepEqual(titles(moved, 'todo'), ['B']);
});

test('moveCard a una columna vacía', () => {
  const s = board();
  const moved = moveCard(s, s.cards[0].id, 'done', 0);
  assert.deepEqual(titles(moved, 'done'), ['A']);
});

test('moveCard a la misma posición devuelve el mismo estado', () => {
  const s = board();
  assert.equal(moveCard(s, s.cards[0].id, 'todo', 0), s);
});

test('formatCode rellena a tres dígitos', () => {
  assert.equal(formatCode({ seq: 14 }), 'TK-014');
});

test('isValidState acepta el estado inicial y rechaza basura', () => {
  assert.equal(isValidState(createInitialState()), true);
  assert.equal(isValidState(null), false);
  assert.equal(isValidState({ version: 2 }), false);
  const s = board();
  const dup = { ...s, cards: [s.cards[0], s.cards[0]] };
  assert.equal(isValidState(dup), false);
});

test('updateCard aplica prioridad, etiqueta y fecha; valores inválidos no cambian nada', () => {
  const s = board();
  const id = s.cards[0].id;
  const next = updateCard(s, id, { priority: 'high', label: '  ui  ', due: 1000 });
  const card = next.cards[0];
  assert.equal(card.priority, 'high');
  assert.equal(card.label, 'ui');
  assert.equal(card.due, 1000);
  assert.equal(updateCard(s, id, { priority: 'urgente' }), s);
  assert.equal(updateCard(s, id, { due: 'mañana' }), s);
  assert.equal(updateCard(next, id, { priority: 'high' }), next);
  assert.deepEqual(PRIORITIES, ['low', 'med', 'high']);
});

test('updateCard: label vacío o null lo quita; se limita a 20 caracteres', () => {
  const s = updateCard(board(), board().cards[0].id, {});
  const id = s.cards[0].id;
  const withLabel = updateCard(s, id, { label: 'x'.repeat(30) });
  assert.equal(withLabel.cards[0].label.length, 20);
  assert.equal(updateCard(withLabel, id, { label: '' }).cards[0].label, null);
});

test('matchesQuery busca en título, etiqueta y código', () => {
  const card = { seq: 7, title: 'Diseñar logo', label: 'marca' };
  assert.equal(matchesQuery(card, ''), true);
  assert.equal(matchesQuery(card, 'LOGO'), true);
  assert.equal(matchesQuery(card, 'marca'), true);
  assert.equal(matchesQuery(card, 'tk-007'), true);
  assert.equal(matchesQuery(card, 'backend'), false);
});

test('isOverdue: fecha pasada y no hecha', () => {
  const now = new Date(2026, 9, 8, 15).getTime();
  const yesterday = new Date(2026, 9, 7).getTime();
  const today = new Date(2026, 9, 8).getTime();
  assert.equal(isOverdue({ due: yesterday, column: 'todo' }, now), true);
  assert.equal(isOverdue({ due: today, column: 'todo' }, now), false);
  assert.equal(isOverdue({ due: yesterday, column: 'done' }, now), false);
  assert.equal(isOverdue({ due: null, column: 'todo' }, now), false);
});

test('progress cuenta hechas sobre total', () => {
  assert.deepEqual(progress(board()), { done: 0, total: 3 });
  assert.deepEqual(progress(empty()), { done: 0, total: 0 });
});

test('isValidState acepta campos opcionales válidos y rechaza inválidos', () => {
  const s = board();
  const ok = { ...s, cards: s.cards.map((c) => ({ ...c, priority: 'low', label: 'a', due: 5 })) };
  assert.equal(isValidState(ok), true);
  const bad = { ...s, cards: s.cards.map((c) => ({ ...c, priority: 'x' })) };
  assert.equal(isValidState(bad), false);
});
