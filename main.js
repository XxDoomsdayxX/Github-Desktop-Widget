const {
  app, BrowserWindow, ipcMain, Tray, Menu,
  nativeImage, safeStorage, screen, shell, dialog
} = require('electron')
const path  = require('path')
const fs    = require('fs')
const https = require('https')
const { exec } = require('child_process')

const W              = 200
const H_BAR          = 42
const H_EXPANDED     = 244
const H_WITH_SETTINGS = 390

let win          = null
let tray         = null
let refreshTimer = null

// ─── Single instance ───────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit() }
else { app.on('second-instance', () => win?.show()) }

// ─── Paths ─────────────────────────────────────────────────────────────────
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')
const tokenPath    = () => path.join(app.getPath('userData'), 'token.enc')

// ─── Settings ──────────────────────────────────────────────────────────────
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }
  catch { return { selectedRepo: null, selectedBranch: null, refreshInterval: 5, acknowledgedShas: {}, position: null } }
}

function writeSettings(s) {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2))
}

// ─── Token ─────────────────────────────────────────────────────────────────
function readToken() {
  try {
    const raw = fs.readFileSync(tokenPath())
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf8')
  } catch { return null }
}

function writeToken(token) {
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf8')
  fs.writeFileSync(tokenPath(), data)
}

function clearToken() {
  try { fs.unlinkSync(tokenPath()) } catch {}
}

// ─── GitHub API ─────────────────────────────────────────────────────────────
function ghRequest(endpoint, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'GitPulse-Widget/1.0',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          if (res.statusCode >= 400) reject(new Error(json.message || `HTTP ${res.statusCode}`))
          else resolve(json)
        } catch { reject(new Error('Invalid response from GitHub')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('Request timed out')))
    req.end()
  })
}

async function listRepos(token) {
  const repos = []
  let page = 1
  while (true) {
    const batch = await ghRequest(
      `/user/repos?sort=pushed&per_page=100&page=${page}&affiliation=owner,collaborator`,
      token
    )
    if (!Array.isArray(batch) || !batch.length) break
    for (const r of batch) {
      repos.push({ name: r.name, full_name: r.full_name, default_branch: r.default_branch, private: r.private })
    }
    if (batch.length < 100 || ++page > 10) break
  }
  return repos
}

async function getLatestCommit(fullName, branch, token) {
  const data = await ghRequest(`/repos/${fullName}/commits/${branch}`, token)
  return {
    sha:      data.sha,
    shortSha: data.sha.slice(0, 7),
    message:  data.commit.message.split('\n')[0].slice(0, 80),
    author:   (data.commit.author?.name || data.commit.committer?.name || 'Unknown').slice(0, 28),
    date:     data.commit.author?.date || data.commit.committer?.date
  }
}

// ─── Tray ──────────────────────────────────────────────────────────────────
function makeTrayIcon(status) {
  const fill = status === 'current' ? '#22c55e' : status === 'behind' ? '#ef4444' : '#94a3b8'
  const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#0f172a"/><circle cx="5" cy="4.5" r="1.5" fill="${fill}"/><circle cx="5" cy="11.5" r="1.5" fill="${fill}"/><circle cx="11" cy="4.5" r="1.5" fill="${fill}"/><line x1="5" y1="6" x2="5" y2="10" stroke="${fill}" stroke-width="1.2" stroke-linecap="round"/><path d="M5 9.5 C6 6.5 8.5 5 11 5" stroke="${fill}" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`
  return nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'))
}

function setTrayStatus(status) {
  tray?.setImage(makeTrayIcon(status))
}

// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const s = readSettings()
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const [x, y] = s.position || [sw - W - 20, 20]

  win = new BrowserWindow({
    width: W, height: H_BAR, x, y,
    frame: false, alwaysOnTop: true, resizable: false,
    skipTaskbar: true, transparent: true, hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  win.on('moved', () => {
    const [wx, wy] = win.getPosition()
    const cfg = readSettings(); cfg.position = [wx, wy]; writeSettings(cfg)
  })
  win.on('closed', () => { win = null })
}

function createTray() {
  tray = new Tray(makeTrayIcon('idle'))
  tray.setToolTip('GitPulse')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show',            click: () => win?.show() },
    { type: 'separator' },
    { label: 'Quit GitPulse',   click: () => app.quit() }
  ]))
  tray.on('click', () => win?.show())
}

function startTimer(minutes = 5) {
  clearInterval(refreshTimer)
  refreshTimer = setInterval(() => win?.webContents.send('widget:tick'), minutes * 60 * 1000)
}

// ─── IPC ───────────────────────────────────────────────────────────────────
ipcMain.handle('widget:get-settings', () => {
  const s = readSettings()
  return { ...s, hasToken: !!readToken() }
})

ipcMain.handle('widget:save-token', (_, token) => { writeToken(token.trim()); return { ok: true } })
ipcMain.handle('widget:clear-token', () => { clearToken(); return { ok: true } })

ipcMain.handle('widget:fetch-repos', async () => {
  const token = readToken()
  if (!token) return { error: 'No token configured' }
  try { return { repos: await listRepos(token) } }
  catch (e) { return { error: e.message } }
})

ipcMain.handle('widget:fetch-status', async (_, { fullName, branch }) => {
  const token = readToken()
  if (!token) return { error: 'No token configured' }
  try {
    const commit = await getLatestCommit(fullName, branch, token)
    const s      = readSettings()
    const acked  = s.acknowledgedShas?.[fullName]
    if (!acked) {
      if (!s.acknowledgedShas) s.acknowledgedShas = {}
      s.acknowledgedShas[fullName] = commit.sha
      writeSettings(s)
      setTrayStatus('current')
      return { commit, behind: false }
    }
    const behind = acked !== commit.sha
    setTrayStatus(behind ? 'behind' : 'current')
    return { commit, behind }
  } catch (e) {
    setTrayStatus('idle')
    return { error: e.message }
  }
})

ipcMain.handle('widget:acknowledge', (_, { fullName, sha }) => {
  const s = readSettings()
  if (!s.acknowledgedShas) s.acknowledgedShas = {}
  s.acknowledgedShas[fullName] = sha
  writeSettings(s)
  setTrayStatus('current')
  return { ok: true }
})

ipcMain.handle('widget:select-repo', (_, repo) => {
  const s = readSettings()
  s.selectedRepo   = repo.full_name
  s.selectedBranch = repo.default_branch
  writeSettings(s)
  return { ok: true }
})

ipcMain.handle('widget:set-refresh', (_, minutes) => {
  const s = readSettings(); s.refreshInterval = minutes; writeSettings(s)
  startTimer(minutes); return { ok: true }
})

ipcMain.handle('widget:set-height', (_, h) => {
  if (!win) return { ok: false }
  const [currentW] = win.getSize()
  win.setSize(currentW, h, true)
  return { ok: true }
})

ipcMain.handle('widget:open-external', (_, url) => shell.openExternal(url))

ipcMain.handle('widget:pick-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select local repository folder',
    buttonLabel: 'Use this folder'
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('widget:get-local-path', (_, fullName) => {
  const s = readSettings()
  return s.localPaths?.[fullName] ?? null
})

ipcMain.handle('widget:set-local-path', (_, { fullName, localPath }) => {
  const s = readSettings()
  if (!s.localPaths) s.localPaths = {}
  s.localPaths[fullName] = localPath
  writeSettings(s)
  return { ok: true }
})

ipcMain.handle('widget:run-pull', (_, { localPath }) => {
  return new Promise(resolve => {
    exec('git pull', { cwd: localPath, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) resolve({ error: (stderr || err.message).trim().slice(0, 120) })
      else     resolve({ ok: true, output: stdout.trim().slice(0, 120) })
    })
  })
})

ipcMain.handle('widget:hide', () => win?.hide())
ipcMain.handle('widget:quit', () => app.quit())

// ─── Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide()
  if (process.platform === 'win32') app.setAppUserModelId('com.gitpulse.widget')

  createWindow()
  createTray()
  startTimer(readSettings().refreshInterval || 5)
})

app.on('window-all-closed', e => e.preventDefault())
app.on('before-quit', () => clearInterval(refreshTimer))
