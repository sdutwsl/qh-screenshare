import { app, BrowserWindow, desktopCapturer, ipcMain, session } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;

// Required on many Wayland desktops for Chromium/Electron screen capture.
// Harmless on X11, and it lets xdg-desktop-portal/PipeWire participate when available.
app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");

function loadEnvFile(): void {
  const candidatePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "../..", ".env"),
    join(__dirname, "../../../", ".env"),
    join(__dirname, "../../../../", ".env"),
  ];
  const envPath = candidatePaths.find((path) => existsSync(path));
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
  const setDisplayMediaRequestHandler =
    session.defaultSession.setDisplayMediaRequestHandler.bind(
      session.defaultSession,
    ) as unknown as (
      handler: Parameters<typeof session.defaultSession.setDisplayMediaRequestHandler>[0],
      options?: { useSystemPicker?: boolean },
    ) => void;

  setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 320, height: 180 },
        });
        const firstSource = sources[0];

        if (!firstSource) {
          callback({});
          return;
        }

        callback({ video: firstSource });
      } catch {
        callback({});
      }
    },
    { useSystemPicker: true },
  );

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

  ipcMain.handle("get-app-config", () => {
    return {
      signalingUrl:
        process.env.VITE_SIGNALING_URL ||
        process.env.SIGNALING_WS_URL ||
        process.env.SIGNALING_URL ||
        "ws://localhost:3000",
      viewerPublicUrl:
        process.env.VITE_VIEWER_PUBLIC_URL ||
        process.env.VIEWER_PUBLIC_URL ||
        "http://localhost:5174",
    };
  });

  createWindow();

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
