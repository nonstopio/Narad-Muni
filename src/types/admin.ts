export interface AdminAnalyticsData {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  rangeDays: number;

  platformAdoption: {
    platform: string;
    configured: number;
    activelyUsed: number;
  }[];

  publishStats: {
    platform: string;
    sent: number;
    failed: number;
    skipped: number;
  }[];

  aiProviderDistribution: {
    provider: string;
    count: number;
  }[];

  dailyTrend: {
    date: string;
    updateCount: number;
    uniqueUsers: number;
  }[];

  streakDistribution: {
    bucket: string;
    count: number;
  }[];

  hourlyDistribution: number[];

  inactiveUsers: {
    email: string;
    lastActive: string | null;
  }[];
}
