import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { UpdatePageClient } from "@/components/update/update-page-client";
import type { PlatformConfigData } from "@/types";

export default async function UpdatePage() {
  const configs = await prisma.platformConfig.findMany({
    include: { repeatEntries: true },
    orderBy: { platform: "asc" },
  });

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
    isActive: c.isActive,
    repeatEntries: c.repeatEntries.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      hours: r.hours,
      startTime: r.startTime,
      comment: r.comment,
    })),
  }));

  return (
    <Suspense>
      <UpdatePageClient platformConfigs={serialized} />
    </Suspense>
  );
}
