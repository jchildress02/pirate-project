/* Quest records the prototype reads: their leads and placeholder journal
 * lines (§12.5, §30.6, §30.7). The journal's real wording is written in the
 * UI chat; every line here is marked PLACEHOLDER.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  var P = "PLACEHOLDER (journal, UI chat): ";

  PC.data.quests = {
    what_was_lost: {
      name: "What Was Lost",
      needed: 3, // any 3 of 5 leads open the climax (§12.5)
      summary: {
        A: P + "Find your brother, pressganged by pirates.",
        B: P + "Get back your family's jewels.",
        C: P + "Find the man who shot you.",
        D: P + "Clear your name.",
      },
      beyond: "The trail leads beyond Ocracoke.",
      leads: {
        // The Ocracoke lead (§30.6): the one-armed pirate for A and C, Bobby Rats for B.
        trident: { node: "ocracoke", variants: ["A", "C"], journal: {
          A: P + "The one-armed pirate saw your brother chained to the mast of a French brigantine, the *Trident*.",
          C: P + "The one-armed pirate named the man with the burned face: Gregoire, who sails on the French brigantine *Trident*.",
        } },
        bald_man: { node: "ocracoke", variants: ["B"], journal: {
          B: P + "Bobby Rats sold your jewels to a tall, thin, bald man heading home to Edenton.",
        } },
        // The drinking lead (§30.6, lead 5): any drinking win at any Tavern.
        drinking: { node: null, journal: {
          A: P + "A pirate you drank under the table knows the *Trident*'s hunting waters.",
          B: P + "A pirate you drank under the table bragged about a chest of jewels aboard the *Trident*.",
          C: P + "A pirate you drank under the table knows the waters Gregoire's *Trident* works.",
          any: P + "A lead won over drinks.",
        } },
      },
    },
    hidden_haven: {
      name: "The Hidden Haven",
      needed: 2, // two leads reveal it on the chart (§30.7)
      summary: P + "Where are Captain Deadman's Frenchmen hiding?",
      beyond: null,
      leads: {
        bobby_french: { node: "ocracoke", journal: { any: P + "Bobby Rats hears the Frenchmen are still skulking about somewhere." } },
      },
    },
  };
})();
