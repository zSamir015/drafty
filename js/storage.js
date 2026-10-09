import { createWorkspace, migrate } from './workspace.js';

const KEY = 'drafty:state';

/** Reads the saved workspace (migrating v1 if needed); returns a new one if missing or corrupt. */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const ws = migrate(JSON.parse(raw));
      if (ws) return ws;
    }
  } catch {
    // invalid JSON or no localStorage: start with a new workspace
  }
  return createWorkspace();
}

export function save(ws) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
  } catch {
    // quota full or private mode: the app keeps working without persistence
  }
}

/** Notifies when another tab saves a valid workspace. */
export function onExternalChange(callback) {
  addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const ws = migrate(JSON.parse(e.newValue));
      if (ws) callback(ws);
    } catch {
      // foreign or corrupt value: ignored
    }
  });
}

/** Downloads the workspace as JSON. */
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

/** @returns {Promise<import('./workspace.js').Workspace|null>} null if the file is not valid. */
export async function importFile(file) {
  if (!file || file.size > MAX_IMPORT_BYTES) return null;
  try {
    return migrate(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
