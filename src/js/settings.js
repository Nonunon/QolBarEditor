// SPDX-License-Identifier: AGPL-3.0-or-later
// Settings: config check, data sources, appearance and plugin options.
"use strict";

/* ---------- settings ---------- */
function renderSettings(){
  const d = S.doc;
  const nice = k => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace("G Pose", "GPose").replace("Game UIOff", "Game UI Off").replace("HRIcons", "HR Icons");
  const g = h("div", {class: "grid", style: {gridTemplateColumns: "230px 1fr", alignItems: "start"}});
  for (const k of Object.keys(d).filter(k => !["$type", "BarCfgs", "CndSetCfgs"].includes(k))) {
    const v = d[k];
    let ctl;
    if (typeof v === "boolean") ctl = toggle(v, x => { commit(); d[k] = x; touch(); });
    else if (typeof v === "number" && k !== "Version") ctl = numInput(v, x => { d[k] = x; touch(); }, {float: k === "FontSize", step: k === "FontSize" ? .5 : 1});
    else ctl = h("span", {class: "mono dim"}, JSON.stringify(v));
    g.append(h("label", {class: "flabel", style: {paddingTop: "3px"}}, nice(k)), h("div", null, ctl, GLOBAL_HELP[k] ? h("div", {class: "help"}, GLOBAL_HELP[k]) : null));
  }
  return h("div", {class: "insp"}, healthCard(), sourcesCard(), appearanceCard(), h("div", {class: "insp-hd", style: {marginTop: "26px"}}, h("h2", null, "Plugin settings")), h("div", {class: "card"}, g));
}
// Opens dalamudConfig.json with the plain file picker (it works inside AppData, unlike the folder picker)
function pickDalamudConfig(done){
  const pick = h("input", {type: "file", accept: ".json,application/json", hidden: true});
  pick.addEventListener("change", async () => {
    const f = pick.files[0]; pick.remove(); if (!f) return;
    try { const p = profileFromDalamudConfig(await f.text()); setProfile(p); toast(`Using your Dalamud style "${p.styleName}" at UI scale ${p.ui}` + (p.plugins ? `, ${p.plugins.length} installed plugins listed` : "")); done?.(); }
    catch (e) { toast(e.message, "err"); }
  });
  document.body.append(pick); pick.click();
}
// Shortcuts whose icon can't be drawn: custom images that aren't loaded, and game icons xivapi doesn't have
function iconProblems(kind){
  const out = [];
  allShortcuts(S.doc).forEach(([sh, ctx]) => {
    const p = parseName(sh.n); if (!p.hasIcon || !p.icon) return;
    const bad = kind === "custom" ? p.icon < 0 && !CUSTOM_ICONS.has(-p.icon) : p.icon > 0 && ICON_STATS.fail.has(p.icon);
    if (bad) out.push({sh, bar: ctx.bar, id: p.icon, tip: p.tooltip, hidden: !!ctx.bar.h});
  });
  return out;
}
// Game icons only report failure once something draws them; this loads every one the config uses
function probeIcon(id){
  if (ICON_STATS.ok.has(id) || ICON_STATS.fail.has(id)) return Promise.resolve();
  return new Promise(res => {
    const urls = iconUrls(id, true); let at = 0;
    if (!urls.length) { ICON_STATS.fail.add(id); return res(); }
    const img = new Image();
    img.onload = () => { ICON_STATS.ok.add(id); res(); };
    img.onerror = () => { if (++at < urls.length) img.src = urls[at]; else { ICON_STATS.fail.add(id); res(); } };
    img.src = urls[0];
  });
}
const SRC_OPEN = new Set(); // which problem lists are expanded
// "Show the 3 shortcuts" and the list it opens: each item is {code, name, where, hidden, go}
function problemList(key, items, one, many){
  if (!items.length) return null;
  const label = `the ${items.length} ${items.length === 1 ? one : many}`;
  let open = SRC_OPEN.has(key);
  const list = h("div", {class: "src-probs", style: {display: open ? "" : "none"}}, items.map(p => h("div", {class: "src-prob"},
    h("span", {class: "mono", style: {color: p.hidden ? "var(--faint)" : "var(--accent)"}}, p.code || ""),
    h("div", {style: {minWidth: 0}},
      h("div", {class: "src-prob-name"}, p.name),
      p.where ? h("div", {class: "faint", style: {fontSize: "11.5px"}}, p.where) : null),
    p.hidden ? h("span", {class: "chip plain", tip: "This bar is hidden, so it doesn't show in game"}, "hidden bar") : h("span"),
    p.go ? h("button", {class: "btn sm ghost", onclick: p.go}, "Show me") : h("span"))));
  const text = document.createTextNode(""), chev = svg(ICONS.chev, 10);
  const paint = () => { text.textContent = (open ? "Hide " : "Show ") + label; chev.style.transform = open ? "rotate(90deg)" : ""; list.style.display = open ? "" : "none"; };
  const btn = h("button", {class: "src-more", onclick: () => { open = !open; open ? SRC_OPEN.add(key) : SRC_OPEN.delete(key); paint(); }}, text, chev);
  paint();
  return h("div", null, btn, list);
}
// One row for custom or game icons: a warning only when a bar that can show has the problem
function iconRow(kind, used){
  const probs = iconProblems(kind), shown = probs.filter(p => !p.hidden), hiddenBars = [...new Set(probs.filter(p => p.hidden).map(p => `"${p.bar.n}"`))];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const hiddenNote = hiddenBars.length ? ` ${shown.length ? "Also" : "Only"} in the hidden bar${hiddenBars.length === 1 ? "" : "s"} ${hiddenBars.join(", ")}${shown.length ? "." : ", so nothing you see in game is affected."}` : "";
  let state, detail, actions;
  if (kind === "custom") {
    state = shown.length ? "warn" : probs.length ? "note" : used.size || CUSTOM_ICONS.size ? "ok" : "off";
    detail = `${plural(CUSTOM_ICONS.size, "image", "images")} loaded. ` + (!used.size ? "This config doesn't use any." : !probs.length ? `All ${used.size} this config uses are found.` : shown.length ? `${plural(shown.length, "shortcut shows", "shortcuts show")} a question mark because the image isn't loaded.` : "") + hiddenNote;
    actions = [h("button", {class: "btn sm", onclick: () => pickCustomIcons(true)}, "Load folder...")];
  } else {
    const checked = [...used].filter(id => ICON_STATS.ok.has(id) || ICON_STATS.fail.has(id)).length;
    state = shown.length ? "warn" : probs.length ? "note" : ICON_STATS.ok.size ? "ok" : "off";
    detail = `This config uses ${plural(used.size, "game icon", "different game icons")}, ${checked === used.size ? "all checked" : `${checked} checked so far`}. ` + (shown.length ? `${plural(shown.length, "shortcut points", "shortcuts point")} at an icon the current game data doesn't have, so it shows its number (in game it's most likely blank).` : !probs.length && checked ? "Every one checked is available." : "") + hiddenNote + " Needs an internet connection.";
    actions = checked < used.size ? [h("button", {class: "btn sm", tip: "Load every icon this config uses now, instead of waiting for a preview to show them", onclick: async e => { e.currentTarget.disabled = true; e.currentTarget.textContent = "Checking..."; await Promise.all([...used].map(probeIcon)); if (S.view === "settings") render(); }}, `Check all ${used.size}`)] : null;
  }
  const extra = problemList(kind, probs.map(p => ({code: String(p.id), name: displayName(p.sh) || p.tip || "(icon only)", where: locationText(p.sh), hidden: p.hidden, go: () => goTo(p.sh)})), "shortcut", "shortcuts");
  return {state, name: kind === "custom" ? "Custom icons" : "Game icons", file: kind === "custom" ? (CUSTOM_ICONS.size ? "pluginConfigs\\QoLBar\\icons" : null) : "xivapi.com",
    detail, feeds: kind === "custom" ? ["Icons with negative IDs"] : ["Icons", "UI sheet icons", "Hotbar frame"], actions, extra, where: kind === "custom" ? PATH.icons : null};
}
/* Config check: things in the file that are broken, clash, or do nothing. Each check lists where the problem is.
   Problems that only exist in hidden bars never raise a warning (they can't show in game). */
function configChecks(){
  const d = S.doc, sets = d.CndSetCfgs, all = allShortcuts(d), out = [];
  const shItem = (sh, ctx, code) => ({code, name: displayName(sh) || parseName(sh.n).tooltip || "(icon only)", where: locationText(sh), hidden: !!ctx.bar.h, go: () => goTo(sh)});
  const barItem = (bar, code) => ({code, name: bar.n || "(unnamed bar)", where: "Bar", hidden: !!bar.h, go: () => goTo(bar)});
  const setItem = (i, code, where) => ({code, name: sets[i]?.n || `Set #${i + 1}`, where: where || `Condition set #${i + 1}`, go: () => { S.selSet = i; S.view = "conds"; render(); }});
  const add = (key, title, level, detail, items, one = "item", many = "items") => out.push({key, title, level, detail, items, one, many});

  // 1. Links to condition sets that don't exist (the plugin treats them as no set)
  const dangling = [];
  d.BarCfgs.forEach(b => { if (b.c >= sets.length) dangling.push(barItem(b, `#${b.c + 1}`)); });
  sets.forEach((s, i) => s.c.forEach(c => { if (c.i === "cs" && (typeof c.a !== "number" || c.a < 0 || c.a >= sets.length)) dangling.push(setItem(i, `#${(+c.a || 0) + 1}`, `Condition set #${i + 1} refers to a set that doesn't exist`)); }));
  add("dangling", "Links to missing condition sets", "warn", "A bar or a Condition Set row points at a set number that isn't in the file.", dangling, "link", "links");

  // 2. Hotkeys that clash (QoLBar Keybind.cs): a shortcut's hotkey only works while its bar is shown (not hidden, set
  // true), and every shortcut with the pressed key fires. A bar's hotkey opens it as a pie while its set is true, even
  // when hidden, and the first such bar in the list wins. A pie key shared with a shortcut is fine (hold vs tap).
  // Two bars surely show together when they're the same bar, share a set, or one has none; other pairs only might.
  const together = (a, b) => a === b || a.c === b.c || a.c < 0 || b.c < 0;
  const clashes = (groups, item) => {
    const warn = [], note = [];
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const sure = g.some((x, i) => g.some((y, j) => i < j && together(x.bar, y.bar)));
      (sure ? warn : note).push(...g.map(item));
    }
    return {warn, note};
  };
  const shKeys = new Map();
  all.forEach(([sh, ctx]) => { if (sh.k && !ctx.bar.h) { if (!shKeys.has(sh.k)) shKeys.set(sh.k, []); shKeys.get(sh.k).push({sh, ctx, bar: ctx.bar}); } });
  const sc = clashes(shKeys, x => shItem(x.sh, x.ctx, hotkeyName(x.sh.k)));
  add("hotkeys", "Shortcut hotkeys used more than once", "warn", "These shortcuts share a key and show at the same time, so one key press runs all of them.", sc.warn, "shortcut", "shortcuts");
  add("hotkeys2", "Shortcut hotkeys shared across condition sets", "note", "These share a key but sit in bars with different condition sets. That's fine (and handy for alternates like Enable / Disable) as long as those bars never show together.", sc.note, "shortcut", "shortcuts");
  const pieKeys = new Map();
  d.BarCfgs.forEach(b => { if (b.k) { if (!pieKeys.has(b.k)) pieKeys.set(b.k, []); pieKeys.get(b.k).push({bar: b}); } });
  const pc = clashes(pieKeys, x => ({...barItem(x.bar, hotkeyName(x.bar.k)), hidden: false}));
  add("pies", "Pie menu hotkeys used more than once", "warn", "Several bars open as a pie on the same key. Only the first one in the list opens.", pc.warn, "bar", "bars");
  add("pies2", "Pie menu hotkeys shared across condition sets", "note", "These bars share a pie key but have different condition sets. When more than one set is true, only the first bar in the list opens.", pc.note, "bar", "bars");

  // 3. Plugin conditions and commands vs what's installed (only when dalamudConfig.json is loaded)
  const inst = PROFILE.plugins ? new Set(PROFILE.plugins.map(x => x[0])) : null;
  if (inst) {
    const notInst = [];
    sets.forEach((s, i) => s.c.forEach(c => { if (c.i === "p" && typeof c.a === "string" && c.a && !inst.has(c.a)) notInst.push(setItem(i, c.a, `Condition set #${i + 1}: ${c.n ? "NOT " : ""}Plugin Enabled`)); }));
    add("plugcond", "Conditions on plugins you don't have", "note", "These check a plugin that isn't installed, so they're always false (or always true when negated). Fine if the config is meant for someone else.", notInst, "condition", "conditions");
    const norm = t => t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const known = new Set([...inst].flatMap(n => [norm(n), norm(COMMON_PLUGINS[n] || n)]));
    const cmds = [];
    all.forEach(([sh, ctx]) => { for (const m of String(sh.c || "").matchAll(/\/xl(?:enable|disable|toggle)plugin\s+"?([^"\n]+?)"?\s*$/gim)) { const k = norm(m[1]); if (![...known].some(x => x === k || k.startsWith(x) || x.startsWith(k))) cmds.push(shItem(sh, ctx, m[1].trim())); } });
    add("plugcmd", "Plugin commands that don't match an installed plugin", "note", "The name after /xlenableplugin or /xldisableplugin must be the plugin's display name. These don't look like any installed plugin; check the spelling in /xlplugins.", cmds, "command", "commands");
  }

  // 4. Things that do nothing
  const unused = sets.map((s, i) => i).filter(i => !d.BarCfgs.some(b => b.c === i) && !sets.some(s => s.c.some(c => c.i === "cs" && c.a === i))).map(i => setItem(i, `#${i + 1}`));
  add("unusedsets", "Condition sets nothing uses", "note", "No bar and no other set refers to these. Safe to keep; they just don't do anything.", unused, "set", "sets");
  const empty = [];
  d.BarCfgs.forEach(b => { if (!(b.sL || []).length) empty.push(barItem(b, "empty")); });
  all.forEach(([sh, ctx]) => { if (sh.t === 1 && !(sh.sL || []).length) empty.push(shItem(sh, ctx, "empty")); });
  add("empty", "Empty bars and categories", "note", "Nothing inside, so they show as a blank bar or open an empty popup.", empty);
  const noCmd = all.filter(([sh]) => sh.t === 0 && !String(sh.c || "").trim()).map(([sh, ctx]) => shItem(sh, ctx, "no command"));
  add("nocmd", "Shortcuts with no command", "note", "Clicking these does nothing. Fine for labels and decoration.", noCmd, "shortcut", "shortcuts");
  return out;
}
function healthCard(){
  const checks = configChecks().filter(c => c.items.length);
  const level = c => c.level === "warn" && c.items.some(x => !x.hidden) ? "warn" : "note";
  const warns = checks.filter(c => level(c) === "warn").length;
  const mark = {warn: ["!", "Needs attention"], note: ["i", "Worth knowing, not necessarily wrong"]};
  return h("div", {class: "card"},
    h("h3", null, "Config check", h("span", {class: "faint", style: {textTransform: "none", letterSpacing: 0, fontWeight: 400}}, !checks.length ? "nothing found" : warns ? `${warns} to look at, ${checks.length - warns} notes` : `${checks.length} note${checks.length === 1 ? "" : "s"}, nothing broken`)),
    !checks.length ? h("div", {class: "inline"}, h("span", {class: "src-st ok"}, "✓"), h("span", {class: "dim"}, "No broken links, clashing hotkeys or leftovers found.")) :
    h("div", {class: "src-grid"}, ...checks.flatMap(c => [
      h("span", {class: "src-st " + level(c), tip: mark[level(c)][1]}, mark[level(c)][0]),
      h("div", {style: {minWidth: 0}}, h("div", {class: "src-name"}, c.title), h("div", {class: "src-detail"}, c.detail + (c.items.every(x => x.hidden) ? " Only in hidden bars." : "")), problemList("chk-" + c.key, c.items, c.one, c.many)),
      h("span")])),
    PROFILE.plugins ? null : h("div", {class: "help", style: {marginTop: "12px"}}, "Load dalamudConfig.json in Data sources to also check plugin conditions and commands against what you have installed."));
}
// "Data sources": every file and service the editor reads, whether it's in use, and what it feeds
function sourcesCard(){
  const P = PROFILE, dal = P.source !== DEFAULT_PROFILE.source;
  const usedIcons = new Set(), usedGame = new Set();
  allShortcuts(S.doc).forEach(([sh]) => { const p = parseName(sh.n); if (p.hasIcon && p.icon < 0) usedIcons.add(-p.icon); else if (p.hasIcon && p.icon > 0) usedGame.add(p.icon); });
  const sess = savedSession();
  const mark = {ok: ["✓", "Loaded and in use"], warn: ["!", "Needs attention"], note: ["i", "Only affects hidden bars"], off: ["·", "Not loaded, defaults used"]};
  const row = ({state, name, file, detail, feeds, actions, extra, where}) => [
    h("span", {class: "src-st " + state, tip: mark[state][1]}, mark[state][0]),
    h("div", {style: {minWidth: 0}},
      h("div", {class: "src-name"}, name, file ? h("span", {class: "code", style: {marginLeft: "8px"}}, file) : null),
      h("div", {class: "src-detail"}, detail),
      where ? pathLine(where) : null,
      feeds?.length ? h("div", {class: "src-feeds"}, h("span", {class: "faint"}, "Used for"), feeds.map(f => h("span", {class: "chip plain"}, f))) : null,
      extra || null),
    h("div", {class: "inline", style: {justifyContent: "flex-end"}}, actions || [])];
  const rows = [
    {state: S.changedOnDisk ? "warn" : "ok", name: "QoLBar config", file: S.fileName,
      detail: `${sourceText()}. ${S.doc.BarCfgs.length} bars, ${allShortcuts(S.doc).length} shortcuts, ${S.doc.CndSetCfgs.length} condition sets, plugin version ${S.doc.PluginVersion || "unknown"}.` + (S.dirty ? " Has unsaved changes." : "") + (S.changedOnDisk ? " The file changed on disk since it was read." : ""),
      feeds: ["Bars", "Shortcuts", "Condition sets", "Plugin settings"], where: PATH.qolbar,
      actions: [h("button", {class: "btn sm", onclick: reloadFromDisk}, "Reload")]},
    {state: S.dir ? "ok" : "off", name: "Connected folder", file: S.dir ? S.dir.name : null,
      detail: S.dir ? "Save writes straight back to QoLBar.json, and Reload reads it again without picking the file." : CAN_FOLDER ? "Not connected. Saving downloads a copy instead of writing the file." : "This browser can't connect folders (Chrome and Edge can). Saving downloads a copy.",
      feeds: S.dir ? ["Save in place", "Reload", "Custom icons"] : null, where: CAN_FOLDER ? XIV_PATH : null},
    {state: dal ? "ok" : "off", name: "Dalamud settings", file: dal ? "dalamudConfig.json" : null,
      detail: dal ? `Style "${P.styleName}", UI scale ${P.ui}` + (P.plugins ? `, ${P.plugins.length} installed plugins (${P.plugins.filter(x => x[1]).length} enabled)` : ", no plugin list in this copy (load it again to add one)") + (P.loadedAt ? `. Read ${timeAgo(P.loadedAt)}.` : ".") + (P.note ? " " + P.note : "")
        : "Not loaded. The preview uses Dalamud Standard style at UI scale 1, and the plugin picker only confirms plugins used in this file.",
      feeds: dal ? ["Window and frame padding", "Colors", "UI scale", ...(P.plugins ? ["Installed plugin list"] : [])] : null, where: PATH.dalamud,
      actions: [h("button", {class: "btn sm", onclick: () => pickDalamudConfig(render)}, dal ? "Load again" : "Load..."), dal ? h("button", {class: "btn sm ghost", onclick: () => { setProfile(structuredClone(DEFAULT_PROFILE)); render(); }}, "Reset") : null]},
    iconRow("custom", usedIcons),
    iconRow("game", usedGame),
    {state: ICON_LIST.source === "yours" ? "ok" : "off", name: "Icon list", file: ICON_LIST.source === "yours" ? "pluginConfigs\\QoLBar\\iconCache.json" : null,
      detail: ICON_LIST.source === "yours" ? `Your game's list of existing icons: ${iconList().size} icons, from ${timeAgo(ICON_LIST.at)}. QoLBar writes it when you open its icon browser (and rebuilds it with the refresh button there).` : `Using the built-in list (${iconList().size} icons, ${ICON_SNAPSHOT_DATE}). Load your own for your exact game version; QoLBar writes it when you open its icon browser.`,
      feeds: ["Icon picker"], where: PATH.iconCache, actions: [h("button", {class: "btn sm", onclick: () => pickIconCache(render)}, ICON_LIST.source === "yours" ? "Load again" : "Load...")]},
    {state: FONT_GEN ? "ok" : "warn", name: "Font", file: "Noto Sans JP",
      detail: FONT_GEN ? "Loaded from Google Fonts. Same family as QoLBar's Noto Sans CJK, so label widths match the game." : "Not loaded (offline or blocked), so a fallback font is used and label widths may be a few pixels off.",
      feeds: ["Label widths", "Button sizes"]},
    {state: PV.bg || PV.ref ? "ok" : "off", name: "Preview backdrop", file: PV.bg ? "your screenshot" : PV.ref ? "ReferenceBackdrop.png" : null,
      detail: PV.bg ? `A screenshot kept in this browser (${pvSize().W} × ${pvSize().H}).` : PV.ref ? "The reference image next to this page." : "No screenshot. The preview draws a plain mock scene.",
      feeds: PV.bg ? ["Preview background", "Preview resolution"] : null, where: PATH.screenshots,
      actions: [h("button", {class: "btn sm", onclick: () => pickScreenshotFile()}, PV.bg ? "Change..." : "Use a screenshot...")]},
    {state: sess || TRICKS.length ? "ok" : "off", name: "Saved in this browser", file: null,
      detail: [sess ? `Session autosave from ${timeAgo(sess.at)}` : "No autosaved session", `${TRICKS.length} trick${TRICKS.length === 1 ? "" : "s"}`, S.savedDir || S.dir ? "the remembered folder" : null, CUSTOM_ICONS.size ? "custom icons" : null].filter(Boolean).join(", ") + ". Stays on this computer and is never uploaded.",
      feeds: ["Resume where you left off", "Tricks"]},
  ];
  return h("div", {class: "card"},
    h("h3", null, "Data sources", h("span", {class: "faint", style: {textTransform: "none", letterSpacing: 0, fontWeight: 400}}, "what the editor is reading, and what each one is used for")),
    h("div", {class: "src-grid"}, ...rows.flatMap(row)),
    h("div", {class: "help", style: {marginTop: "12px"}}, "Everything is read inside your browser. Nothing is uploaded; only icons and the font are downloaded."));
}
