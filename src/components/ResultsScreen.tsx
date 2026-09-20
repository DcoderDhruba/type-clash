"use client";

import type { TestResult } from "@/lib/types";
import type { TypingTestConfig } from "@/hooks/useTypingTest";
import { ResultsChart } from "@/components/ResultsChart";
import { ScoreStatus } from "@/components/ScoreStatus";
import { getSpeedTier } from "@/lib/speedTiers";

interface ResultsScreenProps {
  result: TestResult;
  config: TypingTestConfig;
  getTicket: () => Promise<string | null>;
  onNext: () => void;
  onRepeat: () => void;
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl leading-tight text-sub">{label}</span>
      <span className="text-6xl font-bold leading-none text-accent">{value}</span>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg leading-tight text-sub">{label}</span>
      <span className="text-3xl font-semibold text-accent">{children}</span>
    </div>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-12 items-center justify-center rounded-lg bg-panel text-2xl text-sub transition-colors hover:text-accent focus-visible:text-accent"
    >
      <i className={`bi ${icon}`} aria-hidden="true" />
    </button>
  );
}

export function ResultsScreen({ result, config, getTicket, onNext, onRepeat }: ResultsScreenProps) {
  const testLabel = config.mode === "time" ? `time ${config.timeLimit}` : `words ${config.wordLimit}`;
  const tier = getSpeedTier(result.wpm);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-5">
      <div className="mx-auto flex max-w-full items-center gap-3 rounded-xl bg-panel px-5 py-3">
        <span className="text-3xl leading-none" aria-hidden="true">
          {tier.icon}
        </span>
        <p className="min-w-0 truncate text-lg">
          <span className="font-semibold text-accent">{tier.title}</span>
          <span className="text-sub"> — </span>
          <span className="text-text">{tier.message}</span>
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
        <div className="flex shrink-0 gap-10 lg:flex-col lg:justify-center lg:gap-6">
          <BigStat label="wpm" value={String(result.wpm)} />
          <BigStat label="acc" value={`${result.accuracy}%`} />
        </div>
        <div className="min-h-[220px] min-w-0 flex-1">
          <ResultsChart samples={result.samples} />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4">
        <div className="flex flex-col">
          <span className="text-lg leading-tight text-sub">test type</span>
          <span className="text-base leading-snug text-accent">
            {testLabel}
            <br />
            english
          </span>
        </div>
        <Stat label="raw">{result.rawWpm}</Stat>
        <Stat label="characters">
          {result.correctChars}/{result.incorrectChars}/{result.extraChars}/{result.missedChars}
        </Stat>
        <Stat label="consistency">{result.consistency}%</Stat>
        <Stat label="time">{result.elapsedSeconds}s</Stat>
      </div>

      <div className="flex justify-center gap-4">
        <ActionButton label="Next test (tab)" icon="bi-chevron-right" onClick={onNext} />
        <ActionButton label="Repeat same words" icon="bi-arrow-repeat" onClick={onRepeat} />
      </div>

      <ScoreStatus result={result} config={config} getTicket={getTicket} />
    </div>
  );
}
