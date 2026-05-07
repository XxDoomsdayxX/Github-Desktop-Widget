# GitPulse

> A lightweight, always-on-top desktop widget that keeps you in sync with your GitHub repositories — one glance tells you everything.

![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![Electron](https://img.shields.io/badge/electron-28-47848F?style=flat-square&logo=electron)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## What It Does

GitPulse sits in the corner of your screen and watches your GitHub repositories. The moment a new commit lands on remote, the status dot turns **red** — so you know to pull before you start working. When you're in sync, it stays **green**. No browser tab, no notifications, no guessing.

```
● sales-dashboard          ⠿  ×
────────────────────────────────
user123/sales-dashboard  ▾

● Up to date
Darrell Walker · 3dc539f · 2h ago
fix(wip): scope pending-invoice logic...   ▼ Show more
checked just now

[ Up to date ]   ↻  ⚙
```

---

## Features

| Feature | Details |
|---|---|
| **Live sync status** | Green = up to date, Red = behind remote |
| **Commit details** | Author, short SHA, relative timestamp, commit message |
| **Expand commit message** | Click "Show more" to read the full message inline |
| **One-click pull** | Pulls the latest changes to your local clone directly from the widget |
| **Multi-repo support** | Switch between all your GitHub repositories from a dropdown |
| **Auto-refresh** | Configurable polling: every 1, 5, 10, or 30 minutes |
| **System tray icon** | Git-branch logo color-coded to your repo status |
| **Secure token storage** | Your PAT is encrypted via the OS keychain (Windows DPAPI) |
| **Draggable** | Position it anywhere on screen — position is remembered between sessions |
| **No admin required** | Installs entirely in your user profile |

---

## Installation

### Option 1 — Installer (recommended)

1. Download **`GitPulse Setup 1.0.0.exe`** from the [Releases](https://github.com/XxDoomsdayxX/Github-Desktop-Widget/releases) page
2. Double-click the installer — no admin password needed
3. GitPulse installs silently and launches automatically
4. A shortcut is added to your Desktop and Start Menu

> Installs to `%LOCALAPPDATA%\Programs\github-desktop-widget\` — no system-wide changes.

### Option 2 — Run from source

```bash
# 1. Clone the repo
git clone https://github.com/XxDoomsdayxX/Github-Desktop-Widget.git
cd Github-Desktop-Widget

# 2. Install dependencies
npm install

# 3. Start the widget
npm start
```

---

## First-Time Setup

### 1. Create a GitHub Personal Access Token

GitPulse needs read access to your repositories.

1. Go to **[GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens/new?scopes=repo&description=GitPulse+Widget)**
2. Click **Generate new token (classic)**
3. Give it a name (e.g. `GitPulse Widget`)
4. Check the **`repo`** scope
5. Click **Generate token** and copy it

> Your token is encrypted and stored locally on your machine. It is never transmitted anywhere except directly to the GitHub API.

### 2. Connect the widget

1. Click the **⚙ settings icon** in the widget's action bar
2. Paste your token into the **GitHub Token** field
3. Click **Connect**

The widget will verify your token, load your repositories, and show your GitHub username.

### 3. Select a repository

Click the repository dropdown and pick the repo you want to monitor. GitPulse immediately checks its status and starts the auto-refresh timer.

---

## Using the Widget

### Status indicators

| Color | Meaning |
|---|---|
| 🟢 Green dot | Your local branch is up to date with remote |
| 🔴 Red dot | New commits exist on remote — you need to pull |
| 🟡 Amber dot | An error occurred (check your token or network) |
| ⬜ Pulsing | Currently checking status |

### Pulling changes

When the dot is red, a **Pull** button appears in the action bar.

1. Click **Pull**
2. If you haven't used this repo before, a folder picker opens — select your local clone
3. GitPulse runs `git pull` in that directory and updates the status

Your local path is saved so future pulls happen in one click.

### Expanding the commit message

Long commit messages are truncated by default. Click **▼ Show more** beneath the message to expand it — the widget grows to show the full text. Click **▲ Show less** to collapse.

### Switching repositories

Click the repository name at the top of the expanded panel to open the dropdown and select a different repo.

### Controls

| Control | Action |
|---|---|
| Click the status dot or repo label | Open or close the detail panel |
| Grab the `⠿` grip (right side of bar) | Drag the widget anywhere on screen |
| Hover the bar | Reveals the **×** close button |
| **×** button | Hides the widget to the system tray |
| **↻** button | Manually refresh status |
| **⚙** button | Open / close settings |
| `Esc` | Close dropdown → close settings → close panel |

### System tray

GitPulse lives in the system tray when hidden. The tray icon mirrors the status:

- **Gray** — idle / no repo selected
- **Green** — up to date
- **Red** — behind remote

Right-click the tray icon for **Show** and **Quit**.

---

## Settings

Open the settings panel by clicking **⚙** in the action bar.

### GitHub Account

When connected, shows your GitHub username with a green indicator and a **Disconnect** button. Disconnecting removes the stored token from your keychain and resets the widget.

### Auto-refresh

Choose how often GitPulse polls GitHub:

| Interval | Best for |
|---|---|
| Every 1 min | Active collaboration / fast-moving repos |
| Every 5 min | Default — balanced |
| Every 10 min | Slower-paced projects |
| Every 30 min | Low-traffic / personal repos |

---

## Building the Installer

To produce a fresh `GitPulse Setup x.x.x.exe`:

```bash
# Install dependencies (first time only)
npm install

# Generate icon assets + build the Windows installer
npm run build

# Output: dist/GitPulse Setup 1.0.0.exe
```

The icon generator (`scripts/generate-icon.js`) produces `assets/icon.ico` (256 / 48 / 32 / 16 px) using only Node's built-in `zlib` — no external image tools or extra dependencies needed.

---

## Project Structure

```
Github Desktop Widget/
├── main.js              # Electron main process — GitHub API, IPC, tray, window
├── preload.js           # contextBridge — exposes window.widget API to renderer
├── renderer/
│   ├── index.html       # Widget markup
│   ├── style.css        # OKLCH design system, all UI styles
│   └── app.js           # Renderer logic — state, DOM, events
├── scripts/
│   └── generate-icon.js # Generates assets/icon.ico from pixel art (no deps)
├── assets/
│   ├── icon.ico         # Multi-size Windows icon (generated)
│   └── icon.png         # 256×256 PNG (generated)
└── package.json         # electron-builder config
```

---

## How Sync Detection Works

GitPulse uses the **GitHub REST API only** — it never reads your local `.git` folder (except when you click Pull).

1. On first check, the remote HEAD SHA is saved as "acknowledged" for that repo
2. On every subsequent check, the current remote SHA is compared to the acknowledged one
3. If they differ → **red** (you're behind remote)
4. After a successful pull, the new SHA is acknowledged → **green**

This means the status reflects whether you've pulled the latest remote commit — not whether your working tree is clean.

---

## Tech Stack

- **[Electron](https://www.electronjs.org/)** v28 — cross-platform desktop shell
- **Vanilla JS + CSS** — no frontend framework, no bundler
- **GitHub REST API v3** — repository and commit data
- **Node `zlib`** — PNG/ICO generation for icons (zero canvas dependency)
- **`safeStorage`** — OS-level encryption (Windows DPAPI) for PAT storage
- **`electron-builder`** — NSIS installer packaging for Windows

---

## License

MIT — do whatever you like with it.

---

<p align="center">Built with Claude Code</p>
