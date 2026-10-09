/**
 * Multiple boards. Pure functions over the workspace (v2), which wraps
 * board states (BoardState, see state.js) without changing them.
 *
 * @typedef {Object} Board
 * @property {string} id
 * @property {string} name
 * @property {number|null} wip  card limit for the "In progress" column
 * @property {import('./state.js').BoardState} state
 *
 * @typedef {Object} Workspace
 * @property {2}       version
 * @property {string}  activeId
 * @property {Board[]} boards
 */
import { createInitialState, isValidState } from './state.js';

export const MAX_BOARD_NAME = 40;
export const MAX_WIP = 99;

const cleanName = (name) => (typeof name === 'string' ? name.trim().slice(0, MAX_BOARD_NAME) : '');
const emptyBoardState = () => ({ version: 1, cards: [], nextSeq: 1, revision: 0 });

/** @returns {Workspace} */
export function createWorkspace(state = createInitialState(), name = 'Mi tablero') {
  const id = crypto.randomUUID();
  return { version: 2, activeId: id, boards: [{ id, name, wip: null, state }] };
}

/** Turns any saved version into a workspace; `null` if it is not valid. */
export function migrate(value) {
  if (isValidWorkspace(value)) return value;
  if (isValidState(value)) return createWorkspace(value);
  return null;
}

/** @returns {Board} */
export function activeBoard(ws) {
  return ws.boards.find((b) => b.id === ws.activeId);
}

function replaceBoard(ws, board) {
  return { ...ws, boards: ws.boards.map((b) => (b.id === board.id ? board : b)) };
}

/** Applies a state.js function to the active board. */
export function updateActive(ws, fn) {
  const board = activeBoard(ws);
  const next = fn(board.state);
  return next === board.state ? ws : replaceBoard(ws, { ...board, state: next });
}

export function addBoard(ws, name) {
  const id = crypto.randomUUID();
  const board = { id, name: cleanName(name) || `Tablero ${ws.boards.length + 1}`, wip: null, state: emptyBoardState() };
  return { ...ws, activeId: id, boards: [...ws.boards, board] };
}

export function renameBoard(ws, id, name) {
  const board = ws.boards.find((b) => b.id === id);
  const clean = cleanName(name);
  if (!board || !clean || clean === board.name) return ws;
  return replaceBoard(ws, { ...board, name: clean });
}

export function deleteBoard(ws, id) {
  const index = ws.boards.findIndex((b) => b.id === id);
  if (index === -1 || ws.boards.length === 1) return ws;
  const boards = ws.boards.filter((b) => b.id !== id);
  const activeId = ws.activeId === id ? boards[Math.min(index, boards.length - 1)].id : ws.activeId;
  return { ...ws, activeId, boards };
}

export function setActive(ws, id) {
  if (id === ws.activeId || !ws.boards.some((b) => b.id === id)) return ws;
  return { ...ws, activeId: id };
}

/** `limit`: integer 1..MAX_WIP, or null to remove it. */
export function setWip(ws, limit) {
  if (limit !== null && !(Number.isInteger(limit) && limit >= 1 && limit <= MAX_WIP)) return ws;
  const board = activeBoard(ws);
  return board.wip === limit ? ws : replaceBoard(ws, { ...board, wip: limit });
}

export function isValidWorkspace(value) {
  if (!value || typeof value !== 'object' || value.version !== 2) return false;
  if (!Array.isArray(value.boards) || value.boards.length === 0) return false;
  const ids = new Set();
  for (const b of value.boards) {
    if (!b || typeof b.id !== 'string' || !b.id || ids.has(b.id)) return false;
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > MAX_BOARD_NAME) return false;
    if (b.wip !== null && !(Number.isInteger(b.wip) && b.wip >= 1 && b.wip <= MAX_WIP)) return false;
    if (!isValidState(b.state)) return false;
    ids.add(b.id);
  }
  return ids.has(value.activeId);
}
