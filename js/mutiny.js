/* Pirate Chronicle — desertion and the mutiny (§24.10, §24.13, §25.13,
 * §25.14; Milestone 9, PR 2).
 *
 * Desertion is checked when the captain departs a port (a voyage or a
 * hunt), never at sea. Then, at Pressure 4 or more, the mutiny fires; it
 * also fires at the season's end at Pressure 5. The captain picks one
 * approach (Reason, Pay Off, Make an Example, Strike First, Call Out the
 * Ringleader) and rolls it; a setback leads to the endings: a plea, then
 * the crew's verdict and the last stand when the crew is Mutinous.
 *
 * state.mutiny = { when: "departure"|"season", cont, stage, ringleader,
 *   known, log, result, ... } while it plays. The screen is "mutiny".
 * Nothing here touches the screen.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.mutiny; }
  function L() { return PC.data.mutiny.lines; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function stamp(state) { return PC.state.stamp(state); }
  function key(state, what) { return [state.world.seed, stamp(state), "mutiny", (state.rolls.mutiny = (state.rolls.mutiny || 0) + 1), what].join("|"); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function R() { return PC.npcs.RUNG_VALUE; }
  function oName(o) { return (o.first || "").trim(); }
  function fullName(o) { return (o.first + " " + (o.last || "")).trim(); }
  function hasTrait(o, t) { return o.voice === t || o.secondary === t || o.third === t || o.unique === t; }
  function band(state) { return PC.crew.band(state.crew.morale); }

  // ---- Where each officer stands (§25.14) -------------------------------------

  function present(state) { return (state.officers || []).filter(function (o) { return !o.gone && !o.captured; }); }
  function mutinous(state) {
    var p = state.crew.pressure || 0;
    return present(state).filter(function (o) { return o.rung <= R().Enemy || (o.rung <= R().Rival && p >= 3); });
  }
  function loyal(state) { return present(state).filter(function (o) { return o.rung >= R().Friend; }); }
  function bystanders(state) {
    var m = mutinous(state), l = loyal(state);
    return present(state).filter(function (o) { return m.indexOf(o) < 0 && l.indexOf(o) < 0; });
  }
  // The lowest opinion is the ringleader; ties: a Schemer, then a seeded coin.
  function ringleader(state) {
    var m = mutinous(state);
    if (!m.length) return null;
    var low = Math.min.apply(null, m.map(function (o) { return o.rung; }));
    var tied = m.filter(function (o) { return o.rung === low; });
    var sch = tied.filter(function (o) { return hasTrait(o, "Schemer"); });
    if (sch.length) tied = sch;
    if (tied.length === 1) return tied[0];
    var r = PC.rng.fromKey([state.world.seed, "ringleader", tied.map(function (o) { return o.id; }).join(",")].join("|"));
    return tied[Math.floor(r() * tied.length)];
  }

  // Seeing it coming (§24.13, §25.14): a Pressure-triggered voyage event or
  // the Quartermaster's warning opens Strike First; a clean Read People (or
  // the Quartermaster's warning) names an officer ringleader.
  function noteWarning(state, opts) {
    opts = opts || {};
    var c = state.crew;
    c.mutinySigns = true;
    if (opts.name) { var rl = ringleader(state); if (rl) c.ringleaderKnown = rl.id; }
    return c.ringleaderKnown ? (present(state).filter(function (o) { return o.id === c.ringleaderKnown; })[0] || null) : null;
  }

  // ---- Pressure at the season's end (§24.13, §25.3, §25.14) ----------------------
  // +1 for each mutinous officer, +1 for a Schemer at Wary or below.
  function seasonPressure(state) {
    var n = mutinous(state).length;
    present(state).forEach(function (o) { if (hasTrait(o, "Schemer") && o.rung <= R().Wary) n += 1; });
    return n;
  }

  // ---- Desertion at departure (§24.10, §25.13) ------------------------------------

  function isPort(id) { return !!id && !PC.node.isOcean(id); }

  function desertion(state) {
    var out = { lines: [], chips: [], hands: 0, officers: [] };
    var here = PC.node.here(state), nd = PC.node.nodeData(here), b = band(state);
    var range = D().DESERT[b];
    var plus = state.flags.desertionPlus ? D().DESERT_GO_WITHOUT : 0;
    state.flags.desertionPlus = null;
    if (range) {
      var r = PC.rng.fromKey(key(state, "desert"));
      var rate = range[0] + r() * (range[1] - range[0]) + (nd.faction === "avalon" || nd.faction === "frisia" ? D().DESERT_FACTION_PORT : 0) + plus;
      var n = Math.min(state.crew.count, Math.round(state.crew.count * rate));
      var left = n;
      PC.data.economy.TIER_ORDER.forEach(function (t) { var k = Math.min(left, state.crew.tiers[t] || 0); if (k) { PC.crew.removeHands(state, t, k); left -= k; } });
      out.hands = n - left;
    } else if (plus) {
      // DEFAULT: the Go Without setback's +10% applies at any morale.
      var n2 = Math.min(state.crew.count, Math.round(state.crew.count * plus)), l2 = n2;
      PC.data.economy.TIER_ORDER.forEach(function (t) { var k = Math.min(l2, state.crew.tiers[t] || 0); if (k) { PC.crew.removeHands(state, t, k); l2 -= k; } });
      out.hands = n2 - l2;
    }
    if (out.hands) {
      PC.crew.addMorale(state, D().DESERT_MORALE);
      out.lines.push(L().deserted.replace("[n]", plural(out.hands, "hand")));
      out.chips.push({ icon: "crew", text: plural(out.hands, "hand") + " deserted · morale +" + D().DESERT_MORALE, ink: "bad" });
      PC.state.addLog(state, plural(out.hands, "hand") + " deserted at " + nd.name + ".");
    }
    // Officers: a Rival deserts unless Pressure is 3 or more (then he stays
    // with the mutineers); an Enemy never deserts; a ringleader who yielded
    // goes at this port. A fleet captain takes his ship.
    var p = state.crew.pressure || 0;
    present(state).forEach(function (o) {
      var goes = o.desertNext || (o.rung === R().Rival && p < 3);
      if (!goes) return;
      o.gone = true; o.left = "deserted"; o.desertNext = false;
      var shipId = o.aboard && o.aboard !== "flagship" ? o.aboard : null;
      if (shipId) {
        var f = (state.fleet || []).filter(function (x) { return x.id === shipId; })[0];
        state.fleet = (state.fleet || []).filter(function (x) { return x.id !== shipId; });
        out.lines.push(L().fleetDeserted.replace("[Ship]", f ? f.name || f.cls : "ship").replace("[Name]", oName(o)));
      } else out.lines.push(L().officerDeserted.replace("[Name]", oName(o)));
      if (o.quartermaster) { o.quartermaster = false; PC.officers.vacate(state); }
      out.officers.push(o.id);
      PC.state.addLog(state, fullName(o) + " deserted.");
    });
    if (out.officers.length) PC.officers.ensureQuartermaster(state);
    return out;
  }

  // The captain departs a port (cont: what he was doing: { kind: "sail",
  // to, opts } or { kind: "hunt", opts }). Desertion first, then the mutiny
  // at Pressure 4 or more. Returns { lines, chips, mutiny, blocked }.
  function depart(state, cont) {
    var out = { lines: [], chips: [], mutiny: false, blocked: false };
    if (!state.location || !isPort(PC.node.here(state)) || state.shipless || state.jail) return out;
    var d = desertion(state);
    out.lines = d.lines; out.chips = d.chips;
    if ((state.crew.pressure || 0) >= D().FIRE_AT_DEPARTURE) {
      start(state, "departure", cont, d);
      out.mutiny = true;
      return out;
    }
    if (state.crew.count < (state.ship.crewMin || 5)) {
      out.blocked = true;
      out.lines.push(L().tooFew);
      state.location.popup = { title: "Short-handed", text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
    }
    return out;
  }

  // At the season's end, at Pressure 5 (§24.13). Not in a cell, not
  // shipless, not when the Winter's forced split comes first (DEFAULT).
  function seasonCheck(state) {
    if ((state.crew.pressure || 0) < D().FIRE_AT_SEASON_END || state.jail || state.shipless || state.mutiny || state.ended) return false;
    if (state.split && state.split.forced) return false;
    start(state, "season", { kind: "season" });
    return true;
  }

  // ---- It fires ------------------------------------------------------------------------

  function start(state, when, cont, desert) {
    var rl = ringleader(state);
    var m = state.mutiny = { when: when, cont: cont || null, stage: "approach", ringleader: rl ? rl.id : null, log: [], result: null, at: stamp(state) };
    if (desert && desert.lines.length) m.log = m.log.concat(desert.lines);
    m.log.push(L().fires[when] || L().fires.departure);
    if (rl) m.log.push(L().ringleaderSpeaks.replace(/\[Name\]/g, oName(rl)));
    else m.log.push(L().crewSpeaks);
    var lo = loyal(state);
    if (lo.length) m.log.push(L().loyal.replace("[Names]", lo.map(oName).join(" and ")).replace("[stand]", lo.length === 1 ? "stands" : "stand"));
    state.current = { screen: "mutiny" };
    PC.state.addLog(state, "Mutiny" + (rl ? ", led by " + fullName(rl) : "") + ".");
    return m;
  }

  function rlOf(state) { var m = state.mutiny; return m && m.ringleader ? (state.officers || []).filter(function (o) { return o.id === m.ringleader; })[0] || null : null; }

  // DR = 1 + Pressure − the Dread bonus, 1 to 5 in Year 1; an officer
  // ringleader +1 on top (DEFAULT: after the clamp).
  function dr(state) {
    var base = clamp(1 + (state.crew.pressure || 0) - PC.meters.dreadBonus(state), 1, D().DR_MAX);
    return base + (rlOf(state) ? D().RINGLEADER_DR : 0);
  }
  function loyalExtra(state) {
    var n = Math.min(D().LOYAL_EDGE_MAX, loyal(state).length);
    return n ? [{ label: "Loyal officers", value: n }] : [];
  }
  function hookExtra(state, trait, label) {
    return present(state).some(function (o) { return hasTrait(o, trait); }) ? [{ label: label, value: 1 }] : [];
  }
  function weaponType(state) { return PC.items.meleeType(state); }
  // The ringleader's duel DR: 2 + level, +1 for a Raider, Bloodthirsty,
  // Daredevil or Ironclad (§25.14, §25.10).
  function duelDR(o) {
    return clamp(2 + (o.level || 1) + (o.type === "Raider" || hasTrait(o, "Bloodthirsty") || hasTrait(o, "Daredevil") || hasTrait(o, "Ironclad") ? 1 : 0), 0, 8);
  }
  function headGold(state) { return state.money.crew / Math.max(1, state.crew.count); }

  // The approaches on offer, each { id, label, check, lock, note }.
  function approaches(state) {
    var m = state.mutiny, d = dr(state), lx = loyalExtra(state), out = [];
    var rl = rlOf(state), known = rl && state.crew.ringleaderKnown === rl.id;
    out.push({ id: "reason", label: "Reason with them", check: { type: "Rally Crew", dr: d, extra: lx.concat(hookExtra(state, "Prankster", "Prankster officer")) },
      note: "Clean: it ends; morale +" + D().REASON_MORALE + ". Partial: morale +" + D().REASON_MORALE + ", but nothing is settled: it can fire again at the next departure." });
    var head = headGold(state);
    out.push({ id: "payoff", label: "Pay them off", check: { type: "Pirate Code", dr: d, extra: lx },
      lock: head < D().PAY_OFF_MIN_HEAD ? "Not enough crew gold to buy them off (" + D().PAY_OFF_MIN_HEAD + " a head)" : null,
      note: "Clean: it ends, for half the crew gold (" + Math.round(state.money.crew * D().PAY_OFF_SHARE.clean) + "). Partial: it ends, for three quarters (" + Math.round(state.money.crew * D().PAY_OFF_SHARE.partial) + ")." });
    var ex = exampleType(state);
    out.push({ id: "example", label: "Make an example of them", check: { type: ex, dr: d, extra: lx.concat(hookExtra(state, "Frightening", "Frightening officer")) },
      note: "Clean: it ends; Dread +" + D().EXAMPLE_DREAD + ". Partial: it ends; morale " + D().EXAMPLE_MORALE + ". Counts as this season's Make an Example." });
    out.push({ id: "strikeFirst", label: "Strike first", check: { type: "Strike First", dr: d, extra: lx },
      lock: state.crew.mutinySigns ? null : "You didn't see it coming in time",
      note: "Clean: the ringleaders are seized; morale " + D().STRIKE_FIRST_MORALE + "; Dread +" + D().STRIKE_FIRST_DREAD + ". Partial: bloody, a tenth of the crew killed. Either way every mutinous officer dies." });
    if (known) out.push({ id: "callOut", label: "Call out " + oName(rl), check: { type: weaponType(state), dr: duelDR(rl), extra: lx },
      note: "A duel to the death. Clean: it ends, and his fate is yours to choose. Partial: he yields and leaves at the next port. Setback: you're Wounded, and the crew have you." });
    return out;
  }
  // Make an Example: Discipline or Intimidate, whichever is better (DEFAULT).
  function exampleType(state) {
    var a = PC.checks.assess(state, { type: "Discipline", dr: 2 }, { conditions: [] }).edge;
    var b = PC.checks.assess(state, { type: "Intimidate", dr: 2 }, { conditions: [] }).edge;
    return b > a ? "Intimidate" : "Discipline";
  }

  function roll(state, check, what) {
    return PC.checks.resolve(state, check, key(state, what), { conditions: [] });
  }

  function addPressure(state, v) { state.crew.pressure = clamp(v, 0, 5); }
  function killOfficer(state, o, how) {
    o.gone = true; o.dead = true; o.left = how || "killed in the mutiny";
    if (o.quartermaster) { o.quartermaster = false; PC.officers.vacate(state); }
    // A death costs morale by warmth (§25.12).
    var w = o.mentor ? "warm" : (o.warmth || ((PC.data.creator.OFFICER_TRAITS || []).filter(function (t) { return t.id === o.voice; })[0] || {}).warmth || "neutral");
    var loss = { warm: 10, neutral: 6, cold: 3 }[w] || 6;
    PC.crew.addMorale(state, -loss);
    // A fleet captain's ship stays with the fleet, crewed by her hands (DEFAULT).
    if (o.aboard && o.aboard !== "flagship") o.aboard = "flagship";
    return loss;
  }

  function choose(state, id) {
    var m = state.mutiny;
    if (!m || m.stage !== "approach") throw new Error("Not the moment for that.");
    var a = approaches(state).filter(function (x) { return x.id === id; })[0];
    if (!a) throw new Error("Not an approach you can take.");
    if (a.lock) throw new Error(a.lock);
    var r = roll(state, a.check, id);
    var res = { approach: id, label: a.label, outcome: r.outcome, dice: r.dice, edge: r.assessment.edge, lines: [], chips: [] };
    var rl = rlOf(state), name = rl ? oName(rl) : "";
    res.lines.push((L().approaches[id] || {})[r.outcome].replace(/\[Name\]/g, name));
    m.result = res;
    if (r.outcome === "setback") {
      if (id === "callOut") { wound(state); res.chips.push({ icon: "person", text: "You are Wounded", ink: "bad" }); }
      return toEndings(state);
    }
    switch (id) {
      case "reason":
        PC.crew.addMorale(state, D().REASON_MORALE);
        res.chips.push({ icon: "morale", text: "Morale +" + D().REASON_MORALE, ink: "good" });
        if (r.outcome === "clean") addPressure(state, 1);
        else res.again = true;
        break;
      case "payoff":
        var cost = Math.round(state.money.crew * D().PAY_OFF_SHARE[r.outcome]);
        state.money.crew -= cost;
        res.chips.push({ icon: "gold", text: "−" + cost + " crew gold, shared out", ink: "bad" });
        addPressure(state, 2);
        break;
      case "example":
        PC.crew.markUsed(state, "example");
        if (r.outcome === "clean") { PC.meters.fearDeed(state, D().EXAMPLE_DREAD, "made an example").forEach(function (c) { res.chips.push(c); }); }
        else { PC.crew.addMorale(state, D().EXAMPLE_MORALE); res.chips.push({ icon: "morale", text: "Morale " + D().EXAMPLE_MORALE, ink: "bad" }); }
        addPressure(state, 2);
        break;
      case "strikeFirst":
        if (r.outcome === "clean") {
          PC.crew.addMorale(state, D().STRIKE_FIRST_MORALE);
          res.chips.push({ icon: "morale", text: "Morale " + D().STRIKE_FIRST_MORALE, ink: "bad" });
          PC.meters.fearDeed(state, D().STRIKE_FIRST_DREAD, "struck first").forEach(function (c) { res.chips.push(c); });
        } else {
          var k = Math.max(1, Math.round(state.crew.count * D().STRIKE_FIRST_KILLED)), left = k;
          PC.data.economy.TIER_ORDER.forEach(function (t) { var q = Math.min(left, state.crew.tiers[t] || 0); if (q) { PC.crew.removeHands(state, t, q); left -= q; } });
          res.chips.push({ icon: "crew", text: plural(k - left, "hand") + " killed", ink: "bad" });
        }
        var dead = mutinous(state);
        dead.forEach(function (o) { killOfficer(state, o, "killed when you struck first"); });
        if (dead.length) res.lines.push(L().officersKilled.replace("[Names]", dead.map(oName).join(" and ")).replace("[lie]", dead.length === 1 ? "lies" : "lie"));
        addPressure(state, 0);
        break;
      case "callOut":
        if (r.outcome === "clean") { addPressure(state, 1); m.stage = "ringleaderFate"; return res; }
        rl.desertNext = true; // yields, and leaves at the next port
        addPressure(state, 2);
        break;
    }
    return quell(state, res);
  }

  // Call Out the Ringleader, clean: his fate (§25.14).
  function ringleaderFate(state, how) {
    var m = state.mutiny, rl = rlOf(state);
    if (!m || m.stage !== "ringleaderFate" || !rl) throw new Error("Not the moment for that.");
    var res = m.result;
    res.lines.push(L().ringleaderFate[how].replace(/\[Name\]/g, oName(rl)));
    if (how === "kill") { killOfficer(state, rl, "killed in a duel"); PC.meters.fearDeed(state, D().RINGLEADER_KILL_DREAD, "killed the ringleader").forEach(function (c) { res.chips.push(c); }); }
    else if (how === "plank") { killOfficer(state, rl, "walked the plank"); PC.meters.fearDeed(state, D().PLANK_DREAD, "made him walk the plank").forEach(function (c) { res.chips.push(c); }); }
    else { rl.desertNext = true; rl.noPay = true; PC.meters.fearDeed(state, D().RINGLEADER_ASHORE_DREAD, "put the ringleader ashore").forEach(function (c) { res.chips.push(c); }); }
    res.fate = how;
    return quell(state, res);
  }

  // It's over. Surviving mutineers stay at Rival (§25.14); Strike First
  // closes, and a known ringleader is forgotten if he's gone.
  function quell(state, res) {
    var m = state.mutiny;
    mutinous(state).forEach(function (o) { if (o.rung < R().Rival) o.rung = R().Rival; o.mutineer = true; });
    state.crew.mutinySigns = false;
    if (state.crew.ringleaderKnown && !present(state).some(function (o) { return o.id === state.crew.ringleaderKnown; })) state.crew.ringleaderKnown = null;
    res.lines.push(res.again ? L().again : L().quelled);
    m.stage = "quelled";
    PC.state.addLog(state, "The mutiny was put down (" + res.label + ", " + res.outcome + ").");
    return res;
  }

  // Carry on with what the captain was doing: the voyage or hunt resumes
  // with its departure checks done.
  function carryOn(state) {
    var m = state.mutiny;
    if (!m || (m.stage !== "quelled" && m.stage !== "over")) throw new Error("Not yet.");
    var cont = m.stage === "quelled" ? m.cont : null;
    state.mutiny = null;
    if (state.ended) return null;
    if (state.jail) { state.current = { screen: "jail" }; return null; }
    if (state.shipless) { state.current = { screen: "shipless" }; return null; }
    state.current = { screen: "node" };
    if (!cont || cont.kind === "season") return null;
    if (cont.kind === "sail") return PC.world.sail(state, cont.to, Object.assign({}, cont.opts || {}, { departed: true }));
    if (cont.kind === "hunt") { var g = PC.hunt.start(state, Object.assign({}, cont.opts || {}, { departed: true })); return g; }
    return null;
  }

  // ---- The endings (§24.13) ---------------------------------------------------------

  function wound(state) { var t = state.captain.tags; if (t.indexOf("Wounded") < 0) t.push("Wounded"); }

  function toEndings(state) {
    var m = state.mutiny;
    m.mutinousBand = band(state) === "Mutinous";
    m.stage = "plea";
    m.result.lines.push(m.mutinousBand ? L().verdict : L().setbackPlea);
    return m.result;
  }
  function pleaCheck(state) {
    var db = PC.meters.dreadBonus(state);
    return { type: "Persuade", dr: 2, extra: db ? [{ label: "Dread", value: db }] : [] }; // DR 2: DEFAULT (§24.13 names none)
  }
  function plea(state) {
    var m = state.mutiny;
    if (!m || m.stage !== "plea") throw new Error("Not the moment for that.");
    var r = roll(state, pleaCheck(state), "plea");
    var res = { approach: "plea", label: "Plead your case", outcome: r.outcome, lines: [L().plea[r.outcome]], chips: [] };
    m.plea = res;
    if (!m.mutinousBand) return lose(state, r.outcome === "setback" ? "marooned" : "ashore", res);
    if (r.outcome === "clean") return lose(state, "ashore", res);
    if (r.outcome === "partial") return lose(state, "marooned", res);
    m.stage = "lastStand";
    res.lines.push(L().lastStand);
    return res;
  }
  function lastStandCheck(state) { return { type: weaponType(state), dr: dr(state) }; } // DEFAULT: the approach's DR
  function lastStand(state) {
    var m = state.mutiny;
    if (!m || m.stage !== "lastStand") throw new Error("Not the moment for that.");
    var r = roll(state, lastStandCheck(state), "laststand");
    var res = { approach: "lastStand", label: "The last stand", outcome: r.outcome, lines: [L().lastStandResult[r.outcome]], chips: [] };
    m.stand = res;
    if (r.outcome !== "setback") { wound(state); res.chips.push({ icon: "person", text: "You are Wounded", ink: "bad" }); return lose(state, r.outcome === "clean" ? "ashore" : "marooned", res); }
    // The sacrifice (§25.12): a Friend or Confidant who hasn't made it, the
    // highest rung first. The captain lives, Wounded, and is marooned (DEFAULT).
    var s = loyal(state).filter(function (o) { return !o.sacrificed; }).sort(function (a, b) { return b.rung - a.rung; })[0];
    if (s) {
      s.sacrificed = true;
      res.lines.push(L().sacrifice.replace(/\[Name\]/g, oName(s)));
      if (s.unique !== "Ironclad") killOfficer(state, s, "died saving you");
      wound(state); res.chips.push({ icon: "person", text: "You are Wounded", ink: "bad" });
      return lose(state, "marooned", res);
    }
    res.lines.push(L().killed);
    state.gameOver = { how: "died", line: "mutiny" };
    m.stage = "over";
    PC.state.addLog(state, "Killed by mutineers.");
    PC.summary.end(state);
    return res;
  }

  // The ship is lost (§24.13, §25.14): the mutineers take the whole fleet,
  // the cargo, crew gold and the purse; the captain keeps the stash, his
  // holdings ashore, his tags and what he wears. Loyal officers share his
  // fate; bystanders and mutineers sail on with the ship.
  function lose(state, how, res) {
    var m = state.mutiny;
    var lo = loyal(state), rl = rlOf(state);
    // A loyal fleet captain picks a marooned captain up: her ship is his.
    var saver = how === "marooned" ? lo.filter(function (o) { return o.aboard && o.aboard !== "flagship"; })[0] : null;
    var saved = saver ? (state.fleet || []).filter(function (f) { return f.id === saver.aboard && !f.out; })[0] : null;
    state.world.mutineers = { ringleader: rl ? rl.id : null, ship: state.ship.name, cls: state.ship.type, at: stamp(state) }; // DEFAULT: recorded for the Ringleader Returns (later)
    present(state).forEach(function (o) { if (lo.indexOf(o) < 0) { o.gone = true; o.left = m.ringleader === o.id ? "leads the mutineers" : "sailed with the mutineers"; o.quartermaster = false; } });
    var here = PC.node.here(state);
    var at = here && !PC.node.isOcean(here) ? here : "ocracoke"; // DEFAULT: an ocean node's nearest port is Ocracoke
    PC.prison.loseEverything(state);
    state.minigame = null; state.voyage = null;
    res.lines.push(L().lost);
    PC.state.addLog(state, "The crew mutinied and took the ship.");
    m.stage = "over";
    lo.forEach(function (o) { if (!o.gone) o.aboard = "flagship"; });
    if (saved) {
      takeShip(state, saved, saver);
      state.location = { node: at, place: null, queue: [] };
      PC.node.initNode(state, at);
      res.lines.push(L().pickedUp.replace("[Ship]", saved.name || saved.cls).replace("[Name]", oName(saver)));
      m.ending = "pickedUp";
      return res;
    }
    if (how === "marooned") {
      res.lines.push(L().marooned);
      m.ending = "marooned";
      m.loyalIds = lo.filter(function (o) { return !o.gone; }).map(function (o) { return o.id; });
      return res;
    }
    state.location = { node: at, place: null, queue: [] };
    PC.node.initNode(state, at);
    res.lines.push(L().ashore.replace("[Place]", PC.world.placeName(at)));
    m.ending = "ashore";
    return res;
  }

  // The loyal fleet captain's ship becomes the flagship; he takes his
  // officer slot aboard her.
  function takeShip(state, f, o) {
    var c = PC.data.hunt.CLASSES[f.cls] || {};
    state.ship = { name: f.name || f.cls, type: f.cls, hull: f.hull, hullMax: f.hullMax, baseHull: c.hull || f.hullMax, guns: f.guns, gunsMax: f.gunsMax,
      cargo: f.cargo, size: f.size, crewMin: f.crewMin, crewMax: f.crewMax, speed: f.speed, speedMax: f.speed, handling: f.handling,
      rigging: "sound", upgrades: { hull: 1, rigging: 1, guns: 1 }, dirty: !!f.dirty };
    Object.keys(f.crewTiers || {}).forEach(function (t) { if (f.crewTiers[t]) PC.crew.addHands(state, t, f.crewTiers[t]); });
    if (!state.crew.count && f.crew) PC.crew.addHands(state, "Green", f.crew);
    o.aboard = "flagship";
    state.shipless = false;
    PC.officers.ensureQuartermaster(state);
  }

  // Off the ship: marooned goes into the stranded loop (§21.8) with the
  // loyal officers; put ashore and picked up go to the town.
  function afterLoss(state) {
    var m = state.mutiny;
    if (!m || m.stage !== "over") throw new Error("Not yet.");
    var ending = m.ending;
    state.mutiny = null;
    if (state.ended) return null;
    if (ending === "marooned") { PC.prison.maroon(state, { officers: m.loyalIds || [], by: "mutineers'" }); return null; }
    if (ending === "pickedUp") { state.current = { screen: "node" }; return null; }
    state.shipless = true;
    state.current = { screen: "shipless" };
    return null;
  }

  // ---- The screen's view --------------------------------------------------------------

  function view(state) {
    var m = state.mutiny;
    if (!m) return null;
    var rl = rlOf(state);
    var v = { when: m.when, stage: m.stage, log: m.log.slice(), result: m.result, plea: m.plea || null, stand: m.stand || null, ending: m.ending || null,
      ringleader: rl ? { id: rl.id, name: fullName(rl), known: state.crew.ringleaderKnown === rl.id } : null,
      loyal: loyal(state).map(fullName), mutinous: mutinous(state).map(fullName), pressure: state.crew.pressure || 0, dr: dr(state) };
    if (m.stage === "approach") v.approaches = approaches(state);
    if (m.stage === "plea") v.pleaCheck = pleaCheck(state);
    if (m.stage === "lastStand") v.standCheck = lastStandCheck(state);
    return v;
  }

  // ---- Developer: fire one now ---------------------------------------------------------
  function devFire(state) {
    if (state.jail || state.shipless) throw new Error("Not without a ship.");
    if ((state.crew.pressure || 0) < D().FIRE_AT_DEPARTURE) state.crew.pressure = D().FIRE_AT_DEPARTURE;
    return start(state, "season", { kind: "season" });
  }

  PC.mutiny = {
    mutinous: mutinous, loyal: loyal, bystanders: bystanders, ringleader: ringleader, noteWarning: noteWarning, seasonPressure: seasonPressure,
    desertion: desertion, depart: depart, seasonCheck: seasonCheck, start: start, dr: dr, approaches: approaches, choose: choose,
    ringleaderFate: ringleaderFate, carryOn: carryOn, plea: plea, lastStand: lastStand, afterLoss: afterLoss, view: view, devFire: devFire, duelDR: duelDR,
  };
})();
