# CRASHPAD desktop

A desktop window for [crash-pad.netlify.app](https://crash-pad.netlify.app) — no browser bars, popups blocked. It always loads the live site, so it never needs updating for site changes.

## Download

- **Mac (Apple Silicon — M1 and newer):** [CRASHPAD-mac-arm64.dmg](https://github.com/IBagyin/crashpad-desktop/releases/latest/download/CRASHPAD-mac-arm64.dmg)
- **Mac (Intel):** [CRASHPAD-mac-x64.dmg](https://github.com/IBagyin/crashpad-desktop/releases/latest/download/CRASHPAD-mac-x64.dmg)
- **Windows:** [CRASHPAD-Setup.exe](https://github.com/IBagyin/crashpad-desktop/releases/latest/download/CRASHPAD-Setup.exe)

## First launch

The app isn't signed with a paid certificate, so the system warns once:

- **Mac:** open the app, close the warning, then go to System Settings → Privacy & Security and click **Open Anyway**.
- **Windows:** on "Windows protected your PC", click **More info** → **Run anyway**.

## Releasing

Bump `version` in `package.json`, commit, then push a matching tag (`git tag v1.0.1 && git push --tags`). GitHub Actions builds both platforms and publishes the release.
