import { randomBytes } from "node:crypto";
import { getDb, transaction } from "./db";
import { MAX_CHARS_PER_SECOND, MAX_PLAUSIBLE_WPM, wholeNumber } from "./scores";
import { parseTypedLog, verifyLog } from "./verify";
import { generateWords } from "@/lib/words";
import { calcAccuracy, calcRawWpm, calcWpm } from "@/lib/scoring";
import { isValidAmount } from "@/lib/config";
import { rankResults } from "@/lib/standings";
import { MIN_PLAYERS, capacityOf } from "@/lib/race";
import type { TypedLog } from "@/lib/types";
import type {
  RaceKind,
  RaceOutcome,
  RacePhase,
  RacePlayerView,
  RaceProgress,
  RaceView,
} from "@/lib/race";

/** How long players get to read the words after the host starts the race. */
export const COUNTDOWN_MS = 5000;
/** In a timed race, how long after time is up we wait for a player's final result to arrive. */
const FINISH_GRACE_MS = 8000;
/** In a words race, the longest a race may run at all. */
const WORDS_RACE_MAX_MS = 15 * 60 * 1000;
/** In a words race, how long everyone else has once the first player finishes. */
const WORDS_STRAGGLER_MS = 60 * 1000;
/** A lobby that was never started stops working after this long. */
const WAITING_EXPIRY_MS = 6 * 60 * 60 * 1000;
/** A challenge sent to a particular person is only good for this long. */
const INVITE_EXPIRY_MS = 30 * 60 * 1000;
/** Allowance for clock differences when checking that a timed race really lasted its full time. */
const EARLY_FINISH_TOLERANCE_MS = 1500;

const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

interface RaceRow {
  id: string;
  creator_id: number;
  kind: RaceKind;
  mode: "time" | "words";
  amount: number;
  words: string;
  created_at: number;
  start_at: number | null;
  finished_at: number | null;
  cancelled: number;
  winner_id: number | null;
  invited_user_id: number | null;
  rematch_id: string | null;
}

interface PlayerRow {
  user_id: number;
  username: string;
  correct_chars: number;
  typed_chars: number;
  words_done: number;
  ready: number;
  finished_at: number | null;
  wpm: number | null;
  raw_wpm: number | null;
  accuracy: number | null;
  correct: number | null;
  incorrect: number | null;
  extra: number | null;
  missed: number | null;
}

export type RaceError =
  | "not_found"
  | "forbidden"
  | "full"
  | "closed"
  | "invalid"
  | "too_early"
  | "need_players"
  | "not_ready"
  | "not_invited";

function makeRaceId(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

function loadRace(id: string): RaceRow | undefined {
  return getDb().prepare("SELECT * FROM races WHERE id = ?").get(id) as RaceRow | undefined;
}

function loadPlayers(raceId: string): PlayerRow[] {
  return getDb()
    .prepare(
      `SELECT p.*, u.username AS username
         FROM race_players p JOIN users u ON u.id = p.user_id
        WHERE p.race_id = ?
        ORDER BY p.rowid`
    )
    .all(raceId) as unknown as PlayerRow[];
}

function totalChars(words: string[]): number {
  return words.reduce((sum, word) => sum + word.length + 1, 0);
}

/** A race that has not been started, cancelled or settled, and has not expired. */
function isOpenLobby(race: RaceRow, now: number): boolean {
  const expiry = race.invited_user_id !== null ? INVITE_EXPIRY_MS : WAITING_EXPIRY_MS;
  return race.start_at === null && !race.cancelled && race.finished_at === null && now - race.created_at <= expiry;
}

/** Time races need a long word list so nobody runs out; words races use exactly the chosen count. */
function freshWords(mode: "time" | "words", amount: number): string[] {
  return generateWords(mode === "words" ? amount : Math.max(120, amount * 4));
}

/** Inserts a new race with its host as the first player. Must be called inside a transaction. */
function insertRace(
  id: string,
  creatorId: number,
  kind: RaceKind,
  mode: "time" | "words",
  amount: number,
  invitedUserId: number | null,
  words: string[]
): void {
  const db = getDb();
  // One open lobby at a time: a new race replaces any the host left unstarted.
  db.prepare(
    "UPDATE races SET cancelled = 1 WHERE creator_id = ? AND start_at IS NULL AND cancelled = 0 AND finished_at IS NULL"
  ).run(creatorId);
  db.prepare(
    `INSERT INTO races (id, creator_id, kind, mode, amount, words, invited_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, creatorId, kind, mode, amount, JSON.stringify(words), invitedUserId, Date.now());
  db.prepare("INSERT INTO race_players (race_id, user_id, ready) VALUES (?, ?, 1)").run(id, creatorId);
}

/** `invitedUserId` makes a challenge (duo) that only that person can accept. */
export function createRace(
  creatorId: number,
  mode: "time" | "words",
  amount: number,
  kind: RaceKind = "multi",
  invitedUserId?: number
): string | null {
  if (!isValidAmount(mode, amount)) return null;

  const invited = kind === "duo" && invitedUserId !== undefined && invitedUserId !== creatorId ? invitedUserId : null;
  const words = freshWords(mode, amount);

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = makeRaceId();
    try {
      transaction(() => insertRace(id, creatorId, kind, mode, amount, invited, words));
      return id;
    } catch {
      // Id collision (extremely unlikely): try another.
    }
  }
  return null;
}

/**
 * Decides whether a race is over yet, and who won. Pure: takes the rows and the time.
 * Returns null while the race is still going. `winnerId` is null for a tie or an abandoned race.
 */
function decide(race: RaceRow, players: PlayerRow[], now: number): { winnerId: number | null } | null {
  if (race.finished_at !== null || race.cancelled || race.start_at === null || players.length < MIN_PLAYERS) {
    return null;
  }

  const finished = players.filter((player) => player.finished_at !== null);
  const everyoneDone = finished.length === players.length;

  let deadline: number;
  if (race.mode === "time") {
    deadline = race.start_at + race.amount * 1000 + FINISH_GRACE_MS;
  } else {
    deadline = race.start_at + WORDS_RACE_MAX_MS;
    if (finished.length > 0) {
      const firstFinish = Math.min(...finished.map((player) => player.finished_at as number));
      deadline = Math.min(deadline, firstFinish + WORDS_STRAGGLER_MS);
    }
  }

  if (!everyoneDone && now < deadline) return null;

  // Anyone who never reported a result forfeits (they get no place).
  const places = rankResults(
    players.map((player) => ({ wpm: player.finished_at !== null ? player.wpm : null, accuracy: player.accuracy }))
  );
  const winners = players.filter((_, index) => places[index] === 1);
  return { winnerId: winners.length === 1 ? winners[0].user_id : null };
}

/** Must be called inside a transaction. */
function resolveNow(raceId: string, now: number): void {
  const race = loadRace(raceId);
  if (!race) return;
  const outcome = decide(race, loadPlayers(raceId), now);
  if (!outcome) return;
  getDb()
    .prepare("UPDATE races SET finished_at = ?, winner_id = ? WHERE id = ? AND finished_at IS NULL")
    .run(now, outcome.winnerId, raceId);
}

/** Settles the race if its time is up, without taking a write lock when nothing changed. */
function settleIfDue(raceId: string, now: number): void {
  const race = loadRace(raceId);
  if (!race || !decide(race, loadPlayers(raceId), now)) return;
  transaction(() => resolveNow(raceId, now));
}

function phaseOf(race: RaceRow, now: number): RacePhase {
  if (race.cancelled) return "cancelled";
  if (race.finished_at !== null) return "finished";
  if (race.start_at === null) return isOpenLobby(race, now) ? "waiting" : "cancelled";
  return now < race.start_at ? "countdown" : "running";
}

function playerView(player: PlayerRow, viewerId: number, hostId: number, place: number | null): RacePlayerView {
  const done = player.finished_at !== null;
  return {
    username: player.username,
    isMe: player.user_id === viewerId,
    isHost: player.user_id === hostId,
    isReady: player.user_id === hostId || player.ready === 1,
    correctChars: player.correct_chars,
    typedChars: player.typed_chars,
    wordsDone: player.words_done,
    finished: done,
    place,
    result: done
      ? {
          wpm: player.wpm ?? 0,
          rawWpm: player.raw_wpm ?? 0,
          accuracy: player.accuracy ?? 0,
          correct: player.correct ?? 0,
          incorrect: player.incorrect ?? 0,
          extra: player.extra ?? 0,
          missed: player.missed ?? 0,
        }
      : null,
  };
}

export function getRaceView(raceId: string, viewerId: number, options: { includeWords?: boolean } = {}): RaceView | null {
  const now = Date.now();
  settleIfDue(raceId, now);

  const race = loadRace(raceId);
  if (!race) return null;

  const rows = loadPlayers(raceId);
  const phase = phaseOf(race, now);
  const host = rows.find((player) => player.user_id === race.creator_id);
  const isPlayer = rows.some((player) => player.user_id === viewerId);
  const viewer = viewerId === race.creator_id ? "host" : isPlayer ? "player" : "visitor";
  const words = JSON.parse(race.words) as string[];

  // Places only exist once the race is over; until then everyone is listed in join order.
  const places =
    phase === "finished"
      ? rankResults(rows.map((player) => ({ wpm: player.finished_at !== null ? player.wpm : null, accuracy: player.accuracy })))
      : rows.map(() => null);

  let players = rows.map((player, index) => playerView(player, viewerId, race.creator_id, places[index]));
  if (phase === "finished") {
    // Best place first; players without a place (did not finish) last, in join order.
    players = players
      .map((player, index) => ({ player, index }))
      .sort((a, b) => (a.player.place ?? Infinity) - (b.player.place ?? Infinity) || a.index - b.index)
      .map((entry) => entry.player);
  }
  const me = players.find((player) => player.isMe) ?? null;

  let outcome: RaceOutcome | null = null;
  if (phase === "finished" && me) {
    const winners = players.filter((player) => player.place === 1);
    if (winners.length === 0) outcome = "abandoned";
    else if (me.place === 1) outcome = winners.length === 1 ? "win" : "draw";
    else outcome = "loss";
  }

  const wordsVisible = isPlayer && (phase === "countdown" || phase === "running" || phase === "finished");

  const usernameOf = (id: number | null): string | null =>
    id === null
      ? null
      : ((getDb().prepare("SELECT username FROM users WHERE id = ?").get(id) as { username: string } | undefined)
          ?.username ?? null);

  let rematch: RaceView["rematch"] = null;
  if (isPlayer && phase === "finished" && race.rematch_id) {
    const next = loadRace(race.rematch_id);
    if (next && isOpenLobby(next, now)) rematch = { id: next.id, host: usernameOf(next.creator_id) ?? "" };
  }

  return {
    id: race.id,
    kind: race.kind,
    mode: race.mode,
    amount: race.amount,
    phase,
    serverNow: now,
    startAt: race.start_at,
    viewer,
    host: host?.username ?? "",
    invited: usernameOf(race.invited_user_id),
    invitedMe: race.invited_user_id === viewerId,
    cancelReason: race.cancelled === 2 ? "declined" : phase === "cancelled" ? "cancelled" : null,
    rematch,
    playerCount: rows.length,
    maxPlayers: capacityOf(race.kind),
    words: wordsVisible && options.includeWords ? words : null,
    totalChars: totalChars(words),
    players: isPlayer ? players : [],
    me: isPlayer ? me : null,
    outcome,
  };
}

/** Must be called inside a transaction. */
function joinNow(raceId: string, userId: number): { error: RaceError } | { ok: true } {
  const race = loadRace(raceId);
  if (!race) return { error: "not_found" };
  const now = Date.now();
  const players = loadPlayers(raceId);
  if (players.some((player) => player.user_id === userId)) return { ok: true };
  if (!isOpenLobby(race, now)) return { error: "closed" };
  // A challenge sent to one person can only be accepted by that person.
  if (race.invited_user_id !== null && race.invited_user_id !== userId) return { error: "not_invited" };
  if (players.length >= capacityOf(race.kind)) return { error: "full" };

  const db = getDb();
  if (race.kind === "duo") {
    // A duel begins by itself a few seconds after the opponent accepts: no Ready, no Start.
    db.prepare("INSERT INTO race_players (race_id, user_id, ready) VALUES (?, ?, 1)").run(raceId, userId);
    db.prepare("UPDATE races SET opponent_id = ?, start_at = ? WHERE id = ?").run(userId, now + COUNTDOWN_MS, raceId);
  } else {
    db.prepare("INSERT INTO race_players (race_id, user_id) VALUES (?, ?)").run(raceId, userId);
  }
  return { ok: true };
}

/** Anyone with the link can join until the host starts the race (or the invited person, for a challenge). */
export function joinRace(raceId: string, userId: number): { error: RaceError } | { ok: true } {
  return transaction(() => joinNow(raceId, userId));
}

/** The invited player says no. The host is told when they look at the challenge. */
export function declineRace(raceId: string, userId: number): { error: RaceError } | { ok: true } {
  return transaction(() => {
    const race = loadRace(raceId);
    if (!race) return { error: "not_found" as const };
    if (race.invited_user_id !== userId) return { error: "forbidden" as const };
    if (!isOpenLobby(race, Date.now())) return { error: "closed" as const };
    getDb().prepare("UPDATE races SET cancelled = 2 WHERE id = ? AND start_at IS NULL").run(raceId);
    return { ok: true as const };
  });
}

export interface PendingInvite {
  raceId: string;
  from: string;
  mode: "time" | "words";
  amount: number;
  createdAt: number;
}

/** Challenges sent to this player that they have not answered and that are still open. */
export function getPendingInvites(userId: number, now = Date.now()): PendingInvite[] {
  const rows = getDb()
    .prepare(
      `SELECT r.id AS raceId, u.username AS "from", r.mode AS mode, r.amount AS amount, r.created_at AS createdAt
         FROM races r JOIN users u ON u.id = r.creator_id
        WHERE r.invited_user_id = ? AND r.start_at IS NULL AND r.cancelled = 0
          AND r.finished_at IS NULL AND r.created_at > ?
        ORDER BY r.created_at DESC`
    )
    .all(userId, now - INVITE_EXPIRY_MS) as unknown as PendingInvite[];

  // Database rows have no prototype, which Next.js will not pass from a server page to a browser
  // component, so hand back plain objects.
  return rows.map((row) => ({
    raceId: row.raceId,
    from: row.from,
    mode: row.mode,
    amount: row.amount,
    createdAt: row.createdAt,
  }));
}

/**
 * Starts a rematch of a finished race, or joins the one a player already started. A rematch of a
 * challenge goes only to the other player; a rematch of a race is an open lobby for everyone.
 */
export function startRematch(raceId: string, userId: number): { error: RaceError } | { rematchId: string } {
  return transaction(() => {
    const race = loadRace(raceId);
    if (!race) return { error: "not_found" as const };
    const players = loadPlayers(raceId);
    if (!players.some((player) => player.user_id === userId)) return { error: "forbidden" as const };
    if (race.finished_at === null) return { error: "closed" as const };

    const now = Date.now();
    if (race.rematch_id) {
      const existing = loadRace(race.rematch_id);
      if (existing && isOpenLobby(existing, now)) {
        const joined = joinNow(existing.id, userId);
        return "error" in joined ? joined : { rematchId: existing.id };
      }
    }

    const other = players.find((player) => player.user_id !== userId);
    const invited = race.kind === "duo" && other ? other.user_id : null;
    const id = makeRaceId();
    insertRace(id, userId, race.kind, race.mode, race.amount, invited, freshWords(race.mode, race.amount));
    getDb().prepare("UPDATE races SET rematch_id = ? WHERE id = ?").run(id, raceId);
    return { rematchId: id };
  });
}

/** A player says whether they are ready to race. The host is always ready. */
export function setReady(raceId: string, userId: number, ready: boolean): { error: RaceError } | { ok: true } {
  return transaction(() => {
    const race = loadRace(raceId);
    if (!race) return { error: "not_found" as const };
    if (race.kind === "duo") return { error: "forbidden" as const };
    if (!loadPlayers(raceId).some((player) => player.user_id === userId)) return { error: "forbidden" as const };
    if (!isOpenLobby(race, Date.now())) return { error: "closed" as const };
    getDb()
      .prepare("UPDATE race_players SET ready = ? WHERE race_id = ? AND user_id = ?")
      .run(ready ? 1 : 0, raceId, userId);
    return { ok: true as const };
  });
}

/** A joined player (not the host) backs out before the race starts. */
export function leaveRace(raceId: string, userId: number): { error: RaceError } | { ok: true } {
  return transaction(() => {
    const race = loadRace(raceId);
    if (!race) return { error: "not_found" as const };
    if (race.creator_id === userId) return { error: "forbidden" as const };
    if (!isOpenLobby(race, Date.now())) return { error: "closed" as const };
    getDb().prepare("DELETE FROM race_players WHERE race_id = ? AND user_id = ?").run(raceId, userId);
    return { ok: true as const };
  });
}

/** The host starts the race, once everyone else in the lobby has clicked Ready. */
export function startRace(raceId: string, userId: number): { error: RaceError } | { ok: true } {
  return transaction(() => {
    const race = loadRace(raceId);
    if (!race) return { error: "not_found" as const };
    if (race.creator_id !== userId || race.kind === "duo") return { error: "forbidden" as const };
    const now = Date.now();
    if (!isOpenLobby(race, now)) return { error: "closed" as const };
    const players = loadPlayers(raceId);
    if (players.length < MIN_PLAYERS) return { error: "need_players" as const };
    if (players.some((player) => player.user_id !== race.creator_id && player.ready !== 1)) {
      return { error: "not_ready" as const };
    }

    getDb().prepare("UPDATE races SET start_at = ? WHERE id = ? AND start_at IS NULL").run(now + COUNTDOWN_MS, raceId);
    return { ok: true as const };
  });
}

/** The host closes the lobby before the race starts. */
export function cancelRace(raceId: string, userId: number): { error: RaceError } | { ok: true } {
  const race = loadRace(raceId);
  if (!race) return { error: "not_found" };
  if (race.creator_id !== userId) return { error: "forbidden" };
  if (race.start_at !== null || race.finished_at !== null) return { error: "closed" };
  getDb().prepare("UPDATE races SET cancelled = 1 WHERE id = ? AND start_at IS NULL").run(raceId);
  return { ok: true };
}

export function parseProgress(body: Record<string, unknown>): RaceProgress | null {
  const correctChars = wholeNumber(body.correctChars, 0, 200_000);
  const typedChars = wholeNumber(body.typedChars, 0, 200_000);
  const wordsDone = wholeNumber(body.wordsDone, 0, 100_000);
  return correctChars === null || typedChars === null || wordsDone === null
    ? null
    : { correctChars, typedChars, wordsDone };
}

export function parseFinish(body: Record<string, unknown>): TypedLog | null {
  return parseTypedLog(body);
}

/** Records a player's live progress. Silently ignores anything that is not a running race or not humanly possible. */
export function reportProgress(raceId: string, userId: number, progress: RaceProgress): void {
  const race = loadRace(raceId);
  const now = Date.now();
  if (!race || race.start_at === null || race.finished_at !== null || now < race.start_at) return;

  const elapsedSeconds = (now - race.start_at) / 1000;
  const words = JSON.parse(race.words) as string[];
  const ceiling = Math.min(totalChars(words), (elapsedSeconds + 2) * MAX_CHARS_PER_SECOND);
  if (progress.correctChars > ceiling || progress.wordsDone > words.length) return;

  getDb()
    .prepare(
      `UPDATE race_players
          SET correct_chars = ?, typed_chars = ?, words_done = ?
        WHERE race_id = ? AND user_id = ? AND finished_at IS NULL`
    )
    .run(progress.correctChars, Math.max(progress.typedChars, progress.correctChars), progress.wordsDone, raceId, userId);
}

/**
 * Records a player's final result and, if that ends the race, settles the places.
 * The result is recounted from the typing log against the race's own words and the server's clock;
 * nothing the player claims about their own score is used.
 */
export function finishRace(
  raceId: string,
  userId: number,
  log: TypedLog
): { error: RaceError; reason?: string } | { ok: true } {
  return transaction(() => {
    const race = loadRace(raceId);
    if (!race) return { error: "not_found" as const };
    const player = loadPlayers(raceId).find((row) => row.user_id === userId);
    if (!player) return { error: "forbidden" as const };
    const now = Date.now();
    if (race.start_at === null || now < race.start_at || race.cancelled || race.finished_at !== null) {
      return { error: "closed" as const };
    }
    if (player.finished_at !== null) return { ok: true as const };

    const verdict = verifyLog(JSON.parse(race.words) as string[], log);
    if (!verdict.ok) return { error: "invalid" as const, reason: verdict.reason };

    // The log cannot describe more typing time than the race has lasted so far.
    const wallMs = now - race.start_at;
    if (verdict.durationMs > wallMs + 2500) {
      return { error: "invalid" as const, reason: "The typing log is longer than the race has lasted." };
    }

    const { correct, incorrect, extra, missed } = verdict.counts;
    const typed = correct + incorrect + extra;
    let elapsedSeconds: number;
    if (race.mode === "time") {
      // A timed race lasts exactly its time; a result cannot arrive before that has passed.
      if (now < race.start_at + race.amount * 1000 - EARLY_FINISH_TOLERANCE_MS) return { error: "too_early" as const };
      if (verdict.durationMs > race.amount * 1000 + 2500) {
        return { error: "invalid" as const, reason: "Keys were recorded after the time was up." };
      }
      elapsedSeconds = race.amount;
    } else {
      elapsedSeconds = Math.max(1, wallMs / 1000);
      if (log.typedWords.length + (log.finalInput ? 1 : 0) < race.amount) {
        return { error: "invalid" as const, reason: "Not all of the words were typed." };
      }
    }

    const wpm = calcWpm(correct, elapsedSeconds);
    if (wpm > MAX_PLAUSIBLE_WPM || correct > (elapsedSeconds + 2) * MAX_CHARS_PER_SECOND) {
      return { error: "invalid" as const, reason: "That speed is not humanly possible." };
    }

    getDb()
      .prepare(
        `UPDATE race_players
            SET finished_at = ?, wpm = ?, raw_wpm = ?, accuracy = ?,
                correct = ?, incorrect = ?, extra = ?, missed = ?,
                correct_chars = ?, typed_chars = ?
          WHERE race_id = ? AND user_id = ?`
      )
      .run(
        now,
        wpm,
        calcRawWpm(typed, elapsedSeconds),
        calcAccuracy(correct, typed),
        correct,
        incorrect,
        extra,
        missed,
        correct,
        typed,
        raceId,
        userId
      );

    resolveNow(raceId, now);
    return { ok: true as const };
  });
}
