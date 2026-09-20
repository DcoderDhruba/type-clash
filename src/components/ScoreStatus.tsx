"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/components/UserProvider";
import { amountOf } from "@/lib/config";
import type { TypingTestConfig } from "@/lib/config";
import type { TestResult } from "@/lib/types";

interface ScoreStatusProps {
  result: TestResult;
  config: TypingTestConfig;
  /** Resolves to the ticket registered when the test started, or null if there is none. */
  getTicket: () => Promise<string | null>;
}

type SaveState =
  | { kind: "saving" }
  | { kind: "saved"; rank: number; personalBest: boolean }
  | { kind: "error"; reason: string };

/** Saves a finished test to the leaderboard (when logged in) and says how it went. */
export function ScoreStatus({ result, config, getTicket }: ScoreStatusProps) {
  const user = useUser();
  const [state, setState] = useState<SaveState>({ kind: "saving" });
  const submitted = useRef<TestResult | null>(null);

  useEffect(() => {
    if (!user || submitted.current === result) return;
    submitted.current = result;

    getTicket()
      .then(async (ticketId) => {
        if (!ticketId) throw new Error("This test could not be registered with the server.");
        const response = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, ...result.log, consistency: result.consistency }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { reason?: string } | null;
          throw new Error(data?.reason ?? `The server said no (${response.status}).`);
        }
        const saved = (await response.json()) as { rank: number; isPersonalBest: boolean };
        setState({ kind: "saved", rank: saved.rank, personalBest: saved.isPersonalBest });
      })
      .catch((error: Error) => setState({ kind: "error", reason: error.message }));
  }, [user, result, getTicket]);

  if (!user) {
    return (
      <p className="text-center text-sm text-sub">
        <Link href="/login" className="text-accent hover:underline">
          Log in
        </Link>{" "}
        to save your score to the leaderboard
      </p>
    );
  }

  if (state.kind === "saving") return <p className="text-center text-sm text-sub">Saving score...</p>;
  if (state.kind === "error") {
    return <p className="text-center text-sm text-error">Score not saved: {state.reason}</p>;
  }

  return (
    <p className="text-center text-sm text-sub">
      <i className="bi bi-check-circle-fill text-accent" aria-hidden="true" /> Saved
      {state.personalBest && <span className="text-accent"> · new personal best</span>}
      {" · "}
      <Link href={`/leaderboard?mode=${config.mode}&amount=${amountOf(config)}`} className="text-accent hover:underline">
        rank #{state.rank}
      </Link>
    </p>
  );
}
