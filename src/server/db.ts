import { readFileSync } from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import mysql from "mysql2/promise";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL,
    email VARCHAR(254) NULL UNIQUE,
    email_verified TINYINT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    expires_at BIGINT NOT NULL,
    KEY sessions_user (user_id),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS scores (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    mode VARCHAR(8) NOT NULL,
    amount INT NOT NULL,
    wpm INT NOT NULL,
    raw_wpm INT NOT NULL,
    accuracy INT NOT NULL,
    consistency INT NOT NULL,
    created_at BIGINT NOT NULL,
    KEY scores_board (mode, amount, wpm),
    KEY scores_user (user_id, mode, amount),
    CONSTRAINT scores_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS races (
    id VARCHAR(8) NOT NULL PRIMARY KEY,
    creator_id INT UNSIGNED NOT NULL,
    opponent_id INT UNSIGNED NULL,
    mode VARCHAR(8) NOT NULL,
    amount INT NOT NULL,
    words MEDIUMTEXT NOT NULL,
    kind VARCHAR(8) NOT NULL DEFAULT 'multi',
    invited_user_id INT UNSIGNED NULL,
    rematch_id VARCHAR(8) NULL,
    created_at BIGINT NOT NULL,
    start_at BIGINT NULL,
    finished_at BIGINT NULL,
    cancelled TINYINT NOT NULL DEFAULT 0,
    winner_id INT UNSIGNED NULL,
    KEY races_creator (creator_id),
    KEY races_opponent (opponent_id),
    KEY races_invited_user (invited_user_id),
    KEY races_winner (winner_id),
    CONSTRAINT races_creator_fk FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT races_opponent_fk FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT races_invited_user_fk FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT races_winner_fk FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS race_players (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
    race_id VARCHAR(8) NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    ready TINYINT NOT NULL DEFAULT 0,
    correct_chars INT NOT NULL DEFAULT 0,
    typed_chars INT NOT NULL DEFAULT 0,
    words_done INT NOT NULL DEFAULT 0,
    finished_at BIGINT NULL,
    wpm INT NULL,
    raw_wpm INT NULL,
    accuracy INT NULL,
    correct INT NULL,
    incorrect INT NULL,
    extra INT NULL,
    missed INT NULL,
    PRIMARY KEY (race_id, user_id),
    KEY race_players_order (race_id, id),
    KEY race_players_user (user_id),
    CONSTRAINT race_players_race_fk FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
    CONSTRAINT race_players_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS test_tickets (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    seed VARCHAR(128) NOT NULL,
    mode VARCHAR(8) NOT NULL,
    amount INT NOT NULL,
    punctuation TINYINT NOT NULL,
    numbers TINYINT NOT NULL,
    started_at BIGINT NOT NULL,
    used TINYINT NOT NULL DEFAULT 0,
    KEY test_tickets_user (user_id, started_at),
    CONSTRAINT test_tickets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export type DbExecutor = Pool | PoolConnection;
export type DbValues = Array<string | number | bigint | boolean | Date | null | Buffer | Uint8Array>;

const transactionContext = new AsyncLocalStorage<PoolConnection>();

const globalForDb = globalThis as typeof globalThis & {
  __typechazeDb?: Pool;
  __typechazeDbReady?: Promise<void>;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createPool(): Pool {
  const port = Number(requiredEnv("MYSQL_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be a valid TCP port.");
  }

  const caPath = process.env.MYSQL_SSL_CA;
  if (!caPath) {
    throw new Error(
      "Missing MYSQL_SSL_CA. Download the CA certificate for your Aiven service and set MYSQL_SSL_CA to its file path."
    );
  }
  const ca = readFileSync(path.resolve(caPath), "utf8");

  return mysql.createPool({
    host: requiredEnv("MYSQL_HOST"),
    port,
    user: requiredEnv("MYSQL_USER"),
    password: requiredEnv("MYSQL_PASSWORD"),
    database: requiredEnv("MYSQL_DATABASE"),
    ssl: { ca, rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
}

function getPool(): Pool {
  return (globalForDb.__typechazeDb ??= createPool());
}

export function getDb(): DbExecutor {
  return transactionContext.getStore() ?? getPool();
}

async function ensureSchema(): Promise<void> {
  if (!globalForDb.__typechazeDbReady) {
    globalForDb.__typechazeDbReady = (async () => {
      const db = getPool();
      for (const statement of SCHEMA) await db.query(statement);
    })().catch((error: unknown) => {
      globalForDb.__typechazeDbReady = undefined;
      throw error;
    });
  }
  await globalForDb.__typechazeDbReady;
}

export async function queryRows<T extends RowDataPacket>(
  db: DbExecutor,
  sql: string,
  values: DbValues = []
): Promise<T[]> {
  await ensureSchema();
  const [rows] = await db.execute<T[]>(sql, values);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  db: DbExecutor,
  sql: string,
  values: DbValues = []
): Promise<T | undefined> {
  const rows = await queryRows<T>(db, sql, values);
  return rows[0];
}

export async function execute(
  db: DbExecutor,
  sql: string,
  values: DbValues = []
): Promise<ResultSetHeader> {
  await ensureSchema();
  const [result] = await db.execute<ResultSetHeader>(sql, values);
  return result;
}

/** Runs `fn` inside a transaction and rolls it back if it throws. */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  await ensureSchema();
  const db = await getPool().getConnection();
  let began = false;
  try {
    await db.beginTransaction();
    began = true;
    const result = await transactionContext.run(db, fn);
    await db.commit();
    return result;
  } catch (error) {
    if (began) {
      try {
        await db.rollback();
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "The database transaction and its rollback both failed.");
      }
    }
    throw error;
  } finally {
    db.release();
  }
}
