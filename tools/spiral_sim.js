/* Pirate Chronicle — the spiral test (P12 of the build 0.9 playtest pins).
 * A royal sloop based at Norfolk, no letter, no fence there, 0 crew gold
 * and 5 lots aboard: how many seasons until crew gold recovers to 1,000?
 * Played with and without hardtack, on the real engine.
 *
 *   node tools/spiral_sim.js [runs] [--seasons 12] [--gold 0] [--trace]
 *
 * The policy, each season: buy food for a three-action hunt (ordinary lots
 * first; with hardtack on, hardtack for whatever the gold can't cover in
 * ordinary lots); hunt from Norfolk with the hunt simulator's choices
 * (with no food and no gold, the captain hunts one hungry action anyway,
 * as the playtester did);
 * come home (the port fee and the wounded's payouts as in play); sell every
 * clean good to the provisioner; repair what the gold allows after food.
 * Dirty cargo: Forge a Clearance once a season (1 action) when there's
 * dirty cargo and an action to spare, then sell what it cleared; when the
 * hold has no room for food, the cheapest dirty goods go over the side.
 * A captain with no food for one action, and no gold to buy any, sits the
 * season out only when the crew is below her minimum. Winter is held (no split). Voyage events are off, as in
 * tools/hunt_sim.js.
 */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..");
[
  "js/rng.js", "js/checks.js", "js/meters.js", "js/letters.js", "js/state.js", "js/text.js", "js/npcs.js", "js/crew.js", "js/articles.js", "js/node.js", "js/scenes.js", "js/quests.js", "js/officers.js", "js/rumors.js", "js/validate.js", "js/creator.js", "js/minigames.js", "js/salvage.js", "js/drinking.js", "js/liarsdice.js", "js/hunt_gen.js", "js/combat.js", "js/hunt.js", "js/summary.js", "js/world.js", "js/weather.js", "js/voyage_events.js", "js/norfolk.js", "js/inspections.js", "js/forgery.js", "js/admiralty.js", "js/prison.js", "js/devtools.js",
  "content/check_types.js", "content/modifiers.js", "content/creator.js", "content/ships.js", "content/names.js", "content/economy.js", "content/articles.js",
  "content/test_captain.js", "content/test_scenes.js", "content/ocracoke.js", "content/ocracoke_scenes.js", "content/quests.js", "content/rumors.js", "content/officer_lines.js", "content/minigames.js", "content/hunt.js", "content/world.js", "content/weather.js", "content/voyage_events.js", "content/norfolk.js", "content/norfolk_scenes.js", "content/inspection_scenes.js", "content/admiralty_scenes.js", "content/prison.js",
].forEach(function (f) { require(path.join(root, f)); });
var PC = globalThis.PC;
PC.voyageEvents.off = true; // the hunt simulator's convention: no voyage events on the legs

var RUNS = Number(process.argv[2]) || 200;
var GOLD = (function () { var i = process.argv.indexOf("--gold"); return i >= 0 ? Number(process.argv[i + 1]) : 0; })(); // starting crew gold
var TRACE = process.argv.indexOf("--trace") >= 0; // print each season of each run
var SEASONS = (function () { var i = process.argv.indexOf("--seasons"); return i >= 0 ? Number(process.argv[i + 1]) : 12; })();

function setup(seed) {
  var s = PC.state.newGame(PC.data.testCaptain, { seed: seed });
  PC.devtools.skipQuests(s);
  s.current = { screen: "node" };
  s.articles = { terms: PC.articles.defaults(), greed: 0, signed: { year: 1755, season: 0 } };
  s.time.year = 1755; s.time.season = 0; s.ap.left = 7;
  // A royal sloop as the flagship, crewed at 40% of her berths (18 hands).
  var c = PC.data.hunt.CLASSES["Royal Sloop"];
  s.ship = { name: "Sim", type: "Royal Sloop", hull: c.hull, hullMax: c.hull, baseHull: c.hull, guns: c.guns, gunsMax: c.guns, cargo: c.cargo, size: c.size,
    crewMin: c.crewMin, crewMax: c.crewMax, speed: c.speed, speedMax: c.speed, handling: c.handling, rigging: "sound", upgrades: { hull: 1, rigging: 1, guns: 1 }, dirty: false };
  var want = Math.round(c.crewMax * 0.4), add = want - s.crew.count;
  if (add > 0) PC.crew.addHands(s, "Able", add);
  else if (add < 0) { s.crew.tiers.Green = Math.max(0, (s.crew.tiers.Green || 0) + add); s.crew.count = want; }
  s.crew.morale = 45; s.crew.pressure = 0;
  s.money.crew = GOLD; s.money.purse = 0; s.provisions = 5; s.hardtack = 0;
  s.cargo = { goods: {}, treasure: { clean: 0, dirty: 0 } };
  s.location = { node: "norfolk", place: null, queue: [] };
  PC.node.initNode(s, "norfolk");
  s.seen = s.seen || {};
  s.meters.standing.avalon = 10; // welcome at Norfolk
  s.flags.devForceEvent = null;
  return s;
}

function policyScout(s, g, v) {
  var sc = v.scout;
  if (sc.ships.length > 1 && sc.shape === "escort") return false;
  if (sc.ships.some(function (x) { return x.warship; })) return sc.ca >= 2;
  if (sc.ships.some(function (x) { return x.role === "Hybrid"; })) return sc.ca >= 0;
  return sc.ca >= -1;
}

function battleStep(s, g, bv) {
  var B = function (fn) { return PC.hunt.battle.apply(null, [s, g, fn].concat([].slice.call(arguments, 1))); };
  var en = bv.enemies.filter(function (e) { return e.id === bv.target; })[0] || bv.enemies.filter(function (e) { return !e.out; })[0];
  var me = bv.mine[0], ratio = en ? me.crew / Math.max(1, en.crew) : 1;
  var wantBoard = ratio >= 0.75 || (en && en.hull < en.hullMax / 2 && ratio >= 0.5);
  switch (bv.step) {
    case "setup": return B("engage");
    case "showOfForce": return B("showOfForce", true);
    case "hunterChoice": return B("hunterChoice", bv.ca >= 0 ? "fight" : "flee");
    case "chase": return B("doChase");
    case "press": return B("press", true);
    case "position": return B("doPosition");
    case "posChoice": return B("choosePosition", wantBoard ? "close" : "rake");
    case "exchange": return B("doExchange", wantBoard ? "grape" : "round");
    case "decision":
      if (me.hull < 0.6 * me.hullMax || me.crew < 0.5 * PC.combat.ship(s, g.battle, "flagship").startCrew) return B("decide", "flee");
      return B("decide", wantBoard ? "board" : "fire");
    case "grapple": return B("doGrapple");
    case "repel": return B("doRepel");
    case "clash":
      var acts = bv.actions.filter(function (a) { return !a.lock; });
      var pick = acts.filter(function (a) { return a.id === "lead"; })[0] || acts.filter(function (a) { return a.id === "demand"; })[0] || acts[0];
      return B("doAction", pick.id);
    case "retarget": return B("retarget", bv.enemies.filter(function (e) { return !e.out; })[0].id);
    case "endure": return B("doEndure");
  }
  throw new Error("battle stuck at " + bv.step);
}

function perAction(s) { return Math.ceil(PC.world.headsAtSea(s) / 5 * (PC.state.seasonName(s) === "Winter" ? 1.5 : 1)); }

function hunt(s) {
  var g = PC.hunt.start(s), steps = 0;
  while (!g.over && steps++ < 400) {
    if (g.pending) { PC.minigames.settle(s); PC.hunt.checkBattleOver(s, g); continue; }
    var v = PC.minigames.view(s);
    if (v.phase === "gameover") { g.over = true; break; }
    if (v.phase === "vote") { if (g.vote.step === "pre") PC.hunt.vote(s, g, null); else PC.hunt.voteReact(s, g, Object.keys(PC.hunt.VOTE_REACT)[1]); continue; }
    if (v.phase === "empty") { PC.hunt.next(s, g); continue; }
    if (v.phase === "scout") { if (policyScout(s, g, v)) PC.hunt.engage(s, g); else PC.hunt.next(s, g); continue; }
    if (v.phase === "hunter") { PC.hunt.meetHunter(s, g); continue; }
    if (v.phase === "battle") { battleStep(s, g, v.battle); continue; }
    if (v.phase === "after") {
      if (!v.after.repairDone) { PC.hunt.doRepair(s, g); continue; }
      if (v.after.prize) { var pr = v.after.prize; PC.hunt.settlePrize(s, g, { hull: "release", crew: pr.volunteers ? "recruit" : "release", captives: "free" }); continue; }
      PC.hunt.carryOn(s, g); continue;
    }
    if (v.phase === "batchEnd") {
      var ok = s.ship.hull >= 0.4 * s.ship.hullMax && s.crew.count >= s.ship.crewMin && PC.crew.slotsFree(s) > 5 && PC.crew.food(s) >= perAction(s);
      if (ok && v.canContinue && v.canContinue.ok) PC.hunt.anotherBatch(s, g); else PC.hunt.sailHome(s, g);
      continue;
    }
    throw new Error("stuck in " + v.phase);
  }
  if (g.gameOver) return "lost";
  // Straight home: skip the leg-back event so the arrival runs here.
  s.minigame = null;
  PC.node.arrive(s, "norfolk", { fromHunt: true });
  s.location.queue = []; s.location.popup = null;
  s.current = { screen: "node" };
  return "ok";
}

function buyFood(s, hardtack) {
  var need = Math.max(0, perAction(s) * 3 - PC.crew.food(s));
  if (!need) return;
  var pp = PC.node.provisionsPrice(s), n = Math.min(need, Math.floor(s.money.crew / pp), PC.crew.slotsFree(s));
  if (n > 0) PC.node.buyProvisions(s, n);
  need -= Math.max(0, n);
  if (hardtack && need > 0) {
    var hp = PC.node.hardtackPrice(s), h = Math.min(need, Math.floor(s.money.crew / hp), PC.crew.slotsFree(s));
    if (h > 0) PC.node.buyHardtack(s, h);
  }
}

// Forge a Clearance (§20.3) and sell what it cleared.
function forge(s) {
  if (!PC.forgery.stacks(s).length || s.ap.left < 2) return;
  var c = PC.forgery.canForge(s);
  if (!c.ok) return;
  var f = PC.forgery.roll(s);
  if (f.budget && !f.done) PC.forgery.apply(s, PC.forgery.defaultPicks(s, f.budget));
  PC.node.sellAll(s, "provisioner");
}

// Make room for a hunt's food: the cheapest dirty goods over the side.
function makeRoom(s) {
  var want = perAction(s) * 3 - PC.crew.food(s) - PC.crew.slotsFree(s);
  if (want <= 0) return;
  var dirty = Object.keys(s.cargo.goods).filter(function (g) { return s.cargo.goods[g].dirty; })
    .sort(function (a, b) { return PC.data.goods[a].base - PC.data.goods[b].base; });
  dirty.forEach(function (g) { if (want <= 0) return; var n = Math.min(want, s.cargo.goods[g].dirty); PC.crew.jettison(s, g, n, true); want -= n; });
}

function run(seed, hardtack) {
  var s = setup(seed);
  for (var season = 1; season <= SEASONS; season++) {
    forge(s);
    while (s.ap.left >= 1 && !s.gameOver) {
      makeRoom(s);
      buyFood(s, hardtack);
      if (s.crew.count < s.ship.crewMin) return { seasons: null, why: "short-handed" };
      if (hunt(s) === "lost") return { seasons: null, why: "lost" };
      PC.node.sellAll(s, "provisioner");
      var miss = s.ship.hullMax - s.ship.hull, per = PC.node.repairPerHp(s);
      var fix = Math.min(miss, Math.floor(Math.max(0, s.money.crew - perAction(s) * 3 * PC.node.provisionsPrice(s)) / per));
      if (fix > 0) { try { PC.node.repair(s, fix); } catch (e) { /* an action short */ } }
      if (s.money.crew >= 1000) return { seasons: season, morale: s.crew.morale };
    }
    if (TRACE) console.log("  " + seed + (hardtack ? " (hardtack)" : "") + " season " + season + ": crew gold " + s.money.crew + ", food " + PC.crew.food(s) + " (" + (s.hardtack || 0) + " hardtack), hold " + PC.crew.slotsUsed(s) + "/" + PC.crew.holdCapacity(s) +
      " (dirty " + PC.crew.goodsUnits(s, "dirty") + " goods, " + s.cargo.treasure.dirty + " treasure), hull " + s.ship.hull + "/" + s.ship.hullMax + ", crew " + s.crew.count + ", morale " + s.crew.morale + ", AP left " + s.ap.left);
    var t = PC.world.endSeason(s);
    if (s.gameOver) return { seasons: null, why: "over" };
    if (s.split) { PC.world.holdSplit(s); s.split = null; s.current = { screen: "node" }; if (s.time.season === 3 && s.ap.left === 0) PC.state.advanceSeason(s); }
    if (s.money.crew >= 1000) return { seasons: season, morale: s.crew.morale };
  }
  return { seasons: null, why: "not within " + SEASONS };
}

function report(hardtack) {
  var got = [], fail = {}, mor = 0;
  for (var i = 0; i < RUNS; i++) {
    var r;
    try { r = run("spiral-" + i, hardtack); } catch (e) { r = { seasons: null, why: "error: " + e.message }; }
    if (r.seasons) { got.push(r.seasons); mor += r.morale; } else fail[r.why] = (fail[r.why] || 0) + 1;
  }
  got.sort(function (a, b) { return a - b; });
  var med = got.length ? got[Math.floor(got.length / 2)] : "-";
  console.log((hardtack ? "WITH hardtack:    " : "WITHOUT hardtack: ") + got.length + " of " + RUNS + " recover to 1,000 crew gold within " + SEASONS + " seasons; median " + med + " season(s)" +
    (got.length ? ", mean morale then " + Math.round(mor / got.length) : "") + (Object.keys(fail).length ? "; the rest: " + JSON.stringify(fail) : ""));
}

console.log("The spiral test: a royal sloop at Norfolk, no letter, " + GOLD + " crew gold, 5 lots (" + RUNS + " runs)");
report(false);
report(true);
