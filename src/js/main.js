// SPDX-License-Identifier: AGPL-3.0-or-later
// Keyboard shortcuts, drag and drop, and startup. Loaded last.
"use strict";

/* ---------- keyboard / global drop ---------- */
document.addEventListener("keydown", e => {
  if (!S.doc || FS) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === "s") { e.preventDefault(); save(); return; }
  if (e.target.closest?.("input,textarea,.hk") || document.querySelector(".scrim") || POP) return;
  const current = () => S.multi.size ? topLevelOnly([...S.multi]) : (S.sel && IDX.get(S.sel)?.kind === "sh" ? [S.sel] : []);
  if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (S.view === "bars" && e.key === "Delete") deleteItems(current());
  else if (S.view === "bars" && mod && k === "d") { e.preventDefault(); duplicate(current()); }
  else if (k === "f" && !mod && !e.altKey) { e.preventDefault(); openFullscreen(); }
  else if (e.key === "?") { e.preventDefault(); keySheet(); }
  else if (e.key === "Escape" && S.multi.size) { S.multi.clear(); S.view === "bars" ? renderTree() : rerenderTable(); }
});
addEventListener("beforeunload", e => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
// Ctrl+V a QoLBar import string anywhere outside a text box: open the importer already filled in.
// Export strings are gzip data in base64, which always starts with "H4sI".
document.addEventListener("paste", e => {
  if (!S.doc || FS || document.querySelector(".scrim") || e.target.closest?.("input,textarea")) return;
  const t = (e.clipboardData?.getData("text") || "").trim();
  if (/^H4sI[A-Za-z0-9+/=\s]+$/.test(t)) { e.preventDefault(); importStringModal(t); }
});
document.addEventListener("dragover", e => { if (!DRAG && e.dataTransfer?.types?.includes("Files")) e.preventDefault(); });
document.addEventListener("drop", e => {
  if (DRAG || !e.dataTransfer?.files?.length) return;
  e.preventDefault();
  handleDrop(captureDrop(e.dataTransfer), {confirmDiscard: true}); // captured before the confirm, so the files survive it
});

render();
// Backdrop screenshot chosen on an earlier visit (kept in IndexedDB)
idb.get("backdrop").then(b => { if (b?.blob) useScreenshot(new File([b.blob], b.name || "screenshot.png"), {persist: false, quiet: true}); });
// Custom icons picked on an earlier visit (kept in IndexedDB)
idb.get("iconCache").then(c => { if (c?.ids && ICON_LIST.source !== "yours") try { useIconCache(c.ids, c.at, {persist: false}); } catch {} });
idb.get("customIcons").then(list => { if (list?.length) setCustomIcons(list.map(x => new File([x.blob], x.name)), {persist: false, quiet: true}); });
// Chrome / Edge: pick the remembered folder back up. If the browser still allows access, load straight from it,
// unless the saved session has unsaved edits (those are never silently replaced; the welcome screen offers both).
(async () => {
  if (!CAN_FOLDER) return;
  const d = await idb.get("dir"); if (!d) return;
  S.savedDir = d;
  let perm = "prompt"; try { perm = await d.queryPermission({mode: "readwrite"}); } catch {}
  if (S.doc) return render();
  if (perm === "granted" && !savedSession()?.dirty) connectFolder(d);
  else render();
})();
