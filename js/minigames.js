/* Pirate Chronicle — what the three minigames share (§18.1).
 *
 * A minigame in play lives in state.minigame, and the screen shows it while
 * state.current.screen is "minigame". Each game (js/salvage.js,
 * js/drinking.js, js/liarsdice.js) registers an engine here with:
 *   settle(state, game)  apply the roll waiting in game.pending
 *   view(state, game)    what the screen shows
 * Rolls go through roll() below, so a setback can be rerolled the usual way
 * (a tag, an item or the Drunkard's once a season, §5.7), plus any reroll
 * the game itself grants for one session (Loaded Dice, §32.12).
 *
 * Every roll is seeded (§18.1): world seed, season, the game's own key and a
 * counter, so reloading never changes a result. No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var engines = {};
  function register(kind, engine) { engines[kind] = engine; }
  function engine(game) { var e = engines[game.kind]; if (!e) throw new Error("Unknown minigame: " + game.kind); return e; }

  function current(state) { return state.current && state.current.screen === "minigame" ? state.minigame : null; }

  // Open a game. `back` says where the player goes when it ends: a scene
  // id, or "node" (back to the place he left). The place is kept, so the
  // Tavern or the Graveyard is where he returns.
  function start(state, game, back) {
    game.back = back || "node";
    game.n = 0;
    game.log = game.log || [];
    state.minigame = game;
    state.current = { screen: "minigame" };
    return game;
  }

  // A fresh seeded key for the next draw (dice, a deck, a loot slot).
  function key(state, game, what) {
    game.n = (game.n || 0) + 1;
    return [state.world.seed, PC.state.stamp(state), game.key, what, game.n].join("|");
  }

  function rand(state, game, what) { return PC.rng.fromKey(key(state, game, what)); }

  function pick(r, list) { return list[Math.floor(r() * list.length)]; }

  function weighted(r, weights) { return PC.npcs.weighted(r, weights); }

  function between(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }

  function say(state, game, line) { if (line) game.log.push(PC.text.render(line, state)); }

  // A reroll the captain could use on this roll right now: his own (once a
  // season, PC.checks) or one the game grants for this session.
  function rerollFor(state, game, p) {
    if (!p || p.outcome === "clean" || p.rerolled) return null;
    var own = PC.checks.availableReroll(state, p.check, p.outcome, { conditions: p.conditions });
    if (own) return own;
    var extra = (game.sessionRerolls || []).filter(function (s) { return !s.used && s.types.indexOf(p.check.type) >= 0 && (!s.op || s.op === p.op); })[0];
    return extra ? { id: "session:" + extra.name, name: extra.name, session: true } : null;
  }

  // Roll a check for a game action. The result waits in game.pending; if no
  // reroll is open, it settles at once, otherwise the screen asks first.
  function roll(state, game, check, op, data, conditions) {
    var k = key(state, game, op);
    var res = PC.checks.resolve(state, check, k, { conditions: conditions || [] });
    game.pending = {
      op: op, data: data || {}, check: check, conditions: conditions || [], key: k,
      outcome: res.outcome, roll: { dice: res.dice, total: res.total, edge: res.assessment.edge, tier: res.assessment.tier, type: check.type },
    };
    if (!rerollFor(state, game, game.pending)) return settle(state);
    return game.pending;
  }

  function settle(state) {
    var game = state.minigame;
    if (!game || !game.pending) throw new Error("Nothing to settle.");
    var p = game.pending;
    game.pending = null;
    // logAt: where the log stood, so the screen can show this roll's result
    // box beside the lines it wrote (§41.1, G4 of the M5 playtest).
    game.rollSeq = (game.rollSeq || 0) + 1;
    game.lastRoll = { type: p.check.type, outcome: p.outcome, roll: p.roll, rerolledWith: p.rerolledWith || null, logAt: game.log.length, seq: game.rollSeq, chips: [], op: p.op };
    var eng = engine(game);
    noteRoll(game, { seq: game.rollSeq, label: p.check.type, outcome: p.outcome, op: p.op, mine: true,
      effect: eng.rollEffect ? eng.rollEffect(state, game, p.op, p.outcome) : null });
    return engine(game).settle(state, game, p);
  }

  // Every roll a game makes, in order (N4, §37.12): the screen shows each
  // one's outcome word and what it did, not only the last roll's box.
  // entry: { label, outcome, effect, op, seq, mine }. effect can be filled in
  // later (setRollEffect) once the roll's consequences are known.
  function noteRoll(game, entry) {
    var list = (game.rollList = game.rollList || []);
    entry.logAt = game.log.length;
    if (entry.seq == null) { game.rollSeq = (game.rollSeq || 0) + 1; entry.seq = game.rollSeq; }
    list.push(entry);
    if (list.length > 40) list.splice(0, list.length - 40);
    return entry;
  }
  function setRollEffect(game, effect) {
    var list = game.rollList || [];
    if (list.length && !list[list.length - 1].effect) list[list.length - 1].effect = effect;
  }

  function reroll(state) {
    var game = state.minigame, p = game && game.pending;
    var r = rerollFor(state, game, p);
    if (!r) throw new Error("No reroll available.");
    if (r.session) (game.sessionRerolls || []).filter(function (s) { return "session:" + s.name === r.id; })[0].used = true;
    else state.rerollsUsed[r.id] = (state.rerollsUsed[r.id] || 0) + 1;
    var res = PC.checks.resolve(state, p.check, p.key + "|reroll", { conditions: p.conditions });
    p.outcome = res.outcome; // the new result stands
    p.roll = { dice: res.dice, total: res.total, edge: res.assessment.edge, tier: res.assessment.tier, type: p.check.type };
    p.rerolled = true;
    p.rerolledWith = r.name;
    return settle(state);
  }

  // What the screen shows for the roll waiting on a reroll decision.
  function pendingView(state) {
    var game = state.minigame, p = game && game.pending;
    if (!p) return null;
    var r = rerollFor(state, game, p);
    return { type: p.check.type, outcome: p.outcome, roll: p.roll, reroll: r ? r.name : null };
  }

  // The game is over and the player has read the end: back where he came
  // from (a scene, or the place in town).
  function leave(state) {
    var game = state.minigame;
    if (!game) throw new Error("No minigame in play.");
    if (!game.over) throw new Error("The game isn't over yet.");
    var e = engine(game);
    var to = e.exit ? e.exit(state, game) : game.back;
    if (state.minigame === game) state.minigame = null;
    if (to === null) return; // the exit set the screen itself (a voyage, Milestone 7)
    if (to && to !== "node" && to !== "hub") return PC.scenes.enterScene(state, to);
    state.current = { screen: "node" };
    var next = PC.node.nextQueued(state);
    if (next) PC.scenes.enterScene(state, next);
  }

  function view(state) {
    var game = state.minigame;
    var v = engine(game).view(state, game);
    v.kind = game.kind;
    v.pending = pendingView(state);
    v.over = !!game.over;
    v.log = game.log.slice();
    v.lastRoll = game.lastRoll || null;
    v.rollList = (game.rollList || []).slice();
    v.winBanner = game.winBanner || null; // #31 of the build 0.9 pins
    return v;
  }

  // Edge for a check, for the screen ("Easy", the odds).
  function assess(state, check, conditions) { return PC.checks.assess(state, check, { conditions: conditions || [] }); }

  PC.minigames = {
    register: register,
    current: current,
    start: start,
    key: key,
    rand: rand,
    pick: pick,
    weighted: weighted,
    between: between,
    roll: roll,
    noteRoll: noteRoll,
    setRollEffect: setRollEffect,
    settle: settle,
    reroll: reroll,
    leave: leave,
    view: view,
    assess: assess,
    say: say,
  };
})();
