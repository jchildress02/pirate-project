# Pirate Chronicle

Jack's Pirate Project: a browser-based, choice-driven pirate RPG. The design documents live in the claude.ai project "Pirate Chronicle"; this repo holds the game's code.

## Playing it

- **On your computer:** download the repo (green **Code** button → **Download ZIP**), unzip it and double-click `index.html`. It opens in your browser. No install, no internet needed.
- **As one file:** `dist/pirate-chronicle.html` is the whole game in a single file. Download it and open it.
- **Online:** if GitHub Pages is switched on, the game is at the link shown under **Settings → Pages**.

The game saves itself in your browser after every action. **Save file** downloads your save; **Load file** brings it back, on the same or another computer. A browser save only lives in that browser, so download a save file before you clear your browser data.

## Where things stand

**Milestone 2: the Ocracoke shell** (§17.2, §37.8). After the creator you sail into Ocracoke:

- the town screen with its five places (Tavern, Docks, Merchant, Lilyhook's Graveyard, the Ship) and the first-visit locks: only the Tavern is open until your first visit there ends;
- the Tavern keeper, shipwright and provisioner are new people in every world, named from the §36 pools with the gender weights by role (§15.1) and two traits each; pronoun tokens like {keeper.he} follow them;
- the plain services: provisions and the seasonal stock (Spring 1754's is fixed), selling clean treasure and goods to the provisioner and dirty ones to Bobby Rats's fence, repairs (which fix the frayed rigging), level 2 upgrades and guns, the crew pool and paying off hands, and shore leave;
- the harbor due on every arrival, with its shortfall rules, and the arrival popup;
- the Ship layer: the Articles (sign, loosen, never tighten), the Crew tab (Rally, Drill, Give to the crew, Make an Example, rationing), officers, cargo (jettison, open the stores) and the captain;
- random name buttons in the creator.

The first-visit scenes and the Startup quests are short PLACEHOLDER beats that fire at the right moments and pay the real rewards; Milestone 3 writes them in. Menu entries for later milestones show what's coming.

**Milestone 1: the character creator** (§12). **New game** opens it:

- ten steps: name and age, portrait, origin (home city, profession and its free point, what was lost), stats, training, traits and flaw, tags and debuffs, the mentor, the ship's name, and a review;
- the 48 portraits: the captain picks from the eight sets in his age band, one at a time; the portrait ages with him and swaps to the eyepatch twin with One Eye; the mentor picks an old portrait the captain didn't take; Anne Reed and Mary Bonny make a woman captain;
- every rule the creator needs: point limits and caps, the 1/2/3 tags and 0/1/2 debuffs by age, exclusions greyed out, Variant D hidden, the mentor's traits never a clashing pair;
- the starting game (§12.12): the sloop, 12 green hands, 600 crew gold (Baltimore 1,100), 10 provisions lots, the home-city friend, the mentor as first Quartermaster on the Friend rung with a seeded drive and fear, hidden profession flags, and the loss quest open;
- every trait, flaw, tag and debuff now changes checks (rerolls, +1s and -1s, with their conditions), and the mentor's Old Lessons reroll works;
- **Surprise me** fills a random captain; a half-made captain survives a refresh.

**Quick start with the test captain** (on the title screen) skips the creator.

**Milestone 0: the engine.** The check system, seeded dice, the scene runner, effects, pronoun tokens, seasons and actions, autosave and save files, the content checker and the Developer panel.

Next: Milestone 3, Ocracoke's scenes and quests (§37.8).

## Folders

| Folder | What's in it |
| --- | --- |
| `index.html` | The page that loads everything |
| `js/` | The engine: rules, dice, scenes, saving (`ui.js` draws the screen) |
| `content/` | Game data: check types, modifiers, the creator's lists, the test captain, scenes |
| `assets/` | Images: the 48 captain portraits |
| `css/` | The look (placeholder until the UI chat) |
| `tests/` | Engine tests: `node tests/run_tests.js` |
| `tools/` | `build_single.py` bundles the game, images included, into `dist/` |
| `dist/` | The single-file build |

Content is data and the engine reads it, so the same engine can be reskinned for another setting by swapping the `content/` folder.
