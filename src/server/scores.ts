import { execute, getDb, queryOne, queryRows } from "./db";
import type { QueryResultRow } from "pg";
import { consumeTicket } from "./tickets";
import { parseTypedLog, verifyLog } from "./verify";
import { calcAccuracy, calcRawWpm, calcWpm } from "@/lib/scoring";
import { rankResults } from "@/lib/standings";
import { createWordStream } from "@/lib/words";
import type { TypedLog } from "@/lib/types";

/** Nobody types faster than this; anything above is treated as tampering. */
export const MAX_PLAUSIBLE_WPM = 350;
export const MAX_CHARS_PER_SECOND = (MAX_PLAUSIBLE_WPM * 5) / 60;

/** How far the log's length may differ from the real time the server saw pass. */
const TIMING_EARLY_MS = 4000;
const TIMING_LATE_MS = 8000;

export interface SavedScore {
  wpm: number;
  accuracy: number;
  rank: number;
  isPersonalBest: boolean;
}

export interface LeaderboardRow extends QueryResultRow {
  rank: number;
  username: string;
  wpm: number;
  accuracy: number;
  consistency: number;
  createdAt: number;
}

export interface RaceRecordRow {
  rank: number;
  username: string;
  wins: number;
  losses: number;
  draws: number;
}

export function wholeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export interface ScoreSubmission {
  ticketId: string;
  log: TypedLog;
  consistency: number;
}

/** Validates an untrusted request body. Returns null if it is malformed. */
export function parseScoreSubmission(body: unknown): ScoreSubmission | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const log = parseTypedLog(record);
  const consistency = wholeNumber(record.consistency, 0, 100);
  if (typeof record.ticketId !== "string" || record.ticketId.length > 64 || !log || consistency === null) return null;
  return { ticketId: record.ticketId, log, consistency };
}

export type SubmitResult = { ok: true; saved: SavedScore } | { ok: false; status: number; reason: string };

const fail = (status: number, reason: string): SubmitResult => ({ ok: false, status, reason });

/**
 * Saves a score after checking it from scratch. The words come from the ticket's seed (not from the
 * browser), the score is recounted from the typing log, and the log has to look like a person typing
 * for as long as the server saw the test take. The browser's own numbers are never used.
 */
export async function submitVerifiedScore(
  userId: number,
  submission: ScoreSubmission,
  now = Date.now()
): Promise<SubmitResult> {
  const ticket = await consumeTicket(submission.ticketId, userId, now);
  if (!ticket) return fail(400, "This test was not registered, was already submitted, or has expired.");

  const { log } = submission;
  const words = createWordStream(ticket.seed, { punctuation: ticket.punctuation, numbers: ticket.numbers }).take(
    log.typedWords.length + 2
  );
  const verdict = verifyLog(words, log);
  if (!verdict.ok) return fail(422, verdict.reason);

  // The log cannot claim more or less time than the server saw pass.
  const wallMs = now - ticket.startedAt;
  const expectedMs = ticket.mode === "time" ? ticket.amount * 1000 : verdict.durationMs;
  if (wallMs < expectedMs - TIMING_EARLY_MS || wallMs > expectedMs + TIMING_LATE_MS) {
    return fail(422, "The timing did not match how long this test really took.");
  }
  if (ticket.mode === "time" && verdict.durationMs > ticket.amount * 1000 + 1500) {
    return fail(422, "Keys were recorded after the time was up.");
  }
  if (ticket.mode === "words" && log.typedWords.length + (log.finalInput ? 1 : 0) < ticket.amount) {
    return fail(422, "Not all of the words were typed.");
  }

  const { correct, incorrect, extra } = verdict.counts;
  const typed = correct + incorrect + extra;
  const elapsed = ticket.mode === "time" ? ticket.amount : Math.max(1, verdict.durationMs / 1000);
  const wpm = calcWpm(correct, elapsed);
  if (wpm > MAX_PLAUSIBLE_WPM || correct > elapsed * MAX_CHARS_PER_SECOND + 5) {
    return fail(422, "That speed is not humanly possible.");
  }
  if (wpm <= 0) return fail(422, "There was no score to save.");

  const accuracy = calcAccuracy(correct, typed);
  const rawWpm = calcRawWpm(typed, elapsed);
  const db = getDb();

  const previousBest = await queryOne<QueryResultRow & { best: number | null }>(
    db,
    "SELECT MAX(wpm) AS best FROM scores WHERE user_id = ? AND mode = ? AND amount = ?",
    [userId, ticket.mode, ticket.amount]
  );
  if (!previousBest) throw new Error("Could not read the player's previous best score.");

  await execute(
    db,
    `INSERT INTO scores (user_id, mode, amount, wpm, raw_wpm, accuracy, consistency, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, ticket.mode, ticket.amount, wpm, rawWpm, accuracy, submission.consistency, now]
  );

  const best = Math.max(wpm, previousBest.best ?? 0);
  const ahead = await queryOne<QueryResultRow & { n: number }>(
    db,
      `SELECT COUNT(*)::INTEGER AS n FROM (
         SELECT user_id, MAX(wpm) AS best FROM scores
          WHERE mode = ? AND amount = ? GROUP BY user_id
       ) AS score_bests WHERE best > ?`,
    [ticket.mode, ticket.amount, best]
  );
  if (!ahead) throw new Error("Could not calculate the leaderboard rank.");

  return {
    ok: true,
    saved: { wpm, accuracy, rank: ahead.n + 1, isPersonalBest: previousBest.best === null || wpm > previousBest.best },
  };
}

/** Each player's single best result for this test type, fastest first. */
export async function getLeaderboard(
  mode: "time" | "words",
  amount: number,
  limit = 50
): Promise<LeaderboardRow[]> {
  const rows = await queryRows<LeaderboardRow>(
    getDb(),
      `SELECT username, wpm, accuracy, consistency, created_at AS "createdAt" FROM (
         SELECT u.username AS username, s.wpm AS wpm, s.accuracy AS accuracy,
                s.consistency AS consistency, s.created_at AS created_at,
                ROW_NUMBER() OVER (
                  PARTITION BY s.user_id
                  ORDER BY s.wpm DESC, s.accuracy DESC, s.created_at ASC
                ) AS rn
           FROM scores s JOIN users u ON u.id = s.user_id
          WHERE s.mode = ? AND s.amount = ?
       ) AS player_scores
       WHERE rn = 1
       ORDER BY wpm DESC, accuracy DESC, created_at ASC
       LIMIT ?`,
    [mode, amount, limit]
  );

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Every player's record across finished duels (kind "duo") or multiplayer races (kind "multi"). Finishing first alone is a win, finishing
 * first together with someone else is a draw, and anything else in a real race is a loss.
 * Races where nobody typed anything are ignored.
 */
async function raceRecordMap(kind: "duo" | "multi"): Promise<Map<string, { wins: number; losses: number; draws: number }>> {
  const rows = await queryRows<
    QueryResultRow & {
      raceId: string;
      username: string;
      finishedAt: number | null;
      wpm: number | null;
      accuracy: number | null;
    }
  >(
    getDb(),
      `SELECT p.race_id AS "raceId", u.username AS username, p.finished_at AS "finishedAt",
              p.wpm AS wpm, p.accuracy AS accuracy
         FROM race_players p
         JOIN races r ON r.id = p.race_id
         JOIN users u ON u.id = p.user_id
        WHERE r.finished_at IS NOT NULL AND r.cancelled = 0 AND r.start_at IS NOT NULL AND r.kind = ?
        ORDER BY p.race_id, p.id`,
    [kind]
  );

  const byRace = new Map<string, typeof rows>();
  for (const row of rows) byRace.set(row.raceId, [...(byRace.get(row.raceId) ?? []), row]);

  const records = new Map<string, { wins: number; losses: number; draws: number }>();
  for (const players of byRace.values()) {
    if (players.length < 2) continue;
    const places = rankResults(
      players.map((player) => ({ wpm: player.finishedAt !== null ? player.wpm : null, accuracy: player.accuracy }))
    );
    if (places.every((place) => place === null)) continue;

    const sharedFirst = places.filter((place) => place === 1).length > 1;
    players.forEach((player, index) => {
      const record = records.get(player.username) ?? { wins: 0, losses: 0, draws: 0 };
      if (places[index] === 1) record[sharedFirst ? "draws" : "wins"] += 1;
      else record.losses += 1;
      records.set(player.username, record);
    });
  }
  return records;
}

export interface RaceRecord {
  wins: number;
  losses: number;
  draws: number;
}

/** One player's record in duels ("duo") or multiplayer races ("multi"). */
export async function getPlayerRaceRecord(username: string, kind: "duo" | "multi"): Promise<RaceRecord> {
  return (await raceRecordMap(kind)).get(username) ?? { wins: 0, losses: 0, draws: 0 };
}

export async function getRaceRecords(kind: "duo" | "multi", limit = 50): Promise<RaceRecordRow[]> {
  const records = await raceRecordMap(kind);

  const sorted = [...records.entries()]
    .map(([username, record]) => ({ username, ...record }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.username.localeCompare(b.username))
    .slice(0, limit);

  // Players with the same record share a place (1, 1, 3...), so ties do not decide who gets the crown.
  const ranked: RaceRecordRow[] = [];
  sorted.forEach((row, index) => {
    const previous = ranked[index - 1];
    const tied = previous && previous.wins === row.wins && previous.losses === row.losses;
    ranked.push({ ...row, rank: tied ? previous.rank : index + 1 });
  });
  return ranked;
}
