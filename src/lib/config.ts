import type { Mode } from "./types";

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [30, 50, 75, 100] as const;

export interface TypingTestConfig {
  mode: Mode;
  timeLimit: (typeof TIME_OPTIONS)[number];
  wordLimit: (typeof WORD_OPTIONS)[number];
  punctuation: boolean;
  numbers: boolean;
}

export const DEFAULT_CONFIG: TypingTestConfig = {
  mode: "time",
  timeLimit: 30,
  wordLimit: 30,
  punctuation: false,
  numbers: false,
};

/** The amount for a mode: seconds for "time", word count for "words". */
export function amountOf(config: TypingTestConfig): number {
  return config.mode === "time" ? config.timeLimit : config.wordLimit;
}

export function isValidAmount(mode: string, amount: number): boolean {
  if (mode === "time") return (TIME_OPTIONS as readonly number[]).includes(amount);
  if (mode === "words") return (WORD_OPTIONS as readonly number[]).includes(amount);
  return false;
}
