'use strict'

const w = window.widget

// ─── State ─────────────────────────────────────────────────────────────────
const state = {
  hasToken:     false,
  repos:        [],
  selectedRepo: null,   // { name, full_name, default_branch }
  status:       null,   // { commit, behind } | { error } | null
  loading:      false,
  settingsOpen: false,
  dropdownOpen: false,
  lastChecked:  null
}

// ─── DOM ───────────────────────────────────────────────────────────────────
const el = (id) => document.getElementById(id)

const widget        = document.querySelector('.widget')
const settingsBtn   = el('settingsBtn')
const closeBtn      = el('closeBtn')
const refreshBtn    = el('refreshBtn')
const expandBtn     = el('expandBtn')
const compactInfo   = el('compactInfo')
const dropdownTrig  = el('dropdownTrigger')
const dropdownMenu  = el('dropdownMenu')
const dropdownLabel = el('dropdownLabel')
const statusContent = el('statusContent')
const settingsPanel = el('settingsPanel')
const tokenInput    = el('tokenInput')
const connectBtn    = el('connectBtn')
const refreshSelect = el('refreshSelect')
const disconnectBtn = el('disconnectBtn')
const tokenDocsBtn  = el('tokenDocsBtn')

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
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (secs < 60)    return 'just now'
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ─── Render status ─────────────────────────────────────────────────────────
function renderStatus() {
  if (!state.selectedRepo) {
    statusContent.className = 'state-idle'
    statusContent.innerHTML = '<span class="idle-text">Select a repository to begin</span>'
    return
  }

  if (state.loading) {
    statusContent.className = 'state-loading'
    statusContent.innerHTML = `
      <div class="skeleton sk-short" style="margin-top:3px"></div>
      <div class="skeleton sk-long"></div>
    `
    return
  }

  const s = state.status
  if (!s) return

  if (s.error) {
    statusContent.className = 'state-error'
    statusContent.innerHTML = `
      <div class="error-dot" role="img" aria-label="Warning"></div>
      <span class="error-msg">${esc(s.error)}</span>
    `
    return
  }

  const { commit, behind } = s
  const dot   = behind ? 'red'   : 'green'
  const label = behind ? 'Behind remote' : 'Up to date'
  const checkedStr = state.lastChecked ? reltime(state.lastChecked.toISOString()) : ''
  const commitStr  = commit.date ? reltime(commit.date) : ''

  statusContent.className = 'state-commit'
  statusContent.innerHTML = `
    <div class="commit-top">
      <div class="status-dot ${dot}" role="img" aria-label="${esc(label)}"></div>
      <span class="status-label ${dot}">${esc(label)}</span>
    </div>
    <div class="commit-meta">
      <span class="commit-author">${esc(commit.author)}</span>
      <span class="meta-dot">·</span>
      <span class="commit-sha">${esc(commit.shortSha)}</span>
      ${commitStr ? `<span class="meta-dot">·</span><span class="commit-date">${esc(commitStr)}</span>` : ''}
    </div>
    <div class="commit-message" title="${esc(commit.message)}">${esc(commit.message)}</div>
    <div class="commit-footer">
      <span class="checked-time">${checkedStr ? `checked ${esc(checkedStr)}` : ''}</span>
      ${behind ? `<button class="pull-btn" id="pullBtn">Pull</button>` : ''}
    </div>
  `

  if (behind) {
    el('pullBtn')?.addEventListener('click', () => runPull(commit.sha))
  }
}

// ─── Status fetch ──────────────────────────────────────────────────────────
async function fetchStatus() {
  if (!state.selectedRepo) return
  state.loading = true
  renderStatus()

  const result = await w.fetchStatus({
    fullName: state.selectedRepo.full_name,
    branch:   state.selectedRepo.default_branch
  })

  state.status      = result
  state.loading     = false
  state.lastChecked = new Date()
  renderStatus()

  // Collapse to compact bar after a successful status fetch
  if (!result.error) {
    await collapseToCompact()
  }
}

async function runPull(sha) {
  const fullName = state.selectedRepo.full_name
  const btn = el('pullBtn')
  if (btn) { btn.disabled = true; btn.textContent = 'Pulling...' }

  // Resolve local path: use saved path or prompt user to pick folder
  let localPath = await w.getLocalPath(fullName)

  if (!localPath) {
    localPath = await w.pickFolder()
    if (!localPath) {
      // User cancelled; just mark as acknowledged
      await w.acknowledge({ fullName, sha })
      if (state.status) state.status = { ...state.status, behind: false }
      renderStatus()
      return
    }
    await w.setLocalPath({ fullName, localPath })
  }

  const result = await w.runPull({ localPath })

  if (result.error) {
    // Show error briefly in status, then restore
    statusContent.className = 'state-error'
    statusContent.innerHTML = `
      <div class="error-dot" role="img" aria-label="Warning"></div>
      <span class="error-msg">Pull failed: ${esc(result.error)}</span>
    `
    setTimeout(() => renderStatus(), 4000)
    return
  }

  // Success: acknowledge and refresh
  await w.acknowledge({ fullName, sha })
  await fetchStatus()
}

// ─── Repos ─────────────────────────────────────────────────────────────────
async function loadRepos() {
  const result = await w.fetchRepos()
  if (result.error) {
    state.status  = { error: result.error }
    state.loading = false
    renderStatus()
    return false
  }
  state.repos = result.repos
  return true
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
    >${r.private ? '<span class="repo-lock" aria-label="Private">&#x1F512;</span>' : ''}${esc(r.full_name)}</button>
  `).join('')

  dropdownMenu.querySelectorAll('.dropdown-option').forEach(btn => {
    btn.addEventListener('click', () => selectRepo({
      full_name:      btn.dataset.full,
      default_branch: btn.dataset.branch,
      name:           btn.dataset.name
    }))
  })
}

async function openDropdown() {
  if (!state.hasToken) { openSettings(); return }
  if (!state.repos.length) {
    const ok = await loadRepos()
    if (!ok) return
  }
  state.dropdownOpen = true
  dropdownMenu.hidden = false
  dropdownTrig.setAttribute('aria-expanded', 'true')
  await w.setHeight(300)
  renderDropdown()
  dropdownMenu.querySelector('.is-selected, .dropdown-option')?.focus()
}

async function closeDropdown() {
  if (!state.dropdownOpen) return
  state.dropdownOpen = false
  dropdownMenu.hidden = true
  dropdownTrig.setAttribute('aria-expanded', 'false')
  await w.setHeight(state.settingsOpen ? H_SETTINGS : H_COLLAPSED)
}

const H_COMPACT   = 42
const H_COLLAPSED = 140
const H_SETTINGS  = 290

// ─── Repo selection ─────────────────────────────────────────────────────────
async function selectRepo(repo) {
  await closeDropdown()
  state.selectedRepo = repo
  dropdownLabel.textContent = repo.full_name
  dropdownLabel.classList.add('has-value')
  await w.selectRepo(repo)
  await fetchStatus()
}

// ─── Compact mode ──────────────────────────────────────────────────────────
function renderCompactInfo() {
  const s = state.status
  if (!s || s.error || !s.commit) {
    compactInfo.innerHTML = '<span class="compact-msg" style="color:var(--text-3)">Checking...</span>'
    return
  }

  const { commit, behind } = s
  const dot = behind ? 'red' : 'green'
  const repoShort = state.selectedRepo?.name || state.selectedRepo?.full_name || ''

  compactInfo.innerHTML = `
    <div class="status-dot ${dot}" role="img" aria-label="${behind ? 'Behind remote' : 'Up to date'}"></div>
    <span class="compact-repo">${esc(repoShort)}</span>
    <span class="compact-sep">·</span>
    <span class="compact-author">${esc(commit.author)}</span>
    <span class="compact-sep">·</span>
    <span class="compact-sha">${esc(commit.shortSha)}</span>
    <span class="compact-sep">·</span>
    <span class="compact-msg">${esc(commit.message)}</span>
  `
}

async function collapseToCompact() {
  if (state.settingsOpen) await closeSettings()
  if (state.dropdownOpen) await closeDropdown()
  renderCompactInfo()
  widget.classList.add('is-compact')
  expandBtn.hidden = false
  await w.setHeight(H_COMPACT)
}

async function expandToFull() {
  widget.classList.remove('is-compact')
  expandBtn.hidden = true
  await w.setHeight(state.settingsOpen ? H_SETTINGS : H_COLLAPSED)
}

// ─── Settings ──────────────────────────────────────────────────────────────
async function openSettings() {
  if (state.settingsOpen) return
  if (widget.classList.contains('is-compact')) await expandToFull()
  if (state.dropdownOpen) await closeDropdown()
  state.settingsOpen = true
  settingsPanel.hidden = false
  settingsPanel.setAttribute('aria-hidden', 'false')
  settingsBtn.classList.add('is-active')
  await w.setHeight(H_SETTINGS)
  setTimeout(() => tokenInput.focus(), 60)
}

async function closeSettings() {
  if (!state.settingsOpen) return
  state.settingsOpen = false
  settingsPanel.hidden = true
  settingsPanel.setAttribute('aria-hidden', 'true')
  settingsBtn.classList.remove('is-active')

  // Return to compact if a repo is already selected and has a status
  if (state.selectedRepo && state.status && !state.status.error) {
    await collapseToCompact()
  } else {
    await w.setHeight(H_COLLAPSED)
  }
}

function toggleSettings() {
  state.settingsOpen ? closeSettings() : openSettings()
}

// ─── Auth ───────────────────────────────────────────────────────────────────
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
  disconnectBtn.hidden = false
  await closeSettings()
  await openDropdown()
}

async function disconnect() {
  await w.clearToken()
  state.hasToken     = false
  state.repos        = []
  state.selectedRepo = null
  state.status       = null
  dropdownLabel.textContent = 'Select a repository'
  dropdownLabel.classList.remove('has-value')
  disconnectBtn.hidden = true
  renderStatus()
}

// ─── Auto-refresh ───────────────────────────────────────────────────────────
w.onTick(async () => {
  // If compact, update compact info in place without expanding
  if (widget.classList.contains('is-compact') && state.selectedRepo) {
    const result = await w.fetchStatus({
      fullName: state.selectedRepo.full_name,
      branch:   state.selectedRepo.default_branch
    })
    state.status      = result
    state.lastChecked = new Date()
    renderStatus()
    renderCompactInfo()
  } else {
    fetchStatus()
  }
})

// ─── Event wiring ───────────────────────────────────────────────────────────
expandBtn.addEventListener('click', expandToFull)
settingsBtn.addEventListener('click', toggleSettings)

closeBtn.addEventListener('click', () => w.hide())

dropdownTrig.addEventListener('click', e => {
  e.stopPropagation()
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.dropdownOpen) closeDropdown()
})

refreshBtn.addEventListener('click', async () => {
  refreshBtn.classList.add('spinning')
  setTimeout(() => refreshBtn.classList.remove('spinning'), 700)

  // If currently compact, refresh in place (don't expand)
  if (widget.classList.contains('is-compact') && state.selectedRepo) {
    const result = await w.fetchStatus({
      fullName: state.selectedRepo.full_name,
      branch:   state.selectedRepo.default_branch
    })
    state.status      = result
    state.lastChecked = new Date()
    renderStatus()
    renderCompactInfo()
  } else {
    fetchStatus()
  }
})

connectBtn.addEventListener('click', connect)

tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') connect() })

disconnectBtn.addEventListener('click', disconnect)

refreshSelect.addEventListener('change', e => {
  w.setRefresh(parseInt(e.target.value, 10))
})

tokenDocsBtn.addEventListener('click', () => {
  w.openExternal('https://github.com/settings/tokens/new?scopes=repo&description=GitPulse+Widget')
})

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const s = await w.getSettings()
  state.hasToken = s.hasToken

  if (s.refreshInterval) {
    const opt = refreshSelect.querySelector(`option[value="${s.refreshInterval}"]`)
    if (opt) opt.selected = true
  }

  if (!s.hasToken) {
    openSettings()
    return
  }

  disconnectBtn.hidden = false

  const ok = await loadRepos()
  if (!ok) return

  if (s.selectedRepo) {
    const repo = state.repos.find(r => r.full_name === s.selectedRepo)
    if (repo) {
      state.selectedRepo = repo
      dropdownLabel.textContent = repo.full_name
      dropdownLabel.classList.add('has-value')
      await fetchStatus()
      return
    }
  }

  renderStatus()
}

init()
