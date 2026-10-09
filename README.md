# Drafty

🌐 **English** · [Español](README.es.md)

[![Tests](https://github.com/zSamir015/drafty/actions/workflows/test.yml/badge.svg)](https://github.com/zSamir015/drafty/actions/workflows/test.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Live demo →](https://zsamir015.github.io/drafty/)**

A Kanban board with a technical-drawing (blueprint) look, fluid drag and drop, and physics-based animations. Built with **vanilla JavaScript**, no frameworks and no build step. The interface is in Spanish.

![Demo: add a task, drag it across columns, the done stamp, and undo](docs/media/demo.gif)

## What this project shows

- **Complex interaction without frameworks**: custom pointer-event drag and drop, FLIP animations and spring physics.
- **Clean architecture**: pure, immutable state kept apart from the DOM, with a single entry point for changes.
- **Full accessibility**: everything can be done from the keyboard, with screen-reader announcements.
- **Quality**: 30 unit tests, CI on every push, a strict CSP and offline support (PWA).

| Light | Dark | Mobile |
|---|---|---|
| ![Board in light theme](docs/media/board-light.png) | ![Board in dark theme](docs/media/board-dark.png) | ![Mobile view](docs/media/mobile.png) |

## Features

- **Custom drag and drop with pointer events**: works with mouse and touch (long press). The card lifts with a spring, tilts with your speed, the other cards make room (FLIP), and it settles into its slot on drop. Autoscroll near the edges; `Esc` cancels.
- **Animations with [Motion](https://motion.dev)**: staggered entrances, collapsing exits, counters, toasts, and a "Done" stamp when a task is finished.
- **Undo / redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) with a 100-step history, plus an "Undo" toast when deleting.
- **Multiple boards** with tabs: create, rename (double-click) and delete.
- **Cards with priority, label and due date**, with overdue warnings.
- **Live search** by title, label or code (`TK-007`).
- **WIP limit** on "In progress": the column is flagged when it goes over.
- **Progress bar** and a `REV` title block with the number of changes.
- **JSON export / import** with full validation of the file.
- **Sync across open tabs.**
- **Light / dark theme** with a transition (View Transitions API).
- **PWA**: installable and works offline.
- **Accessible**: fully keyboard-operable, `aria-live` announcements, focus preserved, and `prefers-reduced-motion` respected.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New task |
| `/` | Search |
| `?` | Help |
| `Ctrl` `Z` / `Ctrl` `⇧` `Z` | Undo / redo |
| `←` `→` `↑` `↓` | Move between cards |
| `Alt` + arrows | Move the focused card |
| `Enter` / `Delete` | Edit / delete the focused card |
| `Esc` | Cancel editing or dragging |

## Run

ES modules do not load from `file://`, so you need a static server:

```bash
npm run dev          # python3 -m http.server 5173
# or: npx serve .
```

Open <http://localhost:5173>.

## Tests

```bash
npm test             # node --test, no dependencies
```

They cover the pure logic: board state, workspace (multiple boards and data migration) and history.

## Architecture

Logic is kept apart from the DOM. Every change goes through a single entry point (`commit`) that stores the previous state in the history, persists it and redraws.

```
js/
├── state.js      Single-board state. Pure, immutable functions.
├── workspace.js  Multiple boards, WIP limit and v1 → v2 migration. Pure.
├── history.js    Undo / redo. Pure.
├── storage.js    localStorage, cross-tab sync, export / import.
├── render.js     Keyed reconciliation: reuses nodes and animates only what changed.
├── motion.js     The only module that uses Motion (springs, FLIP, entrances, exits).
├── dragdrop.js   Pointer-event drag and drop; only emits (id, column, index).
├── keyboard.js   Shortcuts and keyboard movement.
├── toast.js      Notifications with an action.
├── theme.js      Light / dark theme (theme-init.js applies it before first paint).
├── tilt.js       3D tilt on hover.
└── main.js       Wires the modules together.
```

Design decisions:

- **No build.** Motion ships as a versioned UMD bundle in `vendor/` (14.0.0, MIT).
- **Custom drag and drop instead of native HTML5 DnD.** The native API cannot animate the dragged card and does not work with touch.
- **Drag, keyboard and "Move to…" all share `moveCard`**, so they behave the same way.
- **User text never goes through `innerHTML`**, and imported data is validated before use.

## License

[MIT](LICENSE) © 2026 Samir Lorenzo

## Credits

- [Motion](https://motion.dev): animations (MIT).
- [Monaspace](https://monaspace.githubnext.com): typeface (SIL OFL 1.1).
- Toasts inspired by [Sileo](https://github.com/hiaaryan/sileo).
