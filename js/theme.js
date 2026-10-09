import { reducedMotion } from './motion.js';

const KEY = 'drafty:theme';
const COLORS = { light: '#eef3fb', dark: '#0b2a55' };

const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const currentTheme = () => document.documentElement.dataset.theme || systemTheme();

function paint(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
}

/** Toggles light/dark with a crossfade (View Transitions when available) and remembers it. */
export function initTheme(button) {
  paint(currentTheme());
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (document.startViewTransition && !reducedMotion()) document.startViewTransition(() => paint(next));
    else paint(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // no persistence: the theme lasts as long as the tab
    }
  });
}
