// SPDX-License-Identifier: AGPL-3.0-or-later
// Snap next to, and Tricks: mock bars, linked alternates, toggle builder, state preview.
"use strict";

/* ---------- snap next to: pick a target, then one click places both axes ---------- */
const SNAP = {target: null, gap: 0, seamless: false}; // remembered while you hop between bars
// Distance between two on-screen rectangles (0 when touching or overlapping)
const rectGap = (a, b) => Math.hypot(Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)));
// Bars that share one rectangle on screen (alternates stacked in one spot) are listed as one target
function snapTargets(bar){
  const {W, H} = pvSize(), g = barGeometry(bar, W, H), groups = new Map();
  for (const ob of S.doc.BarCfgs) {
    if (ob === bar) continue;
    const o = barGeometry(ob, W, H);
    if (o.x === g.x && o.y === g.y && o.w === g.w && o.h === g.h) continue; // already stacked with this bar
    const k = [o.x, o.y, o.w, o.h].join();
    if (!groups.has(k)) groups.set(k, {bars: [], o, d: rectGap(g, o)});
    groups.get(k).bars.push(ob);
  }
  return [...groups.values()].sort((a, b) => a.d - b.d);
}
function snapPicker(bar, repaint){
  const {W, H} = pvSize(), g = barGeometry(bar, W, H), [padX, padY] = PROFILE.winPad;
  const targets = snapTargets(bar);
  const keyOf = t => S.doc.BarCfgs.indexOf(t.bars[0]);
  let cur = SNAP.target === "screen" ? "screen" : targets.find(t => keyOf(t) === SNAP.target) ? SNAP.target : targets.length ? keyOf(targets[0]) : "screen";
  const box = h("div", {class: "snap"});
  const gapX = () => SNAP.seamless ? bar.sp[0] - padX * 2 : SNAP.gap, gapY = () => SNAP.seamless ? bar.sp[1] - padY * 2 : SNAP.gap;
  const go = (x, y) => { if (placeBar(bar, x, y)) repaint(); };
  const paint = () => {
    const t = targets.find(t => keyOf(t) === cur);
    const grid = h("div", {class: "compass"});
    const btn = (col, row, tip, fn, cls = "") => grid.append(h("button", {type: "button", class: "snp " + cls, style: {gridColumn: col, gridRow: row}, tip, onclick: fn}, h("i")));
    if (!t) {
      // Screen: nine spots inside the edges
      const xs = [SNAP.gap, Math.floor((W - g.w) / 2), W - g.w - SNAP.gap], ys = [SNAP.gap, Math.floor((H - g.h) / 2), H - g.h - SNAP.gap];
      const vn = ["Top", "Middle", "Bottom"], hn = ["left", "center", "right"];
      grid.classList.add("screen");
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) btn(c + 1, r + 1, r === 1 && c === 1 ? "Center of the screen" : `${vn[r]} ${hn[c]} of the screen`, () => go(xs[c], ys[r]));
    } else {
      const o = t.o, midX = o.x + Math.floor((o.w - g.w) / 2), midY = o.y + Math.floor((o.h - g.h) / 2);
      const nm = t.bars.length > 1 ? "these bars" : `"${t.bars[0].n}"`;
      const al = [["left edges lined up", o.x], ["centered", midX], ["right edges lined up", o.x + o.w - g.w]];
      const at = [["tops lined up", o.y], ["centered", midY], ["bottoms lined up", o.y + o.h - g.h]];
      al.forEach(([d, x], i) => { btn(i + 2, 1, `Above ${nm}, ${d}`, () => go(x, o.y - g.h - gapY()), "h"); btn(i + 2, 5, `Below ${nm}, ${d}`, () => go(x, o.y + o.h + gapY()), "h"); });
      at.forEach(([d, y], i) => { btn(1, i + 2, `Left of ${nm}, ${d}`, () => go(o.x - g.w - gapX(), y), "v"); btn(5, i + 2, `Right of ${nm}, ${d}`, () => go(o.x + o.w + gapX(), y), "v"); });
      grid.append(h("button", {type: "button", class: "snp mid", style: {gridColumn: "2 / 5", gridRow: "2 / 5"}, tip: `Same spot as ${nm}. For stacking alternates (bars with different condition sets).`, onclick: () => go(o.x, o.y)}, h("span", null, t.bars.map(b => b.n).join(" + "))));
    }
    const opts = [{value: "screen", label: "Screen edges", hint: `${W} × ${H}`}, ...targets.map(t => ({value: keyOf(t), label: t.bars.map(b => b.n).join(" + "), hint: t.d === 0 ? "touching" : Math.round(t.d) + "px away", group: "Bars, nearest first"}))];
    const gapRow = label => h("div", {class: "inline"}, h("span", {class: "dim"}, label), numInput(SNAP.gap, v => { SNAP.gap = v; }, {noUndo: true, width: "64px"}), h("span", {class: "dim"}, "px"));
    box.replaceChildren(
      dropdown({value: cur, width: "250px", searchable: true, options: opts, onChange: v => { cur = SNAP.target = v; paint(); }}),
      h("div", {class: "inline", style: {alignItems: "flex-start", gap: "16px", marginTop: "8px", flexWrap: "nowrap"}}, grid,
        h("div", {style: {display: "flex", flexDirection: "column", gap: "8px", minWidth: 0}},
          t ? toggle(SNAP.seamless, v => { SNAP.seamless = v; paint(); }, "Seamless") : null,
          t ? h("div", {class: "help", style: {marginTop: 0, maxWidth: "260px"}}, SNAP.seamless
            ? `The windows overlap so the buttons sit ${bar.sp[0]}px apart, like inside one bar. Two bars look like one.`
            : "Windows sit this far apart (0 = edge to edge). Turn on Seamless to make them look like one bar.") : null,
          t && SNAP.seamless ? null : gapRow(t ? "gap" : "margin"))));
  };
  paint();
  return box;
}

/* ---------- tricks: pinned stacks and seamless mock bars ----------
   Editor-only helpers (QoLBar has no such feature, and it drops unknown fields when it saves), so they are kept in
   this browser and refer to bars by name. A trick is a row or column of slots; each slot holds one or more bars that
   share a spot (usually alternates with different condition sets, like "Enable X" and "Disable X"). The first bar of
   the first slot is the anchor; the others are placed from it whenever something changes. */
let TRICKS = (() => { try { const t = JSON.parse(store("tricks") || "[]"); return Array.isArray(t) ? t : []; } catch { return []; } })();
const saveTricks = () => store("tricks", JSON.stringify(TRICKS));
const barByName = n => S.doc.BarCfgs.find(b => b.n === n);
function trickOf(bar){
  for (const trick of TRICKS) {
    const live = trick.slots.map(s => s.filter(barByName)).filter(s => s.length);
    for (let i = 0; i < live.length; i++) if (live[i].includes(bar.n)) return {trick, slot: i, anchor: live[0][0], follower: live[0][0] !== bar.n};
  }
  return null;
}
// Positions are fractions of the screen, so a row only lines up exactly at one resolution and UI scale.
// A trick remembers which one it was lined up for and only follows edits there, so peeking at another
// resolution in the preview never moves anything.
const resKey = () => PV.res + "@" + PV.ui;
const resText = k => { const [r, ui] = k.split("@"); return r.replace("x", " × ") + (+ui !== 1 ? `, UI scale ${ui}` : ""); };
const trickHere = t => !t.at || t.at === resKey();
// Where every bar of a trick should be. Slot sizes don't depend on position, so this is pure.
function trickPlan(t, W = pvSize().W, H = pvSize().H){
  const [padX, padY] = PROFILE.winPad;
  const missing = t.slots.flat().filter(n => !barByName(n));
  const live = t.slots.map(s => s.map(barByName).filter(Boolean)).filter(s => s.length);
  if (!live.length) return {moves: [], missing, live};
  const anchor = live[0][0], a = barGeometry(anchor, W, H);
  const gx = t.join === "seamless" ? anchor.sp[0] - padX * 2 : t.gap, gy = t.join === "seamless" ? anchor.sp[1] - padY * 2 : t.gap;
  let x = a.x, y = a.y; const moves = [];
  live.forEach((slot, i) => {
    let sw = 0, sh = 0;
    for (const bar of slot) {
      const g = barGeometry(bar, W, H); sw = Math.max(sw, g.w); sh = Math.max(sh, g.h);
      if (bar !== anchor) moves.push({bar, tx: x, ty: y, g, slot: i});
    }
    if (t.dir === "col") y += sh + gy; else x += sw + gx;
  });
  return {moves, missing, live, anchor};
}

/* Linked alternates: bars stacked in one slot keep the same look (dock, size, spacing, colors, icons), so the
   row never jumps when they swap. Labels, tooltips, commands and condition sets stay their own. */
const LOOK_KEYS = ["d", "a", "v", "ht", "bW", "co", "sp", "s", "fS", "rA", "nB", "l"];
const SH_LOOK_KEYS = ["cl", "clA", "iZ", "iO", "iR"];
function lookOf(bar){
  return JSON.stringify([LOOK_KEYS.map(k => bar[k]), (bar.sL || []).map(sh => { const p = parseName(sh.n); return [SH_LOOK_KEYS.map(k => sh[k]), p.hasIcon, p.args, p.iconRaw]; })]);
}
function copyLook(from, to){
  for (const k of LOOK_KEYS) to[k] = structuredClone(from[k]);
  (to.sL || []).forEach((sh, i) => {
    const src = from.sL?.[i]; if (!src) return;
    for (const k of SH_LOOK_KEYS) sh[k] = structuredClone(src[k]);
    const a = parseName(src.n), b = parseName(sh.n);
    sh.n = buildName({...b, hasIcon: a.hasIcon, args: a.args, iconRaw: a.iconRaw, icon: a.icon});
  });
}
const LOOK_SEEN = new Map(); // slot (bar names) -> look after the last sync, to tell which bar you just edited
function matchSlot(slot){
  if (slot.length < 2) return;
  const key = slot.map(b => b.n).join("\n"), looks = slot.map(lookOf);
  if (looks.every(l => l === looks[0])) return LOOK_SEEN.set(key, looks[0]);
  const seen = LOOK_SEEN.get(key), changed = seen ? slot.filter((b, i) => looks[i] !== seen) : [];
  const src = changed.length === 1 ? changed[0] : slot[0];
  for (const b of slot) if (b !== src) copyLook(src, b);
  LOOK_SEEN.set(key, lookOf(src));
}
// Moves the trick's bars into place (after matching alternates). No undo step or redraw here; callers do that.
function applyTrick(t){
  if (t.match !== false) for (const slot of trickPlan(t).live) matchSlot(slot);
  const bad = [];
  for (const m of trickPlan(t).moves) {
    if (m.g.x === m.tx && m.g.y === m.ty) continue;
    const p = solvePos(m.bar, m.tx, m.ty);
    if (p) m.bar.p = p; else bad.push(m.bar.n);
  }
  return bad;
}
// Runs on every edit so pinned bars follow their anchor (and re-flow when a label or width changes)
function applyTricks(){
  if (!S.doc) return;
  for (const t of TRICKS) {
    if (!t.at) { t.at = resKey(); saveTricks(); }
    if (t.pinned && trickHere(t)) applyTrick(t);
  }
}
function trickIssues(t){
  const {W, H} = pvSize(), out = [], plan = trickPlan(t);
  if (plan.missing.length) out.push(`Not in this file: ${plan.missing.join(", ")}`);
  for (const n of new Set(t.slots.flat())) if (S.doc.BarCfgs.filter(b => b.n === n).length > 1) out.push(`More than one bar is named "${n}", the first one is used`);
  plan.live.forEach((slot, i) => {
    const byCond = new Map();
    for (const b of slot) byCond.set(b.c, [...(byCond.get(b.c) || []), b.n]);
    for (const [c, ns] of byCond) if (ns.length > 1) out.push(`Slot ${i + 1}: ${ns.join(" and ")} ${c < 0 ? "have no condition set" : "use the same condition set"}, so they show at the same time and overlap`);
    // "Enable ..." shown while the plugin is loaded (or "Disable ..." while it isn't) means the sets are swapped
    const wrong = slot.filter(b => { const side = toggleSide(b), label = parseName(b.sL?.[0]?.n || "").label.trim().toLowerCase(); return side && (label.startsWith("enable") && side === "on" || label.startsWith("disable") && side === "off"); });
    if (wrong.length === 2) out.push({text: `Slot ${i + 1}: ${wrong.map(b => `"${parseName(b.sL[0].n).label}" shows while ${S.doc.CndSetCfgs[b.c].c[0].a} is ${toggleSide(b) === "on" ? "loaded" : "not loaded"}`).join(", ")}. Their condition sets look swapped.`,
      fix: ["Swap their condition sets", () => { commit(); [wrong[0].c, wrong[1].c] = [wrong[1].c, wrong[0].c]; touch(); paintTricks(true); toast("Swapped. Undo with Ctrl+Z."); }]});
    if (new Set(slot.map(b => barGeometry(b, W, H).w)).size > 1) out.push(`Slot ${i + 1}: the bars are different widths, so the row shifts when they swap. Turn on Match alternates, or give them the same Button width.`);
  });
  return out;
}
function trickStatus(t){
  const plan = trickPlan(t), off = plan.moves.filter(m => m.g.x !== m.tx || m.g.y !== m.ty);
  return {plan, off: off.length, bad: off.filter(m => !solvePos(m.bar, m.tx, m.ty)).map(m => m.bar.n)};
}
// How the row as stored would look on another screen: worst misplacement in px, and whether it leaves the screen
function trickAtRes(t, r){
  const [W, H] = r.split("x").map(Number), plan = trickPlan(t, W, H);
  let worst = 0, outside = false;
  for (const m of plan.moves) worst = Math.max(worst, Math.abs(m.g.x - m.tx), Math.abs(m.g.y - m.ty));
  for (const b of plan.live.flat()) { const g = barGeometry(b, W, H); if (g.x < 0 || g.y < 0 || g.x + g.w > W || g.y + g.h > H) outside = true; }
  return {worst, outside};
}
// Bars sharing one exact spot on screen: likely alternates meant to swap
function findStacks(){
  const m = new Map(), {W, H} = pvSize();
  for (const b of S.doc.BarCfgs) { const g = barGeometry(b, W, H), k = [g.x, g.y, g.w, g.h].join(); if (!m.has(k)) m.set(k, []); m.get(k).push(b); }
  return [...m.values()].filter(s => s.length > 1);
}
const inAnyTrick = n => TRICKS.some(t => t.slots.some(s => s.includes(n)));
function renameInTricks(from, to){
  if (!from || from === to || !inAnyTrick(from) || S.doc.BarCfgs.some(b => b.n === from)) return;
  for (const t of TRICKS) t.slots = t.slots.map(s => s.map(n => n === from ? to : n));
  saveTricks();
}
const blankTrick = slots => ({name: "Mock bar " + (TRICKS.length + 1), dir: "row", join: "seamless", gap: 0, pinned: true, match: true, at: resKey(), slots});
function newTrick(slots){
  const {W, H} = pvSize();
  // Left to right as they are on screen now
  slots.sort((a, b) => { const ga = barGeometry(a[0], W, H), gb = barGeometry(b[0], W, H); return ga.x - gb.x || ga.y - gb.y; });
  const t = blankTrick(slots.map(s => s.map(b => b.n)));
  TRICKS.push(t); saveTricks();
  runTrick(t, true);
}
// Apply one trick as its own undo step (lining it up for the preview's resolution) and redraw
function runTrick(t, quiet){
  t.at = resKey(); saveTricks();
  const before = S.doc.BarCfgs.map(b => JSON.stringify(b));
  commit(); const bad = applyTrick(t);
  const moved = S.doc.BarCfgs.filter((b, i) => JSON.stringify(b) !== before[i]).length;
  if (!moved) { S.undo.pop(); renderHeaderState(); } else { markDirty(); liveMicro(); fsRefresh(true); }
  if (bad.length) toast(`Couldn't place ${bad.join(", ")}: check its dock side and alignment.`, "warn");
  else if (!quiet) toast(moved ? `Updated ${moved} bar${moved === 1 ? "" : "s"}` : "Already in place");
  paintTricks(true);
}

/* State preview: pick which alternate of each slot the preview shows, by simulating condition sets as true or
   false (the same switches as the preview panel's list). Nothing in the file changes. */
function toggleSide(bar){ const s = S.doc.CndSetCfgs[bar.c]; return s && s.c.length === 1 && s.c[0].i === "p" ? (s.c[0].n ? "off" : "on") : null; }
function previewShow(slot, pick){ for (const b of slot) if (b.c >= 0) { if (pick) PV.sets[b.c] = b === pick; else delete PV.sets[b.c]; } }
function previewTrick(t, how){
  for (const slot of trickPlan(t).live) {
    if (slot.length < 2) continue;
    previewShow(slot, how === "all" ? null : how === "on" || how === "off" ? slot.find(b => toggleSide(b) === how) : slot[how === "first" ? 0 : 1]);
  }
  render(); fsRefresh(true);
}

/* Toggle button builder: the "Enable X" / "Disable X" pair as two bars stacked in one slot, each shown by a
   "Plugin Enabled" condition set (one of them negated). Reuses matching condition sets that already exist. */
const uniqueBarName = n => { let out = n, i = 2; while (S.doc.BarCfgs.some(b => b.n === out)) out = `${n} ${i++}`; return out; };
async function toggleBuilder(presetTrick){
  const st = {plugin: "", name: "", en: "", dis: "", enCmd: "", disCmd: "", to: presetTrick ?? (TRICKS.length ? 0 : "new")};
  const edited = new Set(); // fields you typed in yourself stop following the plugin name
  const auto = {en: () => `Enable ${st.name}`, dis: () => `Disable ${st.name}`, enCmd: () => `/xlenableplugin "${st.name}"`, disCmd: () => `/xldisableplugin "${st.name}"`};
  const boxes = {};
  const follow = () => { for (const k in auto) if (!edited.has(k)) { st[k] = auto[k](); boxes[k].value = st[k]; } };
  const tb = (k, opts) => { boxes[k] = textInput(st[k], v => { st[k] = v; edited.add(k); }, opts); return boxes[k]; };
  const nameNote = h("div", {class: "help"});
  const nameBox = textInput("", v => { st.name = v; nameNote.textContent = ""; follow(); }, {placeholder: "e.g. Wrath Combo"});
  const choose = v => {
    st.plugin = v;
    if (!st.name || st.name === st.autoName) {
      const d = pluginDisplayName(v);
      st.name = st.autoName = d.name; nameBox.value = d.name; follow();
      nameNote.textContent = d.sure ? "" : "Guessed from the InternalName. Check the exact name in /xlplugins.";
      nameNote.style.color = d.sure ? "" : "var(--accent)";
    }
  };
  const plugDD = () => dropdown({value: st.plugin, width: "100%", allowCustom: true, searchable: true, placeholder: "InternalName (its installedPlugins folder)", options: pluginOptions(), onChange: choose});
  let dd = plugDD();
  const pick = h("input", {type: "file", accept: ".json,application/json", hidden: true});
  pick.addEventListener("change", async () => {
    const f = pick.files[0]; pick.value = ""; if (!f) return;
    try { const p = profileFromDalamudConfig(await f.text()); setProfile(p); const fresh = plugDD(); dd.replaceWith(fresh); dd = fresh; instRow.replaceChildren(instText()); toast(`Found ${p.plugins?.length || 0} installed plugins`); }
    catch (e) { toast(e.message, "err"); }
  });
  const instText = () => PROFILE.plugins?.length
    ? h("span", null, `✓ ${PROFILE.plugins.length} installed plugins listed, from your dalamudConfig.json.`)
    : h("span", null, "Only plugins in this file are confirmed. ", h("a", {class: "link", onclick: () => pick.click()}, "Load dalamudConfig.json"), " to list the ones you have installed.", pathLine(PATH.dalamud));
  const instRow = h("div", {class: "help"}, instText());
  const to = [...TRICKS.map((t, i) => ({value: i, label: `Add to "${t.name}"`, hint: `${t.slots.length} slots`})), {value: "new", label: "Start a new mock bar"}, {value: "none", label: "Just make the bars"}];
  const body = h("div", {class: "grid", style: {gridTemplateColumns: "150px 1fr"}},
    ...field("Plugin", h("div", null, h("div", {style: {display: "flex"}}, dd), instRow, pick), "The plugin's InternalName: its folder name in XIVLauncher\\installedPlugins. The condition sets check whether it's loaded. ✓ means the name is confirmed (used in this file, or installed); ? is a common example to double-check."),
    ...field("Plugin name", h("div", null, nameBox, nameNote), "The name the enable and disable commands use, as shown in /xlplugins. It can differ from the InternalName: WrathCombo is \"Wrath Combo\", RotationSolver is \"Rotation Solver Reborn\"."),
    ...field("While it's on", h("div", {style: {display: "flex", flexDirection: "column", gap: "6px"}}, tb("dis", {placeholder: "Button text"}), tb("disCmd", {multiline: true, rows: 2, cls: "mono"}))),
    ...field("While it's off", h("div", {style: {display: "flex", flexDirection: "column", gap: "6px"}}, tb("en", {placeholder: "Button text"}), tb("enCmd", {multiline: true, rows: 2, cls: "mono"}))),
    ...field("Put it", dropdown({value: st.to, width: "100%", options: to, onChange: v => st.to = v}), "Joining a mock bar copies its first bar's look and adds the pair as a new slot at the end."));
  follow();
  const ok = await modal({title: "New toggle button", wide: true, body: h("div", null,
    h("div", {class: "help", style: {marginTop: 0, marginBottom: "14px"}}, "One button that shows Disable while a plugin is loaded and Enable while it isn't. It's made of two bars stacked in one spot, each shown by its own condition set, so it works in QoLBar as is."), body),
    buttons: [["Cancel", null], ["Create", () => {
      if (!st.plugin.trim()) { toast("Pick the plugin first.", "warn"); return false; }
      if (!st.en.trim() || !st.dis.trim()) { toast("Both buttons need text.", "warn"); return false; }
      return true;
    }, "primary"]]});
  if (!ok) return;
  const plugin = st.plugin.trim(), short = (st.name || plugin).trim();
  let made;
  mutate(() => {
    const setFor = neg => {
      const i = S.doc.CndSetCfgs.findIndex(s => s.c.length === 1 && s.c[0].i === "p" && s.c[0].a === plugin && s.c[0].n === neg);
      if (i >= 0) return i;
      S.doc.CndSetCfgs.push(makeSet({n: `${short} ${neg ? "OFF" : "ON"}`, c: [makeCond({i: "p", a: plugin, n: neg})]}));
      return S.doc.CndSetCfgs.length - 1;
    };
    const onSet = setFor(false), offSet = setFor(true);
    let t = typeof st.to === "number" ? TRICKS[st.to] : null;
    const anchor = t && trickPlan(t).anchor;
    const base = anchor ? Object.fromEntries([...LOOK_KEYS, "p"].map(k => [k, structuredClone(anchor[k])])) : {};
    const bar = (suffix, label, cmd, c) => makeBar({...base, n: uniqueBarName(`${short} ${suffix}`), c, sL: [makeShortcut({n: label.trim(), c: cmd})]});
    const on = bar("ON", st.dis, st.disCmd, onSet), off = bar("OFF", st.en, st.enCmd, offSet);
    S.doc.BarCfgs.push(on, off);
    made = [on, off];
    if (st.to === "new") { t = blankTrick([]); TRICKS.push(t); }
    if (t) { t.slots.push([on.n, off.n]); t.at = resKey(); saveTricks(); applyTrick(t); }
    else { S.sel = on; }
  });
  toast(`Made "${made[0].n}" and "${made[1].n}"` + (st.to === "none" ? "" : ", lined up in the mock bar"));
  paintTricks(true);
}

const stackLabel = bars => bars.map(b => b.n).join(" + ");
const condName = c => c < 0 ? "always" : S.doc.CndSetCfgs[c]?.n || `set #${c + 1}`;
function barPickOptions(exclude){
  const stacks = findStacks().filter(s => s.every(b => !exclude.has(b.n)));
  return [
    ...stacks.map((s, i) => ({value: "s" + i, label: stackLabel(s), hint: "share a spot", group: "Stacks (alternates in one spot)", bars: s})),
    ...S.doc.BarCfgs.filter(b => !exclude.has(b.n)).map(b => ({value: "b" + S.doc.BarCfgs.indexOf(b), label: b.n || "(unnamed)", hint: condName(b.c), group: "Bars", bars: [b]})),
  ];
}
function renderTricks(){ const host = h("div", {class: "insp", id: "tricksHost"}); host.append(...tricksBody()); return host; }
// Rebuilds the page, unless you're typing or dragging in it (then only after you're done)
function paintTricks(force){
  const host = $("#tricksHost"); if (!host) return;
  if (!force && (host.contains(document.activeElement) || (SCRUB_EL && host.contains(SCRUB_EL)))) return;
  const y = host.parentElement?.scrollTop;
  host.replaceChildren(...tricksBody());
  if (host.parentElement) host.parentElement.scrollTop = y;
}
function tricksBody(){
  const out = [h("div", {class: "insp-hd"}, h("div", null, h("h2", null, "Tricks"), h("div", {class: "crumb"}, "Layouts QoLBar can't do by itself, built from several bars. Kept in this browser, not in QoLBar.json.")))];
  // Suggestions: stacks not used yet, grouped by row, that could become one mock bar
  const rows = new Map(), {W, H} = pvSize();
  for (const s of findStacks().filter(s => s.every(b => !inAnyTrick(b.n)))) { const k = barGeometry(s[0], W, H).y; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(s); }
  const sug = [...rows.values()];
  out.push(h("div", {class: "card"}, h("h3", null, "Mock bars", h("span", {class: "actions"},
      h("button", {class: "btn sm", tip: "An Enable / Disable button that swaps with a plugin's state", onclick: () => toggleBuilder()}, svg(ICONS.plus), "Toggle button"),
      h("button", {class: "btn sm", onclick: () => { TRICKS.push(blankTrick([])); saveTricks(); paintTricks(true); }}, svg(ICONS.plus), "New mock bar"))),
    h("div", {class: "help", style: {marginTop: 0}}, "Line up several bars so they look like one continuous bar. Each slot holds one bar, or a stack of alternates that swap in place (like \"Disable Plugin\" and \"Enable Plugin\" with opposite condition sets). Seamless overlaps the windows so the buttons sit exactly the bar's spacing apart, like the buttons inside a real bar. While pinned, the other bars follow the first one: move it and the whole row comes along."),
    sug.length ? h("div", {class: "sug"}, h("div", {class: "flabel", style: {marginBottom: "6px"}}, "Found in this file: bars stacked in one spot"),
      ...sug.map(stacks => h("div", {class: "sug-row"},
        h("div", {class: "inline", style: {gap: "6px", minWidth: 0}}, stacks.map(s => h("span", {class: "chip plain", style: {fontSize: "12px"}}, stackLabel(s)))),
        h("button", {class: "btn sm primary", style: {flex: "none"}, onclick: () => newTrick(stacks.map(s => [...s]))}, stacks.length > 1 ? `Make a mock bar of these ${stacks.length}` : "Pin these together")))) : null));
  TRICKS.forEach((t, ti) => out.push(trickCard(t, ti)));
  return out;
}
function trickCard(t, ti){
  const card = h("div", {class: "card"});
  const changed = () => { saveTricks(); if (t.pinned && trickHere(t)) runTrick(t, true); else paintTricks(true); };
  const status = h("div", {class: "inline", style: {gap: "10px"}});
  const paintStatus = () => {
    if (!trickHere(t)) return status.replaceChildren(
      h("span", {style: {color: "var(--accent)", fontSize: "13px"}}, `Lined up for ${resText(t.at)}. The preview is at ${resText(resKey())}, so it isn't following edits here.`),
      h("button", {class: "btn sm primary", tip: "Moves the bars so the row is exact at the preview's resolution instead", onclick: () => runTrick(t)}, `Line up for ${resText(resKey())}`));
    const st = trickStatus(t), issues = trickIssues(t);
    status.replaceChildren(...[
      st.plan.live.length ? h("span", {style: {color: st.bad.length ? "var(--red)" : st.off ? "var(--accent)" : "var(--green)", fontSize: "13px"}},
        st.bad.length ? `✕ Can't reach the spot for ${st.bad.join(", ")} (dock side or alignment)` : st.off ? `• ${st.off} bar${st.off === 1 ? " is" : "s are"} out of place` : `✓ In place at ${resText(resKey())}`) : h("span", {class: "faint"}, "Add a slot to start"),
      st.off && !st.bad.length ? h("button", {class: "btn sm primary", onclick: () => runTrick(t)}, "Line them up") : null,
      ...issues.map(i => h("div", {class: "inline", style: {color: "var(--accent)", fontSize: "12.5px", flexBasis: "100%"}}, "• " + (i.text || i), i.fix ? h("button", {class: "btn sm", onclick: i.fix[1]}, i.fix[0]) : null))].filter(Boolean));
  };
  const used = new Set(t.slots.flat());
  const addTo = slot => { const options = barPickOptions(used); return dropdown({value: null, placeholder: slot === null ? "Add a slot..." : "+ alternate", width: slot === null ? "240px" : "140px", searchable: true, options, onChange: v => {
    const o = options.find(o => o.value === v); if (!o) return;
    const names = o.bars.map(b => b.n);
    if (slot === null) t.slots.push(names); else t.slots[slot].push(...names);
    changed();
  }}); };
  const live = t.slots.map(s => s.map(barByName).filter(Boolean));
  const slotRows = t.slots.map((slot, si) => h("div", {class: "slot"},
    h("div", {class: "slot-n", tip: si === 0 ? "Anchor slot: the others are placed from its first bar" : ""}, si === 0 ? "⚓" : String(si + 1)),
    h("div", {class: "slot-bars"}, slot.map((n, bi) => { const b = barByName(n), shown = b && live[si].length > 1 && barShown(b) === true && live[si].some(o => o !== b && barShown(o) !== true); return h("span", {class: "chip " + (b ? "plain" : "hid") + (shown ? " showing" : ""), style: {fontSize: "12px"}},
      b && live[si].length > 1 ? h("span", {class: "eye", tip: shown ? "Shown in the preview" : "Show this one in the preview", onclick: () => { previewShow(live[si], b); render(); fsRefresh(true); }}, svg(ICONS.eye, 12)) : null,
      b ? h("a", {class: "link", tip: "Open this bar", onclick: () => { S.view = "bars"; S.sel = b; render(); }}, n) : n + " (missing)",
      b ? h("span", {class: "faint", tip: "Condition set that shows this bar"}, b.c < 0 ? " · always" : " · when " + condName(b.c)) : null,
      h("span", {class: "x", tip: "Remove from this slot", onclick: () => { slot.splice(bi, 1); if (!slot.length) t.slots.splice(si, 1); changed(); }}, "×")); }), addTo(si)),
    h("div", {class: "slot-act"},
      h("button", {class: "btn sm ghost icon", tip: "Move earlier", disabled: si === 0, onclick: () => { t.slots.splice(si - 1, 0, t.slots.splice(si, 1)[0]); changed(); }}, svg(ICONS.up)),
      h("button", {class: "btn sm ghost icon", tip: "Move later", disabled: si === t.slots.length - 1, onclick: () => { t.slots.splice(si + 1, 0, t.slots.splice(si, 1)[0]); changed(); }}, svg(ICONS.down)))));
  const gapCtl = t.join === "gap" ? numInput(t.gap, v => {
    t.gap = v; saveTricks();
    if (t.pinned && trickHere(t)) { if (Date.now() - (runTrick.last || 0) > 800) commit(); runTrick.last = Date.now(); applyTrick(t); markDirty(); liveMicro(); fsRefresh(); }
    paintStatus();
  }, {noUndo: true, width: "64px"}) : null;
  // State preview: only offered when some slot has alternates
  const stacked = live.filter(s => s.length > 1);
  const toggles = stacked.length && stacked.every(s => s.some(b => toggleSide(b) === "on") && s.some(b => toggleSide(b) === "off"));
  const states = toggles ? [["on", "Plugins on", "Show what you see while the plugins are loaded"], ["off", "Plugins off", "Show what you see while the plugins aren't loaded"]] : [["first", "First of each", "Show the first bar of every stack"], ["second", "Second of each", "Show the second bar of every stack"]];
  // Other screens: how far the row would be off, as stored, on common resolutions
  const screens = h("div", {class: "inline", style: {gap: "6px"}}, RESOLUTIONS.map(r => {
    const here = t.at && t.at.split("@")[0] === r, {worst, outside} = trickAtRes(t, r);
    const txt = here ? "lined up" : outside ? "off screen" : worst ? `off by ${worst}px` : "exact";
    return h("span", {class: "chip " + (here || (!worst && !outside) ? "mode" : outside ? "hid" : "cond"), style: {fontSize: "12px", cursor: "pointer"}, tip: `Show ${r.replace("x", " × ")} in the preview`, onclick: () => { PV.res = r; store("pv.res", r); render(); fsRefresh(true); }}, r.replace("x", "×") + " · " + txt);
  }));
  const title = h("span", null, t.name || "(unnamed)");
  card.append(
    h("h3", null, title, h("span", {class: "actions"},
      h("button", {class: "btn sm", tip: "Make an Enable / Disable pair and add it to this mock bar", onclick: () => toggleBuilder(ti)}, svg(ICONS.plus), "Toggle button"),
      h("button", {class: "btn sm danger", tip: "Delete this trick (the bars stay where they are)", onclick: async () => { if (await confirmBox("Delete trick", `Delete "${t.name}"? The bars stay where they are now.`, "Delete", "danger")) { TRICKS.splice(ti, 1); saveTricks(); paintTricks(true); } }}, svg(ICONS.trash)))),
    h("div", {class: "grid"},
      ...field("Name", textInput(t.name, v => { t.name = v; title.textContent = v || "(unnamed)"; saveTricks(); })),
      ...field("Direction", seg(t.dir, [["row", "Row", "Left to right"], ["col", "Column", "Top to bottom"]], v => { t.dir = v; changed(); })),
      ...field("Join", h("div", {class: "inline"}, seg(t.join, [["seamless", "Seamless", "Overlap the windows so it looks like one bar"], ["gap", "Gap", "Leave a set gap between the windows"]], v => { t.join = v; changed(); }), gapCtl, gapCtl ? h("span", {class: "dim"}, "px") : null)),
      ...field("Pinned", toggle(t.pinned, v => { t.pinned = v; changed(); }, "The others follow the first bar"), "While pinned, any edit (moving the first bar, renaming a button, changing a width) lines the row up again. Unpin to move the bars freely."),
      ...field("Match alternates", toggle(t.match !== false, v => { t.match = v; changed(); }, "Stacked bars share one look"), "Bars stacked in one slot keep the same width, scale, spacing, dock, colors and icons. Edit either one and the other follows. Labels, tooltips, commands and condition sets stay their own."),
      ...field("Slots", h("div", {class: "slots"}, ...slotRows, h("div", {class: "slot add"}, addTo(null)))),
      ...(stacked.length ? field("Preview", h("div", {class: "inline"}, h("div", {class: "seg"}, [["all", "Everything", "Back to normal: every bar drawn, stacked"], ...states].map(([v, label, tip]) => h("button", {type: "button", tip, onclick: () => previewTrick(t, v)}, label))),
        h("span", {class: "help", style: {marginTop: 0}}, "Only the preview changes, not the file. Or click the eye on a bar.")), "Pretends the stacks' condition sets are true or false, the same as the switches in the preview panel.") : []),
      ...field("Status", status),
      ...field("Other screens", h("div", null, screens, h("div", {class: "help"}, "Positions are stored as fractions of the screen but bars keep their pixel size, so a row lines up exactly at one resolution only. To share it with someone on another screen, pick theirs, line it up, and give them that file.")))));
  paintStatus();
  return card;
}
