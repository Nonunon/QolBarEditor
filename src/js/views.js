// SPDX-License-Identifier: AGPL-3.0-or-later
// The Table and Conditions views.
"use strict";

/* ---------- table view ---------- */
function rerenderTable(){
  const host = $("#tableHost"); if (!host) return;
  const s = host.scrollTop; host.replaceChildren(renderTable()); host.scrollTop = s;
  renderBulk();
}
function renderTable(){
  reindex();
  const q = S.tableFilter.trim().toLowerCase();
  const rows = allShortcuts(S.doc).filter(([sh]) => (S.tableType < 0 || sh.t === S.tableType) && (!q || (sh.n + "\n" + sh.c + "\n" + hotkeyName(sh.k) + "\n" + locationText(sh)).toLowerCase().includes(q)));
  visibleOrder = rows.map(r => r[0]);
  const filter = h("input", {class: "txt", placeholder: "Filter by anything...", value: S.tableFilter, style: {maxWidth: "340px"}});
  filter.addEventListener("input", () => { S.tableFilter = filter.value; clearTimeout(filter._t); filter._t = setTimeout(() => { rerenderTable(); const f = $("#tableHost .sticky-tools input.txt"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); });
  const allOn = rows.length > 0 && rows.every(([sh]) => S.multi.has(sh));
  const tbl = h("table", {class: "tbl"},
    h("thead", null, h("tr", null,
      h("th", {style: {width: "30px"}}, checkbox(allOn, on => { rows.forEach(([sh]) => on ? S.multi.add(sh) : S.multi.delete(sh)); rerenderTable(); }, "blue")),
      h("th", null, "Where"), h("th", {style: {width: "34px"}}), h("th", {style: {width: "18%"}}, "Label"), h("th", null, "Type"), h("th", {style: {width: "36%"}}, "Command"), h("th", null, "Hotkey"), h("th", null, "Mode"))),
    h("tbody", null, rows.map(([sh]) => {
      const p = parseName(sh.n);
      const lab = textInput(p.label, v => { p.label = v.replace(/::|##/g, ""); sh.n = buildName(p); touch(); }, {placeholder: p.hasTooltip ? p.tooltip : (p.hasIcon ? "(icon " + p.iconRaw + ")" : "")});
      return withCtx(h("tr", {class: S.multi.has(sh) ? "multi" : ""},
        h("td", {style: {paddingTop: "10px"}}, checkbox(S.multi.has(sh), (on, ev) => toggleMulti(sh, on, ev.shiftKey), "blue")),
        h("td", {class: "loc"}, h("a", {tip: "Open in Bars view", onclick: () => { S.sel = sh; S.view = "bars"; S.expanded.add(IDX.get(sh).bar); ancestors(sh).forEach(a => S.expanded.add(a)); render(); }}, locationText(sh))),
        h("td", {style: {paddingTop: "7px"}}, thumb(sh)),
        h("td", null, lab),
        h("td", null, dropdown({value: sh.t, width: "112px", options: SH_TYPES.map((t, i) => ({value: i, label: t})), onChange: v => { commit(); sh.t = v; if (v === 1) sh.sL ??= []; touch(); }})),
        h("td", null, sh.t === 2 ? null : textInput(sh.c, v => { sh.c = v; touch(); }, {multiline: true, autosize: true, rows: 1})),
        h("td", null, hotkeyInput(sh.k, v => { commit(); sh.k = v; touch(); })),
        h("td", null, dropdown({value: sh.m, width: "120px", options: SH_MODES.map((t, i) => ({value: i, label: t})), onChange: v => { commit(); sh.m = v; touch(); }}))), () => shortcutMenu(sh));
    })));
  return h("div", {class: "tbl-wrap"},
    h("div", {class: "toolbar sticky-tools"}, filter,
      seg(S.tableType, [[-1, "All"], [0, "Commands"], [1, "Categories"], [2, "Spacers"]], v => { S.tableType = v; rerenderTable(); }),
      h("span", {class: "dim"}, `${rows.length} shown`), h("span", {class: "spacer"}),
      h("button", {class: "btn sm", onclick: () => findReplace(S.multi.size > 0)}, "Find & replace...")),
    tbl);
}

/* ---------- conditions view ---------- */
let ZONES = null, zonesLoading = null;
function loadZones(){
  if (ZONES) return Promise.resolve(ZONES);
  try { const c = JSON.parse(store("zones") || "null"); if (c && c.length > 100) return Promise.resolve(ZONES = c); } catch {}
  return zonesLoading ??= (async () => {
    const out = []; let after = null;
    for (let guard = 0; guard < 20; guard++) {
      const r = await fetch(`https://v2.xivapi.com/api/sheet/TerritoryType?fields=PlaceName.Name&limit=500${after !== null ? "&after=" + after : ""}`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json(); if (!j.rows.length) break;
      for (const row of j.rows) { const n = row.fields?.PlaceName?.fields?.Name; if (n) out.push([row.row_id, n]); }
      after = j.rows[j.rows.length - 1].row_id;
      if (j.rows.length < 500) break;
    }
    ZONES = out; store("zones", JSON.stringify(out)); return out;
  })().catch(e => { zonesLoading = null; throw e; });
}
function zoneLabel(id){ if (KNOWN_ZONES[id]) return KNOWN_ZONES[id]; const z = ZONES && ZONES.find(x => x[0] === id); return z ? z[1] : ""; }
if (store("zones")) loadZones().catch(() => {});
// Well-known plugins: InternalName (what conditions check) -> display name (what /xlplugins lists and /xlenableplugin takes).
// Checked against the plugins' own manifests. Examples only: someone's install may differ.
const COMMON_PLUGINS = {Artisan: "Artisan", AutoDuty: "AutoDuty", AutoRetainer: "AutoRetainer", BossMod: "Boss Mod", BossModReborn: "BossMod Reborn", Glamourer: "Glamourer", Lifestream: "Lifestream", PandorasBox: "Pandora's Box", Penumbra: "Penumbra", QoLBar: "QoL Bar", Questionable: "Questionable", RotationSolver: "Rotation Solver Reborn", Saucy: "Saucy", SimpleTweaksPlugin: "Simple Tweaks Plugin", SomethingNeedDoing: "SomethingNeedDoing", TextAdvance: "TextAdvance", vnavmesh: "vnavmesh", WrathCombo: "Wrath Combo", YesAlready: "YesAlready"};
const byName = (a, b) => a.localeCompare(b, undefined, {sensitivity: "base"});
// Plugin choices for "Plugin Enabled" conditions, marked by how sure we are the name is right
function pluginOptions(){
  const inFile = new Set();
  S.doc.CndSetCfgs.forEach(s => s.c.forEach(x => { if (x.i === "p" && typeof x.a === "string" && x.a) inFile.add(x.a); }));
  const inst = new Map(PROFILE.plugins || []), seen = new Set(), out = [];
  const add = (n, group, mark, tip, hint) => { if (seen.has(n)) return; seen.add(n); out.push({value: n, label: n, group, mark, markTip: tip, hint, search: COMMON_PLUGINS[n] || ""}); };
  const disp = n => COMMON_PLUGINS[n] && COMMON_PLUGINS[n] !== n ? COMMON_PLUGINS[n] : "";
  for (const n of [...inFile].sort(byName)) add(n, "In this file", "ok", "Already used by a condition in this file", disp(n));
  for (const n of [...inst.keys()].sort(byName)) add(n, "Installed (from your dalamudConfig.json)", "ok", "Installed in your Dalamud", [disp(n), inst.get(n) ? "" : "disabled"].filter(Boolean).join(" · "));
  for (const n of Object.keys(COMMON_PLUGINS).sort(byName)) add(n, "Common examples", "q", "A well-known plugin, not confirmed to be installed. Load dalamudConfig.json to see what you have.", disp(n));
  return out;
}
// The name /xlenableplugin needs. Known list first, then names your own commands already use, then a guess.
function pluginDisplayName(internal){
  if (COMMON_PLUGINS[internal]) return {name: COMMON_PLUGINS[internal], sure: true};
  const norm = t => t.toLowerCase().replace(/[^a-z0-9]/g, ""), key = norm(internal), used = new Set();
  for (const [sh] of allShortcuts(S.doc)) for (const m of String(sh.c || "").matchAll(/\/xl(?:enable|disable|toggle)plugin\s+"?([^"\n]+?)"?\s*$/gim)) used.add(m[1].trim());
  const exact = [...used].find(d => norm(d) === key);
  if (exact) return {name: exact, sure: true};
  const near = [...used].filter(d => norm(d).startsWith(key)).sort((a, b) => a.length - b.length)[0];
  if (near) return {name: near, sure: true};
  return {name: internal.replace(/([a-z])([A-Z])/g, "$1 $2"), sure: false};
}
function argEditor(c, onChange){
  const def = COND_BY_ID[c.i];
  if (!def) return h("span", {class: "mono dim"}, "value: " + (isRaw(c.a) ? c.a.__raw : JSON.stringify(c.a)));
  const set = v => { commit(); c.a = v; onChange(); };
  switch (def.arg) {
    case null: return h("span", {class: "faint"}, "(no value needed)");
    case "flag": return dropdown({value: c.a, width: "270px", searchable: true, options: CONDITION_FLAGS.map(([v, n]) => ({value: v, label: n, hint: String(v)})), onChange: set});
    case "set": return dropdown({value: c.a, width: "240px", options: S.doc.CndSetCfgs.map((s, i) => ({value: i, label: `#${i + 1}  ${s.n || "(unnamed)"}`})), onChange: set});
    case "job": return dropdown({value: c.a, width: "200px", searchable: true, options: JOBS.map(([v, a, n]) => ({value: v, label: a, hint: n, search: n})), onChange: set});
    case "role": return dropdown({value: c.a, width: "170px", options: ROLES.map(([v, n]) => ({value: v, label: n})), onChange: set});
    case "target": return seg(c.a, TARGETS.map((t, i) => [i, t]), set);
    case "hud": return seg(c.a, [0, 1, 2, 3].map(i => [i, String(i + 1)]), set);
    case "party": return seg(c.a, [2, 3, 4, 5, 6, 7, 8].map(i => [i, "<" + i + ">"]), set);
    case "hotkey": return hotkeyInput(c.a, set);
    case "charid": {
      const e = textInput(isRaw(c.a) ? c.a.__raw : String(c.a), v => { const s = v.trim(); if (/^\d+$/.test(s)) { c.a = Number.isSafeInteger(+s) ? +s : {__raw: s}; e.classList.remove("bad"); onChange(); } else e.classList.add("bad"); }, {cls: "mono"});
      e.style.width = "220px"; return e;
    }
    case "timespan": {
      const e = textInput(typeof c.a === "string" ? c.a : "", v => { c.a = v; e.classList.toggle("bad", !TIMESPAN_RE.test(v)); onChange(); }, {placeholder: "XX:30-XX:10", cls: "mono"});
      e.style.width = "170px"; if (typeof c.a !== "string" || !TIMESPAN_RE.test(c.a)) e.classList.add("bad"); return e;
    }
    case "plugin": {
      return dropdown({value: typeof c.a === "string" ? c.a : "", width: "240px", allowCustom: true, placeholder: "Plugin InternalName", options: pluginOptions(), onChange: set});
    }
    case "addon": { const e = textInput(typeof c.a === "string" ? c.a : "", v => { c.a = v; onChange(); }, {placeholder: "e.g. _PartyList", cls: "mono"}); e.style.width = "220px"; return e; }
    case "zone": {
      const lab = h("span", {class: "dim"}, zoneLabel(c.a));
      const num = numInput(c.a, v => { c.a = v; onChange(); lab.textContent = zoneLabel(v); }, {min: 0, width: "90px"});
      const pick = h("button", {class: "btn sm", onclick: async () => {
        pick.textContent = "Loading zones...";
        try { await loadZones(); } catch (e) { pick.textContent = "Pick zone..."; return toast("Could not load zone names from xivapi (" + e.message + "). Type the TerritoryType ID instead.", "err"); }
        const dd = dropdown({value: c.a, width: "320px", searchable: true, options: ZONES.map(([id, n]) => ({value: id, label: n, hint: String(id), search: String(id)})), onChange: v => { set(v); renderConditionsBody(); }});
        pick.replaceWith(dd); dd.click();
      }}, "Pick zone...");
      return h("div", {class: "inline"}, num, pick, lab);
    }
  }
  return h("span");
}
function usedBy(i){ const sets = S.doc.CndSetCfgs; return {bars: S.doc.BarCfgs.filter(b => b.c === i), sets: sets.filter(s => s.c.some(c => c.i === "cs" && c.a === i))}; }
function paintSetList(){
  const host = $("#setList"); if (!host) return;
  const sets = S.doc.CndSetCfgs;
  host.replaceChildren(
    ...sets.map((s, i) => { const u = usedBy(i); return withCtx(h("div", {class: "item" + (i === S.selSet ? " sel" : ""), onclick: () => { S.selSet = i; render(); }},
      h("span", {class: "n"}, "#" + (i + 1)),
      h("div", {style: {minWidth: 0, flex: 1}}, h("div", {style: {fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}, s.n || h("i", {class: "faint"}, "(unnamed)")),
        h("div", {class: "faint", style: {fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}, s.c.length ? s.c.map((c, j) => (j ? OPERATORS[c.o] + " " : "") + condText(c, sets)).join("  ") : "empty (always true)")),
      h("span", {class: "chip plain", style: {opacity: u.bars.length ? 1 : .5}, tip: u.bars.length ? "Used by: " + u.bars.map(b => b.n).join(", ") : null}, u.bars.length ? u.bars.length + " bar" + (u.bars.length > 1 ? "s" : "") : "unused")), () => setMenu(i)); }),
    !sets.length ? h("div", {class: "faint", style: {padding: "14px"}}, "No condition sets yet.") : "");
}
function renderConditions(){
  const sets = S.doc.CndSetCfgs;
  S.selSet = Math.min(S.selSet, Math.max(0, sets.length - 1));
  const list = h("div", {class: "setlist", id: "setList", style: {padding: "6px"}});
  queueMicrotask(paintSetList);
  const presetBtn = h("button", {class: "btn sm", onclick: () => presetMenu(presetBtn)}, "Presets ", h("span", {class: "faint", style: {fontSize: "9px"}}, "▼"));
  const left = h("div", {class: "left", style: {width: "400px"}},
    h("div", {class: "toolbar"}, h("b", {style: {flex: 1}}, "Condition sets"),
      h("button", {class: "btn sm", tip: "Bring condition sets in from another QoLBar.json or an import string", onclick: e => importMenu(e.currentTarget)}, "Import"), presetBtn,
      h("button", {class: "btn sm primary", onclick: () => mutate(() => { sets.push(makeSet({n: "New set", c: []})); S.selSet = sets.length - 1; })}, svg(ICONS.plus), "New")),
    h("div", {class: "tree"}, list),
    h("div", {class: "help", style: {padding: "10px 14px", borderTop: "1px solid var(--line)", marginTop: 0}}, "A bar with a condition set is only drawn while that set is true. Moving or deleting sets here keeps every reference pointing at the right set, same as in game."));
  const right = h("div", {class: "right", id: "condBody"});
  queueMicrotask(renderConditionsBody);
  return [left, right];
}
function presetMenu(anchor){
  const P = [
    ["Out of combat", () => makeSet({n: "Out of Combat", c: [makeCond({i: "cf", a: 26, n: true})]})],
    ["In combat", () => makeSet({n: "In Combat", c: [makeCond({i: "cf", a: 26})]})],
    ["Not in duty, cutscene or loading", () => makeSet({n: "Out of the Way", c: [makeCond({i: "cf", a: 34, n: true}), ...[732, 763, 795, 827, 920, 975, 1055].map(z => makeCond({i: "z", a: z, o: 1})), makeCond({i: "cf", a: 45, n: true}), makeCond({i: "cf", a: 35, n: true})]})],
    ["Plugin enabled", () => makeSet({n: "Plugin", c: [makeCond({i: "p", a: ""})]})],
    ["Specific job", () => makeSet({n: "Job", c: [makeCond({i: "j", a: 19})]})],
    ["Mounted", () => makeSet({n: "Mounted", c: [makeCond({i: "cf", a: 4})]})],
    ["Crafter or gatherer", () => makeSet({n: "DoH / DoL", c: [makeCond({i: "r", a: 33}), makeCond({i: "r", a: 32, o: 1})]})],
  ];
  openPop(anchor, h("div", {class: "pop"}, h("div", {class: "pop-list"}, P.map(([n, f]) => h("div", {class: "opt", onclick: () => { closePop(); const s = f(); mutate(() => { S.doc.CndSetCfgs.push(s); S.selSet = S.doc.CndSetCfgs.length - 1; }); }}, n)))));
}
function renderConditionsBody(){
  const host = $("#condBody"); if (!host) return;
  const sets = S.doc.CndSetCfgs, i = S.selSet, s = sets[i];
  if (!s) return host.replaceChildren(h("div", {class: "empty-insp"}, "Create a condition set to get started."));
  const scroll = host.scrollTop;
  const sentence = h("div", {class: "sentence"});
  const paintSentence = () => {
    sentence.replaceChildren(h("span", {class: "chip op"}, "SHOW IF"));
    if (!s.c.length) sentence.append(h("span", {class: "dim"}, "always (empty set)"));
    s.c.forEach((c, j) => { if (j) sentence.append(h("span", {class: "chip op"}, OPERATORS[c.o])); if (c.n) sentence.append(h("span", {class: "chip not"}, "NOT")); sentence.append(h("span", null, condText({...c, n: false}, sets))); });
    if (new Set(s.c.slice(1).map(c => c.o)).size > 1) sentence.append(h("div", {class: "help", style: {width: "100%"}}, "Mixed operators are evaluated strictly left to right with no precedence: ((1 op 2) op 3) op 4 ..."));
  };
  paintSentence();
  const changed = () => { touch(); paintSentence(); };
  const rerow = () => { touch(); renderConditionsBody(); };
  const rows = h("div");
  s.c.forEach((c, j) => {
    const def = COND_BY_ID[c.i];
    rows.append(withCtx(h("div", {class: "cnd-row"},
      h("span", {class: "idx"}, j + 1),
      j === 0 ? h("span", {class: "chip op", style: {width: "92px", justifyContent: "center", padding: "6px"}}, "IF")
        : dropdown({value: c.o, width: "92px", options: OPERATORS.map((o, k) => ({value: k, label: o, hint: ["both", "either", "same", "differ"][k]})), onChange: v => { commit(); c.o = v; changed(); }}),
      toggle(c.n, v => { commit(); c.n = v; changed(); }, "NOT"),
      dropdown({value: c.i, width: "210px", searchable: true, options: CONDITIONS.map(d => ({value: d.id, label: d.name, group: d.cat})), onChange: v => { commit(); c.i = v; c.a = COND_BY_ID[v].arg === null ? 0 : COND_BY_ID[v].def; rerow(); }}),
      argEditor(c, changed),
      def?.help ? help(def.help) : null,
      h("span", {class: "spacer"}),
      h("button", {class: "btn sm ghost icon", tip: "Move up", disabled: j === 0, onclick: () => { commit(); s.c.splice(j, 1); s.c.splice(j - 1, 0, c); rerow(); }}, svg(ICONS.up)),
      h("button", {class: "btn sm ghost icon", tip: "Move down", disabled: j === s.c.length - 1, onclick: () => { commit(); s.c.splice(j, 1); s.c.splice(j + 1, 0, c); rerow(); }}, svg(ICONS.down)),
      h("button", {class: "btn sm ghost icon danger", tip: "Remove", onclick: () => { commit(); s.c.splice(j, 1); rerow(); }}, svg(ICONS.x))), () => condRowMenu(s, c, j)));
  });
  const u = usedBy(i);
  const nameIn = textInput(s.n, v => { s.n = v; touch(); }); nameIn.style.maxWidth = "360px"; nameIn.style.fontSize = "16px"; nameIn.style.fontWeight = "600";
  host.replaceChildren(h("div", {class: "insp"},
    h("div", {class: "insp-hd"}, h("div", {class: "thumb lg", style: {background: "var(--accent-bg)", color: "var(--accent)", fontSize: "16px", fontWeight: 700}}, "#" + (i + 1)),
      h("div", {style: {flex: 1}}, nameIn),
      h("div", {class: "actions"},
        h("button", {class: "btn sm", disabled: i === 0, onclick: () => mutate(() => { moveSet(S.doc, i, i - 1); S.selSet = i - 1; })}, svg(ICONS.up), "Move up"),
        h("button", {class: "btn sm", disabled: i === sets.length - 1, onclick: () => mutate(() => { moveSet(S.doc, i, i + 1); S.selSet = i + 1; })}, svg(ICONS.down), "Move down"),
        h("button", {class: "btn sm", onclick: () => copyImportString("set", s)}, svg(ICONS.copy), "Copy import string"),
        h("button", {class: "btn sm", onclick: () => mutate(() => { const c = structuredClone(s); c.n += " (copy)"; sets.push(c); S.selSet = sets.length - 1; })}, "Duplicate"),
        h("button", {class: "btn sm danger", tip: "Delete set", onclick: async () => { if (await confirmBox("Delete condition set", `Delete "${s.n}"? ${u.bars.length} bar(s) using it become always shown, and "Condition Set" rows pointing at it are removed. Later sets are renumbered automatically.`, "Delete", "danger")) mutate(() => removeSet(S.doc, i)); }}, svg(ICONS.trash)))),
    h("div", {class: "card"}, h("h3", null, "Reads as"), sentence),
    h("div", {class: "card"}, h("h3", null, "Conditions", h("span", {class: "actions"}, h("button", {class: "btn sm primary", onclick: () => { commit(); s.c.push(makeCond({i: "cf", a: 26})); rerow(); }}, svg(ICONS.plus), "Add condition"))),
      rows, !s.c.length ? h("div", {class: "faint"}, "An empty set is always true.") : null,
      h("div", {class: "help", style: {marginTop: "10px"}}, "AND: both true · OR: either true · EQUALS: both the same · XOR: exactly one true. Each operator combines the result so far with its own row.")),
    h("div", {class: "card"}, h("h3", null, "Used by"),
      u.bars.length || u.sets.length ? h("div", {class: "inline"},
        u.bars.map(b => h("button", {class: "btn sm", onclick: () => { S.view = "bars"; S.sel = b; render(); }}, "Bar: " + (b.n || "(unnamed)"))),
        u.sets.map(x => h("button", {class: "btn sm", onclick: () => { S.selSet = sets.indexOf(x); render(); }}, "Set: " + (x.n || "#" + (sets.indexOf(x) + 1)))))
        : h("div", {class: "faint"}, "Nothing uses this set yet. Pick it under a bar's \"Show when\"."))));
  host.scrollTop = scroll;
}
