import { COLUMNS, formatCode, getColumnCards } from './state.js';
import { enter, exit, flip, measure, swap, tick } from './motion.js';

/** id -> { el, title, editing }. Los nodos se reutilizan entre renders. */
const nodes = new Map();
/** columna -> último contador mostrado. */
const counts = new Map();
let first = true;

/** Crea un elemento. El texto siempre va como nodo de texto (nunca innerHTML). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}

function renderCard(card, editing) {
  const code = formatCode(card);
  if (editing) {
    const input = h('input', {
      class: 'edit-input',
      name: 'title',
      type: 'text',
      value: card.title,
      required: '',
      'aria-label': `Editar ${code}`,
    });
    const form = h(
      'form',
      { class: 'edit-form' },
      input,
      h('button', { type: 'submit', text: 'Guardar' }),
      h('button', { type: 'button', text: 'Cancelar', dataset: { action: 'cancel' } }),
    );
    return h('li', { class: 'card is-editing', dataset: { id: card.id } }, h('span', { class: 'card-code', text: code }), form);
  }

  return h(
    'li',
    { class: 'card', dataset: { id: card.id } },
    h('span', { class: 'card-code', text: code }),
    h('p', { class: 'card-title', text: card.title }),
    h(
      'div',
      { class: 'card-actions' },
      h('button', { type: 'button', text: 'Editar', 'aria-label': `Editar ${code}`, dataset: { action: 'edit' } }),
      h('button', { type: 'button', text: 'Borrar', 'aria-label': `Borrar ${code}`, dataset: { action: 'delete' } }),
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
 * Dibuja el tablero a partir del estado, reutilizando nodos y animando los cambios.
 * @param {import('./state.js').BoardState} state
 * @param {{ editingId: string|null }} ui
 * @param {ParentNode} root
 */
export function render(state, ui, root) {
  const focused = document.activeElement;
  const before = measure(root.querySelectorAll('.card:not(.is-exiting)'));
  const live = new Set(state.cards.map((c) => c.id));

  for (const [id, entry] of nodes) {
    if (live.has(id)) continue;
    nodes.delete(id);
    exit(entry.el);
  }

  const entering = [];
  const swapped = [];
  for (const card of state.cards) {
    const editing = card.id === ui.editingId;
    const entry = nodes.get(card.id);
    if (entry && entry.title === card.title && entry.editing === editing) continue;

    const el = renderCard(card, editing);
    if (entry) {
      entry.el.replaceWith(el);
      swapped.push(el);
    } else {
      entering.push(el);
    }
    nodes.set(card.id, { el, title: card.title, editing });
  }

  for (const column of COLUMNS) {
    const section = root.querySelector(`[data-column="${column}"]`);
    const cards = getColumnCards(state, column);
    place(
      section.querySelector('.cards'),
      cards.map((c) => nodes.get(c.id).el),
    );

    const previous = counts.get(column);
    if (previous !== cards.length) {
      counts.set(column, cards.length);
      const countEl = section.querySelector('.count');
      if (previous === undefined) countEl.textContent = String(cards.length);
      else tick(countEl, String(cards.length), cards.length > previous ? 1 : -1);
    }
  }

  flip(before);
  enter(entering, { cascade: first });
  for (const el of swapped) swap(el);
  first = false;

  if (focused && focused !== document.activeElement && focused.isConnected) {
    focused.focus({ preventScroll: true });
  }
  root.querySelector('.edit-input')?.focus();
}
