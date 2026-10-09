/**
 * Undo/redo history over immutable states. Pure functions.
 * @typedef {{ past: any[], future: any[], limit: number }} History
 */

/** @returns {History} */
export function createHistory(limit = 100) {
  return { past: [], future: [], limit };
}

/** Records `state` (the state before the change) and drops the future. */
export function push(history, state) {
  return {
    ...history,
    past: [...history.past, state].slice(-history.limit),
    future: [],
  };
}

/** @returns {{ history: History, state: any } | null} `current` moves to the future. */
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

/** @returns {{ history: History, state: any } | null} `current` goes back to the past. */
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
