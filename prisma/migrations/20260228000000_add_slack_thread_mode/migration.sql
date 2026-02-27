-- Add Slack thread reply mode fields to PlatformConfig
ALTER TABLE "PlatformConfig" ADD COLUMN "slackBotToken" TEXT;
ALTER TABLE "PlatformConfig" ADD COLUMN "slackChannelId" TEXT;
ALTER TABLE "PlatformConfig" ADD COLUMN "slackThreadMode" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "PlatformConfig" ADD COLUMN "slackThreadMatch" TEXT;
