/**
 * The only module that touches Motion (global `Motion`, loaded from vendor/motion.js).
 * With `prefers-reduced-motion`, everything becomes a short fade with no movement.
 */
const { animate, stagger } = window.Motion;

const query = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => query.matches;

export const spring = {
  snappy: { type: 'spring', duration: 0.38, bounce: 0.18 },
  soft: { type: 'spring', duration: 0.55, bounce: 0.25 },
};

const FADE = { duration: 0.1, ease: 'linear' };

/** In-flight FLIPs, so they can be stopped before measuring again. */
const running = new WeakMap();

/** Entrance of one or more cards; staggered with `cascade`. */
export function enter(els, { cascade = false } = {}) {
  const list = [].concat(els);
  if (list.length === 0) return;
  if (reducedMotion()) {
    animate(list, { opacity: [0, 1] }, FADE);
    return;
  }
  animate(
    list,
    { opacity: [0, 1], scale: [0.94, 1], y: [10, 0] },
    { ...spring.snappy, delay: cascade ? stagger(0.06) : 0 },
  );
}

/** Collapses and removes the node. While animating it stays in the DOM with `.is-exiting`. */
export async function exit(el) {
  el.classList.add('is-exiting');
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  if (reducedMotion()) {
    await animate(el, { opacity: [1, 0] }, FADE);
  } else {
    el.style.height = `${el.offsetHeight}px`;
    el.style.overflow = 'hidden';
    await animate(
      el,
      {
        opacity: 0,
        height: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
      },
      { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
    );
  }
  el.remove();
}

/**
 * Measures the current (visual) positions and stops any in-flight FLIPs.
 * Careful: Motion's `cancel()` jumps back to the first keyframe and leaves it applied,
 * so we use `stop()` and reset the offset by hand.
 */
export function measure(els) {
  const rects = new Map();
  for (const el of els) rects.set(el, el.getBoundingClientRect());
  for (const el of rects.keys()) {
    const controls = running.get(el);
    if (!controls) continue;
    controls.stop();
    running.delete(el);
    animate(el, { x: 0, y: 0 }, { duration: 0 });
  }
  return rects;
}

/** Animates each element from where it was to where it ended up after the DOM change. */
export function flip(before) {
  if (reducedMotion()) return;
  for (const [el, a] of before) {
    if (!el.isConnected || el.classList.contains('is-exiting')) continue;
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    const controls = animate(el, { x: [dx, 0], y: [dy, 0] }, spring.snappy);
    running.set(el, controls);
    controls.then(() => {
      if (running.get(el) === controls) running.delete(el);
    });
  }
}

/** Content change on a card (edit mode, new title). */
export function swap(el) {
  if (reducedMotion()) {
    animate(el, { opacity: [0, 1] }, FADE);
    return;
  }
  animate(el, { opacity: [0, 1], y: [4, 0] }, { duration: 0.16, ease: 'easeOut' });
}

/** Changes a counter's text with a small vertical slide. */
export function tick(el, text, dir) {
  el.textContent = text;
  if (reducedMotion()) return;
  animate(el, { y: [dir * 8, 0], opacity: [0, 1] }, spring.snappy);
}

/** Toast entrance: slides up and expands with a spring. */
export function toastIn(el) {
  if (reducedMotion()) {
    animate(el, { opacity: [0, 1] }, FADE);
    return;
  }
  animate(el, { opacity: [0, 1], y: [24, 0], scale: [0.9, 1] }, spring.soft);
}

/** Toast exit; removes the node when done. */
export async function toastOut(el) {
  el.classList.add('is-leaving');
  el.inert = true;
  const keyframes = reducedMotion() ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.95 };
  await animate(el, keyframes, { duration: 0.18, ease: 'easeIn' });
  el.remove();
}

/** Animates a number (0 -> 1 by default), calling `onUpdate` every frame. */
export function driver(onUpdate, { from = 0, to = 1, options = spring.snappy } = {}) {
  if (reducedMotion()) {
    onUpdate(to);
    return Promise.resolve();
  }
  return animate(from, to, { ...options, onUpdate });
}

/**
 * Moves the ghost card from its current pose into the gap.
 * `from` and `to`: { x, y, rot, scale } (x, y in px relative to the ghost's origin).
 */
export function settle(ghost, from, to) {
  const mix = (a, b, t) => a + (b - a) * t;
  return driver(
    (t) => {
      ghost.style.transform = `translate3d(${mix(from.x, to.x, t)}px, ${mix(from.y, to.y, t)}px, 0) rotate(${mix(from.rot, to.rot, t)}deg) scale(${mix(from.scale, to.scale, t)})`;
    },
    { options: { type: 'spring', duration: 0.34, bounce: 0.15 } },
  );
}

/** A stamp that drops onto the card and fades out. */
export function stamp(card, text) {
  if (reducedMotion()) return;
  const el = document.createElement('span');
  el.className = 'stamp';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  card.append(el);
  animate(el, { opacity: [0, 1], scale: [1.9, 1], rotate: [-18, -8] }, spring.soft)
    .then(() => animate(el, { opacity: 0 }, { duration: 0.4, delay: 0.8 }))
    .then(() => el.remove());
}
