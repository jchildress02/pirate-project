/* Pirate Chronicle — the drinking minigame, Under the Table (§18.4).
 *
 * The captain drinks against one opponent: each Drink is a Cast-Iron
 * Stomach check at the ladder DR (1 + drinks poured, capped at 5) that costs
 * Wits, while the opponent's hidden Tolerance ticks down. One taunt a match
 * goads him into drinking alone. Setbacks draw a mishap. A win pays a rumor
 * by his role (or the loss quest's drinking lead, §30.6) and a 10% item.
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  function D() { return PC.data.minigames.drinking; }
  function M() { return PC.minigames; }
  var COND = ["Harbor"];

  function traitOf(opp) { return D().traits[opp.trait] || {}; }

  // ---- Who's drinking ---------------------------------------------------------

  // Once a season at each Tavern, not on the first visit (§18.4.1, §17.2).
  function canDrink(state) {
    var id = PC.node.here(state);
    var c = PC.node.tavernServiceCheck(state, 1);
    if (!c.ok) return c;
    if (!D().pools[id]) return { ok: false, why: "No drinking contest here" };
    if (PC.crew.usedThisSeason(state, "drinking")) return { ok: false, why: "Once a season" };
    return { ok: true };
  }

  // An ephemeral opponent, seeded by node, season and session (§18.1).
  function opponent(state, node, n) {
    var pool = D().pools[node];
    var key = [state.world.seed, PC.state.stamp(state), node, "drinker", n].join("|");
    var r = PC.rng.fromKey(key + "|trait");
    var trait = M().pick(r, pool.traits);
    var t = D().traits[trait] || {};
    var range = D().TOLERANCE[pool.role];
    var tol = Math.max(1, range[0] + Math.floor(r() * (range[1] - range[0] + 1)) + (t.tolerance || 0));
    var rec = PC.npcs.generate(state, { id: "drinker", role: pool.role, pool: "master", node: null, key: key, gender: "m" }); // minigame opponents are men (§15.1)
    return { name: rec.full, role: pool.role, trait: trait, tolerance: tol, tolMax: tol,
      // Proud, Reckless and Wild call for the strong stuff once, on a seeded round (2 or 3).
      strongRound: t.strongOnce ? 2 + Math.floor(r() * 2) : null };
  }

  function newMatch(state, n, wits) {
    var node = PC.node.here(state);
    var opp = opponent(state, node, n);
    var hung = (state.captain.tags || []).indexOf("Hangover") >= 0;
    var start = wits != null ? wits : D().WITS - (hung ? 1 : 0) + (PC.items.has(state, "Kingly Goblet") ? 1 : 0);
    return {
      kind: "drink", key: "drink|" + node + "|" + n, node: node, n: 0, opp: opp,
      wits: start, witsMax: Math.max(start, D().WITS), poured: 0, round: 1,
      sized: null, sizeKnown: null, taunted: false, harder: 0, mustStrong: false,
      hairOfTheDog: hung, insult: false, bottleClean: false, over: false, result: null, log: [],
    };
  }

  function start(state) {
    var c = canDrink(state);
    if (!c.ok) throw new Error(c.why);
    PC.crew.spendAP(state, 1);
    PC.crew.markUsed(state, "drinking");
    PC.node.tavernVisit(state); // a drinking session counts as a Tavern visit (§18.4.1)
    PC.node.tavernActionDone(state); // the first Tavern action (Bug Log B4)
    state.minigames.drinkSessions = (state.minigames.drinkSessions || 0) + 1;
    var game = newMatch(state, state.minigames.drinkSessions);
    M().start(state, game, "node");
    opening(state, game);
    return game;
  }

  function opening(state, game) {
    var t = traitOf(game.opp);
    var pool = D().pools[game.node] || {};
    M().say(state, game, (pool.setup || D().lines.setup) + (t.hint || "PLACEHOLDER (setup hint)."));
    if (game.hairOfTheDog) M().say(state, game, "Your head is still pounding from last time.");
  }

  // His state line (§18.4.2): Steady above half his Tolerance, Wobbling at
  // half or less, Done For at 1.
  function stateName(opp) {
    if (opp.tolerance <= 1) return "doneFor";
    if (opp.tolerance <= opp.tolMax / 2) return "wobbling";
    return "steady";
  }

  function tellLine(state, game) {
    var t = traitOf(game.opp)[stateName(game.opp)];
    if (!t) return { line: "PLACEHOLDER (tell line)", insult: false };
    if (typeof t === "string") return { line: t, insult: false };
    return { line: state.captain.gender === "f" && t.lineF ? t.lineF : t.line, insult: !!t.insult };
  }

  function showTell(state, game) {
    var t = tellLine(state, game);
    M().say(state, game, t.line);
    if (t.insult) game.insult = true;
  }

  // ---- The checks --------------------------------------------------------------

  function ladder(game) { return 1 + game.poured; }

  function drinkCheck(game, strong) {
    var t = traitOf(game.opp);
    var dr = ladder(game) + (strong ? 1 : 0) + game.harder + (t.drinkDr || 0);
    return { type: "Cast-Iron Stomach", dr: Math.max(0, Math.min(D().DR_CAP, dr)) };
  }

  function shift(base, by) { return Math.max(0, Math.min(8, base + Math.max(-2, Math.min(2, by)))); }

  function sizeCheck(game) { var c = D().SIZE_CHECK; return { type: c.type, dr: shift(c.dr, traitOf(game.opp).sizeDr || 0) }; }
  function mockCheck(game) { var t = traitOf(game.opp), c = D().MOCK_CHECK; return { type: c.type, dr: shift(c.dr, (t.mockDr || 0) + (t.tauntDr || 0)) }; }
  function leanCheck(game) { var t = traitOf(game.opp), c = D().LEAN_CHECK; return { type: c.type, dr: shift(c.dr, (t.leanDr || 0) + (t.tauntDr || 0)) }; }

  // What the captain can do this round.
  function options(state, game) {
    if (game.over || game.pending) return [];
    var out = [];
    var first = game.poured === 0 && game.round === 1;
    if (!game.mustStrong) out.push({ op: "drink", label: "Drink", check: drinkCheck(game, false) });
    out.push({ op: "strong", label: "Call for the strong stuff", check: drinkCheck(game, true) });
    if (first && !game.sized && !game.mustStrong) out.push({ op: "size", label: "Size him up", check: sizeCheck(game) });
    if (!game.taunted && !game.mustStrong) {
      out.push({ op: "mock", label: "Mock him", check: mockCheck(game) });
      out.push({ op: "lean", label: "Lean on him", check: leanCheck(game) });
    }
    // The Hot-Tempered flaw's temptation (§18.4.7), when his line is an insult.
    if ((state.captain.flaws || []).indexOf("Hot-Tempered") >= 0 && game.insult) out.push({ op: "throw", label: "Throw your drink in his face.", check: D().BRAWL_CHECK, temptation: true });
    out.push({ op: "callit", label: "Call it a night", check: null });
    return out.map(function (o) { if (o.check) o.assess = M().assess(state, o.check, COND); return o; });
  }

  function act(state, op) {
    var game = state.minigame;
    if (!game || game.kind !== "drink") throw new Error("Not drinking.");
    if (game.over) throw new Error("The match is over.");
    if (game.pending) throw new Error("Finish the last roll first.");
    var o = options(state, game).filter(function (x) { return x.op === op; })[0];
    if (!o) throw new Error("You can't do that now.");
    if (op === "callit") return finish(state, game, "callit");
    if (op === "throw") { game.insult = false; M().say(state, game, D().lines.brawl.start); return M().roll(state, game, D().BRAWL_CHECK, "brawl", { thrown: true }, COND); }
    if (op === "size") game.sized = true;
    if (op === "mock" || op === "lean") game.taunted = true;
    game.insult = false;
    return M().roll(state, game, o.check, op, {}, COND);
  }

  function settle(state, game, p) {
    var L = D().lines;
    if (p.op === "size") {
      var s = L.size[p.outcome];
      M().say(state, game, typeof s === "string" ? s : s.line);
      if (p.outcome === "clean") game.sizeKnown = { trait: game.opp.trait, tolerance: game.opp.tolerance };
      else if (p.outcome === "partial") game.sizeKnown = { band: game.opp.tolerance >= 5 ? "high" : game.opp.tolerance >= 4 ? "middling" : "low" };
      else { game.mustStrong = true; game.insult = !!s.insult; }
      return game;
    }
    if (p.op === "drink" || p.op === "strong") return settleDrink(state, game, p);
    if (p.op === "mock" || p.op === "lean") return settleTaunt(state, game, p);
    if (p.op === "brawl") return settleBrawl(state, game, p);
    if (p.op === "bottle") return settleBottle(state, game, p);
    if (p.op === "hangover") return settleHangover(state, game, p);
    throw new Error("Unknown drinking roll: " + p.op);
  }

  // Drink: clean 0 Wits, partial 1, setback 2 and a mishap. The strong
  // stuff: two drinks for him, the ladder up two; 0 / 2 / 3 Wits.
  function settleDrink(state, game, p) {
    var strong = p.op === "strong";
    var cost = strong ? { clean: 0, partial: 2, setback: 3 } : { clean: 0, partial: 1, setback: 2 };
    game.wits = Math.max(0, game.wits - cost[p.outcome]);
    game.opp.tolerance = Math.max(0, game.opp.tolerance - (strong ? 2 : 1));
    game.poured += strong ? 2 : 1;
    game.harder = 0;
    game.mustStrong = false;
    if (strong) M().say(state, game, "You both throw back the strong stuff.");
    // Hair of the dog: a clean Drink on round 1 clears the Hangover (§18.4.4).
    if (game.hairOfTheDog && game.round === 1 && p.outcome === "clean") {
      PC.scenes.applyEffect(state, { tag: "Hangover", remove: true });
      game.hairOfTheDog = false;
      M().say(state, game, "The first one clears your head.");
    }
    if (game.wits <= 0 && game.opp.tolerance <= 0) return finish(state, game, "draw");
    if (game.wits <= 0) return finish(state, game, "under");
    if (game.opp.tolerance <= 0) return finish(state, game, "win");
    if (p.outcome === "setback") { var m = mishap(state, game); if (m) return m; }
    return nextRound(state, game);
  }

  function settleTaunt(state, game, p) {
    var L = D().lines, t = traitOf(game.opp);
    if (p.outcome === "setback") {
      M().say(state, game, L.tauntSetback.line);
      if (t.tauntSetbackBrawl) { M().say(state, game, L.brawl.start); return M().roll(state, game, D().BRAWL_CHECK, "brawl", {}, COND); }
      game.mustStrong = true;
      game.insult = true;
      return game;
    }
    M().say(state, game, p.outcome === "clean" ? (p.op === "mock" ? L.mockClean : L.leanClean) : L.tauntPartial);
    game.opp.tolerance = Math.max(0, game.opp.tolerance - 1);
    game.poured += 1;
    if (p.outcome === "partial") game.harder += 1;
    if (game.opp.tolerance <= 0) return finish(state, game, "win");
    return nextRound(state, game);
  }

  // One card on each Drink or strong-stuff setback (§18.4.3).
  function mishap(state, game) {
    var t = traitOf(game.opp), L = D().lines;
    var w = JSON.parse(JSON.stringify(D().MISHAPS));
    w.brawl *= t.brawlWeight || 1;
    w.bottle *= t.bottleWeight || 1;
    var card = M().weighted(M().rand(state, game, "mishap"), w);
    if (card === "wrongPipe") {
      M().say(state, game, L.wrongPipe);
      game.wits = Math.max(0, game.wits - 1);
      if (game.wits <= 0) return finish(state, game, "under");
      return null;
    }
    if (card === "spins") { M().say(state, game, L.spins); game.harder += 1; return null; }
    if (card === "brawl") { M().say(state, game, L.brawl.start); return M().roll(state, game, D().BRAWL_CHECK, "brawl", {}, COND); }
    M().say(state, game, L.bottle.start);
    return M().roll(state, game, D().BOTTLE_CHECK, "bottle", {}, COND.concat(["Uncanny"]));
  }

  // Any brawl costs the tavern keeper a rung, whoever wins it (§18.4.3).
  function settleBrawl(state, game, p) {
    M().say(state, game, D().lines.brawl[p.outcome]);
    PC.npcs.moveRung(state, PC.node.slotNpc(game.node, "keeper"), -1);
    if (p.outcome === "clean") return finish(state, game, "brawlWin");
    if (p.outcome === "setback") return finish(state, game, "thrown");
    return nextRound(state, game);
  }

  function settleBottle(state, game, p) {
    M().say(state, game, D().lines.bottle[p.outcome]);
    if (p.outcome === "clean") game.bottleClean = true;
    if (p.outcome === "setback") return finish(state, game, "under");
    return nextRound(state, game);
  }

  function nextRound(state, game) {
    if (game.over) return game;
    game.round += 1;
    var t = traitOf(game.opp);
    if (t.quitsAtDoneFor && game.opp.tolerance <= 1) { M().say(state, game, t.doneFor || D().lines.timidQuits); return finish(state, game, "win"); }
    showTell(state, game);
    if (game.opp.strongRound && game.round === game.opp.strongRound && !game.mustStrong) {
      M().say(state, game, D().lines.heCallsStrong);
      game.mustStrong = true;
    }
    return game;
  }

  // ---- Endings (§18.4.4) -------------------------------------------------------

  var ENDINGS = {
    win: { won: true, tab: 0, hangover: "low", line: "win" },
    brawlWin: { won: true, tab: 0, hangover: null, line: null },
    draw: { won: false, tab: 0.5, hangover: 3, line: "draw" },   // DEFAULT: "each pays his own" is half the tab
    callit: { won: false, tab: 1, hangover: "low", line: "callIt" },
    under: { won: false, tab: 2, hangover: 3, line: "under" },
    thrown: { won: false, tab: 1, hangover: null, line: null },
  };

  function tabFor(state, game) { return D().TAB[PC.node.nodeData(game.node).tier] || 10; }

  // The tab comes from the purse (§18.4.1). DEFAULT: what the purse can't
  // cover comes out of crew gold.
  function payTab(state, n) {
    var fromPurse = Math.min(state.money.purse, n);
    state.money.purse -= fromPurse;
    state.money.crew = Math.max(0, state.money.crew - (n - fromPurse));
    return n;
  }

  function finish(state, game, how) {
    var E = ENDINGS[how];
    game.result = { how: how, won: E.won, tab: 0, rumor: null, lead: null, item: null, legend: null };
    if (E.line) M().say(state, game, D().lines[E.line]);
    if (E.tab) game.result.tab = payTab(state, Math.round(tabFor(state, game) * E.tab));
    if (E.won) reward(state, game);
    // The Heavy Drinker's "One more round" (§18.4.7), before the morning.
    if (E.won && (state.captain.flaws || []).indexOf("Heavy Drinker") >= 0 && game.wits >= D().ONE_MORE_AT) {
      game.offerOneMore = true;
      game.hangoverDue = E.hangover;
      return game;
    }
    return morning(state, game, E.hangover);
  }

  // A win pays a rumor by his role, or the loss quest's drinking lead in its
  // place (§30.6), a Legend rumor on a clean Something in the bottle, and a
  // 10% item (§18.4.6). Never gold.
  function reward(state, game) {
    var r = game.result;
    if (lossQuestActive(state) && !PC.quests.hasLead(state, "what_was_lost", "drinking")) {
      PC.quests.addLead(state, "what_was_lost", "drinking");
      r.lead = PC.quests.leadText(state, PC.data.quests.what_was_lost.leads.drinking.journal[state.captain.loss] || PC.data.quests.what_was_lost.leads.drinking.journal.any);
      M().say(state, game, r.lead);
    } else {
      var rec = PC.rumors.draw(state, D().RUMORS[game.opp.role], M().key(state, game, "rumor"), "a drinking match");
      if (rec) { r.rumor = rec; M().say(state, game, rec.text); }
    }
    if (game.bottleClean) {
      var lg = PC.rumors.draw(state, { "Legend": 1 }, M().key(state, game, "legend"), "a drinking match", "Legend");
      if (lg) { r.legend = lg; M().say(state, game, lg.text); }
    }
    var ir = M().rand(state, game, "item");
    if (ir() < D().ITEM_CHANCE) {
      var table = D().ITEMS[game.opp.role];
      if (table) {
        var rare = table.rare.length && ir() < 0.1;
        var item = M().pick(ir, rare ? table.rare : table.uncommon);
        var got = PC.items.gain(state, item);
        r.item = item;
        r.itemChip = PC.items.chip(got, "Won");
        M().say(state, game, "He leaves something behind: " + item + ".");
      }
    }
    PC.state.addLog(state, "Won a drinking match against " + game.opp.name + ".");
  }

  function lossQuestActive(state) {
    var q = state.quests && state.quests.what_was_lost;
    return !!state.captain.loss && (!q || q.status !== "done");
  }

  // Heavy Drinker: play again on the same action, at the Wits he has left.
  function oneMore(state, accept) {
    var game = state.minigame;
    if (!game || !game.offerOneMore) throw new Error("No one's offering.");
    game.offerOneMore = false;
    if (!accept) return morning(state, game, game.hangoverDue);
    state.minigames.oneMoreRounds = (state.minigames.oneMoreRounds || 0) + 1;
    // The ratchet: the third time, Drunkard replaces the flaw (§5.8).
    if (state.minigames.oneMoreRounds >= D().DRUNKARD_AFTER && (state.captain.flaws || []).indexOf("Heavy Drinker") >= 0) {
      state.captain.flaws = state.captain.flaws.filter(function (f) { return f !== "Heavy Drinker"; });
      if (state.captain.tags.indexOf("Drunkard") < 0) state.captain.tags.push("Drunkard");
      PC.state.addLog(state, "Drunkard replaces the Heavy Drinker flaw.");
    }
    state.minigames.drinkSessions += 1;
    var next = newMatch(state, state.minigames.drinkSessions, game.wits);
    next.log = game.log.concat(["", D().lines.oneMore]);
    next.back = game.back;
    next.earlier = (game.earlier || []).concat([game.result]);
    state.minigame = next;
    opening(state, next);
    if ((state.captain.flaws || []).indexOf("Heavy Drinker") < 0) next.ratcheted = true;
    return next;
  }

  // The Hangover roll (Cast-Iron Stomach): a partial or setback gives the
  // Hangover until the next season (§18.4.4).
  function morning(state, game, hang) {
    var dr = hang === "low" ? (game.wits <= D().HANGOVER_AT ? 2 : null) : hang;
    if (dr == null) return done(state, game);
    return M().roll(state, game, { type: "Cast-Iron Stomach", dr: dr }, "hangover", {}, COND);
  }

  function settleHangover(state, game, p) {
    if (p.outcome !== "clean") {
      M().say(state, game, D().lines.hangover);
      PC.scenes.applyEffect(state, { tag: "Hangover", untilSeasonEnd: true });
      game.result.hangover = true;
    }
    return done(state, game);
  }

  function done(state, game) {
    game.over = true;
    return game;
  }

  function view(state, game) {
    var opp = game.opp;
    return {
      opponent: opp.name, role: opp.role,
      trait: game.sizeKnown && game.sizeKnown.trait ? game.sizeKnown.trait : null,
      tolerance: game.sizeKnown ? (game.sizeKnown.tolerance != null ? game.sizeKnown.tolerance + " to start" : game.sizeKnown.band) : null,
      state: { steady: "Steady", wobbling: "Wobbling", doneFor: "Done For" }[stateName(opp)],
      wits: game.wits, witsMax: game.witsMax, ladder: Math.min(D().DR_CAP, ladder(game)), round: game.round,
      mustStrong: game.mustStrong, options: options(state, game), result: game.result, offerOneMore: !!game.offerOneMore,
      tab: tabFor(state, game),
    };
  }

  M().register("drink", { settle: settle, view: view });

  PC.drinking = { canDrink: canDrink, start: start, act: act, oneMore: oneMore, options: options, opponent: opponent };
})();
