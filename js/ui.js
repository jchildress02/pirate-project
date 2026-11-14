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
      return "<p>" + esc(p).replace(/\*([^*]+)\*/g, "<em>*$1*</em>").replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function pct(x) { return Math.round(x * 100) + "%"; }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n); }

  // ---- Save after every action ----------------------------------------

  function act(fn) {
    return function () {
      try { fn.apply(null, arguments); }
      catch (e) { console.error(e); toast("Something went wrong: " + e.message); }
      if (state) PC.state.saveToBrowser(state);
      draw();
    };
  }

  // ---- Screens ---------------------------------------------------------

  function draw() {
    if (!state) return drawTitle();
    root.innerHTML =
      '<div class="game">' + topBar() +
      '<div class="body"><aside class="sheet">' + captainSheet() + "</aside>" +
      '<main class="stage">' + (state.current.screen === "hub" ? hubPanel() : scenePanel()) + logPanel() + "</main></div></div>";
    wire();
  }

  function drawTitle() {
    var hasSave = !!PC.state.loadFromBrowser();
    root.innerHTML =
      '<div class="title-screen">' +
      "<h1>Pirate Chronicle</h1>" +
      '<p class="sub">Prototype · Milestone 0 · engine test</p>' +
      '<div class="title-buttons">' +
      (hasSave ? '<button data-act="continue" class="primary">Continue</button>' : "") +
      '<button data-act="new"' + (hasSave ? "" : ' class="primary"') + ">New game</button>" +
      '<button data-act="import">Load a save file</button>' +
      "</div>" +
      '<p class="note">This build tests the engine with placeholder scenes. Ocracoke comes next.</p>' +
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
    return '<h2>' + esc(c.first + " " + c.last) + "</h2>" +
      '<p class="muted">Age ' + c.age + " · Ash-Born of " + esc(c.homeCity) + "</p>" +
      '<div class="stats">' + stats + "</div>" +
      '<p class="small"><b>Training:</b> ' + training + "</p>" +
      '<p class="small"><b>Tags:</b> ' + esc((c.tags || []).join(", ") || "None") + "</p>" +
      '<p class="small"><b>Items:</b> ' + esc((c.items || []).join(", ") || "None") + "</p>" +
      '<table class="ledger">' +
      row("Crew gold", state.money.crew) +
      row("Your purse", state.money.purse) +
      row("Provisions", state.provisions + " lots") +
      row(state.ship.type, "<i>" + esc(state.ship.name) + "</i>") +
      row("Hull", state.ship.hull + " / " + state.ship.hullMax) +
      row("Guns", state.ship.guns + " / " + state.ship.gunsMax) +
      row("Crew", state.crew.count + " hands") +
      row("Morale", state.crew.morale) +
      row("Dread", m.dread) +
      row("Standing", "Frisia " + m.standing.frisia + " · Avalon " + m.standing.avalon + " · Pirates " + m.standing.pirates) +
      row("Heat", "Frisia " + m.heat.frisia + " · Avalon " + m.heat.avalon) +
      "</table>";
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

  // ---- Developer panel -------------------------------------------------

  function devPanel() {
    var v = PC.validate(state);
    var list = function (arr) { return arr.length ? "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>None.</p>"; };
    return '<div class="modal" data-act="closedev"><div class="panel" onclick="event.stopPropagation()">' +
      "<h2>Developer</h2>" +
      '<label><input type="checkbox" data-act="toggledice"' + (state.settings.showDice ? " checked" : "") + "> Show the dice on results</label>" +
      '<label><input type="checkbox" data-act="togglegender"' + (state.captain.gender === "f" ? " checked" : "") + "> Woman captain (tests the pronoun swap)</label>" +
      '<div class="actions"><button data-act="addap">+1 action</button><button data-act="tohub">Go to the harbor menu</button></div>' +
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

  // ---- Wiring ----------------------------------------------------------

  var handlers = {
    "continue": function () { state = PC.state.loadFromBrowser(); },
    "new": function () {
      if (PC.state.loadFromBrowser()) { dialog = "confirmnew"; return; }
      handlers.newconfirmed();
    },
    "newconfirmed": function () {
      dialog = null;
      state = PC.state.newGame(PC.data.testCaptain);
      PC.state.addLog(state, "— Spring 1754 begins. —");
    },
    "quit": function () { state = null; },
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
    "tohub": function () { state.current = { screen: "hub", hubId: PC.data.start.hub }; showDev = false; },
  };

  var showDev = false;
  var dialog = null;

  function wire() {
    if (showDev && state) root.insertAdjacentHTML("beforeend", devPanel());
    if (dialog) root.insertAdjacentHTML("beforeend", dialogHtml());
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
