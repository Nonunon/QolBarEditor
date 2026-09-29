// SPDX-License-Identifier: AGPL-3.0-or-later
// The bars tree, drag and drop, right-click menus and bulk actions.
"use strict";

/* ---------- tree ---------- */
let visibleOrder = [];
const matches = (sh, q) => !q || (sh.n + "\n" + sh.c + "\n" + hotkeyName(sh.k)).toLowerCase().includes(q);
function renderTree(){
  const tree = $("#tree"); if (!tree) return;
  reindex();
  const scroll = tree.scrollTop;
  tree.replaceChildren(); visibleOrder = [];
  const q = S.query.trim().toLowerCase();
  const subtreeHit = sh => matches(sh, q) || (sh.sL || []).some(subtreeHit);
  S.doc.BarCfgs.forEach(bar => {
    if (q && !bar.n.toLowerCase().includes(q) && !(bar.sL || []).some(subtreeHit)) return;
    tree.append(barRow(bar));
    if (!S.expanded.has(bar) && !q) return;
    const rec = (list, depth) => list.forEach(sh => {
      if (q && !subtreeHit(sh)) return;
      tree.append(shRow(sh, depth));
      if (sh.sL && (S.expanded.has(sh) || q)) rec(sh.sL, depth + 1);
    });
    rec(bar.sL || [], 1);
    if (!(bar.sL || []).length) tree.append(h("div", {class: "row faint", style: {paddingLeft: "44px", cursor: "default", fontSize: "12.5px"}}, "Empty bar. Drag shortcuts onto it or add one on the right."));
  });
  if (!S.doc.BarCfgs.length) tree.append(h("div", {class: "faint", style: {padding: "20px"}}, "No bars. Click + Bar to create one."));
  tree.scrollTop = scroll;
  renderBulk();
}
function chevron(obj, has){
  if (!has) return h("span", {class: "chev"});
  return h("span", {class: "chev" + (S.expanded.has(obj) || S.query ? " open" : ""), onclick: e => { e.stopPropagation(); S.expanded.has(obj) ? S.expanded.delete(obj) : S.expanded.add(obj); renderTree(); }}, svg(ICONS.chev, 11));
}
function select(obj){ S.sel = obj; renderTree(); renderInspector(); paintMicro(); }
function barRow(bar){
  const cs = bar.c >= 0 ? S.doc.CndSetCfgs[bar.c] : null;
  const row = h("div", {class: "row bar" + (S.sel === bar ? " sel" : ""), draggable: "true"},
    chevron(bar, true),
    h("span", {class: "grow"}, h("span", {class: "lbl"}, bar.n || h("i", {class: "faint"}, "(unnamed bar)")),
      bar.h ? h("span", {class: "chip hid"}, "hidden") : null,
      cs ? h("span", {class: "chip cond", tip: "Only shown while condition set #" + (bar.c + 1) + " is true:\n" + cs.c.map((c, i) => (i ? OPERATORS[c.o] + " " : "") + condText(c, S.doc.CndSetCfgs)).join("\n")}, "if " + (cs.n || "#" + (bar.c + 1))) : null,
      bar.c >= 0 && !cs ? h("span", {class: "chip hid"}, "missing set #" + (bar.c + 1)) : null,
      bar.k ? h("span", {class: "chip key"}, hotkeyName(bar.k)) : null),
    h("span", {class: "faint", style: {fontSize: "12px", fontWeight: 400}}, (bar.sL || []).length));
  row.addEventListener("click", () => { S.multi.clear(); select(bar); });
  row.addEventListener("dblclick", () => { S.expanded.has(bar) ? S.expanded.delete(bar) : S.expanded.add(bar); renderTree(); });
  wireDnD(row, bar);
  withCtx(row, () => barMenu(bar));
  return row;
}
function shRow(sh, depth){
  const p = parseName(sh.n);
  const name = p.label || (p.hasTooltip ? p.tooltip : "");
  const cmdLine = (sh.c || "").split("\n").find(l => l.trim()) || "";
  const row = h("div", {class: "row" + (S.sel === sh ? " sel" : "") + (S.multi.has(sh) ? " multi" : ""), draggable: "true", style: {paddingLeft: (8 + depth * 18) + "px"}},
    checkbox(S.multi.has(sh), (on, ev) => toggleMulti(sh, on, ev.shiftKey), "blue"),
    chevron(sh, !!(sh.sL && sh.sL.length)),
    thumb(sh),
    h("span", {class: "grow"},
      h("span", {class: "lbl" + (p.label ? "" : " dim"), style: {color: !p.hasIcon && sh.cl !== 4294967295 ? cssColor((sh.cl | 0xFF000000) >>> 0) : "", fontStyle: p.label ? "" : "italic"}}, name || (p.hasIcon ? "" : "(blank)")),
      sh.t === 1 ? h("span", {class: "chip cat"}, "category" + (sh.sL ? " · " + sh.sL.length : "")) : null,
      sh.t === 2 ? h("span", {class: "chip spc"}, "spacer") : null,
      sh.m ? h("span", {class: "chip mode", tip: sh.m === 1 ? "Incremental: each press runs the next line or child" : "Random: each press runs a random line or child"}, SH_MODES[sh.m].toLowerCase()) : null,
      sh.k ? h("span", {class: "chip key"}, hotkeyName(sh.k)) : null,
      sh.clA ? h("span", {class: "chip plain"}, ANIMS[sh.clA] || "anim") : null,
      h("span", {class: "cmd"}, cmdLine)));
  row.addEventListener("click", e => {
    if (e.ctrlKey || e.metaKey) return toggleMulti(sh, !S.multi.has(sh), false);
    if (e.shiftKey) return toggleMulti(sh, true, true);
    S.anchor = sh; if (!S.multi.has(sh)) S.multi.clear(); select(sh);
  });
  row.addEventListener("dblclick", () => { if (sh.sL) { S.expanded.has(sh) ? S.expanded.delete(sh) : S.expanded.add(sh); renderTree(); } });
  visibleOrder.push(sh);
  wireDnD(row, sh);
  withCtx(row, () => shortcutMenu(sh));
  return row;
}
function toggleMulti(sh, on, range){
  if (range && S.anchor && visibleOrder.includes(S.anchor)) {
    const a = visibleOrder.indexOf(S.anchor), b = visibleOrder.indexOf(sh);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) S.multi.add(visibleOrder[i]);
  } else { on ? S.multi.add(sh) : S.multi.delete(sh); S.anchor = sh; }
  if (S.view === "bars") renderTree(); else rerenderTable();
}

/* drag and drop */
let DRAG = null;
function wireDnD(row, obj){
  const isBar = IDX.get(obj)?.kind === "bar";
  row.addEventListener("dragstart", e => {
    DRAG = {items: !isBar && S.multi.has(obj) ? topLevelOnly([...S.multi]) : [obj], isBar};
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "qolbar");
    setTimeout(() => row.classList.add("dragging"), 0);
  });
  row.addEventListener("dragend", () => { DRAG = null; document.querySelectorAll(".dragging,.drop-before,.drop-after,.drop-into").forEach(el => el.classList.remove("dragging", "drop-before", "drop-after", "drop-into")); });
  row.addEventListener("dragover", e => {
    if (!DRAG) return;
    const zone = dropZone(e, row, obj, isBar); if (!zone) return;
    e.preventDefault();
    row.classList.remove("drop-before", "drop-after", "drop-into"); row.classList.add("drop-" + zone);
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-before", "drop-after", "drop-into"));
  row.addEventListener("drop", e => {
    e.preventDefault(); e.stopPropagation(); if (!DRAG) return;
    const zone = dropZone(e, row, obj, isBar), {items, isBar: barDrag} = DRAG; DRAG = null;
    if (!zone) return;
    if (barDrag) return mutate(() => { const bars = S.doc.BarCfgs; bars.splice(bars.indexOf(items[0]), 1); bars.splice(bars.indexOf(obj) + (zone === "after" ? 1 : 0), 0, items[0]); });
    moveItems(items, obj, zone);
  });
}
function dropZone(e, row, target, targetIsBar){
  const r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
  if (DRAG.isBar) return targetIsBar && target !== DRAG.items[0] ? (y < .5 ? "before" : "after") : null;
  if (DRAG.items.includes(target)) return null;
  if (!targetIsBar && DRAG.items.some(it => ancestors(target).includes(it))) return null;
  if (targetIsBar) return "into";
  if (target.t === 1) return y < .28 ? "before" : y > .72 ? "after" : "into";
  return y < .5 ? "before" : "after";
}
function cmpPath(a, b){ for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }
function topLevelOnly(items){ const set = new Set(items); return items.filter(it => IDX.has(it) && !ancestors(it).some(a => set.has(a))).sort((a, b) => cmpPath(IDX.get(a).path, IDX.get(b).path)); }
function moveItems(items, target, zone){
  mutate(() => {
    for (const it of items) { const m = IDX.get(it); m.list.splice(m.list.indexOf(it), 1); }
    let list, idx;
    if (zone === "into") { list = IDX.get(target).kind === "bar" ? target.sL : (target.sL ??= []); idx = list.length; S.expanded.add(target); }
    else { list = IDX.get(target).list; idx = list.indexOf(target) + (zone === "after" ? 1 : 0); }
    list.splice(idx, 0, ...items);
  });
  toast(`Moved ${items.length} item${items.length > 1 ? "s" : ""}`);
}

/* ---------- right-click menus for bars, buttons, condition sets and condition rows ---------- */
function moveInList(list, obj, d){ const i = list.indexOf(obj), j = i + d; if (i < 0 || j < 0 || j >= list.length) return; mutate(() => { list.splice(i, 1); list.splice(j, 0, obj); }); }
function shortcutMenu(sh){
  if (!IDX.has(sh)) return appMenu();
  if (S.multi.has(sh) && S.multi.size > 1) {
    const items = () => topLevelOnly([...S.multi]);
    return [{header: `${S.multi.size} selected`},
      {label: "Duplicate", hint: "Ctrl+D", act: () => duplicate(items())},
      {label: "Clear hotkeys", act: () => mutate(() => S.multi.forEach(s => { s.k = 0; s.kP = false; }))},
      {label: "Find & replace...", act: () => findReplace(true)},
      "-",
      {label: "Clear selection", act: () => { S.multi.clear(); renderTree(); }},
      {label: `Delete ${S.multi.size}`, icon: "trash", hint: "Del", danger: true, act: () => deleteItems(items())}];
  }
  if (S.sel !== sh && S.view === "bars") { S.multi.clear(); select(sh); }
  const m = IDX.get(sh), list = m.list, i = list.indexOf(sh);
  return [{header: displayName(sh) || "(blank)"},
    ...(S.view !== "bars" ? [{label: "Open in editor", act: () => goTo(sh)}] : []),
    {label: "Copy import string", icon: "copy", act: () => copyImportString("shortcut", sh)},
    {label: "Duplicate", hint: "Ctrl+D", act: () => duplicate([sh])},
    "-",
    {label: "Add shortcut after", icon: "plus", act: () => addShortcut(list, 0, sh)},
    {label: "Add category after", icon: "plus", act: () => addShortcut(list, 1, sh)},
    {label: "Add spacer after", icon: "plus", act: () => addShortcut(list, 2, sh)},
    ...(sh.t === 1 ? [{label: "Add shortcut inside", icon: "plus", act: () => addShortcut(sh.sL ??= [], 0)}] : []),
    "-",
    {label: "Move up", icon: "up", disabled: i === 0, act: () => moveInList(list, sh, -1)},
    {label: "Move down", icon: "down", disabled: i === list.length - 1, act: () => moveInList(list, sh, 1)},
    ...(sh.k ? [{label: `Clear hotkey (${hotkeyName(sh.k)})`, act: () => mutate(() => { sh.k = 0; sh.kP = false; })}] : []),
    "-",
    {label: "Delete", icon: "trash", hint: "Del", danger: true, act: () => deleteItems([sh])}];
}
async function deleteBar(bar){
  if (await confirmBox("Delete bar", `Delete bar "${bar.n}" and its ${(bar.sL || []).length} shortcuts? Undo is available.`, "Delete", "danger"))
    mutate(() => { S.doc.BarCfgs.splice(S.doc.BarCfgs.indexOf(bar), 1); if (S.sel === bar || IDX.get(S.sel)?.bar === bar) S.sel = null; });
}
function barMenu(bar){
  if (!IDX.has(bar)) return appMenu();
  if (S.sel !== bar && S.view === "bars") { S.multi.clear(); select(bar); }
  const bars = S.doc.BarCfgs, i = bars.indexOf(bar), set = bar.c >= 0 ? S.doc.CndSetCfgs[bar.c] : null;
  return [{header: bar.n || "(unnamed bar)"},
    ...(S.view !== "bars" ? [{label: "Open in editor", act: () => goTo(bar)}] : []),
    {label: "Copy import string", icon: "copy", act: () => copyImportString("bar", bar)},
    {label: "Duplicate bar", act: () => mutate(() => { const c = structuredClone(bar); c.n += " (copy)"; bars.splice(i + 1, 0, c); S.sel = c; })},
    "-",
    {label: "Add shortcut", icon: "plus", act: () => addShortcut(bar.sL, 0)},
    {label: "Add category", icon: "plus", act: () => addShortcut(bar.sL, 1)},
    {label: "Add spacer", icon: "plus", act: () => addShortcut(bar.sL, 2)},
    "-",
    {label: "Copy placement", icon: "copy", act: () => copyPlacement(bar)},
    {label: "Paste position", act: () => pastePlacement(bar, "pos")},
    {label: "Paste position and layout", act: () => pastePlacement(bar, "look")},
    "-",
    {label: bar.h ? "Show bar" : "Hide bar", act: () => mutate(() => bar.h = !bar.h)},
    ...(set ? [{label: `Edit condition set "${set.n || "#" + (bar.c + 1)}"`, act: () => { S.selSet = bar.c; S.view = "conds"; render(); }}] : []),
    {label: "Move up", icon: "up", disabled: i === 0, act: () => moveInList(bars, bar, -1)},
    {label: "Move down", icon: "down", disabled: i === bars.length - 1, act: () => moveInList(bars, bar, 1)},
    "-",
    {label: "Delete bar", icon: "trash", danger: true, act: () => deleteBar(bar)}];
}
function treeMenu(){
  return [{label: "New bar", icon: "plus", act: addBar},
    {label: "Import from string...", hint: "Ctrl+V", act: () => importStringModal()},
    {label: "Import from another QoLBar.json...", act: importFromFileModal},
    "-",
    {label: "Expand all", icon: "down", act: () => { for (const [o, m] of IDX) if (m.kind === "bar" || o.sL?.length) S.expanded.add(o); renderTree(); }},
    {label: "Collapse all", icon: "up", act: () => { S.expanded.clear(); renderTree(); }}];
}
async function deleteSet(i){
  const s = S.doc.CndSetCfgs[i], u = usedBy(i);
  if (await confirmBox("Delete condition set", `Delete "${s.n}"? ${u.bars.length} bar(s) using it become always shown, and "Condition Set" rows pointing at it are removed. Later sets are renumbered automatically.`, "Delete", "danger")) mutate(() => removeSet(S.doc, i));
}
function setMenu(i){
  const sets = S.doc.CndSetCfgs, s = sets[i]; if (!s) return appMenu();
  if (S.selSet !== i) { S.selSet = i; render(); }
  return [{header: `#${i + 1} ${s.n || "(unnamed)"}`},
    {label: "Copy import string", icon: "copy", act: () => copyImportString("set", s)},
    {label: "Duplicate", act: () => mutate(() => { const c = structuredClone(s); c.n += " (copy)"; sets.push(c); S.selSet = sets.length - 1; })},
    {label: "Add condition", icon: "plus", act: () => { commit(); s.c.push(makeCond({i: "cf", a: 26})); touch(); render(); }},
    "-",
    {label: "Import from string...", hint: "Ctrl+V", act: () => importStringModal()},
    {label: "Import from another QoLBar.json...", act: importFromFileModal},
    "-",
    {label: "Move up", icon: "up", disabled: i === 0, act: () => mutate(() => { moveSet(S.doc, i, i - 1); S.selSet = i - 1; })},
    {label: "Move down", icon: "down", disabled: i === sets.length - 1, act: () => mutate(() => { moveSet(S.doc, i, i + 1); S.selSet = i + 1; })},
    "-",
    {label: "Delete set", icon: "trash", danger: true, act: () => deleteSet(i)}];
}
function condRowMenu(s, c, j){
  const redraw = () => { touch(); renderConditionsBody(); };
  return [{header: `Row ${j + 1}: ${condText(c, S.doc.CndSetCfgs)}`},
    {label: c.n ? "Remove NOT" : "Add NOT (negate)", act: () => { commit(); c.n = !c.n; redraw(); }},
    {label: "Duplicate row", act: () => { commit(); s.c.splice(j + 1, 0, structuredClone(c)); redraw(); }},
    "-",
    {label: "Move up", icon: "up", disabled: j === 0, act: () => { commit(); s.c.splice(j, 1); s.c.splice(j - 1, 0, c); redraw(); }},
    {label: "Move down", icon: "down", disabled: j === s.c.length - 1, act: () => { commit(); s.c.splice(j, 1); s.c.splice(j + 1, 0, c); redraw(); }},
    "-",
    {label: "Delete row", icon: "trash", danger: true, act: () => { commit(); s.c.splice(j, 1); redraw(); }}];
}

/* ---------- bulk ---------- */
function renderBulk(){ const host = $("#bulkHost"); if (host) host.replaceChildren(renderBulkBar()); }
function destinations(exclude = []){
  const ex = new Set(exclude); const out = [];
  S.doc.BarCfgs.forEach((b, bi) => {
    out.push({value: b, label: b.n || `(bar ${bi + 1})`, group: "Bars"});
    walkShortcuts(b.sL, sh => { if (sh.t === 1 && !ex.has(sh) && !ancestors(sh).some(a => ex.has(a))) out.push({value: sh, label: locationText(sh) + " › " + (displayName(sh) || "(category)"), group: "Categories"}); });
  });
  return out;
}
function renderBulkBar(){
  for (const it of [...S.multi]) if (!IDX.has(it)) S.multi.delete(it);
  if (!S.multi.size) return h("span");
  const items = () => topLevelOnly([...S.multi]);
  return h("div", {class: "bulk"},
    h("b", null, `${S.multi.size} selected`),
    dropdown({value: null, placeholder: "Move to...", options: destinations(items()), width: "140px", searchable: true, onChange: dest => moveItems(items(), dest, "into")}),
    h("button", {class: "btn sm", onclick: () => duplicate(items())}, "Duplicate"),
    dropdown({value: null, placeholder: "Set mode...", width: "118px", options: SH_MODES.map((m, i) => ({value: i, label: m})), onChange: v => mutate(() => S.multi.forEach(s => s.m = v))}),
    h("button", {class: "btn sm", onclick: bulkColor}, "Color..."),
    h("button", {class: "btn sm", onclick: () => mutate(() => S.multi.forEach(s => { s.k = 0; s.kP = false; }))}, "Clear hotkeys"),
    h("button", {class: "btn sm", onclick: () => findReplace(true)}, "Find & replace..."),
    h("button", {class: "btn sm danger", onclick: () => deleteItems(items())}, svg(ICONS.trash), "Delete"),
    h("span", {class: "spacer"}),
    h("button", {class: "btn sm ghost", onclick: () => { S.multi.clear(); S.view === "bars" ? renderTree() : rerenderTable(); }}, "Clear"));
}
async function bulkColor(){
  let val = 4294967295, anim = 0;
  const body = h("div", {class: "grid"}, h("label", {class: "flabel"}, "Color"), colorInput(val, v => val = v, {undoable: false}), h("label", {class: "flabel"}, "Animation"), dropdown({value: 0, width: "200px", options: ANIMS.map((a, i) => ({value: i, label: a})), onChange: v => anim = v}));
  if (await modal({title: `Color for ${S.multi.size} shortcuts`, body, buttons: [["Cancel", false], ["Apply", true, "primary"]]})) mutate(() => S.multi.forEach(s => { s.cl = val; s.clA = anim; }));
}
function duplicate(items){
  if (!items.length) return;
  const copies = [];
  mutate(() => { for (const it of [...items].reverse()) { const m = IDX.get(it); const c = structuredClone(it); m.list.splice(m.list.indexOf(it) + 1, 0, c); copies.unshift(c); } if (copies.length === 1) S.sel = copies[0]; });
  S.multi = new Set(copies.length > 1 ? copies : []); render();
  toast(`Duplicated ${items.length}`);
}
async function deleteItems(items){
  if (!items.length) return;
  let count = 0; items.forEach(it => { count++; walkShortcuts(it.sL, () => count++); });
  if (!(await confirmBox("Delete shortcuts", `Delete ${items.length} item${items.length > 1 ? "s" : ""}${count > items.length ? ` (${count} including category contents)` : ""}? Undo is available.`, "Delete", "danger"))) return;
  mutate(() => { for (const it of items) { const m = IDX.get(it); m.list.splice(m.list.indexOf(it), 1); S.multi.delete(it); if (S.sel === it) S.sel = m.parent || m.bar; } });
}

/* find & replace */
async function findReplace(selectedOnly){
  let find = "", repl = "", regex = false, cs = false, fName = true, fCmd = true, scopeSel = selectedOnly && S.multi.size > 0;
  const info = h("div", {class: "help"});
  const targets = () => scopeSel ? [...new Set([...S.multi].flatMap(s => { const a = [s]; walkShortcuts(s.sL, x => a.push(x)); return a; }))] : allShortcuts(S.doc).map(x => x[0]);
  const mk = () => { if (!find) return null; try { return new RegExp(regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), cs ? "g" : "gi"); } catch { return undefined; } };
  const preview = () => {
    const re = mk();
    if (re === undefined) return info.replaceChildren(h("span", {style: {color: "var(--red)"}}, "Invalid regular expression"));
    if (!re) return info.replaceChildren("Enter text to find.");
    let hits = 0; const rows = [];
    for (const s of targets()) {
      const f = []; if (fName && s.n.search(re) >= 0) f.push("name"); if (fCmd && s.c.search(re) >= 0) f.push("command");
      if (f.length) { hits++; if (rows.length < 10) rows.push(h("div", null, "· ", locationText(s), " › ", h("b", null, displayName(s) || "(blank)"), h("span", {class: "faint"}, "  [" + f.join(", ") + "]"))); }
    }
    info.replaceChildren(h("div", {style: {marginBottom: "4px", color: "var(--text)"}}, `${hits} shortcut${hits === 1 ? "" : "s"} will change`), ...rows, ...(hits > 10 ? [h("div", null, "...")] : []));
  };
  const body = h("div", {class: "grid"},
    h("label", {class: "flabel"}, "Find"), textInput("", v => { find = v; preview(); }),
    h("label", {class: "flabel"}, "Replace with"), textInput("", v => { repl = v; }, {placeholder: "with Regex on, $1 inserts group 1"}),
    h("label", {class: "flabel"}, "Options"), h("div", {class: "inline", style: {gap: "18px"}}, toggle(false, v => { regex = v; preview(); }, "Regex"), toggle(false, v => { cs = v; preview(); }, "Match case")),
    h("label", {class: "flabel"}, "Look in"), h("div", {class: "inline", style: {gap: "18px"}}, toggle(true, v => { fName = v; preview(); }, "Names & tooltips"), toggle(true, v => { fCmd = v; preview(); }, "Commands")),
    h("label", {class: "flabel"}, "Scope"), h("div", null, seg(scopeSel ? "sel" : "all", [["all", "Everything"], ...(S.multi.size ? [["sel", `Selected (${S.multi.size})`]] : [])], v => { scopeSel = v === "sel"; preview(); })),
    h("span"), info);
  const n0 = S.undo.length;
  preview();
  const ok = await modal({title: "Find & replace", body, wide: true, buttons: [["Cancel", false], ["Replace all", true, "primary"]]});
  S.undo.length = n0; // drop the undo steps the text boxes pushed
  renderHeaderState();
  const re = mk();
  if (!ok || !re) return;
  let n = 0;
  mutate(() => { for (const s of targets()) { const b = s.n + "\0" + s.c; if (fName) s.n = s.n.replace(re, repl); if (fCmd) s.c = s.c.replace(re, repl); if (s.n + "\0" + s.c !== b) n++; } });
  toast(`Changed ${n} shortcut${n === 1 ? "" : "s"}`);
}
