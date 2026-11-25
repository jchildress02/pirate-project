/* Pirate Chronicle — imprisonment II (§43.7-§43.9, §43.11-§43.12, §25.15;
 * Milestone 8, PR 7): the cell's actions (plans, cellmates), the escape
 * clock and points, the three-beat break-out, the escape itself, jail
 * fever, the Freedom and Captivity officer beats, the Twopenny rescue and
 * the gallows. Builds on js/prison.js. No screen code here.
 *
 * state.jail gains: clock (0-2), points (-1..3), plans { study, lock,
 * grease } (true once one succeeds), used { <plan or action>: stamp },
 * recruits { tiers, officers }, breakout (the attempt in progress),
 * freedomDone, captivityDone.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function P() { return PC.data.prison; }
  function E() { return PC.data.prison.escape; }
  function L() { return PC.data.prison.lines; }
  function stamp(state) { return PC.state.stamp(state); }
  function key(state, what) { return [state.world.seed, stamp(state), "escape", what, state.rolls.escape = (state.rolls.escape || 0) + 1].join("|"); }
  function between(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function off(state, id) { return (state.officers || []).filter(function (o) { return o.id === id; })[0] || null; }
  function cellOfficers(state) { var j = state.jail; return (j.cell.officers || []).map(function (id) { return off(state, id); }).filter(function (o) { return o && !o.gone; }); }
  function sum(t) { return Object.keys(t || {}).reduce(function (a, k) { return a + (t[k] || 0); }, 0); }
  function inCell(state) { var j = state.jail; return !!(j && j.kind === "cell" && ["held", "awaitTrial", "trial", "serving", "gallows"].indexOf(j.stage) >= 0); }

  // ---- The plans (§43.7) -----------------------------------------------------------

  // The plans this jail allows. The dog lives only at Edenton and Savannah;
  // Edenton takes no bribes (§43.14).
  function planList(state) {
    var j = state.jail, info = PC.prison.jailInfo(j.node), hasPicks = (state.captain.items || []).some(function (i) { return /lockpick/i.test(i); });
    var out = [
      { id: "study", label: "Study the Guards", check: { type: "Gather Intelligence", dr: E().PLAN_DR }, unlocks: "the sneak in the break-out" },
      { id: "lock", label: "Work the Lock", check: { type: "Light Fingers", dr: hasPicks ? E().PLAN_DR : E().LOCK_DR_BARE }, unlocks: "the cell door", note: hasPicks ? null : "No lockpicks: a hard check" },
    ];
    if (info.dog) out.push({ id: "dog", label: "Coax the Dog", check: { type: "Animal Friend", dr: E().PLAN_DR }, unlocks: "the dog" });
    if (!info.noBribes) out.push({ id: "grease", label: "Grease the Jailer", check: { type: "Bribe", dr: E().PLAN_DR }, unlocks: "what's upstairs, and +1 in the last stretch" });
    return out;
  }

  // Every plan and cell action costs a cell action (§43.7).
  function canAct(state) {
    if (!inCell(state)) return { ok: false, why: "Not in a cell" };
    if (state.jail.breakout) return { ok: false, why: "You're breaking out" };
    if (state.ap.left < 1) return { ok: false, why: "No cell actions left this season" };
    return { ok: true };
  }

  // A plan fills the clock: +2 clean, +1 partial, -1 setback; a full clock
  // (3) is an escape point, capped at 3 (§43.8).
  function plan(state, id) {
    var c = canAct(state);
    if (!c.ok) throw new Error(c.why);
    var p = planList(state).filter(function (x) { return x.id === id; })[0];
    if (!p) throw new Error("Not a plan here.");
    var j = state.jail;
    PC.prison.cellAction(state);
    var r = PC.checks.resolve(state, p.check, key(state, "plan-" + id), { conditions: id === "grease" ? ["Official"] : [] });
    var out = { lines: [E().lines.plan[id][r.outcome]], chips: [], outcome: r.outcome };
    if (r.outcome !== "setback") { j.plans = j.plans || {}; if (!j.plans[id]) out.chips.push({ icon: "rumor", text: "Unlocked: " + p.unlocks, ink: "good" }); j.plans[id] = true; }
    tick(state, r.outcome === "clean" ? 2 : r.outcome === "partial" ? 1 : -1, out);
    return PC.prison.afterCellAction(state, out);
  }

  function tick(state, n, out) {
    var j = state.jail;
    j.clock = Math.max(0, (j.clock || 0) + n);
    j.points = j.points || 0;
    while (j.clock >= E().CLOCK) {
      j.clock -= E().CLOCK;
      if (j.points < E().POINTS_CAP) { j.points += 1; out.chips.push({ icon: "ap", text: "An escape point (" + j.points + " of " + E().POINTS_CAP + ")", ink: "good" }); }
    }
    if (j.points >= E().POINTS_CAP) j.clock = Math.min(j.clock, E().CLOCK - 1);
    out.chips.push({ icon: "ap", text: "The escape clock: " + j.clock + " of " + E().CLOCK, ink: n < 0 ? "bad" : "mid" });
  }

  // ---- Work the Cellmates (§43.7) ------------------------------------------------------

  // Hands and an officer join free, on condition they escape with you.
  // DEFAULT: each once a season; 2-4 hands, a third of them Veterans.
  function recruit(state, what) {
    var c = canAct(state);
    if (!c.ok) throw new Error(c.why);
    var j = state.jail;
    j.used = j.used || {};
    if (j.used[what] === stamp(state)) throw new Error("Once a season.");
    j.recruits = j.recruits || { tiers: {}, officers: [] };
    var r = PC.rng.fromKey(key(state, "cellmates-" + what)), out = { lines: [], chips: [] };
    if (what === "crew") {
      var n = between(r, E().CELLMATES[0], E().CELLMATES[1]), vet = Math.round(n / 3);
      j.recruits.tiers.Seasoned = (j.recruits.tiers.Seasoned || 0) + n - vet;
      j.recruits.tiers.Veteran = (j.recruits.tiers.Veteran || 0) + vet;
      out.lines.push(E().lines.cellmatesCrew.replace("[number]", String(n)));
      out.chips.push({ icon: "officer", text: n + " cellmates will come with you if you get out", ink: "good" });
    } else {
      if (j.recruits.officers.length) throw new Error("One officer a stay.");
      var o = PC.officers.generate(state, PC.data.nodes[j.node] ? j.node : "norfolk", key(state, "cell-officer"), "off_cell_" + (state.world.shipSeq = (state.world.shipSeq || 0) + 1));
      j.recruits.officers.push(o);
      out.lines.push(E().lines.cellmatesOfficer.replace("[Name]", o.first + " " + (o.last || "")).replace("[Type]", o.type));
      out.chips.push({ icon: "officer", text: o.first + " (" + o.type + ") will join you if you get out", ink: "good" });
    }
    PC.prison.cellAction(state);
    j.used[what] = stamp(state);
    return PC.prison.afterCellAction(state, out);
  }

  // ---- The break-out (§43.9) ---------------------------------------------------------------

  // Escapees: the captain 1, each officer 2, each hand 1.
  function escapees(state) {
    var j = state.jail, rec = j.recruits || { tiers: {}, officers: [] };
    return 1 + 2 * (cellOfficers(state).length + rec.officers.length) + sum(j.cell.tiers) + sum(rec.tiers);
  }
  function groupBonus(state, mode) {
    var n = escapees(state);
    if (n <= 3 && mode === "sneak") return { label: "A small party", value: 1 };
    if (n >= 8 && mode === "fight") return { label: "A large party", value: 1 };
    if (n >= 8 && mode === "sneak") return { label: "A large party", value: -1 };
    return null;
  }

  // A blade kept past the cell door: Swordsmanship, and it counts.
  function blade(state) { return (state.captain.items || []).filter(function (i) { return /dagger|stiletto|knife|sword|cutlass|rapier/i.test(i); })[0] || null; }

  function beatCheck(state, mode) {
    var j = state.jail, b = j.breakout, extra = [];
    if (b.spent) extra.push({ label: "An escape point", value: 1 });
    if (b.beat === 1 && (j.points || 0) < 0) extra.push({ label: "The guards are watching you", value: -1 }); // proposal (§43.8)
    if (b.beat === 3 && j.plans && j.plans.grease) extra.push({ label: "The jailer looks the other way", value: 1 });
    if (b.beat === 1) return { type: "Rescue & Breakout", dr: E().BEAT1_DR, extra: extra };
    var g = groupBonus(state, mode); if (g) extra.push(g);
    if (mode === "sneak") return { type: "Rescue & Breakout", dr: E().SNEAK_DR, extra: extra };
    if (mode === "run") return { type: "Chase & Climb", dr: E().RUN_DR, extra: extra };
    var guard = E().GUARD_DR[PC.prison.jailInfo(j.node).guard] || 2;
    var bl = blade(state);
    if (bl) extra.push({ label: "Your " + bl, value: 1 });
    return { type: bl ? "Swordsmanship" : "Brawling", dr: guard, extra: extra };
  }

  function canBreakOut(state) {
    var c = canAct(state);
    if (!c.ok) return c;
    return { ok: true };
  }

  function breakOut(state) {
    var c = canBreakOut(state);
    if (!c.ok) throw new Error(c.why);
    PC.prison.cellAction(state);
    var j = state.jail;
    j.breakout = { beat: 1, mode: null, spent: false, log: [] };
    var out = { lines: [beatOneText(state)], chips: [] };
    return PC.prison.finishStep(state, out);
  }

  // Beat 1's text by the plans that worked: the lock, the dog, or the
  // change of watch.
  function beatOneText(state) {
    var p = state.jail.plans || {}, B = E().lines.beat1;
    return p.lock ? B.lock : p.dog ? B.dog : B.watch;
  }

  // Spend one escape point for +1 on the next beat.
  function spendPoint(state) {
    var j = state.jail, b = j.breakout;
    if (!b || b.spent || (j.points || 0) < 1) throw new Error("No escape point to spend.");
    j.points -= 1; b.spent = true;
    return { lines: [], chips: [{ icon: "ap", text: "An escape point spent: +1", ink: "good" }] };
  }

  // Which modes beat 2 offers; beat 3 starts in beat 2's mode.
  function modes(state) {
    var j = state.jail, b = j.breakout;
    if (!b || b.beat === 1) return [];
    if (b.beat === 3) return [b.mode];
    return ["sneak", "run", "fight"].filter(function (m) { return m !== "sneak" || (j.plans && j.plans.study); });
  }

  function beat(state, mode) {
    var j = state.jail, b = j.breakout;
    if (!b) throw new Error("Not breaking out.");
    if (b.beat > 1 && modes(state).indexOf(mode) < 0) throw new Error("Not that way.");
    var out = { lines: [], chips: [] };
    var r = PC.checks.resolve(state, beatCheck(state, b.beat === 1 ? null : mode), key(state, "beat" + b.beat + "-" + (mode || "cell")), { conditions: [] });
    b.spent = false;
    out.outcome = r.outcome;
    if (b.beat === 1) {
      if (r.outcome === "setback") { out.lines.push(E().lines.beat1Fail); return caught(state, out); }
      out.lines.push(E().lines.beat1Done);
      b.beat = 2;
      return PC.prison.finishStep(state, out);
    }
    var B = E().lines.beat[mode];
    if (mode === "fight") {
      if (r.outcome === "setback") {
        out.lines.push(B.setback);
        var t = state.captain.tags; if (t.indexOf("Wounded") < 0) t.push("Wounded");
        var e = PC.checks.resolve(state, { type: "Endure", dr: 2 }, key(state, "endure"), { conditions: [] });
        out.chips.push({ icon: "person", text: "Wounded · Endure " + e.outcome, ink: "bad" });
        if (e.outcome === "setback") { state.jail.log.push(B.setback); dieInBreakout(state); return out; }
        return caught(state, out);
      }
      if (r.outcome === "partial") { loseOfficer(state, out); loseHands(state, out, 0.5); }
      out.lines.push(B[r.outcome === "clean" ? "clean" : "partial"]);
      b.mode = "fight";
    } else if (r.outcome === "setback") {
      // Spotted: it becomes a fight, rolled at once.
      out.lines.push(B.setback);
      b.mode = "fight";
      var f = beat(state, "fight");
      out.lines = out.lines.concat(f.lines); out.chips = out.chips.concat(f.chips); out.outcome = f.outcome;
      return out;
    } else {
      out.lines.push(B[r.outcome]);
      if (mode === "sneak") b.mode = r.outcome === "partial" ? "run" : "sneak";
      if (mode === "run") { b.mode = "run"; if (r.outcome === "partial") loseOfficer(state, out); }
    }
    if (!state.jail) return out;
    if (b.beat === 2) { b.beat = 3; b.beat2 = r.outcome; return PC.prison.finishStep(state, out); }
    return escaped(state, out, r.outcome);
  }

  function loseOfficer(state, out) {
    var j = state.jail, list = cellOfficers(state);
    var rec = (j.recruits || {}).officers || [];
    if (rec.length) { var lost = rec.pop(); out.chips.push({ icon: "officer", text: lost.first + " is left behind", ink: "bad" }); return; }
    if (!list.length) return;
    var o = list[list.length - 1];
    j.cell.officers = j.cell.officers.filter(function (id) { return id !== o.id; });
    o.gone = true; o.goneWhy = "left behind in the break-out";
    out.chips.push({ icon: "officer", text: o.first + " is left behind", ink: "bad" });
  }
  function loseHands(state, out, share) {
    var j = state.jail, n = 0;
    [j.cell.tiers, (j.recruits || {}).tiers || {}].forEach(function (t) { Object.keys(t).forEach(function (k) { var x = Math.ceil((t[k] || 0) * share); t[k] -= x; n += x; }); });
    if (n) out.chips.push({ icon: "officer", text: n + " hands are cut down or caught", ink: "bad" });
  }

  function dieInBreakout(state) {
    var j = state.jail;
    state.jail = null;
    state.gameOver = { how: "died", line: "died" };
    PC.state.addLog(state, "Killed breaking out of " + j.name + ".");
    PC.summary.end(state);
  }

  // Caught (§43.9): before the trial, trial DR +1; Imprisoned, +1 season;
  // Condemned, the gallows date stands. Points clear.
  function caught(state, out) {
    var j = state.jail;
    j.breakout = null; j.points = 0; j.clock = 0;
    out.lines.push(E().lines.caught);
    if (j.stage === "awaitTrial" || j.stage === "trial") { j.trialDR = (j.trialDR || 0) + 1; out.chips.push({ icon: "person", text: "Your trial: DR +1", ink: "bad" }); }
    else if (j.stage === "serving") { j.sentence += 1; out.chips.push({ icon: "person", text: "A season longer in prison", ink: "bad" }); }
    out.chips.push({ icon: "ap", text: "Escape points lost", ink: "bad" });
    return PC.prison.finishStep(state, out);
  }

  // Out (§43.9): Heat +10 with the jailer; the ship if she's still in
  // port, otherwise a stolen cutter to Ocracoke (no stash yet; D4b). Items
  // by beat 3's result: all on a clean, the 1-2 most valuable on a partial.
  function escaped(state, out, beat3) {
    var j = state.jail, items = j.items || [];
    var back = beat3 === "clean" ? items : beat3 === "partial" ? mostValuable(items, between(PC.rng.fromKey(key(state, "items")), 1, 2)) : [];
    state.captain.items = (state.captain.items || []).concat(back);
    if (back.length) out.chips.push({ icon: "treasure", text: "Recovered: " + back.join(", "), ink: "good" });
    else if (items.length) out.chips.push({ icon: "treasure", text: "Your things stay behind", ink: "bad" });
    PC.meters.addHeat(state, j.faction, E().HEAT);
    out.chips.push({ icon: "heat", text: PC.prison.FACTION_NAME[j.faction] + " Heat +" + E().HEAT, ink: "bad" });
    if (j.stage === "gallows") gallowsTag(state, out);
    // Who comes out: the officers and hands in the cell, and the cellmates.
    (j.cell.officers || []).forEach(function (id) { var o = off(state, id); if (o) { o.gone = false; o.aboard = "flagship"; } });
    var rec = j.recruits || { tiers: {}, officers: [] };
    rec.officers.forEach(function (o) { o.aboard = "flagship"; o.joined = { year: state.time.year, season: state.time.season }; state.officers.push(o); });
    var hands = {};
    [j.cell.tiers, rec.tiers].forEach(function (t) { Object.keys(t || {}).forEach(function (k) { hands[k] = (hands[k] || 0) + (t[k] || 0); }); });
    out.lines.push(E().lines.escaped);
    PC.state.addLog(state, "Escaped from " + j.name + ".");
    var shipThere = j.ship === "port";
    state.jail = null;
    if (shipThere) {
      // Back aboard and away: the nearest open sea (DEFAULT).
      Object.keys(hands).forEach(function (k) { if (hands[k]) PC.crew.addHands(state, k, hands[k]); });
      state.shipless = false;
      var sea = PC.world.zoneOf(PC.node.here(state)) === "south" ? "bahama" : "hatteras";
      state.location = { node: sea, place: null, queue: [] };
      PC.node.initNode(state, sea);
      out.lines.push(E().lines.ownShip);
      state.location.popup = { title: "Away", text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
      state.current = { screen: "node" };
      // 3-35: a mandatory voyage event before the ocean node.
      if (PC.voyageEvents && PC.voyageEvents.afterEscape) PC.voyageEvents.afterEscape(state, sea, rec.officers.length ? rec.officers[0].id : null);
      return out;
    }
    // The stolen cutter: her crew are the escapees, officers first, then
    // the most experienced hands; the rest scatter (§43.9).
    Object.keys(hands).forEach(function (k) { if (hands[k]) PC.crew.addHands(state, k, hands[k]); });
    var to = "ocracoke";
    state.location = { node: to, place: null, queue: [] };
    PC.node.initNode(state, to);
    PC.prison.newCutter(state, { dirty: true, escape: true });
    state.money.crew += E().CUTTER_GOLD;
    out.lines.push(E().lines.cutter.replace("[Place]", PC.world.placeName(to)));
    state.location.popup = { title: "Away", text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
    state.current = { screen: "node" };
    return out;
  }

  function mostValuable(items, n) {
    var val = function (id) { var m = PC.data.modifiers[id] || {}; return m.value || (m.rarity === "rare" ? 3 : m.rarity === "uncommon" ? 2 : 1); };
    return items.slice().sort(function (a, b) { return val(b) - val(a); }).slice(0, n);
  }

  // ---- The officers' beats (§25.15): Freedom and Captivity -------------------------

  // A Freedom officer in the cell offers his plan once a stay.
  function freedomOfficer(state) {
    var j = state.jail;
    if (!inCell(state) || j.freedomDone) return null;
    return cellOfficers(state).filter(function (o) { return o.drive === "Freedom"; })[0] || null;
  }
  function freedom(state, choice) {
    var j = state.jail, o = freedomOfficer(state);
    if (!o) throw new Error("Not the moment for that.");
    j.freedomDone = true;
    var out = { lines: [], chips: [] }, F = E().lines.freedom, pts = PC.voyageEvents.points;
    var name = function (l) { return l.replace(/\[Name\]/g, o.first); };
    if (choice === "trust") {
      if ((j.points || 0) < E().POINTS_CAP) j.points = (j.points || 0) + 1;
      o.rung = Math.min(3, (o.rung || 0) + 1);
      out.lines.push(name(F.trust));
      out.chips.push({ icon: "ap", text: "An escape point (" + j.points + " of " + E().POINTS_CAP + ")", ink: "good" }, { icon: "officer", text: o.first + " +1 rung", ink: "good" });
    } else if (choice === "wait") {
      pts(state, o, -3); out.lines.push(name(F.wait)); out.chips.push({ icon: "officer", text: o.first + " is disappointed", ink: "bad" });
    } else {
      pts(state, o, 2); out.lines.push(name(F.better)); out.chips.push({ icon: "officer", text: o.first + " approves", ink: "good" });
    }
    return PC.prison.finishStep(state, out);
  }

  // A Captivity officer breaks down in the cell, once a stay, at a season's
  // turn (DEFAULT: the first season turn in the cell).
  function captivity(state, choice) {
    var j = state.jail, o = j.captivity ? off(state, j.captivity) : null;
    if (!o) throw new Error("Not the moment for that.");
    j.captivity = null; j.captivityDone = true;
    var out = { lines: [], chips: [] }, C = E().lines.captivity, pts = PC.voyageEvents.points;
    var name = function (l) { return l.replace(/\[Name\]/g, o.first); };
    if (choice === "calm") {
      var r = PC.checks.resolve(state, { type: "Persuade", dr: 2 }, key(state, "calm"), { conditions: [] });
      out.outcome = r.outcome;
      if (r.outcome === "setback") {
        out.lines.push(name(C.calmFail));
        j.points = Math.max(-1, (j.points || 0) - 1);
        out.chips.push({ icon: "ap", text: "An escape point lost (" + j.points + ")", ink: "bad" });
      } else { o.rung = Math.min(3, (o.rung || 0) + 1); out.lines.push(name(C.calm)); out.chips.push({ icon: "officer", text: o.first + " +1 rung", ink: "good" }); }
    } else if (choice === "shut") { pts(state, o, -2); out.lines.push(name(C.shut)); }
    else { o.rung = Math.max(-3, (o.rung || 0) - 1); o.wounded = true; out.lines.push(name(C.knock)); out.chips.push({ icon: "officer", text: o.first + " −1 rung, Wounded", ink: "bad" }); }
    return PC.prison.finishStep(state, out);
  }

  // ---- Each season in the cell ------------------------------------------------------------

  // Jail fever (§43.7): a 15% chance a season; Immune System or Wounded.
  // The Captivity officer's beat comes due at the first season turn.
  function seasonInCell(state, out) {
    var j = state.jail;
    if (!j || j.kind !== "cell") return;
    var r = PC.rng.fromKey(key(state, "fever"));
    if (r() < E().FEVER) {
      var c = PC.checks.resolve(state, { type: "Immune System", dr: 2 }, key(state, "fever-check"), { conditions: [] });
      j.log.push(E().lines.fever);
      if (c.outcome === "setback") { var t = state.captain.tags; if (t.indexOf("Wounded") < 0) t.push("Wounded"); out.chips.push({ icon: "person", text: "Jail fever: Wounded", ink: "bad" }); }
      else out.chips.push({ icon: "person", text: "Jail fever: you shake it off (Immune System " + c.outcome + ")", ink: "mid" });
    }
    if (!j.captivityDone && !j.captivity) {
      var o = cellOfficers(state).filter(function (x) { return x.fear === "Captivity"; })[0];
      if (o) j.captivity = o.id;
    }
  }

  // ---- The Twopenny rescue (§43.11) -----------------------------------------------------

  // Once a game, right after the captain is Condemned at trial: Twopenny
  // at Friend or better, alive, with Ocracoke standing. No checks.
  function twopennyCan(state) {
    if (state.flags.twopennyRescued) return false;
    var t = PC.npcs.get(state, "twopenny");
    return !!(t && !t.dead && t.rung >= PC.npcs.RUNG_VALUE.Friend);
  }
  function twopenny(state, out) {
    if (!twopennyCan(state)) return false;
    var j = state.jail;
    state.flags.twopennyRescued = true;
    out.lines.push(E().lines.twopenny);
    out.chips.push({ icon: "person", text: "Twopenny's rescue (once a game)", ink: "good" });
    gallowsTag(state, out);
    var cell = j.cell, items = j.items || [];
    state.captain.items = (state.captain.items || []).concat(items);
    (cell.officers || []).forEach(function (id) { var o = off(state, id); if (o) { o.gone = false; o.aboard = "flagship"; } });
    Object.keys(cell.tiers || {}).forEach(function (k) { if (cell.tiers[k]) PC.crew.addHands(state, k, cell.tiers[k]); });
    PC.state.addLog(state, "Twopenny got you out of " + j.name + ".");
    state.jail = null;
    state.location = { node: "ocracoke", place: null, queue: [] };
    PC.node.initNode(state, "ocracoke");
    state.location.popup = { title: "Twopenny", text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
    state.shipless = true; // his ship stayed where he was jailed
    state.current = { screen: "shipless" };
    return true;
  }

  // ---- The gallows (§43.12) ---------------------------------------------------------------

  function gallowsTag(state, out) {
    var t = state.captain.tags;
    if (t.indexOf("Cheated the Gallows") < 0) { t.push("Cheated the Gallows"); out.chips.push({ icon: "person", text: "Tag earned: Cheated the Gallows", ink: "good" }); }
  }

  // The crew's rescue (morale 70+, jailed in port, the crew still there),
  // then Key's reprieve (Trusted, once a game, an Admiralty port).
  function atGallows(state, out) {
    var j = state.jail;
    if (j.how === "port" && state.crew.count > 0 && state.crew.morale >= E().RESCUE_MORALE && (j.ship === "port" || j.ship === "impounded")) {
      out.lines.push(E().lines.crewRescue);
      gallowsTag(state, out);
      if (j.ship === "impounded" && j.impounded) { state.ship = j.impounded; }
      j.ship = "port"; j.stage = "gallowsEscape";
      return escapedAtGallows(state, out);
    }
    if (PC.prison.jailInfo(j.node).admiralty && !state.flags.keyReprieve && PC.letters && PC.letters.band(state, "key") === "Trusted") {
      state.flags.keyReprieve = true;
      out.lines.push(E().lines.keyReprieve);
      gallowsTag(state, out);
      var r = PC.prison.release(state, { lines: out.lines, chips: out.chips });
      out.popup = r.popup;
      return true;
    }
    return false;
  }

  function escapedAtGallows(state, out) {
    var j = state.jail;
    PC.meters.addHeat(state, j.faction, E().HEAT);
    out.chips.push({ icon: "heat", text: PC.prison.FACTION_NAME[j.faction] + " Heat +" + E().HEAT, ink: "bad" });
    state.captain.items = (state.captain.items || []).concat(j.items || []);
    (j.cell.officers || []).forEach(function (id) { var o = off(state, id); if (o) { o.gone = false; o.aboard = "flagship"; } });
    state.jail = null;
    state.shipless = false;
    var sea = PC.world.zoneOf(PC.node.here(state)) === "south" ? "bahama" : "hatteras";
    state.location = { node: sea, place: null, queue: [] };
    PC.node.initNode(state, sea);
    state.location.popup = { title: "Cheated the Gallows", text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
    state.current = { screen: "node" };
    PC.state.addLog(state, "The crew cut you down from the gallows.");
    return true;
  }

  // ---- Developer tools (§41.12) ----------------------------------------------------------

  function devFillClock(state) { var j = state.jail; if (!j) return; j.points = E().POINTS_CAP; j.clock = 0; }
  function devToTrial(state) { var j = state.jail; if (!j) return; if (j.stage === "interrogate" || j.stage === "givePick") j.stage = "awaitTrial"; if (j.stage === "awaitTrial") { j.served = P().TRIAL_AP; j.stage = "trial"; } }

  function view(state) {
    var j = state.jail;
    if (!j || j.kind !== "cell") return null;
    var b = j.breakout;
    return {
      inCell: inCell(state), clock: j.clock || 0, clockMax: E().CLOCK, points: j.points || 0, pointsCap: E().POINTS_CAP, plans: j.plans || {},
      planList: planList(state).map(function (p) { return Object.assign({}, p, { assess: PC.checks.assess(state, p.check, { conditions: p.id === "grease" ? ["Official"] : [] }) }); }),
      canAct: canAct(state), escapees: escapees(state), recruits: j.recruits || { tiers: {}, officers: [] }, usedCrew: (j.used || {}).crew === stamp(state),
      breakout: b ? { beat: b.beat, mode: b.mode, spent: b.spent, modes: modes(state).map(function (m) { return { id: m, check: beatCheck(state, m) }; }), check: b.beat === 1 ? beatCheck(state, null) : null } : null,
      freedom: freedomOfficer(state), captivity: j.captivity ? off(state, j.captivity) : null,
    };
  }

  PC.escape = {
    planList: planList, canAct: canAct, plan: plan, tick: tick, recruit: recruit, escapees: escapees, beatCheck: beatCheck,
    breakOut: breakOut, spendPoint: spendPoint, modes: modes, beat: beat, freedom: freedom, captivity: captivity,
    seasonInCell: seasonInCell, twopennyCan: twopennyCan, twopenny: twopenny, atGallows: atGallows,
    devFillClock: devFillClock, devToTrial: devToTrial, view: view,
  };
})();
