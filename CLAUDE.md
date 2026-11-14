# Working on this repo

The author is not a programmer. Claude writes all the code; explain changes in plain language.

## Ground rules

- **The design docs are the source of truth** (the claude.ai project "Pirate Chronicle"; § numbers are global). Code comments cite the § they implement. If code and docs disagree, flag it to the author; don't invent around it.
- **Rules in `js/`, data in `content/`, drawing in `js/ui.js` only.** Engine files never touch the DOM, so `tests/run_tests.js` can load them in Node.
- **Plain JavaScript, no build step, no packages.** Each file is an IIFE that attaches to `globalThis.PC`. Files load with `<script>` tags in `index.html` (order matters: engine, content, then UI). This keeps `index.html` working from a double-click (`file://`) and on GitHub Pages.
- **Scenes follow the §33 template.** See the header comment in `content/test_scenes.js` for the field names. IDs are plain lowercase ASCII.
- **Every roll goes through a seeded key** (`PC.rng`). Never use `Math.random()` for game results.
- **Saves:** bump `SAVE_VERSION` in `js/state.js` and add a migration step whenever the save shape changes.

## Before pushing

1. `node tests/run_tests.js` — all pass.
2. The content check passes with no errors (run by the tests; also in the Developer panel).
3. `python3 tools/build_single.py` to refresh `dist/pirate-chronicle.html`.

## Not built yet (deliberately)

- Meter modifiers on checks (Dread and Standing, §11.8.5): `meterModifier()` in `js/checks.js` is a stub.
- Social retries at DR -1 (§11.10); clocks (§11.9); approval tags are recorded on choices but not yet read by anything.
- The -4 lock rule is OPEN in the docs; `RULES.LOCK_AT_OR_BELOW` holds the current guess (-4).
