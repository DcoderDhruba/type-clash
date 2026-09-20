"use client";

import type { TypingTestConfig } from "@/hooks/useTypingTest";
import { TIME_OPTIONS, WORD_OPTIONS } from "@/hooks/useTypingTest";

interface ConfigBarProps {
  config: TypingTestConfig;
  disabled: boolean;
  onChange: (overrides: Partial<TypingTestConfig>) => void;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${
        active ? "text-accent" : "text-sub hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-sub/30" aria-hidden="true" />;
}

export function ConfigBar({ config, disabled, onChange }: ConfigBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-1 rounded-lg bg-panel px-3 py-2 text-sm transition-opacity ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <Pill active={config.punctuation} onClick={() => onChange({ punctuation: !config.punctuation })}>
        @ punctuation
      </Pill>
      <Pill active={config.numbers} onClick={() => onChange({ numbers: !config.numbers })}>
        # numbers
      </Pill>

      <Divider />

      <Pill active={config.mode === "time"} onClick={() => onChange({ mode: "time" })}>
        time
      </Pill>
      <Pill active={config.mode === "words"} onClick={() => onChange({ mode: "words" })}>
        words
      </Pill>

      <Divider />

      {config.mode === "time"
        ? TIME_OPTIONS.map((t) => (
            <Pill key={t} active={config.timeLimit === t} onClick={() => onChange({ timeLimit: t })}>
              {t}
            </Pill>
          ))
        : WORD_OPTIONS.map((w) => (
            <Pill key={w} active={config.wordLimit === w} onClick={() => onChange({ wordLimit: w })}>
              {w}
            </Pill>
          ))}
    </div>
  );
}
