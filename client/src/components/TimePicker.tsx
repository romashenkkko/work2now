import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  "aria-label"?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

export default function TimePicker({ name, value, onChange, label, "aria-label": ariaLabel }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hour, min] = value.split(":");
  const hourVal = hour || "00";
  const minVal = min || "00";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleSelect = (h: string, m: string) => {
    onChange(`${h}:${m}`);
  };

  return (
    <div className="relative" ref={ref}>
      {label && (
        <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      )}
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel || label}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 hover:border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
      >
        <span className="font-medium tabular-nums">{hourVal}:{minVal}</span>
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="time-picker-dropdown absolute z-50 mt-2 left-0 right-0 rounded-2xl border border-gray-200/90 bg-white shadow-2xl shadow-primary/10 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("dashboard.timeSelected")}</span>
            <p className="font-bold text-lg text-gray-900 tabular-nums mt-0.5">{hourVal}:{minVal}</p>
          </div>
          <div className="flex max-h-52">
            <div className="time-picker-column flex-1 overflow-y-auto py-2 px-1.5">
              <div className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider pb-1.5">{t("dashboard.hours")}</div>
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => { handleSelect(h, minVal); setOpen(false); }}
                  className={`time-picker-option block w-full py-2 rounded-lg text-center text-sm font-semibold tabular-nums transition-all duration-200 ${hourVal === h ? "bg-primary text-white shadow-md shadow-primary/30 scale-[1.02]" : "text-gray-600 hover:bg-primary/10 hover:text-primary"}`}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="w-px self-stretch my-2 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
            <div className="time-picker-column flex-1 overflow-y-auto py-2 px-1.5">
              <div className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider pb-1.5">{t("dashboard.minutes")}</div>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { handleSelect(hourVal, m); setOpen(false); }}
                  className={`time-picker-option block w-full py-2 rounded-lg text-center text-sm font-semibold tabular-nums transition-all duration-200 ${minVal === m ? "bg-primary text-white shadow-md shadow-primary/30 scale-[1.02]" : "text-gray-600 hover:bg-primary/10 hover:text-primary"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
