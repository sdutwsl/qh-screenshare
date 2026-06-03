import { app, BrowserWindow, ipcMain, session, desktopCapturer } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = join(__dirname, "../preload/preload.js");

  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 400,
    minHeight: 500,
    title: "UOS Screen Share",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen", "window"] }).then((sources) => {
      callback({ video: sources[0] });
    });
  });

  ipcMain.handle("get-runtime-info", () => {
    return {
      xdgSessionType: process.env.XDG_SESSION_TYPE || "unknown",
      display: process.env.DISPLAY || "-",
      waylandDisplay: process.env.WAYLAND_DISPLAY || "-",
      xdgCurrentDesktop: process.env.XDG_CURRENT_DESKTOP || "unknown",
      desktopSession: process.env.DESKTOP_SESSION || "unknown",
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron || "unknown",
      nodeVersion: process.versions.node || "unknown",
    };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
