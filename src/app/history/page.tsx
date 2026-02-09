import { prisma } from "@/lib/prisma";
import { HistoryList } from "@/components/history/history-list";
import type { UpdateData } from "@/types";
import type { PublishStatus } from "@/types";

export default async function HistoryPage() {
  const updates = await prisma.update.findMany({
    include: { workLogEntries: true },
    orderBy: { date: "desc" },
  });

  const serialized: UpdateData[] = updates.map((u) => ({
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

  return <HistoryList updates={serialized} />;
}
