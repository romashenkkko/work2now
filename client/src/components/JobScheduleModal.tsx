import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobRow } from "../pages/DashboardLayout";
import { Briefcase, Clock, MapPin, List, Calendar, Banknote, Users, AlertTriangle, Share2, User } from "lucide-react";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function parseYMD(str: string): Date | null {
  if (!str) return null;
  const [y, m, day] = str.split("-").map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function getDatesInRange(startStr: string, endStr: string): Date[] {
  const start = parseYMD(startStr);
  const end = endStr ? parseYMD(endStr) : start;
  if (!start) return [];
  const endDate = end && end >= start ? end : start;
  const out: Date[] = [];
  const d = new Date(start);
  while (d <= endDate) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function ShareJobButton({ job, t }: { job: JobRow; t: (key: string) => string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?job=${job.id ?? ""}` : "";
  const title = `${job.job} – Time2Go`;
  const shareText = [job.job, job.location, job.estimatedSalary].filter(Boolean).join(" · ");

  const copyToClipboard = (text: string): boolean => {
    if (navigator.clipboard?.writeText) {
      try {
        navigator.clipboard.writeText(text);
        return true;
      } catch {
        // continue to fallback
      }
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  };

  const handleShare = async () => {
    setError(false);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText || job.job,
          url: shareUrl,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // fallback to copy
      }
    }
    const fullText = `${title}\n${shareText}\n${shareUrl}`;
    if (copyToClipboard(fullText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setError(true);
      setTimeout(() => setError(false), 3000);
      if (typeof window !== "undefined" && window.prompt) {
        window.prompt(t("dashboard.shareCopyManual"), shareUrl);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors disabled:opacity-70"
    >
      <Share2 className="w-4 h-4 shrink-0" />
      {copied ? t("dashboard.linkCopied") : error ? t("dashboard.shareCopyFailed") : t("dashboard.shareJob")}
    </button>
  );
}

export type WorkSession = { workDate: string; checkedInAt?: string; checkedOutAt?: string };
export type MyAppInfoForModal = { applicationId: string; workSessions: WorkSession[] };

type Props = {
  open: boolean;
  onClose: () => void;
  job: JobRow | null;
  myAppInfo?: MyAppInfoForModal | null;
  onCheckIn?: (applicationId: string, workDate: string) => void;
  onCheckOut?: (applicationId: string, workDate: string) => void;
  checkInOutLoading?: string | null;
};

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function JobScheduleModal({ open, onClose, job, myAppInfo, onCheckIn, onCheckOut, checkInOutLoading }: Props) {
  const { t } = useTranslation();

  const dates = useMemo(() => {
    if (!open || !job?.date) return [];
    return getDatesInRange(job.date, job.endDate ?? job.date);
  }, [open, job?.date, job?.endDate]);

  const formatDateLabel = (d: Date) => {
    const weekday = WEEKDAY_KEYS[d.getDay()];
    const day = d.getDate();
    const month = MONTH_KEYS[d.getMonth()];
    return `${t(`dashboard.weekdayShort.${weekday}`)}, ${day} ${t(`dashboard.monthShort.${month}`)}`;
  };

  const isStaffWithAccepted = myAppInfo && onCheckIn && onCheckOut;
  const workSessions = myAppInfo?.workSessions ?? [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden modal-content-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label={t("dashboard.close")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900">{t("dashboard.job")}</h2>
        </div>

        {job && (
          <>
            <div className="p-4 pb-2 flex-shrink-0">
              {job.imageUrl && (
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={job.imageUrl} alt="" className="w-full h-40 sm:h-48 object-cover" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-xl font-bold text-gray-900">{job.job}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${job.statusClass}`}>
                  {job.status}
                </span>
              </div>
              {job.postedBy && (
                <p className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <User className="w-4 h-4 text-primary shrink-0" />
                  <span>{t("dashboard.postedBy")}: {job.postedBy}</span>
                </p>
              )}
              <ul className="space-y-2.5 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary shrink-0" />
                  <span>{job.job}</span>
                </li>
                {(job.startTime || job.endTime) && (
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span>{job.startTime ?? "—"} – {job.endTime ?? "—"}</span>
                  </li>
                )}
                {job.location && (
                  <li className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="break-words">{job.location}</span>
                  </li>
                )}
                {job.estimatedSalary && (
                  <li className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-primary shrink-0" />
                    <span>{job.estimatedSalary}</span>
                  </li>
                )}
                {job.peopleNeeded && (
                  <li className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span>{job.peopleNeeded}</span>
                  </li>
                )}
                {(job.date || job.endDate) && (
                  <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      {job.date}
                      {job.endDate && job.endDate !== job.date ? ` – ${job.endDate}` : ""}
                    </span>
                  </li>
                )}
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <ShareJobButton job={job} t={t} />
              </div>
            </div>

            <div className="px-4 pb-2 flex gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium">
                <List className="w-4 h-4" />
                {t("dashboard.listView")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">
                <Calendar className="w-4 h-4" />
                {t("dashboard.calendarView")}
              </span>
            </div>

            <div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">
              {dates.length > 2 && (
                <div className="flex gap-3 p-3 mb-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    {t("dashboard.multiDayJobWarning")}
                  </p>
                </div>
              )}
              <h4 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard.upcomingJobs")}</h4>
              <ul className="space-y-2.5">
                {dates.length === 0 ? (
                  <li className="text-sm text-gray-500 py-4 text-center rounded-2xl bg-gray-50 border border-gray-100">
                    {t("dashboard.noDatesInRange")}
                  </li>
                ) : (
                  dates.map((d) => {
                    const workDate = dateToYMD(d);
                    const session = workSessions.find((s) => s.workDate === workDate);
                    const loadingKey = myAppInfo ? `${myAppInfo.applicationId}-${workDate}` : "";
                    const loading = checkInOutLoading === loadingKey;
                    return (
                      <li
                        key={d.toISOString()}
                        className="flex flex-wrap items-center justify-between gap-2 py-4 px-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-gray-900 text-sm"
                      >
                        <span className="font-medium">{formatDateLabel(d)}</span>
                        {isStaffWithAccepted ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!session?.checkedInAt ? (
                              <button
                                type="button"
                                onClick={() => onCheckIn!(myAppInfo!.applicationId, workDate)}
                                disabled={!!checkInOutLoading}
                                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                              >
                                {loading ? "..." : t("dashboard.checkIn")}
                              </button>
                            ) : !session?.checkedOutAt ? (
                              <>
                                <span className="text-xs text-gray-500">{t("dashboard.checkedInAt")} {formatTime(session.checkedInAt!)}</span>
                                <button
                                  type="button"
                                  onClick={() => onCheckOut!(myAppInfo!.applicationId, workDate)}
                                  disabled={!!checkInOutLoading}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                                >
                                  {loading ? "..." : t("dashboard.checkOut")}
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-600">
                                {t("dashboard.checkedInAt")} {formatTime(session.checkedInAt!)} · {t("dashboard.checkedOutAt")} {formatTime(session.checkedOutAt!)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-primary text-gray-400 shrink-0 ml-2" aria-hidden>›</span>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
