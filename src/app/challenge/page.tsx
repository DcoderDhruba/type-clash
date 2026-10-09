import Link from "next/link";
import { ChallengeForm } from "@/components/ChallengeForm";
import { isValidAmount } from "@/lib/config";
import { findUserByUsername, getCurrentUser } from "@/server/auth";

export const metadata = {
  title: "Typing Races and Challenges",
  description: "Challenge a friend to a real-time typing speed duel or start a multiplayer typing race.",
  alternates: { canonical: "/challenge" },
};

export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const mode = params.mode === "words" ? "words" : "time";
  const requested = Number(params.amount);
  const amount = isValidAmount(mode, requested) ? requested : mode === "time" ? 30 : 50;
  const type = params.type === "race" ? "race" : "challenge";

  // ?to=name means "challenge this particular player".
  const toParam = typeof params.to === "string" ? params.to : "";
  const target = user && toParam ? await findUserByUsername(toParam) : null;
  const invitee = target && target.id !== user?.id ? target.username : null;
  const inviteeProblem =
    user && toParam && !invitee
      ? target
        ? "You can't challenge yourself."
        : `We couldn't find a player called "${toParam}".`
      : null;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4">
      {user ? (
        <div className="flex w-full max-w-xl flex-col items-center gap-4">
          {inviteeProblem && (
            <p role="alert" className="text-sm text-error">
              {inviteeProblem}
            </p>
          )}
          <ChallengeForm initialType={type} initialMode={mode} initialAmount={amount} invitee={invitee} />
        </div>
      ) : (
        <div className="flex w-full max-w-lg flex-col gap-5 rounded-xl bg-panel p-8">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-accent">
            <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
            Start a match
          </h1>
          <p className="text-sub">
            Log in to start a match. Challenge one friend 1 vs 1, or start a race for up to 8 players. Everyone types
            the same words at the same time and the fastest typist wins.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login?next=%2Fchallenge"
              className="rounded-lg bg-accent px-5 py-3 font-semibold text-bg transition-opacity hover:opacity-90"
            >
              Log in
            </Link>
            <Link
              href="/signup?next=%2Fchallenge"
              className="rounded-lg bg-bg px-5 py-3 font-semibold text-text transition-colors hover:text-accent"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
