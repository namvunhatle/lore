# Security policy

Lore is a browser that handles personal data, so security reports are taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:

1. Go to the **Security** tab of this repository.
2. Choose **Report a vulnerability** and describe what you found.

Please include the version, your operating system, steps to reproduce, and what an attacker could do. If you can, tell us whether the problem is in Lore's own code or in Electron/Chromium.

We aim to reply within **5 working days**, to share a plan within **14 days**, and to credit you in the release notes if you wish.

## What is in scope

- Lore's own code in `desktop/src/` (main process, preload scripts, UI pages, IPC).
- Ways a web page could reach Lore's privileged windows or IPC channels, escape the sandbox, read memory or settings, or trigger an action without the user's confirmation.
- Prompt injection that makes the assistant take an action, or send data, that the user did not approve.
- Leaks of browsing data, page text, memory or API keys.

## What is out of scope

- Vulnerabilities in Chromium or Electron themselves. Please report those upstream. We keep Lore on a current Electron major, so updating is the fix.
- Problems that need a malicious local user who already controls your account.
- Warnings caused by unsigned builds. Code signing is on the roadmap.

## Supported versions

Only the latest release receives fixes while Lore is in version 0.x.

## Good to know

- Lore stores settings, memory and API keys with the operating system's keychain (Electron `safeStorage`). If the keychain is unavailable, they are **not** saved to disk.
- All Lore pages run sandboxed with context isolation and a strict Content-Security-Policy.
- Lore never sends, posts, pays or books on its own: it opens drafts in the service you choose, and you confirm there.
