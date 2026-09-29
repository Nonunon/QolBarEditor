// SPDX-License-Identifier: AGPL-3.0-or-later
// The interactive fullscreen preview and its live editing.
"use strict";

/* fullscreen */
let FS = null;
function chevSvg(dir){ const s = svg(ICONS.chev, 11); s.style.transform = `rotate(${{right: 0, down: 90, left: 180, up: 270}[dir]}deg)`; return s; }
function openFullscreen(){
  if (!S.doc || FS) return;
  closePop();
  const stage = h("div", {class: "fs-stage"});
  const exact = h("span", {class: "chip plain"});
  // Toolbar floats over the screen and slides up when idle, leaving a small tab
  const barTab = h("button", {class: "fs-tab", tip: "Show / pin the controls", onclick: () => { FS.barPinned = !FS.barPinned; showBar(); }}, chevSvg("down"));
  const bar = h("div", {class: "fs-top"},
    h("b", null, "Live preview"),
    dropdown({value: PV.res, width: "140px", options: RESOLUTIONS.map(r => ({value: r, label: r.replace("x", " × ")})), onChange: v => { PV.res = v; store("pv.res", v); paintFullscreen(); }}),
    h("span", {class: "dim"}, "UI scale"), numInput(PV.ui, v => { PV.ui = v || 1; store("pv.ui", PV.ui); paintFullscreen(); }, {float: true, step: .05, min: .25, max: 4, noUndo: true, width: "64px"}),
    exact,
    h("span", {class: "faint", style: {fontSize: "12.5px"}}, "Click shortcuts to run them · right-click, ✎ or a bar's dark edge to edit · screen edges reveal hidden bars · Ctrl+Z undo · Esc exits"),
    h("span", {class: "spacer"}),
    h("button", {class: "btn sm", onclick: () => { FS.toggled.clear(); FS.counters.clear(); paintFullscreen(); }}, "Reset"),
    h("button", {class: "btn sm primary", onclick: closeFullscreen}, "Close"),
    barTab);
  // Log slides into the right edge behind a tab, can be resized from its left and bottom edges, and its text can be selected
  const logBody = h("div", {class: "fs-log-body"});
  const logTab = h("button", {class: "fs-logtab", tip: "Show / hide the preview log", onclick: () => setLogHidden(!FS.logHidden)});
  const log = h("div", {class: "fs-log"},
    logTab,
    h("div", {class: "fs-log-hd"}, h("b", {style: {flex: 1}}, "Preview log"),
      h("button", {class: "btn sm ghost", tip: "Copy the whole log", onclick: () => navigator.clipboard.writeText(FS.chat.map(([t, x]) => `[${t}] ${x}`).join("\n")).then(() => toast("Log copied"))}, svg(ICONS.copy), "Copy"),
      h("button", {class: "btn sm ghost", onclick: () => { FS.chat = []; paintChat(); }}, "Clear")),
    logBody,
    h("div", {class: "grip grip-l"}), h("div", {class: "grip grip-b"}), h("div", {class: "grip grip-bl"}));
  const root = h("div", {class: "fs"}, stage, bar, log);
  document.body.append(root);
  root.append($("#tip"), $("#toasts")); // so tooltips and toasts still show inside browser fullscreen
  FS = {root, stage, bar, log, logBody, logTab, exact, counters: new Map(), toggled: new Set(), popups: [], chat: [], entries: [], scr: null, scale: 1, barPinned: false, barTimer: 0, logHidden: store("pv.loghide") === "1"};
  const w = +store("pv.logw") || 380, hh = +store("pv.logh") || 260;
  Object.assign(log.style, {width: w + "px", height: hh + "px"});
  wireLogResize(log);
  setLogHidden(FS.logHidden);
  // Toolbar visibility: shown near the top edge or while hovered, hidden 1.5s after the mouse leaves
  bar.addEventListener("mouseenter", () => { clearTimeout(FS.barTimer); showBar(); });
  bar.addEventListener("mouseleave", () => scheduleHideBar(1500));
  root.addEventListener("mousemove", e => { if (e.clientY < 10) showBar(); });
  showBar(); scheduleHideBar(2500);
  document.addEventListener("keydown", fsKey, true);
  document.addEventListener("fullscreenchange", onFsChange);
  addEventListener("resize", fitFullscreen);
  // True fullscreen (like F11). Falls back to filling the window if the browser refuses.
  root.requestFullscreen?.().then(() => FS && (FS.wentFull = true)).catch(() => {});
  paintFullscreen();
}
function showBar(){ if (!FS) return; FS.bar.classList.remove("hide"); FS.bar.querySelector(".fs-tab").replaceChildren(chevSvg(FS.barPinned ? "up" : "down")); if (FS.barPinned) clearTimeout(FS.barTimer); }
function scheduleHideBar(ms){
  if (!FS) return; clearTimeout(FS.barTimer);
  FS.barTimer = setTimeout(() => { if (!FS || FS.barPinned || (POP && FS.bar.contains(POP.anchor)) || FS.bar.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return scheduleHideBar(1000); FS.bar.classList.add("hide"); }, ms);
}
function setLogHidden(hide){
  FS.logHidden = hide; store("pv.loghide", hide ? "1" : "0");
  FS.log.classList.toggle("hide", hide);
  FS.logTab.replaceChildren(chevSvg(hide ? "left" : "right"));
}
function wireLogResize(log){
  const drag = (grip, fn) => grip.addEventListener("pointerdown", e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const r0 = log.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    grip.onpointermove = m => fn(r0, m.clientX - x0, m.clientY - y0);
    grip.onpointerup = () => { grip.onpointermove = null; store("pv.logw", Math.round(log.offsetWidth)); store("pv.logh", Math.round(log.offsetHeight)); };
  });
  const setW = (r0, dx) => log.style.width = Math.max(220, Math.min(innerWidth - 40, r0.width - dx)) + "px";
  const setH = (r0, dy) => log.style.height = Math.max(120, Math.min(innerHeight - r0.top - 10, r0.height + dy)) + "px";
  drag(log.querySelector(".grip-l"), (r0, dx) => setW(r0, dx));
  drag(log.querySelector(".grip-b"), (r0, dx, dy) => setH(r0, dy));
  drag(log.querySelector(".grip-bl"), (r0, dx, dy) => { setW(r0, dx); setH(r0, dy); });
}
function onFsChange(){ if (FS && FS.wentFull && !document.fullscreenElement) closeFullscreen(); else fitFullscreen(); }
function closeFullscreen(){
  if (!FS) return;
  const f = FS; FS = null;
  document.removeEventListener("keydown", fsKey, true);
  document.removeEventListener("fullscreenchange", onFsChange);
  removeEventListener("resize", fitFullscreen);
  clearTimeout(f.barTimer); closePop();
  document.body.append($("#tip"), $("#toasts"));
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  f.root.remove();
  paintMicro();
}
function fitFullscreen(){
  if (!FS || !FS.scr) return;
  const {W, H} = pvSize(), sw = FS.stage.clientWidth, sh = FS.stage.clientHeight, dpr = devicePixelRatio || 1;
  let s = Math.min(sw / W, sh / H);
  // When the screen is (nearly) the preview resolution, snap to exactly one image pixel per screen pixel
  const oneToOne = Math.abs(s * dpr - 1) < 0.03;
  if (oneToOne) s = 1 / dpr;
  FS.scale = s;
  const snap = v => Math.round(v * dpr) / dpr;
  Object.assign(FS.scr.style, {transform: `scale(${s})`, left: snap((sw - W * s) / 2) + "px", top: snap((sh - H * s) / 2) + "px"});
  FS.scr.style.setProperty("--fs-scale", s);
  FS.exact.textContent = oneToOne ? "1:1 pixels" : `${Math.round(s * dpr * 100)}% of real size`;
  FS.exact.className = "chip " + (oneToOne ? "mode" : "plain");
  FS.exact.dataset.tip = oneToOne ? "Every game pixel is one screen pixel, so this matches what you'd see in game." : `Your screen isn't ${W} × ${H}, so the preview is scaled. Text looks crisper or blurrier than in game, but sizes and positions are still correct relative to each other.`;
}
function paintFullscreen(){
  FS.popups = [];
  const {scr, entries} = buildScreen({interactive: true});
  FS.scr = scr; FS.entries = entries;
  const tip = h("div", {class: "g-tip", style: {display: "none", fontSize: 15 * PV.ui + "px"}});
  scr.append(tip); FS.tip = tip;
  FS.stage.replaceChildren(scr);
  fitFullscreen();
  paintChat();
  const toScreen = e => { const r = scr.getBoundingClientRect(); return {x: (e.clientX - r.left) / FS.scale, y: (e.clientY - r.top) / FS.scale}; };
  const rectOf = el => { const r = el.getBoundingClientRect(), s = scr.getBoundingClientRect(); return {x0: (r.left - s.left) / FS.scale, y0: (r.top - s.top) / FS.scale, x1: (r.right - s.left) / FS.scale, y1: (r.bottom - s.top) / FS.scale}; };
  FS.rectOf = rectOf;
  scr.addEventListener("mousemove", e => {
    const pt = toScreen(e), inR = r => pt.x >= r.x0 && pt.x < r.x1 && pt.y >= r.y0 && pt.y < r.y1;
    for (const en of FS.entries) {
      if (en.bar.v === 2) continue;
      const shown = {x0: en.g.x, y0: en.g.y, x1: en.g.x + en.g.w, y1: en.g.y + en.g.h};
      setRevealed(en, inR(en.g.reveal) || (en.revealed && inR(shown)) || pinnedBar(en.bar));
    }
    // Pencil handle over the hovered button, else over the hovered bar
    const b = e.target.closest(".g-btn"), barEl = e.target.closest(".g-bar"), popEl = e.target.closest(".g-pop");
    if (b && b._sh) showHandle(b._sh, b);
    else if (barEl) showHandle(FS.entries.find(en => en.el === barEl)?.bar, barEl);
    else if (popEl) showHandle(FS.popups.find(p => p.el === popEl)?.sh, popEl);
    else hideHandle(400);
  });
  scr.addEventListener("mouseleave", () => { for (const en of FS.entries) if (en.bar.v !== 2) setRevealed(en, pinnedBar(en.bar)); tip.style.display = "none"; hideHandle(400); });
  // Right-click edits, like in game
  scr.addEventListener("contextmenu", e => {
    e.preventDefault();
    const b = e.target.closest(".g-btn"), barEl = e.target.closest(".g-bar"), popEl = e.target.closest(".g-pop");
    if (b && b._sh) openEditPanel(b._sh, b);
    else if (barEl) openEditPanel(FS.entries.find(en => en.el === barEl)?.bar, barEl);
    else if (popEl) openEditPanel(FS.popups.find(p => p.el === popEl)?.sh, popEl);
  });
  scr.addEventListener("click", e => {
    const b = e.target.closest(".g-btn");
    if (!b || !b._sh) {
      const barEl = e.target.closest(".g-bar");
      if (barEl) return openEditPanel(FS.entries.find(en => en.el === barEl)?.bar, barEl); // the dark zone around buttons edits the bar
      if (!e.target.closest(".g-pop")) { closePopups(0); closeEditPanel(); }
      return;
    }
    const barEl = b.closest(".g-bar"), popEl = b.closest(".g-pop");
    const bar = barEl ? FS.entries.find(en => en.el === barEl)?.bar : FS.popups.find(p => p.el === popEl)?.bar;
    const depth = popEl ? FS.popups.findIndex(p => p.el === popEl) + 1 : 0;
    activate(b._sh, b, bar, depth, popEl ? FS.popups[depth - 1].sh : null);
  });
  scr.addEventListener("mouseover", e => {
    const b = e.target.closest(".g-btn");
    if (!b || !b._sh) { tip.style.display = "none"; return; }
    const sh = b._sh, p = parseName(sh.n);
    const cmd = sh.t !== 2 ? sh.c.split("\n").filter(l => l.trim()).slice(0, 6).join("\n") : "";
    if (!p.hasTooltip && !cmd) { tip.style.display = "none"; }
    else {
      tip.replaceChildren(...[p.hasTooltip ? h("div", null, p.tooltip) : null, cmd ? h("div", {class: "c"}, cmd) : null].filter(Boolean));
      const r = rectOf(b); tip.style.display = "";
      const {W, H} = pvSize();
      tip.style.left = Math.min(r.x0, W - tip.offsetWidth - 4) + "px";
      tip.style.top = (r.y1 + 6 + tip.offsetHeight > H ? r.y0 - tip.offsetHeight - 6 : r.y1 + 6) + "px";
    }
    if (sh.t === 1 && sh.cH && sh.m === 0) {
      const barEl = b.closest(".g-bar"), popEl = b.closest(".g-pop");
      const bar = barEl ? FS.entries.find(en => en.el === barEl)?.bar : FS.popups.find(p2 => p2.el === popEl)?.bar;
      const depth = popEl ? FS.popups.findIndex(p2 => p2.el === popEl) + 1 : 0;
      if (FS.popups[depth]?.sh !== sh) openCategory(sh, b, bar, depth);
    }
  });
}
/* ---------- live editing inside fullscreen ----------
   Right-click a button or bar, click a bar's dark background, or use the hover pencil to edit in place. */
// now = structural change (full redraw). Otherwise: at most once per animation frame, move/redraw only
// what changed, so dragging a number slides the bar smoothly instead of updating when you stop.
function fsRefresh(now){
  if (!FS) return;
  if (now) { cancelAnimationFrame(FS.raf); FS.raf = 0; clearTimeout(FS.refreshT); FS.refreshT = setTimeout(() => { if (!FS) return; paintFullscreen(); markEditing(); FS.editPanel?.querySelector(".card")?._paint?.(); }, 0); return; }
  if (FS.raf) return;
  FS.raf = requestAnimationFrame(() => {
    if (!FS) return; FS.raf = 0;
    if (!patchScreen(FS.scr, FS.entries, true, null)) paintFullscreen();
    markEditing();
    FS.editPanel?.querySelector(".card")?._paint?.();
  });
}
const editBar = () => !FS?.editTarget ? null : S.doc.BarCfgs.includes(FS.editTarget) ? FS.editTarget : IDX.get(FS.editTarget)?.bar;
const pinnedBar = bar => !!FS && ((FS.popups[0]?.bar === bar) || FS.pinBar === bar || editBar() === bar);
function markEditing(){
  if (!FS?.scr) return;
  FS.scr.querySelectorAll(".editing").forEach(e => e.classList.remove("editing"));
  const t = FS.editTarget; if (!t) return;
  const el = S.doc.BarCfgs.includes(t) ? FS.entries.find(en => en.bar === t)?.el : [...FS.scr.querySelectorAll(".g-btn")].find(b => b._sh === t);
  el?.classList.add("editing");
  for (const en of FS.entries) if (en.bar.v !== 2 && pinnedBar(en.bar)) setRevealed(en, true);
}
function closeEditPanel(){
  if (!FS?.editPanel) return;
  FS.editPanel.remove(); FS.editPanel = null; FS.editTarget = null; closePop(); markEditing();
}
function openEditPanel(target, anchorEl, keepPos){
  if (!FS) return;
  const old = FS.editPanel, oldPos = old && keepPos ? {left: old.style.left, top: old.style.top} : null;
  old?.remove(); closePop();
  if (!IDX.has(target)) { FS.editPanel = null; FS.editTarget = null; return; }
  const isBar = IDX.get(target).kind === "bar";
  FS.editTarget = target;
  const title = h("b", {style: {flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}, isBar ? `Bar: ${target.n || "(unnamed)"}` : (displayName(target) || "(blank)"));
  const hd = h("div", {class: "fs-edit-hd"}, title,
    h("button", {class: "btn sm ghost", tip: "Leave fullscreen and open this in the full editor", onclick: () => { const t = target; closeFullscreen(); goTo(t); }}, "Full editor"),
    h("button", {class: "btn sm ghost icon", tip: "Close (Esc)", onclick: closeEditPanel}, svg(ICONS.x)));
  const body = h("div", {class: "fs-edit-body"}, isBar ? barQuick(target, title) : shQuick(target, title));
  const panel = h("div", {class: "fs-edit"}, hd, body);
  FS.root.append(panel); FS.editPanel = panel;
  // Drag by the header
  hd.addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;
    hd.setPointerCapture(e.pointerId);
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    hd.onpointermove = m => Object.assign(panel.style, {left: Math.max(0, Math.min(innerWidth - 60, m.clientX - dx)) + "px", top: Math.max(0, Math.min(innerHeight - 40, m.clientY - dy)) + "px"});
    hd.onpointerup = () => hd.onpointermove = null;
  });
  // Place next to the element, on whichever side has room
  if (oldPos) Object.assign(panel.style, oldPos);
  else {
    const r = (anchorEl || document.body).getBoundingClientRect(), pw = panel.offsetWidth, ph = panel.offsetHeight;
    const left = r.right + 14 + pw < innerWidth ? r.right + 14 : Math.max(8, r.left - pw - 14);
    Object.assign(panel.style, {left: left + "px", top: Math.max(8, Math.min(innerHeight - ph - 8, r.top - 20)) + "px"});
  }
  markEditing();
}
const qrow = (label, ctl) => [h("label", {class: "flabel"}, label), ctl];
function shQuick(sh, title){
  const m = IDX.get(sh), list = m.list, p = parseName(sh.n);
  const upd = () => { sh.n = buildName(p); title.textContent = displayName(sh) || "(blank)"; touch(); };
  const set = (fn, rebuild) => { commit(); fn(); touch(); if (rebuild) openEditPanel(sh, null, true); };
  const iconNum = numInput(p.icon, v => { p.iconRaw = String(v); p.icon = v; upd(); }, {width: "90px"});
  iconNum.style.display = p.hasIcon ? "" : "none";
  const grid = h("div", {class: "grid"},
    ...qrow("Label", textInput(p.label, v => { p.label = v.replace(/::|##/g, ""); upd(); }, {placeholder: p.hasIcon ? "optional" : "button text"})),
    ...qrow("Icon", h("div", {class: "inline"}, toggle(p.hasIcon, on => { p.hasIcon = on; if (on && !p.iconRaw) p.iconRaw = "0"; iconNum.style.display = on ? "" : "none"; upd(); }), iconNum, h("button", {class: "btn sm", tip: "Browse and search every icon", onclick: () => browseIcon(sh, () => openEditPanel(sh, null, true))}, "Browse..."))),
    ...qrow("Tooltip", textInput(p.tooltip, v => { p.tooltip = v; p.hasTooltip = v !== ""; upd(); }, {placeholder: "hover text (optional)"})),
    ...qrow("Type", seg(sh.t, [[0, "Command"], [1, "Category"], [2, "Spacer"]], v => set(() => { sh.t = v; if (v === 1) sh.sL ??= []; }, true))),
    ...(sh.t !== 2 ? qrow("Command", textInput(sh.c, v => { sh.c = v; touch(); }, {multiline: true, autosize: true, rows: 2})) : []),
    ...qrow("Mode", seg(sh.m, [[0, "Default"], [1, "Incremental"], [2, "Random"]], v => set(() => sh.m = v))),
    ...qrow("Hotkey", hotkeyInput(sh.k, v => set(() => sh.k = v))),
    ...qrow("Color", h("div", {class: "inline"}, colorInput(sh.cl, v => { sh.cl = v; touch(); }), dropdown({value: sh.clA, width: "150px", options: ANIMS.map((a, i) => ({value: i, label: a})), onChange: v => set(() => sh.clA = v)}))));
  const add = (type, into) => {
    const n = makeShortcut({t: type, sL: type === 1 ? [] : null, n: type === 0 ? "New shortcut" : type === 1 ? "New category" : ""});
    mutate(() => { const L = into ? (sh.sL ??= []) : list; L.splice(into ? L.length : L.indexOf(sh) + 1, 0, n); });
    openEditPanel(n, FS.editPanel, true);
  };
  const move = d => { const i = list.indexOf(sh), j = i + d; if (j < 0 || j >= list.length) return; mutate(() => { list.splice(i, 1); list.splice(j, 0, sh); }); openEditPanel(sh, null, true); };
  return [grid,
    h("div", {class: "inline", style: {marginTop: "12px"}},
      h("button", {class: "btn sm", tip: "Move earlier in the bar", disabled: list.indexOf(sh) === 0, onclick: () => move(-1)}, chevSvg("left")),
      h("button", {class: "btn sm", tip: "Move later in the bar", disabled: list.indexOf(sh) === list.length - 1, onclick: () => move(1)}, chevSvg("right")),
      h("button", {class: "btn sm", onclick: () => add(0)}, svg(ICONS.plus), "Shortcut after"),
      sh.t === 1 ? h("button", {class: "btn sm", onclick: () => add(0, true)}, svg(ICONS.plus), "Shortcut inside") : null,
      h("button", {class: "btn sm", onclick: () => { duplicate([sh]); const c = list[list.indexOf(sh) + 1]; if (c) openEditPanel(c, null, true); }}, "Duplicate"),
      h("button", {class: "btn sm danger", tip: "Delete (undo with Ctrl+Z)", onclick: () => { mutate(() => { list.splice(list.indexOf(sh), 1); }); closeEditPanel(); toast("Deleted. Ctrl+Z to undo."); }}, svg(ICONS.trash)))];
}
function barQuick(bar, title){
  const sets = S.doc.CndSetCfgs;
  const set = (fn, rebuild) => { commit(); fn(); touch(); if (rebuild) openEditPanel(bar, null, true); };
  const grid = h("div", {class: "grid"},
    ...qrow("Name", textInput(bar.n, v => { const was = bar.n; bar.n = v; renameInTricks(was, v); title.textContent = `Bar: ${v || "(unnamed)"}`; touch(); })),
    ...qrow("Show when", dropdown({value: bar.c, width: "100%", options: [{value: -1, label: "Always"}, ...sets.map((s, i) => ({value: i, label: `#${i + 1} ${s.n || "(unnamed)"}`}))], onChange: v => set(() => bar.c = v)})),
    ...qrow("Hidden", toggle(bar.h, v => set(() => bar.h = v), "Hide this bar")),
    ...qrow("Dock", seg(bar.d, DOCK.map((d, i) => [i, d]), v => set(() => bar.d = v, true))),
    ...(bar.d !== 4 ? qrow("Alignment", seg(bar.a, ALIGN.map((d, i) => [i, d]), v => set(() => bar.a = v))) : []),
    ...qrow("Visibility", seg(bar.v, VISIBILITY.map((d, i) => [i, d]), v => set(() => bar.v = v))),
    ...qrow("Layout", h("div", {class: "inline"},
      h("span", {class: "dim"}, "width"), numInput(bar.bW, v => { bar.bW = v; touch(); }, {min: 0, max: 2000, width: "64px"}),
      h("span", {class: "dim"}, "cols"), numInput(bar.co, v => { bar.co = v; touch(); }, {min: 0, max: 200, width: "52px"}),
      h("span", {class: "dim"}, "gap"), numInput(bar.sp[0], v => { bar.sp[0] = v; touch(); }, {min: 0, width: "48px"}), numInput(bar.sp[1], v => { bar.sp[1] = v; touch(); }, {min: 0, width: "48px"}))),
    ...qrow("Scale", h("div", {class: "inline"}, numInput(bar.s, v => { bar.s = v; touch(); }, {float: true, step: .05, min: 0, width: "64px"}), h("span", {class: "dim"}, "font"), numInput(bar.fS, v => { bar.fS = v; touch(); }, {float: true, step: .05, min: 0, width: "64px"}))));
  const add = type => {
    const n = makeShortcut({t: type, sL: type === 1 ? [] : null, n: type === 0 ? "New shortcut" : type === 1 ? "New category" : ""});
    mutate(() => bar.sL.push(n));
    openEditPanel(n, FS.editPanel, true);
  };
  return [grid,
    h("div", {class: "inline", style: {marginTop: "12px"}},
      h("button", {class: "btn sm", onclick: () => add(0)}, svg(ICONS.plus), "Shortcut"),
      h("button", {class: "btn sm", onclick: () => add(1)}, svg(ICONS.plus), "Category"),
      h("button", {class: "btn sm", onclick: () => add(2)}, svg(ICONS.plus), "Spacer"),
      h("button", {class: "btn sm", onclick: () => { let c; mutate(() => { c = structuredClone(bar); c.n += " (copy)"; S.doc.BarCfgs.splice(S.doc.BarCfgs.indexOf(bar) + 1, 0, c); }); openEditPanel(c, null, true); toast("Duplicated. It sits on top of the original until you move it."); }}, "Duplicate bar"),
      h("button", {class: "btn sm danger", tip: "Delete bar (undo with Ctrl+Z)", onclick: () => { mutate(() => S.doc.BarCfgs.splice(S.doc.BarCfgs.indexOf(bar), 1)); closeEditPanel(); toast("Bar deleted. Ctrl+Z to undo."); }}, svg(ICONS.trash))),
    pixelCard(bar, () => {})];
}
// Floating pencil that follows whatever editable thing the mouse is over
function showHandle(target, el){
  if (!FS) return;
  clearTimeout(FS.handleT);
  let hd = FS.handle;
  if (!hd) {
    hd = FS.handle = h("button", {class: "fs-handle", onclick: () => { const t = hd._t; if (t) openEditPanel(t, hd._el?.isConnected ? hd._el : hd); }});
    hd.addEventListener("mouseenter", () => { clearTimeout(FS.handleT); FS.pinBar = S.doc.BarCfgs.includes(hd._t) ? hd._t : IDX.get(hd._t)?.bar; });
    hd.addEventListener("mouseleave", () => { FS.pinBar = null; hideHandle(400); });
    FS.root.append(hd);
  }
  hd._t = target; hd._el = el;
  const isBar = S.doc.BarCfgs.includes(target);
  hd.replaceChildren(svg('<path d="M3 13l1-3.5L10.5 3l2.5 2.5L6.5 12z M9.5 4l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>', 12), isBar ? " " + (target.n || "bar") : "");
  hd.dataset.tip = isBar ? "Edit this bar (or click its dark background)" : "Edit this shortcut (or right-click it)";
  const r = el.getBoundingClientRect();
  Object.assign(hd.style, {left: Math.min(innerWidth - hd.offsetWidth - 4, r.right - 10) + "px", top: Math.max(0, r.top - 12) + "px", display: ""});
}
function hideHandle(ms){ if (!FS?.handle) return; clearTimeout(FS.handleT); FS.handleT = setTimeout(() => { if (FS?.handle) FS.handle.style.display = "none"; }, ms); }

function setRevealed(en, on){
  on = !!on;
  if (en.revealed === on) return;
  en.revealed = on;
  if (en.bar.d === 4) en.el.classList.toggle("undock-hide", !on);
  else en.el.style.transform = on ? "" : `translate(${en.g.hx - en.g.x}px, ${en.g.hy - en.g.y}px)`;
}
function closePopups(depth){ while (FS.popups.length > depth) FS.popups.pop().el.remove(); }
function openCategory(sh, btn, bar, depth){
  closePopups(depth);
  const {W, H} = pvSize(), ui = PV.ui, [padX, padY] = PROFILE.winPad, fontPx = 17 * sh.cS * ui, textPx = fontPx * sh.cF;
  const L = layoutButtons(sh.sL || [], {width: Math.round(sh.cW * ui * sh.cS), cols: sh.cC, sp: sh.cSp, fontPx, textPx, addButton: !(sh.sL || []).length});
  const g = {padX, padY, ui, fontPx, textPx}, w = L.w + padX * 2, hh = L.h + padY * 2;
  const pop = h("div", {class: "g-pop" + (sh.cNB ? " nobg" : ""), style: {width: w + "px", height: hh + "px"}});
  for (const it of L.items) pop.append(gButton(it, g, {inCat: true, catNoBg: sh.cNB}));
  // BarUI.SetupCategoryPosition: a vertical grid opens popups to the side, otherwise above/below,
  // toward the screen half away from the first category that was opened; centered on the clicked button
  const b = FS.rectOf(btn), cont = FS.rectOf(depth ? FS.popups[depth - 1].el : btn.closest(".g-bar"));
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  if (!depth) FS.mainCat = {x: cx, y: cy};
  const parent = depth ? FS.popups[depth - 1].sh : null;
  const vertical = parent ? isVerticalGrid(parent.cC, (parent.sL || []).length) : isVerticalGrid(bar.co, (bar.sL || []).length);
  let x, y;
  if (!vertical) { x = cx - w / 2; y = FS.mainCat.y < H / 2 ? cont.y1 - padY / 2 : cont.y0 + padY / 2 - hh; }
  else { y = cy - hh / 2; x = FS.mainCat.x < W / 2 ? cont.x1 - padX / 2 : cont.x0 + padX / 2 - w; }
  x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - hh, y));
  Object.assign(pop.style, {left: x + "px", top: y + "px"});
  pop.addEventListener("mouseleave", e => { if (sh.cHC && !e.relatedTarget?.closest?.(".g-pop")) { const i = FS.popups.findIndex(p => p.el === pop); if (i >= 0) closePopups(i); } });
  FS.scr.append(pop);
  FS.popups.push({el: pop, sh, bar});
}
function pickIndex(sh, n){
  if (sh.m === 2) return Math.floor(Math.random() * n);
  const i = FS.counters.get(sh) ?? 0; FS.counters.set(sh, (i + 1) % n); return i % n;
}
function activate(sh, btn, bar, depth, parentCat){
  if (btn) { btn.classList.add("flash"); setTimeout(() => btn.classList.remove("flash"), 140); }
  if (sh.t === 2) return;
  if (sh.t === 1) {
    if (sh.m !== 0) { const kids = sh.sL || []; if (kids.length) activate(kids[pickIndex(sh, kids.length)], null, bar, depth, sh); return; }
    if (sh.c.trim()) runCommand(sh);
    if (btn) { if (FS.popups[depth]?.sh === sh) closePopups(depth); else openCategory(sh, btn, bar, depth); }
    return;
  }
  runCommand(sh);
  if (parentCat && !parentCat.cSO) closePopups(0);
}
function runCommand(sh){
  let lines = sh.c.split("\n").filter(l => l.trim());
  if (!lines.length) return chat(`(${displayName(sh) || "shortcut"} has no command)`, "sys");
  if (sh.m !== 0 && sh.t === 0) lines = [lines[pickIndex(sh, lines.length)]];
  for (const l of lines) {
    const t = l.trim();
    if (/^\/\/m\d+/.test(t)) chat(`[runs ${+t.slice(3) >= 100 ? "shared" : "individual"} macro #${+t.slice(3) % 100}]`, "sys");
    else if (/^\/\/m\s*$/.test(t)) chat("[inline macro start/end]", "sys");
    else if (/^\/\/i\s/.test(t)) chat(`[uses item ${t.slice(4)}]`, "sys");
    else if (t.startsWith("//")) continue;
    else if (/^\/echo\s/i.test(t)) chat(t.replace(/^\/echo\s+/i, ""), "echo");
    else chat(t, "cmd");
  }
}
const logTime = () => new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"});
const logLine = ([time, text, cls]) => h("div", {class: "ln " + (cls || "")}, h("span", {class: "t"}, time), text);
// Appends one line and keeps following the newest line, unless you scrolled up to read older ones
function chat(text, cls){
  const entry = [logTime(), text, cls];
  FS.chat.push(entry);
  const body = FS.logBody, follow = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
  if (FS.chat.length === 1) body.replaceChildren();
  body.append(logLine(entry));
  if (FS.chat.length > 500) { FS.chat.shift(); body.firstChild?.remove(); }
  if (follow) body.scrollTop = body.scrollHeight;
}
function paintChat(){
  const body = FS.logBody;
  body.replaceChildren(...(FS.chat.length ? FS.chat.map(logLine) : [h("div", {class: "ln sys"}, "Commands you trigger show up here. Nothing is sent to the game.")]));
  body.scrollTop = body.scrollHeight;
}
function fsKey(e){
  if (!FS) return;
  if (POP) { if (e.key === "Escape") { e.stopPropagation(); closePop(); } return; }
  if (document.querySelector(".scrim")) return;
  if (e.target.closest?.("input,textarea,.hk")) return;
  const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if (mod && key === "z" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); return undo(); }
  if (mod && (key === "y" || (key === "z" && e.shiftKey))) { e.preventDefault(); e.stopPropagation(); return redo(); }
  if (mod && key === "s") { e.preventDefault(); e.stopPropagation(); return save(); }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (FS.editPanel) closeEditPanel(); else if (FS.popups.length) closePopups(0); else closeFullscreen(); return; }
  const vk = CODE_TO_VK[e.code]; if (!vk) return;
  const k = vk | (e.shiftKey ? MOD_SHIFT : 0) | (e.ctrlKey ? MOD_CTRL : 0) | (e.altKey ? MOD_ALT : 0);
  let handled = false;
  // Shortcut hotkeys fire for every visible bar that has them (QoLBar Keybind.DoHotkeys)
  for (const en of FS.entries) {
    let hit = null; walkShortcuts(en.bar.sL, s => { if (!hit && s.k === k) hit = s; });
    if (hit) { handled = true; chat(`[${hotkeyName(k)}] ${displayName(hit) || "shortcut"}`, "sys"); const btn = [...en.el.querySelectorAll(".g-btn")].find(b => b._sh === hit); activate(hit, btn, en.bar, 0, null); }
  }
  // A bar's own hotkey opens it as a pie menu while held, if its condition set is true (even when the bar is hidden).
  // The first such bar wins. Pie menus aren't drawn here, so just say what would happen.
  const pie = S.doc.BarCfgs.find(b => b.k === k && (b.c < 0 || S.doc.AlwaysDisplayBars || PV.sets[b.c] !== false));
  if (pie) { handled = true; chat(`[${hotkeyName(k)}] held: opens "${pie.n}" as a pie menu (not shown in the preview)`, "sys"); }
  if (handled) { e.preventDefault(); e.stopPropagation(); }
}
