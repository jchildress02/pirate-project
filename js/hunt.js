/* Pirate Chronicle — the prize hunt (§22.1-§22.8, §37.3).
 *
 * Hunt for Prizes from Ocracoke's town screen: each action buys a batch of
 * three prize rolls in the Hatteras Banks; each sighting is scouted, then
 * engaged or let pass; a battle runs in js/combat.js; after it, the
 * captured ships, their cargo, captives and crews are settled; the hunt
 * ends by sailing home to Ocracoke (an arrival: the popup and the harbor
 * due). It runs as a minigame ("hunt") so rerolls and the log work the
 * same way as the dive and the drinking match.
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function H() { return PC.data.hunt; }
  function L() { return PC.data.huntLines; }
  function M() { return PC.minigames; }
  function G() { return PC.huntGen; }
  function C() { return PC.combat; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function fleet(state) { return (state.fleet = state.fleet || []); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  // ---- Starting --------------------------------------------------------------

  function canHunt(state) {
    if (!state.location) return { ok: false, why: "Only from a port" };
    if (!state.articles) return { ok: false, why: "Sign the Articles before you sail" };
    if (state.ap.left < 1) return { ok: false, why: "No actions left this season" };
    if (state.crew.count < (state.ship.crewMin || 5)) return { ok: false, why: "Not enough hands to sail her" };
    return { ok: true };
  }

  function start(state, opts) {
    opts = opts || {};
    var c = canHunt(state);
    if (!c.ok) throw new Error(c.why);
    var waters = H().HOME_WATERS[state.location.node] || PC.node.nodeData(state.location.node).waters || "north";
    var game = {
      kind: "hunt", key: "hunt-" + (state.rolls.hunt = (state.rolls.hunt || 0) + 1), waters: waters,
      apUsed: 0, batch: null, phase: "setout", sighting: null, battle: null, after: null,
      prizesTaken: 0, prizeMorale: 0, captives: 0, force: opts.force || null, home: state.location.node,
    };
    M().start(state, game, "node");
    M().say(state, game, L().setOut);
    // Read Weather rolls itself before a port hunt (§42.6); its result
    // rides on the hunt's storm check (voyage events, §44.7).
    game.zone = waters;
    if (!PC.node.isOcean(state.location.node)) {
      game.readWeather = PC.weather.autoRead(state, waters, [state.world.seed, PC.state.stamp(state), game.key, "read"].join("|"));
      M().noteRoll(game, { label: "Read Weather", outcome: game.readWeather.outcome, effect: { clean: "a storm on the way out is redrawn once, and +1 to ride one out", partial: "+1 to ride out a storm", setback: "no help from the sky" }[game.readWeather.outcome] });
    }
    var leg = PC.voyageEvents ? PC.voyageEvents.huntLeg(state, game, "out") : null;
    if (leg && leg.pending) return game; // an event first; afterLeg() starts the batch
    if (state.minigame !== game || game.over) return game;
    newBatch(state, game);
    return game;
  }

  // ---- The batch (§22.2) ------------------------------------------------------

  function provisionHeads(state) {
    var n = state.crew.count + (state.crew.wounded || 0) + (state.captives || 0);
    fleet(state).forEach(function (f) { if (!f.out) n += f.crew; });
    return n;
  }

  // Provisions burn by the hunt's actions: crew ÷ 5 lots an action (§20.6).
  // Short of provisions, the crew go hungry (DEFAULT: −10 morale).
  // Milestone 7: the same burn as a voyage (§20.6): Winter +50%, rationing
  // -25% with its Ration Stores check, and hunger's Go Without check.
  function burn(state, game) {
    var b = PC.world.burn(state, 1, {});
    b.lines.forEach(function (l) { M().say(state, game, l); });
    return b;
  }

  function newBatch(state, game) {
    if (state.ap.left < 1) throw new Error("No actions left this season.");
    if (game.apUsed >= H().MAX_AP) throw new Error("A hunt is at most three actions.");
    state.ap.left -= 1;
    game.apUsed += 1;
    burn(state, game);
    var r = M().rand(state, game, "batch");
    var force = game.force;
    var hunter = force && force.kind === "hunter" ? force.flag || "Avalon" : G().rollHunter(state, game.waters, r);
    // The batch's weather (§42.4): rolled now, or read ahead (§42.6).
    var cond = game.nextCondition || PC.weather.rollCondition(state, game.waters, M().key(state, game, "condition"));
    game.nextCondition = null; game.readAhead = null;
    game.batch = { n: H().ROLLS_PER_BATCH, next: 0, hunter: hunter, found: 0, force: force, condition: cond };
    game.force = null;
    M().say(state, game, "The weather: " + PC.weather.badge(cond) + ".");
    if (cond === "Storm") stormBatch(state, game);
    // A vacant Quartermaster's post is filled at the next voyage event
    // (§25.9): in the prototype, the next action at sea (DEFAULT). An older
    // save with the post empty is caught here too.
    PC.officers.ensureQuartermaster(state);
    if (PC.officers.votePending(state)) {
      game.vote = { step: "pre", candidates: PC.officers.voteScores(state, null).map(function (x) { return { id: x.id, name: x.name }; }) };
      game.phase = "vote";
      M().say(state, game, L().votePre || "The crew want a Quartermaster of their own choosing. They'll vote before the day is out.");
      return;
    }
    reveal(state, game);
  }

  // A Storm batch (§42.4): a Ride Out Storm check (DR 2) before its rolls.
  // Clean, no loss; partial -5% hull; setback -10% hull and -5 morale.
  function stormCheck(state) {
    var extra = [];
    var nav = (state.officers || []).some(function (o) { return !o.gone && o.type === "Navigator" && (o.aboard || "flagship") === "flagship" && (o.level || 1) >= 2; });
    if (nav) extra.push({ label: "Navigator", value: 1 });
    var salt = (state.officers || []).some(function (o) { return !o.gone && (o.voice === "Old Salt" || o.secondary === "Old Salt"); });
    if (salt) extra.push({ label: "Old Salt aboard", value: 1 }); // crew checks in storms, don't stack (§42.9)
    return { type: "Ride Out Storm", dr: PC.data.weather.STORM_BATCH_DR, extra: extra };
  }
  function stormBatch(state, game) {
    var r = PC.checks.resolve(state, stormCheck(state), M().key(state, game, "storm-batch"), { conditions: ["Storm"] });
    var sh = state.ship, lost = 0, morale = 0;
    if (r.outcome === "partial") lost = Math.max(1, Math.round(sh.hullMax * 0.05));
    if (r.outcome === "setback") { lost = Math.max(1, Math.round(sh.hullMax * 0.10)); morale = 5; }
    if (lost) sh.hull = Math.max(1, sh.hull - lost);
    if (morale) PC.crew.addMorale(state, -morale);
    M().say(state, game, PC.data.weather.lines.stormBatch[r.outcome]);
    M().noteRoll(game, { label: "Ride Out Storm", outcome: r.outcome, effect: lost ? "hull −" + lost + (morale ? ", morale −" + morale : "") : "no damage" });
    return r.outcome;
  }

  // Read Weather before a batch (§42.6): optional, 0 AP, once a batch.
  // Clean: see the next batch's condition, and reroll it once if Storm.
  // Partial: see it. Setback: nothing.
  function canReadAhead(state, game) { return game.phase === "batchEnd" && !game.readAhead && state.ap.left >= 1 && game.apUsed < H().MAX_AP; }
  function readAhead(state, game) {
    if (!canReadAhead(state, game)) throw new Error("Not the moment for that.");
    var r = PC.checks.resolve(state, PC.weather.readCheck(state, game.waters), M().key(state, game, "read-ahead"), { conditions: [] });
    var c = PC.weather.rollCondition(state, game.waters, M().key(state, game, "condition"));
    var rerolled = false;
    if (r.outcome === "clean" && c === "Storm") { c = PC.weather.rollCondition(state, game.waters, M().key(state, game, "condition-reroll")); rerolled = true; }
    game.nextCondition = c;
    game.readAhead = { outcome: r.outcome, seen: r.outcome !== "setback" ? c : null, rerolled: rerolled };
    M().noteRoll(game, { label: "Read Weather", outcome: r.outcome, effect: r.outcome === "setback" ? "the sky tells you nothing" : "the next batch: " + PC.weather.badge(c) + (rerolled ? " (the storm passes by)" : "") });
    M().say(state, game, r.outcome === "setback" ? "PLACEHOLDER: You study the sky, but it tells you nothing." : "PLACEHOLDER: You study the sky. Next: " + PC.weather.badge(c) + ".");
    return game.readAhead;
  }

  // ---- The Vote (§25.9, the template §25.15) ------------------------------------
  // The pre-vote beat: speak for a candidate (Order), or stay out of it.
  function vote(state, game, speakFor) {
    if (game.phase !== "vote" || !game.vote || game.vote.step !== "pre") throw new Error("Not the moment for that.");
    var r = PC.officers.runVote(state, speakFor || null, M().key(state, game, "vote"));
    game.vote.step = "result";
    game.vote.winner = { id: r.winner.id, name: (r.winner.first + " " + (r.winner.last || "")).trim() };
    game.vote.scores = r.scores;
    game.vote.spokeFor = speakFor || null;
    M().say(state, game, (L().voteResult || "The crew gathers to elect a new Quartermaster. After deliberating for some time, they select [Officer] to represent their interests.").replace("[Officer]", game.vote.winner.name));
    return r;
  }

  // The captain's reaction (§25.15): Congratulate (Honor), keep silent
  // (Caution), sulk (Retreat), or loudly disagree (Defiance). The tags are
  // recorded for the officers' approval; then the hunt goes on.
  var VOTE_REACT = { congratulate: ["Congratulate the winner", "Honor"], silent: ["Observe and keep silent", "Caution"], sulk: ["Sulk in your cabin", "Retreat"], disagree: ["Loudly disagree with the crew's decision", "Defiance"] };
  function voteReact(state, game, choice) {
    if (game.phase !== "vote" || !game.vote || game.vote.step !== "result") throw new Error("Not the moment for that.");
    var c = VOTE_REACT[choice] || VOTE_REACT.silent;
    var w = game.vote.winner.name;
    M().say(state, game, { congratulate: "PLACEHOLDER: You congratulate " + w + ". The crew made the right choice.", silent: "PLACEHOLDER: You watch, and keep your own counsel.",
      sulk: "PLACEHOLDER: You retire to your cabin and sulk.", disagree: "PLACEHOLDER: You tell the crew, loudly, that they got it wrong." }[choice] || "");
    game.lastApproval = { label: c[0], approval: [c[1]], at: game.log.length };
    game.vote = null;
    reveal(state, game);
  }

  // The next roll of the batch: a ship, or an empty horizon. At least one
  // roll in every batch finds a ship.
  function reveal(state, game) {
    if (game.encounter) { // a ship met on a voyage (§44.4): one sighting, then the voyage runs on
      game.phase = "encounterEnd"; game.over = true; game.sighting = null;
      M().say(state, game, "PLACEHOLDER: You put her astern and carry on with your voyage.");
      return;
    }
    var b = game.batch, r = M().rand(state, game, "sighting");
    if (b.next >= b.n) { game.phase = "batchEnd"; game.sighting = null; return; }
    var i = b.next; b.next += 1;
    var grp = null;
    if (i === 0 && b.hunter) grp = G().sighting(state, game.waters, r, { kind: "hunter", flag: b.hunter });
    else if (b.force && i === 0) grp = G().sighting(state, game.waters, r, b.force);
    else if (r() < G().density(state, b.condition) || (i === b.n - 1 && !b.found)) grp = G().sighting(state, game.waters, r);
    if (grp) {
      b.found += 1; game.sighting = grp; game.phase = grp.hunter ? "hunter" : "scout";
      // A navy ship at Heat 50+, or a pirate at black -70, may attack first (§28.1, §28.4).
      var first = PC.meters.attacksFirst(state, grp, r);
      if (first) { game.phase = "hunter"; game.attackFirst = first; M().say(state, game, PC.data.meterRules.lines[first === "navy" ? "navyAttacks" : "pirateAttacks"]); }
      else M().say(state, game, grp.hunter ? L().hunter : L().sail);
    }
    else { game.sighting = null; game.phase = "empty"; M().say(state, game, L().empty[Math.floor(r() * L().empty.length)]); }
  }

  function next(state, game) {
    if (game.phase !== "empty" && game.phase !== "scout") throw new Error("Not the moment for that.");
    if (game.phase === "scout") M().say(state, game, "PLACEHOLDER: You let her pass.");
    reveal(state, game);
  }

  // ---- Engaging ---------------------------------------------------------------

  function engage(state, game) {
    if (game.phase !== "scout") throw new Error("Not the moment for that.");
    game.phase = "battle";
    C().begin(state, game, game.sighting, "engage");
    checkBattleOver(state, game);
  }

  // Every battle move goes through here, so the hunt notices when the
  // battle ends (struck, fled, taken).
  function battle(state, game, fn) {
    if (game.phase !== "battle") throw new Error("Not the moment for that.");
    var args = [state, game].concat(Array.prototype.slice.call(arguments, 3));
    var r = C()[fn].apply(null, args);
    checkBattleOver(state, game);
    return r;
  }

  function meetHunter(state, game) {
    if (game.phase !== "hunter") throw new Error("Not the moment for that.");
    game.phase = "battle";
    C().begin(state, game, game.sighting, "hunter");
  }

  // ---- The engine hooks ----------------------------------------------------------

  function settle(state, game, p) {
    if (p.op === "repair") return settleRepair(state, game, p);
    var r = C().settle(state, game, p);
    checkBattleOver(state, game);
    return r;
  }

  // Called after every battle action: has the battle ended?
  function checkBattleOver(state, game) {
    var b = game.battle;
    if (!b || game.phase !== "battle" || b.step !== "over") return;
    if (game.gameOver) { game.phase = "gameover"; game.over = true; return; }
    afterBattle(state, game);
  }

  // ---- After the battle (§21.15, §22.7) -------------------------------------------

  // The after-battle chips (A10 of the M5 playtest): chips with a merge key
  // (k) and an amount (n) are totalled across every ship taken, one line
  // per good or effect; tpl spells the line ({+n} signed, {n} plain;
  // tpl1 when n is 1).
  function mchip(icon, k, n, tpl, ink, tpl1) { return { icon: icon, k: k, n: n, tpl: tpl, tpl1: tpl1 || null, ink: ink || null, text: chipText({ n: n, tpl: tpl, tpl1: tpl1 }) }; }
  function chipText(c) {
    var t = c.n === 1 && c.tpl1 ? c.tpl1 : c.tpl;
    return t.replace("{+n}", (c.n > 0 ? "+" : c.n < 0 ? "−" : "±") + Math.abs(c.n)).replace("{n}", Math.abs(c.n));
  }
  function mergeChips(list) {
    var out = [], byKey = {};
    (list || []).forEach(function (c) {
      if (!c.k) { out.push(c); return; }
      var m = byKey[c.k];
      if (!m) { m = byKey[c.k] = Object.assign({}, c); out.push(m); return; }
      m.n += c.n;
    });
    return out.filter(function (c) { return !c.k || c.n; }).map(function (c) {
      if (!c.k) return c;
      var x = Object.assign({}, c, { text: chipText(c) });
      if (c.k === "morale") x.ink = c.n > 0 ? "good" : "bad";
      return x;
    });
  }

  function afterBattle(state, game) {
    var b = game.battle, chips = [], battleChips = [];
    // Hull points are whole numbers outside a battle (a part-point of
    // damage counts as a whole one).
    state.ship.hull = Math.max(0, Math.floor(state.ship.hull + 1e-9));
    fleet(state).forEach(function (f) { f.hull = Math.max(0, Math.floor(f.hull + 1e-9)); });
    var fought = b.round > 0;
    // Morale: −1 for every 2% of the crew killed (§24.2).
    var killed = b.killed.flagship || 0;
    var start = b.startCrew.flagship || 1;
    var mloss = Math.floor(100 * killed / start / 2);
    if (mloss) { PC.crew.addMorale(state, -mloss); battleChips.push({ icon: "morale", text: "Morale −" + mloss + " for the dead", ink: "bad" }); chips.push(mchip("morale", "morale", -mloss, "Crew morale {+n}")); }
    if (killed) battleChips.push({ icon: "cond", text: plural(killed, "hand") + " killed", ink: "bad" });
    var w = Object.keys(b.woundedTiers).reduce(function (a, k) { return a + b.woundedTiers[k]; }, 0);
    if (w) battleChips.push({ icon: "cond", text: plural(w, "hand") + " wounded (aboard until the next port)" });
    // Track the wounded by tier for the arrival (§24.9).
    var wt = (state.crew.woundedTiers = state.crew.woundedTiers || {});
    Object.keys(b.woundedTiers).forEach(function (k) { wt[k] = (wt[k] || 0) + b.woundedTiers[k]; });
    var captured = b.captured.map(function (id) { return b.enemies.filter(function (e) { return e.id === id; })[0]; });
    // Seasoning after a won battle (§24.3): not when she struck before any fighting.
    if (fought && captured.length) {
      var sr = M().rand(state, game, "season");
      var up = 0;
      [["Seasoned", "Veteran", 0.10], ["Able", "Seasoned", 0.20], ["Green", "Able", 0.25]].forEach(function (x) {
        var n = 0; for (var i = 0; i < (state.crew.tiers[x[0]] || 0); i++) if (sr() < x[2]) n++;
        if (n) { state.crew.tiers[x[0]] -= n; state.crew.tiers[x[1]] = (state.crew.tiers[x[1]] || 0) + n; up += n; }
      });
      if (up) battleChips.push({ icon: "morale", text: plural(up, "hand") + " seasoned a step", ink: "good" });
    }
    // Records: Prize Taker at 5 captures, Duelist at 3 duels won (§14.4).
    var rec = (state.records = state.records || { prizes: 0, duels: 0 });
    rec.duels += game.duelsWon || 0; game.duelsWon = 0;
    rec.prizes += captured.length;
    if (rec.prizes >= H().PRIZE_TAKER_AT && state.captain.tags.indexOf("Prize Taker") < 0) { state.captain.tags.push("Prize Taker"); chips.push({ icon: "tag", text: "New tag: Prize Taker", ink: "oxblood" }); }
    if (rec.duels >= H().DUELIST_AT && state.captain.tags.indexOf("Duelist") < 0) { state.captain.tags.push("Duelist"); chips.push({ icon: "tag", text: "New tag: Duelist", ink: "oxblood" }); }
    if (b.over === "fled") { battleChips.push({ icon: "morale", text: "Morale −15 for running", ink: "bad" }); chips.push(mchip("morale", "morale", H().FLEE_MORALE, "Crew morale {+n}")); }
    var hpLost = Math.max(0, b.startHull.flagship - state.ship.hull);
    // battleChips show once, on the first screen after the battle; chips
    // add up into the summary (A10).
    game.after = { chips: chips, battleChips: battleChips, battleSeen: false, queue: captured.map(function (e) { return e.id; }), current: null, repairDone: hpLost <= 0, treatDone: false, hpLost: hpLost, taken: [] };
    game.phase = "after";
    // Fleet ships lost in the fight leave the fleet.
    state.fleet = fleet(state).filter(function (f) { return !f.out; });
  }

  // Repair & Refit after the battle (§21.15): a Carpenter aboard gives +1.
  function repairCheck(state) {
    var carp = (state.officers || []).some(function (o) { return !o.gone && (o.aboard || "flagship") === "flagship" && o.type === "Carpenter"; });
    return { type: "Repair & Refit", dr: 2, extra: carp ? [{ label: "Carpenter", value: 1 }] : [] };
  }

  function doRepair(state, game) {
    var a = game.after;
    if (!a || a.repairDone) throw new Error("Not the moment for that.");
    if (a.hpLost <= 0) { a.repairDone = true; return null; }
    return M().roll(state, game, repairCheck(state), "repair", {}, []);
  }

  function settleRepair(state, game, p) {
    var a = game.after;
    a.repairDone = true;
    var share = H().REPAIR_AT_SEA[p.outcome] || 0;
    var hp = share ? Math.max(1, Math.round(a.hpLost * share)) : 0;
    if (hp) state.ship.hull = Math.min(state.ship.hullMax, state.ship.hull + hp);
    M().say(state, game, L().repair[p.outcome] + (hp ? " (+" + hp + " hull)" : ""));
    var chip = { icon: "hull", text: hp ? "Repaired at sea: hull +" + hp : "No repairs at sea", ink: hp ? "good" : null };
    a.battleSeen = true;
    // Shown once, in the roll's result box (G4); not in the summary (A10).
    if (game.lastRoll) game.lastRoll.chips = [chip];
  }

  // Treat Wounds (§21.15): a Cook aboard rolls on a Wounded captain. Clean
  // clears it; partial eases it until port (DEFAULT: it stays, no edge).
  // DEFAULT: the Cook rolls at edge +1 (a level 1 officer's reading).
  function treat(state, game) {
    var a = game.after;
    a.treatDone = true;
    if ((state.captain.tags || []).indexOf("Wounded") < 0) return;
    var cook = (state.officers || []).some(function (o) { return !o.gone && (o.aboard || "flagship") === "flagship" && o.type === "Cook"; });
    if (!cook) return;
    var dice = PC.rng.roll2d6(M().key(state, game, "treat"));
    var out = PC.checks.readTotal(dice[0] + dice[1] + 1 - 2);
    M().say(state, game, L().treat[out]);
    if (out === "clean") { PC.scenes.applyEffect(state, { tag: "Wounded", remove: true }); a.chips.push({ icon: "cond", text: "Wounded: treated" }); }
  }

  // The next captured ship to settle, with her loot rolled.
  function currentPrize(state, game) {
    var a = game.after;
    if (!a) return null;
    if (!a.current && a.queue.length) {
      var id = a.queue.shift();
      var e = game.battle.enemies.filter(function (x) { return x.id === id; })[0];
      var loot = G().rollLoot(state, e, M().rand(state, game, "loot"));
      // Porcelain broke on her heavy hits (§21.11).
      if (loot.goods["Ming porcelain"]) loot.goods["Ming porcelain"] = Math.round(loot.goods["Ming porcelain"] * Math.pow(1 - H().PORCELAIN_BREAK, e.heavyHits || 0));
      var vr = M().rand(state, game, "volunteers");
      var src = e.flag === "Pirate" ? "Pirate" : e.role;
      var V = H().VOLUNTEERS[src];
      var vol = 0;
      if (V && !e.hunter) {
        vol = 1 + Math.floor(vr() * V[0]);
        var band = PC.crew.band(state.crew.morale);
        if (band === "Eager" || band === "Devoted") vol += 1;
        if (C().dreadBonus(state) >= 2) vol += 1;
        vol = Math.min(vol, e.crew);
      }
      a.current = { id: id, loot: loot, volunteers: vol, volTier: V ? V[1] : "Green" };
    }
    return a.current;
  }

  function capturedShip(game, id) { return game.battle.enemies.filter(function (x) { return x.id === id; })[0]; }

  // What may be done with her hull now (§22.7).
  function hullOptions(state, game) {
    var cur = currentPrize(state, game);
    if (!cur) return [];
    var e = capturedShip(game, cur.id);
    var prizes = fleet(state).filter(function (f) { return f.kind === "prize"; }).length;
    var fleets = fleet(state).filter(function (f) { return f.kind === "fleet"; }).length;
    var spare = state.crew.count - (state.ship.crewMin || 5);
    var freeOfficers = (state.officers || []).filter(function (o) { return !o.gone && (o.aboard || "flagship") === "flagship" && !o.mentor; });
    var out = [];
    var lockPrize = e.hull <= 0 ? "She's sinking" : prizes >= H().PRIZE_SHIP_CAP ? "At most " + H().PRIZE_SHIP_CAP + " prize ships" : spare < e.crewMin ? "Not enough hands for a prize crew (" + e.crewMin + ")" : null;
    out.push({ id: "prize", label: "Keep her as a prize ship", note: "Moves " + e.crewMin + " hands across. She never fights, but her hold joins yours and her Speed (" + e.speed + ") counts for the fleet.", lock: lockPrize });
    var cap = fleetCap(state);
    var lockFleet = e.hull <= 0 ? "She's sinking" : fleets >= cap ? "Your fleet is at its cap (" + cap + " ship" + (cap === 1 ? "" : "s") + ")" : !freeOfficers.length ? "Needs an officer to captain her" : spare < e.crewMin ? "Not enough hands (" + e.crewMin + ")" : null;
    out.push({ id: "fleet", label: "Make her a fleet ship", note: "An officer captains her and she fights beside you.", lock: lockFleet, officers: freeOfficers.map(function (o) { return { id: o.id, name: o.first + " " + (o.last || ""), type: o.type }; }) });
    var lockFlag = e.hull <= 0 ? "She's sinking" : state.crew.count < e.crewMin + (state.ship.crewMin || 5) ? "Not enough hands to crew both" : null;
    out.push({ id: "flagship", label: "Make her your new flagship", note: "Your " + state.ship.type + " becomes a prize ship.", lock: lockFlag });
    out.push({ id: "release", label: "Take what you can and let her go", note: "Her surviving crew sail her home." });
    out.push({ id: "scuttle", label: "Scuttle her", note: "Denies her to her owners. No value." });
    return out;
  }

  // The fleet cap (§21.9): base +1 support ship; Seasoned I and II +1 each.
  function fleetCap(state) {
    var t = state.captain.tags || [];
    return 1 + (t.indexOf("Seasoned I") >= 0 ? 1 : 0) + (t.indexOf("Seasoned II") >= 0 ? 1 : 0);
  }

  // The Quarter Article (§26.3): which crews may be executed.
  function canExecute(state, e) {
    var q = state.articles ? state.articles.terms.quarter : "quarter_asked";
    if (q === "no_quarter") return { ok: true, legal: true };
    if (q === "quarter_given") return { ok: true, legal: false, why: "Your Articles give quarter: this breaks them" };
    // Quarter Asked: only crews who refused a demanded surrender (§22.7).
    return e.refusedDemand ? { ok: true, legal: true } : { ok: true, legal: false, why: "She didn't refuse a demanded surrender: this breaks your Articles" };
  }

  // Settle one captured ship. ch: { hull, officer?, crew: release|recruit|
  // execute, captives: free|recruit|leave }.
  function settlePrize(state, game, ch) {
    var cur = currentPrize(state, game);
    if (!cur) throw new Error("No prize to settle.");
    var e = capturedShip(game, cur.id), loot = cur.loot, chips = [];
    var opt = hullOptions(state, game).filter(function (o) { return o.id === ch.hull; })[0];
    if (!opt) throw new Error("Choose what to do with her.");
    if (opt.lock) throw new Error(opt.lock);
    var name = e.name ? "the " + e.name : "the " + e.cls;
    // Her crew (§22.7).
    var crewChoice = ch.crew || "release";
    if (crewChoice === "execute") {
      var ex = canExecute(state, e);
      state.flags.executedCrew = PC.state.stamp(state); // a Fear of Violence & Death trigger (§25.15)
      PC.scenes.applyEffect(state, { dread: H().EXECUTE_DREAD });
      PC.scenes.applyEffect(state, { standing: { faction: "pirates", delta: 1 } });
      chips.push(mchip("dread", "dread", H().EXECUTE_DREAD, "Dread {+n}", "bad"));
      chips.push(mchip("standing", "standing:pirates", 1, "Pirates Standing {+n}", "pirates"));
      if (!ex.legal) { PC.crew.addMorale(state, -20); state.crew.pressure = (state.crew.pressure || 0) + 2; chips.push(mchip("morale", "morale", -20, "Crew morale {+n}")); chips.push(mchip("pressure", "pressure", 2, "Pressure {+n}: you broke the Articles", "bad")); }
      M().say(state, game, "PLACEHOLDER: Her crew go over the side. Nobody will report this one.");
    } else if (crewChoice === "recruit" && cur.volunteers) {
      var room = PC.crew.berths(state);
      var n = Math.min(cur.volunteers, room);
      if (n) { PC.crew.addHands(state, cur.volTier, n); chips.push(mchip("officer", "vol:" + cur.volTier, n, "{n} " + cur.volTier + " volunteers sign on", "good", "1 " + cur.volTier + " volunteer signs on")); }
      else chips.push({ icon: "cond", text: "No berths for her volunteers" });
    }
    // Standing and Heat (§28.3, §28.6): no letter, so every prize but a
    // pirate is uncovered. An executed crew costs no Heat.
    meterChips(state, e, crewChoice === "execute").forEach(function (c) { chips.push(c); });
    // The hull.
    var shipRec = null;
    if (ch.hull === "prize" || ch.hull === "fleet") {
      shipRec = toFleet(state, e, ch.hull, ch.officer);
      chips.push({ icon: "ship", text: (ch.hull === "prize" ? "Prize ship: " : "Fleet ship: ") + (e.name || e.cls) });
    } else if (ch.hull === "flagship") {
      swapFlagship(state, e);
      chips.push({ icon: "ship", text: "New flagship: " + e.cls + (e.name ? " " + e.name : "") });
    } else if (ch.hull === "scuttle") chips.push({ icon: "ship", text: "Scuttled" });
    // The ship's chest (§22.6): coin, always clean, by the Chest Article.
    var pot = state.articles && state.articles.terms.chest === "captains_chest" ? "purse" : "crew";
    state.money[pot] += loot.chest;
    if (loot.chest) chips.push(mchip("gold", "chest:" + pot, loot.chest, "Ship's chest: {n} gold to " + (pot === "purse" ? "your purse" : "crew gold"), "mid"));
    // Her cargo into the pooled hold: what the player picked (A7), or the
    // densest first when nothing was picked (the sim, §22.7).
    var dirty = e.flag !== "Pirate";
    var taken = ch.cargo ? loadPicked(state, loot, dirty, ch.cargo) : loadCargo(state, loot, dirty);
    // Goods leave the chip list (they were picked on the screen); provisions stay (A10).
    taken.forEach(function (t) { if (t.prov) chips.push(mchip("prov", "prov", t.prov, "+{n} provisions")); });
    game.after.taken = (game.after.taken || []).concat(taken.filter(function (t) { return !t.prov && t.n; }));
    if (loot.item) { state.captain.items.push(loot.item); chips.push({ icon: "item", text: "Found aboard: " + loot.item, ink: "oxblood" }); }
    // Captives (§22.7).
    if (loot.captives) {
      var cc = ch.captives || "free";
      if (cc === "free") { state.captives = (state.captives || 0) + loot.captives; chips.push(mchip("dgood", "captives", loot.captives, "{n} captives aboard, to be freed at a free port", null, "1 captive aboard, to be freed at a free port")); }
      else if (cc === "recruit") {
        var k = Math.min(Math.ceil(loot.captives / 2), PC.crew.berths(state));
        if (k) PC.crew.addHands(state, "Green", k);
        state.captives = (state.captives || 0) + (loot.captives - k);
        chips.push({ icon: "morale", text: plural(k, "freed captive") + " join as Green hands" + (loot.captives - k ? "; the rest stay aboard until a free port" : "") });
      } else chips.push({ icon: "cond", text: "The captives stay with her" });
    }
    // Morale for a prize: +5, or +10 at Rich or Superior; at most +10 a hunt.
    var gain = Math.min(loot.level >= 3 ? H().PRIZE_MORALE.big : H().PRIZE_MORALE.small, H().PRIZE_MORALE.cap - game.prizeMorale);
    if (gain > 0 && !e.hunter) { game.prizeMorale += gain; PC.crew.addMorale(state, gain); chips.push(mchip("morale", "morale", gain, "Crew morale {+n}")); }
    game.prizesTaken += 1;
    PC.state.addLog(state, "Took " + name + " (" + e.flag + " " + e.cls + ").");
    game.after.chips = game.after.chips.concat(chips);
    game.after.battleSeen = true;
    game.after.names = (game.after.names || []).concat([name]);
    game.after.lastPrize = { name: name, chips: chips };
    game.after.current = null;
    return chips;
  }

  function meterChips(state, e, executed) {
    var out = [];
    if (e.hunter) {
      var hf = e.flag === "Avalon" ? "avalon" : e.flag === "Frisia" ? "frisia" : null;
      if (hf && !executed) { PC.scenes.applyEffect(state, { heat: { faction: hf, delta: H().HUNTER_TAKEN_HEAT } }); out.push(mchip("heat", "heat:" + hf, H().HUNTER_TAKEN_HEAT, e.flag + " Heat {+n}", hf)); }
    } else {
      ["Avalon", "Frisia"].forEach(function (fac) {
        var side = H().SIDES[fac][e.flag];
        if (!side) return;
        var kind = e.role === "War" ? "navy" : "merchant";
        var d = H().UNCOVERED[side + " " + kind], key = fac.toLowerCase();
        PC.scenes.applyEffect(state, { standing: { faction: key, delta: d[1] } });
        out.push(mchip("standing", "standing:" + key, d[1], fac + " Standing {+n}", key));
        if (!executed) { PC.scenes.applyEffect(state, { heat: { faction: key, delta: d[0] } }); out.push(mchip("heat", "heat:" + key, d[0], fac + " Heat {+n}", key)); }
      });
    }
    // France and Sicily keep grudge counters (§22.5); Spain feeds France's.
    var g = G().grudge(state);
    if (e.flag === "Sicily") g.Sicily += H().GRUDGE.Sicily.per;
    if (e.flag === "France") g.France += H().GRUDGE.France.per;
    if (e.flag === "Spain") g.France += H().GRUDGE.France.spain;
    return out;
  }

  // ---- The hold, pooled across every ship (§22.7) -------------------------------

  // Load what fits: treasure first (5 to a slot), then precious, fine and
  // bulk goods, then provisions. The rest stays in her hold.
  function loadCargo(state, loot, dirty) {
    var pick = { treasure: loot.treasure, goods: {}, provisions: loot.provisions };
    Object.keys(loot.goods).forEach(function (g) { pick.goods[g] = loot.goods[g]; });
    return loadPicked(state, loot, dirty, pick);
  }

  // Load what the player picked on the prize screen (A7), within what she
  // carries and what fits: treasure, then goods densest first, then
  // provisions. Returns [{ what, n, dirty, left, icon, text }].
  function loadPicked(state, loot, dirty, pick) {
    var out = [];
    var k = dirty ? "dirty" : "clean";
    var want = Math.max(0, Math.min(loot.treasure || 0, Math.floor(pick.treasure || 0)));
    var t = Math.min(want, PC.crew.treasureRoom(state));
    if (t > 0) state.cargo.treasure[k] += t;
    if (loot.treasure) out.push({ what: "treasure", n: t, dirty: dirty, left: loot.treasure - t, icon: "treasure", text: t + " " + (dirty ? "dirty " : "") + "treasure" + (t < loot.treasure ? " (" + (loot.treasure - t) + " left behind)" : "") });
    var goods = Object.keys(loot.goods).sort(function (a, b) { return PC.data.goods[b].base - PC.data.goods[a].base; });
    goods.forEach(function (g) {
      var w = Math.max(0, Math.min(loot.goods[g], Math.floor((pick.goods || {})[g] || 0)));
      var n = Math.min(w, PC.crew.slotsFree(state));
      if (n > 0) PC.crew.addGood(state, g, n, dirty);
      out.push({ what: g, n: n, dirty: dirty, left: loot.goods[g] - n, icon: "treasure", text: n + " " + (dirty ? "dirty " : "") + g + (n < loot.goods[g] ? " (" + (loot.goods[g] - n) + " left behind)" : "") });
    });
    var p = Math.min(loot.provisions || 0, Math.max(0, Math.floor(pick.provisions || 0)), PC.crew.slotsFree(state));
    if (p > 0) { state.provisions += p; out.push({ what: "provisions", prov: p, n: p, icon: "prov", text: "+" + p + " provisions" }); }
    return out;
  }

  // A captured hull joins as a prize or fleet ship (§21.8). Her minimum
  // crew moves across from the flagship, the greenest hands first (DEFAULT).
  function takeHands(state, n) {
    var moved = {};
    PC.data.economy.TIER_ORDER.forEach(function (t) {
      var k = Math.min(n, state.crew.tiers[t] || 0);
      if (k) { PC.crew.removeHands(state, t, k); moved[t] = k; n -= k; }
    });
    return moved;
  }

  function toFleet(state, e, kind, officerId) {
    var tiers = takeHands(state, e.crewMin);
    var rec = { id: e.id, kind: kind, cls: e.cls, name: e.name, flag: e.flag, role: e.role, size: e.size, hull: Math.max(1, e.hull), hullMax: e.hullMax,
      guns: e.guns, gunsMax: e.gunsMax, crew: e.crewMin, crewMin: e.crewMin, crewMax: e.crewMax, cargo: e.cargo, speed: e.speed,
      handling: e.handling, rating: 3, dirty: e.flag !== "Pirate", crewTiers: tiers, wounded: 0 };
    if (kind === "fleet") {
      var o = (state.officers || []).filter(function (x) { return x.id === officerId && !x.gone; })[0]
        || (state.officers || []).filter(function (x) { return !x.gone && (x.aboard || "flagship") === "flagship" && !x.mentor; })[0];
      if (!o) throw new Error("Needs an officer to captain her.");
      o.aboard = rec.id;
      rec.officer = o.id;
      // A fleet command vacates the Quartermaster's post (§25.9): the
      // Acting Quartermaster holds the seat until the next vote (A4).
      if (o.quartermaster) { o.quartermaster = false; PC.officers.vacate(state); }
      else PC.officers.ensureQuartermaster(state);
    }
    fleet(state).push(rec);
    return rec;
  }

  // Make a captured ship the flagship (0 AP, §22.7). The old flagship
  // becomes a prize ship with her minimum crew aboard.
  function swapFlagship(state, e) {
    var old = state.ship, oc = H().CLASSES[old.type] || {};
    var oldRec = { id: "old-" + (state.world.shipSeq = (state.world.shipSeq || 0) + 1), kind: "prize", cls: old.type, name: old.name, flag: "Pirate", role: oc.role || "Raider",
      size: old.size, hull: old.hull, hullMax: old.hullMax, guns: old.guns, gunsMax: old.gunsMax, crew: old.crewMin, crewMin: old.crewMin,
      crewMax: old.crewMax, cargo: old.cargo, speed: old.speed, handling: oc.handling, dirty: false, mine: true, crewTiers: takeHands(state, old.crewMin), wounded: 0, upgrades: old.upgrades };
    fleet(state).push(oldRec);
    var c = H().CLASSES[e.cls];
    state.ship = {
      name: e.name || e.cls, type: e.cls, hull: Math.max(1, Math.round(e.hull)), hullMax: c.hull, baseHull: c.hull, guns: e.guns, gunsMax: c.guns,
      cargo: c.cargo, size: c.size, crewMin: c.crewMin, crewMax: c.crewMax, speed: c.speed, speedMax: c.speed, handling: c.handling,
      rigging: "sound", upgrades: { hull: 1, rigging: 1, guns: 1 }, dirty: e.flag !== "Pirate", prizeOf: e.flag,
    };
  }

  // ---- Ending the hunt -----------------------------------------------------------

  function canContinue(state, game) {
    if (game.phase === "after" && (currentPrize(state, game) || !game.after.repairDone)) return { ok: false, why: "Settle the prize first" };
    if (game.batch && game.batch.next < game.batch.n) return { ok: true, more: true };
    if (state.ap.left < 1) return { ok: false, why: "No actions left this season" };
    if (game.apUsed >= H().MAX_AP) return { ok: false, why: "A hunt is at most three actions" };
    return { ok: true };
  }

  // Done with the battle and its prizes: on to the batch's next roll.
  function carryOn(state, game) {
    if (game.phase !== "after") throw new Error("Not the moment for that.");
    if (!game.after.repairDone) throw new Error("Make your repairs first.");
    if (currentPrize(state, game)) throw new Error("Settle the prize first.");
    if (!game.after.treatDone) treat(state, game);
    game.battle = null; game.after = null; game.sighting = null;
    reveal(state, game);
  }

  function anotherBatch(state, game) {
    if (game.phase !== "batchEnd") throw new Error("Not the moment for that.");
    newBatch(state, game);
  }

  // Sail home (§22.1): the return is an arrival. Unrolled sightings can be
  // given up to end early.
  function sailHome(state, game) {
    if (["batchEnd", "empty", "scout"].indexOf(game.phase) < 0) throw new Error("Not the moment for that.");
    // Fleet ships' wounded come home with the rest (DEFAULT: they join the
    // flagship's wounded for the arrival).
    fleet(state).forEach(function (f) { if (f.wounded) { state.crew.wounded += f.wounded; state.crew.woundedTiers = state.crew.woundedTiers || {}; state.crew.woundedTiers.Green = (state.crew.woundedTiers.Green || 0) + f.wounded; f.wounded = 0; } });
    // Ocracoke's own line; elsewhere the port's return line (§17.4.9).
    var hn = PC.node.nodeData(game.home);
    M().say(state, game, game.home === "ocracoke" ? L().home : hn.kind === "ocean" ? "PLACEHOLDER: You call off the hunt and heave to on the open sea." : (hn.lines.arrival || {}).back || L().home);
    game.phase = "home"; game.over = true;
    PC.state.addLog(state, "Back at " + PC.node.nodeData(game.home).name + " from the hunt: " + plural(game.prizesTaken, "prize") + " taken.");
  }

  // The hunt ends: home to the port it left from (an arrival: the popup and
  // the port fee), back on the open sea at an ocean node, or sailing on to
  // another place from the hunting grounds (§4, §22.1).
  function exit(state, game) {
    if (game.phase === "gameover") { state.gameOver = game.gameOver; if (game.encounter) state.voyage = null; return "node"; }
    if (game.encounter) { // back to the voyage it interrupted (§44.4)
      state.minigame = null;
      PC.voyageEvents.resume(state);
      return null;
    }
    if (game.sailOn) {
      var from = OCEAN_OF[game.waters] || "hatteras";
      state.minigame = null;
      PC.world.sail(state, game.sailOn, { from: from });
      return null; // the voyage has set the screen
    }
    if (PC.node.isOcean(game.home)) {
      state.location.popup = { title: PC.node.nodeData(game.home).title, lines: [], chips: [{ icon: "port", text: "PLACEHOLDER: The hunt is over. You're still out on " + PC.node.nodeData(game.home).name + "." }] };
      return "node";
    }
    // The leg back (§44.2): one event slot before the arrival.
    var leg = PC.voyageEvents ? PC.voyageEvents.huntLeg(state, game, "back") : null;
    if (leg && leg.pending) return null; // afterLeg() arrives when it's done
    PC.node.arrive(state, game.home, { fromHunt: true, voyage: leg && leg.lines.length ? { lines: leg.lines, chips: [] } : undefined });
    return "node";
  }
  var OCEAN_OF = { north: "hatteras", south: "bahama" };

  // Sail on from the hunting grounds instead of going home (§22.1): the
  // voyage starts at the waters' ocean node (assumption, flagged).
  function sailOnOptions(state, game) {
    var from = OCEAN_OF[game.waters] || "hatteras";
    return PC.data.world.live.filter(function (id) { return id !== game.home && id !== from; }).map(function (id) {
      var cost = PC.world.apCost(from, id);
      return { id: id, name: PC.world.placeName(id), cost: cost, ok: state.ap.left >= cost, why: state.ap.left >= cost ? null : "Needs " + plural(cost, "action") };
    });
  }
  function sailOn(state, game, dest) {
    if (["batchEnd", "empty", "scout"].indexOf(game.phase) < 0) throw new Error("Not the moment for that.");
    var o = sailOnOptions(state, game).filter(function (x) { return x.id === dest; })[0];
    if (!o || !o.ok) throw new Error(o ? o.why : "You can't sail there.");
    sailHome(state, game);
    game.sailOn = dest;
  }

  // ---- The view ----------------------------------------------------------------------

  function scoutView(state, game) {
    var g = game.sighting;
    if (!g) return null;
    var fs = C().fleetSpeed(state, null);
    var me = 0; ["flagship"].concat(fleet(state).filter(function (f) { return f.kind === "fleet"; }).map(function (f) { return f.id; }))
      .forEach(function (id) { me += C().br(C().ship(state, null, id)); });
    var them = g.ships.reduce(function (a, s) { return a + C().br(s); }, 0);
    var ca = C().caBand(me / Math.max(1, them));
    var myGuns = state.ship.guns;
    return {
      hunter: g.hunter, shape: g.shape, ca: ca, caName: C().caName(ca), driver: brDriver(state, g.ships),
      ships: g.ships.map(function (s) {
        var lt = G().lootTypes(s);
        return { id: s.id, cls: s.cls, role: s.role, flag: s.flag, name: s.name, escort: !!s.escort,
          guns: s.guns <= 4 ? "a handful" : s.guns <= myGuns ? "about as many as yours" : s.guns <= myGuns * 2 ? "more than yours" : "far more than yours",
          gunsRange: G().range(s.guns), crewRange: G().range(s.crew), hull: G().hullWord(s),
          speed: s.speed > fs ? "faster than you" : s.speed === fs ? "your equal" : "slower than you",
          handling: s.handling > (C().ship(state, null, "flagship").handling) ? "nimbler" : s.handling < C().ship(state, null, "flagship").handling ? "clumsier" : "as nimble",
          draft: s.draft, cue: s.cue, lootTypes: lt, loot: H().LEVELS[s.lootLevel], warship: s.role === "War" || s.hunter,
          legit: s.flag === "Pirate" ? "A pirate: always fair game, and her cargo is clean." : "You hold no letter: her cargo will be dirty, and " + meterNote(s) };
      }),
    };
  }

  // P12a: which part of Battle Rating puts her ahead (guns, hull or crew),
  // so the Quartermaster names the real reason. The same sums as br().
  function brDriver(state, ships) {
    var mine = ["flagship"].concat(fleet(state).filter(function (f) { return f.kind === "fleet"; }).map(function (f) { return f.id; }))
      .map(function (id) { return C().ship(state, null, id); });
    function part(list, k) {
      return list.reduce(function (a, s) { return a + (k === "guns" ? C().manned(s) : k === "hull" ? s.hull / (PC.data.hunt.BR_HULL_DIV || 5) : s.crew / 5); }, 0);
    }
    var best = null, gap = 0;
    ["guns", "hull", "crew"].forEach(function (k) {
      var d = part(ships, k) - part(mine, k);
      if (d > gap) { gap = d; best = k; }
    });
    return best;
  }

  function meterNote(s) {
    if (s.flag === "Avalon" || s.flag === "Burgundy" || s.flag === "Sweden") return "taking her costs Avalon Standing and Heat.";
    if (s.flag === "Frisia" || s.flag === "Ireland") return "taking her costs Frisian Standing and Heat.";
    if (s.flag === "France" || s.flag === "Spain") return "France will remember it.";
    if (s.flag === "Sicily") return "Sicily will send hunters after you.";
    return "nobody here will mind.";
  }

  function advice(state, game, sv) {
    if (!sv) return null;
    var A = L().advice;
    if (sv.hunter) return A.hunter;
    if (sv.ships.some(function (s) { return s.warship; }) && sv.ca < 2) return A.warship;
    if (sv.ca >= 1) return A.good;
    if (sv.ca === 0) return A.even;
    // P12a: name what puts her ahead.
    return (sv.driver && A.badBy && A.badBy[sv.driver]) || A.bad;
  }

  function view(state, game) {
    var sv = game.sighting && (game.phase === "scout" || game.phase === "hunter") ? scoutView(state, game) : null;
    var cur = game.phase === "after" ? currentPrize(state, game) : null;
    var qm = PC.officers.quartermaster ? PC.officers.quartermaster(state) : null;
    return {
      phase: game.phase, apUsed: game.apUsed, apLeft: state.ap.left, maxAp: H().MAX_AP,
      vote: game.vote || null, lastApproval: game.lastApproval || null,
      batch: game.batch ? { n: game.batch.n, next: game.batch.next } : null,
      condition: game.batch ? game.batch.condition : game.condition || null, outlook: PC.weather.outlook(state, game.waters),
      canReadAhead: canReadAhead(state, game), readAhead: game.readAhead || null,
      readCheck: PC.weather.readCheck(state, game.waters),
      waters: H().WATERS[game.waters].name, scout: sv, advice: advice(state, game, sv), qm: qm ? qm.first || qm.full : null,
      battle: game.battle && game.phase === "battle" ? C().view(state, game) : null,
      after: game.after ? {
        chips: game.after.chips, summary: mergeChips(game.after.chips), battleChips: game.after.battleSeen ? [] : (game.after.battleChips || []),
        taken: mergeTaken(game.after.taken || []), names: game.after.names || [],
        repairDone: game.after.repairDone, hpLost: game.after.hpLost, repairCheck: repairCheck(state),
        prize: cur ? prizeView(state, game, cur) : null, lastPrize: game.after.lastPrize || null, left: game.after.queue.length,
      } : null,
      encounter: !!game.encounter, pirateFirst: !!game.pirateFirst,
      canContinue: canContinue(state, game), prizesTaken: game.prizesTaken, gameOver: game.gameOver || null,
      holdFree: PC.crew.slotsFree(state), holdMax: PC.crew.holdCapacity(state),
    };
  }

  // Cargo taken across every ship, one line a good (A10): 50 + 25 tobacco = 75.
  function mergeTaken(list) {
    var by = {}, out = [];
    list.forEach(function (t) { var key = t.what + (t.dirty ? "|d" : ""); if (!by[key]) { by[key] = { what: t.what, n: 0, dirty: t.dirty }; out.push(by[key]); } by[key].n += t.n; });
    return out.filter(function (t) { return t.n; });
  }

  function prizeView(state, game, cur) {
    var e = capturedShip(game, cur.id), l = cur.loot;
    return {
      id: e.id, cls: e.cls, name: e.name, flag: e.flag, role: e.role, captain: e.captain, title: e.title, level: H().LEVELS[l.level],
      hull: Math.round(e.hull), hullMax: e.hullMax, guns: e.guns, crew: e.crew, crewMin: e.crewMin, cargo: e.cargo,
      treasure: l.treasure, goods: l.goods, provisions: l.provisions, chest: l.chest, captives: l.captives,
      volunteers: cur.volunteers, volTier: cur.volTier, execute: canExecute(state, e), hullOptions: hullOptions(state, game).map(function (o) {
        // Keeping her hull adds her hold to the pool before her cargo comes across (A7).
        o.addsHold = o.lock ? 0 : (o.id === "prize" || o.id === "fleet" || o.id === "flagship") ? (e.cargo || 0) : 0;
        return o;
      }),
      dirty: e.flag !== "Pirate",
      // The hold as it stands, for the cargo picker's stacked bar (A7, B42).
      hold: { cap: PC.crew.holdCapacity(state), provisions: state.provisions, goods: PC.crew.goodsUnits(state), treasure: PC.crew.treasureUnits(state), per: PC.data.economy.TREASURE_PER_SLOT },
    };
  }

  // The roll list's "what it did" for a checked roll (N4).
  function rollEffect(state, game, op, outcome) {
    if (op === "repair") return { clean: "a quarter of the damage patched", partial: "a tenth of the damage patched", setback: "nothing to show for it" }[outcome];
    return C().rollEffect(state, game, op, outcome);
  }

  M().register("hunt", { settle: settle, view: view, exit: exit, rollEffect: rollEffect });

  // ---- Developer tools (§37.2) ------------------------------------------------------

  // Spawn a fleet ship with a generated officer-captain (Milestone 5 plan).
  function devFleetShip(state, cls) {
    cls = cls || "Sloop";
    var c = H().CLASSES[cls];
    var id = "dev" + (state.world.shipSeq = (state.world.shipSeq || 0) + 1);
    var o = PC.officers.generate(state, PC.node.here(state), [state.world.seed, "devfleet", id].join("|"), "off_" + id);
    o.aboard = id; o.joined = { year: state.time.year, season: state.time.season };
    state.officers.push(o);
    var crew = Math.max(c.crewMin, Math.round(c.crewMax * 0.6));
    var pool = PC.data.names.SHIPS.pirate, taken = [state.ship.name].concat(fleet(state).map(function (f) { return f.name; }));
    var nm = null;
    for (var i = 0; i < pool.length && (!nm || taken.indexOf(nm) >= 0); i++) nm = pool[(state.world.shipSeq * 7 + i) % pool.length];
    fleet(state).push({ id: id, kind: "fleet", cls: cls, name: nm,
      flag: "Pirate", role: c.role, size: c.size, hull: c.hull, hullMax: c.hull, guns: c.guns, gunsMax: c.guns, crew: crew, crewMin: c.crewMin,
      crewMax: c.crewMax, cargo: c.cargo, speed: c.speed, handling: c.handling, officer: o.id, dirty: false, crewTiers: { Able: crew }, wounded: 0, dev: true });
    return { ship: cls, officer: o.first + " " + (o.last || "") };
  }

  // ---- Voyage events on the hunt's legs (§44.2) ---------------------------------------

  // A hunt leg's events are done. Out: the quiet lines go in the hunt's log
  // and (if the leg waited on a card) the first batch starts. Back: the
  // arrival, with the leg's lines first.
  function afterLeg(state, v) {
    var game = state.minigame;
    if (state.gameOver) { state.minigame = null; PC.summary.end(state); return; }
    if (v.dir === "out") {
      if (!game || game.key !== v.game) return;
      v.lines.forEach(function (l) { M().say(state, game, l); });
      state.current = { screen: "minigame" };
      if (!v.sync) newBatch(state, game);
      return;
    }
    if (v.sync) return; // exit() goes on to the arrival
    PC.node.arrive(state, v.home, { fromHunt: true, voyage: v.lines.length ? { lines: v.lines, chips: [] } : undefined });
    state.current = { screen: "node" };
  }

  // A ship met on a voyage (§44.4, §44.8): the hunt's scouting card and
  // battle, with no batches and no actions; the voyage runs on after.
  // DEFAULT: a pirate engages first when the odds are Even or better for
  // her (§44.4); she plays as a hunter would (no strike, no run before).
  function startEncounter(state, grp, o) {
    var game = {
      kind: "hunt", key: "enc-" + (state.rolls.hunt = (state.rolls.hunt || 0) + 1), waters: o.waters, zone: o.waters,
      apUsed: H().MAX_AP, batch: null, phase: grp.hunter ? "hunter" : "scout", sighting: grp, battle: null, after: null,
      prizesTaken: 0, prizeMorale: 0, captives: 0, force: null, home: o.home, encounter: o.voyage, condition: o.condition,
    };
    M().start(state, game, "node");
    M().say(state, game, "The weather: " + PC.weather.badge(o.condition) + ".");
    var first = PC.meters.attacksFirst(state, grp, M().rand(state, game, "attack-first"));
    if (first) { game.phase = "hunter"; game.attackFirst = first; M().say(state, game, PC.data.meterRules.lines[first === "navy" ? "navyAttacks" : "pirateAttacks"]); return game; }
    if (!grp.hunter && grp.ships[0].flag === "Pirate") {
      var sv = scoutView(state, game);
      if (sv && sv.ca <= 0) { game.phase = "hunter"; game.pirateFirst = true; M().say(state, game, "PLACEHOLDER: She's a pirate, and she likes her odds. She's coming for you."); return game; }
    }
    M().say(state, game, grp.hunter ? L().hunter : L().sail);
    return game;
  }

  // The flagship founders with a fleet ship in company (§44.7): the fleet
  // ship becomes the flagship and the survivors cross to her. DEFAULT: the
  // cargo was the fleet's and stays, down to what her hold can carry.
  function promoteFleetShip(state, rec) {
    var c = H().CLASSES[rec.cls] || {};
    state.fleet = fleet(state).filter(function (f) { return f !== rec; });
    state.ship = {
      name: rec.name || rec.cls, type: rec.cls, hull: Math.max(1, Math.round(rec.hull)), hullMax: rec.hullMax || c.hull, baseHull: c.hull || rec.hullMax,
      guns: rec.guns, gunsMax: rec.gunsMax || c.guns, cargo: rec.cargo != null ? c.cargo : c.cargo, size: rec.size || c.size, crewMin: rec.crewMin || c.crewMin,
      crewMax: rec.crewMax || c.crewMax, speed: rec.speed || c.speed, speedMax: c.speed || rec.speed, handling: rec.handling != null ? rec.handling : c.handling,
      rigging: "sound", upgrades: rec.upgrades || { hull: 1, rigging: 1, guns: 1 }, dirty: !!rec.dirty, prizeOf: rec.flag,
    };
    var t = rec.crewTiers || { Green: rec.crew || 0 };
    Object.keys(t).forEach(function (k) { state.crew.tiers[k] = (state.crew.tiers[k] || 0) + t[k]; state.crew.count += t[k]; });
    (state.officers || []).forEach(function (o) { if (!o.gone && o.aboard === rec.id) o.aboard = "flagship"; });
    PC.crew.jettisonOverflow(state);
    return state.ship;
  }

  PC.hunt = {
    canHunt: canHunt, start: start, battle: battle, next: next, engage: engage, meetHunter: meetHunter, vote: vote, voteReact: voteReact, VOTE_REACT: VOTE_REACT,
    doRepair: doRepair, settlePrize: settlePrize, carryOn: carryOn, anotherBatch: anotherBatch, sailHome: sailHome, sailOnOptions: sailOnOptions, sailOn: sailOn,
    canReadAhead: canReadAhead, readAhead: readAhead, stormCheck: stormCheck,
    hullOptions: hullOptions, fleetCap: fleetCap, devFleetShip: devFleetShip, checkBattleOver: checkBattleOver,
    loadCargo: loadCargo, loadPicked: loadPicked, currentPrize: currentPrize, mergeChips: mergeChips,
    afterLeg: afterLeg, startEncounter: startEncounter, promoteFleetShip: promoteFleetShip,
  };
})();
