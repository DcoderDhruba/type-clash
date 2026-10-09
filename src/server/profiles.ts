import { getDb, queryOne, queryRows } from "./db";
import { getPlayerRaceRecord } from "./scores";
import type { RaceRecord } from "./scores";
import type { QueryResultRow } from "pg";

export interface BestScore {
  mode: "time" | "words";
  amount: number;
  wpm: number;
  accuracy: number;
  createdAt: number;
}

export interface RecentScore {
  mode: "time" | "words";
  amount: number;
  wpm: number;
  accuracy: number;
  createdAt: number;
}

export interface HistoryPoint {
  wpm: number;
  createdAt: number;
}

export interface Profile {
  id: number;
  username: string;
  memberSince: number;
  tests: number;
  averageWpm: number | null;
  averageAccuracy: number | null;
  /** The best result for each test type the player has tried, fastest first. */
  bests: BestScore[];
  recent: RecentScore[];
  races: RaceRecord;
  challenges: RaceRecord;
}

/** Everything shown on a public profile. Never includes the email. */
export async function getProfile(username: string): Promise<Profile | null> {
  const db = getDb();
  const user = await queryOne<QueryResultRow & { id: number; username: string; createdAt: number }>(
    db,
    'SELECT id, username, created_at AS "createdAt" FROM users WHERE LOWER(username) = LOWER(?)',
    [username]
  );
  if (!user) return null;

  const totals = await queryOne<
    QueryResultRow & { tests: number; avgWpm: number | null; avgAccuracy: number | null }
  >(
    db,
    'SELECT COUNT(*)::INTEGER AS tests, AVG(wpm)::DOUBLE PRECISION AS "avgWpm", AVG(accuracy)::DOUBLE PRECISION AS "avgAccuracy" FROM scores WHERE user_id = ?',
    [user.id]
  );
  if (!totals) throw new Error("Could not calculate the player's profile totals.");

  const bests = await queryRows<BestScore & QueryResultRow>(
    db,
      `SELECT mode, amount, wpm, accuracy, created_at AS "createdAt" FROM (
         SELECT mode, amount, wpm, accuracy, created_at,
                ROW_NUMBER() OVER (PARTITION BY mode, amount ORDER BY wpm DESC, accuracy DESC, created_at ASC) AS rn
           FROM scores WHERE user_id = ?
       ) AS user_scores WHERE rn = 1
       ORDER BY wpm DESC`,
    [user.id]
  );

  const recent = await queryRows<RecentScore & QueryResultRow>(
    db,
    'SELECT mode, amount, wpm, accuracy, created_at AS "createdAt" FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 8',
    [user.id]
  );
  const [races, challenges] = await Promise.all([
    getPlayerRaceRecord(user.username, "multi"),
    getPlayerRaceRecord(user.username, "duo"),
  ]);

  return {
    id: user.id,
    username: user.username,
    memberSince: user.createdAt,
    tests: totals.tests,
    averageWpm: totals.avgWpm === null ? null : Math.round(totals.avgWpm),
    averageAccuracy: totals.avgAccuracy === null ? null : Math.round(totals.avgAccuracy),
    bests,
    recent,
    races,
    challenges,
  };
}

/** A player's last results for one test type, oldest first, for the progress chart. */
export async function getScoreHistory(
  userId: number,
  mode: "time" | "words",
  amount: number,
  limit = 50
): Promise<HistoryPoint[]> {
  const rows = await queryRows<HistoryPoint & QueryResultRow>(
    getDb(),
    'SELECT wpm, created_at AS "createdAt" FROM scores WHERE user_id = ? AND mode = ? AND amount = ? ORDER BY created_at DESC LIMIT ?',
    [userId, mode, amount, limit]
  );
  return rows.reverse();
}
