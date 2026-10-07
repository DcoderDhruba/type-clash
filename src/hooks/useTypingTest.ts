"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWordStream, generateWords, newSeed } from "@/lib/words";
import type { WordStream } from "@/lib/words";
import {
  compareWord,
  countChars,
  calcWpm,
  calcRawWpm,
  calcAccuracy,
  buildSamples,
  calcConsistency,
} from "@/lib/scoring";
import { DEFAULT_CONFIG, TIME_OPTIONS, WORD_OPTIONS } from "@/lib/config";
import type { TypingTestConfig } from "@/lib/config";
import type { Keystroke, Mode, TestStatus, TestResult } from "@/lib/types";

export { TIME_OPTIONS, WORD_OPTIONS };
export type { TypingTestConfig };

const INITIAL_WORD_COUNT = 60;
const APPEND_WORD_COUNT = 40;
const APPEND_THRESHOLD = 15;
const TICK_MS = 200;

const CONFIG_STORAGE_KEY = "typechaze:config";

/** Reads the last-used settings, ignoring anything missing or no longer valid. */
function loadSavedConfig(): TypingTestConfig | null {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return {
      mode: saved.mode === "words" ? "words" : "time",
      timeLimit: TIME_OPTIONS.find((t) => t === saved.timeLimit) ?? DEFAULT_CONFIG.timeLimit,
      wordLimit: WORD_OPTIONS.find((w) => w === saved.wordLimit) ?? DEFAULT_CONFIG.wordLimit,
      punctuation: saved.punctuation === true,
      numbers: saved.numbers === true,
    };
  } catch {
    return null;
  }
}

function saveConfig(config: TypingTestConfig) {
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage can be unavailable (private mode, blocked); the settings just won't persist.
  }
}

function initialWordCount(config: TypingTestConfig): number {
  return config.mode === "words" ? config.wordLimit : INITIAL_WORD_COUNT;
}

export interface UseTypingTestOptions {
  /** Fixed words and rules (a race). Skips saved settings, random words and word top-ups. */
  fixed?: { words: string[]; config: TypingTestConfig };
  /** Wait for begin() to start the clock instead of starting on the first keystroke. */
  manualStart?: boolean;
}

export function useTypingTest({ fixed, manualStart = false }: UseTypingTestOptions = {}) {
  const isFixed = fixed !== undefined;
  const [config, setConfig] = useState<TypingTestConfig>(fixed?.config ?? DEFAULT_CONFIG);
  const [words, setWords] = useState<string[]>(fixed?.words ?? []);
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  /** Identifies this test's words: the server can rebuild them from it to check a score. */
  const [seed, setSeed] = useState("");

  const startTimeRef = useRef<number | null>(null);
  const keystrokesRef = useRef<Keystroke[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<WordStream | null>(null);
  const configRef = useRef(config);
  const wordsRef = useRef(words);

  // Keep the refs in step with state after each render. This effect is declared before the
  // others so they always see the latest values.
  useEffect(() => {
    configRef.current = config;
    wordsRef.current = words;
  }, [config, words]);

  /** Starts a new seeded word list for these settings. */
  const startWords = useCallback((cfg: TypingTestConfig): string[] => {
    const nextSeed = newSeed();
    const stream = createWordStream(nextSeed, cfg);
    streamRef.current = stream;
    setSeed(nextSeed);
    return stream.take(initialWordCount(cfg));
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const computeResult = useCallback(
    (finalTypedWords: string[], finalCurrentInput: string, elapsedSecondsIn: number): TestResult => {
      const cfg = configRef.current;
      const targetWords = wordsRef.current;
      const elapsedSeconds = cfg.mode === "time" ? cfg.timeLimit : Math.max(0.001, elapsedSecondsIn);

      const totals = countChars(targetWords, finalTypedWords, finalCurrentInput);

      const totalTyped = totals.correct + totals.incorrect + totals.extra;
      const samples = buildSamples(keystrokesRef.current, elapsedSeconds);
      return {
        wpm: calcWpm(totals.correct, elapsedSeconds),
        rawWpm: calcRawWpm(totalTyped, elapsedSeconds),
        accuracy: calcAccuracy(totals.correct, totalTyped),
        consistency: calcConsistency(samples.map((sample) => sample.burst)),
        correctChars: totals.correct,
        incorrectChars: totals.incorrect,
        extraChars: totals.extra,
        missedChars: totals.missed,
        elapsedSeconds: Math.round(elapsedSeconds),
        samples,
        log: {
          typedWords: finalTypedWords,
          finalInput: finalCurrentInput,
          keystrokes: keystrokesRef.current.map((keystroke) => keystroke.at),
        },
      };
    },
    []
  );

  const finish = useCallback(
    (finalTypedWords: string[], finalCurrentInput: string) => {
      clearTimer();
      const elapsedSeconds = (Date.now() - (startTimeRef.current ?? Date.now())) / 1000;
      setResult(computeResult(finalTypedWords, finalCurrentInput, elapsedSeconds));
      setStatus("finished");
    },
    [clearTimer, computeResult]
  );

  /** Starts the clock (once). `startedAt` lets a race begin at a moment agreed with the server. */
  const begin = useCallback((startedAt: number = Date.now()) => {
    if (startTimeRef.current !== null) return;
    startTimeRef.current = startedAt;
    intervalRef.current = setInterval(() => {
      const started = startTimeRef.current;
      if (started == null) return;
      setElapsedMs(Date.now() - started);
    }, TICK_MS);
    setElapsedMs(Math.max(0, Date.now() - startedAt));
    setStatus("running");
  }, []);

  const resetRun = useCallback(() => {
    clearTimer();
    setTypedWords([]);
    setCurrentInput("");
    setCurrentIndex(0);
    setStatus("idle");
    setElapsedMs(0);
    setResult(null);
    startTimeRef.current = null;
    keystrokesRef.current = [];
  }, [clearTimer]);

  const restart = useCallback(
    (overrides?: Partial<TypingTestConfig>) => {
      const nextConfig = { ...configRef.current, ...overrides };
      saveConfig(nextConfig);
      setConfig(nextConfig);
      setWords(startWords(nextConfig));
      resetRun();
    },
    [resetRun, startWords]
  );

  const repeat = useCallback(() => resetRun(), [resetRun]);

  const handleInputChange = useCallback(
    (raw: string) => {
      if (status === "finished") return;
      if (manualStart && status === "idle") return;
      begin();

      const cfg = configRef.current;
      const targetWords = wordsRef.current;
      const now = Date.now();
      const at = Math.max(0, now - (startTimeRef.current ?? now));

      if (raw.endsWith(" ")) {
        const word = raw.slice(0, -1);
        if (word.length === 0) return;

        keystrokesRef.current.push({ at, correct: true });

        const nextTypedWords = [...typedWords, word];
        const nextIndex = nextTypedWords.length;

        setTypedWords(nextTypedWords);
        setCurrentInput("");
        setCurrentIndex(nextIndex);

        if (cfg.mode === "words" && nextIndex >= targetWords.length) {
          finish(nextTypedWords, "");
        } else if (!isFixed && cfg.mode === "time" && nextIndex >= targetWords.length - APPEND_THRESHOLD) {
          // More words come from the same seeded stream, so the server can still rebuild them.
          const more = streamRef.current?.take(APPEND_WORD_COUNT) ?? generateWords(APPEND_WORD_COUNT, cfg);
          setWords((prev) => [...prev, ...more]);
        }
        return;
      }

      const targetWord = targetWords[currentIndex] ?? "";
      if (raw.length > currentInput.length && raw.startsWith(currentInput)) {
        for (let i = currentInput.length; i < raw.length; i++) {
          keystrokesRef.current.push({ at, correct: raw[i] === targetWord[i] });
        }
      }

      setCurrentInput(raw);

      if (cfg.mode === "words" && currentIndex === targetWords.length - 1 && raw === targetWords[currentIndex]) {
        const nextTypedWords = [...typedWords, raw];
        setTypedWords(nextTypedWords);
        finish(nextTypedWords, "");
      }
    },
    [status, manualStart, begin, isFixed, currentIndex, currentInput, typedWords, finish]
  );

  /**
   * Step back into the previous word when backspace is pressed on an empty
   * input. Words that were typed fully correct are locked. Returns the text to
   * restore into the input, or null if going back isn't allowed.
   */
  const goBack = useCallback((): string | null => {
    if (status === "finished" || currentInput !== "" || currentIndex === 0) return null;

    const previousTyped = typedWords[currentIndex - 1];
    if (previousTyped === undefined || previousTyped === words[currentIndex - 1]) return null;

    setTypedWords(typedWords.slice(0, -1));
    setCurrentIndex(currentIndex - 1);
    setCurrentInput(previousTyped);
    return previousTyped;
  }, [status, currentInput, currentIndex, typedWords, words]);

  useEffect(() => {
    if (status === "running" && config.mode === "time" && elapsedMs / 1000 >= config.timeLimit) {
      finish(typedWords, currentInput);
    }
  }, [elapsedMs, status, config.mode, config.timeLimit, finish, typedWords, currentInput]);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (isFixed) return;
    const initial = loadSavedConfig() ?? configRef.current;
    setConfig(initial);
    setWords(startWords(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timeLeft = useMemo(() => {
    if (config.mode !== "time") return config.timeLimit;
    return Math.max(0, Math.ceil(config.timeLimit - elapsedMs / 1000));
  }, [config.mode, config.timeLimit, elapsedMs]);

  /** Correct characters so far, counting the space after each finished word. */
  const correctChars = useMemo(() => {
    let correct = 0;
    for (let i = 0; i < typedWords.length; i++) {
      correct += compareWord(words[i] ?? "", typedWords[i]).correct + 1;
    }
    return correct + compareWord(words[currentIndex] ?? "", currentInput).correct;
  }, [typedWords, currentInput, currentIndex, words]);

  const liveWpm = useMemo(
    () => (elapsedMs <= 0 ? 0 : calcWpm(correctChars, elapsedMs / 1000)),
    [elapsedMs, correctChars]
  );

  return {
    config,
    words,
    typedWords,
    currentInput,
    currentIndex,
    status,
    timeLeft,
    liveWpm,
    correctChars,
    seed,
    result,
    handleInputChange,
    goBack,
    begin,
    restart,
    repeat,
  };
}

export type { Mode };

