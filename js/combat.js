/* Pirate Chronicle — sea battles (§21.3-§21.16), with the Milestone 5
 * planning rulings: Shaken (stacking Resolve penalties) and boarding losses
 * by Crew Advantage.
 *
 * A battle lives in state.minigame.battle while a hunt is in play. The
 * player's flagship is state.ship and state.crew; fleet and prize ships are
 * in state.fleet; enemy ships are in battle.enemies. The battle moves step
 * by step: each player choice may roll one captain check (through
 * PC.minigames.roll, so rerolls work), and the engine then runs on until the
 * next choice. Ship and crew rolls (the Exchange, crew clashes, strike
 * rolls, background exchanges) are plain seeded 2d6 + edge.
 * No screen code here: js/ui.js draws battleView().
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function H() { return PC.data.hunt; }
  function L() { return PC.data.huntLines; }
  function M() { return PC.minigames; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  // ---- Small pieces ---------------------------------------------------------

  function rawRoll(state, game, what, edge) {
    var e = clamp(Math.round(edge), PC.checks.RULES.EDGE_MIN, PC.checks.RULES.EDGE_MAX);
    var dice = PC.rng.roll2d6(M().key(state, game, what));
    var total = dice[0] + dice[1] + e;
    return { outcome: PC.checks.readTotal(total), dice: dice, edge: e, total: total };
  }
  // The player's own raw rolls (the Exchange, a clash) get the same
  // color-coded result box as checked rolls (G4 of the M5 playtest).
  function markRoll(game, type, r) {
    game.rollSeq = (game.rollSeq || 0) + 1;
    game.lastRoll = { type: type, outcome: r.outcome, roll: { dice: r.dice, edge: r.edge, total: r.total }, logAt: game.log.length, seq: game.rollSeq, chips: [], op: type === "The Exchange" ? "exchange" : "clash" };
    M().noteRoll(game, { seq: game.rollSeq, label: type, outcome: r.outcome, op: game.lastRoll.op, mine: true });
  }
  // A roll the player doesn't make (a strike roll, a fleet ship's fight):
  // listed with its outcome and what it did (N4).
  function noteRaw(game, label, r, effect) { M().noteRoll(game, { label: label, outcome: r.outcome, effect: effect }); }
  function chance(state, game, what, p) { return M().rand(state, game, what)() < p; }
  // Probabilistic rounding (§21.11): 4% of 12 men is 0 or 1, averaging right.
  function prnd(state, game, x) { var f = Math.floor(x); return f + (chance(state, game, "prnd", x - f) ? 1 : 0); }
  function say(state, game, line) { M().say(state, game, line); }
  function fill(line, map) { return String(line).replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); }

  function caBand(ratio) {
    var B = H().CA_BANDS;
    for (var i = 0; i < B.length; i++) if (ratio >= B[i][0]) return B[i][1];
    return -4;
  }
  function caName(b) { return H().CA_NAMES[String(b)]; }

  function dreadBonus(state) {
    var d = (state.meters && state.meters.dread) || 0;
    return d >= 70 ? 3 : d >= 40 ? 2 : d >= 20 ? 1 : 0;
  }

  // ---- The player's ships ---------------------------------------------------

  function cls(id) { return H().CLASSES[id]; }
  function fleet(state) { return (state.fleet = state.fleet || []); }
  function fleetShip(state, id) { return fleet(state).filter(function (f) { return f.id === id; })[0] || null; }

  function onFlagship(state, type) {
    return (state.officers || []).some(function (o) { return !o.gone && (o.aboard || "flagship") === "flagship" && o.type === type; });
  }
  function gunQuality(state) { var g = (state.ship.upgrades || {}).guns || 1; return g >= 5 ? 2 : g >= 3 ? 1 : 0; }

  // Gunnery (§21.4): gun quality, a Gunner aboard, crew drill; clamp 0-4.
  // Gunner's Eye adds +1 on the first Exchange only (in exchange()).
  function playerGunnery(state) {
    var g = gunQuality(state) + (onFlagship(state, "Gunner") ? 1 : 0) + (PC.crew.drilled(state) ? 1 : 0);
    return clamp(g, 0, 4);
  }
  function hasTag(state, t) { return (state.captain.tags || []).indexOf(t) >= 0; }

  function flagshipHandling(state) {
    var c = cls(state.ship.type) || {};
    var h = state.ship.handling != null ? state.ship.handling : c.handling || 0;
    return h + (((state.ship.upgrades || {}).rigging || 1) >= 5 ? 1 : 0);
  }

  // A plain view of any ship in the battle, by id. The flagship reads the
  // live state; everything else is its own record.
  // Weather (§42.4): in a Calm every ship's Speed counts as 1, except ships
  // with sweeps (Cutter, Sloop, Royal Sloop, Schooner).
  function calmed(b, s) {
    if (!b || b.condition !== "Calm" || !s) return s;
    if (PC.weather && PC.weather.hasSweeps(s.cls)) return s;
    s.speed = Math.min(s.speed, 1);
    return s;
  }
  function ship(state, b, id) { return calmed(b, shipRaw(state, b, id)); }
  function shipRaw(state, b, id) {
    if (id === "flagship") {
      var sh = state.ship, c = cls(sh.type) || {};
      return {
        id: "flagship", mine: true, flagship: true, cls: sh.type, name: sh.name, role: c.role || "Raider", size: sh.size || c.size || 1,
        hull: sh.hull, hullMax: sh.hullMax, guns: sh.guns, gunsMax: sh.gunsMax, crew: state.crew.count, crewMin: sh.crewMin, crewMax: sh.crewMax,
        speed: Math.max(0, sh.speed - ((b && b.speedLoss && b.speedLoss.flagship) || 0)), handling: flagshipHandling(state),
        gunnery: playerGunnery(state), startCrew: b ? b.startCrew.flagship : state.crew.count,
      };
    }
    var f = fleetShip(state, id);
    if (f) {
      return Object.assign({}, f, { mine: true, speed: Math.max(0, f.speed - ((b && b.speedLoss && b.speedLoss[id]) || 0)),
        gunnery: 0, startCrew: b ? b.startCrew[id] : f.crew });
    }
    var e = b && b.enemies.filter(function (x) { return x.id === id; })[0];
    if (!e) return null;
    return Object.assign({}, e, { speed: Math.max(0, e.speed - ((b.speedLoss && b.speedLoss[id]) || 0)) });
  }

  function enemyRec(b, id) { return b.enemies.filter(function (x) { return x.id === id; })[0] || null; }

  function manned(s) { return Math.min(s.guns, Math.floor(s.crew / 2)); }
  function br(s) { return manned(s) + s.hull / (H().BR_HULL_DIV || 5) + s.crew / 5; }
  function hullLost(s) { return 1 - s.hull / s.hullMax; }
  function crewLost(s) { return s.startCrew ? 1 - s.crew / s.startCrew : 0; }

  // Fleet Speed: the slowest of the flagship, fleet ships and prize ships
  // (§21.8, §21.10).
  function fleetSpeed(state, b) {
    var sp = ship(state, b, "flagship").speed;
    fleet(state).forEach(function (f) { if (!f.out) sp = Math.min(sp, ship(state, b, f.id).speed); });
    return sp;
  }

  // ---- Mutating ships ------------------------------------------------------

  // Crew losses on the flagship fall across the tiers in proportion, 50/50
  // killed or wounded (§21.11). Returns { killed, wounded }.
  function hurtFlagship(state, game, b, n) {
    var c = state.crew, out = { killed: 0, wounded: 0 };
    n = Math.min(n, c.count);
    for (var i = 0; i < n; i++) {
      var r = M().rand(state, game, "casualty")();
      var x = r * c.count, tier = "Green";
      var order = PC.data.economy.TIER_ORDER;
      for (var t = 0; t < order.length; t++) { x -= c.tiers[order[t]] || 0; if (x < 0) { tier = order[t]; break; } }
      if (!c.tiers[tier]) tier = order.filter(function (k) { return c.tiers[k]; })[0];
      if (!tier) break;
      PC.crew.removeHands(state, tier, 1);
      if (M().rand(state, game, "wound")() < 0.5) { c.wounded = (c.wounded || 0) + 1; out.wounded++; b.woundedTiers[tier] = (b.woundedTiers[tier] || 0) + 1; }
      else out.killed++;
    }
    b.killed.flagship = (b.killed.flagship || 0) + out.killed;
    return out;
  }

  function loseCrew(state, game, b, id, n) {
    n = Math.max(0, Math.round(n));
    if (!n) return;
    if (id === "flagship") return hurtFlagship(state, game, b, n);
    var f = fleetShip(state, id) || enemyRec(b, id);
    var k = Math.min(n, f.crew);
    f.crew -= k;
    var w = 0;
    for (var i = 0; i < k; i++) if (chance(state, game, "wound", 0.5)) w++;
    f.wounded = (f.wounded || 0) + w;
    b.killed[id] = (b.killed[id] || 0) + (k - w);
  }

  function setHull(state, b, id, hp) {
    if (id === "flagship") state.ship.hull = Math.max(0, hp);
    else (fleetShip(state, id) || enemyRec(b, id)).hull = Math.max(0, hp);
  }
  function loseGuns(state, b, id, n) {
    if (id === "flagship") state.ship.guns = Math.max(0, state.ship.guns - n);
    else { var s = fleetShip(state, id) || enemyRec(b, id); s.guns = Math.max(0, s.guns - n); }
  }

  // One hit (§21.11). heavy: true/false. shot: round, chain, grape, rigging,
  // rudder. attacker and target are ids.
  function hit(state, game, b, attId, tgtId, heavy, shot) {
    var a = ship(state, b, attId), t = ship(state, b, tgtId);
    if (!a || !t || a.guns <= 0) return 0;
    var dmg = (heavy ? H().HEAVY : H().LIGHT) * manned(a) * (H().SHOT_MULT[shot] || 1);
    setHull(state, b, tgtId, t.hull - dmg);
    var cl = (heavy ? H().CREW_HIT.heavy : H().CREW_HIT.light) * (shot === "grape" ? (H().GRAPE_MULT || 2) : 1);
    var lost = prnd(state, game, t.crew * cl);
    if (shot === "grape" && H().GRAPE_BY_GUNS) lost = prnd(state, game, manned(a) * (heavy ? H().GRAPE_BY_GUNS.heavy : H().GRAPE_BY_GUNS.light));
    if (shot === "grape") lost = Math.max(1, lost);
    loseCrew(state, game, b, tgtId, lost);
    if (heavy) {
      loseGuns(state, b, tgtId, Math.max(1, Math.floor(dmg / 10)));
      if (shot === "chain" || shot === "rigging") b.speedLoss[tgtId] = (b.speedLoss[tgtId] || 0) + 1;
      if (shot === "rudder") b.rudder[tgtId] = true;
      if (tgtId === "flagship") breakPorcelain(state);
      else { var e = enemyRec(b, tgtId); if (e) e.heavyHits = (e.heavyHits || 0) + 1; }
    }
    return dmg;
  }

  // Ming porcelain: 10% of the units break on each heavy hit (§21.11).
  function breakPorcelain(state) {
    var g = state.cargo.goods["Ming porcelain"];
    if (!g) return;
    ["clean", "dirty"].forEach(function (k) { g[k] = Math.max(0, g[k] - Math.ceil(g[k] * H().PORCELAIN_BREAK)); });
  }

  // ---- Combat Advantage ------------------------------------------------------

  function supportersOf(b, side, targetId) {
    // My supporters back a duel by my ship id; enemy supporters back a duel
    // by their ship id.
    var map = side === "mine" ? b.support : b.enemySupport;
    return Object.keys(map).filter(function (k) { return map[k] === targetId; });
  }

  // Pairing CA for my ship myId against enemy enId, supporters counted at
  // 25% of their BR (§21.9).
  function pairCA(state, b, myId, enId) {
    var me = br(ship(state, b, myId)), them = br(ship(state, b, enId));
    supportersOf(b, "mine", myId).forEach(function (s) { var x = ship(state, b, s); if (x && !x.out) me += H().SUPPORT.brShare * br(x); });
    supportersOf(b, "enemy", enId).forEach(function (s) { var x = ship(state, b, s); if (x && !x.out) them += H().SUPPORT.brShare * br(x); });
    return caBand(me / Math.max(1, them));
  }

  function fightingEnemies(b) { return b.enemies.filter(function (e) { return !e.out; }); }
  function myFighters(state) { return ["flagship"].concat(fleet(state).filter(function (f) { return f.kind === "fleet" && !f.out; }).map(function (f) { return f.id; })); }

  // Whole-fleet CA (§21.3): every fighting ship's BR, prize ships excluded.
  function fleetCA(state, b) {
    var me = 0, them = 0;
    myFighters(state).forEach(function (id) { me += br(ship(state, b, id)); });
    fightingEnemies(b).forEach(function (e) { them += br(ship(state, b, e.id)); });
    return caBand(me / Math.max(1, them));
  }

  function crewAdvantage(state, b, myId, enId) {
    var me = ship(state, b, myId), them = ship(state, b, enId);
    return caBand(me.crew / Math.max(1, them.crew));
  }

  // Support perks for my flagship's duel (§21.9): Raider +1 Position, War
  // +1 Exchange, +1 boarding for a ship alongside; each capped at +2.
  function perk(state, b, kind) {
    var n = 0;
    supportersOf(b, "mine", "flagship").forEach(function (id) {
      var s = ship(state, b, id); if (!s || s.out) return;
      var role = s.perk || s.role;
      if (kind === "position" && role === "Raider") n++;
      if (kind === "exchange" && role === "War") n++;
      if (kind === "board") n++;
    });
    return Math.min(H().SUPPORT.perkCap, n);
  }
  function enemyPerk(state, b, kind, enId) {
    var n = 0;
    supportersOf(b, "enemy", enId).forEach(function (id) {
      var s = ship(state, b, id); if (!s || s.out) return;
      if (kind === "position" && s.role === "Raider") n++;
      if (kind === "exchange" && s.role === "War") n++;
      if (kind === "board") n++;
    });
    return Math.min(H().SUPPORT.perkCap, n);
  }

  // ---- Resolve and strike rolls ---------------------------------------------

  function effResolve(e) { return e.resolve - (e.shaken || 0) - (e.leaderless ? H().LEADERLESS : 0); }

  function shake(e, n) { e.shaken = Math.min(H().SHAKEN_CAP, (e.shaken || 0) + (n || 1)); }

  // Half her crew lost: one more Shaken step, once (planning ruling).
  function checkHalfCrew(state, b, e) {
    var s = ship(state, b, e.id);
    if (!e.halfShaken && crewLost(s) >= 0.5) { e.halfShaken = true; shake(e, 1); }
  }

  // A strike roll: 2d6 + Dread bonus + edge − effective Resolve. Clean
  // strikes; a partial shakes her (planning ruling).
  function strikeRoll(state, game, b, e, edge, why) {
    var r = rawRoll(state, game, "strike", dreadBonus(state) + edge - effResolve(e));
    b.lastStrike = { ship: e.id, outcome: r.outcome, why: why, dice: r.dice, edge: r.edge };
    noteRaw(game, (why === "consort" ? "Strike roll, " : "Strike roll, ") + (e.name || e.cls), r,
      { clean: "she strikes her colors", partial: "she wavers but fights on (Shaken)", setback: "she fights on" }[r.outcome]);
    if (r.outcome === "clean") { knockOut(state, game, b, e, "struck"); return true; }
    if (r.outcome === "partial") { shake(e, 1); say(state, game, L().wavers); }
    return false;
  }

  // An enemy leaves the fight: struck, captured (crew broken, knocked out),
  // sunk or escaped. Triggers the convoy and flagship strike rolls (§21.13).
  function knockOut(state, game, b, e, how, quiet) {
    if (e.out) return;
    e.out = how;
    if (!quiet && (how === "struck" || how === "captured")) say(state, game, how === "struck" ? L().struck : L().crewBroken);
    if (how === "sunk") say(state, game, L().knockedOut.sunk);
    var taken = how === "struck" || how === "captured" || how === "sunk";
    if (!taken) return;
    var others = fightingEnemies(b);
    if (!others.length) return;
    // A convoy has no flagship: any ship struck or taken, the others roll.
    // An escort counts as the escorted pair's flagship (DEFAULT).
    var trigger = e.shape === "convoy" || e.escort || e.flagship;
    if (!trigger) return;
    others.forEach(function (o) {
      if (o.out) return;
      var myId = pairOf(b, o.id);
      var edge = myId ? pairCA(state, b, myId, o.id) : fleetCA(state, b);
      strikeRoll(state, game, b, o, edge, "consort");
    });
  }

  function pairOf(b, enId) { return Object.keys(b.pairs).filter(function (k) { return b.pairs[k] === enId; })[0] || null; }

  // ---- Fate checks (§21.9) ----------------------------------------------------

  function fateCheck(state, game, b, id) {
    var s = ship(state, b, id);
    if (!s || s.out) return null;
    var lost = hullLost(s);
    if (lost >= 1) return id === "flagship" ? "sunk" : finishEnemyOrMine(state, game, b, id, "sunk");
    var from = id === "flagship" ? H().FLAGSHIP_FATE_FROM : 0.5;
    if (lost < from) return null;
    var p = lost >= 0.75 ? 0.5 : 0.25;
    if (!chance(state, game, "fate", p)) return null;
    if (id === "flagship") return "out";
    var cap = b.fleetOrder === "sink" ? H().SINK_THEM_CAPTURE : H().TAKE_PRIZES_CAPTURE;
    var how = chance(state, game, "fateHow", cap) ? "captured" : "sunk";
    if (s.mine) how = chance(state, game, "fateHow", 0.8) ? "captured" : "sunk"; // DEFAULT: the enemy takes her
    return finishEnemyOrMine(state, game, b, id, how);
  }

  function finishEnemyOrMine(state, game, b, id, how) {
    var e = enemyRec(b, id);
    if (e) { if (how === "captured") say(state, game, L().knockedOut.captured); knockOut(state, game, b, e, how); return how; }
    var f = fleetShip(state, id);
    if (f) {
      f.out = how === "sunk" ? "sunk" : "taken";
      say(state, game, "PLACEHOLDER: Your " + f.cls + (f.name ? " " + f.name : "") + (how === "sunk" ? " goes down." : " strikes her colors."));
      // Her officer-captain is lost with her (DEFAULT: the imprisonment chat).
      (state.officers || []).forEach(function (o) { if (o.aboard === id) { o.gone = true; o.goneWhy = how === "sunk" ? "lost with her ship" : "captured"; } });
      delete b.pairs[id]; delete b.support[id];
      return how;
    }
    return null;
  }

  // The 25% crew line (§21.11), checked at the end of every beat.
  function crewLines(state, game, b) {
    fightingEnemies(b).forEach(function (e) {
      if (e.crew < H().CREW_LINE * e.startCrew) knockOut(state, game, b, e, "captured");
    });
    fleet(state).forEach(function (f) {
      if (f.kind === "fleet" && !f.out && f.crew < H().CREW_LINE * (b.startCrew[f.id] || f.crew)) finishEnemyOrMine(state, game, b, f.id, "captured");
    });
  }

  // A disarmed enemy rolls to strike at once, and at every Decision (§21.13).
  function disarmedChecks(state, game, b) {
    fightingEnemies(b).forEach(function (e) {
      if (e.guns > 0 || e.disarmedRolled) return;
      e.disarmedRolled = true;
      say(state, game, L().disarmed);
      var myId = pairOf(b, e.id);
      strikeRoll(state, game, b, e, myId ? pairCA(state, b, myId, e.id) : fleetCA(state, b), "disarmed");
    });
  }

  // ---- Starting a battle ------------------------------------------------------

  // grp: a sighting group from PC.huntGen. mode: "engage" (the player chose
  // to), "hunter" (she engaged the player).
  function begin(state, game, grp, mode) {
    var enemies = grp.ships.map(function (s) { return Object.assign({}, s, { shaken: 0, out: null, startCrew: s.crew, startHull: s.hull }); });
    if (grp.shape === "escort") enemies.forEach(function (e) { e.flagship = !!e.escort; });
    var b = {
      mode: mode, shape: grp.shape, round: 0, enemies: enemies, pairs: {}, support: {}, enemySupport: {},
      speedLoss: {}, rudder: {}, killed: {}, woundedTiers: {}, startCrew: { flagship: state.crew.count },
      startHull: { flagship: state.ship.hull }, firstExchange: true, fleetOrder: "take", openRange: false,
      dueled: false, posBonus: 0, step: null, over: null, captured: [], log0: game.log.length,
      // The weather (§42.4): the batch's condition, or the voyage's.
      condition: (game.batch && game.batch.condition) || game.condition || "Fair",
    };
    fleet(state).forEach(function (f) { b.startCrew[f.id] = f.crew; b.startHull[f.id] = f.hull; });
    game.battle = b;
    // Default pairings: the flagship takes the escort or the first ship.
    var first = enemies.filter(function (e) { return e.escort; })[0] || enemies[0];
    autoPair(state, b, first.id);
    if (mode === "hunter") { b.step = "hunterChoice"; return b; }
    b.step = "setup";
    if (enemies.length === 1 && !fleet(state).some(function (f) { return f.kind === "fleet" && !f.out; })) startStrike(state, game);
    return b;
  }

  // Pair every fighting ship. The flagship takes target (or keeps hers);
  // fleet ships take the remaining enemies in order; surplus mine support
  // the flagship, surplus theirs support the duel against my flagship.
  function autoPair(state, b, target) {
    b.pairs = {}; b.support = {}; b.enemySupport = {};
    var foes = fightingEnemies(b).map(function (e) { return e.id; });
    if (!foes.length) return;
    if (foes.indexOf(target) < 0) target = foes[0];
    b.pairs.flagship = target;
    var left = foes.filter(function (id) { return id !== target; });
    myFighters(state).filter(function (id) { return id !== "flagship"; }).forEach(function (id) {
      var want = b.assign && b.assign[id];
      if (want === "support") { b.support[id] = "flagship"; return; }
      var t = want && left.indexOf(want) >= 0 ? want : left[0];
      if (t) { b.pairs[id] = t; left = left.filter(function (x) { return x !== t; }); }
      else if (supportersOf(b, "mine", "flagship").length < H().SUPPORT.maxSupporters) b.support[id] = "flagship";
    });
    left.forEach(function (id) {
      // Their surplus backs the duel against my flagship (DEFAULT for
      // "where their side is losing worst").
      if (supportersOf(b, "enemy", target).length < H().SUPPORT.maxSupporters) b.enemySupport[id] = target;
    });
  }

  function setTarget(state, game, enId) {
    var b = game.battle;
    if (!enemyRec(b, enId) || enemyRec(b, enId).out) throw new Error("She's out of the fight.");
    autoPair(state, b, enId);
  }
  function assignFleetShip(state, game, myId, what) {
    var b = game.battle;
    b.assign = b.assign || {};
    b.assign[myId] = what;
    autoPair(state, b, b.pairs.flagship);
  }

  // The pre-battle strike-colors roll (§21.10): whole-fleet CA. Prize
  // Takers may first try a show of force (Intimidate vs her Resolve).
  function startStrike(state, game) {
    var b = game.battle;
    b.step = hasTag(state, "Prize Taker") ? "showOfForce" : "strikePre";
    if (b.step === "strikePre") return strikePre(state, game, 0);
  }

  function lead(b) { return enemyRec(b, b.pairs.flagship); }

  function strikePre(state, game, bonus) {
    var b = game.battle, e = lead(b);
    var resolve = Math.max.apply(null, fightingEnemies(b).map(effResolve));
    var r = rawRoll(state, game, "strikePre", dreadBonus(state) + fleetCA(state, b) + bonus - resolve);
    b.preStrike = { outcome: r.outcome, dice: r.dice, edge: r.edge };
    noteRaw(game, "Call on her to strike", r, { clean: "she strikes without a fight", partial: "she won't strike, but she's shaken", setback: "she won't strike" }[r.outcome]);
    if (r.outcome === "clean") {
      say(state, game, L().struckPre);
      fightingEnemies(b).forEach(function (x) { x.out = "struck"; x.noFight = true; });
      return endBattle(state, game);
    }
    say(state, game, L().noStrike);
    if (r.outcome === "partial") fightingEnemies(b).forEach(function (x) { shake(x, 1); });
    return enemyFleePre(state, game);
  }

  // Before the battle, she decides whether to run (§21.10). Hunters, war
  // fleets and an escorting warship never do.
  function enemyFleePre(state, game) {
    var b = game.battle;
    var foes = fightingEnemies(b);
    if (foes.some(function (e) { return e.hunter || e.escort; })) return startRound(state, game);
    if (b.condition === "Fog") return startRound(state, game); // a ship met in fog gets no pre-battle flee roll (§42.4)
    var theirSpeed = Math.min.apply(null, foes.map(function (e) { return ship(state, b, e.id).speed; }));
    var p = fleeChance(theirSpeed - fleetSpeed(state, b), fleetCA(state, b));
    if (!chance(state, game, "fleePre", p)) { say(state, game, L().stays); return startRound(state, game); }
    say(state, game, L().runs);
    b.chase = { mode: "chase", then: "round" };
    b.step = "chase";
  }

  function fleeChance(diff, ca) {
    var p = H().FLEE_TABLE[String(clamp(diff, -2, 2))];
    return p + (H().FLEE_CA_BONUS[String(ca)] || 0);
  }

  // ---- Rounds -------------------------------------------------------------------

  function startRound(state, game) {
    var b = game.battle;
    if (!fightingEnemies(b).length) return endBattle(state, game);
    if (!lead(b) || lead(b).out) { if (pickNextTarget(state, game)) return; }
    b.round += 1;
    b.pos = null; b.exMod = 0; b.closeBonus = 0;
    b.step = "position";
  }

  // The flagship's target is gone: the player picks the next (§21.9).
  function pickNextTarget(state, game) {
    var b = game.battle, foes = fightingEnemies(b);
    if (!foes.length) { endBattle(state, game); return true; }
    if (foes.length === 1) { autoPair(state, b, foes[0].id); return false; }
    b.step = "retarget";
    return true;
  }

  // ---- Weather in battle (§42.4) -------------------------------------------
  // Each returns parts for the player's roll; a Navigator at level 4 spares
  // his side Rough's and Fog's penalties and takes Storm's one smaller.
  function nav4(state) { return PC.weather && PC.weather.navigatorL4(state); }
  function weatherParts(state, b, kind) {
    var c = b.condition, out = [];
    if (!c || c === "Fair" || c === "Calm") return out;
    var me = ship(state, b, "flagship"), en = ship(state, b, b.pairs.flagship);
    if (!en) return out;
    if (c === "Rough") {
      if (kind === "exchange" && me.size !== en.size) {
        if (me.size < en.size && !nav4(state)) out.push({ label: "Rough seas (the smaller ship)", value: -1 });
        if (en.size < me.size) out.push({ label: "Rough seas (she's smaller)", value: 1 });
      }
      if (kind === "grapple" && !nav4(state)) out.push({ label: "Rough seas", value: -1 });
      if (kind === "repel") out.push({ label: "Rough seas (she boards)", value: 1 });
    }
    if (c === "Fog") {
      if (kind === "position" && me.speed !== en.speed) {
        if (me.speed > en.speed) out.push({ label: "Fog (you're faster)", value: 1 });
        else if (!nav4(state)) out.push({ label: "Fog (she's faster)", value: -1 });
      }
      if (kind === "flee") out.push({ label: "Fog (breaking off)", value: 1 });
    }
    if (c === "Storm") {
      // Storm is -2 on the Exchange for both sides: in one opposed roll the
      // two cancel, unless a Navigator at level 4 takes only -1 (DEFAULT).
      if (kind === "exchange" && nav4(state)) out.push({ label: "Storm (your Navigator)", value: 1 });
      if (kind === "firearms") out.push({ label: "Storm (firearms)", value: nav4(state) ? 0 : -1 });
    }
    return out.filter(function (x) { return x.value; });
  }

  // Beat 1: Position (Maneuver). DR is her captain's rating.
  function positionCheck(state, b) {
    var me = ship(state, b, "flagship"), en = ship(state, b, b.pairs.flagship);
    var extra = [{ label: "Handling", value: clamp(me.handling - en.handling, -2, 2) }];
    if (onFlagship(state, "Navigator")) extra.push({ label: "Navigator", value: 1 });
    var pk = perk(state, b, "position") - enemyPerk(state, b, "position", en.id);
    if (pk) extra.push({ label: "Support", value: pk });
    if (b.posBonus) extra.push({ label: b.posBonus > 0 ? "Caught on your terms" : "They caught you", value: b.posBonus });
    if (b.rudder[en.id]) extra.push({ label: "Her rudder", value: 1 });
    extra = extra.concat(weatherParts(state, b, "position"));
    return { type: "Maneuver", dr: clamp(en.rating, 0, 8), extra: extra.filter(function (x) { return x.value; }) };
  }

  function doPosition(state, game) {
    var b = game.battle;
    if (b.step !== "position") throw new Error("Not the moment for that.");
    return M().roll(state, game, positionCheck(state, b), "position", {}, ["Battle"]);
  }

  function settlePosition(state, game, p) {
    var b = game.battle;
    b.posBonus = 0; delete b.rudder[b.pairs.flagship];
    b.pos = p.outcome;
    say(state, game, L().position[p.outcome]);
    if (p.outcome === "clean") { b.step = "posChoice"; return; }
    b.exMod = p.outcome === "partial" ? 1 : -1;
    afterBeat(state, game);
    if (!b.over && b.step !== "retarget") b.step = "exchange";
  }

  // A clean Position: Rake, Close or Open the range.
  function choosePosition(state, game, what) {
    var b = game.battle;
    if (b.step !== "posChoice") throw new Error("Not the moment for that.");
    if (what === "rake") b.exMod = 2;
    else if (what === "open") { b.exMod = 0; b.openRange = true; }
    // Closing for boarding rolls the grapple at once (B37 of the M5 playtest).
    else if (what === "close") { b.closeBonus = 1; afterBeat(state, game); if (!b.over && b.step !== "retarget") { b.step = "grapple"; return doGrapple(state, game); } return; }
    afterBeat(state, game);
    if (!b.over && b.step !== "retarget") b.step = "exchange";
  }

  // Beat 2: the Exchange. Each side picks a shot; the player rolls.
  function exchangeEdge(state, b) {
    var me = ship(state, b, "flagship"), en = ship(state, b, b.pairs.flagship);
    var g = me.gunnery + (b.firstExchange && hasTag(state, "Gunner's Eye") ? 1 : 0);
    var parts = [
      { label: "Your Gunnery", value: clamp(g, 0, 4) }, { label: "Her Gunnery", value: -en.gunnery },
      { label: "Combat Advantage", value: pairCA(state, b, "flagship", en.id) },
      { label: "Position", value: b.exMod || 0 },
      { label: "Support", value: perk(state, b, "exchange") - enemyPerk(state, b, "exchange", en.id) },
    ].concat(weatherParts(state, b, "exchange")).filter(function (x) { return x.value; });
    var edge = parts.reduce(function (a, x) { return a + x.value; }, 0);
    return { parts: parts, edge: clamp(edge, -4, 6) };
  }

  // A ship's numbers before and after a hit (P14).
  function sideSnap(state, b, id) {
    var s = ship(state, b, id);
    return { hull: s.hull, guns: s.guns, crew: s.crew, speed: s.speed };
  }
  // "Her hull −4 · 1 gun lost · 1 man down · Speed −1" as one chip. Her
  // losses read good for you; your own read bad.
  function exchangeChips(a, z, who, ink) {
    var parts = [];
    var dh = Math.round(z.hull - a.hull), dg = z.guns - a.guns, dc = z.crew - a.crew, ds = z.speed - a.speed;
    if (dh) parts.push(who + " hull " + (dh > 0 ? "+" : "−") + Math.abs(dh));
    if (dg) parts.push(Math.abs(dg) + " gun" + (Math.abs(dg) === 1 ? "" : "s") + " lost");
    if (dc) parts.push(Math.abs(dc) + (Math.abs(dc) === 1 ? " man" : " men") + " down");
    if (ds) parts.push("Speed " + (ds > 0 ? "+" : "−") + Math.abs(ds));
    if (!parts.length) return [];
    return [{ icon: "hull", text: parts.join(" · "), ink: ink }];
  }

  function enemyShot(state, game, b, e) {
    var w = e.willBoard ? H().SHOT_WEIGHTS.boarding : e.flag === "Pirate" ? H().SHOT_WEIGHTS.Pirate :
      H().SHOT_WEIGHTS[e.hunter || e.role === "War" ? "War" : e.role] || H().SHOT_WEIGHTS.War;
    return PC.huntGen.weighted(M().rand(state, game, "enshot"), w);
  }

  function doExchange(state, game, shot) {
    var b = game.battle;
    if (b.step !== "exchange") throw new Error("Not the moment for that.");
    if ((shot === "rigging" || shot === "rudder") && !hasTag(state, "Gunner's Eye")) throw new Error("Only a Gunner's Eye can call a shot.");
    var en = lead(b);
    var theirs = enemyShot(state, game, b, en);
    var ed = exchangeEdge(state, b);
    var r = rawRoll(state, game, "exchange", ed.edge);
    b.firstExchange = false;
    b.lastExchange = { outcome: r.outcome, dice: r.dice, edge: r.edge, mine: shot, theirs: theirs };
    markRoll(game, "The Exchange", r);
    M().setRollEffect(game, { clean: "your heavy hit lands", partial: "light hits both ways", setback: "her heavy hit lands" }[r.outcome]);
    say(state, game, L().exchange[r.outcome] + " (" + L().theirShot[theirs] + ")");
    var before = { me: sideSnap(state, b, "flagship"), her: sideSnap(state, b, en.id) };
    if (r.outcome === "clean") hit(state, game, b, "flagship", en.id, true, shot);
    else if (r.outcome === "partial") { hit(state, game, b, "flagship", en.id, false, shot); hit(state, game, b, en.id, "flagship", false, theirs); }
    else hit(state, game, b, en.id, "flagship", true, theirs);
    // P14: what the Exchange did, both sides, as chips under the result.
    if (game.lastRoll) game.lastRoll.chips = exchangeChips(before.her, sideSnap(state, b, en.id), "Her", "good")
      .concat(exchangeChips(before.me, sideSnap(state, b, "flagship"), "Your", "bad"));
    afterBeat(state, game);
    if (!b.over && b.step !== "retarget") b.step = "decision";
  }

  // After every beat: fate checks, the crew line, disarmed ships, then the
  // background exchanges (§21.9). Ends the battle when one side is done.
  function afterBeat(state, game, skipBackground) {
    var b = game.battle;
    if (b.over) return;
    if (!skipBackground) background(state, game);
    b.enemies.forEach(function (e) { if (!e.out) { fateCheck(state, game, b, e.id); checkHalfCrew(state, b, e); } });
    fleet(state).forEach(function (f) { if (f.kind === "fleet" && !f.out) fateCheck(state, game, b, f.id); });
    var mine = fateCheck(state, game, b, "flagship");
    if (mine === "sunk") return flagshipLost(state, game, "sunk");
    if (mine === "out") return flagshipLost(state, game, "out");
    crewLines(state, game, b);
    disarmedChecks(state, game, b);
    if (!fightingEnemies(b).length) return endBattle(state, game);
    if (lead(b) && lead(b).out) pickNextTarget(state, game);
  }

  // Every pairing but the flagship's resolves with one hidden roll after
  // each of the player's beats.
  function background(state, game) {
    var b = game.battle;
    Object.keys(b.pairs).forEach(function (myId) {
      if (myId === "flagship") return;
      var enId = b.pairs[myId], e = enemyRec(b, enId), f = fleetShip(state, myId);
      if (!e || e.out || !f || f.out) return;
      var off = (state.officers || []).filter(function (o) { return o.aboard === myId && !o.gone; })[0];
      var sc = H().SUPPORT.supportCaptain[(off && off.level) || 1] || 0;
      var r = rawRoll(state, game, "background", pairCA(state, b, myId, enId) + sc);
      var map = { ship: f.name || f.cls, enemy: e.name || e.cls };
      noteRaw(game, map.ship + " against the " + map.enemy, r, { clean: "a heavy hit on her", partial: "light hits both ways", setback: "a heavy hit on your ship" }[r.outcome]);
      if (r.outcome === "clean") { hit(state, game, b, myId, enId, true, "round"); say(state, game, fill(L().backgroundYou, map)); }
      else if (r.outcome === "partial") { hit(state, game, b, myId, enId, false, "round"); hit(state, game, b, enId, myId, false, "round"); say(state, game, fill(L().backgroundBoth, map)); }
      else { hit(state, game, b, enId, myId, true, "round"); say(state, game, fill(L().backgroundThem, map)); }
    });
  }

  // ---- Beat 3: the Decision (§21.11, §21.13) -------------------------------------

  // What the enemy means to do this Decision: "board", "flee", "strike" or
  // "fight". Reads her type's row in the §21.13 table.
  function enemyIntent(state, game, b, e) {
    var s = ship(state, b, e.id), me = ship(state, b, "flagship");
    var hl = hullLost(s), lost = (e.role === "Trade" || e.role === "Hybrid") && !e.hunter && e.flag !== "Pirate" ? Math.max(hl, crewLost(s)) : hl;
    var adv = caBand(s.crew / Math.max(1, me.crew)), myLost = hullLost(me);
    var row = { board: false, flee: false, strike: 0 };
    if (e.hunter) { row.board = adv >= 1 || myLost >= 0.5; row.flee = !row.board && hl >= 0.75; }
    else if (e.flag === "Pirate") { row.board = adv >= 0; row.flee = !row.board && hl >= 0.5 && s.speed >= fleetSpeed(state, b); }
    else if (e.role === "War") { row.board = adv >= 1 && myLost >= 0.25; if (!row.board && hl >= 0.75) { row.flee = true; row.strike = 0.25; } }
    else if (e.role === "Hybrid") { row.strike = lost >= 0.75 ? 0.5 : lost >= 0.5 ? 0.25 : 0; row.flee = lost >= 0.5; }
    else { row.strike = lost >= 0.75 ? 0.75 : lost >= 0.5 ? 0.5 : lost >= 0.25 ? 0.25 : 0; row.flee = lost >= 0.25; }
    if (row.strike && !e.hunter && e.flag !== "Pirate") {
      var p = row.strike + 0.10 * (3 - e.resolve) + H().SHAKEN_STRIKE_PCT * (e.shaken || 0);
      if (chance(state, game, "enstrike", p)) return "strike";
    }
    if (e.guns <= 0 && !e.hunter) return "flee"; // a disarmed ship always runs (§21.13)
    if (row.board) return "board";
    if (row.flee) {
      var fp = fleeChance(s.speed - fleetSpeed(state, b), pairCA(state, b, "flagship", e.id)) + (e.role === "Trade" ? 0.15 : 0);
      if (chance(state, game, "enflee", fp)) return "flee";
    }
    return "fight";
  }

  // The player's Decision: "fire", "board", "flee" or "strike".
  function decide(state, game, what) {
    var b = game.battle;
    if (b.step !== "decision") throw new Error("Not the moment for that.");
    var e = lead(b);
    // A disarmed enemy rolls to strike again at every Decision first.
    if (e.guns <= 0) { if (strikeRoll(state, game, b, e, pairCA(state, b, "flagship", e.id), "disarmed")) return afterEnemyOut(state, game); }
    if (what === "strike") { say(state, game, L().youStrike); return flagshipLost(state, game, "struck"); }
    if (what === "flee") {
      PC.crew.addMorale(state, H().FLEE_MORALE);
      say(state, game, L().flee);
      if (b.openRange) { b.openRange = false; return escape(state, game, "clean"); }
      b.chase = { mode: "flee", then: "round" };
      b.step = "chase";
      return;
    }
    var intent = enemyIntent(state, game, b, e);
    e.willBoard = intent === "board";
    b.lastIntent = intent;
    if (intent === "strike") { say(state, game, L().struck); knockOut(state, game, b, e, "struck"); return afterEnemyOut(state, game); }
    if (intent === "flee") {
      say(state, game, L().runs);
      b.chase = { mode: "chase", then: what === "board" ? "grapple" : "round" };
      b.step = "chase";
      return;
    }
    if (intent === "board" && what === "board") {
      // Both board: they crash together, no grapple; the better Position
      // that round is the boarder (§21.19).
      b.board = newBoard(state, b, b.pos === "clean" || b.pos === "partial");
      return toStrikeFirst(state, game);
    }
    if (intent === "board") { say(state, game, L().enemyBoards); b.step = "repel"; return; }
    // Board her rolls the grapple directly: it's the only step after Board
    // (§21.12; B37 of the M5 playtest).
    if (what === "board") { b.step = "grapple"; return doGrapple(state, game); }
    startRound(state, game);
  }

  function afterEnemyOut(state, game) {
    var b = game.battle;
    if (b.over) return;
    if (!fightingEnemies(b).length) return endBattle(state, game);
    if (!pickNextTarget(state, game)) startRound(state, game);
  }

  // ---- Chases (§21.10, §22.8) ------------------------------------------------------

  function chaseCheck(state, b) {
    var en = ship(state, b, b.pairs.flagship);
    var extra = [{ label: "Speed", value: clamp(fleetSpeed(state, b) - en.speed, -2, 2) }];
    if (onFlagship(state, "Navigator")) extra.push({ label: "Navigator", value: 1 });
    var fleeing = b.chaseMode === "flee" || (b.chase && b.chase.mode === "flee");
    if (fleeing) extra = extra.concat(weatherParts(state, b, "flee"));
    // A fleeing ship may run into the storm (§42.4): Ride Out Storm in
    // place of Outrun.
    var type = fleeing && b.condition === "Storm" ? "Ride Out Storm" : "Outrun";
    return { type: type, dr: clamp(en.rating, 0, 8), extra: extra.filter(function (x) { return x.value; }) };
  }

  function doChase(state, game) {
    var b = game.battle;
    if (b.step !== "chase" && b.step !== "press") throw new Error("Not the moment for that.");
    b.step = "chase";
    return M().roll(state, game, chaseCheck(state, b), "chase", {}, []);
  }

  function settleChase(state, game, p) {
    var b = game.battle, c = b.chase;
    if (c.mode === "flee") return escape(state, game, p.outcome);
    say(state, game, L().caught[p.outcome]);
    if (p.outcome === "setback") {
      var faster = fleetSpeed(state, b) > ship(state, b, b.pairs.flagship).speed;
      if (faster && game.batch && game.batch.next < game.batch.n) { b.step = "press"; return; }
      return letHerGo(state, game);
    }
    if (p.outcome === "clean") b.posBonus = 1;
    if (c.then === "grapple") { b.step = "grapple"; return; }
    startRound(state, game);
  }

  // Pressing the chase spends the batch's next prize roll (§22.8).
  function press(state, game, yes) {
    var b = game.battle;
    if (b.step !== "press") throw new Error("Not the moment for that.");
    if (!yes) return letHerGo(state, game);
    game.batch.next += 1;
    say(state, game, L().pressed);
    return doChase(state, game);
  }

  function letHerGo(state, game) {
    var b = game.battle;
    fightingEnemies(b).forEach(function (e) { e.out = "escaped"; });
    endBattle(state, game);
  }

  // The player flees: clean escapes, partial escapes with a parting light
  // hit, setback is caught (they get +1 to Position). Fleet ships try too.
  function escape(state, game, outcome) {
    var b = game.battle, en = lead(b);
    say(state, game, L().fled[outcome]);
    if (outcome === "setback") { b.posBonus = -1; startRound(state, game); return; }
    if (outcome === "partial" && en) hit(state, game, b, en.id, "flagship", false, "round");
    // Fleet ships flee by the speed table; those that fail are taken (DEFAULT).
    fleet(state).forEach(function (f) {
      if (f.kind !== "fleet" || f.out) return;
      var p = 1 - fleeChance((en ? ship(state, b, en.id).speed : 0) - ship(state, b, f.id).speed, 0);
      if (!chance(state, game, "fleetflee", p)) finishEnemyOrMine(state, game, b, f.id, "captured");
    });
    b.over = "fled";
    b.step = "over";
    fightingEnemies(b).forEach(function (e) { e.out = e.out || "left"; });
  }

  // A pirate hunter engages: fight or flee (§21.10).
  function hunterChoice(state, game, what) {
    var b = game.battle;
    if (b.step !== "hunterChoice") throw new Error("Not the moment for that.");
    if (what === "fight") return startRound(state, game);
    PC.crew.addMorale(state, H().FLEE_MORALE); // fleeing costs morale (§24.2)
    b.chase = { mode: "flee", then: "round" };
    b.step = "chase";
  }

  // ---- Boarding (§21.12) -------------------------------------------------------------

  function newBoard(state, b, meBoarding) {
    var e = lead(b);
    return { meBoarding: meBoarding, clash: 0, sf: 0, rallyNext: 0, enemyNext: 0, shotDone: false,
      startMe: state.crew.count, startEn: e.crew, enemy: e.id };
  }

  function doGrapple(state, game) {
    var b = game.battle;
    if (b.step !== "grapple") throw new Error("Not the moment for that.");
    var en = lead(b);
    var extra = (b.closeBonus ? [{ label: "Closed on her", value: 1 }] : []).concat(weatherParts(state, b, "grapple"));
    return M().roll(state, game, { type: "Board", dr: clamp(en.rating, 0, 8), extra: extra }, "grapple", {}, ["Battle"]);
  }

  function settleGrapple(state, game, p) {
    var b = game.battle, en = lead(b);
    b.closeBonus = 0;
    say(state, game, L().grapple[p.outcome]);
    if (p.outcome === "setback") { hit(state, game, b, en.id, "flagship", false, "grape"); afterBeat(state, game); if (!b.over && b.step !== "retarget") startRound(state, game); return; }
    if (p.outcome === "partial") hit(state, game, b, en.id, "flagship", false, "grape");
    b.board = newBoard(state, b, true);
    afterBeat(state, game, true);
    if (b.over) return;
    toStrikeFirst(state, game);
  }

  // Repel Boarders (§21.19): Board against her captain's rating.
  function doRepel(state, game) {
    var b = game.battle;
    if (b.step !== "repel") throw new Error("Not the moment for that.");
    return M().roll(state, game, { type: "Board", dr: clamp(lead(b).rating, 0, 8), extra: weatherParts(state, b, "repel") }, "repel", {}, ["Battle"]);
  }

  function settleRepel(state, game, p) {
    var b = game.battle, en = lead(b);
    say(state, game, L().repel[p.outcome]);
    if (p.outcome === "clean") { hit(state, game, b, "flagship", en.id, false, "grape"); afterBeat(state, game); if (!b.over && b.step !== "retarget") startRound(state, game); return; }
    if (p.outcome === "partial") hit(state, game, b, "flagship", en.id, false, "grape");
    b.board = newBoard(state, b, false);
    afterBeat(state, game, true);
    if (b.over) return;
    toStrikeFirst(state, game);
  }

  // Strike First opens every boarding (§11.4): an automatic roll.
  function toStrikeFirst(state, game) {
    var b = game.battle;
    b.step = "strikeFirst";
    return M().roll(state, game, { type: "Strike First", dr: clamp(lead(b).rating, 0, 8) }, "strikeFirst", {}, ["Battle"]);
  }

  function settleStrikeFirst(state, game, p) {
    var b = game.battle;
    b.board.sf = p.outcome === "clean" ? 1 : p.outcome === "setback" ? -1 : 0;
    b.board.sfOutcome = p.outcome;
    say(state, game, L().strikeFirst[p.outcome]);
    b.step = "clash";
  }

  function wounded(state) { return hasTag(state, "Wounded"); }
  function meleeType(state) {
    var items = state.captain.items || [];
    return items.some(function (i) { return /club|cudgel|knuckle|belaying|brawl/i.test(i); }) ? "Brawling" : "Swordsmanship";
  }
  function gunBonus(state) {
    var items = state.captain.items || [];
    var GUN = { "Simple Flintlock Pistol": 0, "Sea-Service Pistol": 1, "Dueling Pistol": 2, "Family Pistol": 2 };
    var best = null;
    items.forEach(function (i) { if (i in GUN && (best == null || GUN[i] > best)) best = GUN[i]; });
    return best;
  }

  // The captain's five personal actions (§21.12), with what each needs.
  function actions(state, b) {
    var en = lead(b), bd = b.board, list = [];
    var dr = clamp(en.rating, 0, 8);
    var w = wounded(state);
    list.push({ id: "lead", label: "Lead the Charge", check: { type: meleeType(state), dr: dr, cond: ["Lead the Charge"] }, lock: w ? "Not while you're Wounded" : null,
      note: "Clean: +2 on this clash, partial +1. A setback means you're Wounded." });
    list.push({ id: "rally", label: "Rally", check: { type: "Rally Crew", dr: dr }, note: "+1 on the next clash on a partial or better." });
    list.push({ id: "hold", label: "Hold the Deck", check: { type: "Hold Your Ground", dr: dr }, note: "Halves your losses this clash on a partial or better." });
    list.push({ id: "duel", label: "Seek their captain", check: { type: meleeType(state), dr: dr, cond: ["Duel"] },
      lock: w ? "Not while you're Wounded" : b.dueled ? "There's no second duel in a battle" : en.hunter ? null : null,
      note: "A duel. Clean: she rolls to strike at once and her crew is leaderless for the battle. Setback: you're Wounded and they get +1 on the next clash." });
    list.push({ id: "demand", label: "Demand Surrender", check: { type: "Intimidate", dr: clamp(effResolve(en), 0, 8), extra: dreadBonus(state) ? [{ label: "Dread", value: dreadBonus(state) }] : [] },
      note: "Clean: they strike, no clash. Partial: they're shaken (−1 Resolve for the battle)." });
    return list;
  }

  function doAction(state, game, id) {
    var b = game.battle;
    if (b.step !== "clash") throw new Error("Not the moment for that.");
    var a = actions(state, b).filter(function (x) { return x.id === id; })[0];
    if (!a) throw new Error("Unknown action.");
    if (a.lock) throw new Error(a.lock);
    b.board.action = id;
    // The boarding shot: one Marksmanship shot a boarding, at the first
    // Lead the Charge or to open a duel (§21.12, §32.10).
    var gb = gunBonus(state);
    if ((id === "lead" || id === "duel") && !b.board.shotDone && gb != null) {
      b.board.shotDone = true;
      return M().roll(state, game, { type: "Marksmanship", dr: clamp(lead(b).rating, 0, 8), extra: (gb ? [{ label: "The pistol", value: gb }] : []).concat(weatherParts(state, b, "firearms")) }, "shot", { then: id }, ["Battle"]);
    }
    return rollAction(state, game, a);
  }

  // Duels and Lead the Charge carry their own condition, so items like the
  // Rare swords (§32.8) can read it.
  function rollAction(state, game, a) {
    var cond = ["Battle"].concat(a.check && a.check.cond || []);
    return M().roll(state, game, a.check, "act_" + a.id, {}, cond);
  }

  function settleShot(state, game, p) {
    var b = game.battle;
    say(state, game, L().shot[p.outcome]);
    b.board.shotHit = p.outcome === "clean";
    var a = actions(state, b).filter(function (x) { return x.id === p.data.then; })[0];
    return rollAction(state, game, a);
  }

  function settleAction(state, game, p) {
    var b = game.battle, bd = b.board, e = lead(b), id = p.op.slice(4);
    var mod = 0, hold = false;
    if (id === "lead") {
      say(state, game, L().lead[p.outcome]);
      if (bd.shotHit) { loseCrew(state, game, b, e.id, 1); bd.shotHit = false; }
      if (p.outcome === "clean") mod = 2; else if (p.outcome === "partial") mod = 1;
      else PC.scenes.applyEffect(state, { tag: "Wounded", untilSeasonEnd: true });
    } else if (id === "rally") {
      say(state, game, L().rally[p.outcome]);
      if (p.outcome !== "setback") bd.rallyNext = 1;
    } else if (id === "hold") {
      say(state, game, L().hold[p.outcome]);
      hold = p.outcome !== "setback";
    } else if (id === "duel") {
      b.dueled = true;
      if (p.outcome === "clean") {
        say(state, game, L().duel.clean);
        game.duelsWon = (game.duelsWon || 0) + 1;
        e.leaderless = true;
        if (strikeRoll(state, game, b, e, crewAdvantage(state, b, "flagship", e.id), "duel")) return afterBoardingOut(state, game);
      } else if (p.outcome === "partial") say(state, game, L().duel.partial);
      else { say(state, game, L().duel.setback); PC.scenes.applyEffect(state, { tag: "Wounded", untilSeasonEnd: true }); bd.enemyNext += 1; }
    } else if (id === "demand") {
      // A clean demand shows only the surrender line (B40 of the M5 playtest).
      say(state, game, L().demand[p.outcome]);
      if (p.outcome === "clean") { e.demanded = true; knockOut(state, game, b, e, "struck", true); return afterBoardingOut(state, game); }
      e.refusedDemand = true; // the Quarter Asked Article's test (§22.7)
      if (p.outcome === "partial") shake(e, 1);
    }
    return clash(state, game, mod, hold);
  }

  // The crew clash: 2d6 + Crew Rating + Crew Advantage + modifiers.
  function clash(state, game, mod, hold) {
    var b = game.battle, bd = b.board, e = lead(b);
    bd.clash += 1;
    var adv = crewAdvantage(state, b, "flagship", e.id);
    var parts = [
      { label: "Crew Rating", value: PC.crew.crewRating(state) }, { label: "Crew Advantage", value: adv },
      { label: "Raider aboard", value: onFlagship(state, "Raider") ? 1 : 0 },
      { label: "Ships alongside", value: perk(state, b, "board") - enemyPerk(state, b, "board", e.id) },
      { label: "Your action", value: mod }, { label: "Rallied", value: bd.rallyNext },
      { label: "Strike First", value: bd.clash === 1 ? bd.sf : 0 }, { label: "Their captain's blood", value: -bd.enemyNext },
    ].filter(function (x) { return x.value; });
    bd.rallyNext = 0; bd.enemyNext = 0;
    var edge = parts.reduce(function (a, x) { return a + x.value; }, 0);
    var r = rawRoll(state, game, "clash", edge);
    b.lastClash = { outcome: r.outcome, dice: r.dice, edge: r.edge, parts: parts };
    markRoll(game, "The clash", r);
    M().setRollEffect(game, { clean: "your boarders cut hers down", partial: "men fall on both sides", setback: "her crew drive yours back" }[r.outcome]);
    say(state, game, L().clash[r.outcome]);
    var me = ship(state, b, "flagship"), them = ship(state, b, e.id);
    var lossFor = function (winnerAdv, loserCrew) {
      var row = H().BOARD_LOSS[String(clamp(winnerAdv, -4, 3))];
      return Math.min(loserCrew, Math.max(row[1], Math.round(loserCrew * row[0])));
    };
    if (r.outcome === "clean") {
      loseCrew(state, game, b, e.id, lossFor(adv, them.crew));
    } else if (r.outcome === "partial") {
      var half = function (a, crew) { return Math.max(1, Math.ceil(lossFor(a, crew) / 2)); };
      var small = function (crew) { return prnd(state, game, crew * H().CLASH_PARTIAL_BIG); };
      var myLoss = adv < 0 ? half(-adv, me.crew) : small(me.crew);
      var enLoss = adv > 0 ? half(adv, them.crew) : small(them.crew);
      if (adv === 0) { myLoss = small(me.crew); enLoss = small(them.crew); }
      if (hold) myLoss = Math.floor(myLoss / 2);
      loseCrew(state, game, b, "flagship", myLoss); loseCrew(state, game, b, e.id, enLoss);
    } else {
      var loss = adv < 0 ? lossFor(-adv, me.crew) : prnd(state, game, me.crew * H().CLASH_SETBACK);
      if (hold) loss = Math.floor(loss / 2);
      loseCrew(state, game, b, "flagship", loss);
    }
    checkHalfCrew(state, b, e);
    // The background fights on after every boarding beat (§21.9).
    background(state, game);
    // Her crew broken, or a clean clash's strike roll (Crew Advantage).
    if (e.crew < H().CREW_LINE * e.startCrew) { knockOut(state, game, b, e, "captured"); return afterBoardingOut(state, game); }
    if (r.outcome === "clean" && !e.hunter) {
      if (strikeRoll(state, game, b, e, crewAdvantage(state, b, "flagship", e.id), "clash")) return afterBoardingOut(state, game);
    }
    if (state.crew.count < H().CREW_LINE * bd.startMe) {
      if (bd.meBoarding) { say(state, game, L().repelled); b.board = null; afterBeat(state, game, true); if (!b.over && b.step !== "retarget") startRound(state, game); return; }
      say(state, game, L().overrun);
      return flagshipLost(state, game, "overrun");
    }
    afterBeat(state, game, true);
    if (b.over || b.step === "retarget") return;
    if (bd.clash >= 3) { say(state, game, L().fallBack); b.board = null; return startRound(state, game); }
    b.step = "clash";
  }

  function afterBoardingOut(state, game) {
    var b = game.battle;
    b.board = null;
    afterBeat(state, game, true);
    if (b.over || b.step === "retarget") return;
    afterEnemyOut(state, game);
  }

  // ---- Losing, and the end -------------------------------------------------------

  // The flagship is lost (§21.14): struck, overrun, knocked out or sunk.
  // In the prototype every one of these ends the run (Milestone 5 plan).
  function flagshipLost(state, game, how) {
    var b = game.battle;
    b.over = "lost"; b.lostHow = how;
    if (how === "sunk" || (how === "out" && sinksAnyway(state, game, b))) {
      say(state, game, L().sinking);
      b.step = "endure";
      return;
    }
    say(state, game, L().lost);
    b.step = "over";
    game.gameOver = { how: "captured" };
  }

  // Pirates sink a knocked-out flagship 25% of the time; always if Bloody
  // (§21.9, accepted default). Everyone else takes her.
  function sinksAnyway(state, game, b) {
    var e = lead(b);
    if (!e || e.flag !== "Pirate") return false;
    return chance(state, game, "pirateSink", 0.25);
  }

  // The Endure check when the flagship sinks (§21.14).
  function doEndure(state, game) {
    var b = game.battle;
    if (b.step !== "endure") throw new Error("Not the moment for that.");
    return M().roll(state, game, { type: "Endure", dr: 2 }, "endure", {}, []);
  }
  function settleEndure(state, game, p) {
    var b = game.battle;
    b.step = "over";
    game.gameOver = { how: p.outcome === "setback" ? "died" : "captured", endure: p.outcome };
  }

  function endBattle(state, game) {
    var b = game.battle;
    if (b.over) return;
    b.over = "done";
    b.step = "over";
    b.captured = b.enemies.filter(function (e) { return e.out === "struck" || e.out === "captured"; }).map(function (e) { return e.id; });
  }

  function settle(state, game, p) {
    switch (p.op) {
      case "position": return settlePosition(state, game, p);
      case "chase": return settleChase(state, game, p);
      case "grapple": return settleGrapple(state, game, p);
      case "repel": return settleRepel(state, game, p);
      case "strikeFirst": return settleStrikeFirst(state, game, p);
      case "shot": return settleShot(state, game, p);
      case "endure": return settleEndure(state, game, p);
      case "show": return settleShow(state, game, p);
    }
    if (p.op.indexOf("act_") === 0) return settleAction(state, game, p);
    return null;
  }

  // The show of force (§21.10): a Prize Taker's Intimidate before the roll.
  function showOfForce(state, game, yes) {
    var b = game.battle;
    if (b.step !== "showOfForce") throw new Error("Not the moment for that.");
    if (!yes) { b.step = "strikePre"; return strikePre(state, game, 0); }
    var res = Math.max.apply(null, fightingEnemies(b).map(effResolve));
    return M().roll(state, game, { type: "Intimidate", dr: clamp(res, 0, 8) }, "show", {}, []);
  }
  // What a checked battle roll did, for the roll list (N4). The words
  // follow each option's own note on the screen.
  var ROLL_EFFECT = {
    position: { clean: "you have the position", partial: "+1 on this round's Exchange", setback: "−1 on this round's Exchange" },
    chase: { clean: "you catch her, +1 on your first Position", partial: "you catch her", setback: "she gets away" },
    flee: { clean: "you get away", partial: "you get away, with a parting hit", setback: "she catches you, +1 to her Position" },
    grapple: { clean: "you're aboard", partial: "you're aboard, but she sweeps your deck with grape", setback: "they cut your grapples" },
    repel: { clean: "you cut her grapples and rake her", partial: "they're aboard, but pay for it", setback: "they're aboard" },
    strikeFirst: { clean: "you get the jump: +1 on the first clash", partial: "neither side gets the jump", setback: "they get the jump: −1 on the first clash" },
    shot: { clean: "the shot finds its mark", partial: "a glancing hit", setback: "the shot goes wide" },
    endure: { clean: "you hold on", partial: "you hold on, barely", setback: "the sea takes you" },
    show: { clean: "+1 on the strike roll", partial: "no harm done", setback: "no harm done" },
  };
  function rollEffect(state, game, op, outcome) {
    var b = game.battle || {};
    var key = op === "chase" && b.chaseMode === "flee" ? "flee" : op;
    if (/^act_/.test(op)) return null; // a boarding action's own lines say what it did
    return (ROLL_EFFECT[key] || {})[outcome] || null;
  }

  function settleShow(state, game, p) { game.battle.step = "strikePre"; return strikePre(state, game, p.outcome === "clean" ? 1 : 0); }

  function engage(state, game) {
    var b = game.battle;
    if (b.step !== "setup") throw new Error("Not the moment for that.");
    startStrike(state, game);
  }

  // ---- What the screen shows ------------------------------------------------------

  function shipLine(state, b, id) {
    var s = ship(state, b, id);
    if (!s) return null;
    var e = enemyRec(b, id);
    return { id: id, cls: s.cls, name: s.name || null, flag: s.flag || null, hull: Math.round(s.hull), hullMax: s.hullMax, guns: s.guns, gunsMax: s.gunsMax,
      crew: s.crew, startCrew: s.startCrew, speed: s.speed, out: (e && e.out) || s.out || null, shaken: e ? e.shaken || 0 : 0, leaderless: e ? !!e.leaderless : false,
      captain: s.captain || null, title: s.title || null, mine: !!s.mine, kind: s.kind || null, escort: !!(e && e.escort), hunter: !!(e && e.hunter), role: s.role };
  }

  function view(state, game) {
    var b = game.battle;
    if (!b) return null;
    var en = lead(b);
    var v = {
      step: b.step, round: b.round, over: b.over, lostHow: b.lostHow || null, condition: b.condition || null,
      enemies: b.enemies.map(function (e) { return shipLine(state, b, e.id); }),
      mine: ["flagship"].concat(fleet(state).filter(function (f) { return !f.out || b.startCrew[f.id] != null; }).map(function (f) { return f.id; })).map(function (id) { return shipLine(state, b, id); }),
      target: b.pairs.flagship || null, pairs: b.pairs, support: b.support, enemySupport: b.enemySupport,
      ca: en && !en.out ? pairCA(state, b, "flagship", en.id) : null, fleetCA: fightingEnemies(b).length ? fleetCA(state, b) : null,
      fleetSpeed: fleetSpeed(state, b), openRange: b.openRange, gunnersEye: hasTag(state, "Gunner's Eye"),
      lastExchange: b.lastExchange || null, lastClash: b.lastClash || null, lastStrike: b.lastStrike || null, preStrike: b.preStrike || null,
      board: b.board ? { clash: b.board.clash, meBoarding: b.board.meBoarding, sf: b.board.sfOutcome || null } : null,
      fleetOrder: b.fleetOrder, chaseMode: b.chase ? b.chase.mode : null,
      canPress: b.step === "press",
    };
    if (b.step === "position") v.check = positionCheck(state, b);
    if (b.step === "exchange") v.exchange = exchangeEdge(state, b);
    if (b.step === "grapple") v.check = { type: "Board", dr: clamp(en.rating, 0, 8), extra: b.closeBonus ? [{ label: "Closed on her", value: 1 }] : [] };
    // The Decision's Board her shows the grapple's odds (B37).
    if (b.step === "decision" && en) v.grappleCheck = { type: "Board", dr: clamp(en.rating, 0, 8) };
    if (b.step === "posChoice" && en) v.grappleCheck = { type: "Board", dr: clamp(en.rating, 0, 8), extra: [{ label: "Closed on her", value: 1 }] };
    if (b.step === "repel") v.check = { type: "Board", dr: clamp(en.rating, 0, 8) };
    if (b.step === "chase" || b.step === "press") v.check = chaseCheck(state, b);
    if (b.step === "clash") v.actions = actions(state, b);
    if (b.step === "endure") v.check = { type: "Endure", dr: 2 };
    if (b.step === "showOfForce") v.check = { type: "Intimidate", dr: clamp(Math.max.apply(null, fightingEnemies(b).map(effResolve)), 0, 8) };
    return v;
  }

  PC.combat = {
    rollEffect: rollEffect,
    weatherParts: weatherParts,
    caBand: caBand, caName: caName, br: br, manned: manned, ship: ship, dreadBonus: dreadBonus, playerGunnery: playerGunnery,
    fleetSpeed: fleetSpeed, fleetCA: fleetCA, pairCA: pairCA, fleeChance: fleeChance, effResolve: effResolve,
    begin: begin, engage: engage, setTarget: setTarget, assignFleetShip: assignFleetShip, showOfForce: showOfForce,
    hunterChoice: hunterChoice, doPosition: doPosition, choosePosition: choosePosition, doExchange: doExchange,
    decide: decide, doChase: doChase, press: press, doGrapple: doGrapple, doRepel: doRepel, doAction: doAction,
    doEndure: doEndure, startRound: startRound, settle: settle, view: view, actions: actions,
    setFleetOrder: function (state, game, o) { game.battle.fleetOrder = o === "sink" ? "sink" : "take"; },
    retarget: function (state, game, id) { var b = game.battle; if (b.step !== "retarget") throw new Error("Not the moment for that."); setTarget(state, game, id); startRound(state, game); },
    // exposed for tests
    _hit: hit, _strikeRoll: strikeRoll, _enemyIntent: enemyIntent, _clash: clash, _lead: lead,
  };
})();
