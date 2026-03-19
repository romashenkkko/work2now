import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

/** Monochrome purple scale (dark → light) for category slices */
const PURPLE_PALETTE = [
  "#4A3DAD",
  "#5A4FCF",
  "#6B5CE6",
  "#7C6CF6",
  "#9589F8",
  "#B4A9FA",
  "#D4CCFD",
  "#E8E4FF",
];

const STAGGER_MS = 125;
const SLICE_SWEEP_MS = 420;

type DataItem = { code: number | string; title: string; count: number };

type Props = {
  title: string;
  data: DataItem[];
  t: TFunction;
  className?: string;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Pie slice from center; sweep in degrees, start at startDeg (0 = east, we use standard math angle). */
function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  if (sweepDeg <= 0.05) return "";
  const rad0 = (startDeg * Math.PI) / 180;
  const rad1 = ((startDeg + sweepDeg) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad0);
  const y0 = cy + r * Math.sin(rad0);
  const x1 = cx + r * Math.cos(rad1);
  const y1 = cy + r * Math.sin(rad1);

  if (sweepDeg >= 359.95) {
    return `M ${cx} ${cy} m 0 -${r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 -${2 * r} Z`;
  }

  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

export default function JobCategoriesPieCard({ title, data, t, className = "" }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const total = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const segments = useMemo(() => {
    let angle = -90;
    return data.map((item, idx) => {
      const fullSweep = total > 0 ? (item.count / total) * 360 : 0;
      const start = angle;
      angle += fullSweep;
      return {
        ...item,
        idx,
        startDeg: start,
        fullSweep,
        color: PURPLE_PALETTE[idx % PURPLE_PALETTE.length],
        pct: total > 0 ? Math.round((item.count / total) * 100) : 0,
      };
    });
  }, [data, total]);

  const [sliceProgress, setSliceProgress] = useState<number[]>(() => segments.map(() => (reducedMotion ? 1 : 0)));
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null);
  const animStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      setSliceProgress(segments.map(() => 1));
      return;
    }

    setSliceProgress(segments.map(() => 0));
    animStartRef.current = performance.now();

    const tick = (now: number) => {
      const start = animStartRef.current ?? now;
      const next = segments.map((_seg, i) => {
        const elapsed = now - start - i * STAGGER_MS;
        const raw = elapsed / SLICE_SWEEP_MS;
        const p = Math.min(1, Math.max(0, easeOutCubic(raw)));
        return p;
      });
      setSliceProgress(next);
      if (next.some((p) => p < 1)) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [segments, reducedMotion, total, data]);

  const clearHover = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const onSliceMove = useCallback((e: React.MouseEvent, idx: number) => {
    const el = chartWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTooltip({
      idx,
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
  }, []);

  const cx = 70;
  const cy = 70;
  const r = 56;

  if (total === 0) {
    return (
      <div
        className={`flex min-h-[220px] flex-col rounded-[18px] border border-gray-200/90 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-6 ${className}`}
      >
        <h3 className="text-sm font-medium text-[#1e1c2f]">{title}</h3>
        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-gray-50/80 py-10">
          <svg className="h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 6.75h4.5M9 10h6M9 14h6m-5.25 4h4.5M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-600">{t("dashboard.noData", "Fără date")}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`job-categories-pie-card flex min-h-[220px] flex-col rounded-[18px] border border-gray-200/90 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.01] hover:shadow-[0_12px_40px_rgba(90,79,207,0.12)] sm:p-6 ${className}`}
    >
      <h3 className="text-sm font-medium text-[#1e1c2f]">{title}</h3>

      <div
        className="mt-4 flex flex-1 flex-col items-center gap-6 md:flex-row md:items-center md:justify-between md:gap-8"
        onMouseLeave={clearHover}
      >
        <div
          ref={chartWrapRef}
          className={`relative flex shrink-0 justify-center ${!reducedMotion ? "job-cat-pie-tilt-enter" : ""}`}
        >
          <svg width="168" height="168" viewBox="0 0 140 140" className="h-[168px] w-[168px] sm:h-[176px] sm:w-[176px]" aria-hidden>
            {segments.map((seg, i) => {
              const p = sliceProgress[i] ?? 0;
              const sweep = seg.fullSweep * p;
              const d = pieSlicePath(cx, cy, r, seg.startDeg, sweep);
              if (!d) return null;
              const isHi = hovered === seg.idx;
              const dim = hovered !== null && !isHi;
              const scale = isHi ? 1.03 : 1;
              return (
                <g
                  key={String(seg.code)}
                  style={{
                    transform: `translate(${cx}px, ${cy}px) scale(${scale}) translate(${-cx}px, ${-cy}px)`,
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: "transform 0.2s ease-out, opacity 0.2s ease-out",
                    opacity: dim ? 0.42 : 1,
                  }}
                >
                  <path
                    d={d}
                    fill={seg.color}
                    stroke="#fff"
                    strokeWidth={2.5}
                    className="cursor-pointer outline-none"
                    onMouseEnter={() => setHovered(seg.idx)}
                    onMouseMove={(e) => onSliceMove(e, seg.idx)}
                  />
                </g>
              );
            })}
          </svg>

          {tooltip !== null && hovered !== null && segments[tooltip.idx] && (
            <div
              className="pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2 rounded-lg border border-gray-200/90 bg-white/95 px-3 py-2 text-left shadow-lg backdrop-blur-sm"
              style={{
                left: Math.min(Math.max(tooltip.x, 72), (chartWrapRef.current?.offsetWidth ?? 168) - 72),
                top: Math.max(tooltip.y - 48, 8),
              }}
              role="status"
            >
              <div className="text-xs font-semibold text-gray-900">{segments[tooltip.idx].title}</div>
              <div className="mt-0.5 text-xs text-gray-600">
                {segments[tooltip.idx].pct}% · {segments[tooltip.idx].count}{" "}
                {t("dashboard.jobsCountLabel", "joburi")}
              </div>
            </div>
          )}
        </div>

        <ul className="flex w-full min-w-0 max-w-[280px] flex-col gap-2 md:flex-1" role="list">
          {segments.map((seg, idx) => (
            <li
              key={String(seg.code)}
              className={`job-cat-legend-row grid cursor-default grid-cols-[14px_1fr_auto] items-center gap-3 rounded-lg py-1.5 pl-1 pr-2 transition-colors duration-200 ${
                hovered === seg.idx ? "bg-[rgba(124,108,246,0.08)]" : "hover:bg-gray-50/90"
              } ${!reducedMotion ? "job-cat-legend-row--animate" : ""}`}
              style={
                !reducedMotion
                  ? ({
                      ["--legend-delay" as string]: `${280 + idx * 95}ms`,
                    } as React.CSSProperties)
                  : undefined
              }
              onMouseEnter={() => setHovered(seg.idx)}
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-sm shadow-sm ring-1 ring-white/80"
                style={{ backgroundColor: seg.color }}
                aria-hidden
              />
              <span className="min-w-0 text-sm leading-tight text-gray-800 break-words">{seg.title}</span>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-gray-900">{seg.count}</div>
                <div className="text-xs text-gray-500">({seg.pct}%)</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
