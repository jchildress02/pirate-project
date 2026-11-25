/* The prize hunt's numbers (§21, §22) and its placeholder lines.
 *
 * Every number here is a placeholder the playtests will tune (the Tuning
 * Table lists them). Lines marked PLACEHOLDER are Claude's, for the author
 * to rewrite or keep (Milestone 5 plan, §1). js/hunt_gen.js, js/combat.js
 * and js/hunt.js read this file; nothing here rolls dice.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  // §21.2: the 15 classes. [role, size, hull, guns max, crew min, crew max,
  // cargo, speed, handling, draft]
  var CLASS_ROWS = {
    "Cutter": ["Raider", 1, 15, 6, 4, 20, 40, 4, 4, "Shallow"],
    "Sloop": ["Raider", 1, 20, 10, 5, 30, 50, 3, 4, "Shallow"],
    "Schooner": ["Raider", 1, 25, 12, 6, 35, 80, 4, 3, "Shallow"],
    "Royal Sloop": ["War", 2, 35, 16, 8, 45, 70, 3, 3, "Medium"],
    "Brigantine": ["Hybrid", 2, 40, 14, 10, 50, 150, 3, 3, "Medium"],
    "Barque": ["Trade", 2, 45, 10, 8, 40, 250, 2, 2, "Medium"],
    "Brig": ["Hybrid", 2, 50, 18, 12, 60, 180, 3, 2, "Medium"],
    "Merchantman": ["Trade", 3, 70, 16, 12, 60, 450, 2, 1, "Deep"],
    "Frigate": ["War", 3, 110, 36, 25, 120, 300, 3, 2, "Deep"],
    "Galleon": ["War", 4, 150, 50, 30, 150, 750, 1, 0, "Deep"],
    "West Indiaman": ["Trade", 4, 120, 30, 20, 110, 1000, 1, 1, "Deep"],
    "4th Rate": ["War", 4, 170, 56, 40, 160, 450, 2, 1, "Deep"],
    "3rd Rate": ["War", 5, 220, 74, 55, 200, 550, 2, 1, "Deep"],
    "2nd Rate": ["War", 5, 270, 90, 70, 230, 650, 1, 0, "Deep"],
    "1st Rate": ["War", 5, 320, 100, 80, 250, 700, 1, 0, "Deep"],
  };
  var CLASSES = {};
  Object.keys(CLASS_ROWS).forEach(function (k) {
    var r = CLASS_ROWS[k];
    CLASSES[k] = { id: k, role: r[0], size: r[1], hull: r[2], guns: r[3], crewMin: r[4], crewMax: r[5], cargo: r[6], speed: r[7], handling: r[8], draft: r[9] };
  });

  PC.data.hunt = {
    CLASSES: CLASSES,

    // §22.7: hull value = 150 × full BR + 10 × cargo − 100 × max guns.
    HULL_VALUE: {
      "Cutter": 1750, "Sloop": 2500, "Schooner": 3200, "Royal Sloop": 3900, "Brigantine": 4900, "Barque": 5550, "Brig": 6000,
      "Merchantman": 9200, "Frigate": 11700, "4th Rate": 17200, "West Indiaman": 18400, "Galleon": 19000, "3rd Rate": 21800,
      "2nd Rate": 26000, "1st Rate": 29100,
    },
    HULL_SALE: { clean: 0.15, dirty: 0.08 }, // §22.7; Ocracoke's yard is no-control, so it buys both
    LOOSE_GUN_SALE: 0.30,

    // ---- The hunt loop (§22.2) ----
    ROLLS_PER_BATCH: 3,
    MAX_AP: 3,
    // The prototype hunts Ocracoke's waters: the Hatteras Banks (§37.3).
    HOME_WATERS: { ocracoke: "north" },

    // ---- Step 1: pirate hunters (§22.5) ----
    HEAT_CURVE: [[20, 0], [40, 0.02], [50, 0.04], [60, 0.08], [70, 0.12], [80, 0.18], [90, 0.28], [101, 0.40]],
    AVALON_HUNTER_PER_ADMIRALTY_PORT: 0.02,
    FRISIAN_HUNTER_POSTURE: { Hunter: 2, Opportunist: 1, Distracted: 0.5 },
    FRISIAN_HUNTER_NORTH: 0.5,
    GRUDGE: { Sicily: { per: 2, chance: 0.03, cap: 0.30 }, France: { per: 1, spain: 0.5, chance: 0.02, cap: 0.20 } },
    HUNTERS: {
      Avalon: { types: { "Royal Sloop": 45, "Frigate": 30, "Brig": 25 }, rating: 3, gunnery: 2 },
      Frisia: { types: { "Frigate": 45, "Royal Sloop": 35, "Brigantine": 20 }, rating: 3, gunnery: 2 },
      Sicily: { types: { "Frigate": 70, "Brig": 30 }, rating: 4, gunnery: 3, pair: 0.30 },
      France: { types: { "Brigantine": 40, "Brig": 30, "Frigate": 30 }, rating: 3, gunnery: 2 },
    },

    // ---- Step 2: density ----
    DENSITY: { base: 75, min: 45, max: 90, season: { Spring: 10, Summer: 5, Hurricane: -15, Winter: -10 } },

    // ---- Step 3: shape (Trade only; pirates never) ----
    SHAPE: { 1: { convoy: 0.03, escort: 0.03 }, 2: { convoy: 0.04, escort: 0.05 }, 3: { convoy: 0.05, escort: 0.07 }, springBonus: 0.03 },

    // ---- Step 4: flag weights (§22.5) ----
    WATERS: {
      north: { name: "the Hatteras Banks", ports: [
        { id: "norfolk", faction: "Avalon", admiralty: true }, { id: "edenton", faction: "Avalon" },
        { id: "wilmington", faction: "Avalon" }, { id: "ocracoke", faction: "pirate haven" } ],
        france: 20, spain: 10, swedenExtra: 5, irelandExtra: 0 },
      south: { name: "the Bahama Channel", ports: [
        { id: "charleston", faction: "Avalon" }, { id: "beaufort", faction: "Avalon" }, { id: "savannah", faction: "Avalon" },
        { id: "staugustine", faction: "Frisia" }, { id: "nassau", faction: "Frisia" } ],
        france: 30, spain: 13, swedenExtra: 0, irelandExtra: 10 },
    },
    PORT_WEIGHT: { "Avalon": 20, "Frisia": 20, "pirate haven": 12, "pirate port": 20 },
    BASE_FLAGS: { Avalon: 10, Frisia: 10, Sicily: 1 },
    ALLY_SHARE: { Ireland: ["Frisia", 0.2], Burgundy: ["Avalon", 0.1], Sweden: ["Avalon", 0.1] },
    FRISIA_POSTURE: { Distracted: 0.75, Opportunist: 1, Hunter: 1.25 },

    // ---- Step 5: role by flag [Trade, Hybrid, War, Raider] ----
    // Avalon and France changed by the build 0.9 playtest pins (P5).
    // Each Admiralty-held port in the waters moves 5 Avalon points Trade →
    // War (ruled: P5, confirmed November 24 in the M9 chat), so the north,
    // with Norfolk its one Admiralty port, reads 55/20/25 at low Heat.
    // Avalon Heat moves 10 more at Wanted (40+) and 10 more at Hunted (70+):
    // 45/20/35 at Wanted, 35/20/45 at Hunted.
    ADMIRALTY_ROLE_SHIFT: 5,
    // Flags on enemy ships (P6 of the build 0.9 playtest pins): a swatch
    // color and the word for the nation, always shown together (§41.1).
    // PROPOSED colors, for the author's approval.
    FLAG_LOOK: {
      Avalon: { color: "#8a6414", adj: "Avalon" }, Frisia: { color: "#a14c17", adj: "Frisian" },
      France: { color: "#24407a", adj: "French" }, Spain: { color: "#9c1f24", adj: "Spanish" },
      Ireland: { color: "#2f6b3a", adj: "Irish" }, Sicily: { color: "#5e2f6e", adj: "Sicilian" },
      Burgundy: { color: "#6e1f33", adj: "Burgundian" }, Sweden: { color: "#4f86b0", adj: "Swedish" },
      Pirate: { color: "#1c1a18", adj: "Pirate" },
    },
    // The role in plain words, after the nation: "Avalon navy", "Frisian merchant".
    ROLE_WORD: { War: "navy", Trade: "merchant", Hybrid: "armed trader", Raider: "raider" },
    // A prize's food (P2): her crew aboard ÷ per × lo-hi lots, rolled.
    PRIZE_FOOD: { per: 5, lo: 2, hi: 4 },
    AVALON_HEAT_ROLE: [[40, 10], [70, 10]],
    ROLE: {
      Avalon: [60, 20, 20, 0], Frisia: [60, 20, 20, 0], Ireland: [40, 30, 30, 0], Spain: [60, 25, 15, 0],
      Sweden: [50, 30, 20, 0], Burgundy: [85, 10, 5, 0], Sicily: [100, 0, 0, 0], France: [45, 30, 25, 0], Pirate: [0, 30, 0, 70],
    },

    // ---- Step 6: type by role ----
    TYPES: {
      Raider: { "Cutter": 30, "Sloop": 45, "Schooner": 25 },
      Hybrid: { "Brigantine": 50, "Brig": 50 },
      Trade: {
        1: { "Sloop": 20, "Schooner": 10, "Barque": 30, "Merchantman": 30, "West Indiaman": 7, "Galleon": 3 },
        2: { "Sloop": 15, "Schooner": 10, "Barque": 30, "Merchantman": 32, "West Indiaman": 9, "Galleon": 4 },
        3: { "Sloop": 10, "Schooner": 10, "Barque": 27, "Merchantman": 35, "West Indiaman": 12, "Galleon": 6 },
      },
      War: { "Royal Sloop": 55, "Frigate": 42, "4th Rate": 2.5, "3rd Rate": 0.5 }, // Era 1
    },

    // ---- Step 7: fit-out [guns lo, hi], crew, hull ----
    FITOUT: {
      Trade: { guns: [0.3, 0.6], crew: "minToDouble", hull: [1, 1] },
      Hybrid: { guns: [0.6, 0.9], crew: [0.5, 0.8], hull: [0.9, 1] },
      War: { guns: [0.9, 1], crew: [0.8, 1], hull: [1, 1] },
      Raider: { guns: [0.7, 1], crew: [0.7, 1], hull: [0.8, 1] },
    },
    RATING: { Trade: 2, Hybrid: 3, Raider: 3, War: 3 },
    GUNNERY: { Trade: 0, Hybrid: 1, Raider: 1, War: 2 },
    RESOLVE: { Trade: [1, 2], Hybrid: [2, 3], War: [3, 4], Raider: [3, 3] },

    // ---- The loot calculator (§22.6) ----
    LEVELS: ["Poor", "Modest", "Good", "Rich", "Superior"],
    LEVEL_BASE: { War: 0, Raider: "0or1", Hybrid: 1, Trade: 2 },
    FILL: {
      1: [[0.03, 0.07], [0.07, 0.14], [0.14, 0.21], [0.21, 0.32], [0.32, 0.42]],
      2: [[0.04, 0.085], [0.085, 0.17], [0.17, 0.255], [0.255, 0.38], [0.38, 0.51]],
      3: [[0.05, 0.10], [0.10, 0.20], [0.20, 0.30], [0.30, 0.45], [0.45, 0.60]],
    },
    // Shares of the filled slots: [provisions, bulk, fine, treasure]
    COMP: { Trade: { 1: [10, 77.5, 10, 2.5], 2: [10, 75, 12, 3], 3: [10, 72, 14, 4] }, Hybrid: [20, 61.5, 12, 6.5], War: [50, 37.5, 5, 7.5], Raider: [20, 42.5, 20, 17.5] },
    FINE_MULT: { Burgundy: 2, Sicily: 3 },
    CHEST_BASE: 30, CHEST_MULT: [0.5, 1, 2, 4, 8],
    CAPTIVES: { Trade: 0.10, Hybrid: 0.08, War: 0.05, Raider: 0.20 },
    HIDDEN_ITEM: [0, 0.01, 0.03, 0.06, 0.10], HIDDEN_ITEM_SICILY: 0.05,
    // Which goods each flag carries (§22.6 step 3). A flag with no precious
    // list keeps that share as treasure.
    GOODS: {
      Avalon: { bulk: ["Rice", "Tobacco", "Indigo", "Cotton", "Furs and hides", "Kill-devil rum", "Scottish broadcloth"], fine: ["Scotch whisky", "Ming tea", "Bengali muslin and calico"], precious: [] },
      Frisia: { bulk: ["Sugar", "Molasses", "Rice", "Cotton", "Plantation rum", "Mahogany and logwood", "Cocoa", "Coffee", "Frisian genever"], fine: ["Frisian linen and lace", "Pepper", "Cinnamon", "Tortoiseshell", "Ming porcelain"], precious: ["Pearls", "Gold dust", "Emeralds"] },
      France: { bulk: ["Rice", "Sugar", "Molasses", "Cotton", "Tobacco", "Cocoa", "Indigo", "Furs and hides", "Mahogany and logwood"], fine: ["French wine", "French brandy", "Cochineal", "Vanilla"], precious: ["Silver bars"] },
      Spain: { bulk: ["Sugar", "Tobacco", "Furs and hides", "Cotton"], fine: ["Cochineal"], precious: ["Silver bars"] },
      Burgundy: { bulk: ["Scottish broadcloth"], fine: ["Burgundian velvet and brocade", "Frisian linen and lace", "Bengali muslin and calico", "Ming silk"], precious: [] },
      Sicily: { bulk: ["Coffee"], fine: ["Ming silk", "Ming porcelain", "Ming lacquerware", "Ming tea", "Bengali muslin and calico", "Pepper", "Abyssinian ivory"], precious: ["Bengali gems"] },
      Sweden: { bulk: ["Furs and hides"], fine: ["Coffee", "Pepper"], precious: [] },
      Ireland: { bulk: ["Frisian genever", "Sugar"], fine: ["Frisian linen and lace"], precious: [] },
      Pirate: { bulk: ["Rice", "Sugar", "Tobacco", "Kill-devil rum", "Cotton", "Furs and hides", "Cocoa"], fine: ["French brandy", "Pepper", "Frisian linen and lace", "Cinnamon", "Ming silk"], precious: ["Pearls", "Silver bars"] },
    },
    // Precious only at Superior in the Slice's Year 1 (from Year 2 at Rich too).

    // ---- Combat (§21.3-§21.13) ----
    CA_BANDS: [[3, 3], [2, 2], [1.35, 1], [0.75, 0], [0.5, -1], [0.33, -2], [0.2, -3]], // else -4
    CA_NAMES: { "3": "Overwhelming", "2": "Strongly favorable", "1": "Favorable", "0": "Even", "-1": "Unfavorable", "-2": "Outgunned", "-3": "Overmatched", "-4": "Hopeless" },
    FLEE_TABLE: { "2": 0.80, "1": 0.60, "0": 0.35, "-1": 0.15, "-2": 0.05 },
    FLEE_CA_BONUS: { "2": 0.15, "3": 0.25 },
    HEAVY: 0.5, LIGHT: 0.25,
    SHOT_MULT: { round: 1, chain: 0.5, grape: 0.25, rigging: 0.5, rudder: 0.5 },
    CREW_HIT: { heavy: 0.04, light: 0.02 },
    // Balance-check knobs (Milestone 6; P12b, P13). The defaults keep the
    // rules as built; tools/hunt_sim.js tries the proposals before a ruling.
    BR_HULL_DIV: 10,          // Battle Rating counts hull ÷ this (N1, §21.3; built at 5)
    GRAPE_MULT: 2,            // grapeshot multiplies crew losses (P13a proposes 4)
    GRAPE_BY_GUNS: { heavy: 1 / 3, light: 1 / 6 }, // N2 (§21.11): grapeshot kills 1 man per 3 manned guns on a heavy hit, 1 per 6 on a light one
    PORCELAIN_BREAK: 0.10,
    CREW_LINE: 0.25,
    FATE: [[1, "sunk"], [0.75, 0.5], [0.5, 0.25]],
    FLAGSHIP_FATE_FROM: 0.75,
    TAKE_PRIZES_CAPTURE: 0.8,   // DEFAULT: "mostly captured" under Take Prizes
    SINK_THEM_CAPTURE: 0.2,     // DEFAULT: "mostly sunk" under Sink Them
    SHOT_WEIGHTS: {
      Trade: { round: 25, chain: 70, grape: 5 }, Hybrid: { round: 50, chain: 30, grape: 20 },
      War: { round: 70, chain: 15, grape: 15 }, Pirate: { round: 15, chain: 25, grape: 60 },
      boarding: { round: 15, chain: 15, grape: 70 },
    },
    SUPPORT: { brShare: 0.25, perkCap: 2, maxSupporters: 2, supportCaptain: { 1: 0, 2: 1, 3: 1, 4: 2 } },

    // Boarding losses by Crew Advantage (Milestone 5 planning, §1): the
    // winner's band sets the loser's loss on a clean clash.
    BOARD_LOSS: { "-4": [0.15, 1], "-3": [0.15, 1], "-2": [0.15, 1], "-1": [0.15, 1], "0": [0.15, 1], "1": [0.20, 2], "2": [0.30, 4], "3": [0.40, 6] },
    CLASH_PARTIAL_BIG: 0.04, CLASH_SETBACK: 0.08,
    // Shaken (Milestone 5 planning, §1): −1 Resolve a step, the whole
    // battle, at most 3; one more step at half the crew lost.
    SHAKEN_CAP: 3, SHAKEN_STRIKE_PCT: 0.10,
    LEADERLESS: 2,
    REPAIR_AT_SEA: { clean: 0.25, partial: 0.10 },
    VOLUNTEERS: { Trade: [3, "Green"], Hybrid: [4, "Able"], Pirate: [6, "Seasoned"] },
    PRIZE_MORALE: { small: 5, big: 10, cap: 10 },
    FLEE_MORALE: -15,
    PRIZE_SHIP_CAP: 3,
    PRIZE_TAKER_AT: 5, DUELIST_AT: 3,
    EXECUTE_DREAD: 3,
    // Standing and Heat per prize (§28.3, §28.6), as the simulator: [Heat, Standing]
    UNCOVERED: { "own merchant": [6, -2], "own navy": [12, -10], "ally merchant": [2, -1], "ally navy": [2, -1] },
    HUNTER_TAKEN_HEAT: 10,
    SIDES: { Avalon: { Avalon: "own", Burgundy: "ally", Sweden: "ally" }, Frisia: { Frisia: "own", Ireland: "ally" } },
    CAPTIVE_REWARD: 20, // DEFAULT: crew gold a head, freed at a free port (§20.9 gives no figure)
    // Rally, Hold the Deck: no DR in the docs; DEFAULT: the enemy captain's rating.
  };

  // ---- Placeholder lines (PLACEHOLDER: Claude's, for the author) ----------
  PC.data.huntLines = {
    // The battle with a pirate opens on her black flag (P6; PH32 for the author).
    blackFlag: "PLACEHOLDER: She runs up the black flag.",
    setOut: "PLACEHOLDER: You weigh anchor and stand out past the bar into the Hatteras Banks, every eye on the horizon.",
    empty: [
      "PLACEHOLDER: Nothing but grey water and a gull or two.",
      "PLACEHOLDER: The lookout calls a sail, then takes it back. Just a whitecap.",
      "PLACEHOLDER: An empty horizon. The hands mutter and go back to their work.",
    ],
    sail: "PLACEHOLDER: \"Sail ho!\" The lookout points off the bow.",
    hunter: "PLACEHOLDER: She's already coming about to meet you. A hunter, and she's seen you.",
    // The lookout's cue about the captain and crew (§22.3): by Resolve.
    cue: {
      1: ["PLACEHOLDER: the master keeps glancing at your gunports. He looks nervous.", "PLACEHOLDER: hands are already looking at the boats."],
      2: ["PLACEHOLDER: steady enough, going about their business.", "PLACEHOLDER: a few men at the rail, watching you closely."],
      3: ["PLACEHOLDER: guns run out, crew at quarters.", "PLACEHOLDER: she holds her course like she means it."],
      4: ["PLACEHOLDER: a disciplined crew, and an officer pacing the quarterdeck.", "PLACEHOLDER: drums beating to quarters across the water."],
      5: ["PLACEHOLDER: every gun run out and every man at his station. She's spoiling for it.", "PLACEHOLDER: a hard crew under a hard captain."],
    },
    hull: { sound: "sound", damaged: "damaged", low: "low in the water" },
    struckPre: "PLACEHOLDER: Her colors come fluttering down before a shot is fired.",
    noStrike: "PLACEHOLDER: She holds her colors.",
    wavers: "PLACEHOLDER: Her colors dip, then go back up. Her crew is wavering.",
    runs: "PLACEHOLDER: She crowds on sail and runs.",
    stays: "PLACEHOLDER: She makes no move to run.",
    caught: { clean: "PLACEHOLDER: You run her down and take the weather gauge.", partial: "PLACEHOLDER: You run her down, but she keeps the wind.", setback: "PLACEHOLDER: She outruns you. The gap opens and she's gone." },
    fled: { clean: "PLACEHOLDER: You crowd on sail and leave her behind.", partial: "PLACEHOLDER: You get away, but not before she rakes your stern.", setback: "PLACEHOLDER: She runs you down. There's no escaping this fight." },
    pressed: "PLACEHOLDER: You keep after her, giving up time you could spend searching.",
    position: { clean: "PLACEHOLDER: You take the wind and come about across her bow.", partial: "PLACEHOLDER: You edge into a decent firing position.", setback: "PLACEHOLDER: She outmaneuvers you and you take the worse angle." },
    exchange: { clean: "PLACEHOLDER: Your broadside tears into her and she answers with nothing worth the name.", partial: "PLACEHOLDER: The two ships trade broadsides, both taking hits.", setback: "PLACEHOLDER: Her broadside slams into you before your guns can bear." },
    theirShot: { round: "they're firing round shot", chain: "they're loading chain!", grape: "they're loading grape!" },
    disarmed: "PLACEHOLDER: Her last gun falls silent.",
    struck: "PLACEHOLDER: Her colors come down. She's yours.",
    crewBroken: "PLACEHOLDER: Her crew throws down their arms. She's yours.",
    knockedOut: { captured: "PLACEHOLDER: She's a wreck, wallowing and helpless. Her colors come down.", sunk: "PLACEHOLDER: She rolls over and goes down, taking her cargo with her." },
    enemyBoards: "PLACEHOLDER: She swings alongside and grapples! They're coming over the rail.",
    grapple: { clean: "PLACEHOLDER: The grapples bite and your crew pours over her rail.", partial: "PLACEHOLDER: You get across, but she sweeps your deck with a parting volley.", setback: "PLACEHOLDER: They cut your grapples and the ships drift apart." },
    repel: { clean: "PLACEHOLDER: You cut her grapples and give her a parting volley as she sheers off.", partial: "PLACEHOLDER: They make it aboard, but your gunners take a few with them.", setback: "PLACEHOLDER: They're over the rail before your guns can bear." },
    clash: { clean: "PLACEHOLDER: Your crew drives them back across their own deck.", partial: "PLACEHOLDER: The fighting surges back and forth; both sides lose men.", setback: "PLACEHOLDER: They push your crew back to the rail." },
    fallBack: "PLACEHOLDER: Both crews fall back to their own decks, and the grapples are cut.",
    repelled: "PLACEHOLDER: Your boarding party is thrown back.",
    overrun: "PLACEHOLDER: They've taken your deck.",
    lead: { clean: "PLACEHOLDER: You lead the charge and the men follow you like madmen.", partial: "PLACEHOLDER: You lead the charge and carve out a foothold.", setback: "PLACEHOLDER: A blade finds you as you lead the charge." },
    rally: { clean: "PLACEHOLDER: Your crew roars back at you.", partial: "PLACEHOLDER: The men steady at your shout.", setback: "PLACEHOLDER: Your shout is lost in the din." },
    hold: { clean: "PLACEHOLDER: Your crew locks shoulders and holds.", partial: "PLACEHOLDER: Your crew gives ground slowly.", setback: "PLACEHOLDER: The line buckles." },
    duel: { clean: "PLACEHOLDER: You beat their captain to his knees. His crew sees it.", partial: "PLACEHOLDER: You trade cuts with their captain until the melee pulls you apart.", setback: "PLACEHOLDER: Their captain's blade opens your arm, and his crew cheers." },
    // The Quartermaster's vote (§25.9, §25.15): the result is the S25 appendix's text.
    votePre: "PLACEHOLDER: The crew want a Quartermaster of their own choosing. They'll vote before the day is out.",
    voteResult: "The crew gathers to elect a new Quartermaster. After deliberating for some time, they select [Officer] to represent their interests.",
    demand: { clean: "PLACEHOLDER: \"Throw down your arms!\" They do. Her colors come down, and she's yours.", partial: "PLACEHOLDER: \"Throw down your arms!\" Some of them hesitate.", setback: "PLACEHOLDER: \"Throw down your arms!\" They laugh at you." },
    // #27 of the build 0.9 pins: the line names the weapon ({weapon}: the captain's best gun, lowercase).
    shot: { clean: "PLACEHOLDER: You fire your {weapon} and a man drops.", partial: "PLACEHOLDER: You fire your {weapon}, but the shot goes wide.", setback: "PLACEHOLDER: You fire your {weapon}, but it misfires." },
    // #31: the win, unmistakable. A banner across the result when she strikes or is taken.
    winBanner: { struck: "She strikes her colors!", captured: "She's yours!" },
    strikeFirst: { clean: "You strike first: +1 on the first clash.", partial: "Neither side gets the jump.", setback: "They strike first: +1 to them on the first clash." },
    flee: "PLACEHOLDER: You break off and run.",
    youStrike: "PLACEHOLDER: You haul down your colors.",
    lost: "PLACEHOLDER: Your flagship is taken.",
    sinking: "PLACEHOLDER: Your flagship is going down.",
    repair: { clean: "PLACEHOLDER: The crew patches her up well.", partial: "PLACEHOLDER: You stop the worst of the leaks.", setback: "PLACEHOLDER: The patches won't hold. She'll need a yard." },
    treat: { clean: "PLACEHOLDER: The cook stitches you up properly. You'll live.", partial: "PLACEHOLDER: The cook does what he can. It'll hold until port.", setback: "PLACEHOLDER: The cook shakes his head. You'll need a real surgeon." },
    backgroundYou: "PLACEHOLDER: Your {ship} rakes the {enemy}.",
    backgroundBoth: "PLACEHOLDER: Your {ship} and the {enemy} trade broadsides.",
    backgroundThem: "PLACEHOLDER: The {enemy} hammers your {ship}.",
    home: "PLACEHOLDER: You bring her back across the bar into Ocracoke.",
    gameOver: {
      captured: "PLACEHOLDER: Irons, a dark hold and a long voyage to a gallows or a prison hulk. Your story ends here, for now.",
      died: "PLACEHOLDER: The sea closes over you. Your story ends here.",
      // Milestone 7: the Norfolk cells (until §43, Milestone 8) and the sea (§44.7).
      jailed: "PLACEHOLDER: The cell door slams shut behind you. Imprisonment comes with Milestone 8; until then, your story ends here.",
      drowned: "PLACEHOLDER: The sea takes your ship, and then it takes you. Your story ends here.",
      // Milestone 8, PR 6 (§43): the gallows and retiring (D4d: the end screen until inheritance).
      hanged: "PLACEHOLDER: The crowd falls silent as the trapdoor opens. Your story ends here.",
      retired: "PLACEHOLDER: You hang up your cutlass. Your story ends here.",
      shipwrecked: "PLACEHOLDER: You wash ashore with nothing but the clothes on your back. A captain with no ship comes in a later milestone; for now, your story ends here.",
    },
    // The Quartermaster's advice (§24.14): {qm} is his first name.
    advice: {
      warship: "PLACEHOLDER: \"That's a warship, Captain. At these odds she'll tear us apart. Let her go.\"",
      good: "PLACEHOLDER: \"She's a fat one and she's no match for us. I say we take her.\"",
      even: "PLACEHOLDER: \"It'd be a fair fight. Your call, Captain.\"",
      bad: "PLACEHOLDER: \"She's more than a match for us, Captain. I'd think hard before taking her on.\"",
      // P12a: the bad-odds line names what puts her ahead (Battle Rating's
      // guns, hull or crew).
      badBy: {
        guns: "PLACEHOLDER: \"She outguns us, Captain. I'd think hard before taking her on.\"",
        hull: "PLACEHOLDER: \"She's built stout, Captain. Our guns will take a long while to hurt her. I'd think hard before taking her on.\"",
        crew: "PLACEHOLDER: \"She's got more hands than we do, Captain. I'd think hard before taking her on.\"",
      },
      hunter: "PLACEHOLDER: \"She's here for us, Captain. Fight or run, but decide quick.\"",
      board: "PLACEHOLDER: \"We've the numbers for it. Get us alongside and we'll take her deck.\"",
      fire: "PLACEHOLDER: \"Keep her at range and pound her. We don't have the men to board.\"",
      run: "PLACEHOLDER: \"We're taking a beating, Captain. It might be time to cut and run.\"",
      grape: "PLACEHOLDER: \"Grape'll thin her crew before we board.\"",
      chain: "PLACEHOLDER: \"Chain will slow her down if she tries to run.\"",
    },
  };
  // The end-of-prototype screen (§37.1; the M6 chat's R5). PLACEHOLDERs.
  PC.data.endLines = {
    title: "PLACEHOLDER: The end of the prototype",
    overTitle: "PLACEHOLDER: Your story ends here",
    note: "PLACEHOLDER: That's as far as the prototype goes. Thanks for playing. More of the Carolinas, and the seasons after Spring, come in later builds.",
    overNote: "PLACEHOLDER: This is the end of the run for the prototype. Imprisonment and heirs come in later builds.",
    nobody: "PLACEHOLDER: \"Nobody in Ocracoke is talking about you. Yet.\"",
  };
})();
