# Desktop engine spike

Written 2026-11-01. Question: **should Lore stay on Electron, or move to a Chromium fork (or something else)?**
What triggered it: signing in to Google from Lore fails with "Sign in with a supported browser".

## Summary

1. **Stay on Electron for now, and keep it current. Done on 2026-11-01: Lore is now on Electron 45.2.1.** Lore ships Electron 33.4.11. The latest is 45.2.1 and Electron only supports the latest three majors, so the browser has been missing Chromium security fixes for about a year. A browser cannot ship that. The upgrade was tested (see Measurements) and costs nothing in startup time. A rule now keeps it from drifting again: stay within the two newest majors (`npm run check:electron`, enforced weekly in CI, see `docs/release.md`).
2. **A Chromium fork is not a proven fix for Google sign-in**, and it is a large permanent cost (a Chromium release every two weeks since September 2026). Do not start one on this evidence alone. Triggers for revisiting are listed below.
3. **Fix sign-in the supported way:** send Google sign-in to the system browser, and for the web session use what Google allows (see "Google sign-in").
4. **Honest gap:** I could not test whether Google accepts a Chromium fork, because that needs a real Google account and installed forks. The owner can run the 30-minute check below.

## Google sign-in

What Google's own guidance says ([developer blog](https://developers.googleblog.com/guidance-to-developers-affected-by-our-effort-to-block-less-secure-browsers-and-applications/), quoted by [Auth0](https://support.auth0.com/center/s/article/disallowed-useragent-403-with-Google-sign-in)):

- Sign-in from embedded frameworks is blocked, and it names CEF-based apps and non-supported browsers.
- A compatible browser must identify itself clearly in the User-Agent on `accounts.google.com`, **must not use another browser's User-Agent** (such as Chrome's), and must not offer automation features such as scripts that click or type for sign-in.
- Google's help page says sign-in can be refused for browsers that are embedded in another application or are driven by automation ([Google Help](https://support.google.com/accounts/answer/7675428)).

Consequences for Lore:

- Lore used to remove the `Electron` and app tokens from its User-Agent so that it looked like plain Chrome. That is the opposite of what Google asks, and the experiment below shows it is what made Google reject Lore. **Removed on 2026-11-01.**
- Chromium forks are not clearly accepted either. Forum reports show Brave and Vivaldi users being refused at times, depending on build and account ([Brave](https://community.brave.app/t/google-blocking-signin-with-brave/632132), [Vivaldi](https://forum.vivaldi.net/post/239235)). Google publishes no list of accepted browsers. Only Chrome is clearly supported.
- Min, an Electron browser, documents the same limitation: Google sometimes blocks browsers it does not recognise ([Min FAQ](https://github-redirect.dependabot.com/minbrowser/min/wiki/FAQ)).
- Common practice for apps is to open the system browser for Google sign-in and hand the result back (OAuth for native apps).

## Experiment: what actually made Google refuse Lore (2026-11-01)

Google's public sign-in page was loaded in six configurations and a made-up address (`...@example.com`, not a real account, no password) was submitted at the first step. No credentials were used. Results, in Electron 45.2.1:

| Configuration | Google's answer at the email step |
|---|---|
| Bare Electron (its real user agent) | Accepted: "Couldn't find this account" |
| Lore with all protections **and Electron's real user agent** | Accepted: "Couldn't find this account" |
| Lore with all protections and a **Chrome-like user agent** (what Lore did before) | **Rejected**: "Couldn't sign you in. This browser or app may not be secure" |
| Lore with every protection off, Chrome-like user agent | Rejected |
| Nothing but the Chrome-like user agent | Rejected |

So the cause was Lore posing as Chrome, not JavaScript, not the ad blocker, not third-party cookie blocking, and not fingerprint protection. That matches Google's guidance that a browser must not use another browser's user agent. Lore now leaves the user agent as Electron reports it.

What this does **not** prove: only the first (email) step was tested. A later step, such as the password or a verification prompt, may still refuse an embedded browser, and Google's checks change over time. Someone with a throwaway Google account should try a full sign-in. If Google rejects it, Lore shows a short explainer with an "Open in default browser" button (it appears when Google sends the tab to its "rejected" page).

## Options

| Option | Google sign-in | Effort and running cost | Notes |
|---|---|---|---|
| **A. Electron, kept current** (today) | Blocked | Low. A new Electron major every 8 weeks; keep within the latest three | Same Chromium and V8 as Chrome, so page speed is equal for the same version. Extra Node process costs memory. |
| **B. A + system-browser hand-off** | Works for apps that use OAuth in the system browser; no Google session inside Lore | Low | Needed on mobile anyway (Custom Tabs on Android, `ASWebAuthenticationSession` on iOS). |
| **C. CEF** | Named as blocked by Google | Medium | No benefit over Electron here. |
| **D. Chromium fork, built from source** | Unproven; may work, may be refused | Very high and permanent. Chrome ships every 2 weeks since September 2026. Official builds take hours on a powerful machine and need a lot of memory and disk ([Vivaldi](https://vivaldi.com/?p=441493)). A rebase can take days ([Igalia on keeping the fork small](https://blogs.igalia.com/dape/2025/02/04/maintaining-chromium-downstream-keeping-it-small/)) | Gives extensions, native UI, and full control of privacy features. Needs Chromium-experienced engineers, build servers, and an update service. |
| **E. Start from an existing fork** (for example ungoogled-chromium or Brave's open-source core) | Unproven | High. Inherits someone else's patches and release timing | Cheaper than D, but locks Lore to that project's choices and licence terms. |
| **F. Gecko (Firefox fork)** | Unknown; not confirmed in my search | High | Avoids Manifest V3 limits. Much smaller embedding ecosystem for desktop. |
| **G. Platform WebViews** (WebView2, WKWebView) | Embedded, so likely blocked | Medium | Needed on iOS regardless (WebKit is mandatory outside the EU). |

## Measurements (this machine: Apple M3 Pro, 18 GB, unpackaged dev run)

Run with `LORE_BENCH=1 npx electron .` (prints time to the first tab being loaded and memory, then exits). The reported time includes a fixed 0.8 s settle delay, so subtract 0.8 s to get the real time to first tab.

| | Electron 33.4.11 (current) | Electron 45.2.1 (latest) |
|---|---|---|
| Time to first tab loaded (5 runs) | 1.22 to 1.46 s, so about 0.4 to 0.65 s | 1.28 to 1.66 s warm, so about 0.5 to 0.85 s |
| First run after a fresh install | not applicable | 3 to 11 s (macOS verifying the new binary) |
| Memory, all processes, one tab | 490 to 595 MB | 610 to 690 MB (about 10% more) |
| Processes | 6 | 6 |
| Unit tests (85) | pass | pass |
| End-to-end suites (5) | pass | pass |

Notes:
- The end-to-end `reader` test sometimes hangs on both versions, and it also hung when other Electron apps were open. This is a test-harness problem with hidden windows, not an engine regression, and it is still open.
- Electron 45's install step failed on Node 20.14 (`ERR_REQUIRE_ESM`) and worked with Node 24. CI and developer machines need a newer Node (22 or later) before the upgrade.
- Packaged Mac build on Electron 45 (`dist/mac-arm64`, 6 runs, warm): 1.30 to 1.45 s reported, so about 0.5 to 0.65 s to the first tab, and about 0.7 s from launch to first tab. That is inside the brief's 1 s target. The very first launch after install took 3.3 s (macOS verifying the app). Windows was not measured.
- Speedometer was not run for the desktop question. Electron and any Chromium fork share the same Chromium and V8, so the only difference is the Chromium version. Speedometer matters for the **Android** spike (WebView vs GeckoView), which is still to do.
- This machine has about 67 GB of free disk. I expect that to be too tight for a Chromium source checkout plus build output, so a fork spike needs a bigger machine or a cloud build box. This is my judgement, not a measured limit.

## Release cadence facts

- Chrome moved to a two-week stable release in September 2026, starting with Chrome 153 ([Chrome for Developers](https://developer.chrome.com/blog/chrome-two-week-release)). Chrome on this machine is 156.
- Electron releases a major about every 8 weeks, follows Chromium, and supports only the latest three majors ([Electron timelines](https://electronjs.org/docs/latest/tutorial/electron-timelines)). npm lists 45.2.1 as latest (modified 2026-10-31).

## Recommendation and plan

**Done**
1. Electron 33 upgraded to 45.2.1. Node 22 or later is now required (`.nvmrc`, `engines`, CI). The rule "stay within the two newest Electron majors" is enforced by `scripts/check-electron.js` in CI.

**Still to do**
2. Google sign-in: **done.** The user agent is honest, and when Google still rejects the sign-in Lore shows a short explainer with an **Open in default browser** button. The menu also has "Open in System Browser".
3. Keep passkeys and other non-Google sign-in working as normal.

**Revisit a Chromium fork only if one of these becomes true**
- Browser extensions (including ad blockers and password managers) become a launch requirement.
- Signing in to Google or Microsoft inside Lore becomes a top user need **and** the owner's test below shows a fork is accepted.
- The company has at least four to six engineers who can maintain Chromium patches, plus build infrastructure and an update service, and accepts a rebase every two weeks.

**Owner's 30-minute check (needs a throwaway Google account; I cannot enter credentials or create accounts)**
1. Install Brave, Vivaldi and ungoogled-chromium.
2. Try to sign in to a throwaway Google account in each, on a fresh profile, and record accept or refuse.
3. If all three are refused, a fork is not worth it for sign-in; if some pass, a fork spike has a real reason.

**Not covered here**
- The Android engine choice (WebView, GeckoView or a fork) needs its own spike with cold start, Speedometer, memory and ad-block effectiveness on a real device.
- iOS is WebKit-only outside the EU, so this question does not apply there.
- Linux was not examined.
