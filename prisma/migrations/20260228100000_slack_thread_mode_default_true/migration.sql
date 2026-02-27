-- Flip slackThreadMode to true for unconfigured Slack rows only
UPDATE "PlatformConfig"
SET "slackThreadMode" = 1
WHERE "platform" = 'SLACK'
  AND "slackThreadMode" = 0
  AND ("webhookUrl" IS NULL OR "webhookUrl" = '')
  AND ("slackBotToken" IS NULL OR "slackBotToken" = '');
