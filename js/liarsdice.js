/* Pirate Chronicle — Liar's Dice, the Tavern's gambling (§18.3).
 *
 * One session costs 1 AP and holds as many games as the purse covers
 * (no cap, the M5 playtest) against one ephemeral
 * opponent (a Dockhand at Ocracoke). Each game: three dice each under a
 * cup; bid "at least N dice showing X" across both cups, or call Liar. The
 * loser of a call loses a die; the last with dice takes the pot. Stakes come
 * from the purse (§18.1). The Cards & Dice layer: Size them up once a
 * session, Cheat (peek at one of his dice) once a game.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function D() { return PC.data.minigames.dice; }
  function M() { return PC.minigames; }
  var COND = ["Harbor"];

  function stakes(state, node) { return D().STAKES[PC.node.nodeData(node || PC.node.here(state)).tier] || [25, 50]; }

  function canPlay(state) {
    var id = PC.node.here(state);
    var c = PC.node.tavernServiceCheck(state, 1);
    if (!c.ok) return c;
    if (!D().pools[id]) return { ok: false, why: "No one's gambling here" };
    // Stakes come from the purse, never crew gold (§18.1): say so plainly,
    // since gold often goes to the crew at the purse-or-crew choice.
    var min = stakes(state)[0];
    if (state.money.purse < min) return { ok: false, why: "Your purse holds " + state.money.purse + " gold. Stakes come from your own purse, not the crew's gold, and the table here starts at " + min + ". (Rewards that offer \"Into your purse\" fill it.)" };
    return { ok: true };
  }

  function play(opp) {
    var P = D().PLAY, out = { callBelow: P.base.callBelow, bold: false, chases: false, checkDr: 0, sizeDr: 0 };
    (opp.traits || []).forEach(function (t) {
      var p = P[t]; if (!p) return;
      Object.keys(p).forEach(function (k) { out[k] = p[k]; });
    });
    return out;
  }

  function start(state) {
    var c = canPlay(state);
    if (!c.ok) throw new Error(c.why);
    PC.crew.spendAP(state, 1);
    PC.node.tavernVisit(state);
    state.minigames.diceSessions = (state.minigames.diceSessions || 0) + 1;
    var node = PC.node.here(state);
    var key = [state.world.seed, PC.state.stamp(state), node, "gambler", state.minigames.diceSessions].join("|");
    var rec = PC.npcs.generate(state, { id: "gambler", role: D().pools[node].role, pool: "master", node: null, key: key, gender: "m" });
    var game = {
      kind: "dice", key: "dice|" + node + "|" + state.minigames.diceSessions, node: node,
      opp: { name: rec.full, traits: rec.traits || [] },
      games: 0, won: 0, lost: 0, net: 0, sized: null, marks: 0, round: null, over: false, log: [],
      sessionRerolls: (state.captain.items || []).indexOf("Loaded Dice") >= 0 ? [{ name: "Loaded Dice", types: ["Cards & Dice"], op: "cheat" }] : [],
    };
    M().start(state, game, "node");
    M().say(state, game, D().lines.sit);
    return game;
  }

  // ---- A game -----------------------------------------------------------------

  function rollCup(state, game, n) {
    var r = M().rand(state, game, "cup");
    var out = [];
    for (var i = 0; i < n; i++) out.push(1 + Math.floor(r() * 6));
    return out.sort();
  }

  function newGame(state, stake) {
    var game = state.minigame;
    if (game.round) throw new Error("A game is already on.");
    var lim = stakes(state, game.node);
    stake = Math.round(stake);
    if (stake < lim[0] || stake > lim[1]) throw new Error("Stakes here are " + lim[0] + "-" + lim[1] + " gold.");
    if (state.money.purse < stake) throw new Error(D().lines.broke);
    state.money.purse -= stake;
    game.games += 1;
    game.round = { stake: stake, myN: D().DICE, hisN: D().DICE, opener: "me", peeked: [], cheated: false, history: [] };
    newRound(state, game, "me");
    return game;
  }

  function newRound(state, game, opener) {
    var g = game.round;
    g.mine = rollCup(state, game, g.myN);
    g.his = rollCup(state, game, g.hisN);
    g.peeked = [];
    g.bid = null;
    g.turn = opener;
    g.revealed = null;
    if (opener === "him") hisTurn(state, game);
  }

  function valid(g, q, f) {
    var total = g.myN + g.hisN;
    if (!(q >= 1 && q <= total && f >= 1 && f <= 6)) return false;
    if (!g.bid) return true;
    return q > g.bid.q || (q === g.bid.q && f > g.bid.f);
  }

  function count(list, f) { return list.filter(function (d) { return d === f; }).length; }

  // P(at least `need` of `n` unknown dice show a face), each 1 in 6.
  function atLeast(need, n) {
    if (need <= 0) return 1;
    if (need > n) return 0;
    var p = 0;
    for (var k = need; k <= n; k++) p += choose(n, k) * Math.pow(1 / 6, k) * Math.pow(5 / 6, n - k);
    return p;
  }
  function choose(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

  // How likely a bid is from his side: his dice, plus what he's peeked of
  // yours (a sharper opponent after a setback Size up knows one).
  function hisOdds(game, q, f) {
    var g = game.round;
    var known = count(g.his, f), unknown = g.myN;
    if (g.hisPeek != null && g.hisPeek < g.mine.length) { known += g.mine[g.hisPeek] === f ? 1 : 0; unknown -= 1; }
    return atLeast(q - known, unknown);
  }

  function hisTurn(state, game) {
    var g = game.round, P = play(game.opp);
    if (game.sized === "setback" && g.hisPeek == null) g.hisPeek = 0; // he reads you: plays sharper this game
    if (g.bid && hisOdds(game, g.bid.q, g.bid.f) < P.callBelow) return call(state, game, "him");
    // Raise. He ladders (ruled in the M4 review, §13.2): usually the
    // smallest believable raise, otherwise the likeliest valid bid. Bold or
    // chasing players now and then push one die past it.
    var r = M().rand(state, game, "bid");
    var best = null, cands = [];
    for (var f = 1; f <= 6; f++) {
      var q = g.bid ? (f > g.bid.f ? g.bid.q : g.bid.q + 1) : 1;
      if (!valid(g, q, f)) continue;
      var pr = hisOdds(game, q, f);
      cands.push({ q: q, f: f, p: pr });
      if (!best || pr > best.p || (pr === best.p && r() < 0.5)) best = { q: q, f: f, p: pr };
    }
    if (!best) return call(state, game, "him");
    cands.sort(function (a, b) { return a.q - b.q || a.f - b.f; });
    var believable = cands.filter(function (c) { return c.p >= 0.5; });
    if (believable.length && r() < 0.75) best = believable[0];
    var push = (P.bold && r() < 0.2) || (P.chases && game.lost > game.won && r() < 0.2);
    if (push && valid(g, best.q + 1, best.f)) best = { q: best.q + 1, f: best.f, p: hisOdds(game, best.q + 1, best.f) };
    g.bid = { q: best.q, f: best.f, by: "him", bluff: best.p < 0.5 };
    var line = game.opp.name.split(" ")[0] + " bids " + faces(best.q, best.f) + ".";
    if (g.bid.bluff && game.sized === "clean") line += " " + D().lines.tell;
    else if (g.bid.bluff && game.sized === "partial" && r() < 0.6) line += " " + D().lines.vague;
    g.history.push(line);
    g.turn = "me";
    return game;
  }

  var FACES = ["", "one", "two", "three", "four", "five", "six"];
  function face(f) { return FACES[f]; }
  // "1 six", "3 sixes", "2 fives"
  function faces(q, f) { return q + " " + (q === 1 ? FACES[f] : f === 6 ? "sixes" : FACES[f] + "s"); }

  function bid(state, q, f) {
    var game = state.minigame, g = game && game.round;
    if (!g || g.turn !== "me" || g.revealed) throw new Error("Not your turn.");
    q = Math.round(q); f = Math.round(f);
    if (!valid(g, q, f)) throw new Error("A raise must bid more dice, or the same number of a higher face.");
    g.bid = { q: q, f: f, by: "me" };
    g.history.push("You bid " + faces(q, f) + ".");
    g.turn = "him";
    return hisTurn(state, game);
  }

  function call(state, game, who) {
    var g = game.round;
    if (!g.bid) throw new Error("There's no bid to call.");
    var have = count(g.mine, g.bid.f) + count(g.his, g.bid.f);
    var holds = have >= g.bid.q;
    var loser = holds ? who : g.bid.by;
    g.history.push((who === "me" ? "You call" : game.opp.name.split(" ")[0] + " calls") + " Liar! The cups lift: " + faces(have, g.bid.f) + ". " +
      (loser === "me" ? "You lose a die." : "He loses a die."));
    g.revealed = { mine: g.mine.slice(), his: g.his.slice(), loser: loser };
    if (loser === "me") g.myN -= 1; else g.hisN -= 1;
    g.turn = null;
    if (g.myN <= 0) return endGame(state, game, false);
    if (g.hisN <= 0) return endGame(state, game, true);
    g.nextOpener = loser; // the loser opens the next round
    return game;
  }

  function callLiar(state) {
    var game = state.minigame, g = game && game.round;
    if (!g || g.turn !== "me" || !g.bid) throw new Error("Nothing to call.");
    return call(state, game, "me");
  }

  function nextRound(state) {
    var game = state.minigame, g = game.round;
    if (!g || !g.revealed || g.over) throw new Error("No round to move on from.");
    g.history = [];
    newRound(state, game, g.nextOpener);
    return game;
  }

  function endGame(state, game, won) {
    var g = game.round;
    g.over = true;
    g.won = won;
    if (won) {
      state.money.purse += g.stake * 2;
      game.won += 1; game.net += g.stake;
      // Card Sharp counts gross winnings, not net of losses (§18.3 proposal).
      state.minigames.diceWinnings = (state.minigames.diceWinnings || 0) + g.stake;
      M().say(state, game, D().lines.win);
      if (state.minigames.diceWinnings >= D().CARD_SHARP_AT && state.captain.tags.indexOf("Card Sharp") < 0) {
        state.captain.tags.push("Card Sharp");
        M().say(state, game, "New tag: Card Sharp.");
        PC.state.addLog(state, "New tag: Card Sharp.");
      }
    } else {
      game.lost += 1; game.net -= g.stake;
      M().say(state, game, D().lines.lose);
    }
    return game;
  }

  function closeGame(state) {
    var game = state.minigame;
    if (!game.round || !game.round.over) throw new Error("The game isn't over.");
    game.round = null;
    return game;
  }

  // ---- The Cards & Dice layer ---------------------------------------------------

  function checkFor(game, base) { var p = play(game.opp); return { type: base.type, dr: Math.max(0, base.dr + p.checkDr + (base === D().SIZE_CHECK ? p.sizeDr : 0)) }; }

  function sizeUp(state) {
    var game = state.minigame;
    if (game.sized) throw new Error("Once a sitting.");
    if (game.round) throw new Error("Before a game starts.");
    game.sized = "rolling";
    return M().roll(state, game, checkFor(game, D().SIZE_CHECK), "size", {}, COND);
  }

  function cheat(state, index) {
    var game = state.minigame, g = game.round;
    if (!g || g.revealed || g.turn !== "me") throw new Error("Not now.");
    if (g.cheated) throw new Error("Once a game.");
    g.cheated = true;
    return M().roll(state, game, checkFor(game, D().CHEAT_CHECK), "cheat", { index: Math.max(0, Math.min(g.his.length - 1, index || 0)) }, COND);
  }

  function settle(state, game, p) {
    if (p.op === "size") {
      game.sized = p.outcome;
      M().say(state, game, D().lines.size[p.outcome]);
      return game;
    }
    if (p.op === "cheat") {
      var g = game.round;
      if (p.outcome === "setback") return caught(state, game, "setback");
      g.peeked.push(p.data.index);
      M().say(state, game, D().lines.cheat[p.outcome]);
      if (p.outcome === "partial") {
        game.marks += 1;
        if (game.marks >= D().MARKS_TO_CATCH) return caught(state, game, "marks");
      }
      return game;
    }
    throw new Error("Unknown dice roll: " + p.op);
  }

  // Caught: the game ends, the pot is forfeit, and Standing with the node's
  // faction drops (black Standing at Ocracoke, §18.3).
  function caught(state, game, why) {
    var g = game.round;
    M().say(state, game, (D().lines.caughtWhy && D().lines.caughtWhy[why] ? D().lines.caughtWhy[why] + " " : "") + D().lines.caught);
    g.caughtWhy = why || null;
    var faction = PC.node.nodeData(game.node).faction;
    PC.scenes.applyEffect(state, { standing: { faction: faction, delta: D().CAUGHT_STANDING } });
    g.over = true; g.won = false; g.caught = true;
    game.lost += 1; game.net -= g.stake;
    PC.state.addLog(state, "Caught cheating at Liar's Dice: Standing with the pirates " + D().CAUGHT_STANDING + ".");
    return game;
  }

  // Leave the table. Between games it's one click; mid-game the stake on
  // the table is forfeit (the screen warns first, B26 of the M5 playtest).
  function stop(state, forfeit) {
    var game = state.minigame;
    if (game.round && !game.round.over) {
      if (!forfeit) throw new Error("Finish the game first.");
      var g = game.round;
      g.over = true; g.won = false; g.forfeit = true;
      game.lost += 1; game.net -= g.stake;
      M().say(state, game, D().lines.forfeit);
    }
    game.round = null;
    game.over = true;
    PC.state.addLog(state, "Liar's Dice: " + game.won + " won, " + game.lost + " lost (" + (game.net >= 0 ? "+" : "") + game.net + " gold).");
    return game;
  }

  function view(state, game) {
    var g = game.round;
    var lim = stakes(state, game.node);
    return {
      opponent: game.opp.name, games: game.games, won: game.won, lost: game.lost, net: game.net, stakeStep: D().STAKE_STEP || 5,
      stakes: lim, purse: state.money.purse, sized: game.sized, marks: game.marks,
      canSize: !game.sized && !g, sizeAssess: M().assess(state, checkFor(game, D().SIZE_CHECK), COND),
      cheatAssess: M().assess(state, checkFor(game, D().CHEAT_CHECK), COND),
      canStart: !g && state.money.purse >= lim[0],
      round: g ? {
        stake: g.stake, mine: g.mine, myN: g.myN, hisN: g.hisN, bid: g.bid, turn: g.turn, history: g.history.slice(),
        his: g.his.map(function (d, i) { return g.revealed || g.peeked.indexOf(i) >= 0 ? d : null; }),
        revealed: !!g.revealed, over: !!g.over, won: g.won, caught: !!g.caught, caughtWhy: g.caughtWhy || null, forfeit: !!g.forfeit, cheated: g.cheated,
        total: g.myN + g.hisN,
      } : null,
    };
  }

  M().register("dice", { settle: settle, view: view });

  PC.liarsdice = {
    canPlay: canPlay, start: start, stakes: stakes, newGame: newGame, bid: bid, callLiar: callLiar,
    nextRound: nextRound, closeGame: closeGame, sizeUp: sizeUp, cheat: cheat, stop: stop,
    valid: valid, atLeast: atLeast,
  };
})();
