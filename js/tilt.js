import { reducedMotion } from './motion.js';

const MAX_DEG = 4;

/**
 * Subtle 3D tilt of the card under the mouse. Uses the CSS `rotate` property
 * (via --tilt), independent of the `transform` that Motion animates.
 */
export function initTilt(board) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  board.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reducedMotion() || document.body.classList.contains('is-dragging-any')) return;
    const card = e.target.closest('.card');
    if (!card || card.matches('.is-editing, .is-placeholder, .is-exiting')) return;
    const r = card.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    const strength = Math.min(1, Math.hypot(nx, ny));
    card.style.setProperty('--tilt', `${-ny} ${nx} 0 ${(MAX_DEG * strength).toFixed(2)}deg`);
  });

  board.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) card.style.removeProperty('--tilt');
  });
}

/** Removes the tilt (when a drag starts). */
export function clearTilt(card) {
  card.style.removeProperty('--tilt');
}
