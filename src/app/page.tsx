import { prisma } from "@/lib/prisma";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";

export default async function UpdatesPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [monthUpdates, allUpdates] = await Promise.all([
    prisma.update.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { date: true },
    }),
    prisma.update.findMany({
      select: { date: true, slackStatus: true, teamsStatus: true, jiraStatus: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const updateCount = monthUpdates.length;
  const updateDates = monthUpdates.map((u) => u.date.toISOString().split("T")[0]);

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

  // Success rate
  const totalPubs = allUpdates.length * 3;
  const successPubs = allUpdates.reduce((acc, u) => {
    let s = 0;
    if (u.slackStatus === "SENT") s++;
    if (u.teamsStatus === "SENT") s++;
    if (u.jiraStatus === "SENT") s++;
    return acc + s;
  }, 0);
  const successRate = totalPubs > 0 ? Math.round((successPubs / totalPubs) * 100) : 0;

  return (
    <UpdatesPageClient
      updateCount={updateCount}
      streak={streak}
      successRate={successRate}
      updateDates={updateDates}
    />
  );
}
