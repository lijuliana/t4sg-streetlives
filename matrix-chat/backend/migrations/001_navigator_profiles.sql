-- Migration: 001_navigator_profiles
-- Creates the navigator_profiles table.
-- Run once against your Postgres/SQLite database before switching from in-memory stores.

CREATE TABLE navigator_profiles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL UNIQUE,          -- Matrix @user:homeserver.org
  nav_group         TEXT        NOT NULL
                                CHECK (nav_group IN ('CUNY_PIN', 'HOUSING_WORKS', 'DYCD')),
  expertise_tags    TEXT[]      NOT NULL DEFAULT '{}',
  languages         TEXT[]      NOT NULL DEFAULT '{en}',
  capacity          INTEGER     NOT NULL DEFAULT 5 CHECK (capacity >= 1),
  status            TEXT        NOT NULL DEFAULT 'available'
                                CHECK (status IN ('available', 'away', 'offline')),
  -- Routing v2: gates initial session assignment.
  -- Transfer routing can reach any available navigator regardless of this flag.
  -- nav_group is retained for future routing iterations but does not constrain routing now.
  is_general_intake BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for routing v2: available general-intake navigators (initial assignment path)
CREATE INDEX idx_navigator_profiles_intake_available
  ON navigator_profiles (is_general_intake, status)
  WHERE status = 'available';

-- Index for nav_group (retained for future routing use)
CREATE INDEX idx_navigator_profiles_nav_group ON navigator_profiles (nav_group);
