/* Captain modifiers: traits, flaws, tags and items that change checks.
 *
 * Each entry:
 *   name:   shown in the check breakdown
 *   edge:   [{ type: "Persuade", value: -1 }]  or  [{ stat: "Charm", value: 1 }]
 *           optional `when: { condition: "Harbor" }`, optional `outsideCap: true`
 *           (a gun's bonus sits outside the ±3 cap, §32.10)
 *   reroll: { types: ["Marksmanship"], perSeason: 1 }  (on a setback or partial)
 *
 * Milestone 0 holds only the entries the test captain uses, copied from the
 * Tag Catalog (§14). The full lists arrive with the character creator.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.modifiers = {
    // Tags (§14.2-§14.3)
    "Brute": { name: "Brute", edge: [{ type: "Intimidate", value: 1 }, { type: "Persuade", value: -1 }] },
    "Sharpshooter": { name: "Sharpshooter", reroll: { types: ["Marksmanship"], perSeason: 1 } },
    "Silver Tongue": { name: "Silver Tongue", reroll: { types: ["Persuade", "Negotiate"], perSeason: 1 } },
    "Ash-Born": { name: "Ash-Born" }, // no check effect; unlocks scenes
    "Grief-Stricken": { name: "Grief-Stricken", edge: [{ type: "Rally Crew", value: -1 }, { type: "Tavern Talk", value: -1 }] },
    // Debuffs are physical tags (§12.4)
    "Bad Knee": { name: "Bad Knee", edge: [{ type: "Chase & Climb", value: -1 }, { type: "Board", value: -1 }] },
  };
})();
