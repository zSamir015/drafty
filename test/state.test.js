import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TITLE_LENGTH,
  addCard,
  createInitialState,
  deleteCard,
  editCard,
  formatCode,
  getColumnCards,
  isValidState,
  moveCard,
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
