const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('widget', {
  getSettings:   ()    => ipcRenderer.invoke('widget:get-settings'),
  saveToken:     (t)   => ipcRenderer.invoke('widget:save-token', t),
  clearToken:    ()    => ipcRenderer.invoke('widget:clear-token'),
  getUser:       ()    => ipcRenderer.invoke('widget:get-user'),
  fetchRepos:    ()    => ipcRenderer.invoke('widget:fetch-repos'),
  fetchStatus:   (p)   => ipcRenderer.invoke('widget:fetch-status', p),
  acknowledge:   (p)   => ipcRenderer.invoke('widget:acknowledge', p),
  selectRepo:    (r)   => ipcRenderer.invoke('widget:select-repo', r),
  setRefresh:    (m)   => ipcRenderer.invoke('widget:set-refresh', m),
  setHeight:     (h)   => ipcRenderer.invoke('widget:set-height', h),
  openExternal:  (url) => ipcRenderer.invoke('widget:open-external', url),
  pickFolder:    ()    => ipcRenderer.invoke('widget:pick-folder'),
  getLocalPath:  (fn)  => ipcRenderer.invoke('widget:get-local-path', fn),
  setLocalPath:  (p)   => ipcRenderer.invoke('widget:set-local-path', p),
  runPull:       (p)   => ipcRenderer.invoke('widget:run-pull', p),
  hide:          ()    => ipcRenderer.invoke('widget:hide'),
  quit:          ()    => ipcRenderer.invoke('widget:quit'),
  onTick:        (fn)  => ipcRenderer.on('widget:tick', fn)
})
