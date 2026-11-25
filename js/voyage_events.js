/* Pirate Chronicle — voyage events (§44; Milestone 7, PR 4).
 *
 * One slot per AP a voyage costs, each firing 75% of the time. A slot
 * draws, in order (§44.4): forced events; the storm check (once a voyage);
 * the encounter check (pirate hunters at half the batch chance, other
 * ships); the officer events (25% a voyage, only when a trigger is met);
 * the general pool by weight; or a quiet passage line. Hunt legs draw one
 * slot out and one back (no encounters; one storm check a trip). Port
 * events come due as AP is spent in a place and fire when the captain
 * leaves it (§44.3).
 *
 * A card that needs the player puts the voyage on hold (state.voyage)
 * and the screen shows it ("event"); choosing resolves it and the voyage
 * runs on. Nothing here touches the screen.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  function V() { return PC.data.voyageEvents; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function stamp(state) { return PC.state.stamp(state); }
  function seasonName(state) { return PC.state.seasonName(state); }
  function seasonIndex(state) { return state.time.year * 4 + state.time.season; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function rnd(state, v, what) { return PC.rng.fromKey([state.world.seed, stamp(state), v.key, what].join("|")); }

  // ---- The registry ------------------------------------------------------------

  var BY_ID = null;
  function byId(id) {
    if (!BY_ID) {
      BY_ID = {};
      V().written.concat([V().hurricane, V().breakingUp], V().approved, V().officerAtSea, V().officerInPort, V().afterEscape || []).forEach(function (e) { BY_ID[e.id] = e; });
    }
    return BY_ID[id];
  }
  function all() { byId("x"); return BY_ID; }
  function isWritten(e) { return !!(e && e.choices || e && e.vote); }

  // ---- Officers ------------------------------------------------------------------

  function aboard(state) { return (state.officers || []).filter(function (o) { return !o.gone && (o.aboard || "flagship") === "flagship"; }); }
  function warmth(o) {
    if (o.warmth) return o.warmth;
    var t = (PC.data.creator.OFFICER_TRAITS || []).filter(function (x) { return x.id === o.voice; })[0];
    return t ? t.warmth : "neutral";
  }
  function seasonsAboard(state, o) {
    var j = o.joined || { year: 1754, season: 0 };
    return (state.time.year - j.year) * 4 + (state.time.season - j.season);
  }
  function hasVoice(state, v) { return aboard(state).filter(function (o) { return o.voice === v || o.secondary === v; })[0] || null; }
  function ofType(state, t) { return aboard(state).filter(function (o) { return o.type === t; })[0] || null; }
  function mentor(state) { return aboard(state).filter(function (o) { return o.mentor; })[0] || null; }
  function qm(state) { return PC.officers.quartermaster ? PC.officers.quartermaster(state) : null; }
  function oName(o) { return o ? (o.first || o.full || "").trim() : ""; }

  // Approval points (§25.5): 5 net points move a rung, at most one
  // point-driven rung a season; authored rung moves ignore the cap.
  function points(state, o, n) {
    if (!o) return;
    o.approval = (o.approval || 0) + n;
    if (Math.abs(o.approval) >= 5 && o.rungMovedStamp !== stamp(state)) {
      var d = o.approval > 0 ? 1 : -1;
      o.rung = clamp((o.rung || 0) + d, -3, 3);
      o.approval = 0;
      o.rungMovedStamp = stamp(state);
    }
  }
  function rung(state, o, n) { if (o) o.rung = clamp((o.rung || 0) + n, -3, 3); }

  // ---- Weights and conditions -------------------------------------------------------

  var BAND_ORDER = ["Mutinous", "Sullen", "Steady", "Eager", "Devoted"];
  function band(state) { return PC.crew.band(state.crew.morale); }

  function outlookOf(state, v) { return PC.weather ? PC.weather.outlook(state, v.zone) : "Fair"; }

  function eligible(state, v, e) {
    var w = e.when || {};
    var s = seasonName(state);
    if (w.seasons && w.seasons.indexOf(s) < 0) return false;
    if (w.zone && w.zone !== v.zone) return false;
    if (w.outlooks && w.outlooks.indexOf(outlookOf(state, v)) < 0) return false;
    if (w.maxAp && v.ap > w.maxAp) return false;
    if (w.northbound && !v.northbound) return false;
    if (w.minBand && BAND_ORDER.indexOf(band(state)) < BAND_ORDER.indexOf(w.minBand)) return false;
    if (w.minHeat && Math.max(state.meters.heat.avalon || 0, state.meters.heat.frisia || 0) < w.minHeat) return false;
    if (w.storesOpened && !PC.crew.usedThisSeason(state, "stores")) return false;
    if (w.greenCrew && (state.crew.tiers.Green || 0) < state.crew.count / 2) return false;
    if (w.voice && !hasVoice(state, w.voice)) return false;
    if (w.prizeShips && !(state.fleet || []).some(function (f) { return f.kind === "prize" && !f.out; })) return false;
    if (w.near && v.from !== w.near && v.to !== w.near) return false;
    if (w.minYear && state.time.year < w.minYear) return false;
    if (w.maxYear && state.time.year > w.maxYear) return false;
    if (w.greedAtLeast && !(state.articles && (state.articles.greed || 0) >= w.greedAtLeast)) return false;
    if (w.once && (state.world.veOnce || {})[e.id]) return false;
    var cd = (state.world.veCooldown || {})[e.id];
    if (cd != null && seasonIndex(state) - cd < (e.cooldown || V().COOLDOWN)) return false;
    return true;
  }

  function weightOf(state, v, e) {
    if (e.grumbling) return grumbleWeight(state, e);
    var w = e.weight || 0, when = e.when || {};
    if (!w) return 0;
    var o = outlookOf(state, v);
    if (when.outlookMult && when.outlookMult[o]) w *= when.outlookMult[o];
    if (when.conditionMult && when.conditionMult[o]) w *= when.conditionMult[o];
    if (when.voiceMult) Object.keys(when.voiceMult).forEach(function (k) { if (hasVoice(state, k)) w *= when.voiceMult[k]; });
    if (when.officerMult) Object.keys(when.officerMult).forEach(function (k) { if (ofType(state, k)) w *= when.officerMult[k]; });
    if (when.pressureMult && (state.crew.pressure || 0) >= 1) w *= when.pressureMult;
    if (when.lowHullMult && state.ship.hull < state.ship.hullMax / 2) w *= when.lowHullMult;
    if (when.afterHurricaneMult && state.flags.hurricaneZone === stamp(state) + "-" + v.zone) w *= when.afterHurricaneMult;
    return w;
  }

  // Talk at the Mess Tables (§44.9): high at Eager/Devoted (Steady at half
  // weight), low at Sullen or below. The build 0.9 playtest pins (P7a):
  // Sullen ×3, Mutinous ×5, then ×(1 + 0.5 a Pressure point); the sore
  // flag's ×3 still stacks.
  function grumbleWeight(state, e) {
    var b = band(state), w = e.weight;
    if (b === "Steady") w *= 0.5;
    if (b === "Sullen") w *= 3;
    if (b === "Mutinous") w *= 5;
    w *= 1 + 0.5 * (state.crew.pressure || 0);
    if (state.flags.soreFlag) w *= 3;
    return w;
  }
  function grumbleLow(state) { var b = band(state); return b === "Sullen" || b === "Mutinous"; }

  function generalPool(state, v) {
    var out = {};
    all();
    V().written.concat(V().approved).forEach(function (e) {
      if (e.storm || !eligible(state, v, e)) return;
      var w = weightOf(state, v, e);
      if (w > 0) out[e.id] = w;
    });
    return out;
  }

  // ---- Officer triggers (§25.15, §44.12.9) ---------------------------------------------

  function triggered(state, v, e) {
    if (e.trigger === "vote") return PC.officers.votePending(state) ? {} : null;
    if (e.trigger === "qmOpinion") {
      var q = qm(state);
      if (!q || q.full && !q.first || (q.rung != null && q.rung < 0) || q.ringleader) return null;
      if (state.used.bigMoraleLoss !== stamp(state) || state.used.qmOpinion === stamp(state)) return null;
      return { officer: q };
    }
    if (e.place && v.place !== e.place) return null;
    var pick = aboard(state).filter(function (o) {
      if (seasonsAboard(state, o) < 2) return false;
      if (e.trigger === "drive") return o.drive === e.drive && (o.rung || 0) >= 2 && !(o.done || {})["drive"];
      if (e.trigger === "fear") return o.fear === e.fear && (o.rung || 0) > -3 && !(o.done || {})["fear"];
      return false;
    })[0];
    if (!pick) return null;
    if (e.needs === "provisionsOut" && state.flags.provisionsRanOut !== stamp(state)) return null;
    if (e.needs === "executed" && state.flags.executedCrew !== stamp(state)) return null;
    if (e.needs === "standingLost" && !standingLost(state)) return null;
    if (e.needs === "signedGreen" && !((state.flags.lastPortGreen || 0) >= 5)) return null;
    return { officer: pick };
  }

  function standingLost(state) {
    var s0 = state.standingAtSeason || {};
    return Object.keys(state.meters.standing).some(function (f) { return (s0[f] != null ? s0[f] : state.meters.standing[f]) - state.meters.standing[f] >= 10; });
  }

  function officerCard(state, v, list) {
    if ((state.used.officerEvents || {})[stamp(state)] >= V().OFFICER_SEASON_CAP) return null;
    for (var i = 0; i < list.length; i++) {
      var t = triggered(state, v, list[i]);
      if (t) return { id: list[i].id, officer: t.officer ? t.officer.id : null };
    }
    return null;
  }
  function noteOfficerEvent(state) {
    var u = (state.used.officerEvents = state.used.officerEvents || {});
    u[stamp(state)] = (u[stamp(state)] || 0) + 1;
  }

  // ---- Storms (§44.7) -------------------------------------------------------------------

  function stormChance(state, v) {
    var S = V().STORM, o = outlookOf(state, v);
    var p = S[o] || 0;
    if (seasonName(state) === "Hurricane") p = Math.max(p, S.hurricaneFloor);
    p += S.perExtraAp * Math.max(0, v.ap - 1);
    return p;
  }

  function stormEvent(state, v, r) {
    if (seasonName(state) === "Hurricane" && r() < 0.5) return "ve_w02_hurricane";
    return seasonName(state) === "Summer" && v.zone === "south" ? "ve_w03_squall" : "ve_w01_noreaster";
  }

  // ---- The draw (§44.4) ------------------------------------------------------------------

  function drawSlot(state, v) {
    var r = rnd(state, v, "slot" + v.i);
    var read = { i: v.i };
    v.readout.push(read);
    // Forced: the Developer's forced event, then nothing else is scripted yet.
    if (state.flags.devForceEvent) {
      var fid = state.flags.devForceEvent; state.flags.devForceEvent = null;
      read.forced = fid;
      // A forced officer event picks its officer: the one it fits, or anyone aboard.
      var fe = byId(fid), fo = null;
      if (fe && fe.trigger && fe.trigger !== "vote") {
        fo = fe.trigger === "qmOpinion" ? qm(state) : aboard(state).filter(function (o) { return o.drive === fe.drive || o.fear === fe.fear; })[0] || aboard(state)[0];
      }
      return { card: { id: fid, officer: fo && fo.id || null } };
    }
    read.roll = r(); read.chance = V().SLOT_CHANCE;
    var fires = read.roll < V().SLOT_CHANCE;
    // The Vote is a duty, not a chance: the next event after the post falls vacant.
    if (PC.officers.votePending(state) && !v.voteDone) { v.voteDone = true; read.officer = "vo_vote"; return { card: { id: "vo_vote" } }; }
    if (!fires) { read.quiet = true; return { quiet: true }; }
    // The storm check: once a voyage (one a hunt trip).
    if (!v.stormChecked) {
      v.stormChecked = true;
      var p = stormChance(state, v), sr = r();
      read.storm = { chance: p, roll: sr };
      var hit = sr < p;
      if (hit && v.read && v.read.outcome === "clean") { var again = r(); read.storm.redraw = again; hit = again < p; }
      if (hit) { read.event = stormEvent(state, v, r); return { card: { id: read.event } }; }
    }
    // The encounter check (voyages only; hunt legs roll ships in batches).
    if (v.mode === "voyage") {
      var enc = encounter(state, v, r, read);
      if (enc) return { card: enc };
    }
    // Officer events: one roll a voyage (25%), only when a trigger is met.
    if (!v.officerRolled) {
      v.officerRolled = true;
      var oc = officerCard(state, v, V().officerAtSea);
      read.officerChance = oc ? V().OFFICER_CHANCE : 0;
      if (oc && r() < V().OFFICER_CHANCE) { read.officer = oc.id; return { card: oc }; }
    }
    // The general pool.
    var pool = generalPool(state, v);
    read.weights = pool;
    if (!Object.keys(pool).length) { read.quiet = true; return { quiet: true }; }
    var id = PC.npcs.weighted(r, pool);
    read.event = id;
    return { card: { id: id } };
  }

  // Pirate hunters at half the batch chance, on the zone's faction (§44.8);
  // then other ships (the prize pipeline without the hunter and density
  // steps): a pirate engages first at Even or better for her.
  function encounter(state, v, r, read) {
    var ch = PC.huntGen.hunterChances(state, v.waters);
    var f = v.zone === "south" ? "Frisia" : "Avalon";
    var ph = (ch[f] || 0) / 2;
    read.hunter = { chance: ph };
    if (r() < ph) return { encounter: "hunter", flag: f };
    read.ship = { chance: V().ENCOUNTER_CHANCE };
    if (r() < V().ENCOUNTER_CHANCE) return { encounter: "ship" };
    return null;
  }

  // ---- Running a voyage ---------------------------------------------------------------------

  function newRun(state, base) {
    state.world.veSeq = (state.world.veSeq || 0) + 1;
    return Object.assign({ key: "ve" + state.world.veSeq, i: 0, readout: [], events: [], stormChecked: false, officerRolled: false, cur: null, pending: false, refund: 0 }, base);
  }

  // Called by PC.world.sail: one slot per AP. v carries from, to, ap,
  // lines and chips; we add slots and the Read Weather roll.
  function voyage(state, v) {
    if (PC.voyageEvents.off) return null; // the older tests sail without events
    var zone = PC.world.zoneOf(v.to);
    Object.assign(v, newRun(state, {}), v);
    v.mode = "voyage"; v.zone = zone; v.waters = zone; v.slots = Math.max(0, v.ap);
    var o = PC.world.place(v.from), d = PC.world.place(v.to);
    v.northbound = !!(o && d && d.x < o.x);
    if (PC.weather && v.slots) {
      v.read = PC.weather.autoRead(state, zone, [state.world.seed, stamp(state), v.key, "read"].join("|"));
      v.readChip = { icon: "dsea", text: "Read Weather: " + v.read.outcome + " · " + PC.weather.badge(v.read.outlook), ink: v.read.outcome === "setback" ? "mid" : null };
      v.chips.push(v.readChip);
      v.readAt = v.lines.length; // 3-34: shown above the passage lines
    }
    state.voyage = v;
    v.sync = true; run(state, v); v.sync = false;
  }

  // A hunt leg (§44.2): one slot out or back, from a port.
  function huntLeg(state, game, dir) {
    if (PC.voyageEvents.off) return null;
    if (PC.node.isOcean(game.home)) return null;
    var v = newRun(state, { mode: "leg", dir: dir, from: game.home, to: game.home, ap: 1, slots: 1, zone: game.waters, waters: game.waters,
      lines: [], chips: [], read: game.readWeather || null, stormChecked: !!game.stormChecked, officerRolled: !!game.officerRolled, game: game.key, home: game.home });
    state.voyage = v;
    v.sync = true; run(state, v); v.sync = false;
    game.officerRolled = game.officerRolled || v.officerRolled;
    game.stormChecked = game.stormChecked || v.stormChecked;
    return v;
  }

  // After an escape on his own ship (3-35): one mandatory card before the
  // ocean node, with the new officer if one came out of the cell.
  function afterEscape(state, sea, officerId) {
    if (PC.voyageEvents.off) return null;
    var v = newRun(state, { mode: "escape", from: sea, to: sea, ap: 0, slots: 0, zone: PC.world.zoneOf(sea), waters: PC.world.zoneOf(sea), lines: [], chips: [] });
    state.voyage = v;
    openCard(state, v, { id: officerId ? "ve_escape_officer" : "ve_escape_crew", officer: officerId || null });
    v.pending = true;
    state.current = { screen: "event" };
    return v;
  }

  function run(state, v) {
    while (v.i < v.slots) {
      var slot = drawSlot(state, v);
      v.i += 1;
      if (slot.quiet) { var pl = passage(state, v); if (pl) v.lines.push(pl); continue; }
      openCard(state, v, slot.card);
      if (v.cur) { v.pending = true; state.current = { screen: "event" }; return; }
    }
    v.pending = false;
    finish(state, v);
  }

  function openCard(state, v, card) {
    if (card.encounter) { v.cur = { encounter: card.encounter, flag: card.flag, phase: "choose" }; return; }
    var e = byId(card.id);
    if (!e) return;
    if (e.trigger) noteOfficerEvent(state);
    // A Pressure-triggered event opens Strike First (§24.13; M9 PR 2).
    if (e.grumbling && (state.crew.pressure || 0) >= 1 && PC.mutiny) PC.mutiny.noteWarning(state);
    if (e.trigger === "qmOpinion") state.used.qmOpinion = stamp(state);
    if (card.officer) {
      var o = (state.officers || []).filter(function (x) { return x.id === card.officer; })[0];
      if (o) { o.done = o.done || {}; o.done[e.trigger] = true; }
    }
    v.cur = { id: e.id, officer: card.officer || null, phase: isWritten(e) ? "choose" : "placeholder" };
    if (e.vote) { v.cur.phase = "vote"; }
    v.events.push(e.id);
    var cd = (state.world.veCooldown = state.world.veCooldown || {});
    cd[e.id] = seasonIndex(state);
    if ((e.when || {}).once) (state.world.veOnce = state.world.veOnce || {})[e.id] = true;
    if (e.storm) state.flags.firstStormSeen = state.flags.firstStormSeen || "pending";
  }

  // The passage line for a quiet slot (§44 appendix §2): by outlook, then
  // zone and season; never the same line twice in a row.
  function passage(state, v) {
    var o = outlookOf(state, v), s = seasonName(state);
    var fits = V().passage.filter(function (p) {
      var w = p.when || {};
      return (!w.outlook || w.outlook === o) && (!w.zone || w.zone === v.zone) && (!w.season || w.season === s);
    });
    var last = state.world.lastPassage;
    var pool = fits.filter(function (p) { return p.text !== last; });
    if (!pool.length) pool = fits;
    var r = rnd(state, v, "passage" + v.i);
    var line = pool[Math.floor(r() * pool.length)];
    state.world.lastPassage = line ? line.text : null;
    return line ? line.text : null;
  }

  // The run is done. During the first, synchronous run (v.sync) the
  // caller goes on itself: world.sail arrives, hunt.start starts its batch.
  function finish(state, v) {
    state.world.lastReadout = v.readout;
    if (v.mode === "voyage") {
      // The sore flag lasts until the next voyage ends (§44.9).
      state.flags.soreFlag = false; state.flags.soreGotAway = null;
      if (v.refund) { state.ap.left = Math.min(state.ap.max, state.ap.left + v.refund); v.refund = 0; }
      v.events.forEach(function (id) { var e = byId(id); if (e) v.chips.push({ icon: "dsea", text: "At sea: " + e.name }); });
      v.events = [];
      v.pending = false;
      if (v.sync) return;
      if (state.gameOver) { state.voyage = null; PC.summary.end(state); return; }
      PC.world.arriveFrom(state, v);
      return;
    }
    state.voyage = null;
    if (v.mode === "leg") { PC.hunt.afterLeg(state, v); return; }
    if (v.mode === "escape") { state.current = { screen: "node" }; return; }
    if (v.mode === "port") {
      if (state.gameOver) { PC.summary.end(state); return; }
      state.current = { screen: "node" };
      var nx = PC.node.nextQueued(state);
      if (nx) PC.scenes.enterScene(state, nx);
    }
  }

  // ---- The card the screen shows -----------------------------------------------------------

  function tokens(state, v, text, ctx) {
    ctx = ctx || {};
    var o = ctx.officer || null;
    var warmOf = function (want) {
      var x = aboard(state).filter(function (a) { return want.indexOf(warmth(a)) >= 0; })[0];
      return x ? oName(x) : "one of the hands";
    };
    var q = qm(state);
    var fills = {
      "Quartermaster": q ? (q.first ? oName(q) : q.full) : "One of the hands",
      "Mentor": mentor(state) ? oName(mentor(state)) : "One of the old hands",
      "Name": oName(o), "A": oName(o),
      "Ship Name": ctx.gotAway || state.ship.name, "Ship": state.ship.name,
      "Node": PC.world.placeName(v.to === "hatteras" || v.to === "bahama" ? v.from : v.to).replace(/^the /, ""),
      "Wreck Ship": "Santa Clara",
    };
    var t = String(text || "").replace(/\[Officer:([^\]]+)\]/g, function (m, k) {
      if (k === "warm") return warmOf(["warm"]);
      if (k === "warm or neutral") return warmOf(["warm", "neutral"]);
      var byT = ofType(state, k) || hasVoice(state, k);
      if (byT) return oName(byT);
      if (k === "Navigator") return fills.Mentor;
      if (k === "Carpenter") return fills.Quartermaster;
      if (k === "Shanty-Singer") return warmOf(["warm", "neutral"]);
      return "one of the hands";
    }).replace(/\[([A-Za-z ]+)\]/g, function (m, k) { return fills[k] != null ? fills[k] : m; });
    // A woman officer's pronouns (§33.3.12).
    var who = o || (/\{qm\./.test(t) ? q : null);
    var fem = who && who.gender === "f";
    t = t.replace(/\{(?:qm|officer)\.(He|he|His|his|Him|him)\}/g, function (m, f) {
      var map = { He: fem ? "She" : "He", he: fem ? "she" : "he", His: fem ? "Her" : "His", his: fem ? "her" : "his", Him: fem ? "Her" : "Him", him: fem ? "her" : "him" };
      return map[f];
    });
    if (fem && o) t = t.replace(/\b(he|his|him|He|His|Him|himself)\b/g, function (w) { return { he: "she", his: "her", him: "her", He: "She", His: "Her", Him: "Her", himself: "herself" }[w]; });
    t = t.replace(/(^|\.\s+|"\s*)one of the hands/g, function (m, a) { return a + "One of the hands"; });
    return PC.text.render(t, state);
  }

  function choiceShown(state, v, c) {
    var s = c.shows || {};
    if (s.minAp && v.ap < s.minAp) return false;
    if (s.sweeps && !(PC.weather && PC.weather.hasSweeps(state.ship.type))) return false;
    if (s.storesUnopened && PC.crew.usedThisSeason(state, "stores")) return false;
    if (s.low && !grumbleLow(state)) return false;
    if (s.tag && (state.captain.tags || []).indexOf(s.tag) < 0) return false;
    return true;
  }

  function checkOf(state, v, c) {
    if (!c.check) return null;
    var ch = c.check, dr = ch.dr, extra = [];
    if (ch.foulDr != null && outlookOf(state, v) === "Foul") dr = ch.foulDr;
    if (ch.gunnerDr != null && ofType(state, "Gunner")) dr = ch.gunnerDr;
    if (ch.smallShip && (state.ship.size || 1) <= 2) extra.push({ label: "A small ship", value: ch.smallShip });
    if (ch.type === "Ride Out Storm") {
      if (v.read && (v.read.outcome === "clean" || v.read.outcome === "partial")) extra.push({ label: "Read Weather", value: 1 });
      if (aboard(state).some(function (o) { return o.type === "Navigator" && (o.level || 1) >= 2; })) extra.push({ label: "Navigator", value: 1 });
      if (hasVoice(state, "Old Salt")) extra.push({ label: "Old Salt aboard", value: 1 });
    }
    return { type: ch.type, dr: dr, extra: extra };
  }

  function view(state) {
    var v = state.voyage;
    if (!v || !v.cur) return null;
    var cur = v.cur;
    var where = v.mode === "port" ? PC.world.placeName(v.to) : v.mode === "escape" ? "At sea" : v.mode === "leg" ? "At sea · " + PC.data.hunt.WATERS[v.waters].name : "At sea · bound for " + PC.world.placeName(v.to);
    var out = { where: where, phase: cur.phase, mode: v.mode, slot: v.i, slots: v.slots };
    if (cur.encounter) {
      var E = V().encounters[cur.encounter];
      out.title = E.name; out.reg = E.reg; out.text = E.text; out.encounter = cur.encounter;
      return out;
    }
    var e = byId(cur.id), ctx = ctxOf(state, v);
    out.id = e.id; out.reg = e.reg || e.id; out.title = e.name; out.group = e.group;
    if (cur.phase === "placeholder") { out.text = "PLACEHOLDER (" + e.name + "): " + e.placeholder; return out; }
    if (cur.phase === "vote") return voteView(state, v, e, out);
    var setup = e.id === "ve_c01_grumbling" && state.flags.soreGotAway ? e.setupGotAway : e.setup;
    out.text = tokens(state, v, setup, ctx);
    if (e.trigger === "fear" && ctx.officer) out.text = tokens(state, v, "[Name]: \"" + V().fearLines[e.fear] + "\"", ctx) + "\n\n" + out.text;
    (e.variants || []).forEach(function (x) {
      if (x.when.firstStorm && state.flags.firstStormSeen === "pending") out.text += "\n\n" + tokens(state, v, x.text, ctx);
      if (x.when.voice && hasVoice(state, x.when.voice)) out.text += "\n\n" + tokens(state, v, x.text, ctx);
    });
    if (cur.phase === "result") { out.result = cur.result; return out; }
    out.choices = (e.choices || []).map(function (c, i) {
      if (!choiceShown(state, v, c)) return null;
      var label = c.labelBy ? c.labelBy[(state.articles && state.articles.terms.quarrels) || "captains_judgment"] : c.label;
      var lock = null;
      if (c.cost && c.cost.purse && state.money.purse < c.cost.purse) lock = "Needs " + c.cost.purse + " gold in your purse";
      if (c.needsPurse && state.money.purse < c.needsPurse) lock = "Needs " + c.needsPurse + " gold in your purse";
      if (c.needsAp && state.ap.left < c.needsAp) lock = "Needs an action";
      return { index: i, label: tokens(state, v, label, ctx), check: checkOf(state, v, c), lock: lock,
        meta: (c.cost && c.cost.purse ? "Costs " + c.cost.purse + " gold from your purse" : "") + (c.breachIf && state.articles && state.articles.terms.discipline === c.breachIf ? " Breaks your Lenient Articles." : "") || null };
    }).filter(Boolean);
    return out;
  }

  function ctxOf(state, v) {
    var cur = v.cur || {};
    var o = cur.officer ? (state.officers || []).filter(function (x) { return x.id === cur.officer; })[0] : null;
    return { officer: o, gotAway: state.flags.soreGotAway || null, low: grumbleLow(state) };
  }

  function voteView(state, v, e, out) {
    var cur = v.cur;
    out.text = tokens(state, v, e.setup, {});
    if (!cur.vote) {
      out.candidates = PC.officers.voteScores(state, null).map(function (x) { return { id: x.id, name: x.name }; });
      out.voteStep = "pre";
    } else if (!cur.reacted) {
      out.voteStep = "result";
      out.winner = cur.vote.winner;
      out.text = "The crew gathers to elect a new Quartermaster. After deliberating for some time, they select " + cur.vote.winner + " to represent their interests.";
      out.reactions = Object.keys(V().voteReact).map(function (k) { return { id: k, label: V().voteReact[k].label }; });
    } else {
      out.voteStep = "done"; out.result = cur.result;
    }
    return out;
  }

  // ---- Choosing -------------------------------------------------------------------------

  function choose(state, index, opts) {
    var v = state.voyage;
    if (!v || !v.cur || v.cur.phase !== "choose") throw new Error("Nothing to choose.");
    var e = byId(v.cur.id), c = e.choices[index], ctx = ctxOf(state, v);
    if (!c || !choiceShown(state, v, c)) throw new Error("No such choice.");
    if (c.cost && c.cost.purse) { if (state.money.purse < c.cost.purse) throw new Error("Not enough in your purse."); state.money.purse -= c.cost.purse; }
    var res = { label: tokens(state, v, c.labelBy ? c.labelBy[(state.articles && state.articles.terms.quarrels) || "captains_judgment"] : c.label, ctx), approval: c.approval || [], chips: [], text: "" };
    if (c.bottle) return bottle(state, v, e, c, res);
    var outcome = null, branch;
    if (c.check) {
      var key = [state.world.seed, stamp(state), v.key, e.id, "check", index].join("|");
      var r = PC.checks.resolve(state, checkOf(state, v, c), key, { conditions: e.storm ? ["Storm"] : [] });
      outcome = r.outcome; res.roll = { dice: r.dice, edge: r.assessment.edge, total: r.total };
      branch = c[outcome];
    } else branch = c.result;
    res.outcome = outcome || "result";
    res.text = tokens(state, v, branch.text, ctx);
    if (c.spendAp) { state.ap.left = Math.max(0, state.ap.left - c.spendAp); res.chips.push({ icon: "ap", text: plural(c.spendAp, "action") }); }
    applyAll(state, v, branch.fx || [], res, ctx);
    if (e.storm) state.flags.firstStormSeen = true;
    // Foundering (§44.7): the Hurricane at Sea's setback breaks her up; a
    // second setback, she founders.
    if (c.founderSecond) { if (outcome === "setback") founder(state, v, res); }
    v.cur.phase = "result";
    v.cur.result = res;
    PC.state.addLog(state, "At sea: " + e.name + " — " + res.label + (outcome ? " (" + outcome + ")" : "") + ".");
    return res;
  }

  function bottle(state, v, e, c, res) {
    var r = rnd(state, v, "bottle");
    var d = 1 + Math.floor(r() * 6);
    var used = (state.world.bottleUsed = state.world.bottleUsed || {});
    var key = d <= 2 ? "wreck" : d === 3 ? "love" : d === 4 ? "fool" : d === 5 ? "map" : "plea";
    if (used[key]) key = ["love", "fool", "wreck", "map", "plea"].filter(function (k) { return !used[k]; })[0] || "fool";
    used[key] = true;
    var R = e.results[key];
    res.text = tokens(state, v, R.text, {});
    if (R.check) {
      var rr = PC.checks.resolve(state, R.check, [state.world.seed, stamp(state), v.key, "bottle-map"].join("|"), { conditions: [] });
      res.outcome = rr.outcome; res.roll = { dice: rr.dice, edge: rr.assessment.edge };
      res.text += "\n\n" + R[rr.outcome].text;
      applyAll(state, v, R[rr.outcome].fx, res, {});
    } else {
      res.outcome = "result";
      applyAll(state, v, (R.fx || []).concat(c.bottle === "aloud" ? (R.aloud || []) : []), res, {});
    }
    v.cur.phase = "result"; v.cur.result = res;
    return res;
  }

  // The Vote (§25.9, §25.15): speak for a candidate or stay out of it, then
  // react to the result.
  function vote(state, speakFor) {
    var v = state.voyage;
    if (!v || !v.cur || v.cur.phase !== "vote" || v.cur.vote) throw new Error("Not the moment for that.");
    var r = PC.officers.runVote(state, speakFor || null, [state.world.seed, stamp(state), v.key, "vote"].join("|"));
    v.cur.vote = { winner: (r.winner.first + " " + (r.winner.last || "")).trim(), winnerId: r.winner.id, spokeFor: speakFor || null };
    return v.cur.vote;
  }
  function voteReact(state, id) {
    var v = state.voyage, R = V().voteReact[id];
    if (!v || !v.cur || !v.cur.vote || v.cur.reacted || !R) throw new Error("Not the moment for that.");
    var res = { label: R.label, approval: R.approval, chips: [], text: R.text, outcome: "result" };
    var w = (state.officers || []).filter(function (o) { return o.id === v.cur.vote.winnerId; })[0];
    applyAll(state, v, R.fx, res, { winner: w });
    v.cur.reacted = true; v.cur.result = res;
    return res;
  }

  // Continue after a result or a placeholder card: the voyage runs on.
  function next(state) {
    var v = state.voyage;
    if (!v) return;
    if (v.cur && v.cur.queue) { var q = v.cur.queue; v.cur = null; openCard(state, v, { id: q }); return; }
    v.cur = null;
    if (state.gameOver) { v.slots = v.i; }
    run(state, v);
  }

  // ---- Encounters -------------------------------------------------------------------------

  // Meet the ship: the hunt's scouting card and battle, run as a hunt game
  // with no batches; when it ends, the voyage runs on (PC.hunt).
  function meet(state, pass) {
    var v = state.voyage, cur = v && v.cur;
    if (!cur || !cur.encounter) throw new Error("No ship to meet.");
    if (pass) { v.cur = null; run(state, v); return null; }
    var r = rnd(state, v, "encounter" + v.i);
    var grp = cur.encounter === "hunter" ? PC.huntGen.sighting(state, v.waters, r, { kind: "hunter", flag: cur.flag }) : PC.huntGen.sighting(state, v.waters, r);
    var condition = PC.weather ? PC.weather.rollCondition(state, v.zone, [state.world.seed, stamp(state), v.key, "enc-cond"].join("|")) : "Fair";
    v.cur = null;
    return PC.hunt.startEncounter(state, grp, { voyage: v.key, waters: v.waters, condition: condition, home: v.from });
  }
  function resume(state) {
    var v = state.voyage;
    if (!v) return;
    state.current = { screen: "event" };
    run(state, v);
  }

  // ---- Effects ----------------------------------------------------------------------------

  function legLots(state, legs) { return Math.round(PC.world.headsAtSea(state) / 5 * legs); }

  function loseCrew(state, n) {
    var c = state.crew, lost = 0;
    PC.data.economy.TIER_ORDER.forEach(function (t) { var k = Math.min(n - lost, c.tiers[t] || 0); if (k > 0) { c.tiers[t] -= k; c.count -= k; lost += k; } });
    return lost;
  }
  function wound(state, n) {
    var c = state.crew, done = 0;
    c.woundedTiers = c.woundedTiers || {};
    PC.data.economy.TIER_ORDER.forEach(function (t) { var k = Math.min(n - done, c.tiers[t] || 0); if (k > 0) { c.tiers[t] -= k; c.count -= k; c.wounded = (c.wounded || 0) + k; c.woundedTiers[t] = (c.woundedTiers[t] || 0) + k; done += k; } });
    return done;
  }

  function factionOfZone(zone) { return zone === "south" ? "frisia" : "avalon"; }

  var RUMOR_WEIGHTS = { B: { "Danger": 45, "Quest": 30, "Merchant": 25 }, C: { "World State": 45, "Node": 30, "Legend": 5, "Reputation": 20 }, Reputation: { "Reputation": 1 }, Legend: { "Legend": 1 } };

  function applyAll(state, v, fx, res, ctx) {
    var r = rnd(state, v, "fx" + v.i + (v.cur ? v.cur.id : ""));
    (fx || []).forEach(function (f) { applyOne(state, v, f, res, ctx, r); });
  }

  function applyOne(state, v, f, res, ctx, r) {
    var chips = res.chips, sh = state.ship;
    var target = function () { return f.who === "qm" ? qm(state) : f.who === "winner" ? ctx.winner : ctx.officer; };
    if ("prov" in f) {
      var legs = f.prov * (f.fisherman && (state.captain.tags || []).indexOf("Fisherman") >= 0 ? 1.5 : 1);
      var n = legLots(state, Math.abs(legs));
      if (legs > 0) { n = Math.min(n, PC.crew.slotsFree(state)); state.provisions += n; if (n) chips.push({ icon: "prov", text: "+" + plural(n, "provisions lot"), ink: "good" }); }
      else { n = PC.crew.takeFood(state, n).total; if (n) chips.push({ icon: "prov", text: "−" + plural(n, "provisions lot"), ink: "mid" }); }
    }
    if ("provPct" in f) { var p = PC.crew.takeFood(state, Math.ceil(PC.crew.food(state) * Math.abs(f.provPct))).total; if (p) chips.push({ icon: "prov", text: "−" + plural(p, "provisions lot"), ink: "bad" }); }
    if ("morale" in f) {
      var m = f.morale;
      if (ctx.low && f.low != null) m = f.low;
      if (ctx.low && f.lowPressure) { state.crew.pressure = clamp((state.crew.pressure || 0) + f.lowPressure, 0, 5); chips.push({ icon: "pressure", text: "The crew's grievances grow", ink: "bad" }); m = 0; }
      if (f.shantySinger && hasVoice(state, "Shanty-Singer")) m = f.shantySinger;
      if (m) { PC.crew.addMorale(state, m); chips.push({ icon: "morale", text: "Crew morale " + (m > 0 ? "+" : "−") + Math.abs(m), ink: m > 0 ? "good" : "bad" }); }
    }
    if ("hullPct" in f) { var h = Math.max(1, Math.round(sh.hullMax * Math.abs(f.hullPct))); sh.hull = Math.max(1, sh.hull - h); chips.push({ icon: "hull", text: "Hull −" + h, ink: "bad" }); }
    if (f.hullOrMorale) { if (r() < 0.5) applyOne(state, v, { hullPct: -0.05 }, res, ctx, r); else applyOne(state, v, { morale: -3 }, res, ctx, r); }
    if (f.stormTable) stormTable(state, v, res, r);
    if ("crewLost" in f) { var l = loseCrew(state, f.crewLost); if (l) chips.push({ icon: "officer", text: plural(l, "hand") + " lost", ink: "bad" }); }
    if ("wounded" in f) { var w = wound(state, f.wounded); if (w) chips.push({ icon: "officer", text: plural(w, "hand") + " hurt", ink: "bad" }); }
    if ("purse" in f) { state.money.purse = Math.max(0, state.money.purse + f.purse); chips.push({ icon: "gold", text: (f.purse > 0 ? "+" : "−") + Math.abs(f.purse) + " your purse", ink: f.purse > 0 ? "good" : "mid" }); }
    if ("crewGold" in f) { state.money.crew = Math.max(0, state.money.crew + f.crewGold); chips.push({ icon: "gold", text: (f.crewGold > 0 ? "+" : "−") + Math.abs(f.crewGold) + " crew gold", ink: f.crewGold > 0 ? "good" : "mid" }); }
    if ("dread" in f) { PC.meters.addDread(state, f.dread); chips.push({ icon: "dread", text: "Dread +" + f.dread }); }
    if ("heatZone" in f) { var fz = factionOfZone(v.zone); PC.meters.addHeat(state, fz, f.heatZone); chips.push({ icon: "heat", text: (fz === "avalon" ? "Avalon" : "Frisian") + " Heat +" + f.heatZone, ink: "bad" }); }
    if ("heatHere" in f) { var nf = (PC.data.nodes[v.to] || {}).faction; var hf = nf === "frisia" ? "frisia" : "avalon"; PC.meters.addHeat(state, hf, f.heatHere); chips.push({ icon: "heat", text: (hf === "avalon" ? "Avalon" : "Frisian") + " Heat +" + f.heatHere, ink: "bad" }); }
    if ("pressure" in f) { state.crew.pressure = clamp((state.crew.pressure || 0) + f.pressure, 0, 5); chips.push({ icon: "pressure", text: f.pressure > 0 ? "The crew's grievances grow" : "The talk dies down", ink: f.pressure > 0 ? "bad" : "good" }); }
    // Read People in a Pressure event (§24.13, §25.14; M9 PR 2): a clean
    // result reveals how close the crew is and names an officer ringleader;
    // a partial only the level.
    if ("reveal" in f && PC.mutiny) {
      var pr = state.crew.pressure || 0;
      chips.push({ icon: "pressure", text: "How close the crew is to mutiny: " + pr + " of 5", ink: pr >= 3 ? "bad" : "mid" });
      if (f.reveal === "full") {
        var rl = PC.mutiny.noteWarning(state, { name: true });
        chips.push({ icon: "officer", text: rl ? "Behind it: " + (rl.first + " " + (rl.last || "")).trim() : "No officer is behind it", ink: rl ? "bad" : null });
      }
    }
    if ("rumor" in f) {
      var weights = RUMOR_WEIGHTS[f.rumor] || RUMOR_WEIGHTS.C;
      var rec = state.location ? PC.rumors.draw(state, weights, [state.world.seed, stamp(state), v.key, "rumor", v.i].join("|"), "at sea", null, { noA: true }) : null;
      chips.push({ icon: "rumor", text: rec ? "A rumor heard · added to your Rumors" : "Nothing new to hear", ink: rec ? null : "mid" });
    }
    if ("rumorLine" in f) {
      state.rumors.push({ id: "bottle_wreck", type: "Legend", text: f.rumorLine, source: "a bottle", heard: { year: state.time.year, season: state.time.season }, expires: null });
      chips.push({ icon: "rumor", text: "Added to your Rumors" });
    }
    if ("apRefund" in f) { v.refund = (v.refund || 0) + f.apRefund; chips.push({ icon: "ap", text: "+" + plural(f.apRefund, "action") + " back", ink: "good" }); }
    if ("flag" in f) state.flags[f.flag] = true;
    if ("tag" in f) {
      var tags = state.captain.tags;
      if (tags.indexOf(f.tag) < 0) tags.push(f.tag);
      state.captain.tagsUntil = state.captain.tagsUntil || {}; state.captain.tagsUntil[f.tag] = stamp(state);
      chips.push({ icon: "tag", text: f.tag + " (until the season ends)", ink: "bad" });
    }
    if (f.captainWounded) { var tg = state.captain.tags; if (tg.indexOf("Wounded") < 0) tg.push("Wounded"); chips.push({ icon: "person", text: "You're Wounded", ink: "bad" }); }
    if ("guns" in f) { var g = Math.min(sh.guns, Math.abs(f.guns)); sh.guns -= g; if (g) chips.push({ icon: "hull", text: plural(g, "gun") + " lost", ink: "bad" }); }
    if ("good" in f) { var gn = Math.min(f.n, PC.crew.slotsFree(state)); if (gn) { PC.crew.addGood(state, f.good, gn, false); chips.push({ icon: "treasure", text: "+" + gn + " " + f.good, ink: "good" }); } }
    if (f.openStores) {
      var ch = PC.crew.storeChoices ? PC.crew.storeChoices(state) : [];
      var ok = ch.filter(function (x) { return x.ok !== false; })[0];
      if (ok && !PC.crew.usedThisSeason(state, "stores")) { var gm = PC.crew.openStores(state, ok.good || ok.id || ok); chips.push({ icon: "morale", text: "The stores are opened · morale +" + gm, ink: "good" }); }
    }
    if ("item" in f) { state.captain.items.push(f.item); chips.push({ icon: "item", text: f.item, ink: "good" }); }
    if ("points" in f) { var o1 = target(); if (o1) { points(state, o1, f.points); chips.push({ icon: "person", text: oName(o1) + (f.points > 0 ? " approves" : " disapproves") }); } }
    if ("rung" in f) { var o2 = target(); if (o2) { rung(state, o2, f.rung); chips.push({ icon: "person", text: oName(o2) + (f.rung > 0 ? " thinks better of you" : " thinks less of you"), ink: f.rung > 0 ? "good" : "bad" }); } }
    if ("officerFlag" in f) { var o3 = ctx.officer; if (o3) { o3.flags = o3.flags || {}; o3.flags[f.officerFlag] = true; } }
    if ("season" in f) chips.push({ icon: "officer", text: "The new hands are drilled hard (seasoning isn't built yet)", ink: "mid" });
    if ("spendAp" in f) { state.ap.left = Math.max(0, state.ap.left - f.spendAp); chips.push({ icon: "ap", text: plural(f.spendAp, "action") }); }
    if (f.breakingUp) { v.cur.queue = "ve_w02_breaking"; chips.push({ icon: "hull", text: "She's breaking up", ink: "bad" }); }
  }

  // The storm setback table (§44.7): one roll; Hurricane season hits harder.
  function stormTable(state, v, res, r) {
    var S = V().STORM_SETBACK, hur = seasonName(state) === "Hurricane", L = V().lines.stormTable;
    var d = 1 + Math.floor(r() * 4);
    if (d === 1) {
      var rng = hur ? S.hurricaneHull : S.hull, pct = rng[0] + r() * (rng[1] - rng[0]);
      res.text += "\n\n" + L.hull;
      applyOne(state, v, { hullPct: -pct }, res, {}, r);
    } else if (d === 2) {
      var hr = hur ? S.hurricaneHands : S.hands, n = hr[0] + Math.floor(r() * (hr[1] - hr[0] + 1));
      n = Math.min(n, Math.max(0, state.crew.count - 1));
      res.text += "\n\n" + L.hands.replace("[number]", n);
      applyOne(state, v, { crewLost: n }, res, {}, r);
    } else if (d === 3) {
      var plan = PC.crew.jettisonPlan(state, Math.max(1, Math.ceil(PC.crew.slotsUsed(state) * 0.15)));
      (plan || []).forEach(function (x) { if (x.what === "provisions") state.provisions -= x.n; else if (x.what === "treasure") state.cargo.treasure[x.dirty ? "dirty" : "clean"] -= x.n; else PC.crew.removeGood(state, x.what, x.n, x.dirty); });
      res.text += "\n\n" + L.cargo;
      res.chips.push({ icon: "treasure", text: (plan || []).length ? "Over the side: " + plan.map(function (x) { return x.n + " " + x.what; }).join(", ") : "Nothing worth throwing over", ink: "bad" });
    } else {
      state.ship.speed = Math.max(0, state.ship.speed - 1);
      state.ship.rigging = "frayed";
      res.text += "\n\n" + L.mast;
      res.chips.push({ icon: "hull", text: "Sprung mast: Speed −1 until a yard repair", ink: "bad" });
    }
  }

  // She founders (§44.7). With a fleet, survivors cross to a fleet ship;
  // alone, the captain's Endure check (§21.8). A captain rescued alone is
  // set ashore shipless, which the game can't play yet: the run ends there.
  function founder(state, v, res) {
    var F = V().FOUNDER, r = rnd(state, v, "founder");
    var fleetShip = (state.fleet || []).filter(function (f) { return f.kind === "fleet" && !f.out; })[0];
    if (fleetShip) {
      var lost = Math.round(state.crew.count * (F.fleetCrewLost[0] + r() * (F.fleetCrewLost[1] - F.fleetCrewLost[0])));
      loseCrew(state, lost);
      (state.officers || []).forEach(function (o) { if (!o.gone && (o.aboard || "flagship") === "flagship" && r() < F.fleetOfficerLost) { o.gone = true; o.goneHow = "lost at sea"; } });
      PC.hunt.promoteFleetShip(state, fleetShip);
      res.text += "\n\n" + V().lines.founderedFleet.replace("[Ship]", state.ship.name);
      res.chips.push({ icon: "hull", text: "Your flagship is lost; " + plural(lost, "hand") + " drowned", ink: "bad" });
      return;
    }
    res.text += "\n\n" + V().lines.founderedAlone;
    var e = PC.checks.resolve(state, { type: "Endure", dr: 2 }, [state.world.seed, stamp(state), v.key, "founder-endure"].join("|"), { conditions: ["Storm"] });
    res.chips.push({ icon: "person", text: "Endure: " + e.outcome, ink: e.outcome === "setback" ? "bad" : "mid" });
    if (e.outcome === "setback") {
      res.text += "\n\n" + V().lines.drowned;
      state.gameOver = { how: "died", line: "drowned" };
    } else {
      res.text += "\n\n" + V().lines.rescued.replace("[Node]", PC.world.placeName(v.to));
      if (e.outcome === "partial") { var t = state.captain.tags; if (t.indexOf("Wounded") < 0) t.push("Wounded"); }
      state.gameOver = { how: "captured", line: "shipwrecked" };
    }
  }

  // ---- Port events (§44.3) -----------------------------------------------------------------

  // Leaving a place where AP was spent: an officer's port event may come due.
  function portLeave(state, place, apSpent) {
    if (PC.voyageEvents.off) return null;
    var id = state.location && state.location.node;
    if (!id || !apSpent || PC.node.isOcean(id) || id === "talanee" || id === "haven") return null;
    var v = newRun(state, { mode: "port", from: id, to: id, ap: 0, slots: 0, zone: PC.world.zoneOf(id), waters: PC.world.zoneOf(id), lines: [], chips: [], place: place });
    var oc = officerCard(state, v, V().officerInPort);
    if (!oc) return null;
    var r = rnd(state, v, "port");
    if (r() >= V().PORT_OFFICER_CHANCE) return null;
    openCard(state, v, oc);
    if (!v.cur) return null;
    v.pending = true;
    state.voyage = v;
    state.current = { screen: "event" };
    return v;
  }

  PC.voyageEvents = {
    afterEscape: afterEscape,
    byId: byId, all: all, isWritten: isWritten, voyage: voyage, huntLeg: huntLeg, run: run, view: view, choose: choose, next: next,
    vote: vote, voteReact: voteReact, meet: meet, resume: resume, portLeave: portLeave,
    stormChance: stormChance, generalPool: generalPool, triggered: triggered, passage: passage, points: points, finish: finish,
  };
})();
