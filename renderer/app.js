'use strict'

const w = window.widget

// ─── Heights ───────────────────────────────────────────────────────────────
const H_BAR                    = 42
const H_EXPANDED               = 280
const H_WITH_SETTINGS          = 450
const H_WITH_SETTINGS_CONNECTED = 406
const MSG_EXTRA                = 60

// ─── State ─────────────────────────────────────────────────────────────────
const state = {
  hasToken:     false,
  username:     null,
  repos:        [],
  selectedRepo: null,
  status:       null,
  loading:      false,
  panelOpen:    false,
  settingsOpen: false,
  dropdownOpen: false,
  lastChecked:  null,
  msgExpanded:  false
}

// ─── DOM ───────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id)

const barLeft       = el('barLeft')
const barDot        = el('barDot')
const barLabel      = el('barLabel')
const chevronBtn    = el('chevronBtn')
const closeBtn      = el('closeBtn')
const panel         = el('panel')
const dropdownTrig  = el('dropdownTrigger')
const dropdownMenu  = el('dropdownMenu')
const dropdownLabel = el('dropdownLabel')
const panelCommit   = el('panelCommit')
const pullBtn       = el('pullBtn')
const refreshBtn    = el('refreshBtn')
const settingsBtn   = el('settingsBtn')
const settingsPanel    = el('settingsPanel')
const tokenForm        = el('tokenForm')
const tokenConnected   = el('tokenConnected')
const connectedUsername = el('connectedUsername')
const tokenInput       = el('tokenInput')
const connectBtn       = el('connectBtn')
const disconnectBtn    = el('disconnectBtn')
const refreshSelect    = el('refreshSelect')
const tokenDocsBtn     = el('tokenDocsBtn')

// ─── Helpers ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function reltime(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Bar updates ───────────────────────────────────────────────────────────
function updateBar() {
  if (!state.selectedRepo) {
    barDot.className   = 'status-dot idle'
    barDot.setAttribute('aria-label', 'Idle')
    barLabel.textContent = 'GitPulse'
    barLabel.classList.remove('has-repo')
    pullBtn.disabled = true
    pullBtn.classList.remove('is-current')
    return
  }

  barLabel.textContent = state.selectedRepo.name
  barLabel.classList.add('has-repo')

  if (state.loading) {
    barDot.className = 'status-dot loading'
    barDot.setAttribute('aria-label', 'Checking')
    return
  }

  const s = state.status
  if (!s) return

  if (s.error) {
    barDot.className = 'status-dot amber'
    barDot.setAttribute('aria-label', 'Error')
    pullBtn.disabled = true
    return
  }

  if (s.behind) {
    barDot.className = 'status-dot red'
    barDot.setAttribute('aria-label', 'Behind remote')
    pullBtn.disabled = false
    pullBtn.classList.remove('is-current')
    pullBtn.textContent = 'Pull'
  } else {
    barDot.className = 'status-dot green'
    barDot.setAttribute('aria-label', 'Up to date')
    pullBtn.disabled = false
    pullBtn.classList.add('is-current')
    pullBtn.textContent = 'Up to date'
  }
}

// ─── Commit panel ──────────────────────────────────────────────────────────
function renderCommitPanel() {
  if (!state.selectedRepo) {
    panelCommit.innerHTML = '<span class="commit-prompt">Select a repository above</span>'
    return
  }

  if (state.loading) {
    panelCommit.innerHTML = `
      <div class="commit-loading">
        <div class="skeleton sk-60"></div>
        <div class="skeleton sk-85"></div>
        <div class="skeleton sk-40"></div>
      </div>`
    return
  }

  const s = state.status
  if (!s) return

  if (s.error) {
    panelCommit.innerHTML = `
      <div class="commit-error">
        <div class="status-dot amber" role="img" aria-label="Error"></div>
        <span class="error-text">${esc(s.error)}</span>
      </div>`
    return
  }

  const { commit, behind } = s
  const dot   = behind ? 'red' : 'green'
  const label = behind ? 'Behind remote' : 'Up to date'
  const checked    = state.lastChecked ? reltime(state.lastChecked.toISOString()) : ''
  const cdate      = commit.date ? reltime(commit.date) : ''
  const canExpand  = commit.message.length > 24
  const expanded   = state.msgExpanded

  panelCommit.innerHTML = `
    <div class="commit-info">
      <div class="commit-status-row">
        <div class="status-dot ${dot}" role="img" aria-label="${esc(label)}"></div>
        <span class="status-label ${dot}">${esc(label)}</span>
      </div>
      <div class="commit-meta">
        <span class="commit-author">${esc(commit.author)}</span>
        <span class="meta-dot">·</span>
        <span class="commit-sha">${esc(commit.shortSha)}</span>
        ${cdate ? `<span class="meta-dot">·</span><span class="commit-date">${esc(cdate)}</span>` : ''}
      </div>
      <div class="commit-message${expanded ? ' expanded' : ''}" title="${esc(commit.message)}">${esc(commit.message)}</div>
      ${canExpand ? `<button class="msg-toggle" id="msgToggle">${expanded ? '▲ Show less' : '▼ Show more'}</button>` : ''}
      ${checked ? `<div class="commit-date" style="margin-top:1px">checked ${esc(checked)}</div>` : ''}
    </div>`

  if (canExpand) {
    el('msgToggle').addEventListener('click', async () => {
      state.msgExpanded = !state.msgExpanded
      renderCommitPanel()
      await applyHeight()
    })
  }
}

// ─── Height helper ─────────────────────────────────────────────────────────
async function applyHeight() {
  if (!state.panelOpen) { await w.setHeight(H_BAR); return }
  let h
  if (state.settingsOpen) {
    h = state.hasToken ? H_WITH_SETTINGS_CONNECTED : H_WITH_SETTINGS
  } else {
    h = H_EXPANDED
  }
  if (state.msgExpanded) h += MSG_EXTRA
  await w.setHeight(h)
}

// ─── Panel open/close ──────────────────────────────────────────────────────
async function openPanel() {
  if (state.panelOpen) return
  state.panelOpen = true
  panel.hidden = false
  chevronBtn.classList.add('open')
  await applyHeight()
}

async function closePanel() {
  if (!state.panelOpen) return
  if (state.settingsOpen) await closeSettings()
  if (state.dropdownOpen) closeDropdown()
  state.msgExpanded = false
  state.panelOpen = false
  panel.hidden = true
  chevronBtn.classList.remove('open')
  await applyHeight()
}

async function togglePanel() {
  state.panelOpen ? closePanel() : openPanel()
}

// ─── Settings ──────────────────────────────────────────────────────────────
async function openSettings() {
  if (state.settingsOpen) return
  if (!state.panelOpen) await openPanel()
  state.settingsOpen = true
  settingsPanel.hidden = false
  settingsPanel.setAttribute('aria-hidden', 'false')
  settingsBtn.classList.add('is-active')
  await applyHeight()
  setTimeout(() => tokenInput.focus(), 50)
}

async function closeSettings() {
  if (!state.settingsOpen) return
  state.settingsOpen = false
  settingsPanel.hidden = true
  settingsPanel.setAttribute('aria-hidden', 'true')
  settingsBtn.classList.remove('is-active')
  await applyHeight()
}

function toggleSettings() {
  state.settingsOpen ? closeSettings() : openSettings()
}

// ─── Dropdown ──────────────────────────────────────────────────────────────
function renderDropdown() {
  if (!state.repos.length) {
    dropdownMenu.innerHTML = '<div class="dropdown-empty">No repositories found</div>'
    return
  }
  dropdownMenu.innerHTML = state.repos.map(r => `
    <button
      class="dropdown-option${state.selectedRepo?.full_name === r.full_name ? ' is-selected' : ''}"
      data-full="${esc(r.full_name)}"
      data-branch="${esc(r.default_branch)}"
      data-name="${esc(r.name)}"
      role="option"
      aria-selected="${state.selectedRepo?.full_name === r.full_name}"
    >${r.private ? '<span class="repo-lock">&#x1F512;</span>' : ''}${esc(r.full_name)}</button>
  `).join('')

  dropdownMenu.querySelectorAll('.dropdown-option').forEach(btn => {
    btn.addEventListener('click', () => selectRepo({
      full_name:      btn.dataset.full,
      default_branch: btn.dataset.branch,
      name:           btn.dataset.name
    }))
  })
}

function openDropdown() {
  if (!state.repos.length) return
  state.dropdownOpen = true
  dropdownMenu.hidden = false
  dropdownTrig.setAttribute('aria-expanded', 'true')
  renderDropdown()
  dropdownMenu.querySelector('.is-selected, .dropdown-option')?.focus()
}

function closeDropdown() {
  if (!state.dropdownOpen) return
  state.dropdownOpen = false
  dropdownMenu.hidden = true
  dropdownTrig.setAttribute('aria-expanded', 'false')
}

// ─── Repo selection ─────────────────────────────────────────────────────────
async function selectRepo(repo) {
  closeDropdown()
  state.selectedRepo = repo
  dropdownLabel.textContent = repo.full_name
  dropdownLabel.classList.add('has-value')
  await w.selectRepo(repo)
  await fetchStatus()
}

// ─── Status fetch ───────────────────────────────────────────────────────────
async function fetchStatus() {
  if (!state.selectedRepo) return
  state.loading = true
  updateBar()
  renderCommitPanel()

  const result = await w.fetchStatus({
    fullName: state.selectedRepo.full_name,
    branch:   state.selectedRepo.default_branch
  })

  state.status      = result
  state.loading     = false
  state.lastChecked = new Date()
  updateBar()
  renderCommitPanel()
}

// ─── Pull ───────────────────────────────────────────────────────────────────
async function runPull() {
  const fullName = state.selectedRepo?.full_name
  if (!fullName || !state.status || state.status.error) return

  const sha = state.status.commit?.sha
  if (!sha) return

  pullBtn.disabled    = true
  pullBtn.textContent = 'Pulling...'

  let localPath = await w.getLocalPath(fullName)
  if (!localPath) {
    localPath = await w.pickFolder()
    if (!localPath) {
      updateBar()
      return
    }
    await w.setLocalPath({ fullName, localPath })
  }

  const result = await w.runPull({ localPath })

  if (result.error) {
    panelCommit.innerHTML = `
      <div class="commit-error">
        <div class="status-dot amber" role="img" aria-label="Error"></div>
        <span class="error-text">Pull failed: ${esc(result.error)}</span>
      </div>`
    pullBtn.disabled    = false
    pullBtn.textContent = 'Retry pull'
    setTimeout(() => { renderCommitPanel(); updateBar() }, 4000)
    return
  }

  await w.acknowledge({ fullName, sha })
  await fetchStatus()
}

// ─── Repos ──────────────────────────────────────────────────────────────────
async function loadRepos() {
  const result = await w.fetchRepos()
  if (result.error) {
    state.status = { error: result.error }
    updateBar()
    renderCommitPanel()
    return false
  }
  state.repos = result.repos
  return true
}

// ─── Auth ───────────────────────────────────────────────────────────────────
function showConnectedState(username) {
  connectedUsername.textContent = username || 'Connected'
  tokenForm.hidden      = true
  tokenConnected.hidden = false
}

function showDisconnectedState() {
  tokenForm.hidden      = false
  tokenConnected.hidden = true
}

async function connect() {
  const token = tokenInput.value.trim()
  if (!token) { tokenInput.focus(); return }

  connectBtn.disabled    = true
  connectBtn.textContent = 'Connecting...'

  await w.saveToken(token)
  const ok = await loadRepos()

  connectBtn.disabled    = false
  connectBtn.textContent = 'Connect'

  if (!ok) return

  state.hasToken = true
  tokenInput.value = ''

  const user = await w.getUser()
  state.username = user.login || null
  showConnectedState(state.username)

  await closeSettings()
  openDropdown()
}

async function disconnect() {
  await w.clearToken()
  state.hasToken     = false
  state.username     = null
  state.repos        = []
  state.selectedRepo = null
  state.status       = null
  dropdownLabel.textContent = 'Select a repository'
  dropdownLabel.classList.remove('has-value')
  showDisconnectedState()
  updateBar()
  renderCommitPanel()
}

// ─── Auto-refresh ───────────────────────────────────────────────────────────
w.onTick(() => fetchStatus())

// ─── Event listeners ────────────────────────────────────────────────────────
barLeft.addEventListener('click',    togglePanel)
chevronBtn.addEventListener('click', togglePanel)
closeBtn.addEventListener('click',   () => w.hide())

dropdownTrig.addEventListener('click', e => {
  e.stopPropagation()
  if (!state.hasToken) { openSettings(); return }
  if (!state.repos.length) { loadRepos().then(() => openDropdown()); return }
  state.dropdownOpen ? closeDropdown() : openDropdown()
})

dropdownTrig.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); openDropdown() }
})

dropdownMenu.addEventListener('keydown', e => {
  const opts = [...dropdownMenu.querySelectorAll('.dropdown-option')]
  const i    = opts.indexOf(document.activeElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); opts[i + 1]?.focus() }
  if (e.key === 'ArrowUp')   { e.preventDefault(); (i > 0 ? opts[i - 1] : dropdownTrig).focus() }
  if (e.key === 'Escape')    { closeDropdown(); dropdownTrig.focus() }
})

document.addEventListener('click', e => {
  if (!e.target.closest('#dropdown')) closeDropdown()
})

pullBtn.addEventListener('click',     runPull)
refreshBtn.addEventListener('click',  () => {
  refreshBtn.classList.add('spinning')
  setTimeout(() => refreshBtn.classList.remove('spinning'), 700)
  fetchStatus()
})
settingsBtn.addEventListener('click', toggleSettings)
connectBtn.addEventListener('click',  connect)
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') connect() })
disconnectBtn.addEventListener('click', disconnect)
refreshSelect.addEventListener('change', e => w.setRefresh(parseInt(e.target.value, 10)))
tokenDocsBtn.addEventListener('click', () => {
  w.openExternal('https://github.com/settings/tokens/new?scopes=repo&description=GitPulse+Widget')
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.dropdownOpen) { closeDropdown(); return }
    if (state.settingsOpen) { closeSettings(); return }
    if (state.panelOpen)    { closePanel() }
  }
})

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const s = await w.getSettings()
  state.hasToken = s.hasToken

  if (s.refreshInterval) {
    const opt = refreshSelect.querySelector(`option[value="${s.refreshInterval}"]`)
    if (opt) opt.selected = true
  }

  updateBar()
  renderCommitPanel()

  if (!s.hasToken) {
    showDisconnectedState()
    await openPanel()
    await openSettings()
    return
  }

  state.username = s.username || null
  showConnectedState(state.username)

  const ok = await loadRepos()
  if (!ok) return

  if (s.selectedRepo) {
    const repo = state.repos.find(r => r.full_name === s.selectedRepo)
    if (repo) {
      state.selectedRepo = repo
      dropdownLabel.textContent = repo.full_name
      dropdownLabel.classList.add('has-value')
      updateBar()
      await fetchStatus()
    }
  }
}

init()
