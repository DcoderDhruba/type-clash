"use client";

interface StatsBarProps {
  mode: "time" | "words";
  timeLeft: number;
  currentIndex: number;
  wordLimit: number;
  liveWpm: number;
  visible: boolean;
}

export function StatsBar({ mode, timeLeft, currentIndex, wordLimit, liveWpm, visible }: StatsBarProps) {
  return (
    <div
      className={`flex items-center justify-center gap-6 font-mono text-2xl text-accent transition-opacity ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ height: 40 }}
    >
      <span>{mode === "time" ? timeLeft : `${Math.min(currentIndex + 1, wordLimit)}/${wordLimit}`}</span>
      <span className="text-sub">|</span>
      <span>{liveWpm} wpm</span>
    </div>
  );
}
