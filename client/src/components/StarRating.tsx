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
  filledClassName = "text-amber-400 fill-amber-400",
  emptyClassName = "text-gray-300",
  size = 20,
}: Props) {
  const v = Math.max(0, Math.min(MAX, value));

  return (
    <div className="inline-flex items-center gap-0.5" role={editable ? "group" : "img"} aria-label={editable ? undefined : `Rating: ${v} din ${MAX}`}>
      {Array.from({ length: MAX }, (_, i) => {
        const starValue = i + 1;
        const filled = v >= starValue;
        return (
          <button
            key={i}
            type="button"
            disabled={!editable}
            onClick={() => editable && onSelect?.(starValue)}
            className={`p-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              editable ? "cursor-pointer hover:opacity-80" : "cursor-default"
            }`}
            aria-label={editable ? `${starValue} stele` : undefined}
          >
            <Star
              size={size}
              className={filled ? filledClassName : emptyClassName}
            />
          </button>
        );
      })}
    </div>
  );
}
