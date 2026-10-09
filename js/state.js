/**
 * Board state. Pure functions: no DOM, no localStorage.
 * Every function returns a new state (or the same one if nothing changed).
 *
 * @typedef {'todo'|'doing'|'done'} ColumnId
 *
 * @typedef {Object} Card
 * @property {string}   id         crypto.randomUUID()
 * @property {number}   seq        TK-014 -> 14. Display only, never reused
 * @property {string}   title
 * @property {ColumnId} column
 * @property {number}   createdAt  Date.now()
 * @property {Priority|null} [priority]
 * @property {string|null}   [label]  up to MAX_LABEL_LENGTH characters
 * @property {number|null}   [due]    due-date timestamp (local midnight)
 *
 * @typedef {'low'|'med'|'high'} Priority
 *
 * @typedef {Object} BoardState
 * @property {1}      version
 * @property {Card[]} cards     array order is the visual order within each column
 * @property {number} nextSeq   counter for the TK-xxx codes
 * @property {number} revision  +1 on every change (shown in the title block)
 */

export const COLUMNS = Object.freeze(['todo', 'doing', 'done']);
export const MAX_TITLE_LENGTH = 200;
export const MAX_LABEL_LENGTH = 20;
export const PRIORITIES = Object.freeze(['low', 'med', 'high']);

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const isColumn = (value) => COLUMNS.includes(value);

/** Normalizes the title; returns '' if it is not valid. */
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
  return updateCard(state, id, { title });
}

const isDue = (value) => value === null || Number.isFinite(value);

/**
 * Changes one or more fields. Any invalid value cancels the whole change.
 * `label: ''` or `null` removes the label.
 * @param {{ title?: string, priority?: Priority|null, label?: string|null, due?: number|null }} patch
 * @returns {BoardState}
 */
export function updateCard(state, id, patch) {
  const card = getCard(state, id);
  if (!card) return state;
  const next = { ...card };

  if ('title' in patch) {
    const clean = cleanTitle(patch.title);
    if (!clean) return state;
    next.title = clean;
  }
  if ('priority' in patch) {
    if (patch.priority !== null && !PRIORITIES.includes(patch.priority)) return state;
    next.priority = patch.priority;
  }
  if ('label' in patch) {
    if (patch.label !== null && typeof patch.label !== 'string') return state;
    next.label = patch.label?.trim().slice(0, MAX_LABEL_LENGTH) || null;
  }
  if ('due' in patch) {
    if (!isDue(patch.due)) return state;
    next.due = patch.due;
  }

  const changed = ['title', 'priority', 'label', 'due'].some((k) => (next[k] ?? null) !== (card[k] ?? null));
  if (!changed) return state;
  return bump(
    state,
    state.cards.map((c) => (c.id === id ? next : c)),
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
 * toIndex is the position inside the target column, counted WITHOUT the
 * card being moved. It is clamped to [0, length].
 * @returns {BoardState}
 */
export function moveCard(state, id, toColumn, toIndex) {
  const card = getCard(state, id);
  if (!card || !isColumn(toColumn) || !Number.isFinite(toIndex)) return state;

  const rest = state.cards.filter((c) => c.id !== id);
  const dest = rest.filter((c) => c.column === toColumn);
  const index = clamp(Math.trunc(toIndex), 0, dest.length);

  // Position in the flat array: before the card at `index`,
  // or right after the column's last card, or at the end if the column is empty.
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

/** @returns {string} e.g. 'TK-014' */
export function formatCode(card) {
  return `TK-${String(card.seq).padStart(3, '0')}`;
}

/** Case-insensitive search across title, label and code. */
export function matchesQuery(card, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [card.title, card.label ?? '', formatCode(card)].some((text) => text.toLowerCase().includes(q));
}

/** Overdue: due before today and not done. */
export function isOverdue(card, now = Date.now()) {
  if (card.due == null || card.column === 'done') return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return card.due < today.getTime();
}

/** @returns {{ done: number, total: number }} */
export function progress(state) {
  return {
    done: state.cards.filter((c) => c.column === 'done').length,
    total: state.cards.length,
  };
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

/** Validates the structure and types of an unknown value (localStorage, import). */
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
    if (c.priority != null && !PRIORITIES.includes(c.priority)) return false;
    if (c.label != null && (typeof c.label !== 'string' || c.label.length > MAX_LABEL_LENGTH)) return false;
    if (c.due != null && !Number.isFinite(c.due)) return false;
    ids.add(c.id);
  }
  return true;
}
