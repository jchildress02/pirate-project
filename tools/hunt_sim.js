/* Pirate Chronicle — the hunt, played automatically (Milestone 5 plan, §2A).
 * Runs the real engine thousands of times with a simple captain's policy
 * and reports gold per action, prizes, losses and battle lengths.
 *
 *   node tools/hunt_sim.js [hunts] [--old] [--hull10] [--grape4] [--grapeguns] [--bands]
 *                          [--season Spring|Summer|Hurricane|Winter] [--weather]
 *
 * Milestone 7: weather (§42.12). Every batch rolls its condition from the
 * season's outlook, as in play. --season picks the season (default Spring,
 * 1755 so Hurricane isn't the fixed Foul 1754); --weather prints how often
 * each condition came up.
 *
 * Milestone 6's balance check: --hull10 counts hull ÷ 10 in Battle Rating
 * (P12b); --grape4 doubles grapeshot again (P13a); --grapeguns takes
 * grapeshot losses from the attacker's manned guns (P13b); --bands prints
 * how often each odds band comes up when scouting.
 *
 * M9 PR 3 (D11): --bounty takes one Admiralty bounty in the Hatteras Banks
 * before each hunt (--rumor: its rumor heard, so he's in the first batch)
 * and counts its reward (alive or dead) in the hunt's net gold.
 *
 * --old turns off the Milestone 5 planning rulings (Shaken and the
 * boarding-loss table) to compare before and after.
 */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..");
[
  "js/rng.js", "js/checks.js", "js/meters.js", "js/letters.js", "js/state.js", "js/text.js", "js/npcs.js", "js/crew.js", "js/articles.js", "js/node.js", "js/scenes.js", "js/quests.js", "js/officers.js", "js/rumors.js", "js/validate.js", "js/creator.js", "js/minigames.js", "js/salvage.js", "js/drinking.js", "js/liarsdice.js", "js/hunt_gen.js", "js/combat.js", "js/hunt.js", "js/summary.js", "js/world.js", "js/weather.js", "js/norfolk.js", "js/inspections.js", "js/forgery.js", "js/admiralty.js", "js/prison.js", "js/escape.js", "js/mutiny.js", "js/bounties.js", "js/wanted.js", "js/items.js", "js/devtools.js",
  "content/check_types.js", "content/modifiers.js", "content/items.js", "content/creator.js", "content/ships.js", "content/names.js", "content/economy.js", "content/articles.js",
  "content/test_captain.js", "content/test_scenes.js", "content/ocracoke.js", "content/ocracoke_scenes.js", "content/quests.js", "content/rumors.js", "content/officer_lines.js", "content/minigames.js", "content/hunt.js", "content/world.js", "content/weather.js", "content/norfolk.js", "content/norfolk_scenes.js", "content/inspection_scenes.js", "content/admiralty_scenes.js", "content/prison.js", "content/mutiny.js", "content/bounties.js", "content/wanted_man.js",
].forEach(function (f) { require(path.join(root, f)); });
var PC = globalThis.PC;

var N = Number(process.argv[2]) || 1000;
var OLD = process.argv.indexOf("--old") >= 0;
var flag = function (f) { return process.argv.indexOf(f) >= 0; };
if (flag("--hull10")) PC.data.hunt.BR_HULL_DIV = 10;
if (flag("--grape4")) PC.data.hunt.GRAPE_MULT = 4;
if (flag("--grapeguns")) PC.data.hunt.GRAPE_BY_GUNS = { heavy: 1 / 3, light: 1 / 6 };
var BANDS = {}, BANDS_N = 0;
var BOUNTY = flag("--bounty"), RUMOR = flag("--rumor");
var BRES = { met: 0, taken: 0, gold: 0 };
var SEASON = (function () { var i = process.argv.indexOf("--season"); return i >= 0 ? process.argv[i + 1] : "Spring"; })();
var CONDS = {}, CONDS_N = 0;
if (OLD) {
  // Before the planning rulings: 15% (min 1) on a clean clash at any band;
  // no Shaken stacking (one pending step, used once): approximated by a cap of 1.
  Object.keys(PC.data.hunt.BOARD_LOSS).forEach(function (k) { PC.data.hunt.BOARD_LOSS[k] = [0.15, 0]; });
  PC.data.hunt.SHAKEN_CAP = 1;
}

// A fitted Year 1 sloop (§21.7, §20.5): repaired, 30 hands, provisions for
// a 3-action hunt, the Articles signed, the fence open.
function fitted(seed) {
  var s = PC.state.newGame(PC.data.testCaptain, { seed: seed });
  s.current = { screen: "node" }; s.location.place = null;
  PC.devtools.skipQuests(s);
  s.ship.hull = s.ship.hullMax; s.ship.speed = 3; s.ship.rigging = "sound";
  var add = 30 - s.crew.count; if (add > 0) PC.crew.addHands(s, "Green", add);
  s.crew.raw = 0; s.provisions = 20; s.crew.morale = 55;
  s.articles = { terms: PC.articles.defaults(), greed: 0, signed: { year: 1754, season: 0 } };
  s.ap.left = 7;
  s.flags.ocr_underworld_done = true;
  s.time.year = 1755; s.time.season = Math.max(0, PC.state.SEASONS.indexOf(SEASON));
  if (BOUNTY) {
    PC.bounties.devOpen(s);
    var bn = PC.bounties.board(s).cards.filter(function (n) { return n.status === "open"; })[0];
    if (bn) { bn.waters = "north"; PC.bounties.take(s, bn.id); if (RUMOR) PC.bounties.heardRumor(s, bn.id); }
  }
  return s;
}

function caOf(view) { return view.scout ? view.scout.ca : 0; }

function policyScout(s, g, v) {
  var sc = v.scout;
  if (!sc.hunter) { BANDS[sc.ca] = (BANDS[sc.ca] || 0) + 1; BANDS_N++; }
  var war = sc.ships.some(function (x) { return x.warship; });
  if (sc.ships.length > 1 && sc.shape === "escort") return false;
  if (war) return sc.ca >= 2;
  // The simulator's policy (§23): Hybrids only at Even or better.
  if (sc.ships.some(function (x) { return x.role === "Hybrid"; })) return sc.ca >= 0;
  return sc.ca >= -1;
}

function play(s, g) {
  var steps = 0;
  var seenBatch = null;
  while (!g.over && steps++ < 400) {
    if (g.batch && g.batch !== seenBatch) { seenBatch = g.batch; CONDS[g.batch.condition] = (CONDS[g.batch.condition] || 0) + 1; CONDS_N++; }
    if (g.pending) { PC.minigames.settle(s); PC.hunt.checkBattleOver(s, g); continue; }
    var v = PC.minigames.view(s);
    if (v.phase === "gameover") { g.over = true; break; }
    if (v.phase === "empty") { PC.hunt.next(s, g); continue; }
    if (v.phase === "scout" && BOUNTY && v.scout.ships.some(function (x) { return x.bounty; })) { if (!g.simMet) { g.simMet = true; BRES.met++; } PC.hunt.engage(s, g); continue; }
    if (v.phase === "scout") { if (policyScout(s, g, v)) PC.hunt.engage(s, g); else PC.hunt.next(s, g); continue; }
    if (v.phase === "hunter") { PC.hunt.meetHunter(s, g); continue; }
    if (v.phase === "battle") { battleStep(s, g, v.battle); continue; }
    if (v.phase === "after") {
      if (!v.after.repairDone) { PC.hunt.doRepair(s, g); continue; }
      if (v.after.prize) {
        var pr = v.after.prize;
        PC.hunt.settlePrize(s, g, { hull: "release", crew: pr.volunteers ? "recruit" : "release", captives: "free", captain: pr.captainFate ? (pr.captainFate.kind === "bounty" ? "bring" : "prisoner") : null });
        continue;
      }
      PC.hunt.carryOn(s, g); continue;
    }
    if (v.phase === "batchEnd") {
      var hullOk = s.ship.hull >= 0.5 * s.ship.hullMax && s.crew.count >= 18 && PC.crew.slotsFree(s) > 5;
      if (hullOk && v.canContinue.ok) PC.hunt.anotherBatch(s, g); else PC.hunt.sailHome(s, g);
      continue;
    }
    throw new Error("stuck in " + v.phase);
  }
  if (steps >= 400) throw new Error("runaway hunt");
}

function battleStep(s, g, bv) {
  var B = function (fn) { return PC.hunt.battle.apply(null, [s, g, fn].concat([].slice.call(arguments, 1))); };
  var en = bv.enemies.filter(function (e) { return e.id === bv.target; })[0] || bv.enemies.filter(function (e) { return !e.out; })[0];
  var me = bv.mine[0];
  var ratio = en ? me.crew / Math.max(1, en.crew) : 1;
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
      res.clashes++; if (bv.board && bv.board.clash === 0) res.boardings++;
      var acts = bv.actions.filter(function (a) { return !a.lock; });
      var pick = acts.filter(function (a) { return a.id === "lead"; })[0] || acts.filter(function (a) { return a.id === "demand"; })[0];
      return B("doAction", pick.id);
    case "retarget": return B("retarget", bv.enemies.filter(function (e) { return !e.out; })[0].id);
    case "endure": return B("doEndure");
  }
  throw new Error("battle stuck at " + bv.step);
}

// Sell the haul back at Ocracoke: clean to the provisioner, dirty to Bobby.
function haulValue(s) {
  var v = 0;
  var t = s.cargo.treasure;
  v += t.clean * PC.node.unitPrice(s, "provisioner", "treasure") + t.dirty * PC.node.unitPrice(s, "fence", "treasure");
  Object.keys(s.cargo.goods).forEach(function (g) {
    var e = s.cargo.goods[g];
    v += (e.clean || 0) * PC.node.unitPrice(s, "provisioner", g) + (e.dirty || 0) * PC.node.unitPrice(s, "fence", g);
  });
  return v;
}

var res = { gold: 0, ap: 0, prizes: 0, lost: 0, died: 0, battles: 0, rounds: 0, clashes: 0, hunters: 0, chestGold: 0, killed: 0, boardings: 0 };
var perAp = [], LOSTTO = {};
for (var i = 0; i < N; i++) {
  var s = fitted("sim-" + i);
  var crew0 = s.money.crew, purse0 = s.money.purse, prov0 = s.provisions, hull0 = s.ship.hull, hands0 = s.crew.count;
  var g = PC.hunt.start(s);
  try { play(s, g); } catch (e) { console.log("seed sim-" + i + ": " + e.stack); process.exit(1); }
  if (g.gameOver) { var lb = g.battle; var le = lb && lb.enemies[0]; LOSTTO[(le ? (le.hunter ? "hunter " : "") + le.flag + " " + le.role + " " + le.cls : "?") + " · " + (lb && lb.lostHow)] = (LOSTTO[(le ? (le.hunter ? "hunter " : "") + le.flag + " " + le.role + " " + le.cls : "?") + " · " + (lb && lb.lostHow)] || 0) + 1; res.lost++; if (g.gameOver.how === "died") res.died++; res.ap += g.apUsed; perAp.push(0); continue; }
  PC.minigames.leave(s);
  var gross = haulValue(s) + (s.money.crew - crew0) + (s.money.purse - purse0);
  // Food at the port's price; a prize's food counts as a gain (P2, P12).
  var cost = (prov0 - PC.crew.food(s)) * PC.node.provisionsPrice(s) + Math.max(0, hull0 - s.ship.hull) * 8 + Math.max(0, hands0 - s.crew.count) * 15;
  // The bounty's reward, as Howe pays it (alive, or the dead rate).
  if (BOUNTY) (s.bounties ? s.bounties.notices : []).forEach(function (n) {
    if (n.status !== "captured") return;
    BRES.taken++; var gb = PC.bounties.reward(s, n, n.outcome === "alive" ? "alive" : "dead"); BRES.gold += gb; gross += gb;
  });
  var net = gross - cost;
  res.gold += net; res.ap += g.apUsed; res.prizes += g.prizesTaken;
  perAp.push(net / g.apUsed);
}
perAp.sort(function (a, b) { return a - b; });
function q(p) { return Math.round(perAp[Math.floor(p * (perAp.length - 1))]); }
var knobs = ["BR hull ÷" + PC.data.hunt.BR_HULL_DIV, "grape ×" + PC.data.hunt.GRAPE_MULT + (PC.data.hunt.GRAPE_BY_GUNS ? " (by guns)" : "")].join(", ");
console.log((OLD ? "BEFORE the planning rulings" : "WITH the planning rulings") + " · " + knobs + " · " + N + " hunts from Ocracoke, a fitted Year 1 sloop, no letter");
console.log("  net gold per action: " + Math.round(res.gold / res.ap) + "   (median " + q(0.5) + ", 10th " + q(0.1) + ", 90th " + q(0.9) + "; target about 700, §22.11)");
console.log("  actions per hunt:    " + (res.ap / N).toFixed(2));
console.log("  prizes per hunt:     " + (res.prizes / N).toFixed(2));
console.log("  boardings per hunt:  " + (res.boardings / N).toFixed(2) + ", clashes per boarding " + (res.clashes / Math.max(1, res.boardings)).toFixed(2));
console.log("  flagship lost:       " + (100 * res.lost / N).toFixed(1) + "% (captain died " + (100 * res.died / N).toFixed(1) + "%)");
if (process.argv.indexOf("--why") >= 0) console.log(LOSTTO);
if (BOUNTY) console.log("  bounty" + (RUMOR ? " (rumor heard)" : "") + ": met in " + (100 * BRES.met / N).toFixed(1) + "% of hunts, taken in " + (100 * BRES.taken / N).toFixed(1) + "%, reward " + Math.round(BRES.gold / Math.max(1, BRES.taken)) + " a target (in the net above)");
if (flag("--weather")) console.log("  " + SEASON + " batch weather: " + Object.keys(CONDS).map(function (k) { return k + " " + Math.round(100 * CONDS[k] / Math.max(1, CONDS_N)) + "%"; }).join(", "));
if (flag("--bands")) console.log("  odds bands scouted:  " + Object.keys(BANDS).sort(function (a, b) { return b - a; }).map(function (k) { return PC.data.hunt.CA_NAMES[k] + " " + Math.round(100 * BANDS[k] / BANDS_N) + "%"; }).join(", "));
