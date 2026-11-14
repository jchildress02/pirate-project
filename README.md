# Pirate Chronicle

Jack's Pirate Project: a browser-based, choice-driven pirate RPG. The design documents live in the claude.ai project "Pirate Chronicle"; this repo holds the game's code.

## Playing it

- **On your computer:** download the repo (green **Code** button → **Download ZIP**), unzip it and double-click `index.html`. It opens in your browser. No install, no internet needed.
- **As one file:** `dist/pirate-chronicle.html` is the whole game in a single file. Download it and open it.
- **Online:** if GitHub Pages is switched on, the game is at the link shown under **Settings → Pages**.

The game saves itself in your browser after every action. **Save file** downloads your save; **Load file** brings it back, on the same or another computer. A browser save only lives in that browser, so download a save file before you clear your browser data.

## Where things stand

**Milestone 0: the engine.** It runs on placeholder test scenes and a fixed test captain, Dewey Test:

- the check system (§11): 2d6 + edge, setback / partial / clean, the tier and odds shown on every choice, with a breakdown;
- seeded dice, so reloading never changes a roll;
- a scene runner that reads scenes as data, written to the §33 template;
- effects (gold with the purse-or-crew prompt, morale, Dread, Standing, Heat, flags, tags and more), costs, locked and hidden choices, variant lines, rerolls;
- pronoun and name tokens (§33.3.12);
- seasons and actions;
- autosave, plus save file export and import;
- a content checker that catches broken scenes;
- a Developer panel (show the dice, flip the captain's gender to test pronouns, run the content check).

Next: Ocracoke's first visit and the startup quests, then the character creator, a prize hunt and selling loot (the prototype loop).

## Folders

| Folder | What's in it |
| --- | --- |
| `index.html` | The page that loads everything |
| `js/` | The engine: rules, dice, scenes, saving (`ui.js` draws the screen) |
| `content/` | Game data: check types, modifiers, the test captain, scenes |
| `css/` | The look (placeholder until the UI chat) |
| `tests/` | Engine tests: `node tests/run_tests.js` |
| `tools/` | `build_single.py` bundles the game into `dist/` |
| `dist/` | The single-file build |

Content is data and the engine reads it, so the same engine can be reskinned for another setting by swapping the `content/` folder.
