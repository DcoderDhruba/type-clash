import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterButton } from "@/components/FilterButton";
import { PageShell } from "@/components/PageShell";
import { ProgressChart } from "@/components/ProgressChart";
import { isValidAmount } from "@/lib/config";
import { getCurrentUser } from "@/server/auth";
import { getProfile, getScoreHistory } from "@/server/profiles";
import type { BestScore } from "@/server/profiles";
import type { RaceRecord } from "@/server/scores";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `${username} | TypeClash` };
}

const typeLabel = (mode: string, amount: number) => (mode === "time" ? `${amount} seconds` : `${amount} words`);
const shortLabel = (mode: string, amount: number) => (mode === "time" ? `${amount}s` : `${amount}w`);

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-panel px-5 py-4">
      <span className="text-sm text-sub">{label}</span>
      <span className="text-3xl font-bold text-accent">{value}</span>
    </div>
  );
}

function RecordCard({ title, icon, record }: { title: string; icon: string; record: RaceRecord }) {
  const played = record.wins + record.losses + record.draws;
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-panel px-5 py-4">
      <span className="flex items-center gap-2 text-sm text-sub">
        <i className={`bi ${icon}`} aria-hidden="true" /> {title}
      </span>
      {played === 0 ? (
        <span className="text-sub">None yet</span>
      ) : (
        <div className="flex items-baseline gap-5">
          <span className="text-3xl font-bold text-accent">
            {record.wins}
            <span className="ml-1 text-sm font-normal text-sub">W</span>
          </span>
          <span className="text-2xl font-semibold text-text">
            {record.losses}
            <span className="ml-1 text-sm font-normal text-sub">L</span>
          </span>
          <span className="text-2xl font-semibold text-text">
            {record.draws}
            <span className="ml-1 text-sm font-normal text-sub">D</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { username } = await params;
  const query = await searchParams;

  const profile = getProfile(username);
  if (!profile) notFound();

  const me = await getCurrentUser();
  const isMe = me?.id === profile.id;

  // Which test type the progress chart shows: the one in the link, else the most recent 60s, else the fastest.
  const requestedMode = query.mode === "words" ? "words" : "time";
  const requestedAmount = Number(query.amount);
  const requested: BestScore | undefined = isValidAmount(requestedMode, requestedAmount)
    ? profile.bests.find((best) => best.mode === requestedMode && best.amount === requestedAmount)
    : undefined;
  const selected =
    requested ?? profile.bests.find((best) => best.mode === "time" && best.amount === 60) ?? profile.bests[0];
  const history = selected ? getScoreHistory(profile.id, selected.mode, selected.amount) : [];
  const bestWpm = profile.bests.length > 0 ? Math.max(...profile.bests.map((best) => best.wpm)) : null;

  return (
    <PageShell className="gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <span
          className="flex size-16 items-center justify-center rounded-full bg-accent text-3xl font-bold text-bg"
          aria-hidden="true"
        >
          {profile.username.charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-3xl font-bold text-text">{profile.username}</h1>
          <span className="text-sm text-sub">
            Member since{" "}
            {new Date(profile.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </span>
        </div>
        {isMe ? (
          <span className="rounded-lg bg-panel px-4 py-2 text-sm text-sub">This is you</span>
        ) : me ? (
          <Link
            href={`/challenge?type=challenge&to=${encodeURIComponent(profile.username)}`}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <i className="bi bi-lightning-charge-fill" aria-hidden="true" /> Challenge {profile.username}
          </Link>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/profile/${profile.username}`)}`}
            className="rounded-lg bg-panel px-5 py-3 text-text transition-colors hover:text-accent"
          >
            Log in to challenge
          </Link>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
        <StatCard label="Tests taken" value={profile.tests} />
        <StatCard label="Average WPM" value={profile.averageWpm ?? "–"} />
        <StatCard label="Average accuracy" value={profile.averageAccuracy === null ? "–" : `${profile.averageAccuracy}%`} />
        <StatCard label="Best WPM" value={bestWpm ?? "–"} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Match records">
        <RecordCard title="Races" icon="bi-people-fill" record={profile.races} />
        <RecordCard title="Challenges" icon="bi-lightning-charge-fill" record={profile.challenges} />
      </section>

      {profile.bests.length === 0 ? (
        <p className="rounded-xl bg-panel px-6 py-10 text-center text-sub">No tests saved yet.</p>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-xl bg-panel p-5" aria-label="Progress">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-text">Progress</h2>
              <div className="flex flex-wrap gap-2">
                {profile.bests.map((best) => (
                  <FilterButton
                    key={`${best.mode}-${best.amount}`}
                    compact
                    href={`/profile/${encodeURIComponent(profile.username)}?mode=${best.mode}&amount=${best.amount}`}
                    active={best.mode === selected.mode && best.amount === selected.amount}
                  >
                    {shortLabel(best.mode, best.amount)}
                  </FilterButton>
                ))}
              </div>
            </div>
            <p className="text-sm text-sub">
              WPM over the last {history.length} {typeLabel(selected.mode, selected.amount)} tests
            </p>
            <ProgressChart points={history} />
          </section>

          <section className="overflow-hidden rounded-xl bg-panel" aria-label="Personal bests">
            <h2 className="px-5 pt-4 text-lg font-semibold text-text">Personal bests</h2>
            <table className="mt-2 w-full text-left">
              <thead className="text-sm text-sub">
                <tr>
                  <th className="px-5 py-2 font-normal">Test</th>
                  <th className="px-2 py-2 text-right font-normal">WPM</th>
                  <th className="px-2 py-2 text-right font-normal">Accuracy</th>
                  <th className="px-5 py-2 text-right font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {profile.bests.map((best) => (
                  <tr key={`${best.mode}-${best.amount}`} className="border-t border-text/5">
                    <td className="px-5 py-3 text-text">{typeLabel(best.mode, best.amount)}</td>
                    <td className="px-2 py-3 text-right text-xl font-semibold text-accent">{best.wpm}</td>
                    <td className="px-2 py-3 text-right text-text">{best.accuracy}%</td>
                    <td className="px-5 py-3 text-right text-sub">{formatDate(best.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-xl bg-panel" aria-label="Recent tests">
            <h2 className="px-5 pt-4 text-lg font-semibold text-text">Recent tests</h2>
            <ul className="mt-2">
              {profile.recent.map((score, index) => (
                <li key={index} className="flex items-center gap-4 border-t border-text/5 px-5 py-3">
                  <span className="w-28 text-text">{typeLabel(score.mode, score.amount)}</span>
                  <span className="text-xl font-semibold text-accent">{score.wpm}</span>
                  <span className="text-sm text-sub">WPM</span>
                  <span className="text-text">{score.accuracy}%</span>
                  <span className="ml-auto text-sm text-sub">{formatDate(score.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageShell>
  );
}
