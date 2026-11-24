/* Norfolk's first visit (beats 1 and 2), its errands and the barkeep
 * favors at both Taverns (Milestone 7, PR 5). Filed from Norfolk Scene
 * Records Part 2 §5 (the first inspection), Part 3 §7 (Horace's tavern)
 * and Part 4 §9, §10 and §14 (the Apprentices, Drunken Sailors, the
 * favors, Godfrey's lines). The author's language is final: lines are
 * copied exactly, with tokens marked. Lines marked † in the records are
 * Claude's, approved.
 *
 * The rules these scenes call are in js/norfolk.js: { fn } tests,
 * { hook } effects and {port_fee}-style values. The same §33 fields as
 * content/ocracoke_scenes.js.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.scenes = PC.data.scenes || {};

  var scenes = {};
  function S(id, o) {
    o.id = id; o.ap = o.ap || 0; o.repeat = o.repeat || "once"; o.kind = o.kind || "choice";
    o.choices.forEach(function (c, i) { c.id = c.id || "c" + i; c.approval = c.approval || []; });
    scenes[id] = o;
  }
  function R(text, effects, exit, more) { return Object.assign({ text: text || "", effects: effects || [], exit: exit || "hub" }, more || {}); }
  function K(label, approval, check, clean, partial, setback, more) {
    return Object.assign({ label: label, approval: approval, check: check, outcomes: { clean: clean, partial: partial, setback: setback } }, more || {});
  }
  function C(label, approval, result, more) { return Object.assign({ label: label, approval: approval, result: result }, more || {}); }

  // ---- Rules data (js/norfolk.js) --------------------------------------------------
  PC.data.norfolkRules = {
    BRIBE_BEFORE: 4,        // × the port fee (records §5)
    BRIBE_FOUND: 0.5,       // × the fence value of the goods at risk (records §5)
    BRIBE_FOUND_MIN: 20,    // DEFAULT: a floor, so a crate of molasses still costs something
    RAIDS: { Baltimore: 1752.7, Savannah: 1753.45, Charleston: 1753.45 }, // Sep 1752; Jun 1753
    GOOD_LIQUOR: ["Plantation rum", "Frisian genever", "Scotch whisky", "French wine", "French brandy", "Nassau reserve"],
    DS_UNITS: 30,           // Drunken Sailors (ruled)
    DS_MULT: 1.5,           // clean liquor during the errand (×Norfolk's price)
    AFTER_MULT: 1.25,       // clean liquor once the 30 are in
    DIRTY_MULT: 1.0,        // dirty liquor, "no questions" (Part 4 §9)
    DS_STANDING: 5,         // Avalon Standing on completion
    PENDRAGON_OPENS: { year: 1755, season: 1 }, // Summer 1755: wine stops counting
    TIMBER_BILL: 100,       // The Apprentices, fix it, partial (ruled placeholder)
    FAVOR_COST: 25,         // DEFAULT: a barkeep favor's partial "at a cost" (§16.6 names none)
    FAVOR_TYPES: ["fight", "tab", "bar"],
    FAVORS: { norfolk: ["a", "b"], ocracoke: ["o"] },
  };

  // ---- Nicholas Godfrey (records §7, a proposal; his lines §14) ---------------------
  PC.data.namedOfficers = PC.data.namedOfficers || {};
  PC.data.namedOfficers.godfrey = {
    id: "godfrey", first: "Nicholas", last: "Godfrey", gender: "m", age: 48, named: true,
    type: "Gunner", level: 1,
    voice: "Curmudgeon", warmth: "cold", likes: ["Honor"], dislikes: ["Revelry"],
    secondary: "Lonesome", third: "Grudge-Keeper", unique: "Curmudgeon",
    drive: "Revenge", fear: "Disgrace", startRung: "leaning",
    hiringIntro: "He doesn't look up from his bottle. \"You payin' this time?\"",
    dismissal: "\"Hrmph. Figures.\"",
    barks: ["\"Hrmph.\"", "\"Guns are clean. Don't touch 'em.\"", "\"Too much singing on this ship.\"", "\"Powder's damp. Somebody's getting a kick.\"",
      "\"Quiet. Finally.\"", "\"Port. Hate port.\"", "\"Seen faster gun crews. Not many.\"", "\"Hrmph. Fine.\""],
    approve: "\"Hrmph. Good.\"", disapprove: "\"Fool's business.\"",
    want: "\"I've got dreams of blasting Deadman's cursed ship to smithereens.\"",
    fearLine: "\"Men remember the wrong things about a fight. Don't let 'em remember the wrong thing about you.\"",
    lastWords: "\"Should've... reloaded faster.\"", bonded: "\"{dead.He} was all right. Hrmph.\"",
    commission: "\"My own ship. Don't expect a speech.\"", ringleader: "\"Should've listened to me.\"",
  };
  PC.data.npcs = PC.data.npcs || {};
  PC.data.npcs.godfrey = { first: "Nicholas", last: "Godfrey", gender: "m", role: "Colonial Officer", startRung: "Neutral", node: "norfolk", label: "the gruff man" };

  // ---- Variant C, lead 3: Gregoire's wanted bill (records §7) -------------------------
  if (PC.data.quests && PC.data.quests.what_was_lost) {
    PC.data.quests.what_was_lost.leads.gregoire_bill = { node: "norfolk", variants: ["C"], journal: {
      C: "A wanted bill in Horace's tavern names him: Gregoire LeGardier, one of Deadman's men, said to haunt [Trident Waters].",
    } };
  }

  // ---- Norfolk's lines for the new services (Part 4 §9, §10) -------------------------
  var N = PC.data.nodes.norfolk.lines;
  N.horaceLiquor = {
    open: "\"Let's see it then.\"",
    clean: "\"Now that's the good stuff. Fine work.\"",
    dirty: "\"I won't ask where it came from. I'm just glad to have it.\"",
    nothing: "\"You've got nothing I want. Come back when you do.\"",
    noWine: "\"A fancy wine man opened shop down the street. The city's got wine aplenty now, so I don't need any more.\"",
    wineAfter: "\"Take it to Pendragon. Wine's his business now.\"",
  };
  N.drunkenSailors = {
    askAgain: "Ask Horace again if there's anything you can do to help.",
    ask: "Ask Horace if there's anything you can do to help.",
    replyAgain: "\"You're persistent, aren't you. Well, we are always running out of quality drink. These days all we've got to serve is rotgut rum and gritty ale. I'd pay well for anything you're able to find. The more the better—thirty crates would be a dream.\"",
    reply: "\"Funny you should ask. We are always running out of quality drink. These days all we've got to serve is rotgut rum and gritty ale. I'd pay well for anything you're able to find. The more the better—thirty crates would be a dream.\"",
    partial: "Horace pries open a crate and pulls out a bottle to inspect it. \"Good, keep it coming. That's [number] of thirty.\"",
    done: "Horace sets the last crate on the bar and pours two glasses. \"This place is afloat thanks to you. Appreciate all the help.\" He thinks deeply for a moment. \"Although...I'd certainly be willing to buy any more that you bring me.\"",
    noWine: "\"Keep your wine. Pendragon's got that covered. Anything else, I'll take.\"",
    objective: "Bring Horace Daley 30 crates of good liquor (plantation rum, genever, whiskey, wine, brandy or Nassau reserve). He's paying well.",
  };
  N.horaceAsk = {
    advert: "Ask about the help wanted advertisement.",
    advertReply: "\"Oh, that? The Admiral's man put that up. Said that anyone who can sail should head up to the Admiralty House. Hasn't done a lick of good, though. Everyone here's already in the damn navy.\"",
    bill: "Ask about the wanted bill.",
    billReply: "\"Seems like a real bad fella. Gregoire LeGardier. Apparently he was part of Deadman's fleet, but even meaner than the rest, if that's even possible. They say he's been lurking around {waters} for a while now.\"",
    godfrey: "Strike up a conversation with the gruff man next to you.",
    godfreyAgain: "Talk to the gruff man next to you.",
  };
  N.apprentices = {
    opening: "Your apprentices seem...distracted.",
    objective: "Christoph Buchanan's apprentices have made a mess of a refit at the Norfolk Dockyard. Help him set it right.",
  };

  // ---- Beat 1: Hampton Roads and the first inspection (records §5) ---------------------

  var DEAL_ONE = "You hand over a hefty pouch of gold. The man peeks inside the pouch before stuffing it into his coat.\n\n\"Enjoy your time in Norfolk,\" he says as he departs.";
  var DEAL_TWO = "You hand over two hefty pouches of gold. The man peeks inside the pouches before stuffing them into his coat.\n\n\"Enjoy your time in Norfolk,\" he says as he departs.";
  var CRATE_ONE = "The soldiers put the crate down as you hand over a hefty pouch of gold. The man peeks inside the pouch before stuffing it into his coat.\n\n\"Enjoy your time in Norfolk,\" he says as he departs.";
  var CRATE_TWO = "The soldiers put the crate down as you hand over two hefty pouches of gold. The man peeks inside the pouches before stuffing them into his coat.\n\n\"Enjoy your time in Norfolk,\" he says as he departs.";
  var TAKE_IT = "The soldiers haul the goods away as the official writes your name in his ledger.";
  var SEARCH = "\"As you may be aware, Admiral Key has ordered Avalon's port officials to crack down on smuggling. I've got orders to search every suspicious ship that docks here for illicit cargo. That includes yours, newcomer. We'll need to step aboard to conduct the search.\"";
  var FEE = function (eyebrow) {
    return "\"Is that so?\" he remarks" + (eyebrow ? ", raising an eyebrow" : "") + ". You pay the port fee to avoid any trouble, but he doesn't turn to leave.\n\n" + SEARCH;
  };
  var feeFx = [{ hook: "nor_port_fee" }, { flag: "nor_first_inspection_done" }, { meet: "snodgrass" }];
  var HEAT5 = { heat: { faction: "avalon", delta: 5 } };
  var takeIt = C("Take it, then.", ["Retreat"], R(TAKE_IT, [{ hook: "nor_confiscate" }, HEAT5]));
  var bribeFound = K("Perhaps there's an additional \"wrong stamp\" fee? ({bribe_found})", ["Caution"], { type: "Bribe", dr: 3 },
    R(CRATE_ONE, [{ hook: "nor_pay", what: "bribe_found", mult: 1 }]),
    R("He shifts uncomfortably. He lowers his voice and whispers, \"Double.\"", [], "nor_fv1_double_found", { carry: true }),
    R("", [], "nor_fv1_jail"),
    { lockedUnless: { fn: "afford:bribe_found:1" }, lockedReason: "Not enough gold" });
  var talkDown = function (label, appr, check) {
    return K(label, appr, check,
      R("He sizes you up for a moment. Finally, he cracks a smile.\n\n\"Put it down,\" he instructs the soldiers, before turning back to you. \"Just keep that on the ship and you won't have a problem.\" The three of them depart down the gangplank."),
      R("He glances in both directions. \"I might reconsider if you made it worth my while.\"", [], "nor_fv1_limited", { carry: true }),
      R("", [], "nor_fv1_jail"));
  };
  var haggle = function (dealText, what, back) {
    return K("Surely we can come to a more acceptable arrangement.", ["Risk"], { type: "Haggle", dr: 2 },
      R("You manage to reach an understanding.\n\n" + dealText, [{ hook: "nor_pay", what: what, mult: 1.5 }]),
      R("You manage to reach an understanding, though it isn't as good as you would have liked.\n\n" + dealText, [{ hook: "nor_pay", what: what, mult: 1.75 }]),
      R("He stands firm.", [{ flag: back + "_haggled" }], back),
      { hiddenUnless: { all: [{ profession: "Merchant" }, { notFlag: back + "_haggled" }] }, lockedUnless: { fn: "afford:" + what + ":1.75" }, lockedReason: "Not enough gold" });
  };

  S("nor_fv1", {
    title: "Hampton Roads", where: "Norfolk, Hampton Roads and the docks", conditions: ["Harbor", "Official"], manyChoices: true,
    setup: [
      "The bustling harbor of Norfolk is a hive of activity as you approach the mouth of the Elizabeth River. Merchant vessels, cargo ships, and a wide variety of coastal sailboats crisscross the river as fluffy white clouds glide lazily overhead.\n\n",
      "Those busy boats, however, have an obstacle to avoid. Taking up nearly half the harbor is an enormous war fleet, consisting of at least two dozen ships of all sizes and classes. At the center of the formation, surrounded by several heavily-armed frigates, sits the largest ship you've ever seen. The sun gleams off her hull as you count at least fifty guns on one side of her, spread across three tall decks. She seems to have enough sail on her to move a small armada, and she casts a tremendous shadow over the harbor. The gold flag of Scotland fluttering atop her mainmast must be at least fifty feet wide. Two smaller ships of the line, still formidable, anchor either end of the harbor.\n\n",
      { when: { fn: "hometown" }, text: "{years_since_raid}, this fleet might have saved {city}.\n\n" },
      { when: { fn: "qmWarmth:warm" }, text: "\"Get a load of that beauty,\" [Quartermaster] remarks, awestruck by the titanic flagship. \"I've never seen anything like it.\"\n\n" },
      { when: { fn: "qmWarmth:neutral" }, text: "\"I don't know about you, but I certainly wouldn't want to tangle with her,\" [Quartermaster] says of the flagship.\n\n" },
      { when: { fn: "qmWarmth:cold" }, text: "\"Don't let her size fool you; she's only as good as her captain,\" cautions [Quartermaster]. \"And the Scottish navy has a rather spotty track record in that department.\"\n\n" },
      "As you pull slowly into the harbor, giving the fleet a wide berth, you take notice of the infrastructure required to support a fleet like that. Spacious warehouses and sturdy wharves line the waterfront, and a small army of porters, sailors, and craftsmen work at a brisk pace up and down the length of the docks.\n\n",
      "As your crew ties {ship} up at one of the many docks and you disembark, you're met by a bookish man in an official-looking gold uniform, with his spectacles pushed to the end of his nose, carrying a thick ledger underneath his arm. He's flanked by two uniformed soldiers carrying polished muskets.\n\n",
      { when: { tag: "Brute" }, text: "The soldiers' hands tense around their muskets as they watch you step onto the docks.\n\n" },
      "\"Welcome to Norfolk,\" he says in a nasally voice. \"The fee to dock here is {port_fee}. May I inquire as to the purpose of your visit?\" Judging by the soldiers, the question doesn't stem from innocent curiosity.",
    ],
    choices: [
      C("Quite the fleet you have here.", [], R("The man nods curtly. \"It's the finest fleet Scotland has ever produced. And its presence has been good for the city's economy. We're all grateful that Admiral Key is here.\"", [{ flag: "nor_fv1_fleet" }], "nor_fv1"), { info: true }),
      C("Who is Admiral Key?", [], R("\"Admiral Key is the fleet's ranking officer. He's really turned the city around since his arrival.\"", [], "nor_fv1"), { info: true, hiddenUnless: { flag: "nor_fv1_fleet" } }),
      C("My name is Captain {captain.last}. I've got business here in Norfolk.", ["Honor"], R(FEE(false), feeFx, "nor_fv1_search")),
      C("We're simple traders. Our hold contains cargo in search of a buyer.", ["Caution"], R(FEE(false), feeFx, "nor_fv1_search")),
      C("Don't worry, we won't be staying long.", ["Caution"], R(FEE(false), feeFx, "nor_fv1_search")),
      C("My business is my own. I'll just pay the fee and be on my way.", ["Defiance"], R(FEE(true), feeFx, "nor_fv1_search")),
    ],
  });

  S("nor_fv1_search", {
    kind: "check", title: "Hampton Roads", where: "Norfolk, the docks", conditions: ["Harbor", "Official"],
    setup: SEARCH,
    choices: [
      C("By all means.", ["Caution"], R("", [], "nor_fv1_hold")),
      K("I'd be happy to help.", ["Deceit"], { type: "Smuggle", dr: 2 },
        R("You keep the official occupied looking through barrels of your provisions. Eventually, he nods to the soldiers, and the three of them depart."),
        R("", [{ hook: "nor_least" }], "nor_fv1_hold"),
        R("", [], "nor_fv1_hold"),
        { hiddenUnless: { profession: "Smuggler" } }),
      K("That won't be necessary. It was actually Admiral Key who summoned me here.", ["Deceit", "Risk"], { type: "Bluff & Disguise", dr: 3 },
        R("He steps back. \"Oh, you must be the timber merchant from New Scotland that he mentioned! I apologize for the trouble. Enjoy your time in Norfolk.\" He and the soldiers depart without another word."),
        R("He steps back and sizes you up. \"Hmm, I'm not sure that I buy that story, but the inspection is at my discretion. I might reconsider if you made it worth my while.\"", [], "nor_fv1_deal", { carry: true }),
        R("\"A likely story. Unfortunately, the inspection is required of all ships.\"", [], "nor_fv1_hold")),
      // Bribe: base DR 1, +1 at an Admiralty port (records §5). DEFAULT: Heat's step (§6) isn't added yet.
      K("I'm just now realizing I gave you the wrong amount for the port fee earlier. Here's the rest. ({bribe_before})", ["Caution"], { type: "Bribe", dr: 2 },
        R(DEAL_ONE, [{ hook: "nor_pay", what: "bribe_before", mult: 1 }]),
        R("He shifts uncomfortably. He lowers his voice and whispers, \"Double.\"", [], "nor_fv1_double_before", { carry: true }),
        R("\"You must be mistaken. I'm under orders to search every suspicious ship.\"", [], "nor_fv1_hold"),
        { lockedUnless: { fn: "afford:bribe_before:1" }, lockedReason: "Not enough gold" }),
    ],
  });

  S("nor_fv1_deal", {
    title: "Hampton Roads", where: "Norfolk, the docks",
    setup: "He steps back and sizes you up. \"Hmm, I'm not sure that I buy that story, but the inspection is at my discretion. I might reconsider if you made it worth my while.\"",
    choices: [
      C("Deal. ({bribe_before})", ["Caution"], R(DEAL_ONE, [{ hook: "nor_pay", what: "bribe_before", mult: 1 }]), { lockedUnless: { fn: "afford:bribe_before:1" }, lockedReason: "Not enough gold" }),
      C("That's too much.", ["Defiance"], R("\"Shame. In that case the inspection is required.\"", [], "nor_fv1_hold")),
    ],
  });

  S("nor_fv1_double_before", {
    kind: "check", title: "Hampton Roads", where: "Norfolk, the docks", repeat: "always", conditions: ["Harbor", "Official"],
    setup: "He shifts uncomfortably. He lowers his voice and whispers, \"Double.\"",
    choices: [
      haggle(DEAL_ONE, "bribe_before", "nor_fv1_double_before"),
      C("Deal. ({bribe_before_2})", ["Caution"], R(DEAL_TWO, [{ hook: "nor_pay", what: "bribe_before", mult: 2 }]), { lockedUnless: { fn: "afford:bribe_before:2" }, lockedReason: "Not enough gold" }),
      C("That's too much.", ["Defiance"], R("\"In that case, we'll have to search your hold.\"", [], "nor_fv1_hold")),
    ],
  });

  S("nor_fv1_hold", {
    kind: "check", title: "Hampton Roads", where: "Norfolk, the docks", conditions: ["Harbor", "Official"], manyChoices: true,
    setup: [
      "The official and soldiers walk up the gangplank and head down into your hold.\n\n",
      { when: { fn: "noDirty" }, text: "They emerge a few minutes later. \"Everything appears in order. Enjoy your time in Norfolk,\" the official says as they depart." },
      { when: { fn: "dirtyAtRisk" }, text: "They emerge a few minutes later, the soldiers carrying a crate of {dirty_good} between them.\n\n\"This appears to be missing the proper customs seal,\" the official says." },
    ],
    choices: [
      C("Continue", [], R(""), { hiddenUnless: { fn: "noDirty" } }),
      Object.assign({}, takeIt, { hiddenUnless: { fn: "dirtyAtRisk" } }),
      Object.assign(talkDown("Ah, that must be a mistake. The official who was stamping the crates upon our departure seemed quite harried.", ["Deceit"], { type: "Bluff & Disguise", dr: 3 }), { hiddenUnless: { fn: "dirtyAtRisk" } }),
      Object.assign(talkDown("Oh, is it? Surely there's a way we can remedy this, one honest {captain.man} to another.", ["Caution"], { type: "Persuade", dr: 3 }), { hiddenUnless: { fn: "dirtyAtRisk" } }),
      Object.assign({}, bribeFound, { hiddenUnless: { fn: "dirtyAtRisk" } }),
    ],
  });

  S("nor_fv1_limited", {
    kind: "check", title: "Hampton Roads", where: "Norfolk, the docks", conditions: ["Harbor", "Official"],
    setup: "He glances in both directions. \"I might reconsider if you made it worth my while.\"",
    choices: [takeIt, bribeFound],
  });

  S("nor_fv1_double_found", {
    kind: "check", title: "Hampton Roads", where: "Norfolk, the docks", repeat: "always", conditions: ["Harbor", "Official"],
    setup: "He shifts uncomfortably. He lowers his voice and whispers, \"Double.\"",
    choices: [
      haggle(CRATE_ONE, "bribe_found", "nor_fv1_double_found"),
      C("Deal. ({bribe_found_2})", ["Caution"], R(CRATE_TWO, [{ hook: "nor_pay", what: "bribe_found", mult: 2 }]), { lockedUnless: { fn: "afford:bribe_found:2" }, lockedReason: "Not enough gold" }),
      C("That's too much.", ["Defiance"], R("", [], "nor_fv1_jail")),
    ],
  });

  // Jail follows §43 (Milestone 8); until then the story ends here (§37.1).
  S("nor_fv1_jail", {
    kind: "beat", title: "Hampton Roads", where: "Norfolk, the docks",
    setup: "\"You must be mistaken. Smugglers face consequences here in Norfolk,\" he says with a smarmy grin. \"Take {captain.him}.\"\n\nThe two large soldiers drop the crate and seize you by both arms as more armed soldiers march up the dock. Your crew watches on helplessly as you're hauled off to prison.",
    choices: [C("Continue", [], R("", [{ hook: "nor_confiscate" }, HEAT5, { hook: "nor_jail" }], "end"))],
  });

  // ---- Beat 2: Horace's tavern (records §7) ---------------------------------------------

  var warm = [{ ladder: { npc: "horace", delta: 1 }, when: { notFlag: "horace_warmed" } }, { flag: "horace_warmed" }];
  var left = R("\"Hm, suit yourself.\" He heads back into the bar.", [{ flag: "horace_left" }]);

  S("nor_ht_1", {
    title: "Horace's Tavern", where: "Norfolk, outside Horace's tavern",
    setup: "As you walk up the street, you pass by a bustling establishment with \"HORACE'S TAVERN\" written over the door.\n\nBy morning standards, the tavern is positively riotous. A multitude of muffled sounds emanate from behind the intricately carved wooden door. The laughter, shouting, screaming, and crying of its many patrons are audible all the way across the street. A large bay window that would otherwise offer a look inside the tavern instead displays only the backsides of dozens of sailors and marines pressed up against it.\n\nOutside the tavern, a stooped, balding man with a thick white beard is attempting unsuccessfully to strike a spark from his tinderbox to light his pipe. He wears a grimy apron, and he appears to be getting increasingly agitated with each fruitless strike of the flint.\n\nAs you walk by, he grabs your attention. \"Hey, you! Got a light?\"",
    choices: [
      C("Uh, sure. *hand the man your tinderbox*", ["Generosity"], R("\"Thanks,\" he says out of the corner of his mouth as he finally manages to light his carved wooden pipe. He takes a long drag and sighs deeply as he exhales the smooth tobacco smoke.", [], "nor_ht_2")),
      C("What's the matter with you?", [], R("\"Lend me a light and I'll tell you every secret I know,\" he replies sardonically.", [{ flag: "nor_ht_matter" }], "nor_ht_1"),
        { info: true, lockedUnless: { notFlag: "nor_ht_matter" }, lockedReason: "Asked" }),
      C("I don't have time for this.", [], R("", [{ flag: "horace_left" }])),
    ],
  });

  S("nor_ht_2", {
    title: "Horace's Tavern", where: "Norfolk, outside Horace's tavern",
    setup: "He leans back against the brick wall and hands your tinderbox back. \"You ever gotten something you think you want, only to discover that you think you like it a whole lot less than you thunk?\"",
    choices: [
      C("I know the feeling well.", [], R("He nods slowly, taking another deep drag from his pipe. \"Something about folk like us. Like God just put us here to have a good laugh.\"", warm, "nor_ht_3")),
      C("Can't say that I have.", [], R("\"Hmph. Must be nice to live with nothing but sunshine and daisies.\"", [], "nor_ht_3")),
      C("I'm not sure I understand.", [], R("\"Ah, so it's just rocks in there where the brains should be.\"", [], "nor_ht_3")),
    ],
  });

  S("nor_ht_3", {
    title: "Horace's Tavern", where: "Norfolk, outside Horace's tavern", manyChoices: true,
    setup: "\"See that lot in there? The ones currently destroying my tavern? They've been in there for three bloody days. These locusts have been drinking me dry, and wrecking my beloved establishment, ever since they arrived. Makes me wish Norfolk was a shithole again.\"",
    choices: [
      C("Your tavern? Are you Horace?", [], R("\"Unfortunately I am. Built this place with my own two hands, and now look what's happened.\"", [{ meet: "horace" }], "nor_ht_3"), { info: true }),
      C("Business must be good.", [], R("He raises his voice and shakes his fist at the sky. \"But at what cost? At what cost?!\"", [], "nor_ht_3"), { info: true }),
      C("That's a beautiful pattern on the door. Did you carve it yourself?", [], R("\"Sure did. About time somebody with eyes walks by.\"", warm, "nor_ht_4"), { hiddenUnless: { profession: "Artisan" } }),
      C("I know it doesn't mean much coming from a stranger, but I sympathize.", [], R("\"I appreciate it nonetheless. And I appreciate the light.\"", warm, "nor_ht_4")),
      C("Anything you need help with?", [], R("He raises his eyebrows. \"Sure. Invade Scotland. Then maybe the locusts will have to fly home.\"", [{ flag: "asked_horace_help" }], "nor_ht_4")),
      C("You sound ungrateful.", [], R("\"Oh, I'm the King of the Ingrates. Call me whatever you like, I'm miserable all the same.\"", [], "nor_ht_4")),
    ],
  });

  S("nor_ht_4", {
    title: "Horace's Tavern", where: "Norfolk, outside Horace's tavern",
    setup: "\"Say, stranger, how about you head back in with me? I've enjoyed our conversation, and owe you a drink for the light.\"",
    choices: [
      C("That sounds excellent.", [], R("", [], "nor_ht_inside")),
      C("I'd never turn down a free drink.", ["Revelry"], R("", [], "nor_ht_inside")),
      C("That's very generous of you, but I have to be going.", [], left),
      C("No thanks. Looks awful.", [], left),
    ],
  });

  S("nor_ht_inside", {
    title: "Horace's Tavern", where: "Norfolk, Horace's tavern",
    setup: [
      "He empties his pipe on the ground, then pushes the door open. The wall of sound that greets you is deafening. Gold-coated soldiers stand shoulder to shoulder, a solid mass of inebriated young men.\n\nHorace puts his shiny head down and pushes his way through the crowd like a heavy plow. You follow in his wake.\n\n",
      { when: { gender: "f" }, text: "You feel more than one pair of eyes fall upon you as you step toward the bar.\n\n" },
      "\"Move over, you damnable pest!\" Horace shouts as he reaches the bar, before throwing a red-faced soldier off one of the stools. He turns to you and pats the seat, newly yours, as the soldiers clear a bit of space.\n\nAs you take a seat at the bar, the nearby soldiers return to their revelry. Horace pushes his way behind the bar to join a stern-faced barmaid hurriedly pouring foaming mugs of ale. She's moving with great urgency and shouting back at the soldiers as they toss their gold on the bartop. Horace slowly bends down to grab a bottle of whiskey and takes a deep swig.\n\n\"What'll it be?\"",
    ],
    choices: [
      C("Ale, please.", [], R("\"You and everyone else,\" he laments. \"Martha! One more down here!\"\n\nWithout looking, the barmaid slides a full mug down the bar. The ale is coarse and extremely forgettable.", [{ meet: "horace" }, { meet: "martha" }], "nor_ht_room")),
      C("I prefer wine.", [], R("\"Suit yourself, fancypants. I think I've got one last bottle of Burgundian red around here.\" He pours you a glass from a dusty bottle, and it's completely unremarkable.", [{ meet: "horace" }], "nor_ht_room")),
      C("I'll take some of that whiskey.", ["Revelry"], R("He hands you the bottle. \"Have the rest,\" he shouts. \"I don't care anymore.\" You take a sip. It's very strong, but tastes as though it was aged in the hold of a filthy ship.", [{ meet: "horace" }], "nor_ht_room")),
      C("Have anything weaker? A glass of milk, perhaps?", [], R("He nearly spits out his whiskey. \"I cannot believe you just asked that,\" he cackles. \"Hey, Martha!\" He tries and fails to get the barmaid's attention. \"Did you hear what {captain.he} just said? Milk! Ha!\"", [{ flag: "nor_ht_milk" }], "nor_ht_inside"),
        { info: true, lockedUnless: { notFlag: "nor_ht_milk" }, lockedReason: "Asked" }),
    ],
  });

  S("nor_ht_room", {
    kind: "beat", title: "Horace's Tavern", where: "Norfolk, Horace's tavern",
    setup: [
      "Now that you have a bit of space, you take a quick scan around the room.\n\n",
      { when: { not: { fn: "variantC" } }, text: "Behind the bar is a poster, with big, bold letters at the top reading \"WANT TO GET RICH? CAPTAINS WANTED.\"\n\n" },
      { when: { fn: "variantC" }, text: "Behind the bar are two posters. One has big, bold letters at the top reading \"WANT TO GET RICH?\" The other appears to be a wanted bill.\n\n" },
      "In addition, the stout, middle-aged man sitting at the bar to your right strikes you as out of place. He isn't partaking in the revelry; in fact, quite the opposite. He stares straight ahead, holding a bottle of whiskey with a fist the size of a cannonball.",
    ],
    choices: [C("Continue", [], R("", [{ flag: "horace_met" }, { flag: "saw_howe_advert" }, { meet: "horace" }]))],
  });

  S("nor_ht_reentry", {
    kind: "beat", title: "Horace's Tavern", where: "Norfolk, Horace's tavern",
    firesWhen: { all: [{ flag: "horace_left" }, { notFlag: "horace_met" }] },
    setup: "You have to elbow your way through a pack of marines to sit at the lone open barstool. Behind the bar, a look of recognition passes across the face of the white-bearded bartender, who then pretends to not hear you as you try to order a drink.",
    choices: [C("Continue", [], R("", [{ meet: "horace" }], "nor_ht_room"))],
  });

  // ---- Godfrey at the bar (records §7, menu item 5) ---------------------------------------

  var HIRED = R("\"Hrmph.\" He grabs your gold off the bartop and takes one last swig from his bottle before heaving himself off the stool.\n\n\"I'll be at the docks,\" he mumbles as he lumbers off.", [{ hook: "godfrey_join" }]);
  var CAN_PAY = { gold: { pot: "crew", atLeast: 1000 } };

  S("nor_godfrey_talk", {
    title: "Horace's Tavern", where: "Norfolk, Horace's tavern",
    setup: "You ask him a question, but he doesn't respond beyond a barely-audible grunt. \"Don't mind him,\" says Horace. \"Ol' Nick Godfrey's a right curmudgeon.\"\n\nHe leans in and lowers his voice. \"Believe it or not, he used to be one of the finest gunners in Avalon's navy. He was on one of the few ships Deadman didn't manage to sink. They say none of the French ships wanted to come in range.\"",
    choices: [
      C("You were a navy gunner? I'm looking for experienced officers for my crew.", [], R("", [{ flag: "godfrey_met" }, { meet: "godfrey" }], "nor_godfrey_pay")),
      C("Leave him alone.", [], R("", [{ flag: "godfrey_met" }, { meet: "godfrey" }])),
    ],
  });

  S("nor_godfrey_pay", {
    title: "Nicholas Godfrey", where: "Norfolk, Horace's tavern", repeat: "always",
    setup: "This does elicit a response. He turns his meaty head and sizes you up and down with narrow eyes. \"You payin'?\"",
    choices: [
      C("Sure am. (Hire Nicholas Godfrey as a gunner)", [], HIRED, { hiddenUnless: { not: { fn: "gunnerAboard" } }, lockedUnless: CAN_PAY, lockedReason: "Needs 1,000 crew gold" }),
      C("Sure am. (Hire Nicholas Godfrey as a gunner)", [], R("", [], "nor_godfrey_replace"), { hiddenUnless: { fn: "gunnerAboard" }, lockedUnless: CAN_PAY, lockedReason: "Needs 1,000 crew gold" }),
      C("Don't have the coin today, I'm afraid.", [], R("\"Hrmph.\" He turns away and takes a big swig from his bottle.")),
    ],
  });

  // The replacement warning (§25.7, ruled: no line from the officer).
  S("nor_godfrey_replace", {
    title: "Nicholas Godfrey", where: "Norfolk, Horace's tavern", repeat: "always",
    setup: "Hiring Nicholas Godfrey replaces {gunner_name}, your Gunner, who is dismissed with {dismiss_pay} crew gold.",
    choices: [
      C("Hire him anyway", [], HIRED, { lockedUnless: CAN_PAY, lockedReason: "Needs 1,000 crew gold" }),
      C("Go back", [], R("")),
    ],
  });

  // ---- The Apprentices (Part 4 §10; partials ruled) -------------------------------------

  var APP_SET = { setback: R("You only make things worse. Christoph shoos you away from his ship. \"Out, before you sink her at the dock!\"", [{ ap: -1 }, { seasonFlag: "nor_appr_failed" }]) };
  var DONE = { flag: "nor_appr_done" };
  S("nor_appr", {
    kind: "check", title: "The Apprentices", where: "Norfolk, the Dockyard", repeat: "always", manyChoices: true,
    setup: "Christoph shakes his head. \"You don't know the half of it.\" He points at a half-built hull with the planks sticking out at exceedingly odd angles. \"Three days' work, and that's the best they could do. I've got a small army of clowns on my hands.\"",
    choices: [
      K("Let me take a look.", [], { type: "Repair & Refit", dr: 2 },
        R("By sundown the planks sit flush. Christoph runs his hand along the seams. \"Not bad. Not bad at all.\"", [{ ladder: { npc: "christoph", delta: 1 } }, DONE, { ap: -1 }]),
        R("The planks sit flush at last, but only after you've split half a stack of good timber. Christoph sighs and hands you the bill.", [{ ladder: { npc: "christoph", delta: 1 } }, { hook: "pay_gold", amount: 100 }, DONE, { ap: -1 }]),
        APP_SET.setback),
      C("Would a more experienced assistant help? I've got a hand who knows his way around a hull.", ["Generosity"],
        R("Within the hour, the boys are following your man's lead. \"Now this is more like it,\" Christoph says. \"I owe you, Captain.\"", [{ hook: "lose_hand" }, { ladder: { npc: "christoph", delta: 2 } }, DONE]),
        { hiddenUnless: { fn: "seasonedHand" } }),
      K("Go easy on them. They're boys, and they're still learning. Remember what you were like at that age?", ["Generosity"], { type: "Persuade", dr: 2 },
        R("Christoph glares at the timber, then at the boys. \"At least I had a hair more respect back then. But I take your point. I'll give them one more chance.\" The chastened boys look at you like you hung the moon.", [{ ladder: { npc: "christoph", delta: 1 } }, { flag: "nor_free_repair" }, DONE, { ap: -1 }]),
        R("Christoph grumbles, but agrees to give the boys another chance. \"Don't expect any favors for it, though.\"", [{ ladder: { npc: "christoph", delta: 1 } }, DONE, { ap: -1 }]),
        APP_SET.setback),
      C("Hand me that saw. I'll show them how it's done.", [],
        R("By sundown the planks sit flush. Christoph runs his hand along the seams. \"Not bad. Not bad at all.\"", [{ ladder: { npc: "christoph", delta: 1 } }, DONE, { ap: -1 }]),
        { hiddenUnless: { profession: "Artisan" } }),
      C("Sounds like your problem, not mine.", [], R("")),
    ],
  });

  // ---- Barkeep favors (§16.6; Part 4 §10) --------------------------------------------------
  // fav_<node>_<set>_<type>: once a season; 0 AP to accept, 1 to do. Clean:
  // the keeper +1 rung; partial: +1 at a cost; setback: nothing.

  var HORACE_DONE = "\n\n\"Well, that could have gone worse.\"";
  function favor(node, set, type, setup, approaches, outs) {
    var offer = node === "norfolk" ? "\"Hey, you. Yes, you. I've got something I could use your help with.\"\n\n" : "";
    var done = node === "norfolk" ? HORACE_DONE : "";
    var place = { title: "A Favor for the Keeper", where: node === "norfolk" ? "Norfolk, Horace's tavern" : "Ocracoke, the Tavern" };
    S("fav_" + node + "_" + set + "_" + type, Object.assign({
      kind: "check", repeat: "season", setup: offer + setup, manyChoices: true,
      choices: approaches.map(function (a) {
        return K(a.label, a.approval, a.check,
          R(outs[0] + done, [{ hook: "keeper_rung", delta: 1 }, { ap: -1 }]),
          R(outs[1], [{ hook: "keeper_rung", delta: 1 }, { hook: "pay_gold", amount: 25 }, { ap: -1 }]),
          R(outs[2], [{ ap: -1 }]),
          a.more || { lockedUnless: { fn: "hasAp" }, lockedReason: "No actions left this season" });
      }).concat([C("Not tonight.", [], R(""))]),
    }, place));
  }
  var FIGHT = function (l1, l2) { return [{ label: l1, approval: ["Risk"], check: { type: "Brawling", dr: 2 } }, { label: l2, approval: ["Order"], check: { type: "Intimidate", dr: 2 } }]; };
  var TAB = function (l1, l2, merchant) {
    var a = [{ label: l1, approval: ["Honor"], check: { type: "Persuade", dr: 2 } }, { label: l2, approval: ["Order"], check: { type: "Intimidate", dr: 2 } }];
    if (merchant) a.push({ label: merchant, approval: ["Honor"], check: { type: "Persuade", dr: 1 }, more: { hiddenUnless: { profession: "Merchant" }, lockedUnless: { fn: "hasAp" }, lockedReason: "No actions left this season" } });
    return a;
  };
  var BAR = function (l) { return [{ label: l, approval: ["Revelry"], check: { type: "Tavern Talk", dr: 2 } }]; };

  // Horace, set A
  favor("norfolk", "a", "fight", "A scuffle between two marines has turned into an all-out brawl. Horace points their way. \"Would you mind doing something about them?\"",
    FIGHT("*walk up and start swinging*", "Break it up, or you won't have teeth by the end of the night."),
    ["The marines slink back to their seats, rubbing their new bruises.", "You break it up, but not before a stool goes through the bay window.", "Someone's fist finds your jaw, and the whole room joins in."]);
  favor("norfolk", "a", "tab", "\"See the fancy lieutenant in the corner? He owes me forty in gold and a bottle of brandy. Go remind him.\"",
    TAB("Let's settle up before your captain hears about this.", "*loom over him and crack your knuckles*", "Let's work out a payment plan."),
    ["He pays up with a sheepish grin.", "He pays half, and spits on your boots for good measure.", "He laughs in your face and orders another round on Horace's tab."]);
  favor("norfolk", "a", "bar", "\"I need a smoke and some quiet. You're on the bar. Don't let Martha kill anyone.\"",
    BAR("*pour with a flourish and start up a shanty*"),
    ["When Horace returns, the whole room is singing and the till is full.", "The till is full, but the floor is covered in broken glass.", "You lose count of the free drinks you've poured. Horace comes back to an empty till."]);
  // Horace, set B
  favor("norfolk", "b", "fight", "Two sailors are rolling across the floor, fighting over the last bottle of rum. Horace looks at you forlornly.",
    FIGHT("*pull them apart by their belts*", "Next man to swing goes into the river."),
    ["They let go of each other, and the bottle.", "They stop, but the bottle smashes on the floor.", "They both turn on you."]);
  favor("norfolk", "b", "tab", "\"That fellow by the door has been drinking on credit for weeks. Think you could have a word?\"",
    TAB("Time to pay the man, friend.", "Pay up or I'll toss you in the river.", "Let's work out a payment plan."),
    ["He empties his pockets onto the bar.", "He hands over a few coins and a rusty knife.", "He bolts out the door and disappears down the alley."]);
  favor("norfolk", "b", "bar", "\"Watch the bar a minute, would you? And don't drink it all.\"",
    BAR("*pour generous servings and tell your best story*"),
    ["Horace returns to a bar filled with raucous laughter.", "Everyone's happy, but the rum barrel is nearly empty.", "A brawl breaks out over your story's ending."]);
  // Ocracoke's keeper (role lines, †, approved)
  favor("ocracoke", "o", "fight", "Two pirates are rolling across the floor, fighting over the last bottle of kill-devil. The keeper looks at you hopefully.",
    FIGHT("*pull them apart by their belts*", "Next man to swing goes in the sound."),
    ["They let go of each other, and the bottle.", "They stop, but the bottle smashes on the floor.", "They both turn on you."]);
  favor("ocracoke", "o", "tab", "\"That fellow by the door has been drinking on credit since spring. Think you could have a word?\"",
    TAB("Time to pay the man, friend.", "*rest your hand on your cutlass*", null),
    ["He empties his pockets onto the bar.", "He hands over a few coins and a rusty knife.", "He bolts out the door and into the dunes."]);
  favor("ocracoke", "o", "bar", "\"Watch the bar a minute, would you? And don't drink it all.\"",
    BAR("*pour generous measures and tell your best story*"),
    ["The sad sacks are laughing for the first time in weeks.", "Everyone's happy, but the rum barrel is nearly empty.", "A brawl breaks out over your story's ending."]);

  Object.keys(scenes).forEach(function (id) { PC.data.scenes[id] = scenes[id]; });

  // How each is presented (§41.1): the place's banner and heading, and who.
  var P = PC.data.nodes.norfolk.present.scenes;
  Object.keys(scenes).forEach(function (id) {
    if (/^nor_fv1/.test(id)) P[id] = { place: "arrival", person: "snodgrass" };
    else if (/^nor_ht_[1-4]$/.test(id)) P[id] = { place: "tavern", heading: "Outside Horace's Tavern" };
    else if (/^nor_ht|^fav_norfolk/.test(id)) P[id] = { place: "tavern", person: "horace" };
    else if (/^nor_godfrey/.test(id)) P[id] = { place: "tavern", person: "godfrey" };
    else if (id === "nor_appr") P[id] = { place: "docks", person: "christoph" };
  });
  PC.data.nodes.norfolk.firstArrival = "nor_fv1";
  PC.data.nodes.norfolk.firstEntry = Object.assign(PC.data.nodes.norfolk.firstEntry || {}, { tavern: ["nor_ht_1", "nor_ht_reentry"] });
})();
