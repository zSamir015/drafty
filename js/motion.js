/**
 * Único módulo que toca Motion (global `Motion`, cargado desde vendor/motion.js).
 * Con `prefers-reduced-motion` todo se reduce a un fade corto, sin movimiento.
 */
const { animate, stagger } = window.Motion;

const query = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => query.matches;

export const spring = {
  snappy: { type: 'spring', duration: 0.38, bounce: 0.18 },
  soft: { type: 'spring', duration: 0.55, bounce: 0.25 },
};

const FADE = { duration: 0.1, ease: 'linear' };

/** FLIPs en curso, para poder cancelarlos antes de volver a medir. */
const running = new WeakMap();

/** Entrada de una o varias tarjetas; con `cascade`, escalonadas. */
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

/** Colapsa y elimina el nodo. Mientras anima sigue en el DOM con `.is-exiting`. */
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

/** Mide las posiciones actuales (visuales) y cancela FLIPs en curso. */
export function measure(els) {
  const rects = new Map();
  for (const el of els) rects.set(el, el.getBoundingClientRect());
  for (const el of rects.keys()) {
    running.get(el)?.cancel();
    running.delete(el);
  }
  return rects;
}

/** Anima cada elemento desde donde estaba hasta donde quedó tras el cambio de DOM. */
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

/** Cambio de contenido de una tarjeta (edición, título nuevo). */
export function swap(el) {
  if (reducedMotion()) {
    animate(el, { opacity: [0, 1] }, FADE);
    return;
  }
  animate(el, { opacity: [0, 1], y: [4, 0] }, { duration: 0.16, ease: 'easeOut' });
}

/** Cambia el texto de un contador con un pequeño desplazamiento vertical. */
export function tick(el, text, dir) {
  el.textContent = text;
  if (reducedMotion()) return;
  animate(el, { y: [dir * 8, 0], opacity: [0, 1] }, spring.snappy);
}

/** Entrada de un toast: sube y se expande con spring. */
export function toastIn(el) {
  if (reducedMotion()) {
    animate(el, { opacity: [0, 1] }, FADE);
    return;
  }
  animate(el, { opacity: [0, 1], y: [24, 0], scale: [0.9, 1] }, spring.soft);
}

/** Salida de un toast; elimina el nodo al terminar. */
export async function toastOut(el) {
  el.classList.add('is-leaving');
  el.inert = true;
  const keyframes = reducedMotion() ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.95 };
  await animate(el, keyframes, { duration: 0.18, ease: 'easeIn' });
  el.remove();
}
