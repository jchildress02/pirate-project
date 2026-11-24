/* Quest records the prototype reads: their leads, journal objectives and
 * deadlines (§12.5, §16.4, §30.6, §30.7). The journal's wording is §41.14
 * (the UI walkthrough chat, approved November 16).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.quests = {
    what_was_lost: {
      name: "What Was Lost",
      needed: 3, // any 3 of 5 leads open the climax (§12.5)
      // §16.4: the Ash-Born loss quest expires at the end of Spring 1755.
      deadline: { year: 1755, season: 0 },
      summary: {
        A: "Find your brother, pressganged onto a pirate ship.",
        B: "Recover your family's jewels from the pirates who stole them.",
        C: "Find the man who shot you.",
      },
      // The Ocracoke step (§41.14), until Ocracoke's lead is found.
      here: {
        A: "Talk to the one-armed pirate in the Tavern.",
        B: "Find Bobby Rats; stolen treasure finds its way to him.",
        C: "Talk to the one-armed pirate in the Tavern.",
      },
      beyond: "The trail leads beyond Ocracoke.",
      leads: {
        // The Ocracoke lead (§30.6): the one-armed pirate for A and C, Bobby Rats for B.
        trident: { node: "ocracoke", variants: ["A", "C"], journal: {
          A: "The one-armed pirate saw your brother chained to the mast of a French brigantine, the *Trident*.",
          C: "The one-armed pirate named the man with the burned face: Gregoire, who sails on the French brigantine *Trident*.",
        } },
        bald_man: { node: "ocracoke", variants: ["B"], journal: {
          B: "Bobby Rats sold your jewels to a tall, thin, bald man heading home to Edenton.",
        } },
        // The drinking lead (§30.6, lead 5): any drinking win at any Tavern.
        // The author's lines (approved November 18). [Trident Waters] is her
        // hunting ground, seeded per world. The birthmark is the brother's mark.
        drinking: { node: null, journal: {
          A: "A pirate you drank under the table swears the *Trident* hunts [Trident Waters], with a shipwright with a birthmark chained at her pumps.",
          B: "A pirate you drank under the table bragged about a chest of fine jewels aboard the *Trident*. They sound like yours.",
          C: "A pirate you drank under the table says Gregoire's *Trident* hunts [Trident Waters].",
          any: "A lead won over drinks.",
        } },
      },
    },
    hidden_haven: {
      name: "The Hidden Haven",
      needed: 3, // three leads reveal it on the chart (§30.7, ruled November 16, §41.15)
      summary: "Where are Captain Deadman's Frenchmen hiding?",
      beyond: null,
      leads: {
        bobby_french: { node: "ocracoke", journal: { any: "Bobby Rats hears the Frenchmen are still skulking about somewhere." } },
      },
    },
  };

  // Ocracoke's startup quests (§41.14). They live in scenes and flags, not in
  // state.quests; js/quests.js reads these to write their journal entries.
  PC.data.startupQuests = {
    a_wanted_man: {
      name: "A Wanted Man",
      steps: { assigned: "Bring in Freddy Fearless, dead or alive. He was last seen near Ocracoke. [PLACEHOLDER: Freddy isn't at sea yet. He arrives in a later update.]" },
      doneLine: "Return to the Admiralty House in Norfolk for your reward.",
    },
    dying_wish: {
      name: "A Dying Pirate's Wish",
      scenes: "ocr_dpw_",
      done: "ocr_dpw_done",
      // The entry opens at the actual offer, not when the dialogue opens (B9):
      // Ollie names the job (the wrecks) in ocr_dpw_2.
      beforeOffer: ["ocr_dpw_1"],
      steps: {
        follow: "Follow the young man to his dying father at Lilyhook's Graveyard.",
        dive: "Dive the wreck of the *Miranda* and bring up Geezer's ivory mermaid.",
        retry: "The mermaid is still down in the *Miranda*. Dive for her again.",
      },
      doneLine: "Geezer died with his mermaid in his hands. Ollie gave you a piece of Lilyhook's map.",
    },
    underworld: {
      name: "Welcome to the Underworld",
      scenes: "ocr_uw_",
      done: "ocr_underworld_done",
      // Opens when Bobby asks for the coin (ocr_uw_2), not when he waves you over (B9).
      beforeOffer: ["ocr_uw_1"],
      steps: { collect: "Collect the coin a drunk in the Tavern owes Bobby Rats." },
      doneLine: "Bobby Rats has his coin, and his fence is open to you.",
    },
    restless: {
      name: "Restless & Ruined",
      steps: {
        waiting: "Davey Dell is waiting in the Tavern, if you want him after all.",
        tab: "Davey Dell is waiting in the Tavern, if you'll settle his tab.",
      },
      doneLine: "Davey Dell has signed on as your Raider.",
    },
  };
})();
