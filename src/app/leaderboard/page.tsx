import Link from "next/link";
import { FilterButton } from "@/components/FilterButton";
import { PageShell } from "@/components/PageShell";
import { PlaceIcon } from "@/components/PlaceIcon";
import { TIME_OPTIONS, WORD_OPTIONS, isValidAmount } from "@/lib/config";
import { getCurrentUser } from "@/server/auth";
import { getLeaderboard, getRaceRecords } from "@/server/scores";

export const metadata = { title: "Leaderboard | TypeChaze" };

type Board = "time" | "words" | "races" | "challenges";

// What the leaderboard opens on when the link says nothing: the 60-second time board.
const DEFAULT_TIME_AMOUNT = 60;
const DEFAULT_WORDS_AMOUNT = 50;

function FilterGroup({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-sub">{label}</span>
      <div className={className}>{children}</div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rankClass(rank: number): string {
  return rank <= 3 ? "font-bold text-accent" : "text-sub";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const board: Board =
    params.mode === "words"
      ? "words"
      : params.mode === "races"
        ? "races"
        : params.mode === "challenges"
          ? "challenges"
          : "time";
  // Races and challenges show win/loss records; time and words show best scores.
  const isRecords = board === "races" || board === "challenges";
  const options: readonly number[] = board === "words" ? WORD_OPTIONS : TIME_OPTIONS;
  const requested = Number(params.amount);
  const defaultAmount = board === "words" ? DEFAULT_WORDS_AMOUNT : DEFAULT_TIME_AMOUNT;
  const amount = !isRecords && isValidAmount(board, requested) ? requested : defaultAmount;

  const me = await getCurrentUser();
  const scoreRows = board === "time" || board === "words" ? getLeaderboard(board, amount) : [];
  const raceRows = isRecords ? getRaceRecords(board === "challenges" ? "duo" : "multi") : [];
  const isEmpty = isRecords ? raceRows.length === 0 : scoreRows.length === 0;

  return (
    <PageShell className="gap-5">
      <h1 className="flex items-center gap-3 text-3xl font-bold text-accent">
        <i className="bi bi-trophy-fill" aria-hidden="true" />
        Leaderboard
      </h1>

      <div className="grid min-h-0 flex-1 gap-5 max-lg:content-start lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 self-start rounded-xl bg-panel p-4 max-lg:w-full">
          <FilterGroup label="Board" className="flex flex-wrap gap-2 lg:flex-col">
            <FilterButton href={`/leaderboard?mode=time&amount=${board === "time" ? amount : DEFAULT_TIME_AMOUNT}`} active={board === "time"}>
              Time
            </FilterButton>
            <FilterButton href={`/leaderboard?mode=words&amount=${board === "words" ? amount : DEFAULT_WORDS_AMOUNT}`} active={board === "words"}>
              Words
            </FilterButton>
            <FilterButton href="/leaderboard?mode=races" active={board === "races"}>
              Races
            </FilterButton>
            <FilterButton href="/leaderboard?mode=challenges" active={board === "challenges"}>
              Challenges
            </FilterButton>
          </FilterGroup>

          {!isRecords && (
            <FilterGroup label={board === "time" ? "Seconds" : "Words"} className="grid grid-cols-4 gap-2 sm:max-w-xs">
              {options.map((option) => (
                <FilterButton key={option} compact href={`/leaderboard?mode=${board}&amount=${option}`} active={option === amount}>
                  {option}
                </FilterButton>
              ))}
            </FilterGroup>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto rounded-xl bg-panel">
        {isEmpty ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
            <i className="bi bi-stopwatch text-4xl text-sub" aria-hidden="true" />
            <p className="text-sub">
              {board === "races"
                ? "No races finished yet."
                : board === "challenges"
                  ? "No challenges finished yet."
                  : "No scores yet. Be the first on the board!"}
            </p>
            <Link
              href={isRecords ? `/challenge?type=${board === "races" ? "race" : "challenge"}` : "/"}
              className="text-accent hover:underline"
            >
              {board === "races" ? "Start a race" : board === "challenges" ? "Challenge someone" : "Take a test"}
            </Link>
          </div>
        ) : isRecords ? (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-panel text-sm text-sub">
              <tr>
                <th className="px-5 py-3 font-normal">#</th>
                <th className="px-2 py-3 font-normal">Player</th>
                <th className="px-2 py-3 text-right font-normal">Wins</th>
                <th className="px-2 py-3 text-right font-normal">Losses</th>
                <th className="px-5 py-3 text-right font-normal">Draws</th>
              </tr>
            </thead>
            <tbody>
              {raceRows.map((row) => (
                <tr
                  key={row.username}
                  className={`border-t border-text/5 ${row.username === me?.username ? "bg-accent/10" : ""}`}
                >
                  <td className={`px-5 py-3 ${rankClass(row.rank)}`}>{row.rank}</td>
                  <td className="px-2 py-3 text-text">
                    <Link href={`/profile/${encodeURIComponent(row.username)}`} className="transition-colors hover:text-accent hover:underline">
                      {row.username}
                    </Link>
                    <PlaceIcon place={row.rank} />
                    {me && row.username !== me.username && (
                      <Link
                        href={`/challenge?type=challenge&to=${encodeURIComponent(row.username)}`}
                        title={`Challenge ${row.username}`}
                        aria-label={`Challenge ${row.username}`}
                        className="ml-3 text-sub transition-colors hover:text-accent"
                      >
                        <i className="bi bi-lightning-charge" aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-accent">{row.wins}</td>
                  <td className="px-2 py-3 text-right text-text">{row.losses}</td>
                  <td className="px-5 py-3 text-right text-sub">{row.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-panel text-sm text-sub">
              <tr>
                <th className="px-5 py-3 font-normal">#</th>
                <th className="px-2 py-3 font-normal">Player</th>
                <th className="px-2 py-3 text-right font-normal">WPM</th>
                <th className="px-2 py-3 text-right font-normal">Accuracy</th>
                <th className="hidden px-2 py-3 text-right font-normal sm:table-cell">Consistency</th>
                <th className="hidden px-5 py-3 text-right font-normal sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {scoreRows.map((row) => (
                <tr
                  key={row.username}
                  className={`border-t border-text/5 ${row.username === me?.username ? "bg-accent/10" : ""}`}
                >
                  <td className={`px-5 py-3 ${rankClass(row.rank)}`}>{row.rank}</td>
                  <td className="px-2 py-3 text-text">
                    <Link href={`/profile/${encodeURIComponent(row.username)}`} className="transition-colors hover:text-accent hover:underline">
                      {row.username}
                    </Link>
                    <PlaceIcon place={row.rank} />
                    {me && row.username !== me.username && (
                      <Link
                        href={`/challenge?type=challenge&to=${encodeURIComponent(row.username)}`}
                        title={`Challenge ${row.username}`}
                        aria-label={`Challenge ${row.username}`}
                        className="ml-3 text-sub transition-colors hover:text-accent"
                      >
                        <i className="bi bi-lightning-charge" aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right text-xl font-semibold text-accent">{row.wpm}</td>
                  <td className="px-2 py-3 text-right text-text">{row.accuracy}%</td>
                  <td className="hidden px-2 py-3 text-right text-text sm:table-cell">{row.consistency}%</td>
                  <td className="hidden px-5 py-3 text-right text-sub sm:table-cell">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>
    </PageShell>
  );
}
