# Contributing

Contributions that preserve PixelSip's narrow, privacy-conscious purpose are welcome.

## Before opening a pull request

1. Keep the extension focused on lightweight hydration reminders.
2. Do not add analytics, remote code, or host permissions without an explicit product and privacy review.
3. Run the automated tests and syntax checks documented in [docs/TESTING.md](docs/TESTING.md).
4. Test the unpacked extension in Chrome.
5. Update documentation when behavior, permissions, or privacy practices change.

## Code style

- Use plain JavaScript, HTML, and CSS without a build dependency unless there is a clear need.
- Keep Chrome API ownership in the service worker.
- Keep popup behavior small and understandable.
- Prefer explicit state transitions over hidden automatic behavior.
- Add comments only where behavior is not self-explanatory.

## Store-facing changes

Any change that affects permissions, collected data, external services, or public behavior must also update:

- `docs/PRIVACY.md`
- `docs/CHROME_WEB_STORE.md`
- The GitHub Pages privacy policy in `index.html`
