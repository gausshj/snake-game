const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const {
  ensureUserConfigFile,
  getUserConfigPath,
  loadAppConfig
} = require("./config.cjs");

function createWindow() {
  const { config } = loadAppConfig(app);
  const mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    autoHideMenuBar: true,
    backgroundColor: config.window.backgroundColor,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true
    }
  });

  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  ensureUserConfigFile(app);

  ipcMain.handle("config:get", () => loadAppConfig(app));
  ipcMain.handle("config:reload", () => loadAppConfig(app));
  ipcMain.handle("config:open-directory", async () => {
    const targetPath = path.dirname(getUserConfigPath(app));
    return shell.openPath(targetPath);
  });
  ipcMain.handle("config:open-file", async () => shell.openPath(getUserConfigPath(app)));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
