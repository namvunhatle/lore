# Lore feature backlog

Source: planning conversation with the owner (Thanh, Tevo). Positioning, moat and agent safety rules are in the project brief (`CLAUDE.md`, kept out of the public repository). This file is a prioritized backlog, not a committed scope. Priorities are proposals; confirm with the owner before building anything marked P2 or later.

## How to use this file
- Every feature must pass one gate: **does it make personal memory or the agent better, or does it protect the user visibly?** If not, defer it.
- IDs are stable. Reference them in issues and commits (e.g. `MEM-01`).
- Priority: **P0** = MVP (Android, months 2-5), **P1** = Beta (months 5-8), **P2** = after iOS/desktop (months 7-14), **P3** = long term.
- Platform column: A = Android, I = iOS, D = desktop. iOS is limited by WebKit (no Chromium, narrower extension and blocking APIs); flag any feature that cannot ship on iOS.
- Anything touching browsing history or page content must run **on device** unless the row says otherwise.

## 1. Memory and agent (moat)

| ID | Feature | Behavior | Pri | Platform | Notes and dependencies |
|---|---|---|---|---|---|
| MEM-01 | Ask about what I read | Natural-language search over visited pages by meaning ("hôm qua tôi đọc bài nào nói về lãi suất?"). Returns pages with date and snippet. | P0 | A I D | Local SQLite + on-device embeddings. Start collecting from first launch. Needs encrypted storage. |
| MEM-02 | Auto collections | Cluster related pages into topics (travel, shopping) without manual saving. | P1 | A I D | Depends on MEM-01 embeddings. Replaces bookmarks as primary organizer. |
| MEM-04 | Ask across everything I read | One question answered from **many** pages in memory, each claim cited [1][2] back to the page it came from. Extends to "compare these tabs". | P1 | D (then A I) | Reuses MEM-01 and the cited-answer code. Best quality needs the local embedding model; without it, keyword search only. Market note: others do this in the cloud; Lore can do it on device. |
| MEM-05 | Daily digest | End-of-day summary on device: what you read, what is worth keeping, loose ends. Saved into memory. | P1 | D (then A I) | Replaces EXP-03. No server. Opt-in. |
| MEM-03 | Memory review and delete | User can see, search, and delete anything stored; per-site and time-range delete; export. | P0 | A I D | Required for trust. Ship together with MEM-01. |
| AGT-01 | Confirmed agent tasks | Agent performs multi-step web tasks and **always stops for explicit confirmation** before payment, send, delete, settings changes, terms acceptance, or personal-data submission. | P1 | A I D | See agent safety rules in `CLAUDE.md`. Confirmation card shows exact item and amount. |
| AGT-02 | Smart form fill | Fill forms (passenger, address, contact) from on-device profile data. Never auto-fill passwords or card numbers; use the platform credential manager. | P1 | A I D | Needs form-field understanding (page parsing, may use cloud tier with redacted values). |
| AGT-03 | Price and change watching | "Báo tôi khi vé này dưới 700k" or "báo khi trang này đổi". Checks while the browser is open, desktop notification. | P1 | D (then A I) | Desktop: **local checks only, no server**. Mobile background limits apply; decide before building. |
| AGT-04 | Recurring tasks | "Mỗi đầu tháng đóng tiền điện, nước, internet." Always confirms before paying. | P1 | A I D | Depends on AGT-01 and a local scheduler. |
| AGT-05 | Workflow library (first 10-20) | Narrow, reliable workflows for Vietnamese services: utility bills, flights/trains, e-commerce, public services. | P1 | A I D | Quality over quantity. Track per-workflow success rate. |
| AGT-06 | Learn a workflow by demonstration | User does a task once, Lore records and replays it. | P3 | A D | High risk; needs strong sandboxing. Basis for a future skill marketplace. |
| AGT-07 | Skill marketplace | Third parties publish workflows; revenue share. | P3 | A I D | Needs review, signing, permission model. |

## 2. AI on the page

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| AI-01 | Intent bar router | One input accepts URL, question, task, memory query, download request; routes to the right handler (see `docs/ai-model-strategy.md`). | P0 | A I D | Works with and without Vietnamese diacritics. |
| AI-02 | Answer-first results | Direct answer with cited sources; original page one tap away. | P0 | A I D | Every claim linkable to a source. |
| AI-03 | Page summary and Q&A | Summarize current page, ask questions about it, quote the source passage. | P0 | A I D | Truncate pages before cloud calls (see cost notes in AI strategy). |
| AI-04 | In-place translation | Translate in layout; bilingual mode for long articles. | P0 | A I D | On-device model where quality is acceptable, otherwise cloud. |
| AI-05 | Side assistant panel | Trailing panel (desktop) or sheet (mobile) for assistant without leaving the page. | P1 | A I D | Already sketched in mockups. |
| AI-06 | Clean reader | Reader mode without ads, popups, cookie banners, with optional summary on top. | P0 | A I D | Can ship without LLM first. |
| AI-07 | Read aloud (Vietnamese) | Text-to-speech for articles. Prefer on-device voice. | P1 | A I D | Check Vietnamese voice quality per platform. |
| AI-08 | Compare tabs | Select 2-3 product tabs, produce a comparison table. Prices and terms are quoted verbatim, never guessed. | P1 | A I D | Part of MEM-04. |
| AI-10 | Safe reading for AI (injection shield) | Before page text reaches a model: strip hidden text (zero-size, off-screen, aria-hidden, same-colour-as-background), warn when text tries to command the assistant, and always show what was sent. | **P0 · Done (desktop)** | A I D | **Prerequisite for any agent that acts on pages.** Shipped: hidden-text removal, invisible-character stripping, fence protection, EN/VI order detection with notice; see `docs/ai-safety.md`. Still open: image-borne text, per-site allowlist. Prompt injection is the unsolved problem of AI browsers (see section 11). Builds on the existing text-extraction step. |
| AI-11 | Zero-config on-device AI | One-click setup: detect the machine, recommend a small multilingual model that handles Vietnamese, download and test it. | P1 | D (then A) | The privacy promise today needs a manual Ollama install. Check model licence and download size. Evaluate with the Vietnamese eval set first. |
| AI-12 | PDF and file questions | Drop a PDF or document, ask questions, answers cite the page. | P1 | D | Same as DL-06 for the viewer; this is the Q&A on top. |
| AI-09 | Explain terms and contracts | Select text, get plain-language explanation and flags for unfavorable clauses. | P2 | A I D | Show disclaimer; not legal advice. |

## 3. Privacy and safety (visible and measurable)

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| PRV-01 | Ad and tracker blocking | Network-level blocking with `adblock-rust`, EasyList-style lists plus a Vietnam-specific list. | P0 | A D (I via Content Blocker) | Block counter feeds home screen and shield panel. |
| PRV-02 | Scam and phishing warning | Warn on fake bank, e-wallet, parcel and lottery pages, and risky links. | P0 | A I D | Highest day-one value, little dependence on LLM. Source for the list is an open question (see below). |
| PRV-03 | Cookie banner cleanup | Auto reject non-essential cookies and dismiss banners. | P0 | A I D | |
| PRV-04 | Weekly privacy report | Trackers blocked, top trackers, data saved. Shareable. | P1 | A I D | Data from PRV-01. |
| PRV-05 | Ephemeral tab | Self-destructing tab (after N minutes or on close), isolated from memory. | P1 | A I D | |
| PRV-06 | Biometric lock | Lock private tabs and memory with biometrics. | P1 | A I | |
| PRV-07 | Email aliases | One-time email aliases for sign-ups. | P2 | A I D | Needs a mail relay service; privacy and cost review first. |
| PRV-08 | Breach check | Warn if saved credentials appear in known breach data. | P2 | A I D | Use k-anonymity style lookups; never send credentials. |
| PRV-09 | VPN | WireGuard, kill switch, split tunneling. Partner first. | P1 | A I D | Store policy and legal review required. |
| PRV-11 | HTTPS-first | Upgrade to HTTPS when possible and warn before an insecure page. | P1 | A I D | Parity with privacy browsers. |
| PRV-12 | Encrypted DNS | DNS over HTTPS with a visible setting. | P1 | A D | Parity. Mention in the privacy report. |
| PRV-13 | Strip tracking parameters | Remove `utm_*`, `fbclid`, `gclid` and similar from links before loading. | P1 | A I D | Small and visible. Keep a per-site off switch. |
| PRV-14 | Site containers | Separate cookie jars for work, personal and one-off logins. | P1 | A D | Electron partitions already exist for private tabs. Firefox containers are the reference. |
| PRV-10 | Private mode wipe | Wipe cookies, cache, history on private tab close; anti-fingerprinting; block third-party cookies by default. | P0 | A I D | |

## 4. Downloads and media

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| DL-01 | Media detection and download | Detect HLS/DASH/MP4 requests, floating download button, quality options, multi-connection, resume, ffmpeg merge. | P1 | A D (I limited) | **Skip DRM.** Store builds must not offer downloads from YouTube/Netflix-class platforms. Keep isolatable per build. |
| DL-02 | Download queue | Wi-Fi-only option, resume after loss, auto cleanup. | P1 | A I D | |
| DL-03 | Bulk download | Download all images/documents from a page. | P2 | A D | |
| DL-04 | Background and PiP playback | Audio and video continue in background; picture-in-picture. | P1 | A I D | |
| DL-05 | Save for offline | Save a page for offline reading with AI summary. | P2 | A I D | |
| DL-06 | Built-in PDF viewer | View, annotate, summarize, ask questions about PDFs. | P1 | A I D | Tevo already has PDF editor work ("PDF Bench"); evaluate reuse. Do early: contracts and reports are daily office work. See AI-12. |

## 5. Local advantage (Vietnam and Southeast Asia)

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| VN-01 | Vietnamese language understanding | No diacritics, abbreviations, slang, mixed Vietnamese-English in intent bar and agent. | P0 | A I D | Core of the eval set. |
| VN-02 | Local payments and identity | VNPay, MoMo, ZaloPay, bank QR, VNeID when available. | P1 | A I D | Legal and partner review before agent-driven payments. |
| VN-03 | Public service lookup | Traffic fines, tax, insurance, administrative procedures by natural-language question. | P1 | A I D | |
| VN-04 | E-commerce price compare | On product pages, compare Shopee, Lazada, Tiki, TikTok Shop with price history. | P2 | A I D | Check each site's terms and anti-bot behavior. |
| VN-05 | Share to Zalo | Quick share sheet targets local platforms. | P1 | A I | |
| VN-06 | Vietnamese voice input | Voice query with regional accent tolerance. | P2 | A I D | Evaluate speech-to-text providers on Vietnamese accents. |

## 6. Cross-device and Tevo ecosystem

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| SYN-01 | End-to-end encrypted sync | Sync bookmarks, passwords, and **memory index** across devices; server cannot read it. | P2 | A I D | Key management design is critical. Primary lock-in feature. |
| SYN-02 | Send tab to device | | P2 | A I D | Needs SYN-01 transport. |
| TEV-01 | Shared Tevo account and premium | One account, one subscription across Tevo apps. | P1 | A I D | Confirm account system with Tevo backend team. |
| TEV-02 | Open Tevo tools in browser | Quick launch of other Tevo apps and tools. | P2 | A I D | |
| EXT-01 | Extension support | Start with compatibility for popular extensions where the engine allows. | P2 | A D | Depends on Android engine decision (Chromium vs Gecko). |

## 7. Experimental (small trials only)
- **EXP-01 Conversational voice browsing:** chained requests ("tìm quán phở gần đây, mở bản đồ, gọi taxi").
- **EXP-02 Focus mode:** user states a goal ("học 1 tiếng"); Lore blocks distracting sites and opens relevant material.
- **EXP-03 Browsing journal:** on-device summary of time spent per topic. (The daily digest, MEM-05, covers the useful part.)
- **EXP-04 Shareable research session:** send a collection with summary to someone who does not use Lore.

## 7b. Everyday work tasks (added after the desktop prototype)

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| WRK-01 | Tasks | Ready-made and user-built tasks (email, reply, calendar event, social post, key facts, explain, study notes, cover letter). Fields are remembered. Drafts open in the user's own webmail or calendar in a new tab. **Lore never sends, posts or books.** | **Done (desktop)** | D | Next: more built-ins from real use, share a task as a file, mobile. |
| WRK-02 | Right-click Lore AI | Rewrite, fix, shorten, expand, tone, translate, explain, summarize on selected text or in a text box. | **Done (desktop)** | D | Next: a small bar that appears on selection. |
| WRK-03 | Mail and calendar awareness | Read the open webmail message (with the user's selection) and the open calendar day, to draft replies and propose free slots. | P2 | D | Needs sign-in inside Lore, which Google may refuse in embedded browsers. Outlook and others first. |

## 7c. Quality and release (added November 2026)

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| WEB-01 | Sign-in compatibility | Google, Microsoft, Apple and other OAuth sign-ins complete on popular sites (Lovable, Notion, Figma, GitHub). Pop-ups keep `window.opener` when they are sign-in windows; third-party cookies stay blocked except on a sign-in flow, with a visible per-site exception. | **P0** | D | Today's blocking is all-or-nothing. A site that cannot sign in makes users leave, so this outranks new AI features. Test with a list of 10 real sites. |
| REL-01 | Smoke test the packaged app | CI launches the built app on each OS and checks that a window opens and a page loads, before publishing. | **P0** | D | Would have caught the empty-window release. |
| REL-02 | macOS ad-hoc signature, then Developer ID | Ad-hoc sign now so Gatekeeper's "damaged" message is avoided where possible; notarize when a certificate exists. | P1 | D | Document `xattr -cr` as the workaround meanwhile. |
| REL-03 | Auto-update | Check for a signed update and install on restart. | P1 | D | Needs signing first. |

## 7d. Browser basics (must exist before anyone switches to Lore)

Every browser has these. Their absence is why people go back to Chrome after a day, whatever the AI can do. Status is for the desktop prototype as of November 2026; checked against the code, not remembered.

| ID | Feature | Behavior | Pri | Platform | Status and notes |
|---|---|---|---|---|---|
| BRW-01 | Find in page | Cmd/Ctrl+F opens a find bar: next, previous, match count, highlight, Esc to close. | **P0 · Done (desktop)** | A I D | Cmd/Ctrl+F opens a find bar at the top right of the page: type to search, Enter and Shift+Enter move, count shown, Esc closes. Also in the right-click menu and the More menu. Not yet: match whole word, case switch. |
| BRW-02 | Bookmarks | Star button, folders, a bookmarks bar toggle, bookmarks page, search. Optional: suggest saving what Memory shows you revisit. | **P0** | A I D | Missing. Memory is not a substitute: people want pages they chose. |
| BRW-03 | Browsing history page | Chronological list by day, search, delete one, a range or everything. Distinct from Memory's semantic search. | **P0** | A I D | Missing. Memory already stores visits; this is a view over it, with Cmd/Ctrl+Y. Private tabs excluded. |
| BRW-04 | Downloads manager | Any file download (not only media): progress, pause, cancel, open, show in folder, a list with Cmd/Ctrl+J, ask-where setting. Warn on risky file types. | **P0 · Done (desktop)** | A I D | Every download is tracked: file goes to Downloads with a numbered name if taken, progress, pause, resume, cancel, open, show in folder, remove; window with Cmd/Ctrl+J and a toolbar button that appears after the first download. Programs and installers are marked and never opened without asking. Not yet: ask-where setting, list kept across restarts. |
| BRW-05 | Restore tabs on start | Reopen the previous session after a quit or crash; setting for "new tab" or "continue where I left off". Private tabs are never restored. | **P0 · Done (desktop)** | A I D | Tabs are saved (encrypted, never private tabs) and reopened next start; only the active one loads, the rest load when shown. Setting: Settings > General > On startup. Needs secure storage on the system, otherwise nothing is saved. |
| BRW-06 | Tab management | Reopen closed tab (Cmd/Ctrl+Shift+T), duplicate, close others, close to the right, pin, reorder by dragging, Ctrl+Tab and Cmd+1..9 to switch, middle-click to close. | **P0 · Done (desktop)** | A I D | Right-click a tab: reload, duplicate, pin, close, close others, close to the right, reopen. Reopen closed (Cmd/Ctrl+Shift+T, last 25), Ctrl+Tab and Ctrl+Shift+Tab, Cmd/Ctrl+1 to 9, middle-click closes, drag to reorder, pinned tabs show only the icon and stay in front. Not yet: tab groups. |
| BRW-07 | Address bar security state | Lock icon for HTTPS, a clear warning for HTTP and for certificate errors (with a proper interstitial), click to see the site's permissions and certificate. | **P0** | A I D | Missing. The scam warning exists; the plain "is this connection secure" signal does not. Pairs with PRV-11. |
| BRW-08 | Search engine choice | Pick the default (DuckDuckGo, Google, Bing, Brave, Coccoc), add a custom one, keywords in the address bar. | P1 | A I D | Fixed to DuckDuckGo today. Search-partner revenue (business model) would live here. |
| BRW-09 | Make Lore the default browser | Register for http/https and open links from other apps in Lore; a prompt in settings. | P1 | A I D | Missing. Without it, links from mail and chat never reach Lore. |
| BRW-10 | Clear browsing data | Pick data types (history, cookies, cache, passwords, site data) and a time range; clear on exit option. | P1 | A I D | A wipe-everything action exists; no choices. |
| BRW-11 | Print and save as PDF | Cmd/Ctrl+P with preview; save the page as PDF. | P1 | A I D | Missing from the menu. |
| BRW-12 | Password manager | Offer to save, fill, generate, check for reuse; protected by the OS or biometrics; import and export. Never autofill without the user seeing the site. | P1 | A I D | Missing. Agent rules say use the platform credential manager; decide: own vault, OS keychain, or integrate with an existing manager (Bitwarden, 1Password). Also unblocks AGT-02 and PRV-08. |
| BRW-13 | Autofill for addresses and contacts | Saved profiles for forms, with the same on-device storage as memory. | P1 | A I D | Shares work with AGT-02. |
| BRW-14 | Import from other browsers | Bookmarks, history and (where the OS allows) passwords from Chrome, Edge, Firefox, Safari, Cốc Cốc; HTML bookmark file. | P1 | D | Missing. Decides whether people can switch in one afternoon. |
| BRW-15 | Multiple windows | New window, drag a tab out to make one, private window. | P1 | D | Single window today. |
| BRW-16 | Page zoom per site | Zoom keys exist now; remember the level for each site and show it in the address bar. | P1 | A I D | Keys work on the page (November 2026). Not remembered. |
| BRW-17 | Built-in PDF and media handling | Open PDFs in the tab, play audio and video in the tab with the usual controls, picture-in-picture. | P1 | A I D | PDF is DL-06; PiP is DL-04. |
| BRW-18 | Site permissions page | See and change camera, microphone, location, notifications and cookie decisions per site, with a reset. | P1 | A I D | Permissions ask once but cannot be reviewed or undone. |
| BRW-19 | Full-screen and presentation | Full screen for a video or the whole window with the bar shown on hover. | P2 | A I D | Window full screen exists; page full screen not tested. |
| BRW-20 | Reading list and tab groups | Save for later; group and name tabs, collapse. | P2 | A I D | Collections (MEM-02) may cover part of this. |
| BRW-21 | Accessibility | Keyboard-only use of every control, screen-reader labels, high contrast, minimum font size, caret browsing. | P1 | A I D | Tooltips with shortcuts exist; a real audit has not been done. |
| BRW-22 | Developer tools and view source | Open the inspector on the page (works, Alt+Cmd+I) and a View source command. | P2 | D | Inspector done; view source missing. |
| BRW-23 | Context menu completeness | Open link in new tab or private tab, copy link, save image as, copy image, inspect, search the web for the selection. | **P0 · Done (desktop)** | A I D | Links: open in new tab or private tab, copy address. Images: open, save as, copy, copy address. Selection: copy, search the web, Lore AI. Page: back, forward, reload, find, inspect. |
| BRW-24 | Crash and hang recovery | A crashed tab shows a "reload" page instead of a white tab; the app offers to restore. | P1 | A I D | Not checked. |

Done in November 2026: BRW-01, BRW-04, BRW-05, BRW-06, BRW-23. Next: BRW-02 bookmarks, BRW-03 history page, BRW-07 security indicator, then the P1 group by how often people ask.

## 8. Explicitly out of scope for now
- Social network or news feed inside the browser (content cost, conflicts with privacy positioning).
- Crypto wallet, games, pay-to-browse rewards (legal risk, brand drift).
- Shipping many features at launch. Each one must pass the gate at the top of this file.

## 9. Status snapshot (desktop prototype, November 2026)

Done: AI-10 (desktop), MEM-01, MEM-03, AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, PRV-01, PRV-02, PRV-03, PRV-10 (including private tabs), VN-01, WRK-01, WRK-02, favicons in memory, Linux/macOS/Windows packaging.
Partly done: AGT-01 (confirm-first engine and browser driver exist, tested against a local demo portal only; **no real service yet**), DL-01 (plain files and HLS, no DASH, resume or ffmpeg merge).
Known problems (fix before adding features):
- **REL-01** The first macOS installers opened with no window: the Dock icon was read from a folder missing in the package. Fixed in code, not yet released. Lesson: nothing tests the packaged app.
- **WEB-01** Sign-in on some sites loops (reported on Lovable after Google sign-in). Suspects: third-party cookie blocking applied to embedded frames, and pop-ups being turned into new tabs (the page loses `window.opener`, which OAuth pop-ups need). `LORE_DEBUG=1` prints navigations and refused cookies to find the cause.
- The v0.1.0 release workflow failed on Windows; the workflow now uses the unsigned scripts, not yet confirmed on GitHub.

Missing basics: bookmarks, history page, security indicator, search engine choice, default browser, password manager, import (section 7d). Done: find bar, downloads manager, session restore, tab management, full context menu.

Not started: mobile apps, Rust core, VPN, sync, extensions, code signing (pipeline written, untested without certificates), auto-update.

## 9b. Suggested first slice (original MVP, P0)
MEM-01, MEM-03, AI-01, AI-02, AI-03, AI-04, AI-06, PRV-01, PRV-02, PRV-03, PRV-10, VN-01. Start with PRV-02 and MEM-01: PRV-02 gives value on day one without depending on an LLM, and MEM-01 starts accumulating the moat immediately.

## 10. Open questions for the owner
- Data source and update mechanism for the scam/phishing list (own team, partner, public lists)?
- AGT-03: on desktop, checks run locally with no server. Is server-side polling acceptable at all on mobile, given the no-history-to-server promise?
- AI-11: which on-device model, and is it acceptable to ship or download it (licence, size, Vietnamese quality)?
- Which Vietnamese payment and identity partners are realistic in the first year?
- Is the mobile mockup font (currently Be Vietnam Pro and Bricolage Grotesque) to be unified with the desktop font (Google Sans)? Check license before shipping.


## 11. Market review (November 2026)

Method: a web search of roundups and news. The sources are mostly third-party blogs, not vendor documentation, so treat the details as a sketch and check before relying on any single claim.

What the market is doing:
- **AI browsers:** Perplexity Comet, Chrome with Gemini (auto browse is a paid, partly US preview), Edge (Copilot Mode folded into the browser, agent feature "Browse with Copilot"), Opera Neon (paid agent), Dia (mostly paid, macOS). One roundup reports OpenAI stopped Atlas in August 2026; verify.
- **Common pattern:** agents that act for the user, and memory across sessions.
- **Common weakness:** prompt injection. Several reports say Comet, Atlas, Dia and Copilot were exploited and that no vendor has a clean fix.
- **Brave Leo** already lets users plug in their own model, including one running locally. So "bring your own model" is no longer a differentiator.
- **Privacy browsers** (Brave, Tor, Mullvad, Firefox) win on blocking, anti-fingerprinting, HTTPS, encrypted DNS and containers. Some Firefox users reacted badly to AI features, which shows privacy-minded users distrust AI unless they control it.

Where Lore can stand apart:
1. **Reason over your own history, on the device** (MEM-04, AI-08, MEM-05).
2. **Make agents safe before making them powerful** (AI-10 first, then AGT-05 and VN-02).
3. **Make on-device AI effortless** (AI-11), so the privacy promise is true for ordinary users.
4. **Match the privacy-browser basics** (PRV-11 to PRV-14) so privacy users take Lore seriously.
5. **Keep the Vietnamese advantage** (VN-01 to VN-03) for services other browsers will not build.

Proposed next slice, in order: **WEB-01 and REL-01 first**, then the P0 browser basics in section 7d (BRW-01 to BRW-07, BRW-23), (a browser that cannot sign in or cannot open is not worth new features), then MEM-04 with AI-08, AI-11, DL-06 with AI-12, AGT-03 with MEM-05, then PRV-11 to PRV-14.
