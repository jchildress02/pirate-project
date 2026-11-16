/* Pirate Chronicle — drawing the screen.
 *
 * The look is §38 (the signed-off mockup is the visual spec) and what each
 * screen holds is §41. Everything here reads from the engine (PC.scenes,
 * PC.checks, PC.node...) and calls back into it; no game rules live in this
 * file.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});

  var state = null;
  var root = null;
  var BUILD = "Prototype build 0.5 · UI pass 1";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Paragraphs on blank lines; *stage business* in italics (§33.3.3).
  function prose(text) {
    return String(text || "").split(/\n\n+/).filter(Boolean).map(function (p) {
      return "<p>" + inline(p) + "</p>";
    }).join("");
  }
  function inline(t) { return esc(smart(t)).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\n/g, "<br>"); }

  // Printer's quotes: IM Fell has no straight quote that reads as an
  // opening one, so "this" becomes “this” and don't becomes don’t.
  function smart(t) {
    return String(t == null ? "" : t)
      .replace(/(^|[\s(\[\u2014-])"/g, "$1\u201c").replace(/"/g, "\u201d")
      .replace(/(^|[\s(\[\u2014-])'/g, "$1\u2018").replace(/'/g, "\u2019");
  }

  // Images: a file path, or the inlined copy in the single-file build.
  function assetUrl(path) { return esc((PC.assets && PC.assets[path]) || path); }

  // "a sailor", "an official"
  function aOrAn(word) { return (/^[aeiou]/i.test(word) ? "an " : "a ") + word; }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n); }
  function gold(n) { return (Math.round(n * 100) / 100).toLocaleString("en-US"); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function titleCase(s) { return String(s).replace(/(^|\s)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

  // ---- Settings (kept in this browser, apart from any save; §41.2) -------

  var SETTINGS_KEY = "pirate-chronicle-settings";
  function loadSettings() {
    var s = { dev: false, reduceMotion: false };
    try { var t = JSON.parse(globalThis.localStorage.getItem(SETTINGS_KEY) || "{}"); Object.keys(t).forEach(function (k) { s[k] = t[k]; }); } catch (e) { /* ignore */ }
    return s;
  }
  var settings = loadSettings();
  function saveSettings() { try { globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
  function reducedMotion() {
    if (settings.reduceMotion) return true;
    try { return globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  // ---- Inks, icons and ornaments (§38.2, §38.6) ---------------------------

  var INK = { ink: "#2a1c10", faded: "#5e4528", oxblood: "#7a2416", good: "#2f5a22", mid: "#7a5608", bad: "#8f2a1c",
    frisia: "#a14c17", avalon: "#8a6414", pirates: "#2b2622", sea: "#235066", none: "#5e4528" };
  var FACTION = { frisia: "Frisia", avalon: "Avalon", pirates: "Pirates" };

  var I = {
    gold: '<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.8"/><path d="M10 7.5v5"/>',
    treasure: '<path d="M3 9h14v8H3z"/><path d="M3 9q0-5 7-5t7 5"/><path d="M3 12h14"/><rect x="8.5" y="11" width="3" height="3"/>',
    prov: '<path d="M5 3h10q2 7 0 14H5q-2-7 0-14z"/><path d="M4 7h12M4 13h12"/>',
    hull: '<path d="M2 10h16l-3 6H5z"/><path d="M10 10V2l6 6h-6"/>',
    morale: '<circle cx="10" cy="10" r="7.5"/><path d="M6.5 11.5q3.5 3.5 7 0"/><path d="M7.5 7.5v1M12.5 7.5v1"/>',
    pressure: '<path d="M5 12a4 4 0 0 1 1-8a5 5 0 0 1 9 2a3 3 0 0 1 0 6z"/><path d="M10 12l-2 4h3l-2 3"/>',
    standing: '<path d="M5 18V2"/><path d="M5 3h10l-3 3.5L15 10H5z" fill="currentColor" fill-opacity=".85"/>',
    heat: '<path d="M10 2q5 5 4 10a4 4 0 0 1-8 0q0-3 2-5q0 3 2 3q1-4 0-8z" fill="currentColor" fill-opacity=".8"/>',
    dread: '<path d="M4 9a6 6 0 0 1 12 0v3l-2 1v3H6v-3l-2-1z"/><circle cx="7.5" cy="9.5" r="1.5"/><circle cx="12.5" cy="9.5" r="1.5"/><path d="M8.5 16v-2M11.5 16v-2"/>',
    rel: '<circle cx="6.5" cy="6" r="2.6"/><circle cx="13.5" cy="6" r="2.6"/><path d="M1.5 17q0-6 5-6q2.5 0 3.5 1.5q1-1.5 3.5-1.5q5 0 5 6"/><path d="M10 15.5l-1.2-1.1a.9.9 0 0 1 1.2-1.3a.9.9 0 0 1 1.2 1.3z" fill="currentColor"/>',
    officer: '<circle cx="8" cy="6" r="3"/><path d="M2 17q0-6 6-6t6 6"/><path d="M16 4v8M13.5 6.5L16 4l2.5 2.5"/>',
    cond: '<path d="M3 13L13 3l4 4L7 17z"/><path d="M8 8l4 4M9 7l1 1M12 10l1 1"/>',
    tag: '<path d="M3 3h7l7 7l-7 7l-7-7z"/><circle cx="7" cy="7" r="1.5"/>',
    item: '<path d="M10 2l6 6l-6 10L4 8z"/><path d="M4 8h12M7 8l3 10l3-10"/>',
    rumor: '<path d="M4 3h10v14H6a2 2 0 0 1-2-2z"/><path d="M14 3a2 2 0 0 1 2 2v2h-2M7 7h5M7 10h5M7 13h3"/>',
    lead: '<circle cx="10" cy="10" r="7.5"/><path d="M10 4l2 6l-2 6l-2-6z"/>',
    clock: '<path d="M5 2h10M5 18h10M6 2q0 5 4 8q4-3 4-8M6 18q0-5 4-8q4 3 4 8"/>',
    port: '<path d="M4 18V7h12v11M4 7V3h2.5v2h2.5V3h2v2h2.5V3H16v4"/><path d="M8.5 18v-4a1.5 1.5 0 0 1 3 0v4"/>',
    dfear: '<circle cx="10" cy="10" r="8"/><path d="M6 9a4 4 0 0 1 8 0v2l-1.3.7V14H7.3v-2.3L6 11z" fill="currentColor" fill-opacity=".25"/><circle cx="8.3" cy="9.3" r="1"/><circle cx="11.7" cy="9.3" r="1"/>',
    dgood: '<circle cx="10" cy="10" r="8"/><path d="M10 14.5l-3.6-3.4a2.2 2.2 0 0 1 3.6-2.6a2.2 2.2 0 0 1 3.6 2.6z" fill="currentColor" fill-opacity=".35"/>',
    dsea: '<circle cx="10" cy="10" r="8"/><circle cx="10" cy="6.3" r="1.3"/><path d="M10 7.6v7.4M7.5 9.5h5M5.8 12.2q1.2 2.8 4.2 2.8t4.2-2.8"/>',
    ap: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8"/>',
    journal: '<path d="M4 3h11v14H4z"/><path d="M7 3v14M9 7h4M9 10h4"/>',
    captain: '<path d="M3 8q7-6 14 0q-2 2-7 2t-7-2z"/><circle cx="10" cy="13" r="3"/><path d="M5 19q0-3 5-3t5 3"/>',
    notes: '<path d="M4 16l1-4L14 3l3 3l-9 9z"/><path d="M12 5l3 3"/>',
    menu: '<path d="M4 6h12M4 10h12M4 14h12"/>',
    ship: '<path d="M3 13h14l-3 4H6z"/><path d="M10 13V2M10 3l5 7h-5M10 4l-5 7h5"/>',
    up: '<path d="M4 13l6-7l6 7"/>',
    down: '<path d="M4 7l6 7l6-7"/>',
    x: '<path d="M5 5l10 10M15 5L5 15"/>',
  };
  function ic(k, cls, sw) {
    return '<svg' + (cls ? ' class="' + cls + '"' : "") + ' viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.4) + '" stroke-linecap="round" stroke-linejoin="round">' + I[k] + "</svg>";
  }
  function med(k, ink) { return '<span class="med" style="color:' + (INK[ink] || INK.ink) + '">' + ic(k) + "</span>"; }
  function chip(c) { return '<li class="fx">' + med(c.icon, c.ink) + (c.html || esc(c.text)) + "</li>"; }
  function chips(list) { return list.length ? '<ul class="effects">' + list.map(chip).join("") + "</ul>" : ""; }

  var CORNER_SVG = '<svg viewBox="0 0 60 60" aria-hidden="true"><path d="M6 56V24Q6 6 24 6H56" fill="none" stroke="#8a6414" stroke-width="2"/><path d="M11 56V26Q11 11 26 11H56" fill="none" stroke="#c99f45" stroke-width="1"/><path d="M6 38q12 0 12-12q0-7-7-7" fill="none" stroke="#8a6414" stroke-width="1.4"/><path d="M38 6q0 12-12 12q-7 0-7-7" fill="none" stroke="#8a6414" stroke-width="1.4"/><path d="M20 12L22 18L28 20L22 22L20 28L18 22L12 20L18 18Z" fill="#7a2416"/></svg>';
  var CORNERS = [["left:6px;top:6px", ""], ["right:6px;top:6px", "transform:scaleX(-1)"], ["left:6px;bottom:6px", "transform:scaleY(-1)"], ["right:6px;bottom:6px", "transform:scale(-1,-1)"]]
    .map(function (p) { return '<div class="corner" style="' + p[0] + ";" + p[1] + '">' + CORNER_SVG + "</div>"; }).join("");
  var DIVIDER = '<svg class="divider" viewBox="0 0 680 18" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="M90 9H318M362 9H590" stroke="#8c6c3c" stroke-width="1"/><path d="M318 9q-10-8-20 0q10 8 20 0M362 9q10-8 20 0q-10 8-20 0" fill="none" stroke="#8c6c3c" stroke-width="1"/><path d="M340 2L347 9L340 16L333 9Z" fill="#7a2416"/><circle cx="326" cy="9" r="2" fill="#8a6414"/><circle cx="354" cy="9" r="2" fill="#8a6414"/></svg>';
  var CARET = '<svg class="caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

  // The generated officer's silhouette: hatched head and shoulders, no hat (§38.3).
  var silN = 0;
  function sil(w, h) {
    var id = "hx" + (silN++);
    return '<svg class="sil" viewBox="0 0 44 66" role="img" aria-label="No portrait yet" style="width:' + w + "px;height:" + h + 'px;background:#e2d2ad">' +
      '<defs><pattern id="' + id + '" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="3" fill="#2a1c10"/></pattern></defs>' +
      '<ellipse cx="22" cy="27" rx="9" ry="11" fill="url(#' + id + ')"/><path d="M4 66Q4 46 22 43Q40 46 40 66Z" fill="url(#' + id + ')"/></svg>';
  }
  function officerFace(o, w, h) {
    var pic = PC.creator.officerPortrait(o);
    return pic ? '<img src="' + assetUrl(pic) + '" alt="" style="width:' + w + "px;height:" + h + 'px">' : sil(w, h);
  }

  // Tier words carry a shape as well as a color (§38.2).
  var TIER_CLASS = { "Trivial": "t-good", "Very Easy": "t-good", "Easy": "t-good", "Medium": "t-mid", "Hard": "t-bad", "Very Hard": "t-bad" };
  var SHAPE = { "t-good": '<circle cx="6" cy="6" r="4.5" fill="currentColor"/>', "t-mid": '<path d="M6 1.5L10.5 6L6 10.5L1.5 6Z" fill="currentColor"/>', "t-bad": '<path d="M6 1.5L10.8 10.5H1.2Z" fill="currentColor"/>' };
  function shape(cls) { return '<svg viewBox="0 0 12 12" aria-hidden="true">' + SHAPE[cls] + "</svg>"; }
  function tierWord(t) { var c = TIER_CLASS[t] || "t-mid"; return '<span class="tier ' + c + '">' + shape(c) + esc(t) + "</span>"; }

  var OUTCOME = { clean: ["Clean success", "t-good"], partial: ["Partial success", "t-mid"], setback: ["Setback", "t-bad"] };
  function badge(outcome) {
    var o = OUTCOME[outcome];
    return o ? '<div class="badge ' + o[1] + '">' + shape(o[1]) + o[0] + "</div>" : "";
  }

  // ---- Bands (§28.1, §28.4) ----------------------------------------------

  function standingBand(v) {
    return v >= 70 ? "Honored" : v >= 40 ? "Trusted" : v >= 20 ? "Favored" : v >= -9 ? "Neutral" : v >= -39 ? "Wary" : v >= -69 ? "Hostile" : "Enemy";
  }
  function heatBand(v) { return v >= 90 ? "Most Wanted" : v >= 70 ? "Hunted" : v >= 40 ? "Wanted" : v >= 20 ? "Noticed" : "Cold"; }

  function standingBar(f, v) {
    var left = v >= 0 ? 50 : 50 + v / 2, width = Math.abs(v) / 2;
    return '<div class="meterrow"><span>' + FACTION[f] + '</span><span class="sc">' + standingBand(v) + "</span></div>" +
      '<div class="hbar"><i style="left:' + left + "%;width:" + width + "%;background:" + INK[f] + '"></i><i style="left:50%;width:1px;background:#4a3418"></i>' +
      '<i style="left:60%;width:1px;background:rgba(74,52,24,.4)"></i><i style="left:70%;width:1px;background:rgba(74,52,24,.4)"></i><i style="left:45%;width:1px;background:rgba(74,52,24,.4)"></i></div>';
  }
  function vbar(label, v, ink, band) {
    return '<div class="vbar"><div class="tube"><i style="height:' + Math.max(0, Math.min(100, v)) + "%;background:" + INK[ink] + '"></i></div><span>' + esc(label) + '</span><span class="sc">' + esc(band) + "</span></div>";
  }
  function meters(withNumbers) {
    var m = state.meters, n = function (x) { return withNumbers ? " · " + x : ""; };
    return '<div class="h4">Standing</div>' + ["frisia", "avalon", "pirates"].map(function (f) {
      var bar = standingBar(f, m.standing[f]);
      return withNumbers ? bar.replace(standingBand(m.standing[f]) + "</span>", standingBand(m.standing[f]) + n(m.standing[f]) + "</span>") : bar;
    }).join("") +
      '<div class="h4">Dread &amp; Heat</div><div class="vbars">' +
      vbar("Dread", m.dread, "pirates", withNumbers ? String(m.dread) : "") +
      vbar("Frisian Heat", m.heat.frisia || 0, "frisia", heatBand(m.heat.frisia || 0) + n(m.heat.frisia || 0)) +
      vbar("Avalon Heat", m.heat.avalon || 0, "avalon", heatBand(m.heat.avalon || 0) + n(m.heat.avalon || 0)) + "</div>";
  }

  // ---- Save after every action; Continue returns to the top (§38.5) -----

  function screenKey() {
    if (prologue) return "prologue";
    if (!state) return creating ? "creator|" + stepIndex : "title";
    var c = state.current || {}, l = state.location || {};
    return [c.screen, c.sceneId, c.phase, l.place, l.tab, state.minigame ? state.minigame.kind + (state.minigame.over ? "!" : "") : ""].join("|");
  }

  function act(fn) {
    return function (el) {
      var before = screenKey();
      try { fn.apply(null, arguments); }
      catch (e) { console.error(e); toast("Something went wrong: " + e.message); }
      if (state) PC.state.saveToBrowser(state);
      else if (creating) saveDraft();
      draw();
      if (screenKey() !== before || (el && el.dataset && el.dataset.top)) scrollTop();
    };
  }

  // ---- The frame -----------------------------------------------------------

  // The expiry warning (§41.12): at the start of the season a quest
  // expires, a popup, and a dot on the Journal button until it is opened.
  function expiryWarning() {
    if (!state.location || state.location.popup) return;
    var names = PC.quests.expiringNow(state);
    if (!names.length) return;
    state.journalDot = true;
    state.location.popup = { title: "Running out of time", chips: [],
      text: names.map(function (n) { return n + " must be done by the end of this season."; }).join("\n\n") };
  }

  function frame(inner) {
    return '<div class="desk' + (reducedMotion() ? " reduce-motion" : "") + '"><div class="rope"><div class="page">' + CORNERS + inner + "</div></div></div>";
  }

  function draw() {
    if (prologue) return drawPrologue();
    if (!state && creating) return drawCreator();
    if (!state) return drawTitle();
    liveTotals = [];
    expiryWarning();
    var screen = state.current.screen;
    var content = screen === "hub" ? hubPanel() : screen === "node" ? nodePanel() : screen === "minigame" ? minigamePanel() : scenePanel();
    root.innerHTML = frame(topBar() + phoneStrip() +
      '<div class="cols"><aside class="strip">' + strip() + '</aside><main class="stage">' + content + "</main></div>" + tabBar()) +
      popupHtml() + menuHtml();
    wire();
  }

  // ---- Title screen (§41.2) ----

  function drawTitle() {
    liveTotals = [];
    var save = PC.state.loadFromBrowser();
    var cont = "";
    if (save) {
      var c = save.captain, pic = PC.creator.captainPortrait(c);
      cont = '<button class="contcard" data-act="continue">' + (pic ? '<img src="' + assetUrl(pic) + '" alt="">' : sil(60, 90)) +
        "<div><b>Continue</b><span>" + esc((c.first + " " + c.last).trim()) + " · <i>" + esc(save.ship.name) + "</i></span>" +
        "<span>" + esc(PC.state.seasonName(save)) + " " + save.time.year + "</span></div></button>";
    }
    root.innerHTML = frame('<div class="title-screen"><h1>Pirate Chronicle</h1><span class="wt">(working title)</span>' + DIVIDER +
      '<div class="title-buttons">' + cont +
      '<button data-act="new" class="' + (save ? "secondary" : "primary") + '">New game</button>' +
      '<button data-act="import" class="secondary">Load a save file</button>' +
      '<button data-act="openmenu" data-menu="settings" class="secondary">Settings</button>' +
      (settings.dev ? '<button data-act="quickask" class="secondary">Developer: quick start with the test captain</button>' : "") +
      '</div><p class="version">' + esc(BUILD) + "</p></div>") + menuHtml();
    wire();
  }

  // ---- The top bar (§38.5, §41.12) ----

  function apPips(preview) {
    var out = "";
    for (var i = 0; i < state.ap.max; i++) out += '<i class="pip' + (i < state.ap.left ? " on" : "") + '" data-pip="' + i + '"></i>';
    return out + '<span class="count">' + state.ap.left + " of " + plural(state.ap.max, "action") + "</span>";
  }

  // The letter the captain sails under, with the Saved stamp beside it.
  function seal() {
    var wax = '<svg class="wax" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="14" fill="rgba(122,36,22,.12)" stroke="#7a2416" stroke-width="1.2" stroke-dasharray="2 2"/><circle cx="17" cy="17" r="9" fill="none" stroke="#7a2416" stroke-width=".8"/><path d="M12 17h10M17 12v10" stroke="#7a2416" stroke-width=".8"/></svg>';
    return '<span class="seal" title="No letter of marque: you sail under no flag but your own.">' + wax + '<span class="letter">No letter</span><span class="stamp">Saved</span></span>';
  }

  function topBar() {
    var b = function (k, t, m) { return '<button class="menubtn' + (menu === m ? " on" : "") + '" data-act="openmenu" data-menu="' + m + '">' + ic(k) + t + (m === "journal" ? jdot() : "") + "</button>"; };
    return '<header class="topbar"><div><span class="brand">Pirate Chronicle</span><span class="wt">(working title)</span></div>' +
      '<span class="when">' + esc(PC.state.seasonName(state)) + " " + state.time.year + "</span>" +
      '<span class="pips" title="Actions left this season">' + apPips() + "</span>" +
      // On a phone the strip scrolls away, so the gold rides in the sticky bar (the author's phone notes).
      '<span class="pgold">Purse ' + gold(state.money.purse) + " · Crew " + gold(state.money.crew) + "</span>" +
      '<span class="grow"></span>' + seal() +
      '<div class="line2">' + b("menu", "Menu", "menu") + b("journal", "Journal", "journal") + b("rumor", "Rumors", "rumors") + b("captain", "Captain", "captain") + b("notes", "Notes", "notes") + "</div></header>";
  }

  // ---- The captain strip (§38.5, §41.12) ----

  function lrow(label, value) { return "<tr><th>" + esc(label) + "</th><td>" + value + "</td></tr>"; }

  function aboard() { return (state.officers || []).filter(function (o) { return !o.gone; }); }

  function officerRole(o) {
    var f = o.aboard && o.aboard !== "flagship" ? (state.fleet || []).filter(function (x) { return x.id === o.aboard; })[0] : null;
    return [o.mentor ? "Mentor" : null, o.quartermaster ? "Quartermaster" : null, f ? "captains the " + (f.name || f.cls) : null].filter(Boolean).join(" · ");
  }

  function relWord(n) { return '<span class="rel rel-' + esc(n) + '">' + esc(n) + "</span>"; }

  function strip() {
    var c = state.captain, sh = state.ship;
    var pic = PC.creator.captainPortrait(c);
    var offs = aboard();
    return (pic ? '<img class="portrait" src="' + assetUrl(pic) + '" alt="Portrait of ' + esc(c.first) + '">' : "") +
      '<div class="xpline" aria-hidden="true"></div>' +
      '<p class="capname">' + esc((c.first + " " + c.last).trim()) + '</p><p class="muted" style="margin:3px 0 0;font-size:17.5px;font-style:italic">Age ' + c.age + "</p>" +
      '<table class="ledger">' + lrow("Your purse", gold(state.money.purse)) + lrow("Crew gold", gold(state.money.crew)) +
      lrow(sh.type, "<i>" + esc(sh.name) + "</i>") +
      lrow("Hull", Math.round(sh.hull) + " / " + sh.hullMax + '<div class="hbar" style="margin-left:auto;width:84px"><i style="width:' + Math.round(100 * sh.hull / sh.hullMax) + '%;background:#5e4528"></i></div>') +
      lrow("Crew", plural(state.crew.count, "hand")) +
      lrow("Morale", state.crew.morale + ' · <span class="sc" style="font-size:16px">' + esc(PC.crew.band(state.crew.morale)) + "</span>") + "</table>" +
      '<button class="link fulllink" data-act="openmenu" data-menu="captain">Full captain sheet ›</button>' +
      meters(false) +
      '<div class="h4">Officers</div>' + offs.map(function (o) {
        return '<button class="off" data-act="openmenu" data-menu="officer:' + esc(o.id) + '">' + officerFace(o, 44, 66) +
          "<div><b>" + esc((o.first + " " + (o.last || "")).trim()) + "</b><span>" + esc(o.type + (officerRole(o) ? " · " + officerRole(o) : "")) + "</span>" +
          relWord(PC.npcs.rungName(o.rung)) + "</div></button>";
      }).join("") + actingQMCard();
  }

  // The Acting Quartermaster (§25.9): a crewman, shown with the silhouette.
  function actingQMCard() {
    var q = state.actingQM;
    if (!q || !q.active) return "";
    return '<div class="off">' + sil(44, 66) + "<div><b>" + esc(q.full) + "</b><span>Acting Quartermaster</span><span class=\"note\">One of the crew</span></div></div>";
  }

  function phoneStrip() {
    var c = state.captain, sh = state.ship, pic = PC.creator.captainPortrait(c);
    return '<button class="pstrip" data-act="openmenu" data-menu="captain">' + (pic ? '<img src="' + assetUrl(pic) + '" alt="">' : "") +
      '<span class="ptext"><b>' + esc((c.first + " " + c.last).trim()) + "</b> · <i>" + esc(sh.name) + "</i><br>Purse " + gold(state.money.purse) + " · Crew " + gold(state.money.crew) +
      "<br>Hull " + Math.round(sh.hull) + "/" + sh.hullMax + " · " + plural(state.crew.count, "hand") + " · Morale " + state.crew.morale + '</span><span class="go">›</span></button>' +
      (aboard().length ? '<div class="pfaces">' + aboard().map(function (o) {
        return '<button class="link" data-act="openmenu" data-menu="officer:' + esc(o.id) + '" aria-label="' + esc(o.first) + '">' + officerFace(o, 30, 45) + "</button>";
      }).join("") + '<span class="note">Officers · tap for cards</span></div>' : "");
  }

  function jdot() { return state.journalDot ? '<span class="jdot" title="Something new in your Journal"></span>' : ""; }

  function tabBar() {
    var atNode = state.current.screen === "node";
    var b = function (k, t, a, extra) { return '<button data-act="' + a + '"' + (extra || "") + ">" + ic(k) + t + "</button>"; };
    return '<nav class="tabbar">' + b("journal", "Journal" + jdot(), "openmenu", ' data-menu="journal"') + b("rumor", "Rumors", "openmenu", ' data-menu="rumors"') +
      b("captain", "Captain", "openmenu", ' data-menu="captain"') + b("ship", "Ship", "goplace", ' data-place="ship"' + (atNode ? "" : " disabled")) + b("menu", "Menu", "openmenu", ' data-menu="menu"') + "</nav>";
  }

  // ---- Choices (§38.6, §41.1) -------------------------------------------------
  // One row for every kind of option: scene choices, node services and the
  // minigames. o: { act, attrs, label, check, meta, lock, ap, opener, done, html }

  function oddsBox(chk) {
    return '<div class="odds" hidden><div class="r"><span class="sc">' + esc(chk.type) + "</span><span>" + pct(chk.odds.partialOrBetter) + " success · " + pct(chk.odds.clean) + " clean</span></div>" +
      chk.parts.map(function (p) { return '<div class="r muted"><span>' + esc(p.label) + "</span><span>" + signed(p.value) + "</span></div>"; }).join("") +
      (chk.modsCapped ? '<div class="r muted"><span>Traits and tags are capped at ±3.</span><span></span></div>' : "") +
      (chk.rawEdge !== chk.edge ? '<div class="r muted"><span>Edge is clamped to −4…+6.</span><span></span></div>' : "") +
      '<div class="r tot"><span>Edge</span><span>' + signed(chk.edge) + "</span></div></div>";
  }

  function manicule(op) {
    if (!op) return "";
    var title = op.kind === "flaw" ? "Your " + op.name + " streak" : "Your " + op.name;
    return '<span class="manicule ' + (op.kind === "flaw" ? "flaw" : "trait") + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">☞</span> ';
  }

  function opt(o) {
    var locked = !!o.lock;
    var check = o.check && !locked ? o.check : null;
    return '<li class="choice' + (locked ? " locked" : "") + (o.done ? " done" : "") + '"><div class="row">' +
      '<button class="pick" data-act="' + o.act + '" ' + (o.attrs || "") + (o.ap ? ' data-cost-ap="' + o.ap + '"' : "") + (locked ? " disabled" : "") + ">" +
      "<span>" + manicule(o.opener) + (o.html || inline(o.label)) + "</span></button>" +
      (check ? '<button class="oddsbtn ' + (TIER_CLASS[check.tier] || "t-mid") + '" data-act="toggleodds" title="Show the odds"><span>' + tierWord(check.tier) + CARET + "</span></button>" : "") +
      "</div>" + (o.meta ? '<div class="meta">' + o.meta + "</div>" : "") + (locked ? '<div class="meta lock">' + esc(o.lock) + "</div>" : "") +
      (check ? oddsBox(check) : "") + "</li>";
  }
  function opts(list) { return '<ol class="choices">' + list.filter(Boolean).join("") + "</ol>"; }
  function apText(n) { return n ? "(" + plural(n, "action") + ")" : "No action"; }

  // ---- Art slots (§38.3) ----

  function banner(label) {
    return '<div class="banner"><p>Woodcut banner · ' + esc(label) + "<small>3 : 1 · art spec 1800 × 600</small></p></div>";
  }
  function plate(label) {
    return '<div class="plate"><div class="art"><p>Color plate · ' + esc(label) + '<br><small>replaces the banner for this scene · 3 : 2 · art spec 1500 × 1000</small></p></div></div>';
  }
  // A Named NPC's portrait frame, unnamed until met (§41.1).
  function castFrame(id) {
    if (!id || !(id in (PC.data.npcPortraits || {}))) return "";
    var n = PC.npcs.get(state, id);
    if (!n) return "";
    var known = PC.npcs.known(state, id);
    var name = known ? n.full || (n.first + " " + n.last) : (n.label ? titleCase(n.label.replace(/^the /, "")) : "A stranger");
    var art = PC.data.npcPortraits[id];
    return '<div class="castframe">' + (art ? '<img class="frame" src="' + assetUrl(art) + '" alt="">' : '<div class="frame"><span>Portrait<br>' + esc(name) + "<br><small>2 : 3 · 640 × 960</small></span></div>") +
      '<div class="cap">' + esc(known ? name : "") + "</div></div>";
  }

  // ---- Scenes ---------------------------------------------------------------

  function placeInfo(key) {
    var nd = state.location ? N().nodeData(N().here(state)) : null;
    var pl = nd && nd.present ? nd.present.places[key] : null;
    return { node: nd ? nd.name : "", heading: pl ? pl.heading : titleCase(key || ""), banner: pl ? pl.banner : key };
  }

  // The heading names the place until the person is met (§38.5, §41.1).
  function sceneHead(v) {
    var meta = PC.scenes.sceneMeta(v.id) || {};
    var pl = placeInfo(meta.place);
    var who = meta.person && PC.npcs.known(state, meta.person) ? PC.npcs.get(state, meta.person) : null;
    var heading = meta.heading || (who ? (who.full || who.first + " " + who.last) : meta.place ? pl.heading : v.title);
    var s = PC.scenes.sceneById(v.id);
    var line = pl.node ? pl.node + " · " + pl.heading : v.where;
    return { line: line, heading: heading, banner: meta.plate && v.phase === "choosing" ? null : (meta.place ? pl.banner : v.where), plate: meta.plate || null,
      quest: meta.quest || null, ap: s.ap || 0, person: meta.person || null };
  }

  function scenePanel() {
    var v = PC.scenes.viewScene(state);
    var h = sceneHead(v);
    var html = '<div class="where">' + esc(h.line) + "</div>" + (h.plate ? plate(h.plate) : banner(h.banner)) +
      (h.quest ? '<div class="ribbon">' + esc(h.quest) + (h.ap ? '<span class="apnote">(' + plural(h.ap, "action") + ")</span>" : "") + "</div>" : "") +
      '<h2 class="title">' + esc(h.heading) + "</h2>";
    var body = "";
    if (v.phase === "choosing") {
      var lead = state.current.lead;
      if (lead) body += resultBits(lead, true);
      var fresh = state.current.again == null && !lead;
      body += '<div class="prose' + (fresh ? " dropcap" : "") + '">' + prose(v.setup) + "</div>" + DIVIDER;
      body += opts(v.choices.map(function (c) {
        return opt({ act: "choose", attrs: 'data-i="' + c.index + '"', label: c.label, check: c.check, lock: c.status === "locked" ? c.reason : null,
          meta: c.cost && c.cost.gold ? "Costs " + gold(c.cost.gold) + " gold from " + (c.cost.pot === "purse" ? "your purse" : "crew gold") : null, opener: c.opener });
      }));
    } else {
      body += resultPanel(v.result);
    }
    return '<div class="scene-cols"><div class="scene-main">' + html + body + "</div>" + castFrame(h.person) + "</div>";
  }

  function diceLine(roll) {
    if (!roll || !state.settings.showDice) return "";
    return '<div class="dice">Dice ' + roll.dice[0] + " + " + roll.dice[1] + ", edge " + signed(roll.edge) + " = " + roll.total + "</div>";
  }

  // Officer approval: small faces with an up or down mark (§38.6), read
  // from the choice's approval tags against each officer's likes.
  function approvalChip(tags) {
    if (!tags || !tags.length) return null;
    var faces = aboard().map(function (o) {
      var lk = PC.officers.likesOf(o), up = 0;
      tags.forEach(function (t) { if (lk.likes.indexOf(t) >= 0) up++; if (lk.dislikes.indexOf(t) >= 0) up--; });
      if (!up) return "";
      return '<span class="appr" title="' + esc(o.first + (up > 0 ? " approves" : " disapproves")) + '">' + officerFace(o, 22, 32) +
        '<span style="color:' + (up > 0 ? INK.good : INK.bad) + '">' + ic(up > 0 ? "up" : "down", "mark", 2) + "</span></span>";
    }).filter(Boolean);
    return faces.length ? { icon: "officer", ink: "good", html: faces.join(" ") + " Officers" } : null;
  }

  // Strike First (§11.4): the automatic opening roll of a close fight, in
  // the same result styling (§38.6).
  function strikeFirstLine(sf) {
    if (!sf) return "";
    var t = sf.value > 0 ? "You strike first: +1 on the first clash." : sf.value < 0 ? "It gets the jump: −1 to you on the first clash." : "Neither of you gets the jump.";
    return '<p class="sfline" style="color:' + (sf.value > 0 ? INK.good : sf.value < 0 ? INK.bad : "inherit") + '">' + esc(t) +
      (state.settings.showDice && sf.dice ? ' <span class="note">(Strike First: dice ' + sf.dice.join(" + ") + ", edge " + sf.edge + ")</span>" : "") + "</p>";
  }

  function resultBits(r, compact) {
    var html = '<p class="you-chose">' + inline(r.choiceLabel || r.label) + "</p>";
    if (r.firstRoll) html += '<p class="note">First roll: ' + OUTCOME[r.firstRoll.outcome][0] + ". Rerolled with " + esc(r.firstRoll.by) + ".</p>";
    html += strikeFirstLine(r.strikeFirst) + badge(r.outcome) + diceLine(r.roll);
    if (r.text) html += '<div class="prose">' + prose(r.text) + "</div>";
    var list = (r.chips || []).slice();
    var ap = approvalChip(r.approval);
    if (ap) list.push(ap);
    if (list.length) html += (compact ? "" : '<div class="h4" style="max-width:680px">What came of it</div>') + chips(list);
    return html + (compact ? DIVIDER : "");
  }

  function resultPanel(r) {
    var html = resultBits(r, false) + '<div class="actions">';
    if (r.reroll) html += '<button class="secondary" data-act="reroll">Reroll (' + esc(r.reroll.name) + ")</button>";
    if (r.needsPot) {
      html += '</div><p style="font-size:20px;margin:16px 0 10px">Where does the ' + gold(r.potGold) + ' gold go?</p><div class="actions">' +
        '<button data-act="commit" data-pot="purse" data-top="1" class="primary">Into your purse · ' + gold(r.potGold) + "</button>" +
        '<button data-act="commit" data-pot="crew" data-top="1" class="secondary">Share it with the crew · ' + gold(r.potGold) + "</button>";
    } else {
      html += '<button data-act="commit" data-top="1" class="primary">Continue</button>';
    }
    return html + "</div>";
  }

  // The engine's old test harbor (reachable from Developer only, §41.4).
  function hubPanel() {
    var h = PC.scenes.viewHub(state);
    return '<h2 class="title">' + esc(h.title) + '</h2><div class="prose">' + prose(h.text) + "</div>" +
      opts(h.entries.map(function (en) {
        return opt({ act: "enter", attrs: 'data-scene="' + esc(en.scene) + '"', label: en.label, ap: en.ap, meta: en.ap ? apText(en.ap) : null, lock: en.ok ? null : en.why });
      })) + '<div class="actions"><button class="secondary" data-act="endseason">End the season</button></div>';
  }

  // ---- The node (§17, §41.4-§41.11) ----------------------------------------
  // The rules are in js/node.js, js/crew.js and js/articles.js; this only
  // draws them. Numbers come from steppers (§41.1), read when a button is
  // pressed (data-for names the box).

  function N() { return PC.node; }

  // How many of something crew gold can pay for (the steppers cap here, so
  // the player never has to do the sum; ruled November 14).
  function afford(each) { return each > 0 ? Math.floor(state.money.crew / each + 1e-9) : Infinity; }

  // A stepper (§41.1). Its running total lives in a total slot whose text
  // is rebuilt from the boxes as the numbers move, without a redraw.
  var liveTotals = [];
  function qstep(id, value, max, min, withMax) {
    min = min == null ? 1 : min;
    value = Math.max(min, Math.min(max, value));
    return '<span class="stepper"><button type="button" data-step="' + id + '" data-d="-1" aria-label="Fewer">−</button>' +
      '<input id="' + id + '" type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + value + '">' +
      '<button type="button" data-step="' + id + '" data-d="1" aria-label="More">+</button></span>' +
      // Max fills the box in one tap (the author's phone notes).
      (withMax && max > 1 ? '<button type="button" class="maxbtn" data-step="' + id + '" data-d="max">Max</button>' : "");
  }
  function totalSlot(fn, cls) {
    var id = "tot" + liveTotals.length;
    liveTotals.push({ id: id, fn: fn });
    return '<span class="' + (cls == null ? "total" : cls) + '" id="' + id + '"></span>';
  }
  function val(id) { var el = document.getElementById(id); return el ? Math.max(0, Math.floor(Number(el.value)) || 0) : 0; }
  function refreshTotals() {
    liveTotals.forEach(function (t) { var el = document.getElementById(t.id); if (el) el.innerHTML = t.fn(); });
  }

  function npcName(id) {
    var n = PC.npcs.get(state, id);
    return n ? ((n.title ? n.title + " " : "") + n.full) : id;
  }

  // A person's name card (§41.5): name, role, relationship word, known traits.
  function nameCard(id, roleWord) {
    var n = PC.npcs.get(state, id);
    if (!n) return "";
    var known = (state.npcs[n.id] || {}).knownTraits || [];
    return '<div class="namecard"><b>' + esc(npcName(id)) + "</b>" + (roleWord ? '<span class="role">' + esc(roleWord) + "</span>" : "") +
      relWord(n.rungName) + (known.length ? '<span class="traits">' + esc(known.join(", ")) + "</span>" : "") + "</div>";
  }

  // What was last said, under the person it was said to (§41.1).
  function sayFor(who) {
    var s = state.location.say;
    if (!s || (s.to || null) !== (who || null)) return "";
    var html = '<div class="say">';
    if (s.who) html += '<div class="who">' + esc(s.who) + "</div>";
    if (s.ask) html += '<p style="font-style:normal;margin:0 0 6px">You: “' + esc(s.ask) + '”</p>';
    if (s.line) html += inline(PC.text.render(s.line, state));
    if (s.heard && s.heard.length) html += '<ul class="heard">' + s.heard.map(function (h) { return "<li>" + inline(h) + "</li>"; }).join("") + "</ul>";
    if (s.heardNote) html += '<span class="snote">' + esc(s.heardNote) + "</span>";
    if (s.note) html += '<span class="snote">' + esc(s.note) + "</span>";
    return html + "</div>" + (s.chips && s.chips.length ? chips(s.chips) : "");
  }

  // to: the person the exchange belongs under (an NPC id), or null for the
  // place itself. who: the speaker's label.
  // Two quoted lines spoken as one: drop the first's closing quote and the
  // second's opening quote, so the ellipsis runs straight on.
  function joinQuotes(a, b) {
    var A = String(a).replace(/"\s*$/, ""), B = String(b).replace(/^\s*"/, "");
    return A + " " + B;
  }

  function say(to, who, line, note, heard, extra) {
    state.location.say = { to: to || null, who: who || null, line: line || "", note: note || null, heard: heard || null };
    if (extra) Object.keys(extra).forEach(function (k) { state.location.say[k] = extra[k]; });
  }

  function nodeHead(key) {
    var pl = placeInfo(key);
    return '<div class="where">' + esc(pl.node + (key === "town" ? "" : " · " + pl.heading)) + "</div>" + banner(pl.banner) +
      '<h2 class="title">' + esc(pl.heading) + "</h2>";
  }

  var CONTROL = { "No control": ["No Control", "none"], "Pirate control": ["Pirate Control", "pirates"], "Frisian control": ["Frisian Control", "frisia"], "Avalon control": ["Avalon Control", "avalon"] };
  function flagSvg(ink) {
    return '<svg class="flag" viewBox="0 0 22 15" aria-hidden="true"><rect width="22" height="15" fill="' + (ink === "none" ? "#efe3c6" : INK[ink]) + '"/>' +
      (ink === "none" ? '<path d="M0 0L22 15M22 0L0 15" stroke="#5e4528" stroke-width=".8"/>' : "") + "</svg>";
  }

  function nodePanel() {
    var nd = N().nodeData(N().here(state));
    var place = state.location.place;
    if (!place) return townPanel(nd);
    var html = nodeHead(place);
    var loc = nd.locations[place];
    // A scene is waiting (Welcome to the Underworld after the first Tavern
    // action): let the player read what was just said, then go on.
    if ((state.location.queue || []).some(function (q) { return !state.seen[q]; })) {
      return html + sayFor(state.location.say ? state.location.say.to : null) + '<div class="actions"><button class="primary" data-top="1" data-act="nextqueued">Continue</button></div>';
    }
    html += '<div class="prose dropcap">' + prose(loc.blurb) + "</div>";
    var back = function (top) { return '<div class="actions"' + (top ? ' style="margin:0 0 6px"' : "") + '><button class="secondary" data-act="leaveplace">‹ Back to ' + esc(nd.name) + "</button></div>"; };
    html = back(true) + html;
    html += ({ tavern: tavernMenu, docks: docksMenu, merchant: merchantMenu, graveyard: graveyardMenu, ship: shipMenu })[place]();
    return html + DIVIDER + back(false);
  }

  // The town screen (§41.4): the control line, then Town, Your ship, To sea.
  function townPanel(nd) {
    var c = CONTROL[nd.control] || [nd.control, "none"];
    var pres = nd.present || { places: {} };
    var html = '<div class="ctrl" style="color:' + INK[c[1]] + '">' + flagSvg(c[1]) + esc(c[0]) + (nd.freePort ? " · Free Port" : "") + " · " + esc(pres.prosperityWord || nd.tier) + "</div>" +
      banner(pres.places.town ? pres.places.town.banner : nd.name) + '<h2 class="title">' + esc(nd.name) + '</h2><div class="prose dropcap">' + prose(nd.blurb) + "</div>";
    var ps = N().places(state).filter(function (p) { return !p.hidden; });
    var row = function (p) {
      var pl = pres.places[p.id] || {};
      var hint = pl.hint ? pl.hint + (p.id === "merchant" && N().fenceOpen(state) && pl.hintFence ? ", " + pl.hintFence : "") : null;
      return opt({ act: "goplace", attrs: 'data-place="' + p.id + '"', label: pl.heading || p.name, meta: hint ? esc(hint) : null, lock: p.locked ? p.why : null });
    };
    html += '<div class="h4" style="max-width:680px">Town</div>' + opts(ps.filter(function (p) { return p.id !== "ship"; }).map(row));
    html += '<div class="h4" style="max-width:680px">Your ship</div>' + opts(ps.filter(function (p) { return p.id === "ship"; }).map(row));
    html += '<div class="h4" style="max-width:680px">To sea</div>' + opts([
      // Leaving Ocracoke without Articles fires the first signing (§40.5).
      // Hunt for Prizes (§22.1, §37.3): Ocracoke's own waters, 1 action a batch.
      (function () {
        if (!state.articles) return opt({ act: "firstsigning", label: "Hunt for Prizes", meta: "Sign the Articles before you sail" });
        var c = PC.hunt.canHunt(state);
        return opt({ act: "hunt", label: "Hunt for Prizes", ap: 1, meta: "1 action a batch of sightings, up to 3 · the Hatteras Banks · back to Ocracoke for free (the harbor due again)", lock: c.ok ? null : c.why });
      })(),
      opt({ act: state.articles ? "nop" : "firstsigning", label: "Set Sail", meta: "The world map" + (state.articles ? "" : " · sign the Articles before you sail"), lock: state.articles ? notInPrototype() : null }),
    ]);
    if (!state.ap.left) html += '<p class="notice" style="margin-top:16px">No actions left this season.</p>';
    return html;
  }
  function notInPrototype() { return settings.dev ? "Not in the prototype (the hunt arrives in Milestone 5)" : "Not in the prototype"; }

  // ---- Tavern (§41.5) ----

  function tavernMenu() {
    var id = N().here(state);
    var keeper = N().slotNpc(id, "keeper");
    var L = N().nodeData(id).lines.keeper;
    var first = !state.flags[N().FLAGS.tavernDone];
    var asked = PC.rumors.keeperAsked(state);
    var talk = PC.checks.assess(state, PC.rumors.talkCheck(state), { conditions: ["Harbor"] });
    var html = '<div class="block">' + nameCard(keeper, "Tavern Keeper") + sayFor(keeper);
    var list = [opt({ act: "rumors", label: "“" + L.askRumors + "”", check: asked ? null : talk, done: asked,
      meta: asked ? "You've heard this season's rumors." : "No action. A clean Tavern Talk gets one more." })];
    // The keeper's other questions (§38.11, §41.5).
    N().keeperQuestions(state).forEach(function (q) {
      list.push(opt({ act: "keeperq", attrs: 'data-q="' + esc(q.id) + '"', label: "“" + q.label + "”", meta: "No action", done: q.asked }));
    });
    html += opts(list);
    // Lodging (§24.12): Shore Leave and Long Shore Leave.
    html += '<p class="note" style="margin:14px 0 6px">“' + esc(L.lodgingAsk) + '”</p>' + opts([1, 2].map(function (ap) {
      var c = N().lodgingCheck(state, ap);
      var gain = (ap === 2 ? 15 : 10) + (N().nodeData(id).freePort ? 5 : 0);
      return opt({ act: "lodging", attrs: 'data-ap="' + ap + '"', label: (ap === 2 ? "Long Shore Leave " : "Shore Leave ") + apText(ap), ap: ap,
        meta: gold(N().lodgingCost(state, ap)) + " crew gold · morale +" + gain, lock: c.ok ? null : c.why });
    })) + "</div>";
    if (first) {
      html += '<p class="note" style="max-width:680px">This is your first visit to the Tavern. Ask ' + esc(PC.npcs.get(state, keeper).first) + " for rumors" +
        (N().oneArmedHere(state) ? ", talk to the one-armed pirate" : "") + ", or leave; the rest opens once your first visit is done.</p>";
    }
    html += DIVIDER + '<div class="block"><div class="h4">Around the Tavern</div>' + sayFor("around");
    var list2 = [];
    if (N().oneArmedHere(state)) list2.push(opt({ act: "oneArmed", label: "Talk to the one-armed pirate", meta: "He sits with his mates, drinking." }));
    var dk = PC.drinking.canDrink(state);
    list2.push(opt({ act: "drink", label: "Under the Table " + apText(1), ap: 1, meta: "Drink with a pirate. Once a season; the loser pays the " + PC.data.minigames.drinking.TAB[N().nodeData(id).tier] + "-gold tab from your purse. Win a rumor.", lock: dk.ok ? null : dk.why }));
    var lp = PC.liarsdice.canPlay(state), st = PC.liarsdice.stakes(state);
    list2.push(opt({ act: "dice", label: "Liar's Dice " + apText(1), ap: 1, meta: "Up to " + PC.data.minigames.dice.GAMES_PER_SESSION + " games a sitting, " + st[0] + "-" + st[1] + " gold a game from your purse.", lock: lp.ok ? null : lp.why }));
    var gi = N().tavernServiceCheck(state, 1);
    list2.push(opt({ act: "gather", label: "Gather Intelligence " + apText(1), ap: 1, meta: "Ask around town. Clean: you pick what kind of rumor. Partial: one rumor.",
      check: gi.ok ? PC.checks.assess(state, PC.rumors.gatherCheck(state), { conditions: ["Harbor"] }) : null, lock: gi.ok ? null : gi.why }));
    html += opts(list2);
    if (state.location.gatherPick) {
      html += '<div class="hotmenu"><p class="sc" style="margin:0 0 6px">What do you want to hear about?</p><div class="actions" style="margin:0">' + PC.rumors.gatherTypes(state).map(function (t) {
        return '<button class="secondary" data-act="gatherpick" data-type="' + esc(t) + '">' + esc(t) + "</button>";
      }).join("") + "</div></div>";
    }
    return html + "</div>" + DIVIDER + officersBlock();
  }

  // Officer recruitment (§25.7): two seats a season.
  function officersBlock() {
    var html = '<div class="block"><div class="h4">Officers for hire</div>' + sayFor("officers");
    var chk = N().tavernServiceCheck(state, 0);
    if (!chk.ok) return html + '<p class="note">' + esc(chk.why) + ".</p></div>";
    html += '<p class="note">Hiring takes 1 action, however many you hire this visit.' + (PC.officers.apNeeded(state) ? "" : " This visit's action is already spent.") + "</p>";
    PC.officers.candidates(state).forEach(function (c) {
      var held = PC.officers.holding(state, c.type);
      var hc = PC.officers.hireCheck(state, c);
      var art = c.named && PC.data.npcPortraits && (c.id in PC.data.npcPortraits) ? castFrame(c.id) : null;
      html += '<div class="person" style="margin:14px 0">' + (art ? art.replace('class="castframe"', 'class="castframe" style="flex:0 0 72px"').replace(/width:150px/, "") : sil(72, 108)) +
        '<div class="pmain"><div class="namecard"><b>' + esc(c.full || (c.first + " " + c.last)) + '</b><span class="role">' + esc(c.type) + ", " + c.age + "</span></div>" +
        '<div class="prose" style="font-size:18.5px">' + prose(PC.officers.hiringText(state, c)) + "</div>" +
        (held ? '<p class="note">Hiring ' + esc(c.first) + " replaces " + esc(held.first) + (held.mentor ? ", your mentor," : "") + " (your " + esc(held.type) + "), who is dismissed with " + PC.officers.dismissPay(state) + " crew gold.</p>" : "") +
        '<div class="actions" style="margin-top:6px"><button class="primary" data-act="hireofficer" data-officer="' + esc(c.id) + '"' + (PC.officers.apNeeded(state) ? ' data-cost-ap="1"' : "") + (hc.ok ? "" : " disabled") + ">Hire " + esc(c.first) + " · " + gold(PC.officers.FEE) + " crew gold</button>" +
        (hc.ok ? "" : '<span class="lock">' + esc(hc.why) + "</span>") + "</div></div></div>";
    });
    return html + "</div>";
  }

  // ---- Docks (§41.8) ----

  var TIER_TIP = {
    Green: "New to the sea. Counts 0 toward the crew's Skill.",
    Able: "A trained sailor. Counts 1 toward the crew's Skill.",
    Seasoned: "Has weathered fights and storms. Counts 2 toward the crew's Skill.",
    Veteran: "A hardened hand. Counts 3 toward the crew's Skill.",
  };

  function hullBar(sh, w) {
    return '<span class="hbar" style="display:inline-block;width:' + (w || 120) + 'px;vertical-align:middle;margin:0 6px"><i style="width:' + Math.round(100 * sh.hull / sh.hullMax) + '%;background:#5e4528"></i></span>';
  }

  function shipLine() {
    var sh = state.ship, art = PC.data.shipArt(sh.type);
    return '<div class="person" style="align-items:center;margin:8px 0 12px">' + (art ? '<img src="' + assetUrl(art) + '" alt="" style="width:72px;height:80px;object-fit:cover;border:1px solid #6b5030">' : "") +
      '<div class="pmain"><b class="gp" style="font-size:22px;font-weight:normal"><i>' + esc(sh.name) + "</i></b>, your " + esc(sh.type.toLowerCase()) +
      '<br><span class="small">Hull ' + sh.hull + " of " + sh.hullMax + hullBar(sh) + " · " + sh.guns + " of " + sh.gunsMax + " guns · rigging " + (sh.rigging === "frayed" ? "Frayed" : "Sound") + "</span></div></div>";
  }

  function levelPips(u, cap) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<i style="display:inline-block;width:13px;height:13px;border-radius:50%;margin-right:4px;border:1.5px solid #4a3418;' + (i <= u.level ? "background:#5e4528;" : "") + (i === cap ? "box-shadow:0 0 0 2px #c99f45;" : "") + '"' + (i === cap ? ' title="This yard tops out here"' : "") + "></i>";
    }
    return out;
  }

  function docksMenu() {
    var id = N().here(state), sh = state.ship;
    var wright = N().slotNpc(id, "shipwright");
    var g = N().shipwrightGreeting(state);
    var html = '<div class="block">' + nameCard(wright, "Shipwright");
    html += state.location.say && state.location.say.to === wright ? sayFor(wright) : '<div class="say">' + inline(g.line) + "</div>";
    if (!g.refuse) {
      html += shipLine();
      var missing = sh.hullMax - sh.hull;
      var per = N().repairPerHp(state);
      html += '<div class="svc"><h4>Repairs</h4>';
      if (missing > 0) {
        var fix = Math.max(1, Math.min(missing, afford(per)));
        html += '<div class="buyrow">' + qstep("q-repair", fix, fix) + '<button class="secondary" data-act="repair" data-for="q-repair">Repair</button> ' +
          totalSlot(function () { var n = val("q-repair"); return n + " points · " + gold(N().repairCost(state, n)) + " gold" + (N().repairTakesAP(state, n) ? " · 1 action" : ""); }) + "</div>" +
          '<div class="actions" style="margin-top:8px"><button class="secondary" data-act="repair" data-all="1"' + (N().repairTakesAP(state, missing) ? ' data-cost-ap="1"' : "") + ">Repair all · " + gold(N().repairCost(state, missing)) + " gold" + (N().repairTakesAP(state, missing) ? " · 1 action" : "") + "</button></div>" +
          '<p class="note">' + gold(per) + " gold a point. A repair of " + Math.ceil(0.25 * sh.hullMax) + " points or more takes an action." + (sh.rigging === "frayed" ? " Any repair fixes the frayed rigging." : "") + "</p>";
      } else html += '<p class="note">Nothing to fix.</p>';
      html += "</div>";
      html += '<div class="svc"><h4>Upgrades</h4><div class="opts">' + ["hull", "rigging", "guns"].map(function (t) {
        var u = N().upgradeInfo(state, t);
        var cap = N().nodeData(id).yardMax;
        return '<div class="opt" style="cursor:default"><b class="sc">' + esc(u.name) + "</b><span>" + levelPips(u, cap) + "</span>" +
          (u.locked ? '<span class="small">' + esc(u.locked) + "</span>" : '<span class="small">Level ' + u.next + ": " + esc(u.effect) + '</span><button class="secondary" style="margin-top:6px" data-act="upgrade" data-track="' + t + '">Buy · ' + gold(u.cost) + " gold</button>") + "</div>";
      }).join("") + "</div></div>";
      var room = sh.gunsMax - sh.guns;
      var gunsMax = Math.min(room, afford(N().gunPrice(state)));
      html += '<div class="svc"><h4>Guns</h4><p class="small">' + sh.guns + " of " + sh.gunsMax + " guns · " + gold(N().gunPrice(state)) + " gold a gun.</p>" +
        (room <= 0 ? '<p class="note">Every gun port is full.</p>' : gunsMax > 0 ? '<div class="buyrow">' + qstep("q-guns", 1, gunsMax) + '<button class="secondary" data-act="guns" data-for="q-guns">Buy guns</button> ' +
          totalSlot(function () { var n = val("q-guns"); return plural(n, "gun") + " · " + gold(n * N().gunPrice(state)) + " gold"; }) + "</div>" : '<p class="note">You can\'t pay for a gun right now.</p>') + "</div>";
    }
    // Your other ships: sell a prize hull, or strip her guns (§22.7, Milestone 5).
    var fl = state.fleet || [];
    if (fl.length) {
      html += '<div class="svc"><h4>Your other ships</h4>' + fl.map(function (f) {
        var p = N().hullSalePrice(state, f);
        var room = state.ship.gunsMax - state.ship.guns;
        return '<div class="buyrow" style="flex-wrap:wrap"><span><b>' + esc(f.name || f.cls) + '</b> <span class="note">' + esc(f.cls + " · " + (f.kind === "fleet" ? "fleet ship" : "prize ship") + (f.dirty ? " · dirty" : "") +
          " · hull " + Math.round(f.hull) + "/" + f.hullMax + " · " + f.guns + " guns · " + f.crew + " aboard") + "</span></span> " +
          (p.ok ? '<button class="secondary" data-act="sellhull" data-ship="' + esc(f.id) + '">Sell her · ' + gold(p.total) + " gold</button>" : '<span class="note">' + esc(p.why) + "</span>") +
          (f.guns && room > 0 ? '<button class="secondary" data-act="stripguns" data-ship="' + esc(f.id) + '">Move ' + Math.min(f.guns, room) + " guns to your flagship</button>" : "") + "</div>" +
          (p.ok ? '<p class="note" style="margin:2px 0 8px">Hull ' + gold(p.hull) + (p.repair ? " (after " + gold(p.repair) + " of repairs)" : "") + " + guns " + gold(p.guns) + ". Her hands come back aboard; any without a berth are paid off.</p>" : "");
      }).join("") + "</div>";
    }
    html += "</div>" + DIVIDER;
    // Hands on the Docks (§24.7, §41.8)
    var avail = N().poolAvailable(state);
    var berths = PC.crew.berths(state);
    html += '<div class="block"><div class="h4">Hands on the Docks</div>' + sayFor("hands") + docksRollBlock();
    var tiers = PC.data.economy.TIER_ORDER.filter(function (t) { return avail[t] || (N().season(state).pool[t]); });
    if (!tiers.length) html += '<p class="note">Nobody is looking for a berth.</p>';
    else {
      html += '<table class="grid"><tr><th>Hands</th><th>Waiting</th><th>Each</th><th>Sign</th></tr>' + tiers.map(function (t) {
        var max = Math.min(avail[t], berths, afford(N().signingCost(state, t)));
        return '<tr><td><span title="' + esc(TIER_TIP[t] || "") + '" style="border-bottom:1px dotted">' + t + "</span></td><td>" + avail[t] + "</td><td>" + gold(N().signingCost(state, t)) + "</td><td>" +
          (max > 0 ? qstep("q-hire-" + t, 0, max, 0, true) : '<span class="note">' + (!avail[t] ? "None left" : !berths ? "No berths" : "Not enough crew gold") + "</span>") + "</td></tr>";
      }).join("") + "</table>";
      html += '<div class="actions">' + '<button class="primary" data-act="signhands" data-tiers="' + tiers.join(",") + '">' +
        totalSlot(function () {
          var n = 0, cost = 0, ask = {}, asked = 0;
          tiers.forEach(function (t) { ask[t] = val("q-hire-" + t); asked += ask[t]; });
          var p = N().trimPlan(state, ask);
          tiers.forEach(function (t) { n += p[t]; cost += p[t] * N().signingCost(state, t); });
          var cut = asked - n;
          return "Sign " + plural(n, "hand") + " · " + gold(cost) + " crew gold · " + (state.crew.count + n) + " of " + sh.crewMax + " berths" +
            (cut ? " (" + cut + " fewer: " + Object.keys(p.left).map(function (t) { return p.left[t] + " " + t; }).join(", ") + " stay on the docks)" : "");
        }, "") + "</button></div>";
    }
    // Put hands ashore (§24.7)
    var each = PC.crew.payOffEach(state);
    var have = PC.data.economy.TIER_ORDER.filter(function (t) { return state.crew.tiers[t]; });
    if (have.length) {
      html += '<details class="svc" style="margin-top:16px"><summary class="sc" style="cursor:pointer;color:#5e4528">Put hands ashore</summary><p class="small">Each leaves with half a share: ' + each + " crew gold. No hard feelings.</p>" +
        '<table class="grid">' + have.map(function (t) {
          return "<tr><td>" + t + "</td><td>" + state.crew.tiers[t] + ' aboard</td><td><div class="buyrow">' + qstep("q-off-" + t, 1, state.crew.tiers[t]) +
            '<button class="secondary" data-act="payoff" data-tier="' + t + '" data-for="q-off-' + t + '">Put ashore</button></div></td></tr>';
        }).join("") + "</table></details>";
    }
    return html + "</div>";
  }

  // ---- Optional rolls (§41.1): marked optional, every outcome stated ----

  // Haggle (§11.4 as changed by §41.13): once per merchant per season,
  // before the first trade there.
  function haggleBlock(npc) {
    var c = N().haggleCheck(state, npc), h = (N().season(state).haggle || {})[npc];
    if (h) {
      var pct = Math.round(Math.abs(N().HAGGLE[h]) * 100);
      // The result stands out as a result (the author's phone notes).
      return '<div class="haggled">' + badge(h) + '<p style="margin:0"><b>' + (N().HAGGLE[h] > 0 ? "You talked the prices down" : "The haggling went badly") + ":</b> prices " + pct + "% " +
        (N().HAGGLE[h] > 0 ? "in your favor" : "against you") + " here this season.</p></div>";
    }
    if (!c.ok) return "";
    return opts([opt({ act: "haggle", attrs: 'data-npc="' + esc(npc) + '"', label: "Haggle (optional)",
      check: PC.checks.assess(state, N().haggleRoll(state, npc), { conditions: N().haggleConditions(state, npc) }),
      meta: "No action · once a season, before your first trade here. Clean: prices 10% in your favor. Partial: 5% in your favor. Setback: 10% against you." })]);
  }

  // The Docks roll (§11.4, §41.8): once a visit, before signing.
  function docksRollBlock() {
    var d = state.location.docksRoll;
    if (d && d.visit === state.location.visit) {
      var t = d.outcome === "clean" ? "a third of the hands you sign come aboard a tier better" + (d.upgraded ? " (" + d.upgraded + " so far)" : "") :
        d.outcome === "setback" ? (d.lost ? plural(d.lost, "Seasoned or Veteran hand") + " signed elsewhere" : "nobody worth losing was waiting") : "the hands are what they look like";
      return '<p class="small"><b>Sized up the hands (' + OUTCOME[d.outcome][0].toLowerCase() + "):</b> " + esc(t) + ".</p>";
    }
    var c = N().docksRollCheck(state);
    if (!c.ok) return "";
    return opts([opt({ act: "docksroll", label: "Size up the hands (optional)",
      check: PC.checks.assess(state, N().docksCheck(state), { conditions: ["Harbor", "Underworld"] }),
      meta: "No action · once a visit, before you sign. Clean: a third of the hands you sign come a tier better. Setback: a third of the pool's Seasoned and Veteran hands are gone." })]);
  }

  // ---- Merchant (§41.9) ----

  function holdBar() {
    var p = state.provisions, goods = PC.crew.goodsUnits(state), tc = state.cargo.treasure.clean, td = state.cargo.treasure.dirty;
    var per = PC.data.economy.TREASURE_PER_SLOT, cap = PC.crew.holdCapacity(state);
    var tSlots = Math.ceil((tc + td) / per), tcS = tc + td ? tSlots * tc / (tc + td) : 0;
    var seg = function (n, color, label) { return n > 0 ? '<i title="' + esc(label) + '" style="position:static;display:inline-block;height:100%;width:' + (100 * n / cap) + "%;background:" + color + '"></i>' : ""; };
    var manifest = ["Provisions: " + p + " lots"].concat(Object.keys(state.cargo.goods).map(function (g) {
      var e = state.cargo.goods[g];
      return (e.clean ? g + ": " + e.clean : "") + (e.dirty ? (e.clean ? ", " : g + ": ") + e.dirty + " dirty" : "");
    }).filter(Boolean), tc || td ? ["Treasure: " + (tc + td) + " units" + (td ? " (" + td + " dirty)" : "")] : []);
    return '<details class="svc"><summary style="cursor:pointer;list-style:none"><div class="hbar" style="height:16px;display:flex;max-width:680px">' +
      seg(p, "#8a6414", "Provisions") + seg(goods, "#5e4528", "Goods") + seg(tcS, "#c99f45", "Treasure") + seg(tSlots - tcS, "#7a2416", "Dirty treasure") + "</div>" +
      '<span class="small">Hold ' + PC.crew.slotsUsed(state) + " of " + cap + " · Provisions " + p + " · Goods " + goods + " · Treasure " + (tc + td) + (td ? " (" + td + " dirty)" : "") +
      ' <span class="note">· tap for the manifest</span></span></summary><ul class="small">' + manifest.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul></details>";
  }

  function timeAtSea(lots) {
    var a = lots * 5 / Math.max(1, state.crew.count);
    var r = Math.round(a * 2) / 2;
    var s = Math.floor(r) + (r % 1 ? "½" : "");
    if (s === "0½") s = "½";
    return "about " + s + " action" + (r === 1 ? "" : "s") + " at sea for your " + state.crew.count + " hands";
  }

  function coffers(left, cap, his) {
    return '<p class="small">' + esc(his) + " coffers: " + gold(left) + " of " + gold(cap) + ' left this season <span class="hbar" style="display:inline-block;width:110px;vertical-align:middle"><i style="width:' + Math.round(100 * left / Math.max(1, cap)) + '%;background:#8a6414"></i></span></p>';
  }

  function demandTag(g) {
    var d = N().demandOf(state, N().here(state), g);
    if (d === "Wants" || d === "Craves") return ' <span class="rel" style="color:#2f5a22">Wanted</span>';
    if (d === "Glutted") return ' <span class="rel" style="color:#8f2a1c">Glutted</span>';
    return "";
  }
  var STORES = '<span title="Your crew eats or drinks this" style="color:#5e4528">' + ic("prov").replace("<svg", '<svg style="width:16px;height:16px;vertical-align:-2px"') + "</span>";

  function merchantMenu() {
    var id = N().here(state);
    var prov = N().slotNpc(id, "provisioner");
    var g = N().greeting(state, id, prov, "provisioner");
    var said = state.location.said || {};
    var html = '<div class="block">' + nameCard(prov, "Provisioner");
    html += state.location.say && state.location.say.to === prov ? sayFor(prov) : '<div class="say">' + inline(g.line) + "</div>";
    if (!g.refuse) {
      var free = PC.crew.slotsFree(state);
      html += haggleBlock(prov) + holdBar();
      var pp = N().provisionsPrice(state);
      var provMax = Math.min(free, afford(pp));
      html += '<div class="svc"><h4>Provisions</h4><p class="small">' + gold(pp) + " gold a lot. One lot feeds 5 hands for an action at sea.</p>" +
        (free <= 0 ? '<p class="note">The hold is full.</p>' : provMax > 0 ? '<div class="buyrow">' + qstep("q-prov", Math.min(provMax, 10), provMax) + '<button class="secondary" data-act="buyprov" data-for="q-prov">Buy provisions</button></div>' +
          '<p class="small">' + totalSlot(function () { var n = val("q-prov"); return gold(n * pp) + " gold · aboard after: " + (state.provisions + n) + " lots, " + timeAtSea(state.provisions + n); }) + "</p>" : '<p class="note">You can\'t pay for a lot right now.</p>') +
        '<p class="small">Aboard: ' + state.provisions + " lots, " + timeAtSea(state.provisions) + ".</p></div>";
      var stock = N().season(state).stock;
      html += '<div class="svc"><h4>For sale this season</h4><table class="grid"><tr><th>Goods</th><th>Left</th><th>Each</th><th>Buy</th></tr>' +
        Object.keys(stock).map(function (gname) {
          var price = N().shopPrice(state, id, gname, prov);
          var max = Math.min(stock[gname], free, afford(price));
          var info = PC.data.goods[gname], sid = "q-good-" + slug(gname);
          return "<tr><td>" + esc(gname) + (info && info.stores ? " " + STORES : "") + demandTag(gname) + "</td><td>" + stock[gname] + "</td><td>" + gold(price) + "</td><td>" +
            (max > 0 ? '<div class="buyrow">' + qstep(sid, 1, max) + '<button class="secondary" data-act="buygood" data-good="' + esc(gname) + '" data-for="' + sid + '">' +
              totalSlot(function () { return "Buy · " + gold(val(sid) * price); }, "") + "</button></div>" : '<span class="note">' + (stock[gname] ? "No room" : "Sold out") + "</span>") +
            "</td></tr>";
        }).join("") + "</table></div>";
      html += sellTable("provisioner", "Sell to " + PC.npcs.get(state, prov).first, N().provisionerCapLeft(state), N().provisionerCap(state), "clean");
      if (hasCargo("dirty") && !said.offerdirty) html += '<p><button class="link" data-act="offerdirty">Offer dirty goods</button></p>';
    }
    html += "</div>";
    if (N().fenceOpen(state)) {
      var f = N().nodeData(id).fence;
      var fg = N().greeting(state, id, f.npc, "fence");
      html += DIVIDER + '<div class="block"><div class="person">' + castFrame(f.npc).replace('class="castframe"', 'class="castframe" style="flex:0 0 100px"').replace(/width:150px/g, "width:100px") +
        '<div class="pmain">' + nameCard(f.npc, "Fence") +
        (state.location.say && state.location.say.to === f.npc ? sayFor(f.npc) : '<div class="say">' + inline(fg.line) + "</div>") + "</div></div>";
      if (!fg.refuse) {
        html += haggleBlock(f.npc) + sellTable("fence", "Sell dirty goods", N().fenceCapLeft(state), f.cap, "dirty");
        var links = [];
        if (!state.flags.bobby_french_heard) links.push('<button class="link" data-act="askfrench">Ask about the French</button>');
        if (hasCargo("clean") && !said.offerclean) links.push('<button class="link" data-act="offerclean">Offer him clean goods</button>');
        if (links.length) html += "<p>" + links.join(" · ") + "</p>";
      }
      html += "</div>";
    }
    return html;
  }

  function hasCargo(kind) {
    if (state.cargo.treasure[kind]) return true;
    return Object.keys(state.cargo.goods).some(function (g) { return state.cargo.goods[g][kind]; });
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  function sellTable(buyer, title, capLeft, cap, kind) {
    var rows = [];
    if (state.cargo.treasure[kind]) rows.push({ what: "treasure", label: (kind === "dirty" ? "Dirty " : "") + "Treasure", have: state.cargo.treasure[kind] });
    Object.keys(state.cargo.goods).forEach(function (g) {
      var n = state.cargo.goods[g][kind];
      if (n) rows.push({ what: g, label: (kind === "dirty" ? "Dirty " : "") + g, have: n });
    });
    var who_ = PC.npcs.get(state, buyer === "fence" ? N().nodeData(N().here(state)).fence.npc : N().slotNpc(N().here(state), "provisioner"));
    var his = who_ && who_.gender === "f" ? "Her" : "His";
    var html = '<div class="svc"><h4>' + esc(title) + '</h4><p class="small">' + (buyer === "fence" ? "Buys dirty treasure and goods only." : "Buys clean treasure and goods only.") + " Sales go to crew gold.</p>" + coffers(capLeft, cap, his);
    if (!rows.length) return html + '<p class="note">Nothing aboard ' + (buyer === "fence" ? "for him" : "to sell here") + ".</p></div>";
    return html + '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Pays</th><th>Sell</th></tr>' + rows.map(function (r) {
      var id = "q-sell-" + buyer + "-" + slug(r.what);
      var price = N().unitPrice(state, buyer, r.what);
      var max = Math.max(1, Math.min(r.have, price > 0 ? Math.floor(capLeft / price + 1e-9) : r.have));
      return "<tr><td>" + esc(r.label) + (r.what !== "treasure" ? demandTag(r.what) : "") + "</td><td>" + r.have + "</td><td>" + gold(price) + "</td><td>" +
        '<div class="buyrow">' + qstep(id, max, max) + '<button class="secondary" data-act="sell" data-buyer="' + buyer + '" data-what="' + esc(r.what) + '" data-for="' + id + '"' + (capLeft < price ? " disabled" : "") + ">" +
        totalSlot(function () { return "Sell · " + gold(val(id) * price); }, "") + "</button></div></td></tr>";
    }).join("") + "</table></div>";
  }

  // ---- Lilyhook's Graveyard (§41.10) ----

  function zoneTiers(type) {
    var S = PC.data.minigames.salvage;
    return S.ZONES[type].map(function (z) {
      var a = PC.checks.assess(state, { type: "Dive", dr: S.ZONE_DR[z] }, { conditions: ["Underwater"] });
      return esc(S.ZONE_NAMES[z]) + " " + tierWord(a.tier);
    }).join(" · ");
  }

  function graveyardMenu() {
    var S = PC.data.minigames.salvage;
    var greet = (S.greetings || {})[String(Math.max(-1, Math.min(3, PC.npcs.rung(state, "ollie"))))] || (S.greetings || {})["0"] || "";
    var html = '<div class="block"><div class="person">' + castFrame("ollie").replace('class="castframe"', 'class="castframe" style="flex:0 0 100px"').replace(/width:150px/g, "width:100px") +
      '<div class="pmain">' + nameCard("ollie", "Dive host") + '<div class="say">' + inline(greet) + "</div></div></div>";
    // A Dying Pirate's Wish: the Miranda is the only wreck until the mermaid comes up (§18.2).
    if (PC.salvage.mirandaPending(state)) {
      var rc = PC.salvage.canRetryMiranda(state);
      return html + '<div class="wreck"><div class="wthumb">Woodcut<br>the <i>Miranda</i></div><div><h4>The <i>Miranda</i></h4><p class="small">' + esc(S.miranda.flavor) + "</p>" +
        '<p class="small">Ollie waits on the beach. Geezer\'s mermaid is still down there.</p>' +
        '<div class="actions"><button class="primary" data-act="miranda" data-cost-ap="1"' + (rc.ok ? "" : " disabled") + ">Dive for the mermaid again (1 action)</button>" +
        (rc.ok ? "" : '<span class="lock">' + esc(rc.why) + "</span>") + "</div></div></div></div>";
    }
    var cd = PC.salvage.canDive(state);
    var wrecks = PC.salvage.wrecksOnOffer(state, "ocracoke");
    html += '<p class="note">' + esc(S.lines.offered) + (wrecks.some(function (w) { return w.type === "frigate"; }) ? " " + esc(S.lines.frigate) : "") + "</p>";
    if (!cd.ok) html += '<p class="notice">' + esc(cd.why) + "</p>";
    wrecks.forEach(function (w) {
      html += '<div class="wreck"><div class="wthumb">Woodcut<br>a ' + esc(w.type) + " wreck</div><div><h4>A " + esc(titleCase(w.type)) + "</h4>" + '<p class="small">' + esc(w.flavor) + "</p>" +
        '<p class="small">' + zoneTiers(w.type) + "</p>" +
        '<div class="actions" style="margin-top:6px"><button class="primary" data-act="divewreck" data-cost-ap="1" data-wreck="' + esc(w.id) + '"' + (cd.ok ? "" : " disabled") + ">Dive (1 action)</button>" +
        '<button class="secondary" data-act="divequick" data-cost-ap="1" data-wreck="' + esc(w.id) + '"' + (cd.ok ? "" : " disabled") + ">Quick Dive (1 action)</button></div>" +
        '<p class="note" style="margin:6px 0 0">Dive: choose every grab yourself. Hazards below; relics possible.<br>Quick Dive: one roll, no hazards, no relics. Clean brings up four finds, partial two; a setback brings up nothing.</p></div></div>';
    });
    return html + "</div>";
  }

  // ---- The minigames (§18, §38.8, §41.6, §41.10) ----
  // The rules are in js/salvage.js, js/drinking.js and js/liarsdice.js.

  // The log: what the last move did stands out in a box at the top; the
  // lines before it sit faded below (the author's phone notes). mgMark is
  // where the log stood when the player last acted.
  var mgMark = 0;
  function markLog() { mgMark = state && state.minigame && state.minigame.log ? state.minigame.log.length : 0; }
  function mgLatest(lines) {
    var fresh = lines.slice(Math.min(mgMark, lines.length)).filter(function (l) { return l; });
    return fresh.length ? '<div class="mglatest">' + fresh.map(function (l) { return prose(l); }).join("") + "</div>" : "";
  }
  function mgLog(lines) {
    var old = lines.slice(0, Math.min(mgMark, lines.length)).slice(-6);
    return old.length ? '<div class="mglog">' + old.map(function (l) { return l ? prose(l) : "<hr>"; }).join("") + "</div>" : "";
  }

  function gpips(n, max, cls) {
    var out = "";
    for (var i = 0; i < max; i++) out += '<i class="' + (i < n ? "on" : "") + '" data-gpip="' + i + '"></i>';
    return '<span class="gpips ' + (cls || "") + '">' + out + "</span>";
  }

  function mgPending(p) {
    if (!p) return "";
    return '<p class="you-chose">' + esc(p.type) + "</p>" + badge(p.outcome) + diceLine(p.roll) +
      '<div class="actions"><button class="secondary" data-act="mgreroll">Reroll (' + esc(p.reroll) + ')</button><button class="primary" data-act="mgaccept">Accept it</button></div>';
  }

  function mgHead(line, title) { return '<div class="where">' + esc(line) + '</div><h2 class="title">' + esc(title) + "</h2>"; }

  function minigamePanel() {
    var v = PC.minigames.view(state);
    if (v.kind === "hunt") v.hunt = v; // the hunt's own view rides on the minigame view
    return '<div class="mg-' + v.kind + '">' + ({ dive: divePanel, drink: drinkPanel, dice: dicePanel, hunt: huntPanel })[v.kind](v) + "</div>";
  }

  // The dive (§41.10): the clickable wreck with Hull, Hold and Cabin.
  var ZONE_POS = { hull: "left:5%;top:44%;width:28%;height:40%", hold: "left:37%;top:52%;width:28%;height:38%", cabin: "left:68%;top:28%;width:27%;height:40%" };

  function divePanel(v) {
    var html = mgHead("Ocracoke · Lilyhook's Graveyard", v.title) +
      '<div class="gauges"><div class="gauge"><span class="lbl">Breath</span>' + gpips(v.breath, v.breathMax, "breath") + ' <span class="small">' + v.breath + " of " + v.breathMax + "</span></div></div>";
    if (!v.over && v.haul && v.haul.length) html += '<p class="small" style="margin:0 0 6px"><b>In your arms:</b> ' + v.haul.map(esc).join(", ") + "</p>";
    html += mgLatest(v.log);
    if (v.pending) return html + mgPending(v.pending) + mgLog(v.log);
    if (!v.over) {
      var sel = diveZone && v.zones.filter(function (z) { return z.id === diveZone; })[0];
      html += '<div class="hotframe">' + v.zones.map(function (z) {
        var pos = ZONE_POS[z.id] || "left:10%;top:10%;width:25%;height:30%";
        return '<button class="hot' + (z.left <= 0 ? " off" : "") + (sel && sel.id === z.id ? " lit" : "") + '" style="' + pos + '" data-act="divezone" data-zone="' + z.id + '"' + (z.left <= 0 ? " disabled" : "") + ">" +
          esc(z.name) + '<span class="sub">' + (z.left > 0 ? z.left + " left" : "Picked clean") + (z.scouted ? "<br>next: " + esc(z.scouted) : "") + "</span></button>";
      }).join("") + '<span class="framelabel">Woodcut · a ' + esc(v.wreckType || "wreck") + " cutaway · 16 : 10 · 1600 × 1000</span></div>";
      if (sel && sel.left > 0) {
        html += '<div class="hotmenu"><p class="sc" style="margin:0 0 6px">The ' + esc(sel.name) + "</p>" + opts([
          opt({ act: "mgdive", attrs: 'data-op="grab" data-zone="' + sel.id + '" data-cost-breath="1"', label: "Grab", check: sel.assess, meta: "Clean costs 1 breath, partial 2, setback 2 and a hazard" }),
          opt({ act: "mgdive", attrs: 'data-op="scout" data-zone="' + sel.id + '" data-cost-breath="1"', label: "Scout", meta: "1 breath: see the next find, and the next grab here is one step easier" }),
        ]) + "</div>";
      } else html += '<p class="note">Pick a part of the wreck to work.</p>';
      html += '<div class="actions"><button class="primary" data-act="mgdive" data-op="surface">Surface</button>' + (v.canQuick ? '<button class="secondary" data-act="mgquick">Quick Dive instead</button>' : "") + "</div>";
      return html + mgLog(v.log);
    }
    html += '<div class="h4" style="max-width:680px">' + (v.blackout ? "What you kept" : "Your haul") + "</div>";
    var kept = (v.kept || v.haul || []).map(function (k) { return { icon: /treasure|gold|coin/i.test(k) ? "treasure" : "item", text: k, ink: "mid" }; });
    var lostList = [];
    if (v.blackout && v.kept) {
      var left = v.kept.slice();
      (v.haul || []).forEach(function (k) { var i = left.indexOf(k); if (i >= 0) left.splice(i, 1); else lostList.push(k); });
    }
    var lost = lostList.map(function (k) { return { icon: "item", html: "<s>" + esc(k) + "</s>" }; });
    html += kept.length || lost.length ? chips(kept.concat(lost)) : '<p class="note">Nothing.</p>';
    if (v.needsPot) {
      return html + '<p style="font-size:20px;margin:16px 0 10px">Where does the ' + gold(v.gold) + ' gold go?</p><div class="actions"><button class="primary" data-top="1" data-act="mgbank" data-pot="purse">Into your purse · ' + gold(v.gold) + "</button>" +
        '<button class="secondary" data-top="1" data-act="mgbank" data-pot="crew">Share it with the crew · ' + gold(v.gold) + "</button></div>";
    }
    return html + '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Continue</button></div>';
  }
  var diveZone = null;
  var devForce = null; // the Developer panel's next sighting (Milestone 5)

  // Under the Table (§41.6): the hotspot table.
  function drinkPanel(v) {
    var html = mgHead("Ocracoke · The Tavern · Under the Table", v.opponent) +
      '<p class="small">Round ' + v.round + " · the tab " + v.tab + " gold</p>" +
      '<div class="namecard"><b style="font-size:22px">' + esc(v.opponent) + '</b><span class="role">' + esc(v.role) + "</span>" + (v.trait ? '<span class="traits">' + esc(v.trait) + "</span>" : "") + "</div>" +
      '<div class="gauges"><div class="gauge"><span class="lbl">Your Wits</span>' + gpips(v.wits, v.witsMax) + "</div>" +
      '<div class="gauge"><span class="lbl">Him</span><span class="big">' + esc(v.state) + "</span>" + (v.tolerance ? '<span class="small"> · Tolerance ' + esc(v.tolerance) + "</span>" : "") + "</div></div>";
    html += mgLatest(v.log);
    if (v.pending) return html + mgPending(v.pending) + mgLog(v.log);
    if (v.offerOneMore) {
      return html + mgLog(v.log) + '<p class="notice">Heavy Drinker: another pirate wants a go. Play on with the Wits you have left, for another rumor?</p>' +
        '<div class="actions"><button class="secondary" data-act="mgonemore" data-yes="1">One more round</button><button class="primary" data-act="mgonemore" data-yes="0">Call it a night</button></div>';
    }
    if (!v.over) {
      var by = {};
      v.options.forEach(function (o) { by[o.op] = o; });
      var NOTE = { drink: "Clean costs no Wits, partial 1, setback 2 and a mishap", strong: "Counts as two drinks for him. Clean 0 Wits, partial 2, setback 3 and a mishap",
        size: "Once, before the first drink. Clean names his trait and Tolerance", mock: "One taunt a match: he drinks alone", lean: "One taunt a match: he drinks alone",
        throw: "Starts a brawl", callit: "A loss: you pay the tab" };
      var spot = function (op, pos, label) {
        var o = by[op];
        return '<button class="hot' + (o ? "" : " off") + (drinkSpot === op ? " lit" : "") + '" style="' + pos + '" data-act="drinkspot" data-spot="' + op + '"' + (o ? "" : " disabled") + ">" + label + "</button>";
      };
      var taunts = ["mock", "lean", "throw"].filter(function (k) { return by[k]; });
      html += '<div class="hotframe">' + spot("drink", "left:12%;top:38%;width:22%;height:34%", "The Tankard<span class=\"sub\">drink</span>") +
        spot("strong", "left:42%;top:30%;width:18%;height:44%", "The Rum Bottle<span class=\"sub\">the strong stuff</span>") +
        '<button class="hot' + (taunts.length ? "" : " off") + (drinkSpot === "hands" ? " lit" : "") + '" style="left:66%;top:8%;width:28%;height:26%" data-act="drinkspot" data-spot="hands"' + (taunts.length ? "" : " disabled") + '>His Hands<span class="sub">taunt him</span></button>' +
        '<span class="framelabel">Woodcut · the drinking table · 16 : 10 · 1600 × 1000</span></div>';
      if (v.mustStrong) html += '<p class="notice">The strong stuff, or call it a night.</p>';
      var pick = drinkSpot === "hands" ? taunts : drinkSpot && by[drinkSpot] ? [drinkSpot] : [];
      if (pick.length) {
        html += '<div class="hotmenu">' + opts(pick.map(function (k) {
          var o = by[k];
          return opt({ act: "mgdrink", attrs: 'data-op="' + o.op + '"', label: o.label, check: o.assess || null, meta: NOTE[o.op], opener: o.op === "throw" ? { kind: "flaw", name: "Hot-Tempered" } : null });
        })) + "</div>";
      }
      html += '<div class="actions">' + (by.size ? '<button class="secondary" data-act="mgdrink" data-op="size">Size him up</button>' : "") +
        (by.callit ? '<button class="secondary" data-act="mgdrink" data-op="callit">Call it a night</button>' : "") + "</div>";
      return html + mgLog(v.log);
    }
    var r = v.result || {};
    var list = [];
    if (r.tab) list.push({ icon: "gold", text: "You paid the " + r.tab + "-gold tab", ink: "mid" });
    if (r.lead) list.push({ icon: "lead", text: "A new lead · Journal updated", ink: "oxblood" });
    if (r.rumor) list.push({ icon: "rumor", text: "Added to your Rumors." });
    if (r.item) list.push({ icon: "item", text: "Found: " + r.item });
    if (r.hangover) list.push({ icon: "cond", text: "Hangover until next season", ink: "bad" });
    return html + mgLog(v.log) + '<div class="h4" style="max-width:680px">' + (r.won ? "You won" : r.how === "draw" ? "A draw" : "You lost") + "</div>" + chips(list) +
      '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Continue</button></div>';
  }
  var drinkSpot = null;

  // ---- The prize hunt (§22.3, §22.10, §38.5; Milestone 5) ----
  // The rules are in js/hunt.js and js/combat.js; this draws them.

  var CA_INK = { "3": "t-good", "2": "t-good", "1": "t-good", "0": "t-mid", "-1": "t-bad", "-2": "t-bad", "-3": "t-bad", "-4": "t-bad" };
  function caWord(b) { return '<span class="tier ' + (CA_INK[String(b)] || "t-mid") + '">' + shape(CA_INK[String(b)] || "t-mid") + esc(PC.combat.caName(b)) + "</span>"; }

  function shipArtHtml(cls, faded) {
    var art = PC.data.shipArt(cls), c = PC.data.hunt.CLASSES[cls] || { size: 1 };
    var w = 70 + c.size * 26;
    return art ? '<img class="shipart" src="' + assetUrl(art) + '" alt="' + esc(cls) + '" style="width:' + w + "px" + (faded ? ";opacity:.4" : "") + '">' : "";
  }

  // A raw-edge roll shown like a check (the Exchange): tier and odds.
  function rawCheck(type, edge, parts) {
    return { type: type, tier: PC.checks.tier(edge), odds: PC.checks.odds(edge), parts: parts || [], edge: edge, rawEdge: edge };
  }
  function chk(c) { return c ? PC.checks.assess(state, c, { conditions: ["Battle"] }) : null; }

  function qmSays(line, v) {
    if (!line) return "";
    var who = v.qm || "Your Quartermaster";
    return '<div class="qm"><b>' + esc(who) + ', Quartermaster:</b> ' + inline(PC.text.render(line, state)) + "</div>";
  }

  function huntStatus(v) {
    var bits = ["Action " + v.apUsed + " of up to " + v.maxAp];
    if (v.batch) bits.push("sighting " + Math.min(v.batch.next, v.batch.n) + " of " + v.batch.n + " this action");
    bits.push("hold " + (v.holdMax - v.holdFree) + " of " + v.holdMax);
    if (v.prizesTaken) bits.push(plural(v.prizesTaken, "prize") + " taken");
    return '<p class="small" style="margin:0 0 8px">' + esc(bits.join(" · ")) + "</p>";
  }

  // The scouting card (§22.3): only what a lookout could see.
  function scoutCard(s, v) {
    var rows = [["Flag", s.flag + (s.name ? " · the " + s.name : "")], ["Guns", s.guns + " (" + s.gunsRange + ")"], ["Crew", s.crewRange], ["Hull", s.hull],
      ["Speed", s.speed + " · " + s.handling], ["Draft", s.draft], ["Carries", s.lootTypes.join(", ")], ["Loot", s.loot]];
    return '<div class="scout">' + shipArtHtml(s.cls) + '<div><h4 style="margin:0">' + (s.escort ? "Her escort: " : "") + "A " + esc(s.cls) + ' <span class="note">· ' + esc(s.role === "War" ? "warship" : s.role === "Raider" ? "raider" : s.role === "Hybrid" ? "armed trader" : "merchant") + "</span></h4>" +
      '<table class="ledger">' + rows.map(function (r) { return lrow(r[0], esc(r[1])); }).join("") + "</table>" +
      '<p class="small" style="margin:4px 0"><i>The lookout: ' + esc(PC.text.render(s.cue, state).replace(/^PLACEHOLDER: /, "")) + "</i></p>" +
      '<p class="small" style="margin:0">' + esc(s.legit) + "</p></div></div>";
  }

  function huntPanel(v) {
    var H = v.hunt, html = mgHead("Ocracoke · Hunting " + H.waters, H.phase === "battle" ? "Battle" : H.phase === "after" ? "After the Battle" : H.phase === "gameover" ? "Your Story Ends" : "Hunt for Prizes");
    if (H.phase === "gameover") return html + gameOverPanel(v);
    html += huntStatus(H) + mgLatest(v.log);
    if (v.pending) return html + mgPending(v.pending) + mgLog(v.log);
    var home = H.canContinue.ok || H.phase === "batchEnd" ? '<button class="secondary" data-act="hhome">Sail home to Ocracoke</button>' : "";
    if (H.phase === "empty") {
      html += '<div class="actions"><button class="primary" data-act="hnext">Keep searching</button>' + home + "</div>";
    } else if (H.phase === "scout" || H.phase === "hunter") {
      var sv = H.scout;
      html += '<p class="sc" style="margin:8px 0 4px">' + (sv.ships.length > 1 ? (sv.shape === "convoy" ? "A convoy of " + sv.ships.length : "A merchant under escort") : "A sail") + " · " + caWord(sv.ca) + "</p>";
      html += sv.ships.map(function (s) { return scoutCard(s, H); }).join("");
      var war = sv.ships.some(function (s) { return s.warship; });
      if (war && sv.ca < 2 && !sv.hunter) html += '<p class="notice warn">☠ A warship at these odds will tear a ship your size apart. Let her go unless you mean it.</p>';
      html += qmSays(H.advice, H);
      html += sv.hunter ? '<div class="actions"><button class="primary" data-act="hhunter">Face her</button></div>' :
        '<div class="actions"><button class="primary" data-act="hengage">Engage</button><button class="secondary" data-act="hnext">Let her pass</button>' + home + "</div>";
    } else if (H.phase === "battle") {
      html += battlePanel(H.battle, H);
    } else if (H.phase === "after") {
      html += afterPanel(H.after, H);
    } else if (H.phase === "batchEnd") {
      html += '<p>The horizon is empty for now.</p><div class="actions">' +
        (H.apLeft >= 1 && H.apUsed < H.maxAp ? '<button class="primary" data-act="hmore" data-cost-ap="1">Keep hunting (1 action)</button>' : '<span class="note">' + esc(H.apLeft < 1 ? "No actions left this season." : "A hunt is at most three actions.") + "</span>") +
        '<button class="secondary" data-act="hhome">Sail home to Ocracoke</button></div>';
    }
    return html + mgLog(v.log);
  }

  function shipRow(s, enemy, target) {
    var hp = s.hullMax ? Math.max(0, Math.round(100 * s.hull / s.hullMax)) : 0;
    var outWord = { struck: "struck", captured: "taken", sunk: "sunk", escaped: "escaped", taken: "taken", left: "left behind" }[s.out] || "";
    return '<div class="bship' + (s.out ? " out" : "") + (target ? " target" : "") + '">' + shipArtHtml(s.cls, !!s.out) +
      '<div><b>' + esc((s.mine && s.id === "flagship" ? "" : "") + (s.name ? s.name : "A " + s.cls)) + '</b> <span class="note">' + esc(s.cls + (s.kind === "prize" ? " · prize" : "") + (s.escort ? " · escort" : "")) + "</span>" +
      (outWord ? ' <span class="badge-out">' + esc(outWord) + "</span>" : "") +
      '<div class="hbar" style="height:9px;max-width:200px;margin:3px 0"><i style="width:' + hp + "%;background:" + (hp < 50 ? "#8f2a1c" : "#5e4528") + '"></i></div>' +
      '<span class="small">Hull ' + s.hull + "/" + s.hullMax + " · Guns " + s.guns + " · Crew " + s.crew + (s.speed != null ? " · Speed " + s.speed : "") +
      (enemy && s.shaken ? ' · <span style="color:#8f2a1c">Shaken ' + s.shaken + "</span>" : "") + (enemy && s.leaderless ? ' · <span style="color:#8f2a1c">Leaderless</span>' : "") + "</span></div></div>";
  }

  function battlePanel(b, H) {
    var html = '<div class="battle"><div class="bside"><div class="h4">Your side</div>' + b.mine.map(function (s) { return shipRow(s, false, false); }).join("") + "</div>" +
      '<div class="bside"><div class="h4">Theirs</div>' + b.enemies.map(function (s) { return shipRow(s, true, s.id === b.target); }).join("") + "</div></div>";
    if (b.ca != null) html += '<p class="sc" style="margin:6px 0">Round ' + Math.max(1, b.round) + " · the odds: " + caWord(b.ca) + (b.enemies.length > 1 ? " · whole fleet " + caWord(b.fleetCA) : "") + "</p>";
    var B = function (fn, arg, label, cls, extra) { return '<button class="' + (cls || "secondary") + '" data-act="hb" data-fn="' + fn + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : "") + (extra || "") + ">" + label + "</button>"; };
    var O = function (fn, arg, label, check, meta, lock, extra) {
      return opt({ act: "hb", attrs: 'data-fn="' + fn + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : "") + (extra || ""), label: label, check: check, meta: meta || null, lock: lock || null });
    };
    var A = PC.data.huntLines.advice, me = b.mine[0], en = b.enemies.filter(function (e) { return e.id === b.target; })[0];
    switch (b.step) {
      case "setup":
        html += '<div class="svc"><h4>Before you close</h4><p class="small">Pick your flagship\'s target' + (b.mine.length > 1 ? " and what your fleet ships do" : "") + ".</p>" +
          '<p class="small">Your flagship takes: ' + b.enemies.map(function (e) { return '<button class="' + (b.target === e.id ? "primary" : "secondary") + '" data-act="hb" data-fn="setTarget" data-arg="' + e.id + '">' + esc(e.name || e.cls) + "</button>"; }).join(" ") + "</p>" +
          b.mine.filter(function (s) { return s.id !== "flagship" && s.kind === "fleet"; }).map(function (s) {
            var tgt = b.pairs[s.id], sup = b.support[s.id];
            return '<p class="small">' + esc(s.name || s.cls) + ": " + b.enemies.filter(function (e) { return e.id !== b.target; }).map(function (e) {
              return '<button class="' + (tgt === e.id ? "primary" : "secondary") + '" data-act="hassign" data-ship="' + s.id + '" data-what="' + e.id + '">Fight ' + esc(e.name || e.cls) + "</button>";
            }).join(" ") + ' <button class="' + (sup ? "primary" : "secondary") + '" data-act="hassign" data-ship="' + s.id + '" data-what="support">Support your flagship</button></p>';
          }).join("") +
          '<p class="small">Fleet order: ' + B("setFleetOrder", "take", "Take Prizes", b.fleetOrder === "take" ? "primary" : "secondary") + " " + B("setFleetOrder", "sink", "Sink Them", b.fleetOrder === "sink" ? "primary" : "secondary") + "</p></div>" +
          '<div class="actions">' + B("engage", null, "Close and call on her to strike", "primary") + "</div>";
        break;
      case "showOfForce":
        html += opts([O("showOfForce", "yes", "A show of force (optional)", chk(b.check), "Prize Taker. Clean: +1 on the strike roll. Anything else: no harm done."), O("showOfForce", "no", "Just call on her to strike", null, "No roll")]);
        break;
      case "hunterChoice":
        html += qmSays(A.hunter, H) + opts([O("hunterChoice", "fight", "Fight her", null, "She won't strike or run before the battle."),
          O("hunterChoice", "flee", "Run for it", chk({ type: "Outrun", dr: en ? 3 : 3 }), "Morale −15. Clean: escaped. Partial: escaped with a parting hit. Setback: she catches you, +1 to her Position.")]);
        break;
      case "chase": case "press":
        var fleeing = b.chaseMode === "flee";
        html += b.step === "press" ? '<p>She\'s pulling away. You\'re faster: you can keep after her, giving up your next sighting this action.</p>' + '<div class="actions">' + B("press", "yes", "Press the chase", "primary") + B("press", "no", "Let her go") + "</div>" :
          opts([O("doChase", null, fleeing ? "Run for it" : "Give chase", chk(b.check), fleeing ? "Clean: escaped. Partial: escaped, with a parting hit. Setback: caught; she gets +1 to Position." : "Clean: caught, +1 to your first Position. Partial: caught. Setback: she gets away (unless you're faster and press the chase).")]);
        break;
      case "position":
        html += opts([O("doPosition", null, "Work for position", chk(b.check), "Maneuver against her captain. Clean lets you Rake, Close or Open the range; partial +1 on the Exchange, setback −1.")]);
        break;
      case "posChoice":
        html += '<p class="sc">You have the position. What now?</p>' + opts([
          O("choosePosition", "rake", "Rake her", null, "+2 on this round's Exchange."),
          O("choosePosition", "close", "Close for boarding", null, "Skip the Exchange and grapple, +1 to the grapple."),
          O("choosePosition", "open", "Open the range", null, "Your next attempt to flee needs no roll.")]);
        break;
      case "exchange":
        var ex = b.exchange, rc = rawCheck("Exchange", ex.edge, ex.parts);
        var shots = [["round", "Round shot", "Full damage. Sink or cripple her."], ["chain", "Chain shot", "Half damage; a heavy hit costs her 1 Speed. Stops a runner."], ["grape", "Grapeshot", "Quarter damage, double crew losses. Thins her crew before boarding and keeps the prize whole."]];
        if (b.gunnersEye) { shots.push(["rigging", "Called shot: her rigging", "Gunner's Eye. Half damage; a heavy hit costs her 1 Speed."]); shots.push(["rudder", "Called shot: her rudder", "Gunner's Eye. Half damage; a heavy hit costs her −1 on her next Position."]); }
        html += '<p class="sc" style="margin:4px 0">The Exchange · pick your shot</p>' + opts(shots.map(function (x) { return O("doExchange", x[0], x[1], rc, x[2]); }));
        html += qmSays(me && en && me.crew >= 0.75 * en.crew ? A.grape : en && en.speed >= me.speed ? A.chain : A.fire, H);
        break;
      case "decision":
        var hurt = me.hull < 0.6 * me.hullMax;
        html += qmSays(hurt ? A.run : me.crew >= 0.75 * (en ? en.crew : 1) ? A.board : A.fire, H) + opts([
          O("decide", "fire", "Fire again", null, "A new round, starting with Position."),
          O("decide", "board", "Board her", null, "Grapple (Board), then up to three clashes."),
          O("decide", "flee", "Break off and run", null, "Morale −15. " + (b.openRange ? "You opened the range: no roll needed." : "A chase: Outrun.")),
          O("decide", "strike", "Strike your colors", null, "The battle is lost, and your story ends here.")]);
        break;
      case "grapple":
        html += opts([O("doGrapple", null, "Grapple her", chk(b.check), "Clean: you're aboard. Partial: aboard, but she sweeps your deck with grape. Setback: they cut your grapples.")]);
        break;
      case "repel":
        html += '<p class="notice">She\'s coming alongside to board you.</p>' + opts([O("doRepel", null, "Repel boarders", chk(b.check), "Clean: cut her grapples and rake her as she sheers off. Partial: they're aboard, but pay for it. Setback: they're aboard.")]);
        break;
      case "clash":
        var bd = b.board || {};
        html += '<p class="sc" style="margin:4px 0">' + (bd.meBoarding ? "On her deck" : "On your deck") + " · clash " + (bd.clash + 1) + " of 3" + (bd.sf && bd.clash === 0 ? " · " + esc(PC.data.huntLines.strikeFirst[bd.sf]) : "") + "</p>" +
          opts(b.actions.map(function (a) { return O("doAction", a.id, a.label, chk(a.check), a.note, a.lock); }));
        break;
      case "retarget":
        html += '<p class="sc">Your target is out of the fight. Who next?</p><div class="actions">' + b.enemies.filter(function (e) { return !e.out; }).map(function (e) { return B("retarget", e.id, esc(e.name || e.cls)); }).join("") + "</div>";
        break;
      case "endure":
        html += opts([O("doEndure", null, "Hold on", chk(b.check), "Endure, as your ship goes down.")]);
        break;
    }
    if (state.settings.showDice && b.lastExchange) html += '<div class="dice">Last Exchange: dice ' + b.lastExchange.dice.join(" + ") + ", edge " + signed(b.lastExchange.edge) + " · " + b.lastExchange.outcome + "</div>";
    if (state.settings.showDice && b.lastClash) html += '<div class="dice">Last clash: dice ' + b.lastClash.dice.join(" + ") + ", edge " + signed(b.lastClash.edge) + " · " + b.lastClash.outcome + "</div>";
    return html;
  }

  function afterPanel(a, H) {
    var html = a.chips.length ? chips(a.chips) : "";
    if (!a.repairDone) {
      return html + opts([opt({ act: "hrepair", label: "Repairs at sea", check: chk(a.repairCheck), meta: "Repair & Refit on the " + Math.round(a.hpLost) + " hull lost. Clean restores a quarter of it, partial a tenth." })]);
    }
    var p = a.prize;
    if (p) {
      var goods = Object.keys(p.goods).map(function (g) { return p.goods[g] + " " + g; });
      html += '<div class="svc prize"><h4 style="margin:0">' + esc(p.name ? "The " + p.name : "A " + p.cls) + ' <span class="note">· ' + esc(p.flag + " " + p.cls + " · " + p.level) + "</span></h4>" +
        (p.captain ? '<p class="small" style="margin:2px 0">' + esc((p.title ? p.title + " " : "") + p.captain) + " hands over her papers.</p>" : "") +
        '<p class="small">In her hold: ' + esc([p.treasure ? p.treasure + " treasure" : null].concat(goods).concat(p.provisions ? [p.provisions + " provisions"] : []).filter(Boolean).join(", ") || "nothing much") +
        " · her ship's chest " + p.chest + " gold" + (p.dirty ? " · <b>dirty</b>: only Bobby will buy it" : " · clean") + ".</p>";
      var radio = function (name, val, label, note, lock, on) {
        return '<label class="pick' + (lock ? " locked" : "") + '"><input type="radio" name="' + name + '" value="' + esc(val) + '"' + (on ? " checked" : "") + (lock ? " disabled" : "") + "> <b>" + esc(label) + "</b>" +
          (note || lock ? '<span class="note"> · ' + esc(lock || note) + "</span>" : "") + "</label>";
      };
      html += '<div class="h4">Her hull</div>' + p.hullOptions.map(function (o, i) {
        var off = o.id === "fleet" && !o.lock && o.officers.length ? ' <select class="hofficer">' + o.officers.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name + " (" + x.type + ")") + "</option>"; }).join("") + "</select>" : "";
        return radio("h-hull", o.id, o.label, o.note, o.lock, o.id === "release") + off;
      }).join("");
      html += '<div class="h4">Her crew (' + p.crew + ")</div>" +
        radio("h-crew", "release", "Release them", "With their ship, or in her boats", null, true) +
        radio("h-crew", "recruit", "Recruit the willing", p.volunteers ? p.volunteers + " " + p.volTier + " hands want to sign on" : "Nobody wants to", p.volunteers ? null : "Nobody wants to", false) +
        radio("h-crew", "execute", "Execute them", "Dead men tell no tales: no Heat, Dread +3" + (p.execute.legal ? "" : ". " + p.execute.why), null, false);
      if (p.captives) html += '<div class="h4">' + plural(p.captives, "captive") + " aboard her</div>" +
        radio("h-cap", "free", "Take them aboard to free them", "Freed at Ocracoke for a reward", null, true) +
        radio("h-cap", "recruit", "Recruit the willing", "Half join as Green hands", null, false) +
        radio("h-cap", "leave", "Leave them with her", null, null, false);
      html += '<div class="actions"><button class="primary" data-act="hprize">Settle her' + (a.left ? " (" + a.left + " more to go)" : "") + "</button></div></div>";
      return html;
    }
    return html + '<div class="actions"><button class="primary" data-act="hcarry" data-top="1">Back to the hunt</button></div>';
  }

  function gameOverPanel(v) {
    var go = v.hunt.gameOver || {};
    return '<div class="prose dropcap">' + prose(PC.data.huntLines.gameOver[go.how === "died" ? "died" : "captured"]) + "</div>" +
      '<p class="note">This is the end of the run for the prototype. Imprisonment and heirs come in later milestones.</p>' +
      '<div class="actions"><button class="primary" data-act="quit">Back to the title</button></div>';
  }

  // Liar's Dice (§41.6): drawn dice, cups, a bid stepper and tappable faces.
  var PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  function die(n, cls) {
    if (!n) return '<svg class="die ' + (cls || "") + '" viewBox="0 0 100 100" aria-label="A hidden die"><path d="M18 88L28 22Q50 10 72 22L82 88Z" fill="#5e4528" stroke="#2a1c10" stroke-width="3"/><ellipse cx="50" cy="88" rx="32" ry="7" fill="#4a3418"/></svg>';
    return '<svg class="die ' + (cls || "") + '" viewBox="0 0 100 100" aria-label="' + n + '"><rect x="6" y="6" width="88" height="88" rx="16" fill="#f3e9cf" stroke="#2a1c10" stroke-width="4"/>' +
      PIPS[n].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#2a1c10"/>'; }).join("") + "</svg>";
  }

  function dicePanel(v) {
    var html = mgHead("Ocracoke · The Tavern · Liar's Dice", v.opponent);
    var board = '<div class="scoreboard"><p class="sc" style="margin:0 0 4px">The scoreboard</p>Game ' + v.games + " of " + v.maxGames + "<br>Won " + v.won + " · lost " + v.lost +
      "<br>Net " + (v.net >= 0 ? "+" : "−") + Math.abs(v.net) + " gold<br>Your purse " + gold(v.purse) + "</div>";
    if (v.pending) return html + mgLog(v.log) + mgPending(v.pending);
    var g = v.round;
    if (!g) {
      html += '<div class="dicetable"><div class="felt"><span class="framelabel" style="position:static">Woodcut · the dice table, top-down · 16 : 10 · 1600 × 1000</span></div>' + board + "</div>" + mgLog(v.log);
      if (v.over) return html + '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Leave the table</button></div>';
      var list = [];
      if (v.canSize) list.push(opt({ act: "mgsize", label: "Size him up", check: v.sizeAssess, meta: "Once a sitting" }));
      html += opts(list);
      if (v.canStart) {
        html += '<div class="svc"><h4>The stake</h4><div class="buyrow">' + qstep("q-stake", v.stakes[0], Math.min(v.stakes[1], Math.floor(v.purse)), v.stakes[0]) +
          '<button class="primary" data-act="mgstake" data-for="q-stake">Play a game</button></div><p class="note">Stake ' + v.stakes[0] + "-" + v.stakes[1] + " gold from your purse; the winner takes both stakes.</p></div>";
      }
      return html + '<div class="actions"><button class="secondary" data-act="mgstop">Leave the table</button></div>';
    }
    var bidHtml = g.bid ? '<span class="bidbox">' + g.bid.q + " × " + die(g.bid.f, "sm") + "</span>" : '<span class="bidbox" style="font-size:18px">You open the bidding</span>';
    html += '<div class="dicetable"><div class="felt"><div class="cupsrow">' + g.his.map(function (d) { return die(d); }).join("") + '</div><div style="text-align:center">' + bidHtml +
      '<div class="small" style="margin-top:4px">' + g.total + " dice on the table</div></div>" +
      '<div class="cupsrow">' + g.mine.map(function (d) { return die(d); }).join("") + "</div></div>" + board + "</div>";
    if (g.history.length) html += '<div class="mglog">' + g.history.slice(-6).map(function (h) { return "<p>" + esc(h) + "</p>"; }).join("") + "</div>";
    if (g.over) {
      return html + '<p class="notice">' + (g.caught ? "Caught cheating: the pot is his." : g.won ? "You take the pot: " + g.stake * 2 + " gold." : "He takes the pot.") + "</p>" +
        '<div class="actions"><button class="primary" data-top="1" data-act="mgclosegame">Continue</button></div>';
    }
    if (g.revealed) return html + '<div class="actions"><button class="primary" data-act="mgnextround">Next round</button></div>';
    // The smallest legal raise opens the stepper and faces.
    var q = g.bid ? g.bid.q : 1, f = g.bid ? Math.min(6, g.bid.f + 1) : 1;
    if (g.bid && g.bid.f >= 6) { q += 1; f = 1; }
    html += '<div class="svc"><h4>Your bid</h4><div class="buyrow"><span class="small">At least</span>' + qstep("bid-q", q, g.total, 1) +
      '<span class="small">showing</span><input type="hidden" id="bid-f" value="' + f + '"><span class="faces">' + [1, 2, 3, 4, 5, 6].map(function (n) {
        return '<button type="button" class="' + (n === f ? "on" : "") + '" data-face="' + n + '" aria-label="' + n + '">' + die(n, "sm") + "</button>";
      }).join("") + "</span></div>" +
      '<div class="actions"><button class="primary" data-act="mgbid">Bid</button>' + (g.bid ? '<button class="secondary" data-act="mgliar">Call Liar!</button>' : "") + "</div></div>";
    if (!g.cheated) {
      html += '<details class="svc"><summary class="sc" style="cursor:pointer;color:#5e4528">Cheat: peek under his cup (once a game) <span class="susp">' +
        [0, 1].map(function (i) { return '<i class="' + (i < (v.marks || 0) ? "on" : "") + '"></i>'; }).join("") + "</span></summary>" +
        opts([opt({ act: "nop", label: "Peek at a die", check: v.cheatAssess, meta: "Two suspicion marks and you are caught: the pot is forfeit, and the pirates think less of you." })]) +
        '<div class="actions">' + g.his.map(function (d, i) { return '<button class="secondary" data-act="mgcheat" data-i="' + i + '">Die ' + (i + 1) + "</button>"; }).join("") + "</div></details>";
    }
    return html;
  }

  // ---- The Ship (§41.11) ----

  var SHIP_TABS = [["articles", "Articles"], ["crew", "Crew"], ["officers", "Officers"], ["cargo", "Cargo"], ["cabin", "Your Cabin"]];

  function shipMenu() {
    var tab = state.location.tab || (state.articles ? "crew" : "articles");
    var html = '<div class="tabs">' + SHIP_TABS.map(function (t) {
      return '<button data-act="shiptab" data-tab="' + t[0] + '" class="menubtn' + (t[0] === tab ? " on" : "") + '">' + t[1] + "</button>";
    }).join("") + "</div>" + barkHtml() + sayFor("ship");
    return html + ({ articles: articlesTab, crew: crewTab, officers: officersTab, cargo: cargoTab, cabin: cabinTab })[tab]();
  }

  // An officer's bark: a small card in the corner of the screen (§38.6).
  function barkHtml() {
    var b = state.location && state.location.bark;
    if (!b) return "";
    var o = aboard().filter(function (x) { return x.id === b.id; })[0];
    if (!o) return "";
    return '<div class="bark" style="position:relative;right:auto;top:auto;width:auto;max-width:560px;margin:4px 0 12px">' + officerFace(o, 34, 50) +
      "<div><b style=\"font-weight:normal\">" + esc(o.first) + ":</b> " + inline(b.line) + "</div></div>";
  }

  var articleDraft = null;
  var PURPOSE = { share: "Your cut of every haul.", officers: "What your officers and fleet captains take.", compensation: "What the maimed and the dismissed are paid.",
    quarter: "Whether captives may be executed.", discipline: "How hard you may drive the crew.", quarrels: "How feuds between officers are settled.", chest: "Where a prize's ship's chest goes." };

  function greedWord(n) { return n == null ? "" : n < 0 ? '<span style="color:#2f5a22">Generous</span>' : n > 0 ? '<span style="color:#8f2a1c">Harsh</span>' : "Fair"; }

  // The Greed gauge: a needle across Generous · Fair · Harsh · Cruel.
  function greedGauge(g) {
    var R = PC.data.articles.REPUTATION;
    var lo = -4, bands = R.map(function (r, i) { var from = i ? R[i - 1].max + 1 : lo; return { name: r.name, from: from, to: Math.min(r.max, 9) }; });
    var bi = 0; bands.forEach(function (b, i) { if (g >= b.from) bi = i; });
    var b = bands[bi], frac = b.to > b.from ? (Math.max(b.from, Math.min(b.to, g)) - b.from) / (b.to - b.from) : 0.5;
    var ang = Math.PI * (1 - (bi + 0.15 + 0.7 * frac) / 4);
    var cx = 120, cy = 110, r = 90;
    var arc = function (i, color) {
      var a0 = Math.PI * (1 - i / 4), a1 = Math.PI * (1 - (i + 1) / 4);
      return '<path d="M' + (cx + r * Math.cos(a0)) + " " + (cy - r * Math.sin(a0)) + " A" + r + " " + r + " 0 0 1 " + (cx + r * Math.cos(a1)) + " " + (cy - r * Math.sin(a1)) + '" stroke="' + color + '" stroke-width="16" fill="none"/>';
    };
    var lab = function (i, t) { var a = Math.PI * (1 - (i + 0.5) / 4); return '<text x="' + (cx + (r + 22) * Math.cos(a)) + '" y="' + (cy - (r + 22) * Math.sin(a) + 4) + '" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="13" fill="#5e4528">' + t + "</text>"; };
    return '<svg viewBox="-34 0 308 130" style="width:300px;max-width:100%" role="img" aria-label="Greed: ' + esc(b.name) + '">' +
      arc(0, "#2f5a22") + arc(1, "#b89a66") + arc(2, "#a8604a") + arc(3, "#8f2a1c") + lab(0, "Generous") + lab(1, "Fair") + lab(2, "Harsh") + lab(3, "Cruel") +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + (r - 8) * Math.cos(ang)) + '" y2="' + (cy - (r - 8) * Math.sin(ang)) + '" stroke="#2a1c10" stroke-width="3" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#7a2416"/></svg>';
  }

  function articlesTab() {
    var A = PC.data.articles;
    var signed_ = !!state.articles;
    var terms = signed_ ? state.articles.terms : (articleDraft = articleDraft || PC.articles.defaults());
    var g = signed_ ? state.articles.greed : PC.articles.greed(terms);
    var rd = PC.articles.readingFor(g), rep = PC.articles.reputation(g);
    var html = signed_ ? '<p class="small">Signed ' + esc(PC.state.SEASONS[state.articles.signed.season]) + " " + state.articles.signed.year + ".</p>" :
      '<div class="prose dropcap">' + prose(PC.data.firstSigning) + "</div>" +
      '<p class="small">You set the terms; the crew holds you to every word. The Standard terms are fair. Signing costs no action.</p>';
    html += A.SLOTS.map(function (s) {
      return '<div class="svc"><h4 style="margin-bottom:0">' + esc(s.name) + '</h4><p class="note" style="margin:0 0 6px">' + esc(PURPOSE[s.id] || "") +
        (s.noGreed ? " No Greed · change any time." : "") + '</p><div class="opts">' + s.options.map(function (o) {
          var on = terms[s.id] === o.id;
          var c = signed_ && !on ? PC.articles.amendCheck(state, s.id, o.id) : null;
          var tip = o.greed != null ? "Greed " + (o.greed > 0 ? "+" : "") + o.greed : "";
          return '<button class="opt' + (on ? " on" : "") + '"' + (signed_ && (on || !c.ok) ? " disabled" : "") + ' title="' + esc(tip) + '" data-act="' + (signed_ ? "artamend" : "artpick") + '" data-slot="' + s.id + '" data-opt="' + o.id + '">' +
            "<b>" + esc(o.label) + (o.id === "no_quarter" ? ' <span class="rel">tag: No Quarter</span>' : "") + "</b>" +
            '<span class="small">' + esc(o.text) + (s.noGreed ? "" : " · " + greedWord(o.greed)) + (c && c.ok && c.morale ? " · +" + c.morale + " morale" : "") + "</span>" +
            (c && !c.ok ? '<span class="small lock">' + esc(c.why) + "</span>" : "") + "</button>";
        }).join("") + "</div></div>";
    }).join("");
    var check = !signed_ && rd.dr != null ? PC.checks.assess(state, { type: "Pirate Code", dr: rd.dr }) : null;
    html += '<div class="svc" style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">' + greedGauge(g) + '<div style="flex:1;min-width:220px"><p class="sc" style="margin:0">Greed: ' + esc(rep.name) + "</p>" +
      '<ul class="small" style="padding-left:1.1em;margin:4px 0">' +
      "<li>" + (rd.cheer ? "The crew will cheer: morale +" + rd.cheer + "." : rd.dr == null ? "The crew will accept these terms." : "Terms this harsh have to be read out to the crew: a Pirate Code check.") + "</li>" +
      "<li>In port: " + (rep.pool === 1 ? "word of fair terms; crew pools as usual." : "crew pools " + (rep.pool > 1 ? "+" : "−") + Math.abs(Math.round((rep.pool - 1) * 100)) + "% at every port.") + "</li>" +
      "<li>You can always loosen a term. Harder terms wait for the Winter split.</li></ul>" + "</div></div>";
    if (!signed_) {
      html += (check ? opts([opt({ act: "nop", label: "Reading the Articles to the crew", check: check, meta: "A Pirate Code check at signing" })]) : "") +
        '<div class="actions"><button class="primary" data-act="artask">Sign the Articles</button><button class="secondary" data-act="artreset">Reset to Standard</button></div>';
    }
    return html;
  }

  function crewTab() {
    var c = state.crew, C = PC.crew, sh = state.ship;
    var colors = { Green: "#b89a66", Able: "#8a6414", Seasoned: "#5e4528", Veteran: "#2a1c10" };
    var bar = '<div class="hbar" style="height:18px;display:flex;max-width:680px">' + PC.data.economy.TIER_ORDER.map(function (t) {
      var n = c.tiers[t] || 0;
      return n ? '<i title="' + n + " " + t + '" style="position:static;display:inline-block;height:100%;width:' + (100 * n / sh.crewMax) + "%;background:" + colors[t] + '"></i>' : "";
    }).join("") + (c.wounded ? '<i title="' + c.wounded + ' wounded" style="position:static;display:inline-block;height:100%;width:' + (100 * c.wounded / sh.crewMax) + '%;background:repeating-linear-gradient(45deg,#8f2a1c 0 2px,transparent 2px 5px)"></i>' : "") + "</div>";
    var html = '<div class="svc"><h4>Hands · ' + c.count + " of " + sh.crewMax + (c.wounded ? " · " + c.wounded + " wounded" : "") + "</h4>" + bar +
      '<p class="small">' + PC.data.economy.TIER_ORDER.filter(function (t) { return c.tiers[t]; }).map(function (t) { return '<span title="' + esc(TIER_TIP[t]) + '" style="border-bottom:1px dotted">' + c.tiers[t] + " " + t + "</span>"; }).join(" · ") + "</p></div>";
    html += '<div class="svc"><h4>Morale · ' + c.morale + " · " + esc(C.band(c.morale)) + '</h4><div class="hbar" style="height:12px;max-width:680px"><i style="width:' + c.morale + '%;background:#2f5a22"></i></div></div>';
    html += '<table class="ledger wide">' +
      '<tr><th><span title="The average worth of your hands (Green 0 to Veteran 3), less 1 in a season when raw hands are over a quarter of the crew." style="border-bottom:1px dotted">Skill</span></th><td>' + C.skill(state) + (c.raw > 0.25 * c.count ? ' <span class="note">(raw hands this season: −1)</span>' : "") + "</td></tr>" +
      '<tr><th><span title="How well the crew follow orders. Fed by your Quartermaster, Strict Articles and Make an Example." style="border-bottom:1px dotted">Discipline</span></th><td>' + C.discipline(state) + "</td></tr>" +
      '<tr><th><span title="Skill and Discipline together: what the crew adds in a fight." style="border-bottom:1px dotted">Crew Rating</span></th><td>' + C.crewRating(state) + "</td></tr>" +
      lrow("Guns drilled", C.drilled(state) ? "Yes" : "No") +
      '<tr><th><span title="What one hand takes from a haul, at the current Articles." style="border-bottom:1px dotted">One share</span></th><td>' + gold(Math.round(C.oneShare(state))) + " crew gold</td></tr></table>";
    var rallyUsed = C.usedThisSeason(state, "rally"), drillUsed = C.usedThisSeason(state, "drill");
    var ex = C.canMakeExample(state);
    html += opts([
      opt({ act: "rally", label: "Rally the crew " + apText(1), ap: 1, check: rallyUsed ? null : PC.checks.assess(state, C.rallyCheck(state)), meta: "Morale +5 on a partial, +10 on a clean result. Once a season.",
        lock: rallyUsed ? "Done this season" : !state.ap.left ? "No actions left this season" : null }),
      opt({ act: "drill", label: "Drill the guns " + apText(1), ap: 1, meta: C.skill(state) >= 2 ? "Your hands are already drilled." : "The crew count as drilled (+1 Gunnery) for the rest of the season. Once a season.",
        lock: drillUsed ? "Done this season" : C.skill(state) >= 2 ? "Already drilled" : !state.ap.left ? "No actions left this season" : null }),
      opt({ act: "example", label: "Make an example of a troublemaker", check: ex.ok ? PC.checks.assess(state, { type: "Discipline", dr: 2 }) : null,
        meta: "No action · once a season, only when the crew is Sullen or Mutinous. Clean: Pressure −2, Discipline +1 for the season, Dread up. Partial: Pressure −1, morale −5. Setback: morale −5.", lock: ex.ok ? null : ex.why }),
    ]);
    var giveMax = state.money.purse;
    html += '<div class="svc"><h4>Give to the crew</h4><p class="small">Move gold from your purse into crew gold: +1 morale for every 5 gold a head (at most +10 a gift, +15 a season).</p>' +
      (giveMax > 0 ? '<div class="buyrow">' + qstep("q-give", Math.min(giveMax, c.count * 5 * 2), giveMax) + '<button class="secondary" data-act="give" data-for="q-give">Give</button> ' +
        totalSlot(function () { var n = val("q-give"); return gold(n) + " gold · morale +" + (n > 0 ? PC.crew.giftMorale(state, n) : 0); }) + "</div>" : '<p class="note">Your purse is empty.</p>') + "</div>";
    html += '<div class="svc"><h4>Rationing</h4><p class="small">' + (c.rationing ? "On: provisions burn 25% slower, and a Ration Stores check each season sets the cost to morale." : "Off.") + "</p>" +
      '<button class="secondary" data-act="rationing">' + (c.rationing ? "Lift rationing" : "Order rationing") + "</button></div>";
    return html;
  }

  function officerCard(o, full) {
    var t = PC.data.creator.OFFICER_TYPES.filter(function (x) { return x.id === o.type; })[0];
    var traits = [o.voice, o.secondary, o.third, o.unique && o.unique !== o.voice ? o.unique : null].filter(Boolean);
    return '<div class="person" style="margin:12px 0">' + officerFace(o, 72, 108) + '<div class="pmain"><div class="namecard"><b>' + esc((o.first + " " + (o.last || "")).trim()) + "</b>" +
      '<span class="role">' + esc(o.type + (officerRole(o) ? " · " + officerRole(o) : "")) + "</span>" + relWord(PC.npcs.rungName(o.rung)) + "</div>" +
      (traits.length ? '<p class="small" style="margin:0"><i>' + esc(traits.join(", ")) + "</i></p>" : "") +
      (t ? '<p class="small" style="margin:2px 0">' + esc(t.perk) + "</p>" : "") +
      (o.mentor && t ? '<p class="small" style="margin:2px 0">Old Lessons: ' + esc(t.lessons) + "</p>" : "") +
      (full ? "" : '<button class="link small" data-act="openmenu" data-menu="officer:' + esc(o.id) + '">Notes ›</button>') + "</div></div>";
  }

  function officersTab() {
    var list = aboard();
    var q = state.actingQM && state.actingQM.active ? '<div class="person" style="margin:12px 0">' + sil(72, 108) + '<div class="pmain"><div class="namecard"><b>' + esc(state.actingQM.full) +
      '</b><span class="role">Acting Quartermaster</span></div><p class="small">With no officers aboard, the crew elected one of their own. No officer slot, no bonuses; a real officer wins the next vote.</p></div></div>' : "";
    if (!list.length) return q + '<p class="note">No officers aboard.</p>';
    return q + list.map(function (o) { return officerCard(o); }).join("") +
      '<p class="note">Officers are hired at the Tavern: 1,000 crew gold each, one action a visit. One of each type; a new hire of a type you hold replaces the old one.</p>';
  }

  function cargoTab() {
    var html = holdBar() + '<p class="small">Treasure packs five units to a slot.</p>';
    var rows = [{ what: "provisions", label: "Provisions lots", n: state.provisions, dirty: false }];
    ["clean", "dirty"].forEach(function (k) { if (state.cargo.treasure[k]) rows.push({ what: "treasure", label: (k === "dirty" ? "Dirty" : "Clean") + " treasure", n: state.cargo.treasure[k], dirty: k === "dirty" }); });
    Object.keys(state.cargo.goods).forEach(function (g) {
      ["clean", "dirty"].forEach(function (k) { var n = state.cargo.goods[g][k]; if (n) rows.push({ what: g, label: (k === "dirty" ? "Dirty " : "") + g, n: n, dirty: k === "dirty" }); });
    });
    html += '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Jettison</th></tr>' + rows.map(function (r, i) {
      var info = PC.data.goods[r.what];
      return "<tr><td>" + esc(r.label) + (info && info.stores ? " " + STORES : "") + "</td><td>" + r.n + "</td><td>" + (r.n ? '<div class="buyrow">' + qstep("q-jet-" + i, 1, r.n) +
        '<button class="secondary" data-act="jettison" data-what="' + esc(r.what) + '" data-dirty="' + (r.dirty ? 1 : 0) + '" data-for="q-jet-' + i + '" data-big="' + (r.what === "treasure" ? 1 : 0) + '">Over the side</button></div>' : "") + "</td></tr>";
    }).join("") + "</table>";
    var used = PC.crew.usedThisSeason(state, "stores");
    var choices = PC.crew.storeChoices(state);
    var need = PC.crew.storesNeeded(state);
    html += '<div class="svc"><h4>' + STORES + " Open the stores</h4><p class=\"small\">Once a season, no action: " + plural(need, "unit") + " of drink or tobacco for your " + state.crew.count + " hands.</p>" +
      (used ? '<p class="note">Opened this season.</p>' : !choices.length ? '<p class="note">Not enough drink or tobacco aboard.</p>' :
        '<div class="actions">' + choices.map(function (c) { return '<button class="secondary" data-act="stores" data-good="' + esc(c.good) + '">Open the ' + esc(c.good.toLowerCase()) + " (+" + c.morale + " morale)</button>"; }).join("") + "</div>") + "</div>";
    return html;
  }

  function cabinTab() {
    return '<div class="hotframe" style="display:flex;align-items:center;justify-content:center"><p class="note" style="text-align:center;background:rgba(239,227,198,.85);padding:6px 14px">Woodcut · your cabin (simple)<br>16 : 10 · 1600 × 1000</p></div>' +
      '<p class="note">Your cabin and its display spots come with the items work. Not in the prototype.</p>';
  }

  // ---- The always-available menus (§38.5, §41.12) ---------------------------
  // Journal, Rumors, Captain, Notes and Menu open over any screen, mid-scene
  // included. They change nothing in the game but the notes.

  var menu = null;
  var journalTab = "quests";
  var showAllSkills = false;

  function menuHtml() {
    if (!menu) return dialogHtml();
    var body = menu === "menu" ? menuMain() : menu === "settings" ? menuSettings() : !state ? "" :
      menu === "journal" ? menuJournal() : menu === "rumors" ? menuRumors() : menu === "captain" ? menuCaptain() : menu === "notes" ? menuNotes() :
      menu === "dev" ? menuDev() : menu.indexOf("officer:") === 0 ? menuOfficer(menu.slice(8)) : "";
    return '<div class="modal" data-act="closemenu"><div class="panel' + (menu === "captain" || menu === "dev" ? " wide" : "") + '" data-stop="1">' +
      '<button class="secondary close" data-act="closemenu" aria-label="Close">' + ic("x") + "</button>" + body + "</div></div>" + dialogHtml();
  }

  function menuMain() {
    return "<h2>Menu</h2>" + '<div class="title-buttons" style="margin:10px 0">' +
      (state ? '<button class="secondary" data-act="export">Save file</button>' : "") +
      '<button class="secondary" data-act="import">Load file</button>' +
      '<button class="secondary" data-act="openmenu" data-menu="settings">Settings</button>' +
      (state && settings.dev ? '<button class="secondary" data-act="openmenu" data-menu="dev">Developer</button>' : "") +
      (state ? '<button class="secondary" data-act="quit">Title</button>' : "") + "</div>" +
      (state ? '<p class="note">The game saves itself after every action.</p>' : "");
  }

  function menuSettings() {
    return "<h2>Settings</h2>" +
      '<label class="tog"><input type="checkbox" data-act="setreduce"' + (settings.reduceMotion ? " checked" : "") + "> Reduced motion</label>" +
      '<label class="tog"><input type="checkbox" data-act="setdev"' + (settings.dev ? " checked" : "") + "> Developer mode</label>" +
      '<p class="note">Developer mode shows the testing tools in the Menu. Reduced motion also follows your device setting.</p>' +
      '<div class="actions"><button class="primary" data-act="' + (state ? "openmenu" : "closemenu") + '" data-menu="menu">Done</button></div>';
  }

  // The Journal (§41.12): Quests and the Log.
  function menuJournal() {
    var html = "<h2>Journal</h2>" + '<div class="tabs">' + [["quests", "Quests"], ["log", "Log"]].map(function (t) {
      return '<button class="menubtn' + (journalTab === t[0] ? " on" : "") + '" data-act="jtab" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    if (journalTab === "log") {
      var groups = [], cur = null;
      state.log.forEach(function (l) {
        var m = /^— (.+) begins\. —$/.exec(l);
        if (m || !cur) { cur = { title: m ? m[1] : "Before", lines: [] }; groups.push(cur); if (m) return; }
        cur.lines.push(l);
      });
      return html + (groups.length ? groups.reverse().map(function (g) {
        return '<div class="qcard"><h4>' + esc(g.title) + '</h4><ul class="small" style="padding-left:1.1em">' + g.lines.slice().reverse().map(function (l) { return "<li>" + esc(l.trim()) + "</li>"; }).join("") + "</ul></div>";
      }).join("") : '<p class="note">Nothing yet.</p>');
    }
    var q = PC.quests.journal(state);
    var open = q.filter(function (j) { return j.status !== "done"; }), done = q.filter(function (j) { return j.status === "done"; });
    var card = function (j) {
      return '<div class="qcard"><h4>' + esc(j.name) + "</h4>" + (j.objective ? '<p class="obj">' + inline(j.objective) + "</p>" : "") + (j.summary ? '<p class="small">' + inline(j.summary) + "</p>" : "") +
        (j.needed ? '<p class="small">Leads: ' + j.leads + " of " + j.needed + "</p>" : "") +
        (j.entries.length ? '<ul class="small" style="padding-left:1.1em">' + j.entries.map(function (e) { return "<li>" + inline(e) + "</li>"; }).join("") + "</ul>" : "") +
        (j.beyond ? '<p class="small"><i>' + esc(j.beyond) + "</i></p>" : "") +
        (j.deadline ? '<p class="dl' + (j.lastSeason ? " last" : "") + '">' + esc(j.deadline) + "</p>" : "") + "</div>";
    };
    return html + (open.length ? open.map(card).join("") : '<p class="note">No quests open.</p>') +
      (done.length ? '<details style="margin-top:12px"><summary class="sc" style="cursor:pointer">Done</summary>' + done.map(card).join("") + "</details>" : "");
  }

  // Rumors (§41.12): the leads tracker on top, then by type.
  function menuRumors() {
    var html = "<h2>Rumors</h2>";
    var q = PC.quests.journal(state).filter(function (j) { return j.needed && j.status !== "done"; });
    if (q.length) html += '<div class="svc"><h4>Leads</h4>' + q.map(function (j) { return '<p class="small" style="margin:2px 0">' + esc(j.name) + ": " + j.leads + " of " + j.needed + "</p>"; }).join("") + "</div>";
    var live = PC.rumors.liveRumors(state);
    var types = {};
    live.forEach(function (r) { (types[r.type] = types[r.type] || []).push(r); });
    return html + (live.length ? Object.keys(types).map(function (t) {
      return '<div class="qcard"><h4>' + esc(t) + '</h4><ul style="padding-left:1.1em;font-size:18px">' + types[t].map(function (r) {
        return "<li>" + inline(r.text) + ' <span class="note">(' + esc(r.source) + (r.expires != null ? "; good until the end of " + esc(PC.state.SEASONS[r.expires % 4]) + " " + Math.floor(r.expires / 4) : "") + ")</span></li>";
      }).join("") + "</ul></div>";
    }).join("") : '<p class="note">Nothing heard yet.</p>');
  }

  // A modifier's effect in one line, from its record (content/modifiers.js).
  function modLine(name) {
    var m = (PC.data.modifiers || {})[name];
    if (!m) return "";
    var bits = (m.edge || []).map(function (e) {
      var what = e.type || e.stat || (e.group ? e.group + " checks" : e.any ? "every check" : "");
      var when = e.when ? " (" + (e.when.condition || (e.when.anyOf || []).join(" or ")) + ")" : "";
      return signed(e.value) + " " + what + when;
    });
    if (m.reroll) bits.push("reroll " + m.reroll.types.join(" or ") + " once a season");
    if (!bits.length && m.note) bits.push(m.note);
    return bits.join("; ");
  }

  function skillsBlock() {
    var c = state.captain, T = PC.data.checkTypes, all = Object.keys(T);
    var html = "";
    PC.checks.STATS.forEach(function (s) {
      var list = all.filter(function (t) { return T[t].stat === s; }).map(function (t) {
        var a = PC.checks.assess(state, { type: t, dr: 0 });
        var mod = a.parts.filter(function (p) { return !/^(Cunning|Daring|Command|Seamanship|Charm|Grit)$/.test(p.label) && !/training|Difficulty/i.test(p.label); }).length;
        return { t: t, total: a.edge, trained: (c.training || {})[t] || 0, mod: mod, player: T[t].player };
      }).filter(function (x) { return showAllSkills || x.trained || x.mod; });
      if (!list.length) return;
      html += '<p class="sc" style="margin:10px 0 2px">' + esc(s) + " " + c.stats[s] + '</p><table class="ledger" style="max-width:420px">' + list.map(function (x) {
        return '<tr><th><span' + (x.player ? ' title="' + esc(x.player) + '" style="border-bottom:1px dotted"' : "") + ">" + esc(x.t) + "</span>" + (x.trained ? ' <span class="note">trained +' + x.trained + "</span>" : "") + "</th><td>" + signed(x.total) + "</td></tr>";
      }).join("") + "</table>";
    });
    return html + '<p><button class="link" data-act="allskills">' + (showAllSkills ? "Show only my skills" : "Show all " + Object.keys(T).length) + "</button></p>";
  }

  // The full captain sheet (§41.12).
  function menuCaptain() {
    var c = state.captain, pic = PC.creator.captainPortrait(c);
    var loss = (PC.data.creator.LOSSES || []).filter(function (l) { return l.id === c.loss; })[0];
    var stats = PC.checks.STATS.map(function (s) { return '<div class="vbar" style="width:auto"><span class="gp" style="font-size:34px">' + c.stats[s] + '</span><span class="sc">' + esc(s) + "</span></div>"; }).join("");
    var lines = function (list, kind) {
      return list.map(function (n) {
        return '<li><b style="font-weight:normal">' + (kind === "flaw" ? '<span class="manicule flaw">☞</span> ' : "") + esc(n) + '</b> <span class="note">' + esc(modLine(n)) + "</span></li>";
      }).join("");
    };
    return "<h2>Captain</h2>" + '<div class="person">' + (pic ? '<img src="' + assetUrl(pic) + '" alt="" style="width:120px;height:180px">' : "") +
      '<div class="pmain"><p class="gp" style="font-size:30px;margin:0">' + esc((c.first + " " + c.last).trim()) + "</p>" +
      '<p style="margin:2px 0">Age ' + c.age + " · Ash-Born of " + esc(c.homeCity) + (c.profession ? " · once " + esc(aOrAn(c.profession.toLowerCase())) : "") + "</p>" +
      (loss ? '<p class="small" style="margin:2px 0">' + esc(loss.name) + ": " + esc(loss.tag) + "</p>" : "") +
      '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px">' + stats + "</div></div></div>" +
      '<div class="h4">Skills</div>' + skillsBlock() +
      '<div class="h4">Traits, flaw, old ailments and tags</div><ul style="padding-left:1.1em;font-size:18px">' +
      lines(c.traits || []) + lines(c.flaws || [], "flaw") + lines(c.debuffs || []) + lines((c.tags || []).filter(function (t) { return (c.debuffs || []).indexOf(t) < 0; })) + "</ul>" +
      '<div class="h4">Items and equipment</div><p class="small">' + esc((c.items || []).join(", ") || "Nothing yet.") + ' <span class="note">The equipment screen comes later.</span></p>' +
      '<div class="h4">Ship and stores</div><table class="ledger wide">' +
      lrow("Ship", esc(state.ship.type) + " <i>" + esc(state.ship.name) + "</i>") + lrow("Hull · Speed", Math.round(state.ship.hull) + " / " + state.ship.hullMax + " · " + state.ship.speed) +
      lrow("Guns", state.ship.guns + " of " + state.ship.gunsMax) + lrow("Provisions", state.provisions + " lots") +
      lrow("Hold", PC.crew.slotsUsed(state) + " of " + PC.crew.holdCapacity(state)) + lrow("Crew Rating", PC.crew.crewRating(state)) + "</table>" +
      meters(true) + '<p class="small" style="margin-top:12px">' + seal().replace('class="seal"', 'class="seal" style="display:inline-flex"') + "</p>";
  }

  function menuNotes() {
    var notes = state.notes || {};
    var people = [{ id: "voyage", name: "The voyage", ph: "What's happened, what's next" }, { id: "captain", name: (state.captain.first + " " + state.captain.last).trim() + " (your captain)", ph: "Who are they to you?" }].concat(
      aboard().map(function (o) { return { id: "officer:" + o.id, name: (o.first + " " + (o.last || "")).trim() + " (" + o.type + ")", ph: "Who are they to you?" }; }));
    return "<h2>Notes</h2><p class=\"note\">Your own notes. Nothing in the game reads them; they travel with your save.</p>" + people.map(function (p) {
      return '<div class="svc"><h4>' + esc(p.name) + '</h4><textarea class="note-box" rows="3" data-note="' + esc(p.id) + '" placeholder="' + esc(p.ph) + '">' + esc(notes[p.id] || "") + "</textarea></div>";
    }).join("");
  }

  function menuOfficer(id) {
    var o = (state.officers || []).filter(function (x) { return x.id === id; })[0];
    if (!o) return "<h2>Officer</h2><p class=\"note\">No longer aboard.</p>";
    var notes = state.notes || {};
    return "<h2>" + esc(o.type) + "</h2>" + officerCard(o, true) +
      '<div class="svc"><h4>Your notes</h4><textarea class="note-box" rows="3" data-note="officer:' + esc(o.id) + '" placeholder="Who are they to you?">' + esc(notes["officer:" + o.id] || "") + "</textarea></div>";
  }

  // ---- Popups ----

  function popupHtml() {
    var p = state.location && state.location.popup;
    if (!p) return "";
    var list = (p.chips || p.lines.map(function (l) { return { icon: "rumor", text: l }; }));
    return '<div class="modal"><div class="panel" style="max-width:560px"><h2>' + esc(p.title) + "</h2>" + (p.text ? '<div class="prose">' + prose(p.text) + "</div>" : "") + chips(list) +
      '<div class="actions">' + (p.back ? '<button class="secondary" data-act="' + p.back + '">Go back</button>' : "") +
      '<button class="primary" data-act="' + (p.ok || "closepopup") + '">' + esc(p.okLabel || "Continue") + "</button></div></div></div>";
  }

  // ---- Developer (§41.12): hidden unless Developer mode is on ----

  function menuDev() {
    var v = PC.validate(state);
    var list = function (arr) { return arr.length ? '<ul class="small">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="note">None.</p>'; };
    var grp = function (t, body) { return '<div class="devgroup"><span class="sc">' + t + "</span>" + body + "</div>"; };
    var b = function (a, t, extra) { return '<button class="secondary" data-act="' + a + '"' + (extra || "") + ">" + t + "</button>"; };
    var here = state.location ? N().nodeData(N().here(state)) : null;
    return "<h2>Developer</h2>" +
      grp("Display", '<label class="tog"><input type="checkbox" data-act="toggledice"' + (state.settings.showDice ? " checked" : "") + "> Show the dice on results</label>" +
        '<label class="tog"><input type="checkbox" data-act="togglegender"' + (state.captain.gender === "f" ? " checked" : "") + "> Woman captain (tests the pronoun swap)</label>") +
      grp("Time", '<div class="actions">' + b("addap", "+1 action") + b("fillap", "Top up actions") + b("devnewseason", "Start the next season") + b("tohub", "Back to the town menu") + "</div>") +
      (state.location ? grp("Money and cargo", '<div class="actions">' + b("devgold", "+500 crew gold") + b("devpurse", "+500 purse") + b("devtreasure", "+10 clean treasure", ' data-dirty="0"') +
        b("devtreasure", "+10 dirty treasure", ' data-dirty="1"') + b("devdamage", "Damage the hull (−5)") + b("devarrive", "The arrival popup (back from a hunt, 4 wounded)") + "</div>") : "") +
      (state.location ? grp("Story", (PC.devtools && PC.devtools.skipQuests ? '<div class="actions">' + b("devskip", "Skip the mandatory quests") + "</div>" : "") +
        '<p class="small">Loss variant: ' + ["A", "B", "C"].map(function (x) { return '<button class="' + (state.captain.loss === x ? "primary" : "secondary") + '" data-act="devloss" data-loss="' + x + '">' + x + "</button>"; }).join(" ") +
        " · Frisian posture: " + PC.state.POSTURES.map(function (p) { return '<button class="' + (state.world.posture === p ? "primary" : "secondary") + '" data-act="devposture" data-posture="' + p + '">' + p + "</button>"; }).join(" ") + "</p>" +
        '<p class="small">Jump to a scene: <select class="devscene">' + Object.keys(PC.data.scenes).filter(function (id) { return id.indexOf("ocr_") === 0; }).map(function (id) {
          return '<option value="' + esc(id) + '">' + esc(id) + "</option>";
        }).join("") + "</select> " + b("devjump", "Go") + "</p>") : "") +
      (state.location ? grp("The hunt", '<p class="small">Next sighting: ' + b("devforce", "Avalon hunter", ' data-kind="hunter" data-flag="Avalon"') + b("devforce", "Frisian hunter", ' data-kind="hunter" data-flag="Frisia"') +
        b("devforce", "Sicilian hunter", ' data-kind="hunter" data-flag="Sicily"') + b("devforce", "French hunter", ' data-kind="hunter" data-flag="France"') + b("devforce", "Convoy", ' data-kind="convoy"') +
        b("devforce", "Escorted merchant", ' data-kind="escort"') + b("devforce", "Warship", ' data-kind="warship"') + b("devforce", "Pirate sloop", ' data-kind="ship" data-flag="Pirate" data-cls="Sloop"') + "</p>" +
        '<p class="small">Add a fleet ship (generated officer-captain): ' + ["Sloop", "Schooner", "Brigantine", "Brig"].map(function (c) { return b("devfleet", c, ' data-cls="' + c + '"'); }).join("") + "</p>" +
        '<p class="small">Avalon Heat: ' + [0, 25, 55, 85].map(function (h) { return b("devheat", String(h), ' data-f="avalon" data-v="' + h + '"'); }).join("") + " · Frisian Heat: " + [0, 55, 85].map(function (h) { return b("devheat", String(h), ' data-f="frisia" data-v="' + h + '"'); }).join("") +
        " · " + b("devfullcrew", "Full crew, guns and hull") + "</p>") : "") +
      grp("Start", '<div class="actions">' + b("quickask", "Quick start with the test captain") + "</div>") +
      grp("Info", '<p class="small">World seed ' + esc(state.world.seed) + " · save version " + state.saveVersion + "</p>" +
        (here ? '<p class="small">' + esc(here.name) + "'s people this world: " + here.slots.map(function (sl) { var g = state.generated[sl.id]; return esc(sl.label + ": " + g.full + " (" + (g.gender === "f" ? "woman" : "man") + ", " + g.age + "; " + g.traits.join(", ") + ")"); }).join(" · ") + "</p>" : "") +
        "<p><b>Content check: errors</b></p>" + list(v.errors) + "<p><b>Warnings</b></p>" + list(v.warnings));
  }

  // ---- The prologues (§40) ----
  // The opening plays after New game and before the creator; the closing
  // after Set sail and before the beach. The screens are js/prologue.js.
  var prologue = null;
  function drawPrologue() {
    var p = prologue;
    if (p.running) return;
    p.running = true;
    PC.prologue.play(root, {
      kind: p.kind, reduce: reducedMotion(), tokens: p.tokens || {}, home: p.home,
      assetUrl: function (path) { return (PC.assets && PC.assets[path]) || path; },
      onDone: function () {
        prologue = null;
        if (p.kind === "opening") startCreator();
        else state = p.game;
        draw(); scrollTop();
      },
    });
  }

  // ---- Node actions ----------------------------------------------------------

  function qty(el) {
    var box = el.dataset.for ? document.getElementById(el.dataset.for) : null;
    var n = box ? Math.floor(Number(box.value)) : 1;
    if (!(n > 0)) throw new Error("Choose a number above zero.");
    if (box && box.max && n > Number(box.max)) n = Number(box.max);
    return n;
  }

  function enterPlace(place) {
    var fire = N().enter(state, place);
    diveZone = null; drinkSpot = null;
    state.location.said = {}; state.location.bark = null;
    if (fire) PC.scenes.enterScene(state, fire);
  }

  function who(slot) { return N().slotNpc(N().here(state), slot); }
  function firstName(id) { return PC.npcs.get(state, id).first; }

  var nodeHandlers = {
    // ---- The minigames (§18) ----
    "drink": function () { drinkSpot = null; mgMark = 0; PC.drinking.start(state); },
    "dice": function () { PC.liarsdice.start(state); },
    "divewreck": function (el) { diveZone = null; mgMark = 0; PC.salvage.startGraveyardDive(state, el.dataset.wreck, false); },
    "divequick": function (el) { diveZone = null; mgMark = 0; PC.salvage.startGraveyardDive(state, el.dataset.wreck, true); },
    "miranda": function () { diveZone = null; mgMark = 0; PC.salvage.retryMiranda(state); },
    "divezone": function (el) { diveZone = el.dataset.zone; },
    "drinkspot": function (el) { drinkSpot = drinkSpot === el.dataset.spot ? null : el.dataset.spot; },
    "mgdive": function (el) { markLog(); PC.salvage.act(state, el.dataset.op, el.dataset.zone); },
    "mgquick": function () { markLog(); PC.salvage.quickDive(state); },
    "mgbank": function (el) { PC.salvage.bank(state, state.minigame, el.dataset.pot); },
    "mgdrink": function (el) { markLog(); PC.drinking.act(state, el.dataset.op); drinkSpot = null; },
    "mgonemore": function (el) { markLog(); PC.drinking.oneMore(state, el.dataset.yes === "1"); },
    "mgreroll": function () { PC.minigames.reroll(state); },
    "mgaccept": function () { PC.minigames.settle(state); },
    "mgleave": function () { diveZone = null; drinkSpot = null; PC.minigames.leave(state); },
    "mgsize": function () { PC.liarsdice.sizeUp(state); },
    "mgstake": function (el) { PC.liarsdice.newGame(state, qty(el)); },
    "mgbid": function () { PC.liarsdice.bid(state, Number(document.getElementById("bid-q").value), Number(document.getElementById("bid-f").value)); },
    "mgliar": function () { PC.liarsdice.callLiar(state); },
    "mgcheat": function (el) { PC.liarsdice.cheat(state, Number(el.dataset.i)); },
    "mgnextround": function () { PC.liarsdice.nextRound(state); },
    "mgclosegame": function () { PC.liarsdice.closeGame(state); },
    "mgstop": function () { PC.liarsdice.stop(state); },
    // ---- The prize hunt (Milestone 5) ----
    "hunt": function () { mgMark = 0; var f = devForce; devForce = null; PC.hunt.start(state, { force: f }); },
    "hnext": function () { markLog(); PC.hunt.next(state, state.minigame); },
    "hengage": function () { markLog(); PC.hunt.engage(state, state.minigame); },
    "hhunter": function () { markLog(); PC.hunt.meetHunter(state, state.minigame); },
    "hb": function (el) {
      markLog();
      var a = el.dataset.arg, fn = el.dataset.fn;
      if (fn === "showOfForce" || fn === "press") a = a === "yes";
      PC.hunt.battle(state, state.minigame, fn, a);
    },
    "hassign": function (el) { PC.hunt.battle(state, state.minigame, "assignFleetShip", el.dataset.ship, el.dataset.what); },
    "hrepair": function () { markLog(); PC.hunt.doRepair(state, state.minigame); },
    "hprize": function () {
      var pick = function (n, d) { var x = document.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : d; };
      var off = document.querySelector(".hofficer");
      PC.hunt.settlePrize(state, state.minigame, { hull: pick("h-hull", "release"), crew: pick("h-crew", "release"), captives: pick("h-cap", "free"), officer: off ? off.value : null });
    },
    "hcarry": function () { markLog(); PC.hunt.carryOn(state, state.minigame); },
    "hmore": function () { markLog(); PC.hunt.anotherBatch(state, state.minigame); },
    "hhome": function () { PC.hunt.sailHome(state, state.minigame); PC.minigames.leave(state); },
    "sellhull": function (el) {
      var id = who("shipwright");
      var r = N().sellHull(state, el.dataset.ship);
      say(id, firstName(id), r.line, r.gold ? gold(r.gold) + " crew gold." + (r.home ? " " + plural(r.home, "hand") + " come back aboard." : "") + (r.paid ? " " + plural(r.paid, "hand") + " paid off: no berths." : "") : null);
      if (r.gold) toast("Sold her · +" + gold(r.gold) + " crew gold");
    },
    "stripguns": function (el) { var n = N().stripGuns(state, el.dataset.ship); toast(plural(n, "gun") + " moved to your flagship"); },
    "goplace": function (el) { if (state.current.screen === "node") enterPlace(el.dataset.place); },
    "leaveplace": function () {
      var fire = N().leave(state);
      if (fire) PC.scenes.enterScene(state, fire);
    },
    "nop": function () {},
    // The Tavern Talk: the captain's line shows between the keeper's
    // greeting and the rumors (the M3 review, §37.9).
    "rumors": function () {
      var id = who("keeper");
      var g = N().talkToKeeper(state);
      var r = PC.rumors.askKeeper(state);
      var L = N().nodeData(N().here(state)).lines.keeper;
      if (r.refuse) { say(id, firstName(id), r.line); return; }
      var heard = r.rumors.map(function (x) { return x.text; });
      // One quote, running on: "I did hear one other thing... [rumor]" (the author, UI pass 1 review).
      if (r.extra) heard.push(joinQuotes(r.extraLine, r.extra.text));
      say(id, firstName(id), g.line, null, heard, { ask: L.askRumors, heardNote: heard.length ? "Added to your Rumors." : null,
        chips: state.settings.showDice ? [{ icon: "ap", text: "Tavern Talk: " + r.talk.outcome + " (dice " + r.talk.dice.join(" + ") + ", edge " + r.talk.edge + ")" }] : null });
    },
    // The keeper's other questions (§41.5): information only, no action.
    "keeperq": function (el) {
      var id = who("keeper");
      var r = N().askKeeperQuestion(state, el.dataset.q);
      if (r.refuse) { say(id, firstName(id), r.line); return; }
      say(id, firstName(id), r.line, null, null, { ask: r.label });
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
      say("around", null, { clean: "You ask around town, and people talk.", partial: "You ask around town and pick up a rumor.", setback: "You ask around town, but nobody tells you anything. They do notice you asking." }[r.outcome],
        r.pick && r.pick.length ? "Pick what you want to hear about." : null, heard, { heardNote: heard.length ? "Added to your Rumors." : null, chips: [{ icon: OUTCOME[r.outcome] ? "rumor" : "rumor", text: "Gather Intelligence: " + OUTCOME[r.outcome][0].toLowerCase() }] });
    },
    "gatherpick": function (el) {
      var r = PC.rumors.gatherPick(state, el.dataset.type);
      var prev = state.location.say || {};
      say("around", prev.who, prev.line, null, (prev.heard || []).concat(r ? [r.text] : []), { heardNote: "Added to your Rumors." });
    },
    "hireofficer": function (el) {
      var r = PC.officers.hire(state, el.dataset.officer);
      var o = r.officer;
      var note = (r.replaced ? r.replaced.officer.first + " is dismissed with " + r.replaced.pay + " crew gold: " + r.replaced.line + " " : "") +
        (r.mentorLine ? "[Mentor]: " + r.mentorLine : "");
      say("officers", null, (o.first + " " + (o.last || "")).trim() + " signs on as your " + o.type + ".", PC.text.render(note, state) || null);
    },
    "askfrench": function () {
      var f = N().nodeData(N().here(state)).fence.npc;
      say(f, firstName(f), PC.rumors.askFrench(state), null, null, { chips: [{ icon: "lead", text: "A new lead · the Hidden Haven · Journal updated", ink: "oxblood" }] });
    },
    "offerclean": function () {
      var f = N().nodeData(N().here(state)).fence.npc;
      state.location.said = state.location.said || {}; state.location.said.offerclean = true;
      say(f, firstName(f), N().nodeData(N().here(state)).lines.fence.offeredClean);
    },
    "offerdirty": function () {
      var prov = who("provisioner");
      state.location.said = state.location.said || {}; state.location.said.offerdirty = true;
      say(prov, firstName(prov), N().nodeData(N().here(state)).lines.provisioner.dirty);
    },
    "lodging": function (el) {
      var id = who("keeper");
      var r = N().lodging(state, Number(el.dataset.ap));
      say(id, firstName(id), r.line, null, null, { chips: [{ icon: "morale", text: "Crew morale +" + r.morale }] });
    },
    "repair": function (el) {
      var id = who("shipwright");
      var hp = el.dataset.all ? state.ship.hullMax - state.ship.hull : qty(el);
      var r = N().repair(state, hp);
      say(id, firstName(id), r.line, r.fixedRigging ? "The frayed rigging is fixed: Speed " + state.ship.speed + "." : null);
      bought(r, "Repaired " + hp + " hull");
    },
    "upgrade": function (el) { var id = who("shipwright"); var r = N().upgrade(state, el.dataset.track); say(id, firstName(id), r.line); bought(r, "Upgrade bought"); },
    "guns": function (el) { var id = who("shipwright"); var n = qty(el); var r = N().buyGuns(state, n); say(id, firstName(id), r.line); bought(r, "Bought " + plural(n, "gun")); },
    // One Sign button for every tier (§41.8).
    "signhands": function (el) {
      var plan = {};
      el.dataset.tiers.split(",").forEach(function (t) { plan[t] = val("q-hire-" + t); });
      var r = N().recruitBatch(state, plan);
      var leftOn = r.left ? Object.keys(r.left).map(function (t) { return r.left[t] + " " + t; }) : [];
      say("hands", null, r.line, r.n ? plural(r.n, "hand") + " for " + gold(r.cost) + " crew gold." + (r.upgraded ? " " + plural(r.upgraded, "of them turns", "of them turn") + " out better than they looked." : "") +
        (leftOn.length ? " No room for " + leftOn.join(", ") + "." : "") : null);
      if (r.n) toast("Signed " + plural(r.n, "hand") + " · −" + gold(r.cost) + " crew gold");
    },
    "docksroll": function () {
      var r = N().docksRoll(state);
      say("hands", null, "You walk the docks and size up who's looking for a berth.", null, null,
        state.settings.showDice ? { chips: [{ icon: "ap", text: "Recruit: " + r.outcome + " (dice " + r.dice.join(" + ") + ", edge " + r.edge + ")" }] } : null);
    },
    "haggle": function (el) {
      // The result stays as a line at the top of the block (§41.9).
      var r = N().haggle(state, el.dataset.npc);
      state.location.say = null;
      var pct = Math.round(Math.abs(N().HAGGLE[r.outcome]) * 100);
      toast("Haggle: " + OUTCOME[r.outcome][0] + " · prices " + pct + "% " + (N().HAGGLE[r.outcome] > 0 ? "in your favor" : "against you") +
        (state.settings.showDice ? " (dice " + r.dice.join(" + ") + ", edge " + r.edge + ")" : ""));
    },
    "payoff": function (el) { var n = qty(el); var r = N().payOff(state, el.dataset.tier, n); say("hands", null, r.line, gold(r.cost) + " crew gold."); bought(r, plural(n, "hand") + " put ashore"); },
    "buyprov": function (el) { var id = who("provisioner"); var n = qty(el); var r = N().buyProvisions(state, n); say(id, firstName(id), r.line, r.cost ? gold(r.cost) + " crew gold." : null); bought(r, "Bought " + n + " provisions"); },
    "buygood": function (el) { var id = who("provisioner"); var n = qty(el); var r = N().buyGood(state, el.dataset.good, n); say(id, firstName(id), r.line, r.cost ? gold(r.cost) + " crew gold." : null); bought(r, "Bought " + n + " " + el.dataset.good); },
    "sell": function (el) {
      var r = N().sell(state, el.dataset.buyer, el.dataset.what, qty(el));
      var id = el.dataset.buyer === "fence" ? N().nodeData(N().here(state)).fence.npc : who("provisioner");
      if (r.units) toast("Sold " + r.units + " · +" + gold(r.gold) + " crew gold");
      say(id, firstName(id), r.line, r.units ? "Sold " + r.units + " for " + gold(r.gold) + " crew gold." : null,
        r.rumor ? [r.rumor.leadIn + " " + r.rumor.rumor.text] : null, r.rumor ? { heardNote: "Added to your Rumors." } : null);
    },
    "shiptab": function (el) { state.location.tab = el.dataset.tab; state.location.say = null; state.location.bark = null; },
    "artpick": function (el) { articleDraft = articleDraft || PC.articles.defaults(); articleDraft[el.dataset.slot] = el.dataset.opt; },
    "artreset": function () { articleDraft = PC.articles.defaults(); },
    // The Articles popup comes before signing, with a way back (§38.7).
    "artask": function () {
      state.location.popup = { title: "Sign the Articles?", text: "You can loosen a term at any time, and the crew will thank you for it.\n\nHarder terms have to wait for the next split. A split is when the crew takes its shares and may sign new Articles, and splits happen only at the start of Winter.",
        chips: [], back: "closepopup", ok: "artsign", okLabel: "Sign them" };
    },
    "artsign": function () {
      state.location.popup = null;
      var r = PC.articles.sign(state, articleDraft || PC.articles.defaults());
      articleDraft = null;
      var text = { accepted: "The crew file up and put their names to it.", cheered: "The crew cheer as they sign.", clean: "You read the terms out and the crew sign without a murmur.", partial: "The crew sign, but there's grumbling.", setback: "The crew sign with sour faces." }[r.outcome];
      var mt = aboard().filter(function (o) { return o.mentor; })[0];
      say("ship", null, text, r.effects.length ? r.effects.join(", ") + "." : null);
      if (mt && !state.flags.mentor_first_articles) { state.flags.mentor_first_articles = true; state.location.bark = { id: mt.id, line: PC.data.officerLines.mentorFirstArticles }; }
      state.location.tab = "articles";
    },
    "artamend": function (el) { var c = PC.articles.amend(state, el.dataset.slot, el.dataset.opt); say("ship", null, "The change is read out to the crew.", c.morale ? "Crew morale +" + c.morale + "." : null); },
    "rally": function () { var r = PC.crew.rally(state); say("ship", null, { clean: "The men roar back at you.", partial: "A few cheers, and some nods.", setback: "The speech falls flat." }[r.outcome], r.gain ? "Crew morale +" + r.gain + "." : null); },
    "drill": function () { PC.crew.drill(state); say("ship", null, "The guns run in and out until the crew can do it in their sleep.", "Drilled for the rest of the season."); },
    "example": function () { var r = PC.crew.makeExample(state, "Discipline"); say("ship", null, "You make an example of a troublemaker: " + OUTCOME[r.outcome][0].toLowerCase() + "."); },
    "give": function (el) { var m = PC.crew.give(state, qty(el)); say("ship", null, "The gold goes into the crew's chest.", m ? "Crew morale +" + m + "." : "No change in morale."); },
    "rationing": function () { PC.crew.toggleRationing(state); },
    "jettison": function (el) {
      var n = qty(el);
      if ((el.dataset.big === "1" || n > 3) && !jettisonOk) { jettisonOk = { what: el.dataset.what, n: n, dirty: el.dataset.dirty === "1" };
        state.location.popup = { title: "Over the side?", text: "Throw " + n + " " + (el.dataset.what === "provisions" ? "lots of provisions" : el.dataset.what) + " overboard? It can't be fished back out.", chips: [], back: "jetcancel", ok: "jetconfirm", okLabel: "Over the side" };
        return; }
      PC.crew.jettison(state, el.dataset.what, n, el.dataset.dirty === "1");
    },
    "jetconfirm": function () { var j = jettisonOk; jettisonOk = null; state.location.popup = null; if (j) PC.crew.jettison(state, j.what, j.n, j.dirty); },
    "jetcancel": function () { jettisonOk = null; state.location.popup = null; },
    "stores": function (el) { var m = PC.crew.openStores(state, el.dataset.good); say("ship", null, "The crew drink to your health.", "Crew morale +" + m + "."); },
    "closepopup": function () { state.location.popup = null; },
    "firstsigning": function () {
      if (state.location.place) N().leave(state);
      enterPlace("ship");
      state.location.tab = "articles";
    },
  };
  var jettisonOk = null;

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
      dialog = null; menu = null; creating = false;
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
        '<div class="actions"><button data-act="download" class="primary">Download</button><button data-act="copy" class="secondary">Copy</button><button data-act="closedialog" class="secondary">Close</button></div>' +
        "</div></div>";
    }
    if (dialog === "import") {
      return '<div class="modal" data-act="closedialog"><div class="panel" onclick="event.stopPropagation()">' +
        "<h2>Load a save</h2><p>Choose a save file, or paste a copied save into the box.</p>" +
        '<p><input type="file" accept=".json,.txt,application/json,text/plain" data-act="pickfile"></p>' +
        '<textarea class="savetext pastebox" placeholder="Paste a save here"></textarea>' +
        '<div class="actions"><button data-act="loadpasted" class="primary">Load pasted save</button><button data-act="closedialog" class="secondary">Cancel</button></div>' +
        "</div></div>";
    }
    if (dialog === "confirmquick") {
      return '<div class="modal" data-act="closedialog"><div class="panel" onclick="event.stopPropagation()">' +
        "<h2>Quick start?</h2><p>The test captain replaces the game saved in this browser. Use Save file first if you want to keep it.</p>" +
        '<div class="actions"><button data-act="quickstart" class="primary">Quick start</button><button data-act="closedialog" class="secondary">Cancel</button></div>' +
        "</div></div>";
    }
    if (dialog === "confirmnew") {
      return '<div class="modal" data-act="closedialog"><div class="panel" onclick="event.stopPropagation()">' +
        "<h2>Start a new game?</h2><p>The game saved in this browser will be replaced. Use Save file first if you want to keep it.</p>" +
        '<div class="actions"><button data-act="newconfirmed" class="primary">Start a new game</button><button data-act="closedialog" class="secondary">Cancel</button></div>' +
        "</div></div>";
    }
    return "";
  }

  // A purchase lands with a toast, so a tap is never in doubt (the author's
  // phone notes: he bought twice the rum he meant to).
  function bought(r, what) {
    if (!r || r.failed || !r.cost) return;
    toast(what + " · −" + gold(r.cost) + " crew gold");
  }

  function toast(msg) {
    document.querySelectorAll(".toast").forEach(function (x) { x.remove(); }); // the newest replaces the last
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
    stepIndex = saved && typeof saved.step === "number" ? Math.min(saved.step, PC.creator.STEPS.length - 1) : 0;
    // A draft from before the Creator chat may hold a scrapped loss or a cut skill.
    if (draft.loss && !PC.creator.lossById(draft.loss)) draft.loss = null;
    Object.keys(draft.training || {}).forEach(function (t) { if (!PC.data.checkTypes[t]) delete draft.training[t]; });
    if (draft.freePoint && !PC.data.checkTypes[draft.freePoint]) draft.freePoint = null;
    PC.creator.fitToProfession(draft);
    draft.tags = (draft.tags || []).filter(function (t) { return PC.creator.entry(t) && !PC.creator.blockedBy({ tags: [], debuffs: [], traits: [], flaw: null }, t); });
    draft.shown = draft.shown || { captain: [], mentor: [], ship: [] };
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
    var body = creatorStep(); // may settle a default pick (the portrait in view)
    var errs = C.stepErrors(draft, stepId());
    var last = stepIndex === C.STEPS.length - 1;
    liveTotals = [];
    root.innerHTML = frame(
      '<div class="creator"><header class="topbar"><div><span class="brand">Pirate Chronicle</span><span class="wt">(working title)</span></div><span class="when">A new captain</span>' +
      '<span class="grow"></span><button class="menubtn" data-act="surprise" title="Fill every step at random">Surprise me</button>' +
      '<button class="menubtn" data-act="resetdraft">Start over</button><button class="menubtn" data-act="quit">Title</button></header>' +
      '<ol class="steps">' + steps + "</ol>" +
      '<div class="creator-body"><main class="stage">' + '<section class="cstep cstep-' + stepId() + '">' + body + "</section>" +
      '<div class="actions step-nav">' +
      (stepIndex > 0 ? '<button class="secondary" data-act="back">Back</button>' : "") +
      (last ? "" : '<button data-act="next" class="primary">Next</button>') +
      "</div>" +
      (errs.length && !last ? '<ul class="todo">' + errs.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" : "") +
      "</main>" + '<aside class="preview">' + previewCard() + "</aside></div></div>") + menuHtml();
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
    var stats = PC.checks.STATS.map(function (s) { return '<div class="vbar" style="width:auto"><span class="gp" style="font-size:24px">' + draft.stats[s] + '</span><span class="sc">' + esc(s) + "</span></div>"; }).join("");
    var tags = ["Ash-Born"].concat(loss ? [loss.tag] : [], draft.tags);
    return (pic ? '<img class="preview-portrait" src="' + assetUrl(pic) + '" alt="">' : '<div class="preview-portrait empty">No portrait yet</div>') +
      '<p class="capname" style="margin-top:4px">' + esc(name) + "</p>" +
      '<p class="note" style="margin:2px 0 8px">' + esc(bits.join(" · ")) + "</p>" +
      '<div style="display:flex;flex-wrap:wrap;gap:6px 10px">' + stats + "</div>" +
      (draft.traits.length || draft.flaw ? '<p class="small"><span class="sc">Traits:</span> ' + esc(draft.traits.join(", ")) + (draft.flaw ? ' · <span class="manicule flaw" style="font-size:16px">☞</span> ' + esc(draft.flaw) : "") + "</p>" : "") +
      '<p class="small"><span class="sc">Tags:</span> ' + esc(tags.join(", ")) + "</p>" +
      (draft.debuffs.length ? '<p class="small"><span class="sc">Old ailments:</span> ' + esc(draft.debuffs.join(", ")) + "</p>" : "") +
      (draft.shipName ? '<p class="small"><span class="sc">Ship:</span> <i>' + esc(PC.creator.shipName(draft.shipName)) + "</i></p>" : "");
  }

  function creatorStep() {
    switch (stepId()) {
      case "portrait": return stepPortrait();
      case "name": return stepName();
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

  function head(title, line) { return '<h2 class="title">' + title + "</h2>" + (line ? '<p class="note" style="font-size:19px;max-width:680px">' + line + "</p>" : ""); }

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
      (opts.max ? ' data-max="' + opts.max + '"' : "") + (blocked ? " disabled" : "") + ' aria-pressed="' + on + '">' +
      "<b>" + esc(title) + "</b>" + (body ? '<span class="small">' + esc(body) + "</span>" : "") + (opts.extra || "") +
      (!on && opts.blocked ? '<span class="small lock">' + esc(opts.blocked) + "</span>" : "") + "</button>";
  }

  function ailmentLine(n) { return n === 0 ? "no old ailments" : n === 1 ? "one old ailment" : "two old ailments"; }
  function tagLine(n) { return ["", "one starting tag", "two starting tags", "three starting tags"][n]; }

  // Portrait and age (§12.2): the slider, its band line, the cycler.
  function stepPortrait() {
    var C = PC.creator;
    var b = C.band(draft.age);
    var choices = C.captainPortraitChoices(draft);
    if (choices.length && !choices.some(function (c) { return c.set === draft.portraitSet; })) draft.portraitSet = choices[0].set; // what you see is what you pick
    var age = Number(draft.age) || 25;
    var track = "linear-gradient(90deg, rgba(47,90,34,.25) 0 " + (100 * 10.5 / 25) + "%, rgba(122,86,8,.25) 0 " + (100 * 20.5 / 25) + "%, rgba(143,42,28,.25) 0)";
    return head("Your captain") +
      '<label class="field"><span>Age</span><input class="slider" type="range" min="15" max="40" step="1" value="' + age + '" data-act="age" style="background:' + track + '"></label>' +
      '<p class="sc" style="margin:0">Age ' + age + (b ? " · " + tagLine(b.tags) + ", " + ailmentLine(b.debuffs) : "") + "</p>" +
      '<p class="note">15–25: one starting tag. 26–35: two tags and one old ailment. 36–40: three tags and two old ailments.</p>' +
      (choices.length ? cycler(choices, "portraitSet", "Portrait") : "") +
      '<p class="note" style="text-align:center">Your portrait ages with you, and an eyepatch replaces it if you lose an eye.</p>';
  }

  // No set names on screen (§12.2): the cycler counts, it doesn't name.
  function cycler(choices, field, label) {
    var cur = getField(field);
    var i = Math.max(0, choices.map(function (c) { return c.set; }).indexOf(cur));
    var c = choices[i];
    return '<div class="cycler">' +
      '<button class="arrow" data-act="cycle" data-field="' + field + '" data-dir="-1" aria-label="Previous portrait">‹</button>' +
      '<figure><img src="' + assetUrl(c.path) + '" alt="' + esc(label) + " " + (i + 1) + '">' +
      "<figcaption>" + (i + 1) + " of " + choices.length + "</figcaption></figure>" +
      '<button class="arrow" data-act="cycle" data-field="' + field + '" data-dir="1" aria-label="Next portrait">›</button></div>';
  }

  function stepName() {
    return head("Name") + '<div class="row2">' + textField("First name", "first", { max: 24 }) + textField("Last name", "last", { max: 24 }) + "</div>" +
      '<p><button class="secondary" data-act="randname">Random name</button></p>';
  }

  // Origin (§12.5): the origin cards, home city, old trade, what the fire took.
  function stepOrigin() {
    var C = PC.creator, Dc = PC.data.creator;
    var html = '<div class="cards">' + Dc.ORIGINS.map(function (o) {
      return o.locked ? '<button class="card blocked" disabled><b>' + esc(o.id) + '</b><span class="small lock">' + esc(o.locked) + "</span></button>"
        : '<div class="card on"><b>' + esc(o.id) + "</b></div>";
    }).join("") + "</div>";
    html += '<h3>Ash-Born</h3><p class="note">' + esc(Dc.ORIGINS[0].text) + "</p>" +
      '<div class="cards">' + Dc.HOME_CITIES.map(function (c) { return card("pick", "homeCity", c.id, c.id, null, { extra: '<span class="small"><i>' + esc(c.burned) + "</i> " + esc(c.effect) + "</span>" }); }).join("") + "</div>";
    html += '<h3>Your old trade</h3><p class="note">What you did before the fire. Pick one of its two skills for a free point of training.</p>' +
      '<div class="cards">' + Dc.PROFESSIONS.map(function (p) {
        var on = draft.profession === p.id;
        return '<div class="card' + (on ? " on" : "") + '"><b>' + esc(p.id) + '</b><span class="actions" style="margin-top:6px">' + p.free.map(function (t) {
          var pick = on && draft.freePoint === t;
          return '<button class="' + (pick ? "primary" : "secondary") + '" style="font-size:16px;padding:4px 10px;min-height:36px" data-act="trade" data-prof="' + esc(p.id) + '" data-skill="' + esc(t) + '" title="' + esc(PC.data.checkTypes[t].player) + '">' + esc(t) + "</button>";
        }).join("") + "</span></div>";
      }).join("") + "</div>";
    html += '<h3>What the fire took</h3><p class="note">Each loss weighs on you, and each can be won back—if you can find who took it.</p>' +
      '<div class="cards">' + C.lossChoices(draft).map(function (l) {
        return card("pick", "loss", l.id, l.name, l.text, { extra: '<span class="small lock" style="color:#7a2416">' + esc(l.tag) + ": " + esc(l.penalty) + "</span>" });
      }).join("") + "</div>";
    return head("Origin") + html;
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

  // The stats screen's text stays as built (§12.6).
  function stepStats() {
    var C = PC.creator;
    var left = C.statPointsLeft(draft);
    return head("Stats", "Every stat starts at 1. Spend <b>" + left + "</b> more point" + (left === 1 ? "" : "s") + ", at most 2 in a stat. A stat adds to every check in its family.") +
      '<table class="alloc">' + PC.checks.STATS.map(function (s) {
        return "<tr><th>" + esc(s) + '<br><span class="note">' + esc(STAT_TEXT[s]) + "</span></th><td>" +
          stepper("stat", s, draft.stats[s], C.canLowerStat(draft, s), C.canRaiseStat(draft, s)) + "</td></tr>";
      }).join("") + "</table>";
  }

  function familyTypes() {
    var fam = {};
    PC.checks.STATS.forEach(function (s) { fam[s] = []; });
    Object.keys(PC.data.checkTypes).forEach(function (t) { fam[PC.data.checkTypes[t].stat].push(t); });
    return fam;
  }

  var touch = (function () { try { return globalThis.matchMedia && globalThis.matchMedia("(hover: none)").matches; } catch (e) { return false; } })();

  // Skills (§12.6): the counter pinned on top, groups by stat, the bonus
  // on each row, the free point as a gilt pip, the Player line on hover/tap.
  function stepTraining() {
    var C = PC.creator;
    var left = C.trainingLeft(draft);
    var fam = familyTypes();
    var html = head("Training") +
      '<div class="notice" style="position:sticky;top:0;z-index:3;background:#efe3c6">' + (left ? "<b>" + left + "</b> point" + (left === 1 ? "" : "s") + " left to spend." : "All points spent.") + "</div>" +
      '<p class="note" style="font-size:19px;max-width:680px">Some things you learned the hard way. Spend <b>6 points</b> on the skills you know best—no more than 2 in any one.' +
      (draft.freePoint ? " Your old trade's free point is already in <b>" + esc(draft.freePoint) + "</b>." : "") + "</p>" +
      '<p class="note" style="max-width:680px">Your bonus is the stat plus your training, and it\'s added to every roll of that skill. With +3 or better, most everyday tasks are easy.</p>' +
      '<p class="note">' + (touch ? "Tap a skill for details." : "Hover over a skill for details.") + "</p>";
    return html + PC.checks.STATS.map(function (s) {
      return '<div class="h4" style="max-width:620px">' + esc(s) + " " + draft.stats[s] + " · " + esc(STAT_TEXT[s].toLowerCase()) + "</div>" +
        '<table class="alloc small-rows">' + fam[s].map(function (t) {
          var free = draft.freePoint === t ? ' <span title="Your old trade\'s free point" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#c99f45;border:1px solid #8a6414;vertical-align:middle"></span>' : "";
          return '<tr><th><span class="skilltip" tabindex="0" title="' + esc(PC.data.checkTypes[t].player) + '" style="border-bottom:1px dotted">' + esc(t) + "</span>" + free +
            '<span class="note tipline" hidden>' + esc(PC.data.checkTypes[t].player) + "</span></th><td>" +
            stepper("train", t, C.trainingTotal(draft, t), C.canLowerType(draft, t), C.canRaiseType(draft, t)) +
            '</td><td class="edge">' + signed(draft.stats[s] + C.trainingTotal(draft, t)) + "</td></tr>";
        }).join("") + "</table>";
    }).join("");
  }

  // The officer-lean line (§12.7): which officers warm to this pick.
  function leanLine(id) {
    var tag = (PC.data.officerLeaning || {})[id];
    return tag ? '<span class="small" style="color:#235066"><i>Officers who value ' + esc(tag) + " warm to this</i></span>" : "";
  }

  function stepCharacter() {
    var C = PC.creator, Dc = PC.data.creator;
    var html = head("Traits and flaw", "Pick two traits and one flaw. Traits give +1 to their skills; your flaw costs −1 and tempts you at the worst moments. Your officers will judge you by them.") +
      "<h3>Traits (" + draft.traits.length + " of " + Dc.START.traitCount + ")</h3>";
    Dc.TRAIT_GROUPS.forEach(function (g) {
      html += "<h4>" + esc(g.group) + '</h4><div class="cards small-cards">' + g.traits.map(function (t) {
        var full = draft.traits.length >= Dc.START.traitCount && draft.traits.indexOf(t.id) < 0;
        return card("toggle", "traits", t.id, t.id, t.text, { max: Dc.START.traitCount, blocked: C.blockedBy(draft, t.id), full: full, extra: leanLine(t.id) });
      }).join("") + "</div>";
    });
    html += "<h3>Flaw</h3>" + '<div class="cards small-cards">' + Dc.FLAWS.map(function (f) {
      return card("pick", "flaw", f.id, f.id, f.text, { blocked: C.blockedBy(draft, f.id), extra: leanLine(f.id) });
    }).join("") + "</div>";
    return html;
  }

  function stepTags() {
    var C = PC.creator, Dc = PC.data.creator;
    var n = C.tagsAllowed(draft), d = C.debuffsRequired(draft);
    var loss = C.lossById(draft.loss);
    var words = ["", "one", "two", "three"];
    var html = head("Tags", "What people say about you: what you're known for, and your quirks. Your years give you <b>" + words[n] + "</b>.") +
      '<p class="small">Already yours: <b>Ash-Born</b>' + (loss ? ", <b>" + esc(loss.tag) + "</b> (" + esc(loss.name.toLowerCase()) + ")" : "") + ". These don't count.</p>" +
      "<h3>Tags (" + draft.tags.length + " of " + n + ")</h3>";
    Dc.TAG_GROUPS.forEach(function (g) {
      html += "<h4>" + esc(g.group) + '</h4><div class="cards small-cards">' + g.tags.map(function (t) {
        var full = draft.tags.length >= n && draft.tags.indexOf(t.id) < 0;
        return card("toggle", "tags", t.id, t.id, t.text, { max: n, blocked: C.blockedBy(draft, t.id), full: full });
      }).join("") + "</div>";
    });
    if (d) {
      html += "<h3>Old ailments (" + draft.debuffs.length + " of " + d + ')</h3><p class="note">The years leave their mark. Pick <b>' + words[d] + "</b>. Some can be cured, for a price.</p>" +
        '<div class="cards small-cards">' + Dc.DEBUFFS.map(function (x) {
          var full = draft.debuffs.length >= d && draft.debuffs.indexOf(x.id) < 0;
          return card("toggle", "debuffs", x.id, x.id, x.text, { max: d, blocked: C.blockedBy(draft, x.id), full: full, extra: '<span class="small sc" style="color:' + (x.life === "Curable" ? "#2f5a22" : "#7a2416") + '">' + esc(x.life) + "</span>" });
        }).join("") + "</div>";
    }
    return html;
  }

  function stepMentor() {
    var C = PC.creator, Dc = PC.data.creator;
    var choices = C.mentorPortraitChoices(draft);
    if (!draft.mentor.portraitSet || !choices.some(function (c) { return c.set === draft.mentor.portraitSet; })) draft.mentor.portraitSet = choices[0].set;
    var html = head("Your mentor", "An old hand who sailed with you out of the ashes: your first officer, your first Quartermaster, and already a friend. Once a season, you can reroll a failed check in something your mentor taught you.") +
      '<div class="row2">' + textField("Mentor's first name", "mentor.first", { max: 24 }) + textField("Last name", "mentor.last", { max: 24 }) + "</div>" +
      '<p><button class="secondary" data-act="randmentor">Random name</button></p>' +
      cycler(choices, "mentor.portraitSet", "Mentor portrait") +
      "<h3>Type</h3>" + '<div class="cards">' + Dc.OFFICER_TYPES.map(function (t) {
        return card("pick", "mentor.type", t.id, t.id, t.perk + ". Teaches: " + t.lessons + ".");
      }).join("") + "</div>";
    function traitCards(field, blockFn) {
      return ["warm", "neutral", "cold"].map(function (w) {
        return "<h4>" + { warm: "Warm", neutral: "Steady", cold: "Dark" }[w] + '</h4><div class="cards small-cards">' +
          Dc.OFFICER_TRAITS.filter(function (t) { return t.warmth === w; }).map(function (t) {
            return card("pick", field, t.id, t.id, t.hook + ". Likes " + t.likes + ", dislikes " + t.dislikes + ".", { blocked: blockFn ? blockFn(t.id) : null });
          }).join("") + "</div>";
      }).join("");
    }
    html += '<h3>Voice trait</h3><p class="note">How your mentor talks and what they care about.</p>' + traitCards("mentor.voice") +
      "<h3>Secondary trait</h3>" + (draft.mentor.voice ? traitCards("mentor.secondary", function (id) { return C.secondaryBlocked(draft, id); }) : '<p class="note">Pick a voice trait first.</p>') +
      '<p class="note">Your mentor\'s drive and fear are rolled when the game begins, and stay hidden until you learn them.</p>';
    return html;
  }

  function stepShip() {
    return head("Your ship") + '<div class="ship-plate"><img class="ship-art" src="' + assetUrl(PC.data.shipArt("Sloop")) + '" alt="A sloop">' +
      '<p class="note" style="font-size:19px">She\'s battered and half-armed, but she\'s yours: 14 of 20 hull strength, 6 of 10 guns, a shallow draft for the shoals, and twelve green hands.</p></div>' +
      textField("Her name", "shipName", { max: 34 }) +
      '<p><button class="secondary" data-act="randship">Random name</button></p>' +
      '<p class="note">Leave off “the”; the game adds it (“the Drunken Saint”).</p>';
  }

  // Review (§12.11): both portraits, sections with Change links, the money.
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
    var b = C.band(draft.age);
    var cap = draft.portraitSet && b ? C.portraitPath(draft.portraitSet, b.band, false) : null;
    var men = m.portraitSet ? C.portraitPath(m.portraitSet, "old", false) : null;
    var html = head("Review");
    if (errs.length) {
      html += '<div class="todo"><p><b>Still to do:</b></p><ul>' + errs.map(function (e) {
        var i = C.STEPS.map(function (s) { return s.id; }).indexOf(e.step);
        return '<li><button class="link" data-act="gostep" data-i="' + i + '">' + esc(C.STEPS[i].title) + "</button>: " + esc(e.message) + "</li>";
      }).join("") + "</ul></div>";
    }
    html += '<div style="display:flex;gap:18px;margin:6px 0 10px">' + (cap ? '<figure style="margin:0;text-align:center"><img src="' + assetUrl(cap) + '" alt="" style="width:120px;height:180px;object-fit:cover;border:1px solid #6b5030"><figcaption class="note">You</figcaption></figure>' : "") +
      (men ? '<figure style="margin:0;text-align:center"><img src="' + assetUrl(men) + '" alt="" style="width:120px;height:180px;object-fit:cover;border:1px solid #6b5030"><figcaption class="note">Your mentor</figcaption></figure>' : "") + "</div>";
    html += sec("Your captain", "portrait", "<p>Age " + esc(draft.age) + "</p>") +
      sec("Name", "name", "<p>" + esc((String(draft.first) + " " + String(draft.last)).trim() || "?") + "</p>") +
      sec("Origin", "origin", "<p>Ash-Born of " + esc(draft.homeCity || "?") + (city ? ' <span class="note">(' + esc(city.effect) + ")</span>" : "") +
        "<br>Once " + esc(aOrAn((draft.profession || "?").toLowerCase())) + (draft.freePoint ? ", free point in " + esc(draft.freePoint) : "") +
        "<br>" + (loss ? esc(loss.name) + ": " + esc(loss.tag) + ' <span class="note">(' + esc(loss.penalty) + ")</span>" : "Nothing lost yet") + "</p>") +
      sec("Stats", "stats", "<p>" + PC.checks.STATS.map(function (s) { return esc(s) + " " + draft.stats[s]; }).join(" · ") + "</p>") +
      sec("Skills", "training", "<p>" + (training || "None") + "</p>") +
      sec("Traits and flaw", "character", "<p>" + esc(draft.traits.join(", ") || "None") + (draft.flaw ? "; flaw: " + esc(draft.flaw) : "") + "</p>") +
      sec("Tags", "tags", "<p>Ash-Born" + (loss ? ", " + esc(loss.tag) : "") + (draft.tags.length ? ", " + esc(draft.tags.join(", ")) : "") +
        (draft.debuffs.length ? '<br><span class="note">Old ailments:</span> ' + esc(draft.debuffs.join(", ")) : "") + "</p>") +
      sec("Your mentor", "mentor", "<p>" + esc((String(m.first) + " " + String(m.last)).trim() || "?") + (m.type ? ", " + esc(m.type) : "") +
        (m.voice ? "<br>" + esc(m.voice) + (m.secondary ? ", " + esc(m.secondary) : "") + ", Mentor" : "") + "</p>") +
      sec("Your ship", "ship", "<p><i>" + esc(PC.creator.shipName(draft.shipName) || "?") + "</i>, a battered sloop</p>") +
      '<p style="max-width:680px;margin-top:14px">You start with <b>' + gold(600 + (city && city.gold ? city.gold : 0)) + " gold in the ship's chest</b> (the crew's, until it's split) and <b>nothing in your own purse</b>, plus 10 lots of provisions, " + esc(PC.data.creator.START.startKit) + ". <b>No one knows your name yet.</b></p>" +
      '<div class="actions"><button class="primary big" data-act="begin"' + (errs.length ? " disabled" : "") + ">Set sail</button></div>";
    return html;
  }

  // A random-name draw that doesn't repeat until the pool is used up (§36.2).
  function remember(kind, name) {
    draft.shown = draft.shown || { captain: [], mentor: [], ship: [] };
    draft.shown[kind] = (draft.shown[kind] || []).concat([name]);
  }

  var creatorHandlers = {
    "gostep": function (el) { stepIndex = Number(el.dataset.i); },
    "next": function () { if (stepIndex < PC.creator.STEPS.length - 1) stepIndex += 1; },
    "back": function () { if (stepIndex > 0) stepIndex -= 1; },
    "age": function (el) {
      draft.age = Math.round(Number(el.value));
      PC.creator.fitToAge(draft);
    },
    "trade": function (el) {
      draft.profession = el.dataset.prof;
      draft.freePoint = el.dataset.skill;
      PC.creator.fitToProfession(draft);
    },
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
      var shown = draft && draft.shown;
      draft = PC.creator.randomDraft(key);
      draft.shown = shown || { captain: [], mentor: [], ship: [] };
      var n = PC.npcs.randomCaptainName(PC.creator.setById(draft.portraitSet).gender, key + "|name", draft.shown.captain);
      draft.first = n.first; draft.last = n.last;
      draft.shipName = PC.npcs.randomShipName(key + "|ship", null, draft.shown.ship) || PC.npcs.randomShipName(key + "|ship");
      stepIndex = PC.creator.STEPS.length - 1;
    },
    "resetdraft": function () { draft = PC.creator.blankDraft(); draft.shown = { captain: [], mentor: [], ship: [] }; stepIndex = 0; },
    // The random-name buttons (§36.2): no repeats until the pool is used up.
    "randname": function () {
      var g = draft.portraitSet ? PC.creator.setById(draft.portraitSet).gender : "m";
      var n = PC.npcs.randomCaptainName(g, "captain-name|" + PC.rng.newWorldSeed(), (draft.shown || {}).captain);
      draft.first = n.first; draft.last = n.last; remember("captain", n.first + " " + n.last);
    },
    "randmentor": function () {
      var set = draft.mentor.portraitSet ? PC.creator.setById(draft.mentor.portraitSet) : null;
      var key = "mentor-name|" + PC.rng.newWorldSeed();
      for (var i = 0; i < 10; i++) {
        var n = PC.npcs.randomCaptainName(set ? set.gender : "m", key + "|" + i, (draft.shown || {}).mentor);
        if (n.last !== draft.last) { draft.mentor.first = n.first; draft.mentor.last = n.last; remember("mentor", n.first + " " + n.last); break; }
      }
    },
    "randship": function () {
      var key = "ship-name|" + PC.rng.newWorldSeed();
      var n = PC.npcs.randomShipName(key, null, (draft.shown || {}).ship);
      if (!n) { draft.shown.ship = []; n = PC.npcs.randomShipName(key, null, []); }
      draft.shipName = n; remember("ship", n);
    },
    // Set sail: the closing prologue plays, then the beach (§40.4).
    "begin": function () {
      var seed = PC.rng.newWorldSeed();
      var template = PC.creator.build(draft, seed);
      var built = PC.state.newGame(template, { seed: seed });
      PC.state.addLog(built, "— Spring 1754 begins. —");
      PC.state.addLog(built, "The quest What Was Lost is open (until the end of Spring 1755).");
      var m = (built.officers || []).filter(function (o) { return o.mentor; })[0];
      creating = false;
      clearDraft();
      PC.state.saveToBrowser(built);
      prologue = { kind: "closing", game: built, home: built.captain.homeCity, tokens: {
        city: built.captain.homeCity, loss: PC.data.prologue.LOSS_WORDS[built.captain.loss] || "what was lost",
        mentor: m ? m.first : "your mentor", "mentor.he": m && m.gender === "f" ? "she" : "he", "mentor.He": m && m.gender === "f" ? "She" : "He",
        ship: built.ship.name } };
    },
  };

  function scrollTop() { try { globalThis.scrollTo(0, 0); } catch (e) { /* ignore */ } }

  // Text boxes update the draft as you type, without redrawing (so the
  // cursor stays put). Age redraws on change: it moves the portrait band.
  function wireNotes() {
    root.querySelectorAll("textarea[data-note]").forEach(function (el) {
      el.addEventListener("input", function () {
        state.notes = state.notes || {};
        state.notes[el.dataset.note] = el.value;
        PC.state.saveToBrowser(state);
      });
    });
  }

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
    "continue": function () { state = PC.state.loadFromBrowser(); menu = null; },
    "new": function () {
      if (PC.state.loadFromBrowser()) { dialog = "confirmnew"; return; }
      handlers.newconfirmed();
    },
    "newconfirmed": function () {
      dialog = null; menu = null;
      prologue = { kind: "opening" };
    },
    // Quick start lives in Developer and warns before it replaces a save (§41.2).
    "quickask": function () {
      if (PC.state.loadFromBrowser()) { dialog = "confirmquick"; return; }
      handlers.quickstart();
    },
    "quickstart": function () {
      dialog = null; menu = null;
      state = PC.state.newGame(PC.data.testCaptain);
      PC.state.addLog(state, "— Spring 1754 begins. —");
    },
    "quit": function () { state = null; creating = false; menu = null; },
    "export": function () { dialog = "export"; },
    "import": function () { dialog = "import"; },
    "closedialog": function () { dialog = null; },
    "download": downloadSave,
    "copy": copySave,
    "pickfile": pickSaveFile,
    "loadpasted": function () { var t = document.querySelector(".pastebox").value; if (t.trim()) loadSaveText(t); else toast("Paste a save first."); },
    "openmenu": function (el) { menu = el.dataset.menu; if (menu === "journal") { journalTab = journalTab || "quests"; state.journalDot = false; } },
    "closemenu": function () { menu = null; },
    "jtab": function (el) { journalTab = el.dataset.tab; },
    "allskills": function () { showAllSkills = !showAllSkills; },
    "setreduce": function () { settings.reduceMotion = !settings.reduceMotion; saveSettings(); },
    "setdev": function () { settings.dev = !settings.dev; saveSettings(); },
    "choose": function (el) {
      PC.scenes.choose(state, Number(el.dataset.i));
      var r = PC.scenes.viewScene(state).result;
      // A beat's "carry on" with nothing to show goes straight through.
      if (r && r.outcome === "result" && !r.text && !r.chips.length) { PC.scenes.commit(state); return; }
      // A check result that leads to a choice shows the choices on the same
      // screen (the M3 review: Davey's tab, Twopenny's pay-or-shove).
      if (r && r.outcome !== "result" && !r.reroll && !r.needsPot) {
        var ex = PC.scenes.peekExit(state);
        if (ex && ex.to && ex.to !== "hub") {
          var lead = { label: r.choiceLabel, outcome: r.outcome, roll: r.roll, strikeFirst: r.strikeFirst, text: ex.carry || ex.same ? null : r.text, chips: r.chips, approval: r.approval };
          PC.scenes.commit(state);
          if (state.current.screen === "scene") state.current.lead = lead;
        }
      }
    },
    "reroll": function () { PC.scenes.reroll(state); },
    "commit": function (el) { PC.scenes.commit(state, el.dataset.pot || null); },
    "enter": function (el) {
      var id = el.dataset.scene;
      if (PC.scenes.canEnter(state, id).ok) PC.scenes.enterScene(state, id);
    },
    "endseason": function () { PC.scenes.endSeason(state); },
    "toggledice": function () { state.settings.showDice = !state.settings.showDice; },
    "togglegender": function () { state.captain.gender = state.captain.gender === "f" ? "m" : "f"; },
    "addap": function () { state.ap.left = Math.min(state.ap.max, state.ap.left + 1); },
    "tohub": function () {
      if (state.location) { state.current = { screen: "node" }; state.location.place = null; }
      else state.current = { screen: "hub", hubId: PC.data.testStart.hub };
      menu = null;
    },
    "fillap": function () { state.ap.left = state.ap.max; },
    "devgold": function () { state.money.crew += 500; },
    "devpurse": function () { state.money.purse += 500; },
    "devtreasure": function (el) { state.cargo.treasure[el.dataset.dirty === "1" ? "dirty" : "clean"] += 10; },
    "devdamage": function () { state.ship.hull = Math.max(1, state.ship.hull - 5); },
    "devskip": function () { var r = PC.devtools.skipQuests(state); menu = null; toast(r); },
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
    // The hunt's Developer tools (Milestone 5 plan, §2C).
    "devforce": function (el) {
      var f = { kind: el.dataset.kind, flag: el.dataset.flag || null, cls: el.dataset.cls || null };
      if (state.minigame && state.minigame.kind === "hunt") { state.minigame.force = f; toast("The next batch starts with that ship."); }
      else { devForce = f; toast("Your next hunt starts with that ship."); }
      menu = null;
    },
    "devfleet": function (el) { var r = PC.hunt.devFleetShip(state, el.dataset.cls); toast("A " + r.ship + " joins your fleet under " + r.officer + "."); },
    "devheat": function (el) { state.meters.heat[el.dataset.f] = Number(el.dataset.v); },
    "devfullcrew": function () { var add = state.ship.crewMax - state.crew.count - (state.crew.wounded || 0); if (add > 0) PC.crew.addHands(state, "Able", add); state.ship.hull = state.ship.hullMax; state.ship.guns = state.ship.gunsMax; },
    "devjump": function () {
      var id = document.querySelector(".devscene").value;
      if (state.location) state.location.place = /_(uw|oap)/.test(id) ? "tavern" : /_rr_/.test(id) ? "docks" : null;
      PC.scenes.enterScene(state, id);
      menu = null;
    },
    "devnewseason": function () { PC.scenes.endSeason(state); menu = null; },
    "devarrive": function () {
      var n = Math.min(4, state.crew.tiers.Green || 0);
      if (n) { PC.crew.removeHands(state, "Green", n); state.crew.wounded += n; }
      PC.node.arrive(state, PC.node.here(state), { fromHunt: true });
      menu = null;
    },
  };

  // Creator and node actions live in their sections above.
  Object.keys(creatorHandlers).forEach(function (k) { handlers[k] = creatorHandlers[k]; });
  Object.keys(nodeHandlers).forEach(function (k) { handlers[k] = nodeHandlers[k]; });

  var dialog = null;

  // The pips dim to preview an option's cost on hover or focus (§41.1).
  function previewAP(n) {
    var pips = root.querySelectorAll(".topbar .pip.on");
    pips.forEach(function (p, i) { p.classList.toggle("preview", n > 0 && i >= pips.length - n); p.classList.toggle("on", !(n > 0 && i >= pips.length - n)); });
  }
  function clearPreview() { root.querySelectorAll(".topbar .pip.preview").forEach(function (p) { p.classList.remove("preview"); p.classList.add("on"); }); }

  // Press feedback: a button darkens the moment a finger or mouse goes down,
  // before the click redraws the screen (the author's phone notes).
  var pressWired = false;
  function wirePress() {
    if (pressWired || typeof document === "undefined") return;
    pressWired = true;
    var on = function (ev) { var b = ev.target.closest && ev.target.closest("button, .hot"); if (b) b.classList.add("pressing"); };
    var off = function () { document.querySelectorAll(".pressing").forEach(function (b) { b.classList.remove("pressing"); }); };
    document.addEventListener("pointerdown", on, { passive: true });
    document.addEventListener("pointerup", function () { setTimeout(off, 120); }, { passive: true });
    document.addEventListener("pointercancel", off, { passive: true });
  }

  function wire() {
    wirePress();
    wireFields();
    if (state) wireNotes();
    root.querySelectorAll("[data-act]").forEach(function (el) {
      var name = el.dataset.act;
      // Odds open and close in place, with no redraw (§38.6).
      if (name === "toggleodds") {
        el.addEventListener("click", function () {
          var box = el.closest(".choice").querySelector(".odds");
          if (box) box.hidden = !box.hidden;
          el.querySelector(".caret").style.transform = box && !box.hidden ? "rotate(180deg)" : "";
        });
        return;
      }
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
    // Steppers (§41.1): move the number and the running totals, no redraw.
    root.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = document.getElementById(b.dataset.step);
        var n = b.dataset.d === "max" ? Number(box.max) : (Math.floor(Number(box.value)) || 0) + Number(b.dataset.d);
        box.value = Math.max(Number(box.min), Math.min(Number(box.max), n));
        refreshTotals();
      });
    });
    root.querySelectorAll(".stepper input").forEach(function (box) {
      box.addEventListener("input", refreshTotals);
      box.addEventListener("change", function () {
        var n = Math.floor(Number(box.value)) || 0;
        box.value = Math.max(Number(box.min), Math.min(Number(box.max), n));
        refreshTotals();
      });
    });
    // Liar's Dice faces (§41.6).
    root.querySelectorAll("[data-face]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.getElementById("bid-f").value = b.dataset.face;
        root.querySelectorAll("[data-face]").forEach(function (x) { x.classList.toggle("on", x === b); });
      });
    });
    // Action costs preview on the pips (§41.1).
    if (state) {
      root.querySelectorAll("[data-cost-ap]").forEach(function (el) {
        var n = Number(el.dataset.costAp);
        el.addEventListener("mouseenter", function () { previewAP(n); });
        el.addEventListener("focus", function () { previewAP(n); });
        el.addEventListener("mouseleave", clearPreview);
        el.addEventListener("blur", clearPreview);
      });
      // The dive's breath gauge previews a grab or a scout (§41.10).
      root.querySelectorAll("[data-cost-breath]").forEach(function (el) {
        var on = function () {
          var pips = root.querySelectorAll(".breath i.on");
          if (pips.length) pips[pips.length - 1].classList.add("prev");
        };
        var off = function () { root.querySelectorAll(".breath i.prev").forEach(function (p) { p.classList.remove("prev"); }); };
        el.addEventListener("mouseenter", on); el.addEventListener("focus", on);
        el.addEventListener("mouseleave", off); el.addEventListener("blur", off);
      });
    }
    // A skill's Player line: hover on desktop, tap on a phone (§12.6).
    root.querySelectorAll(".skilltip").forEach(function (t) {
      t.addEventListener("click", function () { var l = t.parentNode.querySelector(".tipline"); if (l) l.hidden = !l.hidden; });
    });
    // The italic line under a choice picks it too (the author's phone notes).
    root.querySelectorAll(".choice .meta:not(.lock)").forEach(function (m) {
      var pick = m.parentNode.querySelector(".pick");
      if (!pick || pick.disabled) return;
      m.classList.add("tappable");
      m.addEventListener("click", function () { pick.click(); });
    });
    // Clicks inside a menu panel don't close it.
    root.querySelectorAll("[data-stop]").forEach(function (p) { p.addEventListener("click", function (ev) { ev.stopPropagation(); }); });
    refreshTotals();
  }

  function start(rootEl) {
    root = rootEl;
    draw();
  }

  PC.ui = { start: start };
})();
