# Working on this repo

The author is not a programmer. Claude writes all the code; explain changes in plain language.

## Ground rules

- **The design docs are the source of truth** (the claude.ai project "Pirate Chronicle"; § numbers are global). Code comments cite the § they implement. If code and docs disagree, flag it to the author; don't invent around it.
- **The look is §38 and each screen's contents §41.** `css/style.css` holds the §38.2 token sheet (inks, IM Fell, the page and rope); the IM Fell fonts live in `assets/fonts/` and ride inside the single-file build.
- **Rules in `js/`, data in `content/`, drawing in `js/ui.js` (and the prologue screens in `js/prologue.js`) only.** Engine files never touch the DOM, so `tests/run_tests.js` can load them in Node.
- Developer tools that change game state live in `js/devtools.js` (Skip the mandatory quests, §41.12).
- **Plain JavaScript, no build step, no packages.** Each file is an IIFE that attaches to `globalThis.PC`. Files load with `<script>` tags in `index.html` (order matters: engine, content, then UI). This keeps `index.html` working from a double-click (`file://`) and on GitHub Pages.
- **Scenes follow the §33 template.** See the header comment in `content/test_scenes.js` for the field names, and `content/ocracoke_scenes.js` for the extras the real scenes use (text pieces shown under a condition, exits by condition, information steps that return to their menu, `carry`). IDs are plain lowercase ASCII.
- **Every roll goes through a seeded key** (`PC.rng`). Never use `Math.random()` for game results.
- **Saves:** bump `SAVE_VERSION` in `js/state.js` and add a migration step whenever the save shape changes.

## Branches and pull requests

- **Work on a branch, never push to main.** Every milestone or fix starts on its own branch from main (for example `milestone-3-scenes-quests`) and ends with a pull request. Claude never merges: the author reviews and merges.
- **Defaults first.** Where the docs leave something OPEN and the build picks a default (§37.11), the PR description starts with a "Defaults I chose" list, one line each with the § it touches, so the review starts with the decisions that need a ruling.
- **Keep PRs focused.** Unrelated fixes go on their own branch and PR, even in the same run.

## Before pushing

1. `node tests/run_tests.js` — all pass.
2. The content check passes with no errors (run by the tests; also in the Developer panel).
3. `python3 tools/build_single.py` to refresh `dist/pirate-chronicle.html`.

## Not built yet (deliberately)

- The meters (§28) live in `js/meters.js` (Milestone 8, PR 2): every Standing, Heat and Dread change goes through `PC.meters` so the season's offenses and fear deeds are tracked. Arrival inspections are `js/inspections.js` with `content/inspection_scenes.js` (PR 3); Forge a Clearance is `js/forgery.js` (PR 4b); laying a ship up is in `js/node.js` (`state.laidUp`). Not yet: letters and the letter's Standing cap (PR 4), pardons (PR 5), the merchant ports' fee shakedown (no merchant port is live), displays on the Dread floor.
- Social retries at DR -1 (§11.10); clocks (§11.9); approval tags are recorded on choices but not yet read by anything.
- Modifier `note` fields (economy cuts, Gunnery, Dread and morale floors) are recorded but not applied; the systems that read them come later.
- The prize hunt (Milestone 5) is built: `js/hunt_gen.js` (what's met at sea, the loot), `js/combat.js` (battles, boarding, fleets), `js/hunt.js` (the hunt loop and after the battle, run as the "hunt" minigame), numbers and PLACEHOLDER lines in `content/hunt.js`; `tools/hunt_sim.js` plays it automatically. Not yet: patrols, false flags, the Known Prize flag, scouting ranges narrowing with experience, captured enemy captains beyond release, imprisonment and heirs (a captured or killed captain gets a game over), letters of marque. The minigames are built (Milestone 4: `js/salvage.js`, `js/drinking.js`, `js/liarsdice.js`, shared plumbing in `js/minigames.js`, numbers and lines in `content/minigames.js`); not yet: displays (the Giant Tooth and the Kingly Goblet count while carried), the Gambler flaw's stake temptation, item selling, and the giant shark's own cryptid scenes (PLACEHOLDER lines).
- Rumors: only the base Patrol danger spot rolls (Heat-driven spots, Hunter's Waters and the Frisian Sweep wait for Heat and the hunt); a Prize rumor is recorded but adds no ship until Milestone 5; the Hidden Haven's chart reveal waits for the map.
- Officers: approval points, barks (only the mentor's first-Articles line shows), bonds and officer events. The Acting Quartermaster and the Quartermaster's vote are built (§25.9): a vacancy is held by the Acting Quartermaster until the vote at the next action at sea (the M5 playtest patch). Officers join, show their traits and can be replaced (dismissed); nothing reads their likes yet.
- Quest deadlines and their expiry outcomes beyond the warning popup (§16.4): only What Was Lost carries a deadline, and nothing expires it yet.
- Named NPC portraits: Twopenny, Bobby, Davey, Ollie and Geezer show labeled frames until the art lands in `PC.data.npcPortraits` (content/ocracoke.js).
- The Drunkard/Heavy Drinker temptations, world-state price modifiers and the No Quarter tag's lag.
- Captain ageing over the years: the portrait already follows `captain.age`, but nothing advances it yet.
