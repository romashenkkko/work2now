import { useEffect, useId, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const R = 38;
const CIRC = 2 * Math.PI * R;

const CARD_ENTER_MS = 500;
const CHART_MS = 900;

type Props = {
  title: string;
  /** 0–100 */
  value: number;
  className?: string;
};

/**
 * Modern SaaS dashboard card: donut job occupancy with entry animation,
 * circular sweep + synced count-up, hover lift, optional completion pulse.
 */
export default function JobOccupancyRateCard({ title, value, className = "" }: Props) {
  const id = useId();
  const gradId = `occ-grad-${id.replace(/:/g, "")}`;
  const reducedMotion = usePrefersReducedMotion();

  const target = Math.max(0, Math.min(100, Math.round(value)));
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);
  const [displayPct, setDisplayPct] = useState(reducedMotion ? target : 0);
  const [completePulse, setCompletePulse] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Donut draw + count-up (synced)
  useEffect(() => {
    if (reducedMotion) {
      setProgress(1);
      setDisplayPct(target);
      setCompletePulse(false);
      return;
    }

    setProgress(0);
    setDisplayPct(0);
    setCompletePulse(false);

    const start = performance.now();
    const delay = CARD_ENTER_MS * 0.35;

    const tick = (now: number) => {
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const tNorm = Math.min(1, elapsed / CHART_MS);
      const eased = 1 - (1 - tNorm) ** 3;
      setProgress(eased);
      setDisplayPct(Math.round(target * eased));
      if (tNorm < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayPct(target);
        setProgress(1);
        setCompletePulse(true);
        window.setTimeout(() => setCompletePulse(false), 1200);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, reducedMotion]);

  const offset = CIRC * (1 - progress);
  const dashArray = `${CIRC}`;

  return (
    <div
      className={[
        "occupancy-card group flex min-h-[220px] flex-col overflow-hidden rounded-[18px] border border-gray-200/90 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-6",
        "hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(90,79,207,0.14)]",
        !reducedMotion && "occupancy-card-enter",
        completePulse ? "occupancy-card--pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h3 className="text-sm font-medium text-[#1e1c2f]">{title}</h3>

      <div className="relative mt-4 flex flex-1 items-center justify-center">
        <div className="relative flex h-[168px] w-[168px] items-center justify-center sm:h-[184px] sm:w-[184px]">
          <svg
            className="h-full w-full -rotate-90 drop-shadow-[0_0_14px_rgba(124,108,246,0.22)]"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7C6CF6" />
                <stop offset="100%" stopColor="#5A4FCF" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(241 245 249)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              strokeDashoffset={offset}
              className="transition-none"
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-[#1e1c2f] sm:text-3xl">{displayPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
