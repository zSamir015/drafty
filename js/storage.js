import { createInitialState, isValidState } from './state.js';

const KEY = 'drafty:state';

/** Lee el estado guardado; si falta o está corrupto, devuelve el inicial. */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) return parsed;
    }
  } catch {
    // JSON inválido o localStorage no disponible: se usa el estado inicial
  }
  return createInitialState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // cuota llena o modo privado: la app sigue funcionando sin persistir
  }
}
