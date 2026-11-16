/* Pirate Chronicle — the prologue screens (§40).
 *
 * Screen code, like js/ui.js: it draws the opening prologue before the
 * creator and the closing prologue after it, ported from the signed-off
 * preview (§40.1). The text and the chart's shapes are in content/prologue.js.
 *
 * Tap, click, Space, Enter or an arrow key advances; Back steps back a
 * paragraph; Skip is always there. Reduced motion (the Settings switch or
 * the device's) makes every fade instant.
 */
(function () {
  "use strict";
  var PC = (globalThis.PC = globalThis.PC || {});
  var NS = "http://www.w3.org/2000/svg";

  // opts: { kind: "opening" | "closing", reduce, tokens, home, assetUrl(path), onDone() }
  function play(root, opts) {
    var D = PC.data.prologue, CH = D.CHART;
    var SCREENS = opts.kind === "closing" ? D.CLOSING : D.OPENING;
    var reduce = !!opts.reduce;
    var tok = opts.tokens || {};
    function fill(html) { return html.replace(/\{([a-zA-Z.]+)\}/g, function (m, k) { return tok[k] != null ? tok[k] : m; }); }

    root.innerHTML =
      '<div class="pro" id="pstage" aria-live="polite">' +
      '<div class="pro-page" id="ppage"><div class="pro-layout"><div class="pro-mapbox">' +
      '<svg id="pmap" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Chart of the coast of North America in 1754"></svg>' +
      '<div class="pro-cartouche"><div class="a">A Chart of the Coasts</div><div class="b">of North America, 1754</div></div>' +
      '<svg class="pro-compass" viewBox="-36 -44 72 82"><circle r="24" fill="none" stroke="#8a6414" stroke-width=".9"/><path d="M0,-32L5,0L0,32L-5,0Z" fill="#c99f45" stroke="#8a6414" stroke-width=".7"/><path d="M-32,0L0,5L32,0L0,-5Z" fill="#efe3c6" stroke="#8a6414" stroke-width=".7"/><text y="-36" text-anchor="middle" font-family="IM Fell English SC,Georgia,serif" font-size="12" fill="#5e4528">N</text></svg>' +
      '</div><div class="pro-text" id="ptext"></div></div></div>' +
      '<div class="pro-night" id="pnight"><div class="pro-ntext"><div class="col" id="ntext"></div></div></div>' +
      '<button class="pro-chrome pro-back" id="pback" aria-label="Back">‹ Back</button>' +
      '<button class="pro-chrome pro-skip" id="pskip">Skip prologue</button>' +
      '<div class="pro-chrome pro-hint" id="phint"><span class="tri">▾</span> tap to continue</div></div>';

    var svg = root.querySelector("#pmap"), night = root.querySelector("#pnight"), page = root.querySelector("#ppage");
    var ntext = root.querySelector("#ntext"), ptext = root.querySelector("#ptext"), hint = root.querySelector("#phint"), stage = root.querySelector("#pstage");
    if (reduce) stage.classList.add("reduce-motion");

    // ---- The chart (a placeholder, drawn in code; §40.1) ----
    var K = 20, C = Math.cos(35 * Math.PI / 180), LON0 = -100, LAT0 = 53;
    function P(lon, lat) { return [(lon - LON0) * K * C, (LAT0 - lat) * K]; }
    function f1(n) { return n.toFixed(1); }
    function lin(pts, close) { return "M" + pts.map(function (p) { var q = P(p[0], p[1]); return f1(q[0]) + "," + f1(q[1]); }).join("L") + (close ? "Z" : ""); }
    function smooth(pts, close) {
      var q = pts.map(function (p) { return P(p[0], p[1]); }), n = q.length, d = "M" + f1(q[0][0]) + "," + f1(q[0][1]), last = close ? n : n - 1;
      for (var i = 0; i < last; i++) {
        var p0 = q[(i - 1 + n) % n], p1 = q[i], p2 = q[(i + 1) % n], p3 = q[(i + 2) % n];
        if (!close) { if (i === 0) p0 = p1; if (i + 2 >= n) p3 = p2; }
        d += "C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + "," + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " + f1(p2[0] - (p3[0] - p1[0]) / 6) + "," + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + "," + f1(p2[1]);
      }
      return d + (close ? "Z" : "");
    }
    function el(tag, a, parent, text) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (text != null) e.textContent = text; (parent || svg).appendChild(e); return e; }

    var landD = smooth(CH.MAINLAND, true) + Object.keys(CH.ISLANDS).map(function (k) { return smooth(CH.ISLANDS[k], true); }).join("");
    var bahD = CH.BAHAMAS.map(function (b) { var c = P(b[0], b[1]), rx = b[2] * K * C, ry = b[3] * K; return "M" + f1(c[0] - rx) + "," + f1(c[1]) + "a" + f1(rx) + "," + f1(ry) + " 0 1,0 " + f1(2 * rx) + ",0a" + f1(rx) + "," + f1(ry) + " 0 1,0 " + f1(-2 * rx) + ",0Z"; }).join("");
    var lakeD = CH.LAKES.map(function (l) { return smooth(l, true); }).join("");
    var defs = el("defs", {});
    var cp = el("clipPath", { id: "landclip" }, defs); el("path", { d: landD + bahD }, cp);
    var hf = el("pattern", { id: "hatchFr", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("rect", { width: 7, height: 7, fill: "#eceef2" }, hf); el("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "#2f3f6b", "stroke-width": 1.7, "stroke-opacity": 0.62 }, hf);
    var sp = el("pattern", { id: "sea", width: 26, height: 9, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M0,5 q3.25,-3 6.5,0 t6.5,0 t6.5,0 t6.5,0", fill: "none", stroke: "#8c6c3c", "stroke-width": 0.6, "stroke-opacity": 0.28 }, sp);
    el("rect", { x: -800, y: -400, width: 2400, height: 1600, fill: "#e6d8b6" });
    el("rect", { x: -800, y: -400, width: 2400, height: 1600, fill: "url(#sea)" });
    var grid = el("g", { stroke: "#8c6c3c", "stroke-width": 0.6, "stroke-opacity": 0.35, "stroke-dasharray": "2 4", fill: "none" });
    for (var lo = -120; lo <= -40; lo += 5) el("path", { d: lin([[lo, 64], [lo, 8]], false), "vector-effect": "non-scaling-stroke" }, grid);
    for (var la = 10; la <= 60; la += 5) el("path", { d: lin([[-128, la], [-36, la]], false), "vector-effect": "non-scaling-stroke" }, grid);
    el("path", { d: landD + bahD, fill: "none", stroke: "#8c6c3c", "stroke-width": 14, "stroke-opacity": 0.07, "stroke-linejoin": "round" });
    el("path", { d: landD + bahD, fill: "none", stroke: "#8c6c3c", "stroke-width": 6, "stroke-opacity": 0.12, "stroke-linejoin": "round" });
    el("path", { d: landD + bahD, fill: "#f3e9d0" });
    var COL = { frisia: "#a14c17", avalon: "#8a6414", sweden: "#3e5f8a" };
    var tg = el("g", { "clip-path": "url(#landclip)" }), TERR_EL = {};
    ["sweden", "avalon", "france", "frisia"].forEach(function (k) {
      var grp = el("g", { "class": "terr" }, tg);
      el("path", { d: lin(CH.TERR[k], true), fill: k === "france" ? "url(#hatchFr)" : COL[k], "fill-opacity": k === "france" ? 0.95 : 0.5 }, grp);
      TERR_EL[k] = grp;
    });
    ["cuba", "jamaica", "puertoRico"].forEach(function (k) { el("path", { d: smooth(CH.ISLANDS[k], true), fill: COL.frisia, "fill-opacity": 0.5 }, TERR_EL.frisia); });
    el("path", { d: bahD, fill: COL.frisia, "fill-opacity": 0.6 }, TERR_EL.frisia);
    el("path", { d: lakeD, fill: "#e6d8b6", stroke: "#5e4528", "stroke-width": 0.9, "vector-effect": "non-scaling-stroke" });
    el("path", { d: landD + bahD, fill: "none", stroke: "#4a3520", "stroke-width": 1.2, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" });

    // Marks and labels are anchored at their point and counter-scaled as the
    // camera zooms, so they stay readable.
    var PINS = [];
    function pin(lon, lat, parent, cls) { var p = P(lon, lat); var gr = el("g", { "class": cls || "" }, parent || svg); PINS.push({ g: gr, x: p[0], y: p[1] }); return gr; }
    function txt(parent, s, x, y, size, fillc, cls, anchor) { return el("text", { x: x, y: y, "font-size": size, fill: fillc, "class": cls + " halo", "text-anchor": anchor || "middle" }, parent, s); }
    var LBL = {};
    function label(k, lon, lat, big, small) {
      var gr = pin(lon, lat, null, "terr"); LBL[k] = gr;
      var col = { sweden: "#2c4566", avalon: "#5c430b", france: "#2f3f6b", frisia: "#6e310d" }[k];
      txt(gr, big, 0, 0, 27, col, "lbl"); if (small) txt(gr, small, 0, 22, 17, col, "lbl");
    }
    label("sweden", -76, 50.2, "SWEDEN", "Vinland");
    label("avalon", -81.8, 37.4, "AVALON", "Scottish North America");
    label("france", -99.2, 24.6, "FRANCE", "Louisiana · Mexico");
    label("frisia", -75.4, 28.4, "FRISIA", "Florida · the Bahamas · Cuba");
    function flame(gr, col) { return el("path", { d: "M0,-13c4,6 9,9 4.5,14c-1.5,3 -7.5,3 -9,0c-3,-4.5 1.5,-8 4.5,-14Z", fill: col || "#c99f45", stroke: "#7a2416", "stroke-width": 1.1 }, gr); }
    var CITY = CH.CITY, mk = el("g", {});
    var gJack = el("g", { "class": "mk" }, mk);
    ["pensacola", "mobile", "neworleans", "galveston", "campeche", "belize"].forEach(function (c) { flame(pin(CITY[c][0], CITY[c][1], gJack)); });
    var vg = pin(CITY.veracruz[0], CITY.veracruz[1], gJack);
    el("path", { d: "M-6,-6L6,6M6,-6L-6,6", stroke: "#7a2416", "stroke-width": 2.4, "stroke-linecap": "round" }, vg);
    txt(vg, "Veracruz · repulsed, 1751", 0, -14, 15, "#2a1c10", "chip", "middle");
    txt(pin(-89.8, 26.4, gJack), "Amber Jack’s raids, 1745–1751", 0, 0, 17, "#2a1c10", "chip");
    var gCF = el("g", { "class": "mk" }, mk), cfg = pin(-77.45, 33.45, gCF);
    el("path", { d: "M-9,-9L9,9M9,-9L-9,9", stroke: "#7a2416", "stroke-width": 3.2, "stroke-linecap": "round" }, cfg);
    txt(cfg, "Battle of Cape Fear", 14, 0, 17, "#2a1c10", "chip", "start"); txt(cfg, "July 1752", 14, 18, 15, "#5e4528", "chip", "start");
    // Routes: Deadman's two legs, or the voyage home-to-Ocracoke.
    var LEGS = opts.kind === "closing" ? [CH.HOME_LEGS[opts.home] || CH.HOME_LEGS.Charleston] : CH.LEGS;
    var gRoute = el("g", {}, mk), routes = [];
    LEGS.forEach(function (leg, i) {
      var d = smooth(leg, false), m = el("mask", { id: "rm" + i, maskUnits: "userSpaceOnUse", x: -800, y: -400, width: 2400, height: 1600 }, defs);
      var r = el("path", { d: d, fill: "none", stroke: "#fff", "stroke-width": 14, "stroke-linecap": "round" }, m);
      el("path", { d: d, fill: "none", stroke: "#7a2416", "stroke-width": 3, "stroke-dasharray": "1 8", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", mask: "url(#rm" + i + ")" }, gRoute);
      routes.push(r);
    });
    var gRM = el("g", {}, mk), RM = {};
    function rmark(key, city, line1, line2, dx, dy, anchor) {
      var gr = el("g", { "class": "mk" }, gRM); var pg = pin(CITY[city][0], CITY[city][1], gr); flame(pg, "#c0472f");
      txt(pg, line1, dx, dy, 17, "#2a1c10", "chip", anchor); if (line2) txt(pg, line2, dx, dy + 18, 15, "#5e4528", "chip", anchor); RM[key] = gr;
    }
    if (opts.kind === "closing") {
      var hc = (opts.home || "Charleston").toLowerCase();
      rmark("home", hc, opts.home || "Charleston", null, hc === "baltimore" ? -12 : -12, hc === "charleston" ? -16 : 8, "end");
    } else {
      rmark("bal", "baltimore", "Baltimore", "September 1752", -12, -4, "end");
      rmark("sav", "savannah", "Savannah", "June 1753", -12, 10, "end");
      rmark("cha", "charleston", "Charleston", "June 1753", 10, -26, "start");
    }
    var gOcr = el("g", { "class": "mk" }, mk), og = pin(CITY.ocracoke[0], CITY.ocracoke[1], gOcr);
    el("circle", { r: 14, fill: "none", stroke: "#7a2416", "stroke-width": 1.8, "class": "ocr-glow" }, og); el("circle", { r: 4.5, fill: "#7a2416" }, og);
    txt(og, "Ocracoke", 20, 6, 19, "#2a1c10", "chip", "start");

    // ---- The camera ----
    function box(v) { var a = P(v[0], v[3]), b = P(v[1], v[2]); return [a[0], a[1], b[0] - a[0], b[1] - a[1]]; }
    var VIEWS = {}; Object.keys(CH.VIEWS).forEach(function (k) { VIEWS[k] = box(CH.VIEWS[k]); });
    var cam = null, camTarget = null, camAnim = null;
    function fitAspect(v) {
      var W = svg.clientWidth || 800, H = svg.clientHeight || 700, a = W / H, x = v[0], y = v[1], w = v[2], h = v[3];
      if (w / h < a) { var nw = h * a; x -= (nw - w) / 2; w = nw; } else { var nh = w / a; y -= (nh - h) / 2; h = nh; }
      return [x, y, w, h];
    }
    function applyCam(v) {
      cam = v; svg.setAttribute("viewBox", v.map(f1).join(" "));
      var k = Math.pow(v[2] / VIEWS.full[2], 0.62);
      if ((svg.clientWidth || 800) < 520) k *= 1.25;
      PINS.forEach(function (p) { p.g.setAttribute("transform", "translate(" + f1(p.x) + "," + f1(p.y) + ") scale(" + k.toFixed(3) + ")"); });
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function setCamera(name, animate) {
      camTarget = name; var to = fitAspect(VIEWS[name]); if (camAnim) cancelAnimationFrame(camAnim);
      if (!animate || !cam || reduce) { applyCam(to); return; }
      var from = cam.slice(), t0 = performance.now(), dur = 1600;
      (function step(now) { var t = Math.min(1, (now - t0) / dur), e = ease(t); applyCam(from.map(function (a, i) { return a + (to[i] - a) * e; })); if (t < 1) camAnim = requestAnimationFrame(step); else camAnim = null; })(t0);
    }
    function onResize() { if (camTarget) applyCam(fitAspect(VIEWS[camTarget])); }
    globalThis.addEventListener("resize", onResize);
    routes.forEach(function (r) { var L = r.getTotalLength(); r.style.strokeDasharray = L; r.style.strokeDashoffset = L; r.dataset.len = L; });

    // ---- Sequencing ----
    var timers = [];
    function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); fn(); }, reduce ? 0 : ms); timers.push(id); }
    function finishTimers() { timers.forEach(function (id) { clearTimeout(id); }); timers = []; }
    var hintTimer = null;
    function showHintSoon(on) { clearTimeout(hintTimer); hint.classList.remove("in"); if (on) hintTimer = setTimeout(function () { hint.classList.add("in"); }, reduce ? 0 : 1500); }
    function animRoute(i, ms, onDone) {
      var r = routes[i], L = +r.dataset.len; r.style.transition = "none"; r.style.strokeDashoffset = L; r.getBoundingClientRect();
      r.style.transition = reduce ? "none" : "stroke-dashoffset " + ms + "ms ease-in-out"; r.style.strokeDashoffset = 0; if (onDone) later(onDone, ms);
    }
    function setRoute(i, on) { var r = routes[i]; r.style.transition = "none"; r.style.strokeDashoffset = on ? 0 : r.dataset.len; }
    function show(gr, on) { if (gr) gr.classList.toggle("in", !!on); }
    function lit(p, on) { var s = root.querySelector(".pw-" + p); if (s) s.classList.toggle("lit", on); }
    var powers = ["frisia", "avalon", "sweden", "france"];

    var ORDER = opts.kind === "closing" ? ["home", "sail"] : ["powers", "jackRaids", "capeFear", "route", "dawn", "ocracoke"];
    var CAMERA = opts.kind === "closing" ? { home: "home", sail: "home" } : { powers: "full", jackRaids: "gulf", capeFear: "capeFear", route: "route", dawn: "coast", ocracoke: "coast" };
    function applyState(cue, animate) {
      finishTimers();
      var n = cue ? ORDER.indexOf(cue) : -1;
      if (n >= 0) setCamera(CAMERA[cue], animate);
      if (opts.kind === "closing") {
        powers.forEach(function (p) { show(TERR_EL[p], n >= 0); show(LBL[p], false); });
        show(RM.home, n >= 0);
        if (n === 1 && animate) { setRoute(0, false); show(gOcr, false); animRoute(0, 3000, function () { show(gOcr, true); }); }
        else { setRoute(0, n >= 1); show(gOcr, n >= 1); }
        return;
      }
      if (n === 0 && animate) {
        powers.forEach(function (p, i) {
          show(TERR_EL[p], false); show(LBL[p], false); lit(p, false);
          later(function () { show(TERR_EL[p], true); show(LBL[p], true); lit(p, true); }, 700 + i * 1100);
        });
      } else powers.forEach(function (p) { show(TERR_EL[p], n >= 0); show(LBL[p], n >= 0); lit(p, n >= 0); });
      show(gJack, n === 1); show(gCF, n === 2);
      var R = [RM.bal, RM.sav, RM.cha];
      if (n === 3 && animate) {
        R.forEach(function (m) { show(m, false); }); [0, 1].forEach(function (i) { setRoute(i, false); });
        later(function () {
          animRoute(0, 2800, function () {
            show(RM.bal, true);
            later(function () { animRoute(1, 3200, function () { show(RM.cha, true); }); }, 700);
            later(function () { show(RM.sav, true); }, 700 + 2900);
          });
        }, 1200);
      } else { [0, 1].forEach(function (i) { setRoute(i, n >= 3); }); R.forEach(function (m) { show(m, n >= 3); }); }
      gRoute.style.transition = gRM.style.transition = "opacity 1s"; gRoute.style.opacity = n >= 4 ? 0.35 : 1; gRM.style.opacity = n >= 4 ? 0.4 : 1;
      show(gOcr, n >= 5);
    }

    var si = 0, pi = -1, busy = false, done = false;
    function lastCueUpTo(s, p) { var c = null; for (var i = 0; i <= s; i++) { var ps = SCREENS[i].paras, lim = i === s ? p : ps.length - 1; for (var j = 0; j <= lim; j++) if (ps[j] && ps[j].cue) c = ps[j].cue; } return c; }
    function setBg(bg) { var paper = bg === "page"; night.classList.toggle("gone", paper); page.classList.toggle("on", paper); stage.classList.toggle("paper", paper); }
    function boxFor() { return SCREENS[si].bg === "page" ? ptext : ntext; }
    function buildScreen() {
      var sc = SCREENS[si], bx = boxFor(); ntext.innerHTML = ""; ptext.innerHTML = "";
      if (sc.portrait) {
        var f = document.createElement("figure"); f.className = "oil";
        f.innerHTML = '<div class="frame"><img alt="" src="' + opts.assetUrl(sc.portrait.src) + '"></div><figcaption>' + sc.portrait.cap + "<br><i>" + sc.portrait.sub + "</i></figcaption>";
        bx.appendChild(f);
      }
      sc.paras.forEach(function (pa) {
        var p = document.createElement("p"); p.className = "t" + (pa.cls ? " " + pa.cls : ""); p.innerHTML = fill(pa.html); bx.appendChild(p);
        if (pa.rule) {
          var r = document.createElementNS(NS, "svg"); r.setAttribute("viewBox", "0 0 220 18"); r.setAttribute("class", "year-rule");
          r.innerHTML = '<line x1="0" y1="9" x2="96" y2="9" stroke="#c99f45"/><path d="M110,3L116,9L110,15L104,9Z" fill="#7a2416" stroke="#c99f45" stroke-width=".8"/><line x1="124" y1="9" x2="220" y2="9" stroke="#c99f45"/>';
          bx.appendChild(r);
        }
      });
      var end = sc.paras.filter(function (x) { return x.end; })[0];
      if (end) {
        var b = document.createElement("div"); b.innerHTML = '<button class="pro-end" id="pend">' + end.end + " ›</button>"; bx.appendChild(b);
        b.querySelector("button").addEventListener("click", function (e) { e.stopPropagation(); finish(); });
      }
    }
    function revealPara(j, animate) {
      var bx = boxFor(), ps = bx.querySelectorAll("p.t");
      bx.getBoundingClientRect();
      requestAnimationFrame(function () {
        for (var k = 0; k < ps.length; k++) ps[k].classList.toggle("in", k <= j);
        var fig = bx.querySelector("figure.oil"); if (fig) fig.classList.add("in");
        var r = bx.querySelector(".year-rule"); if (r && SCREENS[si].paras[j] && SCREENS[si].paras[j].rule) r.classList.add("in");
      });
      var pa = SCREENS[si].paras[j];
      if (pa && pa.cue) applyState(pa.cue, animate); else if (SCREENS[si].bg === "page") applyState(lastCueUpTo(si, j), false);
      var eb = root.querySelector("#pend"); if (eb) eb.classList.toggle("show", !!(pa && pa.end));
      showHintSoon(!(pa && pa.end));
    }
    function revealWithPartner(animate) {
      revealPara(pi, animate);
      var nx = SCREENS[si].paras[pi + 1];
      if (nx && nx.with) { pi += 1; var keep = pi; later(function () { if (pi === keep) revealPara(keep, false); }, 1100); }
    }
    function enterScreen(ns, np, animate, first) {
      busy = true; finishTimers(); showHintSoon(false);
      if (!first) Array.prototype.forEach.call(boxFor().querySelectorAll("p.t,figure.oil"), function (p) { p.classList.remove("in"); });
      var bgChange = first || SCREENS[ns].bg !== SCREENS[si].bg;
      setTimeout(function () {
        si = ns; buildScreen(); setBg(SCREENS[si].bg);
        if (SCREENS[si].bg === "page" && !cam) applyCam(fitAspect(VIEWS[opts.kind === "closing" ? "home" : "full"]));
        if (SCREENS[si].bg !== "page" && opts.kind !== "closing") applyState(null, false);
        setTimeout(function () { pi = np; revealWithPartner(animate); busy = false; }, (!animate || reduce) ? 0 : (bgChange ? (first ? 700 : 900) : 150));
      }, (!animate || reduce || first) ? 0 : 900);
    }
    function advance() {
      if (busy || done) return;
      if (timers.length) {
        finishTimers(); var pa = SCREENS[si].paras[pi]; if (pa && pa.cue) applyState(pa.cue, false);
        Array.prototype.forEach.call(boxFor().querySelectorAll("p.t"), function (p, k) { if (k <= pi) p.classList.add("in"); });
        showHintSoon(true); return;
      }
      if (pi < SCREENS[si].paras.length - 1) { pi += 1; revealWithPartner(true); return; }
      if (si < SCREENS.length - 1) enterScreen(si + 1, 0, true);
    }
    function goBack() {
      if (busy) return; finishTimers();
      if (pi > 0 && !SCREENS[si].paras[pi].with) { pi -= 1; revealPara(pi, false); return; }
      if (si > 0) { var ns = si - 1; enterScreen(ns, SCREENS[ns].paras.length - 1, false); }
    }
    function cleanup() {
      done = true; finishTimers(); clearTimeout(hintTimer);
      globalThis.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    }
    function finish() { if (done) return; cleanup(); opts.onDone(); }
    function onKey(e) {
      if (done) return;
      if ([" ", "Enter", "ArrowRight", "ArrowDown"].indexOf(e.key) >= 0) { e.preventDefault(); advance(); }
      if (["ArrowLeft", "ArrowUp", "Backspace"].indexOf(e.key) >= 0) { e.preventDefault(); goBack(); }
      if (e.key === "Escape") finish();
    }
    stage.addEventListener("click", function () { advance(); });
    root.querySelector("#pback").addEventListener("click", function (e) { e.stopPropagation(); goBack(); });
    root.querySelector("#pskip").addEventListener("click", function (e) { e.stopPropagation(); finish(); });
    document.addEventListener("keydown", onKey);
    if (opts.kind === "closing") root.querySelector("#pskip").textContent = "Skip";
    // A beat of darkness before the first words.
    setTimeout(function () { if (!done) enterScreen(0, 0, true, true); }, reduce ? 0 : 700);
    return { stop: cleanup };
  }

  PC.prologue = { play: play };
})();
