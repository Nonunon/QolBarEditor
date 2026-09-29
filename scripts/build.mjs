// SPDX-License-Identifier: AGPL-3.0-or-later
// Assembles the website in dist/: src/index.html with its stylesheets and scripts inlined into one self-contained
// index.html (the scripts joined into a single <script>, in the order the page lists them), plus the link-preview
// banner. It also gives it a little kiss.
// Run by Cloudflare on every push to main (`npm run build`), or locally to check.
import fs from "node:fs";

const root = new URL("../", import.meta.url), src = new URL("src/", root), dist = new URL("dist/", root);
const read = p => fs.readFileSync(new URL(p, src), "utf8").replace(/\r\n/g, "\n");
// Each source file starts with a small header (license, description, and "use strict" for scripts) that the joined
// page only needs once: drop exactly those lines
const dropHeader = (text, lines) => text.split("\n").slice(lines).join("\n").replace(/^\n+/, "");
const css = p => dropHeader(read(p), 2);
const js = p => dropHeader(read(p), 3);

const shell = read("index.html");
const scripts = [...shell.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error("No scripts found in src/index.html");
const page = shell
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${css(p)}</style>`)
  .replace(/<!-- Plain scripts[^\n]*-->\n/, "")
  // (functions as replacements, never strings: the code itself contains $1 and $` that replace() would expand)
  .replace(/(<script src="js\/[^"]+"><\/script>\n)+/, () => `<script>\n"use strict";\n${scripts.map(js).join("\n")}</script>\n`);

fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(dist);
fs.writeFileSync(new URL("index.html", dist), page);
fs.copyFileSync(new URL("assets/og-image.png", root), new URL("og-image.png", dist));
console.log(`dist/ ready: index.html (${scripts.length} scripts and 2 stylesheets inlined, ${Math.round(page.length / 1024)} KB), og-image.png`);
