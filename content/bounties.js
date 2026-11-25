/* Pirate Chronicle — Admiralty Bounties and French stragglers: numbers and
 * lines (§17.4.8, §22.5; Milestone 9, PR 3). The lines are the author's
 * (Norfolk Scene Records Part 4, §9-§10).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.bounties = {
    // ---- The board (§17.4.8) ----
    POST: [1, 2],              // new notices a season
    OPEN_MAX: 3,               // open at once (open or taken)
    UNTAKEN_SEASONS: 2,        // an untaken notice comes down after 2 seasons
    DECEASED: 0.15,            // another hunter gets him, each season while taken
    SHIPS: { "Sloop": 50, "Schooner": 25, "Brigantine": 20, "Brig": 5 },
    WATERS: { north: 70, south: 30 },
    PORTS: ["edenton", "wilmington", "charleston", "beaufort", "savannah"],
    RATING: [2, 3],
    RESOLVE: 3,
    STRIKE_PRE: -1,            // the strike-colors roll at the outset
    ITEM: 0.10,                // an Uncommon item aboard
    SPAWN: 0.10,               // a batch in his waters, without the rumor
    REWARD: { "Sloop": [600, 300], "Schooner": [800, 400], "Brigantine": [1200, 600], "Brig": [1500, 750] },
    RESPECTED: 1.25,           // Key's Respected or better
    STANDING: 3,               // Avalon Standing on collection
    REGARD_AT: 5,              // Key's regard +1, once, at 5 collected
    RELEASE_STANDING: 2,       // Pirate Standing for letting him go
    KILL_DREAD: 3,             // DEFAULT: as A Wanted Man's yielded captain (+2 head, +1 hand)
    TROPHY_DREAD: { head: 2, hand: 1 },
    LIE_CAUGHT_REGARD: -2,     // DEFAULT: as A Wanted Man's lie after the battle

    // ---- French stragglers (§17.4.4, §22.5) ----
    STRAGGLER: 0.20,           // of generated pirate ships in the Slice
    STRAGGLER_REWARD: 300,
    STRAGGLER_KILL_DREAD: 3,   // DEFAULT: as a yielded captain

    lines: {
      // The board (Part 4 §9).
      blurb: "A cork board by the door, containing bounty notices with the Admiralty's seal.",
      fresh: "A fresh notice has been pinned up since your last visit.",
      empty: "The board is bare, apart from a few rusty pins.",
      taken: "You unpin the notice from the board. Lieutenant Howe stamps it and wishes you luck.",
      deceased: "The name has been stamped DECEASED. Someone else got to {target.him} first.",
      expired: "[NPC]'s notice is gone. {target.He} seems to have disappeared.",
      nothing: "\"The board is over there, if you're looking for work.\"",
      // Capture and turn-in (Part 4 §10).
      captureSetup: "Your men drag [NPC] before you in irons. {target.He} spits on the deck. \"Get on with it, then.\"",
      bring: "There's a bounty on your head, and I intend to collect it.",
      release: "Take a boat and go. If I see you again, I won't be so kind.",
      kill: "You grab a sword from the nearest hand and plunge it into {target.his} chest.",
      trophy: { head: "Your crew watches on as you separate {target.his} head from {target.his} neck. When you're finished, you wrap your trophy in sailcloth.", hand: "A hand should be sufficient. You wrap it in sailcloth and store it in your cabin." },
      turninAlive: "Lieutenant Howe beams as the soldiers march [NPC] away. \"Splendid work, Captain. Here's your reward.\"",
      turninDead: "The Lieutenant winces at your report, but counts out the coin. \"Dead pays, Captain. Just not as well.\"",
      lieClean: "\"Went down with his ship, you say? Well, I'll take your word for it.\"",
      liePartial: "He narrows his eyes. \"Good.\"",
      lieCaught: "The smile fades from the Lieutenant's face. \"That's not what I've been hearing, Captain.\"",
      trophyHowe: "The Lieutenant's eyes widen with horror. \"Oh. That's, erm...quite sufficient.\" He gingerly moves the [trophy] to the floor and wipes the desk down with a handkerchief.",
      fifth: "\"The Admiral asked me earlier how you were doing on these bounties. He's delighted.\"",
      // French stragglers.
      stragglerCaptured: "The French captain is hauled aboard, cursing you in his own language.",
      stragglerDelivered: "Howe signs a receipt with a flourish. \"Another one of those slimy bastards. Three hundred, as promised.\"",
      stragglerParting: "\"Vive la France!\" he shouts as the soldiers lead him away.",
      prisonerReleased: "PLACEHOLDER: You put [NPC] ashore in the ship's boat and watch {target.him} row away.",
      prisonerKilled: "PLACEHOLDER: [NPC] goes over the side, and the sea takes {target.him}.",
      // The scouting card (PLACEHOLDER cues).
      cueBounty: "PLACEHOLDER: Her captain matches the sketch on the Admiralty's notice: [NPC].",
      cueFrench: "PLACEHOLDER: She flies a black flag, but the shouts across the water are French.",
      // Journal objectives (Part 4, approved).
      jTaken: "Bring in [NPC], wanted for piracy near [Node]. Last seen in [Waters] aboard the *[Ship]*. Alive pays better.",
      jCaptured: "Return to Norfolk and turn in [NPC] to Lieutenant Howe.",
      jStraggler: "Deliver the captured French captain to Lieutenant Howe at Norfolk for a reward.",
      jReport: "Return to Norfolk and report to Lieutenant Howe about [NPC].",
    },
  };
})();
