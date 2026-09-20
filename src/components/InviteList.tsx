"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TimeAgo } from "@/components/TimeAgo";
import type { PendingInvite } from "@/server/races";

const describe = (invite: PendingInvite) =>
  invite.mode === "time" ? `${invite.amount}-second challenge` : `${invite.amount}-word challenge`;

/** Challenges other players have sent you, with Accept and Decline. Refreshes on its own. */
export function InviteList({ initial }: { initial: PendingInvite[] }) {
  const router = useRouter();
  const [invites, setInvites] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/invites", { cache: "no-store" });
        if (response.ok && !stopped) setInvites(((await response.json()) as { invites: PendingInvite[] }).invites);
      } catch {
        // Try again next time.
      }
    }
    const timer = setInterval(refresh, 8000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  async function answer(raceId: string, action: "join" | "decline") {
    setBusy(raceId);
    setError(null);
    try {
      const response = await fetch(`/api/race/${raceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        if (action === "join") router.push(`/race/${raceId}`);
        else setInvites((list) => list.filter((invite) => invite.raceId !== raceId));
      } else {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Something went wrong. Try again.");
        setInvites((list) => list.filter((invite) => invite.raceId !== raceId));
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-panel p-10 text-center">
        <i className="bi bi-bell text-4xl text-sub" aria-hidden="true" />
        <p className="text-sub">No challenges waiting. When someone challenges you, it shows up here.</p>
        <Link href="/leaderboard" className="text-accent hover:underline">
          Find someone to challenge
        </Link>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3" aria-label="Challenges waiting for you">
        {invites.map((invite) => (
          <li key={invite.raceId} className="flex flex-wrap items-center gap-4 rounded-xl bg-panel px-5 py-4">
            <i className="bi bi-lightning-charge-fill text-2xl text-accent" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-lg font-semibold text-text">
                <Link href={`/profile/${encodeURIComponent(invite.from)}`} className="text-accent hover:underline">
                  {invite.from}
                </Link>{" "}
                challenged you
              </span>
              <span className="text-sm text-sub">
                A {describe(invite)} · <TimeAgo at={invite.createdAt} />
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === invite.raceId}
                onClick={() => answer(invite.raceId, "join")}
                className="rounded-lg bg-accent px-5 py-2 font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy === invite.raceId}
                onClick={() => answer(invite.raceId, "decline")}
                className="rounded-lg bg-bg px-5 py-2 text-sub transition-colors hover:text-error disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
