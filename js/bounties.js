/* Pirate Chronicle — Admiralty Bounties and French stragglers (§17.4.8,
 * §17.4.4, §22.5; Milestone 9, PR 3).
 *
 * The notice board posts 1-2 generated notices a season (at most 3 open),
 * once A Wanted Man is done. A taken notice spawns its target on hunts in
 * his waters (10% a batch; the bounty's rumor guarantees him in the next
 * batch). Beaten, he can be brought in, let go or killed; Lieutenant Howe
 * pays on the captain's report, with the claims and the lie (Bluff &
 * Disguise). French stragglers are 20% of generated pirate ships: their
 * captains can be held as prisoners and delivered to Howe for 300.
 *
 * state.bounties = { notices: [...], seen, collected, regardGiven, refreshed }
 * state.prisoners = [{ id, kind: "bounty"|"straggler", name, gender, bounty }]
 * Nothing here touches the screen.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function D() { return PC.data.bounties; }
  function L() { return PC.data.bounties.lines; }
  function H() { return PC.data.hunt; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function stamp(state) { return PC.state.stamp(state); }
  function seasonIndex(state) { return state.time.year * 4 + state.time.season; }
  function rnd(state, what) { return PC.rng.fromKey([state.world.seed, stamp(state), "bounty", what].join("|")); }

  function B(state) {
    return (state.bounties = state.bounties || { notices: [], seen: 0, collected: 0, regardGiven: false, refreshed: null, seq: 0 });
  }
  function prisoners(state) { return (state.prisoners = state.prisoners || []); }

  // The board is open from Key's introduction; generated notices post once
  // A Wanted Man is done (§17.4.8). Not for a Sworn enemy of Key's.
  function boardOpen(state) { return !!state.flags.admiralty_board_open && PC.letters.band(state, "key") !== "Sworn enemy"; }
  function posting(state) { return boardOpen(state) && (!!state.flags.a_wanted_man_done || !!state.flags.bounties_open); }

  // ---- Text --------------------------------------------------------------------------

  function noticeOf(state, id) { return B(state).notices.filter(function (n) { return n.id === id; })[0] || null; }
  function render(state, text, n, extra) {
    extra = extra || {};
    var f = n ? n.gender === "f" : false;
    var forms = { he: f ? "she" : "he", him: f ? "her" : "him", his: f ? "her" : "his", himself: f ? "herself" : "himself" };
    var t = String(text).replace(/\{target\.([A-Za-z]+)\}/g, function (w, form) {
      var lower = form.toLowerCase(), o = forms[lower];
      if (!o) return w;
      return form !== lower ? o.charAt(0).toUpperCase() + o.slice(1) : o;
    });
    if (n) {
      t = t.replace(/\[NPC\]/g, n.name).replace(/\[Ship type\]/g, (n.cls || "").toLowerCase()).replace(/\[Ship\]/g, n.ship || "")
        .replace(/\[Node\]/g, n.port ? PC.world.placeName(n.port) : "").replace(/\[Waters\]/g, n.waters ? H().WATERS[n.waters].name : "");
    }
    Object.keys(extra).forEach(function (k) { t = t.split("[" + k + "]").join(extra[k]); });
    return PC.text.render(t, state);
  }

  // ---- The board's seasons -------------------------------------------------------------

  function openCount(state) { return B(state).notices.filter(function (n) { return n.status === "open" || n.status === "taken"; }).length; }

  // Catch the board up to this season: untaken notices come down after 2
  // seasons; a taken one may be stamped Deceased (15% a season); then 1-2
  // new notices, up to 3 open. Runs once a season, whenever the board or
  // the hunt looks at it.
  function refresh(state) {
    if (!posting(state)) return [];
    var b = B(state), now = seasonIndex(state), news = [];
    if (b.refreshed === now) return news;
    var first = b.refreshed == null;
    b.refreshed = now;
    var r = rnd(state, "season");
    b.notices.forEach(function (n) {
      if (n.status === "open" && now - n.posted >= D().UNTAKEN_SEASONS) { n.status = "expired"; n.note = render(state, L().expired, n); }
      else if (n.status === "taken" && !first && n.taken < now && r() < D().DECEASED) { n.status = "deceased"; n.note = render(state, L().deceased, n); }
    });
    var add = D().POST[0] + Math.floor(r() * (D().POST[1] - D().POST[0] + 1));
    for (var i = 0; i < add && openCount(state) < D().OPEN_MAX; i++) { var n = post(state, r); news.push(n); }
    return news;
  }

  function post(state, r) {
    var b = B(state);
    b.seq += 1;
    var cls = PC.npcs.weighted(r, D().SHIPS);
    var rec = PC.npcs.generate(state, { id: null, role: "Pirate Captain", pool: "master", node: null, key: [state.world.seed, "bounty-captain", b.seq].join("|"), persistent: false });
    var names = (PC.data.names.SHIPS || {}).pirate || ["Sea Wolf"];
    var R = D().REWARD[cls];
    var n = {
      id: "b" + b.seq, name: rec.full || (rec.first + " " + (rec.last || "")).trim(), first: rec.first, gender: rec.gender || "m",
      cls: cls, ship: names[Math.floor(r() * names.length)], waters: PC.npcs.weighted(r, D().WATERS),
      port: D().PORTS[Math.floor(r() * D().PORTS.length)], rating: D().RATING[0] + Math.floor(r() * (D().RATING[1] - D().RATING[0] + 1)),
      item: r() < D().ITEM, alive: R[0], dead: R[1], posted: seasonIndex(state), status: "open", rumor: false, rumorFresh: false,
      outcome: null, trophy: null,
    };
    b.notices.push(n);
    return n;
  }

  // What the board shows: the notices still up (and the latest stamped
  // ones, this season), newest first.
  function board(state) {
    var news = refresh(state), b = B(state), now = seasonIndex(state);
    var fresh = b.notices.some(function (n) { return n.posted > b.seen; });
    var cards = b.notices.filter(function (n) {
      return n.status === "open" || n.status === "taken" || n.status === "captured" || ((n.status === "deceased" || n.status === "expired") && n.closedSeen == null);
    });
    return { cards: cards.slice().reverse(), fresh: fresh && b.seen > 0, empty: !cards.length, news: news };
  }
  // The captain has looked at the board.
  function seen(state) {
    var b = B(state), now = seasonIndex(state);
    b.seen = now;
    b.notices.forEach(function (n) { if ((n.status === "deceased" || n.status === "expired") && n.closedSeen == null) n.closedSeen = now; });
  }

  function take(state, id) {
    var n = noticeOf(state, id);
    if (!n || n.status !== "open") throw new Error("That notice isn't open.");
    if (!boardOpen(state)) throw new Error("The board isn't open to you.");
    n.status = "taken"; n.taken = seasonIndex(state);
    PC.state.addLog(state, "Took the Admiralty's bounty on " + n.name + ".");
    return render(state, L().taken, n);
  }

  function taken(state) { return B(state).notices.filter(function (n) { return n.status === "taken"; }); }

  // ---- The bounty's rumor (§17.4.8, §30) --------------------------------------------
  // A taken notice without its rumor yet. Heard, it guarantees him in the
  // next batch in his waters.
  function rumorTargets(state) { return taken(state).filter(function (n) { return !n.rumorFresh; }); }
  function heardRumor(state, id) {
    var n = noticeOf(state, id);
    if (n) { n.rumor = true; n.rumorFresh = true; }
  }

  // ---- At sea: the spawn (§22.5) ------------------------------------------------------

  // At a new hunt batch: is a taken target in these waters this batch?
  // The rumor guarantees him; otherwise 10%.
  function batchTarget(state, waters, r) {
    refresh(state);
    var list = taken(state).filter(function (n) { return n.waters === waters; });
    var fresh = list.filter(function (n) { return n.rumorFresh; })[0];
    if (fresh) return fresh;
    for (var i = 0; i < list.length; i++) if (r() < D().SPAWN) return list[i];
    return null;
  }

  // His ship and crew, as the notice says: full guns and crew, Poor loot,
  // rating 2-3, Resolve 3, the strike-colors roll at the outset at -1.
  function targetShip(state, n, r) {
    var s = PC.huntGen.makeShip(state, { cls: n.cls, role: "Raider", flag: "Pirate", full: true, rating: n.rating, resolve: D().RESOLVE }, r);
    s.name = n.ship; s.captain = n.name; s.title = "Captain"; s.captainNick = false;
    s.bounty = n.id; s.lootLevel = 0; s.strikePre = D().STRIKE_PRE;
    s.cue = render(state, L().cueBounty, n);
    n.rumorFresh = false; // the rumor's guarantee is spent once he's met
    return { ships: [s], shape: "single", hunter: false, bounty: n.id };
  }

  // A French straggler (§17.4.4): 20% of generated pirate ships. Its own
  // seeded draw by the ship's id, so other rolls don't shift.
  function maybeFrench(state, s) {
    if (!s || s.flag !== "Pirate" || s.hunter || s.bounty) return s;
    var r = PC.rng.fromKey([state.world.seed, "straggler", s.id].join("|"));
    if (r() >= D().STRAGGLER) return s;
    s.french = true;
    try {
      var rec = PC.npcs.generate(state, { id: null, role: "Ship Captain", pool: "french", node: null, key: [state.world.seed, "straggler-captain", s.id].join("|"), persistent: false });
      s.captain = rec.full || (rec.first + " " + (rec.last || "")).trim(); s.captainNick = false; s.title = "Captain"; s.captainGender = rec.gender || "m";
    } catch (e) { /* keep the generated pirate's name */ }
    s.cue = L().cueFrench;
    return s;
  }

  // She's sunk: a bounty target dies with her (§17.4.8).
  function sunk(state, id) {
    var n = noticeOf(state, id);
    if (n && n.status === "taken") { n.status = "captured"; n.outcome = "sunk"; PC.state.addLog(state, n.name + " went down with the " + n.ship + "."); }
  }

  // ---- The capture choice (Part 4 §10) ----------------------------------------------
  // On the prize screen. A bounty: bring / release / kill (with "head" or
  // "hand"). A straggler: prisoner / release / kill.
  function captainOptions(state, e) {
    if (e.bounty) {
      var n = noticeOf(state, e.bounty);
      if (!n) return null;
      return { kind: "bounty", name: n.name, setup: render(state, L().captureSetup, n), options: [
        { id: "bring", label: L().bring, note: "Held aboard for Lieutenant Howe: " + reward(state, n, "alive") + " gold." },
        { id: "release", label: L().release, note: "Pirate Standing +" + D().RELEASE_STANDING + ". Howe will want an answer." },
        { id: "kill", label: "Kill " + (n.gender === "f" ? "her" : "him") + ".", note: "The dead rate (" + reward(state, n, "dead") + "). Dread +" + D().KILL_DREAD + "." },
        { id: "killHead", label: "Kill " + (n.gender === "f" ? "her" : "him") + ", and take the head.", note: "Dread +" + (D().KILL_DREAD + D().TROPHY_DREAD.head) + ". Proof for Howe." },
        { id: "killHand", label: "Kill " + (n.gender === "f" ? "her" : "him") + ", and take a hand.", note: "Dread +" + (D().KILL_DREAD + D().TROPHY_DREAD.hand) + ". Proof for Howe." },
      ] };
    }
    if (e.french) {
      return { kind: "straggler", name: e.captain, setup: L().stragglerCaptured, options: [
        { id: "prisoner", label: "Take him prisoner.", note: "Lieutenant Howe pays " + D().STRAGGLER_REWARD + " for him at Norfolk." },
        { id: "release", label: "Let him go.", note: null },
        { id: "kill", label: "Kill him.", note: "Dread +" + D().STRAGGLER_KILL_DREAD + "." },
      ] };
    }
    return null;
  }

  // Settle the captain's fate. Returns chips for the after-battle summary.
  function settleCaptain(state, e, choice) {
    var chips = [], o = captainOptions(state, e);
    if (!o) return chips;
    if (o.kind === "bounty") {
      var n = noticeOf(state, e.bounty);
      choice = choice || "bring";
      n.status = "captured";
      if (choice === "bring") {
        n.outcome = "alive";
        prisoners(state).push({ id: "p" + n.id, kind: "bounty", name: n.name, gender: n.gender, bounty: n.id });
        chips.push({ icon: "person", text: n.name + " in irons, for Lieutenant Howe", ink: "good" });
      } else if (choice === "release") {
        n.outcome = "spared";
        PC.meters.addStanding(state, "pirates", D().RELEASE_STANDING);
        chips.push({ icon: "standing", text: "Pirate Standing +" + D().RELEASE_STANDING + " (you let " + n.name + " go)", ink: "pirates" });
      } else {
        n.outcome = "dead";
        var trophy = choice === "killHead" ? "head" : choice === "killHand" ? "hand" : null;
        n.trophy = trophy;
        var dd = PC.meters.addDread(state, D().KILL_DREAD + (trophy ? D().TROPHY_DREAD[trophy] : 0));
        chips.push({ icon: "dread", text: "Dread +" + dd + " (" + render(state, L().kill, n).replace(/\.$/, "") + ")", ink: "bad" });
        if (trophy) chips.push({ icon: "item", text: "His " + trophy + ", wrapped in sailcloth", ink: "oxblood" });
      }
      PC.state.addLog(state, "The bounty on " + n.name + ": " + n.outcome + ".");
      return chips;
    }
    // A French straggler.
    choice = choice || "release";
    if (choice === "prisoner") {
      prisoners(state).push({ id: "p" + e.id, kind: "straggler", name: e.captain || "a French captain", gender: e.captainGender || "m" });
      chips.push({ icon: "person", text: (e.captain || "Her French captain") + " held prisoner, for Lieutenant Howe", ink: "good" });
    } else if (choice === "kill") {
      var d2 = PC.meters.addDread(state, D().STRAGGLER_KILL_DREAD);
      chips.push({ icon: "dread", text: "Dread +" + d2 + " (her French captain killed)", ink: "bad" });
    }
    return chips;
  }

  // ---- Prisoners in the Ship menu -------------------------------------------------------
  function releasePrisoner(state, id, kill) {
    var list = prisoners(state), p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) throw new Error("No such prisoner.");
    state.prisoners = list.filter(function (x) { return x !== p; });
    var out = { lines: [], chips: [] };
    var fake = { name: p.name, gender: p.gender };
    if (p.kind === "wanted" && PC.wanted) PC.wanted.prisonerFate(state, p, kill); // A Wanted Man's quest prisoner
    if (kill) {
      var dd = PC.meters.addDread(state, p.kind === "straggler" ? D().STRAGGLER_KILL_DREAD : D().KILL_DREAD);
      out.lines.push(render(state, L().prisonerKilled, fake));
      out.chips.push({ icon: "dread", text: "Dread +" + dd, ink: "bad" });
      if (p.bounty) { var n = noticeOf(state, p.bounty); if (n) n.outcome = "dead"; }
    } else {
      out.lines.push(render(state, L().prisonerReleased, fake));
      if (p.bounty) { var n2 = noticeOf(state, p.bounty); if (n2) n2.outcome = "spared"; }
    }
    PC.state.addLog(state, (kill ? "Killed " : "Released ") + "the prisoner " + p.name + ".");
    return out;
  }

  // ---- Report a bounty (Howe, §17.4.3) --------------------------------------------------

  function reward(state, n, rate) {
    var base = rate === "alive" ? n.alive : n.dead;
    var band = PC.letters.band(state, "key");
    return Math.round(base * (band === "Respected" || band === "Trusted" ? D().RESPECTED : 1));
  }

  // What the captain can report: each captured bounty (with the claims he
  // can make) and each straggler prisoner aboard.
  function reportable(state) {
    if (!boardOpen(state)) return [];
    var out = [];
    B(state).notices.forEach(function (n) {
      if (n.status !== "captured") return;
      var alive = n.outcome === "alive" && prisoners(state).some(function (p) { return p.bounty === n.id; });
      if (alive) { out.push({ id: n.id, kind: "bounty", name: n.name, alive: true, claims: [{ id: "alive", label: "Hand over " + n.name + "." }] }); return; }
      if (n.outcome === "alive") n.outcome = "spared"; // brought aboard, but not aboard now
      var claims = [{ id: "dead", label: "He's dead." }, { id: "sunk", label: "He went down with his ship." }];
      if (n.trophy) claims.push({ id: "trophy", label: "Throw the " + n.trophy + " onto the desk." });
      claims.forEach(function (c) { c.label = render(state, c.label.replace(/\bHe\b/, "{target.He}"), n); c.lie = isLie(n, c.id); });
      out.push({ id: n.id, kind: "bounty", name: n.name, alive: false, claims: claims });
    });
    prisoners(state).filter(function (p) { return p.kind === "straggler"; }).forEach(function (p) {
      out.push({ id: p.id, kind: "straggler", name: p.name, alive: true, claims: [{ id: "deliver", label: "Hand over the French captain." }] });
    });
    return out;
  }
  // The claims pattern (Part 1 §3): the engine knows what happened.
  function isLie(n, claim) {
    if (claim === "trophy") return false;
    if (n.outcome === "spared") return true;
    if (claim === "dead") return n.outcome !== "dead";
    if (claim === "sunk") return n.outcome !== "sunk";
    return false;
  }
  function lieCheck(state) { return { type: "Bluff & Disguise", dr: 2 }; } // DR 2: DEFAULT (none set)

  // Report one. Returns { lines, chips, outcome? }.
  function report(state, id, claim) {
    var out = { lines: [], chips: [] };
    var p = prisoners(state).filter(function (x) { return x.id === id && x.kind === "straggler"; })[0];
    if (p) {
      state.prisoners = prisoners(state).filter(function (x) { return x !== p; });
      state.money.purse += D().STRAGGLER_REWARD;
      out.lines.push(L().stragglerDelivered, L().stragglerParting);
      out.chips.push({ icon: "gold", text: "+" + D().STRAGGLER_REWARD + " to your purse", ink: "good" });
      PC.state.addLog(state, "Delivered the French captain " + p.name + " to Lieutenant Howe for " + D().STRAGGLER_REWARD + ".");
      return out;
    }
    var n = noticeOf(state, id);
    if (!n || n.status !== "captured") throw new Error("Nothing to report on that one.");
    var rate = "dead";
    if (claim === "alive") {
      var pr = prisoners(state).filter(function (x) { return x.bounty === n.id; })[0];
      if (!pr) throw new Error(n.name + " isn't aboard.");
      state.prisoners = prisoners(state).filter(function (x) { return x !== pr; });
      rate = "alive";
      out.lines.push(render(state, L().turninAlive, n));
    } else if (claim === "trophy" && n.trophy) {
      out.lines.push(render(state, L().trophyHowe, n, { trophy: n.trophy }));
    } else if (isLie(n, claim)) {
      var r = PC.checks.resolve(state, lieCheck(state), [state.world.seed, stamp(state), "bounty-lie", n.id].join("|"), { conditions: ["Official"] });
      out.outcome = r.outcome; out.roll = r;
      if (r.outcome === "clean") out.lines.push(L().lieClean);
      else if (r.outcome === "partial") { out.lines.push(L().liePartial); state.flags.key_suspects = true; }
      else {
        out.lines.push(L().lieCaught);
        state.flags.key_suspects = true;
        PC.letters.addRegard(state, "key", D().LIE_CAUGHT_REGARD);
        out.chips.push({ icon: "standing", text: "Admiral Key's regard " + D().LIE_CAUGHT_REGARD, ink: "bad" });
      }
    } else {
      out.lines.push(render(state, L().turninDead, n));
    }
    var gold = reward(state, n, rate);
    state.money.purse += gold;
    out.chips.push({ icon: "gold", text: "+" + gold + " to your purse (" + rate + ")", ink: "good" });
    // On collection (§17.4.8): Avalon Standing +3; +1 Admiralty segment at
    // the notice's port (recorded, D3); Key's regard +1 once, at 5.
    var st = PC.meters.addStanding(state, "avalon", D().STANDING);
    if (st) out.chips.push({ icon: "standing", text: "Avalon Standing +" + st, ink: "avalon" });
    var seg = (state.world.segments = state.world.segments || {});
    seg[n.port] = seg[n.port] || { admiralty: 0, governor: 0, merchants: 0 };
    seg[n.port].admiralty += 1;
    n.status = "collected";
    var b = B(state);
    b.collected += 1;
    if (b.collected >= D().REGARD_AT && !b.regardGiven) {
      b.regardGiven = true;
      PC.letters.addRegard(state, "key", 1);
      out.lines.push(L().fifth);
      out.chips.push({ icon: "standing", text: "Admiral Key's regard +1", ink: "good" });
    }
    PC.state.addLog(state, "Collected the bounty on " + n.name + ": " + gold + " gold.");
    return out;
  }

  // ---- The journal ----------------------------------------------------------------------
  function journal(state) {
    var out = [];
    B(state).notices.forEach(function (n) {
      if (n.status === "taken") out.push({ id: "bounty_" + n.id, title: "Admiralty bounty: " + n.name, line: render(state, L().jTaken, n), status: "open" });
      else if (n.status === "captured") out.push({ id: "bounty_" + n.id, title: "Admiralty bounty: " + n.name, line: render(state, n.outcome === "alive" ? L().jCaptured : L().jReport, n), status: "open" });
      else if (n.status === "collected") out.push({ id: "bounty_" + n.id, title: "Admiralty bounty: " + n.name, line: "Collected.", status: "done" });
    });
    prisoners(state).filter(function (p) { return p.kind === "straggler"; }).forEach(function (p) {
      out.push({ id: "straggler_" + p.id, title: "A French prisoner: " + p.name, line: L().jStraggler, status: "open" });
    });
    return out;
  }

  // ---- Developer -------------------------------------------------------------------------
  function devOpen(state) {
    state.flags.admiralty_board_open = true; state.flags.bounties_open = true;
    B(state).refreshed = null;
    return refresh(state);
  }

  PC.bounties = {
    boardOpen: boardOpen, posting: posting, refresh: refresh, board: board, seen: seen, take: take, taken: taken, notice: noticeOf, render: render,
    rumorTargets: rumorTargets, heardRumor: heardRumor, batchTarget: batchTarget, targetShip: targetShip, maybeFrench: maybeFrench, sunk: sunk,
    captainOptions: captainOptions, settleCaptain: settleCaptain, prisoners: prisoners, releasePrisoner: releasePrisoner,
    reward: reward, reportable: reportable, report: report, isLie: isLie, lieCheck: lieCheck, journal: journal, devOpen: devOpen,
  };
})();
