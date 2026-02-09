-- CreateTable
CREATE TABLE "Update" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATETIME NOT NULL,
    "rawTranscript" TEXT NOT NULL,
    "audioPath" TEXT,
    "slackOutput" TEXT NOT NULL DEFAULT '',
    "teamsOutput" TEXT NOT NULL DEFAULT '',
    "slackStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "teamsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "jiraStatus" TEXT NOT NULL DEFAULT 'PENDING'
);

-- CreateTable
CREATE TABLE "WorkLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "updateId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "timeSpentSecs" INTEGER NOT NULL,
    "started" DATETIME NOT NULL,
    "comment" TEXT,
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "jiraWorklogId" TEXT,
    CONSTRAINT "WorkLogEntry_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "apiToken" TEXT,
    "baseUrl" TEXT,
    "email" TEXT,
    "projectKey" TEXT,
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "RepeatEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "startTime" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    CONSTRAINT "RepeatEntry_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PlatformConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'app-settings',
    "aiProvider" TEXT NOT NULL DEFAULT 'local-claude',
    "geminiApiKey" TEXT,
    "claudeApiKey" TEXT
);
