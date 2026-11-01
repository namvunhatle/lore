# desktop

The Lore app for macOS, Windows and Linux, built on Electron.

```bash
npm ci
npm run filters   # compile the bundled ad-block lists (needs internet)
npm start
npm test          # unit tests
npm run test:e2e  # end-to-end tests (real Electron window)
```

Needs Node.js 22 or newer. Packaging and the Electron update rule are in [../docs/release.md](../docs/release.md); how the code is organised is in [../CONTRIBUTING.md](../CONTRIBUTING.md).
