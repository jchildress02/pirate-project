/* Pirate Chronicle — the Admiralty House at Norfolk (§17.4.3, §17.4.10, §28.7;
 * Milestone 8, PR 5).
 *
 * Lieutenant Howe's menu: an audience with Key (through Howe until Key's
 * regard reaches Respected; at Respected or better Key always sees the
 * captain), Key's letter (Howe's standing offer after the introduction),
 * Key's pardon, Howe's information steps, and the notice board. A Sworn
 * enemy of Key's is refused everything. The lines are the author's
 * (Norfolk Scene Records Part 4 §9-§10), in content/norfolk.js.
 *
 * Key's pardon (§28.7, §17.4.10): 60 gold a point of Avalon Heat, ×1.5 at
 * Wary and ×2 at Hostile, ×0.75 at Key's Respected, ×0.5 at Trusted, ×1.5
 * at Distrusted; paid from the purse. Avalon Heat to 0, Avalon +10, pirate
 * Standing -10, and the Pardoned tag. A new offense against Avalon while
 * Pardoned breaks it: a betrayal (§28.6), Key's regard -3 and a year of
 * Key's hunt (js/meters.js).
 *
 * No screen code here.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function L() { return PC.data.nodes.norfolk.lines.admiralty; }
  function R() { return PC.data.admiraltyRules; }
  function keyBand(state) { return PC.letters.band(state, "key"); }

  function refused(state) { return keyBand(state) === "Sworn enemy"; }

  // Howe's greeting by his rung (Part 4 §9).
  function greeting(state) {
    if (refused(state)) return L().refuse;
    var r = PC.npcs.rung(state, "howe");
    return r <= -1 ? L().greet.wary : r >= 3 ? L().greet.confidant : r >= 1 ? L().greet.friend : L().greet.neutral;
  }

  // ---- The audience ---------------------------------------------------------------
  // Below Respected: "occupied" (two lines, by season so it doesn't repeat).
  // At Respected or better: a walk-in; with nothing to raise in this build,
  // Key's greeting and "nothing for you at the moment".
  function audience(state) {
    var b = keyBand(state);
    if (b === "Respected" || b === "Trusted") {
      return { walkIn: true, lines: [L().key.busy, b === "Trusted" ? L().key.greetTrusted : L().key.greetRespected, L().key.nothing] };
    }
    var odd = (state.time.year * 4 + state.time.season) % 2;
    return { walkIn: false, lines: [odd ? L().occupied2 : L().occupied1] };
  }

  // ---- Key's letter: Howe's standing offer (§17.4.10) ---------------------------
  function letterOffer(state) {
    if (!state.flags.key_met || refused(state)) return null;
    var l = PC.letters.letter(state);
    if (l && l.issuer === "key") return null;
    var c = PC.letters.canTake(state, "key");
    var b = keyBand(state);
    if (b === "Distrusted") return { ok: false, why: "The Admiral won't issue you a letter at present", line: L().letterRefused };
    return { ok: c.ok, why: c.ok ? null : c.why, line: L().letterOffer };
  }
  function takeLetter(state) {
    var o = letterOffer(state);
    if (!o || !o.ok) throw new Error(o ? o.why : "No letter on offer.");
    var r = PC.letters.take(state, "key");
    state.flags.key_letter_accepted = true; state.flags.key_letter_pending = false;
    return { line: L().letterAccepted, lines: r.lines };
  }

  // ---- Key's pardon (§28.7) --------------------------------------------------------
  function pardonPrice(state) {
    var heat = state.meters.heat.avalon || 0;
    var sb = PC.node.standingBand(state, "avalon").name;
    var sm = sb === "Wary" ? 1.5 : sb === "Hostile" ? 2 : sb === "Enemy" ? null : 1;
    if (sm == null) return null;
    var kb = keyBand(state);
    var km = kb === "Respected" ? 0.75 : kb === "Trusted" ? 0.5 : kb === "Distrusted" ? 1.5 : 1;
    return Math.round(heat * R().PARDON_PER_HEAT * sm * km);
  }
  function canPardon(state) {
    if (refused(state)) return { ok: false, why: "Key has sworn against you", line: L().pardonRefused };
    if (!(state.meters.heat.avalon > 0)) return { ok: false, why: "Avalon doesn't want you for anything" };
    var p = pardonPrice(state);
    if (p == null) return { ok: false, why: "No pardon for sale at Enemy Standing" };
    if (state.money.purse < p) return { ok: false, why: "Needs " + p + " gold in your purse", price: p, line: L().pardonBroke };
    return { ok: true, price: p };
  }
  function pardon(state) {
    var c = canPardon(state);
    if (!c.ok) throw new Error(c.why);
    state.money.purse -= c.price;
    var heat = state.meters.heat.avalon;
    state.meters.heat.avalon = 0;
    PC.meters.addStanding(state, "avalon", R().PARDON_STANDING);
    PC.meters.addStanding(state, "pirates", -R().PARDON_BLACK);
    if ((state.captain.tags || []).indexOf("Pardoned") < 0) state.captain.tags.push("Pardoned");
    state.pardon = { issuer: "key", faction: "avalon", since: PC.state.stamp(state) };
    PC.state.addLog(state, "Pardoned by Admiral Key for " + c.price + " gold (Avalon Heat " + heat + " cleared).");
    return { price: c.price, heat: heat, line: L().pardonAccepted };
  }

  // Breaking the pardon (§28.7, §17.4.10), called by js/meters.js when Heat
  // is gained with the pardoning faction: the tag goes, Key's regard -3 and
  // a year of Key's hunt. The betrayal itself is meters' to apply.
  function breakPardon(state) {
    var p = state.pardon;
    if (!p) return false;
    state.pardon = null;
    var tags = state.captain.tags, i = tags.indexOf("Pardoned");
    if (i >= 0) tags.splice(i, 1);
    if (p.issuer === "key") {
      PC.letters.addRegard(state, "key", -R().PARDON_BREAK_REGARD);
      (state.meterState = state.meterState || {}).keyHuntUntil = state.time.year * 4 + state.time.season + 4;
    }
    PC.state.addLog(state, "You broke Admiral Key's pardon. He won't forget it.");
    return true;
  }

  // ---- Howe's information steps (Part 4 §10) --------------------------------------
  function questions(state) {
    var q = L().ask, asked = (state.flags.howe_asked || {});
    return q.filter(function (x) { return !x.when || PC.scenes.test(state, x.when); })
      .map(function (x) { return { id: x.id, label: x.label, answer: x.answer, asked: !!asked[x.id] }; });
  }
  function ask(state, id) {
    var x = L().ask.filter(function (q) { return q.id === id; })[0];
    if (!x) throw new Error("No such question.");
    (state.flags.howe_asked = state.flags.howe_asked || {})[id] = true;
    return x.answer;
  }

  // ---- Scene hooks and tests ----------------------------------------------------
  var F = PC.sceneFns;
  F.addHook("key_meet", { apply: function (state) { PC.letters.meet(state, "key"); return null; } });
  // Regard moves are never shown as numbers (§39.6): no chip.
  F.addHook("key_regard", { apply: function (state, e) { PC.letters.addRegard(state, "key", e.delta); return null; } });
  F.addHook("key_letter", {
    apply: function (state) { PC.letters.take(state, "key"); return "You now sail under Admiral Key's letter of marque."; },
    chip: function () { return { icon: "tag", text: "Admiral Key's letter of marque", ink: "avalon" }; },
  });
  F.addCond("canTakeKeyLetter", function (state) { return PC.letters.canTake(state, "key").ok; });

  PC.admiralty = {
    refused: refused, greeting: greeting, audience: audience, letterOffer: letterOffer, takeLetter: takeLetter,
    pardonPrice: pardonPrice, canPardon: canPardon, pardon: pardon, breakPardon: breakPardon, questions: questions, ask: ask,
  };
})();
