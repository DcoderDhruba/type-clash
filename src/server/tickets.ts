import { randomBytes } from "node:crypto";
import { execute, getDb, queryOne } from "./db";
import type { QueryResultRow } from "pg";

/**
 * A ticket is registered when a logged-in player types the first key of a test. It fixes the words
 * (through the seed) and starts the server's own clock, so a submitted score can be checked against
 * real elapsed time. Each ticket can be used for one score, once.
 */

const TICKET_TTL_MS = 30 * 60 * 1000;
const MAX_OPEN_TICKETS = 20;

export interface Ticket {
  id: string;
  userId: number;
  seed: string;
  mode: "time" | "words";
  amount: number;
  punctuation: boolean;
  numbers: boolean;
  startedAt: number;
}

interface TicketRow extends QueryResultRow {
  id: string;
  user_id: number;
  seed: string;
  mode: "time" | "words";
  amount: number;
  punctuation: number;
  numbers: number;
  started_at: number;
}

export async function createTicket(
  userId: number,
  input: { seed: string; mode: "time" | "words"; amount: number; punctuation: boolean; numbers: boolean }
): Promise<string> {
  const db = getDb();
  const now = Date.now();

  await execute(db, "DELETE FROM test_tickets WHERE started_at < ?", [now - 2 * TICKET_TTL_MS]);
  // A player never needs many tickets at once; drop the oldest unused ones beyond a handful.
  await execute(
    db,
    `DELETE FROM test_tickets WHERE user_id = ? AND used = 0 AND id NOT IN (
       SELECT id FROM (
         SELECT id FROM test_tickets WHERE user_id = ? AND used = 0 ORDER BY started_at DESC LIMIT ?
       ) AS retained_tickets
     )`,
    [userId, userId, MAX_OPEN_TICKETS - 1]
  );

  const id = randomBytes(16).toString("base64url");
  await execute(
    db,
    `INSERT INTO test_tickets (id, user_id, seed, mode, amount, punctuation, numbers, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, input.seed, input.mode, input.amount, input.punctuation ? 1 : 0, input.numbers ? 1 : 0, now]
  );
  return id;
}

/** Marks the ticket as used and returns it, or null if it is unknown, someone else's, used or too old. */
export async function consumeTicket(id: string, userId: number, now = Date.now()): Promise<Ticket | null> {
  const db = getDb();
  const claimed = await execute(
    db,
    "UPDATE test_tickets SET used = 1 WHERE id = ? AND user_id = ? AND used = 0 AND started_at > ?",
    [id, userId, now - TICKET_TTL_MS]
  );
  if (claimed.affectedRows !== 1) return null;

  const row = await queryOne<TicketRow>(db, "SELECT * FROM test_tickets WHERE id = ?", [id]);
  if (!row) throw new Error("Claimed test ticket was not found.");
  return {
    id: row.id,
    userId: row.user_id,
    seed: row.seed,
    mode: row.mode,
    amount: row.amount,
    punctuation: row.punctuation === 1,
    numbers: row.numbers === 1,
    startedAt: row.started_at,
  };
}
