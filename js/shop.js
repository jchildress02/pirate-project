/* Pirate Chronicle — item merchants, selling and buying from crew gold
 * (§32.5, §32.7; M9 PR 6). Norfolk's Top of the Barrel General Store is the
 * only item merchant built (§17.4.4).
 *
 * The shelves restock once a season, seeded so reloading never changes them;
 * a sold slot stays empty until the next restock. Buying from the purse costs
 * nothing more; from crew gold, −1 morale per 200 gold and +1 Pressure per
 * 3,000 spent since the last split (§32.5). Selling pays 40% into the purse.
 * Engine file: no DOM.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.items; }
  function def(n) { return PC.items.def(n); }
  function here(state) { return state.location && state.location.node; }
  function shopData(id) { return D().SHOPS[id] || null; }
  function lines(id) { return PC.data.nodes[id].lines[shopData(id).npcKey]; }

  function keeper(state, id) {
    var sd = shopData(id);
    if (!sd) return null;
    var who = PC.node.slotNpc(id, sd.npcKey);
    if (!who) { PC.node.initNode(state, id); who = PC.node.slotNpc(id, sd.npcKey); }
    return who;
  }

  // What a shelf can hold, by kind (content/items.js SHOPS.weights).
  function kind(d) {
    if (d.unique || d.notSold || d.relic || d.stock || d.talanee) return null;
    if (d.slot === "pet" || d.art || d.slot === "display") return null;
    if (d.slot === "melee" || d.slot === "ranged" || d.brace) return "weapon";
    if (d.consumable) return "consumable";
    if (d.slot === "hat" || d.slot === "face" || d.slot === "top" || d.slot === "bottom") return "clothing";
    if (d.curio) return "curio";
    if (/Rutter|Guide|Prayer Book|Codex/.test(d.name)) return "book";
    if (d.slot === "trinket") return "gear";
    return null;
  }

  function weighted(r, list, weights) {
    var tot = 0;
    list.forEach(function (n) { tot += weights[kind(def(n))] || 0; });
    var x = r() * tot;
    for (var i = 0; i < list.length; i++) { x -= weights[kind(def(list[i]))] || 0; if (x < 0) return list[i]; }
    return list[list.length - 1];
  }

  // The price here (§32.2): Uncommon × the port's goods multiplier, Rare and
  // up flat (Very Rare ×1.25 at Nassau, not built).
  function price(state, id, name) {
    var d = def(name), t = PC.data.economy.TIERS[PC.data.nodes[id].tier] || { goods: 1 };
    return Math.round(d.tier === "Uncommon" ? d.price * t.goods : d.price);
  }

  // This season's shelves, seeded (§32.7).
  function stock(state, id) {
    id = id || here(state);
    var sd = shopData(id);
    if (!sd) return null;
    state.shops = state.shops || {};
    var st = PC.state.stamp(state), cur = state.shops[id];
    if (cur && cur.stamp === st) return cur;
    var r = PC.rng.fromKey([state.world.seed, st, id, "itemshop"].join("|"));
    var cat = D().catalog, pick = function (tier, n) {
      var pool = Object.keys(cat).filter(function (k) { var d = cat[k]; return d.tier === tier && kind(d) && (sd.weights[kind(d)] || 0) > 0; });
      var out = [];
      for (var i = 0; i < n && pool.length; i++) { var x = weighted(r, pool, sd.weights); out.push(x); pool.splice(pool.indexOf(x), 1); }
      return out;
    };
    var items = pick("Uncommon", sd.uncommon).concat(pick("Rare", sd.rare));
    state.shops[id] = { stamp: st, fresh: !!cur, seen: false, items: items.map(function (n) { return { name: n, price: price(state, id, n), sold: false }; }) };
    return state.shops[id];
  }

  // What buying from crew gold would cost the crew (§32.5), shown beforehand.
  function crewCost(state, gold) {
    var spent = state.crew.itemSpend || 0, per = D().CREW_PRESSURE_PER;
    return { morale: Math.round(gold / D().CREW_MORALE_PER), pressure: Math.floor((spent + gold) / per) - Math.floor(spent / per) };
  }

  function refuses(state, id) { var who = keeper(state, id); return !who || PC.npcs.serviceLevel(state, who) == null; }

  function buy(state, i, from) {
    var id = here(state), L = lines(id), s = stock(state, id), it = s.items[i];
    if (refuses(state, id)) return { line: L.refuse, failed: true };
    if (!it || it.sold) throw new Error("That's already gone.");
    var d = def(it.name);
    if (d.consumable && PC.items.count(state, it.name) >= D().STACK) throw new Error("You carry three already.");
    var chips = [];
    if (from === "crew") {
      if (state.money.crew < it.price) return { line: L.broke, failed: true };
      var cc = crewCost(state, it.price);
      state.money.crew -= it.price;
      state.crew.itemSpend = (state.crew.itemSpend || 0) + it.price;
      if (cc.morale) { PC.crew.addMorale(state, -cc.morale); chips.push({ icon: "morale", text: "Morale −" + cc.morale + " (the crew's gold)", ink: "bad" }); }
      if (cc.pressure) { state.crew.pressure = Math.min(5, (state.crew.pressure || 0) + cc.pressure); chips.push({ icon: "pressure", text: "Pressure +" + cc.pressure, ink: "bad" }); }
      chips.unshift({ icon: "gold", text: "−" + it.price + " crew gold" });
    } else {
      if (state.money.purse < it.price) return { line: L.broke, failed: true };
      state.money.purse -= it.price;
      chips.push({ icon: "gold", text: "−" + it.price + " from your purse" });
    }
    it.sold = true;
    var got = PC.items.gain(state, it.name);
    chips.push(PC.items.chip(got, "Bought"));
    PC.state.addLog(state, "Bought the " + it.name + " for " + it.price + " " + (from === "crew" ? "crew gold" : "from the purse") + ".");
    return { line: d.tier === "Rare" && L.boughtRare ? L.boughtRare : L.bought, chips: chips, item: it.name };
  }

  // Selling (§32.5): 40% of the item's base price, into the purse. Only
  // what's in the inventory (take it off first); never relics (Cael, Maelis
  // and the Sicilian buy those), ship's stock or quest pieces.
  function sellInfo(state, name) {
    var d = def(name), id = here(state);
    if (!d || !shopData(id) || state.jail) return null;
    if (d.stock) return { why: "Ship's stock" };
    if (d.relic) return { why: "Only a collector buys relics" };
    if (refuses(state, id)) return { why: "The shopkeeper won't deal with you" };
    return { gold: Math.max(1, Math.round(d.price * D().SELL_RATE)), why: null };
  }

  function sell(state, name) {
    var id = here(state), L = lines(id), info = sellInfo(state, name);
    if (!info) throw new Error("There's nobody here to buy it.");
    if (info.why) throw new Error(info.why);
    var w = PC.items.worn(state), worn = Object.keys(w).filter(function (k) { return w[k] === name; }).length;
    if (PC.items.count(state, name) - worn < 1) throw new Error("Take it off first.");
    PC.items.lose(state, name);
    state.money.purse += info.gold;
    PC.state.addLog(state, "Sold the " + name + " for " + info.gold + " into the purse.");
    return { line: L.sold, chips: [{ icon: "gold", text: "+" + info.gold + " into your purse" }] };
  }

  // The shop card's view.
  function view(state) {
    var id = here(state), sd = shopData(id);
    if (!sd) return null;
    var who = keeper(state, id), L = lines(id), s = stock(state, id);
    var sl = PC.npcs.serviceLevel(state, who);
    var greet = sl == null ? L.refuse : (L.greet[String(sl)] || L.greet["0"]);
    var opening = !s.seen && s.fresh ? L.newStock : null;
    s.seen = true;
    var left = s.items.filter(function (x) { return !x.sold; }).length;
    return {
      who: who, name: L.name, blurb: L.blurb, greet: greet, opening: opening, refuse: sl == null, soldOut: left === 0 ? L.soldOut : null,
      items: s.items.map(function (x, i) {
        var d = def(x.name), cc = crewCost(state, x.price);
        return { i: i, name: x.name, tier: d.tier, effect: d.effect, inert: d.inert || null, slot: d.slot, price: x.price, sold: x.sold,
          crew: cc, purseOk: state.money.purse >= x.price, crewOk: state.money.crew >= x.price,
          full: !!(d.consumable && PC.items.count(state, x.name) >= D().STACK) };
      }),
    };
  }

  PC.shop = { stock: stock, price: price, crewCost: crewCost, buy: buy, sell: sell, sellInfo: sellInfo, view: view, kind: kind, keeper: keeper };
})();
