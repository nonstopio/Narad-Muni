-- Add notification reminder settings to AppSettings
ALTER TABLE "AppSettings" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "AppSettings" ADD COLUMN "notificationHour" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "AppSettings" ADD COLUMN "notificationMinute" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AppSettings" ADD COLUMN "notificationDays" TEXT NOT NULL DEFAULT '1,2,3,4,5';
