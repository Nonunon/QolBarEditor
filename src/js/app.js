// SPDX-License-Identifier: AGPL-3.0-or-later
// Page shell: render(), the header, theme, landing page and status bar.
"use strict";

/* =====================================================================
   Rendering
   ===================================================================== */
function render(){
  closePop();
  reindex();
  $("#app").replaceChildren(renderHeader(), h("div", {id: "bannerHost"}), S.doc ? renderMain() : renderWelcome(), renderStatus());
  renderHeaderState(); renderBanner();
}
/* ---------- theme (editor chrome only) ---------- */
const THEMES = [["system", "Match system", "Follows your computer's light or dark setting"], ["light", "Light", ""], ["dark", "Dark", ""]];
const LIGHT_MQ = matchMedia("(prefers-color-scheme: light)");
const themePref = () => ["system", "light", "dark"].includes(store("theme")) ? store("theme") : "system";
function applyTheme(){ const p = themePref(); document.documentElement.dataset.theme = p === "system" ? (LIGHT_MQ.matches ? "light" : "dark") : p; }
function setTheme(p){ store("theme", p); applyTheme(); if (S.view === "settings") render(); }
LIGHT_MQ.addEventListener("change", () => { if (themePref() === "system") applyTheme(); });
applyTheme();
function helpMenu(e){
  const r = e.currentTarget.getBoundingClientRect(), cur = themePref();
  showMenu(r.right - 220, r.bottom + 6, [
    {label: "Keyboard shortcuts", hint: "?", act: keySheet},
    ...(S.doc ? [{label: "Take the tour", act: startTour}] : []),
    "-",
    ...THEMES.map(([v, label]) => ({label: `Theme: ${label}`, hint: v === cur ? "✓" : "", act: () => setTheme(v)})),
  ]);
}
function appearanceCard(){
  return h("div", {class: "card"}, h("h3", null, "Appearance"),
    h("div", {class: "grid"},
      ...field("Theme", seg(themePref(), THEMES, setTheme), "Colors of the editor itself. The game preview always keeps the game's own colors and your Dalamud style.")));
}
function renderHeader(){
  const tab = (id, label) => h("button", {class: "tab" + (S.view === id ? " on" : ""), onclick: () => { S.view = id; render(); }}, ...[].concat(label));
  return h("div", {class: "hdr"},
    h("div", {class: "brand"}, h("div", {class: "logo", tip: S.doc ? `QoLBar Editor · ${S.fileName}` : "QoLBar Editor"}, "Q"), h("div", {class: "brand-text"}, "QoLBar Editor", h("small", null, S.doc ? (S.fileName + (S.dir ? `  ·  ${S.dir.name} folder` : "")) : "no file loaded"))),
    S.doc ? h("div", {class: "tabs"}, tab("bars", "Bars"), tab("table", "Table"), tab("conds", "Conditions"), tab("tricks", "Tricks"), tab("settings", ["Settings", configChecks().some(c => c.level === "warn" && c.items.some(x => !x.hidden)) ? h("span", {class: "tab-dot", tip: "The config check found something to look at"}) : null])) : null,
    h("div", {class: "spacer"}),
    S.doc ? [
      h("button", {class: "btn icon ghost", id: "undoBtn", tip: "Undo (Ctrl+Z)", onclick: undo}, svg(ICONS.undo, 15)),
      h("button", {class: "btn icon ghost", id: "redoBtn", tip: "Redo (Ctrl+Y)", onclick: redo}, svg(ICONS.redo, 15)),
      h("button", {class: "btn", tip: "Show or hide the screen preview panel", onclick: () => { PV.open = !PV.open; store("pv.open", PV.open ? "1" : "0"); render(); }}, PV.open ? [h("span", {class: "mid-only"}, "Hide preview"), h("span", {class: "narrow-only"}, "Preview")] : "Preview"),
      h("button", {class: "btn", tip: "Interactive fullscreen preview (F)", onclick: openFullscreen}, "Fullscreen"),
      h("button", {class: "btn", onclick: moreMenu}, "Import / Export ", h("span", {class: "faint", style: {fontSize: "9px"}}, "▼")),
    ] : null,
    S.doc ? h("button", {class: "btn", onclick: reloadFromDisk, tip: S.handle || S.dir || S.savedDir ? "Read QoLBar.json again from disk, keeping your place" : "Pick QoLBar.json again to get the current version from disk (this browser can't reopen it by itself)"}, "Reload", h("span", {class: "wide-only"}, " from disk")) : null,
    h("button", {class: "btn icon ghost", tip: "Keyboard shortcuts, tour and theme", onclick: helpMenu, style: {fontWeight: 700, width: "30px"}}, "?"),
    h("button", {class: "btn", onclick: openFile}, "Open"),
    S.doc ? h("button", {class: "btn primary", onclick: save, tip: S.handle ? "Write straight back to the file (Ctrl+S)" : "Download the edited QoLBar.json (Ctrl+S)"}, h("span", {class: "dirty-dot", id: "dirtyDot"}), S.handle ? "Save" : "Download") : null
  );
}
function renderHeaderState(){
  const d = $("#dirtyDot"); if (d) d.style.display = S.dirty ? "" : "none";
  const u = $("#undoBtn"), r = $("#redoBtn"); if (u) u.disabled = !S.undo.length; if (r) r.disabled = !S.redo.length;
  document.title = (S.dirty ? "* " : "") + "QoLBar Editor";
  const st = $("#statusDirty"); if (st) { st.textContent = S.dirty ? "Unsaved changes" : (S.doc ? "No unsaved changes" : ""); st.style.color = S.dirty ? "var(--accent)" : ""; st.style.cursor = S.dirty ? "pointer" : ""; st.dataset.tip = S.dirty ? "See what changed since the last save" : ""; st.onclick = S.dirty ? reviewModal : null; }
}
function renderStatus(){
  return h("div", {class: "status"},
    S.doc ? [h("span", {id: "srcInfo"}, sourceText()), h("span", null, `${S.doc.BarCfgs.length} bars`), h("span", null, `${allShortcuts(S.doc).length} shortcuts`), h("span", null, `${S.doc.CndSetCfgs.length} condition sets`), h("span", null, `QoLBar ${S.doc.PluginVersion || "?"}`), h("span", {id: "statusDirty"})]
      : h("span", null, "Open or drop your files to start. They stay in this browser."),
    h("span", {class: "spacer"}),
    h("span", {class: "faint status-hints"}, "Right-click for actions · Ctrl+Z undo · Ctrl+S save · Del delete · Ctrl+D duplicate · Ctrl+V import"),
    creditLink(), sourceLink());
}
// Credit for the plugin this edits. Lives in the status bar (and start screen), so it stays out of fullscreen.
function creditLink(){
  return h("a", {class: "credit", href: "https://github.com/UnknownX7/QoLBar", target: "_blank", rel: "noopener noreferrer",
    tip: "This editor is an unofficial fan tool. It is not affiliated with or endorsed by UnknownX7, the Dalamud team or Square Enix.\nFINAL FANTASY XIV © SQUARE ENIX. Game icons are loaded from xivapi.com."},
    "Unofficial editor for QoLBar by UnknownX7");
}
const SOURCE_URL = "https://github.com/Nonunon/QolBarEditor";
const sourceLink = () => h("a", {class: "credit", href: SOURCE_URL, target: "_blank", rel: "noopener noreferrer", tip: "This editor's source code, free under the AGPL-3.0 license"}, "Source");
// Where the loaded config came from, shown in the status bar
function sourceText(){
  if (!S.doc) return "";
  if (S.handle) return `Live file${S.dir ? " (connected folder)" : ""} · read ${timeAgo(S.readAt)}`;
  if (S.resumedAt) return `Resumed session · read from disk ${timeAgo(S.readAt)}`;
  return `Opened copy · read ${timeAgo(S.readAt)}`;
}
setInterval(() => { const e = $("#srcInfo"); if (e) e.textContent = sourceText(); if (S.changedOnDisk) renderBanner(); }, 30000);

// Where things live. Windows file pickers expand %AppData% typed or pasted into their address bar.
const PATH = {
  qolbar: `${XIV_PATH}\\pluginConfigs\\QoLBar.json`,
  dalamud: `${XIV_PATH}\\dalamudConfig.json`,
  icons: `${XIV_PATH}\\pluginConfigs\\QoLBar\\icons`,
  iconCache: `${XIV_PATH}\\pluginConfigs\\QoLBar\\iconCache.json`,
  plugins: `${XIV_PATH}\\installedPlugins`,
  screenshots: "%UserProfile%\\Documents\\My Games\\FINAL FANTASY XIV - A Realm Reborn\\screenshots",
};
// Clipboard copy with the older selection-based fallback, for browsers or frames that block the clipboard API
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = h("textarea", {style: {position: "fixed", opacity: 0, left: "-9999px"}}); ta.value = text;
  document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {}
  ta.remove(); return ok;
}
function pickScreenshotFile(){
  const pick = h("input", {type: "file", accept: "image/*", hidden: true});
  pick.addEventListener("change", async () => { const f = pick.files[0]; pick.remove(); if (f && await useScreenshot(f)) render(); });
  document.body.append(pick); pick.click();
}
// A file's full path, with a button that copies the folder it's in: paste that into the picker's address bar,
// press Enter, and the file is right there. For a folder, the button copies the folder itself.
function pathLine(path, {center = false} = {}){
  const isFile = /\.[a-z0-9]+$/i.test(path), folder = isFile ? path.replace(/\\[^\\]+$/, "") : path, file = path.split("\\").pop();
  const how = `Paste it into the file picker's address bar (Ctrl+V, then Enter)${isFile ? `, then pick ${file}` : ""}.`;
  return h("div", {class: "pathline" + (center ? " center" : "")},
    h("span", {class: "code", tip: path}, path),
    h("button", {class: "btn sm", tip: `Copies ${folder}. ${how}`, onclick: async () => { const ok = await copyText(folder); toast(ok ? `Copied ${isFile ? "the folder" : "the path"}. ${how}` : "Couldn't reach the clipboard. Select the path and copy it by hand.", ok ? "" : "warn"); }}, svg(ICONS.copy), isFile ? "Copy folder" : "Copy path"));
}
function renderWelcome(){
  const sess = savedSession();
  const cards = [];
  // Folder connection only works for launcher folders outside AppData: Chrome blocks AppData for websites
  const folderCard = CAN_FOLDER ? h("div", {class: "wcard"},
    h("div", {class: "wcard-hd"}, h("b", null, "Connect a launcher folder"), h("span", {class: "chip plain"}, "advanced")),
    h("div", {class: "dim"}, "Pick a folder containing ", h("span", {class: "code"}, "pluginConfigs\\QoLBar.json"), " and the editor reads it and your Dalamud style itself, saves straight back, and notices when the game rewrites the file."),
    h("div", {class: "help", style: {color: "var(--accent)"}}, "This browser blocks folders inside AppData (\"contains system files\"), which is where XIVLauncher normally lives. It only works if your launcher keeps its files somewhere else, for example one started with --roamingPath. Otherwise use Open files above."),
    h("div", {class: "inline", style: {marginTop: "12px"}},
      S.savedDir ? h("button", {class: "btn primary", onclick: () => connectFolder(S.savedDir)}, `Reconnect "${S.savedDir.name}"`) : null,
      h("button", {class: "btn", onclick: () => connectFolder()}, S.savedDir ? "Pick a different folder" : "Connect folder..."),
      S.savedDir ? h("button", {class: "btn ghost sm", onclick: forgetFolder}, "Forget folder") : null),
    S.savedDir ? h("div", {class: "help"}, "The browser asks once per visit before the page can use the folder again.") : null) : null;
  if (sess) cards.push(h("div", {class: "wcard"},
    h("div", {class: "wcard-hd"}, h("b", null, "Resume last session"), sess.dirty ? h("span", {class: "chip cond"}, "unsaved changes") : null),
    h("div", {class: "dim"}, `${sess.name}, read from disk ${timeAgo(sess.readAt)}, last edited here ${timeAgo(sess.at)}.`),
    h("div", {class: "help"}, "This is the copy kept in the browser. If the game has changed the file since, use Reload from disk after resuming."),
    h("div", {class: "inline", style: {marginTop: "10px"}},
      h("button", {class: "btn primary", onclick: resumeSession}, "Resume"),
      h("button", {class: "btn ghost sm", onclick: discardSession}, "Discard"))));
  const drop = h("div", {class: "drop"},
    h("div", {style: {fontSize: "17px", fontWeight: 600}}, "Drop QoLBar.json here"),
    h("div", {class: "dim", style: {margin: "4px 0 14px"}}, "Add dalamudConfig.json too (drop or pick both at once) so the preview matches your Dalamud style."),
    h("button", {class: sess ? "btn" : "btn primary", onclick: openFile}, "Open files..."),
    h("div", {class: "paths"},
      h("div", {class: "paths-row"}, h("span", {class: "faint"}, "QoLBar.json"), pathLine(PATH.qolbar)),
      h("div", {class: "paths-row"}, h("span", {class: "faint"}, "dalamudConfig.json"), pathLine(PATH.dalamud))),
    h("div", {class: "help", style: {marginTop: "12px"}}, "Copy folder, click Open files..., paste into the picker's address bar and press Enter: the file is right there. Saving downloads the edited file, since browsers can't write into AppData; your work is kept between visits, so next time you can just Resume."));
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove("over"); loadDropped(e.dataTransfer); });
  return h("div", {class: "main", style: {overflow: "auto", display: "block"}}, h("div", {class: "welcome"},
    h("h1", null, "QoLBar Editor"),
    h("div", {class: "dim"}, "Read and edit your QoLBar bars, shortcuts and condition sets outside the game. Every cryptic key (", h("span", {class: "code"}, "cSO"), ", ", h("span", {class: "code"}, "clA"), ", ", h("span", {class: "code"}, "k: 131154"), "...) becomes a plain control, and saving writes the exact format the plugin expects."),
    ...cards,
    drop,
    folderCard,
    h("div", {class: "warnbox"}, h("b", null, "Before saving back to the live file: "), "QoLBar keeps its config in memory and rewrites the file whenever you change anything in game, which would wipe out edits made here.",
      h("ol", {class: "steps"}, h("li", null, "Close the game, or disable QoLBar in ", h("span", {class: "code"}, "/xlplugins"), " first."), h("li", null, "Open, edit and Save here."), h("li", null, "Start the game or re-enable QoLBar.")),
      h("div", {class: "help"}, "No-restart alternative: select a bar or shortcut here, click Copy import string, then paste it with QoLBar's own Import in game.")),
    h("div", {class: "help", style: {marginTop: "22px", textAlign: "center"}},
      "An unofficial editor for ", h("a", {href: "https://github.com/UnknownX7/QoLBar", target: "_blank", rel: "noopener noreferrer", style: {color: "var(--accent)"}}, "QoLBar"),
      " by UnknownX7. Not affiliated with the plugin's author, the Dalamud team or Square Enix. Your files never leave this browser.",
      h("div", {style: {marginTop: "6px"}}, h("a", {href: SOURCE_URL, target: "_blank", rel: "noopener noreferrer", style: {color: "var(--accent)"}}, "Source on GitHub"), " · free under the AGPL-3.0 license"))
  ));
}
function renderMain(){
  const content = renderMainContent();
  if (!PV.open || S.view === "settings") return content;
  return h("div", {class: "main"}, content, renderPreviewPanel());
}
function renderMainContent(){
  if (S.view === "table") return h("div", {class: "main", style: {flexDirection: "column"}}, h("div", {id: "bulkHost"}, renderBulkBar()), h("div", {class: "right", id: "tableHost"}, renderTable()));
  if (S.view === "conds") return h("div", {class: "main"}, renderConditions());
  if (S.view === "settings") return h("div", {class: "main"}, h("div", {class: "right"}, renderSettings()));
  if (S.view === "tricks") return h("div", {class: "main"}, h("div", {class: "right"}, renderTricks()));
  const search = h("input", {class: "txt", placeholder: "Filter names, tooltips, commands, hotkeys...", value: S.query});
  search.addEventListener("input", () => { S.query = search.value; renderTree(); });
  const left = h("div", {class: "left"},
    h("div", {class: "toolbar"},
      h("div", {class: "search"}, search),
      h("button", {class: "btn sm", onclick: addBar, tip: "Add a new bar"}, svg(ICONS.plus), "Bar"),
      h("button", {class: "btn sm", tip: "Bring bars or shortcuts in from another QoLBar.json or an import string", onclick: e => importMenu(e.currentTarget)}, "Import"),
      h("button", {class: "btn sm ghost", tip: "Expand all", onclick: () => { for (const [o, m] of IDX) if (m.kind === "bar" || o.sL?.length) S.expanded.add(o); renderTree(); }}, svg(ICONS.down)),
      h("button", {class: "btn sm ghost", tip: "Collapse all", onclick: () => { S.expanded.clear(); renderTree(); }}, svg(ICONS.up))),
    h("div", {id: "bulkHost"}),
    withCtx(h("div", {class: "tree", id: "tree"}), treeMenu));
  const main = h("div", {class: "main"}, left, h("div", {class: "right", id: "insp"}));
  queueMicrotask(() => { renderTree(); renderInspector(); });
  return main;
}
