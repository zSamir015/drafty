// Antes de pintar: aplica el tema guardado para evitar un destello.
// Script clásico y bloqueante a propósito; está aparte para no necesitar 'unsafe-inline' en la CSP.
try {
  const theme = localStorage.getItem('drafty:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // sin localStorage: se usa el tema del sistema
}
