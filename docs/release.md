# Releasing the desktop app

## Publishing a release (GitHub)
1. Update `version` in `desktop/package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
3. The **release** workflow builds the macOS and Windows installers, writes `SHA256SUMS.txt` and attaches everything to a GitHub Release. The installers have fixed names (`Lore-mac-arm64.dmg`, `Lore-mac-x64.dmg`, `Lore-win-x64-setup.exe`) so the landing page can link to `releases/latest/download/<name>`.
4. Only tags with a dash (`v1.0.0-beta.1`) become pre-releases. GitHub's "latest release" link ignores pre-releases, so a normal `v0.x` tag is published as a regular release.

## Building by hand

```bash
cd desktop
npm ci
npm test && npm run test:e2e   # quit any running Lore first: end-to-end tests can hang while another Electron app is open
npm run dist:win   # dist/Lore-win-x64-setup.exe  (NSIS, x64)
npm run dist:mac   # dist/Lore-mac-arm64.dmg and Lore-mac-x64.dmg
```
`predist:*` compiles the bundled filter lists first (`npm run filters`, needs internet).

## Keeping the engine current (rule)
Lore is a browser, so its Chromium must be current. **Stay within the two newest Electron majors.** Electron ships a major about every 8 weeks and supports only the latest three.

- `npm run check:electron` compares the pinned major with the latest on npm: OK (latest), warning (one behind: update within the next release window), failure (two or more behind).
- CI runs it with `--strict` every Monday and on pushes to `main`, so a new major triggers a warning before it becomes a failure.
- To upgrade: `npm install --save-dev electron@<version>` using Node 22 or later, run `npm test` and `npm run test:e2e`, rebuild the installers, and note the Chromium version in the release notes.
- Node 22 or later is required (`.nvmrc`, `engines`). Electron 45 downloads its binary the first time it runs (there is no install step), and that download fails on Node 20.14. With nvm: `nvm install 22 && nvm alias default 22`.
- `npm test` uses a glob (`test/*.test.js`), which needs Node 22 or later.

## Signing (not set up yet)
Unsigned builds work but trigger Windows SmartScreen and macOS Gatekeeper warnings.

- **Windows:** buy a code-signing certificate (an EV certificate removes the SmartScreen warning immediately). Set `WIN_CSC_LINK` (path or base64 of the .pfx) and `WIN_CSC_KEY_PASSWORD`, and remove `signAndEditExecutable: false` in `desktop/package.json`.
- **macOS:** needs an Apple Developer account. Set `CSC_LINK`, `CSC_KEY_PASSWORD` for the Developer ID certificate, remove `"identity": null` from the `mac` block, and add notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

## Auto-update (not set up yet)
Needs a place to host releases (for example GitHub Releases or an S3 bucket) and `electron-updater`. Until then, send users the new installer.
