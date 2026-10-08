import { COLUMNS, formatCode, getColumnCards } from './state.js';

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
    { class: 'card', draggable: 'true', dataset: { id: card.id } },
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

/**
 * Dibuja el tablero completo a partir del estado.
 * @param {import('./state.js').BoardState} state
 * @param {{ editingId: string|null }} ui
 * @param {ParentNode} root
 */
export function render(state, ui, root) {
  for (const column of COLUMNS) {
    const section = root.querySelector(`[data-column="${column}"]`);
    const cards = getColumnCards(state, column);
    const items = cards.map((card) => renderCard(card, card.id === ui.editingId));
    if (items.length === 0) items.push(h('li', { class: 'empty', text: 'Sin elementos.' }));

    section.querySelector('.cards').replaceChildren(...items);
    section.querySelector('.count').textContent = String(cards.length);
  }

  root.querySelector('.edit-input')?.focus();
}
