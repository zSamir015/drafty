// Before first paint: apply the saved theme to avoid a flash.
// A classic, render-blocking script on purpose; it lives in its own file so the CSP needs no 'unsafe-inline'.
try {
  const theme = localStorage.getItem('drafty:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // no localStorage: fall back to the system theme
}
