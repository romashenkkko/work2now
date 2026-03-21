import { useContext, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, getApplications, setApplications, JobTitleIcon, type Application, type JobRow } from "./DashboardLayout";
import { jobsApi, ratingsApi, authApi } from "../api/client";
import { MapPin, Calendar, User, Mail, Clock, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import StarRating from "../components/StarRating";
import StaffProfileModal from "../components/StaffProfileModal";
import DatePicker from "../components/DatePicker";

const DEFAULT_AVATAR = "/Illustration/AvatarWhiteGuy.png";

function ApplicantAvatar({ staffAvatar }: { staffAvatar?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = staffAvatar && !imgFailed ? staffAvatar : DEFAULT_AVATAR;
  useEffect(() => setImgFailed(false), [staffAvatar]);
  return (
    <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-primary/10 border border-gray-200">
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setImgFailed(true)}
      />
    </div>
  );
}

function getIsoDatePart(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value?: string): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("ro-RO");
  } catch {
    return value;
  }
}

function matchesDateFilter(filterDate: string, jobDate?: string, jobEndDate?: string, confirmedAt?: string): boolean {
  if (!filterDate) return true;
  if (confirmedAt && getIsoDatePart(confirmedAt) === filterDate) return true;
  if (!jobDate) return false;
  const start = getIsoDatePart(jobDate);
  const end = getIsoDatePart(jobEndDate || jobDate);
  if (!start) return false;
  return filterDate >= start && filterDate <= end;
}

function getJobIconId(jobTitle?: string, jobCategoryTitle?: string): string {
  if (!jobTitle && !jobCategoryTitle) return "waiter";
  const title = (jobCategoryTitle || jobTitle || "").toLowerCase();
  if (title.includes("barista")) return "barista";
  if (title.includes("bartender") || title.includes("barman")) return "bartender";
  if (title.includes("chef") || title.includes("bucatar")) return "chef";
  if (title.includes("cleaner") || title.includes("curatenie")) return "cleaner";
  if (title.includes("dishwasher") || title.includes("spalator")) return "dishwasher";
  if (title.includes("event") || title.includes("echipa")) return "eventcrew";
  if (title.includes("grocery") || title.includes("magazin")) return "grocery";
  if (title.includes("maintenance") || title.includes("intretinere")) return "maintenance";
  if (title.includes("receptionist") || title.includes("receptioner")) return "receptionist";
  if (title.includes("training")) return "trainingevent";
  if (title.includes("waiter") || title.includes("ospatar")) return "waiter";
  return "waiter";
}
type WorkDayInfo = {
  date: string;
  jobs: {
    appId: string;
    jobTitle: string;
    jobLocation?: string;
    customerName?: string;
    status: string;
    checkedInAt?: string;
    checkedOutAt?: string;
    createdAt?: string;
    ratingScore?: number;
  }[];
};

function buildWorkDaysMap(apps: StaffApplication[]): Map<string, WorkDayInfo> {
  const map = new Map<string, WorkDayInfo>();

  for (const a of apps) {
    if (a.status !== "accepted") continue;

    const dates = new Set<string>();
    if (a.workSessions?.length) {
      for (const s of a.workSessions) {
        const d = getIsoDatePart(s.workDate);
        if (d) dates.add(d);
      }
    }
    if (dates.size === 0 && a.jobDate) {
      const start = getIsoDatePart(a.jobDate);
      const end = getIsoDatePart(a.jobEndDate || a.jobDate);
      if (start) {
        const cur = new Date(start + "T00:00:00");
        const last = new Date((end || start) + "T00:00:00");
        while (cur <= last) {
          dates.add(formatYMD(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    for (const date of dates) {
      const session = a.workSessions?.find((s) => getIsoDatePart(s.workDate) === date);
      const entry = map.get(date) || { date, jobs: [] };
      entry.jobs.push({
        appId: a.id,
        jobTitle: a.jobTitle || `Job #${a.jobId}`,
        jobLocation: a.jobLocation,
        customerName: a.customerName,
        status: a.status,
        checkedInAt: session?.checkedInAt || (dates.size === 1 ? a.checkedInAt : undefined),
        checkedOutAt: session?.checkedOutAt || (dates.size === 1 ? a.checkedOutAt : undefined),
        createdAt: a.createdAt,
        ratingScore: a.ratingScore,
      });
      map.set(date, entry);
    }
  }
  return map;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimeOnly(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

const MONTHS_RO = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WDAYS_RO = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
const WDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function WorkCalendar({ apps, t, lang, open, onClose }: { apps: StaffApplication[]; t: (key: string, options?: any) => string; lang: string; open: boolean; onClose: () => void }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const workDays = buildWorkDaysMap(apps);

  const months = lang === "ro" ? MONTHS_RO : lang === "ru" ? MONTHS_RU : MONTHS_EN;
  const weekdays = lang === "ro" ? WDAYS_RO : lang === "ru" ? WDAYS_RU : WDAYS_EN;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: ({ empty: true } | { empty: false; day: number; date: Date; ymd: string })[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ empty: false, day: d, date, ymd: formatYMD(date) });
  }
  while (cells.length < totalCells) cells.push({ empty: true });

  const isToday = (d: Date) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const selectedInfo = selectedDate ? workDays.get(selectedDate) : null;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { onClose(); setSelectedDate(null); }} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide animate-in fade-in zoom-in-95">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-gray-900">{t("dashboard.workCalendar")}</h3>
          </div>
          <button
            type="button"
            onClick={() => { onClose(); setSelectedDate(null); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-semibold text-gray-800">
            {months[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekdays.map((w) => (
              <div key={w} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (cell.empty) return <div key={i} className="aspect-square" />;
              const hasWork = workDays.has(cell.ymd);
              const jobCount = workDays.get(cell.ymd)?.jobs.length ?? 0;
              const isSelected = selectedDate === cell.ymd;
              const isTodayCell = isToday(cell.date);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (hasWork) setSelectedDate(isSelected ? null : cell.ymd);
                  }}
                  className={[
                    "aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all relative",
                    isSelected
                      ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                      : hasWork
                        ? "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
                        : isTodayCell
                          ? "bg-primary/10 text-primary font-bold ring-1 ring-primary/20"
                          : "text-gray-600 hover:bg-gray-50",
                    !hasWork && !isTodayCell ? "cursor-default" : "",
                  ].join(" ")}
                >
                  {cell.day}
                  {hasWork && jobCount > 0 && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5 ${isSelected ? "opacity-80" : ""}`}>
                      {Array.from({ length: Math.min(jobCount, 3) }).map((_, idx) => (
                        <span key={idx} className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-green-600"}`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedInfo && selectedInfo.jobs.map((job, idx) => (
          <div key={idx} className="border-t border-gray-200 bg-gray-50/80 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <JobTitleIcon jobId={getJobIconId(job.jobTitle)} className="w-5 h-5 text-primary shrink-0" size={20} />
              <h4 className="text-sm font-bold text-gray-900">{job.jobTitle}</h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle2 className="w-3 h-3" />
                {t("dashboard.accepted")}
              </span>
            </div>

            <div className="text-xs text-gray-500 space-y-0.5">
              {job.jobLocation && (
                <p className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-primary shrink-0" />
                  {job.jobLocation}
                </p>
              )}
              {job.customerName && (
                <p><span className="text-gray-400">{t("dashboard.client")}:</span> {job.customerName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <h5 className="text-xs font-bold text-gray-700 mb-2">{t("dashboard.daysWorked")}</h5>
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <p className="text-sm font-semibold text-gray-900">
                    {(() => {
                      try {
                        return new Date(selectedInfo.date + "T00:00:00").toLocaleDateString(
                          lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "ro-RO",
                          { weekday: "short", day: "numeric", month: "short" }
                        );
                      } catch { return selectedInfo.date; }
                    })()}
                  </p>
                  {(job.checkedInAt || job.checkedOutAt) && (
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      {job.checkedInAt && <span>{t("dashboard.checkInStart")} {formatTimeOnly(job.checkedInAt)}</span>}
                      {job.checkedOutAt && <span>{t("dashboard.checkOutEnd")} {formatTimeOnly(job.checkedOutAt)}</span>}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-gray-700 mb-2">{t("dashboard.jobInfoDetails")}</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("dashboard.applicationId")}</span>
                    <span className="font-medium text-gray-900">{job.appId}</span>
                  </div>
                  {job.createdAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("dashboard.appliedAt")}</span>
                      <span className="font-medium text-gray-900">
                        {new Date(job.createdAt).toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "ro-RO")}
                      </span>
                    </div>
                  )}
                  {job.ratingScore != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t("dashboard.rating")}</span>
                      <span className="flex items-center gap-1">
                        <StarRating value={job.ratingScore} size={12} />
                        <span className="font-medium text-gray-900">{job.ratingScore}/5</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

type StaffApplication = {
  id: string;
  jobId: string;
  status: "pending" | "accepted" | "refused";
  createdAt?: string;

  // Job info (best case if backend returns it)
  jobTitle?: string;
  jobLocation?: string;
  jobDate?: string;
  jobEndDate?: string;

  // Employer/business info (optional)
  customerName?: string;

  // Work sessions / check-in/out info (optional)
  checkedInAt?: string;
  checkedOutAt?: string;
  workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];

  // Rating (optional)
  ratingScore?: number;
};

function statusBadge(t: (k: string) => string, status: "pending" | "accepted" | "refused") {
  const cls =
    status === "accepted"
      ? "bg-green-100 text-green-800"
      : status === "refused"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

  const label =
    status === "accepted"
      ? t("dashboard.accepted")
      : status === "refused"
        ? t("dashboard.refused")
        : t("dashboard.pending");

  const Icon =
    status === "accepted" ? CheckCircle2 : status === "refused" ? XCircle : Hourglass;

  return (
    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}



export default function DashboardAplicatii() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "ro").toLowerCase().split("-")[0];
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctx = useContext(DashboardContext);
  const jobsAdded = ctx?.jobsAdded ?? [];
  const refreshJobs = ctx?.refreshJobs ?? (() => {});
  const [applications, setApplicationsState] = useState<Record<string, Application[]>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [historyMounted, setHistoryMounted] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);
  const historyTimeoutRef = useRef<number | null>(null);
  const [historyJobFilter, setHistoryJobFilter] = useState("all");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyJobDropdownOpen, setHistoryJobDropdownOpen] = useState(false);
  const historyJobDropdownRef = useRef<HTMLDivElement | null>(null);

  /** Accept confirmation: show "Are you sure you want to accept [Name]?" before calling setStatus(accepted). */
  const [acceptConfirm, setAcceptConfirm] = useState<{ jobId: string; applicationId: string; staffName: string } | null>(null);

  /** Staff profile modal (reviews + experiences) when customer clicks avatar/name on an applicant. */
  const [staffProfileModal, setStaffProfileModal] = useState<{
    staffId: string;
    staffName?: string;
    staffEmail?: string;
    staffAvatar?: string;
    /** ID aplicație finalizată, nerată – pentru butonul „Lasă recenzie”. */
    applicationId?: string;
  } | null>(null);

  /** După „Lasă recenzie” din modal: scroll la acest application și focus pe comentariu. */
  const [expandReviewApplicationId, setExpandReviewApplicationId] = useState<string | null>(null);
  const reviewCommentRef = useRef<HTMLTextAreaElement | null>(null);

  // Staff view: flat list of my applications
  const [myApps, setMyApps] = useState<StaffApplication[]>([]);
  const [myAppsLoading, setMyAppsLoading] = useState(false);
  const [myAppsError, setMyAppsError] = useState<string | null>(null);

  const refreshCustomerApplications = () => {
    if (user?.role !== "customer") return;
    jobsApi
      .applications()
      .then((r) => {
        const map: Record<string, Application[]> = {};
        Object.keys(r.applications || {}).forEach((rawJobId) => {
          const jobId = String(rawJobId ?? "").trim();
          if (!jobId) return;
          map[jobId] = (r.applications![rawJobId] || []).map((a: Record<string, unknown>) => {
            const rawAvatar = a.staffAvatar ?? a.staff_avatar;
            const staffAvatar =
              typeof rawAvatar === "string" && rawAvatar.trim() ? rawAvatar.trim() : undefined;
            return {
              id: a.id as string,
              jobId: a.jobId as string,
              staffId: a.staffId as string,
              staffName: a.staffName as string,
              staffEmail: a.staffEmail as string | undefined,
              staffAvatar,
              staffCvFileUrl: (a.staffCvFileUrl as string | undefined) ?? undefined,
              staffCvOriginalName: (a.staffCvOriginalName as string | undefined) ?? undefined,
              status: a.status as "pending" | "accepted" | "refused",
              checkedInAt: a.checkedInAt as string | undefined,
              checkedOutAt: a.checkedOutAt as string | undefined,
              businessConfirmedAt: (a.businessConfirmedAt as string | undefined) ?? undefined,
              isBusinessConfirmed: !!(a.isBusinessConfirmed ?? (a.businessConfirmedAt != null && String(a.businessConfirmedAt).trim() !== "")),
              workSessions: Array.isArray(a.workSessions)
                ? (a.workSessions as { workDate: string; checkedInAt?: string; checkedOutAt?: string }[])
                : undefined,
              ratingScore: a.ratingScore != null ? Number(a.ratingScore) : undefined,
            };
          });
        });
        setApplicationsState(map);
      })
      .catch(() => setApplicationsState(getApplications()));
  };

  const refreshStaffApplications = async () => {
    if (user?.role !== "staff") return;
    setMyAppsLoading(true);
    setMyAppsError(null);
    try {
      const r = await jobsApi.myApplicationsList();
      const list = Array.isArray(r?.applications) ? r.applications : [];
  
      const normalized: StaffApplication[] = list.map((a: any) => ({
        id: String(a.id ?? ""),
        jobId: String(a.jobId ?? ""),
        status: (a.status ?? "pending") as "pending" | "accepted" | "refused",
        createdAt: a.createdAt,
  
        jobTitle: a.jobTitle,
        jobLocation: a.jobLocation,
        jobDate: a.jobDate,
        jobEndDate: a.jobEndDate,
  
        customerName: a.customerName,
  
        checkedInAt: a.checkedInAt,
        checkedOutAt: a.checkedOutAt,
        workSessions: Array.isArray(a.workSessions) ? a.workSessions : undefined,
  
        ratingScore: a.ratingScore != null ? Number(a.ratingScore) : undefined,
      }));
  
      setMyApps(normalized);
    } catch (e) {
      setMyAppsError((e as Error)?.message || "Failed to load applications");
      setMyApps([]);
    } finally {
      setMyAppsLoading(false);
    }
  };
  

  useEffect(() => {
    if (!user?.role) return;
    if (user.role === "customer") refreshCustomerApplications();
    if (user.role === "staff") refreshStaffApplications();
    // if admin or other role -> do nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.id]);

  /** La venire de pe Joburi cu „Lasă recenzie”: expand id din state și derulează la formular. */
  useEffect(() => {
    const id = (location.state as { expandReviewApplicationId?: string } | null)?.expandReviewApplicationId;
    if (id) {
      setExpandReviewApplicationId(id);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (historyTimeoutRef.current !== null) {
      window.clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }

    if (showHistory) {
      setHistoryMounted(true);
      setHistoryClosing(false);
      return;
    }

    if (historyMounted) {
      setHistoryClosing(true);
      historyTimeoutRef.current = window.setTimeout(() => {
        setHistoryMounted(false);
        setHistoryClosing(false);
        historyTimeoutRef.current = null;
      }, 420);
    }
  }, [showHistory, historyMounted]);

  useEffect(() => {
    return () => {
      if (historyTimeoutRef.current !== null) {
        window.clearTimeout(historyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!historyJobDropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (historyJobDropdownRef.current && !historyJobDropdownRef.current.contains(target)) {
        setHistoryJobDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [historyJobDropdownOpen]);

  /** După „Lasă recenzie” din modal: scroll la formularul de review și focus pe comentariu. */
  useEffect(() => {
    if (!expandReviewApplicationId) return;
    const el = document.getElementById(`review-form-${expandReviewApplicationId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const tId = setTimeout(() => {
      reviewCommentRef.current?.focus();
      setExpandReviewApplicationId(null);
    }, 400);
    return () => clearTimeout(tId);
  }, [expandReviewApplicationId]);

  const [confirmingCompletionId, setConfirmingCompletionId] = useState<string | null>(null);
  const [confirmCompletionPrompt, setConfirmCompletionPrompt] = useState<{ applicationId: string } | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null);
  const [ratingDraft, setRatingDraft] = useState<Record<string, { score: number; comment: string }>>({});

  const confirmCompletion = (applicationId: string) => {
    setConfirmingCompletionId(applicationId);
    jobsApi
      .confirmCompletion(applicationId)
      .then(() => {
        const confirmedAtIso = new Date().toISOString();
        // Update local state instantly so the confirmed timestamp appears without waiting for a refetch.
        setApplicationsState((prev) => {
          const next: Record<string, Application[]> = {};
          Object.entries(prev).forEach(([jobId, list]) => {
            next[jobId] = list.map((item) =>
              item.id === applicationId
                ? { ...item, businessConfirmedAt: item.businessConfirmedAt ?? confirmedAtIso, isBusinessConfirmed: true }
                : item
            );
          });
          return next;
        });
        refreshCustomerApplications();
        refreshJobs();
      })
      .finally(() => setConfirmingCompletionId(null));
  };

  const submitRating = (applicationId: string, score: number, comment?: string) => {
    setRatingSubmitting(applicationId);
    ratingsApi
      .submit(applicationId, score, comment)
      .then(() => {
        setRatingDraft((prev) => {
          const next = { ...prev };
          delete next[applicationId];
          return next;
        });
        if (user?.role === "customer") {
          refreshCustomerApplications();
        } else if (user?.role === "staff") {
          refreshStaffApplications();
        }
      })
      .finally(() => setRatingSubmitting(null));
  };

  const setStatus = (jobId: string, applicationId: string, status: "accepted" | "refused") => {
    setAcceptConfirm(null);
    jobsApi
      .setApplicationStatus(applicationId, status)
      .then(() => {
        if (user?.role === "customer") {
          refreshCustomerApplications();
        }
        refreshCustomerApplications();
        refreshJobs();
      })
      .catch(() => {
        const app = getApplications();
        const list = app[jobId] || [];
        const next = list.map((a) => (a.id === applicationId ? { ...a, status } : a));
        app[jobId] = next;
        setApplications(app);
        setApplicationsState((prev) => ({ ...prev, [jobId]: next }));
      });
  };

  const isCustomer = user?.role === "customer";
  const isStaff = user?.role === "staff";
  const myJobs = isCustomer ? jobsAdded : [];
  const customerApplicationsByJob = myJobs.map((job) => {
    const jobKey = String(job?.id ?? "").trim();
    const allApplicants = applications[jobKey] || [];
    const activeApplicants = allApplicants.filter((a) => a.staffId && !a.businessConfirmedAt && !a.isBusinessConfirmed);
    const historyApplicants = allApplicants.filter((a) => a.staffId && (a.businessConfirmedAt || a.isBusinessConfirmed));
    return { job, activeApplicants, historyApplicants };
  });

  // -----------------------------
  // STAFF VIEW (MY APPLICATIONS)
  // -----------------------------
  if (isStaff) {
    const sorted = [...myApps].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const [calendarOpen, setCalendarOpen] = useState(false);

    return (
      <>
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.aplicatii")}</h1>
            <p className="text-gray-600">{t("dashboard.myApplications")}</p>
          </div>
          {!myAppsLoading && sorted.length > 0 && (
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-700 hover:border-primary hover:text-primary hover:shadow-md transition-all text-sm font-medium"
            >
              <Calendar className="w-4.5 h-4.5" />
              {t("dashboard.workCalendar")}
            </button>
          )}
        </header>

        <WorkCalendar apps={sorted} t={t} lang={lang} open={calendarOpen} onClose={() => setCalendarOpen(false)} />

        {myAppsLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t("profile.branches.loading") || "Loading..."}</p>
          </div>
        ) : myAppsError ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-red-600">{myAppsError}</p>
            <p className="text-gray-500 mt-2">
              If this keeps happening, ensure backend has an endpoint for staff applications (ex: <code>/api/jobs/my-applications</code>).
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t("dashboard.staffNoApplicationsYet")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <JobTitleIcon jobId={getJobIconId(a.jobTitle)} className="w-5 h-5 text-primary shrink-0" size={20} />
                  <h3 className="font-semibold text-gray-900">{a.jobTitle || `Job #${a.jobId}`}</h3>
                  {statusBadge(t, a.status)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  {a.jobLocation && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      {a.jobLocation}
                    </span>
                  )}
                  {a.jobDate && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      {a.jobDate}{a.jobEndDate && a.jobEndDate !== a.jobDate ? ` – ${a.jobEndDate}` : ""}
                    </span>
                  )}
                  {a.customerName && (
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      {a.customerName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // -----------------------------
  // CUSTOMER VIEW (APPLICANTS)
  // -----------------------------
  if (!isCustomer && !isStaff) {
    return (
      <>
        <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.aplicatii")}</h1>
          <p className="text-gray-500 text-sm mt-1.5 max-w-md">{t("dashboard.myApplications")}</p>
        </header>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500">{t("dashboard.staffNoApplicationsYet")}</p>
        </div>
      </>
    );
  }

  const jobsWithApplicants = customerApplicationsByJob
    .map(({ job, activeApplicants }) => ({ job, applicants: activeApplicants }))
    .filter(({ applicants }) => applicants.length > 0);

  const historyJobOptions = customerApplicationsByJob
    .filter(({ historyApplicants }) => historyApplicants.length > 0)
    .map(({ job }) => ({ id: String(job.id ?? ""), title: job.job }));
  const selectedHistoryJobLabel =
    historyJobFilter === "all"
      ? t("dashboard.allJobs", "Toate joburile")
      : historyJobOptions.find((job) => job.id === historyJobFilter)?.title ?? t("dashboard.allJobs", "Toate joburile");

  const jobsWithHistory = customerApplicationsByJob
    .filter(({ job, historyApplicants }) => {
      if (historyApplicants.length === 0) return false;
      if (historyJobFilter !== "all" && String(job.id ?? "") !== historyJobFilter) return false;
      if (!historyDateFilter) return true;
      return historyApplicants.some((a) => matchesDateFilter(historyDateFilter, job.date, job.endDate, a.businessConfirmedAt));
    })
    .map(({ job, historyApplicants }) => ({
      job,
      applicants: [...historyApplicants].sort((a, b) => {
        const ta = a.businessConfirmedAt ? new Date(a.businessConfirmedAt).getTime() : 0;
        const tb = b.businessConfirmedAt ? new Date(b.businessConfirmedAt).getTime() : 0;
        return tb - ta;
      }),
    }));

  const acceptConfirmModal = acceptConfirm && createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-labelledby="accept-confirm-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 id="accept-confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
          {t("dashboard.confirmAcceptTitle")}
        </h3>
        <p className="text-gray-600 mb-4">
          {t("dashboard.confirmAcceptMessage", { name: acceptConfirm.staffName })}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setAcceptConfirm(null)}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            {t("dashboard.reject")}
          </button>
          <button
            type="button"
            onClick={() => setStatus(acceptConfirm.jobId, acceptConfirm.applicationId, "accepted")}
            className="px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700"
          >
            {t("dashboard.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  const confirmCompletionModal = confirmCompletionPrompt && createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-labelledby="completion-confirm-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 id="completion-confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
          {t("dashboard.confirmFinished")}
        </h3>
        <p className="text-gray-600 mb-4">
          {t("dashboard.confirmCheckoutPrompt", "Sunteți sigur că doriți să confirmați checkout-ul?")}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setConfirmCompletionPrompt(null)}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            {t("dashboard.reject")}
          </button>
          <button
            type="button"
            onClick={() => {
              confirmCompletion(confirmCompletionPrompt.applicationId);
              setConfirmCompletionPrompt(null);
            }}
            className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark"
          >
            {t("dashboard.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {acceptConfirmModal}
      {confirmCompletionModal}

      <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.aplicatii")}</h1>
            <p className="text-gray-500 text-sm mt-1.5 max-w-md">{t("dashboard.applicationsSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-300 ${
              showHistory
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-primary/20 bg-white text-primary hover:bg-primary/5"
            }`}
          >
            <Clock className="h-4 w-4" />
            {showHistory ? t("dashboard.hideHistory", "Ascunde history") : t("dashboard.history", "History")}
          </button>
        </div>
      </header>

      {historyMounted && (
        <section className={`${historyClosing ? "history-panel-exit" : "history-panel-enter"} mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t("dashboard.historyTitle", "Istoric aplicații")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("dashboard.historySubtitle", "Poți filtra aplicațiile finalizate după job sau dată.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker
                name="history-date"
                label={t("dashboard.date")}
                value={historyDateFilter}
                onChange={setHistoryDateFilter}
                disablePastDates={false}
                className="block [&_.date-picker-trigger]:h-12 [&_.date-picker-trigger]:px-4 [&_.date-picker-trigger]:py-3 [&_.date-picker-trigger]:text-base"
              />
              <div className="block" ref={historyJobDropdownRef}>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{t("dashboard.job")}</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHistoryJobDropdownOpen((open) => !open)}
                    className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-[rgba(224,216,247,0.9)] bg-white px-4 py-3 text-left text-base font-medium text-gray-800 shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-[rgba(177,163,241,0.6)] hover:bg-[rgba(250,248,255,0.8)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    aria-expanded={historyJobDropdownOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="truncate">{selectedHistoryJobLabel}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-gray-500 transition-transform duration-200 ${historyJobDropdownOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {historyJobDropdownOpen && (
                    <ul
                      role="listbox"
                      className="dropdown-open-anim absolute left-0 top-full z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-[rgba(224,216,247,0.9)] bg-white py-1.5 shadow-[0_10px_40px_rgba(122,99,241,0.12)]"
                    >
                      <li role="option" aria-selected={historyJobFilter === "all"}>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryJobFilter("all");
                            setHistoryJobDropdownOpen(false);
                          }}
                          className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors duration-150 ${
                            historyJobFilter === "all"
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-gray-700 hover:bg-[rgba(250,248,255,0.9)] hover:text-gray-900"
                          }`}
                        >
                          {t("dashboard.allJobs", "Toate joburile")}
                        </button>
                      </li>
                      {historyJobOptions.map((job) => {
                        const isSelected = historyJobFilter === job.id;
                        return (
                          <li key={job.id} role="option" aria-selected={isSelected}>
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryJobFilter(job.id);
                                setHistoryJobDropdownOpen(false);
                              }}
                              className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors duration-150 ${
                                isSelected
                                  ? "bg-primary/10 font-semibold text-primary"
                                  : "text-gray-700 hover:bg-[rgba(250,248,255,0.9)] hover:text-gray-900"
                              }`}
                            >
                              <span className="truncate">{job.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            {jobsWithHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                {t("dashboard.noHistoryApplications", "Nu există aplicații în history pentru filtrele alese.")}
              </div>
            ) : (
              <div className={`${historyClosing ? "" : "history-stagger"} space-y-4`}>
                {jobsWithHistory.map(({ job, applicants }: { job: JobRow; applicants: Application[] }) => (
                  <section
                    key={`history-${job.id}`}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/50"
                  >
                    <div className="border-b border-gray-200 bg-white p-4 sm:p-5">
                      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <JobTitleIcon jobId={getJobIconId(job.job, job.jobCategoryTitle)} className="w-5 h-5 text-primary shrink-0" size={20} />
                        {job.job}
                      </h3>
                      {job.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{job.location}</span>
                        </p>
                      )}
                      {job.date && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                          <Calendar className="w-4 h-4 shrink-0" />
                          {job.date}
                          {job.endDate && job.endDate !== job.date ? ` – ${job.endDate}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="p-4 sm:p-5">
                      <ul className="space-y-3">
                        {applicants.map((a) => (
                          <li
                            key={`history-${a.id}`}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <ApplicantAvatar staffAvatar={a.staffAvatar} />
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900">{a.staffName}</p>
                                  {a.staffEmail && (
                                    <p className="flex items-center gap-1 text-sm text-gray-600">
                                      <Mail className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{a.staffEmail}</span>
                                    </p>
                                  )}
                                  {a.staffCvFileUrl && a.staffId && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(authApi.getCvUrl(a.staffId), "_blank");
                                      }}
                                      className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      {t("dashboard.viewCv")}
                                    </button>
                                  )}
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      {t("dashboard.finished")}
                                    </span>
                                    {a.businessConfirmedAt && (
                                      <span className="text-xs text-gray-500">
                                        {t("dashboard.completedAt", "Finalizat la")} {formatDateTime(a.businessConfirmedAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {a.ratingScore != null && (
                                <span className="flex items-center gap-1 text-sm text-gray-600">
                                  {t("dashboard.rated")}:
                                  <StarRating value={a.ratingScore} size={16} />
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {!showHistory && !historyMounted && (jobsWithApplicants.length === 0 ? (
        <div className="history-return-enter bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500">{t("dashboard.customerNoIncomingApplications")}</p>
        </div>
      ) : (
        <div className="history-return-enter">
          <div className="history-return-stagger space-y-6">
          {jobsWithApplicants.map(({ job, applicants }: { job: JobRow; applicants: Application[] }) => {
            const needed = parseInt(String(job.peopleNeeded ?? "1"), 10) || 1;
            const acceptedFromApi = job.acceptedCount ?? 0;
            const acceptedFromList = applicants.filter((a) => a.status === "accepted").length;
            const acceptedCount = Math.max(acceptedFromApi, acceptedFromList);
            const isFull = acceptedCount >= needed;
            return (
            <section
              key={job.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <JobTitleIcon jobId={getJobIconId(job.job, job.jobCategoryTitle)} className="w-5 h-5 text-primary shrink-0" size={20} />
                  {job.job}
                </h2>
                {job.location && (
                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </p>
                )}
                {job.date && (
                  <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 shrink-0" />
                    {job.date}
                    {job.endDate && job.endDate !== job.date ? ` – ${job.endDate}` : ""}
                  </p>
                )}
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {t("dashboard.applicants")} ({applicants.length}) — {acceptedCount}/{needed}
                </h3>
                <ul className="space-y-3">
                  {applicants.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {a.staffId ? (
                          <button
                            type="button"
                            onClick={() => setStaffProfileModal({
                              staffId: a.staffId!,
                              staffName: a.staffName,
                              staffEmail: a.staffEmail,
                              staffAvatar: a.staffAvatar,
                              applicationId: a.checkedOutAt && a.ratingScore == null ? a.id : undefined,
                            })}
                            className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                            aria-label={t("dashboard.viewProfile", "Vezi profil")}
                          >
                            <ApplicantAvatar staffAvatar={a.staffAvatar} />
                          </button>
                        ) : (
                          <ApplicantAvatar staffAvatar={a.staffAvatar} />
                        )}
                        <div className="min-w-0">
                          {a.staffId ? (
                            <button
                              type="button"
                              onClick={() => setStaffProfileModal({
                                staffId: a.staffId!,
                                staffName: a.staffName,
                                staffEmail: a.staffEmail,
                                staffAvatar: a.staffAvatar,
                                applicationId: a.checkedOutAt && a.ratingScore == null ? a.id : undefined,
                              })}
                              className="text-left font-medium text-gray-900 hover:text-primary focus:outline-none focus:ring-0"
                            >
                              {a.staffName}
                            </button>
                          ) : (
                            <p className="font-medium text-gray-900">{a.staffName}</p>
                          )}
                          {a.staffEmail && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{a.staffEmail}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {a.staffCvFileUrl && a.staffId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(authApi.getCvUrl(a.staffId), "_blank");
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {t("dashboard.viewCv")}
                              </button>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                a.status === "accepted"
                                  ? "bg-green-100 text-green-800"
                                  : a.status === "refused"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {a.status === "accepted"
                                ? t("dashboard.accepted")
                                : a.status === "refused"
                                  ? t("dashboard.refused")
                                  : t("dashboard.pending")}
                            </span>
                          </div>

                          {a.status === "accepted" && a.checkedOutAt && (
                            <div className="mt-2 space-y-2">
                              {!a.businessConfirmedAt && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCompletionPrompt({ applicationId: a.id })}
                                    disabled={confirmingCompletionId === a.id}
                                    className="inline-flex items-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
                                  >
                                    {confirmingCompletionId === a.id ? "..." : t("dashboard.confirmFinished")}
                                  </button>
                                </div>
                              )}
                              {a.businessConfirmedAt && (
                                <p className="text-sm text-gray-600">
                                  {t("dashboard.checkoutConfirmedAt", "Checkout confirmat la")}: {formatDateTime(a.businessConfirmedAt)}
                                </p>
                              )}
                              {a.ratingScore != null ? (
                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                  {t("dashboard.rated")}:
                                  <StarRating value={a.ratingScore} size={16} />
                                </span>
                              ) : (
                                <div id={`review-form-${a.id}`}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-gray-600">{t("dashboard.rateWork")}:</span>
                                    <StarRating
                                      value={ratingDraft[a.id]?.score ?? 0}
                                      editable
                                      onSelect={(score) => setRatingDraft((prev) => ({ ...prev, [a.id]: { ...prev[a.id], score } }))}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mt-1">{t("dashboard.commentOptional")}</label>
                                    <textarea
                                      ref={expandReviewApplicationId === a.id ? reviewCommentRef : undefined}
                                      rows={2}
                                      value={ratingDraft[a.id]?.comment ?? ""}
                                      onChange={(e) => setRatingDraft((prev) => ({ ...prev, [a.id]: { ...(prev[a.id] ?? { score: 0 }), comment: e.target.value.slice(0, 2000) } }))}
                                      className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base"
                                      placeholder={t("dashboard.commentOptional")}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500">{t("dashboard.photoOptional")}</p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={!((ratingDraft[a.id]?.score ?? 0) >= 0.5) || ratingSubmitting === a.id}
                                      onClick={() => submitRating(a.id, ratingDraft[a.id]?.score ?? 1, ratingDraft[a.id]?.comment?.trim() || undefined)}
                                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      {ratingSubmitting === a.id ? "..." : t("dashboard.submitReview", "Trimite review")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {a.status === "pending" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            disabled={isFull}
                            onClick={() => job.id && (isFull ? undefined : setAcceptConfirm({ jobId: job.id, applicationId: a.id, staffName: a.staffName || t("dashboard.applicant") }))}
                            className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("dashboard.accept")}
                          </button>
                          <button
                            type="button"
                            onClick={() => job.id && setStatus(job.id, a.id, "refused")}
                            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                          >
                            {t("dashboard.refuse")}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
          })}
          </div>
        </div>
      ))}

      {staffProfileModal && (
        <StaffProfileModal
          open={!!staffProfileModal}
          onClose={() => setStaffProfileModal(null)}
          staffId={staffProfileModal.staffId}
          staffName={staffProfileModal.staffName}
          staffEmail={staffProfileModal.staffEmail}
          staffAvatar={staffProfileModal.staffAvatar}
          currentUserId={user?.id != null ? String(user.id) : undefined}
          applicationIdForReview={staffProfileModal.applicationId}
          onReviewSubmitted={() => {
            refreshCustomerApplications();
          }}
        />
      )}
    </>
  );
}
