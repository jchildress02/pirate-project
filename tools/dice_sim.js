/* Pirate Chronicle — Liar's Dice, played automatically (Milestone 6's
 * balance check, P18). A plain captain who plays the odds against the
 * Ocracoke dockhand: what a game is worth, and so what an action is worth
 * when one sitting holds as many games as the purse covers.
 *
 *   node tools/dice_sim.js [sittings] [games per sitting] [--size]
 *
 * --size: Size him up before the first game (Cards & Dice, DR 3).
 */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..");
[
  "js/rng.js", "js/checks.js", "js/state.js", "js/text.js", "js/npcs.js", "js/crew.js", "js/articles.js", "js/node.js", "js/scenes.js", "js/quests.js", "js/officers.js", "js/rumors.js", "js/validate.js", "js/creator.js", "js/minigames.js", "js/salvage.js", "js/drinking.js", "js/liarsdice.js", "js/hunt_gen.js", "js/combat.js", "js/hunt.js", "js/summary.js", "js/devtools.js",
  "content/check_types.js", "content/modifiers.js", "content/creator.js", "content/ships.js", "content/names.js", "content/economy.js", "content/articles.js",
  "content/test_captain.js", "content/test_scenes.js", "content/ocracoke.js", "content/ocracoke_scenes.js", "content/quests.js", "content/rumors.js", "content/officer_lines.js", "content/minigames.js", "content/hunt.js",
].forEach(function (f) { require(path.join(root, f)); });
var PC = globalThis.PC, L = PC.liarsdice;

var SITTINGS = Number(process.argv[2]) || 2000, GAMES = Number(process.argv[3]) || 10;
var SIZE = process.argv.indexOf("--size") >= 0;

function count(list, f) { return list.filter(function (d) { return d === f; }).length; }
// The captain's view: his own dice known, the rest 1 in 6.
function myOdds(g, q, f) { return L.atLeast(q - count(g.mine, f), g.hisN); }

function myTurn(s) {
  var g = s.minigame.round;
  if (g.bid && myOdds(g, g.bid.q, g.bid.f) < 0.5) return L.callLiar(s);
  var best = null;
  for (var f = 1; f <= 6; f++) {
    var q = g.bid ? (f > g.bid.f ? g.bid.q : g.bid.q + 1) : 1;
    if (!L.valid(g, q, f)) continue;
    var p = myOdds(g, q, f);
    if (!best || p > best.p) best = { q: q, f: f, p: p };
  }
  if (!best) return L.callLiar(s);
  return L.bid(s, best.q, best.f);
}

var tot = { games: 0, won: 0, net: 0, staked: 0, sittings: 0 };
for (var i = 0; i < SITTINGS; i++) {
  var s = PC.state.newGame(PC.data.testCaptain, { seed: "dice-" + i });
  s.current = { screen: "node" }; PC.devtools.skipQuests(s);
  s.location.place = "tavern"; s.money.purse = 100000; s.ap.left = 7;
  L.start(s); tot.sittings++;
  if (SIZE) L.sizeUp(s);
  if (s.minigame.pending) PC.minigames.settle(s);
  var stake = L.stakes(s)[1];
  for (var k = 0; k < GAMES; k++) {
    var before = s.money.purse;
    L.newGame(s, stake);
    for (var n = 0; n < 400; n++) {
      var g = s.minigame.round;
      if (s.minigame.pending) { PC.minigames.settle(s); continue; }
      if (g.over) break;
      if (g.revealed) { L.nextRound(s); continue; }
      if (g.turn === "me") myTurn(s); else break;
    }
    tot.games++; tot.staked += stake;
    if (s.money.purse > before) tot.won++;
    tot.net += s.money.purse - before;
    L.closeGame(s);
  }
}
console.log("Liar's Dice · " + tot.sittings + " sittings × " + GAMES + " games at the top stake (" + L.stakes(PC.state.newGame(PC.data.testCaptain, { seed: "x" }), "ocracoke")[1] + " gold)" + (SIZE ? " · sized him up" : ""));
console.log("  games won:          " + (100 * tot.won / tot.games).toFixed(1) + "%");
console.log("  net per game:       " + (tot.net / tot.games).toFixed(1) + " gold (" + (100 * tot.net / tot.staked).toFixed(1) + "% of the stake)");
console.log("  net per action:     " + Math.round(tot.net / tot.sittings) + " gold at " + GAMES + " games a sitting (the hunt: about 830)");
