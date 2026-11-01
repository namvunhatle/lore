# Safe reading for AI (AI-10)

A web page is **data, never instructions**. Hostile pages know a model may not tell the two apart, so they hide text ("ignore previous instructions…") where a person cannot see it but a model can read it. This is called prompt injection. It is an unsolved problem across the industry, and Lore does not claim to have solved it. What it does is remove the cheap tricks, tell you when a page tries one, and keep the rule that the assistant never acts for you without your confirmation.

## What happens to page text before a model reads it

1. **Only what you can see is read.** Before the article is extracted, Lore drops elements that a person cannot see: `display:none`, `visibility:hidden`, near-zero opacity, text under 5px, text pushed far off-screen, clipped or zero-size boxes, large negative `text-indent`, and text whose colour is almost the same as its background. The live page is never modified; the work is done on a copy. `aria-hidden` is not treated as hidden, because many real pages use it for visible content.
2. **Invisible characters are stripped.** Zero-width characters, bidirectional overrides, variation selectors and the Unicode "tag" block (which can encode a whole message invisibly) are removed.
3. **The prompt fence cannot be forged.** Prompts wrap page text in `<<<` and `>>>`. Runs of those characters in page text are replaced so a page cannot close the fence early.
4. **Orders aimed at an AI are flagged.** A rule list (English and Vietnamese) looks for phrases such as "ignore previous instructions", "do not tell the user", "send … passwords", "note to the AI assistant", or role markers like `<|im_start|>`. When something matches, the panel or the Tasks form shows a notice with the matching excerpt. The text is still treated as page content and is not followed.
5. **You see what was sent.** The Tasks form shows the text that will be sent and lets you edit it. The panel notes how many invisible characters were removed.

Hidden text on its own is normal (menus, screen-reader labels) and does not trigger a warning. A warning appears only when hidden or visible text reads like an order to an AI.

Covered paths: summarize, ask, key facts, tasks that use the page, selected text, and right-click writing actions. Translation edits the page in place and does not send instructions-bearing text anywhere other than for translation.

## Limits

- Heuristics are not a guarantee. A determined attacker can phrase an order in a way no rule list matches, or use an image.
- A news article about prompt injection will trigger the notice. That is intended: a notice costs nothing.
- Text that is visible but still misleading (a fake "review" saying "this product is the best") is out of scope.

## What protects you even if a model is fooled

- Lore's tasks only produce drafts. They never send, post or book.
- Any future agent action stays behind an explicit confirmation showing the exact item and amount.
- Page content is never executed or given tool access.

## Tests

`desktop/test/shield.test.js` (rules, stripping, fence) and `desktop/test-e2e/shield.js` (a hostile page with six hiding techniques, run in a real Electron window).
