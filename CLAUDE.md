# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the widget (Electron)
npm install        # Install dependencies (only electron dev dep)
```

## Architecture

This is an Electron desktop app (no framework, no bundler). Three-layer structure:

**Main process** (`main.js`): Node.js environment. Owns all privileged operations: GitHub API calls via `https`, PAT storage via `safeStorage` + filesystem, settings persistence (`userData/settings.json`), system tray, window management, and `git pull` execution via `child_process.exec`.

**Preload** (`preload.js`): Thin bridge using `contextBridge`. Exposes the `window.widget` API to the renderer. All renderer↔main communication goes through `ipcRenderer.invoke` calls defined here.

**Renderer** (`renderer/`): Vanilla JS + CSS. No framework. Accesses everything through `window.widget`. Single page with three panels that show/hide: selector row, status area, settings panel.

## Key design decisions

- **API-only sync detection**: The widget never reads local `.git/` files unless the user clicks Pull. "Behind" means the remote HEAD SHA has changed since the user last acknowledged/pulled — stored per-repo in `settings.json` as `acknowledgedShas`.
- **Pull flow**: The Pull button first checks for a saved local path (`settings.localPaths[fullName]`). If none, opens a folder picker dialog via `dialog.showOpenDialog`, saves the path, then runs `git pull` via `exec`. On success, auto-acknowledges the SHA.
- **Token security**: PAT is encrypted via `safeStorage.encryptString()` (OS keychain) when available, raw bytes otherwise. Never exposed to the renderer.
- **Window sizing**: Fixed 300px wide. Height changes via `win.setSize(W, h)` IPC calls — 140px collapsed, 290px settings open, 300px dropdown open.
- **Colors**: OKLCH throughout. `oklch(0.13 0.009 248)` base surface. Green `oklch(0.72 0.18 145)` / red `oklch(0.63 0.22 25)` for semantic status only.

## IPC channels

All channels use `ipcMain.handle` / `ipcRenderer.invoke` (request-response pattern):

| Channel | Direction | Purpose |
|---|---|---|
| `widget:get-settings` | renderer→main | Load settings + hasToken flag |
| `widget:save-token` / `widget:clear-token` | renderer→main | PAT management |
| `widget:fetch-repos` | renderer→main | GitHub `/user/repos` paginated |
| `widget:fetch-status` | renderer→main | Latest commit + behind check |
| `widget:acknowledge` | renderer→main | Reset "acknowledged SHA" to current |
| `widget:run-pull` | renderer→main | `git pull` in a local path |
| `widget:pick-folder` | renderer→main | `dialog.showOpenDialog` for local repo |
| `widget:get-local-path` / `widget:set-local-path` | renderer→main | Per-repo local path storage |
| `widget:set-height` | renderer→main | Resize window (collapse/expand) |
| `widget:tick` | main→renderer | Auto-refresh timer event |

## Settings file shape

```json
{
  "selectedRepo": "owner/repo",
  "selectedBranch": "main",
  "refreshInterval": 5,
  "acknowledgedShas": { "owner/repo": "abc1234..." },
  "localPaths": { "owner/repo": "C:/path/to/local/repo" },
  "position": [x, y]
}
```

Stored at `app.getPath('userData')/settings.json`. Token at `userData/token.enc`.
