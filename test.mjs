// SPDX-License-Identifier: AGPL-3.0-or-later
// Round-trip tests for the file format core (src/js/core.js).
// Usage: node test.mjs [path-to-QoLBar.json]   (defaults to test/fixture.QoLBar.json; pass your own config to check it too)
import fs from "node:fs";
import vm from "node:vm";

const core = fs.readFileSync(new URL("./src/js/core.js", import.meta.url), "utf8");
const ctx = vm.createContext({console, structuredClone, TextEncoder, Blob, Response, CompressionStream, DecompressionStream, btoa, atob, Uint8Array, JSON, Number, Math, String, Object, Array, Set, Map, Error, parseInt, parseFloat});
vm.runInContext(core + "\n;globalThis.API = {parseConfig, serialize, unwrapConfig, wrapConfig, exportString, importString, hotkeyName, parseHotkeyName, colorToHex, hexToColor, parseName, buildName, moveSet, removeSet, allShortcuts, isRaw, walkShortcuts, importFromDoc, setDependencies};", ctx);
const A = ctx.API;

const file = process.argv[2] || new URL("./test/fixture.QoLBar.json", import.meta.url);
const text = fs.readFileSync(file, "utf8");
let fails = 0;
const check = (name, ok, extra = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); if (!ok) fails++; };
const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i < Math.max(a.length, b.length) ? `first difference at char ${i}: ${JSON.stringify(a.slice(i - 40, i + 40))} vs ${JSON.stringify(b.slice(i - 40, i + 40))}` : ""; };

// 1. Parse + serialize is byte identical to what the plugin wrote
const doc = A.parseConfig(text);
const out = A.serialize(doc);
check("byte-identical round trip", out === text.replace(/^﻿/, ""), out === text ? "" : firstDiff(out, text));

// 2. Readable format round trip
const readable = JSON.stringify(A.unwrapConfig(doc), (k, v) => A.isRaw(v) ? v.__raw : v, 2);
const back = A.serialize(A.wrapConfig(A.parseConfig(readable)));
check("readable JSON round trip", back === out, back === out ? "" : firstDiff(back, out));

// 3. In-game export strings round trip for every bar, every shortcut and every condition set
let n = 0, bad = 0;
for (const bar of doc.BarCfgs) {
  const r = await A.importString(await A.exportString("bar", bar, doc.PluginVersion));
  n++; if (A.serialize(r.value) !== A.serialize(bar)) { bad++; console.log("   bar mismatch:", bar.n, firstDiff(A.serialize(r.value), A.serialize(bar))); }
}
for (const [sh] of A.allShortcuts(doc)) {
  const r = await A.importString(await A.exportString("shortcut", sh, doc.PluginVersion));
  n++; if (A.serialize(r.value) !== A.serialize(sh)) { bad++; console.log("   shortcut mismatch:", sh.n); }
}
for (const s of doc.CndSetCfgs) {
  const r = await A.importString(await A.exportString("set", s, doc.PluginVersion));
  n++; if (A.serialize(r.value) !== A.serialize(s)) { bad++; console.log("   set mismatch:", s.n); }
}
check(`in-game export/import strings (${n} objects)`, bad === 0);

// 4. Decoding helpers
check("hotkey 131154 = Ctrl + R", A.hotkeyName(131154) === "Ctrl + R");
check("hotkey 65618 = Shift + R", A.hotkeyName(65618) === "Shift + R");
check("hotkey parse round trip", [0x20052, 0x10052, 0x70041, 0x4 | 0x10000, 0xBD | 0x20000, 0x70].every(k => A.parseHotkeyName(A.hotkeyName(k)) === k));
check("color ABGR 0xFF00FF00 is green", A.colorToHex(4278255360) === "#00FF00FF");
check("color hex round trip", A.hexToColor(A.colorToHex(2030043135)) === 2030043135);
const p = A.parseName("Lbl::fg61341##tip ## more");
check("name parse", p.label === "Lbl" && p.args === "fg" && p.icon === 61341 && p.tooltip === "tip ## more" && A.buildName(p) === "Lbl::fg61341##tip ## more");

// 5. Condition set move/remove keep references right
const d2 = A.parseConfig(text);
if (d2.CndSetCfgs.length >= 2) {
  const nameOf = b => b.c >= 0 ? d2.CndSetCfgs[b.c].n : null;
  const before = d2.BarCfgs.map(nameOf);
  A.moveSet(d2, 0, d2.CndSetCfgs.length - 1);
  check("moveSet keeps bar -> set links", JSON.stringify(d2.BarCfgs.map(nameOf)) === JSON.stringify(before));
  const victim = d2.CndSetCfgs[0].n;
  A.removeSet(d2, 0);
  check("removeSet unlinks only that set", JSON.stringify(d2.BarCfgs.map(nameOf)) === JSON.stringify(before.map(x => x === victim ? null : x)));
}

// 6. Copying between configs renumbers condition set references
{
  const cond = (i, a, extra = {}) => ({"$type": "QoLBar.CndCfg, QoLBar", i, a, n: false, o: 0, ...extra});
  const set = (n, c) => ({"$type": "QoLBar.CndSetCfg, QoLBar", n, c});
  const bar = (n, c) => ({"$type": "QoLBar.BarCfg, QoLBar", n, c, sL: []});
  // src: #0 Filler, #1 InCombat, #2 "Combat and RSR" refers to #1 via a Condition Set row
  const src = {BarCfgs: [bar("Uses 2", 2), bar("Uses 0", 0)], CndSetCfgs: [set("Filler", [cond("l", 0)]), set("InCombat", [cond("cf", 26)]), set("Combat and RSR", [cond("cs", 1), cond("p", "RotationSolver", {o: 0})])]};
  // target already has an identical "InCombat" at #1 and one unrelated set
  const tgt = {BarCfgs: [], CndSetCfgs: [set("Mine", [cond("j", 21)]), set("InCombat", [cond("cf", 26)])]};
  const r = A.importFromDoc(tgt, src, {sets: [2], bars: [src.BarCfgs[0]], withDeps: true});
  const combat = tgt.CndSetCfgs.find(s => s.n === "Combat and RSR");
  check("import: identical set reused, not duplicated", tgt.CndSetCfgs.filter(s => s.n === "InCombat").length === 1 && r.setsReused === 1);
  check("import: Condition Set row renumbered to target's copy", combat && combat.c[0].a === 1);
  check("import: bar points at the new set number", tgt.BarCfgs[0].c === tgt.CndSetCfgs.indexOf(combat));
  check("import: source config untouched", src.CndSetCfgs[2].c[0].a === 1 && src.BarCfgs[0].c === 2);
  const tgt2 = {BarCfgs: [], CndSetCfgs: []};
  const r2 = A.importFromDoc(tgt2, src, {sets: [2], bars: [src.BarCfgs[1]], withDeps: false});
  check("import without dependencies: dangling row dropped, bar unlinked", r2.droppedRows === 1 && tgt2.CndSetCfgs[0].c.length === 1 && tgt2.BarCfgs[0].c === -1 && r2.unlinkedBars === 1);
}

// 7. Big character IDs survive (ulong > 2^53)
const big = '{"a": 18014398509481985123, "b": 1.5}';
check("ulong character IDs keep precision", A.serialize(A.parseConfig(big)).includes("18014398509481985123"));

console.log(fails ? `\n${fails} check(s) failed` : "\nAll checks passed");
process.exit(fails ? 1 : 0);
