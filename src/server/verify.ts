import { countChars } from "@/lib/scoring";
import type { TypedLog, WordCounts } from "@/lib/types";

/**
 * Re-checks a typing log on the server. The log is what the browser recorded: every word that was
 * typed and when each character was typed. Nothing the browser claims about its own score is
 * trusted; the score is recounted here from the log and the real words.
 */

const MAX_TYPED_WORDS = 4000;
const MAX_WORD_LENGTH = 80;
const MAX_KEYSTROKES = 40_000;
const MAX_DURATION_MS = 60 * 60 * 1000;

/** Two characters closer together than this cannot both have been typed by a person. */
export const MIN_HUMAN_GAP_MS = 5;
/** More than this many keys in any single second is faster than anyone types (about 420 wpm). */
export const MAX_KEYS_PER_SECOND = 35;
/** People's typing rhythm varies; a log this regular was produced by a program. */
export const MIN_RHYTHM_VARIATION = 0.04;

export function parseTypedLog(body: unknown): TypedLog | null {
  if (typeof body !== "object" || body === null) return null;
  const { typedWords, finalInput, keystrokes } = body as Record<string, unknown>;

  if (!Array.isArray(typedWords) || typedWords.length > MAX_TYPED_WORDS) return null;
  if (!typedWords.every((word) => typeof word === "string" && word.length > 0 && word.length <= MAX_WORD_LENGTH)) {
    return null;
  }
  if (typeof finalInput !== "string" || finalInput.length > MAX_WORD_LENGTH) return null;
  if (!Array.isArray(keystrokes) || keystrokes.length > MAX_KEYSTROKES) return null;
  if (!keystrokes.every((at) => Number.isInteger(at) && at >= 0 && at <= MAX_DURATION_MS)) return null;

  return { typedWords: typedWords as string[], finalInput, keystrokes: keystrokes as number[] };
}

export type LogVerdict =
  | { ok: true; counts: WordCounts; durationMs: number }
  | { ok: false; reason: string };

const reject = (reason: string): LogVerdict => ({ ok: false, reason });

/** `words` must be the exact words the player was shown, in order. */
export function verifyLog(words: string[], log: TypedLog): LogVerdict {
  const times = log.keystrokes;
  const count = times.length;

  // Every character that ends up in the answer was typed with a key press. Fewer key presses than
  // characters means text was pasted in or filled in by a program.
  const typedChars = log.typedWords.reduce((sum, word) => sum + word.length + 1, 0) + log.finalInput.length;
  if (count < typedChars) return reject("Fewer key presses were recorded than characters typed.");
  if (count > typedChars * 4 + 100) return reject("The key press record does not match what was typed.");

  for (let i = 1; i < count; i++) {
    if (times[i] < times[i - 1]) return reject("The key press times are out of order.");
  }

  if (count > 10) {
    let tooClose = 0;
    for (let i = 1; i < count; i++) if (times[i] - times[i - 1] < MIN_HUMAN_GAP_MS) tooClose++;
    if (tooClose / (count - 1) > 0.1) return reject("Keys were pressed faster than a person can type.");
  }

  // Sliding one-second window over the key presses.
  for (let end = 0, start = 0; end < count; end++) {
    while (times[end] - times[start] >= 1000) start++;
    if (end - start + 1 > MAX_KEYS_PER_SECOND) return reject("Typing speed in a single second was not humanly possible.");
  }

  if (count >= 80) {
    const gaps: number[] = [];
    for (let i = 1; i < count; i++) gaps.push(times[i] - times[i - 1]);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
    if (mean > 0 && Math.sqrt(variance) / mean < MIN_RHYTHM_VARIATION) {
      return reject("The typing rhythm was too regular to be a person.");
    }
  }

  return {
    ok: true,
    counts: countChars(words, log.typedWords, log.finalInput),
    durationMs: count > 0 ? times[count - 1] : 0,
  };
}
