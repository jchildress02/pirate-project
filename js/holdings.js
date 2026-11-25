/* Pirate Chronicle — holdings and homes (§27.5, §27.6, §28.2; M9 PR 7).
 *
 * state.holdings: [{ node, type, level, live, ledger, since, warned, display }]
 *   level   upgrades bought (0-2); `live` is the level that pays (an upgrade,
 *           and a new holding, pay from the next season)
 *   ledger  income waiting, uncapped, collected on arrival at the node
 *   display a home's displayed items (§32.6)
 * One of each type per node. Bought from the purse, with the seller's
 * friendship and the Standing gate. Sold back to the seller at 50%.
 * At Hostile Standing: a one-season warning, then the seller seizes them
 * (§28.2). Raids, rebuilds and confiscation on a change of control come
 * with M10. Engine file: no DOM.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.holdings; }
  function nd(id) { return PC.data.nodes[id]; }
  function list(state) { return (state.holdings = state.holdings || []); }
  function find(state, node, type) { return list(state).filter(function (h) { return h.node === node && h.type === type; })[0] || null; }
  function here(state) { return state.location && state.location.node; }

  // The seller of a type at a node: { npc, place, lines }.
  function seller(state, node, type) {
    var cfg = D().NODES[node];
    if (!cfg || cfg.types.indexOf(type) < 0) return null;
    var s = cfg[D().TYPES[type].seller];
    var npc = s.npc || PC.node.slotNpc(node, s.slot);
    if (!npc && s.slot) { PC.node.initNode(state, node); npc = PC.node.slotNpc(node, s.slot); }
    return { npc: npc, place: s.place, lines: nd(node).lines[s.lines], key: D().TYPES[type].seller };
  }

  function basePrice(node, type) { return D().TYPES[type].price[nd(node).tier] || 0; }
  // What everything put in is worth at the current tier (sell-back, §27.5).
  function putIn(node, type, level) {
    var p = basePrice(node, type), u = D().UPGRADE_COST, v = p;
    for (var i = 0; i < level; i++) v += p * u[i];
    return v;
  }
  // The seller's friendship and the Standing gate (Wary +20%), on purchases
  // and upgrades (§27.5, §28.2).
  function priceMult(state, node, type) {
    var s = seller(state, node, type), sl = PC.npcs.serviceLevel(state, s.npc);
    var gate = PC.meters.officialGate(state, node);
    return (1 + (D().FRIENDSHIP[String(sl)] || 0)) * gate.mult;
  }
  function lock(state, node, type) {
    var s = seller(state, node, type);
    if (!s || !s.npc) return "No one sells that here";
    if (PC.npcs.serviceLevel(state, s.npc) == null) return "He won't deal with you";
    var gate = PC.meters.officialGate(state, node);
    if (!gate.ok) return gate.why;
    return null;
  }

  function income(h) {
    var inc = D().TYPES[h.type].income;
    if (!inc) return 0;
    return Math.round((inc[nd(h.node).tier] || 0) * D().UPGRADE_INCOME[h.live || 0]);
  }
  function rumorBonus(state, node) {
    var h = find(state, node, "tavern");
    if (!h || !h.on) return 0;
    return (D().TYPES.tavern.rumors || 0) + ((h.live || 0) >= 2 ? 1 : 0);
  }

  // What a seller offers the captain here.
  function offers(state, node, sellerKey) {
    node = node || here(state);
    var cfg = D().NODES[node];
    if (!cfg) return [];
    return cfg.types.filter(function (t) { return D().TYPES[t].seller === sellerKey; }).map(function (t) {
      var h = find(state, node, t), mult = priceMult(state, node, t), why = lock(state, node, t);
      var o = { type: t, name: D().TYPES[t].name, owned: !!h, lock: why, holding: h };
      if (!h) {
        o.price = Math.round(basePrice(node, t) * mult);
        o.income = D().TYPES[t].income ? D().TYPES[t].income[nd(node).tier] : 0;
        if (!why && state.money.purse < o.price) o.lock = "Needs " + o.price + " gold in your purse";
      } else {
        if (t !== "home" && h.level < 2) {
          o.upgrade = { n: h.level + 1, name: D().UPGRADE_NAMES[t][h.level], price: Math.round(basePrice(node, t) * D().UPGRADE_COST[h.level] * mult),
            income: Math.round((D().TYPES[t].income[nd(node).tier] || 0) * D().UPGRADE_INCOME[h.level + 1]) };
          if (!why && state.money.purse < o.upgrade.price) o.upgrade.lock = "Needs " + o.upgrade.price + " gold in your purse";
        }
        o.sellBack = Math.round(putIn(node, t, h.level) * D().SELL_BACK);
      }
      return o;
    });
  }

  function buy(state, type) {
    var node = here(state), s = seller(state, node, type), L = s.lines;
    if (find(state, node, type)) throw new Error("You own one here already.");
    var why = lock(state, node, type);
    if (why) return { line: L.locked || L.refuse, failed: true, why: why };
    var price = Math.round(basePrice(node, type) * priceMult(state, node, type));
    if (state.money.purse < price) return { line: L.broke, failed: true };
    state.money.purse -= price;
    var h = { node: node, type: type, level: 0, live: 0, on: false, ledger: 0, since: PC.state.stamp(state), warned: false };
    if (type === "home") { h.display = []; h.on = true; }
    list(state).push(h);
    PC.state.addLog(state, "Bought a " + D().TYPES[type].name.toLowerCase() + " at " + nd(node).name + " for " + price + " gold.");
    return { line: L.bought[type], paid: price, holding: h };
  }

  function upgrade(state, type) {
    var node = here(state), s = seller(state, node, type), L = s.lines, h = find(state, node, type);
    if (!h || type === "home" || h.level >= 2) throw new Error("Nothing to upgrade.");
    var why = lock(state, node, type);
    if (why) return { line: L.locked || L.refuse, failed: true, why: why };
    var price = Math.round(basePrice(node, type) * D().UPGRADE_COST[h.level] * priceMult(state, node, type));
    if (state.money.purse < price) return { line: L.broke, failed: true };
    state.money.purse -= price;
    h.level += 1;
    PC.state.addLog(state, "Paid " + price + " gold for " + D().UPGRADE_NAMES[type][h.level - 1].replace(/^PLACEHOLDER: /, "") + " at " + nd(node).name + ".");
    return { line: L.upgraded, paid: price };
  }

  // Sell back to the seller (§27.5): the ledger first, then 50% of
  // everything put in. A home's displays come back to the inventory.
  function sellBack(state, type) {
    var node = here(state), s = seller(state, node, type), L = s.lines, h = find(state, node, type);
    if (!h) throw new Error("You don't own that.");
    if (PC.npcs.serviceLevel(state, s.npc) == null) return { line: L.refuse || L.locked, failed: true };
    var g = Math.round(putIn(node, type, h.level) * D().SELL_BACK) + (h.ledger || 0);
    state.money.purse += g;
    (h.display || []).forEach(function (n) { state.captain.items.push(n); });
    state.holdings = list(state).filter(function (x) { return x !== h; });
    PC.state.addLog(state, "Sold back the " + D().TYPES[type].name.toLowerCase() + " at " + nd(node).name + " for " + g + " gold.");
    return { line: L.soldBack, gold: g };
  }

  // Each season's end: income into the ledgers, upgrades take hold, and the
  // Hostile warning or seizure (§27.5, §28.2).
  function season(state) {
    var out = { lines: [], chips: [] };
    list(state).slice().forEach(function (h) {
      var gate = PC.meters.officialGate(state, h.node);
      if (!gate.ok) {
        if (!h.warned) { h.warned = true; out.lines.push(D().lines.warn.replace("{node}", nd(h.node).name)); return; }
        (h.display || []).forEach(function (n) { state.captain.items.push(n); }); // DEFAULT: a seized home's displays come back
        state.holdings = list(state).filter(function (x) { return x !== h; });
        out.lines.push(D().lines.seized.replace("{node}", nd(h.node).name));
        out.chips.push({ icon: "gold", text: D().TYPES[h.type].name + " at " + nd(h.node).name + " seized", ink: "bad" });
        PC.state.addLog(state, "The " + D().TYPES[h.type].name.toLowerCase() + " at " + nd(h.node).name + " was seized.");
        return;
      }
      h.warned = false;
      if (h.on) { var inc = income(h); if (inc) h.ledger += inc; }
      h.on = true;
      h.live = h.level;
    });
    var tot = list(state).reduce(function (a, h) { return a + (h.on ? income(h) : 0); }, 0);
    if (tot) out.chips.push({ icon: "gold", text: "Your holdings earn about " + tot + " gold a season" });
    return out;
  }

  // Collected on arrival at the node (the arrival popup).
  function collect(state, node) {
    var g = 0;
    list(state).forEach(function (h) { if (h.node === node && h.ledger) { g += h.ledger; h.ledger = 0; } });
    if (!g) return null;
    state.money.purse += g;
    PC.state.addLog(state, "Collected " + g + " gold from your holdings at " + nd(node).name + ".");
    var L = nd(node).lines.harbormaster;
    return D().lines.ledger.replace("{gold}", g) + (L && L.earnings ? " " + L.earnings : "");
  }

  // ---- Homes and their displays (§27.6, §32.6) -----------------------------
  function home(state, node) { return find(state, node, "home"); }
  function homeSpots(node) { return D().HOME_SPOTS[nd(node).tier] || 1; }
  // Every item displayed in any home: they work wherever the captain is.
  function displays(state) {
    var out = [];
    list(state).forEach(function (h) { (h.display || []).forEach(function (n) { out.push(n); }); });
    return out;
  }
  // Hang or take down at a home only while in that port (DEFAULT).
  function hang(state, name) {
    var node = here(state), h = home(state, node);
    if (!h) throw new Error("You have no home here.");
    var why = PC.items.swapLock(state);
    if (why) throw new Error(why);
    var d = PC.items.def(name);
    if (!d || d.slot !== "display") throw new Error("That isn't for display.");
    if (!PC.items.owns(state, name)) throw new Error("You don't have that.");
    if (h.display.indexOf(name) >= 0) throw new Error("It already hangs there.");
    if (h.display.length >= homeSpots(node)) throw new Error("Your home has no free spot.");
    PC.items.lose(state, name);
    h.display.push(name);
    if (PC.meters) PC.meters.liftToFloor(state);
  }
  function takeDown(state, name) {
    var node = here(state), h = home(state, node);
    if (!h) throw new Error("You have no home here.");
    var why = PC.items.swapLock(state);
    if (why) throw new Error(why);
    var i = h.display.indexOf(name);
    if (i < 0) throw new Error("That isn't on display here.");
    h.display.splice(i, 1);
    state.captain.items.push(name);
  }

  // The Holdings panel's view (D5): per node, the trade ship beside them.
  function view(state) {
    var rows = list(state).map(function (h) {
      return { node: h.node, nodeName: nd(h.node).name, type: h.type, name: D().TYPES[h.type].name, level: h.level, live: h.live, on: h.on,
        upgrades: h.type === "home" ? null : D().UPGRADE_NAMES[h.type].slice(0, h.level).map(function (n) { return n.replace(/^PLACEHOLDER: /, ""); }),
        income: h.on ? income(h) : 0, pending: !h.on || h.live !== h.level, ledger: h.ledger, warned: h.warned,
        display: h.display || null, spots: h.type === "home" ? homeSpots(h.node) : 0 };
    });
    var ts = state.tradeShip;
    return { rows: rows, trade: ts ? { name: ts.ship.name || ts.ship.cls, node: PC.world.placeName(ts.node), income: PC.world.tradeIncome(ts.ship, ts.node), ledger: ts.ledger } : null };
  }

  PC.holdings = {
    list: list, find: find, seller: seller, offers: offers, buy: buy, upgrade: upgrade, sellBack: sellBack,
    season: season, collect: collect, income: income, rumorBonus: rumorBonus, basePrice: basePrice,
    home: home, homeSpots: homeSpots, displays: displays, hang: hang, takeDown: takeDown, view: view,
  };
})();
