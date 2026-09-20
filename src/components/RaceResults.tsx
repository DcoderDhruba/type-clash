"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PlaceIcon } from "@/components/PlaceIcon";
import { pickFunny, resultCategory, resultVars } from "@/lib/funny";
import type { RacePlayerView, RaceView } from "@/lib/race";

function ordinal(place: number): string {
  const teen = place % 100 >= 11 && place % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[place % 10] ?? "th";
  return `${place}${suffix}`;
}

function headline(view: RaceView): { icon: string; title: string; detail: string; tone: string } {
  const others = view.players.filter((player) => !player.isMe);
  const winners = view.players.filter((player) => player.place === 1);
  const me = view.me;
  const isDuo = view.kind === "duo";

  switch (view.outcome) {
    case "win":
      return {
        icon: "🏆",
        title: "You won!",
        detail: others.length === 1 ? `You beat ${others[0].username}.` : `You beat ${others.length} players.`,
        tone: "text-accent",
      };
    case "draw": {
      const names = winners.filter((player) => !player.isMe).map((player) => player.username);
      return {
        icon: "🤝",
        title: isDuo ? "It's a draw" : "It's a tie for first",
        detail: `You matched ${names.join(" and ")} on speed and accuracy.`,
        tone: "text-accent",
      };
    }
    case "loss": {
      const winner = winners.map((player) => player.username).join(" and ");
      const detail = `${winner} won with ${winners[0]?.result?.wpm ?? 0} wpm.`;
      // A 1v1 challenge has no podium: you either won or you lost.
      if (isDuo) return { icon: "😔", title: "You lost", detail, tone: "text-error" };
      const place = me?.place ?? null;
      return {
        icon: place === 2 ? "🥈" : place === 3 ? "🥉" : "😔",
        title: place ? `You finished ${ordinal(place)}` : "You did not finish",
        detail,
        tone: place && place <= 3 ? "text-text" : "text-error",
      };
    }
    default:
      return {
        icon: "⌛",
        title: isDuo ? "Challenge abandoned" : "Race abandoned",
        detail: isDuo ? "Nobody completed the challenge." : "Nobody completed the race.",
        tone: "text-sub",
      };
  }
}

/** What the first column says about a player in a 1v1 challenge: there are no places, only won / lost / draw. */
function duoVerdict(player: RacePlayerView, players: RacePlayerView[]): { label: string; win: boolean } {
  const winners = players.filter((other) => other.place === 1);
  if (winners.length === 0) return { label: "–", win: false };
  if (player.place === 1) return winners.length > 1 ? { label: "Draw", win: true } : { label: "Won", win: true };
  return { label: "Lost", win: false };
}

function Standing({ player, players, duo }: { player: RacePlayerView; players: RacePlayerView[]; duo: boolean }) {
  const result = player.result;
  const verdict = duo ? duoVerdict(player, players) : null;
  return (
    <li
      className={`grid items-center gap-x-4 rounded-xl px-5 py-3 ${
        duo
          ? "grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_minmax(0,1fr)_5rem_6rem_7rem]"
          : "grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_5rem_6rem_7rem]"
      } ${player.isMe ? "bg-accent/10 ring-1 ring-accent/40" : "bg-panel"}`}
    >
      {verdict ? (
        <span className={`text-lg font-bold ${verdict.win ? "text-accent" : "text-sub"}`}>{verdict.label}</span>
      ) : (
        <span className={`text-lg ${player.place && player.place <= 3 ? "font-bold text-accent" : "text-sub"}`}>
          {player.place ?? "–"}
        </span>
      )}

      <span className="flex min-w-0 items-center">
        <span className={`truncate text-lg font-semibold ${player.isMe ? "text-accent" : "text-text"}`}>
          {player.isMe ? `${player.username} (you)` : player.username}
        </span>
        {!duo && <PlaceIcon place={player.place} />}
      </span>

      {result ? (
        <>
          <span className="text-right text-3xl font-bold leading-none text-accent">
            {result.wpm}
            <span className="ml-1 text-sm font-normal text-sub">wpm</span>
          </span>
          <span className="hidden text-right text-sm text-sub sm:block">
            <span className="text-text">{result.accuracy}%</span> acc
          </span>
          <span className="hidden text-right text-sm text-sub sm:block">
            <span className="text-text">
              {result.correct}/{result.incorrect}/{result.extra}/{result.missed}
            </span>
          </span>
        </>
      ) : (
        <span className="col-span-1 text-right text-sub sm:col-span-3">did not finish</span>
      )}
    </li>
  );
}

export function RaceResults({ view }: { view: RaceView }) {
  const { icon, title, detail, tone } = headline(view);
  const router = useRouter();
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const isDuo = view.kind === "duo";
  const raceQuery = `type=${isDuo ? "challenge" : "race"}&mode=${view.mode}&amount=${view.amount}`;

  // The message is chosen from the race and the player, so it looks random from race to race
  // but stays the same when this page is refreshed (and matches between server and browser).
  const category = resultCategory(view);
  const vars = useMemo(() => resultVars(view), [view]);
  const seed = `${view.id}:${view.me?.username ?? ""}`;
  const funny = useMemo(() => pickFunny(category, vars, seed), [category, vars, seed]);

  // One button does both jobs: start a rematch, or join the one somebody already started.
  async function rematch() {
    setRematchBusy(true);
    setRematchError(null);
    try {
      const response = await fetch(`/api/race/${view.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rematch" }),
      });
      const data = (await response.json().catch(() => null)) as { rematchId?: string; message?: string } | null;
      if (!response.ok || !data?.rematchId) throw new Error(data?.message ?? "Could not start a rematch.");
      router.push(`/race/${data.rematchId}`);
    } catch (error) {
      setRematchError(error instanceof Error ? error.message : "Could not start a rematch.");
      setRematchBusy(false);
    }
  }
  const rematchLabel = view.rematch
    ? view.rematch.host === view.me?.username
      ? "Back to your rematch"
      : `Join ${view.rematch.host}'s rematch`
    : "Rematch";

  return (
    <div className="flex max-h-full min-h-0 w-full max-w-3xl flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-6xl leading-none" aria-hidden="true">
          {funny?.icon ?? icon}
        </span>
        <h1 className={`text-4xl font-bold ${tone}`}>{title}</h1>
        <p className="text-sub">{detail}</p>
        <p className="mt-1 min-h-7 max-w-xl text-lg text-accent" data-testid="funny-result">
          {funny?.text}
        </p>
      </div>

      <ol className="flex w-full min-h-0 flex-col gap-2 overflow-y-auto" aria-label="Final standings">
        {view.players.map((player) => (
          <Standing key={player.username} player={player} players={view.players} duo={isDuo} />
        ))}
      </ol>

      {rematchError && (
        <p role="alert" className="-mt-3 text-sm text-error">
          {rematchError}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={rematch}
          disabled={rematchBusy}
          className={`flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 ${
            view.rematch ? "animate-pulse" : ""
          }`}
        >
          <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> {rematchBusy ? "One moment..." : rematchLabel}
        </button>
        <Link
          href={`/challenge?${raceQuery}`}
          className="flex items-center gap-2 rounded-lg bg-panel px-5 py-3 text-text transition-colors hover:text-accent"
        >
          <i className="bi bi-arrow-repeat" aria-hidden="true" /> {isDuo ? "New challenge" : "New race"}
        </Link>
        <Link
          href={`/leaderboard?mode=${isDuo ? "challenges" : "races"}`}
          className="flex items-center gap-2 rounded-lg bg-panel px-5 py-3 text-text transition-colors hover:text-accent"
        >
          <i className="bi bi-trophy" aria-hidden="true" /> {isDuo ? "Challenge records" : "Race records"}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg bg-panel px-5 py-3 text-text transition-colors hover:text-accent"
        >
          <i className="bi bi-keyboard" aria-hidden="true" /> Practice
        </Link>
      </div>
    </div>
  );
}
