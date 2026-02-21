import { prisma } from "@/lib/prisma";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";
import type { UpdateData, PublishStatus } from "@/types";

export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [monthUpdates, allUpdates] = await Promise.all([
    prisma.update.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { workLogEntries: true },
    }),
    prisma.update.findMany({
      select: { date: true, slackStatus: true, teamsStatus: true, jiraStatus: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const updateCount = monthUpdates.length;

  const monthUpdatesSerialized: UpdateData[] = monthUpdates.map((u) => ({
    id: u.id,
    createdAt: u.createdAt.toISOString(),
    date: u.date.toISOString(),
    rawTranscript: u.rawTranscript,
    audioPath: u.audioPath,
    slackOutput: u.slackOutput,
    teamsOutput: u.teamsOutput,
    slackStatus: u.slackStatus as PublishStatus,
    teamsStatus: u.teamsStatus as PublishStatus,
    jiraStatus: u.jiraStatus as PublishStatus,
    workLogEntries: u.workLogEntries.map((w) => ({
      id: w.id,
      issueKey: w.issueKey,
      timeSpentSecs: w.timeSpentSecs,
      started: w.started.toISOString(),
      comment: w.comment ?? undefined,
      isRepeat: w.isRepeat,
      jiraWorklogId: w.jiraWorklogId,
    })),
  }));

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sortedDates = allUpdates
    .map((u) => {
      const d = new Date(u.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b - a);

  if (sortedDates.length > 0) {
    let checkDate = today.getTime();
    for (const dateTs of sortedDates) {
      if (dateTs === checkDate) {
        streak++;
        checkDate -= 86400000;
      } else if (dateTs < checkDate) {
        break;
      }
    }
  }

  return (
    <UpdatesPageClient
      updateCount={updateCount}
      streak={streak}
      monthUpdates={monthUpdatesSerialized}
    />
  );
}
