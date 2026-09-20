import type { HistoryPoint } from "@/server/profiles";

const WIDTH = 640;
const HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 30, left: 44 };
const STEPS = [5, 10, 20, 25, 50, 100, 200];

function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A player's WPM over their last tests of one type. Drawn on the server, so it needs no client code. */
export function ProgressChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="rounded-lg bg-bg px-4 py-10 text-center text-sub">
        Take at least two tests of this type while logged in to see progress here.
      </p>
    );
  }

  const max = Math.max(...points.map((point) => point.wpm), 10);
  const step = STEPS.find((candidate) => max / candidate <= 4) ?? 200;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) => MARGIN.left + (index * plotW) / (points.length - 1);
  const y = (wpm: number) => MARGIN.top + plotH - (wpm / top) * plotH;

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.wpm)}`).join("");
  const area = `${line}L${x(points.length - 1)},${MARGIN.top + plotH}L${x(0)},${MARGIN.top + plotH}Z`;
  const bestIndex = points.reduce((best, point, index) => (point.wpm > points[best].wpm ? index : best), 0);
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`WPM over the last ${points.length} tests, from ${points[0].wpm} to ${points[points.length - 1].wpm}. Best ${points[bestIndex].wpm}.`}
      className="h-auto w-full font-mono text-[11px]"
    >
      <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} rx={6} fill="var(--bg)" />
      {ticks.map((value) => (
        <g key={value}>
          <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(value)} y2={y(value)} stroke="var(--text)" strokeOpacity={0.08} />
          <text x={MARGIN.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle" fill="var(--sub)">
            {value}
          </text>
        </g>
      ))}

      <path d={area} fill="var(--accent)" fillOpacity={0.1} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.length <= 40 &&
        points.map((point, index) => (
          <circle key={index} cx={x(index)} cy={y(point.wpm)} r={index === bestIndex ? 5 : 3} fill="var(--accent)" />
        ))}

      <text
        x={Math.min(Math.max(x(bestIndex), MARGIN.left + 24), WIDTH - MARGIN.right - 24)}
        // Above the point, unless that would run off the top of the chart.
        y={y(points[bestIndex].wpm) - 12 < MARGIN.top + 6 ? y(points[bestIndex].wpm) + 22 : y(points[bestIndex].wpm) - 12}
        textAnchor="middle"
        fill="var(--accent)"
      >
        Best {points[bestIndex].wpm}
      </text>

      <text x={MARGIN.left} y={HEIGHT - 8} textAnchor="start" fill="var(--sub)">
        {shortDate(points[0].createdAt)}
      </text>
      <text x={WIDTH - MARGIN.right} y={HEIGHT - 8} textAnchor="end" fill="var(--sub)">
        {shortDate(points[points.length - 1].createdAt)}
      </text>
    </svg>
  );
}
