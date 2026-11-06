import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal API to the renderer process.
// contextIsolation: true, nodeIntegration: false — secure by default.
contextBridge.exposeInMainWorld("narada", {
  isElectron: true,
  drafts: {
    read: (uid: string, date: string) => ipcRenderer.sendSync("drafts:read", uid, date),
    write: (uid: string, date: string, value: unknown) => ipcRenderer.sendSync("drafts:write", uid, date, value),
    list: (uid: string) => ipcRenderer.sendSync("drafts:list", uid),
    remove: (uid: string, date: string) => ipcRenderer.sendSync("drafts:remove", uid, date),
  },
  setFirebaseUser: (uid: string | null): Promise<void> =>
    ipcRenderer.invoke("set-firebase-user", uid),
  reloadNotificationSchedule: (config: {
    notificationsEnabled: boolean;
    notificationHour: number;
    notificationMinute: number;
    notificationDays: string;
  }): Promise<void> => ipcRenderer.invoke("reload-notification-schedule", config),
  testNotification: (): Promise<void> => ipcRenderer.invoke("test-notification"),
  updates: {
    readyVersion: (): Promise<string | null> => ipcRenderer.invoke("updater:ready-version"),
    install: (): Promise<void> => ipcRenderer.invoke("updater:install"),
    onReady: (cb: (version: string | null) => void) => {
      const listener = (_e: unknown, version: string | null) => cb(version);
      ipcRenderer.on("updater:ready", listener);
      return () => { ipcRenderer.removeListener("updater:ready", listener); };
    },
  },
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    add: () => ipcRenderer.invoke("projects:add"),
    update: (patch: unknown) => ipcRenderer.invoke("projects:update", patch),
    remove: (id: string) => ipcRenderer.invoke("projects:remove", { id }),
    setTimeZone: (tz: string | null) => ipcRenderer.invoke("projects:setTimeZone", tz),
    collect: (args: { date: string; timeZone: string }) => ipcRenderer.invoke("projects:collect", args),
  },
});
