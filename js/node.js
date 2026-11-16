/* Pirate Chronicle — nodes: locations, first-visit locks, the services and
 * the arrival (§17, §20, §21.6, §24.7, §29). Ocracoke is the only node in
 * the prototype (§37).
 *
 * Every function here changes the state and returns what happened, so the
 * screen can show it; nothing here touches the screen.
 *
 * Who pays: running costs (provisions, repairs, guns, crew, lodging, the
 * harbor due, goods for the hold) come from crew gold, and sales go to crew
 * gold (§20.4, §27.1). The captain moves purse gold to the crew with "Give
 * to the crew" (§27.4).
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function E() { return PC.data.economy; }
  function nodeData(id) { var n = PC.data.nodes[id]; if (!n) throw new Error("Unknown node: " + id); return n; }
  function here(state) { return state.location && state.location.node; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function money(n) { return Math.round(n * 100) / 100; }

  // ---- The node's state ---------------------------------------------------

  function initNode(state, id) {
    var nd = nodeData(id);
    state.nodes[id] = state.nodes[id] || { prosperity: nd.prosperity, season: null };
    (nd.slots || []).forEach(function (s) { PC.npcs.fillSlot(state, s); });
  }

  // Everything that resets each season: the stock, the crew pool, the
  // buyers' caps, what's been sold (§20.3, §24.7, §29.4).
  function season(state, id) {
    id = id || here(state);
    var ns = state.nodes[id];
    var st = PC.state.stamp(state);
    if (!ns.season || ns.season.stamp !== st) {
      var nd = nodeData(id);
      ns.season = {
        stamp: st,
        stock: rollStock(state, nd),
        pool: rollPool(state, nd),
        hired: { Green: 0, Able: 0, Seasoned: 0, Veteran: 0 },
        provisionerPaid: 0,   // gold paid out by the provisioner (his cap)
        fencePaid: 0,         // gold paid out by the fence (his cap)
        sold: {},             // units of each good sold here, for the glut rule
        soldGold: 0,          // for prosperity (§20.2)
        prosperityGained: 0,
        traded: {},           // gold traded with each merchant (the visit rule)
      };
    }
    return ns.season;
  }

  function tierOf(state, id) { return E().TIERS[nodeData(id || here(state)).tier]; }

  // ---- The market (§20.9, §29.4) ------------------------------------------

  function rollStock(state, nd) {
    var m = nd.market || {};
    var st = PC.state.stamp(state);
    if (m.fixed && m.fixed[st]) return JSON.parse(JSON.stringify(m.fixed[st]));
    var r = PC.rng.fromKey([state.world.seed, st, nd.id, "stock"].join("|"));
    var out = {};
    Object.keys(m.produces || {}).forEach(function (g) {
      var p = m.produces[g];
      out[g] = p.min + Math.floor(r() * (p.max - p.min + 1));
    });
    if (m.bulk) {
      var w = JSON.parse(JSON.stringify(m.bulk.weights));
      for (var i = 0; i < m.bulk.count && Object.keys(w).length; i++) {
        var g = PC.npcs.weighted(r, w);
        delete w[g];
        out[g] = m.bulk.min + Math.floor(r() * (m.bulk.max - m.bulk.min + 1));
      }
    }
    return out;
  }

  // The seeded ±10% a season on each good (§20.9).
  function drift(state, id, good) {
    var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), id, "drift", good].join("|"));
    return 1 + (r() * 2 - 1) * E().DRIFT;
  }

  // Demand, stepped down a notch for each glut this season (§20.9).
  function demandOf(state, id, good) {
    var nd = nodeData(id);
    var base = (nd.market && nd.market.demand && nd.market.demand[good]) || "Normal";
    if (base === "Won't buy") return base;
    var sold = (season(state, id).sold[good] || 0);
    var steps = E().DEMAND_STEPS;
    var i = steps.indexOf(base) - Math.floor(sold / (E().GLUT_UNITS + 1));
    return steps[Math.max(0, i)];
  }

  // What a merchant here pays for one unit (§20.9): base × demand ×
  // goods-and-services × drift. World-state modifiers aren't built yet.
  function salePrice(state, id, good) {
    var info = PC.data.goods[good];
    if (!info) return 0;
    var d = demandOf(state, id, good);
    if (d === "Won't buy") return 0;
    return money(info.base * E().DEMAND[d] * tierOf(state, id).goods * drift(state, id, good));
  }

  // What the provisioner charges for one unit: produced goods at ×0.6 of
  // base, others at the node's sale price ×1.2 (§29.4).
  function shopPrice(state, id, good, npc) {
    var nd = nodeData(id);
    var info = PC.data.goods[good];
    var raw = nd.market.produces && nd.market.produces[good] ? info.base * E().PRODUCED_PRICE : salePrice(state, id, good) * E().SHOP_MARKUP;
    return money(raw * purchaseMult(state, id, npc, "merchant"));
  }

  // ---- Prices, Service Level and Standing ---------------------------------

  function standingBand(state, faction) {
    var v = state.meters.standing[faction] || 0;
    var bands = E().STANDING_BANDS;
    for (var i = 0; i < bands.length; i++) if (v >= bands[i].min) return bands[i];
    return bands[bands.length - 1];
  }

  // Purchase multiplier: the NPC's Service Level (§15.6) and Wary or
  // Hostile Standing with the node's faction (+10%, §29.3).
  function purchaseMult(state, id, npc, kind) {
    var m = 1;
    if (npc) {
      var sl = PC.npcs.serviceLevel(state, npc);
      var step = kind === "craftsman" ? E().CRAFTSMAN_STEP : E().MERCHANT_BUY_STEP;
      if (sl != null) m *= 1 - step * sl;
    }
    var b = standingBand(state, nodeData(id).faction).name;
    if (b === "Wary" || b === "Hostile") m *= 1 + E().WARY_STANDING_SURCHARGE;
    return m;
  }

  // Standing sale bonus on clean sales to a faction's merchants (§28.1).
  function standingSaleBonus(state, id) {
    var b = standingBand(state, nodeData(id).faction).name;
    return { Favored: 0.05, Trusted: 0.10, Honored: 0.15 }[b] || 0;
  }

  // ---- The NPCs who serve here -------------------------------------------

  function slotNpc(id, key) {
    var s = (nodeData(id).slots || []).filter(function (x) { return x.key === key; })[0];
    return s ? s.id : null;
  }

  // A greeting by rung, or the refusal (Enemy and Rival refuse, §15.6).
  function greeting(state, id, who, linesKey) {
    var L = nodeData(id).lines[linesKey];
    var sl = PC.npcs.serviceLevel(state, who);
    if (sl == null) return { refuse: true, line: L.refuse };
    return { refuse: false, line: L.greet[String(sl)] || L.greet["0"] };
  }

  // Passive ladder moves (§15.6): +1 rung every 3 visits (or commissions),
  // at most one passive rung a season.
  function ladderTick(state, who, kind) {
    var d = (state.npcs[who] = state.npcs[who] || {});
    var st = PC.state.stamp(state);
    if (kind === "visit") {
      if (d.visitStamp === st) return false;
      d.visitStamp = st;
    }
    d.ticks = (d.ticks || 0) + 1;
    if (d.ticks % 3 === 0 && d.movedStamp !== st && PC.npcs.rung(state, who) < 3) {
      d.movedStamp = st;
      PC.npcs.moveRung(state, who, 1);
      return true;
    }
    return false;
  }

  // ---- Locations and first-visit locks (§17.2) ----------------------------

  var F = {
    opening: "ocr_opening_done",
    tavernDone: "ocr_first_tavern_done",
    tavernAction: "ocr_first_tavern_action",
    underworld: "ocr_underworld_done",
    dyingWish: "ocr_dpw_done",
    docks: "ocr_rr_done",
  };

  function flag(state, f) { return state.flags[f] === true; }

  function places(state) {
    var id = here(state), nd = nodeData(id);
    var firstVisit = !flag(state, F.tavernDone);
    return ["tavern", "docks", "merchant", "graveyard", "ship"].map(function (p) {
      var out = { id: p, name: nd.locations[p].name, locked: false, why: null };
      if (firstVisit && p !== "tavern" && p !== "ship") { out.locked = true; out.why = "Come back after your first visit"; }
      else if (p === "graveyard" && !flag(state, F.dyingWish) && !flag(state, "dpw_retry")) { out.locked = true; out.hidden = true; out.why = "Come back after A Dying Pirate's Wish"; }
      return out;
    });
  }

  // Entering a location. Returns a scene to play first, if one fires.
  function enter(state, place) {
    var p = places(state).filter(function (x) { return x.id === place; })[0];
    if (!p) throw new Error("No such place: " + place);
    if (p.locked) throw new Error(p.why);
    state.location.place = place;
    state.location.say = null;
    // Each walk into a place is one visit (one action covers every officer
    // hire on a Tavern visit, §25.7).
    state.location.visit = (state.location.visit || 0) + 1;
    var id = here(state);
    // The persistent Minors count as met once the captain walks into their place.
    var meet = { tavern: "keeper", docks: "shipwright", merchant: "provisioner" }[place];
    if (meet) { var mid = slotNpc(id, meet); (state.npcs[mid] = state.npcs[mid] || {}).met = true; }
    if (place === "docks" && !flag(state, F.docks)) return "ocr_rr_1";
    return null;
  }

  // Leaving a location. On the first Tavern visit, Welcome to the
  // Underworld fires on leaving if nothing was done, then A Dying
  // Pirate's Wish (§17.2).
  function leave(state) {
    var place = state.location.place;
    state.location.place = null;
    state.location.say = null;
    var queue = [];
    if (place === "tavern" && !flag(state, F.tavernDone)) {
      state.flags[F.tavernDone] = true;
      if (!flag(state, F.underworld) && !(state.location.queue || []).length) queue.push("ocr_uw_1");
      if (!flag(state, F.dyingWish)) queue.push("ocr_dpw_1");
    }
    state.location.queue = (state.location.queue || []).concat(queue);
    return nextQueued(state);
  }

  function nextQueued(state) {
    var q = state.location.queue || [];
    while (q.length) {
      var s = q.shift();
      if (!state.seen[s]) return s;
    }
    return null;
  }

  // The first Tavern action triggers Welcome to the Underworld right after
  // it resolves (§17.2).
  function tavernActionDone(state) {
    if (flag(state, F.tavernDone) || flag(state, F.tavernAction)) return;
    state.flags[F.tavernAction] = true;
    if (!flag(state, F.underworld)) state.location.queue = (state.location.queue || []).concat(["ocr_uw_1"]);
  }

  // A season with an action spent at the Tavern is a visit for the keeper's
  // ladder (§30.4): lodging, officer recruitment, Gather Intelligence.
  function tavernVisit(state) {
    return ladderTick(state, slotNpc(here(state), "keeper"), "visit");
  }

  // The one-armed pirate sits in the Tavern for Variants A and C until his
  // lead is heard (§17.2).
  function oneArmedHere(state) {
    var loss = state.captain.loss;
    return (loss === "A" || loss === "C") && !flag(state, "lead_trident_heard");
  }

  // Officer recruitment and Gather Intelligence open after the first visit.
  function tavernServiceCheck(state, ap) {
    if (!flag(state, F.tavernDone)) return { ok: false, why: "Not on your first visit" };
    if (ap && state.ap.left < ap) return { ok: false, why: "Not enough time this season" };
    return { ok: true };
  }

  // ---- The tavern keeper -----------------------------------------------------

  function talkToKeeper(state) {
    var id = here(state), who = slotNpc(id, "keeper");
    var L = nodeData(id).lines.keeper;
    var g = greeting(state, id, who, "keeper");
    var first = !state.npcs[who] || !state.npcs[who].met;
    state.npcs[who] = state.npcs[who] || {};
    state.npcs[who].met = true;
    return { refuse: g.refuse, line: g.refuse ? L.refuse : (first ? L.first : g.line) };
  }

  // ---- Shore leave (§24.12) ---------------------------------------------------

  function lodgingCost(state, ap) { return tierOf(state).lodging * state.crew.count * ap; }

  function lodgingCheck(state, ap) {
    if (!flag(state, F.tavernDone)) return { ok: false, why: "Not on your first visit" };
    var who = slotNpc(here(state), "keeper");
    if (PC.npcs.serviceLevel(state, who) == null) return { ok: false, why: "The tavern keeper won't serve you" };
    if (PC.crew.usedThisSeason(state, "lodging")) return { ok: false, why: "Once a season" };
    if (state.ap.left < ap) return { ok: false, why: "Not enough time this season" };
    if (state.money.crew < lodgingCost(state, ap)) return { ok: false, why: "Needs " + lodgingCost(state, ap) + " crew gold" };
    return { ok: true };
  }

  function lodging(state, ap) {
    var c = lodgingCheck(state, ap);
    if (!c.ok) throw new Error(c.why);
    var cost = lodgingCost(state, ap);
    state.money.crew -= cost;
    PC.crew.spendAP(state, ap);
    PC.crew.markUsed(state, "lodging");
    var gain = (ap >= 2 ? 15 : 10) + (nodeData(here(state)).freePort ? 5 : 0);
    PC.crew.addMorale(state, gain);
    var tags = state.captain.tags, h = tags.indexOf("Hangover");
    if (h >= 0) tags.splice(h, 1);
    var who = slotNpc(here(state), "keeper");
    var up = ladderTick(state, who, "visit"); // a season with AP spent at the Tavern
    tavernActionDone(state);
    PC.state.addLog(state, "Shore leave for the crew: " + cost + " crew gold, " + ap + " action" + (ap > 1 ? "s" : "") + ", +" + gain + " morale.");
    var L = nodeData(here(state)).lines.keeper;
    // The Drunkard and Heavy Drinker temptations are not built yet.
    return { cost: cost, morale: gain, line: up ? L.rungUp : L.lodgingBought };
  }

  // ---- The provisioner (§17.2, §20.3, §29.4) --------------------------------

  function provisionsPrice(state) {
    var id = here(state);
    return money(E().PROVISIONS_LOT * tierOf(state).goods * purchaseMult(state, id, slotNpc(id, "provisioner"), "merchant"));
  }

  function provisionerCap(state) {
    var id = here(state), who = slotNpc(id, "provisioner");
    var sl = PC.npcs.serviceLevel(state, who) || 0;
    return Math.round(nodeData(id).provisionerCap * (1 + E().MERCHANT_CAP_STEP * sl));
  }

  function provisionerCapLeft(state) { return Math.max(0, provisionerCap(state) - season(state).provisionerPaid); }

  function noteTrade(state, who, gold, lines) {
    var s = season(state);
    s.traded[who] = (s.traded[who] || 0) + gold;
    var up = false;
    if (s.traded[who] >= E().MERCHANT_VISIT_GOLD && s.traded[who] - gold < E().MERCHANT_VISIT_GOLD) up = ladderTick(state, who, "visit");
    return up ? lines.rungUp : null;
  }

  function buyProvisions(state, n) {
    n = Math.floor(n);
    if (n <= 0) throw new Error("Buy at least one lot.");
    var id = here(state), who = slotNpc(id, "provisioner");
    var L = nodeData(id).lines.provisioner;
    if (PC.npcs.serviceLevel(state, who) == null) return { line: L.refuse };
    if (n > PC.crew.slotsFree(state)) throw new Error("Not enough room in the hold.");
    var cost = Math.round(provisionsPrice(state) * n);
    if (state.money.crew < cost) return { line: L.broke, failed: true };
    state.money.crew -= cost;
    state.provisions += n;
    PC.state.addLog(state, "Bought " + n + " provisions lot" + (n > 1 ? "s" : "") + " for " + cost + " crew gold.");
    return { cost: cost, line: noteTrade(state, who, cost, L) || L.provisions };
  }

  function buyGood(state, good, n) {
    n = Math.floor(n);
    if (n <= 0) throw new Error("Buy at least one.");
    var id = here(state), who = slotNpc(id, "provisioner");
    var L = nodeData(id).lines.provisioner;
    if (PC.npcs.serviceLevel(state, who) == null) return { line: L.refuse };
    var s = season(state);
    if ((s.stock[good] || 0) < n) throw new Error("He doesn't have that many.");
    if (n > PC.crew.slotsFree(state)) throw new Error("Not enough room in the hold.");
    var cost = Math.round(shopPrice(state, id, good, who) * n);
    if (state.money.crew < cost) return { line: L.broke, failed: true };
    state.money.crew -= cost;
    s.stock[good] -= n;
    PC.crew.addGood(state, good, n, false);
    PC.state.addLog(state, "Bought " + n + " " + good + " for " + cost + " crew gold.");
    return { cost: cost, line: noteTrade(state, who, cost, L) || L.goods };
  }

  // What a buyer pays for one unit. "provisioner": clean only, with the
  // Service Level and Standing sale bonuses. "fence": dirty only, 55% of
  // the merchant price plus 5% a Service Level (§20.3, §15.6).
  function unitPrice(state, buyer, what) {
    var id = here(state);
    var base = what === "treasure" ? E().TREASURE_UNIT * tierOf(state).treasure : salePrice(state, id, what);
    if (buyer === "fence") {
      var f = nodeData(id).fence;
      var sl = PC.npcs.serviceLevel(state, f.npc) || 0;
      return money(base * (E().FENCE_RATE + E().FENCE_SL_STEP * sl));
    }
    var who = slotNpc(id, "provisioner");
    var psl = PC.npcs.serviceLevel(state, who) || 0;
    return money(base * (1 + E().MERCHANT_SELL_STEP * psl + standingSaleBonus(state, id)));
  }

  function fenceOpen(state) {
    var f = nodeData(here(state)).fence;
    return !!(f && flag(state, f.opensWith));
  }

  function fenceCapLeft(state) { return Math.max(0, nodeData(here(state)).fence.cap - season(state).fencePaid); }

  // Sell to the provisioner or the fence. Sells as many whole units as the
  // buyer's cap allows. Proceeds go to crew gold.
  function sell(state, buyer, what, n) {
    n = Math.floor(n);
    var id = here(state), nd = nodeData(id);
    var dirty = buyer === "fence";
    var L = dirty ? nd.lines.fence : nd.lines.provisioner;
    var who = dirty ? nd.fence.npc : slotNpc(id, "provisioner");
    if (dirty && !fenceOpen(state)) throw new Error("There's no fence here yet.");
    if (PC.npcs.serviceLevel(state, who) == null) return { line: L.refuse, units: 0, gold: 0 };
    var k = dirty ? "dirty" : "clean";
    var have = what === "treasure" ? state.cargo.treasure[k] : ((state.cargo.goods[what] || {})[k] || 0);
    if (n <= 0 || have < n) throw new Error("You don't have that many.");
    var each = unitPrice(state, buyer, what);
    if (each <= 0) return { line: L.goodsSold ? "\"I've no use for that.\"" : L.nothing, units: 0, gold: 0 };
    var s = season(state);
    var capLeft = dirty ? fenceCapLeft(state) : provisionerCapLeft(state);
    var units = Math.min(n, Math.floor(capLeft / each));
    if (units <= 0) return { line: L.capReached, units: 0, gold: 0 };
    var gold = Math.round(each * units);
    if (what === "treasure") state.cargo.treasure[k] -= units;
    else { PC.crew.removeGood(state, what, units, dirty); s.sold[what] = (s.sold[what] || 0) + units; }
    state.money.crew += gold;
    if (dirty) s.fencePaid += gold; else s.provisionerPaid += gold;
    // Selling here slowly raises prosperity (§20.2; fence sales count, assumption).
    s.soldGold += gold;
    var gain = Math.min(E().PROSPERITY_SEASON_CAP, Math.floor(s.soldGold / E().PROSPERITY_PER_SOLD)) - s.prosperityGained;
    if (gain > 0) { s.prosperityGained += gain; state.nodes[id].prosperity = clamp(state.nodes[id].prosperity + gain, 0, 100); }
    var label = what === "treasure" ? (dirty ? "dirty " : "") + "treasure" : (dirty ? "dirty " : "") + what;
    PC.state.addLog(state, "Sold " + units + " " + label + " to " + PC.npcs.get(state, who).full + " for " + gold + " crew gold.");
    var line;
    if (dirty) {
      ladderTick(state, who, "deal") && (line = L.rungUp);
      line = line || (units < n ? L.capReached : (gold >= 0.6 * nd.fence.cap ? L.bigHaul : L.sold));
      var fr = PC.rumors ? PC.rumors.fenceDealRumor(state, who) : null; // a chance on each deal (§30.4)
      if (fr) return { units: units, gold: gold, line: line, partial: units < n, rumor: fr };
    } else {
      line = noteTrade(state, who, gold, L) || (units < n ? L.capReached : (what === "treasure" ? L.treasureSold : L.goodsSold));
    }
    return { units: units, gold: gold, line: line, partial: units < n };
  }

  // ---- The shipwright (§17.2, §21.6, §21.7) -----------------------------------

  function craftMult(state) {
    var id = here(state);
    return tierOf(state).goods * purchaseMult(state, id, slotNpc(id, "shipwright"), "craftsman");
  }

  function repairPerHp(state) { return money(E().REPAIR_PER_HP * E().SIZE_REPAIR[state.ship.size] * craftMult(state)); }
  function repairCost(state, hp) { return Math.round(repairPerHp(state) * hp); }
  function repairTakesAP(state, hp) { return hp >= E().BIG_REPAIR_SHARE * state.ship.hullMax; }

  function shipwrightGreeting(state) { var id = here(state); return greeting(state, id, slotNpc(id, "shipwright"), "shipwright"); }

  function repair(state, hp) {
    var id = here(state), L = nodeData(id).lines.shipwright;
    var sh = state.ship;
    hp = Math.min(Math.floor(hp), sh.hullMax - sh.hull);
    if (shipwrightGreeting(state).refuse) return { line: L.refuse };
    if (hp <= 0) return { line: L.nothingToFix };
    var cost = repairCost(state, hp);
    var ap = repairTakesAP(state, hp) ? 1 : 0;
    if (state.ap.left < ap) throw new Error("A big repair takes an action, and you have none left.");
    if (state.money.crew < cost) return { line: L.broke, failed: true };
    state.money.crew -= cost;
    if (ap) PC.crew.spendAP(state, ap);
    sh.hull += hp;
    var fixed = false;
    if (sh.rigging === "frayed") { sh.rigging = "sound"; sh.speed = sh.speedMax; fixed = true; } // §21.7
    var up = ladderTick(state, slotNpc(id, "shipwright"), "commission");
    PC.state.addLog(state, "Repaired " + hp + " hull for " + cost + " crew gold" + (ap ? " and an action" : "") + (fixed ? "; the frayed rigging is fixed too" : "") + ".");
    return { cost: cost, ap: ap, fixedRigging: fixed, line: ap ? L.bigRepair : L.repair, rungUp: up };
  }

  var TRACKS = { hull: "Hull", rigging: "Rigging", guns: "Guns" };

  function upgradeInfo(state, track) {
    var id = here(state), nd = nodeData(id);
    var cur = state.ship.upgrades[track];
    var next = cur + 1;
    var cap = nd.yardMax;
    var out = { track: track, name: TRACKS[track], level: cur, next: next };
    if (next > 5) { out.locked = "At the top level"; return out; }
    if (next > cap) { out.locked = "This yard tops out at level " + cap; out.atCap = true; return out; }
    out.cost = Math.round(E().UPGRADE[next] * E().SIZE_UPGRADE[state.ship.size] * craftMult(state));
    out.effect = track === "hull" ? "Max hull +" + (hullMaxAt(state, next) - state.ship.hullMax)
      : track === "rigging" ? (next === 3 ? "+1 Speed" : next === 5 ? "+1 Handling" : (state.ship.rigging === "frayed" ? "Fixes the frayed rigging" : "No change until level 3"))
      : (next === 3 || next === 5 ? "+1 Gunnery" : "No change until level 3");
    return out;
  }

  function hullMaxAt(state, level) {
    return Math.round(state.ship.baseHull * (1 + E().HULL_PER_LEVEL * (level - 1)));
  }

  function upgrade(state, track) {
    var id = here(state), L = nodeData(id).lines.shipwright;
    if (shipwrightGreeting(state).refuse) return { line: L.refuse };
    var u = upgradeInfo(state, track);
    if (u.locked) return { line: u.atCap ? L.atCap : u.locked, failed: true };
    if (state.money.crew < u.cost) return { line: L.broke, failed: true };
    state.money.crew -= u.cost;
    var sh = state.ship;
    sh.upgrades[track] = u.next;
    if (track === "hull") {
      var add = hullMaxAt(state, u.next) - sh.hullMax;
      sh.hullMax += add;
      sh.hull += add; // the new planks come sound
    }
    if (track === "rigging") {
      if (sh.rigging === "frayed") { sh.rigging = "sound"; sh.speed = sh.speedMax; } // §21.7
      if (u.next === 3) { sh.speedMax += 1; sh.speed = sh.speedMax; }
    }
    ladderTick(state, slotNpc(id, "shipwright"), "commission");
    PC.state.addLog(state, "Bought " + u.name + " level " + u.next + " for " + u.cost + " crew gold.");
    return { cost: u.cost, line: L.upgrade };
  }

  function gunPrice(state) { return money(E().GUN * craftMult(state)); }

  function buyGuns(state, n) {
    var id = here(state), L = nodeData(id).lines.shipwright;
    n = Math.min(Math.floor(n), state.ship.gunsMax - state.ship.guns);
    if (shipwrightGreeting(state).refuse) return { line: L.refuse };
    if (n <= 0) return { line: "Every gun port already has a gun.", failed: true };
    var cost = Math.round(gunPrice(state) * n);
    if (state.money.crew < cost) return { line: L.broke, failed: true };
    state.money.crew -= cost;
    state.ship.guns += n;
    ladderTick(state, slotNpc(id, "shipwright"), "commission");
    PC.state.addLog(state, "Bought " + n + " gun" + (n > 1 ? "s" : "") + " for " + cost + " crew gold.");
    return { cost: cost, line: L.guns };
  }

  // ---- Crew recruitment and paying off hands (§24.7) -----------------------

  function rollPool(state, nd) {
    var p = nd.crewPool;
    if (!p) return { Green: 0, Able: 0, Seasoned: 0, Veteran: 0 };
    var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), nd.id, "crewpool"].join("|"));
    var size = p.min + Math.floor(r() * (p.max - p.min + 1));
    var out = { Green: 0, Able: 0, Seasoned: 0, Veteran: 0 };
    for (var i = 0; i < size; i++) out[PC.npcs.weighted(r, p.mix)] += 1;
    return out;
  }

  // The pool's size this season after its modifiers: the Articles'
  // reputation (§26.5) and Dread at a pirate haven (§24.7). The Dread bonus
  // comes with meter modifiers (not built yet), so it is +0 for now.
  function poolMult(state) {
    return PC.articles.currentReputation(state).pool;
  }

  function poolAvailable(state) {
    var s = season(state);
    var m = poolMult(state);
    var out = {};
    Object.keys(s.pool).forEach(function (t) { out[t] = Math.max(0, Math.floor(s.pool[t] * m) - s.hired[t]); });
    return out;
  }

  function signingCost(state, tier) {
    var id = here(state);
    var c = E().SIGNING[tier] * tierOf(state).goods * purchaseMult(state, id, null);
    if (PC.crew.band(state.crew.morale) === "Mutinous") c *= 2; // free ports sell at double (§24.7)
    return money(c);
  }

  function recruit(state, tier, n) {
    var L = nodeData(here(state)).lines.crew;
    n = Math.floor(n);
    if (n <= 0) throw new Error("Sign at least one hand.");
    var avail = poolAvailable(state)[tier] || 0;
    if (!avail) return { line: L.empty, failed: true };
    if (PC.crew.berths(state) <= 0) return { line: L.full, failed: true };
    n = Math.min(n, avail, PC.crew.berths(state));
    var cost = Math.round(signingCost(state, tier) * n);
    if (state.money.crew < cost) throw new Error("Needs " + cost + " crew gold.");
    state.money.crew -= cost;
    season(state).hired[tier] += n;
    PC.crew.addHands(state, tier, n);
    PC.state.addLog(state, "Signed " + n + " " + tier + " hand" + (n > 1 ? "s" : "") + " for " + cost + " crew gold.");
    return { n: n, cost: cost, line: PC.crew.band(state.crew.morale) === "Mutinous" ? L.doublePrice : L.signed };
  }

  function payOff(state, tier, n) {
    var L = nodeData(here(state)).lines.crew;
    n = Math.floor(n);
    if (n <= 0) throw new Error("Pay off at least one hand.");
    var each = PC.crew.payOffEach(state);
    var cost = each * n;
    if (state.money.crew < cost) throw new Error("Needs " + cost + " crew gold (" + each + " a hand).");
    PC.crew.removeHands(state, tier, n);
    state.money.crew -= cost;
    PC.state.addLog(state, "Paid off " + n + " " + tier + " hand" + (n > 1 ? "s" : "") + " at " + each + " each (" + cost + " crew gold).");
    return { n: n, cost: cost, each: each, line: L.paidOff.replace("[number]", n) };
  }

  // ---- The arrival and the port fee (§17.1, §20.4, §24.9) ---------------------

  function portFee(state, id) {
    id = id || here(state);
    var nd = nodeData(id);
    return Math.round(nd.portFeeBase * state.ship.size * standingBand(state, nd.faction).fee);
  }

  // The harbor due and its shortfall (§17.2). The crew gold on hand pays
  // what it can; the rest is waived by a leader at Friend or better, or
  // taken in kind at the provisioner's prices: clean treasure, dirty
  // treasure, goods (clean before dirty), provisions. With nothing left: a
  // night in the stocks, 1 AP lost (placeholder until jail exists).
  // Taking the gold on hand first is this build's reading (flagged).
  function payPortFee(state, id) {
    id = id || here(state);
    var nd = nodeData(id), L = nd.lines.arrival;
    var fee = portFee(state, id);
    if (state.money.crew >= fee) {
      state.money.crew -= fee;
      return { fee: fee, paid: fee, lines: [L.duePaid + " (" + fee + " gold)"] };
    }
    var paid = state.money.crew;
    state.money.crew = 0;
    var short = fee - paid;
    if (nd.dueWaivedBy && PC.npcs.rung(state, nd.dueWaivedBy) >= 2) {
      return { fee: fee, paid: paid, waived: short, lines: [L.dueWaived] };
    }
    var taken = [];
    function takeUnits(label, have, price, remove) {
      if (short <= 0 || have <= 0 || price <= 0) return;
      var n = Math.min(have, Math.ceil(short / price));
      remove(n);
      short -= n * price;
      taken.push(n + " " + label);
    }
    var tPrice = E().TREASURE_UNIT * tierOf(state, id).treasure;
    takeUnits("clean treasure", state.cargo.treasure.clean, tPrice, function (n) { state.cargo.treasure.clean -= n; });
    takeUnits("dirty treasure", state.cargo.treasure.dirty, tPrice, function (n) { state.cargo.treasure.dirty -= n; });
    ["clean", "dirty"].forEach(function (k) {
      Object.keys(state.cargo.goods).forEach(function (g) {
        var have = (state.cargo.goods[g] || {})[k] || 0;
        takeUnits((k === "dirty" ? "dirty " : "") + g, have, salePrice(state, id, g), function (n) { PC.crew.removeGood(state, g, n, k === "dirty"); });
      });
    });
    takeUnits("provisions lots", state.provisions, E().PROVISIONS_LOT * tierOf(state, id).goods, function (n) { state.provisions -= n; });
    var lines = [];
    if (taken.length) lines.push(L.dueShort.replace("[what they take]", taken.join(", ")));
    if (short > 0) {
      state.ap.left = Math.max(0, state.ap.left - 1);
      lines.push(L.stocks);
    }
    PC.state.addLog(state, "Couldn't pay the harbor due in full" + (taken.length ? "; they took " + taken.join(", ") : "") + (short > 0 ? "; a night in the stocks (1 action lost)" : "") + ".");
    return { fee: fee, paid: paid, taken: taken, stocks: short > 0, lines: lines };
  }

  // Every arrival (a hunt's return counts): the wounded, the maimed, the
  // captives, holdings, then the port fee (§24.9). Returns the popup.
  function arrive(state, id, opts) {
    opts = opts || {};
    id = id || here(state);
    var nd = nodeData(id), L = nd.lines.arrival;
    var lines = [];
    if (opts.fromHunt) lines.push(L.back);
    var c = state.crew;
    if (c.wounded > 0) {
      var cook = (state.officers || []).some(function (o) { return !o.gone && o.type === "Cook" && o.aboard === "flagship"; });
      var rate = cook ? 0.45 : 0.30;
      var r = PC.rng.fromKey([state.world.seed, PC.state.stamp(state), id, "arrival", state.rolls.arrival = (state.rolls.arrival || 0) + 1].join("|"));
      var back = 0;
      for (var i = 0; i < c.wounded; i++) if (r() < rate) back++;
      var maimed = c.wounded - back;
      // Recovered hands rejoin as Green here; the hunt milestone tracks
      // the wounded by tier.
      if (back) { c.tiers.Green += back; c.count += back; lines.push(L.recovered.replace(/\[number\]/i, back)); }
      c.wounded = 0;
      if (maimed) {
        var comp = PC.crew.articleOption(state, "compensation");
        var each = Math.max(comp.min, Math.round(PC.crew.oneShare(state) * comp.shares));
        var cost = each * maimed;
        if (state.money.crew >= cost) {
          state.money.crew -= cost;
          lines.push(L.maimed.replace(/\[number\]/i, maimed) + " (" + cost + " gold)");
        } else {
          state.money.crew = 0;
          PC.crew.addMorale(state, -20);
          c.pressure += 2;
          lines.push(L.maimed.replace(/\[number\]/i, maimed) + " There isn't enough crew gold to pay them their due: the crew call it a breach of the Articles.");
        }
      }
    }
    // Captives and holdings come with the prize hunt and after the prototype.
    var fee = payPortFee(state, id);
    lines = lines.concat(fee.lines);
    state.location.popup = { title: "Arrival at " + nd.name, lines: lines };
    return state.location.popup;
  }

  PC.node = {
    FLAGS: F,
    initNode: initNode,
    season: season,
    tierOf: tierOf,
    nodeData: nodeData,
    here: here,
    salePrice: salePrice,
    shopPrice: shopPrice,
    demandOf: demandOf,
    standingBand: standingBand,
    purchaseMult: purchaseMult,
    slotNpc: slotNpc,
    greeting: greeting,
    places: places,
    enter: enter,
    leave: leave,
    nextQueued: nextQueued,
    tavernActionDone: tavernActionDone,
    tavernVisit: tavernVisit,
    oneArmedHere: oneArmedHere,
    tavernServiceCheck: tavernServiceCheck,
    ladderTick: ladderTick,
    talkToKeeper: talkToKeeper,
    lodgingCost: lodgingCost,
    lodgingCheck: lodgingCheck,
    lodging: lodging,
    provisionsPrice: provisionsPrice,
    provisionerCap: provisionerCap,
    provisionerCapLeft: provisionerCapLeft,
    buyProvisions: buyProvisions,
    buyGood: buyGood,
    unitPrice: unitPrice,
    fenceOpen: fenceOpen,
    fenceCapLeft: fenceCapLeft,
    sell: sell,
    repairPerHp: repairPerHp,
    repairCost: repairCost,
    repairTakesAP: repairTakesAP,
    shipwrightGreeting: shipwrightGreeting,
    repair: repair,
    upgradeInfo: upgradeInfo,
    upgrade: upgrade,
    gunPrice: gunPrice,
    buyGuns: buyGuns,
    poolAvailable: poolAvailable,
    signingCost: signingCost,
    recruit: recruit,
    payOff: payOff,
    portFee: portFee,
    payPortFee: payPortFee,
    arrive: arrive,
  };
})();
