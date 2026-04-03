const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("snakeDesktop", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  reloadConfig: () => ipcRenderer.invoke("config:reload"),
  openConfigDirectory: () => ipcRenderer.invoke("config:open-directory"),
  openConfigFile: () => ipcRenderer.invoke("config:open-file")
});
