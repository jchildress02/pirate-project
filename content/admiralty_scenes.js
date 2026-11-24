/* Pirate Chronicle — Norfolk's Admiralty House (Milestone 8, PR 5).
 *
 * The lounge (Norfolk first visit, beat 3; Norfolk Scene Records §1), Key's
 * introduction (§39.8, Setpieces Part 2), the notice board's first opening
 * on Freddy Kane's notice (Norfolk Scene Records §2), and Howe's lines
 * (Norfolk Scene Records Part 4 §9-§10). The author's language is final;
 * the menu's rules are in js/admiralty.js.
 *
 * D2 (ruled): Key's close shows the board and assigns A Wanted Man; Freddy
 * isn't at sea until Milestone 9.
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
  var ON = function (to) { return { carry: true }; };

  // ---- 1. The lounge (beat 3) -----------------------------------------------------

  S("nor_lounge", {
    title: "The Admiralty House", where: "Norfolk, the Admiralty House lounge",
    setup: "The Admiralty House is a stately, well-appointed building in the center of town. As you enter through the heavy double doors, you're greeted by the smell of coffee blended with fine incense. You find yourself in a comfortable, wood-paneled lounge, filled with plush armchairs next to polished wooden end tables. Fine art and sprawling tapestries cover every wall as sunlight streams through the windows, bathing the room in a golden glow.\n\n" +
      "On the far side of the lounge, an elegant wooden desk sits in front of an equally elegant mahogany door. A square-jawed young man in a gold naval uniform sits at the desk, deep in concentration as he writes with a red-plumed quill. His face brightens when he notices you walking through the doors.\n\n" +
      "\"Ah, hello! My apologies, I almost didn't notice you,\" he says with a refined London accent, setting down the quill and rising to his feet. \"Welcome to the Admiralty House. I don't believe I've had the pleasure.\"",
    choices: [
      C("Are you Admiral Key?", [], R("The man laughs. \"Oh, goodness no. I'm Lieutenant Howe. The Admiral is my commanding officer.\"", [{ meet: "howe" }], "nor_lounge_2", ON())),
      C("I saw the notice in the tavern. It said you're looking for captains.", [], R("\"Ah, excellent! I didn't think anyone would respond to that advertisement.\" He clears his throat. \"The Admiral will be delighted!\"", [{ meet: "howe" }], "nor_lounge_2", ON()),
        { hiddenUnless: { flag: "saw_howe_advert" } }),
      C("I'm looking to earn some coin.", [], R("\"Then you're in the right place, friend. Our holds are full of the King's gold, and we can make a loyal friend quite rich indeed.\"", [{ meet: "howe" }], "nor_lounge_2", ON())),
    ],
  });

  S("nor_lounge_2", {
    kind: "check", title: "The Admiralty House", where: "Norfolk, the Admiralty House lounge", manyChoices: true,
    setup: "\"Excuse me a moment,\" he says, turning and stepping through the mahogany door behind him, leaving you alone in the lounge.",
    choices: [
      C("Sit in one of the comfortable armchairs.", ["Caution"], R("You fall into a large blue armchair and sink deep. A ray of warm sunlight shines on your face as you close your eyes. You could get used to this.", [{ flag: "lounge_sat" }], "nor_lounge_return", ON())),
      // The tapestry: a Loremaster check (Decipher & Research; Loremaster rerolls it).
      K("Inspect the tapestries.", [], { type: "Decipher & Research", dr: 2 },
        R("You stride over to the wall to get a closer look at a long, colorful tapestry. It depicts Tristan the Wolf, the legendary King of Scotland, through his storied campaigns to unify the highland clans.", [{ flag: "lounge_tapestry" }], "nor_lounge_return", ON()),
        R("You stride over to the wall to get a closer look at a long, colorful tapestry. It depicts a bearded King, fighting a series of battles against kilted, red-haired wildmen.", [{ flag: "lounge_tapestry" }], "nor_lounge_return", ON()),
        R("You stride over to the wall to get a closer look at a long, colorful tapestry. It appears to be about Scottish history: battles, kings, that sort of thing.", [{ flag: "lounge_tapestry" }], "nor_lounge_return", ON())),
      K("Find out what the man was writing.", ["Deceit"], { type: "Decipher & Research", dr: 2 },
        R("You walk toward the desk to take a peek at the book the man was writing in.\n\nYou make out a detailed ledger, summarizing ships, provisions, crew sizes, and guns for a specific station. The station appears to be well-armed and well-supplied.", [], "nor_lounge_ledger", ON()),
        R("You walk toward the desk to take a peek at the book the man was writing in.\n\nIt's a ledger, summarizing provisions, crew sizes, and other important information. The numbers in the book are quite large.", [], "nor_lounge_ledger", ON()),
        R("You walk toward the desk to take a peek at the book the man was writing in.\n\nIt's a ledger, filled with numbers and charts. You can't make heads or tails of it.", [], "nor_lounge_ledger", ON())),
      C("Leave the Admiralty House.", [], R("As you walk towards the door, the Lieutenant reappears. \"Oh, leaving already?\" he calls from behind you. \"No problem. Our door is always open!\"", [{ flag: "lounge_seen" }])),
    ],
  });

  // The second ledger check, as the door opens. DEFAULT: Bluff & Disguise
  // (pretending to study a portrait); the record leaves the skill to the build.
  S("nor_lounge_ledger", {
    kind: "check", title: "The Admiralty House", where: "Norfolk, the Admiralty House lounge",
    setup: "The mahogany door's handle begins to turn.",
    choices: [
      K("Step back from the desk.", ["Deceit"], { type: "Bluff & Disguise", dr: 2 },
        R("You quickly step back from the table and pretend to inspect a portrait on the wall. The officer doesn't seem to suspect anything.", [{ flag: "lounge_ledger" }], "nor_lounge_return", ON()),
        R("You quickly step back from the table and pretend to inspect a portrait on the wall. The officer is surprised to find you so close to his desk, but doesn't indicate any displeasure.", [{ flag: "lounge_ledger" }], "nor_lounge_return", ON()),
        R("You quickly step back from the table, but not before the officer sees you peeking at the ledger. He quickly closes it, and narrows his eyes at you.", [{ flag: "lounge_ledger" }, { flag: "howe_caught_ledger" }], "nor_lounge_return", ON())),
    ],
  });

  S("nor_lounge_return", {
    kind: "beat", title: "The Admiralty House", where: "Norfolk, the Admiralty House lounge",
    setup: [
      { when: { notFlag: "lounge_ledger" }, text: "The mahogany door swings open and the uniformed officer walks back out.\n\n" },
      { when: { flag: "lounge_sat" }, text: "\"Wasted no time in getting yourself comfortable, I see,\" he observes with a wry smile. \"Not that I blame you, I've snuck a nap in that chair plenty of times.\"\n\n" },
      { when: { flag: "lounge_tapestry" }, text: "\"Ah, I see you're admiring the Highland Tapestry of King Tristan. The Admiral insisted on bringing it all the way from Edinburgh. It's quite famous, apparently.\" He lowers his voice. \"They say the Admiral's the finest leader Scotland's had since, but don't tell him I said that.\"\n\n" },
      { when: { notFlag: "howe_caught_ledger" }, text: "\"The Admiral will see you now,\" he says." },
      { when: { flag: "howe_caught_ledger" }, text: "\"The Admiral will see you now,\" he says coldly." },
    ],
    choices: [C("Follow him.", [], R("", [{ flag: "lounge_seen" }], "sp1_key"))],
  });

  // A captain who left the lounge sees Key on his next visit (§17.4.3).
  S("nor_key_again", {
    kind: "beat", title: "The Admiralty House", where: "Norfolk, the Admiralty House lounge",
    firesWhen: { all: [{ flag: "lounge_seen" }, { notFlag: "key_met" }] },
    setup: "Lieutenant Howe looks up from his ledger. \"Ah, Captain. The Admiral will see you now.\"",
    choices: [C("Follow him.", [], R("", [], "sp1_key"))],
  });

  // ---- 2. Key's introduction (§39.8) -----------------------------------------------

  var KEY = { title: "Admiral Key", where: "Norfolk, the Admiralty House: Key's office" };
  function KS(id, o) { S(id, Object.assign({}, KEY, o)); }

  KS("sp1_key", {
    setup: "The Lieutenant leads you through the door and up a winding series of carpeted spiral staircases, until you reach a nondescript door in the middle of a hallway. He holds the door as you enter.\n\n" +
      "You find yourself in a dim, chaotic room with maps covering every wall, shocking your senses compared to the calm, clean lounge that you left behind. The drapes are drawn shut, and a gigantic square table dominates the center of the room, upon which sit stacks of ledgers, maps, charts, and a large globe. More books are crammed into several bookcases and piled up along the edges of the room, their titles written in a number of different languages. Amongst the chest-high stacks, however, are two more of those plush armchairs, and a small, simple end-table.\n\n" +
      "The man hunched over the table isn't exactly the spitting image of an admiral. He's dressed in a simple white shirt and worn boots, with brown hair pulled into a short ponytail. He's younger than you might have expected, no older than about thirty-five, with a soft, youthful complexion and rosy red cheeks. He takes a step back from the table as you walk in and smiles warmly.\n\n" +
      "\"Welcome, friend,\" he greets you with a light Scottish lilt, his bright blue eyes meeting your gaze directly. \"Who might you be?\"",
    choices: [
      C("Bow and address him formally: My Lord, if it please you, my name is Captain {captain.full} of [Home City].", [], R("He bows his head in response. \"Ah, a refined {captain.gentleman}. The pleasure is all mine, Captain {captain.last}.\"", [{ hook: "key_meet" }], "sp1_key_2", ON())),
      C("Address him directly: I'm Captain {captain.last}. Are you Admiral Key?", [], R("\"I am.\" He nods. \"It's a pleasure to meet you.\"", [{ hook: "key_meet" }], "sp1_key_2", ON())),
      C("Address him cautiously: I'm just a captain who's looking to earn some coin.", [], R("\"That will do just fine, then.\"", [{ hook: "key_meet" }], "sp1_key_2", ON())),
    ],
  });

  KS("sp1_key_2", {
    setup: "\"I'm glad you came to visit me,\" he says, walking over to the nearest window and pulling back the drapes to douse the room in sunshine and expose an unbroken view of the tremendous warships that slumber in the harbor. \"We'll take all the help we can get.\"\n\n" +
      "You hear a light knock at the door, before Lieutenant Howe edges into the room carrying a fine silver platter with a gleaming coffee pot and two sets of expensive china. The Admiral perks up.\n\n\"Ah, perfect. Do you drink coffee?\" he asks.",
    choices: [
      C("As a matter of fact, I love coffee.", [], R("\"Excellent, then you'll love this. Arabica, from the Near East. Although I will warn you that it's rather robust.\"", [{ flag: "took_coffee" }, { flag: "coffee_love" }], "sp1_key_3", ON())),
      C("I'll confess that I've not had it much.", [], R("\"I'd encourage you to give it a try. This variety is a favorite of mine.\"", [{ flag: "took_coffee" }, { flag: "coffee_new" }], "sp1_key_3", ON())),
      C("It's not to my taste.", [], R("\"I see. Well, I hope you won't mind me partaking.\"", [], "sp1_key_3", ON())),
    ],
  });

  var noCoffee = { lockedUnless: { flag: "took_coffee" }, lockedReason: "You didn't take a cup" };
  KS("sp1_key_3", {
    setup: [
      { when: { flag: "took_coffee" }, text: "He motions to the armchairs, and the two of you sit as Lieutenant Howe pours you each a cup of aromatic, piping hot coffee.\n\n" },
      { when: { notFlag: "took_coffee" }, text: "He motions to the armchairs, and the two of you sit as Lieutenant Howe pours the Admiral a cup of aromatic, piping hot coffee.\n\n" },
      "\"Thank you, Lieutenant,\" the Admiral says to his subordinate, before he leans towards you and whispers in a conspiratorial tone, \"The lieutenant thinks I drink too much coffee. I say a man's allowed to have his small pleasures.\" He smiles slyly at the Lieutenant, who smirks, bows his head, and exits the room.\n\n" +
      "The Admiral takes a careful sip from his cup. \"Mm, perfect.\" He stares at you silently for a long moment, the easy smile still on his lips.",
    ],
    choices: [
      C("Drink the coffee eagerly", [], R("It's bitter, but underneath are complex notes of cardamom and clove. The Admiral nods.", [], "sp1_key_4", ON()), noCoffee),
      C("Drink the coffee politely", [], R("The Admiral nods approvingly.", [], "sp1_key_4", ON()), noCoffee),
      C("Tell him to get to the point", [], R("This elicits a chuckle from the Admiral.", [], "sp1_key_4", ON())),
      // Regard +1 (placeholder): he respects the fire (§39.8).
      C("Stare back", [], R("The two of you stare each other down for a long moment. Is that a hint of fire behind those placid blue eyes?", [{ hook: "key_regard", delta: 1 }], "sp1_key_4", ON())),
    ],
  });

  KS("sp1_key_4", {
    manyChoices: true,
    setup: "\"You know,\" he finally says, breaking your gaze, \"we've had that notice up in the tavern since we got here. In all that time, you're the first captain to pay us a visit.\"\n\n" +
      "\"In truth, I can hardly blame them. Who would want us here, after Deadman sent the last fleet to the bottom of the sea? After Scotland abandoned Avalon, and let the French rampage up and down the coast for the better part of two years? What does Scotland have left to give them?\"\n\n" +
      "He casts his eyes out the window to the harbor beyond.\n\n" +
      "\"Scotland's an old goat,\" he continues, \"but she's still got some fight left in her. That big one out there is the *Griffon*, my flagship. The largest and finest warship ever to sail the seas, with a hundred guns and over two hundred experienced and battle-hardened men aboard. She's accompanied by two ships of the line, half a dozen frigates, and dozens of sloops, brigs, barques, and supply ships. It is, without a doubt, the greatest fleet this side of the ocean.\"\n\n" +
      "\"But.\" He lowers his voice.\n\n\"The fleet is all we have,\" he says. \"It's no secret that Scotland's seen better days, that her aging king sits on the throne of a crumbling empire.\"\n\n" +
      "\"There are those here in Avalon who would take advantage of that fact. The French already have. Our own subjects appear to be discussing certain ideas about self-government.\"\n\n" +
      "\"We could use that grand fleet to defend Scotland's shores against invasion. Or to join the war raging in Europe. Or conquer new lands far afield. But instead, she's here. In Avalon.\"\n\n" +
      "\"What I'm trying to impress upon you is that Scotland is not dead yet.\" His voice rises in intensity as he leans in. \"While I live, Scotland lives. This is our opportunity to restore peace, to restore the people's faith in their nation. I do not intend to squander it.\"\n\n" +
      "His youthful face is now fixed in a grim, serious expression. \"So here is my offer: The Crown's gold, spoils of two hundred years of empire, are yours for the taking if you fight alongside us. Nobody else can offer what I offer. You'll not find a better friend than me on this side of the world.\"\n\n" +
      "He glances out at the gargantuan ships in the harbor. It's an offer, and a threat.\n\n" +
      "He grabs a small envelope sitting atop a nearby pile of books and places it on the table.\n\n" +
      "\"That is a letter of marque with my seal. It makes you a privateer of Avalon, licensed to seize any ship that is an enemy of the Crown, and everything aboard her. Whatever you take under it is a lawful prize. You may sell it openly, in any honest market, at an honest price, instead of hawking it to some back-alley fence for half its worth. Avalon's harbors will treat you as a friend. And most importantly, you'll have the faith and protection of that fleet sitting in the harbor. All you promise in return is to let Avalon's ships pass unhindered.\"\n\n" +
      "\"Can I count on you?\"",
    choices: [
      C("Read the letter.", [], R("It's just as he says—a license to hunt for Avalon. There is, however, mention of a small tax paid to the Crown on all plundered goods, a fact that the Admiral has conveniently left out.", [{ flag: "key_letter_read" }], "sp1_key_4"),
        { info: true, hiddenUnless: { notFlag: "key_letter_read" } }),
      C("Accept the letter", [], R("He smiles wide as you take the letter. \"You've made the right decision. Now it's my responsibility to prove it to you.\"", [{ hook: "key_letter" }, { flag: "key_letter_accepted" }], "sp1_key_close", ON()),
        { lockedUnless: { fn: "canTakeKeyLetter" }, lockedReason: "Needs Avalon Standing 0 or better" }),
      C("Tell him that you need to think about it.", [], R("Disappointment flashes across his eyes, but he nods. \"I understand. The offer stands whenever you're ready for it.\"", [{ flag: "key_letter_pending" }], "sp1_key_close", ON())),
      C("Refuse the letter", [], R("\"I see.\" He casts his eyes downward, clearly disappointed.", [{ flag: "key_letter_refused" }], "sp1_key_close", ON())),
    ],
  });

  KS("sp1_key_close", {
    kind: "beat",
    setup: "The Admiral finishes his coffee and stands up, prompting you to do the same.\n\n" +
      "\"There is one matter you could help us with. You'll find it on the notice board on your way out.\"\n\n" +
      "The Admiral bows his head and gestures to the door.\n\n" +
      "The Lieutenant is there to meet you and escort you back down the stairs. He does so in silence.\n\n" +
      "The spacious lounge is like a deep exhale after the cramped interior of the office and hallways above. The Lieutenant sits back down and continues writing in his ledger with the red-plumed quill.\n\n" +
      "Beside the front doors hangs a board you didn't notice on the way in. A single notice is pinned to it, the ink barely dry.",
    choices: [C("Read the notice", [], R("", [
      // Caught reading Howe's ledger: Key's regard -1, applied here (§17.4.7).
      { hook: "key_regard", delta: -1, when: { flag: "howe_caught_ledger" } },
      { flag: "key_met" }, { flag: "a_wanted_man_assigned" }, { flag: "admiralty_board_open" },
    ], "nor_board_freddy"))],
  });

  // ---- 3. The notice board: Freddy Kane's notice (Norfolk Scene Records §2) ------
  // D2: assigned now; Freddy isn't at sea until Milestone 9.
  S("nor_board_freddy", {
    kind: "beat", title: "The Notice Board", where: "Norfolk, the Admiralty House",
    setup: "WANTED\nby Order of the Admiralty of Avalon\n\nFREDERICK KANE, called \"FREDDY FEARLESS\"\n\nFor piracy against the shipping of Avalon. A known associate of Amber Jack.\nLast seen near Ocracoke. Sails the *Deadly Delight*, a well-armed sloop.\n\nHANDSOME REWARD\n1,500 gold alive · 750 gold dead\n\nBy order of Admiral James Key. Inquire with Lt. Howe, the Admiralty House, Norfolk.\n\n(Key's wax seal) · Assigned to Captain {captain.last}",
    choices: [C("Continue", [], R(""))],
  });

  Object.keys(scenes).forEach(function (id) { PC.data.scenes[id] = scenes[id]; });

  // Presentation: the Admiralty House banner; Howe in the lounge, Key upstairs (§41.1).
  var P = PC.data.nodes.norfolk.present.scenes;
  Object.keys(scenes).forEach(function (id) {
    P[id] = /^sp1_key/.test(id) ? { place: "admiralty", person: "key" } : /^nor_board/.test(id) ? { place: "admiralty" } : { place: "admiralty", person: "howe" };
  });
  // The lounge plays on first entering the Admiralty House; after a captain
  // who left it, Key's audience opens the next visit (§17.4.3).
  PC.data.nodes.norfolk.firstEntry = Object.assign(PC.data.nodes.norfolk.firstEntry || {}, { admiralty: ["nor_lounge", "nor_key_again"] });
  delete PC.data.nodes.norfolk.locations.admiralty.locked;
})();
