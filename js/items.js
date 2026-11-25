/* Pirate Chronicle — items and the equipment screen (§32; M9 PR 5).
 *
 * The captain owns items (state.captain.items, a list of names; consumables
 * appear once per unit) and wears some of them (state.captain.equip, a slot
 * map). Only equipped items work, except: the Pistol Brace works from the
 * inventory, consumables offer themselves on their check, and display items
 * work while they hang in the flagship's cabin (state.ship.cabin, §32.6;
 * PR 6 retired the carried-display stand-in). Items with no catalog entry
 * (quest pieces) keep working while carried, as before.
 *
 * Swaps cost 0 AP, but never in a battle, a minigame or a scene (§32.3).
 * Engine file: no DOM.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.items; }
  function def(name) { return D().catalog[name] || null; }

  // Slot keys: one each, but two trinkets, a second pet with Beastmaster and
  // a second ranged slot (a pistol only) with the Pistol Brace (§32.3).
  var KEYS = ["hat", "face", "top", "bottom", "pet", "pet2", "melee", "ranged", "ranged2", "trinket", "trinket2"];
  function baseSlot(key) { return key.replace(/2$/, ""); }
  function emptyEquip() { var e = {}; KEYS.forEach(function (k) { e[k] = null; }); return e; }

  function owns(captain, name) { return (captain.items || []).indexOf(name) >= 0; }
  function count(captain, name) { return (captain.items || []).filter(function (n) { return n === name; }).length; }
  function hasTag(captain, t) { return (captain.tags || []).indexOf(t) >= 0 || (captain.traits || []).indexOf(t) >= 0; }

  function keyOpen(captain, key) {
    if (key === "pet2") return hasTag(captain, "Beastmaster");
    if (key === "ranged2") return owns(captain, "Pistol Brace");
    return true;
  }
  function openKeys(captain) { return KEYS.filter(function (k) { return keyOpen(captain, k); }); }

  // Can this item go in this slot key?
  function fits(name, key) {
    var d = def(name);
    if (!d || d.slot !== baseSlot(key)) return false;
    if (key === "ranged2" && !d.pistol) return false;
    return true;
  }

  // The items actually worn: valid, owned (a second copy for a second slot).
  function wornOf(captain) {
    var eq = captain.equip || {}, used = {}, out = {};
    KEYS.forEach(function (k) {
      var n = eq[k];
      if (!n || !keyOpen(captain, k) || !fits(n, k)) return;
      if ((used[n] || 0) >= count(captain, n)) return;
      used[n] = (used[n] || 0) + 1;
      out[k] = n;
    });
    return out;
  }

  // Every item name whose effects are live, once each. `state`, when given,
  // adds what hangs in the flagship's cabin (§32.6).
  function activeOf(captain, state) {
    var w = wornOf(captain), seen = {}, out = [];
    function add(n) { if (!seen[n]) { seen[n] = true; out.push(n); } }
    Object.keys(w).forEach(function (k) { add(w[k]); });
    (captain.items || []).forEach(function (n) {
      var d = def(n);
      if (!d) add(n);                                // quest pieces work while carried
      else if (d.brace) add(n);                      // the Pistol Brace, from inventory
    });
    if (state) { cabin(state).forEach(add); if (PC.holdings) PC.holdings.displays(state).forEach(add); } // the cabin and homes (§32.6)
    return out;
  }

  function active(state) { return activeOf(state.captain, state); }
  function has(state, name) { return active(state).indexOf(name) >= 0; }
  function worn(state) { return wornOf(state.captain); }

  // ---- Swapping (0 AP; not in a battle, a minigame or a scene) --------------

  function swapLock(state) {
    var c = state.current || {};
    if (state.minigame) return "Not now: finish what you're doing first.";
    if (c.screen === "scene" || c.screen === "event") return D().lines.equipLocked;
    return null;
  }

  function equip(state, name, key) {
    var why = swapLock(state);
    if (why) throw new Error(why);
    var cap = state.captain;
    if (!owns(cap, name)) throw new Error("You don't have that.");
    if (!keyOpen(cap, key)) throw new Error("That slot isn't open.");
    if (!fits(name, key)) throw new Error("That doesn't go there.");
    cap.equip = cap.equip || emptyEquip();
    // The same item in another slot moves, unless there's a second copy.
    var w = wornOf(cap);
    var elsewhere = Object.keys(w).filter(function (k) { return k !== key && w[k] === name; });
    if (elsewhere.length >= count(cap, name)) cap.equip[elsewhere[0]] = null;
    cap.equip[key] = name;
    after(state);
    return key;
  }

  function unequip(state, key) {
    var why = swapLock(state);
    if (why) throw new Error(why);
    var cap = state.captain;
    cap.equip = cap.equip || emptyEquip();
    cap.equip[key] = null;
    after(state);
  }

  // A floor that rose lifts Dread or morale at once (§5.6).
  function after(state) {
    if (PC.meters && state.meters) PC.meters.liftToFloor(state);
    if (state.crew && PC.crew) state.crew.morale = Math.max(state.crew.morale, PC.crew.floor(state));
  }

  // The first open, fitting, empty slot for an item, or null.
  function freeKey(captain, name) {
    var w = wornOf(captain);
    var keys = openKeys(captain).filter(function (k) { return fits(name, k) && !w[k]; });
    return keys[0] || null;
  }
  // Every slot an item could go in (for the swap buttons).
  function keysFor(captain, name) { return openKeys(captain).filter(function (k) { return fits(name, k); }); }

  // ---- Gaining and losing ----------------------------------------------------

  // A new item goes to the captain (§32.16). DEFAULT: it's worn at once if
  // its slot is empty; otherwise it waits in the inventory. Consumables
  // stack to 3; a fourth is left behind. Returns { name, key, full }.
  function gain(state, name, opts) {
    opts = opts || {};
    var cap = state.captain, d = def(name);
    cap.items = cap.items || [];
    if (d && d.consumable && count(cap, name) >= D().STACK) return { name: name, full: true };
    cap.items.push(name);
    var key = null;
    if (d && d.slot !== "inventory" && d.slot !== "display" && !opts.noEquip) {
      key = freeKey(cap, name);
      if (key) { cap.equip = cap.equip || emptyEquip(); cap.equip[key] = name; }
    }
    after(state);
    return { name: name, key: key };
  }

  function lose(state, name) {
    var cap = state.captain, i = (cap.items || []).lastIndexOf(name);
    if (i < 0) return false;
    cap.items.splice(i, 1);
    if (count(cap, name) === 0 && cap.equip) KEYS.forEach(function (k) { if (cap.equip[k] === name) cap.equip[k] = null; });
    return true;
  }

  // A found item's chip (the hunt, a dive, a drinking win, a scene).
  function chip(res, where) {
    if (res.full) return { icon: "item", text: "No room for another " + res.name + " (3 is the most)", ink: "bad" };
    return { icon: "item", text: (where || "Found") + ": " + res.name + (res.key ? " (worn)" : " (to your inventory)"), ink: "oxblood" };
  }

  // Fill empty slots from what's carried (a migrated save; the creator).
  function autoEquip(captain) {
    captain.equip = captain.equip || emptyEquip();
    (captain.items || []).forEach(function (n) {
      var d = def(n);
      if (!d || d.slot === "inventory" || d.slot === "display") return;
      var w = wornOf(captain);
      if (Object.keys(w).some(function (k) { return w[k] === n; }) && count(captain, n) < 2) return;
      var k = freeKey(captain, n);
      if (k) captain.equip[k] = n;
    });
    return captain.equip;
  }

  // ---- The ship's arms locker (Playtest Pins 0.9, 3-30) ---------------------
  // Back aboard his own ship, a captain who owns no melee weapon takes a
  // plain cutlass, and one with no ranged weapon a plain pistol: free, ship's
  // stock. DEFAULT: "owns none" rather than "the slot is empty", so a
  // captain who takes his sword off doesn't get a cutlass pressed on him.
  function armsLocker(state) {
    if (state.jail || state.shipless || !state.ship) return [];
    var cap = state.captain, out = [];
    function ownsKind(slot) { return (cap.items || []).some(function (n) { var d = def(n); return d && d.slot === slot; }); }
    [["melee", "Ship's Cutlass", "lockerCutlass"], ["ranged", "Ship's Pistol", "lockerPistol"]].forEach(function (x) {
      if (ownsKind(x[0])) return;
      gain(state, x[1]);
      out.push(D().lines[x[2]]);
      PC.state.addLog(state, D().lines[x[2]]);
    });
    return out;
  }

  // ---- The flagship's cabin (§32.6; PR 6) -----------------------------------
  // Display items hang in the cabin and work wherever the captain is, while
  // he has his flagship. They're out of the inventory while they hang; they
  // go down with her if she's sunk, struck or taken (a new ship object has
  // an empty cabin), and move with the displays on a flagship switch.
  function cabin(state) {
    if (!state.ship || state.shipless) return [];
    return state.ship.cabin || [];
  }
  function cabinSpots(state) {
    if (!state.ship) return 0;
    var S = D().CABIN_SPOTS;
    return S[state.ship.type] != null ? S[state.ship.type] : 1;
  }
  function hang(state, name) {
    var why = swapLock(state);
    if (why) throw new Error(why);
    if (!state.ship || state.shipless) throw new Error("You have no ship to hang it in.");
    var d = def(name);
    if (!d || d.slot !== "display") throw new Error("That isn't for display.");
    if (!owns(state.captain, name)) throw new Error("You don't have that.");
    state.ship.cabin = state.ship.cabin || [];
    if (state.ship.cabin.indexOf(name) >= 0) throw new Error("It already hangs there.");
    if (state.ship.cabin.length >= cabinSpots(state)) throw new Error("The cabin has no free spot.");
    lose(state, name);
    state.ship.cabin.push(name);
    after(state);
  }
  function takeDown(state, name) {
    var why = swapLock(state);
    if (why) throw new Error(why);
    var c = (state.ship && state.ship.cabin) || [], i = c.indexOf(name);
    if (i < 0) throw new Error("That isn't in the cabin.");
    c.splice(i, 1);
    state.captain.items.push(name);
  }
  // A flagship switch (0 AP) moves the displays, up to the new ship's spots;
  // the rest go to the inventory (§32.6, assumption).
  function moveCabin(state, oldShip) {
    var c = (oldShip && oldShip.cabin) || [];
    if (oldShip) oldShip.cabin = [];
    var n = cabinSpots(state);
    state.ship.cabin = c.slice(0, n);
    c.slice(n).forEach(function (x) { state.captain.items.push(x); });
    return c.slice(n);
  }
  // Losing the ship with her cabin (a mutiny's loss, the ship taken): its
  // displays are gone. A relic's find chance reopens by itself (§35.4).
  function loseCabin(state) {
    var c = (state.ship && state.ship.cabin) || [];
    if (state.ship) state.ship.cabin = [];
    if (c.length) PC.state.addLog(state, "Lost with the cabin: " + c.join(", ") + ".");
    return c;
  }
  // Held anywhere: carried, worn or in the cabin (a relic is one of each, §32.1).
  function held(state, name) { return owns(state.captain, name) || cabin(state).indexOf(name) >= 0 || ((state.ship && state.ship.cabin) || []).indexOf(name) >= 0 || (PC.holdings ? PC.holdings.displays(state).indexOf(name) >= 0 : false); }

  // ---- What the worn items do ------------------------------------------------

  function wornDef(state, key) { var n = worn(state)[key]; return n ? def(n) : null; }

  // Swordsmanship with a sword; Brawling with a brawling weapon or none (§32.3).
  function meleeType(state) {
    var d = wornDef(state, "melee");
    return d && d.weapon === "sword" ? "Swordsmanship" : "Brawling";
  }

  // The guns that fire the boarding shot: the ranged slot, then the braced
  // second pistol (§32.10). [{ name, bonus, def }]
  function guns(state) {
    var w = worn(state), out = [];
    ["ranged", "ranged2"].forEach(function (k) {
      var d = w[k] && def(w[k]);
      if (!d || d.gun == null) return;
      if (k === "ranged2" && !(owns(state.captain, "Pistol Brace") && d.pistol)) return;
      out.push({ name: w[k], bonus: d.gun, def: d, key: k });
    });
    // The second pistol fires only alongside a pistol in the first slot.
    if (out.length === 2 && !out[0].def.pistol) out.pop();
    return out;
  }

  // Extra enemies a clean Lead the Charge kills (§32.8, §32.9, §32.13).
  function extraKill(state) {
    var d = wornDef(state, "melee");
    if (!d) return 0;
    var n = d.extraKill || 0;
    if (d.bruteKill && hasTag(state.captain, "Brute")) n += d.bruteKill;
    return n;
  }

  // The morale floor from items: the best instrument, plus every other
  // floor (a pet, a book, a relic) (§32.4). The Ship's Fiddle is +10 with Fiddler.
  function moraleFloor(state) {
    var best = 0, rest = 0;
    active(state).forEach(function (n) {
      var d = def(n), m = PC.data.modifiers[n];
      if (!d || !m || !m.moraleFloor) return;
      var v = m.moraleFloor;
      if (d.fiddler && hasTag(state.captain, "Fiddler")) v = d.fiddler;
      if (d.instrument) best = Math.max(best, v); else rest += v;
    });
    return best + rest;
  }

  // Breath on a dive: the best diving gear counts (§32.12).
  function breath(state) {
    var best = 0;
    active(state).forEach(function (n) { var m = PC.data.modifiers[n]; if (m && m.breath) best = Math.max(best, m.breath); });
    return best;
  }

  // Provisions burn cuts (the Orange Cat, Catch of the Day), capped at 30% (§25.2).
  function burnCut(state) {
    var s = 0;
    active(state).forEach(function (n) { var m = PC.data.modifiers[n]; if (m && m.burnCut) s += m.burnCut; });
    return Math.min(s, D().BURN_CAP);
  }

  // ---- Consumables (§32.12) ------------------------------------------------

  function usable(state, name) {
    var cap = state.captain;
    if (!owns(cap, name)) return "You have none.";
    if (name === "Rejuvenating Elixir") {
      if ((cap.tags || []).indexOf("Wounded") < 0) return "Only when you're Wounded";
      if (state.minigame) return "Not in the middle of this";
      return null;
    }
    if (name === "Surgeon's Cordial") {
      if (state.crew && state.crew.cordial) return "One is already at work";
      if (!state.crew || !state.crew.wounded) return "No one is wounded";
      return null;
    }
    if (name === "Blackpowder Grenade") return "It offers itself at the start of a boarding";
    return "Not yet: " + ((def(name) || {}).inert || "nothing uses it");
  }

  function use(state, name) {
    var why = usable(state, name);
    if (why) throw new Error(why);
    lose(state, name);
    if (name === "Rejuvenating Elixir") {
      PC.scenes.applyEffect(state, { tag: "Wounded", remove: true });
      if (state.captain.tagsUntil) delete state.captain.tagsUntil.Wounded;
      PC.state.addLog(state, "Drank the Rejuvenating Elixir: no longer Wounded.");
      return D().lines.elixir;
    }
    if (name === "Surgeon's Cordial") {
      state.crew.cordial = true;
      PC.state.addLog(state, "Opened the Surgeon's Cordial for the wounded.");
      return D().lines.cordial;
    }
  }

  // ---- Hidden items on prizes (§32.16) -------------------------------------
  // Tiers 75% Uncommon / 22% Rare / 3% Very Rare; Rare only at Rich or
  // Superior loot (levels 3-4), Very Rare only at Superior. DEFAULT: a tier
  // the ship's pool lacks falls back a tier, and a pool with no Uncommon at
  // all (Sicily's art) draws its Uncommon from the Others' pool.
  function poolFor(ship) {
    var P = D().POOLS;
    if (ship.role === "War") return P.War;
    return P[ship.flag] || P.Other;
  }
  var TIERS = ["Uncommon", "Rare", "Very Rare"];
  function hiddenItem(ship, r, level) {
    var t = D().POOL_TIERS, x = r() * 100, tier = x < t["Very Rare"] ? 2 : x < t["Very Rare"] + t.Rare ? 1 : 0;
    if (level < 4) tier = Math.min(tier, 1);
    if (level < 3) tier = 0;
    var pool = poolFor(ship);
    for (var k = tier; k >= 0; k--) {
      var list = pool.filter(function (n) { return (def(n) || {}).tier === TIERS[k]; });
      if (!list.length && k === 0) list = D().POOLS.Other.filter(function (n) { return (def(n) || {}).tier === "Uncommon"; });
      if (list.length) return list[Math.floor(r() * list.length)];
    }
    return null;
  }
  // A bounty target's Uncommon (§17.4.8): from the pirates' pool.
  function bountyItem(r) {
    var list = D().POOLS.Pirate.filter(function (n) { return (def(n) || {}).tier === "Uncommon"; });
    return list[Math.floor(r() * list.length)];
  }

  // ---- The screen's view ---------------------------------------------------

  function view(state) {
    var cap = state.captain, w = worn(state), lock = swapLock(state);
    var slots = openKeys(cap).map(function (k) {
      var n = w[k] || null, d = n && def(n);
      return { key: k, slot: baseSlot(k), name: D().SLOT_NAMES[baseSlot(k)] + (/2$/.test(k) ? " II" : ""), item: n, tier: d ? d.tier : null, effect: d ? d.effect : null, inert: d ? d.inert || null : null,
        note: k === "melee" && !n ? "Bare fists: Brawling" : null };
    });
    // The inventory: everything not worn, consumables counted.
    var wornCount = {};
    Object.keys(w).forEach(function (k) { wornCount[w[k]] = (wornCount[w[k]] || 0) + 1; });
    var seen = {}, inv = [];
    (cap.items || []).forEach(function (n) {
      if (seen[n]) return;
      seen[n] = true;
      var left = count(cap, n) - (wornCount[n] || 0);
      if (left <= 0) return;
      var d = def(n);
      inv.push({ name: n, count: left, tier: d ? d.tier : null, effect: d ? d.effect : null, inert: d ? d.inert || null : null,
        slot: d ? d.slot : null, consumable: !!(d && d.consumable),
        works: !d || !!d.brace,
        hang: d && d.slot === "display" ? { why: !state.ship || state.shipless ? "No ship" : cabin(state).length >= cabinSpots(state) ? "The cabin's full" : null } : null,
        keys: d ? keysFor(cap, n).map(function (k) { return { key: k, name: D().SLOT_NAMES[baseSlot(k)] + (/2$/.test(k) ? " II" : ""), holds: w[k] || null }; }) : [],
        use: d && d.consumable ? { why: usable(state, n) } : null });
    });
    var cab = cabin(state).map(function (n) { var d = def(n) || {}; return { name: n, tier: d.tier, effect: d.effect, inert: d.inert || null }; });
    return { slots: slots, inventory: inv, lock: lock, melee: meleeType(state), guns: guns(state).map(function (g) { return g.name + " (gun +" + g.bonus + ")"; }),
      cabin: cab, cabinSpots: state.ship && !state.shipless ? cabinSpots(state) : 0, shipName: state.ship ? state.ship.name : null };
  }

  PC.items = {
    KEYS: KEYS, def: def, emptyEquip: emptyEquip, baseSlot: baseSlot, fits: fits,
    activeOf: activeOf, active: active, has: has, worn: worn, wornOf: wornOf, owns: function (state, n) { return owns(state.captain, n); },
    count: function (state, n) { return count(state.captain, n); },
    swapLock: swapLock, equip: equip, unequip: unequip, freeKey: freeKey,
    gain: gain, lose: lose, chip: chip, autoEquip: autoEquip, armsLocker: armsLocker,
    meleeType: meleeType, guns: guns, extraKill: extraKill, moraleFloor: moraleFloor, breath: breath, burnCut: burnCut,
    usable: usable, use: use, hiddenItem: hiddenItem, bountyItem: bountyItem, view: view,
    cabin: cabin, cabinSpots: cabinSpots, hang: hang, takeDown: takeDown, moveCabin: moveCabin, loseCabin: loseCabin, held: held,
  };
})();
