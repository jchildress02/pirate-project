/* Pirate Chronicle — the world map, voyages and the season loop (§4, §20.6,
 * §24.13, §26.9-§26.10, §27.7; Milestone 7, §37.12).
 *
 * Voyages: 1-3 AP by §4's table; provisions burn crew ÷ 5 × AP; running
 * short never blocks (a morale hit and a Go Without check, §20.6).
 * The season turn: the hurricane strike (weather, PR 3), idle upkeep, the
 * mutiny Pressure drift, the trade ship, then the new season; at the start
 * of Winter, the split popup; after Winter 1754, the end-of-year screen.
 * The trade ship (§27.7): the Trade Master enrolls one kept prize.
 *
 * Every function changes the state and returns what happened, so the
 * screen can show it; nothing here touches the screen.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function W() { return PC.data.world; }
  function E() { return PC.data.economy; }
  function nodeData(id) { return PC.node.nodeData(id); }
  function here(state) { return state.location && state.location.node; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function fill(line, map) { return String(line || "").replace(/\[(\w+)\]/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
  function stamp(state) { return PC.state.stamp(state); }
  function seasonName(state) { return PC.state.seasonName(state); }
  function rng(state, what) { return PC.rng.fromKey([state.world.seed, stamp(state), what, state.rolls[what] = (state.rolls[what] || 0) + 1].join("|")); }

  // ---- The map ------------------------------------------------------------

  function isLive(id) { return W().live.indexOf(id) >= 0; }
  function isOcean(id) { var n = PC.data.nodes[id]; return !!(n && n.kind === "ocean"); }
  function place(id) { return W().places.filter(function (p) { return p.id === id; })[0] || null; }
  function placeName(id) { var n = PC.data.nodes[id]; return n ? n.name : (place(id) || {}).label || id; }
  function zoneOf(id) { var p = place(id); return p ? p.zone : (PC.data.nodes[id] || {}).zone || "north"; }

  // §4's table. Unknown pairs cost 2 (assumption; not reachable this build).
  function apCost(from, to) {
    if (!from || !to || from === to) return 0;
    var o = W().order, i = o.indexOf(from), j = o.indexOf(to);
    if (i < 0 || j < 0) return 2;
    return W().ap[i][j];
  }

  // ---- Provisions (§20.6) ---------------------------------------------------

  // Who eats at sea: every hand aboard any of the captain's ships, the
  // wounded and the captives (as the hunt counts them). Idle upkeep counts
  // only the crew (§20.6); an enrolled trade ship's crew never count.
  function headsAtSea(state) {
    var n = state.crew.count + (state.crew.wounded || 0) + (state.captives || 0);
    (state.fleet || []).forEach(function (f) { if (!f.out) n += f.crew || 0; });
    return n;
  }

  // The season's Ration Stores check (§20.6): rolled at the first voyage or
  // hunt made on rations each season; the result sets the morale cost per
  // AP sailed on rations (clean none, partial -3, setback -5 and +1 Pressure).
  var RATION_DR = 2; // DEFAULT: §20.6 names Command but no DR
  function rationCheck(state) {
    var u = state.used.rationCheck;
    if (u && u.stamp === stamp(state)) return { outcome: u.outcome, first: false };
    var key = [state.world.seed, stamp(state), "ration-stores"].join("|");
    var r = PC.checks.resolve(state, { type: "Ration Stores", dr: RATION_DR }, key, { conditions: [] });
    state.used.rationCheck = { stamp: stamp(state), outcome: r.outcome };
    if (r.outcome === "setback") state.crew.pressure = (state.crew.pressure || 0) + 1;
    return { outcome: r.outcome, first: true };
  }

  var GO_WITHOUT = [[0.25, 2], [0.5, 3], [1.01, 4]]; // shortfall share → DR (§20.6)

  // Burn provisions for ap actions at sea (a voyage, a hunt's batch) or for
  // idle upkeep (opts.upkeep). Winter burns +50% (§4, §20.6); rationing
  // -25% on voyages and hunts, never below half. Returns what happened:
  // { need, used, short, lines, chips, rationing, goWithout }.
  function burn(state, ap, opts) {
    opts = opts || {};
    var heads = opts.upkeep ? state.crew.count : headsAtSea(state);
    var mult = seasonName(state) === "Winter" ? 1.5 : 1;
    var out = { need: 0, used: 0, short: 0, lines: [], chips: [], rationing: null, goWithout: null };
    if (!opts.upkeep && state.crew.rationing) {
      var rc = rationCheck(state);
      out.rationing = rc.outcome;
      mult *= 0.75;
      var cost = rc.outcome === "partial" ? 3 * ap : rc.outcome === "setback" ? 5 * ap : 0;
      if (cost) PC.crew.addMorale(state, -cost);
      out.chips.push({ icon: "prov", text: "On rations: burn −25%" + (rc.first ? " · Ration Stores " + rc.outcome : "") + (cost ? " · morale −" + cost : ""), ink: cost ? "bad" : null });
      if (rc.first && rc.outcome === "setback") out.chips.push({ icon: "pressure", text: "The crew resent the short rations", ink: "bad" });
    }
    mult = Math.max(0.5, mult);
    var need = Math.ceil(heads / 5 * ap * mult);
    out.need = need;
    var used = Math.min(state.provisions, need);
    state.provisions -= used;
    out.used = used;
    out.short = need - used;
    if (used) out.chips.push({ icon: "prov", text: "−" + plural(used, "provisions lot") + (mult > 1 && seasonName(state) === "Winter" ? " (Winter: +50%)" : ""), ink: "mid" });
    if (out.short > 0) {
      // Hunger (§20.6): -10 morale and a Go Without check, DR by the shortfall.
      PC.crew.addMorale(state, -10);
      state.flags.provisionsRanOut = stamp(state); // a Fear of Poverty trigger (§25.15)
      var share = out.short / Math.max(1, need), dr = 4;
      for (var i = 0; i < GO_WITHOUT.length; i++) if (share <= GO_WITHOUT[i][0]) { dr = GO_WITHOUT[i][1]; break; }
      var key = [state.world.seed, stamp(state), "go-without", state.rolls.goWithout = (state.rolls.goWithout || 0) + 1].join("|");
      var r = PC.checks.resolve(state, { type: "Go Without", dr: dr }, key, { conditions: [seasonName(state)] });
      out.goWithout = { outcome: r.outcome, dr: dr };
      out.lines.push(opts.upkeep ? W().lines.upkeepShort : W().lines.hungry);
      out.chips.push({ icon: "morale", text: "Short " + out.short + " lots: morale −10 · Go Without " + r.outcome, ink: "bad" });
      if (r.outcome === "setback") {
        // 10% of the crew go on the wounded ledger as sick (§20.6).
        var sick = Math.max(1, Math.round(state.crew.count * 0.10));
        sick = Math.min(sick, Math.max(0, state.crew.count - 1));
        if (sick) {
          sicken(state, sick);
          out.lines.push(fill(W().lines.sick, { number: sick }));
          out.chips.push({ icon: "officer", text: plural(sick, "hand") + " sick", ink: "bad" });
        }
        state.flags.desertionPlus = stamp(state); // +10% desertion at the next departure (not built yet)
      }
      state.flags.soreFlag = true; // provisions ran short: the sore flag (§44.9)
    }
    return out;
  }

  // Move hands to the wounded ledger, lowest tiers first.
  function sicken(state, n) {
    var c = state.crew;
    c.woundedTiers = c.woundedTiers || {};
    E().TIER_ORDER.forEach(function (t) {
      var k = Math.min(n, c.tiers[t] || 0);
      if (!k) return;
      c.tiers[t] -= k; c.count -= k; c.wounded = (c.wounded || 0) + k;
      c.woundedTiers[t] = (c.woundedTiers[t] || 0) + k;
      n -= k;
    });
  }

  // ---- Voyages (§4) -----------------------------------------------------------

  function splitWinter(state) { return state.splitWinter === stamp(state); }

  // Can the captain sail from here to `to` now?
  function canSail(state, to, opts) {
    opts = opts || {};
    var from = opts.from || here(state);
    if (!from) return { ok: false, why: "Only from a port or the open sea" };
    if (!isLive(to)) return { ok: false, why: W().lines.uncharted, uncharted: true };
    if (to === from) return { ok: false, why: "You're already here" };
    if (!state.articles) return { ok: false, why: "Sign the Articles before you sail", articles: true };
    if (splitWinter(state)) return { ok: false, why: "The split takes the whole Winter" };
    if (state.crew.count < (state.ship.crewMin || 5)) return { ok: false, why: "Not enough hands to sail her" };
    var n = PC.data.nodes[to];
    if (n && n.closedAt && PC.node.standingBand(state, n.faction).name === n.closedAt) return { ok: false, why: (n.lines.arrival || {}).turnedAway || "They won't let you in", closed: true };
    var cost = opts.free ? 0 : apCost(from, to);
    if (state.ap.left < cost) return { ok: false, why: "Needs " + plural(cost, "action") + "; you have " + state.ap.left + " left this season", cost: cost };
    return { ok: true, cost: cost };
  }

  // Sail. opts.free: the Developer's 0 AP voyage. opts.from: a hunt sailing
  // on from its waters (the voyage starts at that ocean node). Returns the
  // popup the screen shows on arrival.
  function sail(state, to, opts) {
    opts = opts || {};
    var from = opts.from || here(state);
    var c = canSail(state, to, opts);
    if (!c.ok) throw new Error(c.why);
    var cost = opts.free ? 0 : apCost(from, to);
    var lines = [fill(W().lines.sailFor, { Place: placeName(to) })];
    var chips = [];
    if (cost) { PC.crew.spendAP(state, cost); chips.push({ icon: "ap", text: plural(cost, "action") + " at sea" }); }
    var b = burn(state, Math.max(1, cost), {});
    lines = lines.concat(b.lines);
    chips = chips.concat(b.chips);
    var voyage = { from: from, to: to, ap: cost, lines: lines, chips: chips, events: [] };
    // Voyage events: one slot per AP (§44; PR 4 hooks in here).
    if (PC.voyageEvents) PC.voyageEvents.voyage(state, voyage);
    PC.state.addLog(state, "Sailed from " + placeName(from) + " to " + placeName(to) + " (" + plural(cost, "action") + ").");
    state.voyage = voyage;
    if (voyage.pending) return voyage; // an event is waiting; arrive() when it's done
    return arriveFrom(state, voyage);
  }

  // The voyage is over: move the ship and open the arrival.
  function arriveFrom(state, voyage) {
    var to = voyage.to;
    state.voyage = null;
    if (state.gameOver) return null;
    state.location = { node: to, place: null, queue: [] };
    state.current = { screen: "node" };
    PC.node.initNode(state, to);
    if (isOcean(to)) {
      var lines = voyage.lines.concat([fill(W().lines.reachOcean, { Place: placeName(to) })]);
      state.location.popup = { title: PC.data.nodes[to].title || placeName(to), lines: lines, chips: chipsFor(lines).concat(voyage.chips) };
      return state.location.popup;
    }
    return PC.node.arrive(state, to, { voyage: voyage });
  }

  function chipsFor(lines) { return lines.map(function (l) { return { icon: "port", text: l }; }); }

  // The destinations the map lists, with their cost and lock.
  function destinations(state) {
    return W().places.map(function (p) {
      var c = canSail(state, p.id);
      return { id: p.id, label: p.label, x: p.x, y: p.y, labelDx: p.labelDx || 0, labelDy: p.labelDy || 0, zone: p.zone, ocean: !!p.ocean, live: isLive(p.id), here: p.id === here(state),
        cost: apCost(here(state), p.id), ok: c.ok, why: c.ok ? null : c.why, closed: !!c.closed };
    });
  }

  // ---- The season turn (§4, §20.6, §24.13) ----------------------------------

  // What the season-turn steps the other milestones add can hang on:
  // { hurricane: fn(state, out) } (weather, PR 3).
  var hooks = { beforeUpkeep: [], afterTurn: [] };
  function hook(name, fn) { hooks[name].push(fn); }

  // End the season. Returns { lines, chips, yearEnd, winter } for the
  // season-turn popup. After Winter 1754 the run ends on the end-of-year
  // screen (§37.12 P2).
  function endSeason(state) {
    var out = { lines: [], chips: [], from: seasonName(state) + " " + state.time.year };
    hooks.beforeUpkeep.forEach(function (fn) { fn(state, out); });
    // Idle upkeep (§20.6): crew ÷ 5, once, wherever the ship is; Winter
    // +50%; nothing in a split Winter.
    if (!splitWinter(state)) {
      var b = burn(state, 1, { upkeep: true });
      if (b.used) out.lines.push(fill(W().lines.upkeep, { lots: b.used }));
      out.lines = out.lines.concat(b.lines);
      out.chips = out.chips.concat(b.chips);
    }
    // Mutiny Pressure drifts by the morale band at season end (§24.13).
    var band = PC.crew.band(state.crew.morale);
    var dp = band === "Mutinous" ? 2 : band === "Sullen" ? 1 : band === "Eager" || band === "Devoted" ? -1 : 0;
    state.crew.pressure = clamp((state.crew.pressure || 0) + dp, 0, 5);
    // The trade ship's season (§27.7).
    var ts = tradeShipSeason(state);
    out.lines = out.lines.concat(ts.lines);
    out.chips = out.chips.concat(ts.chips);
    // Laid-up ships' anchorage (§20.4).
    out.lines = out.lines.concat(PC.node.layUpSeason(state));
    // The meters (§28): Heat bleed, Standing's drift, Dread's decay.
    var mt = PC.meters.seasonEnd(state);
    out.lines = out.lines.concat(mt.lines);
    out.chips = out.chips.concat(mt.chips);
    var wasWinter = seasonName(state) === "Winter";
    var yearEnd = wasWinter && state.time.year >= 1754 && !state.keepPlaying;
    if (yearEnd) {
      PC.state.addLog(state, "— The end of " + state.time.year + ". —");
      out.yearEnd = true;
      out.recap = recap(state);
      PC.summary.end(state, "year");
      return out;
    }
    PC.state.advanceSeason(state);
    state.splitWinter = null;
    out.to = seasonName(state) + " " + state.time.year;
    hooks.afterTurn.forEach(function (fn) { fn(state, out); });
    // Ear to the Ground (§26.10): a free rumor at the start of Spring.
    if (seasonName(state) === "Spring" && state.flags.earToGround) {
      out.earPick = state.flags.earToGround;
      state.flags.earToGround = null;
    }
    if (state.location) state.location.place = null;
    state.current = { screen: "node" };
    if (seasonName(state) === "Winter") out.winter = startWinter(state);
    return out;
  }

  // The year's numbers for the recap (PH7: the author writes its words).
  function recap(state) {
    var y = state.yearStart || { purse: 0, crew: 0, prizes: 0 };
    return { year: state.time.year, prizes: (state.records.prizes || 0) - (y.prizes || 0), purse: state.money.purse - (y.purse || 0), crew: state.money.crew - (y.crew || 0),
      split: !!state.splitDone };
  }

  // ---- The Winter split (§26.9) -------------------------------------------------

  // The implied share per head of crew gold: what one share would be if the
  // crew split today (crew gold less the carryover, ÷ the weighted shares).
  // Prize ships aren't counted: they're only sold at the split (assumption).
  function impliedShare(state) {
    return Math.round(state.money.crew * (1 - W().CARRYOVER) / Math.max(1, totalShares(state)));
  }

  function holdPressure(state) {
    var s = impliedShare(state);
    return s < 50 ? 0 : s <= 200 ? 1 : 2;
  }

  // The Quartermaster's reading (§26.9): only from an officer at Neutral or
  // better (or the Acting Quartermaster); a ringleader always says "hold".
  function qmReading(state) {
    var qm = PC.officers.quartermaster ? PC.officers.quartermaster(state) : null;
    if (!qm) return null;
    if (qm.rung != null && qm.rung < 0) return null;
    var proj = (state.crew.pressure || 0) + holdPressure(state);
    var k = qm.ringleader ? "hold" : proj >= 4 ? "trouble" : proj >= 2 ? "grumbling" : "hold";
    return { who: (qm.first + " " + (qm.last || "")).trim() || qm.full, key: k, line: W().split.reading[k] };
  }

  function startWinter(state) {
    var forced = (state.crew.pressure || 0) >= 4 && impliedShare(state) >= 50;
    state.split = { step: "ask", forced: forced, at: here(state), bandBefore: PC.crew.band(state.crew.morale) };
    state.current = { screen: "split" };
    return state.split;
  }

  // Hold: no split. Pressure by the implied share (§24.13).
  function holdSplit(state) {
    var sp = state.split;
    if (!sp || sp.step !== "ask") throw new Error("No split to decide.");
    if (sp.forced) throw new Error("The crew won't take no for an answer.");
    var dp = holdPressure(state);
    state.crew.pressure = clamp((state.crew.pressure || 0) + dp, 0, 5);
    PC.state.addLog(state, "No split this Winter" + (dp ? " (the crew's patience wears thinner)" : "") + ".");
    state.split = null;
    state.current = { screen: "node" };
    return { pressure: dp, line: W().split.held };
  }

  // The weighted shares: hands 1 each, officers and fleet captains by the
  // Articles, the captain by his share (a percentage share is taken off the
  // top instead, §26.3).
  function totalShares(state) {
    var hands = state.crew.count + (state.crew.wounded || 0);
    (state.fleet || []).forEach(function (f) { if (!f.out) hands += f.crew || 0; });
    var oa = PC.crew.articleOption(state, "officers");
    var off = 0;
    (state.officers || []).forEach(function (o) { if (!o.gone) off += o.aboard && o.aboard !== "flagship" ? oa.fleet : oa.officer; });
    var cap = PC.crew.articleOption(state, "share");
    return hands + off + (cap.shares || 0);
  }

  // A hull sold at the split node's yard: 15% clean, 8% dirty (or no
  // buyer), × the node's sale multiplier, less her missing HP (§26.9).
  function splitHullValue(state, f) {
    var H = PC.data.hunt, at = here(state), n = PC.data.nodes[at] || {};
    var yard = n.kind !== "ocean" && n.tier;
    var dirty = !!f.dirty;
    var buyerForDirty = n.control === "No control";
    var rate = !yard ? H.HULL_SALE.dirty : dirty && !buyerForDirty ? H.HULL_SALE.dirty : dirty ? H.HULL_SALE.dirty : H.HULL_SALE.clean;
    var mult = yard ? E().TIERS[n.tier].goods : 1;
    var repair = Math.round(E().REPAIR_PER_HP * E().SIZE_REPAIR[f.size || 1] * Math.max(0, f.hullMax - f.hull));
    return Math.max(0, Math.round(H.HULL_VALUE[f.cls] * rate * mult) - repair) + Math.round((f.guns || 0) * E().GUN * H.LOOSE_GUN_SALE * mult);
  }

  // Split: prize ships sold, the pool paid out (§26.9).
  function doSplit(state) {
    var sp = state.split;
    if (!sp || sp.step !== "ask") throw new Error("No split to make.");
    var sold = [];
    (state.fleet || []).filter(function (f) { return f.kind === "prize"; }).forEach(function (f) {
      var g = splitHullValue(state, f);
      state.money.crew += g;
      sold.push({ name: f.name || f.cls, cls: f.cls, gold: g });
      // Her hands come home first (they share as hands).
      E().TIER_ORDER.forEach(function (t) { var n = (f.crewTiers || {})[t] || 0; if (n) { state.crew.tiers[t] += n; state.crew.count += n; } });
      if (!f.crewTiers && f.crew) { state.crew.tiers.Green += f.crew; state.crew.count += f.crew; }
      (state.officers || []).forEach(function (o) { if (o.aboard === f.id) o.aboard = "flagship"; });
    });
    state.fleet = (state.fleet || []).filter(function (f) { return f.kind !== "prize"; });
    var pool = state.money.crew;
    var carry = Math.round(pool * W().CARRYOVER);
    var shareable = pool - carry;
    var cap = PC.crew.articleOption(state, "share");
    var capPct = cap.percent ? Math.round(shareable * cap.percent / 100) : 0;
    var rest = shareable - capPct;
    var shares = totalShares(state);
    var one = shares ? rest / shares : 0;
    var oa = PC.crew.articleOption(state, "officers");
    var capGold = capPct + Math.round(one * (cap.shares || 0));
    var offGold = 0;
    (state.officers || []).forEach(function (o) { if (!o.gone) offGold += Math.round(one * (o.aboard && o.aboard !== "flagship" ? oa.fleet : oa.officer)); });
    var handsN = state.crew.count + (state.crew.wounded || 0);
    (state.fleet || []).forEach(function (f) { if (!f.out) handsN += f.crew || 0; });
    var handGold = Math.round(one * handsN);
    state.money.purse += capGold;
    state.money.crew = carry;
    // Morale to 50 plus the floor, Pressure to 0, officers' approval (§26.9).
    state.crew.morale = clamp(50 + (state.crew.floor || 0), 0, 100);
    state.crew.pressure = 0;
    (state.officers || []).forEach(function (o) { if (!o.gone) o.approval = (o.approval || 0) + W().SPLIT_APPROVAL; });
    sp.payout = { sold: sold, pool: pool, carry: carry, one: Math.round(one), captain: capGold, officers: offGold, hands: handGold, handsN: handsN };
    sp.perHead = Math.round(one);
    sp.step = "payout";
    state.splitWinter = stamp(state);
    state.splitDone = true;
    state.ap.left = 0; // the split takes all 7 AP (§26.9)
    PC.state.addLog(state, "The Winter split: " + Math.round(one) + " gold a share; your share " + capGold + " to your purse; " + carry + " carried over.");
    return sp.payout;
  }

  // What each hand takes away, and how the hands take it (Playtest Pins 0.8,
  // #25; the D1 bands, placeholders): under 50 grumbling, 50-149 content,
  // 150-299 pleased, 300+ delighted.
  function handMood(gold) {
    var bands = W().split.MOOD_BANDS;
    for (var i = bands.length - 1; i >= 0; i--) if (gold >= bands[i].min) return bands[i].word;
    return bands[0].word;
  }

  // Departures and re-signers (§26.9): a skeleton crew stays (the minimum
  // to sail the flagship and every fleet ship, chosen at random) with all
  // officers; everyone else leaves; some re-sign by the morale band before
  // the split.
  function departures(state) {
    var sp = state.split;
    if (!sp || sp.step !== "payout") throw new Error("Not the moment for that.");
    var r = rng(state, "split-departures");
    var rate = W().RESIGN[sp.bandBefore] || 0;
    var left = 0, back = 0;
    function shuffleOut(tiers, keep) {
      var men = [];
      E().TIER_ORDER.forEach(function (t) { for (var i = 0; i < (tiers[t] || 0); i++) men.push(t); });
      for (var i = men.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = men[i]; men[i] = men[j]; men[j] = x; }
      var stay = men.slice(0, keep), go = men.slice(keep);
      var res = {};
      E().TIER_ORDER.forEach(function (t) { res[t] = 0; });
      stay.forEach(function (t) { res[t]++; });
      go.forEach(function (t) { if (r() < rate) { res[t]++; back++; } else left++; });
      return res;
    }
    var skeleton = Math.min(state.ship.crewMin || 5, state.crew.count);
    var flag = shuffleOut(state.crew.tiers, state.ship.crewMin || 5);
    state.crew.tiers = flag;
    state.crew.count = E().TIER_ORDER.reduce(function (a, t) { return a + flag[t]; }, 0);
    (state.fleet || []).forEach(function (f) {
      if (f.out) return;
      var t = f.crewTiers || { Green: f.crew };
      var res = shuffleOut(t, f.crewMin || 0);
      f.crewTiers = res;
      f.crew = E().TIER_ORDER.reduce(function (a, k) { return a + res[k]; }, 0);
    });
    sp.departed = { left: left, back: back, aboard: state.crew.count, skeleton: skeleton };
    // The articles are re-signed now (§26.1): harder terms are allowed again.
    sp.oldTerms = state.articles ? state.articles.terms : null;
    state.articles = null;
    sp.step = "resign";
    PC.state.addLog(state, left + " hands leave with their shares; " + back + " sign on again.");
    return sp.departed;
  }

  // After the re-signing: the Quartermaster stands for re-election (§26.11).
  function afterResign(state) {
    var sp = state.split;
    if (!sp || sp.step !== "resign" || !state.articles) throw new Error("Sign the Articles first.");
    var v = null;
    if (PC.officers.runVote && (state.officers || []).some(function (o) { return !o.gone && (o.aboard || "flagship") === "flagship"; })) {
      v = PC.officers.runVote(state, null, [state.world.seed, stamp(state), "split-vote"].join("|"));
    }
    sp.vote = v ? { winner: (v.winner.first + " " + (v.winner.last || "")).trim() } : null;
    sp.step = "winter";
    return sp.vote;
  }

  // How did you spend the Winter? (§26.10). Which options this node offers.
  function winterOptions(state) {
    var id = sp_at(state), n = PC.data.nodes[id] || {};
    var hasTavern = !!(n.locations && n.locations.tavern);
    var shallow = !!n.freePort || n.draft === "Shallow";
    var faction = n.faction === "avalon" || n.faction === "frisia";
    return W().winterOptions.map(function (o) {
      var ok = !o.needs || (o.needs === "tavern" && hasTavern) || (o.needs === "shallow" && shallow) || (o.needs === "faction" && faction);
      if (o.needs === "home") return null; // no romance or homes yet (hidden, §37.12)
      return ok ? { id: o.id, label: o.label } : null;
    }).filter(Boolean);
  }
  function sp_at(state) { return (state.split && state.split.at) || here(state); }

  function spendWinter(state, id, opts) {
    opts = opts || {};
    var sp = state.split;
    if (!sp || sp.step !== "winter") throw new Error("Not the moment for that.");
    if (!winterOptions(state).some(function (o) { return o.id === id; })) throw new Error("That isn't open here.");
    var o = W().winterOptions.filter(function (x) { return x.id === id; })[0];
    var n = PC.data.nodes[sp_at(state)] || {};
    var chips = [];
    if (id === "carousing") {
      var m = 5 + (n.freePort ? 5 : 0);
      PC.crew.addMorale(state, m);
      chips.push({ icon: "morale", text: "Crew morale +" + m, ink: "good" });
    } else if (id === "careening") {
      state.ship.hull = state.ship.hullMax;
      if (state.ship.rigging === "frayed") { state.ship.rigging = "sound"; state.ship.speed = state.ship.speedMax; }
      var t = state.captain.tags;
      if (t.indexOf("Careened") < 0) t.push("Careened");
      // +1 Outrun for the Spring season: the tag lapses at Spring's end.
      state.captain.tagsUntil = state.captain.tagsUntil || {};
      state.captain.tagsUntil.Careened = (state.time.year + 1) + "-0";
      chips.push({ icon: "hull", text: "Hull fully repaired · +1 Outrun in Spring", ink: "good" });
    } else if (id === "officers") {
      (state.officers || []).forEach(function (x) { if (!x.gone) x.approval = (x.approval || 0) + 1; });
      chips.push({ icon: "person", text: "Every officer warms to you a little" });
    } else if (id === "ear") {
      state.flags.earToGround = opts.type || "World State";
      chips.push({ icon: "rumor", text: "A rumor of your choosing at the start of Spring" });
    } else if (id === "courting") {
      PC.meters.addStanding(state, n.faction, 3);
      chips.push({ icon: "standing", text: (n.faction === "avalon" ? "Avalon" : "Frisian") + " Standing +3", ink: "good" });
    } else if (id === "gaming") {
      state.flags.winterTables = stamp(state);
      chips.push({ icon: "ap", text: "One Liar's Dice session from your purse" });
    } else if (id === "rest") {
      ["Wounded", "Fevered", "Hangover"].forEach(function (tg) { var i = state.captain.tags.indexOf(tg); if (i >= 0) state.captain.tags.splice(i, 1); });
      chips.push({ icon: "person", text: "Wounds, fever and hangovers cleared", ink: "good" });
    }
    sp.spent = { id: id, label: o.label, line: o.line, chips: chips };
    sp.step = "done";
    PC.state.addLog(state, "Spent the Winter: " + o.label + ".");
    return sp.spent;
  }

  function finishSplit(state) {
    state.split = null;
    state.current = { screen: "node" };
    if (state.location) state.location.place = null;
  }

  // ---- The trade ship (§27.7) -----------------------------------------------------

  var TRADE = { FEE: { "Very poor": 1500, "Poor": 2250, "Modest": 3000, "Wealthy": 4500 }, PER_SLOT: 1.25,
    PROSPERITY: { "Very poor": 0.7, "Poor": 0.85, "Modest": 1.0, "Wealthy": 1.15 }, LOSS: 0.02, LOSS_HURRICANE: 0.05, LOSS_HEAT: 0.03, HEAT_AT: 50 };

  function tradeFee(state, id) { return TRADE.FEE[nodeData(id || here(state)).tier] || 3000; }

  // Her buyout: her hull sale value (15% clean, 8% dirty, §22.7) at this
  // node's sale multiplier, less her missing HP; paid from the purse into
  // crew gold as a gift.
  function buyout(state, f) {
    var H = PC.data.hunt, n = nodeData(here(state));
    var rate = f.dirty ? H.HULL_SALE.dirty : H.HULL_SALE.clean;
    var repair = Math.round(E().REPAIR_PER_HP * E().SIZE_REPAIR[f.size || 1] * Math.max(0, f.hullMax - f.hull));
    return Math.max(0, Math.round(H.HULL_VALUE[f.cls] * rate * E().TIERS[n.tier].goods) - repair);
  }

  function tradeIncome(ship, nodeId) { return Math.round(TRADE.PER_SLOT * (ship.cargo || 0) * (TRADE.PROSPERITY[nodeData(nodeId).tier] || 1)); }

  function tradeOptions(state) {
    var id = here(state);
    var who = PC.node.slotNpc(id, "trademaster");
    var refuse = who ? PC.npcs.serviceLevel(state, who) == null : true;
    var prizes = (state.fleet || []).filter(function (f) { return f.kind === "prize" && !f.out; });
    var ts = state.tradeShip;
    var paidBefore = ts ? ts.paid : 0;
    return prizes.map(function (f) {
      var b = buyout(state, f), fee = tradeFee(state), cost = b + fee;
      var swap = !!ts;
      var due = swap ? Math.max(0, cost - paidBefore) : cost;
      var gate = PC.meters.officialGate(state, id); // Wary +20%, barred at Hostile (§28.2)
      fee = Math.round(fee * gate.mult); cost = b + fee; due = swap ? Math.max(0, cost - paidBefore) : cost;
      var lock = !gate.ok ? gate.why : refuse ? "He won't deal with you" : ts && ts.node !== id ? "Your trade ship is enrolled at " + placeName(ts.node) + "; swap her there" : state.money.purse < due ? "Needs " + due + " gold in your purse" : null;
      if (!lock && swap && !(state.crew.count - (state.ship.crewMin || 5) >= (ts.ship.crewMin || 0))) lock = "Not enough hands to bring your old trade ship back";
      return { id: f.id, name: f.name || f.cls, cls: f.cls, cargo: f.cargo, dirty: !!f.dirty, buyout: b, fee: fee, cost: cost, due: due, swap: swap, income: tradeIncome(f, id), lock: lock };
    });
  }

  function enroll(state, fid) {
    var id = here(state), L = nodeData(id).lines.trademaster || PC.data.nodes.norfolk.lines.trademaster;
    var opt = tradeOptions(state).filter(function (o) { return o.id === fid; })[0];
    if (!opt) throw new Error("No such ship.");
    if (opt.lock) return { line: /purse/.test(opt.lock) ? L.broke : L.refuse, failed: true, why: opt.lock };
    var f = state.fleet.filter(function (x) { return x.id === fid; })[0];
    var ts = state.tradeShip;
    var buyPart = opt.swap ? Math.min(opt.due, Math.max(0, opt.buyout - (ts.buyout || 0))) : opt.buyout;
    var feePart = opt.due - buyPart;
    state.money.purse -= opt.due;
    var morale = 0;
    if (buyPart > 0) {
      morale = PC.crew.giftMorale(state, buyPart);
      state.money.crew += buyPart;
      var st = stamp(state);
      if (state.used.giftStamp !== st) { state.used.giftStamp = st; state.used.giftMorale = 0; }
      state.used.giftMorale += morale;
      PC.crew.addMorale(state, morale);
    }
    // Her prize crew come home to the flagship; any without a berth are paid off.
    var home = 0, paid = 0;
    E().TIER_ORDER.forEach(function (t) {
      var n = (f.crewTiers || { Green: f.crew })[t] || 0;
      var k = Math.min(n, PC.crew.berths(state));
      if (k) { state.crew.tiers[t] += k; state.crew.count += k; home += k; }
      paid += n - k;
    });
    if (paid) PC.crew.payFrom(state, paid * PC.crew.payOffEach(state), true);
    state.fleet = state.fleet.filter(function (x) { return x !== f; });
    var old = null;
    if (ts) {
      // The old trade ship rejoins the fleet as a prize ship (assumption:
      // needs a free prize-ship slot, which her replacement just freed).
      old = ts.ship;
      var tiers = {}, need = old.crewMin || 0;
      E().TIER_ORDER.forEach(function (t) { var k = Math.min(need, state.crew.tiers[t] || 0); if (k) { state.crew.tiers[t] -= k; state.crew.count -= k; tiers[t] = k; need -= k; } });
      old.crew = old.crewMin || 0; old.crewTiers = tiers; old.kind = "prize";
      state.fleet.push(old);
    }
    var ship = JSON.parse(JSON.stringify(f));
    state.tradeShip = { ship: ship, node: id, buyout: (ts ? ts.buyout : 0) + buyPart, paid: (ts ? ts.paid : 0) + opt.due, ledger: ts ? ts.ledger : 0, since: stamp(state), lostChance: null };
    PC.state.addLog(state, (ts ? "Swapped the trade ship for the " : "Enrolled the ") + (f.name || f.cls) + " with the Trade Master at " + placeName(id) + " (" + opt.due + " gold from your purse).");
    var who = PC.node.slotNpc(id, "trademaster");
    if (who) PC.node.ladderTick(state, who, "visit");
    return { line: L.enrolled, paid: opt.due, buyPart: buyPart, feePart: feePart, morale: morale, home: home, paidOff: paid, old: old ? (old.name || old.cls) : null };
  }

  // Each season: her income into the ledger, then the loss roll (§27.7).
  function tradeShipSeason(state) {
    var ts = state.tradeShip, out = { lines: [], chips: [] };
    if (!ts) return out;
    var inc = tradeIncome(ts.ship, ts.node);
    var heat = Math.max(state.meters.heat.avalon || 0, state.meters.heat.frisia || 0);
    var p = (seasonName(state) === "Hurricane" ? TRADE.LOSS_HURRICANE : TRADE.LOSS) + (heat >= TRADE.HEAT_AT ? TRADE.LOSS_HEAT : 0);
    if (rng(state, "trade-loss")() < p) {
      out.lines.push("PLACEHOLDER (PH8): Word comes that the " + (ts.ship.name || ts.ship.cls) + " has been lost at sea. Everything you put into her, and her earnings waiting at " + placeName(ts.node) + ", are gone.");
      out.chips.push({ icon: "hull", text: "Trade ship lost" + (ts.ledger ? " · " + ts.ledger + " gold uncollected" : ""), ink: "bad" });
      PC.state.addLog(state, "The trade ship " + (ts.ship.name || ts.ship.cls) + " was lost at sea.");
      state.tradeShip = null;
      return out;
    }
    ts.ledger += inc;
    out.chips.push({ icon: "gold", text: "Your trade ship earned " + inc + " gold, waiting at " + placeName(ts.node) });
    return out;
  }

  // Collected on arrival at her node (the arrival popup; holdings in M9).
  function collectLedger(state, id) {
    var ts = state.tradeShip;
    if (!ts || ts.node !== id || !ts.ledger) return null;
    var g = ts.ledger;
    ts.ledger = 0;
    state.money.purse += g;
    PC.state.addLog(state, "Collected " + g + " gold of trade-ship earnings at " + placeName(id) + ".");
    return g;
  }

  // ---- Developer (§37.12) ------------------------------------------------------------

  // Skip ahead to a season of this year (or the next one): every turn runs
  // as normal, and a Winter on the way is held (no split).
  function devSkipTo(state, seasonIndex) {
    for (var guard = 0; guard < 8; guard++) {
      if (state.split) holdSplitQuiet(state);
      var o = endSeason(state);
      if (state.split) holdSplitQuiet(state);
      if (o.yearEnd || state.time.season === seasonIndex) return o;
    }
    return null;
  }
  function holdSplitQuiet(state) {
    if (state.split && state.split.step === "ask") { state.split.forced = false; holdSplit(state); }
    else finishSplit(state);
  }

  PC.world = {
    TRADE: TRADE,
    isLive: isLive, isOcean: isOcean, place: place, placeName: placeName, zoneOf: zoneOf, apCost: apCost,
    headsAtSea: headsAtSea, burn: burn,
    canSail: canSail, sail: sail, arriveFrom: arriveFrom, destinations: destinations,
    hook: hook, endSeason: endSeason, splitWinter: splitWinter,
    impliedShare: impliedShare, holdPressure: holdPressure, qmReading: qmReading, startWinter: startWinter, holdSplit: holdSplit,
    doSplit: doSplit, handMood: handMood, departures: departures, afterResign: afterResign, winterOptions: winterOptions, spendWinter: spendWinter, finishSplit: finishSplit,
    totalShares: totalShares, splitHullValue: splitHullValue,
    tradeFee: tradeFee, buyout: buyout, tradeIncome: tradeIncome, tradeOptions: tradeOptions, enroll: enroll, collectLedger: collectLedger,
    devSkipTo: devSkipTo,
  };
})();
