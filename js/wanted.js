/* Pirate Chronicle — A Wanted Man at sea (Keychain #1; Norfolk Scene
 * Records §3; Milestone 9, PR 4).
 *
 * Freddy Fearless and the *Deadly Delight*: 50% a batch in the Hatteras
 * Banks while the quest is open (his rumor guarantees him in the next
 * batch); he never runs, skips the strike-colors roll at the outset,
 * carries Resolve 4 and forces a duel in the first clash. Beaten, he
 * yields: bring him in, let him go, or kill him (with the trophy). The
 * turn-in is a scene (content/wanted_man.js) when the captain next enters
 * the Admiralty House. D2: Freddy only; Gauthier's record is data.
 *
 * Quest state lives in flags (the record's names): a_wanted_man_assigned,
 * wanted_alive / wanted_dead / wanted_spared / wanted_sunk, trophy_head /
 * trophy_hand, freddy_at_ocracoke, a_wanted_man_done. state.wanted keeps
 * the rumor's guarantee. Nothing here touches the screen.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function W() { return PC.data.wantedMan; }
  function f(state) { return state.flags; }
  function rec(state) { return (state.wanted = state.wanted || { rumor: false, rumorFresh: false, met: 0 }); }
  function targetId(state) { return "freddy"; } // D2: Freddy only (Gauthier after the Battle of Ocracoke, M10)
  function target(state) { return W().targets[targetId(state)]; }

  // Still at large: assigned, and not yet taken, killed, spared or sunk.
  function atLarge(state) {
    var F = f(state);
    return !!F.a_wanted_man_assigned && !F.a_wanted_man_done && !F.wanted_alive && !F.wanted_dead && !F.wanted_spared && !F.wanted_sunk;
  }

  // ---- The rumor (§3 stage 1) -----------------------------------------------------
  function rumorOpen(state) { return atLarge(state) && !rec(state).rumorFresh; }
  function heardRumor(state) { var r = rec(state); r.rumor = true; r.rumorFresh = true; }

  // ---- The spawn ---------------------------------------------------------------------
  // Every batch in the Hatteras Banks while he's at large: 50%, or certain
  // after his rumor.
  function batchTarget(state, waters, r) {
    if (!atLarge(state) || waters !== W().WATERS) return false;
    if (rec(state).rumorFresh) return true;
    return r() < W().SPAWN;
  }

  function ship(state, r) {
    var t = target(state);
    var s = PC.huntGen.makeShip(state, { cls: t.cls, role: "Raider", flag: "Pirate", full: true, rating: t.rating, gunnery: t.gunnery, resolve: t.resolve }, r);
    s.name = t.ship; s.captain = t.name; s.title = null; s.captainNick = true;
    s.wanted = targetId(state); s.named = targetId(state); s.lootLevel = 0;
    s.noStrikePre = true; s.forceDuel = true; s.neverRuns = !!t.neverRuns; s.triesToRun = !!t.triesToRun;
    s.cue = t.cue;
    var w = rec(state); w.rumorFresh = false; w.met += 1;
    return { ships: [s], shape: "single", hunter: false, wanted: true };
  }

  function bark(state, e, slot) {
    var t = e && e.named && W().targets[e.named];
    return t && t.barks[slot] || null;
  }

  // He went down with his ship.
  function sunk(state, e) {
    if (!e || !e.wanted || !atLarge(state)) return;
    f(state).wanted_sunk = true;
    PC.state.addLog(state, target(state).name + " went down with the " + target(state).ship + ".");
  }

  // ---- The surrender scene (§3 stage 3), on the prize screen --------------------------
  function captainOptions(state, e) {
    if (!e || !e.wanted) return null;
    var t = W().targets[e.wanted], D = W();
    return { kind: "wanted", name: t.name, setup: t.irons, options: [
      { id: "bring", label: "Bring him in alive.", note: "He's a prisoner until Norfolk: " + D.ALIVE + " gold." },
      { id: "release", label: "Let him go.", note: "Pirate Standing +" + D.RELEASE_STANDING + ". The Admiral will want an answer." },
      { id: "kill", label: "Kill him.", note: "Dread +" + D.KILL_DREAD + (e.wanted === "freddy" ? ", Pirate Standing " + D.KILL_STANDING : "") + ". Dump the body over the side." },
      { id: "killHead", label: "Kill him, and take his head.", note: "Dread +" + (D.KILL_DREAD + D.TROPHY_DREAD.head) + ". Proof for the Admiral." },
      { id: "killHand", label: "Kill him, and take his hand.", note: "Dread +" + (D.KILL_DREAD + D.TROPHY_DREAD.hand) + ". Proof for the Admiral." },
    ] };
  }

  function settleCaptain(state, e, choice) {
    var chips = [], t = W().targets[e.wanted], D = W(), F = f(state);
    choice = choice || "bring";
    if (choice === "bring") {
      F.wanted_alive = true;
      PC.bounties.prisoners(state).push({ id: "p_" + e.wanted, kind: "wanted", name: t.name, gender: "m", wanted: e.wanted });
      chips.push({ icon: "person", text: t.outcomes.bring });
    } else if (choice === "release") {
      F.wanted_spared = true;
      if (e.wanted === "freddy") F.freddy_at_ocracoke = true; // read by the Battle of Ocracoke (M10)
      PC.meters.addStanding(state, "pirates", D.RELEASE_STANDING);
      chips.push({ icon: "person", text: t.outcomes.release });
      chips.push({ icon: "standing", text: "Pirate Standing +" + D.RELEASE_STANDING, ink: "pirates" });
    } else {
      F.wanted_dead = true;
      var trophy = choice === "killHead" ? "head" : choice === "killHand" ? "hand" : null;
      if (trophy) F["trophy_" + trophy] = true;
      var dd = PC.meters.addDread(state, D.KILL_DREAD + (trophy ? D.TROPHY_DREAD[trophy] : 0));
      if (e.wanted === "freddy") PC.meters.addStanding(state, "pirates", D.KILL_STANDING);
      chips.push({ icon: "person", text: t.outcomes.kill });
      chips.push({ icon: "person", text: t.outcomes[trophy || "nothing"] });
      chips.push({ icon: "dread", text: "Dread +" + dd, ink: "bad" });
      if (e.wanted === "freddy") chips.push({ icon: "standing", text: "Pirate Standing " + D.KILL_STANDING + " (one of Jack's men executed)", ink: "pirates" });
    }
    // His item, on every path where his ship is taken (§3).
    if (t.item) { state.captain.items.push(t.item); chips.push({ icon: "item", text: "Found aboard: " + t.item, ink: "oxblood" }); }
    PC.state.addLog(state, "A Wanted Man: " + t.name + " " + ({ bring: "taken alive", release: "let go" }[choice] || "killed") + ".");
    return chips;
  }

  // The prisoner, from the Crew tab: let go, or killed.
  function prisonerFate(state, p, kill) {
    var F = f(state);
    F.wanted_alive = false;
    if (kill) F.wanted_dead = true;
    else { F.wanted_spared = true; if (p.wanted === "freddy") F.freddy_at_ocracoke = true; }
  }

  // ---- The journal ----------------------------------------------------------------
  function journalLine(state) {
    var J = W().journal, F = f(state);
    if (F.turnin_unfinished) return J.unfinished;
    if (F.a_wanted_man_done) return F.ocracoke_invited ? J.invited : F.ocracoke_declined ? J.declined : null;
    if (F.wanted_spared) return J.spared;
    if (F.wanted_alive || F.wanted_dead || F.wanted_sunk) return J.taken;
    return rec(state).rumorFresh ? J.rumor : J.assigned;
  }

  // ---- Scene tests and hooks --------------------------------------------------------
  var SF = PC.sceneFns;
  if (SF) {
    SF.addCond("wmTurninReady", function (state) {
      var F = f(state);
      if (!F.a_wanted_man_assigned || F.a_wanted_man_done) return false;
      if (F.wanted_alive) return PC.bounties.prisoners(state).some(function (p) { return p.kind === "wanted"; });
      return !!(F.wanted_dead || F.wanted_sunk || F.wanted_spared);
    });
    SF.addCond("keyTrusted", function (state) {
      return PC.letters.band(state, "key") === "Trusted" && (state.captain.items || []).indexOf("Key's Spyglass") < 0;
    });
    SF.addHook("wm_hand_over", {
      apply: function (state) { state.prisoners = PC.bounties.prisoners(state).filter(function (p) { return p.kind !== "wanted"; }); return null; },
      chip: function () { return { icon: "person", text: "Freddy Fearless handed over" }; },
    });
  }

  PC.wanted = {
    atLarge: atLarge, rumorOpen: rumorOpen, heardRumor: heardRumor, batchTarget: batchTarget, ship: ship, bark: bark, sunk: sunk,
    captainOptions: captainOptions, settleCaptain: settleCaptain, prisonerFate: prisonerFate, journalLine: journalLine, target: target,
  };
})();
