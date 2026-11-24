/* Pirate Chronicle — the three meters: Standing, Heat and Dread (§28, §11.8.5).
 *
 * Every change to Standing, Heat or Dread goes through here, so the season's
 * offenses and fear deeds are tracked for the season's end: Heat bleed,
 * Standing's forgiveness drift and Dread's decay (§28.1, §28.6, §28.8).
 * Also: the meter modifiers on checks (§11.8.5), the Heat DR on Smuggle,
 * Bribe and Ship Concealment (§28.4), the Dread floor (§5.6), betrayal
 * (§28.6), and who attacks first at sea by Heat and black Standing (§28.1,
 * §28.4).
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function R() { return PC.data.meterRules; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function stamp(state) { return PC.state.stamp(state); }

  // ---- Bands ----------------------------------------------------------------

  // The §11.8.5 table: 20 / 40 / 70 on the positive side; Standing's
  // negative side -1 / -2 / -3 at Wary / Hostile / Enemy.
  function bonus(v) {
    v = v || 0;
    if (v >= 70) return 3;
    if (v >= 40) return 2;
    if (v >= 20) return 1;
    if (v <= -70) return -3;
    if (v <= -40) return -2;
    if (v <= -10) return -1;
    return 0;
  }
  function dreadBonus(state) { return Math.max(0, bonus(state.meters.dread)); }

  // Heat bands (§28.4).
  function heatBand(v) { v = v || 0; return v >= 90 ? "Most Wanted" : v >= 70 ? "Hunted" : v >= 40 ? "Wanted" : v >= 20 ? "Noticed" : "Cold"; }
  // The DR on Smuggle, Bribe and Ship Concealment in that faction's waters.
  function heatDR(v) { var b = heatBand(v); return b === "Wanted" ? 1 : b === "Hunted" || b === "Most Wanted" ? 2 : 0; }

  // Whose port or waters the captain is in: a node's own faction (Avalon or
  // Frisia), otherwise the weather zone's (Avalon in the north, Frisia in the
  // south, as voyage hunters read it, §28.4, §44.8). Ocracoke has no faction
  // and sits in Avalon's waters.
  function factionHere(state) {
    var g = state.minigame;
    if (g && g.kind === "hunt" && g.waters) return g.waters === "south" ? "frisia" : "avalon"; // at sea, the waters decide
    var id = state.location && state.location.node;
    var nd = id && PC.data.nodes[id];
    if (nd && (nd.faction === "avalon" || nd.faction === "frisia")) return nd.faction;
    var place = id && (PC.data.world.places || []).filter(function (p) { return p.id === id; })[0];
    if (place) return place.zone === "south" ? "frisia" : "avalon";
    return null;
  }
  // The faction whose port the captain stands in (null at sea or at Ocracoke).
  function portFaction(state) {
    var id = state.location && state.location.node, nd = id && PC.data.nodes[id];
    return nd && nd.kind !== "ocean" && (nd.faction === "avalon" || nd.faction === "frisia") ? nd.faction : null;
  }

  // ---- Meter modifiers on checks (§11.8.5) ----------------------------------
  // Returns { value, parts }. The slot is capped at +3 (and floors at -3,
  // the Enemy band). A scene's fixed check.meter still adds in.

  function has(conds, c) { return conds.indexOf(c) >= 0; }

  function checkModifier(state, check, ctx) {
    var conds = (ctx && ctx.conditions) || [];
    var t = check.type, parts = [];
    var d = dreadBonus(state);
    var hostile = has(conds, "Underworld") || has(conds, "Hostile");
    // Dread: Intimidate and Discipline always; Recruit, Negotiate, Parley
    // with the Underworld or a hostile audience.
    if (d && (t === "Intimidate" || t === "Discipline" || (hostile && (t === "Recruit" || t === "Negotiate" || t === "Parley")))) parts.push({ label: "Dread", value: d });
    // Dread's cost with Upstanding NPCs: -(bonus - 1), minimum 0.
    if (d > 1 && has(conds, "Upstanding NPC")) parts.push({ label: "Dread (an upstanding sort)", value: -(d - 1) });
    // Black Standing: Recruit, Haggle, Gather Intelligence with the Underworld.
    if (has(conds, "Underworld") && (t === "Recruit" || t === "Haggle" || t === "Gather Intelligence")) {
      var b = bonus(state.meters.standing.pirates);
      if (b) parts.push({ label: "Pirate Standing", value: b });
    }
    // Avalon or Frisian Standing with that faction's [Official], [Merchant]
    // or [Town] audiences, in its ports.
    var pf = portFaction(state);
    if (pf && (has(conds, "Official") || has(conds, "Merchant") || has(conds, "Town")) && !has(conds, "Underworld") &&
        ["Petition", "Negotiate", "Haggle", "Bribe", "Recruit"].indexOf(t) >= 0) {
      var s = bonus(state.meters.standing[pf]);
      if (s) parts.push({ label: (pf === "avalon" ? "Avalon" : "Frisian") + " Standing", value: s });
    }
    if (check.meter) parts.push({ label: "Reputation", value: check.meter });
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0);
    return { value: clamp(total, -3, PC.checks.RULES.METER_MOD_CAP), parts: parts };
  }

  // The Heat step on the DR (§28.4): Smuggle, Bribe and Ship Concealment in
  // a faction's waters.
  function heatStep(state, check) {
    if (["Smuggle", "Bribe", "Ship Concealment"].indexOf(check.type) < 0) return null;
    var f = factionHere(state);
    if (!f) return null;
    var v = state.meters.heat[f] || 0, n = heatDR(v);
    return n ? { label: (f === "avalon" ? "Avalon" : "Frisian") + " Heat (" + heatBand(v) + ")", value: -n } : null;
  }

  // ---- The Dread floor (§5.6, §28.8) ----------------------------------------
  // Tags and carried items (dreadFloor in content/modifiers.js) and officers
  // aboard with a floor trait (Bloodthirsty). Nets out, clamps at 0, capped
  // at 40. Displays wait for the equipment screen (§32.6).
  function dreadFloor(state) {
    var c = state.captain, sum = 0;
    ["traits", "flaws", "tags", "items"].forEach(function (k) {
      (c[k] || []).forEach(function (id) { var m = PC.data.modifiers[id]; if (m && m.dreadFloor) sum += m.dreadFloor; });
    });
    (state.officers || []).forEach(function (o) {
      if (o.gone || o.captured) return;
      [o.voice, o.secondary, o.third].forEach(function (t) { sum += (R().OFFICER_FLOOR[t] || 0); });
    });
    return clamp(sum, 0, R().FLOOR_CAP);
  }
  function liftToFloor(state) {
    var f = dreadFloor(state);
    if (state.meters.dread < f) state.meters.dread = f;
    return f;
  }

  // ---- This season's record --------------------------------------------------
  // offense[faction]: Heat gained with it (an executed crew's prize gains
  // none, so it is no offense, §28.12). black: pirate Standing lost. deed:
  // a fear deed (any Dread gained).
  function seasonRec(state) {
    var st = stamp(state), m = state.meterSeason;
    if (!m || m.stamp !== st) m = state.meterSeason = { stamp: st, offense: {}, blackLoss: false, deed: false };
    return m;
  }

  // ---- Changing the meters ---------------------------------------------------
  // Each returns the change actually made.

  function betrayalActive(state, f) {
    var b = (state.meterState || {}).betrayal || {};
    var until = b[f];
    if (!until) return false;
    var now = state.time.year * 4 + state.time.season;
    return now < until;
  }

  // Heat (§28.6): gains ×0.75 at Standing 40+ with the faction; an offense
  // at 40+ is a betrayal: +10 on top and gains doubled for a year.
  function addHeat(state, f, d, opts) {
    opts = opts || {};
    if (!f || !d) return 0;
    var before = state.meters.heat[f] || 0, gain = d;
    if (d > 0) {
      // A new offense against the faction that pardoned you breaks the pardon:
      // a betrayal whatever your Standing (§28.7), plus Key's -3 and his hunt.
      var brokePardon = !!(state.pardon && state.pardon.faction === f && PC.admiralty && PC.admiralty.breakPardon(state));
      var s = state.meters.standing[f] || 0, wasBetrayed = betrayalActive(state, f);
      if (s >= 40) gain = Math.round(gain * R().TRUSTED_HEAT_MULT);
      if (wasBetrayed) gain *= 2; // gains doubled for the year after a betrayal
      if ((s >= 40 || brokePardon) && !opts.noBetrayal) {
        gain += R().BETRAYAL_HEAT;
        var ms = (state.meterState = state.meterState || {});
        (ms.betrayal = ms.betrayal || {})[f] = state.time.year * 4 + state.time.season + 4;
        PC.state.addLog(state, "Betrayal: " + (f === "avalon" ? "Avalon" : "Frisia") + " won't forget this for a year.");
      }
      seasonRec(state).offense[f] = true;
    }
    state.meters.heat[f] = clamp(before + gain, 0, 100);
    return state.meters.heat[f] - before;
  }

  // Standing. The letter's cap on the other side waits for letters (PR 4).
  function addStanding(state, f, d) {
    if (!f || !d) return 0;
    var before = state.meters.standing[f] || 0;
    // While a letter is held the other side can't rise above -10 (§28.3).
    var cap = PC.letters ? PC.letters.capFor(state, f) : 100;
    var nv = clamp(before + d, -100, 100);
    if (d > 0 && nv > cap) nv = Math.max(before, cap); // a rise stops at the cap
    state.meters.standing[f] = nv;
    if (f === "pirates" && d < 0) seasonRec(state).blackLoss = true;
    return state.meters.standing[f] - before;
  }

  function addDread(state, d) {
    var before = state.meters.dread || 0;
    state.meters.dread = clamp(before + d, dreadFloor(state), 100);
    if (d > 0) seasonRec(state).deed = true;
    return state.meters.dread - before;
  }

  // A fear deed (§28.8): Dread (+2 by default) and black Standing +1.
  // Returns chips.
  function fearDeed(state, dread, why) {
    var dd = addDread(state, dread == null ? R().FEAR_DEED_DREAD : dread);
    var bs = addStanding(state, "pirates", R().FEAR_DEED_BLACK);
    seasonRec(state).deed = true;
    var out = [];
    if (dd) out.push({ icon: "dread", text: "Dread +" + dd + (why ? " (" + why + ")" : ""), ink: "bad" });
    if (bs) out.push({ icon: "standing", text: "Pirate Standing +" + bs, ink: "pirates" });
    return out;
  }

  // ---- The season's end (§28.1, §28.6, §28.8) --------------------------------
  // Bleed by Standing and offense; Frisian posture; forgiveness drift for
  // negative Standing (stops at -9); Dread decay with no fear deed. Returns
  // { lines, chips } for the season-turn popup, including band changes.

  function bleedFor(state, f) {
    var s = state.meters.standing[f] || 0, off = !!seasonRec(state).offense[f];
    var row = s >= 40 ? R().BLEED.high : s <= -40 ? R().BLEED.low : R().BLEED.mid;
    var b = off ? row.offense : row.clean;
    if (f === "frisia") {
      var p = state.world && state.world.posture;
      if (p === "Hunter") return 0;
      if (p === "Distracted") b += R().DISTRACTED_EXTRA;
    }
    return b;
  }

  function seasonEnd(state) {
    var rec = seasonRec(state), lines = [], chips = [];
    var NAME = { avalon: "Avalon", frisia: "Frisian", pirates: "Pirate" };
    ["avalon", "frisia"].forEach(function (f) {
      var h = state.meters.heat[f] || 0;
      if (!h) return;
      var b = bleedFor(state, f), band0 = heatBand(h);
      var nv = clamp(h - b, 0, 100);
      if (nv === h) return;
      state.meters.heat[f] = nv;
      chips.push({ icon: "heat", text: NAME[f] + " Heat −" + (h - nv) + (rec.offense[f] ? " (a season with an offense)" : ""), ink: "good" });
      if (heatBand(nv) !== band0) lines.push(R().lines.heatBand.replace("{faction}", NAME[f]).replace("{band}", heatBand(nv)));
    });
    ["avalon", "frisia", "pirates"].forEach(function (f) {
      var s = state.meters.standing[f] || 0;
      if (s >= R().DRIFT_STOP) return;
      var offended = f === "pirates" ? rec.blackLoss : !!rec.offense[f];
      if (offended) return;
      var b0 = PC.node.standingBand(state, f).name;
      var nv = Math.min(R().DRIFT_STOP, s + R().DRIFT, PC.letters ? PC.letters.capFor(state, f) : 100);
      if (nv <= s) return;
      state.meters.standing[f] = nv;
      chips.push({ icon: "standing", text: NAME[f] + " Standing +" + (nv - s) + " (time heals)", ink: f });
      var b1 = PC.node.standingBand(state, f).name;
      if (b1 !== b0) lines.push(R().lines.standingBand.replace("{faction}", NAME[f]).replace("{band}", b1));
    });
    var floor = liftToFloor(state);
    if (!rec.deed && state.meters.dread > floor) {
      var d0 = state.meters.dread, nd = Math.max(floor, d0 - R().DREAD_DECAY);
      state.meters.dread = nd;
      chips.push({ icon: "dread", text: "Dread −" + (d0 - nd) + " (no fear deeds this season)" });
      if (bonus(nd) !== bonus(d0)) lines.push(R().lines.dreadBand.replace("{bonus}", String(bonus(nd))));
    }
    state.meterSeason = null;
    return { lines: lines, chips: chips };
  }

  // ---- Who attacks first at sea (§28.1, §28.4) -------------------------------
  // A navy ship of a faction whose Heat is 50+ attacks first (15% / 35% /
  // 60% by band); at black Standing -70 or lower every pirate ship has a 35%
  // chance to. r: the seeded random function. Returns the reason, or null.
  function attacksFirst(state, grp, r) {
    if (!grp || grp.hunter || !grp.ships || !grp.ships.length) return null;
    var lead = grp.ships[0];
    var f = lead.flag === "Avalon" ? "avalon" : lead.flag === "Frisia" ? "frisia" : null;
    var war = grp.ships.some(function (s) { return s.role === "War"; });
    if (f && war) {
      var h = state.meters.heat[f] || 0;
      if (h >= R().NAVY_FROM) {
        var p = R().NAVY_ATTACK[heatBand(h)] || 0;
        if (r() < p) return "navy";
      }
    }
    if (lead.flag === "Pirate" && (state.meters.standing.pirates || 0) <= -70 && r() < R().PIRATE_ATTACK) return "pirate";
    return null;
  }

  // ---- Gates (§28.1, §28.2) --------------------------------------------------
  // The crew pool's Standing and Dread multiplier (§24.7): Dread at the pirate
  // havens, Standing in Avalon and Frisian ports (+10% a bonus step; Wary
  // half; Hostile and below none).
  function poolMult(state, id) {
    var nd = PC.data.nodes[id];
    if (!nd) return 1;
    if (nd.haven) return 1 + R().POOL_STEP * dreadBonus(state);
    if (nd.faction === "avalon" || nd.faction === "frisia") {
      var b = bonus(state.meters.standing[nd.faction]);
      if (b <= -2) return 0;
      if (b === -1) return 0.5;
      return 1 + R().POOL_STEP * b;
    }
    return 1;
  }

  // Holdings, homes, trade-ship enrollment and laying up (§28.2): Wary pays
  // +20%; barred at Hostile and Enemy. Returns { ok, mult, why }.
  function officialGate(state, id) {
    var nd = PC.data.nodes[id];
    if (!nd || !nd.faction) return { ok: true, mult: 1 };
    var b = PC.node.standingBand(state, nd.faction).name;
    if (b === "Hostile" || b === "Enemy") return { ok: false, mult: 1, why: "Not at " + b + " Standing here" };
    return { ok: true, mult: b === "Wary" ? 1 + R().WARY_OFFICIAL : 1 };
  }

  PC.meters = {
    bonus: bonus, dreadBonus: dreadBonus, heatBand: heatBand, heatDR: heatDR, factionHere: factionHere, portFaction: portFaction,
    checkModifier: checkModifier, heatStep: heatStep,
    dreadFloor: dreadFloor, liftToFloor: liftToFloor,
    addHeat: addHeat, addStanding: addStanding, addDread: addDread, fearDeed: fearDeed, betrayalActive: betrayalActive,
    seasonRec: seasonRec, seasonEnd: seasonEnd, bleedFor: bleedFor,
    attacksFirst: attacksFirst, poolMult: poolMult, officialGate: officialGate,
  };
})();
