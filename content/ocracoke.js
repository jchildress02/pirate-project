/* Ocracoke (§17.2 and its appendix): the node record the engine reads.
 *
 * The rules are in js/node.js. The lines are the author's (S17 appendix,
 * §6 service lines and §8 short lines). The first-visit scenes, both Startup
 * quests, Restless & Ruined and the one-armed pirate are in
 * content/ocracoke_scenes.js.
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
    one_armed_pirate: { first: "The one-armed pirate", last: "", gender: "m", role: "Pirate", node: "ocracoke", label: "the one-armed pirate", scripted: true },
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

    // §17.2 The tavern keeper's rumor weights (Ocracoke's mix).
    rumorWeights: { "Legend": 20, "Danger": 20, "World State": 15, "Node": 15, "Reputation": 10, "Quest": 10, "Merchant": 8, "Prize": 2 },

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
        askRumors: "Heard anything interesting lately?",
        talkClean: "\"I did hear one other thing...\"",
        outOfRumors: "\"That's all I've got for you.\"",
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
        offeredClean: "\"What is Bobby supposed to do with this? Go take it to a normal merchant.\"",
        rungUp: "\"Bobby's made another friend! Some say he's got too many.\"",
      },
      arrival: {
        recovered: "[number] wounded crewmen return to duty.",
        maimed: "[number] wounded crewmen are paid out and put ashore.",
        captives: "You free [number] grateful captives. They give you [reward] in gratitude.",
        duePaid: "You pay the port fee to avoid any trouble.",
        dueShort: "You don't have enough gold to cover the port fee. Instead, they take [what they take] from your ship.",
        dueWaived: "Twopenny removes his hat and gives you a theatrical bow. \"Welcome back! Friends dock free here.\"",
        stocks: "You spend a dreary night in the stocks, and are released in the morning.",
        back: "You navigate through the shoals and return to town.",
      },
    },
  };

  // ---- How Ocracoke's places and scenes are presented (§38.3, §41.1) ----
  // A place's heading, its banner slot and the hint line under it on the
  // town screen (hints drafted by Claude, approved November 16).
  PC.data.nodes.ocracoke.present = {
    prosperityWord: "Very Poor",
    places: {
      sandbar: { heading: "The Sandbar", banner: "the sandbar and the beach at Ocracoke" },
      beach: { heading: "The Beach", banner: "the sandbar and the beach at Ocracoke" },
      town: { heading: "Ocracoke", banner: "Ocracoke from the water" },
      tavern: { heading: "The Tavern", banner: "the Ocracoke Tavern", hint: "Rumors, drink, dice, officers for hire" },
      docks: { heading: "The Docks", banner: "the Ocracoke docks", hint: "Shipwright, hands for hire" },
      merchant: { heading: "The Merchant", banner: "the provisioner's shack", hint: "Provisions and goods", hintFence: "Bobby Rats" },
      outside: { heading: "Outside the Tavern", banner: "the Ocracoke Tavern" },
      graveyard: { heading: "Lilyhook's Graveyard", banner: "Lilyhook's Graveyard", hint: "Dive the wrecks" },
      ship: { heading: "The Ship", banner: "your ship at anchor", hint: "Articles, crew, officers, cargo" },
    },
    // Per scene: the place it happens, the quest ribbon above the heading,
    // and the person the heading names once the captain knows them (until
    // then the place). namedIn: the scene where that person gives a name.
    scenes: {
      ocr_sandbar: { place: "sandbar" },
      ocr_mentor: { place: "beach" },
      ocr_twopenny_1: { place: "beach", person: "twopenny" },
      ocr_twopenny_fee: { place: "beach", person: "twopenny" },
      ocr_twopenny_partial: { place: "beach", person: "twopenny" },
      ocr_twopenny_setback: { place: "beach", person: "twopenny" },
      ocr_twopenny_pointer: { place: "beach", person: "twopenny" },
      ocr_twopenny_exit: { place: "beach" },
      ocr_rr_1: { place: "docks", quest: "Restless & Ruined", person: "davey" },
      ocr_rr_2: { place: "docks", quest: "Restless & Ruined", person: "davey", namedIn: true },
      ocr_rr_tab: { place: "docks", quest: "Restless & Ruined", person: "davey" },
      ocr_rr_recruited: { place: "docks", quest: "Restless & Ruined", person: "davey" },
      ocr_dpw_1: { place: "outside", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_2: { place: "outside", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_3: { place: "outside", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_4: { place: "beach", quest: "A Dying Pirate's Wish", person: "ollie", namedIn: true },
      ocr_dpw_5: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "geezer" },
      ocr_dpw_6: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "geezer", namedIn: true },
      ocr_dpw_7: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_dive: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_shark: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_8: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_9: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "geezer", plate: "Geezer's last moment" },
      ocr_dpw_10: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "geezer" },
      ocr_dpw_11: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_dpw_end: { place: "graveyard", quest: "A Dying Pirate's Wish", person: "ollie" },
      ocr_oap: { place: "tavern", heading: "The One-Armed Pirate" },
      ocr_oap_lead: { place: "tavern", quest: "What Was Lost", heading: "The One-Armed Pirate" },
      ocr_uw_1: { place: "tavern", quest: "Welcome to the Underworld", person: "bobby" },
      ocr_uw_2: { place: "tavern", quest: "Welcome to the Underworld", person: "bobby" },
      ocr_uw_drunk: { place: "tavern", quest: "Welcome to the Underworld" },
      ocr_uw_reward: { place: "tavern", quest: "Welcome to the Underworld", person: "bobby" },
    },
  };

  // The first signing of the Articles (§40.5): fires when the captain first
  // tries to leave Ocracoke without them.
  PC.data.firstSigning = "Before you weigh anchor, there's one last order of business. Every pirate crew sails under Articles: terms agreed and signed by all hands, setting the rules aboard and what each man can expect in return.";

  // Named NPCs who get woodcut busts (§38.3, §41.13). No art yet: the game
  // shows a labeled frame until the author's portrait drops into assets/.
  PC.data.npcPortraits = { twopenny: null, bobby: null, davey: null, ollie: null, geezer: null };

  PC.data.start = { scene: "ocr_sandbar", node: "ocracoke" }; // the scenes are in content/ocracoke_scenes.js
})();
