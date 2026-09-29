// SPDX-License-Identifier: AGPL-3.0-or-later
// Screen preview settings, the Dalamud profile, bar geometry (QoLBar's math) and pixel placement.
"use strict";

/* =====================================================================
   Screen preview: micro panel + interactive fullscreen.
   Geometry follows BarUI.cs (SetupPivot / SetupPositions / DrawShortcuts):
   bar = content + 8px window padding, buttons are (17 * Scale * FontScale) px text + 3px frame padding.
   ===================================================================== */
const PV = {
  res: store("pv.res") || "1920x1080",
  ui: +(store("pv.ui") || 1) || 1,
  backdrop: store("pv.backdrop") || "ref", // "ref" (ReferenceBackdrop.png), "custom", "mock" or "none"
  ref: null,  // {url, w, h} when ReferenceBackdrop.png sits next to this page
  open: store("pv.open") !== "0",
  showHidden: false,
  sets: {},   // condition set index -> false when simulated as false
  bg: null,   // object URL of a user screenshot (this session only)
};
const RESOLUTIONS = ["1280x720", "1600x900", "1920x1080", "2560x1080", "2560x1440", "3440x1440", "3840x2160"];
const pvSize = () => { const [W, H] = PV.res.split("x").map(Number); return {W, H}; };
// The backdrop actually in use: a screenshot image, the HUD mockup, or nothing
function backdrop(){
  if (PV.backdrop === "custom" && PV.bg) return {img: PV.bg.url};
  if (PV.backdrop === "ref" && PV.ref) return {img: PV.ref.url};
  return {mock: PV.backdrop !== "none"};
}
// Use a game screenshot as the backdrop. It stays in this browser (IndexedDB), is never uploaded anywhere,
// and its pixel size becomes the preview resolution.
function useScreenshot(file, {persist = true, quiet = false} = {}){
  return new Promise(res => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = async () => {
      if (PV.bg) URL.revokeObjectURL(PV.bg.url);
      PV.bg = {url, w: img.naturalWidth, h: img.naturalHeight, name: file.name};
      if (persist) { PV.backdrop = "custom"; store("pv.backdrop", "custom"); await idb.set("backdrop", {name: file.name, blob: file}); }
      if (PV.backdrop === "custom") useImageRes(img.naturalWidth, img.naturalHeight);
      if (!quiet) toast(`Backdrop set: ${img.naturalWidth} × ${img.naturalHeight}, so the preview now uses that resolution`);
      if (S.doc) render();
      res(true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); if (!quiet) toast("That image couldn't be read.", "err"); res(false); };
    img.src = url;
  });
}
async function removeScreenshot(){
  if (PV.bg) URL.revokeObjectURL(PV.bg.url);
  PV.bg = null; await idb.del("backdrop");
  if (PV.backdrop === "custom") { PV.backdrop = PV.ref ? "ref" : "mock"; store("pv.backdrop", PV.backdrop); }
  render();
}
// A screenshot's pixel size is the game's resolution, so follow it
function useImageRes(w, h){
  const r = `${w}x${h}`;
  if (!RESOLUTIONS.includes(r)) RESOLUTIONS.push(r);
  PV.res = r; store("pv.res", r);
}
(() => {
  const probe = new Image();
  probe.onload = () => {
    PV.ref = {url: probe.src, w: probe.naturalWidth, h: probe.naturalHeight};
    if (PV.backdrop === "ref") useImageRes(PV.ref.w, PV.ref.h);
    if (S.doc) render();
  };
  probe.src = "ReferenceBackdrop.png";
  // Re-measure once the QoLBar font (Noto Sans CJK Medium) has loaded
  document.fonts?.load('500 17px "Noto Sans JP"').then(() => { _mctx = null; FONT_GEN++; if (S.doc) { paintMicro(); if (FS) paintFullscreen(); } }).catch(() => {});
})();
document.head.append(h("style", null, (() => {
  // Color animations from ShortcutUI.AnimateColor: t = text color, b = icon tint
  let css = "@keyframes qfade{0%{opacity:.5}25%{opacity:1}75%{opacity:0}100%{opacity:.5}}";
  const targets = ["#f00", "#ff0", "#0f0", "#0ff", "#00f", "#f0f", "#fff", "#000"];
  for (const [s, prop] of [["t", "color"], ["b", "background-color"]]) {
    css += `@keyframes qrb${s}{` + [0, 1, 2, 3, 4, 5, 6].map(i => `${(i * 100 / 6).toFixed(3)}%{${prop}:hsl(${i * 60},100%,50%)}`).join("") + "}";
    [24, 12, 6].forEach((d, i) => css += `.qa${i}${s}{animation:qrb${s} ${d}s linear infinite}`);
    [12, 6, 3].forEach((d, i) => css += `.qa${i + 3}${s}{animation:qfade ${d}s linear infinite}`);
    targets.forEach((c, i) => css += `@keyframes qtr${i}${s}{0%,100%{${prop}:${c}}50%{${prop}:var(--base)}}.qa${i + 6}${s}{animation:qtr${i}${s} 6s linear infinite}`);
  }
  return css;
})()));

/* ---------- environment profile: the user's own Dalamud style + UI scale ---------- */
// Defaults are Dalamud's built-in "Dalamud Standard" (StyleModelV1). Loading dalamudConfig.json replaces them.
const DEFAULT_PROFILE = {
  source: "Built-in Dalamud defaults", styleName: "Dalamud Standard", ui: 1,
  winPad: [8, 8], framePad: [4, 3], popupRounding: 0,
  col: {WindowBg: [.06, .06, .06, .93], PopupBg: [.08, .08, .08, .94], ButtonHovered: [.3647059, .078431375, .078431375, .94509804], ButtonActive: [.48416287, .10077597, .10077597, .94509804], Text: [1, 1, 1, 1]},
};
let PROFILE = (() => { try { return {...DEFAULT_PROFILE, ...JSON.parse(store("profile") || "{}")}; } catch { return {...DEFAULT_PROFILE}; } })();
const v4css = c => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;
// Reads only the style and scale out of dalamudConfig.json; nothing else from the file is kept
function profileFromDalamudConfig(json){
  const d = JSON.parse(json.replace(/^﻿/, ""));
  if (!d || typeof d !== "object" || !("GlobalUiScale" in d || "ChosenStyle" in d)) throw new Error("This doesn't look like dalamudConfig.json (no GlobalUiScale / ChosenStyle).");
  const name = d.ChosenStyle || "Dalamud Standard";
  const saved = (d.SavedStylesVersioned?.$values || d.SavedStylesVersioned || []).find(s => s && s.name === name);
  const v2 = o => o && typeof o.X === "number" ? [o.X, o.Y] : null, v4 = o => o && typeof o.X === "number" ? [o.X, o.Y, o.Z, o.W] : null;
  const p = {...structuredClone(DEFAULT_PROFILE), source: "Your dalamudConfig.json", styleName: name, ui: typeof d.GlobalUiScale === "number" ? d.GlobalUiScale : 1};
  if (saved) {
    // StyleModelV1 short keys: b WindowPadding, j FramePadding, i PopupRounding, col Colors
    p.winPad = v2(saved.b) || p.winPad; p.framePad = v2(saved.j) || p.framePad;
    if (typeof saved.i === "number") p.popupRounding = saved.i;
    for (const k of Object.keys(p.col)) { const c = v4(saved.col?.[k]); if (c) p.col[k] = c; }
  } else p.note = `Style "${name}" isn't saved in the file, so its built-in values are assumed (Dalamud Standard).`;
  const list = d.DefaultProfile?.Plugins?.$values || d.DefaultProfile?.Plugins;
  if (Array.isArray(list)) p.plugins = list.filter(x => x && typeof x.InternalName === "string").map(x => [x.InternalName, x.IsEnabled !== false]);
  p.loadedAt = Date.now();
  return p;
}
function setProfile(p){ PROFILE = p; store("profile", JSON.stringify(p)); PV.ui = p.ui; store("pv.ui", p.ui); }

/* ImGui sizes a font by its full line height (ascender to descender); browsers size by the em box.
   Noto Sans CJK's line height is 1.448 em (hhea 1160 + 288), so QoLBar's "17px" text is 11.74px in CSS terms.
   Checked against an in-game screenshot: label widths match within about 1px. */
const FONT_EM = 1.448;
let _mctx = null;
function textWidth(t, px){ _mctx ??= document.createElement("canvas").getContext("2d"); _mctx.font = `500 ${px / FONT_EM}px "Noto Sans JP", "Noto Sans CJK JP", "Segoe UI", system-ui, sans-serif`; return _mctx.measureText(t).width; }
function animIndex(sh){ if (!sh.clA) return -1; const n = colorToRGBA(sh.cl).a + sh.clA - 256; return n >= 0 && n <= 13 ? n : -1; }

// Buttons flow left to right; a new row starts every `cols` items (cols 0 = one row)
// fontPx sizes the buttons (17 * Scale); textPx is the label text (that times Font scale). QoLBar measures the
// button height before applying Font scale, so Font scale shrinks text but never icons or button height.
function layoutButtons(list, {width, cols, sp, fontPx, textPx = fontPx, addButton}){
  const fp = PROFILE.framePad, bh = Math.round(fontPx + fp[1] * 2);
  const items = []; let x = 0, y = 0, rowH = 0;
  (addButton ? [...list, null] : list).forEach((sh, i) => {
    const p = sh ? parseName(sh.n) : {label: "+", hasIcon: false, args: ""};
    const iconOnly = p.hasIcon && !p.label;
    const w = iconOnly ? bh : width > 0 ? width : Math.ceil(textWidth(p.label || " ", textPx) + fp[0] * 2) + (p.hasIcon ? bh : 0);
    items.push({sh, p, x, y, w, h: bh});
    rowH = Math.max(rowH, bh);
    if (cols > 0 && i % cols === cols - 1) { x = 0; y += rowH + sp[1]; rowH = 0; } else x += w + sp[0];
  });
  return {items, w: Math.max(0, ...items.map(it => it.x + it.w)), h: Math.max(0, ...items.map(it => it.y + it.h)), bh};
}
const f32 = Math.fround;
const LAYOUT_CACHE = new WeakMap();
let FONT_GEN = 0; // bumped when the web font finishes loading, so text widths get re-measured
// Shortest decimal that is the same 32-bit float, like the plugin writes (e.g. 0.13819444)
function shortestF32(x){ const f = f32(x); for (let p = 1; p <= 9; p++) { const s = +f.toPrecision(p); if (f32(s) === f) return s; } return f; }
const isVerticalGrid = (cols, count) => cols > 0 && count >= cols * (cols - 1) + 1;
function barGeometry(bar, W, H, pos = bar.p){
  // Dalamud's global scale grows fonts (and QoLBar's button widths), not the style's padding
  const ui = PV.ui, [padX, padY] = PROFILE.winPad, pad = padX, fontPx = 17 * bar.s * ui, textPx = fontPx * bar.fS;
  // Layout depends only on these fields; cache it so the pixel solver can probe positions cheaply
  const key = JSON.stringify([ui, bar.bW, bar.s, bar.fS, bar.co, bar.sp, bar.e, (bar.sL || []).map(s => s.n), FONT_GEN, PROFILE.framePad]);
  let L = LAYOUT_CACHE.get(bar);
  if (!L || L.key !== key) { L = layoutButtons(bar.sL || [], {width: Math.round(bar.bW * ui * bar.s), cols: bar.co, sp: bar.sp, fontPx, textPx, addButton: bar.e || !(bar.sL || []).length}); L.key = key; LAYOUT_CACHE.set(bar, L); }
  const w = L.w + padX * 2, h = L.h + padY * 2;
  // BarUI.VectorPosition: float math, then floored to whole pixels
  const px = Math.floor(f32(f32(pos[0]) * W)), py = Math.floor(f32(f32(pos[1]) * H));
  const piv = [0, .5, 1][bar.a] ?? .5, hint = bar.ht ? (bar.d === 0 || bar.d === 2 ? padY : padX) * 2 : 0;
  let x, y, hx, hy; // revealed and hidden top-left corners
  switch (bar.d) {
    case 0: x = W * piv + px - w * piv; y = Math.max(py, hint + 1 - h); hx = x; hy = hint - h; break;
    case 1: x = Math.min(W - w + px, W - hint - 1); y = H * piv + py - h * piv; hx = W - hint; hy = y; break;
    case 2: x = W * piv + px - w * piv; y = Math.min(H - h + py, H - hint - 1); hx = x; hy = H - hint; break;
    case 3: x = Math.max(px, hint + 1 - w); y = H * piv + py - h * piv; hx = hint - w; hy = y; break;
    default: x = px; y = py; hx = x; hy = y;
  }
  // ImGui snaps window positions down to whole pixels
  x = Math.floor(x); y = Math.floor(y); hx = Math.floor(hx); hy = Math.floor(hy);
  // Mouse area that reveals a Slide/Immediate bar (BarUI.CheckMousePosition)
  const r = {x0: x, y0: y, x1: x + w, y1: y + h}, k = 1 - bar.rA;
  if (bar.d === 0) r.y1 = Math.max(r.y1 - h * k, r.y0 + 1, hint + 1);
  if (bar.d === 3) r.x1 = Math.max(r.x1 - w * k, r.x0 + 1, hint + 1);
  if (bar.d === 2) r.y0 = Math.min(r.y0 + h * k, r.y1 - 1, H - hint - 1);
  if (bar.d === 1) r.x0 = Math.min(r.x0 + w * k, r.x1 - 1, W - hint - 1);
  return {x, y, w, h, hx, hy, L, ui, pad, padX, padY, fontPx, textPx, reveal: r};
}
/* ---------- pixel placement helpers (for lining bars up exactly) ---------- */
let PIXEL_PAINT = null; // refreshes the open bar's pixel card after edits elsewhere in the inspector
// Find the stored position fraction that puts the bar's top-left edge on an exact pixel.
// Picks the middle of the pixel so float rounding in game can't push it one pixel off.
function solveAxis(bar, W, H, axis, target){
  const size = axis ? H : W;
  const probe = v => { const p = [...bar.p]; p[axis] = v; const g = barGeometry(bar, W, H, p); return axis ? g.y : g.x; };
  const base = probe(0.5 / size);
  for (const d of [0, -1, 1, -2, 2, -3, 3]) {
    const v = shortestF32((target - base + d + 0.5) / size);
    if (probe(v) === target) return v;
  }
  return null;
}
// The stored position that puts the bar's top-left on (tx, ty); null keeps that axis. Returns null if unreachable.
function solvePos(bar, tx, ty){
  const {W, H} = pvSize(), g = barGeometry(bar, W, H);
  const nx = tx === null || tx === g.x ? bar.p[0] : solveAxis(bar, W, H, 0, tx);
  const ny = ty === null || ty === g.y ? bar.p[1] : solveAxis(bar, W, H, 1, ty);
  return nx === null || ny === null ? null : [nx, ny];
}
function placeBar(bar, tx, ty){
  const p = solvePos(bar, tx, ty);
  if (!p) return toast("That spot can't be reached with this bar's dock side and alignment.", "warn"), false;
  // Rapid changes (typing, dragging a number) collapse into one undo step
  if (Date.now() - (placeBar.last || 0) > 800) commit();
  placeBar.last = Date.now();
  bar.p = p; touch(); return true;
}
// How a bar sits relative to the screen and to every other visible bar
function barRelations(bar){
  const {W, H} = pvSize(), g = barGeometry(bar, W, H), out = [];
  const edges = [["left", -g.x], ["top", -g.y], ["right", g.x + g.w - W], ["bottom", g.y + g.h - H]];
  for (const [side, over] of edges) if (over > 0) out.push({kind: "bad", text: `${over}px past the ${side} screen edge`});
  for (const ob of S.doc.BarCfgs) {
    if (ob === bar || ob.h) continue;
    const o = barGeometry(ob, W, H);
    const ox = Math.min(g.x + g.w, o.x + o.w) - Math.max(g.x, o.x), oy = Math.min(g.y + g.h, o.y + o.h) - Math.max(g.y, o.y);
    const name = `"${ob.n}"`;
    // Two bars with different condition sets may be alternates (e.g. "Enable Plugin" vs "Disable Plugin") that never show at once
    const alternates = ob.c >= 0 && bar.c >= 0 && ob.c !== bar.c;
    // Bars of one mock bar overlap on purpose: seamless joins, and alternates stacked in one slot
    const tb = trickOf(bar), to = tb && trickOf(ob);
    if (ox > 0 && oy > 0 && to && to.trick === tb.trick) { out.push({kind: "ok", text: to.slot === tb.slot ? `stacked with ${name} (swaps in place)` : `joined to ${name} in "${tb.trick.name}"`}); continue; }
    if (ox > 0 && oy > 0) { out.push({kind: alternates ? "warn" : "bad", text: `overlaps ${name} by ${ox}×${oy}px` + (alternates ? " (different condition sets, fine if they never show together)" : "")}); continue; }
    if (ox > 0) { const gap = g.y >= o.y + o.h ? g.y - (o.y + o.h) : o.y - (g.y + g.h); if (gap <= 40) out.push({kind: gap === 0 ? "ok" : "warn", text: gap === 0 ? `flush ${g.y >= o.y ? "below" : "above"} ${name}` : `${gap}px gap ${g.y >= o.y ? "below" : "above"} ${name}`}); }
    if (oy > 0) { const gap = g.x >= o.x + o.w ? g.x - (o.x + o.w) : o.x - (g.x + g.w); if (gap <= 40) out.push({kind: gap === 0 ? "ok" : "warn", text: gap === 0 ? `flush ${g.x >= o.x ? "right of" : "left of"} ${name}` : `${gap}px gap ${g.x >= o.x ? "right of" : "left of"} ${name}`}); }
  }
  return {g, out, W, H};
}
// Copied bar placement, shared by the inspector and the live editor (also put on the clipboard as JSON)
let PLACEMENT_CLIP = null;
const PLACEMENT_KEYS = {pos: ["d", "a", "p"], look: ["d", "a", "p", "v", "bW", "co", "sp", "s", "fS", "rA", "nB", "ht"]};
function copyPlacement(bar){
  PLACEMENT_CLIP = Object.fromEntries(PLACEMENT_KEYS.look.map(k => [k, structuredClone(bar[k])]));
  navigator.clipboard?.writeText(JSON.stringify({qolbarPlacement: PLACEMENT_CLIP})).catch(() => {});
  toast(`Copied placement of "${bar.n}". Paste it onto another bar.`);
}
async function pastePlacement(bar, which){
  let clip = PLACEMENT_CLIP;
  try { const t = await navigator.clipboard.readText(); const j = JSON.parse(t); if (j && j.qolbarPlacement) clip = j.qolbarPlacement; } catch {}
  if (!clip) return toast("Copy a bar's placement first.", "warn");
  commit();
  for (const k of PLACEMENT_KEYS[which]) if (k in clip) bar[k] = structuredClone(clip[k]);
  touch(); renderInspector(); fsRefresh(true);
  toast(which === "pos" ? "Pasted position (dock, alignment, offset)" : "Pasted position and layout");
}
function pixelCard(bar, after = renderInspector){
  const card = h("div", {class: "card"});
  let pending = false;
  const color = {bad: "var(--red)", warn: "var(--accent)", ok: "var(--green)"};
  const readout = h("div", {class: "mono", style: {fontSize: "13px"}}), nbr = h("div");
  // Only the text readouts; safe to run while a field in this card is being typed in or dragged
  const fillLive = () => {
    const {g, out} = barRelations(bar);
    readout.textContent = `x ${g.x} → ${g.x + g.w}   y ${g.y} → ${g.y + g.h}   (${g.w} × ${g.h} px)`;
    nbr.replaceChildren(out.length ? h("div", {style: {display: "flex", flexDirection: "column", gap: "3px"}}, out.map(r => h("div", {style: {color: color[r.kind], fontSize: "13px"}}, (r.kind === "ok" ? "✓ " : r.kind === "bad" ? "✕ " : "• ") + r.text))) : h("span", {class: "faint"}, "Nothing nearby"));
  };
  const busy = () => card.contains(document.activeElement) || (SCRUB_EL && card.contains(SCRUB_EL));
  const paint = () => {
    fillLive();
    const {g, W, H} = barRelations(bar);
    const pin = trickOf(bar);
    card.replaceChildren(h("h3", null, "Pixel placement", h("span", {class: "faint", style: {textTransform: "none", letterSpacing: 0, fontWeight: 400}}, `at ${W} × ${H}, UI scale ${PV.ui} (from the preview panel)`)),
      h("div", {class: "grid"},
        ...field("On screen", readout, "Where the bar's window lands when shown, worked out the same way QoLBar does it (32-bit float math, floored to whole pixels)."),
        ...field("Top-left pixel", h("div", {class: "inline"}, h("span", {class: "dim"}, "x"), numInput(g.x, v => { if (placeBar(bar, v, null)) repaint(); }, {noUndo: true, width: "84px"}), h("span", {class: "dim"}, "y"), numInput(g.y, v => { if (placeBar(bar, null, v)) repaint(); }, {noUndo: true, width: "84px"})), "Type an exact pixel and the stored position is recalculated to land on it."),
        ...(pin && pin.follower ? field("Pinned", h("div", null, h("span", {class: "dim"}, `Part of the mock bar "${pin.trick.name}" (slot ${pin.slot + 1}), so it follows "${pin.anchor}". `), h("a", {class: "link", onclick: () => { S.view = "tricks"; render(); }}, "Open Tricks"))) : []),
        ...field("Snap next to", snapPicker(bar, repaint), "Pick a bar (nearest first) or the screen, then click where this bar should go. One click sets both the side and the alignment."),
        ...field("Placement", h("div", {class: "inline"},
          h("button", {class: "btn sm", tip: "Copy dock, alignment, position and layout (button width, columns, spacing, scale...)", onclick: () => copyPlacement(bar)}, svg(ICONS.copy), "Copy"),
          h("button", {class: "btn sm", tip: "Paste only dock, alignment and position offset", onclick: () => pastePlacement(bar, "pos").then(repaint)}, "Paste position"),
          h("button", {class: "btn sm", tip: "Paste position plus the layout settings", onclick: () => pastePlacement(bar, "look").then(repaint)}, "Paste all")), "Copy one bar's placement and paste it onto similar bars. Pasting the same position onto bars with different condition sets stacks them in one spot."),
        ...field("Neighbors", nbr)));
  };
  // While a field here is focused or being dragged, only refresh the readouts; rebuild once you're done,
  // so the box you're editing never disappears under you
  const repaint = () => { if (busy()) { fillLive(); pending = true; } else { paint(); after(); } };
  const settle = () => setTimeout(() => { if (pending && card.isConnected && !busy()) { pending = false; paint(); after(); } }, 0);
  card.addEventListener("focusout", settle);
  card.addEventListener("scrubend", settle);
  paint();
  const selfPaint = () => { if (!card.isConnected) return; if (busy()) fillLive(); else paint(); };
  if (after === renderInspector) PIXEL_PAINT = selfPaint; else card._paint = selfPaint;
  return card;
}
