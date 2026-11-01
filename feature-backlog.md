# Lore feature backlog

Source: planning conversation with the owner (Thanh, Tevo JSC). Read `CLAUDE.md` first for positioning, moat, and agent safety rules. This file is a prioritized backlog, not a committed scope. Priorities are proposals; confirm with the owner before building anything marked P2 or later.

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
| MEM-02 | Auto collections | Cluster related pages into topics (travel, shopping) without manual saving. | P2 | A I D | Depends on MEM-01 embeddings. Replaces bookmarks as primary organizer. |
| MEM-03 | Memory review and delete | User can see, search, and delete anything stored; per-site and time-range delete; export. | P0 | A I D | Required for trust. Ship together with MEM-01. |
| AGT-01 | Confirmed agent tasks | Agent performs multi-step web tasks and **always stops for explicit confirmation** before payment, send, delete, settings changes, terms acceptance, or personal-data submission. | P1 | A I D | See agent safety rules in `CLAUDE.md`. Confirmation card shows exact item and amount. |
| AGT-02 | Smart form fill | Fill forms (passenger, address, contact) from on-device profile data. Never auto-fill passwords or card numbers; use the platform credential manager. | P1 | A I D | Needs form-field understanding (page parsing, may use cloud tier with redacted values). |
| AGT-03 | Price and change watching | "Báo tôi khi vé này dưới 700k" or "báo khi trang này đổi". Background checks, push notification. | P1 | A I D | iOS background limits apply; may need server-side polling for public pages only (no user credentials). Decide design before building. |
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
| AI-08 | Compare tabs | Select 2-3 product tabs, produce a comparison table. | P2 | A I D | |
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
| PRV-10 | Private mode wipe | Wipe cookies, cache, history on private tab close; anti-fingerprinting; block third-party cookies by default. | P0 | A I D | |

## 4. Downloads and media

| ID | Feature | Behavior | Pri | Platform | Notes |
|---|---|---|---|---|---|
| DL-01 | Media detection and download | Detect HLS/DASH/MP4 requests, floating download button, quality options, multi-connection, resume, ffmpeg merge. | P1 | A D (I limited) | **Skip DRM.** Store builds must not offer downloads from YouTube/Netflix-class platforms. Keep isolatable per build. |
| DL-02 | Download queue | Wi-Fi-only option, resume after loss, auto cleanup. | P1 | A I D | |
| DL-03 | Bulk download | Download all images/documents from a page. | P2 | A D | |
| DL-04 | Background and PiP playback | Audio and video continue in background; picture-in-picture. | P1 | A I D | |
| DL-05 | Save for offline | Save a page for offline reading with AI summary. | P2 | A I D | |
| DL-06 | Built-in PDF viewer | View, annotate, summarize, ask questions about PDFs. | P1 | A I D | Tevo already has PDF editor work ("PDF Bench"); evaluate reuse. |

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
- **EXP-03 Browsing journal:** on-device summary of time spent per topic.
- **EXP-04 Shareable research session:** send a collection with summary to someone who does not use Lore.

## 8. Explicitly out of scope for now
- Social network or news feed inside the browser (content cost, conflicts with privacy positioning).
- Crypto wallet, games, pay-to-browse rewards (legal risk, brand drift).
- Shipping many features at launch. Each one must pass the gate at the top of this file.

## 9. Suggested first slice (MVP, P0)
MEM-01, MEM-03, AI-01, AI-02, AI-03, AI-04, AI-06, PRV-01, PRV-02, PRV-03, PRV-10, VN-01. Start with PRV-02 and MEM-01: PRV-02 gives value on day one without depending on an LLM, and MEM-01 starts accumulating the moat immediately.

## 10. Open questions for the owner
- Data source and update mechanism for the scam/phishing list (own team, partner, public lists)?
- Is server-side polling acceptable for AGT-03 on public pages, given the no-history-to-server promise?
- Which Vietnamese payment and identity partners are realistic in the first year?
- Is the mobile mockup font (currently Be Vietnam Pro and Bricolage Grotesque) to be unified with the desktop font (Google Sans)? Check license before shipping.
