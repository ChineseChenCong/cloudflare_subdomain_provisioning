CREATE TABLE IF NOT EXISTS user_daily_limits (
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  apply_count INTEGER NOT NULL DEFAULT 0,
  delete_count INTEGER NOT NULL DEFAULT 0,
  limit_override INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_limits_user_id ON user_daily_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_limits_date ON user_daily_limits(date);
