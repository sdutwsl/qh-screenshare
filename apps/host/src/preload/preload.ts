import { contextBridge, ipcRenderer } from "electron";

export interface RuntimeInfo {
  xdgSessionType: string;
  display: string;
  waylandDisplay: string;
  xdgCurrentDesktop: string;
  desktopSession: string;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
}

export interface AppConfig {
  signalingUrl: string;
  viewerPublicUrl: string;
}

contextBridge.exposeInMainWorld("hostAPI", {
  getRuntimeInfo: (): Promise<RuntimeInfo> =>
    ipcRenderer.invoke("get-runtime-info"),
  getAppConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke("get-app-config"),
});
