import { reducedMotion } from './motion.js';

const KEY = 'drafty:theme';
const COLORS = { light: '#eef3fb', dark: '#0b2a55' };

const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const currentTheme = () => document.documentElement.dataset.theme || systemTheme();

function paint(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
}

/** Alterna claro/oscuro con un fundido (View Transitions si existe) y lo recuerda. */
export function initTheme(button) {
  paint(currentTheme());
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (document.startViewTransition && !reducedMotion()) document.startViewTransition(() => paint(next));
    else paint(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // sin persistencia: el tema dura lo que la pestaña
    }
  });
}
