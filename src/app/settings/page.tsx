import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";
import type { PlatformConfigData } from "@/types";

export default async function SettingsPage() {
  const configs = await prisma.platformConfig.findMany({
    include: { repeatEntries: true },
    orderBy: { platform: "asc" },
  });

  const serialized: PlatformConfigData[] = configs.map((c) => ({
    id: c.id,
    platform: c.platform as PlatformConfigData["platform"],
    webhookUrl: c.webhookUrl,
    apiToken: c.apiToken,
    baseUrl: c.baseUrl,
    email: c.email,
    projectKey: c.projectKey,
    timezone: c.timezone,
    isActive: c.isActive,
    repeatEntries: c.repeatEntries.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      hours: r.hours,
      startTime: r.startTime,
      comment: r.comment,
    })),
  }));

  return <SettingsClient initialConfigs={serialized} />;
}
