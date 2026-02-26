import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal API to the renderer process.
// contextIsolation: true, nodeIntegration: false — secure by default.
contextBridge.exposeInMainWorld("narada", {
  isElectron: true,
  pickFilePath: (): Promise<string | null> => ipcRenderer.invoke("pick-file-path"),
  reloadNotificationSchedule: (config: {
    notificationsEnabled: boolean;
    notificationHour: number;
    notificationMinute: number;
    notificationDays: string;
  }): Promise<void> => ipcRenderer.invoke("reload-notification-schedule", config),
  testNotification: (): Promise<void> => ipcRenderer.invoke("test-notification"),
});
