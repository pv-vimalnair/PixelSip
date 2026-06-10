# Testing

## Automated checks

Run from the repository root:

```powershell
node tests\state.test.js
node tests\popup-contract.test.js
node --check extension\service-worker.js
node --check extension\popup.js
node --check extension\offscreen.js
```

### State tests

`tests/state.test.js` validates:

- Overnight quiet-hour boundaries
- Daytime quiet-hour behavior
- Next quiet-hours start
- Time parsing and validation
- Reminder-volume normalization and limits

### Popup contract tests

`tests/popup-contract.test.js` validates:

- Popup JavaScript selectors have matching HTML elements
- Manifest-referenced runtime files exist
- Required pixel-glass assets exist
- Packaged reminder audio exists

## Manual test checklist

1. Load the `extension` folder as an unpacked extension.
2. Pin PixelSip.
3. Confirm the popup shows a running timer.
4. Click **I drank water** and verify the glass refills.
5. Pause and resume the timer.
6. Change quiet hours and verify settings persist.
7. Temporarily change the interval to one minute for alert testing.
8. Verify the icon drains, shakes, loops the sound, and displays a notification.
9. Change reminder volume while the sound is playing and verify it updates immediately.
10. Set volume to 0% and verify the reminder is muted.
11. Test both notification actions and confirm they stop the sound.
12. Verify the timer waits for confirmation after becoming empty.

## Store-package review

Before uploading a new version:

- Confirm the ZIP root contains `manifest.json`.
- Confirm no documentation, test files, or secrets are included.
- Confirm the manifest version number has increased.
- Re-run all automated checks.
- Load the exact packaged extension locally before submission.
