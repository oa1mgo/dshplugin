CREATE TABLE catalog_reviews (
  plugin_slug TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('unverified', 'review', 'verified')),
  note TEXT,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX catalog_reviews_status_updated_idx ON catalog_reviews (status, updated_at DESC);
