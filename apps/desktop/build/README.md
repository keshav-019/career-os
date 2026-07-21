# electron-builder Icon Source

## Purpose
Source art for the packaged app icon. `electron-builder` looks for a `build/` folder at the project root by
convention and generates platform-specific icon formats (`.ico` for Windows, `.icns` for macOS) from `icon.png`.

## What This Folder Owns
`icon.png` - a copy of `apps/web/public/careeros-dark-mode.png`. Dark mode is the default brand mark everywhere
outside the in-app UI (see that folder's README), so this is the source used for the taskbar icon while the app is
running (set directly in `src/main.js`'s `BrowserWindow` config) and for the installed/packaged app icon.

## Integration Points
- Referenced by `package.json`'s `build.icon` / `build.win.icon` / `build.mac.icon` / `build.linux.icon`.
- Referenced directly (not through electron-builder) by `src/main.js` for the live `BrowserWindow` icon.

## Files In This Folder
- `icon.png`

## Child Folders
- No direct child folders.

## Maintenance Notes
If the brand mark changes, update `apps/web/public/careeros-dark-mode.png` first and copy it here - keep the two in
sync manually, there is no build step that does this automatically. Source art is ~264x262px; electron-builder can
work with this but a 1024x1024 (or at least 512x512) source would produce sharper generated `.ico`/`.icns` files if
higher-resolution art becomes available later.

## Contributor Checklist
1. Keep changes scoped to this folder responsibility before reaching into adjacent modules.
2. Keep this file byte-identical to `apps/web/public/careeros-dark-mode.png` unless intentionally diverging.
3. Prefer additive changes over breaking renames, and document any migration impact clearly.
