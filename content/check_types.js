/* The 60 check types and their home stats (§11.4, §12.6).
 * A scene can override the stat or pair two stats on any check.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  var FAMILIES = {
    Cunning: ["Bluff & Disguise", "Read People", "Forge", "Decipher & Research", "Plan & Ambush",
      "Notice Danger", "Gather Intelligence", "Smuggle", "Fence", "Light Fingers", "Appraise",
      "Cards & Dice", "Sabotage", "Treat Wounds"],
    Daring: ["Board", "Strike First", "Swordsmanship", "Brawling", "Marksmanship", "Chase & Climb",
      "Run Blockade", "Gambit", "Storm a Position", "Rescue & Breakout"],
    Command: ["Leadership", "Discipline", "Intimidate", "Rally Crew", "Pirate Code", "Ration Stores"],
    Seamanship: ["Navigate", "Pilot Shoals", "Read Weather", "Ride Out Storm", "Repair at Sea",
      "Refit & Careen", "Maneuver", "Outrun", "Keep Watch", "Small Boat Handling", "Ship Concealment"],
    Charm: ["Persuade", "Negotiate", "Haggle", "Bribe", "Recruit", "Tavern Talk", "Court", "Petition", "Parley"],
    Grit: ["Endure", "Go Without", "Haul & Labor", "Dive", "Hold Your Ground", "Resist Interrogation",
      "Ghost Sense", "Immune System", "Cast-Iron Stomach", "Wilderness Survival"],
  };

  var types = {};
  Object.keys(FAMILIES).forEach(function (stat) {
    FAMILIES[stat].forEach(function (t) { types[t] = { stat: stat }; });
  });
  PC.data.checkTypes = types;

  // Cross-stat groups for modifiers that span stats (§11.6).
  PC.data.checkGroups = {
    "Fine Work": ["Light Fingers", "Forge", "Decipher & Research", "Repair at Sea", "Treat Wounds"],
    "Heavy Labor": ["Haul & Labor", "Refit & Careen"],
    "Combat": ["Board", "Strike First", "Swordsmanship", "Brawling", "Marksmanship", "Storm a Position", "Hold Your Ground"],
    "Underworld": ["Smuggle", "Fence", "Light Fingers", "Gather Intelligence", "Cards & Dice", "Bribe", "Tavern Talk"],
    "Officialdom": ["Petition", "Negotiate", "Bribe", "Forge", "Bluff & Disguise"],
  };
})();
