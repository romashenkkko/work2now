import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  openUpward?: boolean;
  disableFutureDates?: boolean;
};

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(str: string): Date | null {
  if (!str) return null;
  const [y, m, day] = str.split("-").map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

export default function DatePicker({
  name,
  value,
  onChange,
  label,
  className,
  openUpward = false,
  disableFutureDates = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseYMD(value) || new Date());
  const ref = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  const lang = (i18n.language || "ro").toLowerCase().split("-")[0];
  const months = lang === "ro" ? ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"]
    : lang === "ru" ? ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
    : MONTHS_EN;
  const weekdays = lang === "ro" ? ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"]
    : lang === "ru" ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    : WEEKDAYS_EN;

  const selected = parseYMD(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
        setYearOpen(false);
        return;
      }
      if (yearOpen && yearRef.current && !yearRef.current.contains(target)) {
        setYearOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, yearOpen]);

  useEffect(() => {
    if (!open) setYearOpen(false);
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: ({ empty: true } | { empty: false; day: number; date: Date })[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ empty: false, day: d, date: new Date(year, month, d) });
  }
  while (cells.length < totalCells) cells.push({ empty: true });

  const isSelected = (d: Date) => selected && selected.getTime() === new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const isToday = (d: Date) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

  const displayValue = value ? (() => {
    const parsed = parseYMD(value);
    if (!parsed) return value;
    const dd = String(parsed.getDate()).padStart(2, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  })() : "dd/mm/yyyy";

  return (
    <div className={`relative ${className || ""}`.trim()} ref={ref}>
      {label && <span className="date-picker-label block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="date-picker-trigger w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 hover:border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
      >
        <span className="font-medium">{displayValue}</span>
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div
          className={`date-picker-panel absolute z-50 left-0 right-0 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden min-w-[280px] ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2" ref={yearRef}>
              <span className="font-semibold text-gray-900">{months[month]}</span>
              <div className="date-picker-year-dropdown relative">
                <button
                  type="button"
                  onClick={() => setYearOpen((v) => !v)}
                  className="date-picker-year-trigger text-sm font-semibold rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-800 inline-flex items-center gap-1.5"
                  aria-label="Year"
                  aria-expanded={yearOpen}
                >
                  <span>{year}</span>
                  <svg className={`h-4 w-4 transition-transform ${yearOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {yearOpen && (
                  <ul className="date-picker-year-list absolute top-full mt-1 left-0 right-0 z-20 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {years.map((y) => (
                      <li key={y}>
                        <button
                          type="button"
                          onClick={() => {
                            setViewDate(new Date(y, month, 1));
                            setYearOpen(false);
                          }}
                          className={`date-picker-year-option w-full px-3 py-1.5 text-left text-sm ${
                            y === year ? "date-picker-year-option--active" : ""
                          }`}
                        >
                          {y}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                aria-label={t("dashboard.prevMonth")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                aria-label={t("dashboard.nextMonth")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {weekdays.map((w) => (
                <div key={w} className="text-center text-xs font-medium text-gray-500 py-1">{w}</div>
              ))}
              {cells.map((cell, i) =>
                cell.empty ? (
                  <div key={i} className="aspect-square" aria-hidden />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (disableFutureDates && cell.date.getTime() > today.getTime()) return;
                      onChange(formatYMD(cell.date));
                      setOpen(false);
                    }}
                    className={`date-picker-day aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-colors ${
                      isSelected(cell.date)
                        ? "bg-primary text-white shadow-sm"
                        : isToday(cell.date)
                          ? "bg-primary/10 text-primary font-semibold"
                          : disableFutureDates && cell.date.getTime() > today.getTime()
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {cell.day}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/80">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {t("dashboard.clear")}
            </button>
            <button
              type="button"
              onClick={() => { onChange(formatYMD(today)); setOpen(false); }}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("dashboard.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
