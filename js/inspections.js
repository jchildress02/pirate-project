/* Pirate Chronicle — arrival inspections (§28.5; Milestone 8, PR 3).
 *
 * Inspections go by the port's control: Admiralty ports from Heat 20
 * (Noticed 10%, Wanted 25%, Hunted 50%, Most Wanted 75%), governor ports at
 * half the band's chance from Heat 40, merchant ports never (they shake you
 * down on the fee instead: not live in this build). A clean hold gets a line
 * in the arrival popup; a dirty one plays the inspection scene
 * (content/inspection_scenes.js). Norfolk's scripted first arrival is its
 * own scene (js/norfolk.js) and fires instead of this, once.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function R() { return PC.data.inspectionRules; }
  function E() { return PC.data.economy; }
  function here(state) { return state.location && state.location.node; }
  function nd(id) { return PC.data.nodes[id]; }

  // What kind of port this is for inspections: "admiralty", "governor",
  // "merchant" or null (no faction control: Ocracoke).
  function kind(id) {
    var n = nd(id), c = (n && n.control) || "";
    if (n && n.inspect) return n.inspect;
    if (/Admiralty/.test(c)) return "admiralty";
    if (/Governor/.test(c)) return "governor";
    if (/Merchant/.test(c)) return "merchant";
    return null;
  }

  function chance(state, id) {
    var k = kind(id), n = nd(id);
    if (!k || k === "merchant" || !n || (n.faction !== "avalon" && n.faction !== "frisia")) return 0;
    var h = state.meters.heat[n.faction] || 0, band = PC.meters.heatBand(h);
    var p = R().CHANCE[band] || 0;
    if (k === "governor") return h >= R().GOVERNOR_FROM ? p * R().GOVERNOR_MULT : 0;
    return p;
  }

  // ---- The goods and their price -------------------------------------------

  function unitValue(state, id, what) {
    if (what === "treasure") return E().TREASURE_UNIT * PC.node.tierOf(state, id).treasure;
    return PC.node.salePrice(state, id, what);
  }
  // Every dirty stack aboard (dirty treasure counts as searchable cargo,
  // ruled D6). Forged goods are clean already (§20.3).
  function dirtyStacks(state) {
    var out = [];
    Object.keys(state.cargo.goods).forEach(function (g) { var n = (state.cargo.goods[g] || {}).dirty || 0; if (n) out.push({ what: g, n: n }); });
    if (state.cargo.treasure.dirty) out.push({ what: "treasure", n: state.cargo.treasure.dirty });
    return out;
  }
  // The fence value of what they found (§28.5: the bribe and the jail
  // threshold both read it).
  function foundValue(state, id) {
    id = id || here(state);
    return Math.round(dirtyStacks(state).reduce(function (a, s) { return a + s.n * unitValue(state, id, s.what) * E().FENCE_RATE; }, 0));
  }
  function k(state) { return kind(here(state)) || "admiralty"; }
  function bribeBefore(state) { return R().BRIBE_BEFORE[k(state)] * PC.node.portFee(state, here(state)); }
  function bribeFound(state) { return Math.max(R().BRIBE_FOUND_MIN, Math.round(R().BRIBE_FOUND[k(state)] * foundValue(state))); }
  function threshold(state) { return R().JAIL_ABOVE[k(state)]; }
  // Above the threshold "Take it, then" is locked: the captain has to roll.
  function overThreshold(state) { return foundValue(state) > threshold(state); }
  function crate(state) {
    var r = dirtyStacks(state).slice().sort(function (a, b) { return b.n - a.n; })[0];
    if (!r) return "contraband";
    return r.what === "treasure" ? "stolen silver" : r.what.toLowerCase();
  }

  function confiscate(state) {
    var gone = [];
    dirtyStacks(state).forEach(function (s) {
      if (s.what === "treasure") state.cargo.treasure.dirty -= s.n;
      else PC.crew.removeGood(state, s.what, s.n, true);
      gone.push(s.n + " " + (s.what === "treasure" ? "dirty treasure" : s.what));
    });
    return gone;
  }

  // Bribes come from the purse (§27.1); crew gold covers what it can't.
  function pay(state, amt) {
    amt = Math.round(amt);
    var fromPurse = Math.min(state.money.purse, amt);
    state.money.purse -= fromPurse;
    var fromCrew = Math.min(state.money.crew, amt - fromPurse);
    state.money.crew -= fromCrew;
    return (fromPurse ? fromPurse + " purse gold" : "") + (fromPurse && fromCrew ? ", " : "") + (fromCrew ? fromCrew + " crew gold" : "");
  }
  function canPay(state, amt) { return state.money.purse + state.money.crew >= Math.round(amt); }

  // ---- On arrival -------------------------------------------------------------
  // Returns null (no inspection), { line } (a clean hold) or { scene }.
  function onArrival(state, id) {
    var p = chance(state, id);
    if (!p) return null;
    var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), id, "inspection", state.rolls.inspection = (state.rolls.inspection || 0) + 1].join("|"));
    if (r() >= p) return null;
    state.flags.insp_last = PC.state.stamp(state);
    if (!dirtyStacks(state).length) return { line: ((nd(id).lines || {}).inspection || {}).clean || R().lines.clean };
    return { scene: "insp_search" };
  }

  // ---- The scene's tests and effects ---------------------------------------------
  var F = PC.sceneFns;
  F.addCond("inspDirty", function (state) { return dirtyStacks(state).length > 0; });
  F.addCond("inspJailed", function (state) { return !!state.jailPending; });
  F.addCond("inspUnder", function (state) { return !overThreshold(state); });
  F.addCond("inspAfford", function (state, what, mult) {
    var base = what === "found" ? bribeFound(state) : bribeBefore(state);
    return canPay(state, base * Number(mult || 1));
  });
  F.addHook("insp_pay", {
    amount: function (state, e) { return Math.round((e.what === "found" ? bribeFound(state) : bribeBefore(state)) * (e.mult || 1)); },
    apply: function (state, e) { return "Paid " + pay(state, this.amount(state, e)) + "."; },
    chip: function (state, e) { return { icon: "gold", text: "−" + this.amount(state, e) + " gold (your purse first)", ink: "mid" }; },
  });
  // "Take it, then" (§28.5): confiscation and Heat +5, never jail.
  F.addHook("insp_take", {
    apply: function (state) {
      var g = confiscate(state);
      PC.meters.addHeat(state, nd(here(state)).faction, R().HEAT_CONFISCATED);
      return g.length ? "Confiscated: " + g.join(", ") + "." : null;
    },
    chip: function (state) { return { icon: "treasure", text: "Confiscated: everything dirty aboard · " + factionName(state) + " Heat +" + R().HEAT_CONFISCATED, ink: "bad" }; },
  });
  // A setback (§28.5): confiscation, Heat +5 and the port fee again; jail
  // above the threshold: the cells, charged by Heat (§43, PR 6).
  F.addHook("insp_setback", {
    apply: function (state) {
      var id = here(state), jail = overThreshold(state);
      var g = confiscate(state);
      PC.meters.addHeat(state, nd(id).faction, R().HEAT_CONFISCATED);
      var fee = PC.node.portFee(state, id), paid = PC.crew.payFrom(state, fee, true);
      var line = (g.length ? "Confiscated: " + g.join(", ") + ". " : "") + "Fined " + (paid.crew + paid.purse) + " gold.";
      if (jail) {
        state.flags.jailed_at = id;
        state.jailPending = { node: id, faction: nd(id).faction }; // the cells (§43, PR 6)
        line += " Jailed (" + PC.prison.chargeFor(state, nd(id).faction) + ").";
      }
      return line;
    },
    chip: function (state) {
      return { icon: "treasure", text: "Confiscated · " + factionName(state) + " Heat +" + R().HEAT_CONFISCATED + " · a fine of the port fee" + (overThreshold(state) ? " · jail" : ""), ink: "bad" };
    },
  });
  function factionName(state) { return nd(here(state)).faction === "frisia" ? "Frisian" : "Avalon"; }

  // Tokens for the scene's text.
  PC.text.vars.insp_before = function (state) { return bribeBefore(state) + " gold"; };
  PC.text.vars.insp_before_2 = function (state) { return bribeBefore(state) * 2 + " gold"; };
  PC.text.vars.insp_found = function (state) { return bribeFound(state) + " gold"; };
  PC.text.vars.insp_found_2 = function (state) { return bribeFound(state) * 2 + " gold"; };
  PC.text.vars.insp_crate = function (state) { return crate(state); };
  PC.text.vars.insp_port = function (state) { return nd(here(state)).name; };
  PC.text.vars.insp_take_line = function (state) { return ((nd(here(state)).lines || {}).inspection || {}).takeIt || "PLACEHOLDER: His men carry the goods off as he writes your name in his ledger."; };

  PC.inspections = {
    kind: kind, chance: chance, onArrival: onArrival, dirtyStacks: dirtyStacks, foundValue: foundValue,
    bribeBefore: bribeBefore, bribeFound: bribeFound, threshold: threshold, overThreshold: overThreshold, confiscate: confiscate,
  };
})();
