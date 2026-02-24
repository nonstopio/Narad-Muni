import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal API to the renderer process.
// contextIsolation: true, nodeIntegration: false — secure by default.
contextBridge.exposeInMainWorld("narada", {
  isElectron: true,
  pickFilePath: (): Promise<string | null> => ipcRenderer.invoke("pick-file-path"),
  onUpdateStatus: (
    callback: (event: unknown, data: { status: string; progress?: number; version?: string }) => void
  ): (() => void) => {
    ipcRenderer.on("update:status", callback);
    return () => {
      ipcRenderer.removeListener("update:status", callback);
    };
  },
});
