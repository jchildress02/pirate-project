/* Ocracoke (§17.2 and its appendix): the node record the engine reads.
 *
 * The rules are in js/node.js. The lines are the author's (S17 appendix,
 * §6 service lines and §8 short lines). The first-visit scenes and the two
 * Startup quests are Milestone 3: until then, short PLACEHOLDER beats stand
 * in for them at the right moments and give the real rewards, so the
 * economy can be played.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.npcs = PC.data.npcs || {};
  PC.data.scenes = PC.data.scenes || {};
  PC.data.nodes = PC.data.nodes || {};

  // ---- The Named cast (slim records, S17 appendix §5) -------------------
  var cast = {
    twopenny: { first: "Arthur", last: "Twopenny", gender: "m", role: "Pirate", title: "Captain", startRung: "Wary", traits: ["Suspicious", "Vain"], node: "ocracoke", label: "the Beach Captain" },
    ollie: { first: "Ollie", last: "Flanagan", gender: "m", role: "Pirate", startRung: "Neutral", traits: ["Cool-Headed", "Humble"], node: "ocracoke", label: "the dive host" },
    geezer: { first: "Geezer", last: "Flanagan", gender: "m", role: "Pirate", startRung: "Neutral", traits: ["Old Sea Dog", "Superstitious"], node: "ocracoke" },
    bobby: { first: "Bobby", last: "Rats", gender: "m", role: "Smuggler/Fence", startRung: "Neutral", traits: ["Greedy", "Fickle"], node: "ocracoke", label: "the fence" },
    davey: { first: "Davey", last: "Dell", gender: "m", role: "Pirate", startRung: "Friendly", node: "ocracoke", label: "the Raider" },
  };
  Object.keys(cast).forEach(function (id) { PC.data.npcs[id] = cast[id]; });

  PC.data.nodes.ocracoke = {
    id: "ocracoke",
    name: "Ocracoke",
    control: "No control",
    faction: "pirates",        // whose Standing sets fees and prices here
    leader: "twopenny",
    tier: "Very poor",
    prosperity: 10,            // start (§20.2)
    freePort: true,
    portFeeBase: 25,           // the harbor due for a Size 1 flagship (§17.2)
    dueWaivedBy: "twopenny",   // at Friend or better he waives a shortfall
    yardMax: 2,                // the yard tops out at level 2 (§17.2)
    provisionerCap: 5000,
    fence: { npc: "bobby", cap: 2000, opensWith: "ocr_underworld_done" },
    blurb: "A ragged pirate haven that's seen better days. A few ramshackle huts, a splintered dock, and a warehouse without a roof are all that's left of the town. On the bright side, the rum is cheap, and nobody asks too many questions.",

    // Persistent Minor slots (§15.1), named from the master pool (§36.1).
    slots: [
      { key: "keeper", id: "ocr_keeper", role: "Tavern Keeper", label: "the tavern keeper", place: "tavern", node: "ocracoke" },
      { key: "shipwright", id: "ocr_shipwright", role: "Craftsman", label: "the shipwright", place: "docks", node: "ocracoke" },
      { key: "provisioner", id: "ocr_provisioner", role: "Merchant", label: "the provisioner", place: "merchant", node: "ocracoke" },
    ],

    locations: {
      tavern: { name: "Tavern", blurb: "The tavern consists of three shacks nailed together. With only a simple bar and a wide assortment of tables and chairs, the tavern hosts the most pathetic group of sad sacks this side of the Atlantic." },
      docks: { name: "Docks", blurb: "The long dock creaks under every step. A handful of barefoot pirates sit along its edge, fishing for whatever bites. It doesn't look like they've caught much. What's left of the warehouse is perched atop rotting wooden beams along the right side of the dock." },
      merchant: { name: "Merchant", blurb: "A simple shack containing barrels of stinking provisions, even more barrels of kill-devil rum, and a lone merchant." },
      graveyard: { name: "Lilyhook's Graveyard", blurb: "The masts rise out of the surf like a drowned forest. Ollie pokes his head out of his tent and waves, cheerful as ever." },
      ship: { name: "The Ship", blurb: "Your ship sits at anchor just off the beach." },
    },

    // §24.7 The ruined on the docks and Amber Jack's loyalists.
    crewPool: { min: 15, max: 25, mix: { Green: 40, Seasoned: 50, Veteran: 10 } },

    // §17.2 The market and the provisioner's stock.
    market: {
      demand: { "Molasses": "Wants", "Kill-devil rum": "Glutted" },
      produces: { "Kill-devil rum": { min: 10, max: 20 } },
      bulk: { count: 3, min: 3, max: 8, weights: { "Rice": 30, "Tobacco": 25, "Sugar": 15, "Cotton": 10, "Mahogany and logwood": 10, "Furs and hides": 5, "Cocoa": 3, "Coffee": 2 } },
      // Spring 1754's stock is fixed so playtests compare (§17.2).
      fixed: { "1754-0": { "Kill-devil rum": 15, "Rice": 6, "Tobacco": 4, "Sugar": 3 } },
    },

    // ---- Service lines (S17 appendix §6) --------------------------------
    lines: {
      keeper: {
        first: "\"Welcome in. What can I do for you?\"",
        greet: { "-1": "\"You again. What do you want?\"", "0": "\"Welcome back.\"", "1": "\"Greetings, friend. What can I do for you?\"", "2": "\"Greetings, friend. What can I do for you?\"", "3": "\"Good to see you! First drink is on me.\"" },
        refuse: "\"Absolutely not. You'd best turn around and leave.\"",
        lodgingAsk: "My crew needs lodging.",
        lodgingBought: "\"Hope it's to your liking.\"",
        lodgingUsed: "\"Sorry, no space left.\"",
        rungUp: "\"Always good to see you.\"",
      },
      shipwright: {
        greet: { "-1": "\"Make it quick.\"", "0": "\"Fine day for sailing.\"", "1": "\"Good day, friend!\"", "2": "\"Good day, friend!\"", "3": "\"Always good to see you. Need anything?\"" },
        refuse: "\"Go away, we're closed.\"",
        repair: "\"She's all set.\"",
        bigRepair: "\"Took a bit of work, but she's ready to sail.\"",
        nothingToFix: "\"She looks fine to me.\"",
        upgrade: "\"That will make a difference, I'm sure.\"",
        atCap: "\"Sorry, can't help you there.\"",
        guns: "\"Always good to have more firepower.\"",
        broke: "\"Come back when you've got more gold.\"",
      },
      crew: {
        signed: "They gather their things and head toward your ship.",
        empty: "There's nobody else to hire.",
        full: "You don't have any more space.",
        doublePrice: "They eye you warily, but agree to join.",
        paidOff: "You don't have enough space for everyone, so you put [number] hands ashore and pay them their due.",
      },
      provisioner: {
        greet: { "-1": "\"Make it quick.\"", "0": "\"What can I do for you?\"", "1": "\"Good to see you again!\"", "2": "\"Good to see you again!\"", "3": "\"Always a pleasure!\"" },
        refuse: "\"Go away.\"",
        provisions: "\"That should keep you afloat for a while.\"",
        goods: "\"All yours.\"",
        treasureSold: "\"A fair deal.\"",
        goodsSold: "\"This will do.\"",
        capReached: "\"I can't pay you any more at the moment.\"",
        dirty: "\"Are you crazy? I can't take those.\"",
        broke: "\"Doesn't look like you have the gold.\"",
        rungUp: "\"I always look forward to your visits.\"",
      },
      fence: {
        first: "\"Bobby always loves a good deal.\"",
        greet: { "-1": "\"Has anybody ever told you that you smell terrible? Even worse than Bobby!\"", "0": "\"Back to see to ol' Bobby Rats again, eh?\"", "1": "\"I'm sure you've brought Bobby something interesting.\"", "2": "\"I'm sure you've brought Bobby something interesting.\"", "3": "\"Welcome, welcome! Bobby's got the best rates for you.\"" },
        refuse: "\"Not even Bobby Rats will associate with you.\"",
        sold: "\"This deal is good for Bobby.\"",
        bigHaul: "\"Hold on, hold on! Give Bobby a second to count.\"",
        capReached: "\"Bobby's got a serious case of empty pockets. Why don't you pay a visit to Bobby's old friend Declan in Edenton, or the pretty miss Maelis in Nassau?\"",
        nothing: "\"Nothing for Bobby? Too bad.\"",
        rungUp: "\"Bobby's made another friend! Some say he's got too many.\"",
      },
      arrival: {
        recovered: "[number] wounded crewmen return to duty.",
        maimed: "[number] wounded crewmen are paid out and put ashore.",
        captives: "You free [number] grateful captives. They give you [reward] in gratitude.",
        duePaid: "You pay the port fee to avoid any trouble.",
        dueShort: "You don't have enough gold to cover the port fee. Instead, they take [what they take] from your ship.",
        dueWaived: "(to write) Twopenny waves off the fee you can't cover.",
        stocks: "(to write) With nothing left to take, Twopenny's men put you in the stocks for the night.",
        back: "You navigate through the shoals and return to town.",
      },
    },
  };

  // ---- PLACEHOLDER first-visit beats (replaced in Milestone 3) -----------
  // They fire at the doc's moments (§17.2) and give the real rewards.
  var P = "PLACEHOLDER (Milestone 3). ";
  var scenes = {
    ocr_opening: {
      id: "ocr_opening", kind: "beat", title: "Ocracoke", where: "Ocracoke, arrival",
      ap: 0, repeat: "once",
      setup: P + "The sandbar, the mentor's first words and Arthur Twopenny's welcome come in the next milestone. For now [Mentor] brings [Ship Name] over the bar, and the Beach Captain's men collect the harbor due on the beach.",
      choices: [{ id: "pay", label: "Pay Twopenny's harbor due and head up the beach.",
        result: { text: "\"Satisfactory,\" says the young man in the oversized coat. \"Welcome to Ocracoke.\"",
          effects: [{ gold: -25, pot: "crew" }, { ladder: { npc: "twopenny", delta: 1 } }, { flag: "ocr_opening_done" }], exit: "hub" } }],
    },
    ocr_underworld_stub: {
      id: "ocr_underworld_stub", kind: "beat", title: "Welcome to the Underworld", where: "Ocracoke, Tavern",
      ap: 1, repeat: "once",
      setup: P + "An unusually small man in the corner waves you over. Bobby Rats has a debt he wants collected from the drunk at the bar. The full scene arrives in the next milestone; for now, the debt is collected.",
      choices: [{ id: "done", label: "Collect the debt.",
        result: { text: "\"You make Bobby very happy.\" Bobby lets you keep the drunk's coin purse, and tells you he buys anything the merchants won't touch.",
          effects: [{ gold: 385 }, { ladder: { npc: "bobby", delta: 1 } }, { flag: "ocr_underworld_done" }], exit: "hub" } }],
    },
    ocr_dying_wish_stub: {
      id: "ocr_dying_wish_stub", kind: "beat", title: "A Dying Pirate's Wish", where: "Ocracoke, Lilyhook's Graveyard",
      ap: 1, repeat: "once",
      setup: P + "As you leave the tavern, Ollie Flanagan catches you: his father Geezer wants his ivory mermaid back from the wreck of the *Miranda*. The dive and the shark arrive in later milestones; for now, the mermaid comes up on the first try.",
      choices: [{ id: "done", label: "Dive for the mermaid.",
        result: { text: "Old Geezer dies with the mermaid in his hands. Ollie pays you with a pouch of old coins and jewelry, and a scrap of a map with \"Ocracoke\" written on it.",
          effects: [{ treasure: 10, dirty: false }, { item: "Lilyhook Fragment 1" }, { ladder: { npc: "ollie", delta: 1 } }, { flag: "ocr_dpw_done" }], exit: "hub" } }],
    },
    ocr_restless_stub: {
      id: "ocr_restless_stub", kind: "beat", title: "Restless & Ruined", where: "Ocracoke, Docks",
      ap: 0, repeat: "once",
      setup: P + "On your first walk down the dock, a very large young man named Davey Dell asks to sign on. Recruiting him arrives in the next milestone, along with the rest of the scene.",
      choices: [{ id: "done", label: "Tell him you'll talk later.",
        result: { text: "Davey waves cheerfully and goes back to coaxing a small black monkey with a piece of hardtack.",
          effects: [{ flag: "ocr_rr_done" }], exit: "hub" } }],
    },
  };
  Object.keys(scenes).forEach(function (id) { PC.data.scenes[id] = scenes[id]; });

  PC.data.start = { scene: "ocr_opening", node: "ocracoke" };
})();
