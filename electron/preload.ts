import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal API to the renderer process.
// contextIsolation: true, nodeIntegration: false — secure by default.
contextBridge.exposeInMainWorld("narada", {
  isElectron: true,
  setFirebaseUser: (uid: string | null): Promise<void> =>
    ipcRenderer.invoke("set-firebase-user", uid),
  reloadNotificationSchedule: (config: {
    notificationsEnabled: boolean;
    notificationHour: number;
    notificationMinute: number;
    notificationDays: string;
  }): Promise<void> => ipcRenderer.invoke("reload-notification-schedule", config),
  testNotification: (): Promise<void> => ipcRenderer.invoke("test-notification"),
});
