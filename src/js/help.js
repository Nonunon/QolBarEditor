// SPDX-License-Identifier: AGPL-3.0-or-later
// The keyboard shortcut sheet and the first-run tour.
"use strict";

/* ---------- keyboard shortcut sheet (?) and the first-run tour ---------- */
const KEY_SHEET = [
  ["Anywhere", [
    ["Ctrl+S", "Save, or download when the file can't be written directly"],
    ["Ctrl+Z", "Undo"], ["Ctrl+Y  or  Ctrl+Shift+Z", "Redo"],
    ["F", "Fullscreen live preview"],
    ["Ctrl+V", "Paste a QoLBar import string (outside a text box) to import it"],
    ["?", "This list"],
    ["Right-click", "Actions for whatever is under the mouse"]]],
  ["Bars tree", [
    ["Click", "Select"], ["Ctrl+click", "Add to or remove from the selection"], ["Shift+click", "Select a range"],
    ["Drag", "Reorder, or drop into a category or another bar"],
    ["Delete", "Delete the selected shortcuts"], ["Ctrl+D", "Duplicate the selected shortcuts"], ["Esc", "Clear the selection"]]],
  ["Number boxes", [
    ["Drag sideways", "Change the value (Shift: 10x, Alt: fine steps)"],
    ["↑ / ↓", "Step up or down (Shift: 10x)"], ["Click", "Type a value; Enter to finish"]]],
  ["Lists and hotkey boxes", [
    ["Type", "Search a list"], ["↑ / ↓, Enter", "Pick"], ["Esc", "Close the list"],
    ["Enter or Space", "Start recording a hotkey"], ["Esc (while recording)", "Clear the hotkey"]]],
  ["Fullscreen preview", [
    ["Click", "Run a shortcut or open a category (commands go to the log, not the game)"],
    ["Right-click or ✎", "Edit it in place"],
    ["Shortcut hotkeys", "Work like in game for the bars on screen"],
    ["Esc", "Close the edit panel, then popups, then fullscreen"]]],
];
function keySheet(){
  const body = h("div", {class: "keys"}, KEY_SHEET.map(([group, rows]) => h("div", {class: "keys-group"},
    h("div", {class: "flabel", style: {margin: "0 0 6px"}}, group),
    ...rows.map(([k, what]) => h("div", {class: "keys-row"}, h("span", null, ...k.split(/(\s+or\s+|,\s|\s\/\s)/).map(p => /^(\s+or\s+|,\s|\s\/\s)$/.test(p) ? h("span", {class: "faint"}, p) : h("kbd", null, p))), h("span", {class: "dim"}, what))))));
  modal({title: "Keyboard and mouse", wide: true, body, buttons: [["Take the tour", () => { setTimeout(startTour, 50); return true; }], ["Close", null, "primary"]]});
}
// A few stops around the main screen, each pointing at the real thing
const TOUR = [
  {el: () => $("#tree"), title: "Your bars", text: "Every bar and shortcut in the file. Drag to reorder or into categories, tick boxes for bulk edits, right-click for actions."},
  {el: () => $("#insp"), title: "Edit what's selected", text: "Everything QoLBar stores, in plain words. Bars get a live preview and a Pixel placement card to line them up exactly, with one-click snapping next to other bars."},
  {el: () => $(".pvpanel"), title: "Screen preview", text: "Your bars on a screen at your resolution and UI scale, drawn with QoLBar's own math. Click a bar to jump to it. Load dalamudConfig.json here to match your Dalamud style."},
  {el: () => [...document.querySelectorAll(".hdr .btn")].find(b => b.textContent === "Fullscreen"), title: "Try it like in game", text: "Fullscreen shows the bars at real size. Click shortcuts, open categories, test hotkeys, and edit anything in place."},
  {el: () => [...document.querySelectorAll(".tab")].find(t => t.textContent.startsWith("Tricks")), title: "Tricks", text: "Layouts QoLBar can't do alone: several bars lined up to look like one, and Enable / Disable buttons that swap with a plugin's state."},
  {el: () => [...document.querySelectorAll(".tab")].find(t => t.textContent.startsWith("Settings")), title: "Settings", text: "A config check for broken links, clashing hotkeys and leftovers, a list of every file the editor reads, and QoLBar's own options."},
  {el: () => $(".hdr .btn.primary"), title: "Save", text: "You'll see a summary of what changed first, and can revert anything you didn't mean to. Press ? any time for keyboard shortcuts."},
];
function startTour(){
  if (!S.doc) return;
  if (S.view !== "bars") { S.view = "bars"; render(); }
  if (!PV.open) { PV.open = true; store("pv.open", "1"); render(); }
  store("toured", "1");
  let i = 0;
  const spot = h("div", {class: "tour-spot"}), card = h("div", {class: "tour-card"});
  const layer = h("div", {class: "tour"}, spot, card);
  const end = () => { layer.remove(); removeEventListener("resize", place); document.removeEventListener("keydown", key, true); };
  const key = e => { if (e.key === "Escape") { e.stopPropagation(); end(); } else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); } else if (e.key === "ArrowLeft") go(-1); };
  const place = () => {
    const el = TOUR[i].el(); if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, {left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px"});
    const cw = card.offsetWidth, chh = card.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 14;
    // Beside the target when it's tall, otherwise below (or above when there's no room)
    let x, y;
    if (r.height > vh * .5) { x = r.right + gap + cw < vw ? r.right + gap : r.left - gap - cw; y = r.top + 20; }
    else { x = r.left; y = r.bottom + gap + chh < vh ? r.bottom + gap : r.top - gap - chh; }
    card.style.left = Math.max(12, Math.min(vw - cw - 12, x)) + "px"; card.style.top = Math.max(12, Math.min(vh - chh - 12, y)) + "px";
  };
  const go = d => { i += d; if (i < 0) i = 0; if (i >= TOUR.length) return end(); paint(); };
  const paint = () => {
    const st = TOUR[i];
    card.replaceChildren(
      h("div", {class: "faint", style: {fontSize: "11.5px", marginBottom: "4px"}}, `${i + 1} of ${TOUR.length}`),
      h("div", {style: {fontWeight: 650, fontSize: "15px", marginBottom: "6px"}}, st.title),
      h("div", {class: "dim", style: {fontSize: "13px", lineHeight: 1.55}}, st.text),
      h("div", {class: "inline", style: {marginTop: "14px", justifyContent: "space-between"}},
        h("button", {class: "btn sm ghost", onclick: end}, "Skip"),
        h("div", {class: "inline"}, i ? h("button", {class: "btn sm", onclick: () => go(-1)}, "Back") : null, h("button", {class: "btn sm primary", onclick: () => go(1)}, i === TOUR.length - 1 ? "Done" : "Next"))));
    requestAnimationFrame(place);
  };
  document.body.append(layer);
  addEventListener("resize", place); document.addEventListener("keydown", key, true);
  paint();
}
// Offered once, after the first file is opened
function offerTour(){
  if (store("toured") || $(".tour-offer")) return;
  const el = h("div", {class: "tour-offer"},
    h("div", {style: {fontWeight: 600}}, "New here?"), h("div", {class: "dim", style: {fontSize: "12.5px", margin: "3px 0 10px"}}, "A quick look around the editor, about a minute."),
    h("div", {class: "inline"}, h("button", {class: "btn sm primary", onclick: () => { el.remove(); startTour(); }}, "Show me around"), h("button", {class: "btn sm ghost", onclick: () => { el.remove(); store("toured", "1"); }}, "No thanks")));
  document.body.append(el);
}
