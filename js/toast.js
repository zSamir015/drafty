import { toastIn, toastOut } from './motion.js';

const MAX_VISIBLE = 3;

/** Cierra cada toast; permite descartar el más antiguo al pasar el máximo. */
const closers = new WeakMap();
let region;

function getRegion() {
  if (!region) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-label', 'Notificaciones');
    document.body.append(region);
  }
  return region;
}

/**
 * Muestra un toast. Se pausa con el puntero o el foco encima.
 * @param {{ message: string, actionLabel?: string, onAction?: () => void, duration?: number }} options
 * @returns {() => void} función para cerrarlo
 */
export function showToast({ message, actionLabel = 'Deshacer', onAction, duration = 5000 }) {
  const host = getRegion();
  const el = document.createElement('div');
  el.className = 'toast';

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  el.append(text);

  let timer;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    toastOut(el);
  };
  closers.set(el, close);

  if (onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = actionLabel;
    button.addEventListener('click', () => {
      onAction();
      close();
    });
    el.append(button);
  }

  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(close, duration);
  };
  const hold = () => clearTimeout(timer);
  el.addEventListener('pointerenter', hold);
  el.addEventListener('pointerleave', arm);
  el.addEventListener('focusin', hold);
  el.addEventListener('focusout', arm);

  host.append(el);
  const visible = host.querySelectorAll('.toast:not(.is-leaving)');
  if (visible.length > MAX_VISIBLE) closers.get(visible[0])?.();

  toastIn(el);
  arm();
  return close;
}
