# Contributing to Lore

Thank you for helping. Lore is a small project with a clear aim: a **private, fast, easy** browser where AI helps without taking your data. Contributions in English or Vietnamese are both welcome.

## Before you start

- **Small fixes** (typos, bugs, tests, translations): just open a pull request.
- **New features or big changes:** open an issue first so we can agree on the shape. Please check the product rules below, because some good ideas do not fit.
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Product rules (these are not up for debate in a pull request)

1. **Private means on your device.** Browsing history, page text and memory must never be sent to a server. Anything that sends page content to a model must say where it goes and must be started by the user.
2. **Say "private", never "anonymous."**
3. **The agent never acts alone on anything that matters.** Payments, sending messages, deleting, changing settings, accepting terms and submitting personal data always stop for an explicit confirmation that shows the exact item and amount. Text from web pages is data, never instructions.
4. **No DRM circumvention.** Encrypted streams and platforms that forbid downloads stay out.
5. **No telemetry or analytics** without an explicit opt-in that a user can read and refuse.
6. **Keep the engine current.** Lore stays within the two newest Electron majors (`npm run check:electron`).

## Setting up

You need Node.js 22 or newer.

```bash
git clone https://github.com/tevo-web/lore.git
cd lore/desktop
npm ci
npm run filters
npm start
```

Run the checks before you push:

```bash
npm test             # unit tests
npm run test:e2e     # needs a display; quit other Electron apps first
```

End-to-end suites sometimes hang if another Electron app is open. If a suite stalls, quit the other apps and run it again. The `extract` suite is known to be flaky.

## How the code is organised

| Where | What |
|---|---|
| `desktop/src/main.js` | Windows, tabs, panels, IPC, menus |
| `desktop/src/router.js` | Decides what the intent bar input means (URL, question, memory, write, ...) |
| `desktop/src/harden.js`, `privacy.js`, `scam.js`, `adblock.js` | Privacy and safety |
| `desktop/src/memory.js`, `favicons.js` | On-device memory |
| `desktop/src/llm.js`, `answer.js`, `pageassist.js`, `writing.js` | AI providers and what we ask them |
| `desktop/src/tasks.js` | Built-in and user tasks, drafts, mail and calendar links |
| `desktop/src/ui/` | Every page we ship (HTML, CSS, JS). Strings live in `i18n.js` |

UI pages are served from `file:` with a strict Content-Security-Policy: no inline scripts, no inline `style` attributes, no remote resources. Build DOM with `textContent` or the small `h()` helpers, never with `innerHTML` on anything that is not a fixed string.

## Code style

- Match the file you are in: names, comment density, quotes, semicolons.
- Comments explain **why**, in plain English.
- No new dependency without a reason in the pull request. Check its licence is compatible with MIT and add it to [docs/third-party.md](docs/third-party.md).
- Every user-visible string goes through `i18n.js` in **both** English and Vietnamese. A test checks that the two stay in step.

## Tests

- Pure logic gets a unit test in `desktop/test/`.
- The intent bar is checked against real sentences in `desktop/test/vn-eval.test.js`. If you change `router.js`, add the sentences that motivated the change, including ones **without diacritics**.
- UI changes: run the app and look at them (light, dark, English and Vietnamese). Say in the pull request what you checked.

## Pull requests

- Keep each pull request to one idea.
- Describe what changed and why, and how you tested it.
- Be honest about what you did not test.
- By contributing you agree your work is released under the [MIT license](LICENSE).

## Translations

Add a language by extending `desktop/src/ui/i18n.js`. Copy the `en` block, translate the values (keep `{placeholders}` as they are) and register the language in `LANGS`. The parity test will tell you what is missing.
