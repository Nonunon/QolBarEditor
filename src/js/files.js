// SPDX-License-Identifier: AGPL-3.0-or-later
// Opening, saving, connected folders, reload from disk, session memory, and the review before saving.
"use strict";

/* =====================================================================
   File I/O
   ===================================================================== */
/* Browser abilities differ. Chrome / Edge / Helium can remember a folder and write files in place;
   Firefox can only read files you pick or drop, and save by downloading. */
const CAN_FOLDER = typeof window.showDirectoryPicker === "function";
const XIV_PATH = "%AppData%\\XIVLauncher";

// Tiny IndexedDB key/value store: folder handles can be kept there (localStorage can't hold them)
const idb = (() => {
  let dbp = null;
  const db = () => dbp ??= new Promise((res, rej) => { const r = indexedDB.open("qolbarunwrap", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const run = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("kv", mode), req = fn(t.objectStore("kv")); t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error); }); };
  return {get: k => run("readonly", s => s.get(k)).catch(() => null), set: (k, v) => run("readwrite", s => s.put(v, k)).catch(() => {}), del: k => run("readwrite", s => s.delete(k)).catch(() => {})};
})();

function timeAgo(t){
  if (!t) return "unknown";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  return Math.round(s / 86400) + " days ago";
}

// opts.resumed = a saved session; opts.keepView = reload in place (keeps tab and selection)
async function loadText(text, name, handle, mtime, opts = {}){
  let doc;
  try { doc = parseConfig(text); } catch (e) { return toast("Could not parse JSON: " + e.message, "err"); }
  if (!doc || !Array.isArray(doc.BarCfgs)) {
    if (doc && Array.isArray(doc.Bars)) { try { doc = wrapConfig(doc); handle = null; toast("Loaded a readable file. Saving downloads a normal QoLBar.json.", "warn"); } catch (e) { return toast(e.message, "err"); } }
    else return toast("This does not look like a QoLBar config (no BarCfgs).", "err");
  }
  doc.CndSetCfgs = doc.CndSetCfgs || [];
  const keepSel = opts.keepView && S.sel && IDX.get(S.sel) ? IDX.get(S.sel).path : null, view = S.view;
  const r = opts.resumed;
  Object.assign(S, {doc, fileName: name, handle: handle || null, originalText: r ? (r.original || text) : text, savedText: r ? (r.saved || r.original || text) : text, loadedMtime: r ? (r.mtime || 0) : (mtime || 0),
    readAt: r ? r.readAt : Date.now(), resumedAt: r ? r.at : 0, dirty: r ? !!r.dirty : false, changedOnDisk: 0,
    undo: [], redo: [], sel: null, expanded: new Set(), selSet: 0});
  S.multi.clear();
  reindex();
  if (opts.keepView) { S.view = view; S.sel = keepSel ? resolvePath(keepSel) : null; if (S.sel) { const m = IDX.get(S.sel); S.expanded.add(m.bar); ancestors(S.sel).forEach(a => S.expanded.add(a)); } }
  if (!S.sel) { const first = doc.BarCfgs.find(b => b.n !== "-DEMO-") || doc.BarCfgs[0]; if (first) { S.sel = first; S.expanded.add(first); } }
  render();
  schedulePersist();
  if (!opts.keepView) setTimeout(offerTour, 1200);
  toast(r ? `Resumed your session: ${name}, read from disk ${timeAgo(r.readAt)}${r.dirty ? ", with unsaved changes" : ""}` : `${opts.keepView ? "Reloaded" : "Loaded"} ${name}: ${doc.BarCfgs.length} bars, ${allShortcuts(doc).length} shortcuts, ${doc.CndSetCfgs.length} condition sets`);
}

// Sorts picked or dropped files by content: QoLBar.json (or a readable export) and/or dalamudConfig.json
async function loadFiles(items, opts = {}){
  let qol = null, dal = null;
  for (const it of items) {
    let j; try { j = parseConfig(it.text); } catch { continue; }
    if (j && (Array.isArray(j.BarCfgs) || Array.isArray(j.Bars))) qol = it;
    else if (j && ("GlobalUiScale" in j || "ChosenStyle" in j)) dal = it;
  }
  if (!qol && !dal) return toast("Those files aren't QoLBar.json or dalamudConfig.json.", "err");
  if (dal) { try { const p = profileFromDalamudConfig(dal.text); setProfile(p); if (!qol) toast(`Using your Dalamud style "${p.styleName}" at UI scale ${p.ui}`); } catch (e) { toast(e.message, "err"); } }
  if (qol) await loadText(qol.text, qol.name, qol.handle, qol.mtime, opts);
  else render();
}
async function openFile(){
  if (S.dirty && !(await confirmBox("Discard changes?", "You have unsaved changes. Open another file anyway?", "Open", "danger"))) return;
  pickFiles();
}
// Always the browser's basic file picker: Chrome's newer picker refuses anything inside AppData ("contains
// system files"), which is exactly where XIVLauncher keeps its configs. The basic picker works everywhere.
function pickFiles(opts = {}){
  const inp = $("#fileInput"); inp._opts = opts; inp.click();
}
$("#fileInput").addEventListener("change", async e => {
  const files = [...e.target.files], opts = e.target._opts || {}; e.target.value = "";
  if (files.length) loadFiles(await Promise.all(files.map(async f => ({text: await f.text(), name: f.name, handle: null, mtime: f.lastModified}))), opts);
});
// Takes everything out of a drop right away (the browser empties the drop data after the first await).
// Images: numbered ones ("811002.png") are custom icons, any other image is a backdrop screenshot.
// JSON files: QoLBar.json and/or dalamudConfig.json.
function captureDrop(dt){
  const items = [...(dt?.items || [])].filter(i => i.kind === "file");
  const isImg = f => f && (f.type.startsWith("image/") || IMG_EXT.test(f.name));
  const out = {icons: [], screenshot: null, json: []};
  for (const i of items) {
    const file = i.getAsFile();
    if (isImg(file)) { if (/^\d+\.[^.]+$/.test(file.name)) out.icons.push(file); else out.screenshot ??= file; continue; }
    out.json.push({handleP: i.getAsFileSystemHandle?.().catch(() => null) ?? null, file});
  }
  return out;
}
async function handleDrop(drop, {confirmDiscard = false} = {}){
  if (drop.screenshot) useScreenshot(drop.screenshot);
  if (drop.icons.length) setCustomIcons(drop.icons);
  if (!drop.json.length) return;
  if (confirmDiscard && S.dirty && !(await confirmBox("Discard changes?", "You have unsaved changes. Load the dropped file anyway?", "Load", "danger"))) return;
  loadFiles(await Promise.all(drop.json.map(async ({handleP, file}) => {
    const hd = handleP ? await handleP : null, f = hd && hd.kind === "file" ? await hd.getFile() : file;
    return {text: await f.text(), name: f.name, handle: hd && hd.kind === "file" ? hd : null, mtime: f.lastModified};
  })));
}
const loadDropped = dt => handleDrop(captureDrop(dt));

/* ---------- Chrome / Edge: connect the XIVLauncher folder once ---------- */
async function findConfigs(dir){
  const file = async (d, n) => { try { return await d.getFileHandle(n); } catch { return null; } };
  const sub = async (d, n) => { try { return await d.getDirectoryHandle(n); } catch { return null; } };
  const pc = await sub(dir, "pluginConfigs");
  return {qol: (pc && await file(pc, "QoLBar.json")) || await file(dir, "QoLBar.json"), dal: await file(dir, "dalamudConfig.json")};
}
async function connectFolder(existing, opts = {}){
  let dir = existing;
  try {
    if (!dir) dir = await showDirectoryPicker({id: "xivlauncher", mode: "readwrite"});
    if ((await dir.queryPermission({mode: "readwrite"})) !== "granted" && (await dir.requestPermission({mode: "readwrite"})) !== "granted") return toast("Folder access wasn't allowed.", "err"), false;
  } catch (e) {
    if (e.name !== "AbortError") toast(e.message, "err");
    else if (!existing) toast("If the browser said the folder \"contains system files\": Chrome blocks everything inside AppData, where XIVLauncher normally lives. Use Open files... instead; saving then downloads the file.", "warn");
    return false;
  }
  const {qol, dal} = await findConfigs(dir);
  if (!qol) return toast(`No pluginConfigs\\QoLBar.json inside "${dir.name}". Pick the XIVLauncher folder (${XIV_PATH}).`, "err"), false;
  S.dir = dir; await idb.set("dir", dir);
  if (dal) { try { setProfile(profileFromDalamudConfig(await (await dal.getFile()).text())); } catch {} }
  else toast("dalamudConfig.json wasn't in that folder, so the preview keeps its current style settings.", "warn");
  loadCustomIconsFromDir(dir); // pluginConfigs\QoLBar\icons, if there is one
  loadIconCacheFromDir(dir);   // pluginConfigs\QoLBar\iconCache.json: which icons exist in this game version
  const f = await qol.getFile();
  await loadText(await f.text(), "QoLBar.json", qol, f.lastModified, opts);
  return true;
}
async function forgetFolder(){ await idb.del("dir"); S.dir = null; S.savedDir = null; render(); toast("Folder forgotten"); }

/* ---------- Reload from disk ---------- */
async function reloadFromDisk(){
  if (S.dirty && !(await confirmBox("Reload from disk?", "This replaces your unsaved changes with what's in the file right now. It can't be undone.", "Reload", "danger"))) return;
  const opts = {keepView: true};
  if (S.handle) {
    try {
      if ((await S.handle.queryPermission?.({mode: "read"})) === "prompt") await S.handle.requestPermission?.({mode: "readwrite"});
      const f = await S.handle.getFile();
      return loadText(await f.text(), S.fileName, S.handle, f.lastModified, opts);
    } catch (e) { toast("Couldn't read the file again: " + e.message, "err"); }
  }
  if (S.dir || S.savedDir) { if (await connectFolder(S.dir || S.savedDir, opts)) return; }
  // Firefox (or a file opened without a handle): the page isn't allowed to reopen a file by itself
  toast("Pick QoLBar.json again (the browser only lets the page read files you choose).", "warn");
  pickFiles(opts);
}

/* ---------- Watch for the game rewriting the file (only with a file handle) ---------- */
setInterval(async () => {
  if (!S.handle || document.hidden || !S.loadedMtime || S.changedOnDisk) return;
  try {
    if ((await S.handle.queryPermission?.({mode: "read"})) !== "granted") return;
    const m = (await S.handle.getFile()).lastModified;
    if (m !== S.loadedMtime && m !== S.ignoredMtime) { S.changedOnDisk = m; renderBanner(); }
  } catch {}
}, 3000);
function renderBanner(){
  const host = $("#bannerHost"); if (!host) return;
  if (!S.changedOnDisk) return host.replaceChildren();
  host.replaceChildren(h("div", {class: "disk-banner"},
    h("b", null, "QoLBar.json changed on disk"), h("span", {class: "dim"}, ` (${timeAgo(S.changedOnDisk)}, probably the game saving). `),
    S.dirty ? h("span", null, "Reloading replaces your unsaved edits here.") : h("span", null, "You have no unsaved edits, so reloading is safe."),
    h("span", {class: "spacer"}),
    h("button", {class: "btn sm primary", onclick: reloadFromDisk}, "Reload from disk"),
    h("button", {class: "btn sm", tip: "Keep what's in the editor. Saving will still warn you before overwriting.", onclick: () => { S.ignoredMtime = S.changedOnDisk; S.changedOnDisk = 0; renderBanner(); }}, "Keep mine")));
}

/* ---------- Session memory: resume after closing the page (works in every browser) ---------- */
let persistT = 0;
function schedulePersist(){ clearTimeout(persistT); persistT = setTimeout(persistSession, 500); }
function persistSession(){
  if (!S.doc) return;
  store("session", JSON.stringify({name: S.fileName, text: serialize(S.doc), original: S.originalText, saved: S.savedText, readAt: S.readAt, mtime: S.loadedMtime, dirty: S.dirty, at: Date.now()}));
}
function savedSession(){ try { const s = JSON.parse(store("session") || "null"); return s && s.text ? s : null; } catch { return null; } }
function resumeSession(){ const s = savedSession(); if (s) loadText(s.text, s.name, null, 0, {resumed: s}); }
function discardSession(){ store("session", ""); render(); }

function download(name, text){ const a = h("a", {href: URL.createObjectURL(new Blob([text], {type: "application/json"})), download: name}); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
/* ---------- review changes before saving ----------
   Compares the config with what was last saved (or read), bar by bar and shortcut by shortcut. Lists are matched by
   name first, then by position, so a rename shows as a change instead of a remove plus an add. */
const BAR_WORDS = {n: "name", k: "pie hotkey", h: "hidden", d: "dock", a: "alignment", p: "position", v: "visibility", ht: "hint", bW: "button width", co: "columns", sp: "spacing", s: "scale", fS: "font scale", rA: "reveal area", e: "edit mode", cT: "click-through", l: "lock", nB: "background", c: "condition set"};
const SH_WORDS = {t: "type", c: "command", k: "hotkey", kP: "key passthrough", m: "mode", cl: "color", clA: "color animation", iZ: "icon zoom", iO: "icon offset", iR: "icon rotation", cdA: "cooldown action", cdS: "cooldown style", cW: "category width", cSO: "stay open", cC: "category columns", cSp: "category spacing", cS: "category scale", cF: "category font scale", cNB: "category background", cH: "hover open", cHC: "close on hover out", _i: "selected item"};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Pairs two lists: exact name matches first (in order), then what's left by position
function pairLists(olds, news, name){
  const pairs = [], usedO = new Set(), usedN = new Set();
  news.forEach((n, j) => { const i = olds.findIndex((o, k) => !usedO.has(k) && name(o) === name(n)); if (i >= 0) { usedO.add(i); usedN.add(j); pairs.push([olds[i], n, i, j]); } });
  const restO = olds.map((o, i) => i).filter(i => !usedO.has(i)), restN = news.map((n, j) => j).filter(j => !usedN.has(j));
  while (restO.length && restN.length) { const i = restO.shift(), j = restN.shift(); pairs.push([olds[i], news[j], i, j]); }
  return {pairs, removed: restO.map(i => [olds[i], i]), added: restN.map(j => [news[j], j])};
}
function shFieldChanges(o, n){
  const out = [], po = parseName(o.n), pn = parseName(n.n);
  if (po.label !== pn.label) out.push(`label "${po.label}" → "${pn.label}"`);
  if (po.icon !== pn.icon || po.hasIcon !== pn.hasIcon || po.args !== pn.args) out.push(pn.hasIcon ? (po.hasIcon ? "icon" : "icon added") : "icon removed");
  if (po.tooltip !== pn.tooltip || po.hasTooltip !== pn.hasTooltip) out.push("tooltip");
  for (const k of Object.keys(SH_WORDS)) if (!same(o[k], n[k])) out.push(k === "k" ? `hotkey ${o.k ? hotkeyName(o.k) : "none"} → ${n.k ? hotkeyName(n.k) : "none"}` : SH_WORDS[k]);
  return out;
}
function barFieldChanges(o, n, oldSets){
  const out = [], pos = ["d", "a", "p"].some(k => !same(o[k], n[k]));
  if (pos) out.push("moved");
  for (const k of Object.keys(BAR_WORDS)) {
    if (["d", "a", "p"].includes(k) || same(o[k], n[k])) continue;
    if (k === "n") out.push(`renamed from "${o.n}"`);
    else if (k === "c") out.push(`condition set ${o.c < 0 ? "none" : `"${oldSets[o.c]?.n || "#" + (o.c + 1)}"`} → ${n.c < 0 ? "none" : `"${S.doc.CndSetCfgs[n.c]?.n || "#" + (n.c + 1)}"`}`);
    else if (k === "h") out.push(n.h ? "hidden" : "shown");
    else if (k === "k") out.push(`pie hotkey ${o.k ? hotkeyName(o.k) : "none"} → ${n.k ? hotkeyName(n.k) : "none"}`);
    else out.push(BAR_WORDS[k]);
  }
  return out;
}
// Every change as {kind: add|remove|change, area, name, where, what, revert?}
function reviewChanges(){
  const base = parseConfig(S.savedText || S.originalText), cur = S.doc, out = [];
  const shName = sh => sh.n;
  const walk = (olds, news, bar, where, parentNew) => {
    const {pairs, removed, added} = pairLists(olds || [], news || [], shName);
    for (const [sh, i] of removed) out.push({kind: "remove", area: "Shortcuts", name: displayName(sh) || parseName(sh.n).tooltip || "(icon only)", where, revert: parentNew ? () => parentNew.splice(Math.min(i, parentNew.length), 0, structuredClone(sh)) : null});
    for (const [sh] of added) out.push({kind: "add", area: "Shortcuts", name: displayName(sh) || parseName(sh.n).tooltip || "(icon only)", where, go: () => goTo(sh), revert: () => { const l = parentNew; const k = l.indexOf(sh); if (k >= 0) l.splice(k, 1); }});
    for (const [o, n] of pairs) {
      const what = shFieldChanges(o, n);
      if (what.length) out.push({kind: "change", area: "Shortcuts", name: displayName(n) || parseName(n.n).tooltip || "(icon only)", where, what, go: () => goTo(n), revert: () => { for (const k of Object.keys(o)) if (k !== "sL") n[k] = structuredClone(o[k]); }});
      if (o.sL || n.sL) walk(o.sL, n.sL, bar, where + " › " + (displayName(n) || "(category)"), n.sL);
    }
    // Same shortcuts in a new order
    if (!removed.length && !added.length && pairs.some(([, , i, j]) => i !== j)) out.push({kind: "change", area: "Shortcuts", name: "Order", where, what: ["reordered"]});
  };
  const bars = pairLists(base.BarCfgs, cur.BarCfgs, b => b.n);
  for (const [b, i] of bars.removed) out.push({kind: "remove", area: "Bars", name: b.n || "(unnamed bar)", what: [`${(b.sL || []).length} shortcuts`], revert: () => cur.BarCfgs.splice(Math.min(i, cur.BarCfgs.length), 0, structuredClone(b))});
  for (const [b] of bars.added) out.push({kind: "add", area: "Bars", name: b.n || "(unnamed bar)", what: [`${(b.sL || []).length} shortcuts`], go: () => goTo(b), revert: () => cur.BarCfgs.splice(cur.BarCfgs.indexOf(b), 1)});
  for (const [o, n] of bars.pairs) {
    const what = barFieldChanges(o, n, base.CndSetCfgs);
    if (what.length) out.push({kind: "change", area: "Bars", name: n.n || "(unnamed bar)", what, go: () => goTo(n), revert: () => { for (const k of Object.keys(o)) if (k !== "sL") n[k] = structuredClone(o[k]); }});
    walk(o.sL, n.sL, n, n.n || "(bar)", n.sL);
  }
  if (!bars.removed.length && !bars.added.length && bars.pairs.some(([, , i, j]) => i !== j)) out.push({kind: "change", area: "Bars", name: "Bar order", what: ["reordered"]});
  // Condition sets: adding or removing renumbers references, so those are left to undo
  const sets = pairLists(base.CndSetCfgs, cur.CndSetCfgs, s => s.n);
  const openSet = s => () => { S.selSet = cur.CndSetCfgs.indexOf(s); S.view = "conds"; render(); };
  for (const [s] of sets.removed) out.push({kind: "remove", area: "Condition sets", name: s.n || "(unnamed)"});
  for (const [s] of sets.added) out.push({kind: "add", area: "Condition sets", name: s.n || "(unnamed)", go: openSet(s)});
  for (const [o, n] of sets.pairs) {
    const what = [];
    if (o.n !== n.n) what.push(`renamed from "${o.n}"`);
    if (!same(o.c, n.c)) what.push(o.c.length === n.c.length ? "conditions edited" : `${o.c.length} → ${n.c.length} conditions`);
    if (what.length) out.push({kind: "change", area: "Condition sets", name: n.n || "(unnamed)", what, go: openSet(n), revert: sets.removed.length || sets.added.length ? null : () => { n.n = o.n; n.c = structuredClone(o.c); }});
  }
  if (!sets.removed.length && !sets.added.length && sets.pairs.some(([, , i, j]) => i !== j)) out.push({kind: "change", area: "Condition sets", name: "Order", what: ["reordered"]});
  for (const k of Object.keys(cur)) if (!["$type", "BarCfgs", "CndSetCfgs"].includes(k) && !same(base[k], cur[k])) out.push({kind: "change", area: "Plugin settings", name: k.replace(/([a-z])([A-Z])/g, "$1 $2"), what: [`${JSON.stringify(base[k])} → ${JSON.stringify(cur[k])}`], revert: () => { cur[k] = structuredClone(base[k]); }});
  return out;
}
// The review list; reverting an item is one undo step and redraws the list
function reviewBody(host, onEmpty){
  const paint = () => {
    const ch = reviewChanges();
    if (!ch.length) { host.replaceChildren(h("div", {class: "dim"}, "Nothing has changed since the last save.")); onEmpty?.(); return; }
    const areas = ["Bars", "Shortcuts", "Condition sets", "Plugin settings"].map(a => [a, ch.filter(c => c.area === a)]).filter(([, l]) => l.length);
    const sign = {add: ["+", "added"], remove: ["−", "removed"], change: ["~", "changed"]};
    const count = k => ch.filter(c => c.kind === k).length;
    host.replaceChildren(
      h("div", {class: "inline", style: {gap: "6px", marginBottom: "12px"}}, ...["change", "add", "remove"].filter(count).map(k => h("span", {class: "chip rv-" + k}, `${count(k)} ${sign[k][1]}`))),
      ...areas.map(([area, list]) => h("div", {class: "rv-area"}, h("div", {class: "flabel", style: {margin: "10px 0 6px"}}, area),
        h("div", {class: "src-probs"}, list.map(c => h("div", {class: "rv-row"},
          h("span", {class: "rv-sign rv-" + c.kind, tip: sign[c.kind][1]}, sign[c.kind][0]),
          h("div", {style: {minWidth: 0}}, h("div", {class: "src-prob-name"}, c.name, c.what?.length ? h("span", {class: "dim", style: {fontWeight: 400}}, "  " + c.what.join(", ")) : null), c.where ? h("div", {class: "faint", style: {fontSize: "11.5px"}}, c.where) : null),
          c.revert ? h("button", {class: "btn sm ghost", tip: "Put this back the way it was saved (Ctrl+Z to redo it)", onclick: () => { commit(); c.revert(); reindex(); markDirty(); render(); fsRefresh(true); paint(); }}, "Revert") : h("span"),
          c.go ? h("button", {class: "btn sm ghost", onclick: () => { host.closest(".modal")?.querySelector(".m-ft button")?.click(); c.go(); }}, "Show me") : h("span")))))));
  };
  paint();
}
async function reviewBeforeSave(){
  const body = h("div", {class: "rv"});
  let empty = false;
  reviewBody(body, () => empty = true);
  if (empty) return true;
  const ask = toggle(store("reviewSave") !== "0", v => store("reviewSave", v ? "1" : "0"), "Review before every save");
  return await modal({title: "Review changes", wide: true, body: h("div", null,
    h("div", {class: "help", style: {marginTop: 0, marginBottom: "12px"}}, `What will change in ${S.fileName} compared with ${S.savedText && S.savedText !== S.originalText ? "your last save" : "the file as it was read"}. Revert anything you didn't mean to change.`),
    body, h("div", {style: {marginTop: "14px"}}, ask)),
    buttons: [["Cancel", false], [S.handle || S.dir || S.savedDir ? "Save" : "Download", true, "primary"]]});
}
function reviewModal(){
  const body = h("div", {class: "rv"});
  reviewBody(body);
  modal({title: "Changes since the last save", wide: true, body});
}
async function save(){
  if (!S.doc) return;
  if (store("reviewSave") !== "0" && !(await reviewBeforeSave())) return;
  const text = serialize(S.doc);
  // Resumed session in Chrome with a remembered folder: write back to the real file instead of downloading
  if (!S.handle && (S.dir || S.savedDir)) {
    try {
      const dir = S.dir || S.savedDir;
      if ((await dir.queryPermission({mode: "readwrite"})) === "granted" || (await dir.requestPermission({mode: "readwrite"})) === "granted") { const {qol} = await findConfigs(dir); if (qol) { S.handle = qol; S.dir = dir; } }
    } catch {}
  }
  if (!S.handle) {
    download(/\.json$/i.test(S.fileName) && !/readable/i.test(S.fileName) ? S.fileName : "QoLBar.json", text);
    S.savedText = text; S.dirty = false; renderHeaderState(); schedulePersist();
    if (!store("dlTip")) { store("dlTip", "1"); downloadTip(); }
    else toast(`Downloaded. Put it at ${XIV_PATH}\\pluginConfigs\\QoLBar.json`);
    return;
  }
  try {
    if ((await S.handle.queryPermission?.({mode: "readwrite"})) !== "granted" && (await S.handle.requestPermission?.({mode: "readwrite"})) !== "granted") return toast("Write permission was not granted", "err");
    const f = await S.handle.getFile();
    if (S.loadedMtime && f.lastModified !== S.loadedMtime) {
      const ok = await confirmBox("File changed on disk", h("div", null,
        h("p", null, "QoLBar.json was modified after you opened it (the game probably saved it)."),
        h("p", null, "Saving overwrites those changes with what you see here. If the game is still running with QoLBar enabled, it may overwrite your edits again the next time it saves.")), "Overwrite", "danger");
      if (!ok) return;
    }
    const w = await S.handle.createWritable(); await w.write(text); await w.close();
    S.loadedMtime = (await S.handle.getFile()).lastModified;
    S.originalText = S.savedText = text; S.readAt = Date.now(); S.changedOnDisk = 0; renderBanner();
    S.dirty = false; renderHeaderState(); schedulePersist(); toast("Saved " + S.fileName);
  } catch (e) {
    // The browser wouldn't write the file (permission refused, protected folder...): download it instead
    S.handle = null;
    download("QoLBar.json", text);
    S.savedText = text; S.dirty = false; renderHeaderState(); schedulePersist();
    toast(`Couldn't write the file directly (${e.message}), so it was downloaded instead.`, "warn");
  }
}
// Shown once: Firefox (and any browser without file access) can only download, so explain how to land it in place
function downloadTip(){
  const ff = /firefox/i.test(navigator.userAgent);
  modal({title: "Saved as a download", body: h("div", null,
    h("p", null, "Browsers aren't allowed to write into AppData, where XIVLauncher keeps QoLBar.json, so the edited file was downloaded. To put it in place without copying by hand:"),
    ff ? h("ol", {class: "steps"},
      h("li", null, "Firefox Settings > General > Files and Applications > Downloads: turn on ", h("b", null, "Always ask you where to save files"), "."),
      h("li", null, "Next time you save here, go to this folder and overwrite QoLBar.json:", pathLine(`${XIV_PATH}\\pluginConfigs`)))
      : h("ol", {class: "steps"},
        h("li", null, "Browser Settings > Downloads: turn on ", h("b", null, "Ask where to save each file before downloading"), "."),
        h("li", null, "Next time you save here, go to this folder and overwrite QoLBar.json:", pathLine(`${XIV_PATH}\\pluginConfigs`))),
    h("p", {class: "help"}, "Disable QoLBar in /xlplugins (or close the game) before replacing the file, or the plugin may overwrite it.")),
    buttons: [["Got it", true, "primary"]]});
}
