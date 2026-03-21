import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { JobRow } from "../pages/DashboardLayout";
import { Briefcase, Clock, MapPin, Calendar, Banknote, Users, AlertTriangle, Share2 } from "lucide-react";
import { getBusinessTotal, getStaffNet, roundMoney } from "../utils/salary";

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
  const title = `${job.job} – Work2Now`;
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

/** Minimal app shape for customer: show "employee started at" and "Finished". */
export type JobApplicationForCustomer = {
  id: string;
  status?: string;
  staffName?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  job: JobRow | null;
  /** When true, show staff net (base - 9% - 12%). When false, show business total (base + 24% + 10%). */
  viewerIsStaff?: boolean;
  myAppInfo?: MyAppInfoForModal | null;
  onCheckIn?: (applicationId: string, workDate: string) => void;
  onCheckOut?: (applicationId: string, workDate: string) => void;
  checkInOutLoading?: string | null;
  /** Customer: accepted applications for this job (for "employee started at" + "Finished" label). */
  jobApplications?: JobApplicationForCustomer[];
};

/** Parse "HH:MM" or "H:MM" to minutes since midnight. Returns NaN if invalid. */
function timeToMinutes(str: string): number {
  if (!str || typeof str !== "string") return NaN;
  const parts = str.trim().split(/[:\s]+/);
  const h = parseInt(parts[0], 10);
  const m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** Hours between start and end time. If end <= start (e.g. 22:00–02:00), treats end as next day. Returns 0 if invalid. */
function hoursBetweenTimes(startStr: string, endStr: string): number {
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const minsPerDay = 24 * 60;
  const durationMins = end <= start ? minsPerDay - start + end : end - start;
  return durationMins / 60;
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normalize workDate for comparison (YYYY-MM-DD only). */
function normWorkDate(s: string | undefined): string {
  return (s || "").trim().slice(0, 10);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatTimeFromIso(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function JobScheduleModal({ open, onClose, job, viewerIsStaff = false, myAppInfo, onCheckIn, onCheckOut, checkInOutLoading, jobApplications = [] }: Props) {
  const { t } = useTranslation();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      // Save previous overflow value
      const previousOverflow = document.body.style.overflow;
      // Lock body scroll
      document.body.style.overflow = "hidden";
      
      return () => {
        // Restore previous overflow value
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [open]);

  const dates = useMemo(() => {
    if (!open || !job?.date) return [];
    const range = getDatesInRange(job.date, job.endDate ?? job.date);
    return range.sort((a, b) => a.getTime() - b.getTime());
  }, [open, job?.date, job?.endDate]);

  const formatDateLabel = (d: Date) => {
    const weekday = WEEKDAY_KEYS[d.getDay()];
    const day = d.getDate();
    const month = MONTH_KEYS[d.getMonth()];
    return `${t(`dashboard.weekdayShort.${weekday}`)}, ${day} ${t(`dashboard.monthShort.${month}`)}`;
  };

  const isStaffWithAccepted = myAppInfo && onCheckIn && onCheckOut;
  const workSessions = myAppInfo?.workSessions ?? [];

  const isJobFull = job && (job.acceptedCount ?? 0) >= (parseInt(String(job.peopleNeeded ?? "1"), 10) || 1);

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-black/50 modal-overlay-enter"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col modal-content-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - shrink-0 */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
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
        </div>

        {/* Body - flex-1 min-h-0 overflow-y-auto overscroll-contain */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {job && (
            <>
              <div className="p-4 pb-2">
              {job.imageUrl && (
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={job.imageUrl} alt="" className="w-full h-40 sm:h-48 object-cover" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-xl font-extrabold bg-gradient-to-r from-primary via-[#7d66ff] to-[#5f7cff] bg-clip-text text-transparent">
                  {job.job}
                </h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isJobFull ? "bg-amber-100 text-amber-800 border border-amber-200" : job.statusClass}`}>
                  {isJobFull ? t("dashboard.jobFull") : job.status}
                </span>
              </div>
              {job.postedBy && (
                <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="relative flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    <span className="text-primary font-semibold text-sm">{job.postedBy.charAt(0).toUpperCase()}</span>
                    {job.postedByAvatar && (
                      <img
                        src={job.postedByAvatar}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{job.postedBy}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {(() => {
                        const r = (job.postedByRole ?? "").toLowerCase();
                        return r === "staff" ? t("dashboard.roleStaff") : r === "admin" ? t("dashboard.roleAdmin") : t("dashboard.roleCustomer");
                      })()}
                    </span>
                  </div>
                </div>
              )}
              <ul className="space-y-2.5 text-sm text-gray-600">
                {(job.jobCategoryTitle || job.job) && (
                  <li className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary shrink-0" />
                    <span>{job.jobCategoryTitle ?? job.job}</span>
                  </li>
                )}
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
                {(() => {
                  const hourlyRate = job.hourlyRateBase != null ? Number(job.hourlyRateBase) : (job.estimatedSalary ? parseFloat(String(job.estimatedSalary).replace(/,/g, ".")) : NaN);
                  const hasRate = Number.isFinite(hourlyRate) && hourlyRate > 0;
                  const startT = (job.startTime ?? "").trim();
                  const endT = (job.endTime ?? "").trim();
                  const hoursPerDay = startT && endT ? hoursBetweenTimes(startT, endT) : 0;
                  const numDays = dates.length || 1;
                  const totalHours = hoursPerDay * numDays;
                  const baseTotal = hasRate && totalHours > 0 ? hourlyRate * totalHours : null;
                  // Staff sees base salary, business sees total with taxes
                  const displayTotal = baseTotal != null && baseTotal > 0
                    ? roundMoney(viewerIsStaff ? baseTotal : getBusinessTotal(baseTotal))
                    : null;
                  // For staff, calculate net amount after taxes
                  const staffNetTotal = baseTotal != null && baseTotal > 0 && viewerIsStaff
                    ? roundMoney(getStaffNet(baseTotal))
                    : null;
                  return (
                    <>
                      {hasRate && (
                        <li className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-primary shrink-0" />
                          <span>{hourlyRate.toFixed(2)} MDL/hour</span>
                        </li>
                      )}
                      {!hasRate && job.estimatedSalary && (
                        <li className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-primary shrink-0" />
                          <span>{job.estimatedSalary}</span>
                        </li>
                      )}
                      {displayTotal != null && displayTotal > 0 && (
                        <li className="flex items-center gap-2 font-medium text-gray-900">
                          <Banknote className="w-4 h-4 text-primary shrink-0" />
                          <span>{t("dashboard.totalEstimated", "Total (estimated)")}: {displayTotal.toFixed(2)} MDL</span>
                        </li>
                      )}
                      {staffNetTotal != null && staffNetTotal > 0 && (
                        <li className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <span className="ml-6">{t("dashboard.afterTaxYouWillReceive", "After taxes are deducted, you will receive")} {staffNetTotal.toFixed(2)} {t("dashboard.currency", "MDL")}</span>
                        </li>
                      )}
                    </>
                  );
                })()}
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

              {/* Customer: "Angajatul a început lucrul la ora ..." and "Finished" */}
              {!viewerIsStaff && jobApplications.length > 0 && (() => {
                const accepted = jobApplications.filter((a) => a.status === "accepted");
                const inProcess = accepted.filter((a) => a.checkedInAt && !a.checkedOutAt);
                const anyCheckedOut = accepted.some((a) => a.checkedOutAt);
                const firstCheckedInAt = accepted.map((a) => a.checkedInAt).filter(Boolean)[0] as string | undefined;
                const hasStartedLine = !!firstCheckedInAt && (inProcess.length > 0 || anyCheckedOut);
                if (!hasStartedLine && !anyCheckedOut) return null;
                return (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {hasStartedLine && (
                      <p className="text-sm text-gray-700">
                        {t("dashboard.employeeStartedAt", "Angajatul a început lucrul la ora {{time}}.", { time: formatTimeFromIso(firstCheckedInAt!) })}
                      </p>
                    )}
                    {anyCheckedOut && (
                      <p className="text-sm font-medium text-green-700">{t("dashboard.finished")}</p>
                    )}
                  </div>
                );
              })()}
              </div>

              {/* Dates list - part of scrollable body */}
              <div className="px-4 pb-4">
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
                  dates.map((d, index) => {
                    const workDate = dateToYMD(d);
                    const session = workSessions.find((s) => normWorkDate(s.workDate) === workDate);
                    const loadingKey = myAppInfo ? `${myAppInfo.applicationId}-${workDate}` : "";
                    const loading = checkInOutLoading === loadingKey;
                    const isFirstDay = index === 0;
                    return (
                      <li
                        key={d.toISOString()}
                        className="flex flex-wrap items-center justify-between gap-2 py-4 px-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-gray-900 text-sm"
                      >
                        <span className="font-medium">
                          {formatDateLabel(d)}
                          {isFirstDay && (
                            <span className="ml-1.5 text-xs font-normal text-primary/80" title={t("dashboard.firstDay")}>
                              ({t("dashboard.firstDay")})
                            </span>
                          )}
                        </span>
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
    </div>
  );

  // Render modal to document.body via portal to avoid parent container positioning issues
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
