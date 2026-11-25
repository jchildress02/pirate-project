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
  var BUILD = "Build 0.9 · Milestone 8";

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
    person: '<circle cx="10" cy="6" r="3.2"/><path d="M3.5 17.5q0-6.5 6.5-6.5t6.5 6.5"/>',
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
  function chips(list) { list = (list || []).filter(Boolean); return list.length ? '<ul class="effects">' + list.map(chip).join("") + "</ul>" : ""; }
  // Dirty goods, hulls and prizes (B44 of the M5 playtest): the name in
  // oxblood with a small black spot after it, never color alone; hover or
  // tap says what it means. Clean ones are unmarked.
  var DIRTY_TIP = "Dirty: only a fence will buy it.";
  function dirtyName(name, dirty, raw) {
    var n = raw ? name : esc(name);
    return dirty ? '<span class="dirty" title="' + DIRTY_TIP + '" tabindex="0">' + n + '<span class="spot" aria-label="dirty"> ●</span></span>' : n;
  }
  // Effect chips for the node's services (G4): gold, morale, hull.
  function goldChip(n, pot) { return n ? { icon: "gold", text: (n > 0 ? "+" : "−") + gold(Math.abs(n)) + " " + (pot === "purse" ? "your purse" : "crew gold"), ink: n > 0 ? "good" : "mid" } : null; }
  function moraleChip(n) { return n ? { icon: "morale", text: "Crew morale " + (n > 0 ? "+" : "−") + Math.abs(n), ink: n > 0 ? "good" : "bad" } : null; }
  function textChip(icon, text, ink) { return text ? { icon: icon, text: text, ink: ink || null } : null; }

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
  // The color-coded result box every roll gets (G4 of the M5 playtest):
  // the edge of the box carries the outcome's ink, the badge its word and
  // shape. key marks it as a result the screen scrolls to (G1).
  function rbox(outcome, inner, key, extraCls) {
    var o = OUTCOME[outcome];
    return '<div class="rbox ' + (o ? o[1].replace("t-", "o-") : "o-none") + (extraCls ? " " + extraCls : "") + '"' + (key ? ' data-result="' + esc(key) + '"' : "") + ">" + inner + "</div>";
  }
  // A roll's type and outcome in one line: "Size Him Up · Partial success".
  function rollBadge(outcome, type) {
    var o = OUTCOME[outcome];
    return o ? '<div class="badge ' + o[1] + '">' + shape(o[1]) + (type ? esc(type) + " · " : "") + o[0] + "</div>" : "";
  }

  // ---- Bands (§28.1, §28.4) ----------------------------------------------

  function standingBand(v) {
    return v >= 70 ? "Honored" : v >= 40 ? "Trusted" : v >= 20 ? "Favored" : v >= -9 ? "Neutral" : v >= -39 ? "Wary" : v >= -69 ? "Hostile" : "Enemy";
  }
  function heatBand(v) { return PC.meters.heatBand(v); }

  // The Standing bar (#33 of the build 0.9 pins): thicker, green to the
  // right of a center zero and red to the left, labeled ticks at 25, 50 and
  // 75 each way, and the number beside the band.
  // Who's allied with whom (#36 of the build 0.9 pins), from the hunt's
  // sides table: whose ships cost you Standing and Heat with whom.
  function alliesBlock() {
    var S = PC.data.hunt.SIDES, row = function (fac, name) {
      var allies = Object.keys(S[fac]).filter(function (k) { return S[fac][k] === "ally"; });
      return "<li><b>" + name + "</b>" + (allies.length ? " and its allies " + allies.join(" and ") : "") + ": taking their ships costs " + name + " Standing and Heat.</li>";
    };
    return '<div class="h4">Who\'s allied with whom</div><ul class="small" style="padding-left:1.1em;margin:4px 0 10px">' + row("Avalon", "Avalon") + row("Frisia", "Frisia") +
      "<li><b>France and Spain</b> keep a grudge; <b>Sicily</b> sends hunters. Pirates are fair game for anyone.</li></ul>";
  }

  function standingBar(f, v) {
    v = Math.max(-100, Math.min(100, Math.round(v || 0)));
    var left = v >= 0 ? 50 : 50 + v / 2, width = Math.abs(v) / 2;
    var ticks = [-75, -50, -25, 25, 50, 75].map(function (t) {
      return '<b class="stick" style="left:' + (50 + t / 2) + '%"></b><span class="stlab" style="left:' + (50 + t / 2) + '%">' + (t > 0 ? "+" : "−") + Math.abs(t) + "</span>";
    }).join("");
    return '<div class="meterrow"><span>' + FACTION[f] + '</span><span class="sc">' + standingBand(v) + ' <span class="stnum">' + (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "</span></span></div>" +
      '<div class="stbar" title="' + esc(FACTION[f] + " Standing " + v) + '"><i class="stfill ' + (v >= 0 ? "pos" : "neg") + '" style="left:' + left + "%;width:" + width + '%"></i><b class="stzero"></b>' + ticks + "</div>";
  }
  function vbar(label, v, ink, band) {
    return '<div class="vbar"><div class="tube"><i style="height:' + Math.max(0, Math.min(100, v)) + "%;background:" + INK[ink] + '"></i></div><span>' + esc(label) + '</span><span class="sc">' + esc(band) + "</span></div>";
  }
  function meters(withNumbers) {
    var m = state.meters, n = function (x) { return withNumbers ? " · " + x : ""; };
    return '<div class="h4">Standing</div>' + ["frisia", "avalon", "pirates"].map(function (f) {
      var bar = standingBar(f, m.standing[f]);
      return bar; // the number always shows now (#33)
    }).join("") +
      '<div class="h4">Dread &amp; Heat</div><div class="vbars">' +
      // Dread's bonus and floor beside its number (§11.8.5, §5.6).
      vbar("Dread", m.dread, "pirates", (PC.meters.dreadBonus(state) ? "+" + PC.meters.dreadBonus(state) : "") + (withNumbers ? (PC.meters.dreadBonus(state) ? " · " : "") + m.dread + (PC.meters.dreadFloor(state) ? " (floor " + PC.meters.dreadFloor(state) + ")" : "") : "")) +
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

  // Where the screen lands after an action: ONE rule, built once and used
  // by every screen (Playtest Pins (Build 0.9), PR B; clarified after the
  // scrolling playtest, November 24).
  //  1. The story keeps its place. Inside a place and its scenes (a choice,
  //     a result, Continue, one scene leading into the next, a scene opened
  //     from a place's menu, back to the place's menu), the screen puts the
  //     FIRST NEW LINE OF TEXT just under the sticky bar. The heading, the
  //     "where" line and the woodcut never count as new. If nothing new
  //     appears, the screen stays exactly where it is.
  //  2. Only a real change of scene setting jumps: walking into a place from
  //     the town menu, arriving at a port, starting a hunt or a minigame, a
  //     creator step. Those go to the top, or to the screen's landing spot
  //     (data-land): the hunt's "Hunting…" line on a new sighting, the two
  //     ships' header when a battle opens and on each new round, the
  //     after-battle report. The last spot on the screen wins.
  //  3. Back to the town menu returns to where the town menu was left.
  //  4. Menus: opening or closing one leaves the page where it was; inside a
  //     menu, a new line scrolls into view within the menu.
  // Four exceptions (playthrough 3 of the build 0.9 pins, ruled November 25):
  //  5. The creator never jumps inside a step: picks, the age slider and the
  //     mentor screen leave the page where it is, even when new text
  //     appears. Only a new step goes to the top.
  //  6. Minigames (the dive, Liar's Dice, the drinking match) land on the
  //     game's header ("Ocracoke · The Tavern · Liar's Dice"), never on the
  //     new text, so the wrecks or the table stay in view.
  //  7. In a place with several boxes (the Merchant's provisioner and
  //     fence, the Docks' shipwright and hiring), the landing goes to the
  //     top of the box that changed, with its name header showing.
  //  8. Battle stays anchored on the side-by-side ships.
  var townScroll = 0;

  // What counts as a change of setting (rule 2). Scenes, voyage events and a
  // place's own menu are all "the story" at that port, so moving between
  // them is not a jump.
  function landKey() {
    if (prologue) return "prologue";
    if (!state) return creating ? "creator|" + stepIndex : "title";
    var c = state.current || {}, l = state.location || {}, g = state.minigame, sub = "";
    if (g && g.kind === "hunt") {
      var a = g.after;
      sub = [g.phase === "battle" || g.phase === "after" ? g.phase : "look", g.batch ? g.batch.n + "." + g.batch.next : "", g.battle ? g.battle.round : "",
        a ? (a.repairDone ? 1 : 0) + ":" + (a.current ? a.current.id || "prize" : "") + ":" + (a.queue ? a.queue.length : "") : ""].join(",");
    }
    var story = c.screen === "scene" || c.screen === "event" || (c.screen === "node" && l.place);
    var where = story ? "story" : c.screen === "node" ? "town" : c.screen;
    return [where, l.node || "", g ? g.kind : "", sub].join("|");
  }

  // The lines on the screen, for spotting the first new one. Leaf blocks
  // only, so a long passage that gained a line doesn't count as all new.
  var LINE_SEL = "p, li, .say, h2, h3, h4, h5, .chips, .chip, table, .scout, .hotmenu, blockquote, .note, .where";
  function lineEls(scope) {
    if (!scope) return [];
    // Buttons and choices aren't "lines": the choice you just picked comes
    // back as a line of text, and that line is new.
    // The heading, the "where" line and the woodcut are the frame, not news.
    return Array.prototype.filter.call(scope.querySelectorAll(LINE_SEL), function (el) {
      return !el.querySelector(LINE_SEL) && !el.closest("button, .choice, .choices, .opts, .actions, [data-anchor], .banner, .plate") && !el.matches(".where, h2.title");
    });
  }
  function lineText(el) { return (el.textContent || "").replace(/\s+/g, " ").trim(); }
  function snapLines(scope) {
    var m = {};
    lineEls(scope).forEach(function (el) { var t = lineText(el); if (t) m[t] = (m[t] || 0) + 1; });
    return m;
  }
  function firstNewLine(scope, before) {
    var seen = {}, els = lineEls(scope);
    for (var i = 0; i < els.length; i++) {
      var t = lineText(els[i]);
      if (!t) continue;
      seen[t] = (seen[t] || 0) + 1;
      if (seen[t] > (before[t] || 0)) return els[i];
    }
    return null;
  }

  function stickyOffset() {
    var tb = root && root.querySelector(".topbar");
    if (!tb || typeof getComputedStyle === "undefined" || getComputedStyle(tb).position !== "sticky") return 8;
    return tb.getBoundingClientRect().height + 8;
  }
  function scrollToY(y) { try { globalThis.scrollTo(0, Math.max(0, Math.round(y))); } catch (e) { /* ignore */ } }
  // Put an element just under the sticky bar (inside a menu: at the menu's top).
  function scrollToAnchor(a) {
    var modal = a.closest(".modal");
    if (modal) { modal.scrollTop += a.getBoundingClientRect().top - modal.getBoundingClientRect().top - 16; return; }
    var y = a.getBoundingClientRect().top + (globalThis.scrollY || 0) - stickyOffset();
    // The line just above never peeks out under the bar (its y's and g's):
    // land at least far enough down to hide it completely.
    var bar = stickyOffset() - 8, prev = lineAbove(a);
    if (prev) y = Math.max(y, prev.getBoundingClientRect().bottom + (globalThis.scrollY || 0) - bar + 12); // +12: a woodcut's frame shadow reaches past its box
    y = Math.min(y, a.getBoundingClientRect().top + (globalThis.scrollY || 0) - bar); // never past the new line itself
    // A short page can't scroll far enough to bring the new line up: add
    // room at the bottom of the page so it can (gone at the next redraw).
    var doc = document.documentElement, short = y - (doc.scrollHeight - (globalThis.innerHeight || 0));
    var stage = root.querySelector(".stage");
    if (short > 0 && stage) { var pad = document.createElement("div"); pad.className = "landpad"; pad.style.height = Math.ceil(short) + "px"; stage.appendChild(pad); }
    scrollToY(y);
  }
  function scrollTop() { scrollToY(0); }
  // The nearest line of text (or the woodcut) that ends above an element.
  function lineAbove(a) {
    var stage = root.querySelector(".stage"), top = a.getBoundingClientRect().top, best = null, bb = -Infinity;
    if (!stage) return null;
    stage.querySelectorAll(LINE_SEL + ", .ribbon, [data-anchor], .banner, .plate, .choice").forEach(function (x) {
      if (x === a || x.contains(a) || a.contains(x)) return;
      var r = x.getBoundingClientRect();
      if (r.height && r.bottom <= top + 1 && r.bottom > bb) { bb = r.bottom; best = x; }
    });
    return best;
  }

  function land(snap, el) {
    var modal = root.querySelector(".modal:not(.popup)");
    // 3. Menus.
    if (menu && menu !== snap.menu) return;                       // a menu opened over the page
    if (!menu && snap.menu) return;                               // a menu closed
    if (modal && menu) {
      modal.scrollTop = snap.panelTop;
      var mNew = firstNewLine(modal, snap.modalLines);
      if (mNew) scrollToAnchor(mNew);
      return;
    }
    var same = landKey() === snap.land;
    // 5. The creator, inside a step: stay exactly where it was.
    if (same && !state && creating) return scrollToY(snap.y);
    // 6. Minigames: the game's header.
    if (same && state && state.current && state.current.screen === "minigame") {
      var mg = root.querySelector(".stage .mg-dive, .stage .mg-dice, .stage .mg-drink");
      var head = mg && mg.querySelector(".where");
      if (head) return scrollToAnchor(head);
      // 8. Battle: the two sides' ships.
      var ships = state.minigame && state.minigame.phase === "battle" && root.querySelector('.stage [data-land="battle"]');
      if (ships) return scrollToAnchor(ships);
    }
    // 2 and 3. A change of setting.
    if (!same) {
      var placeNow = state && state.current && state.current.screen === "node" && state.location ? state.location.place : undefined;
      if (state && state.current && state.current.screen === "node" && !placeNow && snap.place !== undefined) return scrollToY(townScroll);
      var spots = root.querySelectorAll(".stage [data-land]");
      return spots.length ? scrollToAnchor(spots[spots.length - 1]) : scrollTop();
    }
    // 1. The story: the first new line of text, or stay put.
    var fresh = firstNewLine(root.querySelector(".stage"), snap.lines);
    if (!fresh) return;
    // 7. A place with several boxes: the top of the box that changed (the
    // one the click came from), its name header showing.
    if (snap.box && state && state.current && state.current.screen === "node") {
      var box = findBox(snap.box);
      if (box) return scrollToAnchor(box);
    }
    scrollToAnchor(withHeader(fresh));
  }

  // The box a click came from (rule 7): its name header and place among the
  // place's boxes, so it can be found again after the redraw.
  function boxOf(el) {
    var stage = root.querySelector(".stage");
    var box = el && el.closest && el.closest(".svc");
    if (!stage || !box || !stage.contains(box)) return null;
    var all = Array.prototype.slice.call(stage.querySelectorAll(".svc"));
    if (all.length < 2) return null;
    var h = box.querySelector("h4");
    return { head: h ? lineText(h) : null, i: all.indexOf(box) };
  }
  function findBox(b) {
    var all = Array.prototype.slice.call(root.querySelectorAll(".stage .svc"));
    if (b.head) { var m = all.filter(function (x) { var h = x.querySelector("h4"); return h && lineText(h) === b.head; })[0]; if (m) return m; }
    return all[b.i] || null;
  }

  // When the new text opens a scene step, its header comes with it: the
  // quest ribbon and the scene's title ("Restless & Ruined · The Docks")
  // sit just above it (the author's scrolling playtest, November 24).
  function withHeader(el) {
    var main = el.closest(".scene-main");
    if (!main) return el;
    var title = main.querySelector("h2.title");
    if (!title || !(title.compareDocumentPosition(el) & 4)) return el; // the title comes before it
    // Only the header and the woodcut stand between the title and the new text.
    var before = lineEls(main).filter(function (x) { return x !== el && (x.compareDocumentPosition(el) & 4) && (title.compareDocumentPosition(x) & 4); });
    if (before.length) return el;
    return main.querySelector(".ribbon") || title;
  }

  function act(fn) {
    return function (el) {
      var before = screenKey();
      var modal = root.querySelector(".modal:not(.popup)");
      var onNode = state && state.current && state.current.screen === "node" && state.location;
      var snap = { land: landKey(), menu: menu, panelTop: modal ? modal.scrollTop : 0, place: onNode ? state.location.place : undefined,
        lines: snapLines(root.querySelector(".stage")), modalLines: modal ? snapLines(modal) : {}, y: globalThis.scrollY || 0, box: onNode && state.location.place ? boxOf(el) : null };
      if (onNode && !state.location.place && !menu) townScroll = globalThis.scrollY || 0;
      // The run log (Playtest Pins 0.9, PR A): the choice, then what changed.
      var RL = PC.runlog;
      if (RL && el && el.dataset) RL.choice(el.dataset.act || "?", el.dataset, before, (el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 90));
      try { fn.apply(null, arguments); }
      catch (e) { console.error(e); toast("Something went wrong: " + e.message); }
      if (state) PC.state.saveToBrowser(state);
      else if (creating) saveDraft();
      stampFlash = !!state;
      draw();
      stampFlash = false;
      if (RL) { var nowKey = screenKey(); if (nowKey !== before) RL.screen(nowKey); RL.after(state); RL.save(); }
      land(snap, el);
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
    liveTotals = []; liveMax = {};
    expiryWarning();
    moraleBandNotice();
    var screen = state.current.screen;
    if (screen !== jailScreen) { if (jailScreen === "jail" || jailScreen === "shipless") jailSay = null; jailScreen = screen; }
    if (screen === "end") return drawEnd();
    var content = screen === "hub" ? hubPanel() : screen === "node" ? noActionsBanner() + nodePanel() : screen === "minigame" ? minigamePanel() :
      screen === "map" ? mapPanel() : screen === "split" ? splitPanel() : screen === "jail" ? jailPanel() : screen === "shipless" ? shiplessPanel() : screen === "mutiny" && PC.mutiny ? mutinyPanel() : screen === "event" && PC.voyageEvents ? eventPanel() : scenePanel();
    root.innerHTML = frame(topBar() + phoneStrip() +
      '<div class="cols"><aside class="strip">' + strip() + '</aside><main class="stage">' + content + "</main></div>" + tabBar()) +
      popupHtml() + menuHtml();
    wire();
  }

  // ---- Imprisonment (§43; Milestone 8, PR 6) ----
  var jailSay = null; // the last step's lines and chips, shown above the choices
  var jailSeq = 0;
  var jailScreen = null;

  // ---- The mutiny (§24.13, §25.14; M9 PR 2) ----
  // The crew's demand, the five approaches, then (on a setback) the plea,
  // the crew's verdict and the last stand. Lines are PLACEHOLDERs (PH33).
  function mutinyResult(r) {
    if (!r) return "";
    var inner = badge(r.outcome) + '<div class="say">' + r.lines.map(function (l) { return inline(l); }).join("<br>") + "</div>" + chips(r.chips);
    return rbox(r.outcome, inner, "mutiny-" + r.approach + "-" + r.outcome);
  }
  function mutinyPanel() {
    var v = PC.mutiny.view(state);
    if (!v) return "";
    var html = '<div class="where">' + esc(PC.state.seasonName(state) + " " + state.time.year + " · " + state.ship.name) + '</div>' + banner("the crew massed at the mainmast, the officers apart") +
      '<h2 class="title">Mutiny</h2><div class="prose">' + prose(v.log.join("\n\n")) + "</div>";
    var side = '<p class="small">' + (v.loyal.length ? "With you: " + esc(v.loyal.join(", ")) + " (+" + Math.min(2, v.loyal.length) + " on your roll). " : "No officer stands with you. ") +
      (v.ringleader ? (v.ringleader.known ? "Leading them: <b>" + esc(v.ringleader.name) + "</b>." : "One of your officers is behind this, but you don't know which.") : "") + "</p>";
    if (v.stage === "approach") {
      return html + side + opts(v.approaches.map(function (a) {
        return opt({ act: "mutapproach", attrs: 'data-id="' + a.id + '"', label: a.label, check: a.lock ? null : PC.checks.assess(state, a.check, { conditions: [] }), meta: a.note, lock: a.lock });
      }));
    }
    html += mutinyResult(v.result);
    if (v.stage === "ringleaderFate") {
      return html + "<p>" + esc(v.ringleader ? v.ringleader.name : "He") + " is at your mercy.</p>" + opts([
        opt({ act: "mutfate", attrs: 'data-how="kill"', label: "Kill him", meta: "Dread +" + PC.data.mutiny.RINGLEADER_KILL_DREAD + "." }),
        opt({ act: "mutfate", attrs: 'data-how="ashore"', label: "Put him ashore at the next port", meta: "He leaves with nothing. Dread +" + PC.data.mutiny.RINGLEADER_ASHORE_DREAD + "." }),
        opt({ act: "mutfate", attrs: 'data-how="plank"', label: "Make him walk the plank", meta: "Dread +" + PC.data.mutiny.PLANK_DREAD + "." })]);
    }
    if (v.stage === "quelled") {
      var go = v.when === "departure" ? "Carry on" : "Back to work";
      return html + '<div class="actions"><button class="primary" data-act="mutcarry" data-top="1">' + go + "</button></div>";
    }
    if (v.stage === "plea" || v.stage === "lastStand" || v.stage === "over") html += mutinyResult(v.plea);
    if (v.stage === "plea") {
      return html + opts([opt({ act: "mutplea", label: "Plead your case", check: PC.checks.assess(state, v.pleaCheck, { conditions: [] }),
        meta: state.crew.morale < 15 ? "Clean: put ashore. Partial: marooned. Setback: they come for you." : "Clean or partial: put ashore. Setback: marooned." })]);
    }
    if (v.stage === "lastStand" || v.stage === "over") html += mutinyResult(v.stand);
    if (v.stage === "lastStand") {
      return html + opts([opt({ act: "mutstand", label: "Fight for your life", check: PC.checks.assess(state, v.standCheck, { conditions: [] }),
        meta: "Clean: you cut your way to a boat, Wounded. Partial: marooned, Wounded. Setback: killed, unless a friend gives his life for yours." })]);
    }
    return html + '<div class="actions"><button class="primary" data-act="mutafter" data-top="1">' + (v.ending === "marooned" ? "Alone on the sand" : "Continue") + "</button></div>";
  }

  function jailPanel() {
    var v = PC.prison.view(state);
    if (!v) return "";
    var J = PC.data.prison, html;
    if (v.kind === "marooned") {
      html = '<div class="where">' + esc(PC.state.seasonName(state) + " " + state.time.year) + '</div><h2 class="title">Marooned</h2>' +
        '<div class="prose dropcap">' + prose(v.log.join("\n\n")) + "</div>" + jailResult();
      if (v.stage === "drift") html += opts([opt({ act: "jdrift", label: "Wait for a sail", meta: J.MAROON_AP + " actions pass." })]);
      else html += opts([opt({ act: "jrescue", label: "Hail her and ask to be taken aboard", check: PC.checks.assess(state, v.rescueCheck, { conditions: [] }),
        meta: "Clean: taken aboard and landed at Norfolk. Partial: they want paying first. Setback: they sail on, and you wait again." })]);
      return html;
    }
    html = '<div class="where">' + esc(v.name + " · " + PC.state.seasonName(state) + " " + state.time.year) + "</div>" + banner("a cell: straw, a barred window, a heavy door") +
      '<h2 class="title">' + esc(v.name) + "</h2>" +
      (v.standIn ? '<p class="note">St. Augustine isn\'t built yet: this cell stands in for its castle dungeon, and you\'ll be let go at Ocracoke.</p>' : "") +
      '<table class="ledger" style="max-width:520px">' + lrow("The charge", esc(v.charge || "")) + lrow("Cell actions left this season", String(v.ap)) +
      lrow("Your ship", { port: "waiting in port with your Quartermaster", lost: "lost", impounded: "impounded", sailed: "gone: your crew sailed without you" }[v.ship] || "") + "</table>" +
      (jailSay ? jailResult() : '<div class="prose">' + prose(v.log.slice(-3).join("\n\n")) + "</div>");
    var turn = opt({ act: "jseason", label: "Let the season turn", meta: "The world goes on without you." });
    if (v.stage === "interrogate") {
      html += '<div class="prose">' + prose(J.lines.interrogation) + "</div>";
      if (!v.secrets.length) return html + opts([opt({ act: "jresist", label: "Tell them nothing", meta: "You have no secrets worth their trouble." })]);
      var offer = J.lines.talkOffer[v.offer];
      return html + '<p class="small">Your secrets: ' + v.secrets.map(function (x) { return esc(x.name) + " (" + x.size + ")"; }).join(", ") + " · " + plural(v.points, "point") + ".</p>" + opts([
        opt({ act: "jresist", label: "Resist", check: PC.checks.assess(state, v.resist, { conditions: [] }),
          meta: "Clean: nothing given up. Partial: you give up one small secret of your choosing. Setback: they take one at random." }),
        opt({ act: "jtalk", label: "Talk freely", meta: inline(offer) + " Exposes every secret, with every cost, and earns the Snitch tag.", lock: v.offer === "laugh" ? "What you know isn't worth a lighter sentence" : null }),
      ]);
    }
    if (v.stage === "givePick") return html + '<p>Give them one:</p>' + opts(v.pick.map(function (x) { return opt({ act: "jgive", attrs: 'data-id="' + esc(x.id) + '"', label: x.name, meta: "If exposed: " + esc(x.penalty) }); }));
    var ev = PC.escape ? PC.escape.view(state) : null;
    // An escape under way (§43.9) takes over the screen.
    if (ev && ev.breakout) return html + breakoutBlock(ev);
    var beats = ev ? officerBeats(ev) : "";
    if (beats) return html + beats;
    var escapeHtml = ev && ev.inCell ? escapeBlock(ev) : "";
    if (v.stage === "held" || v.stage === "awaitTrial") {
      var what = v.stage === "held" ? plural(v.left, "more action") + " here, then a fine of " + J.FINE_FEES + "× the port fee and you're out." : plural(v.left, "more action") + " until your trial.";
      // 3-29: Held's line counts down every cell action; at 0, pay the fine and go.
      if (v.stage === "held" && v.left <= 0) return html + opts([opt({ act: "jwait", label: "Pay the fine and go", meta: J.FINE_FEES + "× the port fee." })]);
      return html + '<p class="small">' + esc(what) + "</p>" + opts([v.ap > 0 ? opt({ act: "jwait", label: "Wait", meta: "One cell action." }) : turn]) + escapeHtml;
    }
    if (v.stage === "trial") {
      return html + (v.confidant ? '<p class="small">' + esc(v.confidant) + " will speak for you: +1.</p>" : "") +
        (v.judgeShift ? '<p class="small">The judge is known to be ' + (v.judgeShift > 0 ? "harsh: a sentence runs a season longer." : "merciful: a sentence runs a season shorter.") + "</p>" : "") +
        opts([opt({ act: "jtrial", label: "Petition the court", check: PC.checks.assess(state, v.trialCheck, { conditions: ["Official"] }),
          meta: v.charge === "Condemned" ? "Clean: free. Partial: 4-8 seasons in prison. Setback: the gallows at the end of next season." :
            "Clean: free, with a fine and a drop in " + esc(v.faction) + " Standing. Partial: 1-3 seasons. Setback: 2-5 seasons." })]);
    }
    if (v.stage === "serving") {
      return html + '<p class="small">' + plural(v.sentence, "season") + " left to serve. Serving the whole sentence clears your Heat with " + esc(v.faction) + ".</p>" +
        opts([opt({ act: "jserve", label: "Serve your time", meta: "The seasons pass. You'll see what happened outside when you're let out." }), turn]) + escapeHtml;
    }
    if (v.stage === "gallows") {
      return html + '<p class="notice warn">The gallows ' + (v.gallowsIn <= 1 ? "at the end of this season." : "at the end of next season.") + "</p>" + opts([turn]) + escapeHtml;
    }
    return html;
  }

  // The cell's actions (§43.7) and the escape clock (§43.8).
  function escapeBlock(ev) {
    var lock = ev.canAct.ok ? null : ev.canAct.why;
    var rec = ev.recruits, recN = Object.keys(rec.tiers).reduce(function (a, k) { return a + rec.tiers[k]; }, 0);
    var dots = function (n, max) { var o = ""; for (var i = 0; i < max; i++) o += i < n ? "●" : "○"; return o; };
    return '<div class="svc"><h4>Planning an escape</h4><p class="small">The escape clock ' + dots(ev.clock, ev.clockMax) + " · escape points " + (ev.points < 0 ? "−1 (the guards are watching you)" : dots(ev.points, ev.pointsCap)) +
      " · " + plural(ev.escapees, "escapee") + " (each officer counts two)" + (recN || rec.officers.length ? " · cellmates waiting to come: " + [recN ? plural(recN, "hand") : null].concat(rec.officers.map(function (o) { return o.first + " (" + o.type + ")"; })).filter(Boolean).join(", ") : "") + ".</p>" +
      '<p class="note">Each plan fills the clock: +2 clean, +1 partial, −1 setback. A full clock is an escape point; spend one before a beat of the break-out for +1.</p></div>' +
      opts(ev.planList.map(function (p) {
        return opt({ act: "jplan", attrs: 'data-id="' + p.id + '"', label: p.label + (ev.plans[p.id] ? " ✓" : ""), check: p.assess, lock: lock,
          meta: "One cell action. Unlocks " + esc(p.unlocks) + (p.note ? ". " + esc(p.note) : "") + "." });
      }).concat([
        opt({ act: "jrecruit", attrs: 'data-what="crew"', label: "Work the cellmates: a few hands", lock: lock || (ev.usedCrew ? "Once a season" : null), meta: "One cell action. Seasoned and Veteran hands who join for free, if they get out with you." }),
        opt({ act: "jrecruit", attrs: 'data-what="officer"', label: "Work the cellmates: an officer", lock: lock || (rec.officers.length ? "One a stay" : null), meta: "One cell action. An officer who joins for free, if he gets out with you." }),
        opt({ act: "jbreak", label: "Break out", lock: lock, meta: "One cell action, then three beats: the cell, the guards, the jail. Caught: your trial gets harder, or your sentence longer." }),
      ]));
  }

  function breakoutBlock(ev) {
    var b = ev.breakout, html = '<div class="svc"><h4>Breaking out · beat ' + b.beat + " of 3</h4>" +
      '<p class="small">Escape points: ' + Math.max(0, ev.points) + (b.spent ? " · one spent on this beat (+1)" : "") + ".</p></div>";
    var list = [];
    if (!b.spent && ev.points > 0) list.push(opt({ act: "jspend", label: "Spend an escape point", meta: "+1 on this beat." }));
    var M = { sneak: ["Sneak", "Hard. Clean: unseen. Partial: you're running now. Setback: a fight."], run: ["Run", "Moderate. Partial: you lose an officer. Setback: a fight."],
      fight: ["Fight", "By the guards here. Partial: you lose an officer and many hands. Setback: Wounded, then Endure: a setback is death; otherwise back to the cell."] };
    if (b.beat === 1) list.push(opt({ act: "jbeat", label: "Out of the cell", check: PC.checks.assess(state, b.check, { conditions: [] }), meta: "The easiest of the three. Setback: back in the cell, and your escape points are gone." }));
    else b.modes.forEach(function (m) { list.push(opt({ act: "jbeat", attrs: 'data-mode="' + m.id + '"', label: (b.beat === 3 ? "Keep going: " : "") + M[m.id][0], check: PC.checks.assess(state, m.check, { conditions: [] }), meta: M[m.id][1] })); });
    return html + opts(list);
  }

  // The Freedom and Captivity officers' beats in the cell (§25.15).
  function officerBeats(ev) {
    var F = PC.data.prison.escape.lines;
    if (ev.captivity) {
      var n = ev.captivity.first;
      return '<div class="prose">' + prose(F.captivity.setup.replace(/\[Name\]/g, n)) + "</div>" + opts([
        opt({ act: "jcapt", attrs: 'data-c="calm"', label: "Try to calm him", check: PC.checks.assess(state, { type: "Persuade", dr: 2 }, { conditions: [] }), meta: "Clean or partial: +1 rung. Setback: the guards come, and you lose an escape point." }),
        opt({ act: "jcapt", attrs: 'data-c="shut"', label: "Tell him to shut up, or you'll do it for him", meta: "He won't like it." }),
        opt({ act: "jcapt", attrs: 'data-c="knock"', label: "Knock him out", meta: "−1 rung, and he's Wounded." })]);
    }
    if (ev.freedom) {
      var f = ev.freedom.first;
      return '<div class="prose">' + prose(F.freedom.setup.replace(/\[Name\]/g, f)) + "</div>" + opts([
        opt({ act: "jfree", attrs: 'data-c="trust"', label: "Trust him and follow his lead", meta: "+1 escape point, +1 rung." }),
        opt({ act: "jfree", attrs: 'data-c="wait"', label: "Too risky. Wait.", meta: "He'll be disappointed." }),
        opt({ act: "jfree", attrs: 'data-c="better"', label: "Stand down: you've a better plan", meta: "He approves of a captain with a plan." })]);
    }
    return "";
  }

  function jailResult() {
    if (!jailSay) return "";
    var h = (jailSay.lines || []).length ? '<div class="say">' + (jailSay.lines || []).map(inline).join("<br>") + "</div>" : "";
    // 3-28 of the build 0.9 pins: a cell action's roll gets the same result box and chip as everywhere else.
    if (OUTCOME[jailSay.outcome]) return rbox(jailSay.outcome, badge(jailSay.outcome) + h + chips(jailSay.chips), "jail-" + (jailSeq++));
    return h + chips(jailSay.chips);
  }

  function shiplessPanel() {
    var nd = N().nodeData(N().here(state)), O = PC.prison.shiplessOptions(state), L = PC.data.prison.lines;
    var meta = { buy: "A used cutter with her minimum crew, today. " + gold(PC.data.prison.CUTTER_PRICE) + " gold from crew gold, then your purse.",
      steal: "Four little cutthroat urchins know a cutter nobody's watching. Clean: she's yours. Partial: yours, and Heat +" + PC.data.prison.STEAL_HEAT + ". Setback: caught.",
      work: "A season of hard work for a shabby cutter with a bare crew.", stash: "A friend here fetches your stash: a season.", retire: "Your story ends here." };
    return '<div class="where">' + esc(nd.name + " · " + PC.state.seasonName(state) + " " + state.time.year) + '</div><h2 class="title">Without a Ship</h2>' +
      '<div class="prose dropcap">' + prose(L.shipless) + "</div>" + jailResult() +
      '<p class="small">' + gold(state.money.crew + state.money.purse) + " gold on hand · " + plural(state.crew.count, "hand") + " with you.</p>" +
      opts(O.map(function (o) {
        return opt({ act: "jship", attrs: 'data-id="' + o.id + '"', label: o.label, check: o.check ? PC.checks.assess(state, o.check, { conditions: ["Town"] }) : null, meta: meta[o.id], lock: o.ok ? null : o.why });
      }));
  }

  // The morale band changed since the last screen (P7b): a one-line notice.
  function moraleBandNotice() {
    if (!state.crew) return;
    var b = PC.crew.band(state.crew.morale);
    if (state.crew.bandSeen && state.crew.bandSeen !== b) {
      var msg = PC.data.world.lines.moraleBand.replace("{band}", b), t = document.querySelector(".toast");
      if (t) t.textContent += " · " + msg; else toast(msg); // don't wipe the action's own toast
    }
    state.crew.bandSeen = b;
  }

  // ---- The end of the prototype (§37.1; the M6 chat's R5) ----
  // One screen for stopping, being captured and dying (it absorbs the old
  // game over screen).

  function drawEnd() {
    var v = PC.summary.summary(state);
    var c = state.captain, pic = PC.creator.captainPortrait(c);
    var L = PC.data.endLines;
    var Y = PC.data.world.yearEnd;
    var head = v.how === "year" ? Y.title : v.how === "stopped" ? L.title : L.overTitle;
    var meter = function (n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n); };
    var st = v.standing || {}, ht = v.heat || {};
    var rows = [
      ["Your purse", gold(v.purse) + " gold"], ["Crew gold", gold(v.crew) + " gold"],
      ["Your worth", gold(v.worth) + " gold" + ' <span class="note">(your purse; no stash or holdings yet)</span>'],
      ["Prizes taken", String(v.prizes)], ["Hulls sold", String(v.hullsSold)],
      ["Standing", "Avalon " + meter(st.avalon || 0) + " · Frisia " + meter(st.frisia || 0) + " · Pirates " + meter(st.pirates || 0)],
      ["Heat", "Avalon " + (ht.avalon || 0) + " · Frisia " + (ht.frisia || 0)],
      ["Dread", String(v.dread)],
      [v.tagsAreNew ? "Tags earned" : "Tags", v.tags.length ? esc(v.tags.join(", ")) : "None"],
      ["Leads", "What Was Lost " + v.leads.loss + " of " + v.leads.lossNeeded + " · The Hidden Haven " + v.leads.haven + " of " + v.leads.havenNeeded],
    ];
    // The year's recap (Milestone 7; its words are the author's to write, PH7).
    if (v.how === "year" && v.year) rows.unshift(["This year", "Prizes taken " + v.year.prizes + " · your purse " + (v.year.purse >= 0 ? "+" : "−") + gold(Math.abs(v.year.purse)) +
      " · " + (v.year.split ? "the crew split in Winter" : "no split") + (v.year.tradeShip ? " · trade ship: the " + esc(v.year.tradeShip) : "") + " · ports: " + esc(v.year.visited.join(", "))]);
    var how = v.how === "stopped" || v.how === "year" ? "" : '<div class="prose dropcap">' + prose(PC.data.huntLines.gameOver[(state.gameOver && PC.data.huntLines.gameOver[state.gameOver.line]) ? state.gameOver.line : v.how === "died" ? "died" : "captured"]) + "</div>";
    root.innerHTML = frame('<div class="endscreen" style="padding:18px 16px 32px;max-width:720px;margin:0 auto">' + '<p class="sc" style="margin:0">' + esc(v.season) + "</p>" +
      '<h2 class="title">' + esc(head) + "</h2>" + how +
      '<div class="person" style="margin:12px 0">' + (pic ? '<img src="' + assetUrl(pic) + '" alt="" style="width:96px;height:auto">' : sil(72, 108)) +
      '<div class="pmain"><div class="namecard"><b>' + esc(v.captain) + '</b><span class="role">Captain of the ' + esc(v.ship.name) + " · " + esc(v.ship.type) + "</span></div>" +
      (v.reputation ? '<p class="small"><i>' + esc(v.reputation) + "</i></p>" : "") + "</div></div>" +
      '<table class="grid">' + rows.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + r[1] + "</td></tr>"; }).join("") + "</table>" +
      '<p class="note">' + esc(v.how === "year" ? Y.note : v.how === "stopped" ? L.note : L.overNote) + "</p>" +
      '<div class="actions"><button class="primary" data-act="quit">Return to title</button>' +
      (settings.dev && v.how === "stopped" ? '<button class="secondary" data-act="keepplaying">Developer: keep playing (actions topped up)</button>' : "") +
      (settings.dev && v.how === "year" ? '<button class="secondary" data-act="keepplaying">Developer: keep playing into ' + (state.time.year + 1) + "</button>" : "") + "</div></div>") +
      popupHtml() + menuHtml();
    wire();
  }

  // The banner when the season's actions are spent (R5): free actions like
  // selling still work, and the player ends the prototype when ready.
  // Milestone 7: the season turns here (§4). Free actions still work first.
  function noActionsBanner() {
    if (!state || state.ap.left > 0 || state.current.screen !== "node") return "";
    var split = PC.world.splitWinter(state);
    return '<div class="notice" style="margin:0 0 10px"><b>' + (split ? "The split takes the whole Winter." : "No actions left.") + "</b> " +
      (split ? "" : "You can still do anything that costs no action, like selling. ") +
      '<button class="primary" data-act="endseason" style="margin-left:6px">' + esc(endSeasonLabel()) + "</button></div>";
  }
  function endSeasonLabel() {
    var last = PC.state.seasonName(state) === "Winter" && !state.keepPlaying;
    return last ? "End the Winter and the year" : "End the season";
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
    // The Saved stamp ticks after every action (§41.12): it flashes as it
    // lands so it reads as a save, and says so on hover (B29).
    return '<span class="seal">' + '<span title="No letter of marque: you sail under no flag but your own." style="display:inline-flex;align-items:center;gap:10px">' + wax + '<span class="letter">No letter</span></span>' +
      '<span class="stamp' + (stampFlash ? " flash" : "") + '" title="Saved automatically after every action">Saved</span></span>';
  }

  // Purse · Crew gold · Crew aboard / room · Provisions (and about how many
  // actions at sea they feed). Compact on a phone.
  function barStats() {
    var c = state.crew, sh = state.ship;
    var crew = c.count + (c.wounded || 0);
    var food = PC.crew.food(state), feeds = state.location && PC.world && PC.world.apOfFood ? PC.world.apOfFood(state) : null;
    var item = function (cls, label, short, val, title) {
      return '<span class="bstat ' + cls + '" title="' + esc(title) + '"><span class="bl">' + label + '</span><span class="bs">' + short + "</span> " + val + "</span>";
    };
    return '<span class="barstats">' +
      item("b-purse", "Purse", "Purse", gold(state.money.purse), "Your own gold") +
      item("b-crewgold", "Crew gold", "Crew gold", gold(state.money.crew), "The crew's shared gold: wages, food, repairs") +
      (state.shipless ? "" : item("b-crew", "Crew", "Hands", crew + " / " + sh.crewMax, "Hands aboard your flagship" + (c.wounded ? " (" + c.wounded + " wounded)" : "") + " / room for " + sh.crewMax + " (at least " + (sh.crewMin || 0) + " to sail)")) +
      item("b-prov", "Provisions", "Food", food + (feeds != null ? ' <span class="bfeeds">(~' + (Math.floor(feeds) === 1 ? "1 action" : Math.floor(feeds) + " actions") + ")</span>" : ""), "Lots of provisions aboard, and about how many actions at sea they feed") +
      "</span>";
  }

  var stampFlash = false;
  function topBar() {
    var b = function (k, t, m) { return '<button class="menubtn' + (menu === m ? " on" : "") + '" data-act="openmenu" data-menu="' + m + '">' + ic(k) + t + (m === "journal" ? jdot() : "") + "</button>"; };
    return '<header class="topbar"><div><span class="brand">Pirate Chronicle</span><span class="wt">(working title)</span></div>' +
      '<span class="when">' + esc(PC.state.seasonName(state)) + " " + state.time.year + "</span>" +
      '<span class="pips" title="Actions left this season">' + apPips() + "</span>" +
      (state.location && PC.weather ? wxBadge(PC.weather.outlook(state, PC.weather.zoneHere(state)), "This season's weather here (" + PC.weather.zoneHere(state) + ")") : "") +
      // The sticky bar's numbers (Playtest Pins 0.9, items 17, 32, 50): what
      // you have to spend and feed, on every screen, phone and desktop.
      barStats() +
      '<span class="grow"></span>' + seal() +
      '<div class="line2">' + b("menu", "Menu", "menu") + b("journal", "Journal", "journal") + b("rumor", "Rumors", "rumors") + b("captain", "Captain", "captain") + b("ship", "Ship", "ship") + "</div></header>";
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
      (state.shipless ? lrow("Ship", "<i>none</i>") : lrow(sh.type, "<i>" + esc(sh.name) + "</i>") +
      lrow("Hull", Math.round(sh.hull) + " / " + sh.hullMax + '<div class="hbar" style="margin-left:auto;width:84px"><i style="width:' + Math.round(100 * sh.hull / sh.hullMax) + '%;background:#5e4528"></i></div>')) +
      // Crew with the wounded (A16, §38.5); provisions as lots under morale (P8).
      lrow("Crew", plural(state.crew.count, "hand") + (state.crew.wounded ? ' <span class="note">+ ' + state.crew.wounded + " wounded</span>" : "")) +
      lrow("Morale", state.crew.morale + ' · <span class="sc" style="font-size:16px">' + esc(PC.crew.band(state.crew.morale)) + "</span>") +
      // P8: provisions as lots, with time at sea in the tooltip.
      lrow("Provisions", '<span title="' + esc(foodWords() + ": " + timeAtSea(PC.crew.food(state))) + '">' + esc(String(PC.crew.food(state))) + "</span>") + "</table>" +
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
      '<span class="ptext"><b>' + esc((c.first + " " + c.last).trim()) + "</b> · <i>" + esc(state.shipless ? "no ship" : sh.name) + "</i><br>Purse · " + gold(state.money.purse) + " gold · Crew gold · " + gold(state.money.crew) +
      "<br>Hull " + Math.round(sh.hull) + "/" + sh.hullMax + " · " + plural(state.crew.count, "hand") + (state.crew.wounded ? " (+" + state.crew.wounded + " wounded)" : "") + " · Morale " + state.crew.morale + " " + esc(PC.crew.band(state.crew.morale)) + " · Provisions " + PC.crew.food(state) + '</span><span class="go">›</span></button>' +
      (aboard().length ? '<div class="pfaces">' + aboard().map(function (o) {
        return '<button class="link" data-act="openmenu" data-menu="officer:' + esc(o.id) + '" aria-label="' + esc(o.first) + '">' + officerFace(o, 30, 45) + "</button>";
      }).join("") + '<span class="note">Officers · tap for cards</span></div>' : "");
  }

  function jdot() { return state.journalDot ? '<span class="jdot" title="Something new in your Journal"></span>' : ""; }

  // The Ship opens over any screen, mid-hunt and mid-battle included (A1, B27).
  function tabBar() {
    var b = function (k, t, a, extra) { return '<button data-act="' + a + '"' + (extra || "") + ">" + ic(k) + t + "</button>"; };
    return '<nav class="tabbar">' + b("journal", "Journal" + jdot(), "openmenu", ' data-menu="journal"') + b("rumor", "Rumors", "openmenu", ' data-menu="rumors"') +
      b("captain", "Captain", "openmenu", ' data-menu="captain"') + b("ship", "Ship", "openmenu", ' data-menu="ship"') + b("menu", "Menu", "openmenu", ' data-menu="menu"') + "</nav>";
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
    // P7: a scene step lands with its woodcut (or plate) at the top.
    var html = '<div class="where">' + esc(h.line) + "</div>" + '<div data-anchor="scene">' + (h.plate ? plate(h.plate) : banner(h.banner)) + "</div>" +
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

  // Officer approval (§38.6): one chip an officer, his face with a single
  // up or down mark beside it, saying which trait or drive moved him
  // (B4, B5 of the M5 playtest). The chip's own icon stays plain ink.
  function approvalChips(tags) {
    if (!tags || !tags.length) return [];
    return aboard().map(function (o) {
      var rx = PC.officers.reactions(o, tags);
      var up = rx.reduce(function (a, r) { return a + r.dir; }, 0);
      if (!up) return null;
      var shown = rx.filter(function (r) { return r.dir === (up > 0 ? 1 : -1); });
      // A hidden drive or fear that reacts to the same tag as a known trait
      // adds nothing on screen (Playtest Pins 0.8, #13/#20: Davey's Jovial
      // and his hidden drive both like revelry).
      var known = shown.filter(function (r) { return !r.hidden; }).map(function (r) { return r.tag + "|" + r.dir; });
      shown = shown.filter(function (r) { return !r.hidden || known.indexOf(r.tag + "|" + r.dir) < 0; });
      var why = shown.map(function (r) {
        var src = r.source || (r.hidden === "fear" ? "A fear " + (o.gender === "f" ? "she" : "he") + " hasn't told you" : r.hidden === "drive" ? "A drive " + (o.gender === "f" ? "she" : "he") + " hasn't told you" : "Their nature");
        return src + ": " + (r.dir > 0 ? "likes " : "dislikes ") + r.tag;
      }).join("; ");
      return { icon: "person", ink: "ink", html: '<span class="appr" title="' + esc(o.first + (up > 0 ? " approves" : " disapproves")) + '">' + officerFace(o, 22, 32) +
        '<span style="color:' + (up > 0 ? INK.good : INK.bad) + '">' + ic(up > 0 ? "up" : "down", "mark", 2) + "</span></span> " + esc(o.first) + " · " + esc(why) };
    }).filter(Boolean);
  }

  // Strike First (§11.4): the automatic opening roll of a close fight, in
  // the same result styling (§38.6).
  function strikeFirstLine(sf) {
    if (!sf) return "";
    // A scene's close fight is one clash (B15 of the M5 playtest).
    var t = sf.value > 0 ? "You strike first: +1 on the clash." : sf.value < 0 ? "It gets the jump: −1 to you on the clash." : "Neither of you gets the jump.";
    return '<p class="sfline" style="color:' + (sf.value > 0 ? INK.good : sf.value < 0 ? INK.bad : "inherit") + '">' + esc(t) +
      (state.settings.showDice && sf.dice ? ' <span class="note">(Strike First: dice ' + sf.dice.join(" + ") + ", edge " + sf.edge + ")</span>" : "") + "</p>";
  }

  // A scene's result (§38.6): what you chose, then a roll's result in its
  // color-coded box (G4); the screen scrolls here after the choice (G1).
  function resultBits(r, compact) {
    var key = (compact ? "lead:" : "res:") + (state.current.sceneId || "") + ":" + (r.choiceLabel || r.label || "") + ":" + (r.outcome || "") + ":" + (r.roll && r.roll.dice ? r.roll.dice.join(",") : "");
    var html = '<p class="you-chose">' + inline(r.choiceLabel || r.label) + "</p>";
    if (r.firstRoll) html += '<p class="note">First roll: ' + OUTCOME[r.firstRoll.outcome][0] + ". Rerolled with " + esc(r.firstRoll.by) + ".</p>";
    html += strikeFirstLine(r.strikeFirst);
    var inner = badge(r.outcome) + diceLine(r.roll);
    if (r.text) inner += '<div class="prose">' + prose(r.text) + "</div>";
    var list = (r.chips || []).slice();
    approvalChips(r.approval).forEach(function (c) { list.push(c); });
    // #9 of the build 0.9 pins: on a wide screen, what came of it (effects,
    // officers' approval) sits beside the text instead of under it.
    if (list.length) inner = '<div class="rcols"><div class="rmain">' + inner + '</div><div class="rside">' + (compact ? "" : '<div class="h4" style="max-width:680px">What came of it</div>') + chips(list) + "</div></div>";
    html += OUTCOME[r.outcome] ? rbox(r.outcome, inner, key) : '<div data-result="' + esc(key) + '">' + inner + "</div>";
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
  var liveMax = {}; // a stepper's live cap, read when + or Max is pressed
  function qstep(id, value, max, min, withMax, step) {
    min = min == null ? 1 : min;
    step = step || 1;
    value = Math.max(min, Math.min(max, value));
    return '<span class="stepper"><button type="button" data-step="' + id + '" data-d="' + (-step) + '" aria-label="Fewer">−</button>' +
      '<input id="' + id + '" type="number" inputmode="numeric" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
      '<button type="button" data-step="' + id + '" data-d="' + step + '" aria-label="More">+</button></span>' +
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
    return n ? PC.npcs.menuName(n) : id;
  }

  // A person's name card (§41.5): name, role, relationship word, known traits.
  function nameCard(id, roleWord) {
    var n = PC.npcs.get(state, id);
    if (!n) return "";
    var known = (state.npcs[n.id] || {}).knownTraits || [];
    return '<div class="namecard"><b>' + esc(npcName(id)) + "</b>" + (roleWord ? '<span class="role">' + esc(roleWord) + "</span>" : "") +
      relWord(n.rungName) + (known.length ? '<span class="traits">' + esc(known.join(", ")) + "</span>" : "") + "</div>";
  }

  // What was last said, under the person it was said to (§41.1). Every
  // paragraph in the block keeps the same spacing (G6); a roll's outcome
  // colors the box and leads it with the badge (G4); it is a result the
  // screen scrolls to (G1).
  function sayParas(text) {
    return String(text || "").split(/\n\n+/).filter(Boolean).map(function (p) { return '<p class="sl">' + inline(p) + "</p>"; }).join("");
  }
  function sayFor(who) {
    var s = state.location.say;
    if (!s || (s.to || null) !== (who || null)) return "";
    var o = s.outcome && OUTCOME[s.outcome];
    var html = '<div class="say' + (o ? " rbox " + o[1].replace("t-", "o-") : "") + '" data-result="say:' + (state.location.sayN || 0) + '">';
    if (s.who) html += '<div class="who">' + esc(s.who) + "</div>";
    if (s.ask) html += '<p class="sl ask">You: “' + esc(s.ask) + '”</p>';
    if (o) html += rollBadge(s.outcome, s.rollType);
    if (s.line) html += sayParas(PC.text.render(s.line, state));
    if (s.heard && s.heard.length) html += '<ul class="heard">' + s.heard.map(function (h) { return "<li>" + inline(h) + "</li>"; }).join("") + "</ul>";
    if (s.heardNote) html += '<span class="snote">' + esc(s.heardNote) + "</span>";
    if (s.note) html += '<span class="snote">' + esc(s.note) + "</span>";
    if (s.chips && s.chips.length) html += chips(s.chips);
    return html + "</div>";
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
    if (!state.location) { if (line) toast(PC.text.render(line, state).replace(/[“”"*]/g, "")); return; }
    state.location.sayN = (state.location.sayN || 0) + 1;
    state.location.say = { to: to || null, who: who || null, line: line || "", note: note || null, heard: heard || null };
    if (extra) Object.keys(extra).forEach(function (k) { state.location.say[k] = extra[k]; });
  }

  function nodeHead(key) {
    var pl = placeInfo(key);
    return '<div class="where">' + esc(pl.node + (key === "town" ? "" : " · " + pl.heading)) + "</div>" + banner(pl.banner) +
      '<h2 class="title">' + esc(pl.heading) + "</h2>";
  }

  var CONTROL = { "Admiralty control": ["Admiralty Control", "avalon"], "Open water": ["Open Water", "sea"], "No control": ["No Control", "none"], "Pirate control": ["Pirate Control", "pirates"], "Frisian control": ["Frisian Control", "frisia"], "Avalon control": ["Avalon Control", "avalon"] };
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
    html += '<div class="prose dropcap">' + prose(isWinter() && loc.winter ? loc.winter : loc.blurb) + '</div><div style="clear:both"></div>';
    var back = function (top) { return '<div class="actions"' + (top ? ' style="margin:0 0 6px"' : "") + '><button class="secondary" data-act="leaveplace">‹ Back to ' + esc(nd.name) + "</button></div>"; };
    html = back(true) + html;
    html += ({ tavern: tavernMenu, docks: docksMenu, merchant: merchantMenu, graveyard: graveyardMenu, ship: shipMenu, admiralty: admiraltyMenu })[place]();
    return html + DIVIDER + back(false);
  }

  // The town screen (§41.4): the control line, then Town, Your ship, To sea.
  // An ocean node (Milestone 7) has only the Ship and To sea.
  function isWinter() { return PC.state.seasonName(state) === "Winter"; }
  function townPanel(nd) {
    if (nd.kind === "ocean") return oceanPanel(nd);
    var c = CONTROL[nd.control] || [nd.control, "none"];
    var pres = nd.present || { places: {} };
    var html = '<div class="ctrl" style="color:' + INK[c[1]] + '">' + flagSvg(c[1]) + esc(c[0]) + (nd.freePort ? " · Free Port" : "") + " · " + esc(pres.prosperityWord || nd.tier) + "</div>" +
      banner(pres.places.town ? pres.places.town.banner : nd.name) + '<h2 class="title">' + esc(nd.name) + '</h2><div class="prose dropcap">' + prose(isWinter() && nd.winterBlurb ? nd.winterBlurb : nd.blurb) + '</div><div style="clear:both"></div>';
    var ps = N().places(state).filter(function (p) { return !p.hidden; });
    var row = function (p) {
      var pl = pres.places[p.id] || {};
      var hint = pl.hint ? pl.hint + (p.id === "merchant" && N().fenceOpen(state) && pl.hintFence ? ", " + pl.hintFence : "") : null;
      if (p.id === "ship") return opt({ act: "openmenu", attrs: 'data-menu="ship"', label: pl.heading || p.name, meta: hint ? esc(hint) : null });
      return opt({ act: "goplace", attrs: 'data-place="' + p.id + '"', label: pl.heading || p.name, meta: hint ? esc(hint) : null, lock: p.locked ? p.why : null });
    };
    html += '<div class="h4" style="max-width:680px">Town</div>' + opts(ps.filter(function (p) { return p.id !== "ship"; }).map(row));
    html += '<div class="h4" style="max-width:680px">Your ship</div>' + opts(ps.filter(function (p) { return p.id === "ship"; }).map(row));
    html += '<div class="h4" style="max-width:680px">To sea</div>' + opts(toSea(nd));
    return html + seasonFooter();
  }

  // Hunt for Prizes and Set Sail (§41.4). Leaving without Articles fires
  // the first signing (§40.5).
  function toSea(nd) {
    var pres = nd.present || {};
    var waters = PC.data.hunt.WATERS[PC.data.hunt.HOME_WATERS[nd.id] || nd.waters || "north"].name;
    var hunt;
    if (!state.articles) hunt = opt({ act: "firstsigning", label: "Hunt for Prizes", meta: "Sign the Articles before you sail" });
    else {
      var c = PC.hunt.canHunt(state);
      var tail = nd.kind === "ocean" ? "you stay out at sea when it's done" : "back to " + nd.name + " for free (the port fee again)";
      hunt = opt({ act: "hunt", label: "Hunt for Prizes", ap: 1, meta: esc((isWinter() && pres.huntWinter ? pres.huntWinter + " " : "") + "1 action a batch of sightings, up to 3 · " + waters + " · " + tail), lock: c.ok ? null : c.why });
    }
    var sail = state.articles ? opt({ act: "openmap", label: "Set Sail", meta: "The chart: Ocracoke, Norfolk and the open sea" + (PC.world.splitWinter(state) ? "" : "") ,
      lock: PC.world.splitWinter(state) ? "The split takes the whole Winter" : null }) :
      opt({ act: "firstsigning", label: "Set Sail", meta: "The chart · sign the Articles before you sail" });
    return [hunt, sail];
  }

  function oceanPanel(nd) {
    var pres = nd.present || { places: {} };
    var html = '<div class="ctrl" style="color:' + INK.sea + '">Open Water · the ' + esc(nd.zone === "south" ? "south" : "north") + " weather zone</div>" +
      banner(pres.places.town ? pres.places.town.banner : nd.name) + '<h2 class="title">' + esc(nd.title || nd.name) + '</h2><div class="prose dropcap">' + prose(nd.blurb) + '</div><div style="clear:both"></div>';
    html += '<div class="h4" style="max-width:680px">Your ship</div>' + opts([opt({ act: "openmenu", attrs: 'data-menu="ship"', label: "The Ship", meta: "Your ship, crew and cargo" })]);
    html += '<div class="h4" style="max-width:680px">To sea</div>' + opts(toSea(nd));
    return html + seasonFooter();
  }

  // The season's end, by choice (§4: a captain with too few actions for
  // the voyage he wants stays where he is as the season turns).
  function seasonFooter() {
    if (!state.ap.left) return "";
    return '<div class="h4" style="max-width:680px">The season</div>' + opts([opt({ act: "endseason", label: endSeasonLabel(),
      meta: "You have " + plural(state.ap.left, "action") + " left." })]);
  }
  // ---- The chart (§41.4, §38.8; Milestone 7) -----------------------------------
  // A PLACEHOLDER map drawn in code from the author's layout guide: north to
  // the left, the coast running left to right. The hotspots are data
  // (content/world.js), laid over the picture by fraction, so the author's
  // art drops in by swapping the picture (PC.data.world.mapArt).
  var mapSel = null;
  var MAP_SVG = null;
  function mapSvg() {
    if (MAP_SVG) return MAP_SVG;
    var land = "#e6d3a3", ink = "#4a3418", sea = "#c9d6cf", sound = "#dbe2d7";
    var coast = "M0,598 L40,575 L75,552 L112,543 L138,512 L152,500 L176,507 L210,527 L236,541 L248,560 L262,585 L276,612 L283,642 L296,664 L318,674 L330,652 L342,612 L362,590 L382,580 L412,586 L440,606 L470,598 L494,590 L522,604 L556,612 L598,588 L636,576 L662,592 L702,600 L740,617 L782,632 L830,656 L878,664 L906,636 L922,666 L962,690 L1010,712 L1050,716 L1085,742 L1092,760 L1128,742 L1166,756 L1196,780 L1238,782 L1290,800 L1310,826 L1336,852 L1372,838 L1418,832 L1448,834 L1500,846 L1544,849 L1566,840 L1604,842 L1662,826 L1702,812 L1800,795 L1800,1200 L0,1200 Z";
    var chesapeake = "M0,350 L36,368 L70,392 L100,420 L124,442 L134,474 L94,472 L40,466 L0,462 Z";
    var soundPoly = "M0,462 L192,482 L300,430 L405,388 L460,420 L532,452 L652,560 L636,576 L598,588 L556,612 L522,604 L494,590 L470,598 L440,606 L412,586 L382,580 L362,590 L342,612 L330,652 L318,674 L296,664 L283,642 L276,612 L262,585 L248,560 L236,541 L210,527 L176,507 L152,500 L138,512 L112,543 L75,552 L40,575 L0,598 Z";
    var banks = '<path d="M195,486 L300,431 L398,390 Q420,384 436,396 L458,418" fill="none" stroke="' + ink + '" stroke-width="15" stroke-linecap="round"/>' +
      '<path d="M195,486 L300,431 L398,390 Q420,384 436,396 L458,418" fill="none" stroke="' + land + '" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M468,428 L528,452" fill="none" stroke="' + ink + '" stroke-width="15" stroke-linecap="round"/><path d="M468,428 L528,452" fill="none" stroke="' + land + '" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M546,462 L654,560" fill="none" stroke="' + ink + '" stroke-width="15" stroke-linecap="round"/><path d="M546,462 L654,560" fill="none" stroke="' + land + '" stroke-width="11" stroke-linecap="round"/>';
    var isle = function (cx, cy, rx, ry, rot) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + rot + " " + cx + " " + cy + ')" fill="' + land + '" stroke="' + ink + '" stroke-width="2"/>'; };
    var isles = isle(1525, 158, 80, 12, 12) + isle(1676, 178, 66, 9, -14) + isle(1432, 310, 12, 64, 2) + isle(1700, 432, 26, 40, 6) + isle(1745, 308, 8, 36, -32) +
      isle(1611, 342, 16, 6, 0) + isle(1475, 204, 7, 5, 0) + isle(1566, 239, 5, 4, 0) + isle(1637, 263, 6, 5, 0) + isle(1731, 270, 6, 5, 0) + isle(1709, 288, 5, 4, 0) + isle(1548, 383, 6, 5, 0) + isle(1741, 360, 6, 5, 0) + isle(1781, 204, 6, 5, 0);
    var river = function (d) { return '<path d="' + d + '" fill="none" stroke="#5f8796" stroke-width="3"/>'; };
    var rivers = river("M836,656 C832,690 806,700 808,730 C802,760 786,780 788,810 C760,830 768,840 756,852") + river("M1088,760 C1060,770 1042,800 1020,806 C1018,830 990,836 958,860 C930,876 918,900 914,930 C900,940 886,950 880,962") +
      river("M1198,782 C1186,800 1164,830 1164,860 C1150,880 1160,900 1152,912") + river("M1222,782 C1222,820 1228,850 1258,862 L1260,900") + river("M1418,836 C1432,850 1430,870 1414,882 C1398,920 1384,960 1380,1000 C1370,1020 1344,1030 1342,1050 C1350,1060 1350,1070 1346,1080");
    var lbl = function (x, y, t, size, style) { return '<text x="' + x + '" y="' + y + '" font-family="IM Fell English, Georgia, serif" font-size="' + (size || 22) + '" fill="' + ink + '"' + (style ? ' font-style="italic"' : "") + ' text-anchor="middle">' + t + "</text>"; };
    MAP_SVG = '<svg class="mapsvg" viewBox="0 0 1800 1200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A placeholder chart of the Carolina coast">' +
      '<defs><pattern id="mapwave" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0,15 Q15,5 30,15 T60,15" fill="none" stroke="#9fb4ad" stroke-width="1"/></pattern></defs>' +
      '<rect width="1800" height="1200" fill="' + sea + '"/><rect width="1800" height="1200" fill="url(#mapwave)" opacity=".5"/>' +
      '<path d="' + soundPoly + '" fill="' + sound + '"/>' +
      '<path d="' + chesapeake + '" fill="' + land + '" stroke="' + ink + '" stroke-width="2.5"/>' +
      '<path d="' + coast + '" fill="' + land + '" stroke="' + ink + '" stroke-width="2.5"/>' + banks + isles + rivers +
      '<ellipse cx="207" cy="636" rx="60" ry="36" fill="#a29c70" opacity=".75"/>' +
      '<ellipse cx="450" cy="204" rx="180" ry="96" fill="none" stroke="#7a2416" stroke-width="3" stroke-dasharray="10 8"/>' +
      '<ellipse cx="1530" cy="624" rx="180" ry="96" fill="none" stroke="#7a2416" stroke-width="3" stroke-dasharray="10 8"/>' +
      lbl(62, 505, "Chesapeake Bay", 19, true) + lbl(324, 528, "Pamlico Sound", 19, true) + lbl(423, 350, "Cape Hatteras", 18, true) + lbl(968, 620, "Cape Fear", 18, true) + lbl(207, 703, "Great Dismal Swamp", 17, true) +
      lbl(540, 1040, "The Carolinas", 34, true) + lbl(1650, 1172, "The French gulf shore lies beyond", 17, true) +
      '<g transform="translate(60,60)"><path d="M100,0 L0,0" stroke="' + ink + '" stroke-width="3"/><path d="M0,0 L14,-8 L14,8 Z" fill="' + ink + '"/>' + lbl(48, 44, "NORTH", 22) + "</g>" +
      "</svg>";
    return MAP_SVG;
  }

  function mapPanel() {
    var here = N().here(state), nd = N().nodeData(here);
    var dests = PC.world.destinations(state);
    var html = '<div class="where">' + esc((nd.kind === "ocean" ? nd.title : nd.name) + " · Set Sail") + '</div><h2 class="title">The Chart</h2>' +
      '<p class="note" style="max-width:680px">Pick where to sail. A voyage costs 1-3 actions by distance and burns provisions on the way. Uncharted places aren\'t on your charts yet.</p>';
    var art = PC.data.world.mapArt;
    html += '<div class="mapwrap"><div class="mapbox">' + (art ? '<img class="mapimg" src="' + assetUrl(art) + '" alt="">' : mapSvg());
    dests.forEach(function (d) {
      var cls = "mapnode" + (d.ocean ? " ocean" : "") + (d.live ? " live" : " uncharted") + (d.here ? " here" : "") + (mapSel === d.id ? " sel" : "");
      html += '<button class="' + cls + '" style="left:' + (d.x * 100) + "%;top:" + (d.y * 100) + '%" data-act="mapsel" data-node="' + esc(d.id) + '" title="' + esc(d.live ? d.label : d.label + ": " + PC.data.world.lines.uncharted) + '">' +
        '<span class="dot"></span><span class="lab"' + (d.labelDx || d.labelDy ? ' style="transform:translate(' + d.labelDx + "px," + d.labelDy + 'px)"' : "") + ">" + esc(d.label) + (d.here ? " (here)" : "") + "</span></button>";
    });
    html += "</div></div>";
    var sel = mapSel && dests.filter(function (d) { return d.id === mapSel; })[0];
    if (sel) html += destCard(sel);
    else html += '<p class="note">Tap a place on the chart.</p>';
    html += '<div class="actions"><button class="secondary" data-act="closemap">‹ Back to ' + esc(nd.kind === "ocean" ? nd.title : nd.name) + "</button></div>";
    return html;
  }

  // The destination card: what the town screen's top line says, the cost
  // from here, and the weather outlook (weather, PR 3).
  function destCard(d) {
    var html = '<div class="svc destcard"><h4>' + esc(d.label) + "</h4>";
    if (!d.live) return html + '<p class="small">' + esc(PC.data.world.lines.uncharted) + "</p></div>";
    var n = PC.data.nodes[d.id];
    if (n.kind === "ocean") html += '<p class="small" style="color:' + INK.sea + '">Open water · hunting grounds · no port fee, no merchant, no crew</p>';
    else {
      var c = CONTROL[n.control] || [n.control, "none"];
      html += '<p class="small" style="color:' + INK[c[1]] + '">' + flagSvg(c[1]) + esc(c[0]) + (n.freePort ? " · Free Port" : "") + " · " + esc((n.present || {}).prosperityWord || n.tier) + "</p>";
    }
    if (PC.weather && PC.weather.outlookLine) html += '<p class="small">' + PC.weather.outlookLine(state, d.zone) + "</p>";
    if (d.here) return html + '<p class="small">You are here.</p></div>';
    html += '<p class="small">' + plural(d.cost, "action") + " from here · about " + Math.ceil(PC.world.headsAtSea(state) / 5 * d.cost) + " provisions lots" + (PC.state.seasonName(state) === "Winter" ? " (more in Winter)" : "") + "</p>";
    html += '<div class="actions" style="margin-top:6px"><button class="primary" data-act="sail" data-node="' + esc(d.id) + '"' + (d.ok ? ' data-cost-ap="' + d.cost + '"' : " disabled") + ">Sail for " + esc(n.kind === "ocean" ? n.title : n.name) + (devFreeSail ? " (free)" : "") + "</button>" +
      (d.ok ? "" : '<span class="lock">' + esc(d.why) + "</span>") + "</div></div>";
    return html;
  }
  var devFreeSail = false;

  // ---- The Winter split (§26.9, §26.10) ------------------------------------------

  function splitPanel() {
    var sp = state.split, S = PC.data.world.split;
    if (!sp) return "";
    var nd = N().nodeData(N().here(state));
    var html = '<div class="where">' + esc((nd.title || nd.name) + " · Winter " + state.time.year) + '</div>' + banner("the split: the crew's chest opened on the deck") + '<h2 class="title">' + esc(S.title) + "</h2>";
    if (sp.step === "ask") {
      html += '<div class="prose dropcap">' + prose(S.ask) + "</div>";
      var rd = PC.world.qmReading(state), share = PC.world.impliedShare(state);
      html += '<div class="svc"><h4>The Quartermaster</h4>' + (rd ? '<p><b>' + esc(rd.who) + ":</b> " + inline(rd.line) + "</p>" : '<p class="note">No Quartermaster to read the crew\'s mood.</p>') +
        '<p class="small">If they split today, each share would be about <b>' + gold(share) + " gold</b> of crew gold (" + gold(state.money.crew) + " in the chest, less the " + Math.round(PC.data.world.CARRYOVER * 100) + "% carried over).</p></div>";
      if (sp.forced) html += '<p class="notice warn">' + inline(S.forced) + "</p>";
      var hp = PC.world.holdPressure(state);
      html += opts([
        opt({ act: "splitgo", label: "Split the gold", meta: "Takes the whole Winter: all 7 actions, no voyage, no port business. Prize ships are sold, every man takes his share, most of the crew go ashore." }),
        opt({ act: "splithold", label: "No split this Winter", meta: hp ? "The crew won't like waiting with this much gold in the chest." : "Not enough gold in the chest to be worth splitting.", lock: sp.forced ? "The crew won't take no for an answer" : null }),
      ]);
      return html;
    }
    if (sp.step === "payout") {
      var p = sp.payout;
      html += '<div class="prose">' + prose(S.payout) + "</div>";
      html += '<table class="grid">' + (p.sold.length ? p.sold.map(function (x) { return "<tr><td>Sold the " + esc(x.name) + '</td><td>+' + gold(x.gold) + "</td></tr>"; }).join("") : "") +
        "<tr><td>The chest</td><td>" + gold(p.pool) + "</td></tr><tr><td>Held back for next time (" + Math.round(PC.data.world.CARRYOVER * 100) + "%)</td><td>" + gold(p.carry) + "</td></tr>" +
        "<tr><td>One share</td><td>" + gold(p.one) + "</td></tr><tr><td>Your share, into your purse</td><td>+" + gold(p.captain) + "</td></tr>" +
        "<tr><td>Your officers</td><td>" + gold(p.officers) + "</td></tr><tr><td>" + plural(p.handsN, "hand") + "</td><td>" + gold(p.hands) + "</td></tr></table>";
      html += '<p>' + esc(S.perHand.replace("{gold}", gold(p.one)).replace("{mood}", PC.world.handMood(p.one))) + "</p>";
      html += chips([{ icon: "morale", text: "Crew morale reset to " + state.crew.morale }, { icon: "pressure", text: "The crew's grievances are settled" }, { icon: "ap", text: "The Winter's 7 actions are spent" }]);
      return html + '<div class="actions"><button class="primary" data-act="splitdepart" data-top="1">Continue</button></div>';
    }
    if (sp.step === "resign") {
      var dd = sp.departed || {};
      html += '<div class="prose">' + prose(S.departures) + "</div>" +
        '<p>' + esc(S.crewLine.replace("{skeleton}", dd.skeleton || 0).replace("{left}", dd.left || 0).replace("{back}", dd.back || 0).replace("{aboard}", state.crew.count)) + "</p>" +
        chips([{ icon: "officer", text: plural(dd.left || 0, "hand") + " went ashore for good", ink: "bad" }, { icon: "officer", text: plural(dd.back || 0, "hand") + " signed on again", ink: "good" }, { icon: "officer", text: plural(state.crew.count, "hand") + " aboard your flagship" }]);
      html += '<div class="prose">' + prose(S.resign) + "</div>";
      if (!state.articles) return html + '<div class="actions"><button class="primary" data-act="splitarticles">Draw up the Articles</button></div>';
      return html + '<p class="note">The Articles are signed.</p><div class="actions"><button class="primary" data-act="splitvote" data-top="1">Continue</button></div>';
    }
    if (sp.step === "winter") {
      if (sp.vote) html += '<div class="prose">' + prose(S.vote) + "</div>" + chips([{ icon: "officer", text: sp.vote.winner + " is your Quartermaster" }]);
      html += '<h3 class="sc" style="margin:14px 0 6px">' + esc(S.winter) + "</h3>";
      var types = PC.rumors.gatherTypes(state);
      html += opts(PC.world.winterOptions(state).map(function (o) {
        var meta = { carousing: "Crew morale +5" + (nd.freePort ? ", +5 more at a free port" : "") + ". Revelry.", careening: "The hull fully repaired, free; +1 Outrun in Spring.", officers: "Every officer warms to you a little.",
          ear: "A free rumor at the start of Spring, of the kind you pick.", courting: "+3 Standing with " + (nd.faction === "avalon" ? "Avalon" : "Frisia") + ".", gaming: "One Liar's Dice session, stakes from your purse. Revelry.",
          rest: "Clears Wounded, Fevered and Hangover." }[o.id] || "";
        if (o.id === "ear") return opt({ act: "nop", label: o.label, meta: meta, html: esc(o.label) + ' <span class="note">· pick a kind:</span> ' + types.map(function (t) { return '<button class="secondary" data-act="winterpick" data-opt="ear" data-type="' + esc(t) + '">' + esc(t) + "</button>"; }).join(" ") });
        return opt({ act: "winterpick", attrs: 'data-opt="' + o.id + '"', label: o.label, meta: meta });
      }));
      return html;
    }
    if (sp.step === "done") {
      var w = sp.spent;
      html += '<p class="you-chose">' + esc(w.label) + '</p><div class="prose">' + prose(w.line) + "</div>" + chips(w.chips) + '<div class="prose">' + prose(S.done) + "</div>";
      return html + '<div class="actions"><button class="primary" data-act="splitdone" data-top="1">Continue</button></div>';
    }
    return html;
  }

  // ---- The Trade Master (§27.7) ------------------------------------------------------
  function tradeMasterCard() {
    var id = N().here(state), who = N().slotNpc(id, "trademaster");
    if (!who) return "";
    var L = N().nodeData(id).lines.trademaster;
    var ts = state.tradeShip;
    var html = mcard("m:trade", who, "Trade Master");
    var g = PC.npcs.serviceLevel(state, who) == null ? L.refuse : ts && ts.node === id ? L.already : L.greet;
    html += state.location.say && state.location.say.to === who ? sayFor(who) : '<div class="say">' + inline(g) + "</div>";
    if (ts) html += '<p class="small">Your trade ship: <b>' + esc(ts.ship.name || ts.ship.cls) + "</b>, enrolled at " + esc(PC.world.placeName(ts.node)) + " · earns about " + gold(PC.world.tradeIncome(ts.ship, ts.node)) + " gold a season · " + gold(ts.ledger || 0) + " waiting to collect.</p>";
    var list = PC.world.tradeOptions(state);
    if (!list.length) html += '<p class="note">' + (ts ? "Bring in another kept prize to swap her." : inline(L.offer) + " You have no kept prize ship to enroll.") + "</p>";
    else {
      html += '<p class="small">' + (ts ? "Swap her for a kept prize: you pay only what the new ship costs over what you put into the old one, and the old one rejoins your fleet." : inline(L.offer)) + "</p>";
      html += list.map(function (o) {
        return '<div class="buyrow" style="flex-wrap:wrap"><span><b>' + dirtyName(o.name, o.dirty) + '</b> <span class="note">' + esc(o.cls + " · " + o.cargo + " cargo · earns about " + o.income + " a season") + "</span></span> " +
          '<button class="secondary" data-act="enroll" data-ship="' + esc(o.id) + '"' + (o.lock ? " disabled" : "") + ">" + (o.swap ? "Swap · " : "Enroll · ") + gold(o.due) + " from your purse</button>" +
          (o.lock ? '<span class="lock">' + esc(o.lock) + "</span>" : "") + "</div>" +
          '<p class="note" style="margin:2px 0 8px">Buyout ' + gold(o.buyout) + " (into crew gold, a gift to the crew) + the fee " + gold(o.fee) + (o.swap ? "; you've put " + gold(o.cost - o.due) + " in already" : "") + ".</p>";
      }).join("");
    }
    return html + '<p class="note">Earnings wait here until you come back for them. A trade ship can be lost at sea (worse in Hurricane season).</p></div></details>';
  }

  function notInPrototype() { return settings.dev ? "Not in the prototype (the hunt arrives in Milestone 5)" : "Not in the prototype"; }

  // ---- Tavern (§41.5) ----

  function tavernMenu() {
    var id = N().here(state);
    var keeper = N().slotNpc(id, "keeper");
    var L = N().nodeData(id).lines.keeper;
    var first = !N().firstTavernDone(state);
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
    // "At the bar" sits above the patrons and officers (Playtest Pins 0.8, #21).
    html += nodeExtras("tavern");
    html += DIVIDER + '<div class="block"><div class="h4">Around the Tavern</div>' + sayFor("around");
    // Gather Intelligence: pick what to hear about right in its result (#15 of the build 0.9 pins).
    if (state.location.gatherPick) {
      var gpl = state.location.gatherPick.left || 1;
      html += '<div class="hotmenu"><p class="sc" style="margin:0 0 6px">What do you want to hear about?' + (gpl > 1 ? " (" + gpl + " picks)" : "") + '</p><div class="actions" style="margin:0">' + PC.rumors.gatherTypes(state).map(function (t) {
        return '<button class="secondary" data-act="gatherpick" data-type="' + esc(t) + '">' + esc(t) + "</button>";
      }).join("") + "</div></div>";
    }
    var list2 = [];
    if (N().oneArmedHere(state)) list2.push(opt({ act: "oneArmed", label: "Talk to the one-armed pirate", meta: "He sits with his mates, drinking." }));
    var dk = PC.drinking.canDrink(state);
    list2.push(opt({ act: "drink", label: "Under the Table " + apText(1), ap: 1, meta: "Drink with " + ({ "Colonial Officer": "a navy officer", "Pirate": "a pirate" }[(PC.data.minigames.drinking.pools[id] || {}).role] || "a local") + ". Once a season; the loser pays the " + PC.data.minigames.drinking.TAB[N().nodeData(id).tier] + "-gold tab from your purse. Win a rumor.", lock: dk.ok ? null : dk.why }));
    var lp = PC.liarsdice.canPlay(state), st = PC.liarsdice.stakes(state);
    list2.push(opt({ act: "dice", label: "Liar's Dice " + apText(1), ap: 1, meta: "As many games a sitting as your purse covers, " + st[0] + "-" + st[1] + " gold a game from your purse.", lock: lp.ok ? null : lp.why }));
    var gi = N().tavernServiceCheck(state, 1);
    list2.push(opt({ act: "gather", label: "Gather Intelligence " + apText(1), ap: 1, meta: "Ask around town. Clean: two rumors, you pick both kinds. Partial: one, you pick the kind. Setback: one rumor, and people notice you asking.",
      check: gi.ok ? PC.checks.assess(state, PC.rumors.gatherCheck(state), { conditions: ["Harbor"] }) : null, lock: gi.ok ? null : gi.why }));
    html += opts(list2);
    return html + "</div>" + DIVIDER + officersBlock();
  }

  // Norfolk's own entries and the barkeep favor (Milestone 7, PR 5; records
  // §7 and §10, §16.6). The rules are in js/norfolk.js.
  function nodeExtras(place) {
    var id = N().here(state), f = state.flags, list = [];
    if (place === "tavern") {
      var fav = PC.norfolk.favorOffer(state);
      if (fav) list.push(opt({ act: "enter", attrs: 'data-scene="' + esc(fav.scene) + '"', label: "A favor for " + esc(PC.npcs.get(state, who("keeper")).first),
        meta: PC.text.render("Once a season · no action. Clean: {keeper.he} thinks better of you. Partial: the same, at a cost.", state), lock: fav.ok ? null : fav.why }));
      if (id === "norfolk" && f.horace_met) {
        var NL = N().nodeData(id).lines;
        if (!f.nor_drunken_sailors) list.push(opt({ act: "dsask", label: f.asked_horace_help ? NL.drunkenSailors.askAgain : NL.drunkenSailors.ask, meta: "No action" }));
        var have = PC.norfolk.liquorAboard(state).reduce(function (a, x) { return a + x.n; }, 0);
        if (f.nor_drunken_sailors) list.push(opt({ act: "horacesell", label: PC.norfolk.dsOpen(state) ? "Bring Horace your good liquor" : "Sell Horace good liquor",
          meta: (PC.norfolk.dsOpen(state) ? "Drunken Sailors: " + PC.norfolk.delivered(state) + " of 30 delivered. He pays half again Norfolk's price for clean liquor, the plain price for dirty." :
            "A quarter over Norfolk's price for clean liquor, the plain price for dirty.") + " No action · " + plural(have, "unit") + " aboard" + (PC.norfolk.pendragonOpen(state) ? " (no wine)" : "") + ".",
          lock: have ? null : "No good liquor aboard" }));
        list.push(opt({ act: "horaceask", attrs: 'data-q="advert"', label: NL.horaceAsk.advert, meta: "No action" }));
        if (PC.norfolk.variantCActive(state) && !f.gregoire_bill_lead) list.push(opt({ act: "horaceask", attrs: 'data-q="bill"', label: NL.horaceAsk.bill, meta: "No action" }));
        if (!f.godfrey_hired && !PC.officers.aboard(state).some(function (o) { return o.id === "godfrey"; })) {
          list.push(opt({ act: "enter", attrs: 'data-scene="' + (f.godfrey_met ? "nor_godfrey_pay" : "nor_godfrey_talk") + '"', label: f.godfrey_met ? NL.horaceAsk.godfreyAgain : NL.horaceAsk.godfrey, meta: "No action" }));
        }
      }
    }
    if (!list.length) return "";
    return DIVIDER + '<div class="block"><div class="h4">' + (place === "tavern" ? "At the bar" : "Around the yard") + "</div>" + opts(list) + "</div>";
  }

  // The Apprentices' opening question sits right under Christoph's line
  // (Playtest Pins 0.8, #17). Talking them round costs no action (#18).
  function apprenticesOpt() {
    var id = N().here(state), f = state.flags;
    if (id !== "norfolk" || !(state.npcs.christoph || {}).met || f.nor_appr_done) return "";
    var failed = f.nor_appr_failed === PC.scenes.seasonStamp(state);
    return opts([opt({ act: "enter", attrs: 'data-scene="nor_appr"', label: "“" + N().nodeData(id).lines.apprentices.opening + "”",
      meta: "The Apprentices · talking him round costs no action; fixing it yourself, 1", lock: failed ? "Christoph wants you away from his ship until next season" : null })]);
  }

  // The Admiralty House (§17.4.3; js/admiralty.js): Lieutenant Howe's menu.
  function admiraltyMenu() {
    var A = PC.admiralty, LA = N().nodeData("norfolk").lines.admiralty, f = state.flags;
    var html = '<div class="block">' + nameCard("howe", "Flag Lieutenant");
    html += state.location.say && state.location.say.to === "howe" ? sayFor("howe") : '<div class="say">' + inline(PC.text.render(A.greeting(state), state)) + "</div>";
    if (A.refused(state)) return html + '<p class="note">Lieutenant Howe won\'t deal with you.</p></div>';
    var list = [];
    // An audience with the Admiral.
    list.push(opt({ act: "keyaudience", label: "“" + LA.askAudience + "”", meta: PC.letters.band(state, "key") === "Respected" || PC.letters.band(state, "key") === "Trusted" ? "No action. He'll see you." : "No action. Through the Lieutenant." }));
    // Key's letter: Howe's standing offer.
    var lo = A.letterOffer(state);
    if (lo) list.push(opt({ act: "keyletter", label: "“Yes, I'd like my letter.”", meta: "Admiral Key's letter of marque (see the captain sheet for what it does). " + (lo.ok ? "Binding once taken." : ""), lock: lo.ok ? null : lo.why }));
    // Key's pardon.
    var pc = A.canPardon(state), price = A.pardonPrice(state);
    if (state.meters.heat.avalon > 0) list.push(opt({ act: "pardonask", label: "“" + LA.pardonAsk + "”",
      meta: "Clears your Avalon Heat (" + state.meters.heat.avalon + ")" + (price != null ? " for " + gold(price) + " gold from your purse" : "") + ". Avalon Standing +10, pirate Standing −10. Break it with a new offense against Avalon, and it's a betrayal.",
      lock: pc.ok ? null : pc.why }));
    if (state.pardon) list.push(opt({ act: "nop", label: "You hold the Admiral's pardon.", meta: "Any new offense against Avalon breaks it: a betrayal, and Key will hunt you for a year.", done: true }));
    // Report a bounty (§17.4.3; M9 PR 3).
    var rep = PC.bounties ? PC.bounties.reportable(state) : [];
    if (!rep.length) list.push(opt({ act: "bountynone", label: "Report a bounty", meta: "No action. Nothing to report yet." }));
    html += opts(list);
    if (rep.length) {
      html += '<p class="note" style="margin:14px 0 6px">Report a bounty</p>' + rep.map(function (x) {
        return '<p class="small" style="margin:6px 0 2px"><b>' + esc(x.name) + "</b>" + (x.kind === "straggler" ? " · a French straggler" : "") + "</p>" + opts(x.claims.map(function (c) {
          return opt({ act: "bountyreport", attrs: 'data-id="' + esc(x.id) + '" data-claim="' + esc(c.id) + '"', label: "“" + c.label + "”",
            check: c.lie ? PC.checks.assess(state, PC.bounties.lieCheck(state), { conditions: ["Official"] }) : null,
            meta: c.lie ? "A lie: Bluff & Disguise. Paid the dead rate either way; caught, the Admiral will hear of it." : x.kind === "straggler" ? PC.data.bounties.STRAGGLER_REWARD + " gold." : c.id === "alive" ? "The alive rate." : "The dead rate." });
        }));
      }).join("");
    }
    // Ask Lieutenant Howe...
    html += '<p class="note" style="margin:14px 0 6px">Ask Lieutenant Howe…</p>' + opts(A.questions(state).map(function (q) {
      return opt({ act: "howeask", attrs: 'data-q="' + esc(q.id) + '"', label: "“" + q.label + "”", meta: "No action", done: q.asked });
    })) + "</div>";
    // The notice board (from the end of Key's introduction).
    if (f.admiralty_board_open) {
      html += DIVIDER + '<div class="block"><div class="h4">The Notice Board</div><p class="small">' + esc(LA.boardBlurb) + "</p>";
      if (!f.a_wanted_man_done) html += '<div class="svc notice"><p class="sc">Wanted · by Order of the Admiralty of Avalon</p><p><b>Frederick Kane, called “Freddy Fearless”</b></p>' +
        '<p class="small">For piracy against the shipping of Avalon. A known associate of Amber Jack. Last seen near Ocracoke. Sails the <i>Deadly Delight</i>, a well-armed sloop.</p>' +
        '<p class="small"><b>1,500 gold alive · 750 gold dead</b></p><p class="small">Key\'s wax seal · Assigned to Captain ' + esc(state.captain.last) + ' · <span class="sc">Taken</span></p></div>';
      if (PC.bounties && PC.bounties.posting(state)) html += bountyCards();
      else html += '<p class="note">' + esc(LA.boardMore) + "</p>";
      html += "</div>";
    }
    return html;
  }

  // The notice board's generated notices (§17.4.8; M9 PR 3): parchment
  // cards with the silhouette ("Likeness unknown"), crimes, waters, ship,
  // reward and a status stamp; Take the bounty or Leave it.
  var STAMP = { open: "Open", taken: "Taken", captured: "Taken", collected: "Collected", deceased: "Deceased", expired: "Gone" };
  function bountyCards() {
    var Bn = PC.bounties, bd = Bn.board(state), BL = PC.data.bounties.lines, html = "";
    if (bd.fresh) html += '<p class="small"><i>' + esc(BL.fresh) + "</i></p>";
    if (bd.empty) html += '<p class="note">' + esc(BL.empty) + "</p>";
    html += bd.cards.map(function (n) {
      var w = PC.data.hunt.WATERS[n.waters].name;
      return '<div class="svc notice bountycard"><div class="bsil">' + sil(44, 60) + '<span class="small">Likeness unknown</span></div><div><p class="sc">Wanted · by Order of the Admiralty of Avalon</p><p><b>' + esc(n.name) + "</b></p>" +
        '<p class="small">For piracy near ' + esc(PC.world.placeName(n.port)) + ". Last seen in " + esc(w) + ". Sails the <i>" + esc(n.ship) + "</i>, a " + esc(n.cls.toLowerCase()) + ".</p>" +
        '<p class="small"><b>' + Bn.reward(state, n, "alive") + " gold alive · " + Bn.reward(state, n, "dead") + ' gold dead</b></p><p class="small"><span class="sc stamp s-' + n.status + '">' + esc(STAMP[n.status] || n.status) + "</span>" +
        (n.note ? " · " + esc(n.note) : "") + "</p>" +
        (n.status === "open" ? '<div class="actions"><button class="primary" data-act="bountytake" data-id="' + esc(n.id) + '">Take the bounty</button></div>' : "") + "</div></div>";
    }).join("");
    Bn.seen(state);
    return html;
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
    html += apprenticesOpt();
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
          (state.flags.nor_free_repair && N().here(state) === "norfolk" ? '<p class="note">Christoph owes you one repair: your next one here is free.</p>' : "") +
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
          // P10: fill every port the purse can pay for.
          (gunsMax > 1 ? '<button class="secondary" data-act="guns" data-qty-value="' + gunsMax + '">Buy max (' + gunsMax + ')</button> ' : "") +
          totalSlot(function () { var n = val("q-guns"); return plural(n, "gun") + " · " + gold(n * N().gunPrice(state)) + " gold"; }) + "</div>" : '<p class="note">You can\'t pay for a gun right now.</p>') + "</div>";
    }
    // The whole hold, clearly (A8 of the M5 playtest): what each ship adds,
    // what's used and what's free.
    var fl = (state.fleet || []).filter(function (f) { return !f.out; });
    html += '<div class="svc"><h4>The hold</h4>' + holdBarHtml(holdNow()) + '<table class="grid"><tr><th>Ship</th><th>Adds</th></tr>' +
      PC.crew.holdByShip(state).map(function (h) { return "<tr><td>" + (h.id === "flagship" ? "<i>" + esc(h.name) + "</i>, your flagship" : dirtyName(h.name, h.dirty) + ' <span class="note">' + esc(h.cls + " · " + (h.kind === "fleet" ? "fleet ship" : "prize ship")) + "</span>") + "</td><td>" + h.cargo + "</td></tr>"; }).join("") +
      "<tr><th>Total</th><th>" + PC.crew.holdCapacity(state) + " · " + PC.crew.slotsUsed(state) + " used, " + PC.crew.slotsFree(state) + " free</th></tr></table></div>";
    // Your other ships: sell a prize hull, or strip her guns (§22.7, Milestone 5).
    if (fl.length) {
      html += '<div class="svc"><h4>Your other ships</h4>' + fl.map(function (f) {
        var p = N().hullSalePrice(state, f);
        var room = state.ship.gunsMax - state.ship.guns;
        var hh = N().hullSaleHold(state, f.id);
        return '<div class="buyrow" style="flex-wrap:wrap"><span><b>' + dirtyName(f.name || f.cls, f.dirty) + '</b> <span class="note">' + esc(f.cls + " · " + (f.kind === "fleet" ? "fleet ship" : "prize ship") +
          " · hull " + Math.round(f.hull) + "/" + f.hullMax + " · " + f.guns + " guns · " + f.crew + " aboard") + "</span></span> " +
          (p.ok ? '<button class="secondary" data-act="sellhull" data-ship="' + esc(f.id) + '">Sell her · ' + gold(p.total) + " gold</button>" : '<span class="note">' + esc(p.why) + "</span>") +
          (f.guns && room > 0 ? '<button class="secondary" data-act="stripguns" data-ship="' + esc(f.id) + '">Move ' + Math.min(f.guns, room) + " guns to your flagship</button>" : "") +
          // Lay her up at anchor (§22.7): 10% up front, 3% a season.
          (function () {
            var lu = N().canLayUp(state, f.id), pr = lu.price || N().layUpPrice(state, f);
            return lu.ok ? '<button class="secondary" data-act="layup" data-ship="' + esc(f.id) + '">Lay her up · ' + gold(pr.up) + " gold, plus " + gold(pr.season) + " a season when you take her back</button>"
              : '<span class="note">Lay her up: ' + esc(lu.why) + "</span>";
          })() + "</div>" +
          (p.ok ? '<p class="note" style="margin:2px 0 8px">Hull ' + gold(p.hull) + (p.repair ? " (after " + gold(p.repair) + " of repairs)" : "") + (p.cut ? ", less " + gold(p.cut) + " to your letter's issuer" : "") + " + guns " + gold(p.guns) + ". Her hands come back aboard; any without a berth are paid off." +
            // Her effect on the hold (A9).
            " The hold goes from " + hh.capBefore + " to " + hh.capAfter + " (" + hh.used + " used)" + (hh.over ? '; <b style="color:#8f2a1c">' + hh.over + " slots won't fit and go over the side</b>" : "") + ".</p>" : "");
      }).join("") + "</div>";
    }
    // At anchor here (§22.7): take a laid-up ship back, 0 AP.
    var lu = N().laidUpHere(state);
    if (lu.length || fl.length) {
      html += '<div class="svc"><h4>At anchor here</h4><p class="small">Laid-up ships burn nothing, are safe from hurricanes and stay here until you take them back. ' +
        N().laidUpHere(state).length + " of " + N().layUpSlots(N().here(state)) + " berths used.</p>" +
        lu.map(function (l) {
          var r = N().canRecover(state, l.ship.id);
          return '<div class="buyrow" style="flex-wrap:wrap"><span><b>' + dirtyName(l.ship.name || l.ship.cls, l.ship.dirty) + '</b> <span class="note">' + esc(l.ship.cls + " · needs " + (l.ship.crewMin || 0) + " hands" + (l.owed ? " · anchorage so far " + l.owed + " gold, paid when you take her back" : "")) + "</span></span> " +
            (r.ok ? '<button class="secondary" data-act="recover" data-ship="' + esc(l.ship.id) + '">Take her back</button>' : '<span class="note">' + esc(r.why) + "</span>") + "</div>";
        }).join("") + "</div>";
    }
    html += "</div>" + DIVIDER;
    // Hands on the Docks (§24.7, §41.8)
    var avail = N().poolAvailable(state);
    var berths = PC.crew.berths(state);
    html += '<div class="block"><div class="h4">Hands on the Docks</div>' + sayFor("hands") + docksRollBlock();
    // Crew and room (P9 of the build 0.9 playtest pins): each ship's crew
    // against her berths, and the room left on the flagship.
    html += '<p class="small">' + ["<i>" + esc(sh.name) + "</i>: crew " + (state.crew.count + (state.crew.wounded || 0)) + " / max " + sh.crewMax + " (minimum " + (sh.crewMin || 0) + ")" + (state.crew.wounded ? ", " + state.crew.wounded + " of them wounded" : "")]
      .concat((state.fleet || []).filter(function (f) { return !f.out; }).map(function (f) { return esc(f.name || f.cls) + ": crew " + (f.crew || 0) + " / max " + (f.crewMax || f.crew || 0) + " (minimum " + (f.crewMin || 0) + ")"; })).join(" · ") +
      " · <b>Room for " + berths + " more</b>.</p>";
    var tiers = PC.data.economy.TIER_ORDER.filter(function (t) { return avail[t] || (N().season(state).pool[t]); });
    if (!tiers.length) html += '<p class="note">Nobody is looking for a berth.</p>';
    else {
      // Max fills only what the berths and crew gold leave after the other
      // tiers' numbers, so nobody is left on the docks (B34).
      tiers.forEach(function (t) {
        liveMax["q-hire-" + t] = function () {
          var b = berths, g = state.money.crew;
          tiers.forEach(function (u) { if (u !== t) { var n = val("q-hire-" + u); b -= n; g -= n * N().signingCost(state, u); } });
          return Math.max(0, Math.min(avail[t], b, Math.floor(g / N().signingCost(state, t) + 1e-9)));
        };
      });
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
        }, "") + "</button></div>" +
        // P9: what the food aboard feeds at the new crew size.
        '<p class="small">' + totalSlot(function () {
          var n = 0, ask = {};
          tiers.forEach(function (t) { ask[t] = val("q-hire-" + t); });
          var p = N().trimPlan(state, ask);
          tiers.forEach(function (t) { n += p[t]; });
          var heads = PC.world.headsAtSea(state) + n, ap = PC.world.apOfFood(state, heads);
          return "Provisions aboard: " + foodWords() + ", about " + (ap === 1 ? "1 action" : ap + " actions") + " at sea with " + heads + " aboard.";
        }) + "</p>";
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
    return html + "</div>" + nodeExtras("docks");
  }

  // ---- Optional rolls (§41.1): marked optional, every outcome stated ----

  // Haggle (§11.4 as changed by §41.13): once per merchant per season,
  // before the first trade there.
  function haggleBlock(npc) {
    var c = N().haggleCheck(state, npc), h = (N().season(state).haggle || {})[npc];
    if (h) {
      var pct = Math.round(Math.abs(N().HAGGLE[h]) * 100);
      // The result stands out as a result (the author's phone notes).
      return rbox(h, rollBadge(h, "Haggle") + '<p style="margin:0"><b>' + (N().HAGGLE[h] > 0 ? "You talked the prices down" : "The haggling went badly") + ":</b> prices " + pct + "% " +
        (N().HAGGLE[h] > 0 ? "in your favor" : "against you") + " here this season.</p>", "haggle:" + npc + ":" + h + ":" + PC.state.stamp(state), "haggled");
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
      return rbox(d.outcome, '<p class="small" style="margin:0"><b>Sized up the hands:</b> ' + esc(t) + ".</p>", null, "slim");
    }
    var c = N().docksRollCheck(state);
    if (!c.ok) return "";
    return opts([opt({ act: "docksroll", label: "Size up the hands (optional)",
      check: PC.checks.assess(state, N().docksCheck(state), { conditions: N().docksConditions(state) }),
      meta: "No action · once a visit, before you sign. Clean: a third of the hands you sign come a tier better. Setback: a third of the pool's Seasoned and Veteran hands are gone." })]);
  }

  // ---- Merchant (§41.9) ----

  // The hold as a stacked bar (§21.15; A6-A8 of the M5 playtest):
  // provisions, goods, treasure (five units a slot), then whatever is being
  // taken on (hatched), then the free space. extra: { slots, label } for
  // the cargo picker; cap overrides the capacity (a hull being kept).
  var HOLD_INK = { prov: "#8a6414", goods: "#5e4528", treasure: "#c99f45", dirtyT: "#7a2416", add: "#2f5a22", over: "#8f2a1c" };
  function holdBarHtml(o) {
    var per = PC.data.economy.TREASURE_PER_SLOT;
    var cap = o.cap, tSlots = Math.ceil(o.treasure / per), used = o.prov + o.goods + tSlots + (o.add || 0);
    var scale = Math.max(cap, used, 1);
    var seg = function (n, color, label, cls) { return n > 0 ? '<i class="' + (cls || "") + '" title="' + esc(label + ": " + n) + '" style="width:' + (100 * n / scale) + "%;background:" + color + '"></i>' : ""; };
    var tD = o.treasure ? tSlots * (o.treasureDirty || 0) / o.treasure : 0;
    var over = used - cap;
    return '<div class="holdbar">' + seg(o.prov, HOLD_INK.prov, "Provisions") + seg(o.goods, HOLD_INK.goods, "Goods") + seg(tSlots - tD, HOLD_INK.treasure, "Treasure") + seg(tD, HOLD_INK.dirtyT, "Dirty treasure") +
      seg(Math.min(o.add || 0, Math.max(0, cap - (used - (o.add || 0)))), HOLD_INK.add, o.addLabel || "Taking on", "new") + seg(Math.max(0, over), HOLD_INK.over, "Over the hold", "new") + "</div>" +
      '<div class="holdkey"><span><b style="background:' + HOLD_INK.prov + '"></b>Provisions ' + o.prov + "</span><span><b style=\"background:" + HOLD_INK.goods + '"></b>Goods ' + o.goods + "</span>" +
      '<span><b style="background:' + HOLD_INK.treasure + '"></b>Treasure ' + o.treasure + (o.treasureDirty ? " (" + o.treasureDirty + " dirty)" : "") + "</span>" +
      (o.add ? '<span><b class="new" style="background:' + HOLD_INK.add + '"></b>' + esc(o.addLabel || "Taking on") + " " + o.add + "</span>" : "") +
      "<span>Hold " + used + " of " + cap + " · " + (over > 0 ? '<i class="over">' + over + " over</i>" : Math.max(0, cap - used) + " free") + "</span></div>";
  }
  function holdNow() {
    return { cap: PC.crew.holdCapacity(state), prov: PC.crew.food(state), goods: PC.crew.goodsUnits(state), treasure: PC.crew.treasureUnits(state), treasureDirty: state.cargo.treasure.dirty || 0 };
  }
  function holdBar() {
    var manifest = [esc("Provisions: " + foodWords())].concat(Object.keys(state.cargo.goods).map(function (g) {
      var e = state.cargo.goods[g];
      return [e.clean ? esc(g) + ": " + e.clean : null, e.dirty ? dirtyName(g, true) + ": " + e.dirty : null].filter(Boolean).join(" · ");
    }).filter(Boolean), state.cargo.treasure.clean ? ["Treasure: " + state.cargo.treasure.clean] : [], state.cargo.treasure.dirty ? [dirtyName("Treasure", true) + ": " + state.cargo.treasure.dirty] : []);
    return '<details class="svc"><summary style="cursor:pointer;list-style:none">' + holdBarHtml(holdNow()) +
      ' <span class="note">tap for the manifest</span></summary><ul class="small">' + manifest.map(function (m) { return "<li>" + m + "</li>"; }).join("") + "</ul></details>";
  }

  // "12 lots".
  function foodWords() { return PC.crew.food(state) + " lots"; }

  // Provisions as time at sea, short form for the strip: "4½ actions".
  function seaTime(lots) {
    var a = lots * 5 / Math.max(1, state.crew.count + (state.crew.wounded || 0));
    var r = Math.floor(a * 2) / 2;
    var w = Math.floor(r) + (r % 1 ? "½" : "");
    if (w === "0½") w = "½";
    return w + " action" + (r === 1 ? "" : "s") + " at sea";
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
    // Every merchant here as a collapsed card; open one to trade (B46).
    var html = '<p class="note" style="max-width:680px">Open a merchant to trade.</p>' + holdBar() + mcard("m:prov", prov, "Provisioner");
    html += state.location.say && state.location.say.to === prov ? sayFor(prov) : '<div class="say">' + inline(g.line) + "</div>";
    if (!g.refuse) {
      var free = PC.crew.slotsFree(state);
      html += haggleBlock(prov);
      var pp = N().provisionsPrice(state);
      var provMax = Math.min(free, afford(pp));
      // Buy and Sell look different (Playtest Pins 0.8, #8): own sub-headings,
      // Buy filled and Sell outlined, "You pay" / "They pay", and what you'd
      // have after the trade.
      var onHand = function () { return state.money.crew + state.money.purse; };
      html += '<div class="svc"><h4>Provisions</h4><p class="small">One lot feeds 5 hands for an action at sea. Aboard: ' + esc(foodWords()) + ", " + timeAtSea(PC.crew.food(state)) + ".</p>" +
        '<h5 class="sc">Buy</h5><p class="small">You pay ' + gold(pp) + " gold each.</p>" +
        (free <= 0 ? '<p class="note">The hold is full.</p>' : provMax > 0 ? '<div class="buyrow">' + qstep("q-prov", Math.min(provMax, 10), provMax) + '<button class="primary" data-act="buyprov" data-for="q-prov">' +
          totalSlot(function () { return "Buy · " + gold(val("q-prov") * pp); }, "") + "</button></div>" +
          '<p class="small">' + totalSlot(function () { var n = val("q-prov"); return "After: " + (PC.crew.food(state) + n) + " lots aboard (" + timeAtSea(PC.crew.food(state) + n) + ") · " + gold(onHand() - n * pp) + " left (purse and crew gold together)"; }) + "</p>" : '<p class="note">You can\'t pay for a lot right now.</p>') +
        // R7: provisions sell back at half his price, out of his coffers.
        (state.provisions > 0 ? (function () {
          var sp = N().provisionsSellPrice(state), cl = N().provisionerCapLeft(state);
          var smax = Math.max(1, Math.min(state.provisions, sp > 0 ? Math.floor(cl / sp + 1e-9) : 0));
          return '<h5 class="sc" style="margin-top:10px">Sell</h5><p class="small">They pay ' + gold(sp) + " gold each.</p>" +
            '<div class="buyrow">' + qstep("q-sellprov", 1, smax) + '<button class="secondary outline" data-act="sellprov" data-for="q-sellprov"' + (cl < sp ? " disabled" : "") + ">" +
            totalSlot(function () { return "Sell · " + gold(val("q-sellprov") * sp); }, "") + "</button></div>" +
            '<p class="small">' + totalSlot(function () { var n = val("q-sellprov"); return "After: " + Math.max(0, PC.crew.food(state) - n) + " lots aboard · " + gold(onHand() + n * sp) + " left (purse and crew gold together)"; }) + "</p>";
        })() : "") + "</div>";
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
      // Dialogue options are buttons, never links (G5).
      if (hasCargo("dirty") && !said.offerdirty) html += opts([opt({ act: "offerdirty", label: "Offer dirty goods", meta: "No action" })]);
    }
    html += "</div></details>";
    html += tradeMasterCard();
    if (N().fenceOpen(state)) {
      var f = N().nodeData(id).fence;
      var fg = N().greeting(state, id, f.npc, "fence");
      html += mcard("m:fence", f.npc, "Fence") + '<div class="person">' + castFrame(f.npc).replace('class="castframe"', 'class="castframe" style="flex:0 0 100px"').replace(/width:150px/g, "width:100px") +
        '<div class="pmain">' +
        (state.location.say && state.location.say.to === f.npc ? sayFor(f.npc) : '<div class="say">' + inline(fg.line) + "</div>") + "</div></div>";
      if (!fg.refuse) {
        html += haggleBlock(f.npc) + sellTable("fence", "Sell dirty goods", N().fenceCapLeft(state), f.cap, "dirty");
        var talk = [];
        if (!state.flags.bobby_french_heard) talk.push(opt({ act: "askfrench", label: "Ask about the French", meta: "No action" }));
        if (hasCargo("clean") && !said.offerclean) talk.push(opt({ act: "offerclean", label: "Offer him clean goods", meta: "No action" }));
        if (talk.length) html += opts(talk);
      }
      html += "</div></details>";
    }
    return html;
  }

  // A merchant's card: the name card as its handle; open when the player
  // opened it, or when it holds the last thing said (B46).
  function mcard(key, npc, role) {
    var open = keepOpen[key] || (state.location.say && state.location.say.to === npc);
    if (open) keepOpen[key] = true;
    return '<details class="card2" data-keep="' + key + '"' + (open ? " open" : "") + '><summary>' + nameCard(npc, role).replace('class="namecard"', 'class="namecard" style="margin:0"') + CARET + '</summary><div class="inner">';
  }

  function hasCargo(kind) {
    if (state.cargo.treasure[kind]) return true;
    return Object.keys(state.cargo.goods).some(function (g) { return state.cargo.goods[g][kind]; });
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

  function sellTable(buyer, title, capLeft, cap, kind) {
    var rows = [];
    if (state.cargo.treasure[kind]) rows.push({ what: "treasure", html: dirtyName("Treasure", kind === "dirty"), have: state.cargo.treasure[kind] });
    Object.keys(state.cargo.goods).forEach(function (g) {
      var n = state.cargo.goods[g][kind];
      if (n) rows.push({ what: g, html: dirtyName(g, kind === "dirty"), have: n });
    });
    var who_ = PC.npcs.get(state, buyer === "fence" ? N().nodeData(N().here(state)).fence.npc : N().slotNpc(N().here(state), "provisioner"));
    var his = who_ && who_.gender === "f" ? "Her" : "His";
    // R6: this visit's running total, and Sell all he'll take.
    var sold = N().visitSales(state, buyer);
    var html = '<div class="svc"><h4>' + esc(title) + '</h4><p class="small">' + (buyer === "fence" ? "Buys dirty treasure and goods only." : "Buys clean treasure and goods only.") + " Sales go to crew gold.</p>" + coffers(capLeft, cap, his) +
      (sold ? '<p class="small"><b>This visit: +' + gold(sold - N().visitCut(state, buyer)) + " crew gold</b>" +
        // The issuer's cut, deducted at the till (§29.12).
        (N().visitCut(state, buyer) ? ' <span class="note">(after ' + gold(N().visitCut(state, buyer)) + " to " + esc(PC.letters.issuer(PC.letters.letter(state).issuer).name) + "'s cut)</span>" : "") + "</p>" : "") +
      (buyer !== "fence" && PC.letters.letter(state) ? '<p class="note">' + esc(PC.letters.issuer(PC.letters.letter(state).issuer).name) + " takes " + Math.round(PC.letters.issuer(PC.letters.letter(state).issuer).cut * 100) + "% of every clean sale.</p>" : "");
    if (!rows.length) return html + '<p class="note">Nothing aboard ' + (buyer === "fence" ? "for him" : "to sell here") + ".</p></div>";
    html += '<div class="actions" style="margin:4px 0 8px"><button class="secondary" data-act="sellall" data-buyer="' + buyer + '"' + (capLeft <= 0 ? " disabled" : "") + ">Sell all " + (his === "Her" ? "she" : "he") + "'ll take</button></div>";
    return html + '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Pays</th><th>Sell</th></tr>' + rows.map(function (r) {
      var id = "q-sell-" + buyer + "-" + slug(r.what);
      var price = N().unitPrice(state, buyer, r.what);
      var max = Math.max(1, Math.min(r.have, price > 0 ? Math.floor(capLeft / price + 1e-9) : r.have));
      return "<tr><td>" + r.html + (r.what !== "treasure" ? demandTag(r.what) : "") + "</td><td>" + r.have + "</td><td>" + gold(price) + "</td><td>" +
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
    // Ollie's Winter line, the first Graveyard visit each Winter (§42.8).
    if (state.location.ollieWinter) greet = PC.data.weather.lines.ollieWinter;
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
  // What a minigame roll is called in its result box (B22: "Size him up").
  var OP_NAME = { size: "Size him up", cheat: "The Cheat", grab: "Grab", quick: "Quick Dive", repair: "Repairs at sea", grapple: "The grapple", repel: "Repel boarders",
    chase: "The chase", show: "A show of force", position: "Position", strikeFirst: "Strike First", endure: "Hold on", drink: "Drink", strong: "The strong stuff", vote: "The vote" };
  // The latest move's lines, in the roll's color-coded box when a roll made
  // them (G4); the screen scrolls here (G1).
  // Battle text drops its PLACEHOLDER marks (#28 of the build 0.9 pins): the
  // author flags lines that don't work instead.
  function noPh(t) { return String(t || "").replace(/^PLACEHOLDER:\s*/, "").replace(/\[PLACEHOLDER\]\s*/g, ""); }

  // A check's name beside its line (3-19, 3-20 of the build 0.9 pins): no
  // leading "The" ("Clean Clash", not "Clean The clash"), and a strike roll
  // is just "Strike roll", so the tag stays on its line.
  function tagName(r) {
    var n = String(OP_NAME[r.op] || r.label || "");
    if (/^Strike roll/.test(n)) return "Strike roll";
    return n.replace(/^The (\w)/, function (m, c) { return c.toUpperCase(); });
  }

  // The hunt's result box (#24, #29, #30, #31): each line of text with the
  // check it came from beside it ("You fire your pistol, but the shot goes
  // wide. · ◆ Partial Marksmanship"); no header over the box and no roll list
  // under it; a big banner when she strikes.
  function huntLatest(lines, v) {
    var from = Math.min(mgMark, lines.length);
    var rs = (v.rollList || []).filter(function (r) { return r.logAt >= from && r.logAt <= lines.length; });
    var lr = v.lastRoll && v.lastRoll.logAt >= from && v.lastRoll.logAt <= lines.length ? v.lastRoll : null;
    var wb = v.winBanner && v.winBanner.at >= from && v.winBanner.at < lines.length ? v.winBanner : null;
    var hasLine = false;
    for (var k = from; k < lines.length; k++) if (lines[k]) hasLine = true;
    if (!hasLine && !rs.length && !lr && !wb) return "";
    var tag = function (r) {
      var o = OUTCOME[r.outcome];
      return ' <span class="rtag ' + (o ? o[1] : "t-mid") + '">· ' + shape(o ? o[1] : "t-mid") + esc(OUT_WORD[r.outcome] || r.outcome) + " " + esc(tagName(r)) + "</span>";
    };
    // A strike roll that ends the fight closes the list with its own short
    // line under the clash (3-21), whatever came before it (a refused demand).
    var strikeEnd = function (r) { return r.outcome === "clean" && /^(Strike roll|Call on her to strike)/.test(r.label || ""); };
    var byAt = {};
    rs.forEach(function (r) { (byAt[r.logAt] = byAt[r.logAt] || []).push(r); });
    var out = wb ? '<div class="winbanner">' + esc(PC.data.huntLines.winBanner[wb.how] || "She's yours!") + "</div>" : "";
    for (var i = from; i <= lines.length; i++) {
      var here = byAt[i] || [], line = i < lines.length ? lines[i] : null;
      if (wb && i === wb.at) { line = null; } // the banner says it
      if (line) out += "<p>" + inline(noPh(line)) + here.map(tag).join("") + "</p>";
      else here.forEach(function (r) {
        if (strikeEnd(r)) { out += "<p>She strikes her colors." + tag(r) + "</p>"; return; }
        out += '<p class="small">' + esc(tagName(r) + (r.effect ? ": " + r.effect : "")) + tag(r) + "</p>";
      });
    }
    if (lr && lr.chips && lr.chips.length) out += chips(lr.chips);
    var key = "mg:hunt:" + lines.length + ":" + (lr ? lr.seq : 0);
    return rbox(wb ? "clean" : lr ? lr.outcome : null, out, key, "mglatest" + (wb ? " won" : ""));
  }

  function mgLatest(lines, v) {
    if (v && v.kind === "hunt") return huntLatest(lines, v);
    var fresh = lines.slice(Math.min(mgMark, lines.length)).filter(function (l) { return l; });
    var lr = v && v.lastRoll && v.lastRoll.logAt >= mgMark && v.lastRoll.logAt <= lines.length ? v.lastRoll : null;
    if (!fresh.length && !lr) return "";
    var key = "mg:" + (v ? v.kind : "") + ":" + lines.length + ":" + (lr ? lr.seq : 0);
    var inner = (lr ? rollBadge(lr.outcome, OP_NAME[lr.op] || lr.type) : "") + fresh.map(function (l) { return prose(l); }).join("") + (lr && lr.chips && lr.chips.length ? chips(lr.chips) : "") +
      rollList(v, lines);
    return rbox(lr ? lr.outcome : null, inner, key, "mglatest");
  }
  // N4 (§37.12): in a battle, every roll since the player's last move, one
  // line each: the roll, the outcome word, and what it did.
  var OUT_WORD = { clean: "Clean", partial: "Partial", setback: "Setback" };
  function rollList(v, lines) {
    if (!v || v.kind !== "hunt") return "";
    var rs = (v.rollList || []).filter(function (r) { return r.logAt >= mgMark && r.logAt <= lines.length; });
    if (!rs.length) return "";
    return '<ul class="rolllist">' + rs.map(function (r) {
      var o = OUTCOME[r.outcome];
      return '<li><span class="tier ' + (o ? o[1] : "t-mid") + '">' + shape(o ? o[1] : "t-mid") + esc(OUT_WORD[r.outcome] || r.outcome) + "</span> " +
        "<b>" + esc(OP_NAME[r.op] || r.label) + "</b>" + (r.effect ? ": " + esc(r.effect) : "") + "</li>";
    }).join("") + "</ul>";
  }
  function mgLog(lines, hunt) {
    var old = lines.slice(0, Math.min(mgMark, lines.length)).slice(-6);
    return old.length ? '<div class="mglog">' + old.map(function (l) { return l ? prose(hunt ? noPh(l) : l) : "<hr>"; }).join("") + "</div>" : "";
  }

  function gpips(n, max, cls) {
    var out = "";
    for (var i = 0; i < max; i++) out += '<i class="' + (i < n ? "on" : "") + '" data-gpip="' + i + '"></i>';
    return '<span class="gpips ' + (cls || "") + '">' + out + "</span>";
  }

  function mgPending(p) {
    if (!p) return "";
    return '<p class="you-chose">' + esc(p.type) + "</p>" + rbox(p.outcome, badge(p.outcome) + diceLine(p.roll), "pend:" + p.type + ":" + (p.roll && p.roll.dice ? p.roll.dice.join(",") : "")) +
      '<div class="actions"><button class="secondary" data-act="mgreroll">Reroll (' + esc(p.reroll) + ')</button><button class="primary" data-act="mgaccept">Accept it</button></div>';
  }

  function mgHead(line, title) { return '<div class="where" data-land="head">' + esc(line) + '</div><h2 class="title">' + esc(title) + "</h2>"; }

  function tavernWhere() {
    var nd = state.location ? N().nodeData(N().here(state)) : null;
    var pl = nd && nd.present && nd.present.places.tavern;
    return nd ? nd.name + " · " + (pl ? pl.heading : "The Tavern") : "The Tavern";
  }

  function minigamePanel() {
    var v = PC.minigames.view(state);
    if (v.kind === "hunt") v.hunt = v; // the hunt's own view rides on the minigame view
    return '<div class="mg-' + v.kind + '">' + ({ dive: divePanel, drink: drinkPanel, dice: dicePanel, hunt: huntPanel })[v.kind](v) + "</div>";
  }

  // The dive (§41.10): the clickable wreck with Hull, Hold and Cabin.
  var ZONE_POS = { hull: "left:5%;top:44%;width:28%;height:40%", hold: "left:37%;top:52%;width:28%;height:38%", cabin: "left:68%;top:28%;width:27%;height:40%" };

  function divePanel(v) {
    var html = mgHead("Ocracoke · Lilyhook's Graveyard", v.title) +
      // P6: after a dive action the breath gauge lands at the top.
      '<div class="gauges" data-anchor="dive"><div class="gauge"><span class="lbl">Breath</span>' + gpips(v.breath, v.breathMax, "breath") + ' <span class="small">' + v.breath + " of " + v.breathMax + "</span></div></div>";
    if (!v.over && v.haul && v.haul.length) html += '<p class="small" style="margin:0 0 6px"><b>In your arms:</b> ' + v.haul.map(esc).join(", ") + "</p>";
    html += mgLatest(v.log, v);
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
      return html + '<p style="font-size:20px;margin:16px 0 10px">Where does the ' + gold(v.gold) + ' gold go?</p><div class="actions"><button class="primary" data-act="mgbank" data-pot="purse">Into your purse · ' + gold(v.gold) + "</button>" +
        '<button class="secondary" data-act="mgbank" data-pot="crew">Share it with the crew · ' + gold(v.gold) + "</button></div>";
    }
    if (v.beach) return html + beachPicker(v.beach);
    return html + '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Continue</button></div>';
  }

  // A full hold after a dive (ruled November 18): the player picks what
  // stays on the beach. Filled in with the default (cheapest goods, then
  // provisions, then treasure) to change as he likes.
  function beachPicker(bch) {
    var rows = [{ what: "provisions", label: "Provisions lots", n: state.provisions, dirty: false }];
    ["clean", "dirty"].forEach(function (k) { if (state.cargo.treasure[k]) rows.push({ what: "treasure", label: "Treasure", n: state.cargo.treasure[k], dirty: k === "dirty" }); });
    Object.keys(state.cargo.goods).forEach(function (g) {
      ["clean", "dirty"].forEach(function (k) { var n = state.cargo.goods[g][k]; if (n) rows.push({ what: g, label: g, n: n, dirty: k === "dirty" }); });
    });
    var planned = function (r) { var p = bch.plan.filter(function (x) { return x.what === r.what && !!x.dirty === r.dirty; })[0]; return p ? p.n : 0; };
    return '<div class="svc" data-result="beach"><h4>No room for it all</h4><p class="small">Your hold is ' + plural(bch.over, "slot") + " over. Choose what stays on the beach. Treasure packs five units to a slot.</p>" +
      '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Leave on the beach</th></tr>' + rows.map(function (r, i) {
        return "<tr><td>" + dirtyName(r.label, r.dirty) + "</td><td>" + r.n + "</td><td>" + (r.n ? qstep("q-beach-" + i, planned(r), r.n, 0) : "") +
          '<span hidden data-beach-row="' + i + '" data-what="' + esc(r.what) + '" data-dirty="' + (r.dirty ? 1 : 0) + '"></span></td></tr>';
      }).join("") + "</table>" +
      '<div class="actions"><button class="primary" data-act="beachleave">Leave these on the beach</button></div></div>';
  }
  var diveZone = null;
  var devForce = null; // the Developer panel's next sighting (Milestone 5)

  // Under the Table (§41.6): the hotspot table.
  function drinkPanel(v) {
    var html = mgHead(tavernWhere() + " · Under the Table", v.opponent) +
      '<p class="small">Round ' + v.round + " · the tab " + v.tab + " gold</p>" +
      '<div class="namecard"><b style="font-size:22px">' + esc(v.opponent) + '</b><span class="role">' + esc(v.role) + "</span>" + (v.trait ? '<span class="traits">' + esc(v.trait) + "</span>" : "") + "</div>" +
      '<div class="gauges"><div class="gauge"><span class="lbl">Your Wits</span>' + gpips(v.wits, v.witsMax) + "</div>" +
      '<div class="gauge"><span class="lbl">Him</span><span class="big">' + esc(v.state) + "</span>" + (v.tolerance ? '<span class="small"> · Tolerance ' + esc(v.tolerance) + "</span>" : "") + "</div></div>";
    html += mgLatest(v.log, v);
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

  function shipArtHtml(cls, faded, scale) {
    var art = PC.data.shipArt(cls), c = PC.data.hunt.CLASSES[cls] || { size: 1 };
    var w = Math.round((70 + c.size * 26) * (scale || 1));
    return art ? '<img class="shipart" src="' + assetUrl(art) + '" alt="' + esc(cls) + '" style="width:' + w + "px" + (faded ? ";opacity:.4" : "") + '">' : "";
  }

  // A raw-edge roll shown like a check (the Exchange): tier and odds.
  function rawCheck(type, edge, parts) {
    return { type: type, tier: PC.checks.tier(edge), odds: PC.checks.odds(edge), parts: parts || [], edge: edge, rawEdge: edge };
  }
  function chk(c) { return c ? PC.checks.assess(state, c, { conditions: ["Battle"].concat(c.cond || []) }) : null; }

  function qmSays(line, v) {
    if (!line) return "";
    var who = v.qm || "Your Quartermaster";
    return '<div class="qm"><b>' + esc(who) + ', Quartermaster:</b> ' + inline(noPh(PC.text.render(line, state))) + "</div>";
  }

  function huntStatus(v) {
    var bits = v.encounter ? ["A ship met on your voyage"] : ["Action " + v.apUsed + " of up to " + v.maxAp];
    if (v.batch) bits.push("sighting " + Math.min(v.batch.next, v.batch.n) + " of " + v.batch.n + " this action");
    bits.push("hold " + (v.holdMax - v.holdFree) + " of " + v.holdMax);
    if (v.prizesTaken) bits.push(plural(v.prizesTaken, "prize") + " taken");
    return '<p class="small" style="margin:0 0 8px">' + (v.condition ? wxBadge(v.condition) + " " : "") + esc(bits.join(" · ")) + "</p>";
  }

  // A weather word as a text badge (§42.10) until the art chat's icons.
  // The weather chip; hover (tap on a phone) says what it does (#43).
  function wxBadge(word, title) {
    if (!word || !PC.weather) return "";
    var fx = (PC.data.weather.EFFECTS || {})[word];
    return '<span class="wx wx-' + esc(String(word).toLowerCase()) + '" tabindex="0" title="' + esc((title ? title + ". " : "") + (fx || "The weather")) + '"' + (fx ? ' data-wxtip="' + esc(fx) + '"' : "") + ">" + esc(PC.weather.badge(word)) + "</span>";
  }

  // The scouting card (§22.3): only what a lookout could see. In Fog, only
  // her class until the battle opens (§42.4).
  function scoutCard(s, v) {
    if (v && v.condition === "Fog") {
      return '<div class="scout">' + shipArtHtml(s.cls) + '<div><h4 style="margin:0">A ' + esc(s.cls) + ' <span class="note">· half-seen in the fog</span></h4>' +
        '<p class="small" style="margin:4px 0"><i>The lookout: PLACEHOLDER: "Can\'t make out her colors in this murk, Captain."</i></p></div></div>';
    }
    var rows = [["Guns", s.guns + " (" + s.gunsRange + ")"], ["Crew", s.crewRange], ["Hull", s.hull],
      ["Speed", s.speed + " · " + s.handling], ["Draft", s.draft], ["Carries", s.lootTypes.join(", ")], ["Loot", s.loot]];
    return '<div class="scout">' + shipArtHtml(s.cls) + '<div>' + flagTag(s.flag, s.role, true) + '<h4 style="margin:0">' + (s.escort ? "Her escort: " : "") + dirtyName("A " + s.cls + (s.name ? ", the " + s.name : ""), s.flag !== "Pirate") + "</h4>" +
      '<table class="ledger">' + rows.map(function (r) { return lrow(r[0], esc(r[1])); }).join("") + "</table>" +
      '<p class="small" style="margin:4px 0"><i>The lookout: ' + esc(PC.text.render(s.cue, state).replace(/^PLACEHOLDER: /, "")) + "</i></p>" +
      '<p class="small" style="margin:0">' + esc(s.legit) + "</p>" +
      // M9 PR 3: an Admiralty bounty's target, or one of Deadman's French stragglers.
      (s.bounty ? '<p class="small" style="margin:4px 0 0"><b class="sc">Wanted</b> · ' + esc(s.bounty) + ", on the Admiralty's notice.</p>" : "") +
      (s.wanted ? '<p class="small" style="margin:4px 0 0"><b class="sc">Wanted</b> · ' + esc(s.wanted) + ", assigned to you by the Admiral.</p>" : "") +
      (s.rating != null ? '<p class="small" style="margin:4px 0 0">Key\'s Spyglass: her captain\'s rating is ' + s.rating + ".</p>" : "") +
      (s.french ? '<p class="small" style="margin:4px 0 0"><b class="sc">A French straggler</b> · Lieutenant Howe pays ' + PC.data.bounties.STRAGGLER_REWARD + " for her captain.</p>" : "") + "</div></div>";
  }

  function huntPanel(v) {
    var homeNd = N().nodeData(state.minigame.home || N().here(state));
    var homeLabel = homeNd.kind === "ocean" ? "Stop hunting" : "Sail home to " + homeNd.name;
    var H = v.hunt, html = mgHead(H.encounter ? "At sea · " + H.waters : (homeNd.kind === "ocean" ? homeNd.title : homeNd.name) + " · Hunting " + H.waters, H.phase === "battle" ? "Battle" : H.phase === "after" ? "After the Battle" : H.phase === "gameover" ? "Your Story Ends" : "Hunt for Prizes");
    if (H.phase === "gameover") return html + gameOverPanel(v);
    html += huntStatus(H);
    // In a battle the result sits under the two ships' stats, right above
    // the next choice (G3); elsewhere it leads the screen.
    if (H.phase === "battle") html += battleShips(H.battle);
    // After the battle, each step lands on its report (#48).
    if (H.phase === "after") html += '<div data-land="after"></div>';
    // 3-16: in a battle the Quartermaster's advice sits to the right of the
    // result box on a wide screen, so the ships and buttons stay in view.
    var latest = mgLatest(v.log, v);
    if (H.phase !== "battle" || v.pending) html += latest;
    if (v.pending) return html + mgPending(v.pending) + (H.phase === "battle" ? "" : mgLog(v.log, true));
    var home = H.encounter ? "" : H.canContinue.ok || H.phase === "batchEnd" ? '<button class="secondary" data-act="hhome">' + esc(homeLabel) + "</button>" + sailOnButtons() : "";
    if (H.phase === "encounterEnd") {
      html += '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Back to your voyage</button></div>';
    } else if (H.phase === "empty") {
      html += foodAtSea() + '<div class="actions"><button class="primary" data-act="hnext">Keep searching</button>' + home + "</div>";
    } else if (H.phase === "scout" || H.phase === "hunter") {
      var sv = H.scout;
      html += '<p class="sc" style="margin:8px 0 4px">' + (sv.ships.length > 1 ? (sv.shape === "convoy" ? "A convoy of " + sv.ships.length : "A merchant under escort") : "A sail") + " · " + caWord(sv.ca) + "</p>";
      // #9: the Quartermaster's advice sits beside the scouting card on a wide screen.
      html += '<div class="beside"><div class="bmain">' + sv.ships.map(function (s) { return scoutCard(s, H); }).join("") + "</div>" +
        '<div class="bside2">' + qmSays(H.advice, H) + "</div></div>";
      var war = sv.ships.some(function (s) { return s.warship; });
      if (war && sv.ca < 2 && !sv.hunter) html += '<p class="notice warn">☠ A warship at these odds will tear a ship your size apart. Let her go unless you mean it.</p>';
      html += sv.hunter ? '<div class="actions"><button class="primary" data-act="hhunter">Face her</button></div>' :
        '<div class="actions"><button class="primary" data-act="hengage">Engage</button><button class="secondary" data-act="hnext">Let her pass</button>' + home + "</div>";
    } else if (H.phase === "vote") {
      html += votePanel(H.vote);
    } else if (H.phase === "battle") {
      html += battlePanel(H.battle, H, latest);
    } else if (H.phase === "after") {
      html += afterPanel(H.after, H);
    } else if (H.phase === "batchEnd") {
      // Read Weather rolls itself (#38): only the next batch's weather shows.
      if (H.readAhead && H.readAhead.seen) html += '<p class="small">Next batch: ' + wxBadge(H.readAhead.seen) + (H.readAhead.rerolled ? ' <span class="note">(you wait out a storm)</span>' : "") + "</p>";
      html += '<p>The horizon is empty for now.</p>' + foodAtSea() + '<div class="actions">' +
        (H.apLeft >= 1 && H.apUsed < H.maxAp ? '<button class="primary" data-act="hmore" data-cost-ap="1">Keep hunting (1 action)</button>' : '<span class="note">' + esc(H.apLeft < 1 ? "No actions left this season." : "A hunt is at most three actions.") + "</span>") +
        '<button class="secondary" data-act="hhome">' + esc(homeLabel) + "</button>" + sailOnButtons() + "</div>";
    }
    // The log hides during a battle and comes back after it (#25).
    return html + (H.phase === "battle" ? "" : mgLog(v.log, true));
  }

  // ---- Voyage events (§44): the card at sea, or in port as you leave ----

  function eventPanel() {
    var v = PC.voyageEvents.view(state);
    if (!v) return '<div class="actions"><button class="primary" data-act="evnext">Continue</button></div>';
    var html = '<div class="where">' + esc(v.where) + "</div>" + banner(v.title.toLowerCase()) + '<h2 class="title">' + esc(v.title) + "</h2>";
    if (settings.dev) html += '<p class="note">' + esc((v.reg || "") + (v.slots ? " · slot " + v.slot + " of " + v.slots : "")) + "</p>";
    var cont = '<div class="actions"><button class="primary" data-top="1" data-act="evnext">Continue</button></div>';
    if (v.encounter) {
      html += '<div class="prose dropcap">' + prose(v.text) + "</div>";
      return html + '<div class="actions"><button class="primary" data-act="evmeet">' + (v.encounter === "hunter" ? "Face her" : "Close and look her over") + "</button>" +
        (v.encounter === "hunter" ? "" : '<button class="secondary" data-act="evpass">Let her pass</button>') + "</div>";
    }
    if (v.phase === "placeholder") return html + '<div class="prose dropcap">' + prose(v.text) + "</div>" + cont;
    if (v.phase === "vote") {
      html += '<div class="prose dropcap">' + prose(v.text) + "</div>";
      if (v.voteStep === "pre") {
        var bonus = PC.officers.speakBonus(state);
        return html + opts(v.candidates.map(function (c) { return opt({ act: "evvote", attrs: 'data-for-officer="' + esc(c.id) + '"', label: "Speak for " + c.name, meta: "Order · " + (bonus > 0 ? "+" + bonus : bonus) + " to the count" }); })
          .concat([opt({ act: "evvote", attrs: 'data-for-officer=""', label: "Stay out of it", meta: "The crew decide alone" })]));
      }
      if (v.voteStep === "result") return html + opts(v.reactions.map(function (r) { return opt({ act: "evreact", attrs: 'data-react="' + r.id + '"', label: r.label }); }));
      return html + DIVIDER + resultBits(v.result, false) + cont;
    }
    html += '<div class="prose' + (v.phase === "choose" ? " dropcap" : "") + '">' + prose(v.text) + "</div>";
    if (v.phase === "result") return html + DIVIDER + resultBits(v.result, false) + cont;
    return html + DIVIDER + opts(v.choices.map(function (c) {
      var check = c.check ? PC.checks.assess(state, c.check, { conditions: [] }) : null;
      return opt({ act: "evchoose", attrs: 'data-i="' + c.index + '"', label: c.label, check: check, lock: c.lock, meta: c.meta ? esc(c.meta) : null });
    }));
  }

  // The Developer's readout of the last voyage's slots (§44).
  function devReadout() {
    var rd = (state.voyage && state.voyage.readout) || state.world.lastReadout || [];
    if (!rd.length) return '<p class="note">No voyage yet.</p>';
    var pct = function (x) { return Math.round(100 * x) + "%"; };
    return '<ul class="small">' + rd.map(function (s) {
      if (s.forced) return "<li>Slot " + (s.i + 1) + ": forced " + esc(s.forced) + "</li>";
      var bits = [];
      if (s.roll != null) bits.push("fires " + (s.roll < s.chance ? "yes" : "no") + " (" + s.roll.toFixed(2) + " vs " + pct(s.chance) + ")");
      if (s.storm) bits.push("storm " + pct(s.storm.chance) + " rolled " + s.storm.roll.toFixed(2) + (s.storm.redraw != null ? ", redrawn " + s.storm.redraw.toFixed(2) : ""));
      if (s.hunter) bits.push("hunter " + pct(s.hunter.chance));
      if (s.ship) bits.push("other ship " + pct(s.ship.chance));
      if (s.officerChance != null) bits.push("officer " + pct(s.officerChance));
      if (s.weights) bits.push("pool of " + Object.keys(s.weights).length);
      bits.push(s.officer ? "→ " + s.officer : s.event ? "→ " + s.event : s.quiet ? "→ quiet" : "→ a ship");
      return "<li>Slot " + (s.i + 1) + ": " + esc(bits.join(" · ")) + "</li>";
    }).join("") + "</ul>";
  }

  // Sail on from the hunting grounds to another live place (§22.1).
  // #41 of the build 0.9 pins: before Keep hunting or Head home, what's
  // aboard to eat and what another action at sea will cost.
  function foodAtSea() {
    var heads = PC.world.headsAtSea(state), per = Math.ceil(heads / 5 * (PC.state.seasonName(state) === "Winter" ? 1.5 : 1));
    var food = PC.crew.food(state), left = Math.floor(food / Math.max(1, per));
    return '<div class="foodline' + (food < per ? " short" : left <= 1 ? " low" : "") + '"><b>Provisions ' + food + "</b> aboard · each action at sea eats about <b>" + per + "</b>" +
      (PC.state.seasonName(state) === "Winter" ? " (Winter)" : "") + " · enough for <b>" + (left === 1 ? "1 more action" : left + " more actions") + "</b>" +
      (food < per ? " · <b>not enough for another action: the crew go hungry</b>" : "") + "</div>";
  }

  function sailOnButtons() {
    var g = state.minigame;
    if (!g || g.kind !== "hunt") return "";
    return PC.hunt.sailOnOptions(state, g).map(function (o) {
      return '<button class="secondary" data-act="hsailon" data-dest="' + esc(o.id) + '"' + (o.ok ? ' data-cost-ap="' + o.cost + '"' : " disabled") + ' title="' + esc(o.ok ? "" : o.why) + '">Sail on to ' + esc(o.name) + " (" + plural(o.cost, "action") + ")</button>";
    }).join("");
  }

  // The Quartermaster's vote (§25.9, §25.15; A4 of the M5 playtest).
  function votePanel(vt) {
    if (!vt) return "";
    var aq = state.actingQM;
    if (vt.step === "pre") {
      var bonus = PC.officers.speakBonus(state);
      return '<div class="svc"><h4>The crew vote for a Quartermaster</h4><p class="small">' + (aq ? esc(aq.full) + " has held the seat since the post fell vacant. " : "") +
        "The officers aboard your flagship stand. You can speak for one of them (" + (bonus > 0 ? "+" + bonus : bonus) + " to their count with the crew " + esc(PC.crew.band(state.crew.morale)) + "), or stay out of it.</p></div>" +
        opts(vt.candidates.map(function (c) { return opt({ act: "hvote", attrs: 'data-for-officer="' + esc(c.id) + '"', label: "Speak for " + c.name, meta: "Order · " + (bonus > 0 ? "+" + bonus : bonus) + " to the count" }); })
          .concat([opt({ act: "hvote", attrs: 'data-for-officer=""', label: "Stay out of it", meta: "The crew decide alone" })]));
    }
    var R = PC.hunt.VOTE_REACT;
    return '<div class="svc"><h4>' + esc(vt.winner.name) + ' is your Quartermaster</h4><p class="small">' + vt.scores.map(function (x) { return esc(x.name) + " " + x.score; }).join(" · ") + "</p></div>" +
      opts(Object.keys(R).map(function (k) { return opt({ act: "hvotereact", attrs: 'data-react="' + k + '"', label: R[k][0] }); }));
  }

  // The flag (P6): a swatch, the nation in bold and the role in plain
  // words ("Pirate raider", "Avalon navy"). Never the color alone (§41.1).
  function flagTag(flag, role, big) {
    var H = PC.data.hunt, look = (H.FLAG_LOOK || {})[flag] || { color: "#5e4528", adj: flag || "Unknown" };
    var word = flag === "Pirate" ? "raider" : (H.ROLE_WORD || {})[role] || "";
    return '<span class="flagtag' + (big ? " big" : "") + '"><svg class="flag" viewBox="0 0 22 15" aria-hidden="true"><rect width="22" height="15" fill="' + look.color + '"/>' +
      (flag === "Pirate" ? '<circle cx="11" cy="6.5" r="2.6" fill="#efe3c6"/><path d="M6.5 11.5l9-3M6.5 8.5l9 3" stroke="#efe3c6" stroke-width="1.1"/>' : "") +
      "</svg><b>" + esc(look.adj) + "</b>" + (word ? " " + esc(word) : "") + "</span>";
  }

  function shipRow(s, enemy, target) {
    var hp = s.hullMax ? Math.max(0, Math.round(100 * s.hull / s.hullMax)) : 0;
    var outWord = { struck: "struck", captured: "taken", sunk: "sunk", escaped: "escaped", taken: "taken", left: "left behind" }[s.out] || "";
    // Prize ships don't fight (§21.8), so they're drawn smaller (#39).
    var prize = !enemy && s.kind === "prize";
    return '<div class="bship' + (s.out ? " out" : "") + (target ? " target" : "") + (prize ? " prizeship" : "") + '">' + shipArtHtml(s.cls, !!s.out, prize ? 0.55 : 1) +
      '<div>' + (enemy ? flagTag(s.flag, s.role) + " " : "") + '<b>' + dirtyName(s.name ? s.name : "A " + s.cls, enemy && s.flag && s.flag !== "Pirate") + '</b> <span class="note">' + esc(s.cls + (s.kind === "prize" ? " · prize" : "") + (s.escort ? " · escort" : "")) + "</span>" +
      (outWord ? ' <span class="badge-out">' + esc(outWord) + "</span>" : "") +
      '<div class="hbar" style="height:9px;max-width:200px;margin:3px 0"><i style="width:' + hp + "%;background:" + (hp < 50 ? "#8f2a1c" : "#5e4528") + '"></i></div>' +
      // Her full stats sit in a drop-down (A12); hull and her state stay in view.
      (enemy ? '<span class="small">Hull ' + s.hull + "/" + s.hullMax + (s.shaken ? ' · <span style="color:#8f2a1c">Shaken ' + s.shaken + "</span>" : "") + (s.leaderless ? ' · <span style="color:#8f2a1c">Leaderless</span>' : "") + "</span>" +
        '<details class="stats" data-keep="en:' + esc(s.id) + '"' + (keepOpen["en:" + s.id] ? " open" : "") + '><summary>Her stats</summary>Guns ' + s.guns + " · Crew " + s.crew + (s.speed != null ? " · Speed " + s.speed : "") + "</details>" :
        '<span class="small">Hull ' + s.hull + "/" + s.hullMax + " · Guns " + s.guns + " · Crew " + s.crew + (s.speed != null ? " · Speed " + s.speed : "") + "</span>") + "</div></div>";
  }

  function battleShips(b) {
    var html = '<div class="battle" data-land="battle"><div class="bside"><div class="h4">Your side</div>' + b.mine.map(function (s) { return shipRow(s, false, false); }).join("") + "</div>" +
      '<div class="bside"><div class="h4">Theirs' + (b.enemies[0] ? " · " + flagTag(b.enemies[0].flag, b.enemies[0].role) : "") + '</div>' + b.enemies.map(function (s) { return shipRow(s, true, s.id === b.target); }).join("") + "</div></div>";
    if (b.ca != null) html += '<p class="sc" style="margin:6px 0">' + (b.condition ? wxBadge(b.condition) + " " : "") + "Round " + Math.max(1, b.round) + " · the odds: " + caWord(b.ca) + (b.enemies.length > 1 ? " · whole fleet " + caWord(b.fleetCA) : "") + "</p>";
    return html;
  }

  // Battle decisions (#26 of the build 0.9 pins): the choices sit side by
  // side as strong buttons, one row (four make a 2×2), wrapping on a phone.
  function bopts(list) {
    list = list.filter(Boolean);
    return '<div class="bchoices n' + list.length + '">' + opts(list) + "</div>";
  }

  // Icons on the battle buttons (3-15, 3-18 of the build 0.9 pins). The
  // shots as ruled: round shot one ball, chain shot two balls on a chain,
  // grapeshot a cluster of three. The boarding actions' icons are Claude's
  // choice, for the author to tweak.
  var BI = function (body) { return '<svg class="bicon" viewBox="0 0 24 24" aria-hidden="true">' + body + "</svg>"; };
  var BICON = {
    "doExchange:round": BI('<circle cx="12" cy="12" r="7" fill="currentColor"/>'),
    "doExchange:chain": BI('<circle cx="5.5" cy="12" r="4" fill="currentColor"/><circle cx="18.5" cy="12" r="4" fill="currentColor"/><path d="M9.5 12h5" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1.6 1.2"/>'),
    "doExchange:grape": BI('<circle cx="8" cy="15" r="4" fill="currentColor"/><circle cx="16" cy="15" r="4" fill="currentColor"/><circle cx="12" cy="8" r="4" fill="currentColor"/>'),
    "doExchange:rigging": BI('<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2"/>'),
    "doExchange:rudder": BI('<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2"/>'),
    "doAction:lead": BI('<path d="M4 20L17 7M17 7l1-4 3 3-4 1M6 15l3 3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>'),
    "doAction:rally": BI('<path d="M6 21V3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 4h12l-3 4 3 4H7z" fill="currentColor"/>'),
    "doAction:hold": BI('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/>'),
    "doAction:duel": BI('<path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 9l6-6M15 21l6-6M21 9l-6-6M9 21l-6-6" stroke="currentColor" stroke-width="1.4" opacity=".6"/>'),
    "doAction:demand": BI('<path d="M6 21V3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 4h12v8H7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13v5M10.5 15.5L13 18l2.5-2.5" stroke="currentColor" stroke-width="1.8" fill="none"/>'),
  };

  function battlePanel(b, H, latest) {
    var html = "", qm = "";
    var B = function (fn, arg, label, cls, extra) { return '<button class="' + (cls || "secondary") + '" data-act="hb" data-fn="' + fn + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : "") + (extra || "") + ">" + label + "</button>"; };
    var O = function (fn, arg, label, check, meta, lock, extra) {
      var ic = BICON[fn + ":" + arg];
      return opt({ act: "hb", attrs: 'data-fn="' + fn + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : "") + (extra || ""), label: label, html: ic ? ic + inline(label) : null, check: check, meta: meta || null, lock: lock || null });
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
        html += bopts([O("showOfForce", "yes", "A show of force (optional)", chk(b.check), PC.combat.prizeRung(state) >= 2 ? "Sea Wolf. Clean or partial: +1 on the strike roll. A setback: no harm done." : "Prize Taker. Clean: +1 on the strike roll. Anything else: no harm done."), O("showOfForce", "no", "Just call on her to strike", null, "No roll")]);
        break;
      case "hunterChoice":
        qm = qmSays(A.hunter, H); html += bopts([O("hunterChoice", "fight", "Fight her", null, "She won't strike or run before the battle."),
          O("hunterChoice", "flee", "Run for it", chk({ type: "Outrun", dr: en ? 3 : 3 }), "Morale −15. Clean: escaped. Partial: escaped with a parting hit. Setback: she catches you, +1 to her Position.")]);
        break;
      case "chase": case "press":
        var fleeing = b.chaseMode === "flee";
        html += b.step === "press" ? '<p>She\'s pulling away. You\'re faster: you can keep after her, giving up your next sighting this action.</p>' + '<div class="actions">' + B("press", "yes", "Press the chase", "primary") + B("press", "no", "Let her go") + "</div>" :
          bopts([O("doChase", null, fleeing ? "Run for it" : "Give chase", chk(b.check), fleeing ? "Clean: escaped. Partial: escaped, with a parting hit. Setback: caught; she gets +1 to Position." : "Clean: caught, +1 to your first Position. Partial: caught. Setback: she gets away (unless you're faster and press the chase).")]);
        break;
      case "position":
        html += bopts([O("doPosition", null, "Work for position", chk(b.check), "Maneuver against her captain. Clean lets you Rake, Close or Open the range; partial +1 on the Exchange, setback −1.")]);
        break;
      case "posChoice":
        html += '<p class="sc">You have the position. What now?</p>' + bopts([
          O("choosePosition", "rake", "Rake her", null, "+2 on this round's Exchange."),
          O("choosePosition", "close", "Close for boarding", chk(b.grappleCheck), "Skip the Exchange: the grapple rolls at once, +1."),
          O("choosePosition", "open", "Open the range", null, "Your next attempt to flee needs no roll.")]);
        break;
      case "exchange":
        var ex = b.exchange, rc = rawCheck("Exchange", ex.edge, ex.parts);
        var shots = [["round", "Round shot", "Full damage. Sink or cripple her."], ["chain", "Chain shot", "Half damage; a heavy hit costs her 1 Speed. Stops a runner."], ["grape", "Grapeshot", "Quarter damage, double crew losses. Thins her crew before boarding and keeps the prize whole."]];
        if (b.gunnersEye) { shots.push(["rigging", "Called shot: her rigging", "Gunner's Eye. Half damage; a heavy hit costs her 1 Speed."]); shots.push(["rudder", "Called shot: her rudder", "Gunner's Eye. Half damage; a heavy hit costs her −1 on her next Position."]); }
        html += '<p class="sc" style="margin:4px 0">The Exchange · pick your shot</p>' + bopts(shots.map(function (x) { return O("doExchange", x[0], x[1], rc, x[2]); }));
        qm = qmSays(me && en && me.crew >= 0.75 * en.crew ? A.grape : en && en.speed >= me.speed ? A.chain : A.fire, H);
        break;
      case "decision":
        var hurt = me.hull < 0.6 * me.hullMax;
        qm = qmSays(hurt ? A.run : me.crew >= 0.75 * (en ? en.crew : 1) ? A.board : A.fire, H); html += bopts([
          O("decide", "fire", "Fire again", null, "A new round, starting with Position."),
          O("decide", "board", "Board her", chk(b.grappleCheck), "The grapple rolls at once. Clean: you're aboard. Partial: aboard, but she sweeps your deck with grape. Setback: they cut your grapples. Then up to three clashes."),
          O("decide", "flee", "Break off and run", null, "Morale −15. " + (b.openRange ? "You opened the range: no roll needed." : "A chase: Outrun."))]) +
          // Strike your colors sits apart, smaller and muted: it ends the game (#26).
          '<div class="bstrike">' + opts([O("decide", "strike", "Strike your colors", null, "The battle is lost, and your story ends here.")]) + "</div>";
        break;
      case "grapple":
        html += bopts([O("doGrapple", null, "Grapple her", chk(b.check), "Clean: you're aboard. Partial: aboard, but she sweeps your deck with grape. Setback: they cut your grapples.")]);
        break;
      case "repel":
        html += '<p class="notice">She\'s coming alongside to board you.</p>' + bopts([O("doRepel", null, "Repel boarders", chk(b.check), "Clean: cut her grapples and rake her as she sheers off. Partial: they're aboard, but pay for it. Setback: they're aboard.")]);
        break;
      case "clash":
        var bd = b.board || {};
        html += '<p class="sc" style="margin:4px 0">' + (bd.meBoarding ? "On her deck" : "On your deck") + " · clash " + (bd.clash + 1) + " of 3" + (bd.sf && bd.clash === 0 ? " · " + esc(PC.data.huntLines.strikeFirst[bd.sf]) : "") + "</p>" +
          bopts(b.actions.map(function (a) { return O("doAction", a.id, a.label, chk(a.check), a.note, a.lock); }));
        break;
      case "grenade":
        html += '<p class="sc" style="margin:4px 0">' + (b.board && b.board.meBoarding ? "Boarding her" : "She's boarding you") + "</p>" + bopts([
          O("grenade", "yes", "Throw a blackpowder grenade", null, "You win Strike First and one more of them falls. You have " + PC.items.count(state, "Blackpowder Grenade") + "."),
          O("grenade", "no", "Keep it", chk({ type: "Strike First", dr: Math.max(0, Math.min(8, en ? en.rating : 0)) }), "Roll Strike First as usual.")]);
        break;
      case "retarget":
        html += '<p class="sc">Your target is out of the fight. Who next?</p><div class="actions">' + b.enemies.filter(function (e) { return !e.out; }).map(function (e) { return B("retarget", e.id, esc(e.name || e.cls)); }).join("") + "</div>";
        break;
      case "endure":
        html += bopts([O("doEndure", null, "Hold on", chk(b.check), "Endure, as your ship goes down.")]);
        break;
    }
    if (state.settings.showDice && b.lastExchange) html += '<div class="dice">Last Exchange: dice ' + b.lastExchange.dice.join(" + ") + ", edge " + signed(b.lastExchange.edge) + " · " + b.lastExchange.outcome + "</div>";
    if (state.settings.showDice && b.lastClash) html += '<div class="dice">Last clash: dice ' + b.lastClash.dice.join(" + ") + ", edge " + signed(b.lastClash.edge) + " · " + b.lastClash.outcome + "</div>";
    latest = latest || "";
    if (qm) return (latest ? '<div class="beside bres"><div class="bmain">' + latest + '</div><div class="bside2">' + qm + "</div></div>" : qm) + html;
    return latest + html;
  }

  // After the battle (§21.15, §22.7; A7, A10, A11 of the M5 playtest).
  // The battle's own chips (the dead, the wounded, seasoning) show once, on
  // the first screen after it; repairs at sea show in their roll's box.
  function afterPanel(a, H) {
    var html = a.battleChips && a.battleChips.length ? '<div class="h4" style="max-width:680px">The battle</div>' + chips(a.battleChips) : "";
    if (!a.repairDone) {
      return html + opts([opt({ act: "hrepair", label: "Repairs at sea", check: chk(a.repairCheck), meta: (function () { var sh = PC.hunt.repairShares(state); return "Repair & Refit on the " + Math.round(a.hpLost) + " hull lost. Clean restores " + Math.round(sh.clean * 100) + "% of it, partial " + Math.round(sh.partial * 100) + "%."; })() })]);
    }
    if (a.prize) return html + prizeCard(a.prize, a);
    // The summary: every ship taken, one line a good or effect.
    html += '<div class="h4" style="max-width:680px">' + (a.names.length ? "What you took" : "After the fight") + "</div>";
    if (a.names.length) html += '<p class="small" style="margin:0 0 6px">' + esc(a.names.map(function (n) { return n.charAt(0).toUpperCase() + n.slice(1); }).join(", ")) + ".</p>";
    if (a.taken.length) html += '<p class="small" style="margin:0 0 6px"><b>Into the hold:</b> ' + a.taken.map(function (t) { return t.n + " " + dirtyName(t.what, t.dirty); }).join(", ") + "</p>";
    html += chips(a.summary) + holdBarHtml(holdNow());
    return html + '<div class="actions"><button class="primary" data-act="hcarry" data-top="1">Back to the hunt</button></div>';
  }

  // One struck ship, settled on one screen: her cargo (pick what to take,
  // watching the hold fill), her hull, her crew, her captives (A7, A11).
  var pickRows = [];
  function prizeCard(p, a) {
    pickRows = [];
    var title = p.name ? "The " + p.name : "A " + p.cls;
    var html = '<div class="svc prize"><h4 style="margin:0">' + dirtyName(title, p.dirty) + ' <span class="note">· ' + esc(p.flag + " " + p.cls + " · " + p.level) + "</span>" + (a.left ? ' <span class="note">· ' + a.left + " more to settle</span>" : "") + "</h4>" +
      (p.captain ? '<p class="small" style="margin:2px 0 8px">' + esc((p.title ? p.title + " " : "") + p.captain) + " hands over her papers. Her ship's chest holds " + gold(p.chest) + " gold.</p>" : '<p class="small" style="margin:2px 0 8px">Her ship\'s chest holds ' + gold(p.chest) + " gold.</p>");
    // Her cargo: what she carries, with steppers; defaults fill the free
    // space densest first, as before.
    var free = PC.crew.slotsFree(state), per = p.hold.per;
    var tRoom = PC.crew.treasureRoom(state);
    var rows = [];
    if (p.treasure) { var t0 = Math.min(p.treasure, tRoom); rows.push({ what: "treasure", label: "Treasure", have: p.treasure, def: t0 }); free -= Math.ceil((p.hold.treasure + t0) / per) - Math.ceil(p.hold.treasure / per); }
    Object.keys(p.goods).sort(function (x, y) { return PC.data.goods[y].base - PC.data.goods[x].base; }).forEach(function (g) {
      var d = Math.max(0, Math.min(p.goods[g], free)); free -= d; rows.push({ what: g, label: g, have: p.goods[g], def: d });
    });
    if (p.provisions) { var d = Math.max(0, Math.min(p.provisions, free)); free -= d; rows.push({ what: "provisions", label: "Provisions", have: p.provisions, def: d }); }
    if (rows.length) {
      html += '<div class="h4">Her cargo</div><table class="grid pickrow"><tr><th>Cargo</th><th>She carries</th><th>Take</th></tr>' + rows.map(function (r, i) {
        var id = "pk-" + i;
        pickRows.push({ id: id, what: r.what });
        return "<tr><td>" + dirtyName(r.label, p.dirty && r.what !== "provisions") + (r.what === "treasure" ? ' <span class="note">(five to a slot)</span>' : "") + "</td><td>" + r.have + "</td><td>" + qstep(id, r.def, r.have, 0, true) + "</td></tr>";
      }).join("") + "</table>" +
        // #35: everything she carries in one tap (what won't fit stays in her hold, and the bar says so).
        (rows.length > 1 ? '<div class="actions" style="margin:4px 0 6px"><button type="button" class="secondary maxbtn" data-takeall="' + rows.map(function (r, i) { return "pk-" + i; }).join(" ") + '">Take all</button></div>' : "");
      html += totalSlot(function () { return pickBar(p); }, "") + (p.dirty ? '<p class="note" style="margin:2px 0 6px">' + dirtyName("Dirty", true) + ": no letter covers her, so only a fence will buy her cargo.</p>" : "");
    } else html += '<p class="small">Nothing in her hold worth taking.</p>';
    var radio = function (name, val, label, note, lock, on) {
      return '<label class="pick' + (lock ? " locked" : "") + '"><input type="radio" name="' + name + '" value="' + esc(val) + '"' + (on ? " checked" : "") + (lock ? " disabled" : "") + "> <b>" + esc(label) + "</b>" +
        (note || lock ? '<span class="note"> · ' + esc(lock || note) + "</span>" : "") + "</label>";
    };
    html += '<div class="h4">Her hull</div>' + p.hullOptions.map(function (o) {
      var off = o.id === "fleet" && !o.lock && o.officers.length ? ' <select class="hofficer">' + o.officers.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name + " (" + x.type + ")") + "</option>"; }).join("") + "</select>" : "";
      // #46: which prize she replaces, and what becomes of the old one.
      if (o.id === "replace" && !o.lock) off = '<div class="swaprow small">In place of <select class="hreplace">' + o.olds.map(function (x) {
          return '<option value="' + esc(x.id) + '"' + (x.lock ? " disabled" : "") + ">" + esc(x.name + " · crew " + x.crew + " · hold " + x.cargo + (x.over ? " · " + x.over + " would go over the side" : "") + (x.lock ? " · " + x.lock : "")) + "</option>";
        }).join("") + '</select> · then <label><input type="radio" name="h-oldfate" value="release" checked> let her go</label> <label><input type="radio" name="h-oldfate" value="scuttle"> scuttle her</label>' +
        (o.olds.some(function (x) { return x.over; }) ? '<p class="notice warn" style="margin:4px 0">Her hold is smaller than the one she replaces: what no longer fits goes over the side.</p>' : "") + "</div>";
      return radio("h-hull", o.id, o.label, o.addsHold && !o.lock ? "her hold adds " + o.addsHold + " · " + o.note : o.note, o.lock, o.id === "release") + off;
    }).join("");
    html += '<div class="h4">Her crew (' + p.crew + ")</div>" +
      radio("h-crew", "release", "Release them", null, null, true) +
      radio("h-crew", "recruit", "Recruit the willing", p.volunteers ? p.volunteers + " " + p.volTier + " hands want to sign on" : null, p.volunteers ? null : "Nobody wants to", false) +
      radio("h-crew", "execute", "Execute them", "No Heat, Dread +3" + (p.execute.legal ? "" : ". " + p.execute.why), null, false);
    // Her captain (§17.4.8, §17.4.4): a bounty target or a French straggler.
    if (p.captainFate) html += '<div class="h4">Her captain, ' + esc(p.captainFate.name || "") + "</div>" + '<p class="small" style="margin:0 0 4px">' + inline(p.captainFate.setup) + "</p>" +
      p.captainFate.options.map(function (o, i) { return radio("h-capt", o.id, o.label, o.note, null, i === 0); }).join("");
    if (p.captives) html += '<div class="h4">' + plural(p.captives, "captive") + " aboard her</div>" +
      radio("h-cap", "free", "Take them aboard to free them", "Freed at a free port for a reward", null, true) +
      radio("h-cap", "recruit", "Recruit the willing", "Half join as Green hands", null, false) +
      radio("h-cap", "leave", "Leave them with her", null, null, false);
    return html + '<div class="actions"><button class="primary" data-act="hprize">Settle her</button></div></div>';
  }

  // The stacked hold bar on the prize screen, live as the steppers and her
  // hull choice move (A7, B42).
  function pickBar(p) {
    var h = p.hold, add = 0, tPick = 0;
    pickRows.forEach(function (r) { var n = val(r.id); if (r.what === "treasure") tPick = n; else add += n; });
    var tAdd = Math.ceil((h.treasure + tPick) / h.per) - Math.ceil(h.treasure / h.per);
    var hullSel = document.querySelector('input[name="h-hull"]:checked');
    var opt = hullSel ? p.hullOptions.filter(function (o) { return o.id === hullSel.value; })[0] : null;
    var cap = h.cap + (opt ? opt.addsHold || 0 : 0);
    var used = h.provisions + h.goods + Math.ceil(h.treasure / h.per) + add + tAdd;
    return holdBarHtml({ cap: cap, prov: h.provisions, goods: h.goods, treasure: h.treasure, treasureDirty: state.cargo.treasure.dirty || 0, add: add + tAdd, addLabel: "Taking on" }) +
      (used > cap ? '<p class="notice warn" style="margin:4px 0">That\'s ' + (used - cap) + " more than the hold takes: what doesn't fit stays in her hold." + (p.hullOptions.some(function (o) { return o.addsHold && !o.lock; }) ? " Keeping her hull adds her hold to yours." : "") + "</p>" : "");
  }

  function gameOverPanel(v) {
    var go = v.hunt.gameOver || {};
    if (go.how === "captured" && PC.prison) return '<div class="prose dropcap">' + prose(PC.data.prison.lines.capturedSea) + "</div>" +
      '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Continue</button></div>';
    return '<div class="prose dropcap">' + prose(PC.data.huntLines.gameOver[go.how === "died" ? "died" : "captured"]) + "</div>" +
      '<div class="actions"><button class="primary" data-act="endgameover">See how it ended</button></div>';
  }

  // Liar's Dice (§41.6): drawn dice, cups, a bid stepper and tappable faces.
  var PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  function die(n, cls) {
    if (!n) return '<svg class="die ' + (cls || "") + '" viewBox="0 0 100 100" aria-label="A hidden die"><path d="M18 88L28 22Q50 10 72 22L82 88Z" fill="#5e4528" stroke="#2a1c10" stroke-width="3"/><ellipse cx="50" cy="88" rx="32" ry="7" fill="#4a3418"/></svg>';
    return '<svg class="die ' + (cls || "") + '" viewBox="0 0 100 100" aria-label="' + n + '"><rect x="6" y="6" width="88" height="88" rx="16" fill="#f3e9cf" stroke="#2a1c10" stroke-width="4"/>' +
      PIPS[n].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#2a1c10"/>'; }).join("") + "</svg>";
  }

  function dicePanel(v) {
    // The opponent's name card, smaller (B20).
    var html = '<div class="where">' + esc(tavernWhere()) + ' · Liar\'s Dice</div><h2 class="title smallname">' + esc(v.opponent) + "</h2>";
    // No cap on games a sitting (B21): games played and the running tally.
    var board = '<div class="scoreboard"><p class="sc" style="margin:0 0 4px">The scoreboard</p>' + plural(v.games, "game") + " played<br>Won " + v.won + " · lost " + v.lost +
      "<br>Net " + (v.net >= 0 ? "+" : "−") + Math.abs(v.net) + " gold<br>Your purse " + gold(v.purse) + "</div>";
    if (v.pending) return html + mgLog(v.log) + mgPending(v.pending);
    var g = v.round;
    if (!g) {
      html += '<div class="dicetable"><div class="felt"><span class="framelabel" style="position:static">Woodcut · the dice table, top-down · 16 : 10 · 1600 × 1000</span></div>' + board + "</div>" + mgLatest(v.log, v) + mgLog(v.log);
      if (v.over) return html + '<div class="actions"><button class="primary" data-top="1" data-act="mgleave">Leave the table</button></div>';
      var list = [];
      if (v.canSize) list.push(opt({ act: "mgsize", label: "Size him up", check: v.sizeAssess, meta: "Once a sitting" }));
      html += opts(list);
      if (v.canStart) {
        // The stake stepper moves in fives (B24).
        var smax = Math.min(v.stakes[1], Math.floor(v.purse));
        smax = v.stakes[0] + Math.floor((smax - v.stakes[0]) / v.stakeStep) * v.stakeStep;
        html += '<div class="svc"><h4>The stake</h4><div class="buyrow">' + qstep("q-stake", v.stakes[0], smax, v.stakes[0], false, v.stakeStep) +
          '<button class="primary" data-act="mgstake" data-for="q-stake">Play a game</button></div><p class="note">Stake ' + v.stakes[0] + "-" + v.stakes[1] + " gold from your purse; the winner takes both stakes.</p></div>";
      }
      return html + '<div class="actions"><button class="secondary" data-act="mgstop" data-top="1">Leave the table</button></div>';
    }
    var bidHtml = g.bid ? '<span class="bidbox">' + g.bid.q + " × " + die(g.bid.f, "sm") + "</span>" : '<span class="bidbox" style="font-size:18px">You open the bidding</span>';
    html += '<div class="dicetable"><div class="felt"><div class="cupsrow">' + g.his.map(function (d) { return die(d); }).join("") + '</div><div style="text-align:center">' + bidHtml +
      '<div class="small" style="margin-top:4px">' + g.total + " dice on the table</div></div>" +
      '<div class="cupsrow">' + g.mine.map(function (d) { return die(d); }).join("") + "</div></div>" + board + "</div>";
    if (g.history.length) html += '<div class="mglog">' + g.history.slice(-6).map(function (h) { return "<p>" + esc(h) + "</p>"; }).join("") + "</div>";
    if (g.over) {
      return html + '<p class="notice" data-result="dice-end:' + v.games + '">' + (g.caught ? (g.caughtWhy === "marks" ? "Second mark: he's had enough. " : "Setback: he saw it. ") + "Caught cheating: the pot is his, and the pirates think less of you." : g.won ? "You take the pot: " + g.stake * 2 + " gold." : "He takes the pot.") + "</p>" +
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
    // Cheating, made clear (B25): what each outcome does, and the marks.
    var marks = v.marks || 0;
    var susp = '<span class="susp" title="Suspicion: ' + marks + ' of 2 marks. Two and you\'re caught.">' + [0, 1].map(function (i) { return '<i class="' + (i < marks ? "on" : "") + '"></i>'; }).join("") + "</span>";
    if (!g.cheated) {
      html += '<details class="svc"><summary class="sc" style="cursor:pointer;color:#5e4528">Cheat: peek under his cup (once a game) · suspicion ' + susp + " " + marks + " of 2</summary>" +
        opts([opt({ act: "nop", label: "Peek at a die", check: v.cheatAssess, meta: "Clean: you see the die, and he's none the wiser. Partial: you see it, but he's suspicious: a suspicion mark (two marks and you're caught). Setback: caught at once: the pot and Standing with the pirates are lost." })]) +
        '<div class="actions">' + g.his.map(function (d, i) { return '<button class="secondary" data-act="mgcheat" data-i="' + i + '">Die ' + (i + 1) + "</button>"; }).join("") + "</div></details>";
    } else if (marks) html += '<p class="small">Suspicion ' + susp + " " + marks + " of 2: one more mark and you're caught.</p>";
    // Leaving mid-game forfeits the stake: a warning first (B26, G7).
    html += '<div class="actions"><button class="secondary" data-act="mgstop" data-midgame="1">Leave the table</button></div>';
    return html;
  }

  // ---- The Ship (§41.11) ----

  var SHIP_TABS = [["articles", "Articles"], ["crew", "Crew"], ["fleet", "Fleet"], ["officers", "Officers"], ["cargo", "Cargo"], ["cabin", "Your Cabin"]];

  // The Ship as a menu over any screen (A1, B27). In a battle it can be
  // read but nothing changes; away from port (a scene, a minigame, the
  // hunt) the actions that cost an action wait for port; the free ones
  // work (A3: free whenever no battle is being fought).
  function inBattle() { var g = state.minigame; return !!(g && state.current.screen === "minigame" && g.kind === "hunt" && g.phase === "battle"); }
  function shipLock(costsAP) {
    if (!state.location) return "Only in port";
    if (inBattle()) return "Not during a battle";
    if (costsAP && state.current.screen !== "node") return "Only in port";
    return null;
  }
  function lockAttr(lock) { return lock ? ' disabled title="' + esc(lock) + '"' : ""; }
  function menuShip() {
    if (!state.location) return "<h2>The Ship</h2><p class=\"note\">Only in port.</p>";
    if (state.shipless || state.jail) return "<h2>The Ship</h2><p class=\"note\">" + (state.jail ? "You're in no position to give orders." : "You have no ship.") + "</p>";
    var lock = shipLock(false);
    return "<h2>The Ship</h2>" + '<p class="note" style="margin:0 0 8px"><i>' + esc(state.ship.name) + "</i>, your " + esc(state.ship.type.toLowerCase()) +
      (lock ? " · " + esc(lock) + ": you can look, but nothing changes." : state.current.screen !== "node" ? " · Away from port: what takes an action waits until you're back." : "") + "</p>" + shipMenu();
  }

  function shipMenu() {
    var tab = state.location.tab || (state.articles ? "crew" : "articles");
    var html = '<div class="tabs">' + SHIP_TABS.map(function (t) {
      return '<button data-act="shiptab" data-tab="' + t[0] + '" class="menubtn' + (t[0] === tab ? " on" : "") + '">' + t[1] + "</button>";
    }).join("") + "</div>" + barkHtml() + sayFor("ship");
    return html + ({ articles: articlesTab, crew: crewTab, fleet: fleetTab, officers: officersTab, cargo: cargoTab, cabin: cabinTab })[tab]();
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
    var html = signed_ ? '<p class="small">Signed ' + esc(PC.state.SEASONS[state.articles.signed.season]) + " " + state.articles.signed.year + ".</p>" + sayFor("ship:articles") :
      '<div class="prose dropcap">' + prose(PC.data.firstSigning) + "</div>" +
      '<p class="small">You set the terms; the crew holds you to every word. The Standard terms are fair. Signing costs no action.</p>';
    html += A.SLOTS.map(function (s) {
      return '<div class="svc"><h4 style="margin-bottom:0">' + esc(s.name) + '</h4><p class="note" style="margin:0 0 6px">' + esc(PURPOSE[s.id] || "") +
        (s.noGreed ? " No Greed · change any time." : "") + '</p><div class="opts">' + s.options.map(function (o) {
          var on = terms[s.id] === o.id;
          var c = signed_ && !on ? PC.articles.amendCheck(state, s.id, o.id) : null;
          if (c && c.ok && shipLock(false)) c = { ok: false, why: shipLock(false) };
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
      // The read-out is a note on Sign the Articles, not a button of its own (#18 of the build 0.9 pins).
      html += '<div class="actions"><button class="primary" data-act="artask"' + lockAttr(shipLock(false)) + '>Sign the Articles</button><button class="secondary" data-act="artreset">Reset to Standard</button></div>' +
        (check ? '<p class="note" style="margin:6px 0 0">A check follows: reading the Articles to the crew, Pirate Code (' + tierWord(check.tier) + ").</p>" : "");
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
    // Prisoners and captives (§17.4.4; M9 PR 3): listed together; a prisoner can be released or killed.
    var pris = PC.bounties ? PC.bounties.prisoners(state) : [];
    if (pris.length || state.captives) html += '<div class="svc"><h4>Prisoners and captives</h4>' +
      (state.captives ? '<p class="small">' + plural(state.captives, "captive") + " aboard, to be freed at a free port for a reward.</p>" : "") +
      pris.map(function (p) {
        return '<p class="small" style="margin:4px 0"><b>' + esc(p.name) + "</b> · " + (p.kind === "bounty" ? "wanted by the Admiralty: Lieutenant Howe pays the alive rate" : p.kind === "wanted" ? "the Admiral's man: bring him to the Admiralty House in Norfolk" : "a French straggler: Lieutenant Howe pays " + PC.data.bounties.STRAGGLER_REWARD) +
          ' <button class="secondary" data-act="prisrelease" data-id="' + esc(p.id) + '">Let him go</button> <button class="secondary" data-act="priskill" data-id="' + esc(p.id) + '">Kill him</button></p>';
      }).join("") + "</div>";
    html += '<div class="svc"><h4>Morale · ' + c.morale + " · " + esc(C.band(c.morale)) + '</h4><div class="hbar" style="height:12px;max-width:680px"><i style="width:' + c.morale + '%;background:#2f5a22"></i></div></div>';
    html += '<table class="ledger wide">' +
      '<tr><th><span title="The average worth of your hands (Green 0 to Veteran 3), less 1 in a season when raw hands are over a quarter of the crew." style="border-bottom:1px dotted">Skill</span></th><td>' + C.skill(state) + (c.raw > 0.25 * c.count ? ' <span class="note">(raw hands this season: −1)</span>' : "") + "</td></tr>" +
      '<tr><th><span title="How well the crew follow orders. Fed by your Quartermaster, Strict Articles and Make an Example." style="border-bottom:1px dotted">Discipline</span></th><td>' + C.discipline(state) + "</td></tr>" +
      '<tr><th><span title="Skill and Discipline together: what the crew adds in a fight." style="border-bottom:1px dotted">Crew Rating</span></th><td>' + C.crewRating(state) + "</td></tr>" +
      lrow("Guns drilled", C.drilled(state) ? "Yes" : "No") +
      '<tr><th><span title="What one hand takes from a haul, at the current Articles." style="border-bottom:1px dotted">One share</span></th><td>' + gold(Math.round(C.oneShare(state))) + " crew gold</td></tr></table>";
    var rallyUsed = C.usedThisSeason(state, "rally"), drillUsed = C.usedThisSeason(state, "drill");
    var ex = C.canMakeExample(state);
    html += sayFor("ship:crew") + opts([
      opt({ act: "rally", label: "Rally the crew " + apText(1), ap: 1, check: rallyUsed ? null : PC.checks.assess(state, C.rallyCheck(state)), meta: "Morale +5 on a partial, +10 on a clean result. Once a season.",
        lock: shipLock(true) || (rallyUsed ? "Done this season" : !state.ap.left ? "No actions left this season" : null) }),
      opt({ act: "drill", label: "Drill the guns " + apText(1), ap: 1, meta: C.skill(state) >= 2 ? "Your hands are already drilled." : "The crew count as drilled (+1 Gunnery) for the rest of the season. Once a season.",
        lock: shipLock(true) || (drillUsed ? "Done this season" : C.skill(state) >= 2 ? "Already drilled" : !state.ap.left ? "No actions left this season" : null) }),
      opt({ act: "example", label: "Make an example of a troublemaker", check: ex.ok ? PC.checks.assess(state, { type: "Discipline", dr: 2 }) : null,
        meta: "No action · once a season, only when the crew is Sullen or Mutinous. Clean: Pressure −2, Discipline +1 for the season, Dread up. Partial: Pressure −1, morale −5. Setback: morale −5.", lock: shipLock(false) || (ex.ok ? null : ex.why) }),
    ]);
    var giveMax = state.money.purse;
    html += '<div class="svc"><h4>Give to the crew</h4>' + sayFor("ship:give") + '<p class="small">Move gold from your purse into crew gold: +1 morale for every " + PC.data.economy.GIFT_GOLD_PER_MORALE + " gold a head (at most +10 a gift, +15 a season).</p>' +
      // The purse beside the stepper (B33).
      (giveMax > 0 ? '<div class="buyrow"><span class="small">Your purse: <b>' + gold(state.money.purse) + "</b></span>" + qstep("q-give", Math.min(giveMax, c.count * 5 * 2), giveMax) + '<button class="secondary" data-act="give" data-for="q-give"' + lockAttr(shipLock(false)) + '>Give</button> ' +
        totalSlot(function () { var n = val("q-give"); return gold(n) + " gold · morale +" + (n > 0 ? PC.crew.giftMorale(state, n) : 0); }) + "</div>" : '<p class="note">Your purse is empty.</p>') + "</div>";
    html += '<div class="svc"><h4>Rationing</h4><p class="small">' + (c.rationing ? "On: provisions burn 25% slower, and a Ration Stores check each season sets the cost to morale." : "Off.") + "</p>" +
      '<button class="secondary" data-act="rationing"' + lockAttr(shipLock(false)) + ">" + (c.rationing ? "Lift rationing" : "Order rationing") + "</button></div>";
    return html;
  }

  // The Fleet view (A2-A3 of the M5 playtest): every ship you hold, her
  // captain, the hands aboard and what she adds to the pooled hold. Hands
  // move between the flagship and fleet ships, free, outside a battle.
  function fleetTab() {
    var fl = (state.fleet || []).filter(function (f) { return !f.out; });
    var cap = PC.crew.holdCapacity(state);
    var html = '<div class="svc"><h4>The hold</h4>' + holdBarHtml(holdNow()) + '<p class="small">One shared hold: every ship adds her space to the total. ' +
      PC.crew.holdByShip(state).map(function (h) { return (h.id === "flagship" ? "<i>" + esc(h.name) + "</i>" : dirtyName(h.name, h.dirty)) + " " + h.cargo; }).join(" + ") + " = " + cap + ".</p></div>";
    html += sayFor("ship:fleet");
    var sh = state.ship, c = state.crew;
    var offsOn = function (id) { return aboard().filter(function (o) { return (o.aboard || "flagship") === id; }); };
    html += '<div class="fleetship">' + shipArtHtml(sh.type) + '<div class="pmain"><b><i>' + esc(sh.name) + '</i></b> <span class="note">' + esc(sh.type) + " · your flagship</span>" +
      '<p class="small" style="margin:2px 0">Crew ' + c.count + " of " + sh.crewMax + " (at least " + (sh.crewMin || 5) + ")" + (c.wounded ? " · " + c.wounded + " wounded" : "") +
      " · hull " + Math.round(sh.hull) + "/" + sh.hullMax + " · " + sh.guns + " guns · hold " + sh.cargo + "</p>" +
      (offsOn("flagship").length ? '<p class="small" style="margin:0">Officers aboard: ' + offsOn("flagship").map(function (o) { return esc(o.first + " " + (o.last || "")) + (o.quartermaster ? " (Quartermaster)" : ""); }).join(", ") + "</p>" : "") + "</div></div>";
    if (!fl.length) return html + '<p class="note">No other ships yet. After a battle you can keep a captured ship as a prize ship (her hold joins yours) or a fleet ship (an officer captains her and she fights beside you).</p>';
    fl.forEach(function (f) {
      var capt = f.officer ? (state.officers || []).filter(function (o) { return o.id === f.officer && !o.gone; })[0] : null;
      html += '<div class="fleetship">' + shipArtHtml(f.cls) + '<div class="pmain"><b>' + dirtyName(f.name || f.cls, f.dirty) + '</b> <span class="note">' + esc(f.cls) + " · " + (f.kind === "fleet" ? "fleet ship" : "prize ship") + "</span>" +
        '<p class="small" style="margin:2px 0">' + (f.kind === "fleet" ? "Captain: " + (capt ? esc(capt.first + " " + (capt.last || "")) + " (" + esc(capt.type) + ")" : "none") + " · " : "") +
        "Crew " + f.crew + " of " + f.crewMax + " (at least " + f.crewMin + ")" + (f.wounded ? " · " + f.wounded + " wounded" : "") + " · hull " + Math.round(f.hull) + "/" + f.hullMax + " · " + f.guns + " guns · adds " + (f.cargo || 0) + " to the hold</p>";
      if (f.kind === "fleet") {
        var to = PC.crew.canMoveHands(state, "flagship", f.id), back = PC.crew.canMoveHands(state, f.id, "flagship");
        html += '<div class="buyrow" style="margin:4px 0">' +
          (to.ok ? qstep("q-mv-to-" + f.id, Math.min(to.max, 1), to.max, 1, true) + '<button class="secondary" data-act="movehands" data-from="flagship" data-to="' + esc(f.id) + '" data-for="q-mv-to-' + esc(f.id) + '">Send hands to her</button>' : '<span class="note">Send hands to her: ' + esc(to.why) + "</span>") + "</div>" +
          '<div class="buyrow" style="margin:4px 0">' +
          (back.ok ? qstep("q-mv-back-" + f.id, Math.min(back.max, 1), back.max, 1, true) + '<button class="secondary" data-act="movehands" data-from="' + esc(f.id) + '" data-to="flagship" data-for="q-mv-back-' + esc(f.id) + '">Bring hands to the flagship</button>' : '<span class="note">Bring hands to the flagship: ' + esc(back.why) + "</span>") +
          "</div>" + '<p class="note" style="margin:4px 0 0">Free, outside a battle. The greenest hands move first.</p>';
      } else html += '<p class="note" style="margin:2px 0 0">A prize ship keeps exactly her minimum crew until she\'s sold.</p>';
      html += "</div></div>";
    });
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
    var html = holdBar() + '<p class="small">Treasure packs five units to a slot. Every ship\'s hold adds to one total (see Fleet).</p>';
    var rows = [{ what: "provisions", label: "Provisions lots", n: state.provisions, dirty: false }];
    ["clean", "dirty"].forEach(function (k) { if (state.cargo.treasure[k]) rows.push({ what: "treasure", label: "Treasure", n: state.cargo.treasure[k], dirty: k === "dirty" }); });
    Object.keys(state.cargo.goods).forEach(function (g) {
      ["clean", "dirty"].forEach(function (k) { var n = state.cargo.goods[g][k]; if (n) rows.push({ what: g, label: g, n: n, dirty: k === "dirty" }); });
    });
    html += '<table class="grid"><tr><th>Cargo</th><th>Aboard</th><th>Jettison</th></tr>' + rows.map(function (r, i) {
      var info = PC.data.goods[r.what];
      return "<tr><td>" + dirtyName(r.label, r.dirty) + (info && info.stores ? " " + STORES : "") + "</td><td>" + r.n + "</td><td>" + (r.n ? '<div class="buyrow">' + qstep("q-jet-" + i, 1, r.n) +
        '<button class="secondary" data-act="jettison" data-what="' + esc(r.what) + '" data-dirty="' + (r.dirty ? 1 : 0) + '" data-for="q-jet-' + i + '" data-big="' + (r.what === "treasure" ? 1 : 0) + '"' + lockAttr(shipLock(false)) + '>Over the side</button></div>' : "") + "</td></tr>";
    }).join("") + "</table>";
    html += forgeBlock();
    var used = PC.crew.usedThisSeason(state, "stores");
    var choices = PC.crew.storeChoices(state);
    var need = PC.crew.storesNeeded(state);
    html += '<div class="svc"><h4>' + STORES + " Open the stores</h4>" + sayFor("ship:stores") + "<p class=\"small\">Once a season, no action: " + plural(need, "unit") + " of drink or tobacco for your " + state.crew.count + " hands.</p>" +
      (used ? '<p class="note">Opened this season.</p>' : !choices.length ? '<p class="note">Not enough drink or tobacco aboard.</p>' :
        '<div class="actions">' + choices.map(function (c) { return '<button class="secondary" data-act="stores" data-good="' + esc(c.good) + '"' + lockAttr(shipLock(false)) + '>Open the ' + esc(c.good.toLowerCase()) + " (+" + c.morale + " morale)</button>"; }).join("") + "</div>") + "</div>";
    return html;
  }

  // Forge a Clearance (§20.3): roll first, then pick what to clear.
  function forgeBlock() {
    var FG = PC.forgery, f = FG.rec(state), stk = FG.stacks(state);
    var html = '<div class="svc"><h4>Forge a Clearance</h4><p class="small">Once a season, 1 action, in port or at sea. Forged papers make dirty cargo clean: it passes inspections and sells to any merchant. ' +
      "Precious goods take two units of papers each.</p>";
    if (!f) {
      var c = FG.canForge(state);
      return html + opts([opt({ act: "forge", label: "Forge the papers " + apText(1), ap: 1, check: c.ok ? PC.checks.assess(state, FG.check(), { conditions: [] }) : null,
        meta: "Clean: about " + FG.budget(state, "clean") + " units. Partial: about " + FG.budget(state, "partial") + ". Setback: the papers won't pass, and this season's try is spent.", lock: c.ok ? (shipLock(false) || null) : c.why })]) + "</div>";
    }
    html += '<p class="' + OUTCOME[f.outcome][1] + '"><b>' + OUTCOME[f.outcome][0] + "</b>" + (f.rerolled ? " (rerolled with " + esc(f.rerolled) + ")" : "") +
      (state.settings.showDice && f.dice ? ' <span class="note">(dice ' + f.dice.join(" + ") + ", edge " + f.edge + ")</span>" : "") + "</p>";
    var rr = FG.rerollAvailable(state);
    if (rr) html += '<div class="actions"><button class="secondary" data-act="forgereroll">Reroll (' + esc(rr.name) + ")</button></div>";
    if (f.applied) return html + '<p class="note">Cleared this season: ' + esc(f.applied.join(", ") || "nothing") + ".</p></div>";
    if (f.done || !f.budget) return html + '<p class="note">No papers that would pass this season.</p></div>';
    if (!stk.length) return html + '<p class="note">Nothing dirty aboard any more.</p></div>';
    var picks = FG.defaultPicks(state, f.budget);
    html += '<p class="small">Your papers cover <b>' + f.budget + " units</b>. Pick what to clear (most valuable first):</p>" +
      '<table class="grid"><tr><th>Dirty cargo</th><th>Aboard</th><th>Clear</th></tr>' + stk.map(function (s, i) {
        return "<tr><td>" + dirtyName(s.what === "treasure" ? "Treasure" : s.what, true) + (s.weight > 1 ? ' <span class="note">(' + s.weight + " units each)</span>" : "") + "</td><td>" + s.n + "</td><td>" +
          qstep("q-forge-" + i, picks[s.what] || 0, s.n, 0) + '<input type="hidden" class="forgewhat" data-i="' + i + '" value="' + esc(s.what) + '"></td></tr>';
      }).join("") + "</table>" +
      '<p class="small">' + totalSlot(function () {
        var used = 0; stk.forEach(function (s, i) { used += val("q-forge-" + i) * s.weight; });
        return used > f.budget ? '<b style="color:#8f2a1c">' + used + " of " + f.budget + " units: too many</b>" : used + " of " + f.budget + " units";
      }) + "</p>" +
      '<div class="actions"><button class="primary" data-act="forgeapply">Make them clean</button></div>';
    return html + "</div>";
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
    var body;
    try { body = menuBody(); } catch (err) {
      // A menu that fails to draw closes instead of jamming every redraw (Bug Log B2).
      if (globalThis.console) console.error(err);
      menu = null;
      return dialogHtml();
    }
    return '<div class="modal" data-act="closemenu"><div class="panel' + (menu === "captain" || menu === "dev" || menu === "ship" ? " wide" : "") + '" data-stop="1">' +
      '<button class="secondary close" data-act="closemenu" aria-label="Close">' + ic("x") + "</button>" + body + "</div></div>" + dialogHtml();
  }

  function menuBody() {
    return menu === "menu" ? menuMain() : menu === "settings" ? menuSettings() : !state ? "" :
      menu === "journal" ? menuJournal() : menu === "rumors" ? menuRumors() : menu === "captain" ? menuCaptain() : menu === "notes" ? menuNotes() : menu === "ship" ? menuShip() :
      menu === "dev" ? menuDev() : menu.indexOf("officer:") === 0 ? menuOfficer(menu.slice(8)) : "";
  }

  function menuMain() {
    return "<h2>Menu</h2>" + '<div class="title-buttons" style="margin:10px 0">' +
      (state ? '<button class="secondary" data-act="export">Save file</button>' : "") +
      '<button class="secondary" data-act="import">Load file</button>' +
      '<button class="secondary" data-act="openmenu" data-menu="settings">Settings</button>' +
      (state && settings.dev ? '<button class="secondary" data-act="openmenu" data-menu="dev">Developer</button>' : "") +
      (state && state.current.screen === "node" ? '<button class="secondary" data-act="endproto">End the prototype</button>' : "") +
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
    var html = "<h2>Journal</h2>" + '<div class="tabs">' + [["quests", "Quests"], ["log", "Log"], ["notes", "Notes"]].map(function (t) {
      return '<button class="menubtn' + (journalTab === t[0] ? " on" : "") + '" data-act="jtab" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    if (journalTab === "notes") return html + notesBody(); // Notes moved into the Journal (B27)
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
    // The Secrets tab (§30.12): what interrogators could take from you.
    var sec = PC.prison ? PC.prison.secrets(state) : [];
    html += '<div class="qcard"><h4>Secrets</h4>' + (sec.length ? '<ul style="padding-left:1.1em;font-size:18px">' + sec.map(function (x) {
      return "<li>" + esc(x.name) + ' <span class="note">(' + esc(x.size) + ", " + plural(x.points, "point") + (x.exposed ? "; exposed" : "; if exposed: " + x.penalty) + ")</span></li>";
    }).join("") + "</ul>" : '<p class="note">None yet. Some things you do become secrets: your fences, for one.</p>') + "</div>";
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
  // The letter of marque, shown as a state, not a tag (§28.7).
  function letterLine() {
    var l = PC.letters.letter(state);
    if (!l) return '<p class="small" style="margin-top:10px"><b>Letter of marque:</b> none. Every prize but a pirate is dirty.</p>';
    var is = PC.letters.issuer(l.issuer);
    return '<p class="small" style="margin-top:10px"><b>Letter of marque:</b> ' + esc(is.name) + "'s. Covers " + esc(is.covers.join(", ")) + " ships: their cargo is clean, and " + esc(is.factionName) +
      " gains +1 Standing a prize (at most +4 a season). " + esc(is.name) + " takes " + Math.round(is.cut * 100) + "% of every clean sale; " + esc(is.factionName) + "'s port fees are halved; " +
      esc(is.factionName === "Avalon" ? "Frisian" : "Avalon") + " Standing stays at −10 or below while you hold it.</p>";
  }

  // How the meters move, in plain words (§28; the author asked that the
  // offense and betrayal rules be clear to the player).
  function meterHelp() {
    var R = PC.data.meterRules, b = [];
    ["avalon", "frisia"].forEach(function (f) {
      if (PC.meters.betrayalActive(state, f)) b.push((f === "avalon" ? "Avalon" : "Frisia") + " is still angry about your betrayal: Heat gains with them are doubled.");
    });
    return '<details class="card2" style="margin-top:10px"><summary><b>How these move</b>' + CARET + '</summary><div class="inner small">' +
      "<p><b>Heat</b> cools every season: −" + R.BLEED.mid.clean + " (−" + R.BLEED.high.clean + " if they think well of you, −" + R.BLEED.low.clean + " if they hate you). " +
      "In a season when you gain Heat with a faction (an <b>offense</b>, like taking one of their ships), it cools less: −" + R.BLEED.mid.offense + ". Executing a crew leaves no witnesses, so it gains no Heat and is no offense.</p>" +
      "<p><b>Betrayal:</b> an offense against a faction you stand at 40 or more with costs +" + R.BETRAYAL_HEAT + " Heat on top, and doubles your Heat gains with them for a year. The scouting card warns you first.</p>" +
      "<p><b>Standing</b> below Neutral mends by " + R.DRIFT + " a season with no offense against that faction, up to Neutral's edge (−9).</p>" +
      "<p><b>Dread</b> fades by " + R.DREAD_DECAY + " a season unless you do something fearsome (a ship striking without a fight, winning a duel, an execution, Make an Example), and never below your Dread floor.</p>" +
      b.map(function (x) { return '<p class="notice warn">' + esc(x) + "</p>"; }).join("") + "</div></details>";
  }

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
      equipBlock() +
      '<div class="h4">Ship and stores</div><table class="ledger wide">' +
      lrow("Ship", esc(state.ship.type) + " <i>" + esc(state.ship.name) + "</i>") + lrow("Hull · Speed", Math.round(state.ship.hull) + " / " + state.ship.hullMax + " · " + state.ship.speed) +
      lrow("Guns", state.ship.guns + " of " + state.ship.gunsMax) + lrow("Crew", plural(state.crew.count, "hand") + (state.crew.wounded ? " + " + state.crew.wounded + " wounded" : "") + " · morale " + state.crew.morale) +
      lrow("Provisions", esc(foodWords()) + " · " + esc(seaTime(PC.crew.food(state)))) +
      lrow("Hold", PC.crew.slotsUsed(state) + " of " + PC.crew.holdCapacity(state)) + lrow("Crew Rating", PC.crew.crewRating(state)) + "</table>" +
      meters(true) + alliesBlock() + letterLine() + meterHelp() + '<p class="small" style="margin-top:12px">' + seal().replace('class="seal"', 'class="seal" style="display:inline-flex"') + "</p>";
  }

  // The equipment screen (§32.3, §41.12; M9 PR 5): the slots, then the
  // inventory. Swaps are free, but not in a battle, a minigame or a scene.
  function equipBlock() {
    var v = PC.items.view(state), lk = v.lock;
    var tierNote = function (t) { return t ? ' <span class="note">' + esc(t) + "</span>" : ""; };
    var slots = v.slots.map(function (s) {
      var val = s.item ? "<b style=\"font-weight:normal\">" + esc(s.item) + "</b>" + tierNote(s.tier) + '<br><span class="small">' + esc(s.effect || "") + (s.inert ? ' <span class="note">(' + esc(s.inert) + ")</span>" : "") + "</span>" +
        (lk ? "" : ' <button class="link" data-act="unequip" data-key="' + s.key + '">Take off</button>')
        : '<span class="note">' + esc(s.note || "Empty") + "</span>";
      return lrow(s.name, val);
    }).join("");
    var inv = v.inventory.map(function (it) {
      var btns = "";
      if (!lk) {
        btns = it.keys.map(function (k) {
          return '<button class="link" data-act="equip" data-item="' + esc(it.name) + '" data-key="' + k.key + '">' + (k.holds ? "Wear as " + esc(k.name) + " (for the " + esc(k.holds) + ")" : "Wear" + (it.keys.length > 1 ? " as " + esc(k.name) : "")) + "</button>";
        }).join(" ");
        if (it.use) btns += it.use.why ? ' <span class="note">' + esc(it.use.why) + "</span>" : ' <button class="primary" data-act="useitem" data-item="' + esc(it.name) + '">Use</button>';
      }
      var how = it.slot === "display" ? (it.works ? "counts while carried, until the cabin" : "for display: the cabin comes later") : it.works && it.tier ? "works from the inventory" : "";
      return '<li><b style="font-weight:normal">' + esc(it.name) + (it.count > 1 ? " ×" + it.count : "") + "</b>" + tierNote(it.tier) +
        (it.effect ? '<br><span class="small">' + esc(it.effect) + (it.inert ? ' <span class="note">(' + esc(it.inert) + ")</span>" : "") + "</span>" : "") +
        (how ? ' <span class="note">· ' + esc(how) + "</span>" : "") + (btns ? '<div class="small" style="margin:2px 0 8px;display:flex;gap:14px;flex-wrap:wrap">' + btns + "</div>" : "") + "</li>";
    }).join("");
    return '<div class="h4">Equipment</div>' + (lk ? '<p class="notice">' + esc(lk) + "</p>" : "") +
      '<p class="small" style="margin:2px 0">In a boarding you fight with <b style="font-weight:normal">' + esc(v.melee) + "</b>" + (v.guns.length ? " and fire the " + esc(v.guns.join(" and the ")) : ", with no gun for the boarding shot") + ".</p>" +
      '<table class="ledger wide">' + slots + "</table>" +
      '<div class="h4">Inventory</div>' + (inv ? '<ul style="padding-left:1.1em;font-size:18px">' + inv + "</ul>" : '<p class="small">Nothing else.</p>') +
      '<p class="note">Only what you wear works, except the Pistol Brace and what you use. Changing costs no actions.</p>';
  }

  function menuNotes() { return "<h2>Notes</h2>" + notesBody(); }
  function notesBody() {
    var notes = state.notes || {};
    var people = [{ id: "voyage", name: "The voyage", ph: "What's happened, what's next" }, { id: "captain", name: (state.captain.first + " " + state.captain.last).trim() + " (your captain)", ph: "Who are they to you?" }].concat(
      aboard().map(function (o) { return { id: "officer:" + o.id, name: (o.first + " " + (o.last || "")).trim() + " (" + o.type + ")", ph: "Who are they to you?" }; }));
    return "<p class=\"note\">Your own notes. Nothing in the game reads them; they travel with your save.</p>" + people.map(function (p) {
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
    // 3-24: an earned rung is an achievement, shown big.
    if (p.achievement) return '<div class="modal popup"><div class="panel achievement" style="max-width:560px"><div class="ach-kicker">Achievement</div><h2 class="ach-title">' + esc(p.title) + "</h2>" + (p.text ? '<div class="prose">' + prose(p.text) + "</div>" : "") +
      '<div class="actions"><button class="primary" data-act="closepopup">Continue</button></div></div></div>';
    return '<div class="modal popup"><div class="panel" style="max-width:560px"><h2>' + esc(p.title) + "</h2>" + (p.text ? '<div class="prose">' + prose(p.text) + "</div>" : "") + chips(list) +
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
      grp("Time", '<div class="actions">' + b("addap", "+1 action") + b("fillap", "Top up actions") + b("devnewseason", "End the season now") + b("tohub", "Back to the town menu") + "</div>" +
        (state.location ? '<p class="small">Skip to (every turn runs; a Winter on the way is held, no split): ' + PC.state.SEASONS.map(function (n, i) { return b("devskipto", n, ' data-season="' + i + '"'); }).join("") + "</p>" : "")) +
      (state.location ? grp("Milestone 7", '<label class="tog"><input type="checkbox" data-act="devfreesail"' + (devFreeSail ? " checked" : "") + "> Sail anywhere live at 0 actions</label>" +
 '<p class="small">Force the next voyage event: <select class="devevent">' + Object.keys(PC.voyageEvents ? (function () { PC.voyageEvents.byId("x"); return PC.voyageEvents.all(); })() : {}).sort().map(function (id) {
          return '<option value="' + esc(id) + '">' + esc(id + (PC.voyageEvents.isWritten(PC.voyageEvents.byId(id)) ? "" : " (placeholder)")) + "</option>"; }).join("") + "</select> " + b("devevent", "Force") +
          (state.flags.devForceEvent ? ' <span class="note">Next: ' + esc(state.flags.devForceEvent) + "</span>" : "") + "</p>" +
        '<p class="small">This season\'s outlook: ' + ["north", "south"].map(function (z) { return (z === "north" ? "North " : " · South ") + ["Fair", "Unsettled", "Foul"].map(function (o) {
          return '<button class="' + (PC.weather.outlook(state, z) === o ? "primary" : "secondary") + '" data-act="devoutlook" data-zone="' + z + '" data-o="' + o + '">' + o + "</button>"; }).join(""); }).join("") + "</p>" +
        '<div class="small">The last voyage\'s slots:' + devReadout() + "</div>" +
        '<p class="small">Avalon Standing (' + (state.meters.standing.avalon || 0) + "): " + [-75, -45, 0, 25].map(function (v) { return b("devstanding", String(v), ' data-f="avalon" data-v="' + v + '"'); }).join("") + "</p>" +
        // Milestone 8: the letter and Key's regard (hidden in play).
        '<p class="small">Key\'s letter: ' + (PC.letters.letter(state) ? "held " + b("devletter", "Take it away", ' data-on="0"') : "none " + b("devletter", "Give it", ' data-on="1"')) +
        " · Key's regard (" + (state.regard && state.regard.key ? state.regard.key.v + ", " + PC.letters.band(state, "key") : "unmet") + "): " + [-5, -2, 0, 2, 4].map(function (v) { return b("devregard", String(v), ' data-v="' + v + '"'); }).join("") + "</p>") : "") +
      (state.location ? grp("Money and cargo", '<div class="actions">' + b("devgold", "+500 crew gold") + b("devpurse", "+500 purse") + b("devtreasure", "+10 clean treasure", ' data-dirty="0"') +
        b("devtreasure", "+10 dirty treasure", ' data-dirty="1"') + b("devdamage", "Damage the hull (−5)") + b("devarrive", "The arrival popup (back from a hunt, 4 wounded)") + "</div>") : "") +
      (state.location ? grp("Story", (PC.devtools && PC.devtools.skipQuests ? '<div class="actions">' + b("devskip", "Skip the mandatory quests") + "</div>" : "") +
        '<p class="small">Loss variant: ' + ["A", "B", "C"].map(function (x) { return '<button class="' + (state.captain.loss === x ? "primary" : "secondary") + '" data-act="devloss" data-loss="' + x + '">' + x + "</button>"; }).join(" ") +
        " · Frisian posture: " + PC.state.POSTURES.map(function (p) { return '<button class="' + (state.world.posture === p ? "primary" : "secondary") + '" data-act="devposture" data-posture="' + p + '">' + p + "</button>"; }).join(" ") + "</p>" +
        '<p class="small">Jump to a scene: <select class="devscene">' + PC.devtools.jumpable().map(function (id) {
          return '<option value="' + esc(id) + '">' + esc(id) + "</option>";
        }).join("") + "</select> " + b("devjump", "Go") + "</p>" +
        '<div class="actions">' + b("devnorfolk", "Arrive at Norfolk (first visit)") + "</div>" +
        // Milestone 8, PR 6: imprisonment.
        '<p class="small">Jail at Norfolk, ship in port: ' + ["Held", "Imprisoned", "Condemned"].map(function (c) { return b("devjail", c, ' data-charge="' + c + '"'); }).join("") +
        " · Taken at sea by: " + ["Avalon", "Frisia", "Pirate"].map(function (f) { return b("devcaptured", f, ' data-flag="' + f + '"'); }).join("") +
        " · " + b("devsecret", "Make Bobby a secret") + (state.jail ? " · " + b("devclock", "Fill the escape points") + b("devtrial", "Skip to the trial") : "") + "</p>") : "") +
      (state.location ? grp("The hunt", '<p class="small">Next sighting: ' + b("devforce", "Avalon hunter", ' data-kind="hunter" data-flag="Avalon"') + b("devforce", "Frisian hunter", ' data-kind="hunter" data-flag="Frisia"') +
        b("devforce", "Sicilian hunter", ' data-kind="hunter" data-flag="Sicily"') + b("devforce", "French hunter", ' data-kind="hunter" data-flag="France"') + b("devforce", "Convoy", ' data-kind="convoy"') +
        b("devforce", "Escorted merchant", ' data-kind="escort"') + b("devforce", "Warship", ' data-kind="warship"') + b("devforce", "Pirate sloop", ' data-kind="ship" data-flag="Pirate" data-cls="Sloop"') + "</p>" +
        '<p class="small">Add a fleet ship (generated officer-captain): ' + ["Sloop", "Schooner", "Brigantine", "Brig"].map(function (c) { return b("devfleet", c, ' data-cls="' + c + '"'); }).join("") + "</p>" +
        // P8: the crew's hidden numbers.
        '<p class="small">Crew: morale ' + state.crew.morale + " (" + esc(PC.crew.band(state.crew.morale)) + ") · Pressure " + (state.crew.pressure || 0) + " of 5 (mutiny fires at 4 on departure, 5 at season end; not built yet) · set Pressure: " +
          [0, 2, 3, 4, 5].map(function (v) { return b("devpressure", String(v), ' data-v="' + v + '"'); }).join("") + " " + b("devmutiny", "Fire a mutiny now") + " " + b("devbounties", "Open the bounty board (skip A Wanted Man)") + " " + b("devfreddy", "Freddy: assign him and hear his rumor") + "</p>" +
        '<p class="small">Avalon Heat: ' + [0, 25, 55, 85].map(function (h) { return b("devheat", String(h), ' data-f="avalon" data-v="' + h + '"'); }).join("") + " · Frisian Heat: " + [0, 55, 85].map(function (h) { return b("devheat", String(h), ' data-f="frisia" data-v="' + h + '"'); }).join("") +
        " · " + b("devfullcrew", "Full crew, guns and hull") + "</p>") : "") +
      grp("Run log", '<p class="small">Every choice, roll (with its seed), screen and change this run, and any error: ' + (PC.runlog ? PC.runlog.count() : 0) + " entries. Export it and attach the file in the playtest chat.</p>" +
        '<div class="actions">' + b("runlogexport", "Export the run log") + b("runlogcopy", "Copy it") + b("runlogclear", "Clear it") + "</div>") +
      grp("Start", '<div class="actions">' + b("quickask", "Quick start with the test captain") + "</div>") +
      grp("Info", '<p class="small">World seed ' + esc(state.world.seed) + " · save version " + state.saveVersion + "</p>" +
        (here ? '<p class="small">' + esc(here.name) + "'s people this world: " + here.slots.map(function (sl) {
          // Fixed Named NPCs (Horace, Christoph) live in PC.data.npcs, not state.generated (Bug Log B2).
          var g = state.generated[sl.id] || (PC.data.npcs || {})[sl.id];
          if (!g) return esc(sl.label + ": (none)");
          var full = g.full || [g.first, g.last].filter(Boolean).join(" ");
          return esc(sl.label + ": " + full + " (" + (g.gender === "f" ? "woman" : "man") + (g.age ? ", " + g.age : "") + "; " + (g.traits || []).join(", ") + ")" + (sl.fixed ? " · Named" : "")); }).join(" · ") + "</p>" : "") +
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
    var n = el.dataset.qtyValue != null ? Math.floor(Number(el.dataset.qtyValue)) : box ? Math.floor(Number(box.value)) : 1;
    if (!(n > 0)) throw new Error("Choose a number above zero.");
    if (box && box.max && n > Number(box.max)) n = Number(box.max);
    return n;
  }

  function enterPlace(place) {
    var fire = N().enter(state, place);
    state.location.ollieWinter = false;
    if (place === "graveyard" && isWinter() && state.flags.ollieWinterSeen !== PC.state.stamp(state)) { state.flags.ollieWinterSeen = PC.state.stamp(state); state.location.ollieWinter = true; }
    diveZone = null; drinkSpot = null;
    state.location.said = {}; state.location.bark = null; state.location.say = null;
    if (fire) PC.scenes.enterScene(state, fire);
  }

  function who(slot) { return N().slotNpc(N().here(state), slot); }
  function firstName(id) { return PC.npcs.get(state, id).first; }

  // Warn before losing something (G7 of the M5 playtest): a popup with Go
  // back before an action that dismisses an officer, forces a jettison or
  // forfeits a stake. The button's data (and its stepper's number) wait
  // here until the player confirms; the handler then runs again, confirmed.
  var pendingConfirm = null;
  function confirmFirst(el, title, text, okLabel) {
    if (el.dataset.confirmed || !state.location) return false;
    var data = {};
    Object.keys(el.dataset).forEach(function (k) { data[k] = el.dataset[k]; });
    if (data.for) { var box = document.getElementById(data.for); if (box) data.qtyValue = box.value; }
    pendingConfirm = { act: data.act, data: data };
    state.location.popup = { title: title, text: text, chips: [], back: "confirmback", ok: "confirmok", okLabel: okLabel || "Go ahead" };
    return true;
  }

  // The season-turn popup (Milestone 7): what the turn did, then the new
  // season. After Winter 1754 the end-of-year screen shows instead.
  function seasonTurn(out) {
    menu = null;
    if (out.yearEnd) return;
    var chipsList = out.chips.slice();
    if (out.earPick && state.location) {
      var w = (N().nodeData(N().here(state)).rumorWeights) || PC.data.nodes.ocracoke.rumorWeights;
      var r = PC.rumors.draw(state, w, [state.world.seed, PC.state.stamp(state), "ear"].join("|"), "ear to the ground", out.earPick, { noA: true });
      if (r) chipsList.push({ icon: "rumor", text: "Ear to the Ground: " + r.text.replace(/[“”"]/g, "") });
    }
    var text = out.lines.filter(Boolean).join("\n\n");
    if (state.location) state.location.popup = { title: out.to ? out.to + " begins" : "The season turns", text: text || null, chips: chipsList.length ? chipsList : [{ icon: "clock", text: "The season turns." }] };
  }

  var nodeHandlers = {
    "confirmok": function () {
      var p = pendingConfirm;
      pendingConfirm = null;
      state.location.popup = null;
      if (!p || !handlers[p.act]) return;
      p.data.confirmed = "1";
      handlers[p.act]({ dataset: p.data });
    },
    "confirmback": function () { pendingConfirm = null; state.location.popup = null; },
    // ---- The minigames (§18) ----
    "drink": function () { drinkSpot = null; mgMark = 0; PC.drinking.start(state); },
    "dice": function () { mgMark = 0; PC.liarsdice.start(state); },
    "divewreck": function (el) { diveZone = null; mgMark = 0; PC.salvage.startGraveyardDive(state, el.dataset.wreck, false); },
    "divequick": function (el) { diveZone = null; mgMark = 0; PC.salvage.startGraveyardDive(state, el.dataset.wreck, true); },
    "miranda": function () { diveZone = null; mgMark = 0; PC.salvage.retryMiranda(state); },
    "divezone": function (el) { diveZone = el.dataset.zone; },
    "drinkspot": function (el) { drinkSpot = drinkSpot === el.dataset.spot ? null : el.dataset.spot; },
    "mgdive": function (el) { markLog(); PC.salvage.act(state, el.dataset.op, el.dataset.zone); },
    "beachleave": function () {
      var picks = [];
      root.querySelectorAll("[data-beach-row]").forEach(function (sp) {
        picks.push({ what: sp.dataset.what, dirty: sp.dataset.dirty === "1", n: val("q-beach-" + sp.dataset.beachRow) });
      });
      markLog();
      PC.salvage.leaveOnBeach(state, state.minigame, picks);
    },
    "mgquick": function () { markLog(); PC.salvage.quickDive(state); },
    "mgbank": function (el) { PC.salvage.bank(state, state.minigame, el.dataset.pot); },
    "mgdrink": function (el) { markLog(); PC.drinking.act(state, el.dataset.op); drinkSpot = null; },
    "mgonemore": function (el) { markLog(); PC.drinking.oneMore(state, el.dataset.yes === "1"); },
    "mgreroll": function () { PC.minigames.reroll(state); },
    "mgaccept": function () { PC.minigames.settle(state); },
    "mgleave": function () { diveZone = null; drinkSpot = null; PC.minigames.leave(state); },
    "mgsize": function () { markLog(); PC.liarsdice.sizeUp(state); },
    "mgstake": function (el) { markLog(); PC.liarsdice.newGame(state, qty(el)); },
    "mgbid": function () { markLog(); PC.liarsdice.bid(state, Number(document.getElementById("bid-q").value), Number(document.getElementById("bid-f").value)); },
    "mgliar": function () { markLog(); PC.liarsdice.callLiar(state); },
    "mgcheat": function (el) { markLog(); PC.liarsdice.cheat(state, Number(el.dataset.i)); },
    "mgnextround": function () { markLog(); PC.liarsdice.nextRound(state); },
    "mgclosegame": function () { markLog(); PC.liarsdice.closeGame(state); },
    // Leave the table in one click between games; mid-game, warn first:
    // the stake on the table is forfeit (B26, G7).
    "mgstop": function (el) {
      var g = state.minigame && state.minigame.round;
      if (g && !g.over) {
        if (confirmFirst(el, "Leave mid-game?", "Leave now and you forfeit the " + g.stake + " gold on the table.", "Forfeit and leave")) return;
        PC.liarsdice.stop(state, true);
      } else { markLog(); PC.liarsdice.stop(state); }
      diveZone = null; drinkSpot = null;
      PC.minigames.leave(state);
    },
    // ---- The prize hunt (Milestone 5) ----
    "hunt": function () { mgMark = 0; var f = devForce; devForce = null; PC.hunt.start(state, { force: f }); },
    "hnext": function () { markLog(); PC.hunt.next(state, state.minigame); },
    "hengage": function () { markLog(); PC.hunt.engage(state, state.minigame); },
    "hhunter": function () { markLog(); PC.hunt.meetHunter(state, state.minigame); },
    "hb": function (el) {
      markLog();
      var a = el.dataset.arg, fn = el.dataset.fn;
      if (fn === "showOfForce" || fn === "press" || fn === "grenade") a = a === "yes";
      PC.hunt.battle(state, state.minigame, fn, a);
    },
    "hassign": function (el) { PC.hunt.battle(state, state.minigame, "assignFleetShip", el.dataset.ship, el.dataset.what); },
    "hvote": function (el) { markLog(); PC.hunt.vote(state, state.minigame, el.dataset.forOfficer || null); },
    "hvotereact": function (el) { markLog(); PC.hunt.voteReact(state, state.minigame, el.dataset.react); },
    "hrepair": function () { markLog(); PC.hunt.doRepair(state, state.minigame); },
    "hprize": function () {
      var pick = function (n, d) { var x = document.querySelector('input[name="' + n + '"]:checked'); return x ? x.value : d; };
      var off = document.querySelector(".hofficer");
      // The cargo picked on the screen (A7).
      var cargo = pickRows.length ? { treasure: 0, goods: {}, provisions: 0 } : null;
      pickRows.forEach(function (r) { var n = val(r.id); if (r.what === "treasure") cargo.treasure = n; else if (r.what === "provisions") cargo.provisions = n; else cargo.goods[r.what] = n; });
      markLog();
      var rp = document.querySelector(".hreplace");
      PC.hunt.settlePrize(state, state.minigame, { hull: pick("h-hull", "release"), crew: pick("h-crew", "release"), captives: pick("h-cap", "free"), officer: off ? off.value : null, cargo: cargo,
        replace: rp ? rp.value : null, oldFate: pick("h-oldfate", "release"), captain: pick("h-capt", null) });
    },
    "hcarry": function () { markLog(); PC.hunt.carryOn(state, state.minigame); },
    "hmore": function () { markLog(); PC.hunt.anotherBatch(state, state.minigame); },
    "hhome": function () { PC.hunt.sailHome(state, state.minigame); PC.minigames.leave(state); },
    "sellhull": function (el) {
      var id = who("shipwright");
      // A sale that leaves cargo with no room forces a jettison: warn first (A9, G7).
      var hh = N().hullSaleHold(state, el.dataset.ship);
      if (hh && hh.over && confirmFirst(el, "Throw cargo over the side?", "Selling her takes " + hh.loses + " slots out of your hold. What's left won't fit, so this goes over the side:\n\n" +
        hh.plan.map(function (x) { return x.n + " " + (x.what === "provisions" ? "provisions lots" : x.what) + (x.dirty ? " (dirty)" : ""); }).join(", ") + "\n\nSell what you can first, or keep her.", "Sell her anyway")) return;
      var r = N().sellHull(state, el.dataset.ship);
      say(id, firstName(id), r.line, null, null, r.gold ? { chips: [goldChip(r.gold), r.home ? textChip("officer", plural(r.home, "hand") + " back aboard") : null, r.paid ? textChip("officer", plural(r.paid, "hand") + " paid off: no berths" + (r.paidFromPurse ? " (" + gold(r.paidFromPurse) + " from your purse)" : "")) : null]
          .concat((r.jettisoned || []).map(function (x) { return textChip("cond", x.n + " " + x.what + " over the side", "bad"); })) } : null);
      if (r.gold) toast("Sold her · +" + gold(r.gold) + " crew gold");
    },
    // Laying a ship up (§22.7): her hold leaves with her, so warn as a sale does.
    "layup": function (el) {
      var id = who("shipwright"), hh = N().hullSaleHold(state, el.dataset.ship);
      if (hh && hh.over && confirmFirst(el, "Throw cargo over the side?", "Laying her up takes " + hh.loses + " slots out of your hold. What's left won't fit, so this goes over the side:\n\n" +
        hh.plan.map(function (x) { return x.n + " " + (x.what === "provisions" ? "provisions lots" : x.what) + (x.dirty ? " (dirty)" : ""); }).join(", ") + "\n\nSell what you can first, or keep her with you.", "Lay her up anyway")) return;
      var r = N().layUp(state, el.dataset.ship);
      say(id, firstName(id), r.line, null, null, { chips: [goldChip(-r.up), textChip("ship", "Plus " + gold(r.season) + " gold a season, paid when you take her back"), r.home ? textChip("officer", plural(r.home, "hand") + " back aboard your flagship") : null,
        r.paidOff ? textChip("officer", plural(r.paidOff, "hand") + " paid off: no berths") : null].concat((r.jettisoned || []).map(function (x) { return textChip("cond", x.n + " " + x.what + " over the side", "bad"); })) });
    },
    "recover": function (el) {
      var id = who("shipwright"), r = N().recover(state, el.dataset.ship);
      say(id, firstName(id), r.line, null, null, { chips: [textChip("ship", "She sails with you again as a " + r.kind + " ship" + (r.officer ? " under " + r.officer : "")), r.owed ? textChip("gold", "−" + gold(r.owed) + " gold for her anchorage", "mid") : null] });
    },
    "stripguns": function (el) { var n = N().stripGuns(state, el.dataset.ship); toast(plural(n, "gun") + " moved to your flagship"); },
    "goplace": function (el) { if (state.current.screen === "node") enterPlace(el.dataset.place); },
    "leaveplace": function () {
      state.location.say = null;
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
      // Asked again this season (the greyed button is still tappable).
      if (r.again) { say(id, firstName(id), r.line); return; }
      var heard = r.rumors.map(function (x) { return x.text; });
      // One quote, running on: "I did hear one other thing... [rumor]" (the author, UI pass 1 review).
      if (r.extra) heard.push(joinQuotes(r.extraLine, r.extra.text));
      // No "Welcome back." between your question and the rumor (B8).
      var greet = /^\s*"?Welcome back\.?"?\s*$/.test(g.line || "") ? null : g.line;
      say(id, firstName(id), greet, null, heard, { ask: L.askRumors, heardNote: heard.length ? "Added to your Rumors." : null,
        outcome: r.talk.outcome, rollType: "Tavern Talk",
        chips: [heard.length ? { icon: "rumor", text: plural(heard.length, "rumor") + " heard" } : null,
          state.settings.showDice ? { icon: "ap", text: "Dice " + r.talk.dice.join(" + ") + ", edge " + r.talk.edge } : null] });
    },
    // The keeper's other questions (§41.5): information only, no action.
    // The Admiralty House (js/admiralty.js).
    "keyaudience": function () {
      var r = PC.admiralty.audience(state), LA = N().nodeData("norfolk").lines.admiralty;
      say("howe", r.walkIn ? "Admiral Key" : "Lieutenant Howe", r.lines.join("\n\n"), null, null, { ask: LA.askAudience });
    },
    "keyletter": function (el) {
      var LA = N().nodeData("norfolk").lines.admiralty;
      // The popup's Go back is "I'll have to think about it" (Howe's declined line is for the scene).
      if (confirmFirst(el, "Take Admiral Key's letter?", "A letter is binding. Frisian Standing drops 10 and stays at −10 or below while you hold it, and the Admiral takes 10% of every clean sale. Ships of France, Sicily, Spain, Frisia and Ireland become lawful prizes, with clean cargo.", "Take the letter")) return;
      var r = PC.admiralty.takeLetter(state);
      say("howe", "Lieutenant Howe", r.line, null, null, { chips: [textChip("tag", "Admiral Key's letter of marque")] });
    },
    "pardonask": function (el) {
      var LA = N().nodeData("norfolk").lines.admiralty, A = PC.admiralty, c = A.canPardon(state);
      if (!c.ok) { say("howe", "Lieutenant Howe", c.line || ("\"" + c.why + ".\"")); return; }
      var terms = LA.pardonIn + "\n\n" + LA.pardonTerms.replace("[cost]", gold(c.price));
      if (confirmFirst(el, "Admiral Key's pardon", PC.text.render(terms, state).replace(/\*/g, "") + "\n\n" + gold(c.price) + " gold from your purse.", "Accept his terms")) return;
      var r = A.pardon(state);
      say("howe", "Admiral Key", terms + "\n\n" + r.line, null, null, { ask: LA.pardonAsk, chips: [goldChip(-r.price, "purse"), textChip("heat", "Avalon Heat cleared (" + r.heat + ")", "good"), textChip("standing", "Avalon Standing +10", "avalon"), textChip("standing", "Pirate Standing −10", "pirates"), textChip("tag", "New tag: Pardoned")] });
    },
    "howeask": function (el) {
      var q = PC.admiralty.questions(state).filter(function (x) { return x.id === el.dataset.q; })[0];
      say("howe", "Lieutenant Howe", PC.admiralty.ask(state, el.dataset.q), null, null, { ask: q.label });
    },
    "keeperq": function (el) {
      var id = who("keeper");
      var r = N().askKeeperQuestion(state, el.dataset.q);
      if (r.refuse) { say(id, firstName(id), r.line); return; }
      // 3-5: Variant B's answer leads straight into Bobby's scene (Welcome
      // to the Underworld), the keeper's answer shown above it.
      if (r.then && PC.scenes.canEnter(state, r.then).ok) {
        state.location.queue = (state.location.queue || []).filter(function (q) { return q !== r.then; });
        PC.scenes.enterScene(state, r.then);
        state.current.lead = { label: "“" + r.label + "”", outcome: "result", text: r.line, chips: [] };
        return;
      }
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
      say("around", null, { clean: "You ask around town, and people talk.", partial: "You ask around town and pick up a rumor.", setback: "You ask around town. You hear one thing, but people notice you asking." }[r.outcome],
        r.picks ? (r.picks > 1 ? "Pick the two things you want to hear about." : "Pick what you want to hear about.") : null, heard, { heardNote: heard.length ? "Added to your Rumors." : null, outcome: r.outcome, rollType: "Gather Intelligence",
          chips: [{ icon: "ap", text: "1 action" }, heard.length ? { icon: "rumor", text: plural(heard.length, "rumor") + " heard" } : null] });
    },
    "gatherpick": function (el) {
      var r = PC.rumors.gatherPick(state, el.dataset.type);
      var prev = state.location.say || {};
      say("around", prev.who, prev.line, null, (prev.heard || []).concat(r ? [r.text] : []), { heardNote: "Added to your Rumors." });
    },
    "hireofficer": function (el) {
      // Hiring into a filled slot dismisses the incumbent: warn first (G7);
      // the mentor can be replaced too, and the warning says so (B19).
      var c = PC.officers.candidates(state).filter(function (x) { return x.id === el.dataset.officer; })[0];
      var held = c ? PC.officers.holding(state, c.type) : null;
      if (held && confirmFirst(el, "Dismiss " + held.first + "?",
        "Hiring " + c.first + " replaces " + (held.first + " " + (held.last || "")).trim() + ", your " + held.type +
        (held.mentor || held.quartermaster ? " (" + [held.mentor ? "your mentor" : null, held.quartermaster ? "your Quartermaster" : null].filter(Boolean).join(" and ") + ")" : "") +
        ". " + (held.gender === "f" ? "She" : "He") + " is dismissed with " + PC.officers.dismissPay(state) + " crew gold and leaves the ship." +
        (held.mentor ? "\n\nYour mentor won't be back." : ""), "Hire " + c.first)) return;
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
      say(id, firstName(id), r.line, null, null, r.failed ? null : { chips: [textChip("hull", "Hull +" + hp, "good"), goldChip(-(r.cost || 0)), r.fixedRigging ? textChip("hull", "Frayed rigging fixed: Speed " + state.ship.speed, "good") : null] });
      bought(r, "Repaired " + hp + " hull");
    },
    "upgrade": function (el) { var id = who("shipwright"); var r = N().upgrade(state, el.dataset.track); say(id, firstName(id), r.line, null, null, r.failed ? null : { chips: [goldChip(-(r.cost || 0))] }); bought(r, "Upgrade bought"); },
    "guns": function (el) { var id = who("shipwright"); var n = qty(el); var r = N().buyGuns(state, n); say(id, firstName(id), r.line, null, null, r.failed ? null : { chips: [textChip("hull", "+" + plural(n, "gun"), "good"), goldChip(-(r.cost || 0))] }); bought(r, "Bought " + plural(n, "gun")); },
    // One Sign button for every tier (§41.8).
    "signhands": function (el) {
      var plan = {};
      el.dataset.tiers.split(",").forEach(function (t) { plan[t] = val("q-hire-" + t); });
      var r = N().recruitBatch(state, plan);
      var leftOn = r.left ? Object.keys(r.left).map(function (t) { return r.left[t] + " " + t; }) : [];
      say("hands", null, r.line, r.n ? (r.upgraded ? plural(r.upgraded, "of them turns", "of them turn") + " out better than they looked." : "") +
        (leftOn.length ? " No room for " + leftOn.join(", ") + "." : "") || null : null, null, r.n ? { chips: [textChip("officer", "+" + plural(r.n, "hand"), "good"), goldChip(-r.cost)] } : null);
      if (r.n) toast("Signed " + plural(r.n, "hand") + " · −" + gold(r.cost) + " crew gold");
    },
    "docksroll": function () {
      var r = N().docksRoll(state);
      say("hands", null, "You walk the docks and size up who's looking for a berth.", null, null,
        { outcome: r.outcome, rollType: "Size up the hands", chips: state.settings.showDice ? [{ icon: "ap", text: "Dice " + r.dice.join(" + ") + ", edge " + r.edge }] : null });
    },
    "haggle": function (el) {
      // The result stays as a box at the top of the block (§41.9, G4).
      var r = N().haggle(state, el.dataset.npc);
      state.location.say = null;
      if (state.settings.showDice) toast("Haggle: dice " + r.dice.join(" + ") + ", edge " + r.edge);
    },
    "payoff": function (el) { var n = qty(el); var r = N().payOff(state, el.dataset.tier, n); say("hands", null, r.line, null, null, { chips: [textChip("officer", "−" + plural(n, "hand")), goldChip(-r.cost)] }); bought(r, plural(n, "hand") + " put ashore"); },
    "buyprov": function (el) { var id = who("provisioner"); var n = qty(el); var r = N().buyProvisions(state, n); say(id, firstName(id), r.line, null, null, r.cost ? { chips: [textChip("prov", "+" + n + " provisions", "good"), goldChip(-r.cost)] } : null); bought(r, "Bought " + n + " provisions"); },
    "buygood": function (el) { var id = who("provisioner"); var n = qty(el); var r = N().buyGood(state, el.dataset.good, n); say(id, firstName(id), r.line, null, null, r.cost ? { chips: [textChip("treasure", "+" + n + " " + el.dataset.good, "good"), goldChip(-r.cost)] } : null); bought(r, "Bought " + n + " " + el.dataset.good); },
    "sell": function (el) {
      var r = N().sell(state, el.dataset.buyer, el.dataset.what, qty(el));
      var id = el.dataset.buyer === "fence" ? N().nodeData(N().here(state)).fence.npc : who("provisioner");
      if (r.units) toast("Sold " + r.units + " · +" + gold(r.gold) + " crew gold");
      say(id, firstName(id), r.line, null, r.rumor ? [r.rumor.leadIn + " " + r.rumor.rumor.text] : null,
        { heardNote: r.rumor ? "Added to your Rumors." : null, chips: r.units ? [{ icon: "treasure", html: "Sold " + r.units + " " + dirtyName(el.dataset.what === "treasure" ? "treasure" : el.dataset.what, el.dataset.buyer === "fence") }, goldChip(r.gold)] : null });
    },
    "sellprov": function (el) {
      var r = N().sellProvisions(state, qty(el)), id = who("provisioner");
      if (r.units) toast("Sold " + plural(r.units, "lot") + " · +" + gold(r.gold) + " crew gold");
      say(id, firstName(id), r.line, null, null, { chips: r.units ? [{ icon: "treasure", text: "Sold " + plural(r.units, "provisions lot") }, goldChip(r.gold)] : [] });
    },
    "sellall": function (el) {
      var buyer = el.dataset.buyer;
      var r = N().sellAll(state, buyer);
      var id = buyer === "fence" ? N().nodeData(N().here(state)).fence.npc : who("provisioner");
      if (r.units) toast("Sold " + r.units + " · +" + gold(r.gold) + " crew gold");
      say(id, firstName(id), r.line, null, r.rumor ? [r.rumor.leadIn + " " + r.rumor.rumor.text] : null,
        { heardNote: r.rumor ? "Added to your Rumors." : null, chips: r.units ? [{ icon: "treasure", text: "Sold " + r.units + " units" }, goldChip(r.gold)] : [] });
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
      say("ship:articles", null, text, null, null, { outcome: OUTCOME[r.outcome] ? r.outcome : null, rollType: "Pirate Code", chips: r.effects.map(function (e) { return textChip(/morale/i.test(e) ? "morale" : "pressure", e, /−|-/.test(e) || /pressure/i.test(e) ? "bad" : "good"); }) });
      if (mt && !state.flags.mentor_first_articles) { state.flags.mentor_first_articles = true; state.location.bark = { id: mt.id, line: PC.data.officerLines.mentorFirstArticles }; }
      state.location.tab = "articles";
      // Re-signed at the split (§26.9): back to the split screen.
      if (state.split && state.split.step === "resign") { menu = null; state.location.say = null; }
    },
    "artamend": function (el) { var c = PC.articles.amend(state, el.dataset.slot, el.dataset.opt); say("ship:articles", null, "The change is read out to the crew.", null, null, { chips: [moraleChip(c.morale)] }); },
    "rally": function () { var r = PC.crew.rally(state); say("ship:crew", null, { clean: "The men roar back at you.", partial: "A few cheers, and some nods.", setback: "The speech falls flat." }[r.outcome], null, null, { outcome: r.outcome, rollType: "Rally Crew", chips: [textChip("ap", "1 action"), moraleChip(r.gain) || textChip("morale", "No change in morale")] }); },
    "drill": function () { PC.crew.drill(state); say("ship:crew", null, "The guns run in and out until the crew can do it in their sleep.", null, null, { chips: [textChip("ap", "1 action"), textChip("hull", "Guns drilled for the rest of the season", "good")] }); },
    "example": function () {
      var r = PC.crew.makeExample(state, "Discipline");
      var fx = { clean: [textChip("pressure", "Pressure −2", "good"), textChip("dread", "Dread +3"), textChip("officer", "Discipline +1 this season", "good")], partial: [textChip("pressure", "Pressure −1", "good"), moraleChip(-5)], setback: [moraleChip(-5)] }[r.outcome];
      say("ship:crew", null, "You make an example of a troublemaker.", null, null, { outcome: r.outcome, rollType: "Discipline", chips: fx });
    },
    "give": function (el) { var n = qty(el); var m = PC.crew.give(state, n); say("ship:give", null, "The gold goes into the crew's chest.", null, null, { chips: [goldChip(-n, "purse"), goldChip(n), moraleChip(m) || textChip("morale", "No change in morale")] }); },
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
    "movehands": function (el) {
      var r = PC.crew.moveHands(state, el.dataset.from, el.dataset.to, qty(el));
      var f = (state.fleet || []).filter(function (x) { return x.id === (el.dataset.to === "flagship" ? el.dataset.from : el.dataset.to); })[0];
      say("ship:fleet", null, plural(r.n, "hand") + (el.dataset.to === "flagship" ? " come back aboard the flagship from the " : " go across to the ") + (f ? f.name || f.cls : "ship") + ".", null, null,
        { chips: [textChip("officer", Object.keys(r.tiers).map(function (t) { return r.tiers[t] + " " + t; }).join(", "))] });
    },
    "forge": function () { var f = PC.forgery.roll(state); toast(f.outcome === "setback" ? "The papers won't pass" : "Papers for " + f.budget + " units"); },
    "forgereroll": function () { PC.forgery.reroll(state); },
    "forgeapply": function () {
      var picks = {};
      document.querySelectorAll(".forgewhat").forEach(function (el) { picks[el.value] = val("q-forge-" + el.dataset.i); });
      var r = PC.forgery.apply(state, picks);
      toast(r.cleared.length ? "Cleared: " + r.cleared.join(", ") : "Nothing cleared");
    },
    "stores": function (el) { var m = PC.crew.openStores(state, el.dataset.good); say("ship:stores", null, "The crew drink to your health.", null, null, { chips: [moraleChip(m)] }); },
    "closepopup": function () { state.location.popup = null; },
    "popupscene": function () {
      state.location.popup = null;
      var nx = N().nextQueued(state);
      if (nx) PC.scenes.enterScene(state, nx);
    },
    "dsask": function () {
      var id = who("keeper"), D = N().nodeData("norfolk").lines.drunkenSailors;
      var again = state.flags.asked_horace_help;
      state.flags.nor_drunken_sailors = true;
      PC.state.addLog(state, "Journal: Drunken Sailors. " + D.objective);
      state.journalDot = true;
      say(id, firstName(id), again ? D.replyAgain : D.reply, null, null, { ask: again ? D.askAgain : D.ask });
    },
    "horacesell": function () {
      var id = who("keeper"), HL = N().nodeData("norfolk").lines.horaceLiquor;
      var r = PC.norfolk.sellToHorace(state);
      say(id, firstName(id), r.line, null, null, { ask: HL.open, chips: r.gold ? [{ icon: "gold", text: "+" + gold(r.gold) + " crew gold for " + plural(r.units, "unit") }] : null });
    },
    "horaceask": function (el) {
      var id = who("keeper"), A = N().nodeData("norfolk").lines.horaceAsk;
      if (el.dataset.q === "bill") {
        PC.quests.addLead(state, "what_was_lost", "gregoire_bill");
        state.flags.gregoire_bill_lead = true;
        say(id, firstName(id), A.billReply, null, null, { ask: A.bill, heardNote: "A lead · Journal updated." });
        return;
      }
      say(id, firstName(id), A.advertReply, null, null, { ask: A.advert });
    },
    // ---- Milestone 7: the chart, voyages, the season loop ----
    "openmap": function () { mapSel = null; menu = null; state.current = { screen: "map" }; },
    "closemap": function () { mapSel = null; state.current = { screen: "node" }; },
    "mapsel": function (el) { mapSel = mapSel === el.dataset.node ? null : el.dataset.node; },
    "sail": function (el) {
      var to = el.dataset.node;
      mapSel = null;
      PC.world.sail(state, to, { free: devFreeSail });
      if (state.current.screen === "map") state.current = { screen: "node" };
    },
    "hsailon": function (el) { PC.hunt.sailOn(state, state.minigame, el.dataset.dest); PC.minigames.leave(state); },
    "endseason": function (el) {
      if (!state.location) { PC.scenes.endSeason(state); return; }
      if (state.ap.left > 0 && confirmFirst(el, endSeasonLabel() + "?", "You still have " + plural(state.ap.left, "action") + " this season. They don't carry over.", endSeasonLabel())) return;
      seasonTurn(PC.world.endSeason(state));
    },
    "splitgo": function () { PC.world.doSplit(state); },
    "splithold": function () {
      var r = PC.world.holdSplit(state);
      state.location.popup = { title: "No split this Winter", text: r.line, chips: r.pressure ? [{ icon: "pressure", text: "The crew grow restless", ink: "bad" }] : [] };
    },
    "splitdepart": function () { PC.world.departures(state); articleDraft = state.split && state.split.oldTerms ? JSON.parse(JSON.stringify(state.split.oldTerms)) : null; },
    "splitarticles": function () { menu = "ship"; state.location.tab = "articles"; state.location.say = null; },
    "splitvote": function () { PC.world.afterResign(state); },
    "winterpick": function (el) { PC.world.spendWinter(state, el.dataset.opt, { type: el.dataset.type }); },
    "splitdone": function () {
      var gaming = state.split && state.split.spent && state.split.spent.id === "gaming";
      PC.world.finishSplit(state);
      if (gaming && PC.liarsdice.canPlay(state, { free: true }).ok) { mgMark = 0; PC.liarsdice.start(state, { free: true }); }
    },
    "enroll": function (el) {
      var who_ = N().slotNpc(N().here(state), "trademaster");
      var r = PC.world.enroll(state, el.dataset.ship);
      say(who_, firstName(who_), r.line, r.failed ? r.why : null, null, r.failed ? null : { chips: [goldChip(-r.paid, "purse"), r.buyPart ? goldChip(r.buyPart) : null, r.morale ? moraleChip(r.morale) : null,
        r.home ? textChip("officer", plural(r.home, "hand") + " back aboard") : null, r.old ? textChip("ship", "The " + r.old + " rejoins your fleet") : null] });
    },
    "firstsigning": function () {
      menu = "ship";
      state.location.tab = "articles";
      state.location.say = null; state.location.bark = null;
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
    var pic = draft.portraitSet && b ? C.portraitPath(draft.portraitSet, C.portraitBand(draft.age).band, false) : null;
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
    return '<button class="card' + (on ? " on" : "") + (blocked ? " blocked" : "") + '" data-act="' + act + '"' + (opts.unpick ? ' data-unpick="1"' : "") + ' data-field="' + field + '" data-value="' + esc(value) + '"' +
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
      '<label class="field"><span>Age</span><span class="sliderwrap"><input class="slider" type="range" min="15" max="40" step="1" value="' + age + '" data-act="age" style="background:' + track + '">' +
      // Labeled ticks on the track (B1 of the M5 playtest).
      '<span class="ticks" aria-hidden="true">' + [15, 20, 25, 30, 35, 40].map(function (t) { return '<i style="left:' + (100 * (t - 15) / 25) + '%"><b></b>' + t + "</i>"; }).join("") + "</span></span></label>" +
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
      '<div class="cards profgrid">' + Dc.PROFESSIONS.map(function (p) {
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
      // Once a flaw is picked the others grey out, as the traits do (#4); tap yours again to change it.
      return card("pick", "flaw", f.id, f.id, f.text, { blocked: C.blockedBy(draft, f.id), full: !!draft.flaw && draft.flaw !== f.id, unpick: true, extra: leanLine(f.id) });
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
    // Two labeled groups, each its own color (Playtest Pins 0.8, #4). Once
    // one is picked the rest of that group grey out; tap the pick again to
    // clear it.
    function traitCards(field, blockFn) {
      var picked = getField(field);
      return ["warm", "neutral", "cold"].map(function (w) {
        return "<h4>" + { warm: "Warm", neutral: "Steady", cold: "Dark" }[w] + '</h4><div class="cards small-cards">' +
          Dc.OFFICER_TRAITS.filter(function (t) { return t.warmth === w; }).map(function (t) {
            return card("pick", field, t.id, t.id, t.hook + ". Likes " + t.likes + ", dislikes " + t.dislikes + ".",
              { blocked: blockFn ? blockFn(t.id) : null, full: !!picked && picked !== t.id, unpick: true });
          }).join("") + "</div>";
      }).join("");
    }
    var picks = function (v) { return v ? ' <span class="note">· picked: ' + esc(v) + " (tap it again to change)</span>" : ""; };
    html += '<div class="traitgroup voice"><h3>Voice trait (pick 1)' + picks(draft.mentor.voice) + '</h3><p class="note">How your mentor talks and what they care about.</p>' + traitCards("mentor.voice") + "</div>" +
      '<div class="traitgroup secondary"><h3>Secondary trait (pick 1)' + picks(draft.mentor.secondary) + "</h3>" + (draft.mentor.voice ? traitCards("mentor.secondary", function (id) { return C.secondaryBlocked(draft, id); }) : '<p class="note">Pick a voice trait first.</p>') + "</div>" +
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
    var cap = draft.portraitSet && b ? C.portraitPath(draft.portraitSet, C.portraitBand(draft.age).band, false) : null;
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
        (m.voice ? "<br>" + esc(m.voice) + (m.secondary ? ", " + esc(m.secondary) : "") : "") + "</p>") +
      sec("Your ship", "ship", "<p>" + (PC.creator.shipName(draft.shipName) ? "The <i>" + esc(PC.creator.shipName(draft.shipName)) + "</i>" : "?") + ", a battered sloop</p>") +
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
      if (el.dataset.unpick && getField(f) === v) v = null; // tap a pick again to clear it
      setField(f, v);
      if (f === "mentor.voice" && !v) draft.mentor.secondary = null;
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
      if (PC.runlog) PC.runlog.newRun(built);
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
      // Quick start brings the test mentor, Jesse Dew (Playtest Pins 0.8, #3).
      state = PC.state.newGame(Object.assign({}, PC.data.testCaptain, { officers: [PC.data.testMentor] }));
      if (PC.runlog) PC.runlog.newRun(state);
      PC.state.addLog(state, "— Spring 1754 begins. —");
    },
    "quit": function () { state = null; creating = false; menu = null; },
    // The end of the prototype (R5).
    "endproto": function (el) {
      menu = null;
      if (state.ap.left > 0 && confirmFirst(el, "End the prototype?", "You still have " + plural(state.ap.left, "action") + " this season. End the run here?")) return;
      menu = null; PC.summary.end(state, "stopped");
    },
    "jdrift": function () { jailSay = PC.prison.drift(state); },
    "jrescue": function () { jailSay = PC.prison.rescue(state); },
    "jresist": function () { jailSay = PC.prison.interrogate(state, "resist"); },
    "jtalk": function (el) {
      if (confirmFirst(el, "Talk freely?", PC.data.prison.lines.talkWarning, "Tell them everything")) return;
      jailSay = PC.prison.interrogate(state, "talk");
    },
    "jgive": function (el) { jailSay = PC.prison.giveUp(state, el.dataset.id); },
    "jwait": function () { jailSay = PC.prison.wait(state); },
    "jseason": function () { var t = PC.prison.seasonTurn(state); jailSay = { lines: (t.turn && t.turn.lines || []).concat(t.lines || []), chips: t.chips }; },
    "jtrial": function () { jailSay = PC.prison.trial(state); },
    "jserve": function () { jailSay = PC.prison.serve(state); },
    "jship": function (el) {
      if (el.dataset.id === "retire" && confirmFirst(el, "Retire?", "You hang up your cutlass, and your story ends here.", "Retire")) return;
      jailSay = PC.prison.shiplessChoose(state, el.dataset.id);
    },
    "jplan": function (el) { jailSay = PC.escape.plan(state, el.dataset.id); },
    "jrecruit": function (el) { jailSay = PC.escape.recruit(state, el.dataset.what); },
    "jbreak": function (el) {
      if (confirmFirst(el, "Break out?", "If you're caught, your trial gets harder (before it) or your sentence a season longer (after it), and your escape points are lost.", "Break out")) return;
      jailSay = PC.escape.breakOut(state);
    },
    "jspend": function () { jailSay = PC.escape.spendPoint(state); },
    "jbeat": function (el) { jailSay = PC.escape.beat(state, el.dataset.mode || null); },
    "jfree": function (el) { jailSay = PC.escape.freedom(state, el.dataset.c); },
    "jcapt": function (el) { jailSay = PC.escape.captivity(state, el.dataset.c); },
    "devclock": function () { PC.devtools.fillClock(state); },
    "devtrial": function () { PC.devtools.toTrial(state); },
    "endgameover": function () { PC.minigames.leave(state); menu = null; PC.summary.end(state); },
    "keepplaying": function () { PC.summary.keepPlaying(state); },
    "export": function () { dialog = "export"; },
    "import": function () { dialog = "import"; },
    "closedialog": function () { dialog = null; },
    "download": downloadSave,
    "runlogexport": downloadRunLog,
    "runlogcopy": copyRunLog,
    "runlogclear": function () { PC.runlog.clear(); toast("Run log cleared."); },
    "copy": copySave,
    "pickfile": pickSaveFile,
    "loadpasted": function () { var t = document.querySelector(".pastebox").value; if (t.trim()) loadSaveText(t); else toast("Paste a save first."); },
    "openmenu": function (el) {
      menu = el.dataset.menu;
      if (menu === "journal") { journalTab = journalTab || "quests"; state.journalDot = false; }
      if (menu === "ship" && state.location) { if (state.location.say && /^ship/.test(state.location.say.to || "")) state.location.say = null; state.location.bark = null; }
    },
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
      // A result that leads to more choices shows them on the same screen,
      // with no Continue in between (the M3 review: Davey's tab, Twopenny's
      // pay-or-shove; #12 of the build 0.9 pins: plain answers too, like
      // Twopenny's "my business does not concern you"). A result that ends
      // the scene keeps its Continue, so it can be read.
      if (r && !r.reroll && !r.needsPot) {
        var ex = PC.scenes.peekExit(state);
        if (ex && ex.to && PC.data.scenes[ex.to] && !ex.leaves) {
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
    "devjail": function (el) { PC.devtools.jail(state, el.dataset.charge); menu = null; },
    "devcaptured": function (el) { PC.devtools.captured(state, el.dataset.flag); menu = null; },
    "devsecret": function () { state.flags.fenceUsed_bobby = true; },
    "bountytake": function (el) { say("howe", "Lieutenant Howe", PC.bounties.take(state, el.dataset.id)); },
    "bountynone": function () { say("howe", "Lieutenant Howe", PC.data.bounties.lines.nothing); },
    "bountyreport": function (el) {
      var r = PC.bounties.report(state, el.dataset.id, el.dataset.claim);
      say("howe", "Lieutenant Howe", r.lines.join("\n\n"), null, null, r.outcome ? { chips: r.chips, outcome: r.outcome, rollType: "Bluff & Disguise" } : { chips: r.chips });
    },
    "equip": function (el) { PC.items.equip(state, el.dataset.item, el.dataset.key); },
    "unequip": function (el) { PC.items.unequip(state, el.dataset.key); },
    "useitem": function (el) { toast(PC.items.use(state, el.dataset.item)); },
    "prisrelease": function (el) { var r = PC.bounties.releasePrisoner(state, el.dataset.id, false); toast(r.lines.join(" ")); },
    "priskill": function (el) { var r = PC.bounties.releasePrisoner(state, el.dataset.id, true); toast(r.lines.join(" ")); },
    "devfreddy": function () { menu = null; state.flags.a_wanted_man_assigned = true; state.flags.admiralty_board_open = true; PC.wanted.heardRumor(state); toast("Freddy Fearless is in the next hunt batch on the Hatteras Banks."); },
    "devbounties": function () { menu = null; var n = PC.bounties.devOpen(state); toast(n.length ? n.length + " notices posted on the Norfolk board." : "The board is open; no new notices this season."); },
    "devmutiny": function () { menu = null; PC.mutiny.devFire(state); },
    "mutapproach": function (el) { PC.mutiny.choose(state, el.dataset.id); },
    "mutfate": function (el) { PC.mutiny.ringleaderFate(state, el.dataset.how); },
    "mutplea": function () { PC.mutiny.plea(state); },
    "mutstand": function () { PC.mutiny.lastStand(state); },
    "mutcarry": function () { mgMark = 0; PC.mutiny.carryOn(state); },
    "mutafter": function () { PC.mutiny.afterLoss(state); },
    "devpressure": function (el) { state.crew.pressure = Number(el.dataset.v); if (state.crew.pressure < 3) state.crew.qmWarned = false; },
    "devfullcrew": function () { var add = state.ship.crewMax - state.crew.count - (state.crew.wounded || 0); if (add > 0) PC.crew.addHands(state, "Able", add); state.ship.hull = state.ship.hullMax; state.ship.guns = state.ship.gunsMax; },
    "devjump": function () {
      PC.devtools.jumpTo(state, document.querySelector(".devscene").value);
      menu = null;
    },
    "devnorfolk": function () { menu = null; PC.devtools.arriveNorfolkFirst(state); },
    "devnewseason": function () {
      menu = null;
      if (!state.location) { PC.scenes.endSeason(state); return; }
      if (state.split) PC.world.finishSplit(state);
      seasonTurn(PC.world.endSeason(state));
    },
    "devskipto": function (el) { menu = null; if (!state.location) return; var o = PC.world.devSkipTo(state, Number(el.dataset.season)); if (o) seasonTurn(o); },
    "evchoose": function (el) { PC.voyageEvents.choose(state, Number(el.dataset.i)); },
    "evnext": function () { PC.voyageEvents.next(state); },
    "evvote": function (el) { PC.voyageEvents.vote(state, el.dataset.forOfficer || null); },
    "evreact": function (el) { PC.voyageEvents.voteReact(state, el.dataset.react); },
    "evmeet": function () { PC.voyageEvents.meet(state, false); },
    "evpass": function () { PC.voyageEvents.meet(state, true); },
    "devevent": function () { var sel = document.querySelector(".devevent"); if (sel) state.flags.devForceEvent = sel.value; },
    "devoutlook": function (el) {
      var w = state.world, st = PC.state.stamp(state);
      if (!w.devOutlook || w.devOutlook.stamp !== st) w.devOutlook = { stamp: st };
      w.devOutlook[el.dataset.zone] = el.dataset.o;
    },
    "devfreesail": function () { devFreeSail = !devFreeSail; },
    "devletter": function (el) { if (el.dataset.on === "1") PC.letters.take(state, "key", { force: true }); else PC.letters.giveUp(state); },
    "devregard": function (el) { PC.letters.meet(state, "key"); state.regard.key.v = Number(el.dataset.v); },
    "devstanding": function (el) { state.meters.standing[el.dataset.f] = Number(el.dataset.v); },
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
    // B1 (Bug Log): the dimmed pip's class is "pip-prev". It used to be
    // "preview", which the creator's preview card also styles (a 290px
    // panel), so hovering any option that costs an action swelled a pip and
    // pushed the page down under the cursor.
    pips.forEach(function (p, i) { p.classList.toggle("pip-prev", n > 0 && i >= pips.length - n); p.classList.toggle("on", !(n > 0 && i >= pips.length - n)); });
  }
  function clearPreview() { root.querySelectorAll(".topbar .pip.pip-prev").forEach(function (p) { p.classList.remove("pip-prev"); p.classList.add("on"); }); }

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
        if (name === "pickfile" || name === "loadpasted" || name === "copy" || name === "download" || name === "runlogexport" || name === "runlogcopy") { h(el); return; }
        act(h)(el);
      });
    });
    // Steppers (§41.1): move the number and the running totals, no redraw.
    root.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = document.getElementById(b.dataset.step);
        var cap = liveMax[b.dataset.step] ? Math.min(Number(box.max), liveMax[b.dataset.step]()) : Number(box.max);
        var n = b.dataset.d === "max" ? cap : (Math.floor(Number(box.value)) || 0) + Number(b.dataset.d);
        if (Number(b.dataset.d) > 0) n = Math.min(n, Math.max(cap, Math.floor(Number(box.value)) || 0));
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
    // Take all on a prize's cargo (#35): every stepper to its top.
    root.querySelectorAll("[data-takeall]").forEach(function (b) {
      b.addEventListener("click", function () {
        b.dataset.takeall.split(" ").forEach(function (id) { var box = document.getElementById(id); if (box) box.value = box.max; });
        refreshTotals();
      });
    });
    // The weather chip's effects: hover on desktop, tap on a phone (#43).
    root.querySelectorAll("[data-wxtip]").forEach(function (w) {
      w.addEventListener("click", function (ev) { ev.stopPropagation(); toast(w.dataset.wxtip); });
    });
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
    // The prize screen's hull choice moves the hold bar (A7).
    root.querySelectorAll('input[type="radio"]').forEach(function (r) { r.addEventListener("change", refreshTotals); });
    // Collapsed cards remember being open across redraws (A12, B46).
    root.querySelectorAll("details[data-keep]").forEach(function (d) { d.addEventListener("toggle", function () { keepOpen[d.dataset.keep] = d.open; }); });
    refreshTotals();
  }
  var keepOpen = {};

  function start(rootEl) {
    root = rootEl;
    startRunLog();
    draw();
  }

  // The run log (Playtest Pins 0.9, PR A): it records from the moment the
  // game opens. Errors, failed pictures and console errors go in too, so a
  // playtest's bug comes with its trail.
  function startRunLog() {
    var RL = PC.runlog;
    if (!RL || typeof globalThis.addEventListener !== "function") return;
    RL.start();
    RL.note("Game opened · " + BUILD);
    globalThis.addEventListener("error", function (ev) {
      var t = ev && ev.target;
      if (t && t.tagName === "IMG") { RL.error("A picture failed to load: " + (t.getAttribute("alt") || "") + " · " + String(t.getAttribute("src") || "").slice(0, 80)); RL.save(); return; }
      RL.error((ev.message || "error") + (ev.filename ? " at " + ev.filename.split("/").pop() + ":" + ev.lineno : "") + (ev.error && ev.error.stack ? "\n" + ev.error.stack : "")); RL.save();
    }, true);
    globalThis.addEventListener("unhandledrejection", function (ev) { RL.error("Unhandled: " + (ev.reason && ev.reason.stack || ev.reason)); RL.save(); });
    var ce = console.error;
    console.error = function () {
      try { RL.error(Array.prototype.map.call(arguments, function (a) { return a && a.stack ? a.stack : String(a); }).join(" ")); RL.save(); } catch (e) { /* never let the log break the game */ }
      return ce.apply(console, arguments);
    };
  }

  function downloadRunLog() {
    var text = PC.runlog.exportText(state, BUILD);
    try {
      var blob = new Blob([text], { type: "text/plain" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pirate-chronicle-run-log-" + (state && state.world ? state.world.seed : "none") + ".txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      toast("Run log downloaded. Attach it in the playtest chat. (If nothing appeared, use Copy instead.)");
    } catch (e) { toast("Downloads are blocked here. Use Copy instead."); }
  }
  function copyRunLog() {
    var text = PC.runlog.exportText(state, BUILD);
    try { globalThis.navigator.clipboard.writeText(text).then(function () { toast("Run log copied. Paste it into the playtest chat."); }, function () { toast("Copying is blocked here. Use Export instead."); }); }
    catch (e) { toast("Copying is blocked here. Use Export instead."); }
  }

  PC.ui = { start: start };
})();
