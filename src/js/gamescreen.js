// SPDX-License-Identifier: AGPL-3.0-or-later
// Draws bars, buttons and icons the way the game does, and the preview panel.
"use strict";

function barShown(bar){
  if (FS && FS.toggled.has(bar)) return false;
  if (bar.h) return PV.showHidden && !FS ? "ghost" : false;
  if (bar.c >= 0 && !S.doc.AlwaysDisplayBars && PV.sets[bar.c] === false) return PV.showHidden && !FS ? "ghost" : false;
  return true;
}
// The game's hotbar frame sheet (ui/uld/icona_frame, 426 x 144). QoLBar pads textures to a square, centering
// this one with 141px on top, so its UV y values are 141 higher than the real sheet: frame (1,141) is (1,0) here.
const FRAME_URL = "https://v2.xivapi.com/api/asset?path=ui/uld/icona_frame_hr1.tex&format=png";
const FRAME_UV = {frame: [1, 0, 46], glow: [49, 97, 46]}; // [x, y, size] in 426 x 144 sheet units
function sheetBg(el, [ux, uy, us], w){
  const k = w / us; // px per sheet unit
  Object.assign(el.style, {backgroundImage: `url("${FRAME_URL}")`, backgroundSize: `${426 * k}px ${144 * k}px`, backgroundPosition: `${-ux * k}px ${-uy * k}px`});
}
// Draws an icon the way ImGuiEx.AddIcon does: full-size art cropped by zoom/offset/rotation (UV math),
// then the game frame on top, reaching 7.5% past each edge (AddIconFrame)
function gIcon(sh, p, size, n, {noFrame = false} = {}){
  const frame = !noFrame && (p.args.includes("f") || (S.doc.UseIconFrame && !p.args.includes("n")));
  const box = h("div", {class: "g-icon" + (frame ? " framed" : "") + (n >= 3 && n <= 5 ? ` qa${n}t` : ""), style: {width: size + "px", height: size + "px"}});
  const clip = h("div", {class: "g-icon-clip"});
  box.append(clip);
  const c = colorToRGBA(sh.cl), rgb = `rgb(${c.r},${c.g},${c.b})`;
  if (p.icon !== 0) {
    const img = iconImg(p.icon, clip, !p.args.includes("l"));
    if (img.tagName === "IMG") {
      // UVs span 1/zoom of the texture around (0.5 + offset), so the texture is drawn zoom times larger
      const z = sh.iZ || 1, a = Math.abs(z), w = size * a;
      const left = (0.5 - 0.5 * a - sh.iO[0] * a) * size, top = (0.5 - 0.5 * a - sh.iO[1] * a) * size;
      const flip = (z < 0 ? " scale(-1,-1)" : "") + (p.args.includes("r") ? " scaleX(-1)" : "");
      Object.assign(img.style, {position: "absolute", width: w + "px", height: w + "px", left: left + "px", top: top + "px",
        transformOrigin: `${size / 2 - left}px ${size / 2 - top}px`, transform: `rotate(${sh.iR}rad)${flip}`});
      if (p.args.includes("g")) img.style.filter = "grayscale(1)";
    }
    clip.append(img);
    const colorAnim = n >= 0 && !(n >= 3 && n <= 5);
    if ((c.r & c.g & c.b) !== 255 || colorAnim) { const t = h("div", {class: "tint" + (colorAnim ? ` qa${n}b` : ""), style: {background: rgb}}); t.style.setProperty("--base", rgb); clip.append(t); }
    if (c.a < 255 && n < 0) clip.style.opacity = c.a / 255;
  }
  if (frame) {
    const fw = size * 1.15, off = -size * 0.075;
    const fr = h("div", {class: "g-frame", style: {left: off + "px", top: off + "px", width: fw + "px", height: fw + "px"}});
    const glow = h("div", {class: "g-glow", style: {left: off + "px", top: off + "px", width: fw + "px", height: fw + "px"}});
    sheetBg(fr, FRAME_UV.frame, fw); sheetBg(glow, FRAME_UV.glow, fw);
    box.append(glow, fr);
  }
  return box;
}
function gButton(it, g, opts = {}){
  const {sh, p} = it;
  const b = h("div", {class: "g-btn", style: {left: (g.padX + it.x) + "px", top: (g.padY + it.y) + "px", width: it.w + "px", height: it.h + "px", fontSize: g.textPx / FONT_EM + "px", lineHeight: g.textPx + "px"}});
  if (!sh) { b.textContent = "+"; return b; }
  const iconOnly = p.hasIcon && !p.label, n = animIndex(sh);
  if (sh.t === 2) b.classList.add("spacer");
  else if (opts.inCat) b.classList.add(opts.catNoBg && !p.hasIcon ? "dark" : "clear");
  else if (iconOnly) b.classList.add("clear");
  if (iconOnly) b.classList.add("iconly");
  if (p.hasIcon) b.append(gIcon(sh, p, it.h, n));
  if (!iconOnly) {
    const c = colorToRGBA(sh.cl), t = h("span", {class: "g-lbl" + (n >= 0 ? ` qa${n}t` : ""), style: {color: cssColor(sh.cl), marginLeft: p.hasIcon ? it.h + "px" : ""}}, p.label);
    t.style.setProperty("--base", `rgb(${c.r},${c.g},${c.b})`);
    b.append(t);
  }
  b._sh = sh;
  return b;
}
function hudMock(W, H){
  const k = H / 1080, out = [];
  const box = (x, y, w, hh, label, cls = "") => { const e = h("div", {class: "g-hud " + cls, style: {left: x + "px", top: y + "px", width: w + "px", height: hh + "px", fontSize: 13 * k + "px"}}, label ? h("span", {class: "cap"}, label) : null); out.push(e); return e; };
  box(16 * k, H - 290 * k, 600 * k, 270 * k, "Chat");
  const slot = 46 * k, gap = 5 * k, rowW = 12 * slot + 11 * gap, x0 = (W - rowW) / 2;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) out.push(h("div", {class: "g-slot", style: {left: x0 + i * (slot + gap) + "px", top: H - 30 * k - (r + 1) * (slot + 8 * k) + "px", width: slot + "px", height: slot + "px"}}));
  box(W - 250 * k, 24 * k, 220 * k, 220 * k, "", "round");
  box((W - 540 * k) / 2, 36 * k, 540 * k, 34 * k, "Target");
  for (let i = 0; i < 8; i++) box(22 * k, 300 * k + i * 46 * k, 210 * k, 40 * k, i ? "" : "Party");
  return out;
}
// Style variables every rendered bar needs (from the Dalamud profile)
function applyScreenVars(el){
  const c = PROFILE.col;
  el.style.setProperty("--ui", PV.ui);
  el.style.setProperty("--win-bg", v4css(c.WindowBg)); el.style.setProperty("--pop-bg", v4css(c.PopupBg));
  el.style.setProperty("--btn-hov", v4css(c.ButtonHovered)); el.style.setProperty("--btn-act", v4css(c.ButtonActive));
  el.style.setProperty("--pop-round", PROFILE.popupRounding + "px"); el.style.color = v4css(c.Text);
}
// One bar drawn with the real renderer, on its own: used by the bar inspector's Preview card
function barOnly(bar){
  const {W, H} = pvSize();
  const g = barGeometry(bar, W, H);
  const en = barEntry(bar, {...g, x: 0, y: 0}, true, false, null);
  en.el.classList.remove("peek");
  const scr = h("div", {class: "gscreen bar-only", style: {width: g.w + "px", height: g.h + "px"}}, en.el);
  applyScreenVars(scr);
  return {scr, g};
}
function buildScreen({interactive = false, selected = null} = {}){
  const {W, H} = pvSize();
  const bd = backdrop();
  const scr = h("div", {class: "gscreen" + (bd.img ? " bgimg" : ""), style: {width: W + "px", height: H + "px"}});
  applyScreenVars(scr);
  if (bd.img) scr.style.backgroundImage = `url("${bd.img}")`;
  if (bd.mock) scr.append(...hudMock(W, H));
  const entries = [];
  for (const bar of S.doc.BarCfgs) {
    const shown = barShown(bar); if (!shown) continue;
    const en = barEntry(bar, barGeometry(bar, W, H), shown, interactive, selected);
    entries.push(en); scr.append(en.el);
  }
  return {scr, entries};
}
// Everything about a bar except where it sits; if this is unchanged, a redraw only needs to move it
const barSig = bar => JSON.stringify({...bar, p: 0, _: [PROFILE.framePad, PROFILE.winPad, PV.ui, FONT_GEN, S.doc.UseIconFrame]});
function barEntry(bar, g, shown, interactive, selected){
  const el = h("div", {class: "g-bar" + (bar.nB ? " nobg" : "") + (shown === "ghost" ? " ghost" : "") + (bar === selected ? " sel" : ""), style: {left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px"}});
  for (const it of g.L.items) el.append(gButton(it, g));
  const en = {bar, g, el, shown, sig: barSig(bar), revealed: bar.v === 2};
  if (bar.v !== 2) {
    if (!interactive) el.classList.add("peek");
    else if (bar.d === 4) el.classList.add("undock-hide");
    else { if (bar.v === 0) el.classList.add("slide"); el.style.transform = `translate(${g.hx - g.x}px, ${g.hy - g.y}px)`; }
  }
  if (!interactive) {
    el.addEventListener("click", e => { e.stopPropagation(); const sh = e.target.closest(".g-btn")?._sh; goTo(sh || bar); });
    withCtx(el, e => { const sh = e.target.closest(".g-btn")?._sh; return sh ? shortcutMenu(sh) : barMenu(bar); });
  }
  return en;
}
// Cheap live update for an already-drawn screen: moves bars whose content is unchanged, redraws only bars
// that changed. Returns false when bars appeared, vanished or were reordered (the caller then does a full redraw).
function patchScreen(scr, entries, interactive, selected){
  const {W, H} = pvSize();
  const shownBars = S.doc.BarCfgs.filter(b => barShown(b));
  if (shownBars.length !== entries.length || shownBars.some((b, i) => entries[i].bar !== b || entries[i].shown !== barShown(b))) return false;
  entries.forEach((en, i) => {
    const bar = en.bar, g = barGeometry(bar, W, H);
    if (en.sig === barSig(bar)) {
      Object.assign(en.el.style, {left: g.x + "px", top: g.y + "px"});
      if (interactive && bar.v !== 2 && bar.d !== 4 && !en.revealed) en.el.style.transform = `translate(${g.hx - g.x}px, ${g.hy - g.y}px)`;
      en.el.classList.toggle("sel", bar === selected);
      en.g = g;
    } else {
      const fresh = barEntry(bar, g, en.shown, interactive, selected);
      if (interactive && en.revealed && bar.v !== 2) { fresh.revealed = true; fresh.el.style.transform = ""; fresh.el.classList.remove("undock-hide"); }
      en.el.replaceWith(fresh.el);
      entries[i] = fresh;
    }
  });
  return true;
}
function goTo(obj){
  S.multi.clear(); S.sel = obj;
  const m = IDX.get(obj); if (m) { S.expanded.add(m.bar); ancestors(obj).forEach(a => S.expanded.add(a)); }
  if (S.view !== "bars") { S.view = "bars"; render(); } else select(obj);
  setTimeout(() => { const r = $("#tree .row.sel"), t = $("#tree"); if (r && t) { const rr = r.getBoundingClientRect(), tr = t.getBoundingClientRect(); if (rr.top < tr.top || rr.bottom > tr.bottom) r.scrollIntoView({block: "center"}); } }, 0);
}

/* micro panel */
function renderPreviewPanel(){
  const sets = S.doc.CndSetCfgs;
  const pick = h("input", {type: "file", accept: "image/*", hidden: true});
  pick.addEventListener("change", () => { const f = pick.files[0]; pick.value = ""; if (f) useScreenshot(f); });
  const bdOpts = [...(PV.ref ? [["ref", "Reference", "ReferenceBackdrop.png next to this page"]] : []), ...(PV.bg ? [["custom", "Screenshot", `Your screenshot (${PV.bg.w} × ${PV.bg.h})`]] : []), ["mock", "Mockup", "Simple drawn HUD"], ["none", "None"]];
  const bdNow = bdOpts.some(o => o[0] === PV.backdrop) ? PV.backdrop : "mock";
  const panel = h("div", {class: "pvpanel"},
    h("div", {class: "inline", style: {marginBottom: "10px", flexWrap: "nowrap"}}, h("b", {style: {flex: 1}}, "Screen preview"),
      h("button", {class: "btn sm primary", onclick: openFullscreen}, "Fullscreen"),
      h("button", {class: "btn sm ghost icon", tip: "Hide preview", onclick: () => { PV.open = false; store("pv.open", "0"); render(); }}, svg(ICONS.x))),
    (() => {
      const host = h("div", {class: "pv-host", id: "pvHost"});
      host.addEventListener("dragover", e => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); host.classList.add("drop-over"); } });
      host.addEventListener("dragleave", () => host.classList.remove("drop-over"));
      host.addEventListener("drop", e => { host.classList.remove("drop-over"); if (!e.dataTransfer?.files?.length) return; e.preventDefault(); e.stopPropagation(); handleDrop(captureDrop(e.dataTransfer), {confirmDiscard: true}); });
      return host;
    })(),
    h("div", {class: "help"}, "Click a bar or shortcut to edit it. Dashed = hidden until the mouse gets near (Slide / Immediate). Approximate, not pixel exact."),
    h("div", {class: "grid"},
      h("label", {class: "flabel"}, "Resolution"), dropdown({value: PV.res, width: "100%", options: RESOLUTIONS.map(r => ({value: r, label: r.replace("x", " × ")})), onChange: v => { PV.res = v; store("pv.res", v); paintMicro(); }}),
      h("label", {class: "flabel"}, "UI scale"), h("div", {class: "inline"}, numInput(PV.ui, v => { PV.ui = v || 1; store("pv.ui", PV.ui); paintMicro(); }, {float: true, step: .05, min: .25, max: 4, noUndo: true, width: "70px"}), help("Dalamud's global font/UI scale (Dalamud Settings > Look & Feel). 1 = default.")),
      h("label", {class: "flabel"}, "Backdrop"), h("div", null,
        seg(bdNow, bdOpts, v => {
          PV.backdrop = v; store("pv.backdrop", v);
          const im = v === "ref" ? PV.ref : v === "custom" ? PV.bg : null;
          if (im) { useImageRes(im.w, im.h); render(); } else paintMicro();
        }),
        h("div", {class: "inline", style: {marginTop: "6px"}},
          h("button", {class: "btn sm", tip: "Use one of your game screenshots (or drop it on the preview). It stays in this browser only, and the preview resolution follows its size.", onclick: () => pick.click()}, PV.bg ? "Replace screenshot..." : "Use a screenshot..."),
          PV.bg ? h("button", {class: "btn sm ghost", onclick: removeScreenshot}, "Remove") : null, pick),
        h("div", {class: "help"}, PV.bg ? `${PV.bg.name || "Screenshot"}, ${PV.bg.w} × ${PV.bg.h}. Kept in this browser only.` : "Tip: drop a game screenshot onto the preview.")),
      h("label", {class: "flabel"}, "Hidden bars"), toggle(PV.showHidden, v => { PV.showHidden = v; paintMicro(); }, "Show faded")),
    setupSection(),
    sets.length ? h("div", {style: {marginTop: "14px"}},
      h("div", {class: "flabel", style: {display: "flex", gap: "6px", alignItems: "center"}}, "Simulate condition sets", help("Pretend each set is true or false to see which bars would show. Game state can't be read from here, so these are your what-ifs.")),
      S.doc.AlwaysDisplayBars ? h("div", {class: "help"}, "\"Always Display Bars\" is on in Settings, so conditions are ignored.") : null,
      h("div", {class: "pv-sets"}, sets.map((s, i) => toggle(PV.sets[i] !== false, v => { PV.sets[i] = v; paintMicro(); }, `#${i + 1} ${s.n || "(unnamed)"}`)))) : null);
  queueMicrotask(paintMicro);
  return panel;
}
// "Your setup": which Dalamud style / scale the preview uses, loaded from the user's own dalamudConfig.json
function setupSection(){
  const path = "%AppData%\\XIVLauncher\\dalamudConfig.json";
  const pick = h("input", {type: "file", accept: ".json,application/json", hidden: true});
  pick.addEventListener("change", async () => {
    const f = pick.files[0]; pick.value = ""; if (!f) return;
    try { const p = profileFromDalamudConfig(await f.text()); setProfile(p); render(); toast(`Using your Dalamud style "${p.styleName}" at UI scale ${p.ui}`); }
    catch (e) { toast(e.message, "err"); }
  });
  const P = PROFILE, custom = P.source !== DEFAULT_PROFILE.source;
  const sw = c => h("span", {class: "swatch", style: {width: "18px", height: "14px", verticalAlign: "middle"}}, h("i", {style: {background: v4css(c)}}));
  const row = (k, v) => [h("span", {class: "faint"}, k), h("span", {class: "mono", style: {fontSize: "12px"}}, v)];
  let open = false;
  const details = h("div", {style: {display: "none", gridTemplateColumns: "auto 1fr", gap: "4px 10px", marginTop: "8px", fontSize: "12.5px"}},
    h("b", {style: {gridColumn: "1 / -1", fontSize: "12px", color: "var(--dim)"}}, "From Dalamud (" + (custom ? "your file" : "defaults") + ")"),
    ...row("Style", P.styleName), ...row("UI scale", String(P.ui)), ...row("Window padding", P.winPad.join(" × ")), ...row("Frame padding", P.framePad.join(" × ")), ...row("Popup rounding", String(P.popupRounding)),
    ...Object.entries(P.col).flatMap(([k, c]) => [h("span", {class: "faint"}, k), h("span", null, sw(c), " ", h("span", {class: "mono", style: {fontSize: "11.5px"}}, c.map(x => +x.toFixed(3)).join(", ")))]),
    h("b", {style: {gridColumn: "1 / -1", fontSize: "12px", color: "var(--dim)", marginTop: "6px"}}, "From QoLBar.json"),
    ...row("Icon frame default", String(!!S.doc.UseIconFrame)), ...row("Always display bars", String(!!S.doc.AlwaysDisplayBars)), ...row("Font atlas size", String(S.doc.FontSize ?? 17)),
    h("b", {style: {gridColumn: "1 / -1", fontSize: "12px", color: "var(--dim)", marginTop: "6px"}}, "Fixed by QoLBar's code"),
    ...row("Font", "Noto Sans CJK Medium, 17 × Scale px"), ...row("Corners", "square"), ...row("Button color", "rgba(.286,.286,.286,.9)"));
  const toggleBtn = h("button", {class: "btn sm ghost", onclick: () => { open = !open; details.style.display = open ? "grid" : "none"; toggleBtn.textContent = open ? "Hide values" : "Show values"; }}, "Show values");
  return h("div", {style: {marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)"}},
    h("div", {class: "flabel", style: {display: "flex", gap: "6px", alignItems: "center"}}, "Your setup", help("The preview reads your own Dalamud style (padding, colors) and UI scale from dalamudConfig.json, and the plugin picker lists your installed plugins from it. The file is read inside your browser only, and only those values and plugin names are kept (in this browser's storage). Nothing is uploaded.")),
    h("div", {style: {margin: "6px 0", fontSize: "13px"}}, h("span", {class: "chip " + (custom ? "mode" : "plain")}, custom ? "Your config" : "Defaults"), " ", h("span", {class: "dim"}, `${P.styleName}, UI scale ${P.ui}`)),
    P.note ? h("div", {class: "help", style: {color: "var(--accent)"}}, P.note) : null,
    h("div", {class: "inline"},
      h("button", {class: "btn sm", onclick: () => pick.click()}, "Load dalamudConfig.json..."),
      custom ? h("button", {class: "btn sm ghost", onclick: () => { setProfile(structuredClone(DEFAULT_PROFILE)); render(); }}, "Reset") : null,
      toggleBtn, pick),
    pathLine(PATH.dalamud),
    details,
    customIconsRow());
}
// Custom icon status: which negative icon IDs the config uses, and how many of them are loaded
function customIconsRow(){
  const used = new Set();
  if (S.doc) allShortcuts(S.doc).forEach(([sh]) => { const p = parseName(sh.n); if (p.hasIcon && p.icon < 0) used.add(-p.icon); });
  const missing = [...used].filter(n => !CUSTOM_ICONS.has(n));
  const path = `${XIV_PATH}\\pluginConfigs\\QoLBar\\icons`;
  return h("div", {style: {marginTop: "12px"}},
    h("div", {class: "flabel", style: {display: "flex", gap: "6px", alignItems: "center"}}, "Custom icons", help("Negative icon IDs are your own images from QoLBar's icons folder, named by number (icon -811002 is 811002.png). Pick that folder once; the images are remembered in this browser. With a connected folder (Chrome / Edge) they load automatically.")),
    h("div", {style: {margin: "6px 0", fontSize: "13px"}},
      h("span", {class: "chip " + (CUSTOM_ICONS.size ? "mode" : "plain")}, `${CUSTOM_ICONS.size} loaded`), " ",
      h("span", {class: missing.length ? "" : "dim", style: missing.length ? {color: "var(--accent)"} : null}, used.size ? (missing.length ? `${missing.length} of ${used.size} used by this config missing` : `all ${used.size} used by this config found`) : "none used by this config")),
    h("div", {class: "inline"},
      h("button", {class: "btn sm", onclick: () => pickCustomIcons(true)}, "Load icons folder..."),
      h("button", {class: "btn sm ghost", tip: "If the browser won't open the folder (\"contains system files\"), open it here instead and select all the images with Ctrl+A.", onclick: () => pickCustomIcons(false)}, "Pick images..."),
      CUSTOM_ICONS.size ? h("button", {class: "btn sm ghost", onclick: () => setCustomIcons([])}, "Clear") : null),
    pathLine(PATH.icons));
}
let microRO = null;
let MICRO = null, microRaf = 0;
// Live version for edits: once per frame, patch the drawn mini screen (falls back to a full paint)
function liveMicro(){
  if (microRaf) return;
  microRaf = requestAnimationFrame(() => {
    microRaf = 0;
    const host = $("#pvHost"); if (!host || !S.doc) return;
    const selBar = S.sel && IDX.get(S.sel) ? IDX.get(S.sel).bar : null;
    if (!MICRO || !host.contains(MICRO.scr) || !patchScreen(MICRO.scr, MICRO.entries, false, selBar)) paintMicro();
  });
}
function paintMicro(){
  const host = $("#pvHost"); if (!host || !S.doc) return;
  const {W, H} = pvSize();
  const scale = (host.clientWidth || 300) / W;
  host.style.height = Math.round(H * scale) + "px";
  const selBar = S.sel && IDX.get(S.sel) ? IDX.get(S.sel).bar : null;
  const {scr, entries} = buildScreen({selected: selBar});
  MICRO = {scr, entries};
  scr.style.transform = `scale(${scale})`;
  scr.style.setProperty("--ow", Math.max(2, 2 / scale) + "px");
  host.replaceChildren(scr);
  PIXEL_PAINT?.();
  if (!microRO) { microRO = new ResizeObserver(() => { const hh = $("#pvHost"); if (hh && hh._w !== hh.clientWidth) { hh._w = hh.clientWidth; paintMicro(); } }); }
  if (!host._observed) { host._observed = true; microRO.observe(host); }
}
