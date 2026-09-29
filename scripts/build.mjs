// SPDX-License-Identifier: AGPL-3.0-or-later
// Assembles the website in dist/: the editor as index.html, plus the link-preview banner. It also gives it a little kiss.
// Run by Cloudflare on every push to main (`npm run build`), or locally to check.
import fs from "node:fs";

const root = new URL("../", import.meta.url), dist = new URL("dist/", root);
fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(dist);
fs.copyFileSync(new URL("QoLBarEditor.html", root), new URL("index.html", dist));
fs.copyFileSync(new URL("assets/og-image.png", root), new URL("og-image.png", dist));
console.log("dist/ ready:", fs.readdirSync(dist).join(", "));
