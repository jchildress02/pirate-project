/* Weather (§42): the outlook and condition tables, their effects and the
 * popup lines. Every number is a placeholder (§42); the lines marked
 * PLACEHOLDER are §42.7's proposals, for the author to rewrite (PH4).
 * The rules are in js/weather.js.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  PC.data = PC.data || {};

  PC.data.weather = {
    OUTLOOKS: ["Fair", "Unsettled", "Foul"],
    // §42.3 [Fair, Unsettled, Foul] by season and zone.
    OUTLOOK: {
      north: { Spring: [50, 40, 10], Summer: [70, 25, 5], Hurricane: [25, 40, 35], Winter: [30, 45, 25] },
      south: { Spring: [65, 30, 5], Summer: [60, 30, 10], Hurricane: [15, 40, 45], Winter: [65, 30, 5] },
    },
    FIXED: { "1754-2-north": "Foul" }, // Hurricane 1754 in the north (§42.3, the Battle of Ocracoke's storm)

    CONDITIONS: ["Calm", "Fair", "Rough", "Fog", "Storm"],
    // §42.4 [Calm, Fair, Rough, Fog, Storm] by outlook.
    CONDITION: { Fair: [20, 60, 10, 10, 0], Unsettled: [10, 35, 30, 15, 10], Foul: [0, 15, 40, 10, 35] },
    DENSITY: { Calm: -10, Fair: 0, Rough: -5, Fog: -10, Storm: -15 }, // points off §22.5's density
    SWEEPS: ["Cutter", "Sloop", "Royal Sloop", "Schooner"],             // Calm doesn't slow them

    READ_DR: { Fair: 1, Unsettled: 2, Foul: 3 },  // §42.6
    STORM_BATCH_DR: 2,                              // §42.4 Ride Out Storm before a Storm batch
    STRIKE: { Foul: 0.50, Unsettled: 0.15, Fair: 0 }, // §42.7
    STRIKE_HULL: [0.10, 0.20],
    SHELTERED: ["ocracoke", "edenton", "haven", "talanee"],
    WINTER_SALVAGE: { quantity: 1.25, goodFind: 5 }, // §42.8

    // Text badges until the art chat's icons (§42.10).
    BADGE: { Fair: "☀ Fair", Unsettled: "☁ Unsettled", Foul: "⛈ Foul", Calm: "≈ Calm", Rough: "〰 Rough", Fog: "▒ Fog", Storm: "⛈ Storm" },

    lines: {
      // §42.7 (PLACEHOLDER, PH4: the author writes them).
      hit: "PLACEHOLDER: A hurricane tore through the [Waters] as the season turned. The [Ship] rode it out at anchor, but she'll need the shipwright.",
      spared: "PLACEHOLDER: A hurricane tore through the [Waters]. Snug in the shallows, the [Ship] barely felt it.",
      elsewhere: "PLACEHOLDER: Word comes of a hurricane in the [Waters].",
      hitStart: "PLACEHOLDER: A hurricane tore through the [Waters] as the season opened. The [Ship] rode it out at anchor, but she'll need the shipwright.",
      stormBatch: { clean: "PLACEHOLDER: The storm howls, but she rides it out.", partial: "PLACEHOLDER: A sea comes aboard and stoves in part of the rail.", setback: "PLACEHOLDER: The storm batters her for hours. The crew are soaked, sick and sullen." },
      // Ollie's line, the first Graveyard visit each Winter (§42.8; the author's line, final).
      ollieWinter: "Some new wrecks washed up with the latest storm. Should be some good finds out there.",
    },
  };
})();
