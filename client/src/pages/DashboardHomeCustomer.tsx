import { useState, useContext, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext } from "./DashboardLayout";
import { jobsApi } from "../api/client";
import StarRating from "../components/StarRating";

type ReportPeriod = "week" | "month" | "year";

function hoursBetween(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.max(0, (b - a) / (1000 * 60 * 60));
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function formatDateLabel(t: (key: string) => string, ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  const weekday = WEEKDAY_KEYS[d.getDay()];
  const day = d.getDate();
  const month = MONTH_KEYS[d.getMonth()];
  return `${t(`dashboard.weekdayShort.${weekday}`)}, ${day} ${t(`dashboard.monthShort.${month}`)}`;
}

const MONTH_NAMES_LONG = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"] as const;
const WEEKDAY_HEADERS = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"] as const;

/** Returnează zilele pentru grid calendar (lună): prima zi e Luni, goluri la început. */
function getCalendarDaysForMonth(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = (first.getDay() + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

/** Lista de zile (YMD) între date și endDate (inclusive). Dacă endDate lipsește, returnează doar [date]. */
function getScheduledDates(dateYmd: string, endDateYmd?: string): string[] {
  const start = new Date(dateYmd + "T12:00:00");
  if (!endDateYmd || endDateYmd === dateYmd) return [dateYmd];
  const end = new Date(endDateYmd + "T12:00:00");
  if (end < start) return [dateYmd];
  const out: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    out.push(toYMD(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const STATS_ICONS = {
  applications: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  rating: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
};

type AppWithSessions = { status: string; staffId?: string; staffName?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] };

export default function DashboardHomeCustomer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openPostJobModal, jobsAdded, removeJob } = useContext(DashboardContext);
  const [toast, setToast] = useState<string | null>(null);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, AppWithSessions[]>>({});
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("week");
  const [selectedJobIdForReport, setSelectedJobIdForReport] = useState<string | null>(null);
  const [selectedDateForReport, setSelectedDateForReport] = useState<string | null>(null);
  const [selectedStaffIdForReport, setSelectedStaffIdForReport] = useState<string | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const [calendarViewMonth, setCalendarViewMonth] = useState(0);
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear());
  const [animatingDay, setAnimatingDay] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedJobIdForReport || jobsAdded.length === 0) return;
    const job = jobsAdded.find((j, i) => ("id" in j && j.id != null ? String(j.id) : `job-${i}`) === selectedJobIdForReport) as { date?: string; endDate?: string } | undefined;
    const dateStr = (job?.date || "").trim();
    if (dateStr) {
      const d = new Date(dateStr + "T12:00:00");
      if (!isNaN(d.getTime())) {
        setCalendarViewMonth(d.getMonth());
        setCalendarViewYear(d.getFullYear());
      }
    }
  }, [selectedJobIdForReport, jobsAdded]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target as Node)) setJobDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchApplications = useCallback(() => {
    jobsApi
      .applications()
      .then((r) => {
        const map: Record<string, AppWithSessions[]> = {};
        Object.entries(r.applications ?? {}).forEach(([jobId, list]) => {
          map[jobId] = (list || []).map((a) => ({
            status: a.status,
            staffId: a.staffId ?? "",
            staffName: a.staffName ?? "",
            workSessions: a.workSessions ?? [],
          }));
        });
        setApplicationsByJob(map);
      })
      .catch(() => setApplicationsByJob({}));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchApplications();
  }, [user?.id, fetchApplications]);

  // Reîncarcă aplicațiile (inclusiv workSessions/check-in) când customer selectează un job pentru raport
  useEffect(() => {
    if (!selectedJobIdForReport || !user?.id) return;
    fetchApplications();
  }, [selectedJobIdForReport, user?.id, fetchApplications]);

  // La revenirea pe tab, reîncarcă datele raportului dacă e selectat un job
  useEffect(() => {
    if (!selectedJobIdForReport || !user?.id) return;
    const onFocus = () => fetchApplications();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedJobIdForReport, user?.id, fetchApplications]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const allJobs = useMemo(() => [...jobsAdded], [jobsAdded]);

  const totalApplications = useMemo(
    () => allJobs.reduce((sum, j) => sum + (j.applicationsCount ?? 0), 0),
    [allJobs]
  );
  const ratingValue = 0;
  const ratingReviews = 0;

  const jobFillRate = useMemo(() => {
    const totalSlots = allJobs.reduce((sum, j) => sum + (parseInt(String(j.peopleNeeded ?? "1"), 10) || 1), 0);
    if (totalSlots === 0) return 0;
    const filled = allJobs.reduce((sum, j) => sum + (j.applicationsCount ?? 0), 0);
    return Math.min(100, Math.round((filled / totalSlots) * 100));
  }, [allJobs]);

  const reportStats = useMemo(() => {
    const now = new Date();
    const periodStart =
      reportPeriod === "week" ? getDaysAgo(7) : reportPeriod === "month" ? getDaysAgo(30) : getDaysAgo(365);
    let totalHours = 0;
    const weekDayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
    const hoursByDay: Record<string, number> = {};
    weekDayLabels.forEach((d) => { hoursByDay[d] = 0; });
    const activityBarsMonth = [0, 0, 0, 0];
    const activityBarsYear = Array(12).fill(0) as number[];
    let completedJobs = 0;
    Object.values(applicationsByJob).forEach((apps) => {
      if (apps.some((a) => String(a.status).toLowerCase() === "accepted")) completedJobs += 1;
      apps.forEach((a) => {
        (a.workSessions ?? []).forEach((s) => {
          const workDate = (s.workDate || "").slice(0, 10);
          if (!workDate) return;
          const sessionStart = new Date(workDate).getTime();
          if (sessionStart < periodStart.getTime() || sessionStart > now.getTime()) return;
          if (s.checkedInAt && s.checkedOutAt) {
            const h = hoursBetween(s.checkedInAt, s.checkedOutAt);
            totalHours += h;
            if (reportPeriod === "week") {
              const d = new Date(workDate + "T12:00:00");
              const dayKey = weekDayLabels[d.getDay()];
              if (dayKey) hoursByDay[dayKey] = (hoursByDay[dayKey] ?? 0) + h;
            } else if (reportPeriod === "month") {
              const weekIndex = Math.min(3, Math.floor((sessionStart - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
              activityBarsMonth[weekIndex] += h;
            } else {
              const d = new Date(workDate + "T12:00:00");
              activityBarsYear[d.getMonth()] += h;
            }
          }
        });
      });
    });
    const activityBars = reportPeriod === "week" ? weekDayLabels.map((d) => hoursByDay[d] ?? 0) : reportPeriod === "month" ? activityBarsMonth : activityBarsYear;
    const activityLabels = reportPeriod === "week" ? weekDayLabels : reportPeriod === "month" ? [t("dashboard.week") + " 1", t("dashboard.week") + " 2", t("dashboard.week") + " 3", t("dashboard.week") + " 4"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return { totalHours: Math.round(totalHours * 10) / 10, completedJobs, activityBars, activityLabels };
  }, [applicationsByJob, reportPeriod, t]);

  const maxActivityHours = useMemo(() => Math.max(1, ...reportStats.activityBars), [reportStats.activityBars]);

  const statsWithValues = useMemo(
    () => [
      { labelKey: "statsApplications", value: String(totalApplications), icon: STATS_ICONS.applications },
      { labelKey: "statsRating", value: ratingReviews === 0 ? "—" : String(ratingValue), icon: STATS_ICONS.rating, isRating: true, ratingAverage: ratingValue, ratingCount: ratingReviews },
    ],
    [totalApplications, ratingValue, ratingReviews]
  );

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      <div className="page-enter-stagger">
      <header className="mb-6 md:mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f] truncate">{t("dashboard.hello", { name: user?.name ?? "" })}</h1>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md">{t("dashboard.subtitleToday")}</p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-6 md:mb-8">
        {statsWithValues.map((s) => {
          const isRating = "isRating" in s && s.isRating;
          const ratingAverage = isRating && "ratingAverage" in s ? (s as { ratingAverage: number }).ratingAverage : 0;
          const ratingCount = isRating && "ratingCount" in s ? (s as { ratingCount: number }).ratingCount : 0;
          return (
            <article key={s.labelKey} className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 truncate">{t(`dashboard.${s.labelKey}`)}</h3>
                {!isRating && <p className="text-xl sm:text-2xl font-bold text-gray-900">{s.value}</p>}
                {isRating && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <StarRating value={ratingAverage} size={18} />
                    {ratingCount > 0 && (
                      <span className="text-xs text-gray-500">({ratingCount})</span>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mb-6 md:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.jobsToday")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobTitle")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.status")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.confirmed")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.time")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {allJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 sm:p-12 text-center">
                      <p className="text-gray-500 text-sm sm:text-base mb-4">{t("dashboard.noJobsFound")}</p>
                      <button
                        type="button"
                        onClick={openPostJobModal}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-lg leading-none">+</span>
                        {t("dashboard.postJob")}
                      </button>
                    </td>
                  </tr>
                ) : (
                  allJobs.map((row, i) => (
                    <tr key={("id" in row && row.id != null ? String(row.id) : `job-${i}-${row.job}-${row.location}`)} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="p-3 sm:p-4 font-medium text-gray-900 text-sm">{row.job}</td>
                      <td className="p-3 sm:p-4 text-gray-600 text-sm">{row.location}</td>
                      <td className="p-3 sm:p-4 text-gray-600 text-xs sm:text-sm">
                        {"jobType" in row && row.jobType
                          ? row.jobType === "one-day"
                            ? t("dashboard.oneDayJob")
                            : row.jobType === "multi-day"
                              ? t("dashboard.multiDayJob")
                              : t("dashboard.fullTimeRecruitment")
                          : "—"}
                      </td>
                      <td className="p-3 sm:p-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${row.statusClass}`}>{row.status}</span>
                      </td>
                      <td className="p-3 sm:p-4 text-gray-600 text-sm">{row.status === "Confirmat" ? "Da" : "—"}</td>
                      <td className="p-3 sm:p-4 text-gray-600 text-sm">{row.date}</td>
                      <td className="p-3 sm:p-4 text-gray-600 text-sm">
                        {row.startTime && row.endTime ? `${row.startTime} – ${row.endTime}` : "—"}
                      </td>
                      <td className="p-3 sm:p-4">
                        {row.id && (
                          <button
                            type="button"
                            onClick={() => removeJob(row.id!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 bg-red-50/80 hover:bg-red-100 hover:border-red-300 transition-colors"
                            aria-label={t("dashboard.delete")}
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6h8M7 6V4a2 2 0 012-2h6a2 2 0 012 2v2" />
                            </svg>
                            {t("dashboard.delete")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {allJobs.length > 0 && (
            <div className="p-3 sm:p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={openPostJobModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors text-sm"
              >
                <span className="text-lg leading-none">+</span>
                {t("dashboard.postJob")}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Job fill rate, Reports, Activity report */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 md:mb-8">
        {/* Job fill rate */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard.jobFillRate")}</h3>
          <div className="flex justify-center">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(229 231 235)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(122 99 241)" strokeWidth="10" strokeDasharray={`${jobFillRate * 2.64} 264`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-gray-900">{jobFillRate}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Raport pe job: select job → număr angajați + check-in/check-out cu ore */}
      <section className="mb-6 md:mb-8">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-visible min-h-[420px] report-card-enter">
          <div className="bg-gradient-to-br from-[#faf8ff] via-white to-[#f5f3ff] px-5 sm:px-6 py-5 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </span>
              <div>
                <h2 className="font-bold text-gray-900 text-lg tracking-tight">{t("dashboard.reportByJob")}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t("dashboard.reportByJobDesc")}</p>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6 space-y-6">
            <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-4 sm:p-5">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">{t("dashboard.selectJob")}</span>
                <div ref={jobDropdownRef} className="mt-2 relative w-full max-w-xl">
                  <button
                    type="button"
                    onClick={() => setJobDropdownOpen((v) => !v)}
                    aria-expanded={jobDropdownOpen}
                    aria-haspopup="listbox"
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left font-medium shadow-sm transition-all ${selectedJobIdForReport ? "border-primary bg-primary/5 text-gray-900" : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"} focus:ring-2 focus:ring-primary/30 focus:border-primary`}
                  >
                    <span className="truncate">
                      {selectedJobIdForReport
                        ? (() => {
                            const j = allJobs.find((job, i) => ("id" in job && job.id != null ? String(job.id) : `job-${i}`) === selectedJobIdForReport);
                            return j ? `${j.job} — ${j.location}` : t("dashboard.noJobSelected");
                          })()
                        : t("dashboard.noJobSelected")}
                    </span>
                    <svg className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform ${jobDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {jobDropdownOpen && (
                    <div
                      role="listbox"
                      aria-label={t("dashboard.selectJob")}
                      className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1 dropdown-enter origin-top"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={!selectedJobIdForReport}
                        onMouseDown={(e) => { e.preventDefault(); setSelectedJobIdForReport(null); setSelectedDateForReport(null); setSelectedStaffIdForReport(null); setJobDropdownOpen(false); }}
                        className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${!selectedJobIdForReport ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {t("dashboard.noJobSelected")}
                      </button>
                      {allJobs.map((j, i) => {
                        const id = "id" in j && j.id != null ? String(j.id) : `job-${i}`;
                        const selected = selectedJobIdForReport === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseDown={(e) => { e.preventDefault(); setSelectedJobIdForReport(id); setSelectedDateForReport(null); setSelectedStaffIdForReport(null); setJobDropdownOpen(false); }}
                            className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors truncate ${selected ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"}`}
                          >
                            {j.job} — {j.location}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </label>
            </div>
            {selectedJobIdForReport && (
            <div className="report-content-enter">
            {(() => {
              const job = allJobs.find((j, i) => ("id" in j && j.id != null ? String(j.id) : `job-${i}`) === selectedJobIdForReport) as { date?: string; endDate?: string; startTime?: string; endTime?: string; peopleNeeded?: string } | undefined;
              const apps = applicationsByJob[selectedJobIdForReport] ?? [];
              const accepted = apps.filter((a) => String(a.status).toLowerCase() === "accepted");
              const peopleNeeded = job ? (parseInt(String(job.peopleNeeded ?? "1"), 10) || 1) : 0;
              const jobDate = (job?.date || "").trim();
              const jobEndDate = (job?.endDate || "").trim();
              const scheduledDates = jobDate ? getScheduledDates(jobDate, jobEndDate || undefined) : [];
              const scheduledStartTime = (job?.startTime || "").trim() || "—";
              const scheduledEndTime = (job?.endTime || "").trim() || "—";
              type Row = { staffId: string; staffName: string; workDate: string; scheduledCheckIn: string; scheduledCheckOut: string; actualCheckIn?: string; actualCheckOut?: string };
              const rows: Row[] = [];
              accepted.forEach((a) => {
                const sessionsByDate: Record<string, { checkedInAt?: string; checkedOutAt?: string }> = {};
                (a.workSessions ?? []).forEach((s) => {
                  const d = (s.workDate || "").slice(0, 10);
                  if (d) sessionsByDate[d] = { checkedInAt: s.checkedInAt, checkedOutAt: s.checkedOutAt };
                });
                scheduledDates.forEach((workDate) => {
                  const session = sessionsByDate[workDate];
                  rows.push({
                    staffId: a.staffId ?? "",
                    staffName: a.staffName ?? "—",
                    workDate,
                    scheduledCheckIn: scheduledStartTime,
                    scheduledCheckOut: scheduledEndTime,
                    actualCheckIn: session?.checkedInAt,
                    actualCheckOut: session?.checkedOutAt,
                  });
                });
              });
              rows.sort((a, b) => a.workDate.localeCompare(b.workDate) || (a.staffName || "").localeCompare(b.staffName || ""));
              let filteredRows = selectedDateForReport ? rows.filter((r) => r.workDate === selectedDateForReport) : rows;
              if (selectedStaffIdForReport) filteredRows = filteredRows.filter((r) => r.staffId === selectedStaffIdForReport);
              const formatTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" }) : null);
              const notYetDone = t("dashboard.notYetDone");
              const CheckIcon = () => (
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              );
              const ClockIcon = () => (
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              );
              const StatusCell = ({ value }: { value?: string }) => {
                const time = formatTime(value);
                if (time) return <span className="inline-flex items-center gap-1.5 text-gray-700"><CheckIcon /><span>{time}</span></span>;
                return <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium"><ClockIcon /><span>{notYetDone}</span></span>;
              };
              const displayedEmployeeCount = accepted.length;
              return (
                <>
                  <div className="flex flex-wrap items-center gap-4 mb-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
                      <span className="text-sm font-semibold text-primary">{t("dashboard.numberOfEmployees")}</span>
                      <span className="text-sm font-bold text-gray-900">{displayedEmployeeCount}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {accepted.length >= 2 && (
                      <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-4 sm:p-5 min-h-[200px] flex flex-col">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </span>
                          {t("dashboard.selectEmployee")}
                        </h4>
                        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStaffIdForReport(null)}
                            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${selectedStaffIdForReport === null ? "bg-primary text-white shadow-sm" : "bg-white border border-gray-200 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                          >
                            <span>{t("dashboard.allEmployees")}</span>
                            <svg className="w-4 h-4 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                          {accepted.map((a) => (
                            <button
                              key={a.staffId ?? a.staffName ?? ""}
                              type="button"
                              onClick={() => setSelectedStaffIdForReport(a.staffId ?? null)}
                              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${selectedStaffIdForReport === (a.staffId ?? "") ? "bg-primary text-white shadow-sm" : "bg-white border border-gray-200 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                            >
                              <span>{a.staffName || "—"}</span>
                              <svg className="w-4 h-4 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {scheduledDates.length > 0 && (() => {
                      const scheduledSet = new Set(scheduledDates);
                      const days = getCalendarDaysForMonth(calendarViewYear, calendarViewMonth);
                      const hasPrevMonth = scheduledDates.some((ymd) => {
                        const [y, m] = ymd.split("-").map(Number);
                        const month0 = m - 1;
                        return y < calendarViewYear || (y === calendarViewYear && month0 < calendarViewMonth);
                      });
                      const hasNextMonth = scheduledDates.some((ymd) => {
                        const [y, m] = ymd.split("-").map(Number);
                        const month0 = m - 1;
                        return y > calendarViewYear || (y === calendarViewYear && month0 > calendarViewMonth);
                      });
                      return (
                        <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-4 max-w-[260px] flex flex-col">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </span>
                            {t("dashboard.selectDay")}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setSelectedDateForReport(null)}
                            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-all mb-2.5 ${selectedDateForReport === null ? "bg-primary text-white shadow-sm" : "bg-white border border-gray-200 text-gray-800 hover:border-primary/30 hover:bg-primary/5"}`}
                          >
                            <span>{t("dashboard.allDays")}</span>
                            <svg className="w-4 h-4 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (calendarViewMonth === 0) { setCalendarViewMonth(11); setCalendarViewYear(calendarViewYear - 1); }
                                else setCalendarViewMonth(calendarViewMonth - 1);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                              disabled={!hasPrevMonth}
                              aria-label={t("dashboard.prevMonth")}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <span className="text-sm font-bold text-gray-900 capitalize">{MONTH_NAMES_LONG[calendarViewMonth]} {calendarViewYear}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (calendarViewMonth === 11) { setCalendarViewMonth(0); setCalendarViewYear(calendarViewYear + 1); }
                                else setCalendarViewMonth(calendarViewMonth + 1);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                              disabled={!hasNextMonth}
                              aria-label={t("dashboard.nextMonth")}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center">
                            {WEEKDAY_HEADERS.map((h) => (
                              <div key={h} className="py-1 text-[10px] font-semibold text-gray-500">{h}</div>
                            ))}
                            {days.map((day, idx) => {
                              if (day === null) return <div key={`e-${idx}`} />;
                              const ymd = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                              const isScheduled = scheduledSet.has(ymd);
                              const isSelected = selectedDateForReport === ymd;
                              const playSelectAnimation = isSelected && animatingDay === ymd;
                              return (
                                <button
                                  key={ymd}
                                  type="button"
                                  disabled={!isScheduled}
                                  onClick={() => {
                                    if (!isScheduled) return;
                                    setAnimatingDay(ymd);
                                    setSelectedDateForReport(ymd);
                                  }}
                                  onAnimationEnd={() => playSelectAnimation && setAnimatingDay(null)}
                                  className={`min-w-0 w-full aspect-square rounded-lg text-xs font-medium transition-all ${!isScheduled ? "text-gray-300 cursor-default" : isSelected ? "bg-primary text-white shadow-sm" : "text-gray-700 hover:bg-primary/10 hover:text-primary"} ${playSelectAnimation ? "calendar-day-select" : ""}`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                    {filteredRows.length === 0 ? (
                      <div className="py-12 px-6 text-center">
                        <p className="text-gray-500 text-sm">
                          {selectedDateForReport ? t("dashboard.noSessionsForSelectedDay") : t("dashboard.noSessionsForJob")}
                        </p>
                      </div>
                    ) : (
                      <table className="w-full min-w-[640px]">
                        <thead>
                          <tr className="text-left text-xs sm:text-sm text-gray-500 bg-gray-50/80 border-b border-gray-100">
                            <th className="p-4 font-semibold text-gray-700">{t("dashboard.staffName")}</th>
                            <th className="p-4 font-semibold text-gray-700">{t("dashboard.date")}</th>
                            <th className="p-4 font-semibold text-gray-700">{t("dashboard.scheduledCheckIn")}</th>
                            <th className="p-4 font-semibold text-gray-700">{t("dashboard.scheduledCheckOut")}</th>
                            <th className="p-4 font-semibold text-gray-700">{t("dashboard.checkInTime")}</th>
                            <th className="p-4 font-semibold text-gray-700">{t("dashboard.checkOutTime")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row, idx) => (
                            <tr key={idx} className={`border-b border-gray-50 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-primary/5 transition-colors`}>
                              <td className="p-4 font-medium text-gray-900 text-sm">{row.staffName}</td>
                              <td className="p-4 text-gray-600 text-sm">{row.workDate || "—"}</td>
                              <td className="p-4 text-gray-600 text-sm">{row.scheduledCheckIn}</td>
                              <td className="p-4 text-gray-600 text-sm">{row.scheduledCheckOut}</td>
                              <td className="p-4 text-sm"><StatusCell value={row.actualCheckIn} /></td>
                              <td className="p-4 text-sm"><StatusCell value={row.actualCheckOut} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              );
            })()}
            </div>
            )}
          </div>
        </div>
      </section>

      </div>
    </>
  );
}
