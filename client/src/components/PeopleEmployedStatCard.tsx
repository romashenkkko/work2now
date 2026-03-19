import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const COUNT_MS = 600;

type Props = {
  title: string;
  /** Shown below the number (e.g. “angajați au lucrat”) */
  description: string;
  value: number;
  className?: string;
};

function UsersIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 11a4 4 0 100-8 4 4 0 000 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 21v-2a3.5 3.5 0 00-3-3.46" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.5 3a4 4 0 010 8" />
    </svg>
  );
}

/**
 * Minimal stat card: employees worked — aligned with dashboard occupancy card system.
 */
export default function PeopleEmployedStatCard({ title, description, value, className = "" }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const target = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const [display, setDisplay] = useState(reducedMotion ? target : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(target);
      return;
    }

    setDisplay(0);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const tNorm = Math.min(1, elapsed / COUNT_MS);
      const eased = 1 - (1 - tNorm) ** 3;
      setDisplay(Math.round(target * eased));
      if (tNorm < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, reducedMotion]);

  return (
    <div
      className={[
        "people-employed-stat-card group flex min-h-[220px] flex-col rounded-[18px] border border-gray-200/90 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-6",
        "hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(90,79,207,0.14)]",
        !reducedMotion && "people-employed-stat-card-enter",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-[#1e1c2f]">{title}</h3>
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(124,108,246,0.12)] bg-[rgba(124,108,246,0.1)] text-[#5A4FCF]",
            !reducedMotion && "people-employed-stat-icon-enter",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          <UsersIcon />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pt-2">
        <p
          className="people-employed-stat-number bg-gradient-to-br from-[#7C6CF6] to-[#5A4FCF] bg-clip-text text-5xl font-bold tabular-nums text-transparent sm:text-6xl"
          aria-live="polite"
        >
          {display}
        </p>
        <p className="mt-2 max-w-[16rem] text-center text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}
