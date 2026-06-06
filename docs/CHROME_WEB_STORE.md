# Chrome Web Store Release Guide

## Listing identity

- **Name:** PixelSip
- **Category:** Well-being
- **Language:** English
- **Single purpose:** Remind users to drink water every hour using a draining toolbar glass and notification.

## Store assets

- Store icon: `extension/icons/icon128.png`
- Screenshot: `assets/screenshot-1280x800.png`
- Small promo tile: `assets/promo-440x280.png`

## Privacy declarations

- No remote code
- No collected user-data categories
- No selling or transferring user data
- No unrelated use of user data
- No creditworthiness or lending use
- Privacy policy: [https://pv-vimalnair.github.io/PixelSip/](https://pv-vimalnair.github.io/PixelSip/)

## Build upload ZIP

The Chrome Web Store package must include only runtime files from `extension`.

```powershell
Compress-Archive -Path extension\* -DestinationPath PixelSip-store.zip -Force
```

Inspect the archive before uploading and ensure `manifest.json` is at the ZIP root.

## Review submission

Before clicking **Submit for review**:

1. Save the Store listing, Privacy, and Distribution sections.
2. Confirm the extension is public and available in intended regions.
3. Review all public copy and screenshots.
4. Confirm the package version and source match.
5. Test the exact uploaded package.
