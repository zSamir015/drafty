/**
 * Atajos globales y teclado sobre tarjetas enfocadas.
 * Solo traduce teclas a llamadas de `handlers`; no conoce el estado.
 */
const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

const isTyping = (el) => Boolean(el.closest?.('input, textarea, select, [contenteditable="true"]'));
const visibleCards = (list) => [...list.querySelectorAll('.card:not(.is-exiting):not(.is-placeholder)')];

/** Flechas sin modificador: mueven el foco entre tarjetas. */
function focusNeighbor(card, dir) {
  const list = card.parentElement;
  if (dir === 'up' || dir === 'down') {
    const cards = visibleCards(list);
    cards[cards.indexOf(card) + (dir === 'up' ? -1 : 1)]?.focus();
    return;
  }
  const columns = [...document.querySelectorAll('[data-column]')];
  const index = columns.indexOf(card.closest('[data-column]'));
  const target = columns[index + (dir === 'left' ? -1 : 1)];
  if (!target) return;
  const cards = visibleCards(target.querySelector('.cards'));
  const row = visibleCards(list).indexOf(card);
  cards[Math.min(row, cards.length - 1)]?.focus();
}

/**
 * @param {{ undo(): void, redo(): void, newCard(): void, search(): void, help(): void,
 *           edit(id: string): void, remove(id: string): void,
 *           moveCard(id: string, dir: 'left'|'right'|'up'|'down'): void }} handlers
 */
export function initKeyboard(handlers) {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.altKey) {
      // En un campo de texto, Ctrl+Z deshace el texto, no el tablero
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) handlers.undo();
      else if ((key === 'z' && e.shiftKey) || key === 'y') handlers.redo();
      else return;
      e.preventDefault();
      return;
    }

    const card = e.target.classList?.contains('card') && !e.target.classList.contains('is-editing') ? e.target : null;
    if (card) {
      const dir = ARROWS[e.key];
      if (dir && e.altKey) handlers.moveCard(card.dataset.id, dir);
      else if (dir && !e.shiftKey) focusNeighbor(card, dir);
      else if (e.key === 'Enter') handlers.edit(card.dataset.id);
      else if (e.key === 'Delete' || e.key === 'Backspace') handlers.remove(card.dataset.id);
      else return;
      e.preventDefault();
      return;
    }

    if (mod || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return;
    if (e.key === 'n' || e.key === 'N') handlers.newCard();
    else if (e.key === '/') handlers.search();
    else if (e.key === '?') handlers.help();
    else return;
    e.preventDefault();
  });
}
