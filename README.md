# QoLBar Editor

[![AI-DECLARATION: auto](https://img.shields.io/badge/%E4%B7%BC%20AI--DECLARATION-auto-ede9fe?labelColor=ede9fe)](AI-DECLARATION.md)

A browser-based editor for the config of [QoLBar](https://github.com/UnknownX7/QoLBar), the FFXIV Dalamud plugin. Edit your bars, shortcuts and condition sets outside the game, with a live preview that matches the plugin to the pixel, and save back in the exact format QoLBar writes.

**Use it:** https://qolbar-editor.hi-nonunon.workers.dev/

Everything runs in your browser. Your files are never uploaded.

## Features

- **Every setting as a plain control.** No more `cSO`, `clA` or `k: 131154`: hotkeys, colors, icons, modes and condition sets in normal words.
- **Live preview.** Your bars on a screen at your resolution, UI scale and Dalamud style, using QoLBar's own layout math. A fullscreen mode lets you click shortcuts, open categories and edit in place.
- **Pixel placement.** Exact positions, one-click snapping next to other bars, and seamless joins.
- **Tricks.** Several bars lined up to look like one, and Enable / Disable buttons that swap with a plugin's state.
- **Icon picker.** QoLBar's own icon tabs, search by name, and a cropper for game interface sheets.
- **Safety.** A config check (broken links, clashing hotkeys), a review of every change before saving, undo for everything, and byte-identical saves.
- **Light and dark themes.** Follows your system by default; pick one in the ? menu or Settings. The game preview always keeps the game's own colors.
- **Import and export.** In-game import strings, bars from another QoLBar.json, and a readable JSON format.

## Getting started

1. Open the editor and drop in your `QoLBar.json`, found at `%AppData%\XIVLauncher\pluginConfigs\QoLBar.json`.
2. Edit. Press `?` for keyboard shortcuts and a short tour.
3. Close the game (or disable QoLBar in `/xlplugins`), save, and put the file back.

The [full guide](docs/GUIDE.md) covers every feature and the file format details.

## Development

No framework, no dependencies. The source lives in `src/`: `index.html` is the page shell, `css/` has the editor's own styles and the game preview's, and `js/` has one plain script per area (`core.js` is the QoLBar file format, `ui.js` the shared widgets, then `tree.js`, `inspector.js`, `gamescreen.js`, `fullscreen.js`, `tricks.js`, `picker.js` and so on). They are ordinary scripts, not ES modules, loaded in the order `index.html` lists them and sharing one scope, so opening `src/index.html` straight from disk works too.

```
npm test          # round-trip checks of the file format core, against test/fixture.QoLBar.json
npm run build     # dist/index.html: the same page with every stylesheet and script inlined into one file
```

To check your own config: `node test.mjs path/to/QoLBar.json`.

The site deploys itself: every push to `main` makes Cloudflare run `npm run build` and publish `dist/` with `wrangler.jsonc`, so the live site stays one self-contained page.

## Credits

QoLBar is made by UnknownX7. This is an unofficial fan tool, not affiliated with the plugin's author, the Dalamud team or Square Enix. Icons are loaded from [xivapi](https://xivapi.com/).

The editor's layout math, file format handling, icon browser tabs and UI sheet list are based on reading [QoLBar's source](https://github.com/UnknownX7/QoLBar). The QoLBar name and anything taken from its source belong to its author.

**To the author of QoLBar:** if you'd like anything changed, or this project taken down, please open an issue.

## AI use

This project was built with AI assistance (Claude Opus 5.5 in Claude Code). What was done by whom is declared in [AI-DECLARATION.md](AI-DECLARATION.md), following the [AI-DECLARATION.md 0.1.2](https://ai-declaration.md/en/0.1.2/) format.

## License

[AGPL-3.0-or-later](LICENSE), in the spirit of the Dalamud ecosystem. You can use, change and share this editor, including running your own copy online, as long as your version stays under the same license and its source is available to its users.
