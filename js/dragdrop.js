/**
 * Drag and drop with pointer events (mouse and touch).
 * The original card stays behind as the gap (`.is-placeholder`) and moves through the DOM
 * while dragging; a copy (`.is-ghost`) follows the pointer. On drop it only reports
 * `onMove(id, column, index)`: it does not know about the state or change it.
 */
import { driver, flip, measure, reducedMotion, settle, spring, stamp } from './motion.js';
import { clearTilt } from './tilt.js';

const MOUSE_THRESHOLD = 4; // px before a mouse drag starts
const HOLD_MS = 220; // long press to start a touch drag
const HOLD_SLOP = 8; // if the finger moves further, it is a scroll
const EDGE = 64; // px from the edge where autoscroll starts
const SCROLL_MAX = 14; // px per frame

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const isLive = (el) => el.classList.contains('card') && !el.classList.contains('is-exiting');
const liveCards = (list) => [...list.children].filter(isLive);

/** Nearest column: first by horizontal distance, then by vertical. */
function nearestColumn(columns, x, y) {
  let best = columns[0];
  let bestDx = Infinity;
  let bestDy = Infinity;
  for (const section of columns) {
    const r = section.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    if (dx < bestDx || (dx === bestDx && dy < bestDy)) {
      best = section;
      bestDx = dx;
      bestDy = dy;
    }
  }
  return best;
}

/**
 * @param {HTMLElement} board
 * @param {(id: string, column: string, index: number) => void} onMove
 */
export function initDragDrop(board, onMove) {
  const columns = [...board.querySelectorAll('[data-column]')];
  let pending = null;
  let drag = null;

  const clearPending = () => {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  };

  const setOver = (section) => {
    for (const c of columns) c.classList.toggle('is-over', c === section);
  };

  board.addEventListener('pointerdown', (e) => {
    if (drag || pending || e.button !== 0 || !e.isPrimary) return;
    const card = e.target.closest('.card');
    if (!card || card.classList.contains('is-editing') || card.classList.contains('is-exiting')) return;
    if (e.target.closest('button, input, select, a')) return;

    pending = {
      card,
      pointerId: e.pointerId,
      type: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      timer: 0,
    };
    if (e.pointerType !== 'mouse') pending.timer = setTimeout(begin, HOLD_MS);
  });

  document.addEventListener('pointermove', (e) => {
    if (pending && e.pointerId === pending.pointerId) {
      pending.x = e.clientX;
      pending.y = e.clientY;
      const dist = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0);
      if (pending.type === 'mouse') {
        if (dist > MOUSE_THRESHOLD) begin();
      } else if (dist > HOLD_SLOP) {
        clearPending(); // it was a scroll
      }
    } else if (drag && e.pointerId === drag.pointerId) {
      drag.px = e.clientX;
      drag.py = e.clientY;
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (pending && e.pointerId === pending.pointerId) clearPending();
    else if (drag && e.pointerId === drag.pointerId) finish(true);
  });

  document.addEventListener('pointercancel', (e) => {
    if (pending && e.pointerId === pending.pointerId) clearPending();
    else if (drag && e.pointerId === drag.pointerId) finish(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag) finish(false);
  });

  // With touch, once dragging, the browser must not scroll or open menus
  document.addEventListener('touchmove', (e) => drag && e.preventDefault(), { passive: false });
  board.addEventListener('contextmenu', (e) => (pending || drag) && e.preventDefault());

  function begin() {
    if (!pending) return;
    const { card, pointerId, x, y } = pending;
    clearPending();

    clearTilt(card);
    const origin = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('is-ghost');
    ghost.removeAttribute('data-id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${origin.left}px`,
      top: `${origin.top}px`,
      width: `${origin.width}px`,
      height: `${origin.height}px`,
      margin: '0',
    });
    document.body.append(ghost);

    card.classList.add('is-placeholder');
    document.body.classList.add('is-dragging-any');
    document.documentElement.setPointerCapture?.(pointerId);

    drag = {
      id: card.dataset.id,
      card,
      ghost,
      origin,
      pointerId,
      offX: x - origin.left,
      offY: y - origin.top,
      px: x,
      py: y,
      lastX: x,
      lift: 0,
      tilt: 0,
      last: performance.now(),
      raf: 0,
      fromColumn: card.closest('[data-column]').dataset.column,
      home: { list: card.parentElement, next: card.nextElementSibling },
    };
    const d = drag;
    driver((v) => (d.lift = v), { options: spring.snappy });
    d.raf = requestAnimationFrame(frame);
  }

  /** Current pose of the ghost. */
  function pose(d) {
    const motion = !reducedMotion();
    return {
      x: d.px - d.offX - d.origin.left,
      y: d.py - d.offY - d.origin.top,
      rot: motion ? d.lift * 1.5 + d.tilt : 0,
      scale: motion ? 1 + 0.03 * d.lift : 1,
    };
  }

  function apply(d) {
    const p = pose(d);
    d.ghost.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg) scale(${p.scale})`;
    d.ghost.style.setProperty('--lift', String(d.lift));
  }

  function frame(now) {
    const d = drag;
    if (!d) return;
    const dt = clamp(now - d.last, 1, 50);
    d.last = now;

    // Tilt based on horizontal velocity, smoothed
    const vx = ((d.px - d.lastX) / dt) * 16;
    d.lastX = d.px;
    d.tilt += (clamp(vx * 0.6, -8, 8) - d.tilt) * 0.2;

    // Vertical autoscroll near the edges
    if (d.py < EDGE) window.scrollBy(0, -SCROLL_MAX * ((EDGE - d.py) / EDGE));
    else if (d.py > innerHeight - EDGE) window.scrollBy(0, SCROLL_MAX * ((d.py - (innerHeight - EDGE)) / EDGE));

    apply(d);
    retarget(d);
    d.raf = requestAnimationFrame(frame);
  }

  /** Moves the gap to the column/position under the pointer. */
  function retarget(d) {
    const section = nearestColumn(columns, d.px, d.py);
    const list = section.querySelector('.cards');
    const localY = d.py - list.getBoundingClientRect().top;

    // offsetTop ignores in-flight transforms (FLIP), so there is no jitter
    const others = liveCards(list).filter((el) => el !== d.card);
    let index = others.findIndex((el) => el.offsetTop + el.offsetHeight / 2 > localY);
    if (index === -1) index = others.length;

    setOver(section);
    const current = d.card.parentElement === list ? liveCards(list).indexOf(d.card) : -1;
    if (current === index) return;

    const before = measure(board.querySelectorAll('.card:not(.is-exiting):not(.is-placeholder)'));
    list.insertBefore(d.card, others[index] ?? null);
    flip(before);
  }

  function finish(commit) {
    const d = drag;
    if (!d) return;
    drag = null;
    cancelAnimationFrame(d.raf);
    document.body.classList.remove('is-dragging-any');
    document.documentElement.releasePointerCapture?.(d.pointerId);
    setOver(null);

    if (!commit && (d.card.parentElement !== d.home.list || d.card.nextElementSibling !== d.home.next)) {
      const before = measure(board.querySelectorAll('.card:not(.is-exiting):not(.is-placeholder)'));
      d.home.list.insertBefore(d.card, d.home.next);
      flip(before);
    }

    const column = d.card.closest('[data-column]').dataset.column;
    const index = liveCards(d.card.parentElement).indexOf(d.card);
    if (commit) onMove(d.id, column, index);

    const target = d.card.getBoundingClientRect();
    const from = pose(d);
    const to = { x: target.left - d.origin.left, y: target.top - d.origin.top, rot: 0, scale: 1 };
    Promise.resolve(settle(d.ghost, from, to)).then(() => {
      d.ghost.remove();
      d.card.classList.remove('is-placeholder');
      if (commit && column === 'done' && d.fromColumn !== 'done') stamp(d.card, 'Hecho');
    });
  }
}
