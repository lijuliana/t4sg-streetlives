-- Migration: 003_session_events
-- Audit log for session lifecycle events.

CREATE TABLE session_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES sessions (session_id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL
                           CHECK (event_type IN ('created', 'assigned', 'transferred', 'closed')),
  actor        TEXT,                               -- user_id or "system"
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata     JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_session_events_session_id ON session_events (session_id, timestamp);
