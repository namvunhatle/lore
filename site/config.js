// The only place the landing page needs to know the repository and whether the installers are signed.
// Flip `signed` only once a release really is signed and notarized (see docs/release.md).
window.LORE = { repo: 'tevo-web/lore', signed: { mac: false, windows: false } };
