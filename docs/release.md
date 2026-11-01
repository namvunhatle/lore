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
npm run dist:linux # dist/Lore-linux-x64.AppImage and Lore-linux-x64.tar.gz (untested on real Linux)
```
`predist:*` compiles the bundled filter lists first (`npm run filters`, needs internet).

## Keeping the engine current (rule)
Lore is a browser, so its Chromium must be current. **Stay within the two newest Electron majors.** Electron ships a major about every 8 weeks and supports only the latest three.

- `npm run check:electron` compares the pinned major with the latest on npm: OK (latest), warning (one behind: update within the next release window), failure (two or more behind).
- CI runs it with `--strict` every Monday and on pushes to `main`, so a new major triggers a warning before it becomes a failure.
- To upgrade: `npm install --save-dev electron@<version>` using Node 22 or later, run `npm test` and `npm run test:e2e`, rebuild the installers, and note the Chromium version in the release notes.
- Node 22 or later is required (`.nvmrc`, `engines`). Electron 45 downloads its binary the first time it runs (there is no install step), and that download fails on Node 20.14. With nvm: `nvm install 22 && nvm alias default 22`.
- `npm test` uses a glob (`test/*.test.js`), which needs Node 22 or later.

## Signing and notarization

The release workflow (`.github/workflows/release.yml`) signs automatically **when the secrets below exist**, verifies the result, and fails the release if the check fails. Without the secrets it builds unsigned installers, as before, and the release notes say so. The landing page has one switch for this: `signed` in `site/config.js`.

> **Status:** the signing steps are written but have **not been run with real certificates**. Try the first signed build with a manual run (Actions, release, Run workflow, which builds without publishing) and open the installers before you tag a release.

Never paste certificates or passwords into chats, issues or commits. Add them only under the repository's Settings, Secrets and variables, Actions.

### macOS (Developer ID and notarization)

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) (paid, yearly).
2. Create a **Developer ID Application** certificate (Xcode, Settings, Accounts, Manage Certificates, + Developer ID Application; or developer.apple.com, Certificates). An "Apple Development" certificate is **not** enough: Gatekeeper rejects it for other people.
3. In Keychain Access, export that certificate with its private key as a `.p12` file and choose a password.
4. Create an app-specific password at appleid.apple.com (Sign-In and Security) and find your Team ID in your developer account membership.
5. Turn the `.p12` into one line of text: `base64 -i DeveloperID.p12 | pbcopy`
6. Add these repository secrets:

| Secret | Value |
|---|---|
| `MAC_CSC_LINK` | the base64 text of the `.p12` |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_ID` | your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | your Team ID |

electron-builder then signs with the hardened runtime, sends the app to Apple for notarization and staples the ticket. The workflow runs `codesign --verify`, `spctl --assess` and `stapler validate` afterwards.

To sign on your own Mac instead: put the Developer ID certificate in your keychain, set the three `APPLE_*` variables and run `npm run dist:mac:signed`. (`npm run dist:mac` never signs.)

### Windows

Windows SmartScreen trusts a publisher by its signature. Your choices:

- **A code-signing certificate you can export as `.pfx`** (usually OV): set `WIN_CSC_LINK` (base64 of the file: in PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("lore.pfx")) | Set-Clipboard`) and `WIN_CSC_KEY_PASSWORD`. The workflow is wired for this.
- **EV certificates** remove the SmartScreen warning at once, but CAs now deliver them on hardware tokens or in cloud HSMs, so they cannot be exported to a `.pfx`. Use a cloud signing service instead: Azure Trusted Signing (electron-builder supports it through `win.azureSignOptions`) or the CA's own cloud signing. This is **not wired yet**: tell us which service you chose.
- **Free signing for open-source projects** exists, for example through the SignPath Foundation. It needs an application and approval, and its terms change, so check their site.

The workflow verifies the signature with `Get-AuthenticodeSignature`. To sign on your own Windows PC run `npm run dist:win:signed` with the two `WIN_CSC_*` variables set.

### Linux

Linux has no system-level signing check. Each release lists SHA-256 checksums instead. If you want to go further, sign the checksum file with a GPG key.

### After the first signed release

Set `signed: { mac: true, windows: true }` in `site/config.js` (only for what is really signed). The landing page then drops the unsigned warnings.

## Auto-update
Lore looks for a newer version on GitHub Releases 30 seconds after it starts and every six hours (Settings > General > Updates turns this off; **Lore > Check for Updates** asks right away). It reads `latest.yml`, `latest-mac.yml` or `latest-linux.yml` from the latest release, so those files must stay attached to it: the release workflow uploads them with the installers, and it also uploads the macOS `.zip` files that macOS updates use.

What happens next depends on the system:

| System | Result |
|---|---|
| Windows | A notice "Lore X is available"; the person presses Update, it downloads in the background, then "Restart to update". Works with an unsigned installer. |
| Linux, AppImage | The same. The `.tar.gz` build cannot replace itself, so it opens the download page. |
| macOS, signed and notarized | The same. |
| macOS, unsigned (today) | Only a notice with a Download button, because macOS refuses to swap in an unsigned app. The workflow records `{ "signed": true }` in `src/build-info.json` for signed builds, which turns self-install on. |

What was tried: the check and the notice on macOS, against a local feed (a newer version gives the notice, the same version gives "latest version"); the local build produces the `.zip`, the block maps, `latest-mac.yml` and `app-update.yml`. **Not tried:** a real download and restart on any system. Try one on Windows with two real releases before relying on it.

Publish a new version by changing `version` in `desktop/package.json` and pushing a tag `vX.Y.Z` that matches it: the updater compares the version in the app with the one in `latest*.yml`.
