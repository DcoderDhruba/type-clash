import { DEFAULT_CONFIG } from "./config";
import type { TypingTestConfig } from "./config";
import type { TypedLog } from "./types";

/** Shared between the server (which builds these) and the race screen (which renders them). */

/**
 * A "duo" is a one-on-one challenge: it starts by itself when the opponent accepts.
 * A "multi" is a multiplayer race: players join a lobby, click Ready, and the host starts it.
 */
export type RaceKind = "duo" | "multi";

/** The most people who can be in a multiplayer race. */
export const MAX_PLAYERS = 8;
/** A duo is always exactly two players. */
export const DUO_PLAYERS = 2;

export function capacityOf(kind: RaceKind): number {
  return kind === "duo" ? DUO_PLAYERS : MAX_PLAYERS;
}
/** A race needs at least this many players before the host can start it. */
export const MIN_PLAYERS = 2;

export type RacePhase = "waiting" | "countdown" | "running" | "finished" | "cancelled";
export type RaceOutcome = "win" | "loss" | "draw" | "abandoned";

export interface RaceResultStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface RacePlayerView {
  username: string;
  isMe: boolean;
  isHost: boolean;
  /** Clicked "Ready" in the lobby. The host counts as ready. */
  isReady: boolean;
  correctChars: number;
  typedChars: number;
  wordsDone: number;
  finished: boolean;
  result: RaceResultStats | null;
  /** 1-based place once the race is over (equal results share a place); null while racing or if unranked. */
  place: number | null;
}

export interface RaceView {
  id: string;
  kind: RaceKind;
  mode: "time" | "words";
  amount: number;
  phase: RacePhase;
  /** Server clock when this view was built, used to line up countdowns between players. */
  serverNow: number;
  /** Set once the host starts the race; the moment typing begins. */
  startAt: number | null;
  viewer: "host" | "player" | "visitor";
  host: string;
  /** Username of the one player this challenge was sent to, if it was sent to someone in particular. */
  invited: string | null;
  /** True when the person looking is the one who was invited. */
  invitedMe: boolean;
  /** Why a closed race was closed, so the host can be told when the invited player said no. */
  cancelReason: "cancelled" | "declined" | null;
  /** A rematch someone in this race started that is still open to join. */
  rematch: { id: string; host: string } | null;
  playerCount: number;
  maxPlayers: number;
  /** Only sent to people in the race, and only once it has started. */
  words: string[] | null;
  totalChars: number;
  /** Everyone in the race (empty for visitors). Best place first once the race is over. */
  players: RacePlayerView[];
  me: RacePlayerView | null;
  /** From the viewer's point of view; null until the race is over (or for visitors). */
  outcome: RaceOutcome | null;
}

/** What a player sends when they finish: everything they typed, which the server recounts itself. */
export type RaceFinishLog = TypedLog;

export interface RaceProgress {
  correctChars: number;
  typedChars: number;
  wordsDone: number;
}

export type RaceAction =
  | { action: "join" }
  | { action: "leave" }
  | { action: "decline" }
  | { action: "rematch" }
  | { action: "ready"; ready: boolean }
  | { action: "start" }
  | { action: "cancel" }
  | ({ action: "progress" } & RaceProgress)
  | ({ action: "finish" } & RaceFinishLog);

/** The typing-test rules a race is played under. */
export function raceConfig(mode: "time" | "words", amount: number): TypingTestConfig {
  return {
    ...DEFAULT_CONFIG,
    mode,
    timeLimit: (mode === "time" ? amount : DEFAULT_CONFIG.timeLimit) as TypingTestConfig["timeLimit"],
    wordLimit: (mode === "words" ? amount : DEFAULT_CONFIG.wordLimit) as TypingTestConfig["wordLimit"],
  };
}

/** How far along a player is, from 0 to 1, for the progress bars. */
export function raceProgressRatio(view: Pick<RaceView, "mode" | "amount" | "totalChars">, correctChars: number): number {
  // Time races have no fixed length, so the bar fills at a 120 wpm pace (10 characters a second).
  const target = view.mode === "words" ? view.totalChars : view.amount * 10;
  return target > 0 ? Math.min(1, correctChars / target) : 0;
}
