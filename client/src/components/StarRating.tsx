import { useState, useCallback } from "react";
import { Star } from "lucide-react";

const MAX = 5;

/** Rotunjește la cea mai apropiată jumătate (0.5, 1, 1.5, ... 5). */
function toHalfStep(n: number): number {
  const v = Math.max(0, Math.min(MAX, n));
  const half = Math.round(v * 2) / 2;
  return half === 0 ? 0.5 : half; // minim selectabil 0.5
}

type Props = {
  /** Valoare 0–5 (poate fi zecimal pentru medie sau selecție jumătate). */
  value: number;
  editable?: boolean;
  onSelect?: (score: number) => void;
  filledClassName?: string;
  emptyClassName?: string;
  size?: number;
};

export default function StarRating({
  value,
  editable = false,
  onSelect,
  filledClassName = "text-amber-400",
  emptyClassName = "text-gray-300",
  size = 20,
}: Props) {
  const v = Math.max(0, Math.min(MAX, value));
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = editable && hoverValue != null ? hoverValue : v;

  const fullStars = Math.floor(displayValue);
  const remainder = displayValue - fullStars;
  const partialFill = remainder > 0 && remainder < 1 ? remainder : 0;
  const hasPartial = partialFill > 0;

  const handleStarInteraction = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, starIndex: number) => {
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isLeftHalf = x < rect.width / 2;
      const newValue = starIndex + (isLeftHalf ? 0.5 : 1);
      onSelect?.(toHalfStep(newValue));
    },
    [onSelect]
  );

  const handleStarMouseMove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, starIndex: number) => {
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isLeftHalf = x < rect.width / 2;
      setHoverValue(starIndex + (isLeftHalf ? 0.5 : 1));
    },
    []
  );

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={editable ? "group" : "img"}
      aria-label={editable ? undefined : `Rating: ${v.toFixed(1)} din ${MAX}`}
      onMouseLeave={() => editable && setHoverValue(null)}
    >
      {Array.from({ length: MAX }, (_, i) => {
        const starIndex = i + 1; // 1..5
        const isFullyFilled = displayValue >= starIndex;
        const isPartialStar = hasPartial && starIndex === fullStars + 1;

        if (editable) {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handleStarInteraction(e, i)}
              onMouseMove={(e) => handleStarMouseMove(e, i)}
              className="p-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer hover:scale-110 relative"
              aria-label={`${i + 0.5} sau ${i + 1} stele`}
              style={{ width: size, height: size }}
            >
              <span className="relative inline-block w-full h-full" style={{ width: size, height: size }}>
                <Star
                  size={size}
                  className={emptyClassName}
                  fill="none"
                  strokeWidth={2}
                  style={{ position: "absolute", left: 0, top: 0 }}
                />
                {isFullyFilled ? (
                  <Star
                    size={size}
                    className={filledClassName}
                    fill="currentColor"
                    strokeWidth={0}
                    style={{ position: "absolute", left: 0, top: 0 }}
                  />
                ) : isPartialStar ? (
                  <span
                    className="overflow-hidden"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: `${Math.round(partialFill * 100)}%`,
                      height: size,
                    }}
                  >
                    <Star
                      size={size}
                      className={filledClassName}
                      fill="currentColor"
                      strokeWidth={0}
                      style={{ position: "absolute", left: 0, top: 0 }}
                    />
                  </span>
                ) : null}
              </span>
            </button>
          );
        }

        return (
          <span key={i} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
            <Star
              size={size}
              className={emptyClassName}
              fill="none"
              strokeWidth={2}
              style={{ position: "absolute", left: 0, top: 0 }}
            />
            {isFullyFilled ? (
              <Star
                size={size}
                className={filledClassName}
                fill="currentColor"
                strokeWidth={0}
                style={{ position: "absolute", left: 0, top: 0 }}
              />
            ) : isPartialStar ? (
              <span
                className="overflow-hidden"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${Math.round(partialFill * 100)}%`,
                  height: size,
                }}
              >
                <Star
                  size={size}
                  className={filledClassName}
                  fill="currentColor"
                  strokeWidth={0}
                  style={{ position: "absolute", left: 0, top: 0 }}
                />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
