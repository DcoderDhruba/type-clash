export const COMMON_WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "is", "water", "long", "find", "here", "thing", "great", "man", "world", "life",
  "still", "hand", "part", "child", "eye", "woman", "place", "work", "week", "case",
  "point", "government", "company", "number", "group", "problem", "fact", "be", "seem", "feel",
  "try", "leave", "call", "keep", "let", "begin", "help", "talk", "turn", "start",
  "might", "show", "hear", "play", "run", "move", "live", "believe", "bring", "happen",
  "write", "provide", "sit", "stand", "lose", "pay", "meet", "include", "continue", "set",
  "learn", "change", "lead", "understand", "watch", "follow", "stop", "create", "speak", "read",
  "allow", "add", "spend", "grow", "open", "walk", "win", "offer", "remember", "love",
  "consider", "appear", "buy", "wait", "serve", "die", "send", "expect", "build", "stay",
  "fall", "cut", "reach", "kill", "remain", "suggest", "raise", "pass", "sell", "require",
  "report", "decide", "pull", "return", "explain", "hope", "develop", "carry", "break", "receive",
  "agree", "support", "hit", "produce", "eat", "cover", "catch", "draw", "choose", "cause",
  "study", "apply", "check", "clean", "cook", "dance", "dream", "drive", "enjoy", "fight",
  "fly", "join", "laugh", "listen", "paint", "plan", "plant", "play", "rest", "ride",
  "rise", "roll", "save", "share", "shine", "shout", "sing", "sleep", "smile", "solve",
];

const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const PUNCTUATION_MARKS = [".", ",", "!", "?", ";"];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export interface WordOptions {
  punctuation?: boolean;
  numbers?: boolean;
}

/** A stable 32-bit hash of the seed text (FNV-1a). */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A small deterministic random generator (mulberry32): the same seed always gives the same numbers. */
function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh random seed for a new test. */
export function newSeed(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

export const SEED_PATTERN = /^[a-z0-9]{6,32}$/;

export interface WordStream {
  /** The next `count` words. Calling this again carries on where the last call stopped. */
  take(count: number): string[];
}

/**
 * The words for a test, as an endless stream that depends only on the seed and options.
 * Anyone with the same seed and options gets exactly the same words in the same order, however
 * they are batched, which is how the server can check what a player was actually typing.
 */
export function createWordStream(seed: string, options: WordOptions = {}): WordStream {
  const { punctuation = false, numbers = false } = options;
  const random = seededRandom(seed);
  const randomInt = (max: number) => Math.floor(random() * max);
  let previous = "";
  let produced = 0;

  return {
    take(count: number): string[] {
      const result: string[] = [];
      for (let i = 0; i < count; i++) {
        let word = COMMON_WORDS[randomInt(COMMON_WORDS.length)];
        while (word === previous) {
          word = COMMON_WORDS[randomInt(COMMON_WORDS.length)];
        }
        previous = word;

        if (numbers && randomInt(12) === 0) {
          const digits = 1 + randomInt(3);
          word = Array.from({ length: digits }, () => NUMBERS[randomInt(NUMBERS.length)]).join("");
        } else if (punctuation && randomInt(10) === 0) {
          word = capitalize(word);
        } else if (punctuation && randomInt(11) === 0) {
          word = word + PUNCTUATION_MARKS[randomInt(PUNCTUATION_MARKS.length)];
        }

        if (punctuation && produced === 0) word = capitalize(word);
        produced++;
        result.push(word);
      }
      return result;
    },
  };
}

/** A random list of words (used where the exact words do not need to be reproducible). */
export function generateWords(count: number, options: WordOptions = {}): string[] {
  return createWordStream(newSeed(), options).take(count);
}
