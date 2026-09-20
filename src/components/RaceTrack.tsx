"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTypingTest } from "@/hooks/useTypingTest";
import { useTypingInput } from "@/hooks/useTypingInput";
import { WordsDisplay } from "@/components/WordsDisplay";
import { StatsBar } from "@/components/StatsBar";
import { calcWpm } from "@/lib/scoring";
import { liveStanding, pickFunny } from "@/lib/funny";
import type { FunnyMessage } from "@/lib/funny";
import { raceConfig, raceProgressRatio } from "@/lib/race";
import type { RaceFinishLog, RaceProgress, RaceView } from "@/lib/race";

interface RaceTrackProps {
  view: RaceView;
  words: string[];
  /** Best estimate of the server's clock right now. */
  serverTime: number;
  /** When the race starts, on this machine's clock. */
  getLocalStart: () => number;
  onProgress: (progress: RaceProgress) => void;
  onFinish: (log: RaceFinishLog) => void;
}

function Lane({
  name,
  isMe,
  ratio,
  wpm,
  finished,
}: {
  name: string;
  isMe: boolean;
  ratio: number;
  wpm: number;
  finished: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-28 truncate text-right text-sm ${isMe ? "font-semibold text-accent" : "text-text"}`}>
        {isMe ? "You" : name}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${isMe ? "bg-accent" : "bg-text/70"}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className="w-24 font-mono text-sm text-sub">{wpm} wpm</span>
      <i
        className={`bi bi-flag-fill w-4 text-accent ${finished ? "opacity-100" : "opacity-0"}`}
        aria-label={finished ? "finished" : undefined}
      />
    </div>
  );
}

/** The live part of a race: countdown, everyone's progress, and the typing area. */
export function RaceTrack({ view, words, serverTime, getLocalStart, onProgress, onFinish }: RaceTrackProps) {
  const config = useMemo(() => raceConfig(view.mode, view.amount), [view.mode, view.amount]);
  const test = useTypingTest({ fixed: { words, config }, manualStart: true });
  const { begin, result, correctChars, typedWords, currentInput, currentIndex } = test;

  const started = view.startAt !== null && serverTime >= view.startAt;
  const finished = test.status === "finished";

  const { inputRef, focused, focusInput, inputProps } = useTypingInput({
    onInput: test.handleInputChange,
    goBack: test.goBack,
    disabled: !started || finished,
  });

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // The clock starts for everyone at the moment the server agreed on, not at the first keystroke.
  useEffect(() => {
    if (started && test.status === "idle") {
      begin(getLocalStart());
      focusInput();
    }
  }, [started, test.status, begin, getLocalStart, focusInput]);

  const typedChars = useMemo(
    () => typedWords.reduce((sum, word) => sum + word.length + 1, 0) + currentInput.length,
    [typedWords, currentInput]
  );

  useEffect(() => {
    onProgress({ correctChars, typedChars, wordsDone: currentIndex });
  }, [correctChars, typedChars, currentIndex, onProgress]);

  useEffect(() => {
    if (!result) return;
    onFinish(result.log);
  }, [result, onFinish]);

  // A funny line that follows your position. It only changes once your position has stayed the
  // same for a moment, so it does not flicker when two players trade places.
  const standing = useMemo(
    () => (started && !finished ? liveStanding(view.players, correctChars) : null),
    [started, finished, view.players, correctChars]
  );
  const standingRef = useRef(standing);
  useEffect(() => {
    standingRef.current = standing;
  }, [standing]);
  const liveCategory = standing?.category ?? null;
  const [liveFunny, setLiveFunny] = useState<FunnyMessage | null>(null);
  const myName = view.me?.username;
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setLiveFunny(
          liveCategory ? pickFunny(liveCategory, { name: myName, leader: standingRef.current?.leader }) : null
        ),
      liveCategory ? 1200 : 0
    );
    return () => clearTimeout(timer);
  }, [liveCategory, myName]);

  const others = view.players.filter((player) => !player.isMe);
  const stillRacing = others.filter((player) => !player.finished).length;
  const secondsUntilStart = view.startAt === null ? 0 : Math.max(1, Math.ceil((view.startAt - serverTime) / 1000));
  const othersElapsed = view.startAt === null ? 0 : Math.max(0.5, (serverTime - view.startAt) / 1000);
  const speedOf = (player: (typeof others)[number]) =>
    player.result ? player.result.wpm : started ? calcWpm(player.correctChars, othersElapsed) : 0;
  const myWpm = result ? result.wpm : test.liveWpm;

  return (
    <div className="flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center gap-6">
      <input ref={inputRef} {...inputProps} className="absolute h-px w-px opacity-0" />

      <div className="flex w-full flex-col gap-2">
        <Lane
          name={view.me?.username ?? "You"}
          isMe
          ratio={raceProgressRatio(view, correctChars)}
          wpm={myWpm}
          finished={finished}
        />
        {others.map((player) => (
          <Lane
            key={player.username}
            name={player.username}
            isMe={false}
            ratio={raceProgressRatio(view, player.correctChars)}
            wpm={speedOf(player)}
            finished={player.finished}
          />
        ))}
      </div>

      {!finished && (
        <p className="-my-2 min-h-6 text-center text-sm text-text" aria-live="polite" data-testid="funny-live">
          {liveFunny && (
            <>
              <span aria-hidden="true">{liveFunny.icon}</span> {liveFunny.text}
            </>
          )}
        </p>
      )}

      {finished && result ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-panel px-10 py-8 text-center">
          <p className="text-sub">You finished</p>
          <p className="text-6xl font-bold text-accent">
            {result.wpm} <span className="text-2xl font-normal text-sub">wpm</span>
          </p>
          <p className="text-sub">
            {result.accuracy}% accuracy ·{" "}
            {stillRacing > 0
              ? `waiting for ${stillRacing} other ${stillRacing === 1 ? "player" : "players"} to finish...`
              : "working out the results..."}
          </p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <StatsBar
            mode={view.mode}
            timeLeft={test.timeLeft}
            currentIndex={currentIndex}
            wordLimit={view.amount}
            liveWpm={test.liveWpm}
            visible={started}
          />

          <div className="relative cursor-text" onClick={focusInput}>
            <WordsDisplay words={words} typedWords={typedWords} currentInput={currentInput} currentIndex={currentIndex} />

            {!started && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-bg/80 backdrop-blur-sm">
                <span className="text-lg text-sub">Race starts in</span>
                <span className="font-mono text-8xl font-bold text-accent">{secondsUntilStart}</span>
              </div>
            )}
            {started && !focused && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-bg/90 text-lg text-sub backdrop-blur-sm">
                click here to focus
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
