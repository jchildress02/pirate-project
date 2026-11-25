/* Pirate Chronicle — A Wanted Man (Keychain #1; Norfolk Scene Records §3;
 * Milestone 9, PR 4), and Key's Spyglass at Trusted (Part 4 §10, D9).
 *
 * D2 (ruled): Freddy only. Gauthier's record is here as data, untested.
 * The turn-in plays the version before the Battle of Ocracoke (the plan,
 * Finch) and sets the flags M10's invitation reads. The author's language
 * is final; the rules are in js/wanted.js.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};
  PC.data.scenes = PC.data.scenes || {};

  PC.data.wantedMan = {
    SPAWN: 0.50,              // a batch in the Hatteras Banks (placeholder)
    WATERS: "north",
    ALIVE: 1500, DEAD: 750,   // placeholders
    RELEASE_STANDING: 5,      // Pirate Standing for letting Freddy go
    KILL_DREAD: 3,            // a captain who has yielded
    KILL_STANDING: -5,        // Freddy only: one of Jack's men executed
    TROPHY_DREAD: { head: 2, hand: 1 },
    targets: {
      freddy: {
        name: "Freddy Fearless", full: "Frederick Kane", short: "Freddy", formal: "Mr. Kane", ship: "Deadly Delight", cls: "Sloop",
        rating: 3, resolve: 4, gunnery: 2, neverRuns: true, item: "Freddy's Cutlass",
        rumor: "\"Freddy Fearless has apparently been on a tear up and down the Hatteras Banks. They say he never runs from a fight.\"",
        cue: "She flies a black flag and you spy a large bald captain barking orders to his crew.",
        barks: {
          hail: "\"So you're the one that the Admiral sent after me! I'll be sure to leave an impression.\"",
          grapple: "\"Good, come closer! Let Freddy gut you up close!\"",
          repel: "\"Follow me! Rip them apart, boys!\"",
          challenge: "\"Do I frighten you? Because you don't scare me.\"",
          duelWon: "\"Alright, alright, calm down! I yield.\"",
          duelLost: "\"I knew you were going to be a pushover.\"",
          crewBreak: "A cry rings out. \"Freddy's down! Strike the colors!\"",
          crewStrike: "\"Cowards! Get back here and fight!\"",
          killed: "\"Tell Jack... I never ran.\"",
        },
        irons: "Freddy sits in irons on your deck, grinning through a split lip. \"Go on then, Captain. Finish it.\"",
        outcomes: {
          bring: "Freddy clenches his jaw. \"I see. You're too weak to do what needs to be done.\"",
          release: "You unshackle him and escort him to the ship's boat. \"I won't forget this,\" Freddy says, looking you dead in the eye. He rows for Ocracoke without looking back.",
          kill: "\"Tell Jack... I never ran,\" he whispers with his last breath, before you slice his throat.",
          head: "Your crew watches on as you separate his head from his neck. When you're finished, you wrap your trophy in sailcloth.",
          hand: "A hand should be sufficient. You wrap it in sailcloth and store it in your cabin.",
          nothing: "You dump the body over the side and watch it sink into the depths. Not worth wasting a perfectly good hammock.",
        },
      },
      // Untested (D2): the target after the Battle of Ocracoke.
      gauthier: {
        name: "Philippe Gauthier", full: "Philippe Gauthier", short: "Gauthier", formal: "Monsieur Gauthier", ship: "Sardine", cls: "Sloop",
        rating: 3, resolve: 4, gunnery: 1, triesToRun: true, item: "Gauthier's Plumed Hat",
        rumor: "\"That French pirate Gauthier has been spotted around the Hatteras Banks. They say he always tries to avoid a fight.\"",
        cue: "A captain with a large mustache and a white-plumed hat strides nervously up and down the deck.",
        barks: {
          hail: "\"Avalon swine! I will take your ship and throw you into la mer!\"",
          grapple: "\"I will run you through with my sword!\"",
          repel: "\"I am coming to kill you, Captain!\"",
          challenge: "\"Come. See what French steel tastes like.\"",
          duelWon: "\"Sacrebleu! You are too strong.\"",
          duelLost: "\"You are weak! I spit on you!\"",
          crewBreak: "\"Amenez le pavillon !\"",
          crewStrike: "\"Enough! We strike our colors!\"",
          killed: "\"I am defeated! A travesty!\"",
        },
        irons: "Gauthier sits in irons on your deck, chin held high in defiance. \"Do what you must, Capitaine.\"",
        outcomes: {
          bring: "The Frenchman lets out a deep sigh. \"Better a cell than the bottom of the sea, I suppose.\"",
          release: "You unshackle him and escort him to the ship's boat. He sweeps off his white-plumed hat and presents it to you with a deep bow. \"Merci, Capitaine. You are a true gentleman. Adieu.\" He rows toward land without looking back.",
          kill: "\"I am defeated! A travesty!\" he cries, before you slice his throat.",
          head: "Your crew watches on as you separate his head from his neck. When you're finished, you wrap your trophy in sailcloth.",
          hand: "A hand should be sufficient. You wrap it in sailcloth and store it in your cabin.",
          nothing: "You dump the body over the side and watch it sink into the depths. Not worth wasting a perfectly good hammock.",
        },
      },
    },
    // Journal objectives (Norfolk Scene Records §3, drafted for approval).
    journal: {
      assigned: "Bring in Freddy Fearless, dead or alive. He was last seen near Ocracoke.",
      rumor: "Freddy Fearless is raiding the Hatteras Banks. Hunt him there.",
      taken: "Return to the Admiralty House in Norfolk for your reward.",
      spared: "Return to the Admiralty House in Norfolk. Key will want an answer.",
      invited: "Return to the Admiralty House in Norfolk during Hurricane season to join the attack on Ocracoke.",
      declined: "If you change your mind, return to the Admiralty House in Norfolk during Hurricane season.",
      unfinished: "The Admiral wasn't finished with you. Return to the Admiralty House in Norfolk.",
    },
  };

  // His rumor (§3 stage 1): a Quest rumor at any port while he's at large;
  // heard, it guarantees him in the next batch in the Hatteras Banks.
  if (PC.data.rumors && PC.data.rumors.pool) PC.data.rumors.pool.push({ id: "wm_freddy", type: "Quest", tier: "B", wanted: true, text: PC.data.wantedMan.targets.freddy.rumor });

  // ---- The scenes (Norfolk Scene Records §3, stage 4: before the Battle of Ocracoke) ----

  var scenes = {};
  function S(id, o) {
    o.id = id; o.ap = o.ap || 0; o.repeat = o.repeat || "once"; o.kind = o.kind || "choice";
    o.where = o.where || "Norfolk, the Admiralty House lounge"; o.title = o.title || "A Wanted Man";
    o.choices.forEach(function (c, i) { c.id = c.id || "c" + i; c.approval = c.approval || []; });
    scenes[id] = o;
  }
  function R(text, effects, exit, more) { return Object.assign({ text: text || "", effects: effects || [], exit: exit || "hub" }, more || {}); }
  function K(label, approval, check, clean, partial, setback, more) {
    return Object.assign({ label: label, approval: approval, check: check, outcomes: { clean: clean, partial: partial, setback: setback } }, more || {});
  }
  function C(label, approval, result, more) { return Object.assign({ label: label, approval: approval, result: result }, more || {}); }
  var ON; // no carry: the next scene shows its own setup under this result
  var ALIVE = { flag: "wanted_alive" }, SPARED = { flag: "wanted_spared" };
  var TROPHY = { any: [{ flag: "trophy_head" }, { flag: "trophy_hand" }] };
  var LIE = { check: { type: "Bluff & Disguise", dr: 2 } }; // DR 2: DEFAULT (the record names none)

  // The claims (§3 stage 4): a lie only when he was spared; the engine knows.
  function claim(label) {
    return [
      C(label, [], R("\"Excellent work,\" he responds, peering deeply into your eyes. \"I'm sure we won't be seeing him again.\"", [], "nor_wm_shared", ON), { hiddenUnless: { all: [{ not: ALIVE }, { not: SPARED }] } }),
      K(label, ["Deceit"], LIE.check,
        R("\"Good. I'm sure we won't be seeing him again.\"", [], "nor_wm_shared", ON),
        R("\"Good.\" He holds your gaze for a moment longer than is comfortable.", [{ flag: "key_suspects" }], "nor_wm_shared", ON),
        R("He purses his lips. \"I see.\"", [], "nor_wm_setback", ON),
        { hiddenUnless: SPARED }),
    ];
  }

  S("nor_wm_turnin", {
    kind: "check", // one Bluff & Disguise roll on a lie
    firesWhen: { fn: "wmTurninReady" },
    setup: [
      { when: ALIVE, text: "You haul Freddy Fearless into the Admiralty House and find the lounge is as bright and spacious as you remembered.\n\n" },
      { when: { not: ALIVE }, text: "You enter the Admiralty House and find the lounge is as bright and spacious as you remembered.\n\n" },
      "You notice three gold-uniformed men sitting in the center of the room on those plush armchairs. You immediately recognize Admiral Key among them, wearing his coat and appearing slightly more distinguished this time, although his short brown ponytail is still tied somewhat haphazardly. Across from him is a burly man with broad shoulders and thick black mutton chops, and to the Admiral's left, a tall blonde officer with beady eyes that seem too close together. Lieutenant Howe is standing at attention behind the Admiral.\n\n" +
      "\"Ah, what a pleasant surprise!\" Key exclaims, setting down his coffee as the three men rise to their feet. \"Gentlemen, this is the captain I was telling you about.\"",
      { when: ALIVE, text: "\n\n\"And you must be Freddy Fearless,\" he says, peering at the prisoner, seemingly bemused. \"I've been looking forward to meeting you.\"\n\n" +
        "\"I'm not scared of you,\" Freddy spits, meeting the Admiral's gaze.\n\n" +
        "\"Oh, I don't intend to scare you,\" the Admiral responds. \"You are Freddy Fearless, after all. But I do intend to make you talk.\"\n\n" +
        "\"Lieutenant, would you please escort our guest to his accommodations downstairs?\" The Lieutenant does as he's ordered, grabbing the pirate by the arm roughly and leading him out of the lounge." },
      { when: { not: ALIVE }, text: "\n\n\"And what of our friend Mr. Kane?\"" },
    ],
    choices: [
      C("Continue", [], R("", [{ hook: "wm_hand_over" }], "nor_wm_shared", ON), { hiddenUnless: ALIVE }),
    ].concat(claim("He's dead."), claim("He went down with his ship."), [
      C("Throw the head onto the table.", ["Cruelty"], R("Admiral Key and the burly officer don't seem to react. The younger blonde officer appears to startle. Lieutenant Howe looks positively horrified.\n\n" +
        "\"Well then,\" says the Admiral, seemingly amused. \"I suppose that settles it. Lieutenant Howe, would you be so kind as to dispose of this?\" The Lieutenant wastes no time in delicately whisking the head away to a back room.", [], "nor_wm_shared", ON), { hiddenUnless: { flag: "trophy_head" } }),
      C("Throw the hand onto the table.", ["Cruelty"], R("Admiral Key and the burly officer don't seem to react. The younger blonde officer appears to startle. Lieutenant Howe looks positively horrified.\n\n" +
        "\"Well then,\" says the Admiral, seemingly amused. \"I suppose that settles it. Lieutenant Howe, would you be so kind as to dispose of this?\" The Lieutenant wastes no time in delicately whisking the hand away to a back room.", [], "nor_wm_shared", ON), { hiddenUnless: { flag: "trophy_hand" } }),
      C("He's dead. I have proof, if you require it.", [], R("\"That won't be necessary,\" responds the Admiral, peering deeply into your eyes. \"I trust you.\"", [], "nor_wm_shared", ON), { hiddenUnless: TROPHY }),
    ]),
  });

  // SETBACK: the lie is caught.
  S("nor_wm_setback", {
    setup: "\"Thank you for your service, Captain,\" he says through gritted teeth as the Lieutenant steps forward with your gold. \"Keep an eye on the notice board for other tasks that are...less challenging. I bid you good day.\" The Admiral motions toward the front door. You depart without another word.",
    choices: [C("Leave the Admiralty House", [], R("", [
      { gold: 750, pot: "purse" }, { hook: "key_regard", delta: -2 }, { flag: "key_side_locked_ocracoke" }, { flag: "key_suspects" },
      { flag: "wm_paid" }, { flag: "a_wanted_man_done" }]))],
  });

  // SHARED: Brady and Finch, then coffee.
  var HOWE_BACK = { any: [ALIVE, TROPHY] }; // Howe left the room (the alive and trophy paths)
  function coffee(withLeave) {
    var out = [
      C("You already know I'm quite keen on your Arabica.", [], R("The Admiral flashes a knowing smile.", [{ flag: "wm_coffee" }], "nor_wm_plan", ON), { hiddenUnless: { flag: "coffee_love" } }),
      C("Certainly. You've won me over.", [], R("The Admiral appears proud of himself.", [{ flag: "wm_coffee" }], "nor_wm_plan", ON), { hiddenUnless: { flag: "coffee_new" } }),
      C("Yes, please.", [], R("", [{ flag: "wm_coffee" }], "nor_wm_plan", ON)),
      C("No, thank you.", [], R("", [], "nor_wm_plan", ON)),
    ];
    if (withLeave) out.push(C("Actually, I've got somewhere else I need to be.", [], R("The Admiral seems taken aback. \"Ah, well, I won't keep you.\" The Lieutenant brings your reward and you leave without another word.", [
      { gold: 1500, pot: "purse", when: ALIVE }, { gold: 750, pot: "purse", when: { not: ALIVE } }, { hook: "key_regard", delta: 1 },
      { flag: "wm_regard" }, { flag: "wm_paid" }, { flag: "turnin_unfinished" }, { flag: "a_wanted_man_done" }])));
    return out;
  }
  S("nor_wm_shared", {
    setup: "\"Captain, this is Vice-Admiral Brady, my second in command,\" Admiral Key says, as the whiskered, burly officer bows his head.\n\n" +
      "\"And this,\" he gestures to the younger, blonde-haired man, \"is Commodore Finch.\" The Commodore nods curtly.\n\n" +
      "\"The Vice-Admiral was just leaving, unfortunately.\" As his subordinate turns to leave, Key grabs him by the arm and whispers something in his ear. You only make out a few words: \"...if you find him, don't engage yet...\" before the Vice-Admiral nods dutifully and departs.\n\n" +
      "The Admiral turns back to you and the Commodore.\n\n\"Please, sit,\" he encourages you. \"Coffee?\"\n\nThe Commodore shakes his head.",
    choices: coffee(true),
  });

  // RETURN: the next entry, before the squadron sails.
  S("nor_wm_return", {
    firesWhen: { all: [{ flag: "turnin_unfinished" }, { maxYear: 1754 }, { season: ["Spring", "Summer", "Hurricane"] }] },
    setup: "As you enter the Admiralty House, you find Admiral Key sitting in one of the plush armchairs beside Commodore Finch, a fresh pot of coffee between them.\n\n" +
      "\"Ah, there you are,\" Key says with a smile. \"We didn't get to finish our conversation.\" The Commodore looks displeased.\n\n\"Please, sit,\" he encourages you. \"Coffee?\"",
    choices: coffee(false),
  });

  // The plan, and the ask.
  S("nor_wm_plan", {
    setup: [
      { when: { flag: "wm_coffee" }, text: "As you take a seat in one of the soft armchairs, the Admiral pours you a cup of coffee himself, before topping off his own and sinking into the chair opposite you, next to the Commodore. He lets out a deep sigh.\n\n" },
      { when: { not: { flag: "wm_coffee" } }, text: "As you take a seat in one of the soft armchairs, the Admiral refills his coffee and sinks into the chair opposite you, next to the Commodore. He lets out a deep sigh.\n\n" },
      "\"I don't know about you, but I think these might just be the most comfortable chairs I've ever sat in. I can't spend too much time out here, otherwise I'd never get anything done!\" He laughs to himself. \"Lord knows I've caught the lieutenant napping out here on more than one occasion.\" The Commodore does not appear amused.",
      { when: { any: [{ flag: "turnin_unfinished" }, { not: HOWE_BACK }] }, text: " The Lieutenant shifts uncomfortably." },
      "\n\n\"Regardless,\" the Admiral addresses you, \"I'm glad you were able to track down our good friend Freddy. And I'm glad you came back. I'm dispatching Commodore Finch here on an assignment, and I think you could be of some service.\"\n\n" +
      "Next to the Admiral, Commodore Finch's already curdled face turns fully sour. The Admiral is looking directly at you, and doesn't seem to notice.\n\n" +
      "\"I've commanded Commodore Finch to lead a squadron to seize the pirate haven at Ocracoke,\" says the Admiral, taking a sip of coffee. \"Those brigands have threatened our people for too long.\"\n\n" +
      "\"We don't expect the island to be particularly well-defended,\" he continues, setting down his cup, \"but the pirates have seen their fair share of battle, and they tend to be crafty.\"\n\n" +
      "\"The Commodore will command the *Resolute* into battle—she's our third-biggest ship, and just the sight of her may be enough to break the pirates' will to resist. But if not, the squadron sails with two hundred trained marines, ready to storm the beach and capture the harbor.\"\n\n" +
      "\"I'd like you to join that attack.\"\n\n" +
      "The Commodore, who has been silent since you arrived, finally speaks up. His voice is softer than you would have expected for a man of his height.\n\n" +
      "\"Admiral, the squadron is surely sufficient already,\" he protests. \"We have no need for an unproven privateer.\" He shoots you a suspicious glance.\n\n" +
      "\"It's an order,\" the Admiral responds coldly, without even looking at him. A tense, silent moment passes before the Commodore, chastened, casts his eyes downward.\n\n" +
      "\"In any case,\" the Admiral finally says, the soft smile returning to his face, \"Captain {captain.last} has indeed proven {captain.himself} to be dependable.\"\n\n" +
      "\"So, Captain, can I count on you once again? Will you join the attack on Ocracoke?\"",
    ],
    choices: [
      C("Of course. It would be an honor.", ["Honor"], R("\"You continue to surprise me, Captain. I assure you that you'll be well compensated for your trouble.\"", [{ flag: "ocracoke_invited" }], "nor_wm_close", ON)),
      C("Only if there's gold behind it.", ["Plunder"], R("\"I admire your focus. Yes, you will be well compensated.\"", [{ flag: "ocracoke_invited" }], "nor_wm_close", ON)),
      C("I'll need to think about it.", ["Caution"], R("\"I understand. It's a lot to ask of a privateer, and not exactly what you signed up for.\"", [{ flag: "ocracoke_declined" }], "nor_wm_close", ON)),
      C("Find somebody else.", ["Defiance"], R("\"I understand,\" he says, disappointed. The Commodore, however, looks relieved.", [{ flag: "ocracoke_declined" }], "nor_wm_close", ON)),
    ],
  });

  var INVITED = { flag: "ocracoke_invited" }, HURRICANE = { season: "Hurricane" };
  S("nor_wm_close", {
    setup: [
      "The Admiral smiles and rises to his feet, prompting you and the Commodore to do the same.",
      { when: { all: [{ not: { flag: "wm_paid" } }, HOWE_BACK] }, text: "\n\nAt that moment, Lieutenant Howe reappears with a hefty pouch of gold. \"Your reward for the bounty,\" he says. You accept it quickly." },
      { when: { all: [{ not: { flag: "wm_paid" } }, { not: HOWE_BACK }] }, text: "\n\nAt that moment, Lieutenant Howe steps forward with a hefty pouch of gold. \"Your reward for the bounty,\" he says. You accept it quickly." },
      { when: { not: { flag: "key_letter_accepted" } }, text: "\n\nThe Lieutenant also hands you a sealed envelope. \"And here's the Admiral's letter of marque. We thought you might reconsider.\"" },
      { when: { all: [INVITED, { not: HURRICANE }] }, text: "\n\n\"Come back after the end of summer, once we have the plans and necessary provisions in place,\" says the Admiral. \"I look forward to your return.\"" },
      { when: { all: [INVITED, HURRICANE] }, text: "\n\n\"Come back shortly, once we have the plans and necessary provisions in place,\" says the Admiral. \"I look forward to your return.\"" },
      { when: { all: [{ not: INVITED }, { not: HURRICANE }] }, text: "\n\n\"Come back after the end of summer if you change your mind,\" the Admiral says. \"I wish you good fortune.\"" },
      { when: { all: [{ not: INVITED }, HURRICANE] }, text: "\n\n\"Come back shortly if you change your mind,\" the Admiral says. \"I wish you good fortune.\"" },
      "\n\nHe nods, and you leave the Admiralty House.",
    ],
    choices: [C("Continue", [], R("", [
      { gold: 1500, pot: "purse", when: { all: [ALIVE, { not: { flag: "wm_paid" } }] } },
      { gold: 750, pot: "purse", when: { all: [{ not: ALIVE }, { not: { flag: "wm_paid" } }] } },
      { hook: "key_regard", delta: 1, when: { not: { flag: "wm_regard" } } },
      // The letter: accepted (binding) on Choices 1-2; Howe's standing offer on 3-4.
      { hook: "key_letter", when: { all: [INVITED, { not: { flag: "key_letter_accepted" } }] } },
      { flag: "key_letter_accepted", when: INVITED },
      { flag: "key_letter_pending", when: { all: [{ not: INVITED }, { not: { flag: "key_letter_accepted" } }] } },
      { flag: "wm_regard" }, { flag: "wm_paid" }, { flag: "a_wanted_man_done" }, { flag: "turnin_unfinished", value: false }]))],
  });

  // ---- Key's Spyglass at Trusted (Part 4 §10; D9) ---------------------------------
  S("nor_key_spyglass", {
    title: "Key's Spyglass", where: "Norfolk, the Admiralty House",
    firesWhen: { fn: "keyTrusted" },
    setup: "Lieutenant Howe catches you in the lounge. \"The Admiral asked for you, Captain. He said it's personal.\"\n\n" +
      "You meet the Admiral in his office, where he holds out a battered glass spyglass. \"This went to sea with me on my very first voyage. She's seen the world with me. I'd like you to have it.\"",
    choices: [
      C("I can't take this.", ["Honor"], R("\"You can, and you will. Consider it an order.\"", [{ item: "Key's Spyglass" }])),
      C("I'll take good care of it.", ["Honor"], R("\"I know you will.\"", [{ item: "Key's Spyglass" }])),
      C("Why me?", [], R("\"Because you've earned it. Few have.\"", [{ item: "Key's Spyglass" }])),
    ],
  });

  Object.keys(scenes).forEach(function (id) { PC.data.scenes[id] = scenes[id]; });
  var P = PC.data.nodes.norfolk.present.scenes;
  Object.keys(scenes).forEach(function (id) { P[id] = { place: "admiralty", person: "key" }; });
  // Entering the Admiralty House: the turn-in, the return and the Spyglass
  // after the lounge and Key's introduction (the first that can play).
  var FE = PC.data.nodes.norfolk.firstEntry = PC.data.nodes.norfolk.firstEntry || {};
  FE.admiralty = (FE.admiralty || []).concat(["nor_wm_turnin", "nor_wm_return", "nor_key_spyglass"]);
})();
