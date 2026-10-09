import { TypingTest } from "@/components/TypingTest";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Online Typing Speed Test",
  description:
    "Test your typing speed for free. Measure words per minute and accuracy, improve your score, and race friends in real time.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center px-6 py-4">
        <TypingTest />
      </div>
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12 text-sub">
        <h1 className="text-3xl font-bold text-text">Free online typing speed test</h1>
        <p>
          Find out how fast and accurately you type with TypeChaze. Start a typing test, watch your words per minute
          (WPM) and accuracy as you go, and repeat tests to build a more consistent typing speed.
        </p>
        <h2 className="text-xl font-semibold text-text">Practice, track your score, and race friends</h2>
        <p>
          Choose a timed or word-count test, then sign in to save your verified results. Compare personal bests on the
          leaderboard, follow your progress on your profile, or challenge a friend to a real-time typing race.
        </p>
      </section>
    </main>
  );
}
