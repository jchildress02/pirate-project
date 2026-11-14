/* Milestone 0 test content.
 *
 * ENGINE TEST ONLY. The prose here is placeholder written to exercise the
 * engine: checks, a stat override and a two-stat pair, a locked and a hidden
 * choice, a reroll, the purse-or-crew prompt, variant lines and pronoun
 * tokens. None of it is canon; Ocracoke's real scenes replace it in the next
 * milestone.
 *
 * Scene fields follow the §33 blank record:
 *   id, kind ("check" | "choice" | "beat"), where, ap, firesWhen,
 *   repeat ("once" | "season"), conditions, cast, setup, variants, choices.
 * Choice fields:
 *   id, label, cost { gold, pot }, lockedUnless + lockedReason, hiddenUnless,
 *   check { type, stat?, stat2?, dr }, approval [...],
 *   outcomes { clean, partial, setback }  (with a check)
 *   result                                 (without one)
 * Each outcome: { text, effects: [...], exit: "scene_id" | "hub" }.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.start = { scene: "eng_test_gangway", hub: "test_harbor" };

  PC.data.npcs = {
    hob: { first: "Hob", last: "", gender: "m", role: "dockhand", test: true },
  };

  PC.data.hubs = {
    test_harbor: {
      title: "The Test Harbor",
      text: "A stand-in for a port menu, so the engine has somewhere to return to. The real Ocracoke menus arrive with the next milestone.",
      entries: [
        { label: "The gangway", scene: "eng_test_gangway" },
        { label: "Drink at the test tavern", scene: "eng_test_tavern" },
      ],
    },
  };

  PC.data.scenes = {
    eng_test_gangway: {
      id: "eng_test_gangway",
      kind: "check",
      title: "The Gangway",
      where: "Test Harbor, Docks",
      ap: 0,
      repeat: "once",
      conditions: ["Harbor"],
      cast: ["hob"],
      setup:
        "A dockhand sits on a crate across the end of your gangway, eating an apple.\n\n" +
        "\"Gangway fee,\" {hob.he} says. \"Twenty gold. Or you can swim out to [Ship Name].\"",
      variants: [
        { when: { tag: "Brute" }, line: "{hob.He} takes in the size of you and moves the apple behind {hob.his} back." },
      ],
      choices: [
        {
          id: "talk",
          label: "Talk him into waiving the fee.",
          check: { type: "Persuade", dr: 2 },
          approval: ["Honor"],
          outcomes: {
            clean: { text: "\"Ah, go on, then.\" He shifts the crate with his boot.", effects: [{ ladder: { npc: "hob", delta: 1 } }, { flag: "test_gangway_free" }], exit: "eng_test_beat" },
            partial: { text: "\"Half,\" he says. \"I've got a family. Probably.\"", effects: [{ gold: -10, pot: "crew" }], exit: "eng_test_beat" },
            setback: { text: "\"Thirty now. For wasting my time.\"", effects: [{ gold: -30, pot: "crew" }], exit: "eng_test_beat" },
          },
        },
        {
          id: "lean",
          label: "Lean over him until he finds somewhere else to sit.",
          check: { type: "Intimidate", dr: 2 },
          approval: ["Cruelty"],
          outcomes: {
            clean: { text: "He finds somewhere else to sit. Somewhere quite far away.", effects: [{ dread: 3 }], exit: "eng_test_beat" },
            partial: { text: "He moves, but he takes the crate with him, and the crate was holding up the plank.", effects: [{ hull: -1 }], exit: "eng_test_beat" },
            setback: { text: "He laughs at you. So does the crew.", effects: [{ morale: -3 }], exit: "eng_test_beat" },
          },
        },
        {
          id: "shoot",
          label: "Shoot the apple out of his hand.",
          check: { type: "Marksmanship", dr: 3 },
          approval: ["Glory"],
          outcomes: {
            clean: { text: "The apple's gone. So is he. In his hurry he leaves behind a purse he was 'minding' for someone.", effects: [{ gold: 40 }, { morale: 5 }, { dread: 3 }], exit: "eng_test_beat" },
            partial: { text: "You hit the apple, and also the crate, and also very nearly him. He wants paying for the apple.", effects: [{ gold: -5, pot: "crew" }, { morale: 2 }], exit: "eng_test_beat" },
            setback: { text: "A gull drops out of the sky. The dockhand looks at the gull, then at you, and holds out his hand for the fee.", effects: [{ gold: -20, pot: "crew" }, { morale: -2 }], exit: "eng_test_beat" },
          },
        },
        {
          id: "pay",
          label: "Pay the twenty gold.",
          cost: { gold: 20, pot: "crew" },
          approval: ["Caution"],
          result: { text: "He bites the coin, nods, and goes back to his apple.", effects: [], exit: "eng_test_beat" },
        },
        {
          id: "letter",
          label: "Show him your letter of marque.",
          lockedUnless: { tag: "Letter-Bearer" },
          lockedReason: "Needs a letter of marque",
          approval: ["Order"],
          result: { text: "(unreachable in this test)", effects: [], exit: "eng_test_beat" },
        },
        {
          id: "homecity",
          label: "Tell him you're from [Home City].",
          hiddenUnless: { tag: "Ash-Born" },
          check: { type: "Tavern Talk", dr: 1 },
          approval: ["Mercy"],
          outcomes: {
            clean: { text: "He goes quiet. \"My sister was in [Home City].\" He moves the crate himself.", effects: [{ ladder: { npc: "hob", delta: 1 } }], exit: "eng_test_beat" },
            partial: { text: "\"Everyone's from somewhere that burned.\" He waives half.", effects: [{ gold: -10, pot: "crew" }], exit: "eng_test_beat" },
            setback: { text: "\"Then you'll know what twenty gold is worth.\"", effects: [{ gold: -20, pot: "crew" }], exit: "eng_test_beat" },
          },
        },
      ],
    },

    eng_test_beat: {
      id: "eng_test_beat",
      kind: "beat",
      title: "Aboard",
      where: "Test Harbor, Docks",
      ap: 0,
      repeat: "once",
      setup: "The crew file up the gangway behind you. Somebody has already started a card game on the hatch cover.",
      choices: [
        { id: "on", label: "Carry on.", result: { text: "", effects: [], exit: "hub" } },
      ],
    },

    eng_test_tavern: {
      id: "eng_test_tavern",
      kind: "check",
      title: "The Test Tavern",
      where: "Test Harbor, Tavern",
      ap: 1,
      repeat: "season",
      conditions: ["Harbor"],
      setup:
        "The tavern is one room and most of a roof. The barmaid looks you over.\n\n" +
        "\"What'll it be, {captain.sir}?\" Behind her, someone mutters that {captain.he}'s got the look of a {captain.man} who owes money.",
      choices: [
        {
          id: "round",
          label: "Buy the room a round from your own purse.",
          cost: { gold: 30, pot: "purse" },
          approval: ["Generosity"],
          result: { text: "The room cheers. Two of your crew cheer loudest.", effects: [{ morale: 3 }], exit: "hub" },
        },
        {
          id: "stories",
          label: "Swap stories with the old hands.",
          check: { type: "Tavern Talk", dr: 2 },
          approval: ["Caution"],
          outcomes: {
            clean: { text: "An old hand swears blind there's a wreck off the point that nobody's picked clean.", effects: [{ flag: "test_heard_rumor" }], exit: "hub" },
            partial: { text: "You hear about a wreck. You also pay for everyone's drinks while hearing it.", effects: [{ flag: "test_heard_rumor" }, { gold: -15, pot: "crew" }], exit: "hub" },
            setback: { text: "They've heard your stories. They liked them better the first time, from someone else.", effects: [], exit: "hub" },
          },
        },
        {
          id: "arm",
          label: "Arm-wrestle the bosun for the price of the drinks.",
          check: { type: "Haul & Labor", stat2: "Daring", dr: 3 },
          approval: ["Glory"],
          outcomes: {
            clean: { text: "The bosun's knuckles hit the table. He pays, and he isn't happy about it.", effects: [{ gold: 25 }, { morale: 2 }], exit: "hub" },
            partial: { text: "A draw. Each of you swears it was the other's table.", effects: [], exit: "hub" },
            setback: { text: "Your arm goes down. The drinks are on your crew's coin.", effects: [{ gold: -25, pot: "crew" }], exit: "hub" },
          },
        },
      ],
    },
  };
})();
