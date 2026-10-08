/**
 * Drag & drop con la API nativa de HTML5.
 * Solo traduce eventos a (id, columna, índice) y llama a `onMove`;
 * no conoce el estado ni lo modifica.
 */

const CARD = '.card:not(.is-dragging)';

/** Índice de inserción: cuántas tarjetas (sin la arrastrada) quedan por encima del puntero. */
function dropIndex(list, clientY) {
  const cards = [...list.querySelectorAll(CARD)];
  const index = cards.findIndex((card) => {
    const box = card.getBoundingClientRect();
    return clientY < box.top + box.height / 2;
  });
  return { cards, index: index === -1 ? cards.length : index };
}

/**
 * @param {HTMLElement} board
 * @param {(id: string, column: string, index: number) => void} onMove
 */
export function initDragDrop(board, onMove) {
  const indicator = document.createElement('li');
  indicator.className = 'drop-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  let draggedId = null;

  const clearTargets = () => {
    indicator.remove();
    for (const el of board.querySelectorAll('.is-over')) el.classList.remove('is-over');
  };

  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    draggedId = card.dataset.id;
    e.dataTransfer.setData('text/plain', draggedId);
    e.dataTransfer.effectAllowed = 'move';
    // El navegador toma la imagen de arrastre antes de aplicar la clase
    requestAnimationFrame(() => card.classList.add('is-dragging'));
  });

  board.addEventListener('dragover', (e) => {
    const list = e.target.closest?.('.cards');
    if (!list || !draggedId) return;
    e.preventDefault(); // sin esto el navegador nunca dispara `drop`
    e.dataTransfer.dropEffect = 'move';

    const { cards, index } = dropIndex(list, e.clientY);
    list.insertBefore(indicator, cards[index] ?? null);
    for (const el of board.querySelectorAll('.is-over')) el.classList.remove('is-over');
    list.closest('[data-column]').classList.add('is-over');
  });

  board.addEventListener('dragleave', (e) => {
    const column = e.target.closest?.('[data-column]');
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('is-over');
      if (indicator.parentElement && column.contains(indicator)) indicator.remove();
    }
  });

  board.addEventListener('drop', (e) => {
    const list = e.target.closest?.('.cards');
    if (!list) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    const { index } = dropIndex(list, e.clientY);
    const column = list.closest('[data-column]').dataset.column;
    clearTargets();
    if (id) onMove(id, column, index);
  });

  board.addEventListener('dragend', () => {
    draggedId = null;
    clearTargets();
    for (const el of board.querySelectorAll('.is-dragging')) el.classList.remove('is-dragging');
  });
}
