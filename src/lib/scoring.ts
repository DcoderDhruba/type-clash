import type { Keystroke, SecondSample, WordCounts } from "./types";

export function compareWord(target: string, typed: string): WordCounts {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;

  const shared = Math.min(target.length, typed.length);
  for (let i = 0; i < shared; i++) {
    if (target[i] === typed[i]) correct++;
    else incorrect++;
  }

  if (typed.length > target.length) {
    extra += typed.length - target.length;
  } else if (typed.length < target.length) {
    missed += target.length - typed.length;
  }

  return { correct, incorrect, extra, missed };
}

export function sumCounts(a: WordCounts, b: WordCounts): WordCounts {
  return {
    correct: a.correct + b.correct,
    incorrect: a.incorrect + b.incorrect,
    extra: a.extra + b.extra,
    missed: a.missed + b.missed,
  };
}

/**
 * Counts correct, wrong, extra and missed characters for what was typed against the target words.
 * Each finished word also counts its space as a correct character. The browser and the server both
 * use this, so they always agree on a score.
 */
export function countChars(targetWords: string[], typedWords: string[], finalInput: string): WordCounts {
  let totals: WordCounts = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  for (let i = 0; i < typedWords.length; i++) {
    totals = sumCounts(totals, compareWord(targetWords[i] ?? "", typedWords[i]));
    totals.correct += 1;
  }
  if (finalInput.length > 0) {
    totals = sumCounts(totals, compareWord(targetWords[typedWords.length] ?? "", finalInput));
  }
  return totals;
}

export function calcWpm(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  return Math.round(correctChars / 5 / minutes);
}

export function calcRawWpm(totalTypedChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  return Math.round(totalTypedChars / 5 / minutes);
}

export function calcAccuracy(correctChars: number, totalTypedChars: number): number {
  if (totalTypedChars <= 0) return 100;
  return Math.round((correctChars / totalTypedChars) * 100);
}

/**
 * One sample per second of the test. `wpm` and `raw` are cumulative up to that
 * second, `burst` is the speed within that second alone, `errors` counts wrong
 * keystrokes within that second (including ones that were later corrected).
 */
export function buildSamples(keystrokes: Keystroke[], elapsedSeconds: number): SecondSample[] {
  const total = Math.max(1, Math.ceil(elapsedSeconds - 1e-6));
  const samples: SecondSample[] = [];
  let cumCorrect = 0;
  let cumTyped = 0;
  let cursor = 0;

  for (let s = 1; s <= total; s++) {
    const windowEnd = Math.min(s, elapsedSeconds);
    const windowSeconds = Math.max(windowEnd - (s - 1), 0.001);
    let correct = 0;
    let wrong = 0;

    while (cursor < keystrokes.length && (s === total || keystrokes[cursor].at < s * 1000)) {
      if (keystrokes[cursor].correct) correct++;
      else wrong++;
      cursor++;
    }

    cumCorrect += correct;
    cumTyped += correct + wrong;
    samples.push({
      second: s,
      wpm: calcWpm(cumCorrect, windowEnd),
      raw: calcRawWpm(cumTyped, windowEnd),
      burst: calcWpm(correct, windowSeconds),
      errors: wrong,
    });
  }

  return samples;
}

/** 0-100, higher means steadier speed. Uses the same formula as Monkeytype. */
export function calcConsistency(values: number[]): number {
  if (values.length < 2) return 100;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const cov = Math.sqrt(variance) / mean;
  return Math.round(100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5)));
}
