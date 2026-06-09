-- Donations ledger. Internal bookkeeping only; never surfaced per-row to users.
-- Amounts are stored as integer cents to avoid floating-point drift.
CREATE TABLE IF NOT EXISTS donations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_cents INTEGER NOT NULL,
  currency     TEXT    NOT NULL DEFAULT 'CAD',
  sender_name  TEXT,
  sender_email TEXT,
  message      TEXT,
  message_id   TEXT    NOT NULL UNIQUE,
  raw_subject  TEXT,
  received_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_donations_received_at ON donations (received_at);
