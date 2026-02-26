declare global {
  interface Window {
    narada?: {
      isElectron: boolean;
      pickFilePath: () => Promise<string | null>;
      reloadNotificationSchedule: (config: {
        notificationsEnabled: boolean;
        notificationHour: number;
        notificationMinute: number;
        notificationDays: string;
      }) => Promise<void>;
      testNotification: () => Promise<void>;
    };
  }
}

export {};
