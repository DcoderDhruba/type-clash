import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * The single place that knows about SQLite. Everything else calls the
 * query helpers in auth.ts / scores.ts / races.ts, so swapping to another
 * database later means changing this file and those.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  amount INTEGER NOT NULL,
  wpm INTEGER NOT NULL,
  raw_wpm INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  consistency INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_board ON scores(mode, amount, wpm DESC);
CREATE INDEX IF NOT EXISTS scores_user ON scores(user_id, mode, amount);

CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  amount INTEGER NOT NULL,
  words TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'multi',
  invited_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rematch_id TEXT,
  created_at INTEGER NOT NULL,
  start_at INTEGER,
  finished_at INTEGER,
  cancelled INTEGER NOT NULL DEFAULT 0,
  winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS race_players (
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ready INTEGER NOT NULL DEFAULT 0,
  correct_chars INTEGER NOT NULL DEFAULT 0,
  typed_chars INTEGER NOT NULL DEFAULT 0,
  words_done INTEGER NOT NULL DEFAULT 0,
  finished_at INTEGER,
  wpm INTEGER,
  raw_wpm INTEGER,
  accuracy INTEGER,
  correct INTEGER,
  incorrect INTEGER,
  extra INTEGER,
  missed INTEGER,
  PRIMARY KEY (race_id, user_id)
);

CREATE TABLE IF NOT EXISTS test_tickets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed TEXT NOT NULL,
  mode TEXT NOT NULL,
  amount INTEGER NOT NULL,
  punctuation INTEGER NOT NULL,
  numbers INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS test_tickets_user ON test_tickets(user_id, started_at);
`;

// Next.js can evaluate this module more than once in dev (hot reload), so the
// connection lives on globalThis to avoid opening several handles to the file.
const globalForDb = globalThis as unknown as { __typechazeDb?: DatabaseSync };

/**
 * Brings a database created by an older version up to date. Safe to run repeatedly.
 * The unique index on email is created here, not in SCHEMA, because it needs the
 * column to exist first (older databases get the column added below).
 */
function migrate(db: DatabaseSync): void {
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userColumns.some((column) => column.name === "email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }
  if (!userColumns.some((column) => column.name === "email_verified")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email COLLATE NOCASE)");

  const raceColumns = db.prepare("PRAGMA table_info(races)").all() as { name: string }[];
  if (!raceColumns.some((column) => column.name === "kind")) {
    db.exec("ALTER TABLE races ADD COLUMN kind TEXT NOT NULL DEFAULT 'multi'");
    // Before multiplayer lobbies existed every race was a one-on-one duel, and only duels
    // ever recorded an opponent, so those rows become duels.
    db.exec("UPDATE races SET kind = 'duo' WHERE opponent_id IS NOT NULL");
  }

  if (!raceColumns.some((column) => column.name === "invited_user_id")) {
    db.exec("ALTER TABLE races ADD COLUMN invited_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  }
  if (!raceColumns.some((column) => column.name === "rematch_id")) {
    db.exec("ALTER TABLE races ADD COLUMN rematch_id TEXT");
  }

  const playerColumns = db.prepare("PRAGMA table_info(race_players)").all() as { name: string }[];
  if (!playerColumns.some((column) => column.name === "ready")) {
    db.exec("ALTER TABLE race_players ADD COLUMN ready INTEGER NOT NULL DEFAULT 0");
  }
}

function open(): DatabaseSync {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "typechaze.db");
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

// Checked per module instance (not just per connection) so a hot reload in dev
// migrates a connection that was opened before the schema changed.
const migrated = new WeakSet<DatabaseSync>();

export function getDb(): DatabaseSync {
  const db = (globalForDb.__typechazeDb ??= open());
  if (!migrated.has(db)) {
    migrate(db);
    migrated.add(db);
  }
  return db;
}

/** Runs `fn` inside a write transaction; rolls back if it throws. */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

