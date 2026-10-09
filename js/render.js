import { COLUMNS, MAX_LABEL_LENGTH, MAX_TITLE_LENGTH, formatCode, getColumnCards, isOverdue, matchesQuery } from './state.js';
import { enter, exit, flip, measure, swap, tick } from './motion.js';

export const COLUMN_NAMES = Object.freeze({ todo: 'Por hacer', doing: 'En progreso', done: 'Hecho' });
const PRIORITY_NAMES = Object.freeze({ low: 'Baja', med: 'Media', high: 'Alta' });

/** id -> { el, key }. Los nodos se reutilizan entre renders. */
const nodes = new Map();
/** columna -> último contador mostrado. */
const counts = new Map();
let first = true;

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** Timestamp (medianoche local) -> 'YYYY-MM-DD' para <input type="date">. */
export function toDateInput(ts) {
  if (ts == null) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> timestamp de la medianoche local, o null. */
export function fromDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

/** Crea un elemento. El texto siempre va como nodo de texto (nunca innerHTML). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.filter(Boolean));
  return el;
}

/** Lo que cambia la apariencia de una tarjeta; si no cambia, se reutiliza el nodo. */
const cardKey = (card, editing, overdue) =>
  JSON.stringify([card.title, card.priority ?? null, card.label ?? null, card.due ?? null, editing, overdue]);

/**
 * Opciones de "Mover a…" según la columna actual. Se actualizan en el mismo nodo:
 * reemplazar la tarjeta al cambiar de columna rompería el arrastre y sus animaciones.
 */
function syncMoveSelect(el, column) {
  if (el.dataset.moveColumn === column) return;
  el.dataset.moveColumn = column;
  const select = el.querySelector('.move-select');
  if (!select) return;
  select.replaceChildren(
    h('option', { value: '', text: 'Mover a…' }),
    ...COLUMNS.filter((c) => c !== column).map((c) => h('option', { value: c, text: COLUMN_NAMES[c] })),
  );
}

function renderEditForm(card, code) {
  const select = h(
    'select',
    { name: 'priority', 'aria-label': 'Prioridad' },
    h('option', { value: '', text: 'Sin prioridad' }),
    ...Object.entries(PRIORITY_NAMES).map(([value, text]) => h('option', { value, text, selected: card.priority === value })),
  );
  return h(
    'form',
    { class: 'edit-form' },
    h('input', {
      class: 'edit-input',
      name: 'title',
      type: 'text',
      value: card.title,
      required: true,
      maxlength: MAX_TITLE_LENGTH,
      'aria-label': `Título de ${code}`,
    }),
    h('span', { class: 'char-count', 'aria-live': 'polite' }),
    h(
      'div',
      { class: 'edit-fields' },
      select,
      h('input', {
        name: 'label',
        type: 'text',
        value: card.label ?? '',
        maxlength: MAX_LABEL_LENGTH,
        placeholder: 'Etiqueta',
        'aria-label': 'Etiqueta',
      }),
      h('input', { name: 'due', type: 'date', value: toDateInput(card.due), 'aria-label': 'Fecha límite' }),
    ),
    h(
      'div',
      { class: 'edit-actions' },
      h('button', { type: 'submit', text: 'Guardar' }),
      h('button', { type: 'button', text: 'Cancelar', dataset: { action: 'cancel' } }),
    ),
  );
}

function renderCard(card, editing, overdue) {
  const code = formatCode(card);
  if (editing) {
    return h('li', { class: 'card is-editing', dataset: { id: card.id } }, h('span', { class: 'card-code', text: code }), renderEditForm(card, code));
  }

  const summary = [
    `${code}: ${card.title}`,
    card.priority && `prioridad ${PRIORITY_NAMES[card.priority].toLowerCase()}`,
    card.label && `etiqueta ${card.label}`,
    card.due != null && `fecha ${dateFormat.format(card.due)}${overdue ? ', vencida' : ''}`,
  ]
    .filter(Boolean)
    .join(', ');

  const move = h('select', { class: 'move-select', 'aria-label': `Mover ${code} a`, dataset: { action: 'move' } });

  return h(
    'li',
    {
      class: `card${card.priority ? ` priority-${card.priority}` : ''}${overdue ? ' is-overdue' : ''}`,
      tabindex: '0',
      'aria-label': summary,
      dataset: { id: card.id },
    },
    h(
      'div',
      { class: 'card-head' },
      h('span', { class: 'card-code', text: code }),
      card.priority && h('span', { class: `chip chip-${card.priority}`, text: PRIORITY_NAMES[card.priority] }),
      card.label && h('span', { class: 'chip chip-label', text: card.label }),
    ),
    h('p', { class: 'card-title', text: card.title }),
    card.due != null &&
      h('p', { class: 'card-due', text: `${overdue ? 'Vencida · ' : 'Para el '}${dateFormat.format(card.due)}` }),
    h(
      'div',
      { class: 'card-actions' },
      h('button', { type: 'button', text: 'Editar', 'aria-label': `Editar ${code}`, dataset: { action: 'edit' } }),
      h('button', { type: 'button', text: 'Borrar', 'aria-label': `Borrar ${code}`, dataset: { action: 'delete' } }),
      move,
    ),
  );
}

/** Ordena `wanted` dentro de `list` moviendo lo mínimo; no toca los nodos que están saliendo. */
function place(list, wanted) {
  let cursor = list.firstElementChild;
  for (const el of wanted) {
    while (cursor && cursor !== el && cursor.classList.contains('is-exiting')) {
      cursor = cursor.nextElementSibling;
    }
    if (cursor === el) cursor = cursor.nextElementSibling;
    else list.insertBefore(el, cursor);
  }
}

/**
 * Dibuja un tablero a partir de su estado, reutilizando nodos y animando los cambios.
 * @param {import('./state.js').BoardState} state
 * @param {{ editingId: string|null, query: string }} ui
 * @param {ParentNode} root
 * @param {{ wip?: number|null, reset?: boolean }} [options] `reset`: cambio de tablero, sin animar salidas
 */
export function render(state, ui, root, { wip = null, reset = false } = {}) {
  if (reset) {
    for (const list of root.querySelectorAll('.cards')) list.replaceChildren();
    nodes.clear();
    counts.clear();
    first = true;
  }

  const focused = document.activeElement;
  const before = measure(root.querySelectorAll('.card:not(.is-exiting)'));
  const live = new Set(state.cards.map((c) => c.id));
  const now = Date.now();

  for (const [id, entry] of nodes) {
    if (live.has(id)) continue;
    nodes.delete(id);
    exit(entry.el);
  }

  const entering = [];
  const swapped = [];
  for (const card of state.cards) {
    const editing = card.id === ui.editingId;
    const overdue = isOverdue(card, now);
    const key = cardKey(card, editing, overdue);
    const entry = nodes.get(card.id);
    if (entry && entry.key === key) continue;

    const el = renderCard(card, editing, overdue);
    if (entry) {
      entry.el.replaceWith(el);
      swapped.push(el);
    } else {
      entering.push(el);
    }
    nodes.set(card.id, { el, key });
  }

  for (const card of state.cards) {
    const { el } = nodes.get(card.id);
    el.classList.toggle('is-dim', !matchesQuery(card, ui.query));
    syncMoveSelect(el, card.column);
  }

  for (const column of COLUMNS) {
    const section = root.querySelector(`[data-column="${column}"]`);
    const cards = getColumnCards(state, column);
    place(
      section.querySelector('.cards'),
      cards.map((c) => nodes.get(c.id).el),
    );

    const limit = column === 'doing' ? wip : null;
    section.classList.toggle('is-over-limit', limit !== null && cards.length > limit);
    const text = limit === null ? String(cards.length) : `${cards.length}/${limit}`;
    const previous = counts.get(column);
    if (previous !== text) {
      counts.set(column, text);
      const countEl = section.querySelector('.count');
      if (previous === undefined) countEl.textContent = text;
      else tick(countEl, text, parseInt(text, 10) >= parseInt(previous, 10) ? 1 : -1);
    }
  }

  flip(before);
  enter(entering, { cascade: first });
  for (const el of swapped) swap(el);
  first = false;

  if (focused && focused !== document.activeElement && focused.isConnected) {
    focused.focus({ preventScroll: true });
  }
  const editInput = root.querySelector('.edit-input');
  if (editInput && swapped.some((el) => el.contains(editInput))) editInput.focus();
}
