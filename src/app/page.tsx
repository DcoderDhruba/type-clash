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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">
      <TypingTest />
    </div>
  );
}
