import { useState } from "react";
import { Star } from "lucide-react";

const MAX = 5;

type Props = {
  /** Valoare 0–5 (poate fi zecimal pentru medie). La 0 toate stelele sunt goale. */
  value: number;
  /** Dacă true, utilizatorul poate da click pentru a seta 1–5; altfel doar afișare. */
  editable?: boolean;
  onSelect?: (score: number) => void;
  /** Clasa pentru steaua colorată (umplută). */
  filledClassName?: string;
  /** Clasa pentru steaua goală. */
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
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const displayValue = editable && hoverStar != null ? hoverStar : v;

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={editable ? "group" : "img"}
      aria-label={editable ? undefined : `Rating: ${v} din ${MAX}`}
      onMouseLeave={() => editable && setHoverStar(null)}
    >
      {Array.from({ length: MAX }, (_, i) => {
        const starValue = i + 1;
        const filled = displayValue >= starValue;
        return (
          <button
            key={i}
            type="button"
            disabled={!editable}
            onClick={() => editable && onSelect?.(starValue)}
            onMouseEnter={() => editable && setHoverStar(starValue)}
            className={`p-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
              editable ? "cursor-pointer hover:scale-110" : "cursor-default"
            }`}
            aria-label={editable ? `${starValue} din ${MAX} stele` : undefined}
          >
            <Star
              size={size}
              className={filled ? filledClassName : emptyClassName}
              fill={filled ? "currentColor" : "none"}
              strokeWidth={filled ? 0 : 2}
            />
          </button>
        );
      })}
    </div>
  );
}
