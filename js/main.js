import { MAX_TITLE_LENGTH, addCard, deleteCard, editCard, formatCode, getCard, moveCard } from './state.js';
import { load, save } from './storage.js';
import { render } from './render.js';
import { initDragDrop } from './dragdrop.js';
import { createHistory, push, redo, undo } from './history.js';
import { showToast } from './toast.js';

const board = document.querySelector('.board');

let state = load();
let history = createHistory();
const ui = { editingId: null };

const rev = document.querySelector('.rev');

const redraw = () => {
  render(state, ui, board);
  rev.textContent = `REV ${String(state.revision).padStart(3, '0')}`;
};

/** Único punto de entrada de cambios: estado -> save -> render. */
function commit(next) {
  if (next === state) return;
  history = push(history, state);
  state = next;
  save(state);
  redraw();
}

/** Aplica el resultado de undo/redo (o no hace nada si no hay a dónde ir). */
function travel(result) {
  if (!result) return;
  history = result.history;
  state = result.state;
  ui.editingId = null;
  save(state);
  redraw();
}

const undoLast = () => travel(undo(history, state));
const redoLast = () => travel(redo(history, state));

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
    case 'delete': {
      const card = getCard(state, id);
      commit(deleteCard(state, id));
      if (!card) break;
      const afterDelete = state;
      showToast({
        message: `${formatCode(card)} borrada`,
        onAction: () => {
          // Solo se deshace si el borrado sigue siendo el último cambio
          if (state === afterDelete) undoLast();
          else showToast({ message: 'Hay cambios posteriores. Usa Ctrl+Z.', duration: 3000 });
        },
      });
      break;
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  // En un campo de texto, Ctrl+Z deshace el texto, no el tablero
  if (e.target.closest('input, textarea')) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) undoLast();
  else if ((key === 'z' && e.shiftKey) || key === 'y') redoLast();
  else return;
  e.preventDefault();
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
