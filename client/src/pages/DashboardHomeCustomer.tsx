import { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, type JobRow } from "./DashboardLayout";
import { jobsApi } from "../api/client";
import { getBusinessTotal, roundMoney, BUSINESS_TAX_RATE, BUSINESS_MAINTENANCE_RATE } from "../utils/salary";

function hoursBetween(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.max(0, (b - a) / (1000 * 60 * 60));
}

function formatTimeOnly(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" });
}

function getCheckInTime(app: AppWithSessions, emptyLabel: string): string {
  // Check workSessions first (most recent session with check-in)
  if (app.workSessions && app.workSessions.length > 0) {
    const sessionsWithCheckIn = app.workSessions.filter(s => s.checkedInAt);
    if (sessionsWithCheckIn.length > 0) {
      // Get the most recent check-in
      const sorted = sessionsWithCheckIn.sort((a, b) => 
        new Date(b.checkedInAt!).getTime() - new Date(a.checkedInAt!).getTime()
      );
      return formatTimeOnly(sorted[0].checkedInAt);
    }
  }
  // Fallback to application-level check-in
  return app.checkedInAt ? formatTimeOnly(app.checkedInAt) : emptyLabel;
}

function getCheckOutTime(app: AppWithSessions, emptyLabel: string): string {
  // Check workSessions first (most recent session with check-out)
  if (app.workSessions && app.workSessions.length > 0) {
    const sessionsWithCheckOut = app.workSessions.filter(s => s.checkedOutAt);
    if (sessionsWithCheckOut.length > 0) {
      // Get the most recent check-out
      const sorted = sessionsWithCheckOut.sort((a, b) => 
        new Date(b.checkedOutAt!).getTime() - new Date(a.checkedOutAt!).getTime()
      );
      return formatTimeOnly(sorted[0].checkedOutAt);
    }
  }
  // Fallback to application-level check-out
  return app.checkedOutAt ? formatTimeOnly(app.checkedOutAt) : emptyLabel;
}

type AppWithSessions = { 
  id?: string;
  jobId?: string;
  status: string; 
  staffId?: string; 
  staffName?: string; 
  staffEmail?: string;
  staffAvatar?: string;
  workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]; 
  checkedInAt?: string; 
  checkedOutAt?: string;
  businessConfirmedAt?: string;
  isBusinessConfirmed?: boolean;
};

export default function DashboardHomeCustomer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openPostJobModal, jobsAdded, removeJob } = useContext(DashboardContext);
  const [toast] = useState<string | null>(null);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, AppWithSessions[]>>({});
  const [jobsArchiveExpanded, setJobsArchiveExpanded] = useState(false);
  const [activeAppsExpanded, setActiveAppsExpanded] = useState(true);
  const [openAppsExpanded, setOpenAppsExpanded] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<{ job: JobRow; application: AppWithSessions } | null>(null);

  const fetchApplications = useCallback(() => {
    jobsApi
      .applications()
      .then((r) => {
        const map: Record<string, AppWithSessions[]> = {};
        Object.entries(r.applications ?? {}).forEach(([jobId, list]) => {
          map[jobId] = (list || []).map((a) => ({
            id: a.id,
            jobId: a.jobId ?? jobId,
            status: a.status,
            staffId: a.staffId ?? "",
            staffName: a.staffName ?? "",
            staffEmail: a.staffEmail,
            staffAvatar: a.staffAvatar,
            workSessions: a.workSessions ?? [],
            checkedInAt: a.checkedInAt,
            checkedOutAt: a.checkedOutAt,
            businessConfirmedAt: a.businessConfirmedAt,
            isBusinessConfirmed: a.isBusinessConfirmed ?? false,
          }));
        });
        const apps = r?.applications;
        if (apps && typeof apps === "object") {
          Object.entries(apps).forEach(([jobId, list]) => {
            const key = String(jobId).trim();
            if (!key) return;
            const items = Array.isArray(list) ? list : [];
            map[key] = items.map((a: { status?: string; staffId?: string; staffName?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]; checkedInAt?: string; checkedOutAt?: string }) => ({
              status: a.status ?? "",
              staffId: a.staffId ?? "",
              staffName: a.staffName ?? "",
              workSessions: Array.isArray(a.workSessions) ? a.workSessions : [],
              checkedInAt: a.checkedInAt,
              checkedOutAt: a.checkedOutAt,
            }));
          });
        }
        setApplicationsByJob(map);
      })
      .catch(() => setApplicationsByJob({}));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchApplications();
  }, [user?.id, fetchApplications]);

  // Set up periodic refresh every 10 seconds to catch check-ins/check-outs
  // NOTE: fetchApplications is intentionally called only once on mount.
  // If live auto-refresh is needed in future, add a polling effect here.

  const allJobs = useMemo(() => [...jobsAdded], [jobsAdded]);

  /** Joburi cu cel puțin o aplicare vs fără (pentru diagramă acasă) */
  const jobsAppDistribution = useMemo(() => {
    let withApps = 0;
    allJobs.forEach((job, i) => {
      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
      if ((applicationsByJob[jobId] ?? []).length > 0) withApps++;
    });
    const total = allJobs.length;
    return { withApps, withoutApps: total - withApps, total };
  }, [allJobs, applicationsByJob]);

  const localizedEmptyCheckLabel = t("dashboard.notYetDone");
  // Compute jobs with no accepted applications
  const jobsWithNoAcceptances = useMemo(() => {
    const noAcceptances: JobRow[] = [];
    allJobs.forEach((job, i) => {
      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
      const apps = applicationsByJob[jobId] ?? [];

      const hasAcceptedApp = apps.some((app) => {
        const status = String(app.status).toLowerCase();
        return status === "accepted";
      });

      if (!hasAcceptedApp) {
        noAcceptances.push(job);
      }
    });
    return noAcceptances;
  }, [allJobs, applicationsByJob]);

  // Compute active applications grouped by job (one row per job, with all active applications listed)
  const activeJobs = useMemo(
    () =>
      allJobs
        .map((job, i) => {
          const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
          const apps = (applicationsByJob[jobId] ?? []).filter((app) => {
            const status = String(app.status).toLowerCase();
            if (status === "pending") return true;
            if (status === "accepted") {
              const isConfirmed = app.isBusinessConfirmed || !!app.businessConfirmedAt;
              if (isConfirmed) return false;

              // If checkout is stored at application-level, the job should no longer be shown as "in process".
              if (app.checkedOutAt) return false;

              if (app.workSessions && app.workSessions.length > 0) {
                return app.workSessions.some((s) => s.checkedInAt && !s.checkedOutAt);
              }

              return !app.checkedInAt || (app.checkedInAt && !app.checkedOutAt);
            }
            return false;
          });

          if (apps.length === 0) return null;
          return { job, apps };
        })
        .filter((entry): entry is { job: JobRow; apps: AppWithSessions[] } => entry !== null),
    [allJobs, applicationsByJob]
  );

  const archivedJobs = useMemo(() => {
    const archived: JobRow[] = [];
    allJobs.forEach((job, i) => {
      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
      const apps = applicationsByJob[jobId] ?? [];

      if (apps.length === 0) return;

      const allArchived = apps.every((app) => {
        const status = String(app.status).toLowerCase();
        if (status === "pending") return false;

        const isConfirmed = app.isBusinessConfirmed || !!app.businessConfirmedAt;
        if (isConfirmed) return true;

        if (app.workSessions && app.workSessions.length > 0) {
          const allSessionsOut = app.workSessions.every((s) => !!s.checkedOutAt);
          // Some APIs store checkout at application-level without checkedOutAt in each work session.
          // Treat job as archived in that case as well.
          return allSessionsOut || !!app.checkedOutAt;
        }

        return !!app.checkedOutAt;
      });

      if (allArchived) {
        archived.push(job);
      }
    });
    return archived;
  }, [allJobs, applicationsByJob]);

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      <div className="page-enter-stagger flex flex-col">
        <header className="mb-6 md:mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f] truncate">
              {t("dashboard.hello", { name: user?.name ?? "" })}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md">{t("dashboard.subtitleToday")}</p>
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={openPostJobModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors w-full sm:w-auto"
            >
              <span className="text-lg leading-none">+</span>
              {t("dashboard.postJob")}
            </button>
          </div>
        </header>

        {/* Active Jobs Section */}
        <section className="order-[30] mb-6 md:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveAppsExpanded((v) => !v)}
              className="w-full p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 4h.01M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                    />
                  </svg>
                </span>
                <div className="text-left">
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.applicationsInProcessTitle")}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("dashboard.applicationsInProcessDesc")}
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${activeAppsExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={[
                "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out",
                activeAppsExpanded ? "max-h-[1200px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1",
              ].join(" ")}
              aria-hidden={!activeAppsExpanded}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.checkIn")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.checkOut")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.staffName")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 sm:p-12 text-center">
                        <p className="text-gray-500 text-sm sm:text-base">{t("dashboard.noApplicationsInProgress")}</p>
                      </td>
                    </tr>
                  ) : (
                    activeJobs.map(({ job, apps }, index) => {
                      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${index}`);
                      // First active application used for default row-level check-in/out display
                      const primaryApp = apps[0];
                      const checkInTime = getCheckInTime(primaryApp, localizedEmptyCheckLabel);
                      const checkOutTime = getCheckOutTime(primaryApp, localizedEmptyCheckLabel);

                      const handleRowClick = () => {
                        setSelectedApplication({ job, application: primaryApp });
                      };

                      return (
                        <tr
                          key={jobId}
                          onClick={handleRowClick}
                          className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer align-top"
                        >
                          <td className="p-3 sm:p-4 font-medium text-gray-900 text-sm">{job.job}</td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm">{job.location}</td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm">{checkInTime}</td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm">{checkOutTime}</td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              {apps.map((app) => (
                                <button
                                  key={app.id ?? app.staffId}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedApplication({ job, application: app });
                                  }}
                                  className="text-left hover:text-primary transition-colors"
                                >
                                  {app.staffName || "—"}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm">{job.date}</td>
                          <td className="p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
                            {job.id && (
                              <button
                                type="button"
                                onClick={() => removeJob(job.id!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 bg-red-50/80 hover:bg-red-100 hover:border-red-300 transition-colors"
                                aria-label={t("dashboard.delete")}
                              >
                                <svg
                                  className="w-4 h-4 flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h6a2 2 0 012 2v2"
                                  />
                                </svg>
                                {t("dashboard.delete")}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Posted Jobs (No Acceptances) Section */}
        <section className="order-[30] mb-6 md:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenAppsExpanded((v) => !v)}
              className="w-full p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7h16M4 7a2 2 0 110-4h16a2 2 0 110 4M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7"
                    />
                  </svg>
                </span>
                <div className="text-left">
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.openApplicationsTitle")}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t("dashboard.openApplicationsDesc")}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${openAppsExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={[
                "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out",
                openAppsExpanded ? "max-h-[1200px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1",
              ].join(" ")}
              aria-hidden={!openAppsExpanded}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobTitle")}</th>
                    {/* Column showing how many people are applied vs needed (e.g. 2/3, 0/1) */}
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.people")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.time")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsWithNoAcceptances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 sm:p-12 text-center">
                        <p className="text-gray-500 text-sm sm:text-base">{t("dashboard.noOpenApplications")}</p>
                      </td>
                    </tr>
                  ) : (
                    jobsWithNoAcceptances.map((row, i) => {
                      const jobId = ("id" in row && row.id != null ? String(row.id) : `job-${i}`);
                      const apps = applicationsByJob[jobId] ?? [];
                      const firstApp = apps.length > 0 ? apps[0] : null;
                      const handleRowClick = () => {
                        if (firstApp) {
                          setSelectedApplication({ job: row, application: firstApp });
                        }
                      };
                      return (
                        <tr
                          key={jobId}
                          onClick={handleRowClick}
                          className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                            firstApp ? "cursor-pointer" : ""
                          }`}
                        >
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
                            {(() => {
                              const needed = parseInt(String(row.peopleNeeded ?? "1"), 10) || 1;
                              // Count only applications that are not refused (pending or accepted)
                              const activeApps = apps.filter((app) => String(app.status).toLowerCase() !== "refused").length;
                              return (
                                <span className="inline-flex items-center justify-center min-w-[3.5rem] px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                                  {activeApps}/{needed}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm">{row.date}</td>
                          <td className="p-3 sm:p-4 text-gray-600 text-sm">
                            {row.startTime && row.endTime ? `${row.startTime} – ${row.endTime}` : "—"}
                          </td>
                          <td className="p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
                            {row.id && (
                              <button
                                type="button"
                                onClick={() => removeJob(row.id!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 bg-red-50/80 hover:bg-red-100 hover:border-red-300 transition-colors"
                                aria-label={t("dashboard.delete")}
                              >
                                <svg
                                  className="w-4 h-4 flex-shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h6a2 2 0 012 2v2"
                                  />
                                </svg>
                                {t("dashboard.delete")}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Archived Jobs Section */}
        <section className="order-[30] mb-6 md:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setJobsArchiveExpanded(!jobsArchiveExpanded)}
              className="w-full p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
                  </svg>
                </span>
                <div className="text-left">
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.closedArchivedApplicationsTitle")}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{t("dashboard.closedArchivedApplicationsDesc")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {archivedJobs.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                    {archivedJobs.length}
                  </span>
                )}
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${jobsArchiveExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${jobsArchiveExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              aria-hidden={!jobsArchiveExpanded}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.checkIn")}</th>
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.checkOut")}</th>
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.staffName")}</th>
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                      <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 sm:p-12 text-center">
                          <p className="text-gray-500 text-sm sm:text-base">{t("dashboard.noClosedArchivedApplications")}</p>
                        </td>
                      </tr>
                    ) : (
                      archivedJobs.map((row, i) => {
                        const jobId = ("id" in row && row.id != null ? String(row.id) : `job-${i}`);
                        const apps = applicationsByJob[jobId] ?? [];
                        const firstApp = apps.length > 0 ? apps[0] : null;
                        const handleRowClick = () => {
                          if (firstApp) {
                            setSelectedApplication({ job: row, application: firstApp });
                          }
                        };
                        const checkInTime = firstApp ? getCheckInTime(firstApp, localizedEmptyCheckLabel) : localizedEmptyCheckLabel;
                        const checkOutTime = firstApp ? getCheckOutTime(firstApp, localizedEmptyCheckLabel) : localizedEmptyCheckLabel;
                        return (
                          <tr
                            key={jobId}
                            onClick={handleRowClick}
                            className={`border-b border-gray-100 hover:bg-gray-50/50 ${firstApp ? "cursor-pointer" : ""}`}
                          >
                            <td className="p-3 sm:p-4 font-medium text-gray-900 text-sm">{row.job}</td>
                            <td className="p-3 sm:p-4 text-gray-600 text-sm">{row.location}</td>
                            <td className="p-3 sm:p-4 text-gray-600 text-sm">{checkInTime}</td>
                            <td className="p-3 sm:p-4 text-gray-600 text-sm">{checkOutTime}</td>
                            <td className="p-3 sm:p-4 text-gray-600 text-sm font-medium">{firstApp?.staffName || "—"}</td>
                            <td className="p-3 sm:p-4 text-gray-600 text-sm">{row.date}</td>
                            <td className="p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
                              {row.id && (
                                <button
                                  type="button"
                                  onClick={() => removeJob(row.id!)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 bg-red-50/80 hover:bg-red-100 hover:border-red-300 transition-colors"
                                  aria-label={t("dashboard.delete")}
                                >
                                  <svg
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h6a2 2 0 012 2v2"
                                    />
                                  </svg>
                                  {t("dashboard.delete")}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* Distribuție joburi: cu / fără aplicații — donut + bare (responsive) */}
      <section className="mt-6 md:mt-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <div className="border-b border-primary/10 bg-gradient-to-br from-primary/[0.07] via-white to-violet-50/60 px-4 py-3 sm:px-6 sm:py-4">
            <h3 className="text-base font-bold tracking-tight text-gray-900">
              {t("dashboard.branchesDistribution") || "Distribuția joburilor pe filiale"}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              {t("dashboard.jobsWithVsWithoutAppsHint", "Câte joburi au primit aplicații și câte nu.")}
            </p>
          </div>
          <div className="p-4 sm:p-6">
            {jobsAppDistribution.total === 0 ? (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-10 text-center">
                <p className="text-sm font-medium text-gray-600">{t("dashboard.noJobsYetShort", "Încă nu ai joburi postate.")}</p>
                <p className="mt-1 max-w-sm text-xs text-gray-500">{t("dashboard.noData") || "Fără date"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:gap-10">
                {(() => {
                  const { withApps, withoutApps, total } = jobsAppDistribution;
                  const withPct = total > 0 ? (withApps / total) * 100 : 0;
                  const withoutPct = total > 0 ? (withoutApps / total) * 100 : 0;
                  return (
                    <div className="relative mx-auto w-full max-w-[280px] shrink-0 overflow-hidden rounded-3xl border border-primary/12 bg-white px-6 py-8 text-center shadow-[0_12px_40px_-16px_rgba(122,99,241,0.35)] sm:px-8 sm:py-9">
                      <div
                        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-primary/20 to-violet-300/25 blur-2xl"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-200/35 blur-2xl"
                        aria-hidden
                      />
                      <p
                        className="relative text-4xl font-bold tabular-nums tracking-tight text-transparent sm:text-5xl"
                        style={{
                          backgroundImage: "linear-gradient(135deg, #4f46e5 0%, #7a63f1 45%, #9d7bff 100%)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                        }}
                      >
                        {total}
                      </p>
                      <p className="relative mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 sm:text-sm sm:tracking-[0.15em]">
                        {t("dashboard.jobsTotalLabel", "joburi")}
                      </p>
                      <p className="relative mt-3 text-[0.7rem] leading-snug text-gray-500 sm:text-xs">
                        {t("dashboard.jobsDistributionStripHint", "Repartiție rapidă")}
                      </p>
                      <div
                        className="relative mt-4 flex h-3 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200/80"
                        role="img"
                        aria-label={t("dashboard.jobsWithApplications", "Joburi cu aplicații") + ` ${Math.round(withPct)}%, ` + t("dashboard.jobsWithoutApplications", "Joburi fără aplicații") + ` ${Math.round(withoutPct)}%`}
                      >
                        {withApps > 0 && (
                          <div
                            className="h-full min-w-0 bg-gradient-to-r from-[#6d5ae0] to-primary transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                            style={{ width: `${withPct}%` }}
                          />
                        )}
                        {withoutApps > 0 && (
                          <div
                            className="h-full min-w-0 bg-gradient-to-r from-violet-300 to-[#d8b4fe] transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                            style={{ width: `${withoutPct}%` }}
                          />
                        )}
                      </div>
                      <div className="relative mt-3 flex justify-center gap-4 text-[0.65rem] text-gray-500 sm:text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          {withApps}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-violet-300" />
                          {withoutApps}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div className="w-full min-w-0 flex-1 space-y-3">
                  {[
                    {
                      title: t("dashboard.jobsWithApplications", "Joburi cu aplicații"),
                      count: jobsAppDistribution.withApps,
                      color: "#7a63f1",
                    },
                    {
                      title: t("dashboard.jobsWithoutApplications", "Joburi fără aplicații"),
                      count: jobsAppDistribution.withoutApps,
                      color: "#c084fc",
                    },
                  ].map((item) => {
                    const pct =
                      jobsAppDistribution.total > 0
                        ? Math.round((item.count / jobsAppDistribution.total) * 100)
                        : 0;
                    return (
                      <div
                        key={item.title}
                        className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 gap-y-1">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: item.color }} />
                          <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800">{item.title}</span>
                          <span className="shrink-0 text-sm tabular-nums">
                            <strong className="text-gray-900">{item.count}</strong>
                            <span className="ml-1.5 text-xs font-medium text-gray-500">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200/80">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: item.color,
                              minWidth: item.count > 0 ? "4px" : undefined,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Application Details Modal */}
      </div>
      {selectedApplication && (
        <ApplicationDetailsModal
          open={!!selectedApplication}
          onClose={() => setSelectedApplication(null)}
          job={selectedApplication.job}
          application={selectedApplication.application}
        />
      )}
    </>
  );

}

/** Application Details Modal Component */
function ApplicationDetailsModal({
  open,
  onClose,
  job,
  application,
}: {
  open: boolean;
  onClose: () => void;
  job: JobRow;
  application: AppWithSessions;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Calculate salary details
  const hourlyRate = job.hourlyRateBase != null ? Number(job.hourlyRateBase) : null;
  const hasRate = hourlyRate != null && Number.isFinite(hourlyRate) && hourlyRate > 0;

  // Calculate total hours from work sessions
  let totalHours = 0;
  const workSessionsDetails: Array<{ date: string; checkIn?: string; checkOut?: string; hours: number }> = [];
  
  if (application.workSessions && application.workSessions.length > 0) {
    const appCheckOut = application.checkedOutAt;

    // Some APIs store checkout at application-level even when each work session misses `checkedOutAt`.
    // Use `application.checkedOutAt` for the latest open session (checkedInAt exists, checkedOutAt missing).
    const openSessions = appCheckOut
      ? application.workSessions
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => s.checkedInAt && !s.checkedOutAt)
      : [];

    const latestOpenIdx =
      openSessions.length > 0
        ? openSessions
            .sort((a, b) => new Date(b.s.checkedInAt!).getTime() - new Date(a.s.checkedInAt!).getTime())[0]!.idx
        : null;

    application.workSessions.forEach((session, idx) => {
      if (!session.checkedInAt) return;

      const effectiveCheckOut = session.checkedOutAt || (appCheckOut && latestOpenIdx === idx ? appCheckOut : undefined);

      if (effectiveCheckOut) {
        const hours = hoursBetween(session.checkedInAt, effectiveCheckOut);
        totalHours += hours;
        workSessionsDetails.push({
          date: session.workDate || "—",
          checkIn: session.checkedInAt,
          checkOut: effectiveCheckOut,
          hours,
        });
      } else {
        workSessionsDetails.push({
          date: session.workDate || "—",
          checkIn: session.checkedInAt,
          hours: 0,
        });
      }
    });

    // If sessions exist but none had check-in recorded, fallback to application-level check-in/out.
    if (workSessionsDetails.length === 0 && application.checkedInAt) {
      if (application.checkedOutAt) {
        totalHours = hoursBetween(application.checkedInAt, application.checkedOutAt);
        workSessionsDetails.push({
          date: job.date || "—",
          checkIn: application.checkedInAt,
          checkOut: application.checkedOutAt,
          hours: totalHours,
        });
      } else {
        workSessionsDetails.push({
          date: job.date || "—",
          checkIn: application.checkedInAt,
          hours: 0,
        });
      }
    }
  } else if (application.checkedInAt && application.checkedOutAt) {
    // Fallback to application-level check-in/out
    totalHours = hoursBetween(application.checkedInAt, application.checkedOutAt);
    workSessionsDetails.push({
      date: job.date || "—",
      checkIn: application.checkedInAt,
      checkOut: application.checkedOutAt,
      hours: totalHours,
    });
  } else if (application.checkedInAt) {
    workSessionsDetails.push({
      date: job.date || "—",
      checkIn: application.checkedInAt,
      hours: 0,
    });
  }

  const baseSalary = hasRate && totalHours > 0 ? hourlyRate! * totalHours : null;
  const taxAmount = baseSalary != null ? roundMoney(baseSalary * BUSINESS_TAX_RATE) : null;
  const maintenanceAmount = baseSalary != null ? roundMoney(baseSalary * BUSINESS_MAINTENANCE_RATE) : null;
  const totalSalaryPaid = baseSalary != null ? roundMoney(getBusinessTotal(baseSalary)) : null;
  const taxPerHour = hasRate ? roundMoney(hourlyRate! * BUSINESS_TAX_RATE) : null;

  const formatDateTime = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ro-MD", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" });
  };

  // Derive a more meaningful status for the application
  const hasAnyCheckOut =
    (application.workSessions && application.workSessions.some((s) => s.checkedOutAt)) ||
    !!application.checkedOutAt ||
    !!application.businessConfirmedAt;

  const normalizedStatus = (application.status || "").toLowerCase();

  const statusMeta =
    normalizedStatus === "accepted"
      ? hasAnyCheckOut
        ? {
            label: t("dashboard.finished"),
            className: "bg-indigo-100 text-indigo-700 border-indigo-200",
          }
        : {
            label: t("dashboard.jobStatusInProcess"),
            className: "bg-emerald-100 text-emerald-700 border-emerald-200",
          }
      : normalizedStatus === "pending"
        ? {
            label: t("dashboard.pending"),
            className: "bg-amber-100 text-amber-700 border-amber-200",
          }
        : normalizedStatus === "refused"
          ? {
              label: t("dashboard.refused"),
              className: "bg-rose-100 text-rose-700 border-rose-200",
            }
          : {
              label: application.status || "—",
              className: "bg-gray-100 text-gray-700 border-gray-200",
            };

  const jobTypeLabel =
    job.jobType === "one-day"
      ? t("dashboard.oneDayJob")
      : job.jobType === "multi-day"
        ? t("dashboard.multiDayJob")
        : job.jobType === "full-time"
          ? t("dashboard.fullTimeRecruitment")
          : null;

  const modalContent = (
    <div
      className="modal-backdrop-anim fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-details-title"
    >
      <div
        className="modal-panel-anim bg-[#fcfbff] rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.22)] border border-white/70 max-w-4xl max-h-[92vh] w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-primary via-[#7d66ff] to-[#5f7cff] px-5 sm:px-7 py-5 sm:py-6 flex items-start justify-between gap-4">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_45%)]" aria-hidden />
          <div className="relative min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/75 mb-2">
              Work2Now
            </p>
            <h2 id="application-details-title" className="text-xl sm:text-2xl font-bold text-white">
              {t("dashboard.applicationDetails")}
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {job.job || "—"} {application.staffName ? `• ${application.staffName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors inline-flex items-center justify-center"
            aria-label={t("dashboard.close")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-7 space-y-5 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,246,255,0.96))]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-primary/15 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mb-1">{t("dashboard.jobName")}</p>
              <p className="text-sm font-semibold text-gray-900">{job.job || "—"}</p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mb-1">{t("dashboard.date")}</p>
              <p className="text-sm font-semibold text-gray-900">{job.date || "—"}</p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mb-1">{t("dashboard.status")}</p>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-primary/10 bg-white/92 shadow-[0_12px_30px_rgba(122,99,241,0.08)] p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#1e1c2f] border-b border-gray-200/80 pb-2">
              {t("dashboard.jobInfo")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.jobName") || "Nume Job"}</p>
                <p className="text-sm font-medium text-gray-900">{job.job || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.location") || "Locație"}</p>
                <p className="text-sm font-medium text-gray-900">{job.location || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.date") || "Data"}</p>
                <p className="text-sm font-medium text-gray-900">{job.date || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.time") || "Ora"}</p>
                <p className="text-sm font-medium text-gray-900">
                  {job.startTime && job.endTime ? `${job.startTime} – ${job.endTime}` : "—"}
                </p>
              </div>
              {jobTypeLabel && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("dashboard.jobTitle")}</p>
                  <p className="text-sm font-medium text-gray-900">{jobTypeLabel}</p>
                </div>
              )}
              {job.jobCategoryTitle && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("dashboard.category") || "Categorie"}</p>
                  <p className="text-sm font-medium text-gray-900">{job.jobCategoryTitle}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-primary/10 bg-white/92 shadow-[0_12px_30px_rgba(122,99,241,0.08)] p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#1e1c2f] border-b border-gray-200/80 pb-2">
              {t("dashboard.staffInfoTitle")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="rounded-2xl border border-gray-100 bg-[#faf8ff] p-4">
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.staffName") || "Nume Angajat"}</p>
                <p className="text-sm font-medium text-gray-900">{application.staffName || "—"}</p>
              </div>
              {application.staffEmail && (
                <div className="rounded-2xl border border-gray-100 bg-[#faf8ff] p-4">
                  <p className="text-xs text-gray-500 mb-1">{t("dashboard.email") || "Email"}</p>
                  <p className="text-sm font-medium text-gray-900">{application.staffEmail}</p>
                </div>
              )}
              <div className="rounded-2xl border border-gray-100 bg-[#faf8ff] p-4 sm:col-span-2">
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.status") || "Status"}</p>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-primary/10 bg-white/92 shadow-[0_12px_30px_rgba(122,99,241,0.08)] p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#1e1c2f] border-b border-gray-200/80 pb-2">
              {t("dashboard.attendanceInfo")}
            </h3>
            {workSessionsDetails.length > 0 ? (
              <div className="space-y-3">
                {hasAnyCheckOut && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">
                    {t("dashboard.finished")}
                    {": "}
                    <span className="font-normal">
                      {t("dashboard.closedArchivedApplicationsTitle") || "Aplicații închise și arhivate"}
                    </span>
                  </div>
                )}
                {workSessionsDetails.map((session, idx) => (
                  <div key={idx} className="rounded-2xl p-4 border border-primary/10 bg-gradient-to-br from-[#faf8ff] to-white">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
                        {t("dashboard.workDate", { defaultValue: "Data lucrării" })}
                      </p>
                      <span className="text-sm font-semibold text-gray-900">{session.date}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-xs text-gray-500 mb-1">{t("dashboard.checkInTime") || "Check-in"}</p>
                        <p className="text-sm font-medium text-gray-900">{formatTime(session.checkIn)}</p>
                        {session.checkIn && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(session.checkIn)}</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-xs text-gray-500 mb-1">{t("dashboard.checkOutTime") || "Check-out"}</p>
                        <p className="text-sm font-medium text-gray-900">{formatTime(session.checkOut) || "—"}</p>
                        {session.checkOut && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(session.checkOut)}</p>
                        )}
                      </div>
                      {session.hours > 0 && (
                        <div className="sm:col-span-2 rounded-xl border border-primary/10 bg-primary/[0.04] p-3">
                          <p className="text-xs text-gray-500 mb-1">{t("dashboard.hoursWorked") || "Ore lucrate"}</p>
                          <p className="text-sm font-medium text-gray-900">{session.hours.toFixed(2)} {t("dashboard.hours") || "ore"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/[0.03] px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-primary/10 text-primary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M7 3h10l4 4v14H3V3h4z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-800">{t("dashboard.noCheckInOut", { defaultValue: "Nu există informații de check-in/check-out" })}</p>
                <p className="text-xs text-gray-500 mt-1">{t("dashboard.checkInOutDataHint")}</p>
              </div>
            )}
          </div>

          {hasRate && (
            <div className="rounded-[24px] border border-primary/10 bg-white/92 shadow-[0_12px_30px_rgba(122,99,241,0.08)] p-5 sm:p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#1e1c2f] border-b border-gray-200/80 pb-2">
                {t("dashboard.salaryInfo")}
              </h3>
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 sm:p-6 space-y-4 border border-primary/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-primary/20">
                  {job.estimatedSalary && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">{t("dashboard.estimatedSalaryInitial")}</p>
                      <p className="text-lg font-bold text-gray-900">{job.estimatedSalary}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-600 mb-1">{t("dashboard.effectiveTimeWorked")}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {totalHours > 0 ? `${totalHours.toFixed(2)} ore` : t("dashboard.noHoursRecorded")}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">{t("dashboard.hourlyRate") || "Rată orară"}</p>
                    <p className="text-lg font-bold text-gray-900">{hourlyRate!.toFixed(2)} MDL/ora</p>
                  </div>
                  {taxPerHour != null && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">{t("dashboard.taxPerHour") || "Taxă pe oră"}</p>
                      <p className="text-lg font-bold text-gray-900">{taxPerHour.toFixed(2)} MDL/ora</p>
                      <p className="text-xs text-gray-500 mt-0.5">({(BUSINESS_TAX_RATE * 100).toFixed(0)}{t("dashboard.percentOfRate")})</p>
                    </div>
                  )}
                </div>
                {baseSalary != null && (
                  <div className="pt-4 border-t border-primary/20 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{t("dashboard.baseSalary") || "Salariu de bază"}</span>
                      <span className="text-sm font-semibold text-gray-900">{baseSalary.toFixed(2)} MDL</span>
                    </div>
                    {taxAmount != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{t("dashboard.taxAmount") || "Taxă"} ({(BUSINESS_TAX_RATE * 100).toFixed(0)}%)</span>
                        <span className="text-sm font-semibold text-gray-900">{taxAmount.toFixed(2)} MDL</span>
                      </div>
                    )}
                    {maintenanceAmount != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{t("dashboard.maintenanceFee") || "Taxă întreținere"} ({(BUSINESS_MAINTENANCE_RATE * 100).toFixed(0)}%)</span>
                        <span className="text-sm font-semibold text-gray-900">{maintenanceAmount.toFixed(2)} MDL</span>
                      </div>
                    )}
                    {totalSalaryPaid != null && (
                      <div className="flex justify-between items-center pt-3 border-t border-primary/20">
                        <span className="text-base font-semibold text-gray-900">{t("dashboard.totalSalaryPaid") || "Total plătit"}</span>
                        <span className="text-xl font-bold text-primary">{totalSalaryPaid.toFixed(2)} MDL</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confirmation Date */}
          {application.businessConfirmedAt && (
            <div className="rounded-[24px] border border-primary/10 bg-white/92 shadow-[0_12px_30px_rgba(122,99,241,0.08)] p-5 sm:p-6 space-y-2">
              <h3 className="text-base font-semibold text-[#1e1c2f] border-b border-gray-200/80 pb-2">
                {t("dashboard.confirmation")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("dashboard.confirmedOn") || "Confirmat la"}: <span className="font-medium text-gray-900">{formatDateTime(application.businessConfirmedAt)}</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 bg-white/95 border-t border-gray-100 px-5 sm:px-7 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors shadow-sm"
          >
            {t("dashboard.close")}
          </button>
        </div>
      </div>
    </div>
  );

  // Render modal to document.body via portal to ensure viewport-centered positioning
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
