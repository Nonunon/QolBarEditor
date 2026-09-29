// SPDX-License-Identifier: AGPL-3.0-or-later
// The Import / Export menu, readable JSON, import strings and importing from another config.
"use strict";

/* ---------- import / export menu ---------- */
function moreMenu(e){
  const item = (label, sub, fn) => h("div", {class: "opt", style: {flexDirection: "column", alignItems: "flex-start", gap: "1px", whiteSpace: "normal"}, onclick: () => { closePop(); fn(); }}, h("span", null, label), h("span", {class: "faint", style: {fontSize: "12px"}}, sub));
  const stringify = o => JSON.stringify(o, (k, v) => isRaw(v) ? v.__raw : v, 2);
  openPop(e.currentTarget, h("div", {class: "pop", style: {width: "360px", maxHeight: "480px"}}, h("div", {class: "pop-list"},
    h("div", {class: "grp"}, "In-game strings"),
    item("Import from in-game string...", "Paste a string from QoLBar's Export and add it here (or just press Ctrl+V)", () => importStringModal()),
    item("Import from another QoLBar.json...", "Pick condition sets, bars or shortcuts out of a different config", importFromFileModal),
    item("Decode a string...", "See what an import string contains, as readable JSON", decodeModal),
    h("div", {class: "grp"}, "Readable file"),
    item("Export readable JSON", "Long key names, hex colors, hotkeys as text. Good for text editors, diffs and bulk edits.", () => download("QoLBar.readable.json", stringify(unwrapConfig(S.doc)))),
    item("Import readable JSON...", "Replace everything with an edited readable file", importReadable),
    h("div", {class: "grp"}, "Files"),
    item("Download QoLBar.json", "The current edits in plugin format", () => download("QoLBar.json", serialize(S.doc))),
    item("Download the original file", "Exactly what was loaded, untouched", () => download("QoLBar.original.json", S.originalText)))));
}
async function importReadable(){
  const text = await new Promise(res => { const i = h("input", {type: "file", accept: ".json"}); i.onchange = async () => res(i.files[0] ? await i.files[0].text() : null); i.click(); });
  if (!text) return;
  let doc; try { doc = wrapConfig(parseConfig(text)); } catch (e) { return toast(e.message, "err"); }
  if (!(await confirmBox("Replace everything?", `The readable file has ${doc.BarCfgs.length} bars and ${doc.CndSetCfgs.length} condition sets. It replaces the current bars, sets and settings. Undo is available.`, "Replace"))) return;
  mutate(() => { for (const k of Object.keys(S.doc)) delete S.doc[k]; Object.assign(S.doc, doc); S.sel = null; S.multi.clear(); });
  toast("Readable file imported. Save to write it.");
}
function describeDecoded(r){
  const stringify = o => JSON.stringify(o, (k, v) => isRaw(v) ? v.__raw : v, 2);
  if (r.kind === "bar") return stringify(unwrapConfig({BarCfgs: [r.value], CndSetCfgs: S.doc.CndSetCfgs}).Bars[0]);
  if (r.kind === "shortcut") return stringify(unwrapShortcut(r.value));
  return stringify({Name: r.value.n, Conditions: r.value.c.map(c => unwrapCond(c, S.doc.CndSetCfgs))});
}
async function decodeModal(){
  const ta = h("textarea", {class: "txt", rows: 5, placeholder: "Paste the string here"});
  const out = h("pre", {class: "txt mono", style: {whiteSpace: "pre-wrap", maxHeight: "360px", overflow: "auto", fontSize: "12px", margin: "10px 0 0", display: "none"}});
  ta.addEventListener("input", async () => {
    out.style.display = ta.value.trim() ? "" : "none";
    try { out.textContent = describeDecoded(await importString(ta.value)); } catch (e) { out.textContent = "Not a valid QoLBar string: " + e.message; }
  });
  await modal({title: "Decode an import string", body: h("div", null, ta, out), wide: true});
}
// Small menu shared by the Bars and Conditions views
function importMenu(anchor){
  const item = (label, sub, fn) => h("div", {class: "opt", style: {flexDirection: "column", alignItems: "flex-start", gap: "1px", whiteSpace: "normal"}, onclick: () => { closePop(); fn(); }}, h("span", null, label), h("span", {class: "faint", style: {fontSize: "12px"}}, sub));
  openPop(anchor, h("div", {class: "pop", style: {width: "330px"}}, h("div", {class: "pop-list"},
    item("From another QoLBar.json...", "Pick condition sets, bars or shortcuts out of a different config", importFromFileModal),
    item("From an import string...", "A string from QoLBar's Export or Copy import string. Tip: just press Ctrl+V anywhere.", () => importStringModal()))));
}
function pickText(){
  return new Promise(res => { const i = h("input", {type: "file", accept: ".json,application/json"}); i.onchange = async () => res(i.files[0] ? {text: await i.files[0].text(), name: i.files[0].name} : null); i.click(); });
}
async function importFromFileModal(){
  const got = await pickText(); if (!got) return;
  let src;
  try { src = parseConfig(got.text); if (src && Array.isArray(src.Bars)) src = wrapConfig(src); } catch (e) { return toast("Couldn't read that file: " + e.message, "err"); }
  if (!src || !Array.isArray(src.BarCfgs)) return toast("That file isn't a QoLBar config.", "err");
  src.CndSetCfgs ||= [];
  const selSets = new Set(), selBars = new Set(), selSh = new Set(), open = new Set();
  let withDeps = true;
  const selM = S.sel && IDX.get(S.sel);
  let dest = selM ? (selM.kind === "bar" ? S.sel : S.sel.t === 1 ? S.sel : selM.parent || selM.bar) : S.doc.BarCfgs[0];
  const summary = h("div", {class: "help", style: {marginTop: 0, color: "var(--text)"}});
  const list = h("div", {style: {maxHeight: "52vh", overflow: "auto", border: "1px solid var(--line)", borderRadius: "10px", padding: "6px 4px"}});
  const destRow = h("div", {class: "inline", style: {marginTop: "10px"}});
  const row = (on, onToggle, main, sub, indent = 0) => h("div", {class: "inline", style: {flexWrap: "nowrap", padding: "5px 8px 5px " + (8 + indent) + "px", borderRadius: "7px"}},
    checkbox(on, onToggle), h("div", {style: {minWidth: 0}}, h("div", {style: {overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}, main), sub ? h("div", {class: "faint", style: {fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}, sub) : null));
  const paint = () => {
    const sets = src.CndSetCfgs;
    const deps = withDeps ? setDependencies(src, [...selSets], [...selBars].map(i => src.BarCfgs[i])) : new Set(selSets);
    list.replaceChildren(
      h("div", {class: "flabel", style: {padding: "4px 8px"}}, `Condition sets (${sets.length})`),
      ...(sets.length ? sets.map((s, i) => row(selSets.has(i), on => { on ? selSets.add(i) : selSets.delete(i); paint(); },
        h("span", null, h("span", {class: "mono faint"}, `#${i + 1} `), s.n || "(unnamed)", deps.has(i) && !selSets.has(i) ? h("span", {class: "chip plain", style: {marginLeft: "6px"}}, "comes along") : null),
        s.c.length ? s.c.map((c, j) => (j ? OPERATORS[c.o] + " " : "") + condText(c, sets)).join("  ") : "empty (always true)")) : [h("div", {class: "faint", style: {padding: "4px 8px"}}, "None")]),
      h("div", {class: "flabel", style: {padding: "10px 8px 4px"}}, `Bars (${src.BarCfgs.length})`),
      ...src.BarCfgs.flatMap((b, i) => {
        const kids = b.sL || [], expanded = open.has(i);
        const head = row(selBars.has(i), on => { on ? selBars.add(i) : selBars.delete(i); paint(); },
          h("span", null, b.n || "(unnamed)", b.c >= 0 && sets[b.c] ? h("span", {class: "chip cond", style: {marginLeft: "6px"}}, "if " + (sets[b.c].n || "#" + (b.c + 1))) : null),
          `${kids.length} shortcut${kids.length === 1 ? "" : "s"}`);
        if (kids.length) head.append(h("button", {class: "btn sm ghost", style: {marginLeft: "auto"}, onclick: () => { expanded ? open.delete(i) : open.add(i); paint(); }}, expanded ? "Hide shortcuts" : "Pick shortcuts"));
        const rows = [head];
        if (expanded && !selBars.has(i)) kids.forEach(sh => rows.push(row(selSh.has(sh), on => { on ? selSh.add(sh) : selSh.delete(sh); paint(); },
          h("span", null, displayName(sh) || "(blank)", sh.t === 1 ? h("span", {class: "chip cat", style: {marginLeft: "6px"}}, "category") : null), sh.c.split("\n")[0], 26)));
        return rows;
      }));
    const shCount = [...selSh].filter(sh => !src.BarCfgs.some((b, i) => selBars.has(i) && (b.sL || []).includes(sh))).length;
    const extra = [...deps].filter(i => !selSets.has(i)).length;
    summary.textContent = (selSets.size || selBars.size || shCount)
      ? `Will bring over: ${selSets.size} condition set${selSets.size === 1 ? "" : "s"}${extra ? ` (+${extra} they depend on)` : ""}, ${selBars.size} bar${selBars.size === 1 ? "" : "s"}, ${shCount} shortcut${shCount === 1 ? "" : "s"}. Identical sets you already have are reused, not duplicated.`
      : "Tick what to bring over.";
    destRow.replaceChildren(...(shCount ? [h("span", {class: "dim"}, "Put the shortcuts into:"), dropdown({value: dest, options: destinations(), searchable: true, width: "320px", onChange: v => dest = v})] : []));
  };
  paint();
  const body = h("div", null,
    h("div", {class: "dim", style: {marginBottom: "10px"}}, `${got.name}: ${src.BarCfgs.length} bars, ${src.CndSetCfgs.length} condition sets. Nothing in that file is changed.`),
    list,
    h("div", {class: "inline", style: {marginTop: "10px"}}, toggle(true, v => { withDeps = v; paint(); }, "Also bring the condition sets these use"), help("Bars use a condition set, and sets can use other sets through \"Condition Set\" rows. With this on, those come along and every number is fixed up to match this file. With it off, bars lose their set and those rows are removed.")),
    destRow,
    h("div", {style: {marginTop: "10px"}}, summary));
  const ok = await modal({title: "Import from another QoLBar.json", body, wide: true, buttons: [["Cancel", false], ["Import", () => (selSets.size || selBars.size || selSh.size) ? true : (toast("Tick something to import first", "warn"), false), "primary"]]});
  if (!ok) return;
  const shortcuts = [...selSh].filter(sh => !src.BarCfgs.some((b, i) => selBars.has(i) && (b.sL || []).includes(sh)));
  if (shortcuts.length && !dest) return toast("Create a bar here first to put shortcuts into.", "err");
  let r;
  mutate(() => {
    const destList = shortcuts.length ? (IDX.get(dest)?.kind === "bar" ? dest.sL : (dest.sL ??= [])) : null;
    r = importFromDoc(S.doc, src, {sets: [...selSets], bars: [...selBars].map(i => src.BarCfgs[i]), shortcuts, destList, withDeps});
    if (r.bars.length) { S.sel = r.bars[0]; r.bars.forEach(b => S.expanded.add(b)); }
    else if (r.shortcuts.length) { S.sel = r.shortcuts[0]; S.expanded.add(dest); }
    else if (r.firstNewSet >= 0) { S.selSet = r.firstNewSet; S.view = "conds"; }
  });
  const parts = [r.setsAdded && `${r.setsAdded} condition set${r.setsAdded > 1 ? "s" : ""}`, r.setsReused && `${r.setsReused} reused`, r.bars.length && `${r.bars.length} bar${r.bars.length > 1 ? "s" : ""}`, r.shortcuts.length && `${r.shortcuts.length} shortcut${r.shortcuts.length > 1 ? "s" : ""}`].filter(Boolean);
  toast(`Imported ${parts.join(", ") || "nothing new"}.` + (r.droppedRows ? ` ${r.droppedRows} "Condition Set" row(s) removed (their set wasn't brought).` : "") + (r.unlinkedBars ? ` ${r.unlinkedBars} bar(s) now always show.` : ""), r.droppedRows || r.unlinkedBars ? "warn" : "");
}

async function importStringModal(prefill){
  const ta = h("textarea", {class: "txt", rows: 5, placeholder: "Paste the string from QoLBar's Export (right click a bar or shortcut in game > Export)"});
  const info = h("div", {class: "help", style: {marginTop: "8px"}});
  const selM = S.sel && IDX.get(S.sel);
  let decoded = null, dest = selM ? (selM.kind === "bar" ? S.sel : S.sel.t === 1 ? S.sel : selM.parent || selM.bar) : S.doc.BarCfgs[0];
  const destHost = h("div", {style: {marginTop: "10px"}});
  const paintDest = () => destHost.replaceChildren(decoded?.kind === "shortcut" ? h("div", {class: "inline"}, h("span", {class: "dim"}, "Add into:"), dropdown({value: dest, options: destinations(), searchable: true, width: "340px", onChange: v => dest = v})) : "");
  ta.addEventListener("input", async () => {
    decoded = null;
    try {
      decoded = await importString(ta.value); const v = decoded.value; let n = 0; walkShortcuts(decoded.kind === "bar" ? v.sL : [v], () => n++);
      const csRows = decoded.kind === "set" ? v.c.filter(c => c.i === "cs").length : 0;
      info.textContent = decoded.kind === "bar" ? `Bar "${v.n}" with ${n} shortcuts. It is added as a new bar.` + (v.c >= 0 ? " Strings don't carry condition sets, so it will always show until you pick a set for it (like QoLBar does)." : "")
        : decoded.kind === "set" ? `Condition set "${v.n}" with ${v.c.length} conditions. It is added at the end.` + (csRows ? ` Careful: ${csRows} of its rows point at other sets by number, which may mean different sets here. Check them after importing, or use "From another QoLBar.json" to bring them along correctly.` : "")
        : `Shortcut "${displayName(v)}"${n > 1 ? ` (${n} including children)` : ""}.`;
    } catch (e) { info.textContent = ta.value.trim() ? "Not a valid string: " + e.message : ""; }
    paintDest();
  });
  if (prefill) { ta.value = prefill; setTimeout(() => ta.dispatchEvent(new Event("input")), 0); }
  const ok = await modal({title: "Import from in-game string", body: h("div", null, ta, info, destHost), wide: true, buttons: [["Cancel", false], ["Import", () => decoded ? true : (toast("Paste a valid string first", "warn"), false), "primary"]]});
  if (!ok || !decoded) return;
  const v = decoded.value;
  if (!dest && decoded.kind === "shortcut") return toast("Create a bar first", "err");
  mutate(() => {
    if (decoded.kind === "bar") { v.c = -1; S.doc.BarCfgs.push(v); S.sel = v; S.expanded.add(v); }
    else if (decoded.kind === "set") { S.doc.CndSetCfgs.push(v); S.selSet = S.doc.CndSetCfgs.length - 1; S.view = "conds"; }
    else { (IDX.get(dest)?.kind === "bar" ? dest.sL : (dest.sL ??= [])).push(v); S.sel = v; S.expanded.add(dest); }
  });
  toast("Imported " + decoded.kind);
}
