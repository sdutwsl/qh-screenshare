import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function loadEnvFile(): void {
  const candidatePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "../..", ".env"),
    join(__dirname, "../../../", ".env"),
    join(__dirname, "../../../../", ".env"),
  ];
  const envPath = candidatePaths.find((p) => existsSync(p));
  if (!envPath) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = join(__dirname, "../preload/preload.js");

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 640,
    minHeight: 400,
    title: "UOS Screen Share Viewer",
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

  ipcMain.handle("viewer-get-app-config", () => {
    return {
      signalingUrl: process.env.SIGNALING_URL || "ws://localhost:3000",
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
