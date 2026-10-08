/**
 * Historial deshacer/rehacer sobre estados inmutables. Funciones puras.
 * @typedef {{ past: any[], future: any[], limit: number }} History
 */

/** @returns {History} */
export function createHistory(limit = 100) {
  return { past: [], future: [], limit };
}

/** Registra `state` (el estado previo al cambio) y descarta el futuro. */
export function push(history, state) {
  return {
    ...history,
    past: [...history.past, state].slice(-history.limit),
    future: [],
  };
}

/** @returns {{ history: History, state: any } | null} `current` pasa al futuro. */
export function undo(history, current) {
  if (history.past.length === 0) return null;
  return {
    state: history.past.at(-1),
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
  };
}

/** @returns {{ history: History, state: any } | null} `current` vuelve al pasado. */
export function redo(history, current) {
  if (history.future.length === 0) return null;
  return {
    state: history.future[0],
    history: {
      ...history,
      past: [...history.past, current].slice(-history.limit),
      future: history.future.slice(1),
    },
  };
}
