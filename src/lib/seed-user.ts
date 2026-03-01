import { adminDb } from "./firebase-admin";
import { settingsDoc, configsCol } from "./firestore-helpers";

/**
 * Seed default configs for a first-time user.
 * Checks if settings/app exists; if not, creates default platform configs and app settings.
 * Called after first login.
 */
export async function seedUserIfNeeded(userId: string): Promise<void> {
  const settingsRef = settingsDoc(userId);
  const configs = configsCol(userId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(settingsRef);
    if (snap.exists) return; // Already seeded

    // Default Slack config
    tx.set(configs.doc("SLACK"), {
      platform: "SLACK",
      userName: "",
      userId: "",
      webhookUrl: "",
      slackBotToken: "",
      slackChannelId: "",
      slackThreadMode: true,
      slackThreadMatch: "",
      slackWorkflowTime: "",
      isActive: true,
      repeatEntries: [],
    });

    // Default Teams config
    tx.set(configs.doc("TEAMS"), {
      platform: "TEAMS",
      userName: "",
      userId: "",
      webhookUrl: "",
      isActive: true,
      repeatEntries: [],
    });

    // Default Jira config
    tx.set(configs.doc("JIRA"), {
      platform: "JIRA",
      baseUrl: "",
      projectKey: "",
      email: "",
      apiToken: "",
      timezone: "Asia/Kolkata",
      isActive: true,
      repeatEntries: [],
    });

    // Default app settings
    tx.set(settingsRef, {
      aiProvider: "local-claude",
      notificationsEnabled: false,
      notificationHour: 10,
      notificationMinute: 0,
      notificationDays: "1,2,3,4,5",
    });

    console.log(`[Narada] Seeded default configs for user ${userId}`);
  });
}
