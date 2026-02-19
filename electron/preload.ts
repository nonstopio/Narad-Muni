import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal API to the renderer process.
// contextIsolation: true, nodeIntegration: false — secure by default.
contextBridge.exposeInMainWorld("narada", {
  isElectron: true,
  pickFilePath: (): Promise<string | null> => ipcRenderer.invoke("pick-file-path"),
});
