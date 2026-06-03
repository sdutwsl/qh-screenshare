import { contextBridge, ipcRenderer } from "electron";

export interface AppConfig {
  signalingUrl: string;
}

contextBridge.exposeInMainWorld("viewerAPI", {
  getAppConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke("viewer-get-app-config"),
});
