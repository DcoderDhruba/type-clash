export type Mode = "time" | "words";

export type TestStatus = "idle" | "running" | "finished";

export type CharStatus = "correct" | "incorrect" | "extra" | "pending";

export interface CharResult {
  char: string;
  status: CharStatus;
}

export interface WordCounts {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface Keystroke {
  /** Milliseconds since the test started. */
  at: number;
  correct: boolean;
}

export interface SecondSample {
  second: number;
  wpm: number;
  raw: number;
  burst: number;
  errors: number;
}

/** What was typed, so a score can be re-checked from scratch. */
export interface TypedLog {
  typedWords: string[];
  finalInput: string;
  /** When each character was typed, in milliseconds since the first one. */
  keystrokes: number[];
}

export interface TestResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
  elapsedSeconds: number;
  samples: SecondSample[];
  log: TypedLog;
}
