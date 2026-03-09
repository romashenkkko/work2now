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
  useEffect(() => {
    if (!user?.id) return;
    const intervalId = setInterval(() => {
      fetchApplications();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(intervalId);
  }, [user?.id, fetchApplications]);

  const allJobs = useMemo(() => [...jobsAdded], [jobsAdded]);


  // Compute jobs with no accepted applications
  const jobsWithNoAcceptances = useMemo(() => {
    const noAcceptances: JobRow[] = [];
    allJobs.forEach((job, i) => {
      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
      const apps = applicationsByJob[jobId] ?? [];
      
      // Check if job has any accepted applications
      const hasAcceptedApp = apps.some((app) => {
        const status = String(app.status).toLowerCase();
        return status === "accepted";
      });
      
      // If no accepted applications, this job belongs in "Posted Jobs (No Acceptances)"
      if (!hasAcceptedApp) {
        noAcceptances.push(job);
      }
    });
    return noAcceptances;
  }, [allJobs, applicationsByJob]);

  // Compute active jobs (jobs with accepted applications that are pending or in progress)
  const activeJobs = useMemo(() => {
    const active: JobRow[] = [];
    allJobs.forEach((job, i) => {
      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
      const apps = applicationsByJob[jobId] ?? [];
      
      // Must have at least one accepted application
      const hasAcceptedApp = apps.some((app) => {
        const status = String(app.status).toLowerCase();
        return status === "accepted";
      });
      
      if (!hasAcceptedApp) return; // Skip jobs with no accepted applications
      
      // Check if job has any active applications
      // Active: applications that don't have check-in/check-out OR have only check-in without checkout
      const hasActiveApp = apps.some((app) => {
        const status = String(app.status).toLowerCase();
        if (status === "pending") return true; // Pending applications are always active
        if (status === "accepted") {
          const isConfirmed = app.isBusinessConfirmed || !!app.businessConfirmedAt;
          if (isConfirmed) return false; // Confirmed applications are archived
          
          // Check work sessions first
          if (app.workSessions && app.workSessions.length > 0) {
            // If any session has check-in but no check-out, it's active
            return app.workSessions.some((s) => s.checkedInAt && !s.checkedOutAt);
          }
          
          // Fallback to application-level check-in/check-out
          // Active if: no check-in at all, OR has check-in but no check-out
          return !app.checkedInAt || (app.checkedInAt && !app.checkedOutAt);
        }
        return false;
      });
      
      if (hasActiveApp) {
        active.push(job);
      }
    });
    return active;
  }, [allJobs, applicationsByJob]);

  const archivedJobs = useMemo(() => {
    const archived: JobRow[] = [];
    allJobs.forEach((job, i) => {
      const jobId = ("id" in job && job.id != null ? String(job.id) : `job-${i}`);
      const apps = applicationsByJob[jobId] ?? [];
      
      // If no applications, skip (not archived)
      if (apps.length === 0) return;
      
      // Check if all applications are archived (have check-out or are confirmed)
      const allArchived = apps.every((app) => {
        const status = String(app.status).toLowerCase();
        if (status === "pending") return false; // Pending applications are not archived
        
        const isConfirmed = app.isBusinessConfirmed || !!app.businessConfirmedAt;
        if (isConfirmed) return true; // Confirmed applications are archived
        
        // Check work sessions first
        if (app.workSessions && app.workSessions.length > 0) {
          // All sessions must have check-out
          return app.workSessions.every((s) => s.checkedOutAt);
        }
        
        // Fallback to application-level: must have check-out
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
      <div className="page-enter-stagger">
      <header className="mb-6 md:mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f] truncate">{t("dashboard.hello", { name: user?.name ?? "" })}</h1>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md">{t("dashboard.subtitleToday")}</p>
        </div>
      </header>

      {/* Active Jobs Section - Aplicații În Proces */}
      <section className="mb-6 md:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Aplicații În Proces</h2>
            <p className="text-xs text-gray-500 mt-1">Joburi cu angajați acceptați, fără check-in/check-out sau doar cu check-in</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobTitle")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.status")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.time")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {activeJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 sm:p-12 text-center">
                      <p className="text-gray-500 text-sm sm:text-base mb-4">{t("dashboard.noActiveJobs") || "Nu există joburi active"}</p>
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
                  activeJobs.map((row, i) => {
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
                        className={`border-b border-gray-100 hover:bg-gray-50/50 ${firstApp ? "cursor-pointer" : ""}`}
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
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${row.statusClass}`}>{row.status}</span>
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
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6h8M7 6V4a2 2 0 012-2h6a2 2 0 012 2v2" />
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
          {jobsWithNoAcceptances.length > 0 && (
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

      {/* Posted Jobs (No Acceptances) Section - Aplicații Deschise */}
      <section className="mb-6 md:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Aplicații Deschise</h2>
            <p className="text-xs text-gray-500 mt-1">Joburi postate care nu au încă angajați acceptați</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobTitle")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.status")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.time")}</th>
                  <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {jobsWithNoAcceptances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 sm:p-12 text-center">
                      <p className="text-gray-500 text-sm sm:text-base mb-4">{t("dashboard.noPostedJobsNoAcceptances") || "Nu există joburi postate fără acceptări"}</p>
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
                  jobsWithNoAcceptances.map((row, i) => {
                    // Match jobId the same way as in useMemo calculations
                    const jobId = ("id" in row && row.id != null ? String(row.id) : `job-${i}`);
                    const apps = applicationsByJob[jobId] ?? [];
                    // Get first application (even if pending) to show in modal
                    const firstApp = apps.length > 0 ? apps[0] : null;
                    const handleRowClick = () => {
                      // Always open modal if there's an application (including pending)
                      if (firstApp) {
                        setSelectedApplication({ job: row, application: firstApp });
                      }
                    };
                    return (
                      <tr 
                        key={jobId} 
                        onClick={handleRowClick}
                        className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${firstApp ? "cursor-pointer" : ""}`}
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
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${row.statusClass}`}>{row.status}</span>
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
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6h8M7 6V4a2 2 0 012-2h6a2 2 0 012 2v2" />
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
          {activeJobs.length > 0 && (
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

      {/* Archived Jobs Section */}
      <section className="mb-6 md:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setJobsArchiveExpanded(!jobsArchiveExpanded)}
            className="w-full p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              </span>
              <div className="text-left">
                <h2 className="font-bold text-gray-900 text-sm sm:text-base">Aplicații Închise și Arhivate</h2>
                <p className="text-xs text-gray-500 mt-0.5">Joburi finalizate cu check-out completat</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {archivedJobs.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                  {archivedJobs.length}
                </span>
              )}
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${jobsArchiveExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {jobsArchiveExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-gray-500 border-b border-gray-200 bg-gray-50/80">
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobName")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.location")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.jobTitle")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.status")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.date")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.time")}</th>
                    <th className="p-3 sm:p-4 font-medium">{t("dashboard.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 sm:p-12 text-center">
                        <p className="text-gray-500 text-sm sm:text-base">{t("dashboard.noArchivedJobs") || "Nu există joburi arhivate"}</p>
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
                      return (
                        <tr 
                          key={jobId} 
                          onClick={handleRowClick}
                          className={`border-b border-gray-100 hover:bg-gray-50/50 ${firstApp ? "cursor-pointer" : ""}`}
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
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${row.statusClass}`}>{row.status}</span>
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
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6h8M7 6V4a2 2 0 012-2h6a2 2 0 012 2v2" />
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
          )}
        </div>
      </section>

      </div>

      {/* Application Details Modal */}
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
    application.workSessions.forEach((session) => {
      if (session.checkedInAt && session.checkedOutAt) {
        const hours = hoursBetween(session.checkedInAt, session.checkedOutAt);
        totalHours += hours;
        workSessionsDetails.push({
          date: session.workDate || "—",
          checkIn: session.checkedInAt,
          checkOut: session.checkedOutAt,
          hours,
        });
      } else if (session.checkedInAt) {
        workSessionsDetails.push({
          date: session.workDate || "—",
          checkIn: session.checkedInAt,
          hours: 0,
        });
      }
    });
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

  const modalContent = (
    <div
      className="modal-backdrop-anim fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-details-title"
    >
      <div
        className="modal-panel-anim bg-white rounded-2xl shadow-xl max-w-3xl max-h-[95vh] w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between">
          <h2 id="application-details-title" className="text-lg sm:text-xl font-bold text-gray-900">
            Detalii Aplicație
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Închide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          {/* Job Information */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Informații Job
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
              {job.jobCategoryTitle && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("dashboard.category") || "Categorie"}</p>
                  <p className="text-sm font-medium text-gray-900">{job.jobCategoryTitle}</p>
                </div>
              )}
            </div>
          </div>

          {/* Staff Information */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Informații Angajat
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.staffName") || "Nume Angajat"}</p>
                <p className="text-sm font-medium text-gray-900">{application.staffName || "—"}</p>
              </div>
              {application.staffEmail && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("dashboard.email") || "Email"}</p>
                  <p className="text-sm font-medium text-gray-900">{application.staffEmail}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("dashboard.status") || "Status"}</p>
                <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${
                  application.status === "accepted" ? "bg-green-100 text-green-700" :
                  application.status === "pending" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {application.status === "accepted" ? (t("dashboard.accepted") || "Acceptat") :
                   application.status === "pending" ? (t("dashboard.pending") || "În așteptare") :
                   (t("dashboard.refused") || "Refuzat")}
                </span>
              </div>
            </div>
          </div>

          {/* Check-in/Check-out Information */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Informații Prezență
            </h3>
            {workSessionsDetails.length > 0 ? (
              <div className="space-y-3">
                {workSessionsDetails.map((session, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">{t("dashboard.workDate") || "Data lucrării"}: {session.date}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("dashboard.checkInTime") || "Check-in"}</p>
                        <p className="text-sm font-medium text-gray-900">{formatTime(session.checkIn)}</p>
                        {session.checkIn && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(session.checkIn)}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("dashboard.checkOutTime") || "Check-out"}</p>
                        <p className="text-sm font-medium text-gray-900">{formatTime(session.checkOut) || "—"}</p>
                        {session.checkOut && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(session.checkOut)}</p>
                        )}
                      </div>
                      {session.hours > 0 && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-gray-500 mb-1">{t("dashboard.hoursWorked") || "Ore lucrate"}</p>
                          <p className="text-sm font-medium text-gray-900">{session.hours.toFixed(2)} {t("dashboard.hours") || "ore"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t("dashboard.noCheckInOut") || "Nu există informații de check-in/check-out"}</p>
            )}
          </div>

          {/* Salary Information */}
          {hasRate && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Informații Salariu
              </h3>
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 sm:p-6 space-y-4 border border-primary/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">{t("dashboard.hourlyRate") || "Rată orară"}</p>
                    <p className="text-lg font-bold text-gray-900">{hourlyRate!.toFixed(2)} MDL/ora</p>
                  </div>
                  {taxPerHour != null && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">{t("dashboard.taxPerHour") || "Taxă pe oră"}</p>
                      <p className="text-lg font-bold text-gray-900">{taxPerHour.toFixed(2)} MDL/ora</p>
                      <p className="text-xs text-gray-500 mt-0.5">({(BUSINESS_TAX_RATE * 100).toFixed(0)}% din rată)</p>
                    </div>
                  )}
                  {totalHours > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">{t("dashboard.totalHours") || "Total ore"}</p>
                      <p className="text-lg font-bold text-gray-900">{totalHours.toFixed(2)} {t("dashboard.hours") || "ore"}</p>
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
                {totalHours === 0 && (
                  <p className="text-sm text-amber-600">{t("dashboard.noHoursWorkedYet") || "Nu au fost înregistrate ore lucrate încă"}</p>
                )}
              </div>
            </div>
          )}

          {/* Confirmation Date */}
          {application.businessConfirmedAt && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Confirmare
              </h3>
              <p className="text-sm text-gray-600">
                {t("dashboard.confirmedOn") || "Confirmat la"}: <span className="font-medium text-gray-900">{formatDateTime(application.businessConfirmedAt)}</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );

  // Render modal to document.body via portal to ensure viewport-centered positioning
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
