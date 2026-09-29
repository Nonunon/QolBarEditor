# QoLBar Editor

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
- **Import and export.** In-game import strings, bars from another QoLBar.json, and a readable JSON format.

## Getting started

1. Open the editor and drop in your `QoLBar.json`, found at `%AppData%\XIVLauncher\pluginConfigs\QoLBar.json`.
2. Edit. Press `?` for keyboard shortcuts and a short tour.
3. Close the game (or disable QoLBar in `/xlplugins`), save, and put the file back.

The [full guide](docs/GUIDE.md) covers every feature and the file format details.

## Development

The editor is a single self-contained file, `QoLBarEditor.html`. Open it in a browser, or serve the folder with any static server. There's no build step and there are no dependencies.

```
npm test
```

This runs round-trip checks against `test/fixture.QoLBar.json`. To check your own config: `node test.mjs path/to/QoLBar.json`.

## Credits

QoLBar is made by UnknownX7. This is an unofficial fan tool, not affiliated with the plugin's author, the Dalamud team or Square Enix. Icons are loaded from [xivapi](https://xivapi.com/).

The editor's layout math, file format handling, icon browser tabs and UI sheet list are based on reading [QoLBar's source](https://github.com/UnknownX7/QoLBar). The QoLBar name and anything taken from its source belong to its author.

**To the author of QoLBar:** if you'd like anything changed, or this project taken down, please open an issue.

## License

[AGPL-3.0-or-later](LICENSE), in the spirit of the Dalamud ecosystem. You can use, change and share this editor, including running your own copy online, as long as your version stays under the same license and its source is available to its users.
