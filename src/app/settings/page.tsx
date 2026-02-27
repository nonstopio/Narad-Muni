import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";
import type { PlatformConfigData } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let configs;
  try {
    console.log("[Narada Settings] Fetching platform configs...");
    console.log("[Narada Settings] DATABASE_URL:", process.env.DATABASE_URL);
    configs = await prisma.platformConfig.findMany({
      include: { repeatEntries: true },
      orderBy: { platform: "asc" },
    });
    console.log("[Narada Settings] Fetched configs:", configs.length, "platforms:", configs.map((c) => c.platform).join(", "));
  } catch (err) {
    console.error("[Narada Settings] Failed to fetch platform configs:", err);
    throw err;
  }

  if (configs.length === 0) {
    console.warn("[Narada Settings] No platform configs found in database. Did you run `npm run db:seed`?");
  }

  const serialized: PlatformConfigData[] = configs.map((c) => ({
    id: c.id,
    platform: c.platform as PlatformConfigData["platform"],
    userName: c.userName,
    userId: c.userId,
    webhookUrl: c.webhookUrl,
    apiToken: c.apiToken,
    baseUrl: c.baseUrl,
    email: c.email,
    projectKey: c.projectKey,
    timezone: c.timezone,
    teamLeadName: c.teamLeadName,
    teamLeadId: c.teamLeadId,
    slackBotToken: c.slackBotToken,
    slackChannelId: c.slackChannelId,
    slackThreadMode: c.slackThreadMode,
    slackThreadMatch: c.slackThreadMatch,
    slackWorkflowTime: c.slackWorkflowTime,
    isActive: c.isActive,
    repeatEntries: c.repeatEntries.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      hours: r.hours,
      startTime: r.startTime,
      comment: r.comment,
    })),
  }));

  console.log("[Narada Settings] Serialized", serialized.length, "configs for client");

  return <SettingsClient initialConfigs={serialized} />;
}
