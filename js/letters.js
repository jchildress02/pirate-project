/* Pirate Chronicle — letters of marque and Legendary regard (Milestone 8, PR 4).
 *
 * Letters (§22.4, §29.12, §28.3): one at a time. A letter covers the axes
 * its issuer names; a covered prize's cargo and hull are clean, the issuer
 * gains +1 Standing a covered prize (at most +4 a season), and the other
 * side still charges the full uncovered Heat and Standing (only the
 * issuer's side honors a letter, §31.1). Holding one holds the other side's
 * Standing at -10 or below, halves port fees at the issuer's ports (§20.4),
 * and the issuer's cut comes off every clean sale at the till (§29.12).
 *
 * Regard (§39.6, §17.4.7): each Legendary's hidden -5..+5 opinion of the
 * captain, unmet until the first meeting; a journal line when it crosses
 * into a new band. Key's is the only one live in this build.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function L() { return PC.data.letterRules; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- Regard ------------------------------------------------------------------

  function regardRec(state, who) {
    state.regard = state.regard || {};
    return (state.regard[who] = state.regard[who] || { v: 0, met: false });
  }
  function regard(state, who) { return regardRec(state, who).v; }
  function regardBand(v) {
    return v <= -4 ? "Sworn enemy" : v <= -2 ? "Distrusted" : v <= 1 ? "Neutral" : v <= 3 ? "Respected" : "Trusted";
  }
  function band(state, who) { var r = regardRec(state, who); return r.met ? regardBand(r.v) : "Unmet"; }
  function meet(state, who) { regardRec(state, who).met = true; }
  // Move regard; a journal (log) line when it crosses into a new band.
  // Never shown as a number (§39.6).
  function addRegard(state, who, d) {
    var r = regardRec(state, who);
    var b0 = regardBand(r.v);
    r.met = true;
    r.v = clamp(r.v + d, -5, 5);
    var b1 = regardBand(r.v);
    if (b1 !== b0) {
      var line = (L().regardLines[who] || {})[b1];
      if (line) PC.state.addLog(state, line);
      return { from: b0, to: b1, line: line || null };
    }
    return null;
  }

  // ---- Letters ---------------------------------------------------------------------

  function letter(state) { return state.letter || null; }
  function issuer(id) { return L().issuers[id]; }
  function holds(state) { return !!state.letter; }
  // The other side: Avalon's letter answers to Frisia, and back.
  function otherSide(faction) { return faction === "avalon" ? "frisia" : faction === "frisia" ? "avalon" : null; }

  // Does the letter cover a ship of this flag? Pirates are always fair game
  // and clean whatever the letter (§22.4), but never "covered" for Standing.
  function covers(state, flag) {
    var l = letter(state);
    return !!(l && issuer(l.issuer).covers.indexOf(flag) >= 0);
  }
  // Is her cargo (and her hull) clean?
  function legitimate(state, flag) { return flag === "Pirate" || covers(state, flag); }

  // Can the captain take this issuer's letter now (§28.2)? Key's: Avalon 0+
  // and not Distrusted (or worse) by Key.
  function canTake(state, id) {
    var is = issuer(id);
    if (!is) return { ok: false, why: "No such letter" };
    if (state.letter && state.letter.issuer === id) return { ok: false, why: "You already hold it" };
    if ((state.meters.standing[is.faction] || 0) < is.minStanding) return { ok: false, why: "Needs " + is.factionName + " Standing " + is.minStanding + " or better" };
    if (is.legendary) {
      var b = band(state, is.legendary);
      if (b === "Distrusted" || b === "Sworn enemy") return { ok: false, why: is.name + " won't issue it to a captain he " + (b === "Sworn enemy" ? "has sworn against" : "distrusts") };
    }
    return { ok: true };
  }

  // Take a letter (binding, §17.4.10): the other side's Standing -10 and held
  // at -10 or below. A second letter is treason, so a new one replaces the
  // old (destroying it: +5 with the new issuer, -5 with the old, §28.3).
  function take(state, id, opts) {
    opts = opts || {};
    var c = canTake(state, id);
    if (!c.ok && !opts.force) throw new Error(c.why);
    var is = issuer(id), lines = [];
    if (state.letter && state.letter.issuer !== id) {
      var old = issuer(state.letter.issuer);
      PC.meters.addStanding(state, is.faction, L().DESTROY_NEW);
      PC.meters.addStanding(state, old.faction, -L().DESTROY_OLD);
      lines.push("You burn " + old.name + "'s letter.");
      state.letter = null;
    }
    var other = otherSide(is.faction);
    if (other) PC.meters.addStanding(state, other, -L().ACCEPT_OTHER);
    state.letter = { issuer: id, faction: is.faction, since: PC.state.stamp(state), covered: {} };
    capOther(state);
    PC.state.addLog(state, "Took " + is.name + "'s letter of marque.");
    lines.push("You now sail under " + is.name + "'s letter of marque.");
    return { lines: lines };
  }
  // Give the letter up: the other side's cap lifts.
  function giveUp(state) {
    if (!state.letter) return null;
    var is = issuer(state.letter.issuer);
    state.letter = null;
    PC.state.addLog(state, "Gave up " + is.name + "'s letter of marque.");
    return is;
  }

  // While a letter is held, the other side's Standing can't rise above -10.
  function capFor(state, f) {
    var l = letter(state);
    return l && otherSide(l.faction) === f ? L().OTHER_CAP : 100;
  }
  function capOther(state) {
    var l = letter(state);
    if (!l) return;
    var o = otherSide(l.faction);
    if (o && state.meters.standing[o] > L().OTHER_CAP) state.meters.standing[o] = L().OTHER_CAP;
  }

  // A covered prize: the issuer +1 Standing, at most +4 a season (§28.3).
  function coveredPrize(state) {
    var l = letter(state);
    if (!l) return 0;
    var st = PC.state.stamp(state);
    if (l.coveredStamp !== st) { l.coveredStamp = st; l.coveredGain = 0; }
    if (l.coveredGain >= L().ISSUER_SEASON_CAP) return 0;
    l.coveredGain += 1;
    return PC.meters.addStanding(state, l.faction, L().ISSUER_PER_PRIZE);
  }

  // Port fees at the issuer's ports are halved (§20.4).
  function feeMult(state, nodeFaction) {
    var l = letter(state);
    return l && l.faction === nodeFaction ? L().FEE_MULT : 1;
  }

  // The issuer's cut, at the till, on every clean sale (§29.12). Returns
  // { gross, cut, net, who }.
  function cut(state, gross) {
    var l = letter(state);
    if (!l || gross <= 0) return { gross: gross, cut: 0, net: gross, who: null };
    var c = Math.round(gross * issuer(l.issuer).cut);
    return { gross: gross, cut: c, net: gross - c, who: issuer(l.issuer).name };
  }

  // Key's hunt (§28.4, §17.4.10): Avalon's pirate-hunter chance reads Avalon
  // Heat 20 higher while the captain holds a Frisian letter, is Key's Sworn
  // enemy, or broke Key's pardon within the year (PR 5).
  function huntHeat(state, f) {
    var h = state.meters.heat[f] || 0;
    if (f !== "avalon") return h;
    var l = letter(state), on = (l && l.faction === "frisia") || band(state, "key") === "Sworn enemy";
    var until = (state.meterState || {}).keyHuntUntil;
    if (until && state.time.year * 4 + state.time.season < until) on = true;
    return on ? h + L().KEY_HUNT : h;
  }

  PC.letters = {
    regard: regard, regardBand: regardBand, band: band, meet: meet, addRegard: addRegard,
    letter: letter, issuer: issuer, holds: holds, otherSide: otherSide, covers: covers, legitimate: legitimate,
    canTake: canTake, take: take, giveUp: giveUp, capFor: capFor, coveredPrize: coveredPrize, feeMult: feeMult, cut: cut, huntHeat: huntHeat,
  };
})();
