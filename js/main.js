import { MAX_TITLE_LENGTH, addCard, deleteCard, editCard, moveCard } from './state.js';
import { load, save } from './storage.js';
import { render } from './render.js';
import { initDragDrop } from './dragdrop.js';

const board = document.querySelector('.board');

let state = load();
const ui = { editingId: null };

const rev = document.querySelector('.rev');

const redraw = () => {
  render(state, ui, board);
  rev.textContent = `REV ${String(state.revision).padStart(3, '0')}`;
};

/** Único punto de entrada de cambios: estado -> save -> render. */
function commit(next) {
  if (next === state) return;
  state = next;
  save(state);
  redraw();
}

const cardId = (el) => el.closest('.card')?.dataset.id;

board.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  if (form.classList.contains('add-form')) {
    const input = form.elements.title;
    commit(addCard(state, input.value, form.closest('[data-column]').dataset.column));
    input.value = '';
    input.focus();
  } else if (form.classList.contains('edit-form')) {
    const id = cardId(form);
    ui.editingId = null;
    commit(editCard(state, id, form.elements.title.value));
    redraw(); // si no hubo cambio, commit no redibuja y hay que salir del modo edición
  }
});

board.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const id = cardId(button);

  switch (button.dataset.action) {
    case 'edit':
      ui.editingId = id;
      redraw();
      break;
    case 'cancel':
      ui.editingId = null;
      redraw();
      break;
    case 'delete':
      commit(deleteCard(state, id));
      break;
  }
});

board.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.editingId) {
    ui.editingId = null;
    redraw();
  }
});

for (const input of board.querySelectorAll('.add-form input')) input.maxLength = MAX_TITLE_LENGTH;

// El arrastre solo avisa; la lógica vive en moveCard (mismo camino que usarán teclado y "Mover a…")
initDragDrop(board, (id, column, index) => commit(moveCard(state, id, column, index)));

redraw();
