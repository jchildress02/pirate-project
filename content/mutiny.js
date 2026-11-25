/* Pirate Chronicle — the mutiny's numbers and lines (§24.10, §24.13,
 * §25.13, §25.14; Milestone 9, PR 2).
 *
 * Every line here is a PLACEHOLDER for the author (PH33): each approach,
 * the plea, the crew's verdict, the last stand and the endings. The
 * numbers are the docs' placeholders.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.mutiny = {
    // ---- Desertion at departure (§24.10) ----
    DESERT: { Sullen: [0.05, 0.10], Mutinous: [0.15, 0.25] },
    DESERT_FACTION_PORT: 0.05,   // departing an Avalon or Frisian port
    DESERT_GO_WITHOUT: 0.10,     // after a Go Without setback (§20.6)
    DESERT_MORALE: 10,           // the crew who stay

    // ---- When it fires (§24.13) ----
    FIRE_AT_DEPARTURE: 4,
    FIRE_AT_SEASON_END: 5,

    // ---- The roll: DR = 1 + Pressure − Dread bonus, 1 to 5 (Year 1) ----
    DR_MAX: 5,
    RINGLEADER_DR: 1,            // an officer ringleader (§25.14)
    LOYAL_EDGE_MAX: 2,           // +1 a loyal officer, at most +2

    // ---- The approaches ----
    REASON_MORALE: 10,
    PAY_OFF_MIN_HEAD: 25,        // not offered below 25 crew gold a head
    PAY_OFF_SHARE: { clean: 0.5, partial: 0.75 },
    EXAMPLE_MORALE: -10,         // a partial
    EXAMPLE_DREAD: 3,            // a clean (§28.8)
    STRIKE_FIRST_MORALE: -10,    // a clean
    STRIKE_FIRST_DREAD: 5,       // §28.8
    STRIKE_FIRST_KILLED: 0.10,   // a partial: 10% of the crew
    RINGLEADER_KILL_DREAD: 5,    // Call Out, when the ringleader dies (§28.8)
    RINGLEADER_ASHORE_DREAD: 2,  // DEFAULT: "Dread up" read as a fear deed
    PLANK_DREAD: 8,              // §25.14

    lines: {
      fires: {
        departure: "PLACEHOLDER: The men don't go to the capstan. They stand on the deck in a body, and nobody meets your eye.",
        season: "PLACEHOLDER: You wake to voices on deck. The crew have gathered at the mast, and the talk stops when you climb the ladder.",
      },
      ringleaderSpeaks: "PLACEHOLDER: [Name] steps out of the crowd. \"We're done, Captain. The men have had enough, and they've chosen me to say so.\"",
      crewSpeaks: "PLACEHOLDER: A hand at the front speaks for the rest. \"We're done, Captain. The men have had enough.\"",
      loyal: "PLACEHOLDER: [Names] [stand] at your shoulder.",
      approaches: {
        reason: { clean: "PLACEHOLDER: They listen. By the end, the grumbling has turned to nods.", partial: "PLACEHOLDER: They let you talk, and they go back to work. For now.", setback: "PLACEHOLDER: They've heard enough of your words." },
        payoff: { clean: "PLACEHOLDER: The chest comes up on deck, and the grumbling stops at the first chink of gold.", partial: "PLACEHOLDER: They take the gold, and more of it than you'd hoped. But they take it.", setback: "PLACEHOLDER: They take the gold, and they take the ship too." },
        example: { clean: "PLACEHOLDER: You drag the loudest of them to the mast. Nobody else says a word.", partial: "PLACEHOLDER: The example is made. The men obey, but they hate you for it.", setback: "PLACEHOLDER: You reach for the loudest of them, and the crowd closes around him." },
        strikeFirst: { clean: "PLACEHOLDER: You strike before they're ready. The ringleaders are in irons before the rest know what's happening.", partial: "PLACEHOLDER: It's bloody work, and there are bodies on the deck when it's done. But it's done.", setback: "PLACEHOLDER: They were ready for you." },
        callOut: { clean: "PLACEHOLDER: [Name] goes down on the deck, your blade at his throat.", partial: "PLACEHOLDER: [Name] drops his blade. \"I'll go at the next port,\" he says. \"I'm done with you.\"", setback: "PLACEHOLDER: [Name]'s blade opens your side, and the crew roar." },
      },
      ringleaderFate: {
        kill: "PLACEHOLDER: [Name] goes down and doesn't get up.",
        ashore: "PLACEHOLDER: [Name] will go ashore at the next port, with nothing but the clothes on his back.",
        plank: "PLACEHOLDER: The crew bind [Name]'s hands and run a plank out over the side. He walks it.",
      },
      officersKilled: "PLACEHOLDER: [Names] [lie] dead on the deck.",
      setbackPlea: "PLACEHOLDER: The crew have the deck, and the guns, and you. There's one chance left: to talk your way out of this alive.",
      verdict: "PLACEHOLDER: The crew are past talking. They'll give you their verdict, and you may plead your case first.",
      plea: { clean: "PLACEHOLDER: They'll set you ashore, alive.", partial: "PLACEHOLDER: They'll put you off the ship, but not where you'd like.", setback: "PLACEHOLDER: Nobody is listening any more." },
      lastStand: "PLACEHOLDER: They come for you. You draw your blade.",
      lastStandResult: { clean: "PLACEHOLDER: You cut your way to the boat and pull for the shore, bleeding.", partial: "PLACEHOLDER: You fight until they overwhelm you, and wake in a boat with no oars.", setback: "PLACEHOLDER: There are too many of them." },
      sacrifice: "Suddenly, [Name] throws himself between you and the killing blow. With a cry, he falls at your feet.",
      killed: "PLACEHOLDER: The crew you led cut you down on your own deck.",
      ashore: "PLACEHOLDER: The ship's boat sets you on the beach at [Place]. Your ship stands out to sea without you.",
      marooned: "PLACEHOLDER: They leave you on a spit of sand with a cask of water and a pistol with one shot.",
      pickedUp: "PLACEHOLDER: Before the day is out, the [Ship] comes about and picks you up. [Name] meets you at the rail.",
      lost: "PLACEHOLDER: The mutineers sail off with every ship, all the cargo, the crew's gold and your purse.",
      quelled: "The mutiny is over.",
      again: "PLACEHOLDER: The men go back to work, but nothing is settled. They'll be back.",
      // Desertion (§24.10, §25.13).
      deserted: "[n] slipped away in the night, and the hands who stayed are glad to see the back of them.",
      officerDeserted: "[Name]'s hammock is empty, and his sea chest is gone.",
      fleetDeserted: "At first light the [Ship] is gone from her mooring. So is [Name].",
      tooFew: "There aren't enough hands left to sail her. You'll need to sign more before you leave.",
    },
  };
})();
