"use client";

import { useEffect, useRef } from "react";
import { useTypingTest } from "@/hooks/useTypingTest";
import { useTypingInput } from "@/hooks/useTypingInput";
import { ConfigBar } from "@/components/ConfigBar";
import { WordsDisplay } from "@/components/WordsDisplay";
import { StatsBar } from "@/components/StatsBar";
import { ResultsScreen } from "@/components/ResultsScreen";
import { RESET_TEST_EVENT } from "@/lib/events";
import { amountOf } from "@/lib/config";
import type { TypingTestConfig } from "@/lib/config";
import { useUser } from "@/components/UserProvider";

/** Asks the server for a ticket for this test. Resolves to null if it could not be registered. */
function registerTest(seed: string, config: TypingTestConfig): Promise<string | null> {
  return fetch("/api/tests/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seed,
      mode: config.mode,
      amount: amountOf(config),
      punctuation: config.punctuation,
      numbers: config.numbers,
    }),
  })
    .then(async (response) => (response.ok ? ((await response.json()) as { ticketId: string }).ticketId : null))
    .catch(() => null);
}

export function TypingTest() {
  const {
    config,
    words,
    typedWords,
    currentInput,
    currentIndex,
    status,
    timeLeft,
    liveWpm,
    seed,
    result,
    handleInputChange,
    goBack,
    restart,
    repeat,
  } = useTypingTest();

  const { inputRef, focused, focusInput, clearInput, inputProps } = useTypingInput({
    onInput: handleInputChange,
    goBack,
    onKey: (event) => {
      if (event.key !== "Tab" && event.key !== "Escape") return false;
      event.preventDefault();
      onRestartClick();
      return true;
    },
  });

  // A logged-in player's test is registered with the server when they type the first key, so the
  // score can be checked against the real words and the real time when it is submitted.
  const user = useUser();
  const ticketRef = useRef<Promise<string | null> | null>(null);
  useEffect(() => {
    if (status === "idle") {
      ticketRef.current = null;
    } else if (status === "running" && user && seed && !ticketRef.current) {
      ticketRef.current = registerTest(seed, config);
    }
  }, [status, user, seed, config]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (status === "idle") clearInput();
  }, [status, words, clearInput]);

  useEffect(() => {
    if (status === "finished") focusInput();
  }, [status, focusInput]);

  useEffect(() => {
    function onResetRequest() {
      restart();
      clearInput();
      focusInput();
    }
    window.addEventListener(RESET_TEST_EVENT, onResetRequest);
    return () => window.removeEventListener(RESET_TEST_EVENT, onResetRequest);
  }, [restart, clearInput, focusInput]);

  function onRestartClick() {
    restart();
    clearInput();
    focusInput();
  }

  function onRepeatClick() {
    repeat();
    clearInput();
    focusInput();
  }

  return (
    <div className="flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center gap-8">
      {status !== "finished" && (
        <ConfigBar config={config} disabled={status === "running"} onChange={restart} />
      )}

      <div className={status === "finished" ? "relative min-h-0 w-full flex-1" : "relative w-full"}>
        <input ref={inputRef} {...inputProps} className="absolute h-px w-px opacity-0" />

        {status === "finished" && result ? (
          <ResultsScreen
            result={result}
            config={config}
            getTicket={() => ticketRef.current ?? Promise.resolve(null)}
            onNext={onRestartClick}
            onRepeat={onRepeatClick}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <StatsBar
              mode={config.mode}
              timeLeft={timeLeft}
              currentIndex={currentIndex}
              wordLimit={config.wordLimit}
              liveWpm={liveWpm}
              visible={status === "running"}
            />

            <div className="relative cursor-text" onClick={focusInput}>
              <WordsDisplay
                words={words}
                typedWords={typedWords}
                currentInput={currentInput}
                currentIndex={currentIndex}
              />

              {!focused && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-bg/90 text-lg text-sub backdrop-blur-sm">
                  click here to focus
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {status !== "finished" && (
        <button
          type="button"
          onClick={onRestartClick}
          aria-label="Restart test"
          title="Restart test (tab)"
          className="flex size-10 items-center justify-center rounded-lg text-xl text-sub transition-colors hover:text-accent"
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
