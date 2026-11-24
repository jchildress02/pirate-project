/* Imprisonment (§43): the numbers, the jails and every line. Every number
 * is a placeholder (the Tuning Table lists them); every line marked
 * PLACEHOLDER is the author's to write (the imprisonment scene records,
 * §43.15; PH28 of the Milestone 8 build plan).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.prison = {
    // ---- Numbers (§43.4-§43.6, §43.10, §43.13) ----
    CELL_AP: 3,                  // cell actions a season (§43.7)
    HELD_AP: 3,                  // Held: three actions lost (§43.4)
    TRIAL_AP: 3,                 // held three actions, then tried (§43.6)
    FINE_FEES: 4,                // a fine of 4× the port fee
    TRIAL_DR: { Imprisoned: 3, Condemned: 4 },
    SENTENCE: { Imprisoned: { partial: [1, 3], setback: [2, 5] }, Condemned: { partial: [4, 8] } },
    ACQUIT_STANDING: -5,         // Imprisoned, clean: freed with a fine and a Standing drop (DEFAULT: -5)
    CONFIDANT_BONUS: 1,
    JUDGE_TRAITS: { Merciful: -1, Forgiving: -1, Ruthless: 1, Vengeful: 1 }, // ±1 season (§43.6)
    INTERROGATION_DR: 2,         // Resist Interrogation (DEFAULT: §43.5 names no DR)
    TALK_FREELY: { free: 12, drop: 6 }, // secret points: 12+ walks free; 6-11 drops a tier
    CAPTURED_CREW: { min: 10, share: 0.25 }, // into the cell with the captain (§43.3)
    OUTSIDE_MORALE: -5,          // a season, while the crew wait in port (§43.10)
    CREW_LEAVE_MORALE: 15,       // below this (Mutinous) they sail without you (DEFAULT)
    MAROON_AP: 2,                // the stranded-rescue loop (§21.8)
    RESCUE_DR: 2,                // Persuade to be taken in tow (DEFAULT: §21.8 names no DR)
    RESCUE_PRICE_FEES: 2,        // a partial: they help for a price (DEFAULT: 2× the port fee; Haggle not built)
    CUTTER_PRICE: 1000,          // buy a cutter outright (§43.13)
    CUTTER_PROVISIONS: 4,        // lots aboard a new cutter (DEFAULT)
    SHABBY_HULL: 0.6,            // Work in town: a shabby cutter (DEFAULT: 60% hull)
    STEAL_DR: 2,                 // the urchin heist (DEFAULT: Light Fingers, DR 2)
    STEAL_HEAT: 5,
    FENCE_SHUT: [1, 2],          // seasons an exposed fence is shut (§30.12)

    // Who jails, and where (§43.2; D4 of the M8 build plan). Captors not
    // listed maroon the captain (§43.1).
    CAPTORS: {
      Avalon: { node: "norfolk", faction: "avalon" },
      Frisia: { node: "staugustine", faction: "frisia", releaseAt: "ocracoke" }, // a jail screen only until St. Augustine is built (D4b)
    },
    // The node jails (§43.14). Only the live ones and St. Augustine's
    // stand-in are listed.
    JAILS: {
      norfolk: { name: "The Admiralty House Cells", judge: "key", admiralty: true, guard: "Wealthy" },
      staugustine: { name: "The Castle Dungeon", judge: null, admiralty: false, guard: "Modest", standIn: true },
    },
    // Which NPCs may never speak for you at a trial (§43.6).
    NO_TESTIMONY: ["bobby"],

    // The Secrets tab (§30.12): the Slice's starter list, the live entries.
    SECRETS: {
      fence_bobby: { name: "Bobby Rats is your fence", size: "Small", penalty: "Bobby's fence shuts for 1-2 seasons.", fence: "bobby" },
    },
    SECRET_POINTS: { Small: 1, Medium: 3, Large: 6 },

    lines: {
      // The ways in
      capturedSea: "PLACEHOLDER: Your ship is taken. They put you in irons with what's left of your crew.",
      capturedPort: "PLACEHOLDER: The soldiers march you off to the cells.",
      marooned: "PLACEHOLDER: They row you to a spit of sand and leave you there with nothing but the clothes on your back.",
      maroonedOfficers: "PLACEHOLDER: [Officers] wade ashore beside you.",
      // The charge (§43.4)
      charge: {
        Held: "PLACEHOLDER: \"You'll cool your heels here a while, then pay what you owe.\"",
        Imprisoned: "PLACEHOLDER: \"You'll stand trial for your crimes.\"",
        Condemned: "PLACEHOLDER: \"Piracy on the high seas. You'll hang for it, if the court agrees.\"",
      },
      // Interrogation (§43.5)
      interrogation: "PLACEHOLDER: They take you to a windowless room. A man with a ledger wants names.",
      noSecrets: "PLACEHOLDER: You've nothing worth telling them, and after a while even they believe it.",
      resist: { clean: "PLACEHOLDER: You give them nothing.", partial: "PLACEHOLDER: You let one small thing slip, to make them stop.", setback: "PLACEHOLDER: They get something out of you." },
      talkOffer: { free: "PLACEHOLDER: \"Tell us everything, and you walk out of here.\"", drop: "PLACEHOLDER: \"Tell us everything, and we'll go easier on you.\"", laugh: "PLACEHOLDER: They laugh. What you know isn't worth a lighter sentence." },
      talkWarning: "Talking freely exposes every secret you hold, and every exposure has its cost. You'll be known as a snitch.",
      talked: "PLACEHOLDER: You tell them everything. The clerk's pen scratches for an hour.",
      // The cell
      cellWait: "PLACEHOLDER: The hours crawl by in the dark.",
      escapeSoon: "Planning an escape comes in the next update.",
      // The trial (§43.6)
      trialOpen: "PLACEHOLDER: They bring you up to the court in chains.",
      confidant: "PLACEHOLDER: [Name] stands up in the gallery to speak for you.",
      verdict: {
        Condemned: { clean: "PLACEHOLDER: \"You've got the wrong man!\" And somehow, they believe you.", partial: "PLACEHOLDER: The court spares your neck: [n] seasons in prison.", setback: "PLACEHOLDER: The judge pronounces the sentence: you'll hang at the end of next season." },
        Imprisoned: { clean: "PLACEHOLDER: The court lets you go, with a fine to remember them by.", partial: "PLACEHOLDER: [n] seasons in prison.", setback: "PLACEHOLDER: [n] seasons in prison." },
      },
      // The outside (§43.10)
      outsideMorale: "Your crew wait for you in port. Morale −5.",
      crewSailed: "PLACEHOLDER: Your crew gave up waiting. The [Ship] has sailed without you.",
      impounded: "PLACEHOLDER: The Admiralty has impounded the [Ship].",
      // Release
      released: "PLACEHOLDER: The door swings open. You're free.",
      servedHeat: "Your debt to [Faction] is paid: Heat with them falls to 0.",
      fined: "Fined [gold] gold.",
      hanged: "PLACEHOLDER: The trapdoor opens.",
      // The stranded-rescue loop (§21.8)
      drift: "PLACEHOLDER: The days drag on. You watch the horizon for a sail.",
      rescueSail: "PLACEHOLDER: A sail! An Avalon merchantman heaves to and puts a boat in the water.",
      rescue: { clean: "PLACEHOLDER: They take you aboard, no questions asked.", partial: "PLACEHOLDER: They'll take you, for a price.", setback: "PLACEHOLDER: They take one look at you and sail on." },
      towed: "PLACEHOLDER: They land you at [Place].",
      barred: "PLACEHOLDER: They hand you straight to the harbor guard.",
      // The shipless popup (§43.13)
      shipless: "PLACEHOLDER: You're free, but you've no ship and precious little else.",
      boughtCutter: "PLACEHOLDER: You count out the gold, and a battered little cutter is yours.",
      steal: { clean: "PLACEHOLDER: Four grubby urchins lead you down to the docks after dark. By morning a cutter is yours.", partial: "PLACEHOLDER: You get the cutter out, but the harbor watch sees you go.", setback: "PLACEHOLDER: The watch catches you halfway up the gangplank." },
      stocks: "PLACEHOLDER: You spend a night in the stocks.",
      worked: "PLACEHOLDER: A season of hard work buys you a shabby little cutter.",
      retired: "PLACEHOLDER: You hang up your cutlass.",
    },
  };
})();
