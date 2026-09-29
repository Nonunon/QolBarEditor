# QoLBar Editor: full guide

An out-of-game editor for the [QoLBar](https://github.com/UnknownX7/QoLBar) Dalamud plugin's config (`QoLBar.json`). It turns the compact keys (`cSO`, `clA`, `k: 131154`...) into normal controls and saves back in the exact format the plugin writes.

## Use it

Open `QoLBarEditor.html` (or the hosted copy) in any browser. It is a single file with nothing to install and no server. Web pages may only read files you hand them, and no browser lets a page write into `AppData`, where XIVLauncher keeps its configs, so it works like this everywhere:

1. **Open files...** (or drop) `QoLBar.json`, and `dalamudConfig.json` too if you want the preview to use your Dalamud style. Both at once works; the editor tells them apart. Every file the editor mentions (on the start page, in Settings, the preview panel, the toggle builder and the icon picker) shows its full path with a **Copy folder** button: paste that into the file picker's address bar, press Enter, and pick the file. For QoLBar.json that's `%AppData%\XIVLauncher\pluginConfigs`.
2. Edit.
3. **Save** downloads the edited file. To land it in place without copying by hand, turn on your browser's "ask where to save" option (Firefox: *Always ask you where to save files*; Chrome, Edge, Helium: *Ask where to save each file before downloading*) and save straight into `pluginConfigs`, overwriting QoLBar.json. The editor explains this the first time.

**Also**
- Your loaded config and unsaved edits are kept in the browser. Next time the start screen offers **Resume last session**, showing when the copy was read from disk and whether it has unsaved changes.
- **Reload from disk** (top bar) gets the current file again, keeping your tab and selection. It asks you to pick the file, because the page can't reopen it by itself, and asks first if you have unsaved changes.
- The status bar shows where the open config came from and when it was read.
- **Connect a launcher folder** (Chrome / Edge / Helium, advanced): for launchers that keep their files outside AppData (for example one started with `--roamingPath`). Chrome refuses folders inside AppData ("contains system files"). A connected folder is read directly, **Save** writes straight back, and the editor notices when the game rewrites the file.

**Before saving to the live file:** QoLBar rewrites its config from memory whenever you change something in game, which overwrites outside edits. Disable QoLBar in `/xlplugins` (or close the game), save here, then re-enable it.

No-restart alternative: select a bar, shortcut or condition set, click **Copy import string**, and paste it with QoLBar's own Import in game.

## Views

| View | For |
|---|---|
| Bars | Tree of bars, categories and shortcuts. Drag to reorder or drop into categories, filter, layout preview, full inspector. |
| Table | Every shortcut in one editable grid. Fastest for bulk edits. |
| Conditions | Condition sets with a plain-English summary, presets, zone picker, and "used by". Reordering or deleting sets keeps references correct. |
| Tricks | Mock bars: several bars lined up to look like one, including stacks of alternates that swap in place. |
| Settings | Config check (broken condition set links, clashing shortcut and pie hotkeys, plugin conditions and commands that don't match what's installed, unused sets, empty bars, shortcuts with no command; each with a "Show me" list, and a dot on the tab when something needs a look), data sources (every file the editor reads, whether it's loaded, and what it feeds, with missing icons listed per shortcut and a "Show me" link; problems only in hidden bars are marked as a note, not a warning) and global plugin options. |

**Right-click** anything for its actions: shortcuts (copy import string, duplicate, add shortcuts after or inside, move, delete; or bulk actions when several are selected), bars (copy import string, add shortcuts, copy / paste placement, hide, edit its condition set, move, delete), condition sets (copy import string, duplicate, import, move, delete), single condition rows (negate, duplicate, move, delete), and bars in the preview panel. Empty space offers undo, import and save. Text boxes keep the browser's own menu for copy and paste.

## Screen preview

The **Preview** panel on the right shows a small screen with every bar drawn where QoLBar would put it. The placement follows the plugin's own rules for dock side, alignment, position, button width, columns, spacing, scale and font scale. Click a bar or shortcut in it to jump to that item in the editor. Bars with a dashed outline only show up when the mouse gets near them (Slide / Immediate).

**Fullscreen** (header button or `F`) puts the browser into real fullscreen (like F11) and is interactive. When your monitor matches the preview resolution it snaps to **1:1 pixels** (shown in the toolbar), so it looks like the game at true size. The toolbar slides up after a moment of not being used; move the mouse to the top edge or click its small tab to bring it back (clicking the tab pins it). Esc exits.

**Live editing in fullscreen:** right-click a shortcut or bar (like in game), click a bar's dark background, or click the small ✎ that appears over whatever you hover. A floating panel opens next to it (drag it by its header):

- **Shortcuts:** label, icon, tooltip, type, command, mode, hotkey and color, plus move earlier/later, add a shortcut after (or inside a category), duplicate and delete.
- **Bars:** name, condition set, hidden, dock, alignment, visibility, width/columns/spacing/scale, add shortcuts, duplicate or delete the bar, and the full pixel placement tools.
- **Placement copy/paste** (also in the normal inspector's Pixel placement card): **Copy** a bar's dock, alignment, position and layout, then **Paste position** or **Paste all** onto another bar. It also goes to the clipboard as JSON.

Every change shows immediately (dragging a position or size number slides the bar live, frame by frame, in both fullscreen and the side preview) and is undoable with Ctrl+Z. Ctrl+S saves, Esc closes the panel first, then fullscreen, and **Full editor** jumps to that item in the main editor.

The **Preview log** floats on the right: it follows the newest line (unless you scroll up), its text can be selected, **Copy** copies the whole log, drag its left or bottom edge to resize it, and the `>` tab slides it into the right edge (`<` brings it back). Size and hidden state are remembered.

- Move the mouse to a screen edge and Slide / Immediate bars come out, using each bar's reveal area.
- Clicking a category opens its popup next to the bar, using that category's own layout settings. Categories set to open on hover, stay open or close when hover ends behave that way too.
- Clicking a shortcut prints what it would run in the fake chat box. Incremental and Random modes cycle or pick lines like the plugin does. Nothing is sent to the game.
- Hotkeys work: shortcut hotkeys run their shortcut, and bar hotkeys show or hide the bar.
- Color animations (rainbow, fades, transitions) play.

Settings in the panel:

- **Resolution** and **UI scale** (Dalamud's global scale). Bar positions are stored as fractions of the screen but sizes are in pixels, so the same config looks different at different resolutions. Pick yours.
- **Backdrop:** **Use a screenshot...**, or drop a game screenshot onto the preview (or anywhere in the editor). The resolution switches to the image's size, since a screenshot's size is your game resolution. The image stays in this browser (remembered between visits, never uploaded anywhere); **Remove** forgets it. If `ReferenceBackdrop.png` sits next to the editor it is offered as **Reference**. **Mockup** draws a simple fake HUD instead. Dropping numbered images (like `811002.png`) loads them as custom icons instead.
- **Simulate condition sets** lets you mark each set true or false to see which bars would show.
- **Your setup:** **Load dalamudConfig.json...** (from `%AppData%\XIVLauncher\`) reads your chosen Dalamud style (window and frame padding, popup rounding, window, popup, hover and text colors) and your global UI scale, so the preview matches your own install. The file is read inside the browser; only those numbers are kept, in this browser's storage. **Show values** lists everything the preview uses and where each value came from (your Dalamud config, your QoLBar.json, or fixed in QoLBar's code). **Reset** goes back to Dalamud's defaults.
- **Icon picker:** the Browse... button next to a shortcut's icon number (in the inspector and the live editor) opens a picker with the same tabs and sections as QoLBar's own icon browser. Search by name (emotes, actions, items, statuses, mounts, minions and accessories, looked up on xivapi) or type an icon number to jump to it; double-click to use an icon straight away. Which icons exist comes from QoLBar's `pluginConfigs\QoLBar\iconCache.json` (written when you open its icon browser in game), read automatically from a connected folder or loaded by hand; without it a built-in copy (May 2026) is used. Images load only as tiles scroll into view, 8 at a time. The **Advanced** tab crops part of a texture, usually one of the UI sheets: drag the square over a symbol, resize it by its corner or the scroll wheel, and it becomes the shortcut's icon zoom and offset exactly as QoLBar uses them (1/zoom of the texture around 0.5 + offset).

**Custom icons:** see below.

**Icons** are drawn the way QoLBar draws them: the art fills the whole slot (game icons are padded to a square, custom images are stretched to it), zoom / offset / rotation use the plugin's texture-coordinate math, and the `f` frame argument (or the "Use Icon Frame" setting) lays the game's real hotbar frame over the art, reaching 7.5% past each edge, with the game's glow on hover.

**UI sheet icons** (IDs from 10,000,000 up, like `::10000305`) are whole game interface textures, not single icons: `10000000 + n` is entry n of QoLBar's sheet table (for example `10002001` is `ui/uld/todolist`). QoLBar pads the sheet to a square, and a symbol is picked out of it with zoom and offset; the editor draws them the same way, and the tree thumbnails show the picked symbol too.

**Custom icons** (negative IDs, like `::fh-811002`) are your own images in `%AppData%\XIVLauncher\pluginConfigs\QoLBar\icons`, named by number (`811002.png` is icon -811002). With a connected folder (Chrome / Edge) they load automatically. In any browser, **Load icons folder...** under "Your setup" reads the folder once (if the browser refuses a folder inside AppData, use **Pick images...** and select them all with Ctrl+A), and the images are remembered in the browser after that. The panel shows how many of the custom icons your config uses were found; missing ones show as "?".

### Pixel placement

Each bar's inspector has a **Pixel placement** card, using the preview panel's resolution and UI scale:

- **On screen:** the exact window rectangle in game pixels.
- **Top-left pixel:** type an x or y pixel and the stored position is recalculated to land exactly there.
- **Snap next to:** pick a bar (listed nearest first; bars stacked in one spot are listed together) or the screen, then click a spot on the compass around it. Each spot sets both axes at once, like "right of it, tops lined up" or "below it, centered". The middle stacks this bar on the same spot. **Seamless** overlaps the windows so the buttons sit the bar's own spacing apart, so two bars look like one; otherwise set a gap.
- **Neighbors:** flags being past a screen edge, overlaps, and small gaps or flush edges with nearby bars.

Placement copies QoLBar's math exactly: the position fraction is multiplied by the screen size in 32-bit floats and floored, then ImGui floors the window position. That rounding is why hand-typed fractions often land a pixel off. Solved positions aim for the middle of the target pixel, so rounding can't nudge them, and are stored as the shortest value the plugin would write. Checked against an in-game 2560×1440 screenshot: all four measured bars matched to the pixel.

Positions are fractions of the screen, so pixel-perfect alignment only holds for the resolution it was done at.

### Tricks: mock bars

QoLBar can't change one button with a condition, so a common trick is one small bar per state ("Disable Plugin" shown while the plugin is on, "Enable Plugin" while it's off) stacked in the same spot, and several of those lined up in a row. The **Tricks** tab builds and keeps that row for you:

- It finds bars that already share a spot and offers to turn them into a mock bar, ordered as they sit on screen.
- Each **slot** holds one bar or a stack of alternates. The first bar of the first slot is the anchor.
- **Seamless** joins overlap the windows by twice the window padding minus the button spacing, so the gap between buttons is the same as inside a real bar. **Gap** leaves a set gap instead. Row or column.
- While **pinned**, every edit lines the row up again: move the anchor and the rest follow, rename a button or change a width and the row re-flows.
- **Toggle button** makes the Enable / Disable pair for a plugin in one go: two bars stacked in one slot, each shown by a "Plugin Enabled" condition set (one of them negated). It reuses matching condition sets that already exist, and joining a mock bar copies the first bar's look. The button text and commands (`/xlenableplugin "Name"` and `/xldisableplugin "Name"`) are filled in for you and can be changed. The plugin picker marks each name: ✓ for names already used in this file or installed (listed from your `dalamudConfig.json` once you load it), ? for common examples to double-check. A plugin's InternalName (what conditions check, and its folder name in `XIVLauncher\installedPlugins`) can differ from the name the commands use: `WrathCombo` is "Wrath Combo", `RotationSolver` is "Rotation Solver Reborn". The editor fills in the right one for well-known plugins and for names your own commands already use, and says when it's only a guess.
- **Match alternates** keeps bars stacked in one slot looking the same: width, scale, spacing, dock, colors and icons. Edit either one and the other follows; labels, tooltips, commands and condition sets stay their own.
- **Preview** shows the row as it looks with the plugins on or off (or the first or second bar of each stack), or click the eye on one bar. It only changes the preview's condition set switches, never the file.
- It warns when alternates in one slot share a condition set (they'd show together), have different widths (the row would shift when they swap), or look swapped ("Enable" shown while the plugin is loaded), with a button to swap their sets back.
- **Other screens** shows how far the row would be off on common resolutions. Positions are fractions of the screen while bars keep their pixel size, so a row can only be exact at one resolution. A trick remembers the resolution and UI scale it was lined up for and only follows edits there, so looking at another resolution in the preview never moves anything; "Line up for ..." re-aligns it for the current one (for example to make a copy for a friend's monitor).

Tricks are kept in this browser, not in QoLBar.json (the plugin drops unknown fields when it saves), and refer to bars by name. Renaming a bar in the editor updates them.

The metrics come from the actual sources: QoLBar draws with Noto Sans CJK Medium at 17 × Scale × Font scale px. Button height, and so icon size, comes from 17 × Scale only (the plugin measures it before applying Font scale), so Font scale shrinks text but never icons. ImGui measures that size as the whole line height while browsers use the smaller em box, so the preview draws it at size / 1.448 (11.74 px for 17 px), which matches in-game label widths within about 1 px. The Dalamud Standard style gives frame padding 4×3, window padding 8, dark red button hover and a `rgba(0.06,0.06,0.06,0.93)` window background, and QoLBar overrides it for bars with square corners and `rgba(0.286,0.286,0.286,0.9)` buttons. Category popups open sideways from vertical grids and above/below otherwise, toward the screen half away from the clicked button. The web font (Noto Sans JP, loaded from Google Fonts) is the same family, but text rendering and animations still differ a little from ImGui, so treat it as close, not pixel exact. Icons are loaded from xivapi, so they need an internet connection.

Bulk actions (tick boxes, or Ctrl/Shift-click): move, duplicate, set mode, color, clear hotkeys, find & replace (regex optional), delete. Undo/redo covers everything.

Number boxes work like Dalamud's drag fields: press and drag right to increase, left to decrease (one step per pixel; hold Shift for 10x, Alt for fine steps). A click without dragging lets you type. A whole drag counts as one undo step.

Keys: `Ctrl+S` save, `Ctrl+Z` / `Ctrl+Y` undo/redo, `Del` delete, `Ctrl+D` duplicate, `Esc` clear selection. Press `?` (or the ? button in the header) for the full list of keys and mouse actions, and a short tour of the editor. The tour is also offered once after the first file is opened.

**Review before saving:** Save first shows what will change compared with the last save (or the file as it was read): bars moved, renamed or restyled, shortcuts added, removed or edited (label, icon, command, hotkey...), condition sets, and plugin settings. Most items have Revert (one undo step each) and Show me. Clicking "Unsaved changes" in the status bar opens the same list. It can be turned off in the dialog.

**Hotkeys, as QoLBar handles them:** a shortcut's hotkey only works while its bar is on screen, and every visible shortcut with that key fires. A bar's own hotkey opens that bar as a pie menu while held, whenever its condition set is true, even if the bar is hidden; tapping the key still runs a shortcut that shares it. The fullscreen preview runs shortcut hotkeys and notes pie hotkeys in the log (pie menus aren't drawn).

## Importing

**Import** (in the Bars and Conditions toolbars, and under Import / Export) has two sources:

- **From another QoLBar.json:** pick a different config (a backup, a friend's, another character's) and tick the condition sets, bars, or individual shortcuts to bring over. That file is only read, never changed. With **Also bring the condition sets these use** on (the default), sets used by the chosen bars, and sets referenced through "Condition Set" rows, come along automatically. Every set number is renumbered to match this file, and a set identical to one you already have is reused instead of duplicated. The whole import is one undo step.
- **From an import string:** strings from QoLBar's Export or this editor's **Copy import string**. Shortcut: press **Ctrl+V** anywhere outside a text box and the importer opens already filled in. As in QoLBar, an imported bar doesn't keep a condition set (strings don't carry sets). A condition set whose rows point at other sets gets a warning, since those numbers may mean different sets here; use "From another QoLBar.json" to bring them along correctly.

## Readable format

**Import / Export > Export readable JSON** writes `QoLBar.readable.json`: long field names, enum names, `"Hotkey": "Ctrl + R"`, colors as `#RRGGBBAA`, conditions like `{"Condition": "Plugin Enabled", "Value": "RotationSolver"}`, and commands as one array entry per line. Omitted fields use plugin defaults. Edit it in any text editor, then **Import readable JSON** and save.

## Format notes (from the plugin source)

| Raw | Meaning |
|---|---|
| `n` (shortcut) | `Label::[args]IconID##Tooltip`. Icon args: `f` frame, `n` no frame, `l` low-res, `h` high-res, `g` grayscale, `r` reverse. |
| `t` / `m` | Type: 0 Command, 1 Category, 2 Spacer. Mode: 0 Default, 1 Incremental, 2 Random. |
| `k` | Windows key code, plus `0x10000` Shift, `0x20000` Ctrl, `0x40000` Alt. |
| `cl` / `clA` | Color as `0xAABBGGRR`; animation index (1 Slow Rainbow ... 14 Black Transition). |
| `c` (bar) | Index of the condition set, `-1` = always shown. |
| Conditions | `i` type id, `a` value, `n` NOT, `o` operator (0 AND, 1 OR, 2 EQUALS, 3 XOR), evaluated strictly left to right. |
| Import strings | gzip + base64 of the JSON, with short `$type` names and default values left out. |

## Files

- `QoLBarEditor.html`: the whole editor, one self-contained page. The part between the `CORE-START` and `CORE-END` markers (parsing, saving, formats) runs in Node too.
- `test.mjs`: round-trip checks, `node test.mjs [path]`. Byte-identical save, the readable format, in-game import strings, hotkey and color decoding, condition set references. Runs against `test/fixture.QoLBar.json` unless you pass your own config.
- `test/fixture.QoLBar.json`: a sample config: QoLBar's own demo bar plus a few made-up bars and condition sets.
- `docs/GUIDE.md`: this guide.
