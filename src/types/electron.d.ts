declare global {
  interface Window {
    narada?: {
      isElectron: boolean;
      setFirebaseUser: (uid: string | null) => Promise<void>;
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
