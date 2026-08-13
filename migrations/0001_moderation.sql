CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX submissions_status_created_idx ON submissions (status, created_at DESC);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  plugin_slug TEXT NOT NULL,
  plugin_name TEXT NOT NULL,
  repo TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('security', 'broken', 'misleading', 'harmful', 'other')),
  details TEXT NOT NULL,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX reports_status_created_idx ON reports (status, created_at DESC);
