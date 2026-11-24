/* Pirate Chronicle — Norfolk's first visit and its errands (§17.4;
 * Milestone 7, PR 5), and the barkeep favors at both Taverns (§16.6).
 *
 * The scenes are data (content/norfolk_scenes.js). This file holds what
 * they compute: the inspection's prices and confiscation (§5 of the
 * Norfolk records), Godfrey joining, Drunken Sailors' deliveries and
 * Horace's liquor buying (§7, §10), The Apprentices' costs, and which
 * barkeep favor the season offers. It registers the scene tests ({ fn }),
 * effects ({ hook }) and text values ({port_fee}) the scenes use.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function E() { return PC.data.economy; }
  function D() { return PC.data.norfolkRules; }
  function stamp(state) { return PC.state.stamp(state); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function here(state) { return state.location && state.location.node; }

  // ---- The first inspection (Norfolk records §5) --------------------------------

  function portFee(state) { return PC.node.portFee(state, "norfolk"); }

  // One stack's fence value (§6 of the records: the bribe after the goods
  // are found is half the fence value of the goods at risk).
  function unitValue(state, what) {
    if (what === "treasure") return E().TREASURE_UNIT * PC.node.tierOf(state, "norfolk").treasure;
    return PC.node.salePrice(state, "norfolk", what);
  }

  // Every dirty stack aboard. DEFAULT: dirty treasure counts as cargo the
  // search can find, as dirty goods do.
  function dirtyStacks(state) {
    var out = [];
    Object.keys(state.cargo.goods).forEach(function (g) { var n = (state.cargo.goods[g] || {}).dirty || 0; if (n) out.push({ what: g, n: n }); });
    if (state.cargo.treasure.dirty) out.push({ what: "treasure", n: state.cargo.treasure.dirty });
    return out;
  }
  // What the search puts at risk: everything dirty, or after the Smuggler's
  // partial only the least valuable stack.
  function atRisk(state) {
    var all = dirtyStacks(state);
    var only = state.flags.nor_fv1_least;
    return only ? all.filter(function (s) { return s.what === only; }) : all;
  }
  function riskValue(state) {
    return Math.round(atRisk(state).reduce(function (a, s) { return a + s.n * unitValue(state, s.what) * E().FENCE_RATE; }, 0));
  }
  // The crate the soldiers carry out: the largest dirty stack, or the one
  // the Smuggler's partial left them.
  function dirtyGood(state) {
    var r = atRisk(state).slice().sort(function (a, b) { return b.n - a.n; })[0];
    if (!r) return "contraband";
    return r.what === "treasure" ? "stolen silver" : r.what.toLowerCase();
  }
  function bribeBefore(state) { return D().BRIBE_BEFORE * portFee(state); }
  function bribeFound(state) { return Math.max(D().BRIBE_FOUND_MIN, Math.round(D().BRIBE_FOUND * riskValue(state))); }
  // The price after a Haggle (×1.5 clean, ×1.75 partial, ×2 otherwise).
  function priceOf(state, what) {
    var base = what === "bribe_found" ? bribeFound(state) : bribeBefore(state);
    return Math.round(base * (state.flags.nor_fv1_price || 2));
  }

  function confiscate(state) {
    var gone = [];
    atRisk(state).forEach(function (s) {
      if (s.what === "treasure") state.cargo.treasure.dirty -= s.n;
      else PC.crew.removeGood(state, s.what, s.n, true);
      gone.push(s.n + " " + (s.what === "treasure" ? "dirty treasure" : s.what));
    });
    return gone;
  }

  // ---- The hometown line and the Quartermaster's bark ---------------------------

  var YEARS = ["A year ago", "Two years ago", "Three years ago", "Four years ago", "Five years ago", "Six years ago"];
  function raidYear(state) {
    var r = D().RAIDS[state.captain.homeCity];
    return r == null ? null : r;
  }
  function yearsSinceRaid(state) {
    var r = raidYear(state);
    if (r == null) return "Not long ago";
    var now = state.time.year + [0.3, 0.55, 0.75, 0.95][state.time.season];
    return YEARS[Math.max(0, Math.min(YEARS.length - 1, Math.round(now - r) - 1))];
  }
  function qmWarmth(state) {
    var q = PC.officers.quartermaster(state);
    if (!q || !q.voice) return "neutral"; // an Acting Quartermaster speaks the neutral line
    if (q.warmth) return q.warmth;
    var t = (PC.data.creator.OFFICER_TRAITS || []).filter(function (x) { return x.id === q.voice; })[0];
    return t ? t.warmth : "neutral";
  }

  // ---- Variant C: is the loss quest still open? --------------------------------

  function variantCActive(state) {
    if (state.captain.loss !== "C") return false;
    var r = (state.quests || {}).what_was_lost;
    if (r && r.status && r.status !== "open") return false;
    var dl = PC.data.quests.what_was_lost.deadline;
    return state.time.year * 4 + state.time.season <= dl.year * 4 + dl.season;
  }

  // ---- Drunken Sailors (§7, §10): Horace wants 30 units of good liquor -------------

  function pendragonOpen(state) {
    var p = D().PENDRAGON_OPENS;
    return state.time.year * 4 + state.time.season >= p.year * 4 + p.season;
  }
  function liquorKinds(state) {
    return D().GOOD_LIQUOR.filter(function (g) { return !(g === "French wine" && pendragonOpen(state)); });
  }
  function liquorAboard(state) {
    var out = [];
    liquorKinds(state).forEach(function (g) {
      var e = state.cargo.goods[g];
      if (!e) return;
      if (e.clean) out.push({ good: g, n: e.clean, dirty: false });
      if (e.dirty) out.push({ good: g, n: e.dirty, dirty: true });
    });
    return out.sort(function (a, b) { return (a.dirty ? 1 : 0) - (b.dirty ? 1 : 0); }); // clean first
  }
  function delivered(state) { return state.world.dsDelivered || 0; }
  function dsOpen(state) { return !!state.flags.nor_drunken_sailors && !state.flags.nor_ds_done; }

  // Sell to Horace: during the errand at ×1.5 clean and ×1.0 dirty, up to
  // what's left of the 30; afterward he buys any amount at ×1.25 / ×1.0
  // (the Norfolk price). DEFAULT: the gold goes to crew gold, as any sale.
  function sellToHorace(state) {
    var L = PC.data.nodes.norfolk.lines.horaceLiquor;
    var errand = dsOpen(state);
    var cap = errand ? D().DS_UNITS - delivered(state) : Infinity;
    var have = liquorAboard(state);
    if (!have.length) return { line: L.nothing, units: 0, gold: 0 };
    var units = 0, gold = 0, anyDirty = false, anyClean = false;
    have.forEach(function (s) {
      if (cap - units <= 0) return;
      var n = Math.min(s.n, cap - units);
      var mult = s.dirty ? D().DIRTY_MULT : errand ? D().DS_MULT : D().AFTER_MULT;
      gold += Math.round(n * PC.node.salePrice(state, "norfolk", s.good) * mult);
      PC.crew.removeGood(state, s.good, n, s.dirty);
      units += n;
      if (s.dirty) anyDirty = true; else anyClean = true;
    });
    state.money.crew += gold;
    var lines = [];
    var out = { units: gold ? units : 0, gold: gold, lines: lines };
    if (errand) {
      state.world.dsDelivered = delivered(state) + units;
      if (delivered(state) >= D().DS_UNITS) {
        state.flags.nor_ds_done = true;
        PC.npcs.moveRung(state, "horace", 1);
        state.meters.standing.avalon = Math.max(-100, Math.min(100, (state.meters.standing.avalon || 0) + D().DS_STANDING));
        out.done = true;
        out.line = PC.data.nodes.norfolk.lines.drunkenSailors.done;
      } else out.line = PC.data.nodes.norfolk.lines.drunkenSailors.partial.replace("[number]", delivered(state));
    } else {
      out.line = anyClean ? L.clean : L.dirty;
      if (anyClean && anyDirty) lines.push(L.dirty);
    }
    PC.state.addLog(state, "Sold Horace " + plural(units, "unit") + " of liquor for " + gold + " crew gold" + (out.done ? "; Drunken Sailors is done" : "") + ".");
    return out;
  }

  // ---- Barkeep favors (§16.6): one a season at each Tavern ---------------------

  function favorScene(state) {
    var id = here(state);
    if (!D().FAVORS[id]) return null;
    var r = PC.rng.fromKey([state.world.seed, stamp(state), id, "favor"].join("|"));
    var type = D().FAVOR_TYPES[Math.floor(r() * 3)];
    var sets = D().FAVORS[id];
    var set = sets[Math.floor(r() * sets.length)];
    return "fav_" + id + "_" + set + "_" + type;
  }
  // On offer in a season on a seeded 50% roll; once a season; gone once done
  // (Playtest Pins 0.8, #22). No action to do it.
  function favorOnOffer(state) {
    var r = PC.rng.fromKey([state.world.seed, stamp(state), here(state), "favor-offer"].join("|"));
    return r() < D().FAVOR_CHANCE;
  }
  function favorOffer(state) {
    var sc = favorScene(state);
    if (!sc) return null;
    if (!favorOnOffer(state)) return null;
    var c = PC.scenes.canEnter(state, sc);
    var anyDone = Object.keys(state.seen).some(function (k) { return k.indexOf("fav_" + here(state) + "_") === 0 && state.seen[k] === PC.scenes.seasonStamp(state); });
    if (anyDone) return null;
    if (here(state) === "ocracoke" && !PC.node.firstTavernDone(state)) return null;
    var refuse = PC.npcs.serviceLevel ? PC.npcs.serviceLevel(state, PC.node.slotNpc(here(state), "keeper")) == null : false;
    return { scene: sc, ok: c.ok && !refuse, why: refuse ? PC.text.render("{keeper.He} won't serve you", state) : c.ok ? null : c.why };
  }

  // ---- The registered scene tests, effects and values ------------------------------

  var F = PC.sceneFns;
  F.addCond("dirtyAtRisk", function (state) { return atRisk(state).length > 0; });
  F.addCond("noDirty", function (state) { return atRisk(state).length === 0; });
  F.addCond("afford", function (state, what, mult) {
    var amt = mult === "price" ? priceOf(state, what) : Math.round((what === "bribe_found" ? bribeFound(state) : what === "bribe_before" ? bribeBefore(state) : Number(what)) * Number(mult || 1));
    return PC.crew.canPay(state, amt);
  });
  F.addCond("qmWarmth", function (state, w) { return qmWarmth(state) === w; });
  F.addCond("hometown", function (state) { return (state.captain.tags || []).indexOf("Ash-Born") >= 0 && raidYear(state) != null; });
  F.addCond("variantC", function (state) { return variantCActive(state); });
  F.addCond("gunnerAboard", function (state) { var g = PC.officers.holding(state, "Gunner"); return !!(g && g.id !== "godfrey"); });
  F.addCond("hasAp", function (state) { return state.ap.left >= 1; });
  F.addCond("seasonedHand", function (state) { return (state.crew.tiers.Seasoned || 0) + (state.crew.tiers.Veteran || 0) > 0; });

  var payChip = function (amt) { return { icon: "gold", text: "−" + amt + " gold (crew gold first, then your purse)", ink: "mid" }; };
  function pay(state, amt) { var p = PC.crew.payFrom(state, amt, true); return (p.crew ? p.crew + " crew gold" : "") + (p.crew && p.purse ? ", " : "") + (p.purse ? p.purse + " purse gold" : ""); }

  F.addHook("nor_port_fee", {
    apply: function (state) { var r = PC.node.payPortFee(state, "norfolk"); return r.lines.join(" "); },
    chip: function (state) { return { icon: "gold", text: "The port fee · " + portFee(state) + " gold", ink: "mid" }; },
  });
  F.addHook("nor_pay", {
    amount: function (state, e) { return e.mult === "price" ? priceOf(state, e.what) : Math.round((e.what === "bribe_found" ? bribeFound(state) : bribeBefore(state)) * (e.mult || 1)); },
    apply: function (state, e) { return "Paid " + pay(state, this.amount(state, e)) + "."; },
    chip: function (state, e) { return payChip(this.amount(state, e)); },
  });
  F.addHook("nor_price", { apply: function (state, e) { state.flags.nor_fv1_price = e.mult; return null; } });
  F.addHook("nor_least", {
    apply: function (state) {
      var s = dirtyStacks(state).sort(function (a, b) { return unitValue(state, a.what) - unitValue(state, b.what); })[0];
      state.flags.nor_fv1_least = s ? s.what : null;
      return null;
    },
  });
  F.addHook("nor_confiscate", {
    apply: function (state) { var g = confiscate(state); return g.length ? "Confiscated: " + g.join(", ") + "." : null; },
    chip: function (state) {
      var r = atRisk(state);
      return r.length ? { icon: "treasure", text: "Confiscated: " + r.map(function (s) { return s.n + " " + (s.what === "treasure" ? "dirty treasure" : s.what); }).join(", "), ink: "bad" } : null;
    },
  });
  // Jail (§43) isn't built: the story ends here (§37.1), until Milestone 8.
  F.addHook("nor_jail", {
    apply: function (state) { state.flags.nor_jailed = true; state.gameOver = { how: "captured", line: "jailed" }; return "Jailed at Norfolk."; },
    chip: function () { return { icon: "person", text: "Hauled off to prison", ink: "bad" }; },
  });
  F.addHook("godfrey_join", {
    apply: function (state) {
      state.money.crew -= PC.officers.FEE;
      PC.officers.joinNamed(state, "godfrey");
      state.flags.godfrey_hired = true;
      return "Hired Nicholas Godfrey (Gunner) for " + PC.officers.FEE + " crew gold.";
    },
    chip: function (state) {
      var g = PC.officers.holding(state, "Gunner");
      return { icon: "officer", text: "Nicholas Godfrey joins as your Gunner · −" + PC.officers.FEE + " crew gold" + (g && g.id !== "godfrey" ? " · " + g.first + " is dismissed" : ""), ink: "good" };
    },
  });
  F.addHook("lose_hand", {
    apply: function (state) {
      var t = (state.crew.tiers.Seasoned || 0) ? "Seasoned" : "Veteran";
      state.crew.tiers[t] -= 1; state.crew.count -= 1;
      return "A " + t + " hand stays at the Dockyard for good.";
    },
    chip: function (state) { return { icon: "officer", text: "A " + ((state.crew.tiers.Seasoned || 0) ? "Seasoned" : "Veteran") + " hand stays with Christoph for good", ink: "bad" }; },
  });
  F.addHook("pay_gold", {
    apply: function (state, e) { return "Paid " + pay(state, e.amount) + "."; },
    chip: function (state, e) { return payChip(e.amount); },
  });
  F.addHook("keeper_rung", {
    apply: function (state, e) { PC.npcs.moveRung(state, PC.node.slotNpc(here(state), "keeper"), e.delta); return null; },
    chip: function (state, e) {
      var id = PC.node.slotNpc(here(state), "keeper"), n = PC.npcs.get(state, id);
      var to = Math.max(-3, Math.min(3, (n ? n.rung : 0) + e.delta));
      return { icon: "rel", text: (n ? n.full || n.first : "The keeper") + " · now " + PC.npcs.rungName(to), ink: e.delta > 0 ? "good" : "bad" };
    },
  });
  F.addHook("keeper_line", {
    apply: function () { return null; },
    chip: function () { return null; },
  });

  PC.text.vars.port_fee = function (state) { return portFee(state) + " gold"; };
  PC.text.vars.bribe_before = function (state) { return bribeBefore(state) + " gold"; };
  PC.text.vars.bribe_before_2 = function (state) { return priceOf(state, "bribe_before") + " gold"; };
  PC.text.vars.bribe_found = function (state) { return bribeFound(state) + " gold"; };
  PC.text.vars.bribe_found_2 = function (state) { return priceOf(state, "bribe_found") + " gold"; };
  PC.text.vars.dirty_good = dirtyGood;
  PC.text.vars.ship = function (state) { return state.ship.name; };
  PC.text.vars.city = function (state) { return state.captain.homeCity || "your home"; };
  PC.text.vars.years_since_raid = yearsSinceRaid;
  PC.text.vars.gunner_name = function (state) { var g = PC.officers.holding(state, "Gunner"); return g ? (g.first + " " + (g.last || "")).trim() : "your Gunner"; };
  PC.text.vars.dismiss_pay = function (state) { return PC.officers.dismissPay(state); };
  PC.text.vars.waters = function (state) { return PC.quests.tridentWaters(state).name; };

  PC.norfolk = {
    portFee: portFee, atRisk: atRisk, riskValue: riskValue, dirtyGood: dirtyGood, bribeBefore: bribeBefore, bribeFound: bribeFound, priceOf: priceOf,
    confiscate: confiscate, yearsSinceRaid: yearsSinceRaid, qmWarmth: qmWarmth, variantCActive: variantCActive,
    liquorKinds: liquorKinds, liquorAboard: liquorAboard, delivered: delivered, dsOpen: dsOpen, sellToHorace: sellToHorace, pendragonOpen: pendragonOpen,
    favorScene: favorScene, favorOffer: favorOffer,
  };
})();
