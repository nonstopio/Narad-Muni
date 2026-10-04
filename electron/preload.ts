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
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    add: () => ipcRenderer.invoke("projects:add"),
    update: (patch: unknown) => ipcRenderer.invoke("projects:update", patch),
    remove: (id: string) => ipcRenderer.invoke("projects:remove", { id }),
    setTimeZone: (tz: string | null) => ipcRenderer.invoke("projects:setTimeZone", tz),
  },
});
