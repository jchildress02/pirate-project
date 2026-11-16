/* Economy numbers (§20, §21.6, §24.7, §29). All are placeholders that
 * playtesting will tune; the Tuning Table lists them. Prices here are the
 * Modest-port base; js/node.js applies the node's multipliers.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.economy = {
    // §20.2 Prosperity tiers. goods: the goods-and-services multiplier;
    // treasure: what a merchant pays per 100-gold treasure unit (×100);
    // lodging: gold per crewman per AP (§20.4). Only the numbers the
    // docs give are filled in; null means "not set yet".
    TIERS: {
      "Very poor": { goods: 0.8, treasure: 0.7, lodging: 15 },
      "Poor": { goods: 0.9, treasure: null, lodging: 18 },
      "Modest": { goods: 1.0, treasure: 1.0, lodging: 24 },
      "Wealthy": { goods: 1.25, treasure: null, lodging: 30 },
    },
    TREASURE_UNIT: 100,       // gold a unit at a Modest port (§20.1)
    TREASURE_PER_SLOT: 5,     // treasure packs 5 units to a cargo slot (§22.6)
    PROVISIONS_LOT: 30,       // §20.6
    SIGNING: { Green: 15, Able: 30, Seasoned: 45, Veteran: 75 }, // §24.7
    TIER_ORDER: ["Green", "Able", "Seasoned", "Veteran"],
    REPAIR_PER_HP: 8,         // Size 1 (§21.6)
    GUN: 100,                 // a gun (§21.6)
    UPGRADE: { 2: 1500, 3: 4000, 4: 8000, 5: 8000 }, // §20.4 (levels 4-5 "from about 8,000")
    SIZE_UPGRADE: { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10 },     // §21.6
    SIZE_REPAIR: { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 },   // §21.6
    BIG_REPAIR_SHARE: 0.25,   // a repair of 25%+ of the hull costs 1 AP (§21.6)
    HULL_PER_LEVEL: 0.15,     // Hull upgrade: max HP +15% a level above 1 (§21.6)
    FENCE_RATE: 0.55,         // §20.3
    FENCE_SL_STEP: 0.05,      // +5 / +10 / +15% by Service Level (§15.6)
    // §15.6 Service Level effects, per level (Wary is the opposite of Friendly).
    MERCHANT_BUY_STEP: 0.05,  // -5 / -10 / -15% buying from them
    MERCHANT_SELL_STEP: 0.03, // +3 / +6 / +9% selling to them
    MERCHANT_CAP_STEP: 0.10,  // +10 / +20 / +30% on their buy cap
    CRAFTSMAN_STEP: 0.05,     // -5 / -10 / -15% on the shipwright's prices
    WARY_STANDING_SURCHARGE: 0.10, // every purchase while Wary or Hostile with the node's faction (§29.3)
    SHOP_MARKUP: 1.2,         // goods bought from a merchant (§29.4)
    PRODUCED_PRICE: 0.6,      // a node sells its own produce at ×0.6 of base (§20.9)
    DRIFT: 0.10,              // a seeded ±10% a season on goods prices (§20.9)
    DEMAND: { Craves: 1.5, Wants: 1.2, Normal: 1.0, Glutted: 0.6 },
    DEMAND_STEPS: ["Glutted", "Normal", "Wants", "Craves"],
    GLUT_UNITS: 20,           // selling more than about 20 of one good drops demand a step (§20.9)
    PROSPERITY_PER_SOLD: 2500,// +1 prosperity per 2,500 sold, at most +3 a season (§20.2)
    PROSPERITY_SEASON_CAP: 3,
    MERCHANT_VISIT_GOLD: 500, // a merchant visit counts at 500 gold traded (§15.6)
    // Standing bands (§28.1) and the port-fee multipliers.
    STANDING_BANDS: [
      { name: "Honored", min: 70, fee: 0.5 }, { name: "Trusted", min: 40, fee: 0.5 },
      { name: "Favored", min: 20, fee: 1 }, { name: "Neutral", min: -9, fee: 1 },
      { name: "Wary", min: -39, fee: 2 }, { name: "Hostile", min: -69, fee: 4 },
      { name: "Enemy", min: -999, fee: 4 },
    ],
  };

  // §20.9 Special goods with a base price. stores: the morale a unit gives
  // when the stores are opened (§24.12).
  PC.data.goods = {
    "Rice": { base: 10, kind: "bulk" },
    "Molasses": { base: 10, kind: "bulk" },
    "Sugar": { base: 15, kind: "bulk" },
    "Tobacco": { base: 20, kind: "bulk", stores: 5 },
    "Cotton": { base: 20, kind: "bulk" },
    "Mahogany and logwood": { base: 25, kind: "bulk" },
    "Furs and hides": { base: 45, kind: "bulk" },
    "Cocoa": { base: 50, kind: "bulk" },
    "Coffee": { base: 60, kind: "bulk" },
    "Kill-devil rum": { base: 20, kind: "drink", stores: 5 },
    "Plantation rum": { base: 35, kind: "drink", stores: 7 },
    "Nassau reserve": { base: 120, kind: "drink", stores: 10 },
    "Frisian genever": { base: 40, kind: "drink", stores: 7 },
    "Scotch whisky": { base: 60, kind: "drink", stores: 7 },
    "French wine": { base: 50, kind: "drink", stores: 7 },
    "French brandy": { base: 70, kind: "drink", stores: 7 },
    "Indigo": { base: 40, kind: "fine" },
    // Salvage goods (§32.15; prices §20.9).
    "Ming porcelain": { base: 250, kind: "fine" },
    "Ambergris": { base: 400, kind: "fine" },
    "Pearls": { base: 600, kind: "fine" },
    "Silver bars": { base: 150, kind: "precious" },
    // Prize goods (§20.9, §22.6), added with the hunt (Milestone 5).
    "Scottish broadcloth": { base: 40, kind: "bulk" },
    "Pepper": { base: 90, kind: "fine" },
    "Cochineal": { base: 150, kind: "fine" },
    "Cinnamon": { base: 150, kind: "fine" },
    "Vanilla": { base: 180, kind: "fine" },
    "Bengali muslin and calico": { base: 120, kind: "fine" },
    "Frisian linen and lace": { base: 150, kind: "fine" },
    "Burgundian velvet and brocade": { base: 160, kind: "fine" },
    "Ming silk": { base: 300, kind: "fine" },
    "Ming tea": { base: 100, kind: "fine" },
    "Tortoiseshell": { base: 120, kind: "fine" },
    "Abyssinian ivory": { base: 200, kind: "fine" },
    "Ming lacquerware": { base: 200, kind: "fine" },
    // DEFAULT prices: §22.6 names these but §20.9 gives no figure.
    "Gold dust": { base: 400, kind: "precious" },
    "Emeralds": { base: 600, kind: "precious" },
    "Bengali gems": { base: 800, kind: "precious" },
  };
})();
