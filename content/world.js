/* The world map, the voyage table and the season loop's text (§4, §20.6,
 * §26.9-§26.10, §37.12).
 *
 * The map is a PLACEHOLDER drawn in code from the author's layout guide
 * (north to the left, the guide's arrow). Hotspots are data: x and y are
 * fractions of the 1800 × 1200 map, so the author's art drops in by
 * replacing the picture (mapArt) and nudging these numbers.
 *
 * Live places this build (§37.12, P1): Ocracoke, Norfolk, the Hatteras
 * Banks and the Bahama Channel. Everything else is Uncharted: drawn, not
 * sailable. Lilyhook's islet and the Hidden Haven are secret and not drawn.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.nodes = PC.data.nodes || {};

  // ---- The ocean nodes (§4): Hunt for Prizes only; no merchant, fee,
  // lodging or crew. Each is the seat of a weather zone (§42.2).
  PC.data.nodes.hatteras = {
    id: "hatteras", name: "the Hatteras Banks", title: "The Hatteras Banks", kind: "ocean", zone: "north", waters: "north",
    control: "Open water", faction: null,
    blurb: "PLACEHOLDER: Open water off the Outer Banks, the graveyard of the Atlantic. Nothing here but the sea, the sandbars and whatever ships are passing.",
    locations: { ship: { name: "The Ship", blurb: "Your ship rides the swell, out of sight of land." } },
    placeOrder: ["ship"],
    present: { places: { town: { heading: "The Hatteras Banks", banner: "open water off the Outer Banks" }, ship: { heading: "The Ship", hint: "Your ship, crew and cargo" } }, huntHint: "Hunt the Banks for prizes" },
    lines: {},
  };
  PC.data.nodes.bahama = {
    id: "bahama", name: "the Bahama Channel", title: "The Bahama Channel", kind: "ocean", zone: "south", waters: "south",
    control: "Open water", faction: null,
    blurb: "PLACEHOLDER: The warm blue channel between Florida and the Bahamas, where every ship bound for Europe from the Caribbean has to pass.",
    locations: { ship: { name: "The Ship", blurb: "Your ship rides the swell under a hot sun, out of sight of land." } },
    placeOrder: ["ship"],
    present: { places: { town: { heading: "The Bahama Channel", banner: "the Bahama Channel" }, ship: { heading: "The Ship", hint: "Your ship, crew and cargo" } }, huntHint: "Hunt the Channel for prizes" },
    lines: {},
  };

  PC.data.world = {
    // §37.12 P1: what can be sailed to in this build.
    live: ["ocracoke", "norfolk", "hatteras", "bahama"],

    // The places on the chart (layout guide, November 23). kind: port,
    // ocean or secret. zone: the weather zone (§42.2).
    places: [
      { id: "norfolk", label: "Norfolk", x: 0.065, y: 0.450, zone: "north" },
      { id: "edenton", label: "Edenton", x: 0.175, y: 0.575, zone: "north" },
      { id: "ocracoke", label: "Ocracoke", x: 0.280, y: 0.360, zone: "north" },
      { id: "wilmington", label: "Wilmington", x: 0.455, y: 0.600, zone: "north" },
      { id: "talanee", label: "Talanee", x: 0.555, y: 0.700, zone: "north", note: "upriver" },
      { id: "charleston", label: "Charleston", x: 0.670, y: 0.655, zone: "south" },
      { id: "beaufort", label: "Beaufort", x: 0.742, y: 0.710, zone: "south" },
      { id: "savannah", label: "Savannah", x: 0.786, y: 0.735, zone: "south" },
      { id: "staugustine", label: "St. Augustine", x: 0.885, y: 0.700, zone: "south" },
      { id: "nassau", label: "Nassau", x: 0.895, y: 0.285, zone: "south" },
      { id: "hatteras", label: "The Hatteras Banks", x: 0.250, y: 0.170, zone: "north", ocean: true },
      { id: "bahama", label: "The Bahama Channel", x: 0.850, y: 0.520, zone: "south", ocean: true },
    ],
    // The author's art, once it exists: a path in assets/ (the hotspots stay).
    mapArt: null,
    mapSize: [1800, 1200],

    // §4's voyage table, in AP (symmetric; the diagonal is 0).
    order: ["norfolk", "edenton", "ocracoke", "wilmington", "talanee", "charleston", "beaufort", "savannah", "staugustine", "nassau", "haven", "hatteras", "bahama"],
    ap: [
      // Nor Ede Ocr Wil Tal Cha Bea Sav StA Nas Hav Hat Bah
      [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 2], // Norfolk
      [1, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 1, 2], // Edenton
      [1, 1, 0, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2], // Ocracoke
      [1, 1, 1, 0, 1, 1, 1, 2, 2, 2, 2, 1, 1], // Wilmington
      [2, 2, 1, 1, 0, 1, 1, 1, 2, 2, 2, 2, 1], // Talanee
      [2, 2, 1, 1, 1, 0, 1, 1, 2, 2, 2, 2, 1], // Charleston
      [2, 2, 2, 1, 1, 1, 0, 1, 1, 2, 2, 2, 1], // Beaufort
      [2, 2, 2, 2, 1, 1, 1, 0, 1, 1, 2, 2, 1], // Savannah
      [3, 3, 2, 2, 2, 2, 1, 1, 0, 1, 1, 2, 1], // St. Augustine
      [3, 3, 2, 2, 2, 2, 2, 1, 1, 0, 1, 2, 1], // Nassau
      [3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 0, 2, 1], // the Hidden Haven
      [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 0, 2], // the Hatteras Banks
      [2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0], // the Bahama Channel
    ],

    // ---- Lines --------------------------------------------------------------
    lines: {
      uncharted: "Uncharted. Not on your charts yet.", // PH9, Claude's stand-in
      sailFor: "You weigh anchor and set sail for [Place].",
      reachOcean: "You reach [Place].",
      hungry: "PLACEHOLDER: The provisions run out at sea. The hands go hungry, and they grumble about it.",
      sick: "PLACEHOLDER: Hunger turns to sickness. [number] hands take to their hammocks.",
      upkeep: "The crew eat through [lots] lots of provisions as the season turns.",
      upkeepShort: "PLACEHOLDER: There isn't enough food aboard to see the season out. The crew go hungry.",
      seasonTurns: "[Season] [Year] begins.",
      stayPut: "You stay where you are as the season turns.",
    },

    // ---- The Winter split (§26.9, §26.10). All text PLACEHOLDER (PH5).
    split: {
      title: "The start of Winter",
      ask: "PLACEHOLDER: Winter is here, and the crew want to know if there'll be a split. A split shares out the crew's gold and takes the whole Winter: no voyages, no port business, all seven actions.",
      // The Quartermaster's reading (§26.9), by projected Pressure if the
      // captain holds. Three versions by his warmth are pinned for the
      // author (PH5); one stands in for all three.
      reading: { hold: "PLACEHOLDER: \"The men will hold.\"", grumbling: "PLACEHOLDER: \"There's grumbling.\"", trouble: "PLACEHOLDER: \"Trouble's coming.\"" },
      forced: "PLACEHOLDER: The crew won't wait any longer. They want their shares, and they want them now.",
      held: "PLACEHOLDER: You tell the crew there'll be no split this Winter. They take it about as well as you'd expect.",
      payout: "PLACEHOLDER: The prize ships are sold off and the crew's chest is opened on the deck. The Quartermaster counts out every man's share.",
      // Each hand's take and the mood word (Playtest Pins 0.8, #25; D1, placeholders).
      perHand: "Each hand takes away {gold} gold, and the hands are {mood}.",
      MOOD_BANDS: [{ min: 0, word: "grumbling" }, { min: 50, word: "content" }, { min: 150, word: "pleased" }, { min: 300, word: "delighted" }],
      // The skeleton crew stays; the rest go or come back (#26).
      crewLine: "{skeleton} stay aboard as the skeleton crew. {left} leave with their shares and {back} sign on again: {aboard} aboard.",
      departures: "PLACEHOLDER: With their shares in their pockets, most of the hands go ashore for good. A few come back to sign on again.",
      resign: "PLACEHOLDER: The skeleton crew and the men who came back gather to sign the Articles again.",
      vote: "PLACEHOLDER: The crew vote on their Quartermaster again.",
      winter: "How did you spend the Winter?",
      done: "PLACEHOLDER: The Winter passes. Come Spring, you'll need a crew again.",
    },
    // §26.10, one pick. Each plays a short line in the node's flavor (PH5).
    winterOptions: [
      { id: "carousing", label: "Carousing", needs: "tavern", line: "PLACEHOLDER: You and the crew drink the Winter away. Nobody remembers much of it, which is probably for the best." },
      { id: "careening", label: "Careening", needs: "shallow", line: "PLACEHOLDER: You haul her up on the beach, scrape her bottom clean and patch every seam. She'll be quick come Spring." },
      { id: "officers", label: "Officers' Company", line: "PLACEHOLDER: You spend the long nights in your cabin with your officers, swapping stories over a bottle." },
      { id: "ear", label: "Ear to the Ground", line: "PLACEHOLDER: You spend the Winter listening. Come Spring, you'll have heard something worth knowing." },
      { id: "courting", label: "Courting Favor", needs: "faction", line: "PLACEHOLDER: You spend the Winter making yourself useful to the right people." },
      { id: "gaming", label: "The Gaming Tables", needs: "tavern", line: "PLACEHOLDER: You find a table, a cup of dice and an opponent with a full purse." },
      { id: "rest", label: "Rest and Recovery", line: "PLACEHOLDER: You sleep late, eat well and let your body mend." },
      { id: "home", label: "Home and Hearth", needs: "home", line: "" }, // hidden until romance and homes exist
    ],
    // Re-signers by the morale band before the split (§26.9).
    RESIGN: { Mutinous: 0, Sullen: 0.10, Steady: 0.25, Eager: 0.40, Devoted: 0.60 },
    CARRYOVER: 0.10,
    SPLIT_APPROVAL: 2, // DEFAULT: §25.5 names the split's approval points but no number

    // ---- The year-end screen (N6, PH7) ---------------------------------------
    yearEnd: {
      title: "PLACEHOLDER: The End of 1754",
      note: "PLACEHOLDER (N6): the author writes the end-of-year titles and notes after the next playthrough. This is where Milestone 7 ends: a full year in the Carolinas.",
    },
  };
})();
