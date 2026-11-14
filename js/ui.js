/* Pirate Chronicle — drawing the screen.
 *
 * Plain placeholder styling: the UI chat designs the real look. Everything
 * here reads from the engine (PC.scenes, PC.checks) and calls back into it;
 * no game rules live in this file.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var state = null;
  var root = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Paragraphs on blank lines; *stage business* in italics (§33.3.3).
  function prose(text) {
    return String(text || "").split(/\n\n+/).filter(Boolean).map(function (p) {
      return "<p>" + esc(p).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  // Images: a file path, or the inlined copy in the single-file build.
  function assetUrl(path) { return esc((PC.assets && PC.assets[path]) || path); }

  // "a sailor", "an official"
  function aOrAn(word) { return (/^[aeiou]/i.test(word) ? "an " : "a ") + word; }

  function pct(x) { return Math.round(x * 100) + "%"; }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n); }

  // ---- Save after every action ----------------------------------------

  function act(fn) {
    return function () {
      try { fn.apply(null, arguments); }
      catch (e) { console.error(e); toast("Something went wrong: " + e.message); }
      if (state) PC.state.saveToBrowser(state);
      else if (creating) saveDraft();
      draw();
    };
  }

  // ---- Screens ---------------------------------------------------------

  function draw() {
    if (!state && creating) return drawCreator();
    if (!state) return drawTitle();
    root.innerHTML =
      '<div class="game">' + topBar() +
      '<div class="body"><aside class="sheet">' + captainSheet() + "</aside>" +
      '<main class="stage">' + (state.current.screen === "hub" ? hubPanel() : state.current.screen === "node" ? nodePanel() : scenePanel()) + logPanel() + "</main></div></div>" +
      popupHtml();
    wire();
  }

  function drawTitle() {
    var hasSave = !!PC.state.loadFromBrowser();
    root.innerHTML =
      '<div class="title-screen">' +
      "<h1>Pirate Chronicle</h1>" +
      '<p class="sub">Prototype · Milestone 3 · scenes and quests</p>' +
      '<div class="title-buttons">' +
      (hasSave ? '<button data-act="continue" class="primary">Continue</button>' : "") +
      '<button data-act="new"' + (hasSave ? "" : ' class="primary"') + ">New game</button>" +
      '<button data-act="import">Load a save file</button>' +
      "</div>" +
      '<p class="note">Make your captain and sail into Ocracoke: run the sandbar, meet the Beach Captain, take Bobby Rats\'s job and grant a dying pirate\'s wish. Then hire hands and officers, hear the rumors, repair the sloop and sign the Articles. The minigames come next.</p>' +
      '<p class="note"><button class="link" data-act="quickstart">Quick start with the test captain</button></p>' +
      "</div>";
    wire();
  }

  function topBar() {
    return '<header class="topbar">' +
      '<span class="brand">Pirate Chronicle</span>' +
      '<span class="when">' + esc(PC.state.seasonName(state)) + " " + state.time.year + "</span>" +
      '<span class="ap" title="Actions left this season">' + apPips() + "</span>" +
      '<span class="spacer"></span>' +
      '<button data-act="export" title="Download your save as a file">Save file</button>' +
      '<button data-act="import" title="Load a save file">Load file</button>' +
      '<button data-act="dev">Developer</button>' +
      '<button data-act="quit">Title</button>' +
      "</header>";
  }

  function apPips() {
    var out = "";
    for (var i = 0; i < state.ap.max; i++) out += '<i class="' + (i < state.ap.left ? "on" : "off") + '"></i>';
    return out + ' <small>' + state.ap.left + "/" + state.ap.max + "</small>";
  }

  function row(label, value) { return "<tr><th>" + esc(label) + "</th><td>" + value + "</td></tr>"; }

  function captainSheet() {
    var c = state.captain;
    var stats = PC.checks.STATS.map(function (s) {
      return '<span class="stat"><b>' + c.stats[s] + "</b>" + esc(s) + "</span>";
    }).join("");
    var training = Object.keys(c.training || {}).map(function (t) {
      return esc(t) + " +" + c.training[t];
    }).join(", ") || "None";
    var m = state.meters;
    var pic = PC.creator.captainPortrait(c);
    var mentor = (state.officers || []).filter(function (o) { return o.mentor && !o.gone; })[0];
    return (pic ? '<img class="sheet-portrait" src="' + assetUrl(pic) + '" alt="Portrait of ' + esc(c.first) + '">' : "") +
      '<h2>' + esc((c.first + " " + c.last).trim()) + "</h2>" +
      '<p class="muted">Age ' + c.age + " · Ash-Born of " + esc(c.homeCity) + (c.profession ? " · once " + esc(aOrAn(c.profession.toLowerCase())) : "") + "</p>" +
      '<div class="stats">' + stats + "</div>" +
      '<p class="small"><b>Training:</b> ' + training + "</p>" +
      '<p class="small"><b>Tags:</b> ' + esc((c.tags || []).join(", ") || "None") + "</p>" +
      '<p class="small"><b>Items:</b> ' + esc((c.items || []).join(", ") || "None") + "</p>" +
      '<table class="ledger">' +
      row("Crew gold", state.money.crew) +
      row("Your purse", state.money.purse) +
      row("Provisions", state.provisions + " lots") +
      (state.cargo ? row("Hold", PC.crew.slotsUsed(state) + " / " + state.ship.cargo + " slots" + (PC.crew.treasureUnits(state) ? " · " + PC.crew.treasureUnits(state) + " treasure" : "")) : "") +
      "</table>" +
      (PC.data.shipArt(state.ship.type) ? '<img class="sheet-ship" src="' + assetUrl(PC.data.shipArt(state.ship.type)) + '" alt="Your ' + esc(state.ship.type.toLowerCase()) + '">' : "") +
      '<table class="ledger">' +
      row(state.ship.type, "<i>" + esc(state.ship.name) + "</i>") +
      row("Hull", state.ship.hull + " / " + state.ship.hullMax) +
      row("Guns", state.ship.guns + " / " + state.ship.gunsMax) +
      row("Crew", state.crew.count + " hands") +
      row("Morale", state.crew.morale + (PC.crew ? " · " + PC.crew.band(state.crew.morale) : "")) +
      (state.cargo ? row("Crew Rating", PC.crew.crewRating(state)) : "") +
      row("Dread", m.dread) +
      row("Standing", "Frisia " + m.standing.frisia + " · Avalon " + m.standing.avalon + " · Pirates " + m.standing.pirates) +
      row("Heat", "Frisia " + m.heat.frisia + " · Avalon " + m.heat.avalon) +
      "</table>" +
      (mentor ? mentorCard(mentor) : "");
  }

  var RUNGS = { "-3": "Enemy", "-2": "Rival", "-1": "Wary", "0": "Neutral", "1": "Friendly", "2": "Friend", "3": "Confidant" };

  function mentorCard(o) {
    var pic = PC.creator.officerPortrait(o);
    return '<div class="officer-card">' +
      (pic ? '<img src="' + assetUrl(pic) + '" alt="">' : "") +
      "<div><b>" + esc((o.first + " " + o.last).trim()) + "</b><br>" +
      '<span class="small">' + esc(o.type) + (o.mentor ? " · your mentor" : o.named ? " · Named officer" : "") + (o.quartermaster ? " · Quartermaster" : "") + "</span><br>" +
      '<span class="small muted">' + esc([o.voice, o.secondary, o.third, o.mentor ? "Mentor" : o.unique && o.unique !== o.voice ? o.unique : null].filter(Boolean).join(", ")) + " · " + esc(RUNGS[String(o.rung)] || "") + "</span></div></div>";
  }

  function checkLine(chk) {
    if (!chk) return "";
    var parts = chk.parts.map(function (p) {
      return "<li><span>" + esc(p.label) + "</span><b>" + signed(p.value) + "</b></li>";
    }).join("");
    var capNote = chk.modsCapped ? '<li class="muted">Traits and tags are capped at ±3.</li>' : "";
    var clampNote = chk.rawEdge !== chk.edge ? '<li class="muted">Edge is clamped to −4…+6.</li>' : "";
    return '<details class="check"><summary>' +
      "<span class=\"ctype\">" + esc(chk.type) + "</span> · <span class=\"tier tier-" + chk.tier.replace(/\s/g, "") + "\">" + esc(chk.tier) + "</span>" +
      ' <span class="odds">' + pct(chk.odds.partialOrBetter) + " success · " + pct(chk.odds.clean) + " clean</span>" +
      "</summary><ul>" + parts + '<li class="total"><span>Edge</span><b>' + signed(chk.edge) + "</b></li>" + capNote + clampNote + "</ul></details>";
  }

  function costLine(cost) {
    if (!cost || !cost.gold) return "";
    return '<span class="cost">Costs ' + cost.gold + " gold from " + (cost.pot === "purse" ? "your purse" : "crew gold") + "</span>";
  }

  function scenePanel() {
    var v = PC.scenes.viewScene(state);
    var html = '<section class="scene">' +
      '<div class="where">' + esc(v.where) + "</div>" +
      (v.title ? "<h2>" + esc(v.title) + "</h2>" : "") +
      '<div class="setup">' + prose(v.setup) + "</div>";
    if (v.phase === "choosing") {
      html += '<ol class="choices">' + v.choices.map(function (c) {
        var locked = c.status === "locked";
        return '<li class="' + (locked ? "locked" : "") + '">' +
          '<button data-act="choose" data-i="' + c.index + '"' + (locked ? " disabled" : "") + ">" + esc(c.label) + "</button>" +
          (locked ? '<span class="lock">🔒 ' + esc(c.reason) + "</span>" : "") +
          costLine(c.cost) + (locked ? "" : checkLine(c.check)) +
          "</li>";
      }).join("") + "</ol>";
    } else {
      html += resultPanel(v.result);
    }
    return html + "</section>";
  }

  var OUTCOME_LABEL = { clean: "Clean success", partial: "Partial success", setback: "Setback", result: "" };

  function diceLine(roll) {
    if (!roll || !state.settings.showDice) return "";
    return '<div class="dice">Dice ' + roll.dice[0] + " + " + roll.dice[1] + ", edge " + signed(roll.edge) + " = " + roll.total + "</div>";
  }

  function resultPanel(r) {
    var html = '<div class="result">' +
      '<p class="you-chose">' + esc(r.choiceLabel) + "</p>";
    if (r.firstRoll) {
      html += '<p class="muted small">First roll: ' + OUTCOME_LABEL[r.firstRoll.outcome] + ". Rerolled with " + esc(r.firstRoll.by) + ".</p>";
    }
    if (OUTCOME_LABEL[r.outcome]) html += '<div class="badge badge-' + r.outcome + '">' + OUTCOME_LABEL[r.outcome] + "</div>";
    html += diceLine(r.roll) + prose(r.text);
    var eff = r.effects.filter(Boolean);
    if (eff.length) html += '<ul class="effects">' + eff.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>";
    html += '<div class="actions">';
    if (r.reroll) html += '<button data-act="reroll">Reroll (' + esc(r.reroll.name) + ")</button>";
    if (r.needsPot) {
      html += '<button data-act="commit" data-pot="purse" class="primary">Into your purse</button>' +
              '<button data-act="commit" data-pot="crew" class="primary">Share it with the crew</button>';
    } else {
      html += '<button data-act="commit" class="primary">Continue</button>';
    }
    return html + "</div></div>";
  }

  function hubPanel() {
    var h = PC.scenes.viewHub(state);
    return '<section class="scene hub">' +
      "<h2>" + esc(h.title) + "</h2>" + prose(h.text) +
      '<ol class="choices">' + h.entries.map(function (en) {
        return "<li" + (en.ok ? "" : ' class="locked"') + '><button data-act="enter" data-scene="' + esc(en.scene) + '"' + (en.ok ? "" : " disabled") + ">" +
          esc(en.label) + (en.ap ? " <small>(" + en.ap + " action" + (en.ap > 1 ? "s" : "") + ")</small>" : "") + "</button>" +
          (en.ok ? "" : '<span class="lock">' + esc(en.why) + "</span>") + "</li>";
      }).join("") + "</ol>" +
      '<div class="actions"><button data-act="endseason">End the season</button></div>' +
      "</section>";
  }

  function logPanel() {
    var lines = state.log.slice(-30).reverse();
    return '<details class="log"><summary>Ship\'s log</summary>' +
      (lines.length ? "<ul>" + lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : '<p class="muted">Nothing yet.</p>') +
      "</details>";
  }

  // ---- The node (§17): locations, services and the Ship layer ------------
  // The rules are in js/node.js, js/crew.js and js/articles.js; this only
  // draws them. Numbers typed into the boxes are read when a button is
  // pressed (data-for names the box).

  function N() { return PC.node; }
  function gold(n) { return (Math.round(n * 100) / 100).toLocaleString("en-US"); }
  function apLabel(n) { return n ? n + " action" + (n > 1 ? "s" : "") : "no action"; }

  function qtyBox(id, value, max) {
    return '<input class="qty" type="number" inputmode="numeric" min="1"' + (max != null ? ' max="' + max + '"' : "") +
      ' id="' + id + '" value="' + esc(value) + '">';
  }

  function sayBox() {
    var s = state.location.say;
    if (!s) return "";
    return '<div class="say">' + (s.who ? '<span class="who">' + esc(s.who) + "</span> " : "") + esc(PC.text.render(s.line, state)) +
      (s.heard && s.heard.length ? '<ul class="heard">' + s.heard.map(function (h) { return "<li>" + prose(h).replace(/^<p>|<\/p>$/g, "") + "</li>"; }).join("") + "</ul>" : "") +
      (s.note ? '<span class="note">' + esc(s.note) + "</span>" : "") + "</div>";
  }

  function say(who, line, note, heard) { state.location.say = { who: who, line: line || "", note: note || null, heard: heard || null }; }

  function npcName(id) {
    var n = PC.npcs.get(state, id);
    return n ? ((n.title ? n.title + " " : "") + n.full) : id;
  }

  function npcTag(id) {
    var n = PC.npcs.get(state, id);
    if (!n) return "";
    var known = (state.npcs[n.id] || {}).knownTraits || [];
    return '<span class="npc-tag">' + esc(npcName(id)) + (n.label ? ', <i>' + esc(n.label) + "</i>" : "") +
      ' <span class="rung rung-' + esc(n.rungName) + '">' + esc(n.rungName) + "</span>" +
      (known.length ? ' <span class="small muted">(' + esc(known.join(", ")) + ")</span>" : "") + "</span>";
  }

  function comingSoon(label, milestone, extraLock) {
    return '<li class="locked"><button disabled>' + esc(label) + "</button>" +
      '<span class="lock">' + esc(extraLock || "Arrives in Milestone " + milestone) + "</span></li>";
  }

  function nodePanel() {
    var nd = N().nodeData(N().here(state));
    var place = state.location.place;
    var html = '<section class="scene node">';
    if (!place) {
      html += '<div class="where">' + esc(nd.control) + " · " + esc(nd.tier) + "</div><h2>" + esc(nd.name) + "</h2>" + prose(nd.blurb);
      html += '<ol class="choices places">' + N().places(state).map(function (p) {
        return "<li" + (p.locked ? ' class="locked"' : "") + '><button data-act="goplace" data-place="' + p.id + '"' + (p.locked ? " disabled" : "") + ">" + esc(p.name) + "</button>" +
          (p.locked ? '<span class="lock">' + esc(p.why) + "</span>" : "") + "</li>";
      }).join("") +
        comingSoon("Hunt for Prizes", 5, state.articles ? null : "Sign the Articles first (Ship). The hunt arrives in Milestone 5") + "</ol>";
      if (!state.ap.left) html += '<p class="notice">No actions left this season. The end-of-prototype screen comes in Milestone 6; the Developer panel can top up actions.</p>';
    } else {
      var loc = nd.locations[place];
      html += '<div class="where">' + esc(nd.name) + '</div><h2>' + esc(loc.name) + "</h2>" +
        '<p class="muted">' + esc(loc.blurb) + "</p>" + sayBox();
      // A scene is waiting (Welcome to the Underworld after the first Tavern
      // action): let the player read what was just said, then go on.
      if ((state.location.queue || []).some(function (q) { return !state.seen[q]; })) {
        return html + '<div class="actions"><button class="primary" data-act="nextqueued">Continue</button></div></section>';
      }
      html += ({ tavern: tavernMenu, docks: docksMenu, merchant: merchantMenu, graveyard: graveyardMenu, ship: shipMenu })[place]();
      html += '<div class="actions"><button data-act="leaveplace">← Back to ' + esc(nd.name) + "</button></div>";
    }
    return html + "</section>";
  }

  // ---- Tavern ----

  function tavernMenu() {
    var id = N().here(state);
    var keeper = N().slotNpc(id, "keeper");
    var first = !state.flags[N().FLAGS.tavernDone];
    var k = PC.npcs.get(state, keeper);
    var asked = PC.rumors.keeperAsked(state);
    var talk = PC.checks.assess(state, PC.rumors.talkCheck(state), { conditions: ["Harbor"] });
    var html = '<h3>' + npcTag(keeper) + "</h3>" + '<ol class="choices">' +
      "<li" + (asked ? ' class="locked"' : "") + '><button data-act="rumors"' + (asked ? " disabled" : "") + ">Ask " + esc(k.first) + " for rumors</button>" +
      (asked ? '<span class="lock">Heard this season\'s rumors</span>' : '<span class="cost">No action. A clean Tavern Talk gets one more.</span>' + checkLine(talk)) + "</li>";
    if (N().oneArmedHere(state)) {
      html += '<li><button data-act="oneArmed">Talk to the one-armed pirate</button><span class="cost">He sits with his mates, drinking.</span></li>';
    }
    // Shore leave (§24.12)
    [1, 2].forEach(function (ap) {
      var c = N().lodgingCheck(state, ap);
      var gain = (ap === 2 ? 15 : 10) + (N().nodeData(id).freePort ? 5 : 0);
      html += "<li" + (c.ok ? "" : ' class="locked"') + '><button data-act="lodging" data-ap="' + ap + '"' + (c.ok ? "" : " disabled") + ">" +
        "Shore leave for " + apLabel(ap) + "</button>" +
        '<span class="cost">' + gold(N().lodgingCost(state, ap)) + " crew gold · crew morale +" + gain + "</span>" +
        (c.ok ? "" : '<span class="lock">' + esc(c.why) + "</span>") + "</li>";
    });
    // Gather Intelligence (§30.4)
    var gi = N().tavernServiceCheck(state, 1);
    html += "<li" + (gi.ok ? "" : ' class="locked"') + '><button data-act="gather"' + (gi.ok ? "" : " disabled") + ">Gather Intelligence <small>(1 action)</small></button>" +
      '<span class="cost">Ask around town. Clean: you pick what kind of rumor. Partial: one rumor.</span>' +
      (gi.ok ? checkLine(PC.checks.assess(state, PC.rumors.gatherCheck(state), { conditions: ["Harbor"] })) : '<span class="lock">' + esc(gi.why) + "</span>") + "</li>";
    html += comingSoon("Drink with a pirate (Under the Table)", 4, first ? "Not on your first visit" : null) +
      comingSoon("Liar's Dice", 4, first ? "Not on your first visit" : null) + "</ol>";
    if (state.location.gatherPick) {
      html += '<div class="svc"><h4>What do you want to hear about?</h4><div class="opts">' + PC.rumors.gatherTypes(state).map(function (t) {
        return '<button data-act="gatherpick" data-type="' + esc(t) + '">' + esc(t) + "</button>";
      }).join(" ") + "</div></div>";
    }
    html += officersBlock(first);
    return html;
  }

  // Officer recruitment (§25.7): two seats a season.
  function officersBlock(first) {
    var html = '<div class="svc"><h4>Officers looking for a berth</h4>';
    var chk = N().tavernServiceCheck(state, 0);
    if (!chk.ok) return html + '<p class="small muted">' + esc(chk.why) + ".</p></div>";
    var ap = PC.officers.apNeeded(state);
    html += '<p class="small">1,000 crew gold each' + (ap ? "; hiring takes an action (one action covers every hire this visit)" : "; this visit's action is already spent") + ".</p>";
    PC.officers.candidates(state).forEach(function (c) {
      var held = PC.officers.holding(state, c.type);
      var hc = PC.officers.hireCheck(state, c);
      html += '<div class="candidate"><p><b>' + esc(c.full || (c.first + " " + c.last)) + "</b>, " + c.age + " · " + esc(c.type) + (c.named ? " · Named officer" : "") + "</p>" +
        prose(PC.officers.hiringText(state, c)) +
        (held ? '<p class="small notice">Hiring ' + esc(c.first) + " replaces " + esc(held.first) + (held.mentor ? ", your mentor," : "") + " (your " + esc(held.type) + "), who is dismissed with " + PC.officers.dismissPay(state) + " crew gold.</p>" : "") +
        '<div class="actions"><button data-act="hire" data-officer="' + esc(c.id) + '"' + (hc.ok ? "" : " disabled") + ">Hire " + esc(c.first) + "</button>" +
        (hc.ok ? "" : '<span class="lock">' + esc(hc.why) + "</span>") + "</div></div>";
    });
    return html + "</div>";
  }

  // ---- Docks ----

  function docksMenu() {
    var id = N().here(state), sh = state.ship;
    var wright = N().slotNpc(id, "shipwright");
    var g = N().shipwrightGreeting(state);
    var html = "<h3>" + npcTag(wright) + "</h3>";
    if (!state.location.say) html += '<div class="say">' + esc(g.line) + "</div>";
    if (!g.refuse) {
      var missing = sh.hullMax - sh.hull;
      html += '<div class="svc"><h4>Repairs</h4><p class="small">Hull ' + sh.hull + " / " + sh.hullMax +
        (sh.rigging === "frayed" ? " · <b>frayed rigging</b> (Speed " + sh.speed + "; any repair fixes it)" : "") +
        " · " + gold(N().repairPerHp(state)) + " gold a point. A repair of " + Math.ceil(0.25 * sh.hullMax) + " points or more takes an action.</p>";
      if (missing > 0) {
        html += '<div class="buyrow">' + qtyBox("q-repair", missing, missing) +
          '<button data-act="repair" data-for="q-repair">Repair</button>' +
          '<button data-act="repair" data-all="1">Repair all: ' + gold(N().repairCost(state, missing)) + " gold" + (N().repairTakesAP(state, missing) ? ", 1 action" : "") + "</button></div>";
      } else html += '<p class="small muted">Nothing to fix.</p>';
      html += "</div>";
      html += '<div class="svc"><h4>Upgrades</h4><table class="grid"><tr><th>Track</th><th>Level</th><th>Next</th><th></th></tr>' +
        ["hull", "rigging", "guns"].map(function (t) {
          var u = N().upgradeInfo(state, t);
          return "<tr><td>" + esc(u.name) + "</td><td>" + u.level + "</td><td>" + (u.locked ? '<span class="muted small">' + esc(u.locked) + "</span>" : gold(u.cost) + ' gold<br><span class="small muted">' + esc(u.effect) + "</span>") + "</td>" +
            "<td>" + (u.locked ? "" : '<button data-act="upgrade" data-track="' + t + '">Buy level ' + u.next + "</button>") + "</td></tr>";
        }).join("") + "</table></div>";
      var room = sh.gunsMax - sh.guns;
      html += '<div class="svc"><h4>Guns</h4><p class="small">' + sh.guns + " of " + sh.gunsMax + " mounted · " + gold(N().gunPrice(state)) + " gold a gun.</p>" +
        (room > 0 ? '<div class="buyrow">' + qtyBox("q-guns", room, room) + '<button data-act="guns" data-for="q-guns">Buy guns</button></div>' : '<p class="small muted">Every gun port is full.</p>') +
        "</div>";
    }
    // Crew recruitment (§24.7)
    var avail = N().poolAvailable(state);
    var berths = PC.crew.berths(state);
    html += '<div class="svc"><h4>Hire hands</h4><p class="small">The ruined on the docks. ' + state.crew.count + " of " + sh.crewMax + " berths filled.</p>" +
      '<table class="grid"><tr><th>Tier</th><th>Waiting</th><th>Each</th><th></th></tr>' +
      PC.data.economy.TIER_ORDER.filter(function (t) { return avail[t] || (N().season(state).pool[t]); }).map(function (t) {
        var max = Math.min(avail[t], berths);
        return "<tr><td>" + t + "</td><td>" + avail[t] + "</td><td>" + gold(N().signingCost(state, t)) + "</td><td>" +
          (max > 0 ? '<div class="buyrow">' + qtyBox("q-hire-" + t, max, max) + '<button data-act="hire" data-tier="' + t + '" data-for="q-hire-' + t + '">Sign</button></div>' : '<span class="small muted">' + (avail[t] ? "No berths" : "None left") + "</span>") +
          "</td></tr>";
      }).join("") + "</table></div>";
    // Paying off hands
    var each = PC.crew.payOffEach(state);
    html += '<div class="svc"><h4>Pay off hands</h4><p class="small">Each leaves with half a share: ' + each + " crew gold. No hard feelings.</p>" +
      '<table class="grid">' + PC.data.economy.TIER_ORDER.filter(function (t) { return state.crew.tiers[t]; }).map(function (t) {
        return "<tr><td>" + t + "</td><td>" + state.crew.tiers[t] + ' aboard</td><td><div class="buyrow">' + qtyBox("q-off-" + t, 1, state.crew.tiers[t]) +
          '<button data-act="payoff" data-tier="' + t + '" data-for="q-off-' + t + '">Pay off</button></div></td></tr>';
      }).join("") + "</table></div>";
    return html;
  }

  // ---- Merchant ----

  function merchantMenu() {
    var id = N().here(state);
    var prov = N().slotNpc(id, "provisioner");
    var g = N().greeting(state, id, prov, "provisioner");
    var html = "<h3>" + npcTag(prov) + "</h3>";
    if (!state.location.say) html += '<div class="say">' + esc(g.line) + "</div>";
    if (!g.refuse) {
      var free = PC.crew.slotsFree(state);
      html += '<p class="small">Hold: ' + PC.crew.slotsUsed(state) + " of " + state.ship.cargo + " slots used.</p>";
      html += '<div class="svc"><h4>Provisions</h4><p class="small">' + gold(N().provisionsPrice(state)) + " gold a lot. One lot feeds 5 hands for an action at sea. Aboard: " + state.provisions + ".</p>" +
        (free > 0 ? '<div class="buyrow">' + qtyBox("q-prov", Math.min(free, 10), free) + '<button data-act="buyprov" data-for="q-prov">Buy provisions</button></div>' : '<p class="small muted">The hold is full.</p>') + "</div>";
      var stock = N().season(state).stock;
      html += '<div class="svc"><h4>For sale this season</h4><table class="grid"><tr><th>Goods</th><th>Left</th><th>Each</th><th></th></tr>' +
        Object.keys(stock).map(function (gname) {
          var max = Math.min(stock[gname], free);
          var info = PC.data.goods[gname];
          return "<tr><td>" + esc(gname) + (info && info.stores ? ' <span class="small muted">(crew stores)</span>' : "") + "</td><td>" + stock[gname] + "</td><td>" + gold(N().shopPrice(state, id, gname, prov)) + "</td><td>" +
            (max > 0 ? '<div class="buyrow">' + qtyBox("q-good-" + slug(gname), Math.min(max, 2), max) + '<button data-act="buygood" data-good="' + esc(gname) + '" data-for="q-good-' + slug(gname) + '">Buy</button></div>' : '<span class="small muted">' + (stock[gname] ? "No room" : "Sold out") + "</span>") +
            "</td></tr>";
        }).join("") + "</table></div>";
      html += sellTable("provisioner", "Sell to " + PC.npcs.get(state, prov).first, N().provisionerCapLeft(state), "clean");
      if (hasCargo("dirty")) html += '<ol class="choices"><li><button data-act="offerdirty">Offer ' + esc(PC.npcs.get(state, prov).first) + " dirty goods</button></li></ol>";
    }
    if (N().fenceOpen(state)) {
      var f = N().nodeData(id).fence;
      var fg = N().greeting(state, id, f.npc, "fence");
      html += "<h3>" + npcTag(f.npc) + "</h3>" + '<p class="small muted">' + esc(fg.line) + "</p>";
      if (!fg.refuse) {
        html += sellTable("fence", "Sell dirty goods", N().fenceCapLeft(state), "dirty") + '<ol class="choices">';
        if (!state.flags.bobby_french_heard) html += '<li><button data-act="askfrench">Ask about the French</button></li>';
        if (hasCargo("clean")) html += '<li><button data-act="offerclean">Offer him clean goods</button></li>';
        html += "</ol>";
      }
    }
    return html;
  }

  function hasCargo(kind) {
    if (state.cargo.treasure[kind]) return true;
    return Object.keys(state.cargo.goods).some(function (g) { return state.cargo.goods[g][kind]; });
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  function sellTable(buyer, title, capLeft, kind) {
    var rows = [];
    if (state.cargo.treasure[kind]) rows.push({ what: "treasure", label: (kind === "dirty" ? "Dirty " : "") + "Treasure", have: state.cargo.treasure[kind] });
    Object.keys(state.cargo.goods).forEach(function (g) {
      var n = state.cargo.goods[g][kind];
      if (n) rows.push({ what: g, label: (kind === "dirty" ? "Dirty " : "") + g, have: n });
    });
    var html = '<div class="svc"><h4>' + esc(title) + '</h4><p class="small">' + (buyer === "fence" ? "Buys dirty treasure and goods only." : "Buys clean treasure and goods only.") +
      " Can pay " + gold(capLeft) + " more gold this season.</p>";
    if (!rows.length) return html + '<p class="small muted">Nothing aboard ' + (buyer === "fence" ? "for him" : "to sell here") + ".</p></div>";
    return html + '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Pays</th><th></th></tr>' + rows.map(function (r) {
      var id = "q-sell-" + buyer + "-" + slug(r.what);
      return "<tr><td>" + esc(r.label) + "</td><td>" + r.have + "</td><td>" + gold(N().unitPrice(state, buyer, r.what)) + "</td><td>" +
        '<div class="buyrow">' + qtyBox(id, r.have, r.have) + '<button data-act="sell" data-buyer="' + buyer + '" data-what="' + esc(r.what) + '" data-for="' + id + '">Sell</button></div></td></tr>';
    }).join("") + "</table></div>";
  }

  // ---- Lilyhook's Graveyard ----

  function graveyardMenu() {
    var o = PC.npcs.get(state, "ollie");
    var lines = { "-1": "\"I hope you're a strong swimmer.\"", "0": "\"Back for another dive?\"", "1": "\"I dreamed that you're in for a good haul today.\"", "2": "\"I dreamed that you're in for a good haul today.\"", "3": "\"The treasure-seeker returns!\"" };
    return "<h3>" + npcTag("ollie") + "</h3>" + '<div class="say">' + esc(lines[String(Math.max(-1, o.rung))] || lines["0"]) + "</div>" +
      '<ol class="choices">' + comingSoon("Dive the wrecks", 4) + "</ol>";
  }

  // ---- The Ship layer (§17.1) ----

  var SHIP_TABS = [["articles", "Articles"], ["crew", "Crew"], ["officers", "Officers"], ["cargo", "Cargo"], ["captain", "Captain"], ["journal", "Journal"]];

  function shipMenu() {
    var tab = state.location.tab || (state.articles ? "crew" : "articles");
    var html = '<div class="tabs">' + SHIP_TABS.map(function (t) {
      return '<button data-act="shiptab" data-tab="' + t[0] + '" class="' + (t[0] === tab ? "on" : "") + '">' + t[1] + "</button>";
    }).join("") + '<button disabled title="Not in the prototype">World Map' + (state.articles ? "" : " 🔒") + "</button></div>";
    html += ({ articles: articlesTab, crew: crewTab, officers: officersTab, cargo: cargoTab, captain: captainTab, journal: journalTab })[tab]();
    return html;
  }

  var articleDraft = null;

  function articlesTab() {
    var A = PC.data.articles;
    if (!state.articles) {
      articleDraft = articleDraft || PC.articles.defaults();
      var g = PC.articles.greed(articleDraft);
      var rd = PC.articles.readingFor(g);
      var rep = PC.articles.reputation(g);
      var html = '<p class="small">You set the terms; the crew holds you to every word. The Standard terms are fair and take one click. Signing costs no action.</p>';
      html += A.SLOTS.map(function (s) {
        return '<div class="svc"><h4>' + esc(s.name) + (s.noGreed ? ' <span class="small muted">(no Greed; change any time)</span>' : "") + "</h4>" +
          '<div class="opts">' + s.options.map(function (o) {
            var on = articleDraft[s.id] === o.id;
            return '<button class="opt' + (on ? " on" : "") + '" data-act="artpick" data-slot="' + s.id + '" data-opt="' + o.id + '"><b>' + esc(o.label) + "</b>" +
              '<span class="small">' + esc(o.text) + (o.greed ? " · Greed " + (o.greed > 0 ? "+" : "") + o.greed : "") + "</span></button>";
          }).join("") + "</div></div>";
      }).join("");
      var check = rd.dr != null ? PC.checks.assess(state, { type: "Pirate Code", dr: rd.dr }) : null;
      html += '<div class="svc"><p>Net Greed <b>' + (g > 0 ? "+" : "") + g + "</b> · reputation <b>" + esc(rep.name) + "</b>" +
        (rep.pool !== 1 ? " (crew pools " + (rep.pool > 1 ? "+" : "") + Math.round((rep.pool - 1) * 100) + "%)" : "") + "</p>" +
        (rd.cheer ? '<p class="small">The crew will cheer: morale +' + rd.cheer + ".</p>" : rd.dr == null ? '<p class="small">The crew will accept these terms.</p>' :
          '<p class="small">Hard terms: you\'ll read them out with a Pirate Code check.</p>' + checkLine(check)) +
        '<div class="actions"><button class="primary" data-act="artsign">Sign the Articles</button></div></div>';
      return html;
    }
    var html2 = '<p class="small">Signed ' + esc(PC.state.SEASONS[state.articles.signed.season]) + " " + state.articles.signed.year +
      " · net Greed " + (state.articles.greed > 0 ? "+" : "") + state.articles.greed + " · " + esc(PC.articles.currentReputation(state).name) +
      ". You can loosen a term any time (+3 morale); harder terms wait for the next split.</p>";
    html2 += A.SLOTS.map(function (s) {
      return '<div class="svc"><h4>' + esc(s.name) + "</h4>" + '<div class="opts">' + s.options.map(function (o) {
        var on = state.articles.terms[s.id] === o.id;
        var c = on ? null : PC.articles.amendCheck(state, s.id, o.id);
        return '<button class="opt' + (on ? " on" : "") + '"' + (on || !c.ok ? " disabled" : "") + ' data-act="artamend" data-slot="' + s.id + '" data-opt="' + o.id + '"><b>' + esc(o.label) + "</b>" +
          '<span class="small">' + esc(o.text) + (c && c.ok && c.morale ? " · +" + c.morale + " morale" : "") + "</span>" +
          (c && !c.ok ? '<span class="small lock">' + esc(c.why) + "</span>" : "") + "</button>";
      }).join("") + "</div></div>";
    }).join("");
    return html2;
  }

  function crewTab() {
    var c = state.crew, C = PC.crew;
    var html = '<table class="ledger wide">' +
      row("Hands", c.count + " of " + state.ship.crewMax + (c.wounded ? " · " + c.wounded + " wounded" : "")) +
      row("By tier", PC.data.economy.TIER_ORDER.filter(function (t) { return c.tiers[t]; }).map(function (t) { return c.tiers[t] + " " + t; }).join(", ")) +
      row("Morale", c.morale + " · " + C.band(c.morale)) +
      row("Skill · Discipline", C.skill(state) + " · " + C.discipline(state) + (c.raw > 0.25 * c.count ? ' <span class="small muted">(raw hands this season: -1)</span>' : "")) +
      row("Crew Rating", C.crewRating(state)) +
      row("Guns drilled", C.drilled(state) ? "Yes" : "No") +
      row("Crew gold · your purse", gold(state.money.crew) + " · " + gold(state.money.purse)) +
      row("One share", gold(Math.round(C.oneShare(state))) + " crew gold") +
      "</table>";
    var rallyUsed = C.usedThisSeason(state, "rally"), drillUsed = C.usedThisSeason(state, "drill");
    html += '<ol class="choices">' +
      "<li" + (rallyUsed || !state.ap.left ? ' class="locked"' : "") + '><button data-act="rally"' + (rallyUsed || !state.ap.left ? " disabled" : "") + ">Rally the crew <small>(1 action)</small></button>" +
        '<span class="cost">Morale +5 on a partial, +10 on a clean result. Once a season.</span>' + (rallyUsed ? '<span class="lock">Done this season</span>' : checkLine(PC.checks.assess(state, C.rallyCheck(state)))) + "</li>" +
      "<li" + (drillUsed || !state.ap.left ? ' class="locked"' : "") + '><button data-act="drill"' + (drillUsed || C.skill(state) >= 2 || !state.ap.left ? " disabled" : "") + ">Drill the guns <small>(1 action)</small></button>" +
        '<span class="cost">' + (C.skill(state) >= 2 ? "Your hands are already drilled." : "The crew count as drilled (+1 Gunnery) for the rest of the season.") + "</span>" + (drillUsed ? '<span class="lock">Done this season</span>' : "") + "</li>";
    var ex = C.canMakeExample(state);
    html += "<li" + (ex.ok ? "" : ' class="locked"') + '><button data-act="example"' + (ex.ok ? "" : " disabled") + ">Make an example of a troublemaker</button>" +
      (ex.ok ? checkLine(PC.checks.assess(state, { type: "Discipline", dr: 2 })) : '<span class="lock">' + esc(ex.why) + "</span>") + "</li></ol>";
    html += '<div class="svc"><h4>Give to the crew</h4><p class="small">Move gold from your purse into crew gold: +1 morale for every 5 gold a head (at most +10 a gift, +15 a season).</p>' +
      (state.money.purse > 0 ? '<div class="buyrow">' + qtyBox("q-give", Math.min(state.money.purse, c.count * 5 * 2), state.money.purse) + '<button data-act="give" data-for="q-give">Give</button></div>' : '<p class="small muted">Your purse is empty.</p>') + "</div>";
    html += '<div class="svc"><h4>Rationing</h4><p class="small">' + (c.rationing ? "On: provisions burn 25% slower, and a Ration Stores check each season sets the cost to morale." : "Off.") + "</p>" +
      '<button data-act="rationing">' + (c.rationing ? "Lift rationing" : "Order rationing") + "</button></div>";
    return html;
  }

  function officersTab() {
    var list = (state.officers || []).filter(function (o) { return !o.gone; });
    if (!list.length) return '<p class="muted">No officers aboard.</p>';
    return list.map(function (o) { return mentorCard(o); }).join("") +
      '<p class="small muted">Officers are hired at the Tavern: 1,000 crew gold each, one action a visit. One of each type; a new hire of a type you hold replaces the old one.</p>';
  }

  function cargoTab() {
    var html = '<p>Hold: <b>' + PC.crew.slotsUsed(state) + " of " + state.ship.cargo + "</b> slots used. Treasure packs five units to a slot.</p>";
    var rows = [{ what: "provisions", label: "Provisions lots", n: state.provisions, dirty: false }];
    ["clean", "dirty"].forEach(function (k) { if (state.cargo.treasure[k]) rows.push({ what: "treasure", label: (k === "dirty" ? "Dirty" : "Clean") + " treasure", n: state.cargo.treasure[k], dirty: k === "dirty" }); });
    Object.keys(state.cargo.goods).forEach(function (g) {
      ["clean", "dirty"].forEach(function (k) { var n = state.cargo.goods[g][k]; if (n) rows.push({ what: g, label: (k === "dirty" ? "Dirty " : "") + g, n: n, dirty: k === "dirty" }); });
    });
    html += '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Jettison</th></tr>' + rows.map(function (r, i) {
      return "<tr><td>" + esc(r.label) + "</td><td>" + r.n + "</td><td>" + (r.n ? '<div class="buyrow">' + qtyBox("q-jet-" + i, 1, r.n) +
        '<button data-act="jettison" data-what="' + esc(r.what) + '" data-dirty="' + (r.dirty ? 1 : 0) + '" data-for="q-jet-' + i + '">Over the side</button></div>' : "") + "</td></tr>";
    }).join("") + "</table>";
    var used = PC.crew.usedThisSeason(state, "stores");
    var choices = PC.crew.storeChoices(state);
    html += '<div class="svc"><h4>Open the stores</h4><p class="small">Once a season: ' + PC.crew.storesNeeded(state) + " units of drink or tobacco for your " + state.crew.count + " hands.</p>" +
      (used ? '<p class="small muted">Opened this season.</p>' : !choices.length ? '<p class="small muted">Not enough drink or tobacco aboard. Kill-devil is cheap at the Merchant.</p>' :
        choices.map(function (c) { return '<button data-act="stores" data-good="' + esc(c.good) + '">Open the ' + esc(c.good.toLowerCase()) + " (+" + c.morale + " morale)</button> "; }).join("")) + "</div>";
    return html;
  }

  function captainTab() {
    var c = state.captain;
    var training = Object.keys(c.training || {}).map(function (t) { return esc(t) + " +" + c.training[t]; }).join(", ") || "None";
    var sh = state.ship;
    return '<table class="ledger wide">' +
      row("Captain", esc((c.first + " " + c.last).trim()) + ", age " + c.age) +
      row("Traits", esc((c.traits || []).join(", ") || "None") + (c.flaws && c.flaws.length ? "; flaw: " + esc(c.flaws.join(", ")) : "")) +
      row("Training", training) +
      row("Tags", esc((c.tags || []).join(", ") || "None")) +
      row("Items", esc((c.items || []).join(", ") || "None")) +
      row("Ship", esc(sh.type) + " <i>" + esc(sh.name) + "</i>") +
      row("Hull · Speed", sh.hull + " / " + sh.hullMax + " · " + sh.speed + (sh.rigging === "frayed" ? " (frayed rigging)" : "")) +
      row("Upgrades", "Hull " + sh.upgrades.hull + " · Rigging " + sh.upgrades.rigging + " · Guns " + sh.upgrades.guns) +
      row("Guns · crew", sh.guns + " / " + sh.gunsMax + " · " + state.crew.count + " / " + sh.crewMax + " (at least " + sh.crewMin + " to sail)") +
      "</table>" + '<p class="small muted">Equipping items and clothing comes with the UI chat.</p>';
  }

  // The journal (placeholder until the UI chat, §30.12): quests and their
  // leads, then the live rumors by type.
  function journalTab() {
    var html = '<p class="small muted">A placeholder journal: the UI chat designs the real one.</p>';
    var q = PC.quests.journal(state);
    html += q.length ? q.map(function (j) {
      return '<div class="svc"><h4>' + esc(j.name) + ' <span class="small muted">' + j.leads + " of " + j.needed + " leads</span></h4>" + prose(j.summary) +
        (j.entries.length ? "<ul>" + j.entries.map(function (e) { return "<li>" + prose(e).replace(/^<p>|<\/p>$/g, "") + "</li>"; }).join("") + "</ul>" : "") +
        (j.beyond ? "<p><i>" + esc(j.beyond) + "</i></p>" : "") + "</div>";
    }).join("") : '<p class="muted">No quests yet.</p>';
    var live = PC.rumors.liveRumors(state);
    var types = {};
    live.forEach(function (r) { (types[r.type] = types[r.type] || []).push(r); });
    html += '<div class="svc"><h4>Rumors</h4>' + (live.length ? Object.keys(types).map(function (t) {
      return "<p><b>" + esc(t) + "</b></p><ul>" + types[t].map(function (r) {
        return "<li>" + prose(r.text).replace(/^<p>|<\/p>$/g, "") + ' <span class="small muted">(' + esc(r.source) + (r.expires != null ? "; good until the end of " + esc(PC.state.SEASONS[r.expires % 4]) + " " + Math.floor(r.expires / 4) : "") + ")</span></li>";
      }).join("") + "</ul>";
    }).join("") : '<p class="muted">Nothing heard yet.</p>') + "</div>";
    return html;
  }

  // ---- The arrival popup ----

  function popupHtml() {
    var p = state.location && state.location.popup;
    if (!p) return "";
    return '<div class="modal"><div class="panel"><h2>' + esc(p.title) + "</h2>" +
      "<ul>" + p.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
      '<div class="actions"><button class="primary" data-act="closepopup">Continue</button></div></div></div>';
  }

  function qty(el) {
    var box = el.dataset.for ? document.getElementById(el.dataset.for) : null;
    var n = box ? Math.floor(Number(box.value)) : 1;
    if (!(n > 0)) throw new Error("Enter a number above zero.");
    return n;
  }

  function enterPlace(place) {
    var fire = N().enter(state, place);
    if (place === "tavern" && !state.flags[N().FLAGS.tavernDone]) {
      var k = PC.npcs.get(state, N().slotNpc(N().here(state), "keeper"));
      say(null, "This is your first visit to the Tavern. Ask " + k.first + " for rumors" + (N().oneArmedHere(state) ? ", talk to the one-armed pirate" : "") + ", or leave; the rest opens once your first visit is done.");
    }
    if (fire) PC.scenes.enterScene(state, fire);
  }

  var nodeHandlers = {
    "goplace": function (el) { enterPlace(el.dataset.place); },
    "leaveplace": function () {
      var fire = N().leave(state);
      if (fire) PC.scenes.enterScene(state, fire);
    },
    "rumors": function () {
      var id = N().slotNpc(N().here(state), "keeper");
      var g = N().talkToKeeper(state);
      var r = PC.rumors.askKeeper(state);
      var who = PC.npcs.get(state, id).first + ":";
      if (r.refuse) { say(who, r.line); return; }
      var heard = r.rumors.map(function (x) { return x.text; });
      if (r.extra) heard.push(r.extraLine + " " + r.extra.text);
      say(who, g.line, "Tavern Talk: " + { clean: "clean, one more rumor", partial: "partial", setback: "setback" }[r.talk.outcome] + "." + (state.settings.showDice ? " (Dice " + r.talk.dice.join(" + ") + ", edge " + r.talk.edge + ")" : ""), heard);
    },
    "nextqueued": function () {
      var next = N().nextQueued(state);
      state.location.say = null;
      if (next) PC.scenes.enterScene(state, next);
    },
    "oneArmed": function () {
      N().tavernActionDone(state); // the first Tavern action (§17.2)
      PC.scenes.enterScene(state, "ocr_oap");
    },
    "gather": function () {
      var r = PC.rumors.gather(state);
      var heard = [];
      if (r.lead) heard.push(r.lead);
      if (r.rumor) heard.push(r.rumor.text);
      say(null, { clean: "You ask around town, and people talk.", partial: "You ask around town and pick up a rumor.", setback: "You ask around town, but nobody tells you anything. They do notice you asking." }[r.outcome],
        "Gather Intelligence: " + r.outcome + "." + (r.pick && r.pick.length ? " Pick what you want to hear about." : ""), heard);
    },
    "gatherpick": function (el) {
      var r = PC.rumors.gatherPick(state, el.dataset.type);
      var prev = state.location.say || {};
      say(prev.who, prev.line, null, (prev.heard || []).concat(r ? [r.text] : []));
    },
    "hire": function (el) {
      var r = PC.officers.hire(state, el.dataset.officer);
      var o = r.officer;
      var note = (r.replaced ? r.replaced.officer.first + " is dismissed with " + r.replaced.pay + " crew gold: " + r.replaced.line + " " : "") +
        (r.mentorLine ? "[Mentor]: " + r.mentorLine : "");
      say(null, (o.first + " " + (o.last || "")).trim() + " signs on as your " + o.type + ".", PC.text.render(note, state) || null);
    },
    "askfrench": function () { say("Bobby:", PC.rumors.askFrench(state), "A lead for your journal: the Hidden Haven (1 of 2)."); },
    "offerclean": function () { say("Bobby:", N().nodeData(N().here(state)).lines.fence.offeredClean); },
    "offerdirty": function () { var prov = N().slotNpc(N().here(state), "provisioner"); say(PC.npcs.get(state, prov).first + ":", N().nodeData(N().here(state)).lines.provisioner.dirty); },
    "lodging": function (el) {
      var r = N().lodging(state, Number(el.dataset.ap));
      say(PC.npcs.get(state, N().slotNpc(N().here(state), "keeper")).first + ":", r.line, "Crew morale +" + r.morale + ".");
    },
    "repair": function (el) {
      var hp = el.dataset.all ? state.ship.hullMax - state.ship.hull : qty(el);
      var r = N().repair(state, hp);
      say(PC.npcs.get(state, N().slotNpc(N().here(state), "shipwright")).first + ":", r.line, r.fixedRigging ? "The frayed rigging is fixed: Speed " + state.ship.speed + "." : null);
    },
    "upgrade": function (el) { var r = N().upgrade(state, el.dataset.track); say(PC.npcs.get(state, N().slotNpc(N().here(state), "shipwright")).first + ":", r.line); },
    "guns": function (el) { var r = N().buyGuns(state, qty(el)); say(PC.npcs.get(state, N().slotNpc(N().here(state), "shipwright")).first + ":", r.line); },
    "hire": function (el) { var r = N().recruit(state, el.dataset.tier, qty(el)); say(null, r.line, r.n ? r.n + " hands for " + gold(r.cost) + " crew gold." : null); },
    "payoff": function (el) { var r = N().payOff(state, el.dataset.tier, qty(el)); say(null, r.line, gold(r.cost) + " crew gold."); },
    "buyprov": function (el) { var r = N().buyProvisions(state, qty(el)); say(PC.npcs.get(state, N().slotNpc(N().here(state), "provisioner")).first + ":", r.line, r.cost ? gold(r.cost) + " crew gold." : null); },
    "buygood": function (el) { var r = N().buyGood(state, el.dataset.good, qty(el)); say(PC.npcs.get(state, N().slotNpc(N().here(state), "provisioner")).first + ":", r.line, r.cost ? gold(r.cost) + " crew gold." : null); },
    "sell": function (el) {
      var r = N().sell(state, el.dataset.buyer, el.dataset.what, qty(el));
      var who = el.dataset.buyer === "fence" ? N().nodeData(N().here(state)).fence.npc : N().slotNpc(N().here(state), "provisioner");
      say(PC.npcs.get(state, who).first + ":", r.line, r.units ? "Sold " + r.units + " for " + gold(r.gold) + " crew gold." : null,
        r.rumor ? [r.rumor.leadIn + " " + r.rumor.rumor.text] : null);
    },
    "shiptab": function (el) { state.location.tab = el.dataset.tab; state.location.say = null; },
    "artpick": function (el) { articleDraft[el.dataset.slot] = el.dataset.opt; },
    "artsign": function () {
      var r = PC.articles.sign(state, articleDraft || PC.articles.defaults());
      articleDraft = null;
      var text = { accepted: "The crew file up and put their names to it.", cheered: "The crew cheer as they sign.", clean: "You read the terms out and the crew sign without a murmur.", partial: "The crew sign, but there's grumbling.", setback: "The crew sign with sour faces." }[r.outcome];
      say(null, text, r.effects.length ? r.effects.join(", ") + "." : null);
      state.location.tab = "articles";
    },
    "artamend": function (el) { var c = PC.articles.amend(state, el.dataset.slot, el.dataset.opt); say(null, "The change is read out to the crew.", c.morale ? "Crew morale +" + c.morale + "." : null); },
    "rally": function () { var r = PC.crew.rally(state); say(null, { clean: "The men roar back at you.", partial: "A few cheers, and some nods.", setback: "The speech falls flat." }[r.outcome], r.gain ? "Crew morale +" + r.gain + "." : null); },
    "drill": function () { PC.crew.drill(state); say(null, "The guns run in and out until the crew can do it in their sleep.", "Drilled for the rest of the season."); },
    "example": function () { var r = PC.crew.makeExample(state, "Discipline"); say(null, "You make an example of a troublemaker: " + r.outcome + "."); },
    "give": function (el) { var m = PC.crew.give(state, qty(el)); say(null, "The gold goes into the crew's chest.", m ? "Crew morale +" + m + "." : "No change in morale."); },
    "rationing": function () { PC.crew.toggleRationing(state); },
    "jettison": function (el) { PC.crew.jettison(state, el.dataset.what, qty(el), el.dataset.dirty === "1"); },
    "stores": function (el) { var m = PC.crew.openStores(state, el.dataset.good); say(null, "The crew drink to your health.", "Crew morale +" + m + "."); },
    "closepopup": function () { state.location.popup = null; },
  };

  // ---- Developer panel -------------------------------------------------

  function devPanel() {
    var v = PC.validate(state);
    var list = function (arr) { return arr.length ? "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>None.</p>"; };
    return '<div class="modal" data-act="closedev"><div class="panel" onclick="event.stopPropagation()">' +
      "<h2>Developer</h2>" +
      '<label><input type="checkbox" data-act="toggledice"' + (state.settings.showDice ? " checked" : "") + "> Show the dice on results</label>" +
      '<label><input type="checkbox" data-act="togglegender"' + (state.captain.gender === "f" ? " checked" : "") + "> Woman captain (tests the pronoun swap)</label>" +
      '<div class="actions"><button data-act="addap">+1 action</button><button data-act="fillap">Top up actions</button><button data-act="tohub">Back to the town menu</button></div>' +
      (state.location ? '<h3>Testing Ocracoke</h3><div class="actions">' +
        '<button data-act="devgold">+500 crew gold</button><button data-act="devpurse">+500 purse</button>' +
        '<button data-act="devtreasure" data-dirty="0">+10 clean treasure</button><button data-act="devtreasure" data-dirty="1">+10 dirty treasure</button>' +
        '<button data-act="devdamage">Damage the hull (-5)</button>' +
        '<button data-act="devarrive">Return from a hunt (4 wounded): the arrival popup</button></div>' +
        '<h3>Testing Milestone 3</h3><p class="small">Loss variant: ' + ["A", "B", "C"].map(function (v) {
          return '<button data-act="devloss" data-loss="' + v + '"' + (state.captain.loss === v ? ' class="primary"' : "") + ">" + v + "</button>";
        }).join(" ") + ' · Frisian posture: ' + PC.state.POSTURES.map(function (p) {
          return '<button data-act="devposture" data-posture="' + p + '"' + (state.world.posture === p ? ' class="primary"' : "") + ">" + p + "</button>";
        }).join(" ") + "</p>" +
        '<p class="small">Jump to a scene: <select class="devscene">' + Object.keys(PC.data.scenes).filter(function (id) { return id.indexOf("ocr_") === 0; }).map(function (id) {
          return '<option value="' + esc(id) + '">' + esc(id) + "</option>";
        }).join("") + '</select> <button data-act="devjump">Go</button> <button data-act="devnewseason">Start the next season</button></p>' +
        '<p class="small muted">Ocracoke\'s people this world: ' + N().nodeData(N().here(state)).slots.map(function (sl) { var g = state.generated[sl.id]; return esc(sl.label + ": " + g.full + " (" + (g.gender === "f" ? "woman" : "man") + ", " + g.age + "; " + g.traits.join(", ") + ")"); }).join(" · ") + "</p>" : "") +
      '<p class="small muted">World seed: ' + esc(state.world.seed) + " · save version " + state.saveVersion + "</p>" +
      "<h3>Content check</h3><p><b>Errors</b></p>" + list(v.errors) + "<p><b>Warnings</b></p>" + list(v.warnings) +
      '<div class="actions"><button data-act="closedev" class="primary">Close</button></div>' +
      "</div></div>";
  }

  // ---- Save files (in-page dialogs: some hosts block downloads and pop-ups) ----

  function saveFileName() {
    var c = state.captain;
    return "pirate-chronicle-" + (c.first + "-" + c.last).toLowerCase().replace(/[^a-z0-9]+/g, "-") +
      "-" + PC.state.seasonName(state).toLowerCase() + "-" + state.time.year + ".json";
  }

  function downloadSave() {
    try {
      var blob = new Blob([PC.state.serialize(state)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = saveFileName();
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      toast("Save file downloaded. (If nothing appeared, use Copy instead.)");
    } catch (e) { toast("Downloads are blocked here. Use Copy instead."); }
  }

  function copySave() {
    var text = PC.state.serialize(state);
    var done = function () { toast("Save copied. Paste it into a text file to keep it."); };
    try {
      navigator.clipboard.writeText(text).then(done, function () { selectSaveText(); });
    } catch (e) { selectSaveText(); }
  }

  function selectSaveText() {
    var ta = document.querySelector(".savetext");
    if (ta) { ta.focus(); ta.select(); }
    toast("Select all the text in the box and copy it.");
  }

  function loadSaveText(text) {
    try {
      state = PC.state.deserialize(String(text).trim());
      PC.state.saveToBrowser(state);
      dialog = null;
      toast("Save loaded.");
    } catch (e) { toast("Couldn't load that save: " + e.message); }
    draw();
  }

  function pickSaveFile(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { loadSaveText(reader.result); };
    reader.readAsText(f);
  }

  function dialogHtml() {
    if (dialog === "export") {
      return '<div class="modal" data-act="closedialog"><div class="panel" onclick="event.stopPropagation()">' +
        "<h2>Save file</h2><p>Keep your game outside this browser. Download it, or copy it and paste it into a text file.</p>" +
        '<textarea class="savetext" readonly>' + esc(PC.state.serialize(state)) + "</textarea>" +
        '<div class="actions"><button data-act="download" class="primary">Download</button><button data-act="copy">Copy</button><button data-act="closedialog">Close</button></div>' +
        "</div></div>";
    }
    if (dialog === "import") {
      return '<div class="modal" data-act="closedialog"><div class="panel" onclick="event.stopPropagation()">' +
        "<h2>Load a save</h2><p>Choose a save file, or paste a copied save into the box.</p>" +
        '<p><input type="file" accept=".json,.txt,application/json,text/plain" data-act="pickfile"></p>' +
        '<textarea class="savetext pastebox" placeholder="Paste a save here"></textarea>' +
        '<div class="actions"><button data-act="loadpasted" class="primary">Load pasted save</button><button data-act="closedialog">Cancel</button></div>' +
        "</div></div>";
    }
    if (dialog === "confirmnew") {
      return '<div class="modal" data-act="closedialog"><div class="panel" onclick="event.stopPropagation()">' +
        "<h2>Start a new game?</h2><p>The game saved in this browser will be replaced. Use Save file first if you want to keep it.</p>" +
        '<div class="actions"><button data-act="newconfirmed" class="primary">Start a new game</button><button data-act="closedialog">Cancel</button></div>' +
        "</div></div>";
    }
    return "";
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  // ---- The character creator (§12) --------------------------------------
  // The rules are in js/creator.js; this only draws the steps. The draft is
  // kept in the browser too, so a refresh doesn't lose a half-made captain.

  var creating = false;
  var draft = null;
  var stepIndex = 0;
  var DRAFT_KEY = "pirate-chronicle-draft";

  function saveDraft() {
    try { globalThis.localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: draft, step: stepIndex })); } catch (e) { /* ignore */ }
  }
  function loadDraft() {
    try { var t = globalThis.localStorage.getItem(DRAFT_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function clearDraft() { try { globalThis.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  function startCreator() {
    var saved = loadDraft();
    draft = saved && saved.draft ? saved.draft : PC.creator.blankDraft();
    stepIndex = saved && typeof saved.step === "number" ? saved.step : 0;
    creating = true;
  }

  function stepId() { return PC.creator.STEPS[stepIndex].id; }

  // Read and write "mentor.first"-style paths on the draft.
  function getField(path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, draft);
  }
  function setField(path, value) {
    var keys = path.split("."), o = draft;
    for (var i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }

  function drawCreator() {
    var C = PC.creator;
    var steps = C.STEPS.map(function (s, i) {
      var done = s.id === "review" ? !C.allErrors(draft).length : !C.stepErrors(draft, s.id).length;
      return '<li class="' + (i === stepIndex ? "on " : "") + (done ? "done" : "") + '">' +
        '<button data-act="gostep" data-i="' + i + '">' + (i + 1) + ". " + esc(s.title) + "</button></li>";
    }).join("");
    var errs = C.stepErrors(draft, stepId());
    var last = stepIndex === C.STEPS.length - 1;
    root.innerHTML =
      '<div class="game creator">' +
      '<header class="topbar"><span class="brand">Pirate Chronicle</span><span class="when">A new captain</span>' +
      '<span class="spacer"></span><button data-act="surprise" title="Fill every step at random">Surprise me</button>' +
      '<button data-act="resetdraft">Start over</button><button data-act="quit">Title</button></header>' +
      '<ol class="steps">' + steps + "</ol>" +
      '<div class="creator-body"><main class="stage">' + '<section class="cstep cstep-' + stepId() + '">' +
      "<h2>" + esc(C.STEPS[stepIndex].title) + "</h2>" + creatorStep() + "</section>" +
      '<div class="actions step-nav">' +
      (stepIndex > 0 ? '<button data-act="back">Back</button>' : "") +
      (last ? "" : '<button data-act="next" class="primary">Next</button>') +
      "</div>" +
      (errs.length && !last ? '<ul class="todo">' + errs.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" : "") +
      "</main>" + '<aside class="preview">' + previewCard() + "</aside></div></div>";
    wire();
  }

  // The live captain card beside every step.
  function previewCard() {
    var C = PC.creator;
    var b = C.band(draft.age);
    var pic = draft.portraitSet && b ? C.portraitPath(draft.portraitSet, b.band, false) : null;
    var name = (String(draft.first || "") + " " + String(draft.last || "")).trim() || "Your captain";
    var bits = [];
    if (b) bits.push("Age " + draft.age);
    if (draft.homeCity) bits.push("Ash-Born of " + draft.homeCity);
    if (draft.profession) bits.push("once " + aOrAn(draft.profession.toLowerCase()));
    var loss = C.lossById(draft.loss);
    var stats = PC.checks.STATS.map(function (s) { return '<span class="stat"><b>' + draft.stats[s] + "</b>" + esc(s) + "</span>"; }).join("");
    var tags = ["Ash-Born"].concat(loss ? [loss.tag] : [], draft.tags, draft.debuffs);
    return (pic ? '<img class="preview-portrait" src="' + assetUrl(pic) + '" alt="">' : '<div class="preview-portrait empty">No portrait yet</div>') +
      "<h3>" + esc(name) + "</h3>" +
      '<p class="small muted">' + esc(bits.join(" · ")) + "</p>" +
      '<div class="stats">' + stats + "</div>" +
      (draft.traits.length || draft.flaw ? '<p class="small"><b>Traits:</b> ' + esc(draft.traits.concat(draft.flaw ? ["flaw: " + draft.flaw] : []).join(", ")) + "</p>" : "") +
      '<p class="small"><b>Tags:</b> ' + esc(tags.join(", ")) + "</p>" +
      (draft.shipName ? '<p class="small"><b>Ship:</b> <i>' + esc(draft.shipName) + "</i></p>" : "");
  }

  function creatorStep() {
    switch (stepId()) {
      case "identity": return stepIdentity();
      case "portrait": return stepPortrait();
      case "origin": return stepOrigin();
      case "stats": return stepStats();
      case "training": return stepTraining();
      case "character": return stepCharacter();
      case "tags": return stepTags();
      case "mentor": return stepMentor();
      case "ship": return stepShip();
      default: return stepReview();
    }
  }

  function textField(label, path, opts) {
    opts = opts || {};
    return '<label class="field"><span>' + esc(label) + "</span>" +
      '<input type="' + (opts.type || "text") + '" data-field="' + path + '" value="' + esc(getField(path)) + '"' +
      (opts.max ? ' maxlength="' + opts.max + '"' : "") + (opts.min != null ? ' min="' + opts.min + '"' : "") +
      (opts.maxNum != null ? ' max="' + opts.maxNum + '"' : "") + (opts.redraw ? ' data-redraw="1"' : "") +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "") + "></label>";
  }

  // A pickable card. `act` is pick (one value) or toggle (a list).
  function card(act, field, value, title, body, opts) {
    opts = opts || {};
    var on = act === "pick" ? getField(field) === value : (getField(field) || []).indexOf(value) >= 0;
    var blocked = !on && (opts.blocked || opts.full);
    return '<button class="card' + (on ? " on" : "") + (blocked ? " blocked" : "") + '" data-act="' + act + '" data-field="' + field + '" data-value="' + esc(value) + '"' +
      (opts.max ? ' data-max="' + opts.max + '"' : "") + (blocked ? " disabled" : "") + (act === "toggle" || act === "pick" ? ' aria-pressed="' + on + '"' : "") + ">" +
      "<b>" + esc(title) + "</b>" + (body ? '<span class="small">' + esc(body) + "</span>" : "") +
      (!on && opts.blocked ? '<span class="small lock">' + esc(opts.blocked) + "</span>" : "") + "</button>";
  }

  function stepIdentity() {
    var b = PC.creator.band(draft.age);
    var bandNote = b ? "Ages " + b.min + "-" + b.max + ": " + b.tags + " starting tag" + (b.tags > 1 ? "s" : "") +
      (b.debuffs ? " and " + b.debuffs + " debuff" + (b.debuffs > 1 ? "s" : "") : ", no debuffs") + ". Your portrait shows your captain at this age." : "Pick an age from 15 to 40.";
    return '<p class="muted">You survived Axel Dettman\'s raids. Your city burned, and you came out of the ashes with a battered sloop and a grudge.</p>' +
      '<div class="row2">' + textField("First name", "first", { max: 24 }) + textField("Last name", "last", { max: 24 }) + "</div>" +
      '<p><button data-act="randname">Random name</button> <span class="small muted">From the Avalon pool' + (draft.portraitSet ? "" : "; a man's name until you pick a portrait") + ".</span></p>" +
      textField("Age", "age", { type: "number", min: 15, maxNum: 40, redraw: true }) +
      '<p class="small muted">' + esc(bandNote) + "</p>";
  }

  function cycler(choices, field, label) {
    var cur = getField(field);
    var i = Math.max(0, choices.map(function (c) { return c.set; }).indexOf(cur));
    var c = choices[i];
    return '<div class="cycler">' +
      '<button class="arrow" data-act="cycle" data-field="' + field + '" data-dir="-1" aria-label="Previous portrait">‹</button>' +
      '<figure><img src="' + assetUrl(c.path) + '" alt="' + esc(label) + " " + (i + 1) + '">' +
      "<figcaption>" + esc(c.name) + ' <span class="muted">· ' + (i + 1) + " of " + choices.length + "</span></figcaption></figure>" +
      '<button class="arrow" data-act="cycle" data-field="' + field + '" data-dir="1" aria-label="Next portrait">›</button></div>';
  }

  function stepPortrait() {
    var choices = PC.creator.captainPortraitChoices(draft);
    if (!choices.length) return "<p>Set an age first.</p>";
    if (!draft.portraitSet) draft.portraitSet = choices[0].set; // what you see is what you pick
    var b = PC.creator.band(draft.age);
    return '<p class="muted">Portraits for a ' + esc(b.band === "mid" ? "middle-aged" : b.band) + " captain. Your portrait ages with you, and an eyepatch replaces it if you lose an eye. The captain is a woman if you choose a woman's portrait.</p>" +
      cycler(choices, "portraitSet", "Portrait");
  }

  function stepOrigin() {
    var C = PC.creator, Dc = PC.data.creator;
    var p = C.professionById(draft.profession);
    var html = "<h3>Home city</h3><p class=\"small muted\">Which sack did you survive? Baltimore burned in September 1752; Savannah and Charleston in June 1753.</p>" +
      '<div class="cards">' + Dc.HOME_CITIES.map(function (c) { return card("pick", "homeCity", c.id, c.id, c.effect); }).join("") + "</div>" +
      "<h3>Profession</h3><p class=\"small muted\">What you did before the fire. It gives one free training point.</p>" +
      '<div class="cards">' + Dc.PROFESSIONS.map(function (x) { return card("pick", "profession", x.id, x.id, x.flavor); }).join("") + "</div>";
    if (p) {
      html += "<h3>Free training point</h3>" +
        '<div class="cards two">' + p.free.map(function (t) { return card("pick", "freePoint", t, t, "+1 training (" + PC.data.checkTypes[t].stat + ")"); }).join("") + "</div>";
    }
    html += "<h3>What was lost</h3><p class=\"small muted\">It gives you a loss tag and opens the quest to get it back, until the end of Spring 1755.</p>" +
      '<div class="cards">' + C.lossChoices(draft).map(function (l) { return card("pick", "loss", l.id, l.name + " · " + l.tag, l.text); }).join("") + "</div>";
    return html;
  }

  var STAT_TEXT = {
    Cunning: "Wits, planning, deception", Daring: "Nerve to act first and take risks", Command: "Leading groups",
    Seamanship: "Sailing and ship craft", Charm: "Winning individuals", Grit: "Endurance and will",
  };

  function stepper(act, key, value, canDown, canUp, extra) {
    return '<span class="stepper"><button data-act="' + act + '" data-key="' + esc(key) + '" data-d="-1"' + (canDown ? "" : " disabled") + ' aria-label="Lower">−</button>' +
      "<b>" + value + "</b>" +
      '<button data-act="' + act + '" data-key="' + esc(key) + '" data-d="1"' + (canUp ? "" : " disabled") + ' aria-label="Raise">+</button>' + (extra || "") + "</span>";
  }

  function stepStats() {
    var C = PC.creator;
    var left = C.statPointsLeft(draft);
    return '<p class="muted">Every stat starts at 1. Spend <b>' + left + "</b> more point" + (left === 1 ? "" : "s") + ", at most 2 in a stat. A stat adds to every check in its family.</p>" +
      '<table class="alloc">' + PC.checks.STATS.map(function (s) {
        return "<tr><th>" + esc(s) + '<br><span class="small muted">' + esc(STAT_TEXT[s]) + "</span></th><td>" +
          stepper("stat", s, draft.stats[s], C.canLowerStat(draft, s), C.canRaiseStat(draft, s)) + "</td></tr>";
      }).join("") + "</table>";
  }

  function familyTypes() {
    var fam = {};
    PC.checks.STATS.forEach(function (s) { fam[s] = []; });
    Object.keys(PC.data.checkTypes).forEach(function (t) { fam[PC.data.checkTypes[t].stat].push(t); });
    return fam;
  }

  function stepTraining() {
    var C = PC.creator;
    var left = C.trainingLeft(draft);
    var fam = familyTypes();
    return '<p class="muted">Spend <b>' + left + "</b> more training point" + (left === 1 ? "" : "s") + ", at most 2 in a check type" +
      (draft.freePoint ? " (your free point in " + esc(draft.freePoint) + " counts toward the 2)" : "") +
      ". The number on the right is your edge before difficulty: stat plus training.</p>" +
      PC.checks.STATS.map(function (s) {
        var trained = fam[s].filter(function (t) { return C.trainingTotal(draft, t) > 0; }).length;
        return '<details class="family"' + (trained || s === PC.checks.STATS[0] ? " open" : "") + "><summary><b>" + esc(s) + "</b> " + draft.stats[s] +
          (trained ? ' <span class="small muted">· ' + trained + " trained</span>" : "") + "</summary>" +
          '<table class="alloc small-rows">' + fam[s].map(function (t) {
            var free = draft.freePoint === t ? ' <span class="badge-free">+1 free</span>' : "";
            return "<tr><th>" + esc(t) + free + "</th><td>" +
              stepper("train", t, C.trainingTotal(draft, t), C.canLowerType(draft, t), C.canRaiseType(draft, t)) +
              '</td><td class="edge">' + signed(draft.stats[s] + C.trainingTotal(draft, t)) + "</td></tr>";
          }).join("") + "</table></details>";
      }).join("");
  }

  function stepCharacter() {
    var C = PC.creator, Dc = PC.data.creator;
    var html = '<p class="muted">Pick two traits and one flaw. Traits give +1 on their checks; the flaw gives -1 and a temptation. Your officers will read them.</p>' +
      "<h3>Traits (" + draft.traits.length + " of " + Dc.START.traitCount + ")</h3>";
    Dc.TRAIT_GROUPS.forEach(function (g) {
      html += '<h4>' + esc(g.group) + '</h4><div class="cards small-cards">' + g.traits.map(function (t) {
        var full = draft.traits.length >= Dc.START.traitCount && draft.traits.indexOf(t.id) < 0;
        return card("toggle", "traits", t.id, t.id, t.text, { max: Dc.START.traitCount, blocked: C.blockedBy(draft, t.id), full: full });
      }).join("") + "</div>";
    });
    html += "<h3>Flaw</h3>" + '<div class="cards small-cards">' + Dc.FLAWS.map(function (f) {
      return card("pick", "flaw", f.id, f.id, f.text, { blocked: C.blockedBy(draft, f.id) });
    }).join("") + "</div>";
    return html;
  }

  function stepTags() {
    var C = PC.creator, Dc = PC.data.creator;
    var n = C.tagsAllowed(draft), d = C.debuffsRequired(draft);
    var loss = C.lossById(draft.loss);
    var html = '<p class="muted">At ' + draft.age + " you take <b>" + n + "</b> starting tag" + (n > 1 ? "s" : "") +
      (d ? " and <b>" + d + "</b> debuff" + (d > 1 ? "s" : "") : " and no debuffs") + ". Tags mostly give rerolls and open hidden scenes.</p>" +
      '<p class="small">Already yours: <b>Ash-Born</b>' + (loss ? ", <b>" + esc(loss.tag) + "</b> (" + esc(loss.name.toLowerCase()) + ")" : "") + ". These don't count.</p>" +
      "<h3>Starting tags (" + draft.tags.length + " of " + n + ")</h3>";
    Dc.TAG_GROUPS.forEach(function (g) {
      html += "<h4>" + esc(g.group) + '</h4><div class="cards small-cards">' + g.tags.map(function (t) {
        var full = draft.tags.length >= n && draft.tags.indexOf(t.id) < 0;
        return card("toggle", "tags", t.id, t.id, t.text, { max: n, blocked: C.blockedBy(draft, t.id), full: full });
      }).join("") + "</div>";
    });
    if (d) {
      html += "<h3>Debuffs (" + draft.debuffs.length + " of " + d + ")</h3><p class=\"small muted\">The years have left their mark. Some can be cured later, at a price.</p>" +
        '<div class="cards small-cards">' + Dc.DEBUFFS.map(function (x) {
          var full = draft.debuffs.length >= d && draft.debuffs.indexOf(x.id) < 0;
          return card("toggle", "debuffs", x.id, x.id, x.text, { max: d, blocked: C.blockedBy(draft, x.id), full: full });
        }).join("") + "</div>";
    }
    return html;
  }

  function stepMentor() {
    var C = PC.creator, Dc = PC.data.creator;
    var choices = C.mentorPortraitChoices(draft);
    if (!draft.mentor.portraitSet || !choices.some(function (c) { return c.set === draft.mentor.portraitSet; })) draft.mentor.portraitSet = choices[0].set;
    var html = '<p class="muted">An old hand who sailed with you out of the ashes. Your mentor is your first officer and your first Quartermaster, starts as your Friend, and once a season lets you reroll a setback on a check they taught you.</p>' +
      '<div class="row2">' + textField("Mentor's first name", "mentor.first", { max: 24 }) + textField("Last name", "mentor.last", { max: 24 }) + "</div>" +
      cycler(choices, "mentor.portraitSet", "Mentor portrait") +
      "<h3>Type</h3>" + '<div class="cards">' + Dc.OFFICER_TYPES.map(function (t) {
        return card("pick", "mentor.type", t.id, t.id, t.perk + ". Teaches: " + t.lessons + ".");
      }).join("") + "</div>";
    function traitCards(field, blockFn) {
      return ["warm", "neutral", "cold"].map(function (w) {
        return "<h4>" + { warm: "Sweet and funny", neutral: "Steady and odd", cold: "Dark and terrifying" }[w] + '</h4><div class="cards small-cards">' +
          Dc.OFFICER_TRAITS.filter(function (t) { return t.warmth === w; }).map(function (t) {
            return card("pick", field, t.id, t.id, t.hook + ". Likes " + t.likes + ", dislikes " + t.dislikes + ".", { blocked: blockFn ? blockFn(t.id) : null });
          }).join("") + "</div>";
      }).join("");
    }
    html += "<h3>Voice trait</h3><p class=\"small muted\">How your mentor talks and what he cares about.</p>" + traitCards("mentor.voice") +
      "<h3>Secondary trait</h3>" + (draft.mentor.voice ? traitCards("mentor.secondary", function (id) { return C.secondaryBlocked(draft, id); }) : '<p class="small muted">Pick a voice trait first.</p>') +
      '<p class="small muted">The mentor\'s drive and fear are rolled when the game begins, and stay hidden until you learn them.</p>';
    return html;
  }

  function stepShip() {
    return '<div class="ship-plate"><img class="ship-art" src="' + assetUrl(PC.data.shipArt("Sloop")) + '" alt="A sloop">' +
      '<p class="small">A battered sloop: 14 of 20 hull, frayed rigging, 6 of 10 guns, shallow draft for the shoals, and a skeleton crew of 12 green hands.</p></div>' +
      textField("Her name", "shipName", { max: 30, placeholder: "The ship's name" }) +
      '<p><button data-act="randship">Random name</button></p>';
  }

  function stepReview() {
    var C = PC.creator;
    var errs = C.allErrors(draft);
    var loss = C.lossById(draft.loss), city = C.cityById(draft.homeCity);
    function sec(title, step, body) {
      var i = C.STEPS.map(function (s) { return s.id; }).indexOf(step);
      return '<div class="review-sec"><h3>' + esc(title) + ' <button class="link" data-act="gostep" data-i="' + i + '">Change</button></h3>' + body + "</div>";
    }
    var training = Object.keys(PC.data.checkTypes).filter(function (t) { return C.trainingTotal(draft, t); })
      .map(function (t) { return esc(t) + " +" + C.trainingTotal(draft, t); }).join(", ");
    var m = draft.mentor;
    var html = "";
    if (errs.length) {
      html += '<div class="todo"><p><b>Still to do:</b></p><ul>' + errs.map(function (e) {
        var i = C.STEPS.map(function (s) { return s.id; }).indexOf(e.step);
        return '<li><button class="link" data-act="gostep" data-i="' + i + '">' + esc(C.STEPS[i].title) + "</button>: " + esc(e.message) + "</li>";
      }).join("") + "</ul></div>";
    }
    html += sec("Captain", "identity", "<p>" + esc((String(draft.first) + " " + String(draft.last)).trim()) + ", age " + esc(draft.age) + "</p>") +
      sec("Origin", "origin", "<p>Ash-Born of " + esc(draft.homeCity || "?") + (city ? ' <span class="small muted">(' + esc(city.effect) + ")</span>" : "") +
        "<br>Once " + esc(aOrAn((draft.profession || "?").toLowerCase())) + (draft.freePoint ? ", free point in " + esc(draft.freePoint) : "") +
        "<br>" + (loss ? esc(loss.name) + ": " + esc(loss.tag) : "Nothing lost yet") + "</p>") +
      sec("Stats", "stats", "<p>" + PC.checks.STATS.map(function (s) { return esc(s) + " " + draft.stats[s]; }).join(" · ") + "</p>") +
      sec("Training", "training", "<p>" + (training || "None") + "</p>") +
      sec("Traits and flaw", "character", "<p>" + esc(draft.traits.join(", ") || "None") + (draft.flaw ? "; flaw: " + esc(draft.flaw) : "") + "</p>") +
      sec("Tags", "tags", "<p>Ash-Born" + (loss ? ", " + esc(loss.tag) : "") + (draft.tags.length ? ", " + esc(draft.tags.join(", ")) : "") +
        (draft.debuffs.length ? '<br><span class="muted">Debuffs:</span> ' + esc(draft.debuffs.join(", ")) : "") + "</p>") +
      sec("Mentor", "mentor", "<p>" + esc((String(m.first) + " " + String(m.last)).trim() || "?") + (m.type ? ", " + esc(m.type) : "") +
        (m.voice ? "<br>" + esc(m.voice) + (m.secondary ? ", " + esc(m.secondary) : "") + ", Mentor" : "") + "</p>") +
      sec("Ship", "ship", "<p><i>" + esc(draft.shipName || "?") + "</i>, a battered sloop</p>") +
      '<p class="small muted">You start with ' + (600 + (city && city.gold ? city.gold : 0)) + " crew gold, an empty purse and 10 provisions lots. Standing, Heat and Dread start at zero.</p>" +
      '<div class="actions"><button class="primary big" data-act="begin"' + (errs.length ? " disabled" : "") + ">Set sail</button></div>";
    return html;
  }

  var creatorHandlers = {
    "gostep": function (el) { stepIndex = Number(el.dataset.i); scrollTop(); },
    "next": function () {
      if (stepIndex < PC.creator.STEPS.length - 1) stepIndex += 1;
      scrollTop();
    },
    "back": function () { if (stepIndex > 0) stepIndex -= 1; scrollTop(); },
    "pick": function (el) {
      var f = el.dataset.field, v = el.dataset.value;
      setField(f, v);
      if (f === "profession") PC.creator.fitToProfession(draft);
      if (f === "mentor.voice" && draft.mentor.secondary && PC.creator.secondaryBlocked(draft, draft.mentor.secondary)) draft.mentor.secondary = null;
    },
    "toggle": function (el) {
      var list = getField(el.dataset.field), v = el.dataset.value, max = Number(el.dataset.max || 99);
      var i = list.indexOf(v);
      if (i >= 0) list.splice(i, 1);
      else if (list.length < max) list.push(v);
    },
    "cycle": function (el) {
      var f = el.dataset.field;
      var choices = f === "portraitSet" ? PC.creator.captainPortraitChoices(draft) : PC.creator.mentorPortraitChoices(draft);
      var i = choices.map(function (c) { return c.set; }).indexOf(getField(f));
      i = (Math.max(0, i) + Number(el.dataset.dir) + choices.length) % choices.length;
      setField(f, choices[i].set);
    },
    "stat": function (el) {
      var s = el.dataset.key, d = Number(el.dataset.d);
      if (d > 0 && PC.creator.canRaiseStat(draft, s)) draft.stats[s] += 1;
      if (d < 0 && PC.creator.canLowerStat(draft, s)) draft.stats[s] -= 1;
    },
    "train": function (el) {
      var t = el.dataset.key, d = Number(el.dataset.d);
      if (d > 0 && PC.creator.canRaiseType(draft, t)) draft.training[t] = (draft.training[t] || 0) + 1;
      if (d < 0 && PC.creator.canLowerType(draft, t)) { draft.training[t] -= 1; if (!draft.training[t]) delete draft.training[t]; }
    },
    "surprise": function () {
      var key = "surprise|" + PC.rng.newWorldSeed();
      draft = PC.creator.randomDraft(key);
      var n = PC.npcs.randomCaptainName(PC.creator.setById(draft.portraitSet).gender, key + "|name");
      draft.first = n.first; draft.last = n.last;
      draft.shipName = PC.npcs.randomShipName(key + "|ship");
      stepIndex = PC.creator.STEPS.length - 1;
    },
    "resetdraft": function () { draft = PC.creator.blankDraft(); stepIndex = 0; },
    // The random-name buttons (§36.2).
    "randname": function () {
      var g = draft.portraitSet ? PC.creator.setById(draft.portraitSet).gender : "m";
      var n = PC.npcs.randomCaptainName(g, "captain-name|" + PC.rng.newWorldSeed());
      draft.first = n.first; draft.last = n.last;
    },
    "randship": function () { draft.shipName = PC.npcs.randomShipName("ship-name|" + PC.rng.newWorldSeed()); },
    "begin": function () {
      var seed = PC.rng.newWorldSeed();
      var template = PC.creator.build(draft, seed);
      state = PC.state.newGame(template, { seed: seed });
      PC.state.addLog(state, "— Spring 1754 begins. —");
      PC.state.addLog(state, "The quest What Was Lost is open (until the end of Spring 1755).");
      creating = false;
      clearDraft();
      scrollTop();
    },
  };

  function scrollTop() { try { globalThis.scrollTo(0, 0); } catch (e) { /* ignore */ } }

  // Text boxes update the draft as you type, without redrawing (so the
  // cursor stays put). Age redraws on change: it moves the portrait band.
  function wireFields() {
    root.querySelectorAll("input[data-field]").forEach(function (el) {
      var path = el.dataset.field;
      el.addEventListener("input", function () {
        setField(path, el.type === "number" ? el.value : el.value);
        saveDraft();
      });
      if (el.dataset.redraw) {
        el.addEventListener("change", function () {
          var n = Math.round(Number(el.value));
          if (n >= 15 && n <= 40) {
            setField(path, n);
            PC.creator.fitToAge(draft);
          }
          saveDraft();
          draw();
        });
      }
    });
  }

  // ---- Wiring ----------------------------------------------------------

  var handlers = {
    "continue": function () { state = PC.state.loadFromBrowser(); },
    "new": function () {
      if (PC.state.loadFromBrowser()) { dialog = "confirmnew"; return; }
      handlers.newconfirmed();
    },
    "newconfirmed": function () {
      dialog = null;
      startCreator();
    },
    "quickstart": function () {
      state = PC.state.newGame(PC.data.testCaptain);
      PC.state.addLog(state, "— Spring 1754 begins. —");
    },
    "quit": function () { state = null; creating = false; },
    "export": function () { dialog = "export"; },
    "import": function () { dialog = "import"; },
    "closedialog": function () { dialog = null; },
    "download": downloadSave,
    "copy": copySave,
    "pickfile": pickSaveFile,
    "loadpasted": function () { var t = document.querySelector(".pastebox").value; if (t.trim()) loadSaveText(t); else toast("Paste a save first."); },
    "choose": function (el) {
      PC.scenes.choose(state, Number(el.dataset.i));
      // A beat's "carry on" with nothing to show goes straight through.
      var r = PC.scenes.viewScene(state).result;
      if (r && r.outcome === "result" && !r.text && !r.effects.filter(Boolean).length) PC.scenes.commit(state);
    },
    "reroll": function () { PC.scenes.reroll(state); },
    "commit": function (el) { PC.scenes.commit(state, el.dataset.pot || null); },
    "enter": function (el) {
      var id = el.dataset.scene;
      if (PC.scenes.canEnter(state, id).ok) PC.scenes.enterScene(state, id);
    },
    "endseason": function () { PC.scenes.endSeason(state); },
    "dev": function () { showDev = true; },
    "closedev": function () { showDev = false; },
    "toggledice": function () { state.settings.showDice = !state.settings.showDice; },
    "togglegender": function () { state.captain.gender = state.captain.gender === "f" ? "m" : "f"; },
    "addap": function () { state.ap.left = Math.min(state.ap.max, state.ap.left + 1); },
    "tohub": function () {
      if (state.location) { state.current = { screen: "node" }; state.location.place = null; }
      else state.current = { screen: "hub", hubId: PC.data.testStart.hub };
      showDev = false;
    },
    "fillap": function () { state.ap.left = state.ap.max; },
    "devgold": function () { state.money.crew += 500; },
    "devpurse": function () { state.money.purse += 500; },
    "devtreasure": function (el) { state.cargo.treasure[el.dataset.dirty === "1" ? "dirty" : "clean"] += 10; },
    "devdamage": function () { state.ship.hull = Math.max(1, state.ship.hull - 5); },
    // Switch the loss variant (§12.5): the tag, the flag and the quest follow.
    "devloss": function (el) {
      var c = state.captain, v = el.dataset.loss;
      var L = PC.data.creator.LOSSES;
      L.forEach(function (l) { var i = c.tags.indexOf(l.tag); if (i >= 0) c.tags.splice(i, 1); delete state.flags["loss_" + l.id.toLowerCase()]; });
      c.loss = v;
      c.tags.splice(1, 0, L.filter(function (l) { return l.id === v; })[0].tag);
      state.flags["loss_" + v.toLowerCase()] = true;
      PC.quests.record(state, "what_was_lost").variant = v;
    },
    "devposture": function (el) { state.world.posture = el.dataset.posture; },
    "devjump": function () {
      var id = document.querySelector(".devscene").value;
      if (state.location) state.location.place = /_(uw|oap)/.test(id) ? "tavern" : /_rr_/.test(id) ? "docks" : null;
      PC.scenes.enterScene(state, id);
      showDev = false;
    },
    "devnewseason": function () { PC.scenes.endSeason(state); showDev = false; },
    "devarrive": function () {
      var n = Math.min(4, state.crew.tiers.Green || 0);
      if (n) { PC.crew.removeHands(state, "Green", n); state.crew.wounded += n; }
      PC.node.arrive(state, PC.node.here(state), { fromHunt: true });
      showDev = false;
    },
  };

  // Creator actions live in the creator section below.
  Object.keys(creatorHandlers).forEach(function (k) { handlers[k] = creatorHandlers[k]; });
  Object.keys(nodeHandlers).forEach(function (k) { handlers[k] = nodeHandlers[k]; });

  var showDev = false;
  var dialog = null;

  function wire() {
    if (showDev && state) root.insertAdjacentHTML("beforeend", devPanel());
    if (dialog) root.insertAdjacentHTML("beforeend", dialogHtml());
    wireFields();
    root.querySelectorAll("[data-act]").forEach(function (el) {
      var name = el.dataset.act;
      var h = handlers[name];
      if (!h) return;
      var evt = el.tagName === "INPUT" ? "change" : "click";
      el.addEventListener(evt, function (ev) {
        if (el.classList.contains("modal") && ev.target !== el) return;
        // These redraw (or not) themselves: file reads finish later, and
        // copy/download must not rebuild the dialog under the user.
        if (name === "pickfile" || name === "loadpasted" || name === "copy" || name === "download") { h(el); return; }
        act(h)(el);
      });
    });
  }

  function start(rootEl) {
    root = rootEl;
    draw();
  }

  PC.ui = { start: start };
})();
