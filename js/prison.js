/* Pirate Chronicle — imprisonment I (§43.1-§43.6, §43.10, §43.13, §21.8,
 * §30.12; Milestone 8, PR 6): the ways in, where captors take you, capture
 * at sea, the charge by Heat, the Secrets tab and interrogation, the trial,
 * serving your time, the outside, the marooned loop and the shipless popup.
 * The cell's plans, the break-out, Twopenny and the gallows' rescues are
 * PR 7. Numbers and lines: content/prison.js. No screen code here.
 *
 * state.jail (null when free):
 *   { kind: "cell"|"marooned", node, faction, name, charge, stage, served,
 *     sentence, gallows, ship: "port"|"lost"|"impounded"|"sailed",
 *     cell: { officers: [ids], tiers: {} }, items: [], outside: [], log: [],
 *     since, releaseAt, interrogated, pick, trial, ... }
 * state.shipless: true while the captain has no ship.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function P() { return PC.data.prison; }
  function L() { return P().lines; }
  function stamp(state) { return PC.state.stamp(state); }
  function key(state, what) { return [state.world.seed, stamp(state), "jail", what, state.rolls.jail = (state.rolls.jail || 0) + 1].join("|"); }
  function between(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  var FACTION_NAME = { avalon: "Avalon", frisia: "Frisia" };
  var TIERS = ["Held", "Imprisoned", "Condemned"];

  // ---- Secrets (§30.12) ----------------------------------------------------------

  // The captain's live secrets: the Slice's starter list, where it applies.
  function secrets(state) {
    var out = [], S = P().SECRETS, ex = state.secretsExposed || {};
    Object.keys(S).forEach(function (id) {
      var s = S[id];
      if (s.fence && !(state.flags["fenceUsed_" + s.fence])) return;
      out.push({ id: id, name: s.name, size: s.size, points: P().SECRET_POINTS[s.size] || 1, penalty: s.penalty, exposed: !!ex[id] });
    });
    return out;
  }
  function liveSecrets(state) { return secrets(state).filter(function (s) { return !s.exposed; }); }
  function secretPoints(state) { return liveSecrets(state).reduce(function (a, s) { return a + s.points; }, 0); }

  // Seasons count as an index so "shut until" compares simply.
  function seasonIndex(state) { return state.time.year * 4 + state.time.season; }

  function expose(state, id) {
    var s = P().SECRETS[id];
    if (!s) return null;
    state.secretsExposed = state.secretsExposed || {};
    state.secretsExposed[id] = stamp(state);
    var line = s.name + " is out.";
    if (s.fence) {
      var r = PC.rng.fromKey(key(state, "fence-shut"));
      var n = between(r, P().FENCE_SHUT[0], P().FENCE_SHUT[1]);
      state.fenceShut = state.fenceShut || {};
      state.fenceShut[s.fence] = seasonIndex(state) + n;
      line += " " + s.penalty.replace("1-2 seasons", n === 1 ? "a season" : n + " seasons");
    }
    PC.state.addLog(state, "Secret exposed: " + s.name + ".");
    return line;
  }

  // An exposed fence is shut for a season or two (§30.12).
  function fenceShut(state, npc) { var u = (state.fenceShut || {})[npc]; return u != null && seasonIndex(state) < u; }

  // ---- The charge (§43.4) ----------------------------------------------------------

  function chargeFor(state, faction) {
    var b = PC.meters.heatBand((state.meters.heat || {})[faction] || 0);
    return b === "Cold" || b === "Noticed" ? "Held" : b === "Wanted" ? "Imprisoned" : "Condemned";
  }

  // Who jails, and where (§43.2): Avalon at Norfolk, Frisia at St.
  // Augustine's castle (a jail screen only, D4b); anyone else maroons him.
  function captorFor(flag) { return P().CAPTORS[flag] || null; }

  function jailInfo(node) { return P().JAILS[node] || { name: "The Cells", judge: null, admiralty: false }; }

  function fineFor(state, j) {
    var node = PC.data.nodes[j.node] ? j.node : "norfolk";
    try { return Math.round(PC.node.portFee(state, node) * P().FINE_FEES); } catch (e) { return 200; }
  }

  // ---- Going in -----------------------------------------------------------------------

  // Items taken at the cell door: all but concealable weapons and Lockpicks
  // (§43.3), returned on release.
  function concealable(id) {
    var m = PC.data.modifiers[id] || {};
    var d = PC.items && PC.items.def(id);
    return !!m.concealable || !!(d && d.concealable) || /knife|dagger|stiletto|lockpick/i.test(id);
  }
  function takeItems(state) {
    var c = state.captain, keep = [], took = [];
    (c.items || []).forEach(function (id) { (concealable(id) ? keep : took).push(id); });
    c.items = keep;
    return took;
  }

  // Put the captain in a cell. o: { node, faction, how: "sea"|"port"|"tow",
  // cell: { officers, tiers } (sea), lines: [] }.
  function enter(state, o) {
    var info = jailInfo(o.node);
    var charge = o.charge || chargeFor(state, o.faction);
    var j = {
      kind: "cell", node: o.node, faction: o.faction, name: info.name, charge: charge, how: o.how,
      stage: charge === "Held" ? "held" : "interrogate", served: 0, sentence: 0, gallows: null,
      ship: o.how === "port" ? "port" : "lost", cell: o.cell || { officers: [], tiers: {} },
      items: takeItems(state), outside: [], log: (o.lines || []).slice(), since: stamp(state),
      releaseAt: (P().CAPTORS[FACTION_NAME[o.faction]] || {}).releaseAt || null, inPortSeasons: 0,
    };
    j.log.push(o.how === "port" ? L().capturedPort : L().capturedSea);
    j.log.push(L().charge[charge]);
    state.jail = j;
    state.jailPending = null;
    state.gameOver = null;
    if (j.ship !== "port") state.shipless = true;
    if (PC.data.nodes[o.node]) { state.location = { node: o.node, place: null, queue: [] }; PC.node.initNode(state, o.node); }
    // Held costs 3 actions in all, spent as the cell's actions (3-29 of the
    // build 0.9 pins); the season's other actions stay. A longer stay keeps
    // the cell's 3 a season (§43.7).
    if (charge !== "Held") state.ap.left = Math.min(state.ap.left, P().CELL_AP);
    state.current = { screen: "jail" };
    PC.state.addLog(state, "Jailed in " + info.name + " (" + charge + ").");
    return j;
  }

  // A scene that ends in jail (Norfolk's beat 1, an inspection over the
  // threshold) leaves a pending jailing; the scene's "end" exit lands here.
  function fromScene(state) {
    var p = state.jailPending;
    if (!p) return false;
    enter(state, { node: p.node, faction: p.faction, how: "port" });
    return true;
  }

  // Capture at sea (§43.3): officers and 10 hands (or a quarter of the crew,
  // whichever is more) go into the cell with him; the purse, cargo, crew
  // gold and every ship are lost. Pirate and foreign captors maroon him.
  function captureAtSea(state, game) {
    var b = game.battle, lead = b ? (b.enemies.filter(function (e) { return e.id === b.target; })[0] || b.enemies[0]) : null;
    var flag = lead ? lead.flag : "Avalon";
    var cap = captorFor(flag);
    var officers = (state.officers || []).filter(function (o) { return !o.gone; }).map(function (o) { o.aboard = "flagship"; return o.id; });
    var C = P().CAPTURED_CREW, n = Math.min(state.crew.count, Math.max(C.min, Math.ceil(state.crew.count * C.share)));
    var tiers = {};
    PC.data.economy.TIER_ORDER.slice().reverse().forEach(function (t) { var k = Math.min(n, state.crew.tiers[t] || 0); if (k) { tiers[t] = k; n -= k; } });
    loseEverything(state);
    state.minigame = null; state.voyage = null;
    if (!cap) return maroon(state, { officers: officers, by: flag });
    PC.state.addLog(state, "Captured at sea by " + (flag === "Avalon" ? "an Avalon ship" : "a Frisian ship") + ".");
    return enter(state, { node: cap.node, faction: cap.faction, how: "sea", cell: { officers: officers, tiers: tiers } });
  }

  // The purse, crew gold, cargo, the crew and every ship (§43.3).
  function loseEverything(state) {
    state.money.purse = 0; state.money.crew = 0;
    state.cargo = { goods: {}, treasure: { clean: 0, dirty: 0 } };
    state.provisions = 0;
    if (PC.items) PC.items.loseCabin(state); // the cabin goes with the ship (§32.6)
    state.fleet = [];
    var c = state.crew;
    PC.data.economy.TIER_ORDER.forEach(function (t) { c.tiers[t] = 0; });
    c.count = 0; c.wounded = 0; c.woundedTiers = {}; c.raw = 0;
    state.captives = 0;
    state.shipless = true;
    if (state.actingQM) state.actingQM.active = false;
  }

  // ---- Interrogation (§43.5) -------------------------------------------------------

  function talkOffer(state) {
    var p = secretPoints(state), T = P().TALK_FREELY;
    return p >= T.free ? "free" : p >= T.drop ? "drop" : "laugh";
  }

  function interrogate(state, how) {
    var j = state.jail;
    if (!j || j.stage !== "interrogate") throw new Error("Not the moment for that.");
    var live = liveSecrets(state), out = { lines: [], chips: [] };
    if (!live.length) { out.lines.push(L().noSecrets); return toTrialWait(state, out); }
    if (how === "talk") {
      var offer = talkOffer(state);
      if (offer === "laugh") throw new Error("They'd laugh at what you've got.");
      live.forEach(function (s) { var l = expose(state, s.id); if (l) out.chips.push({ icon: "rumor", text: l, ink: "bad" }); });
      if (state.captain.tags.indexOf("Snitch") < 0) state.captain.tags.push("Snitch");
      out.lines.push(L().talked);
      out.chips.push({ icon: "person", text: "Tag earned: Snitch", ink: "bad" });
      if (offer === "free") { j.log.push(L().talked); return release(state, { walk: true, lines: out.lines, chips: out.chips }); }
      j.charge = TIERS[Math.max(0, TIERS.indexOf(j.charge) - 1)];
      out.chips.push({ icon: "person", text: "The charge drops to " + j.charge, ink: "good" });
      if (j.charge === "Held") { j.stage = "held"; j.interrogated = true; return finishStep(state, out); }
      return toTrialWait(state, out);
    }
    var r = PC.checks.resolve(state, { type: "Resist Interrogation", dr: P().INTERROGATION_DR }, key(state, "resist"), { conditions: [] });
    out.outcome = r.outcome;
    out.lines.push(L().resist[r.outcome]);
    if (r.outcome === "partial") {
      var small = live.filter(function (s) { return s.size === "Small"; });
      if (small.length) { j.stage = "givePick"; j.pick = small.map(function (s) { return s.id; }); return finishStep(state, out); }
    }
    if (r.outcome === "setback") {
      var pick = live[Math.floor(PC.rng.fromKey(key(state, "secret"))() * live.length)];
      var l = expose(state, pick.id);
      if (l) out.chips.push({ icon: "rumor", text: l, ink: "bad" });
    }
    return toTrialWait(state, out);
  }

  // A partial: the player gives up one Small secret of his choosing.
  function giveUp(state, id) {
    var j = state.jail;
    if (!j || j.stage !== "givePick" || (j.pick || []).indexOf(id) < 0) throw new Error("Not the moment for that.");
    var out = { lines: [], chips: [] }, l = expose(state, id);
    if (l) out.chips.push({ icon: "rumor", text: l, ink: "bad" });
    j.pick = null;
    return toTrialWait(state, out);
  }

  function toTrialWait(state, out) {
    var j = state.jail;
    j.interrogated = true;
    j.stage = "awaitTrial";
    return finishStep(state, out);
  }

  function finishStep(state, out) {
    var j = state.jail;
    if (j) { (out.lines || []).forEach(function (l) { j.log.push(l); }); (out.chips || []).forEach(function (c) { j.log.push(c.text); }); }
    return out;
  }

  // ---- Time in the cell -----------------------------------------------------------

  // Wait out an action in the cell (Held, or awaiting trial).
  function wait(state) {
    var j = state.jail;
    if (!j || (j.stage !== "held" && j.stage !== "awaitTrial")) throw new Error("Not the moment for that.");
    if (j.stage === "held" && j.served >= P().HELD_AP) return heldDone(state, { lines: [], chips: [] }); // the time's served: the fine, and out
    if (state.ap.left < 1) throw new Error("No actions left this season: let the season turn.");
    state.ap.left -= 1;
    j.served += 1;
    var out = { lines: [L().cellWait], chips: [] };
    if (j.stage === "held" && j.served >= P().HELD_AP) return heldDone(state, out);
    if (j.stage === "awaitTrial" && j.served >= P().TRIAL_AP) { j.stage = "trial"; out.lines.push(L().trialOpen); }
    return finishStep(state, out);
  }

  // Any cell action (a plan, the cellmates, a break-out) costs an action,
  // and while Held it counts toward the three (3-29 of the build 0.9 pins).
  function cellAction(state) {
    var j = state.jail;
    state.ap.left -= 1;
    if (j && j.stage === "held") j.served += 1;
  }
  // After a cell action: Held's three spent with no break-out under way,
  // the fine and out.
  function afterCellAction(state, out) {
    var j = state.jail;
    if (j && j.stage === "held" && j.served >= P().HELD_AP && !j.breakout) return heldDone(state, out);
    return finishStep(state, out);
  }

  // Held: three actions lost, then out with a fine of 4× the port fee.
  function heldDone(state, out) {
    var j = state.jail, fine = fineFor(state, j), paid = PC.crew.payFrom(state, fine, true);
    out.chips.push({ icon: "gold", text: L().fined.replace("[gold]", String(paid.crew + paid.purse)) + (paid.short ? " (" + paid.short + " they couldn't take)" : ""), ink: "bad" });
    return release(state, { lines: out.lines, chips: out.chips });
  }

  // The season turns with the captain inside: the world moves on (§43.10).
  function seasonTurn(state) {
    var j = state.jail;
    if (!j) throw new Error("You're not in a cell.");
    var turn = PC.world.endSeason(state);
    var out = { lines: [], chips: [], turn: turn };
    if (state.ended) return out; // past Winter 1754: the end-of-year screen (D4a)
    if (state.split) { state.split = null; out.lines.push("No split this Winter: the captain is in the cells."); }
    state.current = { screen: j.kind === "marooned" ? "jail" : "jail" };
    state.ap.left = j.kind === "marooned" ? state.ap.max : P().CELL_AP;
    if (j.kind === "cell") outsideSeason(state, out);
    if (j.stage === "serving") {
      j.sentence = Math.max(0, j.sentence - 1);
      if (!j.sentence) { out.served = true; served(state, out); }
    }
    if (state.jail && PC.escape) PC.escape.seasonInCell(state, out); // jail fever, the Captivity beat (PR 7)
    if (state.jail && j.stage === "gallows") {
      if (j.gallows <= seasonIndex(state)) {
        // The crew's rescue or a patron's reprieve, else the rope (§43.12).
        var saved = PC.escape ? PC.escape.atGallows(state, out) : false;
        if (!saved) { out.hanged = true; hang(state); }
      }
    }
    (turn.lines || []).forEach(function (l) { if (state.jail) state.jail.outside.push(l); });
    if (state.jail) finishStep(state, out);
    return out;
  }

  // The outside (§43.10): a ship in port waits with the Quartermaster at
  // -5 morale a season; the crew sail without you when morale falls to
  // Mutinous or the food runs out; an Admiralty port impounds her after one
  // season. DEFAULT: an impounded ship is lost to the captain; officers at
  // Friend or better wait ashore for him, the rest sail with the crew.
  function outsideSeason(state, out) {
    var j = state.jail;
    if (j.ship === "impounded" && state.crew.count > 0) {
      PC.crew.addMorale(state, P().OUTSIDE_MORALE);
      j.outside.push(L().outsideMorale);
      if (state.crew.morale < P().CREW_LEAVE_MORALE) { j.outside.push(L().crewScattered); shipGone(state, false); j.ship = "lost"; }
      return;
    }
    if (j.ship !== "port") return;
    j.inPortSeasons += 1;
    PC.crew.addMorale(state, P().OUTSIDE_MORALE);
    j.outside.push(L().outsideMorale);
    var fill = function (l) { return l.replace("[Ship]", state.ship.name); };
    if (jailInfo(j.node).admiralty && j.inPortSeasons >= 1) {
      // Impounded: the ship, her cargo and the crew's chest are held; the
      // crew wait ashore (a crew rescue at the gallows retakes her, §43.12).
      j.ship = "impounded";
      j.impounded = JSON.parse(JSON.stringify(state.ship));
      j.outside.push(fill(L().impounded));
      out.chips.push({ icon: "hull", text: "The " + state.ship.name + " is impounded", ink: "bad" });
      state.money.crew = 0; state.cargo = { goods: {}, treasure: { clean: 0, dirty: 0 } }; state.provisions = 0; state.fleet = [];
      state.shipless = true;
      return;
    }
    if (state.crew.morale < P().CREW_LEAVE_MORALE || PC.crew.food(state) <= 0) {
      j.ship = "sailed";
      j.outside.push(fill(L().crewSailed));
      out.chips.push({ icon: "hull", text: "Your crew sailed without you", ink: "bad" });
      shipGone(state, true);
    }
  }

  // She's gone: the crew with her (sailed) or scattered (impounded), the
  // cargo and crew gold with her; loyal officers stay ashore.
  function shipGone(state, sailed) {
    var keep = (state.officers || []).filter(function (o) { return !o.gone && o.rung >= PC.npcs.RUNG_VALUE.Friend; }).map(function (o) { return o.id; });
    (state.officers || []).forEach(function (o) { if (!o.gone && keep.indexOf(o.id) < 0) { o.gone = true; o.goneWhy = sailed ? "sailed without you" : "scattered"; } });
    state.jail.cell.officers = (state.jail.cell.officers || []).concat(keep.filter(function (id) { return (state.jail.cell.officers || []).indexOf(id) < 0; }));
    var purse = state.money.purse;
    loseEverything(state);
    state.money.purse = purse; // the captain's purse isn't aboard
  }

  // ---- The trial (§43.6) ------------------------------------------------------------

  // A Friend or better at the jail's node who isn't an Underworld figure.
  function confidant(state, node) {
    var nd = PC.data.nodes[node];
    if (!nd) return null;
    var ids = nd.slots.map(function (s) { return PC.node.slotNpc(node, s.key); }).filter(Boolean);
    var best = null;
    ids.forEach(function (id) {
      if (P().NO_TESTIMONY.indexOf(id) >= 0) return;
      var n = PC.npcs.get(state, id);
      if (n && !n.dead && n.rung >= PC.npcs.RUNG_VALUE.Friend && !best) best = id;
    });
    return best;
  }

  function judgeShift(state, node) {
    var id = jailInfo(node).judge, d = id ? ((PC.data.npcs || {})[id] || (state.generated || {})[id]) : null;
    var n = 0;
    ((d && d.traits) || []).forEach(function (t) { n += P().JUDGE_TRAITS[t] || 0; });
    return Math.max(-1, Math.min(1, n));
  }

  function trialCheck(state) {
    var j = state.jail, extra = [], c = confidant(state, j.node);
    if (c) extra.push({ label: npcName(state, c) + " speaks for you", value: P().CONFIDANT_BONUS });
    if (j.trialDR) extra.push({ label: "Caught trying to escape", value: -j.trialDR });
    return { type: "Petition", dr: P().TRIAL_DR[j.charge], extra: extra };
  }

  function npcName(state, id) {
    var g = (state.generated || {})[id] || (PC.data.npcs || {})[id] || {};
    return g.full || [g.first, g.last].filter(Boolean).join(" ") || id;
  }

  function trial(state) {
    var j = state.jail;
    if (!j || j.stage !== "trial") throw new Error("Not the moment for that.");
    var c = confidant(state, j.node), out = { lines: [], chips: [] };
    if (c) out.lines.push(L().confidant.replace("[Name]", npcName(state, c)));
    var r = PC.checks.resolve(state, trialCheck(state), key(state, "trial"), { conditions: ["Official"] });
    out.outcome = r.outcome;
    var V = L().verdict[j.charge][r.outcome], S = P().SENTENCE[j.charge], rnd = PC.rng.fromKey(key(state, "sentence"));
    if (r.outcome === "clean") {
      out.lines.push(V);
      if (j.charge === "Imprisoned") {
        var fine = fineFor(state, j), paid = PC.crew.payFrom(state, fine, true);
        out.chips.push({ icon: "gold", text: L().fined.replace("[gold]", String(paid.crew + paid.purse)), ink: "bad" });
        PC.meters.addStanding(state, j.faction, P().ACQUIT_STANDING);
        out.chips.push({ icon: "standing", text: FACTION_NAME[j.faction] + " Standing " + P().ACQUIT_STANDING, ink: "bad" });
      }
      return release(state, { lines: out.lines, chips: out.chips, acquitted: true });
    }
    if (j.charge === "Condemned" && r.outcome === "setback") {
      j.stage = "gallows";
      j.gallows = seasonIndex(state) + 2; // hanged as next season ends (the clock reads +2 then)
      out.lines.push(V);
      finishStep(state, out);
      if (PC.escape && PC.escape.twopenny(state, out)) return out; // once a game, before any cell action (§43.11)
      return out;
    }
    var range = S[r.outcome], n = between(rnd, range[0], range[1]) + judgeShift(state, j.node);
    n = Math.max(1, n);
    j.stage = "serving"; j.sentence = n; j.sentenced = n;
    out.lines.push(V.replace("[n]", String(n)));
    out.chips.push({ icon: "person", text: "Sentenced to " + n + " season" + (n === 1 ? "" : "s"), ink: "bad" });
    return finishStep(state, out);
  }

  // Serve your time: fast-forward the seasons (§43.6). Stops at the end of
  // the year (D4a) or the gallows.
  function serve(state) {
    var j = state.jail;
    if (!j || j.stage !== "serving") throw new Error("Not the moment for that.");
    var out = { lines: [], chips: [], seasons: 0 };
    while (state.jail && state.jail.stage === "serving" && !state.ended && out.seasons < 40) {
      var t = seasonTurn(state);
      out.seasons += 1;
      if (t.served) { out.released = true; out.popup = t.popup; }
    }
    return out;
  }

  // The full sentence served: Heat with the jailing faction is cleared.
  function served(state, out) {
    var j = state.jail;
    state.meters.heat[j.faction] = 0;
    out.chips.push({ icon: "heat", text: L().servedHeat.replace("[Faction]", FACTION_NAME[j.faction]), ink: "good" });
    var r = release(state, { lines: [], chips: out.chips, served: true });
    out.popup = r.popup;
  }

  function hang(state) {
    var j = state.jail;
    j.log.push(L().hanged);
    state.jail = null;
    state.gameOver = { how: "died", line: "hanged" };
    PC.state.addLog(state, "Hanged at " + j.name + ".");
    PC.summary.end(state);
  }

  // ---- Release ----------------------------------------------------------------------

  // Out: the items back, the cellmates with him, then the ship in port, or
  // the shipless popup (§43.13). Returns { popup } for the summary.
  function release(state, o) {
    o = o || {};
    var j = state.jail;
    state.captain.items = (state.captain.items || []).concat(j.items || []);
    // Cellmates: the officers rejoin; the hands come out with him (DEFAULT).
    (j.cell.officers || []).forEach(function (id) { var of = (state.officers || []).filter(function (x) { return x.id === id; })[0]; if (of) { of.gone = false; of.aboard = "flagship"; } });
    Object.keys(j.cell.tiers || {}).forEach(function (t) { if (j.cell.tiers[t]) PC.crew.addHands(state, t, j.cell.tiers[t]); });
    var at = j.releaseAt || j.node;
    if (!PC.data.nodes[at]) at = "ocracoke";
    var lines = [L().released].concat(o.lines || []);
    var all = lines.concat(j.outside.length ? ["While you were inside:"].concat(j.outside) : []);
    var popup = { title: "Free", text: all.join("\n\n"), lines: all, chips: o.chips || [] };
    var shipHere = j.ship === "port";
    state.jail = null;
    state.location = { node: at, place: null, queue: [] };
    PC.node.initNode(state, at);
    state.location.popup = popup;
    PC.state.addLog(state, "Released from " + j.name + ".");
    if (shipHere) { state.shipless = false; state.current = { screen: "node" }; return { popup: popup }; }
    state.shipless = true;
    state.current = { screen: "shipless" };
    return { popup: popup };
  }

  // ---- Marooned (§21.8, §24.13) ----------------------------------------------------

  function maroon(state, o) {
    o = o || {};
    var j = { kind: "marooned", stage: "drift", node: null, faction: "avalon", name: "Marooned", charge: null, served: 0,
      cell: { officers: o.officers || [], tiers: {} }, items: [], outside: [], log: [L().marooned], tries: 0, since: stamp(state), ship: "lost" };
    if (j.cell.officers.length) j.log.push(L().maroonedOfficers.replace("[Officers]", j.cell.officers.map(function (id) { var x = state.officers.filter(function (q) { return q.id === id; })[0]; return x ? x.first : id; }).join(" and ")));
    state.jail = j;
    state.shipless = true;
    state.gameOver = null;
    state.current = { screen: "jail" };
    PC.state.addLog(state, "Marooned" + (o.by ? " by a " + o.by + " ship" : "") + ".");
    return j;
  }

  // Two actions pass, then a sail (D4c: an Avalon ship, towing to Norfolk).
  function drift(state) {
    var j = state.jail;
    if (!j || j.kind !== "marooned" || j.stage !== "drift") throw new Error("Not the moment for that.");
    var need = P().MAROON_AP, out = { lines: [L().drift], chips: [] };
    while (need > 0) {
      if (state.ap.left < 1) { var t = seasonTurn(state); if (state.ended) return out; out.lines = out.lines.concat(t.lines); continue; }
      state.ap.left -= 1; need -= 1;
    }
    j.stage = "rescue";
    out.lines.push(L().rescueSail);
    return finishStep(state, out);
  }

  function rescueCheck(state) {
    var j = state.jail, extra = [];
    var friend = (state.officers || []).some(function (o) { return !o.gone && (j.cell.officers || []).indexOf(o.id) >= 0 && o.rung >= PC.npcs.RUNG_VALUE.Friend; });
    if (friend) extra.push({ label: "An officer at Friend or better", value: 1 });
    return { type: "Persuade", dr: P().RESCUE_DR, extra: extra };
  }

  function rescue(state) {
    var j = state.jail;
    if (!j || j.kind !== "marooned" || j.stage !== "rescue") throw new Error("Not the moment for that.");
    var r = PC.checks.resolve(state, rescueCheck(state), key(state, "rescue"), { conditions: [] });
    var out = { lines: [L().rescue[r.outcome]], chips: [], outcome: r.outcome };
    j.tries += 1;
    if (r.outcome === "setback") { j.stage = "drift"; return finishStep(state, out); }
    var to = "norfolk";
    if (r.outcome === "partial") {
      // A price (DEFAULT: 2× the port fee; Haggle isn't built for it): what
      // he has, if not all of it.
      var price = Math.round(PC.node.portFee(state, to) * P().RESCUE_PRICE_FEES), paid = PC.crew.payFrom(state, price, true);
      out.chips.push({ icon: "gold", text: "The price of a passage: " + (paid.crew + paid.purse) + " gold" + (paid.short ? " (all you had)" : ""), ink: "bad" });
    }
    var officers = j.cell.officers || [];
    state.jail = null;
    out.lines.push(L().towed.replace("[Place]", PC.world.placeName(to)));
    // A node his Standing bars means jail (§21.8, §43.1).
    var nd = PC.data.nodes[to];
    if (nd.closedAt && PC.node.standingBand(state, nd.faction).name === nd.closedAt) {
      out.lines.push(L().barred);
      enter(state, { node: to, faction: nd.faction, how: "tow", cell: { officers: officers, tiers: {} }, lines: out.lines });
      return out;
    }
    state.location = { node: to, place: null, queue: [] };
    PC.node.initNode(state, to);
    state.location.popup = { title: PC.world.placeName(to), text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
    state.shipless = true;
    state.current = { screen: "shipless" };
    return out;
  }

  // ---- The shipless popup (§43.13) -----------------------------------------------

  function onHand(state) { return state.money.crew + state.money.purse; }

  function shiplessOptions(state) {
    var here = PC.node.here(state), nd = PC.data.nodes[here] || {};
    var friend = nd.slots ? nd.slots.map(function (s) { return PC.node.slotNpc(here, s.key); }).filter(function (id) { var n = PC.npcs.get(state, id); return n && n.rung >= PC.npcs.RUNG_VALUE.Friend; })[0] : null;
    return [
      { id: "buy", label: "Buy a cutter outright", cost: P().CUTTER_PRICE, ok: onHand(state) >= P().CUTTER_PRICE, why: onHand(state) >= P().CUTTER_PRICE ? null : "Needs " + P().CUTTER_PRICE + " gold on hand" },
      { id: "steal", label: "Steal a ship", check: { type: "Light Fingers", dr: P().STEAL_DR }, ok: true },
      { id: "work", label: "Work in town", ok: true, meta: "A season passes." },
      { id: "stash", label: "Send someone for the stash", ok: false, why: friend ? "You have no stash yet" : "No friend here, and no stash yet" },
      { id: "retire", label: "Retire", ok: true },
    ];
  }

  // A cutter with her minimum crew (Green hands topping up whoever came
  // out of the cell with him), a few lots of food and nothing else.
  function newCutter(state, opts) {
    opts = opts || {};
    var c = PC.data.hunt.CLASSES.Cutter;
    var hull = Math.max(1, Math.round(c.hull * (opts.shabby ? P().SHABBY_HULL : 1)));
    var names = (PC.data.names.SHIPS || {}).pirate || ["Second Wind"];
    var nm = names[Math.floor(PC.rng.fromKey(key(state, "cutter-name"))() * names.length)];
    state.ship = { name: nm, type: "Cutter", hull: hull, hullMax: c.hull, baseHull: c.hull, guns: Math.round(c.guns / 2), gunsMax: c.guns, cargo: c.cargo, size: c.size,
      crewMin: c.crewMin, crewMax: c.crewMax, speed: c.speed, speedMax: c.speed, handling: c.handling, rigging: "sound", upgrades: { hull: 1, rigging: 1, guns: 1 }, dirty: !!opts.dirty };
    // Hands beyond her berths are lost (DEFAULT).
    var over = state.crew.count - c.crewMax;
    PC.data.economy.TIER_ORDER.forEach(function (t) { if (over > 0) { var k = Math.min(over, state.crew.tiers[t] || 0); if (k) { PC.crew.removeHands(state, t, k); over -= k; } } });
    if (state.crew.count < c.crewMin) PC.crew.addHands(state, "Green", c.crewMin - state.crew.count);
    state.provisions = Math.max(state.provisions, P().CUTTER_PROVISIONS);
    state.shipless = false;
    state.current = { screen: "node" };
    PC.officers.ensureQuartermaster && PC.officers.ensureQuartermaster(state);
    PC.state.addLog(state, "A new ship: the cutter " + nm + ".");
    return state.ship;
  }

  function shiplessChoose(state, id) {
    if (!state.shipless) throw new Error("You have a ship.");
    var opt = shiplessOptions(state).filter(function (o) { return o.id === id; })[0];
    if (!opt || !opt.ok) throw new Error(opt ? opt.why : "Not an option.");
    var out = { lines: [], chips: [] };
    if (id === "buy") {
      var paid = PC.crew.payFrom(state, P().CUTTER_PRICE);
      newCutter(state);
      out.lines.push(L().boughtCutter);
      out.chips.push({ icon: "gold", text: "−" + (paid.crew + paid.purse) + " gold", ink: "mid" });
    } else if (id === "steal") {
      var r = PC.checks.resolve(state, opt.check, key(state, "steal"), { conditions: ["Town"] });
      out.outcome = r.outcome;
      out.lines.push(L().steal[r.outcome]);
      var nd = PC.node.nodeData(PC.node.here(state));
      if (r.outcome !== "setback") {
        newCutter(state, { dirty: true });
        if (r.outcome === "partial" && (nd.faction === "avalon" || nd.faction === "frisia")) { PC.meters.addHeat(state, nd.faction, P().STEAL_HEAT); out.chips.push({ icon: "heat", text: FACTION_NAME[nd.faction] + " Heat +" + P().STEAL_HEAT, ink: "bad" }); }
      } else if (nd.faction === "avalon" || nd.faction === "frisia") {
        enter(state, { node: PC.node.here(state), faction: nd.faction, how: "tow", lines: out.lines });
      } else {
        // No jail here (Ocracoke has the stocks, §43.14): a night in them, an action lost.
        out.lines.push(L().stocks);
        state.ap.left = Math.max(0, state.ap.left - 1);
      }
    } else if (id === "work") {
      var t = PC.world.endSeason(state);
      if (state.ended) return out;
      state.split = null;
      newCutter(state, { shabby: true });
      out.lines.push(L().worked);
      out.lines = out.lines.concat(t.lines || []);
    } else if (id === "retire") {
      state.gameOver = { how: "retired", line: "retired" };
      PC.state.addLog(state, "Retired.");
      PC.summary.end(state, "retired");
      return out;
    }
    if (state.location && !state.ended) state.location.popup = { title: state.shipless ? "Still ashore" : "A ship of your own", text: out.lines.join("\n\n"), lines: out.lines, chips: out.chips };
    return out;
  }

  // ---- The screen's view ------------------------------------------------------------

  function view(state) {
    var j = state.jail;
    if (!j) return null;
    var v = { kind: j.kind, name: j.name, charge: j.charge, stage: j.stage, served: j.served, sentence: j.sentence, log: j.log.slice(-12), ap: state.ap.left,
      faction: FACTION_NAME[j.faction], ship: j.ship, standIn: !!(P().JAILS[j.node] || {}).standIn };
    if (j.stage === "interrogate") { v.secrets = liveSecrets(state); v.points = secretPoints(state); v.offer = talkOffer(state); v.resist = { type: "Resist Interrogation", dr: P().INTERROGATION_DR }; }
    if (j.stage === "givePick") v.pick = (j.pick || []).map(function (id) { return { id: id, name: P().SECRETS[id].name, penalty: P().SECRETS[id].penalty }; });
    if (j.stage === "held") v.left = Math.max(0, P().HELD_AP - j.served);
    if (j.stage === "awaitTrial") v.left = P().TRIAL_AP - j.served;
    if (j.stage === "trial") { v.trialCheck = trialCheck(state); var c = confidant(state, j.node); v.confidant = c ? npcName(state, c) : null; v.judgeShift = judgeShift(state, j.node); }
    if (j.stage === "gallows") v.gallowsIn = j.gallows - seasonIndex(state);
    if (j.kind === "marooned" && j.stage === "rescue") v.rescueCheck = rescueCheck(state);
    return v;
  }

  PC.prison = {
    cellAction: cellAction, afterCellAction: afterCellAction, loseEverything: loseEverything,
    secrets: secrets, liveSecrets: liveSecrets, secretPoints: secretPoints, expose: expose, fenceShut: fenceShut, seasonIndex: seasonIndex,
    chargeFor: chargeFor, captorFor: captorFor, enter: enter, fromScene: fromScene, captureAtSea: captureAtSea,
    talkOffer: talkOffer, interrogate: interrogate, giveUp: giveUp, wait: wait, seasonTurn: seasonTurn,
    confidant: confidant, judgeShift: judgeShift, trialCheck: trialCheck, trial: trial, serve: serve, release: release,
    maroon: maroon, drift: drift, rescue: rescue, rescueCheck: rescueCheck,
    shiplessOptions: shiplessOptions, shiplessChoose: shiplessChoose, newCutter: newCutter, view: view,
    jailInfo: jailInfo, finishStep: finishStep, hang: hang, npcName: npcName, takeItems: takeItems, FACTION_NAME: FACTION_NAME,
  };
})();
