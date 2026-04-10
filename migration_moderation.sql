-- Moderation system migration

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportReason') THEN
    CREATE TYPE "ReportReason" AS ENUM ('SPAM','HARASSMENT','ILLEGAL','VIOLENCE','OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportStatus') THEN
    CREATE TYPE "ReportStatus" AS ENUM ('PENDING','RESOLVED_WARN','RESOLVED_MUTE','RESOLVED_BAN','DISMISSED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModVerdict') THEN
    CREATE TYPE "ModVerdict" AS ENUM ('WARN','MUTE_1H','MUTE_24H','MUTE_7D','BAN_30D','BAN_PERM','DISMISS');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PunishmentType') THEN
    CREATE TYPE "PunishmentType" AS ENUM ('WARN','MUTE','BAN');
  END IF;
END $$;

ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_mod_channel BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason "ReportReason" NOT NULL,
  status "ReportStatus" NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_message_idx ON reports(message_id);

CREATE TABLE IF NOT EXISTS mod_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL,
  verdict "ModVerdict" NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, moderator_id)
);

CREATE TABLE IF NOT EXISTS user_punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type "PunishmentType" NOT NULL,
  expires_at TIMESTAMP,
  reason VARCHAR(256),
  report_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_punishments_user_idx ON user_punishments(user_id);
