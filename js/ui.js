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
      '<main class="stage">' + (state.current.screen === "hub" ? hubPanel() : scenePanel()) + logPanel() + "</main></div></div>";
    wire();
  }

  function drawTitle() {
    var hasSave = !!PC.state.loadFromBrowser();
    root.innerHTML =
      '<div class="title-screen">' +
      "<h1>Pirate Chronicle</h1>" +
      '<p class="sub">Prototype · Milestone 1 · the character creator</p>' +
      '<div class="title-buttons">' +
      (hasSave ? '<button data-act="continue" class="primary">Continue</button>' : "") +
      '<button data-act="new"' + (hasSave ? "" : ' class="primary"') + ">New game</button>" +
      '<button data-act="import">Load a save file</button>' +
      "</div>" +
      '<p class="note">Make your captain, then play the engine\'s placeholder scenes. Ocracoke comes next.</p>' +
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
      "</table>" +
      (PC.data.shipArt(state.ship.type) ? '<img class="sheet-ship" src="' + assetUrl(PC.data.shipArt(state.ship.type)) + '" alt="Your ' + esc(state.ship.type.toLowerCase()) + '">' : "") +
      '<table class="ledger">' +
      row(state.ship.type, "<i>" + esc(state.ship.name) + "</i>") +
      row("Hull", state.ship.hull + " / " + state.ship.hullMax) +
      row("Guns", state.ship.guns + " / " + state.ship.gunsMax) +
      row("Crew", state.crew.count + " hands") +
      row("Morale", state.crew.morale) +
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
      '<span class="small">' + esc(o.type) + " · your mentor" + (o.quartermaster ? " · Quartermaster" : "") + "</span><br>" +
      '<span class="small muted">' + esc(o.voice) + ", " + esc(o.secondary) + ", Mentor · " + esc(RUNGS[String(o.rung)] || "") + "</span></div></div>";
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
      textField("Her name", "shipName", { max: 30, placeholder: "The ship's name" });
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
      draft = PC.creator.randomDraft("surprise|" + PC.rng.newWorldSeed());
      stepIndex = PC.creator.STEPS.length - 1;
    },
    "resetdraft": function () { draft = PC.creator.blankDraft(); stepIndex = 0; },
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
    "tohub": function () { state.current = { screen: "hub", hubId: PC.data.start.hub }; showDev = false; },
  };

  // Creator actions live in the creator section below.
  Object.keys(creatorHandlers).forEach(function (k) { handlers[k] = creatorHandlers[k]; });

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
