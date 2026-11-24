/* Pirate Chronicle — Forge a Clearance (§20.3; Milestone 8, PR 4b).
 *
 * Once a season, 1 AP, from the Cargo tab, in port or at sea: a Forge roll
 * at a flat DR 2 (no Heat, no audience). Units made clean, by Forge
 * training 0 / 1 / 2 / 3: clean 20 / 30 / 40 / 50; partial 10 / 20 / 30 /
 * 40; setback none (the season's attempt is spent). Bulk, fine and treasure
 * weigh 1 a unit, precious goods 2. Goods that are always dirty are left
 * out. The Forger's Kit (a reroll, +5 units) and the Engraver's Seal
 * Matrices (+1 Forge, +10 units) add on (§32.8); an era multiplier (×1 in
 * the Slice). Forged goods are clean everywhere (§28.5).
 *
 * The roll comes first; then the captain picks what to clear, most
 * valuable first by default.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function F() { return PC.data.forgeRules; }
  function stamp(state) { return PC.state.stamp(state); }

  function check() { return { type: "Forge", dr: F().DR }; }
  function rec(state) { var f = state.forge; return f && f.stamp === stamp(state) ? f : null; }

  // What can be forged: dirty treasure and dirty goods, never anything
  // always dirty (church plate; crated muskets, §20.9).
  function stacks(state) {
    var out = [];
    if (state.cargo.treasure.dirty) out.push({ what: "treasure", n: state.cargo.treasure.dirty, weight: F().WEIGHT.treasure, value: PC.data.economy.TREASURE_UNIT });
    Object.keys(state.cargo.goods).forEach(function (g) {
      var n = (state.cargo.goods[g] || {}).dirty || 0, info = PC.data.goods[g] || {};
      if (!n || info.alwaysDirty) return;
      out.push({ what: g, n: n, weight: F().WEIGHT[info.kind] || 1, value: info.base || 0 });
    });
    // Most valuable a weight-unit first (§20.3: the picker opens that way).
    return out.sort(function (a, b) { return b.value / b.weight - a.value / a.weight; });
  }

  function canForge(state) {
    if (rec(state)) return { ok: false, why: "You've already forged papers this season" };
    if (state.ap.left < 1) return { ok: false, why: "No actions left this season" };
    if (!stacks(state).length) return { ok: false, why: "Nothing dirty aboard to clear" };
    return { ok: true };
  }

  function itemBonus(state) {
    return (state.captain.items || []).reduce(function (a, id) { var m = PC.data.modifiers[id]; return a + ((m && m.forgeUnits) || 0); }, 0);
  }
  // The units the roll clears (§20.3).
  function budget(state, outcome) {
    if (outcome === "setback") return 0;
    var t = Math.min(3, (state.captain.training || {}).Forge || 0);
    var base = (outcome === "clean" ? F().CLEAN : F().PARTIAL)[t];
    return Math.round((base + itemBonus(state)) * F().ERA);
  }

  // Roll: 1 AP, once a season.
  function roll(state) {
    var c = canForge(state);
    if (!c.ok) throw new Error(c.why);
    PC.crew.spendAP(state, 1);
    var key = [state.world.seed, stamp(state), "forge"].join("|");
    var r = PC.checks.resolve(state, check(), key, { conditions: [] });
    state.forge = { stamp: stamp(state), outcome: r.outcome, key: key, budget: budget(state, r.outcome), dice: r.dice, edge: r.assessment.edge, done: false };
    if (r.outcome === "setback") state.forge.done = true;
    PC.state.addLog(state, "Forged clearances: " + r.outcome + (state.forge.budget ? " (" + state.forge.budget + " units)" : "") + ".");
    return state.forge;
  }

  function rerollAvailable(state) {
    var f = rec(state);
    if (!f || f.rerolled || f.applied || f.outcome === "clean") return null;
    return PC.checks.availableReroll(state, check(), f.outcome, { conditions: [] });
  }
  function reroll(state) {
    var f = rec(state), r = rerollAvailable(state);
    if (!r) throw new Error("No reroll available.");
    state.rerollsUsed[r.id] = (state.rerollsUsed[r.id] || 0) + 1;
    var res = PC.checks.resolve(state, check(), f.key + "|reroll", { conditions: [] });
    f.outcome = res.outcome; f.rerolled = r.name; f.dice = res.dice; f.edge = res.assessment.edge;
    f.budget = budget(state, f.outcome);
    f.done = f.outcome === "setback";
    return f;
  }

  // The default picks: most valuable first, until the budget runs out.
  function defaultPicks(state, units) {
    var left = units, out = {};
    stacks(state).forEach(function (s) {
      var n = Math.min(s.n, Math.floor(left / s.weight));
      if (n > 0) { out[s.what] = n; left -= n * s.weight; }
    });
    return out;
  }
  function weightOf(state, picks) {
    var byWhat = {};
    stacks(state).forEach(function (s) { byWhat[s.what] = s; });
    return Object.keys(picks).reduce(function (a, w) { return a + (byWhat[w] ? byWhat[w].weight * picks[w] : 0); }, 0);
  }

  // Clear the picked units. Returns what was cleared.
  function apply(state, picks) {
    var f = rec(state);
    if (!f || f.done || !f.budget) throw new Error("No forged papers to use.");
    var byWhat = {};
    stacks(state).forEach(function (s) { byWhat[s.what] = s; });
    var w = 0, done = [];
    Object.keys(picks).forEach(function (k) {
      var n = Math.max(0, Math.floor(picks[k] || 0));
      if (!n || !byWhat[k]) return;
      n = Math.min(n, byWhat[k].n);
      w += n * byWhat[k].weight;
    });
    if (w > f.budget) throw new Error("That's more than your papers cover (" + f.budget + " units).");
    Object.keys(picks).forEach(function (k) {
      var n = Math.min(Math.max(0, Math.floor(picks[k] || 0)), byWhat[k] ? byWhat[k].n : 0);
      if (!n) return;
      if (k === "treasure") { state.cargo.treasure.dirty -= n; state.cargo.treasure.clean += n; }
      else { state.cargo.goods[k].dirty -= n; state.cargo.goods[k].clean += n; }
      done.push(n + " " + (k === "treasure" ? "treasure" : k));
    });
    f.done = true; f.applied = done;
    PC.state.addLog(state, "Forged papers cleared " + (done.join(", ") || "nothing") + ".");
    return { cleared: done, weight: w, budget: f.budget };
  }

  PC.forgery = { check: check, rec: rec, stacks: stacks, canForge: canForge, budget: budget, roll: roll, rerollAvailable: rerollAvailable, reroll: reroll, defaultPicks: defaultPicks, weightOf: weightOf, apply: apply };
})();
