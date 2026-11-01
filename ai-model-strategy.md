# Lore AI model strategy

Source: planning conversation with the owner (Thanh, Tevo JSC), with web research done on 2026-11-01. Read `CLAUDE.md` first. This document defines **how AI is wired into Lore**; it does not fix a single vendor. Items marked **Verify** were taken from secondary sources or are untested for Vietnamese and must be confirmed by measurement before they drive a decision.

## 1. Decision summary
- Use **three tiers plus a router**, not one model. Keep browsing history on device; only the current task's content may leave the device, through an anonymizing proxy.
- **Personal memory uses on-device embeddings.** Never embed browsing history in the cloud.
- **Put an AI gateway between the app and every cloud model** so models can be swapped without app changes.
- **Choose models by measurement on a Vietnamese eval set** (section 6), not by public leaderboards. Public comparisons found were English-only.
- The model is not the defense against prompt injection. The architecture is (section 7).

## 2. Tiers

| Tier | Runs where | Handles | Candidates |
|---|---|---|---|
| 0. No LLM | On device | Input classification (URL / question / task / memory query / download), ad blocking, scam detection, cookie banner rules | Small classifier, rules, `adblock-rust` |
| 1. Small on-device model | On device | Short summaries, translation, query rewriting, **embeddings for memory** | LLM: Qwen3.5 (0.8B, 2B, 4B), Gemma 4 edge (~4B), Phi-4 Mini (3.8B). Embeddings: `multilingual-e5-small`, `bge-m3` (larger, likely more accurate) |
| 2. Fast cloud model | Cloud via privacy proxy | Answer-first results with sources, long summaries, page understanding for agents, most agent steps | Claude Haiku 5.5 as the default candidate |
| 3. Strong cloud model | Cloud via privacy proxy | Complex multi-step agent tasks, ambiguous pages, hard questions | Claude Sonnet 5.5; larger Claude models only for hard cases |

Routing principle: use the cheapest tier that passes the quality bar for that task type; escalate on failure or low confidence. Log (locally, and in aggregate telemetry only if opted in) which tier handled each task and whether it succeeded, so thresholds can be tuned.

## 3. On-device model notes (Verify all)
- **Qwen3.5**: Apache 2.0. Sizes 0.8B, 2B, 4B, 9B. The 0.8B model is reported under 2 GB at 4-bit. First candidate for Vietnamese.
- **Gemma 4 edge (~4B)**: reported under 4 GB at 4-bit. Gemma Terms of Use (not a plain OSI license; one source claims the 12B variant is Apache 2.0, sources conflict, check the actual license text).
- **Phi-4 Mini (3.8B)**: MIT. Strong on math and code, but believed English-centric; test Vietnamese carefully.
- Source figures are mostly GPU VRAM, not phone RAM. Test on the lowest-spec target device (suggest a 6 GB RAM mid-range Android) for memory, latency, battery and thermal throttling.
- Runtimes to evaluate: llama.cpp (Android NDK, iOS), MLX (iOS/Apple silicon), Android on-device runtimes from the platform vendor, and on recent iPhones the OS-provided on-device model through Apple's framework (check device support and language support, including Vietnamese).
- Embedding model choice affects index size and recall. Benchmark both candidates on Vietnamese retrieval (section 6).

## 4. Cloud model notes
- Claude Haiku 5.5 reported pricing (secondary source, **Verify against official pricing**): about $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100K tokens; above 100K per request, every line rises (about $0.50 and $2.50). Cache reads about 0.1x input price. Batch is about 50% off but asynchronous.
- Claude Sonnet 5.5 reported pricing: about $2 input and $10 output per million tokens, flat to 1M tokens.
- Rough per-task cost estimates (assumptions, recompute with real token counts):

| Task | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| Summarize one page (8K in, 500 out) | about $0.001 | about $0.02 |
| 10-step agent task (15K in per step, 500 out per step) | about $0.02 | about $0.35 |

- Implications: Haiku makes a free tier viable; Sonnet only on escalation. **Truncate or chunk page content before sending** to stay under the 100K threshold. Use prompt caching for repeated system prompts and tool definitions.
- Owner context: the assistant that drafted this plan is Claude, so there is a vendor bias. Compare against at least two other vendors' fast models in the eval before committing.

## 5. Architecture requirements
1. **AI gateway** (own service): single internal API for all cloud calls; handles provider selection, fallback, rate limits, per-user quotas, cost accounting, and redaction. No provider SDK calls directly from the app.
2. **Privacy proxy**: strips user identity and device identifiers, no request or response logging, short-lived anonymous tokens for quota (design so the quota token cannot be linked to the account in logs). Publish the policy; plan an independent audit.
3. **Redaction before cloud**: on-device pass removes or masks credentials, card numbers, ID numbers and obvious personal data from page content sent to cloud tiers, where feasible for the task.
4. **No-cloud mode**: setting that disables tiers 2 and 3 completely; features degrade gracefully to tier 0 and 1.
5. **Provider data terms**: only use providers and plans whose terms exclude training on submitted data, and record the terms version used.
6. **Telemetry**: no URLs, no page content. Task outcome statistics are opt-in.

## 6. Evaluation plan (first spike, run alongside the Android engine spike)

Build `eval/vi-browser/` with about 100 realistic prompts, versioned and reviewed by a native Vietnamese speaker:

| Category | Count (suggested) | What it tests | Metric |
|---|---|---|---|
| Intent classification | 25 | URL vs question vs task vs memory query vs download; with and without diacritics, slang, abbreviations, mixed Vietnamese-English | Accuracy |
| Page summary and Q&A | 20 | Vietnamese news and e-commerce pages; faithfulness to source | Human rating 1-5 and citation correctness |
| Translation | 15 | Vietnamese and English both ways, in-layout fragments | Human rating |
| Memory retrieval | 20 | "tìm lại bài báo tuần trước về xe điện" over a synthetic history of 500+ pages | Recall@5, latency |
| Agent steps | 20 | Given a page snapshot, pick the next action on Vietnamese service pages (utility bill, flight booking); includes adversarial pages | Step accuracy, and injection resistance |

Models to run: Qwen3.5 (0.8B, 2B, 4B), Gemma 4 edge, Phi-4 Mini, the two embedding candidates, Haiku 5.5, Sonnet 5.5, plus at least two competing cloud fast models. Report per model: quality per category, p50 and p95 latency, memory, battery on a reference phone, and cost per task. Write results to `docs/ai-eval-results.md`. Re-run when a new model generation ships.

Pass bars to propose to the owner (not yet agreed): tier 1 must match or beat tier 2 on intent classification before the router sends it there; agent steps must reach an agreed minimum step accuracy before any workflow is exposed to users.

## 7. Prompt injection and agent safety (architecture rules)
- Web page content is **data, never instructions**. Pass it in clearly delimited untrusted fields; the system prompt states this; tool results cannot change tool permissions.
- **Separate read and act capabilities.** The component that reads untrusted pages must not hold the credentials or permission to act; actions go through a typed action layer.
- **Typed, allow-listed actions** with explicit parameters; no free-form code execution from model output.
- **Confirmation is enforced by the app, not requested of the model.** The action layer refuses payment, send, delete, settings and form-with-personal-data actions without a user-confirmed token.
- Show the exact item and amount in the confirmation card; per-action permission.
- Include adversarial pages in the eval (hidden text, fake instructions, look-alike buttons) and track resistance as a release gate.
- Local action log the user can review.

## 8. Open questions for the owner
- Budget per active user per month for cloud inference, and the free-tier limits?
- Willingness to host the AI gateway and privacy proxy ourselves (recommended) vs rely on a vendor feature?
- Is on-device AI required on all devices, or only on devices above a RAM threshold, with cloud fallback below it?
- Which markets after Vietnam (Thailand, Indonesia, Philippines)? Add their languages to the eval set early.
- Acceptable app size increase for bundling a model (or download on first run)?

## 9. First tasks
1. Create `eval/vi-browser/` with the schema and a first 30 prompts; ask the owner or a native speaker to review.
2. Build a small harness that runs one prompt set across local models (via llama.cpp) and cloud models through a thin gateway stub, writing a results table.
3. Prototype the on-device embedding index with a synthetic history and measure recall and latency on a mid-range Android phone.
4. Sketch the gateway API and the privacy proxy token scheme in `docs/gateway-design.md` for owner review before implementing.
