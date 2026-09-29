// SPDX-License-Identifier: AGPL-3.0-or-later
// The element helper, app state, undo, and the shared widgets: toggles, number boxes, dropdowns, menus, color picker, dialogs, tooltips, icons.
"use strict";

/* =====================================================================
   UI
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids){
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "tip") e.dataset.tip = v;
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const svg = (d, s = 12) => { const e = document.createElementNS("http://www.w3.org/2000/svg", "svg"); e.setAttribute("width", s); e.setAttribute("height", s); e.setAttribute("viewBox", "0 0 16 16"); e.innerHTML = d; return e; };
const ICONS = {
  chev: '<path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  down: '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  copy: '<rect x="5" y="5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10V4a1 1 0 011-1h6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  undo: '<path d="M5 3L2 6l3 3M2 6h7a4 4 0 010 8H6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  eye: '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/>',
  redo: '<path d="M11 3l3 3-3 3M14 6H7a4 4 0 000 8h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  folder: '<path d="M2 4.5h4l1.2 1.5H14v6.5H2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  dash: '<path d="M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/>',
  prompt: '<path d="M3 5l3 3-3 3M8 11h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
};

/* ---------- state ---------- */
const S = {
  doc: null, fileName: "", handle: null, originalText: "", savedText: "", loadedMtime: 0, dirty: false,
  view: "bars", sel: null, multi: new Set(), anchor: null, expanded: new Set(), query: "",
  undo: [], redo: [], selSet: 0, tableFilter: "", tableType: -1,
};
function store(key, val){ try { if (val === undefined) return localStorage.getItem("qolbarunwrap." + key); localStorage.setItem("qolbarunwrap." + key, val); } catch { return null; } }

/* ---------- index: parent lookups for the whole tree ---------- */
let IDX = new Map();
function reindex(){
  IDX = new Map();
  if (!S.doc) return;
  S.doc.BarCfgs.forEach((b, bi) => {
    IDX.set(b, {kind: "bar", bar: b, list: S.doc.BarCfgs, index: bi, parent: null, path: [bi]});
    const rec = (list, parent, path) => list.forEach((sh, i) => {
      const p = path.concat(i);
      IDX.set(sh, {kind: "sh", bar: b, list, index: i, parent, path: p});
      if (sh.sL) rec(sh.sL, sh, p);
    });
    rec(b.sL || [], null, [bi]);
  });
}
function resolvePath(path){
  if (!S.doc || !path) return null;
  let o = S.doc.BarCfgs[path[0]]; if (!o) return null;
  for (let i = 1; i < path.length; i++) { o = o.sL && o.sL[path[i]]; if (!o) return null; }
  return o;
}
function ancestors(sh){ const out = []; let m = IDX.get(sh); while (m && m.parent) { out.push(m.parent); m = IDX.get(m.parent); } return out; }
function locationText(sh){
  const m = IDX.get(sh); if (!m) return "";
  return [m.bar.n || "(bar)", ...ancestors(sh).reverse().map(a => displayName(a) || "(category)")].join(" › ");
}

/* ---------- undo ---------- */
function snapshot(){
  const m = S.sel && IDX.get(S.sel);
  return {doc: structuredClone(S.doc), sel: m ? m.path : null, expanded: [...S.expanded].map(o => IDX.get(o)?.path).filter(Boolean), selSet: S.selSet};
}
function restore(snap){
  S.doc = snap.doc; reindex();
  S.sel = snap.sel ? resolvePath(snap.sel) : null;
  S.expanded = new Set(snap.expanded.map(resolvePath).filter(Boolean));
  S.multi.clear(); S.selSet = snap.selSet;
}
function commit(){ S.undo.push(snapshot()); if (S.undo.length > 200) S.undo.shift(); S.redo.length = 0; renderHeaderState(); }
// Undo swaps in a copy of the document, so a live-edit panel would point at stale objects: close it
function undo(){ if (!S.undo.length) return; S.redo.push(snapshot()); restore(S.undo.pop()); markDirty(); render(); closeEditPanel(); fsRefresh(true); }
function redo(){ if (!S.redo.length) return; S.undo.push(snapshot()); restore(S.redo.pop()); markDirty(); render(); closeEditPanel(); fsRefresh(true); }
// Text fields: one undo step per focus session instead of one per keystroke
function lazyCommit(el){ let done = false; el.addEventListener("focus", () => done = false); return () => { if (!done) { commit(); done = true; } }; }

let treeTimer = 0;
function markDirty(){ S.dirty = true; renderHeaderState(); schedulePersist(); }
function touch(){ applyTricks(); markDirty(); fsRefresh(); liveMicro(); clearTimeout(treeTimer); treeTimer = setTimeout(() => { if (S.view === "bars") renderTree(); else if (S.view === "conds") paintSetList(); else if (S.view === "tricks") paintTricks(); PIXEL_PAINT?.(); }, 150); }
function mutate(fn){ commit(); fn(); applyTricks(); reindex(); markDirty(); render(); fsRefresh(true); }

/* ---------- small widgets ---------- */
function toast(msg, kind = ""){ const t = h("div", {class: "toast " + kind}, msg); $("#toasts").append(t); setTimeout(() => t.remove(), kind === "err" ? 8000 : 3500); }
function checkbox(on, onChange, cls = ""){
  const e = h("span", {class: "cb " + cls + (on ? " on" : ""), role: "checkbox", tabindex: 0});
  const flip = ev => { ev.stopPropagation(); ev.preventDefault(); on = !on; e.classList.toggle("on", on); onChange(on, ev); };
  e.addEventListener("click", flip); e.addEventListener("keydown", ev => { if (ev.key === " " || ev.key === "Enter") flip(ev); });
  return e;
}
function toggle(on, onChange, label){
  const e = h("span", {class: "sw" + (on ? " on" : ""), role: "switch", tabindex: 0}, h("span", {class: "track"}), label ? h("span", null, label) : null);
  const flip = ev => { ev.preventDefault(); on = !on; e.classList.toggle("on", on); onChange(on); };
  e.addEventListener("click", flip); e.addEventListener("keydown", ev => { if (ev.key === " " || ev.key === "Enter") flip(ev); });
  return e;
}
function seg(value, options, onChange){
  const e = h("div", {class: "seg"});
  const btns = options.map(([v, label, tip]) => h("button", {type: "button", class: v === value ? "on" : "", tip, onclick: () => { if (v === value) return; value = v; btns.forEach((b, i) => b.classList.toggle("on", options[i][0] === v)); onChange(v); }}, label));
  e.append(...btns);
  return e;
}
function textInput(value, onInput, opts = {}){
  const e = h(opts.multiline ? "textarea" : "input", {class: "txt " + (opts.cls || ""), spellcheck: "false", placeholder: opts.placeholder || "", rows: opts.rows});
  e.value = value ?? "";
  const lc = lazyCommit(e);
  e.addEventListener("input", () => { lc(); onInput(e.value, e); });
  if (opts.multiline && opts.autosize) {
    const fit = () => { e.style.height = "auto"; e.style.height = Math.min(e.scrollHeight + 2, 340) + "px"; };
    e.addEventListener("input", fit); requestAnimationFrame(fit);
  }
  return e;
}
let SCRUB_EL = null; // the number box currently being dragged, so panels don't rebuild it mid-drag
function numInput(value, onChange, {step = 1, min = -Infinity, max = Infinity, float = false, width, noUndo = false} = {}){
  const e = h("input", {class: "txt num", inputmode: float ? "decimal" : "numeric", spellcheck: "false"});
  if (width) e.style.width = width;
  e.value = String(value);
  const lc = noUndo ? () => {} : lazyCommit(e);
  const parse = s => { if (!(float ? /^\s*-?\d*\.?\d+(e-?\d+)?\s*$/i : /^\s*-?\d+\s*$/).test(s)) return null; const v = float ? parseFloat(s) : parseInt(s, 10); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null; };
  const apply = v => { lc(); value = float ? Math.round(v * 1e6) / 1e6 : v; onChange(value); };
  e.addEventListener("input", () => { const v = parse(e.value); e.classList.toggle("bad", v === null); if (v !== null) apply(v); });
  e.addEventListener("blur", () => { e.classList.remove("bad"); e.value = String(value); });
  e.addEventListener("keydown", ev => {
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") { ev.preventDefault(); const d = (ev.key === "ArrowUp" ? 1 : -1) * step * (ev.shiftKey ? 10 : 1); apply(Math.min(max, Math.max(min, (parse(e.value) ?? value) + d))); e.value = String(value); }
    if (ev.key === "Enter") e.blur();
  });
  // Drag to change, like Dalamud / ImGui drag fields: right increases, left decreases, one step per pixel.
  // Shift = 10x faster, Alt = 10x finer. A click without dragging just focuses the box for typing.
  e.addEventListener("pointerdown", ev => {
    if (ev.button !== 0 || document.activeElement === e) return; // already typing: normal text selection
    ev.preventDefault();
    try { e.setPointerCapture(ev.pointerId); } catch {}
    const x0 = ev.clientX, start = value;
    let moved = false, committed = false;
    e.onpointermove = m => {
      const dx = m.clientX - x0;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) { moved = true; SCRUB_EL = e; e.classList.add("scrub"); }
      if (!committed && !noUndo) { commit(); committed = true; } // the whole drag is one undo step
      const k = step * (m.shiftKey ? 10 : 1) * (m.altKey ? .1 : 1);
      let v = start + Math.round(dx) * k;
      v = float ? Math.round(v / (k || 1)) * (k || 1) : Math.round(v);
      v = Math.min(max, Math.max(min, v));
      if (v !== value) { value = float ? Math.round(v * 1e6) / 1e6 : v; e.value = String(value); onChange(value); }
    };
    e.onpointerup = () => {
      e.onpointermove = e.onpointerup = null; e.classList.remove("scrub");
      if (SCRUB_EL === e) { SCRUB_EL = null; e.dispatchEvent(new Event("scrubend", {bubbles: true})); }
      if (!moved) { e.focus(); e.select(); }
    };
  });
  return e;
}
function help(text){ return h("span", {class: "q", tip: text}, "?"); }

/* popovers */
let POP = null;
function closePop(){ if (POP) { POP.el.remove(); POP.anchor?.classList.remove("open"); if (POP.anchor?._temp) POP.anchor.remove(); POP = null; } }

/* ---------- right-click menus ----------
   Any element can offer a menu by setting el._ctx = () => [items]. An item is {label, act, hint, danger,
   disabled, icon} or "-" for a divider. Text fields keep the browser's own menu (copy / paste / spelling). */
function withCtx(el, fn){ el._ctx = fn; return el; }
function showMenu(x, y, items){
  const anchor = h("div", {style: {position: "fixed", left: x + "px", top: y + "px", width: "0", height: "0"}});
  anchor._temp = true;
  (document.fullscreenElement || document.body).append(anchor);
  const opts = [];
  const list = h("div", {class: "pop-list"}, items.filter(Boolean).map(it => {
    if (it === "-") return h("div", {class: "ctx-sep"});
    if (it.header) return h("div", {class: "grp"}, it.header);
    const el = h("div", {class: "opt ctx-opt" + (it.danger ? " danger" : "") + (it.disabled ? " disabled" : ""), onmousedown: ev => ev.preventDefault(),
      onclick: () => { if (it.disabled) return; closePop(); it.act(); }},
      h("span", {class: "ctx-ic"}, it.icon ? svg(ICONS[it.icon] || it.icon, 12) : null), h("span", null, it.label), it.hint ? h("span", {class: "hint"}, it.hint) : null);
    if (!it.disabled) opts.push(el);
    return el;
  }));
  const pop = h("div", {class: "pop ctx", tabindex: -1}, list);
  let hi = -1;
  pop.addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); hi = (hi + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, i) => o.classList.toggle("hi", i === hi)); }
    else if (ev.key === "Enter" && opts[hi]) { ev.preventDefault(); opts[hi].click(); }
    else if (ev.key === "Escape") { ev.stopPropagation(); closePop(); }
  });
  openPop(anchor, pop);
  pop.style.minWidth = "220px";
  pop.focus();
}
document.addEventListener("contextmenu", e => {
  if (e.defaultPrevented) return; // the fullscreen live editor handles its own right-clicks
  if (e.target.closest?.("input, textarea, [contenteditable]")) return; // keep copy / paste / spelling
  e.preventDefault();
  let fn = null;
  for (let n = e.target; n && !fn; n = n.parentElement) fn = n._ctx;
  const items = fn ? fn(e) : appMenu();
  const sel = String(window.getSelection?.() || "").trim();
  if (sel) items.unshift({label: "Copy", icon: "copy", hint: "Ctrl+C", act: () => navigator.clipboard.writeText(sel)}, "-");
  if (items.length) showMenu(e.clientX, e.clientY, items);
});
// Fallback menu for empty space
function appMenu(){
  if (!S.doc) return [{label: "Open files...", act: openFile}, ...(CAN_FOLDER ? [{label: "Connect folder...", act: () => connectFolder()}] : [])];
  return [
    {label: "Undo", icon: "undo", hint: "Ctrl+Z", disabled: !S.undo.length, act: undo},
    {label: "Redo", icon: "redo", hint: "Ctrl+Y", disabled: !S.redo.length, act: redo},
    "-",
    {label: "Import from string...", hint: "Ctrl+V", act: () => importStringModal()},
    {label: "Import from another QoLBar.json...", act: importFromFileModal},
    "-",
    {label: "Fullscreen preview", hint: "F", act: openFullscreen},
    {label: "Reload from disk", act: reloadFromDisk},
    {label: S.handle ? "Save" : "Download", hint: "Ctrl+S", act: save},
    "-",
    {label: "Keyboard shortcuts", hint: "?", act: keySheet},
    {label: "Take the tour", act: startTour},
  ];
}
function openPop(anchor, el){
  closePop();
  (document.fullscreenElement || document.body).append(el); // inside browser fullscreen only that element is drawn
  const r = anchor.getBoundingClientRect(), pr = el.getBoundingClientRect();
  let top = r.bottom + 4, left = r.left;
  if (top + pr.height > innerHeight - 8) top = Math.max(8, r.top - pr.height - 4);
  if (left + pr.width > innerWidth - 8) left = Math.max(8, innerWidth - pr.width - 8);
  Object.assign(el.style, {top: top + "px", left: left + "px", minWidth: Math.max(r.width, 180) + "px"});
  anchor.classList.add("open");
  POP = {el, anchor, at: performance.now()};
}
document.addEventListener("mousedown", e => { if (POP && !POP.el.contains(e.target) && !POP.anchor.contains(e.target)) closePop(); }, true);
addEventListener("resize", closePop);
// Close popovers when the page scrolls, except for the moment right after a right-click menu opens
// (selecting the clicked row redraws panels, which resets their scroll and would close the new menu)
document.addEventListener("scroll", e => { if (POP && !POP.el.contains(e.target) && !(POP.anchor._temp && performance.now() - POP.at < 400)) closePop(); }, true);

function dropdown({value, options, onChange, searchable = options.length > 12, placeholder = "Select...", width, allowCustom = false}){
  const btn = h("button", {type: "button", class: "dd"});
  if (width) btn.style.width = width;
  const paint = () => {
    const o = options.find(o => o.value === value);
    const custom = allowCustom && value !== "" && value != null && !o;
    btn.replaceChildren(h("span", {class: "dd-label" + (o || custom ? "" : " faint")}, o ? o.label : custom ? String(value) : placeholder), h("span", {class: "dd-caret"}, "▼"));
  };
  paint();
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (POP && POP.anchor === btn) return closePop();
    const pop = h("div", {class: "pop", tabindex: -1});
    const search = searchable || allowCustom ? h("input", {class: "txt pop-search", placeholder: allowCustom ? "Search or type a custom value" : "Search..."}) : null;
    const list = h("div", {class: "pop-list"});
    let hi = -1, shown = [];
    const pick = v => { value = v; paint(); closePop(); onChange(v); btn.focus(); };
    const paintHi = scroll => shown.forEach(([, el], i) => { el.classList.toggle("hi", i === hi); if (i === hi && scroll) el.scrollIntoView({block: "nearest"}); });
    const draw = () => {
      const q = (search?.value || "").toLowerCase().trim();
      list.replaceChildren(); shown = [];
      let lastGroup = null;
      for (const o of options) {
        if (q && !(o.label + " " + (o.hint || "") + " " + (o.search || "")).toLowerCase().includes(q)) continue;
        if (o.group && o.group !== lastGroup) { list.append(h("div", {class: "grp"}, o.group)); lastGroup = o.group; }
        const el = h("div", {class: "opt" + (o.value === value ? " cur" : ""), onmousedown: ev => { ev.preventDefault(); pick(o.value); }}, o.mark ? h("span", {class: "mk " + o.mark, tip: o.markTip}, o.mark === "ok" ? "✓" : "?") : null, o.label, o.hint ? h("span", {class: "hint"}, o.hint) : null);
        shown.push([o.value, el]); list.append(el);
      }
      if (allowCustom && q && !options.some(o => o.label.toLowerCase() === q)) {
        const val = search.value.trim();
        const el = h("div", {class: "opt", onmousedown: ev => { ev.preventDefault(); pick(val); }}, "Use ", h("b", null, "\"" + val + "\""));
        shown.push([val, el]); list.append(el);
      }
      if (!shown.length) list.append(h("div", {class: "empty"}, "No matches"));
      hi = shown.findIndex(s => s[0] === value); if (hi < 0) hi = shown.length ? 0 : -1;
      paintHi(false);
    };
    const key = ev => {
      if (ev.key === "ArrowDown") { hi = Math.min(shown.length - 1, hi + 1); paintHi(true); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { hi = Math.max(0, hi - 1); paintHi(true); ev.preventDefault(); }
      else if (ev.key === "Enter") { if (shown[hi]) pick(shown[hi][0]); ev.preventDefault(); }
      else if (ev.key === "Escape") { ev.stopPropagation(); closePop(); btn.focus(); }
    };
    if (search) { search.addEventListener("input", draw); pop.append(search); }
    pop.addEventListener("keydown", key);
    pop.append(list); draw();
    openPop(btn, pop);
    (search || pop).focus();
    list.querySelector(".cur")?.scrollIntoView({block: "center"});
  });
  return btn;
}

/* hotkey capture */
const CODE_TO_VK = (() => {
  const m = {Space:0x20,Enter:0x0D,NumpadEnter:0x0D,Tab:0x09,Backspace:0x08,Insert:0x2D,Delete:0x2E,Home:0x24,End:0x23,PageUp:0x21,PageDown:0x22,ArrowLeft:0x25,ArrowUp:0x26,ArrowRight:0x27,ArrowDown:0x28,Semicolon:0xBA,Equal:0xBB,Comma:0xBC,Minus:0xBD,Period:0xBE,Slash:0xBF,Backquote:0xC0,BracketLeft:0xDB,Backslash:0xDC,BracketRight:0xDD,Quote:0xDE,IntlBackslash:0xE2,Pause:0x13,ScrollLock:0x91,CapsLock:0x14,NumLock:0x90,PrintScreen:0x2C,NumpadMultiply:0x6A,NumpadAdd:0x6B,NumpadSubtract:0x6D,NumpadDecimal:0x6E,NumpadDivide:0x6F,ContextMenu:0x5D};
  for (let i = 0; i < 26; i++) m["Key" + String.fromCharCode(65 + i)] = 0x41 + i;
  for (let i = 0; i < 10; i++) { m["Digit" + i] = 0x30 + i; m["Numpad" + i] = 0x60 + i; }
  for (let i = 1; i <= 24; i++) m["F" + i] = 0x6F + i;
  return m;
})();
function hotkeyInput(value, onChange){
  const lbl = h("span");
  const x = h("span", {class: "x", tip: "Clear hotkey"}, svg(ICONS.x, 10));
  const e = h("span", {class: "hk", tabindex: 0}, lbl, x);
  let capturing = false;
  const mods = ev => (ev.shiftKey ? MOD_SHIFT : 0) | (ev.ctrlKey ? MOD_CTRL : 0) | (ev.altKey ? MOD_ALT : 0);
  const paint = () => { lbl.textContent = capturing ? "Press a combo (Esc clears)" : (hotkeyName(value) || "None"); lbl.className = !capturing && !value ? "faint" : ""; e.classList.toggle("cap", capturing); x.style.visibility = value && !capturing ? "visible" : "hidden"; };
  const set = v => { capturing = false; if (v !== value) { value = v; onChange(v); } paint(); };
  x.addEventListener("click", ev => { ev.stopPropagation(); set(0); });
  e.addEventListener("click", () => { capturing = true; paint(); e.focus(); });
  e.addEventListener("blur", () => { capturing = false; paint(); });
  e.addEventListener("keydown", ev => {
    if (!capturing) { if (ev.key === "Enter" || ev.key === " ") { capturing = true; paint(); ev.preventDefault(); } return; }
    ev.preventDefault(); ev.stopPropagation();
    if (ev.key === "Escape") return set(0);
    if (["Shift", "Control", "Alt", "Meta"].includes(ev.key)) return;
    const vk = CODE_TO_VK[ev.code]; if (!vk) return toast("That key is not supported by QoLBar", "warn");
    set(vk | mods(ev));
  });
  e.addEventListener("mousedown", ev => { if (!capturing || ev.button === 0) return; ev.preventDefault(); const vk = {1: 4, 2: 2, 3: 5, 4: 6}[ev.button]; if (vk) set(vk | mods(ev)); });
  e.addEventListener("contextmenu", ev => { if (capturing) ev.preventDefault(); });
  paint();
  return e;
}

/* color picker */
function rgb2hsv(r, g, b){ r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0; if (d) { hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return {h: hh, s: mx ? d / mx : 0, v: mx}; }
function hsv2rgb(hh, s, v){ const f = n => { const k = (n + hh / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return {r: f(5), g: f(3), b: f(1)}; }
const COLOR_PRESETS = ["#FFFFFFFF","#FF5555FF","#FFAA33FF","#FFE066FF","#66DD77FF","#55CCEEFF","#5588FFFF","#BB77FFFF","#FF77CCFF","#999999FF","#FFFFFF80","#00000000"];
function colorInput(value, onChange, {undoable = true} = {}){
  const inner = h("i"); const sw = h("span", {class: "swatch", tabindex: 0}, inner);
  const hex = h("input", {class: "txt mono", style: {width: "112px", fontSize: "13px"}, spellcheck: "false"});
  let committed = false;
  const set = (v, fromHex) => { if (undoable && !committed) { commit(); committed = true; } value = v >>> 0; onChange(value); inner.style.background = cssColor(value); if (!fromHex) hex.value = colorToHex(value); };
  inner.style.background = cssColor(value); hex.value = colorToHex(value);
  hex.addEventListener("focus", () => committed = false);
  hex.addEventListener("input", () => { const v = hexToColor(hex.value); hex.classList.toggle("bad", v === null); if (v !== null) set(v, true); });
  hex.addEventListener("blur", () => { hex.classList.remove("bad"); hex.value = colorToHex(value); });
  sw.addEventListener("click", () => {
    if (POP && POP.anchor === sw) return closePop();
    committed = false;
    const c0 = colorToRGBA(value); let hsv = rgb2hsv(c0.r, c0.g, c0.b), alpha = c0.a;
    const svKnob = h("span", {class: "knob"}), hueKnob = h("span", {class: "knob"}), aKnob = h("span", {class: "knob"});
    const sv = h("div", {class: "sv"}, svKnob);
    const hue = h("div", {class: "bar", style: {background: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"}}, hueKnob);
    const aFill = h("div", {style: {position: "absolute", inset: "0", borderRadius: "7px"}});
    const aBar = h("div", {class: "bar", style: {background: "conic-gradient(#888 25%,#555 0 50%,#888 0 75%,#555 0) 0 0/10px 10px"}}, aFill, aKnob);
    const drawPick = () => {
      const {r, g, b} = hsv2rgb(hsv.h, hsv.s, hsv.v);
      sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hsv.h},100%,50%))`;
      svKnob.style.left = hsv.s * 100 + "%"; svKnob.style.top = (1 - hsv.v) * 100 + "%";
      hueKnob.style.left = hsv.h / 360 * 100 + "%";
      aFill.style.background = `linear-gradient(90deg,rgba(${r},${g},${b},0),rgb(${r},${g},${b}))`; aKnob.style.left = alpha / 255 * 100 + "%";
    };
    const emit = () => { const {r, g, b} = hsv2rgb(hsv.h, hsv.s, hsv.v); set(rgbaToColor({r, g, b, a: alpha})); drawPick(); };
    const drag = (el, fn) => el.addEventListener("pointerdown", ev => {
      el.setPointerCapture(ev.pointerId);
      const mv = e2 => { const r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (e2.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e2.clientY - r.top) / r.height))); emit(); };
      mv(ev); el.onpointermove = mv; el.onpointerup = () => el.onpointermove = null;
    });
    drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
    drag(hue, x => { hsv.h = x * 359.9; });
    drag(aBar, x => { alpha = Math.round(x * 255); });
    const presets = h("div", {class: "presets"}, COLOR_PRESETS.map(p => h("span", {tip: p, style: {background: cssColor(hexToColor(p))}, onclick: () => { const c = colorToRGBA(hexToColor(p)); hsv = rgb2hsv(c.r, c.g, c.b); alpha = c.a; emit(); }})));
    drawPick();
    openPop(sw, h("div", {class: "pop cp"}, sv, hue, aBar, presets, h("div", {class: "help"}, "Alpha below 100% makes the icon or text see-through.")));
  });
  return h("span", {class: "inline"}, sw, hex);
}

/* modal */
function modal({title, body, buttons = [["Close", null]], wide = false}){
  return new Promise(res => {
    const done = v => { closePop(); scrim.remove(); document.removeEventListener("keydown", esc, true); res(v); };
    const esc = e => { if (e.key === "Escape" && !POP) { e.stopPropagation(); done(null); } };
    document.addEventListener("keydown", esc, true);
    const ft = h("div", {class: "m-ft"}, buttons.map(([label, val, cls]) => h("button", {class: "btn " + (cls || ""), onclick: async () => { if (typeof val === "function") { const r = await val(); if (r !== false) done(r); } else done(val); }}, label)));
    const scrim = h("div", {class: "scrim", onmousedown: e => { if (e.target === scrim) done(null); }}, h("div", {class: "modal" + (wide ? " wide" : "")}, h("div", {class: "m-hd"}, title), h("div", {class: "m-bd"}, body), ft));
    (document.fullscreenElement || document.body).append(scrim);
    setTimeout(() => (scrim.querySelector("textarea,input") || ft.lastChild)?.focus(), 30);
  });
}
const confirmBox = (title, msg, ok = "Continue", cls = "primary") => modal({title, body: h("div", null, msg), buttons: [["Cancel", false], [ok, true, cls]]});

/* custom tooltips (instead of native title tooltips) */
(() => {
  const tip = $("#tip"); let cur = null;
  document.addEventListener("mouseover", e => {
    const t = e.target.closest?.("[data-tip]");
    if (t === cur) return; cur = t;
    if (!t || !t.dataset.tip) { tip.classList.remove("on"); return; }
    tip.textContent = t.dataset.tip; tip.classList.add("on");
    const r = t.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    let top = r.bottom + 6; const left = Math.min(innerWidth - tr.width - 8, Math.max(8, r.left + r.width / 2 - tr.width / 2));
    if (top + tr.height > innerHeight - 8) top = r.top - tr.height - 6;
    tip.style.top = top + "px"; tip.style.left = left + "px";
  });
  document.addEventListener("mousedown", () => { tip.classList.remove("on"); cur = null; });
})();

/* icon images: try the high-res texture, then low-res, then show the number */
/* Custom icons: negative icon IDs are image files in pluginConfigs\QoLBar\icons, named by number
   ("811002.png" is icon -811002). Loaded from a connected folder or picked by hand, and remembered. */
const ICON_STATS = {ok: new Set(), fail: new Set()}; // game icon IDs that loaded or failed this session
const CUSTOM_ICONS = new Map(); // number (positive) -> object URL
const IMG_EXT = /\.(png|jpe?g|gif|bmp|webp|tga|tiff?)$/i;
async function setCustomIcons(files, {persist = true, quiet = false} = {}){
  let n = 0;
  for (const u of CUSTOM_ICONS.values()) URL.revokeObjectURL(u);
  CUSTOM_ICONS.clear();
  const keep = [];
  for (const f of files) {
    const m = /^(\d+)\.[^.]+$/.exec(f.name); if (!m || !IMG_EXT.test(f.name) || +m[1] <= 0) continue;
    CUSTOM_ICONS.set(+m[1], URL.createObjectURL(f)); keep.push(f); n++;
  }
  if (persist) await idb.set("customIcons", keep.map(f => ({name: f.name, blob: f})));
  if (!quiet) toast(n ? `Loaded ${n} custom icon${n === 1 ? "" : "s"}` : "No numbered images found (custom icons are named like 811002.png)", n ? "" : "warn");
  if (S.doc) render();
  return n;
}
async function loadCustomIconsFromDir(dirHandle){
  try {
    const pc = await dirHandle.getDirectoryHandle("pluginConfigs"), q = await pc.getDirectoryHandle("QoLBar"), icons = await q.getDirectoryHandle("icons");
    const files = [];
    for await (const [name, hd] of icons.entries()) if (hd.kind === "file" && IMG_EXT.test(name)) files.push(await hd.getFile());
    await setCustomIcons(files, {quiet: true});
    return files.length;
  } catch { return 0; }
}
// folder = pick the whole icons folder; otherwise select the image files themselves (the fallback when a
// browser refuses a folder inside AppData: select everything in the icons folder with Ctrl+A)
function pickCustomIcons(folder = true){
  const i = h("input", {type: "file", multiple: true, accept: "image/*"}); i.webkitdirectory = folder;
  i.onchange = () => setCustomIcons([...i.files]); i.click();
}

// Game icons are padded to a square (object-fit: contain); custom images are stretched to fill (QoLBar does the same)
function iconImg(id, box, hr = true){
  if (id < 0) {
    const url = CUSTOM_ICONS.get(-id);
    if (!url) { box.textContent = "?"; box.dataset.tip = `Custom icon ${id}: load your icons folder (pluginConfigs\\QoLBar\\icons) in the preview panel to see it`; return document.createTextNode(""); }
    const img = h("img", {src: url, alt: "", style: {objectFit: "fill"}});
    return img;
  }
  const urls = iconUrls(id, hr); let at = 0;
  const img = h("img", {src: urls[0], loading: "lazy", alt: "", style: {objectFit: "contain"}});
  img.onerror = () => { if (++at < urls.length) img.src = urls[at]; else { ICON_STATS.fail.add(id); img.remove(); box.textContent = id; } };
  img.addEventListener("load", () => ICON_STATS.ok.add(id));
  return img;
}
function thumb(sh, large = false){
  const p = parseName(sh.n);
  const box = h("span", {class: "thumb" + (large ? " lg" : "") + (p.args.includes("g") ? " gray" : "") + (p.args.includes("r") ? " flip" : "")});
  if (p.hasIcon) {
    // Same drawing as the preview (zoom / offset / rotation), so sheet icons show the picked symbol
    if (p.icon !== 0) { box.classList.remove("gray", "flip"); box.append(gIcon(sh, p, large ? 48 : 22, animIndex(sh), {noFrame: true})); }
    if (sh.cl !== 4294967295) box.style.boxShadow = `inset 0 0 0 2px ${cssColor(sh.cl)}`;
  } else {
    box.append(svg(sh.t === 1 ? ICONS.folder : sh.t === 2 ? ICONS.dash : ICONS.prompt, large ? 24 : 13));
    if (sh.cl !== 4294967295) box.style.color = cssColor(sh.cl);
  }
  return box;
}
