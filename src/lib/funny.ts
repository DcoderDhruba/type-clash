import { FUNNY_MESSAGES } from "./funnyMessages";
import type { FunnyCategory, FunnyMessage } from "./funnyMessages";
import type { RacePlayerView, RaceView } from "./race";

/**
 * Picks and fills in the funny messages. The messages themselves live in
 * funnyMessages.ts; this file only decides which category applies and which
 * message to show, so you should not need to edit it to add messages.
 */

export type { FunnyCategory, FunnyMessage };
export type FunnyVars = Partial<Record<"name" | "wpm" | "winner" | "winnerWpm" | "leader", string | number>>;

const PLACEHOLDER_DEFAULTS: Record<string, string> = {
  name: "you",
  wpm: "0",
  winner: "the winner",
  winnerWpm: "0",
  leader: "the leader",
};

// Remembers the last message shown per category so the same one is not picked twice in a row.
const lastPicked = new Map<FunnyCategory, number>();

/** A small, stable string hash (FNV-1a), so the same seed always gives the same number. */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fill(text: string, vars: FunnyVars): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = vars[key as keyof FunnyVars] ?? PLACEHOLDER_DEFAULTS[key];
    // An unknown placeholder (a typo in funnyMessages.ts) is left visible so it is easy to spot.
    return value === undefined ? placeholder : String(value);
  });
}

/**
 * A message for the category, or null if that list is empty.
 *
 * Without a `seed` the choice is random (and never the same twice in a row). With a `seed`
 * the choice looks random but is always the same for that seed, so the same race and player
 * keep the same message when the page is refreshed.
 */
export function pickFunny(category: FunnyCategory, vars: FunnyVars = {}, seed?: string): FunnyMessage | null {
  const pool = FUNNY_MESSAGES[category] ?? [];
  if (pool.length === 0) return null;

  let index: number;
  if (seed !== undefined) {
    index = hashString(`${seed}|${category}`) % pool.length;
  } else {
    index = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && index === lastPicked.get(category)) {
      index = (index + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    }
    lastPicked.set(category, index);
  }

  const message = pool[index];
  return { icon: message.icon, text: fill(message.text, vars) };
}

/** Which "after the race" list applies to the person looking at these results. */
export function resultCategory(view: RaceView): FunnyCategory {
  const me = view.me;
  if (!me || view.outcome === "abandoned" || view.outcome === null) return "abandoned";
  if (!me.result) return "didNotFinish";
  if (me.result.wpm === 0) return "noTyping";
  if (view.outcome === "draw") return "tie";
  if (view.outcome === "win") return "winner";

  // A 1v1 challenge has no podium, so a loss is just a loss (no "silver medal" jokes).
  if (view.kind === "duo") return "lost";

  const placed = view.players.filter((player) => player.place !== null);
  const worstPlace = Math.max(...placed.map((player) => player.place as number));
  if (view.players.length >= 3 && me.place === worstPlace) return "last";
  if (me.place === 2) return "second";
  if (me.place === 3) return "third";
  return "middle";
}

export function resultVars(view: RaceView): FunnyVars {
  const winners = view.players.filter((player) => player.place === 1);
  return {
    name: view.me?.username,
    wpm: view.me?.result?.wpm ?? 0,
    winner: winners.map((player) => player.username).join(" and ") || undefined,
    winnerWpm: winners[0]?.result?.wpm ?? 0,
  };
}

export interface LiveStanding {
  position: number;
  category: "leading" | "chasing" | "behind";
  leader: string;
}

/**
 * Where you are right now, going by how many correct characters everyone has typed.
 * `myChars` is passed in because it is more up to date than the copy the server has.
 * Returns null while nobody has typed anything or there is nobody to compare with.
 */
export function liveStanding(players: RacePlayerView[], myChars: number): LiveStanding | null {
  const others = players.filter((player) => !player.isMe);
  if (others.length === 0) return null;
  if (Math.max(myChars, ...others.map((player) => player.correctChars)) === 0) return null;

  const position = 1 + others.filter((player) => player.correctChars > myChars).length;
  const leader = others.reduce((best, player) => (player.correctChars > best.correctChars ? player : best));
  return {
    position,
    category: position === 1 ? "leading" : position <= 3 ? "chasing" : "behind",
    leader: leader.username,
  };
}
