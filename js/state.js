/**
 * Estado del tablero. Funciones puras: sin DOM, sin localStorage.
 * Cada función devuelve un estado nuevo (o el mismo si no hay cambio).
 *
 * @typedef {'todo'|'doing'|'done'} ColumnId
 *
 * @typedef {Object} Card
 * @property {string}   id         crypto.randomUUID()
 * @property {number}   seq        TK-014 -> 14. Solo presentación, nunca se reutiliza
 * @property {string}   title
 * @property {ColumnId} column
 * @property {number}   createdAt  Date.now()
 *
 * @typedef {Object} BoardState
 * @property {1}      version
 * @property {Card[]} cards     el orden del array es el orden visual dentro de cada columna
 * @property {number} nextSeq   contador para los códigos TK-xxx
 * @property {number} revision  +1 por cada cambio (cajetín)
 */

export const COLUMNS = Object.freeze(['todo', 'doing', 'done']);
export const MAX_TITLE_LENGTH = 200;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const isColumn = (value) => COLUMNS.includes(value);

/** Normaliza el título; devuelve '' si no es válido. */
function cleanTitle(title) {
  return typeof title === 'string' ? title.trim().slice(0, MAX_TITLE_LENGTH) : '';
}

const bump = (state, cards) => ({
  ...state,
  cards,
  revision: state.revision + 1,
});

/** @returns {BoardState} */
export function createInitialState() {
  const sample = [
    ['todo', 'Definir el alcance del proyecto'],
    ['todo', 'Arrastrar esta tarjeta a otra columna'],
    ['doing', 'Montar la estructura de módulos'],
    ['done', 'Crear el repositorio'],
  ];
  const now = Date.now();
  return {
    version: 1,
    cards: sample.map(([column, title], i) => ({
      id: crypto.randomUUID(),
      seq: i + 1,
      title,
      column,
      createdAt: now,
    })),
    nextSeq: sample.length + 1,
    revision: 0,
  };
}

/** @returns {BoardState} */
export function addCard(state, title, column = 'todo') {
  const clean = cleanTitle(title);
  if (!clean || !isColumn(column)) return state;
  const card = {
    id: crypto.randomUUID(),
    seq: state.nextSeq,
    title: clean,
    column,
    createdAt: Date.now(),
  };
  return { ...bump(state, [...state.cards, card]), nextSeq: state.nextSeq + 1 };
}

/** @returns {BoardState} */
export function editCard(state, id, title) {
  const clean = cleanTitle(title);
  const card = getCard(state, id);
  if (!card || !clean || clean === card.title) return state;
  return bump(
    state,
    state.cards.map((c) => (c.id === id ? { ...c, title: clean } : c)),
  );
}

/** @returns {BoardState} */
export function deleteCard(state, id) {
  if (!getCard(state, id)) return state;
  return bump(
    state,
    state.cards.filter((c) => c.id !== id),
  );
}

/**
 * toIndex es la posición dentro de la columna destino, contada SIN la
 * tarjeta que se mueve. Se limita a [0, longitud].
 * @returns {BoardState}
 */
export function moveCard(state, id, toColumn, toIndex) {
  const card = getCard(state, id);
  if (!card || !isColumn(toColumn) || !Number.isFinite(toIndex)) return state;

  const rest = state.cards.filter((c) => c.id !== id);
  const dest = rest.filter((c) => c.column === toColumn);
  const index = clamp(Math.trunc(toIndex), 0, dest.length);

  // Posición en el array plano: antes de la tarjeta que ocupa `index`,
  // o justo después de la última de la columna, o al final si está vacía.
  let at = rest.length;
  if (index < dest.length) at = rest.indexOf(dest[index]);
  else if (dest.length > 0) at = rest.indexOf(dest[dest.length - 1]) + 1;

  const cards = [...rest.slice(0, at), { ...card, column: toColumn }, ...rest.slice(at)];
  const unchanged = cards.every((c, i) => c.id === state.cards[i].id && c.column === state.cards[i].column);
  return unchanged ? state : bump(state, cards);
}

/** @returns {Card[]} */
export function getColumnCards(state, column) {
  return state.cards.filter((c) => c.column === column);
}

/** @returns {Card|undefined} */
export function getCard(state, id) {
  return state.cards.find((c) => c.id === id);
}

/** @returns {string} p. ej. 'TK-014' */
export function formatCode(card) {
  return `TK-${String(card.seq).padStart(3, '0')}`;
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

/** Valida estructura y tipos de un valor desconocido (localStorage, importación). */
export function isValidState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return false;
  if (!Array.isArray(value.cards) || !isCount(value.nextSeq) || !isCount(value.revision)) return false;

  const ids = new Set();
  for (const c of value.cards) {
    if (!c || typeof c !== 'object') return false;
    if (typeof c.id !== 'string' || !c.id || ids.has(c.id)) return false;
    if (!Number.isInteger(c.seq) || c.seq < 1 || c.seq >= value.nextSeq) return false;
    if (typeof c.title !== 'string' || !c.title.trim() || c.title.length > MAX_TITLE_LENGTH) return false;
    if (!isColumn(c.column) || !Number.isFinite(c.createdAt)) return false;
    ids.add(c.id);
  }
  return true;
}
