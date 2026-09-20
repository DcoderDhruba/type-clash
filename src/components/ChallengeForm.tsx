"use client";

import Link from "next/link";
import { useState } from "react";
import { createChallenge } from "@/app/actions/race";
import { TIME_OPTIONS, WORD_OPTIONS } from "@/lib/config";
import { MAX_PLAYERS } from "@/lib/race";

export type MatchType = "challenge" | "race";

interface ChallengeFormProps {
  initialType: MatchType;
  initialMode: "time" | "words";
  initialAmount: number;
  /** Set when challenging one particular player, who is the only one who can accept. */
  invitee: string | null;
}

const TYPES: { id: MatchType; icon: string; title: string; blurb: string }[] = [
  {
    id: "challenge",
    icon: "bi-lightning-charge-fill",
    title: "Challenge",
    blurb: "1 vs 1. Send the link to one friend. It starts as soon as they accept.",
  },
  {
    id: "race",
    icon: "bi-people-fill",
    title: "Race",
    blurb: `Up to ${MAX_PLAYERS} players. Everyone joins, clicks Ready, and you start it.`,
  },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-accent text-bg" : "bg-bg text-sub hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export function ChallengeForm({ initialType, initialMode, initialAmount, invitee }: ChallengeFormProps) {
  const [chosenType, setType] = useState<MatchType>(initialType);
  const type: MatchType = invitee ? "challenge" : chosenType;
  const [mode, setMode] = useState(initialMode);
  const options: readonly number[] = mode === "time" ? TIME_OPTIONS : WORD_OPTIONS;
  const [amount, setAmount] = useState(options.includes(initialAmount) ? initialAmount : options[1]);

  function chooseMode(next: "time" | "words") {
    setMode(next);
    const nextOptions: readonly number[] = next === "time" ? TIME_OPTIONS : WORD_OPTIONS;
    if (!nextOptions.includes(amount)) setAmount(nextOptions[1]);
  }

  return (
    <form action={createChallenge} className="flex w-full max-w-xl flex-col gap-5 rounded-xl bg-panel p-8">
      <input type="hidden" name="kind" value={type === "challenge" ? "duo" : "multi"} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="amount" value={amount} />
      {invitee && <input type="hidden" name="to" value={invitee} />}

      <h1 className="flex items-center gap-3 text-3xl font-bold text-accent">
        <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
        Start a match
      </h1>

      {invitee && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/10 px-4 py-3 text-sm text-text">
          <i className="bi bi-person-fill text-accent" aria-hidden="true" />
          Challenging <strong className="text-accent">{invitee}</strong>. Only they can accept it.
          <Link href="/challenge" className="ml-auto text-sub transition-colors hover:text-accent hover:underline">
            Cancel
          </Link>
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-sub">Match type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map((option) => {
            const active = option.id === type;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setType(option.id)}
                aria-pressed={active}
                disabled={invitee !== null && option.id === "race"}
                className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? "border-accent bg-accent/10" : "border-text/10 bg-bg hover:border-text/30"
                }`}
              >
                <span className={`flex items-center gap-2 text-lg font-semibold ${active ? "text-accent" : "text-text"}`}>
                  <i className={`bi ${option.icon}`} aria-hidden="true" />
                  {option.title}
                </span>
                <span className="text-sm text-sub">{option.blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-sub">How long</legend>
        <div className="flex gap-2">
          <Pill active={mode === "time"} onClick={() => chooseMode("time")}>
            Timed
          </Pill>
          <Pill active={mode === "words"} onClick={() => chooseMode("words")}>
            Word count
          </Pill>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-sub">{mode === "time" ? "Seconds" : "Words"}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Pill key={option} active={option === amount} onClick={() => setAmount(option)}>
              {option}
            </Pill>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-3 font-semibold text-bg transition-opacity hover:opacity-90"
      >
        {type === "challenge" ? (invitee ? `Send challenge to ${invitee}` : "Create challenge link") : "Create race link"}
      </button>
    </form>
  );
}
