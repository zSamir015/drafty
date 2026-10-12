# Security

Drafty runs entirely in the browser: no backend, no accounts, and boards are stored in your own `localStorage`. There are no secrets in this repository.

## Reporting a vulnerability

Use GitHub's [private vulnerability reporting](https://github.com/zSamir015/drafty/security/advisories/new). Please don't open a public issue.

In scope: anything that runs script from a board's content (for example through import/export or card fields), or bypasses the Content Security Policy.

## How the app is protected

- A strict Content Security Policy without `unsafe-inline`, and `referrer-policy: no-referrer`.
- Board content is written to the page as text, never as HTML.
- Imported JSON is validated before it replaces anything.
- Motion is vendored at a fixed version; there are no runtime dependencies from a CDN.
