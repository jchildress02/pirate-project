/* Pirate Chronicle — the check system (§11).
 *
 *   Roll 2d6 + edge.  5 or less: setback.  6-8: partial.  9+: clean.
 *   Edge = stat + type training + captain modifiers + meter modifiers - DR,
 *   clamped to -4..+6.
 *
 * Nothing in this file touches the screen; ui.js draws what these return.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var RULES = {
    EDGE_MIN: -4,
    EDGE_MAX: 6,
    CAPTAIN_MOD_CAP: 3, // net traits/flaws/tags/items, ±3 (§11.2)
    METER_MOD_CAP: 3,   // Dread and Standing slot, capped at +3 (§11.2)
    PARTIAL_AT: 6,
    CLEAN_AT: 9,
    // Ruled (Milestone 0 chat, November 13, 2026): the locked-option UI
    // triggers at an unclamped edge of -4 or lower (§11.2).
    LOCK_AT_OR_BELOW: -4,
    DR_MAX: 8, // data accepts 0-8; Year 1 content uses 0-5
  };

  var STATS = ["Cunning", "Daring", "Command", "Seamanship", "Charm", "Grit"];

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function readTotal(total) {
    if (total >= RULES.CLEAN_AT) return "clean";
    if (total >= RULES.PARTIAL_AT) return "partial";
    return "setback";
  }

  // Exact odds for an edge, counted over all 36 dice pairs.
  function odds(edge) {
    var partialOrBetter = 0, clean = 0;
    for (var a = 1; a <= 6; a++) for (var b = 1; b <= 6; b++) {
      var r = readTotal(a + b + edge);
      if (r !== "setback") partialOrBetter++;
      if (r === "clean") clean++;
    }
    return { partialOrBetter: partialOrBetter / 36, clean: clean / 36 };
  }

  // The tier shown to the player, from their actual edge (§11.3).
  function tier(edge) {
    if (edge >= 5) return "Trivial";
    if (edge >= 3) return "Very Easy";
    if (edge >= 1) return "Easy";
    if (edge >= -1) return "Medium";
    if (edge === -2) return "Hard";
    return "Very Hard";
  }

  // DR labels for authors (§11.3).
  var DR_LABELS = ["Routine", "Simple", "Moderate", "Standard", "Demanding", "Brutal", "Heroic", "Legendary", "Mythic"];

  function checkTypeInfo(type) {
    var t = PC.data.checkTypes[type];
    if (!t) throw new Error("Unknown check type: " + type);
    return t;
  }

  // Which stats a check uses: the type's home stat, or a scene override,
  // plus an optional second stat (§11.2).
  function statsUsed(check) {
    var first = check.stat || checkTypeInfo(check.type).stat;
    return check.stat2 ? [first, check.stat2] : [first];
  }

  // Two stats average, rounded up (Cunning 3 with Charm 1 gives 2).
  function statValue(captain, stats) {
    var sum = 0;
    stats.forEach(function (s) { sum += captain.stats[s] || 0; });
    return Math.ceil(sum / stats.length);
  }

  // Every modifier source the captain carries. Each id points at an entry
  // in PC.data.modifiers. Unknown ids are skipped (content may lag code).
  function captainSources(captain) {
    var out = [];
    ["traits", "flaws", "tags", "items"].forEach(function (kind) {
      (captain[kind] || []).forEach(function (id) {
        var m = PC.data.modifiers[id];
        if (m) out.push({ id: id, kind: kind, mod: m });
      });
    });
    return out;
  }

  function whenMatches(when, ctx) {
    if (!when) return true;
    if (when.condition && (ctx.conditions || []).indexOf(when.condition) < 0) return false;
    return true;
  }

  // Captain modifiers for one check. A modifier that names a type follows
  // the type; one that names a stat follows the stats actually used (§11.2).
  // A modifier with the same name never applies twice.
  function captainModifiers(captain, check, stats, ctx) {
    var seen = {}, parts = [], capped = 0, outside = 0;
    captainSources(captain).forEach(function (src) {
      (src.mod.edge || []).forEach(function (e) {
        var hit = (e.type && e.type === check.type) ||
                  (e.stat && stats.indexOf(e.stat) >= 0);
        if (!hit || !whenMatches(e.when, ctx)) return;
        var name = src.mod.name || src.id;
        if (seen[name]) return;
        seen[name] = true;
        parts.push({ label: name, value: e.value, outsideCap: !!e.outsideCap });
        if (e.outsideCap) outside += e.value; else capped += e.value;
      });
    });
    var cappedTotal = clamp(capped, -RULES.CAPTAIN_MOD_CAP, RULES.CAPTAIN_MOD_CAP);
    return { parts: parts, total: cappedTotal + outside, wasCapped: cappedTotal !== capped };
  }

  // Meter modifiers (Dread and Standing, §11.8.5). Not built in Milestone 0:
  // a scene can pass a fixed value as check.meter while the real rule waits.
  function meterModifier(state, check) {
    var v = check.meter || 0;
    return clamp(v, -99, RULES.METER_MOD_CAP);
  }

  // Full breakdown of a check for one captain. Pure: no dice rolled.
  function assess(state, check, ctx) {
    ctx = ctx || {};
    var cap = state.captain;
    var stats = statsUsed(check);
    var dr = check.dr || 0;
    if (dr < 0 || dr > RULES.DR_MAX) throw new Error("DR out of range: " + dr);
    var parts = [];
    var sv = statValue(cap, stats);
    parts.push({ label: stats.join(" + ") + (stats.length > 1 ? " (average)" : ""), value: sv });
    var tr = (cap.training && cap.training[check.type]) || 0;
    if (tr) parts.push({ label: check.type + " training", value: tr });
    var mods = captainModifiers(cap, check, stats, ctx);
    mods.parts.forEach(function (p) { parts.push(p); });
    var meter = meterModifier(state, check);
    if (meter) parts.push({ label: "Reputation", value: meter });
    parts.push({ label: "Difficulty (" + DR_LABELS[dr] + ")", value: -dr });
    var raw = sv + tr + mods.total + meter - dr;
    var edge = clamp(raw, RULES.EDGE_MIN, RULES.EDGE_MAX);
    var o = odds(edge);
    return {
      type: check.type,
      stats: stats,
      dr: dr,
      parts: parts,
      modsCapped: mods.wasCapped,
      rawEdge: raw,
      edge: edge,
      tier: tier(edge),
      odds: o,
      locked: raw <= RULES.LOCK_AT_OR_BELOW,
    };
  }

  // Roll a check with a seeded key.
  function resolve(state, check, key, ctx) {
    var a = assess(state, check, ctx);
    var dice = PC.rng.roll2d6(key);
    var total = dice[0] + dice[1] + a.edge;
    return { assessment: a, dice: dice, total: total, outcome: readTotal(total), key: key };
  }

  // Which reroll (if any) the captain can use on this check right now.
  // Once per season per source; a few sources grant two (§11.2, §5.7).
  function availableReroll(state, check, outcome) {
    if (outcome === "clean") return null;
    var used = state.rerollsUsed || {};
    var found = null;
    captainSources(state.captain).forEach(function (src) {
      if (found) return;
      var r = src.mod.reroll;
      if (!r) return;
      if (r.types && r.types.indexOf(check.type) < 0) return;
      if (r.on && r.on.indexOf(outcome) < 0) return;
      var per = r.perSeason || 1;
      if ((used[src.id] || 0) >= per) return;
      found = { id: src.id, name: src.mod.name || src.id };
    });
    return found;
  }

  PC.checks = {
    RULES: RULES,
    STATS: STATS,
    DR_LABELS: DR_LABELS,
    readTotal: readTotal,
    odds: odds,
    tier: tier,
    statsUsed: statsUsed,
    assess: assess,
    resolve: resolve,
    availableReroll: availableReroll,
  };
})();
