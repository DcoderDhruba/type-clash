"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RaceResults } from "@/components/RaceResults";
import { RaceTrack } from "@/components/RaceTrack";
import type { RaceFinishLog, RaceProgress, RaceView } from "@/lib/race";

const POLL_PLAYING_MS = 500;
const POLL_IDLE_MS = 1000;
const POLL_REMATCH_MS = 2000;
const REMATCH_WATCH_MS = 10 * 60 * 1000;
const OFFSET_STALE_MS = 10_000;
const FINISH_RETRIES = 8;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describe(view: Pick<RaceView, "mode" | "amount" | "kind">): string {
  const noun = view.kind === "duo" ? "challenge" : "race";
  return view.mode === "time" ? `${view.amount}-second ${noun}` : `${view.amount}-word ${noun}`;
}

function Card({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={`flex w-full flex-col items-center rounded-xl bg-panel text-center ${
        wide ? "max-w-xl gap-3 p-6" : "max-w-lg gap-5 p-8"
      }`}
    >
      {children}
    </div>
  );
}

export function RaceRoom({ initial }: { initial: RaceView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [words, setWords] = useState<string[] | null>(initial.words);
  const [serverTime, setServerTime] = useState(initial.serverNow);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const viewRef = useRef(initial);
  const wordsRef = useRef<string[] | null>(initial.words);
  const progressRef = useRef<RaceProgress>({ correctChars: 0, typedChars: 0, wordsDone: 0 });
  const finishSentRef = useRef(false);
  // The gap between the server's clock and this machine's, measured from the fastest round trip seen.
  const offsetRef = useRef(0);
  const bestRttRef = useRef(Infinity);
  const offsetSetAtRef = useRef(0);

  const url = `/api/race/${initial.id}`;
  const terminal = view.phase === "finished" || view.phase === "cancelled";
  // After a race, keep listening for a rematch that someone starts.
  const watchingRematch = view.phase === "finished" && view.viewer !== "visitor" && !view.rematch;

  const applyView = useCallback((next: RaceView, sentAt?: number, receivedAt?: number) => {
    if (sentAt !== undefined && receivedAt !== undefined) {
      const roundTrip = receivedAt - sentAt;
      if (roundTrip <= bestRttRef.current || receivedAt - offsetSetAtRef.current > OFFSET_STALE_MS) {
        bestRttRef.current = roundTrip;
        offsetRef.current = next.serverNow - (sentAt + receivedAt) / 2;
        offsetSetAtRef.current = receivedAt;
      }
    }
    viewRef.current = next;
    if (next.words) {
      wordsRef.current = next.words;
      setWords(next.words);
    }
    setView(next);
  }, []);

  useEffect(() => {
    offsetRef.current = initial.serverNow - Date.now();
    setServerTime(Date.now() + offsetRef.current);
    setLink(`${window.location.origin}/race/${initial.id}`);
  }, [initial.id, initial.serverNow]);

  // Keeps the countdown and the opponent's live speed ticking.
  useEffect(() => {
    if (terminal) return;
    const timer = setInterval(() => setServerTime(Date.now() + offsetRef.current), 100);
    return () => clearInterval(timer);
  }, [terminal]);

  // One loop does everything: while racing it sends our progress and reads the opponent's;
  // otherwise it just watches for changes (opponent joined, race cancelled, race decided).
  useEffect(() => {
    if (terminal && !watchingRematch) return;
    const watchUntil = Date.now() + REMATCH_WATCH_MS;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const current = viewRef.current;
      const isPlayer = current.viewer !== "visitor";
      const raceOn = isPlayer && current.startAt !== null && Date.now() + offsetRef.current >= current.startAt;
      const done = current.phase === "finished" || current.phase === "cancelled";
      const needWords = isPlayer && current.phase !== "waiting" && wordsRef.current === null;
      const sentAt = Date.now();

      try {
        const response =
          raceOn && !done && !finishSentRef.current
            ? await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "progress", ...progressRef.current }),
              })
            : await fetch(needWords ? `${url}?words=1` : url, { cache: "no-store" });

        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/race/${initial.id}`)}`);
          return;
        }
        if (response.ok) applyView((await response.json()) as RaceView, sentAt, Date.now());
      } catch {
        // Network blip: try again on the next tick.
      }

      if (!stopped) {
        const latest = viewRef.current;
        const playing = latest.phase === "countdown" || latest.phase === "running";
        const finished = latest.phase === "finished";
        // Once a rematch shows up (or after a while) there is nothing left to wait for.
        if (finished && (latest.rematch || Date.now() > watchUntil)) return;
        timer = setTimeout(tick, finished ? POLL_REMATCH_MS : playing ? POLL_PLAYING_MS : POLL_IDLE_MS);
      }
    }

    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [terminal, watchingRematch, url, initial.id, applyView, router]);

  const post = useCallback(
    async (body: object): Promise<{ ok: boolean; status: number; message?: string }> => {
      const sentAt = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        applyView(data as RaceView, sentAt, Date.now());
        return { ok: true, status: response.status };
      }
      return { ok: false, status: response.status, message: data?.message };
    },
    [url, applyView]
  );

  const handleProgress = useCallback((progress: RaceProgress) => {
    progressRef.current = progress;
  }, []);

  const handleFinish = useCallback(
    async (log: RaceFinishLog) => {
      if (finishSentRef.current) return;
      finishSentRef.current = true;

      for (let attempt = 0; attempt < FINISH_RETRIES; attempt++) {
        try {
          const outcome = await post({ action: "finish", ...log });
          if (outcome.ok) return;
          // 409 usually means our clock ran a touch ahead of the server's; anything else will not improve.
          if (outcome.status !== 409) return;
        } catch {
          // Network blip: retry.
        }
        await sleep(700);
      }
    },
    [post]
  );

  const getLocalStart = useCallback(() => (viewRef.current.startAt ?? Date.now()) - offsetRef.current, []);

  async function act(body: object) {
    setBusy(true);
    setError(null);
    try {
      const outcome = await post(body);
      if (!outcome.ok) setError(outcome.message ?? "Something went wrong. Try again.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically. Select the link and copy it.");
    }
  }

  const isPlayer = view.viewer !== "visitor";
  const noun = view.kind === "duo" ? "challenge" : "race";

  const shareLink = (
    <div className="flex w-full items-center gap-2">
      <input
        readOnly
        value={link}
        aria-label={view.kind === "duo" ? "Challenge link" : "Race link"}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-text/10 bg-bg px-3 py-3 text-sm text-text outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={copyLink}
        className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-3 font-semibold text-bg transition-opacity hover:opacity-90"
      >
        <i className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`} aria-hidden="true" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (view.phase === "cancelled") {
    body = (
      <Card>
        <i className="bi bi-x-circle text-5xl text-sub" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text">
          {view.cancelReason === "declined" && view.viewer === "host"
            ? `${view.invited} declined your challenge`
            : `This ${noun} is no longer open`}
        </h1>
        <p className="text-sub">
          {view.cancelReason === "declined" && view.viewer === "host"
            ? "Maybe next time."
            : "The host cancelled it, or it expired."}
        </p>
        <Link href="/challenge" className="text-accent hover:underline">
          Start a new match
        </Link>
      </Card>
    );
  } else if (view.phase === "finished" && isPlayer) {
    body = <RaceResults view={view} />;
  } else if (!isPlayer && view.kind === "duo") {
    if (view.phase === "waiting" && view.invited && !view.invitedMe) {
      body = (
        <Card>
          <i className="bi bi-lock text-5xl text-sub" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-text">This challenge is for someone else</h1>
          <p className="text-sub">
            {view.host} sent it to another player. Start your own challenge, or race with friends.
          </p>
          <Link href="/challenge" className="text-accent hover:underline">
            Start a match
          </Link>
        </Card>
      );
    } else if (view.phase === "waiting") {
      body = (
        <Card>
          <i className="bi bi-lightning-charge-fill text-5xl text-accent" aria-hidden="true" />
          <h1 className="text-3xl font-bold text-text">
            <span className="text-accent">{view.host}</span> challenged you!
          </h1>
          <p className="text-sub">
            A {describe(view)}. You both type the same words at the same time, and the faster typist wins.
          </p>
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: "join" })}
              className="w-full rounded-lg bg-accent px-4 py-3 text-lg font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Joining..." : "Accept challenge"}
            </button>
            {view.invitedMe && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act({ action: "decline" })}
                className="text-sm text-sub transition-colors hover:text-error disabled:opacity-50"
              >
                Decline
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </Card>
      );
    } else {
      body = (
        <Card>
          <i className="bi bi-people text-5xl text-sub" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-text">
            {view.phase === "finished" ? "This challenge is over" : "This challenge was already accepted"}
          </h1>
          <p className="text-sub">Someone else took it. Start your own and send it to a friend.</p>
          <Link href="/challenge?type=challenge" className="text-accent hover:underline">
            Start a challenge
          </Link>
        </Card>
      );
    }
  } else if (!isPlayer && view.phase === "waiting") {
    const full = view.playerCount >= view.maxPlayers;
    body = (
      <Card>
        <i className="bi bi-lightning-charge-fill text-5xl text-accent" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-text">
          <span className="text-accent">{view.host}</span> invited you to a race!
        </h1>
        <p className="text-sub">
          A {describe(view)}. Everyone who joins types the same words at the same time, and the fastest typist wins.
        </p>
        <p className="text-sm text-sub">
          {view.playerCount} of {view.maxPlayers} players are in so far.
        </p>
        {full ? (
          <p className="text-error">This race is full.</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => act({ action: "join" })}
            className="w-full rounded-lg bg-accent px-4 py-3 text-lg font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Joining..." : "Join race"}
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </Card>
    );
  } else if (!isPlayer) {
    body = (
      <Card>
        <i className="bi bi-flag text-5xl text-sub" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text">
          {view.phase === "finished" ? "This race is over" : "This race has already started"}
        </h1>
        <p className="text-sub">You can only join a race before the host starts it. Create your own and invite friends.</p>
        <Link href="/challenge?type=race" className="text-accent hover:underline">
          Create a race
        </Link>
      </Card>
    );
  } else if (view.phase === "waiting" && view.kind === "duo") {
    body = (
      <Card>
        <i className="bi bi-hourglass-split text-5xl text-accent" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-text">
          {view.invited ? `Waiting for ${view.invited}` : "Waiting for your opponent"}
        </h1>
        <p className="text-sub">
          {view.invited
            ? `A ${describe(view)}. ${view.invited} will see your challenge in their alerts. The race starts a few seconds after they accept, and the challenge expires after 30 minutes.`
            : `A ${describe(view)}. Send this link to a friend. The race starts a few seconds after they accept.`}
        </p>
        {!view.invited && shareLink}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: "cancel" })}
          className="text-sm text-sub transition-colors hover:text-error disabled:opacity-50"
        >
          Cancel challenge
        </button>
      </Card>
    );
  } else if (view.phase === "waiting") {
    const isHost = view.viewer === "host";
    const me = view.me;
    const others = view.players.filter((player) => !player.isHost);
    const waitingOn = others.filter((player) => !player.isReady).length;
    const canStart = others.length >= 1 && waitingOn === 0;
    body = (
      <Card wide>
        <i className="bi bi-people-fill text-4xl text-accent" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-text">{isHost ? "Your race lobby" : "You're in!"}</h1>
        <p className="text-sub">
          A {describe(view)}.{" "}
          {isHost
            ? "Send the link to everyone who should join. When they have all clicked Ready, press Start race."
            : me?.isReady
              ? `You're ready! Waiting for ${view.host} to start the race.`
              : `Click Ready when you're set. ${view.host} starts the race once everyone is ready.`}
        </p>

        {shareLink}

        <div className="w-full text-left">
          <p className="mb-2 flex justify-between text-sm text-sub">
            <span>Players</span>
            <span>
              {view.playerCount} / {view.maxPlayers}
            </span>
          </p>
          <ul className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2" aria-label="Players in the lobby">
            {view.players.map((player) => (
              <li key={player.username} className="flex items-center gap-3 rounded-lg bg-bg px-4 py-1.5">
                <i className="bi bi-person-fill text-accent" aria-hidden="true" />
                <span className={`min-w-0 flex-1 truncate ${player.isMe ? "font-semibold text-accent" : "text-text"}`}>
                  {player.username}
                </span>
                {player.isHost ? (
                  <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">host</span>
                ) : player.isReady ? (
                  <span className="flex items-center gap-1 text-xs text-accent">
                    <i className="bi bi-check-circle-fill" aria-hidden="true" /> ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-sub">
                    <i className="bi bi-hourglass-split" aria-hidden="true" /> not ready
                  </span>
                )}
                {player.isMe && <span className="text-xs text-sub">you</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost && (
          <div className="flex w-full flex-col items-center gap-2">
            <button
              type="button"
              disabled={busy || !canStart}
              onClick={() => act({ action: "start" })}
              className="w-full rounded-lg bg-accent px-4 py-3 text-lg font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Starting..." : "Start race"}
            </button>
            <p className="text-xs text-sub">
              {others.length === 0
                ? "Waiting for at least one more player to join."
                : waitingOn > 0
                  ? `Waiting for ${waitingOn} ${waitingOn === 1 ? "player" : "players"} to click Ready.`
                  : "Everyone is ready. Start when you like!"}
            </p>
          </div>
        )}

        {!isHost && me && (
          <button
            type="button"
            disabled={busy}
            aria-pressed={me.isReady}
            onClick={() => act({ action: "ready", ready: !me.isReady })}
            className={`w-full rounded-lg px-4 py-3 text-lg font-semibold transition-colors disabled:opacity-50 ${
              me.isReady
                ? "border border-accent bg-accent/10 text-accent hover:bg-accent/20"
                : "bg-accent text-bg hover:opacity-90"
            }`}
          >
            {me.isReady ? "Ready! (click to undo)" : "I'm ready!"}
          </button>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: isHost ? "cancel" : "leave" })}
          className="text-sm text-sub transition-colors hover:text-error disabled:opacity-50"
        >
          {isHost ? "Cancel race" : "Leave lobby"}
        </button>
      </Card>
    );
  } else if (words) {
    body = (
      <RaceTrack
        view={view}
        words={words}
        serverTime={serverTime}
        getLocalStart={getLocalStart}
        onProgress={handleProgress}
        onFinish={handleFinish}
      />
    );
  } else {
    body = (
      <Card>
        <h1 className="text-2xl font-bold text-text">Getting the race ready...</h1>
      </Card>
    );
  }

  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-4">{body}</div>;
}
