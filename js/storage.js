import { createWorkspace, migrate } from './workspace.js';

const KEY = 'drafty:state';

/** Lee el workspace guardado (migrando v1 si hace falta); si falta o está corrupto, uno nuevo. */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const ws = migrate(JSON.parse(raw));
      if (ws) return ws;
    }
  } catch {
    // JSON inválido o localStorage no disponible: se usa un workspace nuevo
  }
  return createWorkspace();
}

export function save(ws) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
  } catch {
    // cuota llena o modo privado: la app sigue funcionando sin persistir
  }
}

/** Avisa cuando otra pestaña guarda un workspace válido. */
export function onExternalChange(callback) {
  addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const ws = migrate(JSON.parse(e.newValue));
      if (ws) callback(ws);
    } catch {
      // valor ajeno o corrupto: se ignora
    }
  });
}

/** Descarga el workspace como JSON. */
export function exportFile(ws) {
  const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drafty-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** @returns {Promise<import('./workspace.js').Workspace|null>} null si el archivo no es válido. */
export async function importFile(file) {
  if (!file || file.size > MAX_IMPORT_BYTES) return null;
  try {
    return migrate(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
