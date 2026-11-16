/* The three Year 1 minigames' numbers and lines (§18, §32.15, S17 appendix §8).
 *
 * The rules are in js/salvage.js, js/drinking.js and js/liarsdice.js. Every
 * number here is a placeholder the docs mark for playtesting; the Tuning
 * Table lists the main ones. Lines are the author's (S17 appendix), with
 * "PLACEHOLDER" where a line is still to write.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  // ---- The salvage dive (§18.2, §32.15) ------------------------------------
  var salvage = {
    BREATH: 6,
    SLOTS: 3,                 // items a zone holds
    ZONE_MOD_CLAMP: 2,        // a zone's running modifier stays within ±2
    DR_MAX: 5,                // Year 1 content
    ZONE_DR: { hull: 2, hold: 3, cabin: 4 },
    ZONE_NAMES: { hull: "Hull", hold: "Hold", cabin: "Cabin" },
    ZONES: { sloop: ["hull", "hold"], brig: ["hull", "hold", "cabin"], frigate: ["hull", "hold", "cabin"] },
    WRECK_WEIGHTS: { sloop: 55, brig: 30, frigate: 15 },
    WRECKS_OFFERED: 3,
    // One of each at Lilyhook's Graveyard (the author, November 16); other
    // dive sites set their own mix in their node chats.
    WRECK_MIX: { ocracoke: ["sloop", "brig", "frigate"] },
    HAZARDS: { snag: 35, current: 30, shark: 20, cryptid: 15 },
    // DEFAULT (§18.2 gives no DR): the shark's Notice Danger and the
    // cryptid's Ghost Sense.
    SHARK_CHECK: { type: "Notice Danger", dr: 2 },
    CRYPTID_CHECK: { type: "Ghost Sense", dr: 3 },
    RELIC_CHANCE: 0.4,
    GEAR: { "Diver's Mask": 1, "Diving Barrel": 2 }, // the best one counts (§32.12)

    // §32.15 Tier weights by zone (%), raised in UI pass 1 (§38.8: a dive
    // that finds something should be worthwhile; tuned with the simulator).
    TIERS: {
      hull: { junk: 20, supplies: 25, goods: 10, treasure: 45, item: 0 },
      hold: { junk: 10, supplies: 15, goods: 20, treasure: 55, item: 0 },
      cabin_brig: { junk: 5, supplies: 0, goods: 15, treasure: 70, item: 10 },
      cabin_frigate: { junk: 5, supplies: 0, goods: 10, treasure: 70, item: 15 },
    },
    // §32.15 Yields. goods: [good, min, max, weight]. "Rum (sealed casks)"
    // is read as Plantation rum and porcelain as Ming porcelain (DEFAULTS).
    YIELDS: {
      hull: { supplies: [1, 2], goods: [["Plantation rum", 1, 3, 1]], treasure: [2, 3], gold: [30, 60] },
      hold: { supplies: [2, 3], goods: [["Plantation rum", 2, 4, 50], ["Ming porcelain", 1, 3, 50]], treasure: [2, 4], gold: [40, 80] },
      cabin_brig: { goods: [["Ming porcelain", 2, 3, 80], ["Ambergris", 1, 2, 20]], treasure: [3, 5], gold: [75, 150], rare: 1 / 5 },
      cabin_frigate: { goods: [["Ming porcelain", 2, 3, 60], ["Silver bars", 1, 2, 30], ["Pearls", 1, 2, 10]], treasure: [4, 6], gold: [100, 200], rare: 1 / 3 },
    },
    // Salvage-safe items (§32.15). DEFAULT: the catalog doesn't tier the
    // Ivory Compass or the Obsidian Amulet, so they stand in as the Rares.
    ITEMS: {
      uncommon: ["Shark-Tooth Necklace", "Tin Whistle", "Silver Pocket Watch", "Fancy Spyglass", "Navigator's Octant"],
      rare: ["Ivory Compass", "Obsidian Amulet"],
    },
    // Rough worth, only to pick the better half of a haul on a blackout.
    WORTH: { treasureUnit: 70, provisions: 30, uncommon: 500, rare: 2500 },

    sites: {
      ocracoke: { name: "Lilyhook's Graveyard", cryptid: "the giant shark", relic: "Giant Tooth", legend: ["legend_giant_shark"] },
    },

    // The *Miranda* (A Dying Pirate's Wish, §18.2): a brig, her Hull at DR 1,
    // the mermaid seeded first in her Hull, only Snag and Current.
    miranda: {
      id: "miranda", type: "brig", name: "the Miranda",
      zoneDr: { hull: 1 },
      hazards: { snag: 35, current: 30 },
      quest: { zone: "hull", item: "carved ivory mermaid" },
      flavor: "A brig sits upright on the bottom, in relatively good condition compared to the other wrecks, save for the gaping holes in her hull.",
    },

    // Ollie's greeting at the Graveyard, by how he feels about the captain
    // (S17 appendix §6; moved out of the screen code in UI pass 1, §41.10).
    greetings: { "-1": "\"I hope you're a strong swimmer.\"", "0": "\"Back for another dive?\"", "1": "\"I dreamed that you're in for a good haul today.\"", "2": "\"I dreamed that you're in for a good haul today.\"", "3": "\"The treasure-seeker returns!\"" },

    lines: {
      goingUnder: "You take a deep breath and plunge into the depths below.",
      grab: { clean: "You manage to grab it and tuck it under your arm.", partial: "It takes some effort, but you manage to work it loose.", setback: "You expend a lot of energy trying to claw it free, but it doesn't budge." },
      scout: "You take a moment to peer through the gloom.",
      surface: "You break the surface, gasping for air.",
      blackout: "Your vision grows black. You wake on the beach, coughing up seawater, with only half of what you grabbed.",
      snag: "Your shirt catches on a splintered plank, and it takes precious seconds to tear yourself free.",
      current: "A fast current rolls through the wreck and pushes you out. Getting back in there won't be easy.",
      shark: { draw: "A grey shadow glides past the wreck.", clean: "You press yourself flat against the hull until it swims lazily away.",
        partial: "You hide for what seems like ages, holding your breath to its limit, until it goes away.",
        setback: "It rushes at you and opens its jaws, then the world goes dark. When you come to, Ollie is dragging you up the beach as your blood mixes with the seawater." },
      // The giant shark's own lines belong with the cryptid scenes (§35); the
      // dive uses Ollie's "Shark seen" line and the relic line until then.
      cryptid: { draw: "A chill runs up your spine. You're not alone here. You look down and watch a massive shadow passing underneath.",
        clean: "PLACEHOLDER (cryptid scene, §35): the shadow passes.", partial: "PLACEHOLDER (cryptid scene, §35): you hold still until it's gone.",
        setback: "PLACEHOLDER (cryptid scene, §35): the shadow blots out the wreck, and the world goes dark.",
        relic: "You dive to the bottom in the creature's wake, and pick up what fell to the sea floor." },
      junkPrefix: "You surface with ",
      offered: "You spot a few ripe pickings.",
      frigate: "One of them is larger than the rest.",
      quick: "You gather what you can find and return to the beach.",
      goodHaul: "You spot something valuable.",
      poorHaul: "Slim pickings this time.",
      already: "The wrecks are picked clean. Come back later.",
      mermaidMissed: "You surface without finding the mermaid. You'll need to try again if you want to get paid.",
      mermaid: "PLACEHOLDER (dive beat): your fingers close around something small and smooth in the sand. The ivory mermaid.",
    },
    flavor: {
      sloop: ["A small, sleek hull lies on her side in the shallows, her mast snapped clean off.", "The bow of a half-buried sloop rises out of the sand."],
      brig: ["Two broken masts break the surface, leading down to a shattered brig.", "The two broken halves of a brig lie sideways at the bottom."],
      frigate: ["The remnants of a heavy frigate lie broken at the bottom of the sea, with only murky darkness behind her gunports.", "A large warship lies submerged at the bottom of the shallows, half-buried in the sand."],
    },
    // Lines 16-30 are still to write (pinned, §13.2).
    junk: ["a barnacled boot, still laced", "a cannonball, very heavy, entirely worthless", "a tin cup with a hole in the bottom",
      "a lid from a barrel, stamped with a big letter A", "a chunk of decades-old hardtack, probably still edible",
      "an empty glass bottle, stained green", "half a compass, without a needle", "an algae-filled clay pipe", "a pewter candlestick",
      "a piece of rotted pulp that used to be a book", "a handful of buttons", "a doll's head that stares at you coldly",
      "a tangled net", "a single smooth rock", "a crude wooden sign that says \"No Lollygagging\""],
  };

  // ---- Under the Table (§18.4) -------------------------------------------------
  var drinking = {
    WITS: 6,
    DR_CAP: 5,
    TOLERANCE: { Pirate: [3, 6], Sailor: [3, 5], Dockhand: [2, 4], "Colonial Officer": [2, 4] },
    TAB: { "Very poor": 10, "Poor": 20, "Modest": 40, "Wealthy": 80 },
    MISHAPS: { wrongPipe: 40, spins: 30, brawl: 20, bottle: 10 },
    BRAWL_CHECK: { type: "Brawling", dr: 2 },
    BOTTLE_CHECK: { type: "Ghost Sense", dr: 3 },
    SIZE_CHECK: { type: "Read People", dr: 2 },
    MOCK_CHECK: { type: "Tavern Talk", dr: 2 },
    LEAN_CHECK: { type: "Intimidate", dr: 2 },
    HANGOVER_AT: 2,           // a win or a called night at 2 Wits or less rolls
    ITEM_CHANCE: 0.10,
    ONE_MORE_AT: 2,           // Heavy Drinker's "One more round" needs 2+ Wits after a win
    DRUNKARD_AFTER: 3,        // the ratchet (§5.8)
    // The rumor a win pays, by the opponent's role (§30.4; Ocracoke's
    // Pirate is in the Tuning Table).
    RUMORS: { Pirate: { "Danger": 85, "Prize": 15 }, Sailor: { "World State": 100 }, Dockhand: { "Merchant": 100 }, "Colonial Officer": { "Danger": 100 } },
    ITEMS: {
      Pirate: { uncommon: ["Hip Flask", "Shark-Tooth Necklace", "Loaded Dice"], rare: ["Velvet Buccaneer Coat"] },
    },
    // Ocracoke's drinker pool (§17.2): a Pirate with one of six traits.
    pools: { ocracoke: { role: "Pirate", traits: ["Hard Drinker", "Hot-Tempered", "Proud", "Superstitious", "Old Sea Dog", "Jovial"] } },

    // The opponent's trait (§18.4.5). Lines marked insult show the
    // Hot-Tempered flaw's "Throw your drink in his face" (§18.4.7; which
    // lines count as insults is a DEFAULT).
    traits: {
      "Hard Drinker": { drinkDr: 1, hint: "red-faced and big-bellied.",
        steady: { line: "He drains it and wipes his mouth. \"Too easy.\"", insult: true }, wobbling: "He drinks a bit slower this time, but still downs it in one gulp.", doneFor: "He stares into his cup like he's been here before." },
      "Hot-Tempered": { tauntDr: -1, tauntSetbackBrawl: true, brawlWeight: 2, hint: "tapping his foot impatiently.",
        steady: "He slams his cup down on the table and whoops.", wobbling: { line: "\"You lookin' at me funny?\" You weren't.", insult: true }, doneFor: "He tries to take a swing at you, but misses and falls back into his chair." },
      "Proud": { leanDr: 1, strongOnce: true, hint: "his chin held high.",
        steady: { line: "\"You don't stand a chance at besting me.\"", insult: true }, wobbling: "He stares at the ceiling, swaying in place with perfect posture.", doneFor: "\"I am perfect. I've never been better. I'm always...\" He loses the end of his sentence." },
      "Superstitious": { bottleWeight: 2, hint: "tying and untying his shoelaces several times.",
        steady: "He throws a pinch of salt over his shoulder.", wobbling: "He keeps glancing over at the corner. There's nothing there.", doneFor: "\"Bad omens. Bad, bad omens.\"" },
      "Old Sea Dog": { tolerance: 1, hint: "his face as worn and leathery as a book cover.",
        steady: { line: "\"Been around a long time, and beaten better men than you.\"", lineF: "\"Been around a long time, and beaten better women than you.\"", insult: true },
        wobbling: "He starts telling a story about a drunken mermaid, but trails off.", doneFor: "He's humming a shanty from before you were born, eyes shut tight." },
      "Jovial": { mockDr: -1, hint: "brimming with excitement.",
        steady: "He clinks your cup before you've even lifted it. \"To new friends!\"", wobbling: "He's been giggling at his own joke for quite a while.", doneFor: "He tells you that he loves you. He tells you again, louder." },
      // Hooks for the other pools (§18.4.5); their lines come with their nodes.
      "Taciturn": { mockDr: 1 }, "Fearless": { leanDr: 1 }, "Cool-Headed": { leanDr: 1 }, "Timid": { leanDr: -1, tolerance: -1, quitsAtDoneFor: true },
      "Inscrutable": { sizeDr: 1 }, "Candid": { sizeDr: -1 }, "Reckless": { strongOnce: true }, "Wild": { strongOnce: true }, "Green": { tolerance: -1 },
    },

    lines: {
      setup: "A grizzled pirate drops onto the stool across from you, ",
      size: { clean: "You watch how he holds his cup and know exactly what you're dealing with.", partial: "You get a rough measure of him, but he's hard to pin down.",
        setback: { line: "He catches you staring. \"Sizing me up, eh? Let's start with the strong stuff, then.\"", insult: true } },
      mockClean: "\"I can outdrink ten of you, just watch.\" He downs one to prove he can.",
      leanClean: "You lean in close and don't blink. He breaks eye contact and drinks first.",
      tauntPartial: "He glares at you and waves for something stronger.",
      tauntSetback: { line: "He laughs in your face and slides the strong stuff across. \"Let's see if you can handle it.\"", insult: true },
      // DEFAULT: the Proud (Reckless, Wild) opponent's own call for the strong stuff.
      heCallsStrong: "He bangs the table and calls for the strong stuff.",
      wrongPipe: "It goes down the wrong way, and you spend the next few seconds coughing your lungs out.",
      spins: "The room starts to spin, and it's getting faster now.",
      brawl: { start: "He flips the table and drinks fly everywhere. \"Get over here!\"", clean: "When the dust settles, he's unconscious under the table and you're polishing off your drink.",
        partial: "You both get dusted off and pushed back onto your stools as the onlookers turn the table back upright.", setback: "The tavern keeper throws you both out the door face-first." },
      bottle: { start: "For a moment, a face stares up at you from the bottom of your cup.", clean: "You blink and it's gone.", partial: "You push the cup away, unsettled.",
        setback: "You don't remember falling off your stool. You only remember the face." },
      win: "He slides slowly off his stool and goes to sleep under the table as the room cheers.",
      draw: "You wake on the floor beside him. Nobody can agree on who went down first.",
      callIt: "You push your cup away and hang your head. He tells the tavern keeper that you'll be picking up the tab.",
      under: "The room goes black, and you fall straight backward. You wake to the tavern keeper standing above you, demanding you pay the tab.",
      oneMore: "A second competitor drops onto the warm stool. \"My turn.\"",
      hangover: "You wake with a bone-dry mouth and a headache that could kill an elephant.",
      timidQuits: "PLACEHOLDER (drinking line): he pushes his cup away and calls it a night.",
    },
  };

  // ---- Liar's Dice (§18.3) -------------------------------------------------------
  var dice = {
    DICE: 5,                  // each, the classic game (ruled November 14; §18.3 had 3 as the placeholder)
    GAMES_PER_SESSION: 5,
    STAKES: { "Very poor": [25, 50], "Poor": [25, 100], "Modest": [50, 150], "Wealthy": [50, 200] },
    SIZE_CHECK: { type: "Cards & Dice", dr: 3 },
    CHEAT_CHECK: { type: "Cards & Dice", dr: 3 },
    CAUGHT_STANDING: -5,      // with the node's faction; black Standing at Ocracoke (§18.3, §28.3)
    MARKS_TO_CATCH: 2,
    CARD_SHARP_AT: 500,       // DEFAULT: gross winnings at Liar's Dice (threshold OPEN, §18.3)
    // How the opponent plays, by trait (§18.3): call when the bid is less
    // likely than this; bold players raise past the minimum. Loosened a
    // touch with five dice (November 14), so he doesn't play the exact odds.
    PLAY: {
      base: { callBelow: 0.38 },
      "Reckless": { callBelow: 0.25, bold: true }, "Fearless": { callBelow: 0.25, bold: true }, "Proud": { callBelow: 0.25, bold: true },
      "Timid": { callBelow: 0.52 }, "Suspicious": { callBelow: 0.52 }, "Gullible": { callBelow: 0.12 },
      "Cool-Headed": { callBelow: 0.45 }, "Gambler": { callBelow: 0.38, chases: true, checkDr: -1 },
      "Inscrutable": { sizeDr: 1 }, "Candid": { sizeDr: -1 },
    },
    pools: { ocracoke: { role: "Dockhand/Laborer" } },
    lines: {
      sit: "A dockhand with tar under his nails rattles a cup at you. \"Let's play. No crying when you lose.\"",
      size: { clean: "He gulps hard whenever he's bluffing.", partial: "He's nervous about something. You're just not sure what.", setback: "He grins. \"I've got you right where I want you.\"" },
      tell: "He gulps hard.",
      vague: "He shifts in his seat.",
      cheat: { clean: "A quick glance under the edge of his cup, and he's none the wiser.", partial: "You sneak a quick peek, but he narrows his eyes and pulls the cup closer." },
      caught: "He slams his hand on the table. \"Cheater!\" he cries, and the whole tavern hears it.",
      win: "He groans and pushes the coins across.",
      lose: "He sweeps up the coins with a grin. \"I'd love to take more of your coin. Another?\"",
      broke: "\"Come back when you've got more gold.\"",
    },
  };

  PC.data.minigames = { salvage: salvage, drinking: drinking, dice: dice };
})();
