/* Norfolk (§17.4 and its appendix): the node record the engine reads.
 *
 * The rules are in js/node.js and js/world.js. Every line here is the
 * author's, from Norfolk Scene Records Part 4 (the Norfolk writing pass),
 * except lines marked † there (Claude's, approved, to tweak in playtesting)
 * and lines marked PLACEHOLDER here. Milestone 7 builds the Norfolk shell
 * (§17.4.17): the Tavern, the Dockyard, the Merchant, the Ship and the
 * Admiralty House as a locked row. Beats 1 and 2 are in
 * content/norfolk_scenes.js.
 *
 * This file loads after content/rumors.js and content/minigames.js: it adds
 * Norfolk's rumor pool, drinker pool and Liar's Dice table to theirs.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.npcs = PC.data.npcs || {};
  PC.data.nodes = PC.data.nodes || {};

  // ---- The Named cast (§17.4.6) -------------------------------------------
  // Horace and Christoph fill the Tavern Keeper and shipwright slots, so
  // the node's services read their lines. Snodgrass and Martha are
  // persistent Minors with fixed names (name cards, no portraits).
  var cast = {
    horace: { first: "Horace", last: "Daley", gender: "m", role: "Tavern Keeper", startRung: "Neutral", traits: ["Candid", "Hard Drinker"], node: "norfolk", label: "the tavern keeper" },
    christoph: { first: "Christoph", last: "Buchanan", gender: "m", role: "Craftsman", startRung: "Neutral", traits: ["Proud", "Stubborn"], node: "norfolk", label: "the Master Shipwright" },
    // Admiral Key leads Norfolk (Legendary, §15.9). Offstage in Milestone 7:
    // his introduction comes with letters in M8.
    key: { first: "James", last: "Key", title: "Admiral", gender: "m", role: "Colonial Officer", node: "norfolk", label: "the Admiral", scripted: true, legendary: true },
    howe: { first: "Lieutenant", last: "Howe", gender: "m", role: "Colonial Officer", startRung: "Neutral", traits: ["Upstanding", "Green"], node: "norfolk", label: "the flag lieutenant" },
    snodgrass: { first: "Rupert", last: "Snodgrass", gender: "m", role: "Official", startRung: "Neutral", traits: ["Corrupt", "Greedy"], node: "norfolk", label: "the Harbormaster", minor: true },
    martha: { first: "Martha", last: "", gender: "f", role: "Tavern staff", node: "norfolk", label: "the barmaid", minor: true, scripted: true },
  };
  Object.keys(cast).forEach(function (id) { PC.data.npcs[id] = cast[id]; });

  var O = function () { return PC.data.nodes.ocracoke.lines; };

  PC.data.nodes.norfolk = {
    id: "norfolk",
    name: "Norfolk",
    control: "Admiralty control",  // locked for the Slice (§17.4.1)
    faction: "avalon",
    leader: "key",
    tier: "Modest",
    prosperity: 55,
    freePort: false,
    portFeeBase: 75,               // × Size × the Avalon band; halved with a letter (M8)
    feeTakerName: "Rupert Snodgrass",
    layUpSlots: 2,                 // two ships at anchor here (§22.7)
    yardMax: 4,                    // the best yard in Avalon (§17.4.1)
    yardGate: { level: 4, standing: 20, faction: "avalon" }, // level 4 at Avalon 20+
    hullSales: "clean",            // clean hulls only (§17.4.4)
    provisionerCap: 20000,
    fence: null,                   // no fence at Norfolk
    crewGate: { faction: "avalon", min: 0 },  // the pool is closed below Avalon 0
    closedAt: "Enemy",             // turned away at Enemy (§17.4.1)
    officerTypeWeights: { Gunner: 2, Navigator: 2 }, // candidates lean ex-navy (§17.4.4)
    blurb: "A bustling navy town at the mouth of the Elizabeth River.",
    winterBlurb: "Ice rims the docks, and the fleet sits under a dusting of snow.",
    firstTavernFlag: null,         // beat 2 is a scene on first entering (PR 5); nothing locks behind it

    slots: [
      { key: "keeper", id: "horace", fixed: true, role: "Tavern Keeper", label: "the tavern keeper", place: "tavern", node: "norfolk" },
      { key: "shipwright", id: "christoph", fixed: true, role: "Craftsman", label: "the Master Shipwright", place: "docks", node: "norfolk" },
      { key: "provisioner", id: "nor_provisioner", role: "Merchant", label: "the provisioner", place: "merchant", node: "norfolk" },
      { key: "trademaster", id: "nor_trademaster", role: "Merchant", label: "the Trade Master", place: "merchant", node: "norfolk" },
    ],

    placeOrder: ["admiralty", "tavern", "docks", "merchant", "ship"],
    locations: {
      admiralty: { name: "The Admiralty House", blurb: "A grand brick building flying the gold flag of Scotland. Clerks hurry in and out with armfuls of paper.",
        winter: "A fire roars in the lounge, and Lieutenant Howe has dragged his armchair right up to it.",
        locked: "The Admiralty House receives no visitors yet." },
      tavern: { name: "Horace's Tavern", blurb: "Horace's is the local watering hole, popular with the navy men, much to Horace's chagrin.",
        winter: "The soldiers and sailors have crowded in from the cold, and the windows are fogged with their breath." },
      docks: { name: "The Dockyard", blurb: "The docks are alive with activity.",
        winter: "The shipwrights work on through the cold, their breath steaming in the air." },
      merchant: { name: "The Merchant", blurb: "A bustling market with provisions aplenty from every corner of the Chesapeake colony.",
        winter: "Shopkeepers stamp their feet in their doorways to keep warm." },
      ship: { name: "The Ship", blurb: "Your ship sits in the deep harbor at the end of a long dock.", winter: "Frost coats the rigging." },
    },

    // §17.4.1 Horace's rumor mix: tiers C 45 / B 52 / A 3; within C,
    // World State 45, Node 30, Reputation 20, Legend 5; within B, Danger 45,
    // Quest 30, Merchant 25; A is Prize only.
    rumorWeights: { "World State": 45, "Node": 30, "Reputation": 20, "Legend": 5, "Danger": 45, "Quest": 30, "Merchant": 25, "Prize": 3 },
    tierMix: { C: 45, B: 52, A: 3 },

    // §24.7: Able 80%, Seasoned 20%.
    crewPool: { min: 15, max: 25, mix: { Able: 80, Seasoned: 20 } },

    // §17.4.5 The market and the provisioner's stock.
    market: {
      demand: { "Mahogany and logwood": "Wants", "Coffee": "Wants", "Tobacco": "Glutted" },
      produces: { "Tobacco": { min: 20, max: 40 } },
      bulk: { countMin: 2, countMax: 4, min: 5, max: 15, weights: { "Rice": 25, "Sugar": 20, "Cotton": 15, "Molasses": 15, "Furs and hides": 10, "Coffee": 10, "Cocoa": 5 } },
    },

    // ---- Service lines (Norfolk Scene Records Part 4, §9) ----------------
    lines: {
      // The Admiralty House (Part 4 §9-§10; js/admiralty.js).
      admiralty: {
        greet: { wary: "\"Captain {captain.last}. State your business.\"", neutral: "\"Good day, Captain.\"",
          friend: "\"Welcome back, Captain. Always a pleasure to see you.\"", confidant: "\"Captain {captain.last}! We're delighted to see you again.\"" },
        refuse: "\"You have a lot of nerve coming here, Captain. You'd best leave before I call the guard.\"",
        nap: "The lieutenant is asleep in an armchair, a half-read report on his chest. He jolts awake when you clear your throat.",
        askAudience: "I'd like to see the Admiral.",
        occupied1: "\"I'm afraid he's occupied at the moment. Come back another time.\"",
        occupied2: "\"The Admiral is feeling under the weather today, unfortunately.\"",
        key: {
          greetRespected: "\"Captain {captain.last}. Welcome. What can I do for you?\"",
          greetTrusted: "\"Ah, Captain {captain.last}. Come in. Coffee?\"",
          nothing: "\"I've got nothing for you at the moment. Come back another time.\"",
          busy: "Admiral Key stands at the wall, peering closely at a tattered old map and stroking his chin.",
        },
        letterOffer: "\"The Admiral's offer still stands, Captain. Would you like your letter?\"",
        letterAccepted: "\"Splendid! Sign here, here, and initial here. Welcome to His Majesty's service.\"",
        letterDeclined: "\"Of course. It's still here if you change your mind.\"",
        letterRefused: "\"I'm sorry, Captain. The Admiral won't be issuing you a letter at present.\"",
        nothingToReport: "\"The board is over there, if you're looking for work.\"",
        pardonAsk: "I'd like to speak to the Admiral about a pardon.",
        pardonIn: "\"Of course. This way, Captain.\" He shows you into a sparse office overlooking the harbor.",
        pardonTerms: "Key folds his hands. \"I don't give these out lightly. [cost] in gold, and your word that you're finished preying on the Crown. Break it, and I'll see you hanged.\"",
        pardonAccepted: "The Admiral signs the paper and presses his seal into the wax. \"A clean slate. Don't waste it.\"",
        pardonDeclined: "\"Then we've nothing more to discuss. The offer stands, for now.\"",
        pardonBroke: "\"You haven't the gold, Captain. Come back when you do.\"",
        pardonRefused: "The Lieutenant looks furious. \"How dare you show your face here. Guards!\" You take off before they get there.",
        boardBlurb: "A cork board by the door, containing bounty notices with the Admiralty's seal.",
        boardMore: "More notices to follow.",
        // Howe's information steps (Part 4 §10). The fourth opens after A Wanted Man (M9).
        ask: [
          { id: "admiral", label: "Tell me about the Admiral.", answer: "\"Admiral James Key is the finest leader of men that Scotland's seen in generations. The King sent him here to put Avalon back together, and he intends to do just that.\"" },
          { id: "fleet", label: "That's quite the fleet out there.", answer: "\"Isn't it? They say the *Griffon* is the most powerful ship afloat. Nobody would dare come near her with ill intent.\"" },
          { id: "letters", label: "What's the difference between a letter and a pardon?", answer: "\"A letter makes you a privateer: you hunt the King's enemies, and the Admiral takes a tenth of the loot you sell. A pardon wipes your slate clean, for a price.\"" },
          { id: "board", label: "How does the notice board work?", when: { flag: "a_wanted_man_done" }, answer: "\"Take a notice, find the bastard and bring him in, and I'll pay you on the spot. Remember, alive always pays better.\"" },
        ],
      },
      // Inspections at Norfolk (Part 4 §9).
      inspection: {
        clean: "The soldiers search your hold but find nothing questionable.",
        takeIt: "The soldiers haul the goods away as the official writes your name in his ledger.",
      },
      keeper: {
        greet: { "-1": "\"Oh. It's you.\"", "0": "\"Another day in paradise. What'll it be?\"", "1": "\"Ah, it's you. Come in and drown your sorrows. Pull up a stool.\"", "2": "\"Ah, it's you. Come in and drown your sorrows. Pull up a stool.\"", "3": "\"Finally a face I don't despise. Welcome, welcome!\"" },
        refuse: "\"Get out. I've got enough vermin in here already.\"",
        lodgingAsk: "My crew needs lodging.",
        askRumors: "Heard anything interesting lately?",
        talkClean: "\"Oh, and another thing, since you're still standing there...\"",
        outOfRumors: "\"That's all the gossip I've got. I'm a barkeep, not the bloody town crier.\"",
        lodgingBought: "\"Rooms are upstairs. Try not to break anything. No refunds.\"",
        lodgingUsed: "\"Full up. If I had more room, I'd take it myself.\"",
        rungUp: "\"Back again? If I didn't know any better, I'd think you're starting to fall in love with me.\"",
        broke: "\"This isn't a charity. Come back with more gold, or leave me alone.\"",
        favorOffered: "\"Hey, you. Yes, you. I've got something I could use your help with.\"",
        favorDone: "\"Well, that could have gone worse.\"",
        brawlAftermath: "\"Somebody's paying for that, and it won't be me. Get out before I throw you out.\"",
        questions: [],
      },
      shipwright: {
        // Laying a ship up (Part 4 §9).
        laidUp: "\"She'll be safe here. I'll look after her myself.\"",
        recovered: "\"Here she is, just as you left her. Better, actually. I couldn't help myself.\"",
        slotsFull: "\"Don't have an extra berth, sorry to say.\"",
        first: "A tall man in a leather apron is shouting at two boys swordfighting with wooden planks. He sees you and sighs. \"Christoph Buchanan, Master Shipwright at your service. Forgive the circus.\"",
        greet: { "-1": "\"Make it quick. I have real work waiting.\"", "0": "\"Good day, Captain. What can I do for you?\"", "1": "\"Ah, Captain! All is well, I hope?\"", "2": "\"Ah, Captain! All is well, I hope?\"", "3": "\"My favorite customer! Don't tell the Admiral I said that.\"" },
        refuse: "\"I'd rather go hungry than work for you. Find someone else.\"",
        repair: "\"Done properly. Not that you'd notice the difference.\"",
        bigRepair: "\"She was barely seaworthy. Now she's a fine lass.\"",
        nothingToFix: "\"Nothing wrong with her that I can see.\"",
        upgrade: "\"Better. Not perfect, but better.\"",
        upgradeTop: "\"Proud of that one, I am. Enjoy her, Captain.\"",
        gateLocked: "\"My best work is for friends of the Crown, Captain. You're not one yet.\"",
        atCap: "\"She can't take any more, I'm afraid.\"",
        guns: "\"They'll shoot true. I didn't let my apprentices near them.\"",
        hullSold: "\"I'll take her. The apprentices will strip her down for parts. Lord knows destroying things is all they do.\"",
        dirtyHull: "\"Can't take that one, sorry. Find another port.\"",
        broke: "\"The highest quality work costs the most coin. Come back when you can pay for it.\"",
        rungUp: "\"I'm starting to look forward to your visits, Captain.\"",
        freeRepair: "\"This one's on the house, as promised.\"",
      },
      crew: {
        signed: "The new hands sling their sea bags over their shoulders and head for your ship.",
        empty: "Key's fleet has snapped up everyone else.",
        full: "You don't have room for any more hands.",
        doublePrice: "They've heard about your crew, but your gold does the talking.",
        closed: "The sailors on the docks turn their backs as you pass. No one here will sign on with you.",
        paidOff: "You put [number] hands ashore with their due. Most of them head straight for Horace's.",
      },
      provisioner: null, // filled below from Ocracoke's role lines plus Norfolk's own
      trademaster: {
        greet: "\"Captain. Here about putting a ship to work?\"",
        offer: "\"For a fee, I'll put one of your ships on the merchant rolls. She'll earn while you're busy elsewhere.\"",
        enrolled: "\"She's on the rolls. You'll start seeing her earnings soon.\"",
        already: "\"Your ship's doing honest work. Anything else?\"",
        refuse: "\"I can't put a ship of yours on the rolls.\"",
        broke: "\"The fee is fixed, Captain. No exceptions.\"",
      },
      arrival: {
        arrive: "You pull into the harbor and drop anchor well clear of the fleet.",
        back: "You slip up the Elizabeth River and return to port at Norfolk.",
        duePaid: "The official counts your coin closely, then waves you ashore.",
        dueShort: "Since you've come up short on the port fee, a few soldiers come aboard and carry off [what they take].",
        // D3 (ruled for M7): with nothing left to take, a night in the cells and 1 AP lost.
        stocks: "PLACEHOLDER: With nothing left to take, the soldiers march you to the Admiralty House cells for the night. They turn you loose in the morning.",
        turnedAway: "A frigate fires a warning shot across your bow. It's clear you're not welcome here.",
        recovered: null, maimed: null, captives: null, // Ocracoke's role lines (below)
      },
    },
  };

  var NL = PC.data.nodes.norfolk.lines;

  // The provisioner: Norfolk's own lines over Ocracoke's role lines (Part 4, §9).
  NL.provisioner = Object.assign({}, O().provisioner, {
    greet: Object.assign({}, O().provisioner.greet, { "0": "\"What can I get you, Captain?\"" }),
    dirty: "\"In this town? With half the navy watching? Not a chance.\"",
    capReached: "\"That's all the coin I can spare this season.\"",
    tobacco: "\"Chesapeake's finest. Grown just up the river.\"",
  });
  ["recovered", "maimed", "captives"].forEach(function (k) { NL.arrival[k] = O().arrival[k]; });

  // ---- How Norfolk's places are presented (§38.3, §41.4; Part 4 §11) ----
  PC.data.nodes.norfolk.present = {
    prosperityWord: "Modest",
    places: {
      town: { heading: "Norfolk", banner: "Norfolk and Hampton Roads" },
      arrival: { heading: "Hampton Roads", banner: "Hampton Roads and the fleet at anchor",
        blurb: "Merchant ships weave between the anchored warships, careful to keep out of the *Griffon*'s shadow.",
        winter: "The harbor is quiet, the warships' decks white with frost." },
      admiralty: { heading: "The Admiralty House", banner: "the Admiralty House", hint: "Lieutenant Howe: letters, pardons and bounties" },
      lounge: { heading: "The Lounge", banner: "the Admiralty House lounge", blurb: "A spacious, comfortable, and well-appointed lounge for guests of Admiral Key." },
      tavern: { heading: "Horace's Tavern", banner: "Horace's tavern", hint: "Rumors, lodging, drinking and dice" },
      docks: { heading: "The Dockyard", banner: "the Norfolk Dockyard", hint: "Repairs, upgrades and crew" },
      merchant: { heading: "The Merchant", banner: "the Norfolk market", hint: "Trade, provisions and gear" },
      ship: { heading: "The Ship", banner: "your ship at the long dock", hint: "Your ship, crew and cargo" },
    },
    huntHint: "Hunt the Hatteras Banks for prizes",
    huntWinter: "The winter sea is gray and nearly empty.",
    scenes: {},
  };

  PC.data.npcPortraits = PC.data.npcPortraits || {};
  ["horace", "christoph"].forEach(function (id) { if (!(id in PC.data.npcPortraits)) PC.data.npcPortraits[id] = null; });

  // ---- Norfolk's rumor pool (Part 4, §13) ----------------------------------
  // Lines carry node: "norfolk". Rows whose system isn't built yet wait on a
  // flag nothing sets in this build (bounties, letters, the revolution).
  var R = PC.data.rumors;
  var Y2 = { minYear: 1755 };
  [
    { id: "nor_jack_out_1", type: "World State", tier: "B", when: [Y2, { flag: "missed_staug_meeting" }], text: "\"Amber Jack's out there somewhere. Men like that don't vanish unless they're planning something.\"" },
    { id: "nor_jack_out_2", type: "World State", tier: "B", when: [Y2, { flag: "missed_staug_meeting" }], text: "\"Nobody's seen or heard from anyone on Amber Jack's crew. An ominous sign, if you ask me.\"" },
    { id: "nor_joan_1", type: "World State", when: Y2, text: "\"Sweden's found itself a girl general. They say the Frisians break and run at the sight of her banner.\"" },
    { id: "nor_joan_2", type: "World State", when: [{ minYear: 1756 }, { flag: "frisia_seeks_peace" }], text: "\"Frisia's asking Sweden for terms. All on account of one young woman.\"" },
    { id: "nor_two_masters_1", type: "Reputation", deed: true, when: { flag: "two_masters" }, text: "\"Word is [Player] works for the Admiralty by day and stirs up trouble by night.\"" },
    { id: "nor_two_masters_2", type: "Reputation", deed: true, when: { flag: "two_masters" }, text: "\"[Player] is playing both sides. Sooner or later, one of them will notice.\"" },
    { id: "nor_bounty_1", type: "Quest", bounty: true, text: "\"[NPC]'s been raiding near [Node]. {target.He} sails a [Ship type] called the *[Ship]*, last seen in [Waters].\"" },
    { id: "nor_bounty_2", type: "Quest", bounty: true, text: "\"If you're after [NPC], try [Waters]. {target.His} [Ship type] was spotted there not two days ago.\"" },
    { id: "nor_griffon", type: "World State", text: "\"A hundred guns on the *Griffon*. One broadside would turn a sloop into driftwood.\"" },
    { id: "nor_crackdown", type: "World State", when: { maxYear: 1754 }, text: "\"Key's hunters keep taking pirate ships. They're stringing pirates up like garlands around here.\"" },
    { id: "nor_pamphlets", type: "World State", text: "\"Someone's been nailing pamphlets to the church door again. The Admiral's men tear them down every morning.\"" },
    { id: "nor_governors", type: "World State", when: Y2, text: "\"They say the rebels are being funded by some rich and powerful folk. I wonder who?\"" },
    { id: "nor_king", type: "World State", text: "\"The King's on death's door, and his son would rather chase skirts than rule. Rough seas ahead, methinks.\"" },
    { id: "nor_embargo", type: "World State", text: "\"Frisian goods are banned in Avalon, but you'd never know it in Charleston.\"" },
    { id: "nor_balfour", type: "World State", text: "\"Governor Balfour of the Chesapeake colony won't sit at the same table as Governor Clarke of Carolina. Nobody remembers why.\"" },
    { id: "nor_hunters_frisian", type: "Danger", when: { flag: "frisian_letter" }, text: "\"Key's hunters are out on the Banks, looking for anyone sailing under a Frisian letter.\"" },
    { id: "nor_stragglers", type: "Danger", text: "\"Some of Deadman's Frenchmen never went home. They're still spotted out on the Banks on occasion.\"" },
    { id: "nor_wine_merchant", type: "Merchant", when: [{ minYear: 1755 }, { maxYear: 1755 }, { season: "Spring" }], text: "\"A wine merchant from St. Augustine has bought a shop by the docks. Very fancy fellow.\"" },
    { id: "nor_bells", type: "Legend", text: "\"Fishermen swear they hear church bells under the water off Cape Henry on foggy nights.\"" },
  ].forEach(function (l) { l.node = "norfolk"; R.pool.push(l); });

  // Node rumors (#19-#27): the shared trait lines serve where one is
  // already written; Norfolk adds the two that weren't.
  R.traits["Upstanding"] = R.traits["Upstanding"] || "\"[NPC]'s never taken a bribe in his life. Wouldn't know what to do with one.\"";
  R.traits["Green"] = R.traits["Green"] || "\"[NPC]'s barely been to sea. Got his post on his father's name.\"";
  R.tierMix.norfolk = PC.data.nodes.norfolk.tierMix;

  // ---- Under the Table: the Colonial Officer (Part 4, §12) ------------------
  var D = PC.data.minigames.drinking;
  D.pools.norfolk = { role: "Colonial Officer", traits: ["Green", "Timid", "Cool-Headed", "Proud", "Jovial", "Hot-Tempered"],
    setup: "A young navy officer in a gold-trimmed coat sits down across from you, " };
  Object.assign(D.traits["Green"], { hint: "a fresh-faced boy with his first moustache.", steady: "He grins and wipes his mouth on his sleeve.",
    wobbling: "His cheeks have gone bright pink.", doneFor: "He keeps asking whether the room always tilts like this." });
  Object.assign(D.traits["Timid"], { hint: "glancing at the door as if he hopes someone will call him away.", steady: "He takes a careful sip, then another, then the rest.",
    wobbling: "\"Perhaps that's enough for one evening?\" he asks no one in particular.", doneFor: "He pushes his cup away, mumbles an apology and calls it a night." });
  // Cool-Headed replaces Upstanding (ruled): leaning on him is one DR harder.
  Object.assign(D.traits["Cool-Headed"], { hint: "his face as calm as a millpond.", steady: "He drinks without a flicker of expression.",
    wobbling: "He sets his cup down very carefully, as if it might escape.", doneFor: "He blinks slowly. \"I believe,\" he says, \"that I am quite drunk.\"" });

  // ---- Liar's Dice: the Colonial Officer (Part 4, §12) ------------------------
  var LD = PC.data.minigames.dice;
  LD.pools.norfolk = { role: "Colonial Officer", lines: {
    sit: "A young officer in a spotless coat sets down his cup. \"A friendly game, Captain? Navy rules.\"",
    size: { clean: "He straightens his collar whenever he's bluffing.", partial: "He's hiding something, but you can't tell what.", setback: "\"They teach us to read the enemy at the Academy, you know.\"" },
    tell: "He straightens his collar.",
    cheat: { clean: "You sneak a peek while he signals for another drink.", partial: "You get your peek, but he frowns and pulls the cup closer." },
    caught: "\"Cheat!\" He jumps to his feet, and half the tavern turns to look.",
    win: "He pushes the coins across with a grimace.",
    lose: "\"Bad luck, Captain. Another round?\"",
    broke: "\"The stakes are fifty, Captain. Perhaps another time.\"",
  } };

  // ---- The hunt: Norfolk hunts the Hatteras Banks (§17.4.4) -------------------
  PC.data.hunt.HOME_WATERS.norfolk = "north";
  PC.data.hunt.HOME_WATERS.hatteras = "north";
  PC.data.hunt.HOME_WATERS.bahama = "south";
  // Ocracoke's Trade Master speaks Norfolk's lines as role lines (M7 plan).
  PC.data.nodes.ocracoke.lines.trademaster = NL.trademaster;
})();
