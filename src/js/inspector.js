// SPDX-License-Identifier: AGPL-3.0-or-later
// The inspector for the selected shortcut or bar.
"use strict";

/* ---------- inspector ---------- */
function renderInspector(){
  const host = $("#insp"); if (!host) return;
  const scroll = host.scrollTop;
  reindex();
  if (S.sel && !IDX.has(S.sel)) S.sel = null;
  if (!S.sel) host.replaceChildren(h("div", {class: "empty-insp"}, h("div", null, h("div", {style: {fontSize: "16px", marginBottom: "6px"}}, "Select a bar or shortcut"), h("div", null, "Ctrl/Shift-click or tick boxes to select several. Drag rows to reorder them or drop them into categories."))));
  else host.replaceChildren(IDX.get(S.sel).kind === "bar" ? barInspector(S.sel) : shInspector(S.sel));
  host.scrollTop = scroll;
}
const field = (label, control, helpText) => [h("label", {class: "flabel"}, label, helpText ? [" ", help(helpText)] : null), control];
function crumbs(sh){
  const m = IDX.get(sh);
  return h("div", {class: "crumb"}, [m.bar, ...ancestors(sh).reverse()].map((p, i) => [i ? h("span", null, "›") : null, h("a", {onclick: () => select(p)}, IDX.get(p).kind === "bar" ? (p.n || "(bar)") : (displayName(p) || "(category)"))]));
}
async function copyImportString(kind, obj){
  try { const s = await exportString(kind, obj, S.doc.PluginVersion); await navigator.clipboard.writeText(s); toast(`Import string copied (${s.length} chars). Paste it with QoLBar's Import in game.`); }
  catch (e) { toast("Could not create import string: " + e.message, "err"); }
}
function addShortcut(parentList, type, afterObj){
  const sh = makeShortcut({t: type, sL: type === 1 ? [] : null, n: type === 0 ? "New shortcut" : type === 1 ? "New category" : ""});
  mutate(() => { parentList.splice(afterObj ? parentList.indexOf(afterObj) + 1 : parentList.length, 0, sh); S.sel = sh; });
  const m = IDX.get(sh); if (m) { S.expanded.add(m.bar); ancestors(sh).forEach(a => S.expanded.add(a)); }
  renderTree(); renderInspector();
  setTimeout(() => $("#insp input.txt")?.select(), 30);
}
function addBar(){ const b = makeBar({n: "New Bar", sL: []}); mutate(() => { S.doc.BarCfgs.push(b); S.sel = b; S.expanded.add(b); }); }
function shInspector(sh){
  const p = parseName(sh.n);
  const m = IDX.get(sh), parentList = m.list;
  let headThumb = thumb(sh, true);
  const headTitle = h("h2", null, displayName(sh) || "(blank)");
  const rawName = h("div", {class: "mono dim", style: {fontSize: "12.5px", wordBreak: "break-all"}}, sh.n || " ");
  const refreshHead = () => { headTitle.textContent = displayName(sh) || "(blank)"; const t = thumb(sh, true); headThumb.replaceWith(t); headThumb = t; rawName.textContent = sh.n || " "; };
  const upd = () => { sh.n = buildName(p); refreshHead(); touch(); };
  const wrap = h("div", {class: "insp"});
  wrap.append(h("div", {class: "insp-hd"}, headThumb, h("div", {style: {minWidth: 0}}, headTitle, crumbs(sh)),
    h("div", {class: "actions"},
      h("button", {class: "btn sm", tip: "Copy a string you can paste into QoLBar's Import in game", onclick: () => copyImportString("shortcut", sh)}, svg(ICONS.copy), "Copy import string"),
      h("button", {class: "btn sm", tip: "Ctrl+D", onclick: () => duplicate([sh])}, "Duplicate"),
      h("button", {class: "btn sm danger", tip: "Delete", onclick: () => deleteItems([sh])}, svg(ICONS.trash)))));

  // Name & look
  const iconField = numInput(p.icon, v => { p.iconRaw = String(v); p.icon = v; upd(); }, {width: "110px"});
  const argToggles = ICON_ARGS.map(([a, label, tip]) => { const t = toggle(p.args.includes(a), on => { const set = new Set(p.args); on ? set.add(a) : set.delete(a); p.args = "fnlhgr".split("").filter(x => set.has(x)).join(""); upd(); }, label); t.dataset.tip = tip; return t; });
  const iconBox = h("div", null,
    h("div", {class: "inline"}, iconField, h("button", {class: "btn sm", tip: "Browse and search every icon, or crop part of a UI sheet", onclick: () => browseIcon(sh, renderInspector)}, "Browse..."), h("span", {class: "help", style: {marginTop: 0}}, "Icon ID. Negative = your custom icons.")),
    h("div", {class: "inline", style: {marginTop: "10px", gap: "16px"}}, argToggles));
  // Label cell + icon settings hide together, so the two-column grid never shifts by one cell
  const iconRow = h("div", {style: {display: p.hasIcon ? "contents" : "none"}}, h("span"), iconBox);
  const tipInput = textInput(p.tooltip, v => { p.tooltip = v; upd(); }, {placeholder: "hover text"});
  tipInput.style.display = p.hasTooltip ? "" : "none";
  wrap.append(h("div", {class: "card"}, h("h3", null, "Name & look"),
    h("div", {class: "grid"},
      ...field("Label", textInput(p.label, v => { p.label = v.replace(/::|##/g, ""); upd(); }, {placeholder: p.hasIcon ? "optional" : "text shown on the shortcut"})),
      ...field("Use icon", toggle(p.hasIcon, on => { p.hasIcon = on; if (on && !p.iconRaw) p.iconRaw = "0"; iconRow.style.display = on ? "contents" : "none"; upd(); })),
      iconRow,
      ...field("Tooltip", h("div", {class: "inline", style: {flexWrap: "nowrap"}}, toggle(p.hasTooltip, on => { p.hasTooltip = on; tipInput.style.display = on ? "" : "none"; upd(); }), tipInput)),
      ...field("Color", h("div", {class: "inline", style: {gap: "12px"}}, colorInput(sh.cl, v => { sh.cl = v; touch(); refreshHead(); }),
        dropdown({value: sh.clA, options: ANIMS.map((a, i) => ({value: i, label: a})), width: "180px", onChange: v => { commit(); sh.clA = v; touch(); }})), "Tints the icon, or colors the text for text shortcuts. Animation overrides it with a rainbow / fade effect."),
      ...field("Stored name", rawName, "Exactly what QoLBar stores:  Label::[args]IconID##Tooltip"))));

  // Behavior
  const showCmd = sh.t !== 2 && (sh.t !== 1 || sh.m === 0);
  wrap.append(h("div", {class: "card"}, h("h3", null, "Behavior"),
    h("div", {class: "grid"},
      ...field("Type", seg(sh.t, [[0, "Command"], [1, "Category"], [2, "Spacer"]], v => mutate(() => { sh.t = v; if (v === 1) sh.sL ??= []; }))),
      ...field("Mode", seg(sh.m, [[0, "Default", sh.t === 1 ? "Opens the category" : "Runs the whole command"], [1, "Incremental", sh.t === 1 ? "Each press runs the next child shortcut" : "Each press runs the next line"], [2, "Random", sh.t === 1 ? "Each press runs a random child" : "Each press runs a random line"]], v => mutate(() => sh.m = v))),
      ...(showCmd ? field(sh.t === 1 ? "Command on click" : "Command", h("div", null, textInput(sh.c, v => { sh.c = v; touch(); }, {multiline: true, autosize: true, rows: 3}), h("div", {class: "help"},
        h("span", {class: "code"}, "//m0"), " individual macro #0 (to 99) · ", h("span", {class: "code"}, "//m100"), " shared macro #0 (to 199) · ", h("span", {class: "code"}, "//m"), " starts/ends an inline macro so ", h("span", {class: "code"}, "/wait"), " works (30 lines max) · ", h("span", {class: "code"}, "//i <ID/Name>"), " use item · ", h("span", {class: "code"}, "// text"), " comment")))
        : [h("label", {class: "flabel"}, "Command"), h("div", {class: "help"}, sh.t === 2 ? "Spacers do nothing when clicked." : "Categories in Incremental or Random mode run their children instead of a command.")]),
      ...field("Hotkey", h("div", {class: "inline", style: {gap: "14px"}}, hotkeyInput(sh.k, v => { commit(); sh.k = v; touch(); }), toggle(sh.kP, v => { commit(); sh.kP = v; touch(); }, "Pass key to game")), "Hotkeys work while the bar exists. Pass-through also sends the key to the game."))));

  if (sh.t === 1) {
    wrap.append(h("div", {class: "card"}, h("h3", null, "Category popup", h("span", {class: "actions"},
      h("button", {class: "btn sm", onclick: () => addShortcut(sh.sL ??= [], 0)}, svg(ICONS.plus), "Shortcut"),
      h("button", {class: "btn sm", onclick: () => addShortcut(sh.sL ??= [], 1)}, svg(ICONS.plus), "Category"),
      h("button", {class: "btn sm", onclick: () => addShortcut(sh.sL ??= [], 2)}, svg(ICONS.plus), "Spacer"))),
      h("div", {class: "grid"},
        ...field("Button width", numInput(sh.cW, v => { sh.cW = v; touch(); }, {min: 0, max: 2000}), "0 = automatic width"),
        ...field("Columns", numInput(sh.cC, v => { sh.cC = v; touch(); }, {min: 0, max: 100}), "0 = everything on one row"),
        ...field("Spacing (x, y)", h("div", {class: "inline"}, numInput(sh.cSp[0], v => { sh.cSp[0] = v; touch(); }, {min: 0}), numInput(sh.cSp[1], v => { sh.cSp[1] = v; touch(); }, {min: 0}))),
        ...field("Scale", numInput(sh.cS, v => { sh.cS = v; touch(); }, {float: true, step: .05, min: 0})),
        ...field("Font scale", numInput(sh.cF, v => { sh.cF = v; touch(); }, {float: true, step: .05, min: 0})),
        ...field("Options", h("div", {class: "inline", style: {gap: "18px"}},
          toggle(sh.cSO, v => { commit(); sh.cSO = v; touch(); }, "Stays open after click"),
          toggle(sh.cH, v => { commit(); sh.cH = v; touch(); }, "Open on hover"),
          toggle(sh.cHC, v => { commit(); sh.cHC = v; touch(); }, "Close when hover ends"),
          toggle(sh.cNB, v => { commit(); sh.cNB = v; touch(); }, "No background"))))));
  }

  if (p.hasIcon || sh.cdA || sh.iZ !== 1 || sh.iR) {
    wrap.append(h("div", {class: "card"}, h("h3", null, "Icon transform & cooldown"),
      h("div", {class: "grid"},
        ...field("Zoom", numInput(sh.iZ, v => { sh.iZ = v; touch(); }, {float: true, step: .1})),
        ...field("Offset (x, y)", h("div", {class: "inline"}, numInput(sh.iO[0], v => { sh.iO[0] = v; touch(); }, {float: true, step: .01}), numInput(sh.iO[1], v => { sh.iO[1] = v; touch(); }, {float: true, step: .01}))),
        ...field("Rotation (degrees)", numInput(Math.round(sh.iR * 180 / Math.PI * 100) / 100, v => { sh.iR = Math.fround(v * Math.PI / 180); touch(); }, {float: true, step: 5}), "Stored in radians"),
        ...field("Cooldown action", numInput(sh.cdA, v => { sh.cdA = v; touch(); }, {min: 0}), "Action ID whose cooldown is drawn over the icon. 0 = none"),
        ...field("Cooldown style", h("div", {class: "inline", style: {gap: "16px"}}, CD_FLAGS.map(([bit, name]) => toggle(!!(sh.cdS & bit), on => { commit(); sh.cdS = on ? sh.cdS | bit : sh.cdS & ~bit; touch(); }, name)))))));
  }

  wrap.append(h("div", {class: "card"}, h("h3", null, "Position"),
    h("div", {class: "inline"},
      h("button", {class: "btn sm", onclick: () => addShortcut(parentList, 0, sh)}, svg(ICONS.plus), "Shortcut after this"),
      h("button", {class: "btn sm", onclick: () => addShortcut(parentList, 1, sh)}, svg(ICONS.plus), "Category after this"),
      h("button", {class: "btn sm", onclick: () => addShortcut(parentList, 2, sh)}, svg(ICONS.plus), "Spacer after this"),
      h("span", {class: "spacer"}),
      h("button", {class: "btn sm", disabled: m.index === 0, onclick: () => mutate(() => { parentList.splice(m.index, 1); parentList.splice(m.index - 1, 0, sh); })}, svg(ICONS.up), "Up"),
      h("button", {class: "btn sm", disabled: m.index === parentList.length - 1, onclick: () => mutate(() => { parentList.splice(m.index, 1); parentList.splice(m.index + 1, 0, sh); })}, svg(ICONS.down), "Down"))));

  wrap.append(rawCard(sh, "shortcut"));
  return wrap;
}
function rawCard(obj, kind){
  const ta = h("textarea", {class: "txt", rows: 12, spellcheck: "false"});
  let open = false;
  const body = h("div", {style: {display: "none"}}, ta, h("div", {class: "inline", style: {marginTop: "8px"}},
    h("button", {class: "btn sm", onclick: () => {
      let v; try { v = parseConfig(ta.value); } catch (e) { return toast("Invalid JSON: " + e.message, "err"); }
      mutate(() => { const fresh = kind === "bar" ? makeBar(v) : makeShortcut(v); for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, fresh); });
      toast("Applied raw JSON");
    }}, "Apply raw JSON"), h("span", {class: "help", style: {marginTop: 0}}, "Exactly as stored in QoLBar.json. For power users.")));
  const btn = h("button", {class: "btn sm ghost", onclick: () => { open = !open; body.style.display = open ? "" : "none"; btn.textContent = open ? "Hide" : "Show"; if (open) ta.value = serialize(obj, 0, "", "\n"); }}, "Show");
  return h("div", {class: "card"}, h("h3", null, "Raw JSON", h("span", {class: "actions"}, btn)), body);
}
function barInspector(bar){
  const sets = S.doc.CndSetCfgs, bi = S.doc.BarCfgs.indexOf(bar);
  const wrap = h("div", {class: "insp"});
  const title = h("h2", null, bar.n || "(unnamed bar)");
  wrap.append(h("div", {class: "insp-hd"}, h("div", {class: "thumb lg", style: {background: "var(--accent-bg)", color: "var(--accent)", fontSize: "18px", fontWeight: 700}}, String(bi + 1)),
    h("div", {style: {minWidth: 0}}, title, h("div", {class: "crumb"}, `Bar ${bi + 1} of ${S.doc.BarCfgs.length} · ${(bar.sL || []).length} shortcuts`)),
    h("div", {class: "actions"},
      h("button", {class: "btn sm", onclick: () => copyImportString("bar", bar)}, svg(ICONS.copy), "Copy import string"),
      h("button", {class: "btn sm", onclick: () => mutate(() => { const c = structuredClone(bar); c.n += " (copy)"; S.doc.BarCfgs.splice(bi + 1, 0, c); S.sel = c; })}, "Duplicate"),
      h("button", {class: "btn sm danger", tip: "Delete bar", onclick: async () => { if (await confirmBox("Delete bar", `Delete bar "${bar.n}" and its ${(bar.sL || []).length} shortcuts? Undo is available.`, "Delete", "danger")) mutate(() => { S.doc.BarCfgs.splice(S.doc.BarCfgs.indexOf(bar), 1); S.sel = null; }); }}, svg(ICONS.trash)))));

  const pv = h("div", {class: "pv"});
  // Same renderer as the screen preview and fullscreen, so it matches the game. Shown at real size
  // (one game pixel per screen pixel) unless the bar is wider than the card, then scaled down to fit.
  const drawPv = () => {
    const {scr, g} = barOnly(bar);
    const holder = h("div", {style: {position: "relative"}});
    holder.append(scr);
    const note = h("div", {class: "help", style: {marginTop: "8px"}});
    pv.replaceChildren(holder, note);
    const fit = () => {
      const avail = pv.clientWidth - 38;
      const s = avail > 0 ? Math.min(1, avail / g.w) : 1;
      scr.style.transform = `scale(${s})`;
      holder.style.height = g.h * s + "px";
      note.textContent = `${g.w} × ${g.h} px in game${s < 1 ? `, shown at ${Math.round(s * 100)}% to fit` : ", shown at real size"}. Click a shortcut to edit it, right-click for more.`;
    };
    fit(); requestAnimationFrame(fit);
  };
  drawPv();
  const re = () => { touch(); drawPv(); };

  wrap.append(h("div", {class: "card"}, h("h3", null, "Preview", h("span", {class: "actions"},
    h("button", {class: "btn sm", onclick: () => addShortcut(bar.sL, 0)}, svg(ICONS.plus), "Shortcut"),
    h("button", {class: "btn sm", onclick: () => addShortcut(bar.sL, 1)}, svg(ICONS.plus), "Category"),
    h("button", {class: "btn sm", onclick: () => addShortcut(bar.sL, 2)}, svg(ICONS.plus), "Spacer"))), pv));

  wrap.append(h("div", {class: "card"}, h("h3", null, "General"), h("div", {class: "grid"},
    ...field("Name", textInput(bar.n, v => { const was = bar.n; bar.n = v; renameInTricks(was, v); title.textContent = v || "(unnamed bar)"; touch(); })),
    ...field("Show when", h("div", {class: "inline"}, dropdown({value: bar.c, width: "300px", options: [{value: -1, label: "Always (no condition set)"}, ...sets.map((s, i) => ({value: i, label: `#${i + 1}  ${s.n || "(unnamed)"}`, hint: s.c.length + " cond."}))], onChange: v => { commit(); bar.c = v; touch(); }}),
      h("button", {class: "btn sm ghost", onclick: () => { if (bar.c >= 0) S.selSet = bar.c; S.view = "conds"; render(); }}, "Edit sets ›")), "The bar is only drawn while this condition set is true."),
    ...field("Hidden", toggle(bar.h, v => { commit(); bar.h = v; touch(); renderTree(); }, "Hide this bar")),
    ...field("Pie hotkey", hotkeyInput(bar.k, v => { commit(); bar.k = v; touch(); }), "Hold it to open this bar as a pie menu around the mouse. Works while the bar's condition set is true, even if the bar is hidden. A quick tap still triggers a shortcut with the same key."))));
  wrap.append(h("div", {class: "card"}, h("h3", null, "Position & reveal"), h("div", {class: "grid"},
    ...field("Dock", seg(bar.d, DOCK.map((d, i) => [i, d]), v => mutate(() => bar.d = v))),
    ...field("Alignment", bar.d === 4 ? h("span", {class: "help"}, "Not used by undocked bars") : seg(bar.a, ALIGN.map((d, i) => [i, d]), v => { commit(); bar.a = v; touch(); })),
    ...field("Visibility", seg(bar.v, VISIBILITY.map((d, i) => [i, d, ["Slides out when the mouse nears it", "Appears instantly when the mouse nears it", "Always shown"][i]]), v => { commit(); bar.v = v; touch(); })),
    ...field("Reveal area scale", numInput(bar.rA, v => { bar.rA = v; touch(); }, {float: true, step: .1, min: 0})),
    ...field("Hint", toggle(bar.ht, v => { commit(); bar.ht = v; touch(); }, "Show a hint where the hidden bar is")),
    ...field("Position (x, y)", h("div", {class: "inline"}, numInput(bar.p[0], v => { bar.p[0] = v; touch(); }, {float: true, step: .01, width: "110px"}), numInput(bar.p[1], v => { bar.p[1] = v; touch(); }, {float: true, step: .01, width: "110px"}), h("span", {class: "help", style: {marginTop: 0}}, "fraction of screen size, 0 to 1"))),
    ...field("Lock position", toggle(bar.l, v => { commit(); bar.l = v; touch(); })))));
  wrap.append(pixelCard(bar));
  wrap.append(h("div", {class: "card"}, h("h3", null, "Layout"), h("div", {class: "grid"},
    ...field("Button width", numInput(bar.bW, v => { bar.bW = v; re(); }, {min: 0, max: 2000})),
    ...field("Columns", numInput(bar.co, v => { bar.co = v; re(); }, {min: 0, max: 200}), "0 = one row"),
    ...field("Spacing (x, y)", h("div", {class: "inline"}, numInput(bar.sp[0], v => { bar.sp[0] = v; re(); }, {min: 0}), numInput(bar.sp[1], v => { bar.sp[1] = v; re(); }, {min: 0}))),
    ...field("Scale", numInput(bar.s, v => { bar.s = v; touch(); }, {float: true, step: .05, min: 0})),
    ...field("Font scale", numInput(bar.fS, v => { bar.fS = v; touch(); }, {float: true, step: .05, min: 0})),
    ...field("Options", h("div", {class: "inline", style: {gap: "18px"}},
      toggle(bar.nB, v => { commit(); bar.nB = v; re(); }, "No background"),
      toggle(bar.cT, v => { commit(); bar.cT = v; touch(); }, "Click-through"),
      toggle(bar.e, v => { commit(); bar.e = v; touch(); }, "Edit mode"))))));
  wrap.append(rawCard(bar, "bar"));
  return wrap;
}
