import {
  COLUMNS,
  MAX_TITLE_LENGTH,
  addCard,
  deleteCard,
  formatCode,
  getCard,
  getColumnCards,
  moveCard,
  progress,
  updateCard,
} from './state.js';
import { activeBoard, addBoard, deleteBoard, renameBoard, setActive, setWip, updateActive } from './workspace.js';
import { exportFile, importFile, load, onExternalChange, save } from './storage.js';
import { COLUMN_NAMES, fromDateInput, render } from './render.js';
import { initDragDrop } from './dragdrop.js';
import { createHistory, push, redo, undo } from './history.js';
import { showToast } from './toast.js';
import { initKeyboard } from './keyboard.js';
import { initTheme } from './theme.js';
import { initTilt } from './tilt.js';

const $ = (selector) => document.querySelector(selector);
const board = $('.board');
const tabs = $('.board-tabs');
const search = $('#search');
const wipInput = $('.wip-input');
const importInput = $('#import-file');

let ws = load();
let history = createHistory();
const ui = { editingId: null, query: '', renamingId: null };
let renderedBoardId = null;

const current = () => activeBoard(ws);
const cardEl = (id) => board.querySelector(`.card[data-id="${CSS.escape(id)}"]`);

/* ---------- Rendering ---------- */

function redraw() {
  const active = current();
  const reset = renderedBoardId !== null && renderedBoardId !== active.id;
  renderedBoardId = active.id;
  render(active.state, ui, board, { wip: active.wip, reset });
  renderChrome(active);
}

function renderChrome(active) {
  $('.rev').textContent = `REV ${String(active.state.revision).padStart(3, '0')}`;

  const { done, total } = progress(active.state);
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('.progress-bar').style.setProperty('--pct', String(pct / 100));
  $('.progress-label').textContent = `${pct}%`;
  $('.progress').setAttribute('aria-valuenow', String(pct));

  if (document.activeElement !== wipInput) wipInput.value = active.wip ?? '';
  renderTabs();
}

function renderTabs() {
  const focusedId = document.activeElement?.closest?.('.board-tabs [data-board-id]')?.dataset.boardId;
  const items = ws.boards.map((b) => {
    const li = document.createElement('li');
    li.dataset.boardId = b.id;
    if (b.id === ui.renamingId) {
      const input = document.createElement('input');
      input.className = 'tab-rename';
      input.value = b.name;
      input.maxLength = 40;
      input.setAttribute('aria-label', 'Nombre del tablero');
      li.append(input);
      return li;
    }
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.textContent = b.name;
    tab.title = 'Doble clic para renombrar';
    if (b.id === ws.activeId) tab.setAttribute('aria-current', 'true');
    li.append(tab);
    if (b.id === ws.activeId && ws.boards.length > 1) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.textContent = '×';
      close.setAttribute('aria-label', `Borrar tablero ${b.name}`);
      li.append(close);
    }
    return li;
  });
  tabs.replaceChildren(...items);

  const rename = tabs.querySelector('.tab-rename');
  if (rename) {
    rename.focus();
    rename.select();
  } else if (focusedId) {
    tabs.querySelector(`[data-board-id="${CSS.escape(focusedId)}"] .tab`)?.focus();
  }
}

function announce(message) {
  const region = $('#announcer');
  region.textContent = '';
  requestAnimationFrame(() => (region.textContent = message));
}

/* ---------- Changes ---------- */

/** Single entry point for changes: workspace -> history -> save -> render. */
function commit(next, { record = true } = {}) {
  if (next === ws) return false;
  if (record) history = push(history, ws);
  ws = next;
  save(ws);
  redraw();
  return true;
}

const commitBoard = (fn) => commit(updateActive(ws, fn));

/** Applies an undo/redo result (or does nothing if there is nowhere to go). */
function travel(result) {
  if (!result) return;
  history = result.history;
  ws = result.state;
  ui.editingId = null;
  save(ws);
  redraw();
  announce('Cambio deshecho o rehecho');
}

const undoLast = () => travel(undo(history, ws));
const redoLast = () => travel(redo(history, ws));

/** Toast with "Undo" that only acts if that change is still the latest one. */
function undoToast(message) {
  const after = ws;
  showToast({
    message,
    onAction: () => {
      if (ws === after) undoLast();
      else showToast({ message: 'Hay cambios posteriores. Usa Ctrl+Z.', duration: 3000 });
    },
  });
}

function removeCard(id) {
  const card = getCard(current().state, id);
  if (!card) return;
  const neighbor = cardEl(id)?.nextElementSibling ?? cardEl(id)?.previousElementSibling;
  if (ui.editingId === id) ui.editingId = null;
  if (!commitBoard((s) => deleteCard(s, id))) return;
  if (neighbor?.classList.contains('card')) neighbor.focus({ preventScroll: true });
  announce(`${formatCode(card)} borrada`);
  undoToast(`${formatCode(card)} borrada`);
}

function startEdit(id) {
  ui.editingId = id;
  redraw();
}

function stopEdit(id) {
  ui.editingId = null;
  redraw();
  cardEl(id)?.focus({ preventScroll: true });
}

/** Moves and announces; `index` is counted without the moving card (like moveCard). */
function move(id, column, index) {
  const card = getCard(current().state, id);
  if (!card || !commitBoard((s) => moveCard(s, id, column, index))) return;
  const position = getColumnCards(current().state, column).findIndex((c) => c.id === id) + 1;
  announce(`${formatCode(card)} en ${COLUMN_NAMES[column]}, posición ${position}`);
}

function moveByKey(id, dir) {
  const state = current().state;
  const card = getCard(state, id);
  if (!card) return;
  const list = getColumnCards(state, card.column);
  const row = list.indexOf(card);
  if (dir === 'left' || dir === 'right') {
    const column = COLUMNS[COLUMNS.indexOf(card.column) + (dir === 'left' ? -1 : 1)];
    if (!column) return;
    move(id, column, Math.min(row, getColumnCards(state, column).length));
  } else {
    const index = row + (dir === 'up' ? -1 : 1);
    if (index < 0 || index >= list.length) return;
    move(id, card.column, index);
  }
  cardEl(id)?.focus({ preventScroll: true });
}

/* ---------- Board events ---------- */

board.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;

  if (form.classList.contains('add-form')) {
    const input = form.elements.title;
    const column = form.closest('[data-column]').dataset.column;
    if (commitBoard((s) => addCard(s, input.value, column))) announce(`Tarea añadida en ${COLUMN_NAMES[column]}`);
    input.value = '';
    updateCharCount(input);
    input.focus();
  } else if (form.classList.contains('edit-form')) {
    const id = form.closest('.card').dataset.id;
    const { title, priority, label, due } = form.elements;
    ui.editingId = null;
    commitBoard((s) =>
      updateCard(s, id, {
        title: title.value,
        priority: priority.value || null,
        label: label.value,
        due: fromDateInput(due.value),
      }),
    );
    stopEdit(id); // if nothing changed, commit does not redraw, so leave edit mode explicitly
  }
});

board.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.card')?.dataset.id;
  if (!id) return;
  if (button.dataset.action === 'edit') startEdit(id);
  else if (button.dataset.action === 'cancel') stopEdit(id);
  else if (button.dataset.action === 'delete') removeCard(id);
});

board.addEventListener('change', (e) => {
  if (!e.target.matches('.move-select') || !e.target.value) return;
  const id = e.target.closest('.card').dataset.id;
  const column = e.target.value;
  move(id, column, getColumnCards(current().state, column).length);
  cardEl(id)?.focus({ preventScroll: true });
});

board.addEventListener('dblclick', (e) => {
  const card = e.target.closest('.card:not(.is-editing)');
  if (card && !e.target.closest('button, select')) startEdit(card.dataset.id);
});

board.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.editingId) {
    e.preventDefault();
    stopEdit(ui.editingId);
  }
});

/** Counter becomes visible from 75% of the maximum. */
function updateCharCount(input) {
  const counter = input.closest('form')?.querySelector('.char-count');
  if (!counter) return;
  const length = input.value.length;
  counter.textContent = length >= MAX_TITLE_LENGTH * 0.75 ? `${length}/${MAX_TITLE_LENGTH}` : '';
  counter.classList.toggle('is-full', length >= MAX_TITLE_LENGTH);
}

board.addEventListener('input', (e) => {
  if (e.target.name === 'title') updateCharCount(e.target);
});

for (const input of board.querySelectorAll('.add-form input')) input.maxLength = MAX_TITLE_LENGTH;

wipInput.addEventListener('change', () => {
  const raw = wipInput.value.trim();
  const limit = raw === '' ? null : Number(raw);
  if (!commit(setWip(ws, limit)) && limit !== current().wip) {
    wipInput.value = current().wip ?? '';
    showToast({ message: 'El límite WIP debe ser un entero entre 1 y 99.', duration: 3000 });
  }
});

/* ---------- Top bar ---------- */

search.addEventListener('input', () => {
  ui.query = search.value;
  redraw();
});

search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && search.value) {
    search.value = '';
    ui.query = '';
    redraw();
  } else if (e.key === 'Escape') {
    search.blur();
  }
});

document.querySelector('.topbar').addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'add-board') {
    commit(addBoard(ws));
    ui.renamingId = ws.activeId;
    renderTabs();
  } else if (action === 'export') {
    exportFile(ws);
    showToast({ message: 'Tableros exportados.', duration: 2500 });
  } else if (action === 'import') {
    importInput.click();
  } else if (action === 'help') {
    $('#help').showModal();
  }

  const tab = e.target.closest('.tab');
  if (tab) commit(setActive(ws, tab.closest('li').dataset.boardId), { record: false });

  if (e.target.closest('.tab-close')) {
    const name = current().name;
    if (commit(deleteBoard(ws, ws.activeId))) undoToast(`Tablero «${name}» borrado`);
  }
});

tabs.addEventListener('dblclick', (e) => {
  const li = e.target.closest('.tab')?.closest('li');
  if (!li) return;
  ui.renamingId = li.dataset.boardId;
  renderTabs();
});

function finishRename(input, keep) {
  const id = ui.renamingId;
  ui.renamingId = null;
  if (!keep || !commit(renameBoard(ws, id, input.value))) renderTabs();
}

tabs.addEventListener('keydown', (e) => {
  if (!e.target.matches('.tab-rename')) return;
  if (e.key === 'Enter') finishRename(e.target, true);
  else if (e.key === 'Escape') finishRename(e.target, false);
});

tabs.addEventListener('focusout', (e) => {
  if (e.target.matches('.tab-rename') && ui.renamingId) finishRename(e.target, true);
});

importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  importInput.value = '';
  if (!file) return;
  const imported = await importFile(file);
  if (!imported) {
    showToast({ message: 'Archivo no válido. No se importó nada.', duration: 3500 });
    return;
  }
  ui.editingId = null;
  commit(imported);
  undoToast('Tableros importados');
});

/* ---------- Startup ---------- */

initTheme(document.querySelector('[data-action="theme"]'));
initTilt(board);

initKeyboard({
  undo: undoLast,
  redo: redoLast,
  newCard: () => board.querySelector('[data-column="todo"] .add-form input').focus(),
  search: () => search.focus(),
  help: () => $('#help').showModal(),
  edit: startEdit,
  remove: removeCard,
  moveCard: moveByKey,
});

// Drag only reports; the logic lives in moveCard (same path as the keyboard and "Move to…")
initDragDrop(board, move);

onExternalChange((next) => {
  ws = next;
  history = createHistory();
  ui.editingId = null;
  redraw();
  showToast({ message: 'Actualizado desde otra pestaña.', duration: 2500 });
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // without a service worker the app still works, just not offline
  });
}

redraw();
