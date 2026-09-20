"use client";

import { useEffect, useRef, useState } from "react";
import type { SecondSample } from "@/lib/types";

interface ResultsChartProps {
  samples: SecondSample[];
}

const MARGIN = { top: 16, right: 48, bottom: 36, left: 56 };
const DOT_LIMIT = 30;
const WPM_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

function niceScale(max: number) {
  const step = WPM_STEPS.find((s) => max / s <= 4) ?? 500;
  return { step, top: Math.max(step, Math.ceil(max / step) * step) };
}

function ticks(step: number, top: number) {
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

/** Monotone cubic interpolation: smooth curve that never overshoots the data. */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;

  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }

  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const tau = 3 / Math.sqrt(h);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }

  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    d += `C${x0 + dx[i] / 3},${y0 + (t[i] * dx[i]) / 3},${x1 - dx[i] / 3},${y1 - (t[i + 1] * dx[i]) / 3},${x1},${y1}`;
  }
  return d;
}

export function ResultsChart({ samples }: ResultsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const n = samples.length;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const plotBottom = MARGIN.top + plotH;

  const maxSpeed = Math.max(10, ...samples.flatMap((s) => [s.wpm, s.raw, s.burst]));
  const maxErrors = Math.max(1, ...samples.map((s) => s.errors));
  const speed = niceScale(maxSpeed);
  const errStep = Math.ceil(maxErrors / 3);
  const errTop = errStep * Math.ceil(maxErrors / errStep);

  const x = (i: number) => (n === 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (i * plotW) / (n - 1));
  const ySpeed = (v: number) => plotBottom - (v / speed.top) * plotH;
  const yErrors = (v: number) => plotBottom - (v / errTop) * plotH;

  const labelStride = Math.ceil(n / Math.max(2, Math.floor(plotW / 44)));
  const showDots = n <= DOT_LIMIT;

  const series = [
    { key: "burst", color: "var(--sub)", dash: undefined, opacity: 1 },
    { key: "raw", color: "var(--accent)", dash: "6 5", opacity: 0.55 },
    { key: "wpm", color: "var(--accent)", dash: undefined, opacity: 1 },
  ] as const;

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = plotW > 0 ? (e.clientX - rect.left - MARGIN.left) / plotW : 0;
    setHovered(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
  }

  const active = hovered !== null ? samples[hovered] : null;
  const flip = hovered !== null && hovered > (n - 1) / 2;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div ref={containerRef} className="relative min-h-[180px] w-full flex-1">
        {width > 0 && height > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Speed per second, from ${samples[0]?.wpm ?? 0} to ${samples[n - 1]?.wpm ?? 0} words per minute`}
            className="absolute inset-0 block select-none font-mono text-xs"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHovered(null)}
          >
            <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} rx={6} fill="var(--panel)" />

            {ticks(speed.step, speed.top).map((v) => (
              <g key={`y-${v}`}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={ySpeed(v)}
                  y2={ySpeed(v)}
                  stroke="var(--text)"
                  strokeOpacity={0.08}
                />
                <text x={MARGIN.left - 10} y={ySpeed(v)} textAnchor="end" dominantBaseline="middle" fill="var(--sub)">
                  {v}
                </text>
              </g>
            ))}

            {ticks(errStep, errTop).map((v) => (
              <text
                key={`e-${v}`}
                x={MARGIN.left + plotW + 10}
                y={yErrors(v)}
                dominantBaseline="middle"
                fill="var(--sub)"
              >
                {v}
              </text>
            ))}

            {samples.map((s, i) =>
              i % labelStride === 0 ? (
                <g key={`x-${s.second}`}>
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={MARGIN.top}
                    y2={plotBottom}
                    stroke="var(--text)"
                    strokeOpacity={0.08}
                  />
                  <text x={x(i)} y={plotBottom + 18} textAnchor="middle" fill="var(--sub)">
                    {s.second}
                  </text>
                </g>
              ) : null
            )}

            <text
              transform={`translate(14 ${MARGIN.top + plotH / 2}) rotate(-90)`}
              textAnchor="middle"
              fill="var(--sub)"
            >
              Words per Minute
            </text>
            <text
              transform={`translate(${width - 12} ${MARGIN.top + plotH / 2}) rotate(90)`}
              textAnchor="middle"
              fill="var(--sub)"
            >
              Errors
            </text>

            {hovered !== null && (
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={MARGIN.top}
                y2={plotBottom}
                stroke="var(--text)"
                strokeOpacity={0.3}
              />
            )}

            {series.map(({ key, color, dash, opacity }) => (
              <g key={key} opacity={opacity}>
                <path
                  d={smoothPath(samples.map((s, i) => [x(i), ySpeed(s[key])]))}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                />
                {showDots &&
                  samples.map((s, i) => (
                    <circle key={s.second} cx={x(i)} cy={ySpeed(s[key])} r={i === hovered ? 5 : 3} fill={color} />
                  ))}
              </g>
            ))}

            {samples.map((s, i) =>
              s.errors > 0 ? (
                <path
                  key={`err-${s.second}`}
                  d="M-3.5,-3.5L3.5,3.5M3.5,-3.5L-3.5,3.5"
                  transform={`translate(${x(i)} ${yErrors(s.errors)})`}
                  stroke="var(--error)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ) : null
            )}
          </svg>
        )}

        {active && hovered !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-text/10 bg-bg px-3 py-2 text-sm shadow-lg"
            style={{
              top: MARGIN.top + 8,
              left: x(hovered) + (flip ? -12 : 12),
              transform: flip ? "translateX(-100%)" : undefined,
            }}
          >
            <div className="mb-1 font-semibold text-text">{active.second}</div>
            <ul className="flex flex-col gap-0.5 font-mono text-text">
              <TooltipRow color="var(--error)" label="errors" value={active.errors} />
              <TooltipRow color="var(--accent)" label="wpm" value={active.wpm} />
              <TooltipRow color="var(--accent)" faded label="raw" value={active.raw} />
              <TooltipRow color="var(--sub)" label="burst" value={active.burst} />
            </ul>
          </div>
        )}
      </div>

      <ul className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-sm text-sub">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-accent" /> wpm
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 border-t-2 border-dashed border-accent/60" /> raw
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-sub" /> burst
        </li>
        <li className="flex items-center gap-2">
          <i className="bi bi-x-lg text-xs text-error" aria-hidden="true" /> errors
        </li>
      </ul>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
  faded,
}: {
  color: string;
  label: string;
  value: number;
  faded?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-3 rounded-sm" style={{ background: color, opacity: faded ? 0.55 : 1 }} />
      {label}: {value}
    </li>
  );
}
