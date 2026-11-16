/* The 55 check types ("skills" on screen), their home stats and the Player
 * line the skills screen and the Captain menu show (§11.4, §12.6).
 * A scene can override the stat or pair two stats on any check.
 *
 * Cut in the Creator chat (November 16): Fence (into Haggle), Run Blockade
 * (into Outrun), Sabotage (into Plan & Ambush), Haul & Labor (into Endure),
 * and Repair at Sea with Refit & Careen merged into Repair & Refit.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  var FAMILIES = {
    Cunning: [
      ["Bluff & Disguise", "Lying to faces, false names, false colors."],
      ["Read People", "Seeing what someone really wants, or fears."],
      ["Forge", "Faking letters, passes and commissions."],
      ["Decipher & Research", "Charts, ciphers, old logs and riddles."],
      ["Plan & Ambush", "Setting the trap before the fight."],
      ["Notice Danger", "Spotting the knife, the trap, the shark."],
      ["Gather Intelligence", "Learning what people are hiding."],
      ["Smuggle", "Moving cargo past prying eyes."],
      ["Light Fingers", "Pockets, locks and burglary."],
      ["Appraise", "Judging what loot is worth, and spotting fakes."],
      ["Cards & Dice", "Gambling, and cheating at it."],
      ["Treat Wounds", "Patching up the wounded."],
    ],
    Daring: [
      ["Board", "Getting across the rail when ships grapple."],
      ["Strike First", "Making the first move when a fight breaks out."],
      ["Swordsmanship", "Blades and duels."],
      ["Brawling", "Fists, knives, clubs and bottles."],
      ["Marksmanship", "Pistols and muskets."],
      ["Chase & Climb", "Running, climbing, rooftops and rigging."],
      ["Gambit", "A wild, desperate gamble."],
      ["Storm a Position", "Assaulting forts, batteries and barricades."],
      ["Rescue & Breakout", "Getting captives out alive."],
    ],
    Command: [
      ["Leadership", "Clear orders when it all goes to hell."],
      ["Discipline", "Enforcing the rules, and punishing those who break them."],
      ["Intimidate", "Making men afraid of you."],
      ["Rally Crew", "Lifting the crew's spirits."],
      ["Pirate Code", "The Articles, the shares, and the crew's sense of fair play."],
      ["Ration Stores", "Stretching provisions without starting a riot."],
    ],
    Seamanship: [
      ["Navigate", "Finding your way across open water."],
      ["Pilot Shoals", "Threading shallows, bars and channels."],
      ["Read Weather", "Knowing what the sky will do."],
      ["Ride Out Storm", "Keeping her afloat through the worst."],
      ["Repair & Refit", "Patching damage at sea, and fitting her out in port."],
      ["Maneuver", "Getting the better position in a sea fight."],
      ["Outrun", "Running a ship down, or getting away."],
      ["Keep Watch", "Spotting sails and false colors from far off."],
      ["Small Boat Handling", "Landing parties, surf and night rowing."],
      ["Ship Concealment", "Hiding the ship in coves and shallows."],
    ],
    Charm: [
      ["Persuade", "Changing someone's mind."],
      ["Negotiate", "Formal terms, such as ransoms, deals and treaties."],
      ["Haggle", "Better prices when you buy and sell."],
      ["Bribe", "Buying a favor without getting caught."],
      ["Recruit", "Signing on better hands."],
      ["Tavern Talk", "Gossip, rumors and new acquaintances."],
      ["Court", "Romance."],
      ["Petition", "Getting what you need from officials."],
      ["Parley", "Talking under a flag of truce, or with strangers."],
    ],
    Grit: [
      ["Endure", "Pain, wounds, exhaustion and heavy labor."],
      ["Go Without", "Hunger and thirst when stores run short."],
      ["Dive", "Holding your breath and working a wreck."],
      ["Hold Your Ground", "Standing firm in a fight."],
      ["Resist Interrogation", "Keeping your mouth shut when they ask hard."],
      ["Ghost Sense", "Facing the uncanny without breaking."],
      ["Immune System", "Fevers, flux and plague."],
      ["Cast-Iron Stomach", "Strong drink and bad food."],
      ["Wilderness Survival", "Marsh, forest and the hunt."],
    ],
  };

  var types = {};
  Object.keys(FAMILIES).forEach(function (stat) {
    FAMILIES[stat].forEach(function (t) { types[t[0]] = { stat: stat, player: t[1] }; });
  });
  PC.data.checkTypes = types;

  // Cross-stat groups for modifiers that span stats (§11.6). Heavy Labor is
  // retired with Haul & Labor and Refit & Careen.
  PC.data.checkGroups = {
    "Fine Work": ["Light Fingers", "Forge", "Decipher & Research", "Repair & Refit", "Treat Wounds"],
    "Combat": ["Board", "Strike First", "Swordsmanship", "Brawling", "Marksmanship", "Storm a Position", "Hold Your Ground"],
    "Underworld": ["Smuggle", "Light Fingers", "Gather Intelligence", "Cards & Dice", "Bribe", "Tavern Talk"],
    "Officialdom": ["Petition", "Negotiate", "Bribe", "Forge", "Bluff & Disguise"],
  };
})();
