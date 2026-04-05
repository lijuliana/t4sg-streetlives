-- Migration: 002_sessions_v2
-- Creates the sessions table with routing and lifecycle fields.
-- Supersedes any earlier sessions table from the in-memory era.

CREATE TABLE sessions (
  session_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_room_id          TEXT        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'unassigned'
                                      CHECK (status IN ('unassigned', 'active', 'closed', 'transferred')),
  need_category           TEXT        NOT NULL DEFAULT 'other'
                                      CHECK (need_category IN (
                                        'housing', 'employment', 'health', 'benefits',
                                        'youth_services', 'education', 'other'
                                      )),
  assigned_navigator_id   UUID        REFERENCES navigator_profiles (id) ON DELETE SET NULL,
  routing_version         TEXT,
  routing_reason          JSONB,
  routing_fail_reason     TEXT,       -- set when routing returned unassigned; null otherwise
  referral_id             UUID,       -- future FK to referrals table
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at               TIMESTAMPTZ
);

-- Index for listing sessions by navigator (load calculation)
CREATE INDEX idx_sessions_navigator_active
  ON sessions (assigned_navigator_id, status)
  WHERE status = 'active';

-- Index for dashboard listing (newest first)
CREATE INDEX idx_sessions_created_at ON sessions (created_at DESC);
