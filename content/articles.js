/* The Articles (§26.2-§26.5): seven slots, the Standard option first in
 * each. greed: -1 generous, 0 fair, +1 or more harsh. Quarter and Quarrels
 * carry no Greed (greed: null) and can be changed any time.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.articles = {
    SLOTS: [
      { id: "share", name: "The Captain's Share", options: [
        { id: "standard", label: "Standard", text: "2 shares", greed: 0, approval: [], shares: 2 },
        { id: "lean", label: "Lean", text: "1.5 shares", greed: -1, approval: ["Generosity"], shares: 1.5 },
        { id: "captains_due", label: "Captain's Due", text: "4 shares", greed: 1, approval: ["Plunder"], shares: 4 },
        { id: "lions_share", label: "Lion's Share", text: "25% of the haul", greed: 3, approval: ["Plunder"], percent: 25 },
        { id: "half_haul", label: "Half the Haul", text: "50% of the haul", greed: 4, approval: ["Plunder"], percent: 50 },
      ] },
      { id: "officers", name: "Officers' and Fleet Captains' Shares", options: [
        { id: "standard", label: "Standard", text: "Officers 1.5 shares, fleet captains 2", greed: 0, approval: [], officer: 1.5, fleet: 2 },
        { id: "even_hands", label: "Even Hands", text: "Officers 1.25 shares, fleet captains 1.5", greed: -1, approval: ["Generosity"], officer: 1.25, fleet: 1.5 },
        { id: "officers_mess", label: "Officers' Mess", text: "Officers 2 shares, fleet captains 2.5", greed: 1, approval: ["Plunder"], officer: 2, fleet: 2.5 },
      ] },
      { id: "compensation", name: "Compensation", options: [
        { id: "standard", label: "Standard", text: "1.5 shares, at least 75 gold, for the maimed and for a dismissed officer", greed: 0, approval: [], shares: 1.5, min: 75 },
        { id: "stingy", label: "Stingy", text: "1 share, at least 50 gold", greed: 1, approval: ["Plunder"], shares: 1, min: 50 },
        { id: "open_handed", label: "Open-Handed", text: "2.5 shares, at least 125 gold", greed: -1, approval: ["Generosity", "Mercy"], shares: 2.5, min: 125 },
      ] },
      { id: "quarter", name: "Quarter", noGreed: true, options: [
        { id: "quarter_asked", label: "Quarter Asked", text: "Only crews who refuse a demanded surrender may be executed", greed: null, approval: ["Honor"] },
        { id: "quarter_given", label: "Quarter Given", text: "No executions", greed: null, approval: ["Mercy"] },
        { id: "no_quarter", label: "No Quarter", text: "Unlimited executions; you earn the No Quarter tag", greed: null, approval: ["Cruelty"] },
      ] },
      { id: "discipline", name: "Discipline", options: [
        { id: "standard", label: "Standard", text: "Normal rules", greed: 0, approval: [] },
        { id: "lenient", label: "Lenient", text: "No Make an Example; shore leave at least once a year", greed: -1, approval: ["Revelry"] },
        { id: "strict", label: "Strict", text: "+1 Discipline; Make an Example also allowed at Steady", greed: 1, approval: ["Order"] },
      ] },
      { id: "quarrels", name: "Quarrels", noGreed: true, options: [
        { id: "captains_judgment", label: "Captain's Judgment", text: "Officers duel only with your permission", greed: null, approval: [] },
        { id: "settled_ashore", label: "Settled Ashore", text: "Feuding officers may duel in port to end a feud", greed: null, approval: ["Glory"] },
        { id: "no_blood", label: "No Blood Among Brothers", text: "No duels; slot contests go to your choice", greed: null, approval: ["Mercy"] },
      ] },
      { id: "chest", name: "The Ship's Chest", options: [
        { id: "crews_chest", label: "Crew's Chest", text: "A prize's ship's chest joins crew gold", greed: 0, approval: [] },
        { id: "captains_chest", label: "Captain's Chest", text: "A prize's ship's chest goes to your purse", greed: 2, approval: ["Plunder"] },
      ] },
    ],

    // §26.4 Reading the Articles to the crew. dr: the Pirate Code DR this
    // build uses for the doc's Easy / Medium / Hard / Very Hard (DR 2 / 3 /
    // 5 / 6, a reading of §11.3's reference captain; flagged for a ruling).
    READING: [
      { max: -2, cheer: 5 },
      { max: 0 },
      { max: 2, dr: 2, label: "Easy", partial: { morale: -5 }, setback: { morale: -10 } },
      { max: 4, dr: 3, label: "Medium", partial: { morale: -5 }, setback: { morale: -10, pressure: 1 } },
      { max: 6, dr: 5, label: "Hard", partial: { morale: -10 }, setback: { morale: -15, pressure: 1 } },
      { max: 99, dr: 6, label: "Very Hard", partial: { morale: -10 }, setback: { morale: -15, pressure: 2 } },
    ],

    // §26.5 The Articles' reputation: crew pools at every node.
    REPUTATION: [
      { name: "Generous", max: -2, pool: 1.2 },
      { name: "Fair", max: 2, pool: 1 },
      { name: "Harsh", max: 5, pool: 0.8 },
      { name: "Cruel", max: 99, pool: 0.6, noSeasoned: true },
    ],

    LOOSEN_MORALE: 3, // +3 morale per slot loosened (§26.6)
  };
})();
