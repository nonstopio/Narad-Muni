import type { LocalProject, ProjectCollectResult } from "./index";

type ProjectsError = { error: "signed-out" };

declare global {
  interface Window {
    narada?: {
      isElectron: boolean;
      drafts: {
        read: (uid: string, date: string) => { value?: unknown; error?: string };
        write: (uid: string, date: string, value: unknown) => { error?: string };
        list: (uid: string) => { value?: string[]; error?: string };
        remove: (uid: string, date: string) => { error?: string };
      };
      setFirebaseUser: (uid: string | null) => Promise<void>;
      reloadNotificationSchedule: (config: {
        notificationsEnabled: boolean;
        notificationHour: number;
        notificationMinute: number;
        notificationDays: string;
      }) => Promise<void>;
      testNotification: () => Promise<void>;
      projects: {
        list: () => Promise<{ workdayTimeZone: string | null; projects: LocalProject[] } | ProjectsError>;
        add: () => Promise<
          | { project: LocalProject }
          | { error: "signed-out" | "cancelled" | "not-a-repo" | "git-missing" }
          | { error: "duplicate"; name: string }
        >;
        update: (patch: {
          id: string;
          name?: string;
          enabled?: boolean;
          authorEmails?: string[];
        }) => Promise<{ project: LocalProject } | ProjectsError>;
        remove: (id: string) => Promise<{ ok: true } | ProjectsError>;
        setTimeZone: (tz: string | null) => Promise<{ workdayTimeZone: string | null } | ProjectsError>;
        collect: (args: { date: string; timeZone: string }) => Promise<ProjectCollectResult>;
      };
    };
  }
}

export {};
