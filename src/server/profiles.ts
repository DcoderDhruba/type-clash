import { getDb } from "./db";
import { getPlayerRaceRecord } from "./scores";
import type { RaceRecord } from "./scores";

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
export function getProfile(username: string): Profile | null {
  const db = getDb();
  const user = db.prepare("SELECT id, username, created_at AS createdAt FROM users WHERE username = ?").get(username) as
    | { id: number; username: string; createdAt: number }
    | undefined;
  if (!user) return null;

  const totals = db
    .prepare("SELECT COUNT(*) AS tests, AVG(wpm) AS avgWpm, AVG(accuracy) AS avgAccuracy FROM scores WHERE user_id = ?")
    .get(user.id) as { tests: number; avgWpm: number | null; avgAccuracy: number | null };

  const bests = db
    .prepare(
      `SELECT mode, amount, wpm, accuracy, created_at AS createdAt FROM (
         SELECT mode, amount, wpm, accuracy, created_at,
                ROW_NUMBER() OVER (PARTITION BY mode, amount ORDER BY wpm DESC, accuracy DESC, created_at ASC) AS rn
           FROM scores WHERE user_id = ?
       ) WHERE rn = 1
       ORDER BY wpm DESC`
    )
    .all(user.id) as unknown as BestScore[];

  const recent = db
    .prepare(
      "SELECT mode, amount, wpm, accuracy, created_at AS createdAt FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 8"
    )
    .all(user.id) as unknown as RecentScore[];

  return {
    id: user.id,
    username: user.username,
    memberSince: user.createdAt,
    tests: totals.tests,
    averageWpm: totals.avgWpm === null ? null : Math.round(totals.avgWpm),
    averageAccuracy: totals.avgAccuracy === null ? null : Math.round(totals.avgAccuracy),
    bests,
    recent,
    races: getPlayerRaceRecord(user.username, "multi"),
    challenges: getPlayerRaceRecord(user.username, "duo"),
  };
}

/** A player's last results for one test type, oldest first, for the progress chart. */
export function getScoreHistory(userId: number, mode: "time" | "words", amount: number, limit = 50): HistoryPoint[] {
  const rows = getDb()
    .prepare(
      "SELECT wpm, created_at AS createdAt FROM scores WHERE user_id = ? AND mode = ? AND amount = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(userId, mode, amount, limit) as unknown as HistoryPoint[];
  return rows.reverse();
}
