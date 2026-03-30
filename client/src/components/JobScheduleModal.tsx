import { useMemo, useState, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { JobRow } from "../pages/DashboardLayout";
import {
  Briefcase,
  Clock,
  MapPin,
  Calendar,
  Banknote,
  Users,
  AlertTriangle,
  Share2,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import { resolveApiAssetUrl } from "../api/client";
import { getBusinessTotal, getStaffNet, roundMoney } from "../utils/salary";
import { geocodeAddress } from "../utils/geocodeAddress";
import JobDetailLocationMap from "./JobDetailLocationMap";

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
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState<number | null>(null);
  const [jobPin, setJobPin] = useState<[number, number] | null>(null);
  const [jobMapOverlay, setJobMapOverlay] = useState<null | "loading" | "no-token" | "fail">(null);

  const galleryUrls = useMemo(
    () => (job?.galleryImageUrls ?? []).filter((u) => typeof u === "string" && u.trim() !== ""),
    [job?.galleryImageUrls]
  );

  const jobAttachmentItems = useMemo(() => {
    const raw = job?.jobAttachments;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (a): a is { url: string; name: string } =>
        !!a && typeof a === "object" && typeof (a as { url?: string }).url === "string" && (a as { url: string }).url.trim() !== ""
    );
  }, [job?.jobAttachments]);

  useEffect(() => {
    if (galleryLightboxIndex == null) return;
    const n = galleryUrls.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGalleryLightboxIndex(null);
        return;
      }
      if (n <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setGalleryLightboxIndex((i) => {
          if (i == null) return null;
          return i <= 0 ? n - 1 : i - 1;
        });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setGalleryLightboxIndex((i) => {
          if (i == null) return null;
          return i >= n - 1 ? 0 : i + 1;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryLightboxIndex, galleryUrls.length]);

  useEffect(() => {
    if (!open) {
      setGalleryLightboxIndex(null);
      setJobPin(null);
      setJobMapOverlay(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !job) return;

    const lat = job.checkInLat;
    const lng = job.checkInLng;
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      setJobPin([lat, lng]);
      setJobMapOverlay(null);
      return;
    }

    const addr = job.location?.trim();
    if (!addr) {
      setJobPin(null);
      setJobMapOverlay(null);
      return;
    }

    const token = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "").trim();
    if (!token) {
      setJobPin(null);
      setJobMapOverlay("no-token");
      return;
    }

    setJobMapOverlay("loading");
    setJobPin(null);
    let cancelled = false;
    geocodeAddress(addr, token).then((c) => {
      if (cancelled) return;
      if (c) {
        setJobPin(c);
        setJobMapOverlay(null);
      } else {
        setJobPin(null);
        setJobMapOverlay("fail");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, job?.id, job?.location, job?.checkInLat, job?.checkInLng]);

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

  const showJobMapColumn =
    !!job &&
    (!!job.location?.trim() ||
      (typeof job.checkInLat === "number" &&
        typeof job.checkInLng === "number" &&
        Number.isFinite(job.checkInLat) &&
        Number.isFinite(job.checkInLng)));

  const backdropStyle =
    job?.imageUrl != null && String(job.imageUrl).trim() !== ""
      ? {
          backgroundImage: `linear-gradient(rgba(12, 8, 32, 0.88), rgba(12, 8, 32, 0.92)), url(${job.imageUrl})`,
          backgroundSize: "cover" as const,
          backgroundPosition: "center" as const,
        }
      : undefined;

  if (!open) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 modal-overlay-enter ${backdropStyle ? "" : "bg-black/50"}`}
      style={backdropStyle}
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col modal-content-enter"
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

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {job && (
            <>
              <div className="p-4 pb-2">
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
              <ul className="min-w-0 flex-1 space-y-2.5 text-sm text-gray-600">
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
              {showJobMapColumn && (
                <aside
                  className="flex h-48 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-100 sm:h-52 lg:h-auto lg:min-h-[13rem] lg:max-h-[24rem] lg:w-[min(100%,17rem)] lg:shrink-0 xl:w-[18.5rem]"
                  aria-label={t("dashboard.jobDetailMapTitle")}
                >
                  {jobMapOverlay === "loading" && (
                    <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-600">
                      {t("dashboard.jobDetailMapLoading")}
                    </div>
                  )}
                  {jobMapOverlay === "no-token" && (
                    <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-gray-600">
                      {t("dashboard.jobDetailMapNoToken")}
                    </div>
                  )}
                  {jobMapOverlay === "fail" && (
                    <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-600">
                      {t("dashboard.jobDetailMapGeocodeFail")}
                    </div>
                  )}
                  {jobMapOverlay === null && jobPin && (
                    <JobDetailLocationMap lat={jobPin[0]} lng={jobPin[1]} className="h-full min-h-[11rem] w-full flex-1" />
                  )}
                </aside>
              )}
              </div>
              {jobAttachmentItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">{t("dashboard.jobDetailAttachmentsTitle")}</h4>
                  <ul className="space-y-2">
                    {jobAttachmentItems.map((att, idx) => {
                      const label =
                        typeof att.name === "string" && att.name.trim() ? att.name.trim() : att.url.split("/").pop() || att.url;
                      return (
                        <li key={`${att.url}-${idx}`}>
                          <a
                            href={resolveApiAssetUrl(att.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline break-all"
                          >
                            <FileText className="w-4 h-4 shrink-0 text-primary" aria-hidden />
                            <span>{label}</span>
                            <span className="text-xs font-normal text-gray-500">({t("dashboard.jobAttachmentOpen")})</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {galleryUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1.5">{t("dashboard.jobGalleryModalTitle")}</h4>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {galleryUrls.map((src, i) => (
                      <button
                        key={`${i}-${src}`}
                        type="button"
                        className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-md overflow-hidden border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
                        onClick={() => setGalleryLightboxIndex(i)}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
    </div>
  );

  const lightboxOpen = galleryLightboxIndex != null && galleryUrls.length > 0;
  const lightboxSrc =
    lightboxOpen && galleryLightboxIndex != null ? galleryUrls[galleryLightboxIndex] ?? null : null;
  const canGalleryNav = galleryUrls.length > 1;

  const goGalleryPrev = (e?: MouseEvent) => {
    e?.stopPropagation();
    setGalleryLightboxIndex((i) => {
      if (i == null) return null;
      const n = galleryUrls.length;
      if (n <= 1) return i;
      return i <= 0 ? n - 1 : i - 1;
    });
  };

  const goGalleryNext = (e?: MouseEvent) => {
    e?.stopPropagation();
    setGalleryLightboxIndex((i) => {
      if (i == null) return null;
      const n = galleryUrls.length;
      if (n <= 1) return i;
      return i >= n - 1 ? 0 : i + 1;
    });
  };

  const lightbox =
    lightboxOpen && lightboxSrc ? (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3 sm:p-8"
        onClick={() => setGalleryLightboxIndex(null)}
        role="dialog"
        aria-modal="true"
        aria-label={t("dashboard.jobGalleryModalTitle")}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setGalleryLightboxIndex(null);
          }}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label={t("dashboard.close")}
        >
          <X className="w-6 h-6" />
        </button>

        {canGalleryNav && (
          <button
            type="button"
            onClick={goGalleryPrev}
            className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            aria-label={t("dashboard.galleryPrev")}
          >
            <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={2} />
          </button>
        )}
        {canGalleryNav && (
          <button
            type="button"
            onClick={goGalleryNext}
            className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            aria-label={t("dashboard.galleryNext")}
          >
            <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={2} />
          </button>
        )}

        <div
          className="flex max-h-[90vh] max-w-[min(100vw-5rem,1200px)] flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl select-none"
            draggable={false}
          />
          {canGalleryNav && galleryLightboxIndex != null && (
            <p className="mt-3 text-sm font-medium text-white/90 tabular-nums">
              {galleryLightboxIndex + 1} / {galleryUrls.length}
            </p>
          )}
        </div>
      </div>
    ) : null;

  // Render modal to document.body via portal to avoid parent container positioning issues
  if (typeof document === "undefined") return null;
  return (
    <>
      {createPortal(modalContent, document.body)}
      {lightbox ? createPortal(lightbox, document.body) : null}
    </>
  );
}
