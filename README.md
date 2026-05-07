# GitPulse

A floating desktop widget that shows whether your GitHub repositories need pulling.

## What it does

- Sits always-on-top in a corner of your screen, draggable anywhere
- Green dot: remote matches what you last pulled. Red dot: someone pushed, you need to pull.
- Shows the last committer, short commit hash, and commit message at a glance
- **Pull button**: click it, pick your local repo folder once, and it runs `git pull` for you
- Auto-refreshes every 5 minutes (configurable)
- Lives in the system tray when hidden

## Setup

1. Install [Node.js](https://nodejs.org)
2. Clone this repo and run:
   ```bash
   npm install
   npm start
   ```
3. On first launch, paste a [GitHub Personal Access Token](https://github.com/settings/tokens/new?scopes=repo&description=GitPulse+Widget) with `repo` scope
4. Select a repository from the dropdown

## Tech

Electron, vanilla JS, no bundler.