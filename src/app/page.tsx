import { TypingTest } from "@/components/TypingTest";
import { TIME_OPTIONS, WORD_OPTIONS } from "@/lib/config";
import type { TypingTestConfig } from "@/lib/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "TypeChaze | Free Online Typing Speed Test" },
  description:
    "Test your typing speed for free. Measure words per minute and accuracy, improve your score, and race friends in real time.",
  alternates: { canonical: "/" },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const mode = params.mode;
  const amount = typeof params.amount === "string" ? Number(params.amount) : Number.NaN;
  const timeLimit = TIME_OPTIONS.find((option) => option === amount);
  const wordLimit = WORD_OPTIONS.find((option) => option === amount);
  const initialOverrides: Partial<TypingTestConfig> | undefined =
    mode === "time" && timeLimit !== undefined
      ? { mode, timeLimit }
      : mode === "words" && wordLimit !== undefined
        ? { mode, wordLimit }
        : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">
      <TypingTest initialOverrides={initialOverrides} />
    </div>
  );
}
