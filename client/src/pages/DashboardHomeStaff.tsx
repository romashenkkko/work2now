import { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { jobsApi, type StaffApplicationItem } from "../api/client";
import { DashboardContext, JobTitleIcon } from "./DashboardLayout";
import StarRating from "../components/StarRating";
import { MapPin, Clock, Calendar, CheckCircle2, XCircle, ClipboardCheck, Archive } from "lucide-react";
import {
  addStaffArchivedJob,
  getArchivedApplicationIds,
  loadStaffArchivedJobs,
  removeStaffArchivedJob,
} from "../utils/staffJobArchive";

const RATING_ICON = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

type JobItem = { id: string; job: string; location: string; jobType?: string; isPromoted?: boolean };

function getJobIconId(jobTitle?: string): string {
  if (!jobTitle) return "waiter";
  const title = jobTitle.toLowerCase();
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

export default function DashboardHomeStaff() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userRating, availableToWork } = useContext(DashboardContext);
  const [toast, setToast] = useState<string | null>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<JobItem[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }>>({});
  const [acceptedApplications, setAcceptedApplications] = useState<StaffApplicationItem[]>([]);
  const [allJobs, setAllJobs] = useState<Array<{ id: string; checkInLat?: number; checkInLng?: number; checkInRadiusM?: number }>>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [checkInOutLoading, setCheckInOutLoading] = useState<string | null>(null);
  const [checkInOutConfirm, setCheckInOutConfirm] = useState<{ type: "checkin" | "checkout"; time: string } | null>(null);
  const [checkInOutError, setCheckInOutError] = useState<string | null>(null);
  const [confirmCheckIn, setConfirmCheckIn] = useState<{ applicationId: string; workDate: string; jobId?: string } | null>(null);
  const [confirmCheckOut, setConfirmCheckOut] = useState<{ applicationId: string; workDate: string; jobId?: string } | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [staffArchiveTick, setStaffArchiveTick] = useState(0);
  const [staffJobsArchiveExpanded, setStaffJobsArchiveExpanded] = useState(false);

  const staffUserId = String(user?.id ?? "");
  const staffArchivedIds = useMemo(() => getArchivedApplicationIds(staffUserId), [staffUserId, staffArchiveTick]);
  const staffArchivedList = useMemo(() => loadStaffArchivedJobs(staffUserId), [staffUserId, staffArchiveTick]);
  const acceptedApplicationsVisible = useMemo(
    () => acceptedApplications.filter((a) => !staffArchivedIds.has(a.id)),
    [acceptedApplications, staffArchivedIds]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchData = () => {
    if (user?.role !== "staff") return;
    setJobsLoading(true);
    Promise.all([jobsApi.list(), jobsApi.myApplications(), jobsApi.myApplicationsList()])
      .then(([jobsRes, appRes, appsListRes]) => {
        const jobsList = (jobsRes.jobs || []) as Array<{ id: string; checkInLat?: number; checkInLng?: number; checkInRadiusM?: number }>;
        setAllJobs(jobsList);
        // Hide jobs from the open list if they already have at least one accepted applicant.
        const openJobs = jobsList.filter((j) => {
          const acceptedCount = Number((j as any).acceptedCount ?? 0);
          return !Number.isFinite(acceptedCount) || acceptedCount <= 0;
        });
        const list = openJobs
          .filter((job, index, arr) => {
            const jobId = String(job.id ?? "").trim();
            if (!jobId) return index === arr.findIndex((item) => String(item.id ?? "").trim() === "");
            return index === arr.findIndex((item) => String(item.id ?? "").trim() === jobId);
          })
          .slice(0, 3)
          .map((j) => ({
            id: String(j.id ?? ""),
            job: String((j as any).job ?? ""),
            location: String((j as any).location ?? ""),
            jobType: (j as any).jobType != null ? String((j as any).jobType) : undefined,
            isPromoted: !!(j as any).isPromoted,
          }));
        setRecommendedJobs(list);
        const byJob = appRes.byJob ?? {};
        setApplicationsByJob(byJob);
        const accepted = (appsListRes.applications || [])
          .filter((app) => app.status === "accepted")
          .map((app) => {
            const latestByJob = app.jobId ? byJob[String(app.jobId)] : undefined;
            if (!latestByJob) return app;
            const mergedWorkSessions =
              latestByJob.workSessions && latestByJob.workSessions.length > 0
                ? latestByJob.workSessions
                : app.workSessions;
            return {
              ...app,
              checkedInAt: latestByJob.checkedInAt ?? app.checkedInAt,
              checkedOutAt: latestByJob.checkedOutAt ?? app.checkedOutAt,
              workSessions: mergedWorkSessions,
            };
          });
        setAcceptedApplications(accepted);
      })
      .catch(() => {
        setRecommendedJobs([]);
        setAcceptedApplications([]);
      })
      .finally(() => setJobsLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [user?.role]);

  const handleApply = (job: JobItem) => {
    const appInfo = applicationsByJob[job.id];
    if (!job.id || appInfo || applyingId) return;
    setApplyingId(job.id);
    jobsApi
      .apply(job.id)
      .then(() => {
        setApplicationsByJob((prev) => ({ ...prev, [job.id]: { status: "pending", applicationId: "" } }));
        showToast(t("dashboard.applySuccess") || "Ai aplicat cu succes.");
        fetchData();
      })
      .catch(() => showToast(t("dashboard.applyError") || "Nu s-a putut trimite aplicarea."))
      .finally(() => setApplyingId(null));
  };

  const getCurrentWorkDate = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  type WorkSession = NonNullable<StaffApplicationItem["workSessions"]>[number];

  const getEffectiveSession = (
    app: StaffApplicationItem,
    fallbackWorkDate: string
  ): { session: WorkSession | null; effectiveWorkDate: string } => {
    const sessions = app.workSessions ?? [];
    const targetKey = normDate(fallbackWorkDate);

    const parseTime = (iso?: string) => {
      if (!iso) return 0;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const localDateKey = (iso?: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    // Prefer the most recent session that has timestamps (works even if workDate != "azi").
    // This fixes cases where the backend stores the session under a different workDate string
    // (timezone / previous day) and the UI would previously show "Check-in" incorrectly.
    const sessionCandidates = sessions
      .filter((s) => !!s.checkedInAt || !!s.checkedOutAt)
      .map((s) => {
        const hasOut = !!s.checkedOutAt;
        const t = Math.max(parseTime(s.checkedOutAt), parseTime(s.checkedInAt));
        const workDateKey = normDate(s.workDate);
        return { s, hasOut, t, workDateKey };
      })
      .sort((a, b) => {
        if (a.hasOut !== b.hasOut) return a.hasOut ? -1 : 1; // prefer checked-out sessions
        return b.t - a.t;
      });

    // If application-level timestamps exist for the same day, prefer them.
    // This covers cases where `application_work_sessions` row may be missing/partial,
    // but the job is already completed in `applications.checked_out_at`.
    if (app.checkedOutAt && localDateKey(app.checkedOutAt) === targetKey) {
      return {
        session: {
          workDate: targetKey,
          checkedInAt: app.checkedInAt,
          checkedOutAt: app.checkedOutAt,
        },
        effectiveWorkDate: targetKey,
      };
    }

    if (!app.checkedOutAt && app.checkedInAt && localDateKey(app.checkedInAt) === targetKey) {
      return {
        session: {
          workDate: targetKey,
          checkedInAt: app.checkedInAt,
          checkedOutAt: app.checkedOutAt,
        },
        effectiveWorkDate: targetKey,
      };
    }

    if (sessionCandidates.length > 0) {
      const forTarget = sessionCandidates.filter((c) => c.workDateKey === targetKey);
      const best = (forTarget.length > 0 ? forTarget : sessionCandidates)[0].s;
      return { session: best, effectiveWorkDate: normDate(best.workDate) };
    }

    // Fallback: legacy data (application.checkedInAt / checkedOutAt)
    if (app.checkedOutAt) {
      const d = normDate(app.checkedOutAt);
      return {
        session: { workDate: d, checkedInAt: app.checkedInAt, checkedOutAt: app.checkedOutAt },
        effectiveWorkDate: d,
      };
    }

    if (app.checkedInAt) {
      const d = normDate(app.checkedInAt);
      return {
        session: { workDate: d, checkedInAt: app.checkedInAt, checkedOutAt: app.checkedOutAt },
        effectiveWorkDate: d,
      };
    }

    // Nothing recorded yet: default to today's workDate for the action buttons.
    return { session: null, effectiveWorkDate: targetKey };
  };

  const normDate = (s: string) => (s || "").trim().slice(0, 10);

  const showCheckInOutConfirm = (type: "checkin" | "checkout") => {
    const time = new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    setCheckInOutError(null);
    setCheckInOutConfirm({ type, time });
    setTimeout(() => setCheckInOutConfirm(null), 5000);
  };

  const formatWorkDateLabel = (workDate?: string) => {
    if (!workDate) return null;
    const d = parseYMD(workDate);
    if (!d) return workDate;
    const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
    const weekday = t(`dashboard.weekdayShort.${weekdayKeys[d.getDay()]}`);
    const month = t(`dashboard.monthShort.${monthKeys[d.getMonth()]}`);
    return `${weekday}, ${d.getDate()} ${month}`;
  };

  const parseYMD = (str: string): Date | null => {
    if (!str) return null;
    const [y, m, day] = str.split("-").map(Number);
    if (!y || !m || !day) return null;
    const d = new Date(y, m - 1, day);
    return isNaN(d.getTime()) ? null : d;
  };

  const handleCheckIn = (e: React.MouseEvent, applicationId: string, workDate?: string, jobId?: string) => {
    e?.stopPropagation?.();
    const key = workDate ? `${applicationId}-${workDate}` : applicationId;
    const wd = workDate ?? getCurrentWorkDate();
    setConfirmCheckIn(null);
    setConfirmCheckOut(null);
    setCheckInOutLoading(key);
    setCheckInOutError(null);

    const job = jobId ? allJobs.find((j) => String(j.id) === String(jobId)) : null;
    const jobRow = job as { checkInLat?: number; checkInLng?: number; checkInRadiusM?: number } | undefined;
    const needsGeo = jobRow?.checkInLat != null && jobRow?.checkInLng != null && jobRow?.checkInRadiusM != null;

    const doCheckIn = (geo?: { lat: number; lng: number }) => {
      // Optimistic update: immediately update the session state
      const now = new Date().toISOString();
      const normalizedWd = normDate(wd);
      setAcceptedApplications((prev) => {
        return prev.map((app) => {
          if (app.id === applicationId) {
            const sessions = [...(app.workSessions || [])];
            const sessionIndex = sessions.findIndex((s) => normDate(s.workDate) === normalizedWd);
            if (sessionIndex >= 0) {
              sessions[sessionIndex] = { ...sessions[sessionIndex], checkedInAt: now };
            } else {
              sessions.push({ workDate: normalizedWd, checkedInAt: now });
            }
            return { ...app, workSessions: sessions };
          }
          return app;
        });
      });

      jobsApi
        .checkIn(applicationId, wd, geo)
        .then(async () => {
          showCheckInOutConfirm("checkin");
          try {
            await new Promise((r) => setTimeout(r, 350));
            fetchData();
          } catch (_) {}
        })
        .catch(async (err) => {
          setConfirmCheckIn(null);
          setConfirmCheckOut(null);
          // Revert optimistic update on error
          fetchData();
          const msg = err instanceof Error ? err.message : (typeof err === "object" && err !== null && "error" in (err as { error?: string }) ? (err as { error: string }).error : String(err)) || "Eroare la check-in";
          const msgLower = String(msg).toLowerCase();
          if (msgLower.includes("deja efectuat") || msgLower.includes("already")) {
            try { await fetchData(); } catch (_) {}
            showCheckInOutConfirm("checkin");
          } else {
            try { await fetchData(); } catch (_) {}
            setCheckInOutError(
              /not within the allowed location radius/i.test(msg) ? t("dashboard.locationRadiusError") : msg
            );
            setTimeout(() => setCheckInOutError(null), 5000);
          }
        })
        .finally(() => setCheckInOutLoading(null));
    };

    if (needsGeo && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          doCheckIn({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setCheckInOutError(t("dashboard.checkInShareLocation"));
          setTimeout(() => setCheckInOutError(null), 5000);
          setCheckInOutLoading(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      doCheckIn();
    }
  };

  const handleCheckOut = (e: React.MouseEvent, applicationId: string, workDate?: string, jobId?: string) => {
    e?.stopPropagation?.();
    const key = workDate ? `${applicationId}-${workDate}` : applicationId;
    const wdOut = workDate ?? getCurrentWorkDate();
    setConfirmCheckIn(null);
    setConfirmCheckOut(null);
    setCheckInOutLoading(key);
    setCheckInOutError(null);

    const jobOut = jobId ? allJobs.find((j) => String(j.id) === String(jobId)) : null;
    const jobOutRow = jobOut as { checkInLat?: number; checkInLng?: number; checkInRadiusM?: number } | undefined;
    const needsGeoOut = jobOutRow?.checkInLat != null && jobOutRow?.checkInLng != null && jobOutRow?.checkInRadiusM != null;

    const doCheckOut = (geo?: { lat: number; lng: number }) => {
      // Optimistic update: immediately update the session state
      const now = new Date().toISOString();
      const normalizedWdOut = normDate(wdOut);
      setAcceptedApplications((prev) => {
        return prev.map((app) => {
          if (app.id === applicationId) {
            const sessions = [...(app.workSessions || [])];
            const sessionIndex = sessions.findIndex((s) => normDate(s.workDate) === normalizedWdOut);
            if (sessionIndex >= 0) {
              sessions[sessionIndex] = { ...sessions[sessionIndex], checkedOutAt: now };
            } else {
              // If session doesn't exist, create it with both check-in and check-out
              const existingCheckIn = sessions.find((s) => normDate(s.workDate) === normalizedWdOut)?.checkedInAt || now;
              sessions.push({ workDate: normalizedWdOut, checkedInAt: existingCheckIn, checkedOutAt: now });
            }
            return { ...app, workSessions: sessions };
          }
          return app;
        });
      });

      jobsApi
        .checkOut(applicationId, wdOut, geo)
        .then(async () => {
          showCheckInOutConfirm("checkout");
          try {
            await new Promise((r) => setTimeout(r, 350));
            fetchData();
          } catch (_) {}
        })
        .catch(async (err) => {
          setConfirmCheckIn(null);
          setConfirmCheckOut(null);
          // Revert optimistic update on error
          fetchData();
          const msg = err instanceof Error ? err.message : (typeof err === "object" && err !== null && "error" in (err as { error?: string }) ? (err as { error: string }).error : String(err)) || "Eroare la check-out";
          const msgLower = String(msg).toLowerCase();
          if (msgLower.includes("deja efectuat") || msgLower.includes("already")) {
            try { await fetchData(); } catch (_) {}
            showCheckInOutConfirm("checkout");
          } else {
            try { await fetchData(); } catch (_) {}
            setCheckInOutError(
              /not within the allowed location radius/i.test(msg) ? t("dashboard.locationRadiusError") : msg
            );
            setTimeout(() => setCheckInOutError(null), 5000);
          }
        })
        .finally(() => setCheckInOutLoading(null));
    };

    if (needsGeoOut && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          doCheckOut({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setCheckInOutError(t("dashboard.checkInShareLocation"));
          setTimeout(() => setCheckInOutError(null), 5000);
          setCheckInOutLoading(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      doCheckOut();
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  };

  const formatDate = (ymd?: string) => {
    if (!ymd) return "";
    try {
      const [y, m, d] = ymd.split("-");
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return date.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short" });
    } catch {
      return ymd;
    }
  };

  const acceptedJobsCount = acceptedApplications.length;
  const finishedJobsCount = useMemo(() => {
    return acceptedApplications.filter(
      (app) =>
        !!app.checkedOutAt ||
        (app.workSessions && app.workSessions.some((s) => !!s.checkedOutAt))
    ).length;
  }, [acceptedApplications]);
  const pendingCount = useMemo(() => {
    return Object.values(applicationsByJob).filter((app) => app.status === "pending").length;
  }, [applicationsByJob]);

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      {checkInOutConfirm && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${checkInOutConfirm.type === "checkin" ? "bg-green-200" : "bg-amber-200"}`}>
            <span className={`text-xl ${checkInOutConfirm.type === "checkin" ? "text-green-700" : "text-amber-700"}`}>
              ✓
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold ${checkInOutConfirm.type === "checkin" ? "text-green-900" : "text-amber-900"}`}>
              {checkInOutConfirm.type === "checkin" ? t("dashboard.checkInConfirm") : t("dashboard.checkOutConfirm")}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {checkInOutConfirm.type === "checkin"
                ? t("dashboard.checkInAtTime", { time: checkInOutConfirm.time })
                : t("dashboard.checkOutAtTime", { time: checkInOutConfirm.time })}
            </p>
          </div>
        </div>
      )}
      {checkInOutError && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium shadow-lg">
          {checkInOutError}
        </div>
      )}
      {(confirmCheckIn || confirmCheckOut) && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
          onClick={() => { setConfirmCheckIn(null); setConfirmCheckOut(null); }}
        >
          <div
            className="modal-content-enter bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-6 pt-7 flex flex-col gap-5 ${confirmCheckIn ? "bg-gradient-to-b from-green-50/80 to-white" : "bg-gradient-to-b from-amber-50/80 to-white"}`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${confirmCheckIn ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                  <Clock className="w-6 h-6" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 font-semibold text-base leading-snug">
                    {confirmCheckIn ? t("dashboard.confirmCheckIn") : t("dashboard.confirmCheckOut")}
                  </p>
                  {(() => {
                    const forDateLabel = formatWorkDateLabel(confirmCheckIn?.workDate ?? confirmCheckOut?.workDate);
                    return forDateLabel ? <p className="mt-2 text-sm text-gray-600">{t("dashboard.forDate", { date: forDateLabel })}</p> : null;
                  })()}
                  {confirmCheckIn?.jobId && (() => {
                    const j = allJobs.find((job) => String(job.id) === String(confirmCheckIn!.jobId)) as { checkInLat?: number; checkInLng?: number; checkInRadiusM?: number } | undefined;
                    if (j?.checkInLat != null && j?.checkInLng != null && j?.checkInRadiusM != null) {
                      return <p className="mt-2 text-sm text-gray-600">{t("dashboard.checkInLocationHint")}</p>;
                    }
                    return null;
                  })()}
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{t("dashboard.currentTime")}: <strong className="text-gray-900 font-mono">{new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setConfirmCheckIn(null); setConfirmCheckOut(null); }}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  {t("dashboard.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!!checkInOutLoading}
                  onClick={() => {
                    if (confirmCheckIn) {
                      handleCheckIn({ stopPropagation: () => {} } as React.MouseEvent, confirmCheckIn.applicationId, confirmCheckIn.workDate, confirmCheckIn.jobId);
                    } else if (confirmCheckOut) {
                      handleCheckOut({ stopPropagation: () => {} } as React.MouseEvent, confirmCheckOut.applicationId, confirmCheckOut.workDate, confirmCheckOut.jobId);
                    }
                  }}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-white shadow-sm transition-colors disabled:opacity-60 disabled:pointer-events-none ${confirmCheckIn ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}`}
                >
                  {checkInOutLoading ? "..." : t("dashboard.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="page-enter-stagger">
        <header className="mb-6 md:mb-8 w-full flex items-center justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f] truncate">{t("dashboard.hello", { name: user?.name ?? "" })}</h1>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md">{t("dashboard.staffSubtitle")}</p>
          </div>
          <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[#9d7bff] text-white shadow-[0_8px_20px_rgba(122,99,241,0.3)] items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </header>

        {/* 1 col mobil → 2 col → 3 col (tablet/laptop) → 5 col doar pe ecrane foarte late (evită carduri înguste) */}
        <section className="w-full min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 sm:gap-5 mb-6 md:mb-8">
          <article className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug line-clamp-2">{t("dashboard.statsMyApplications")}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">{pendingCount}</p>
            </div>
          </article>
          <article className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug line-clamp-2">{t("dashboard.statsAcceptedJobs") || "Joburi acceptate"}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">{acceptedJobsCount}</p>
            </div>
          </article>
          <article className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug line-clamp-2">{t("dashboard.statsFinishedJobs") || "Joburi finisate"}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">{finishedJobsCount}</p>
            </div>
          </article>
          <article className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6">
              {RATING_ICON}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug line-clamp-2">{t("dashboard.statsMyRating")}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StarRating value={userRating?.average ?? 0} size={16} />
                {userRating && userRating.count > 0 && (
                  <span className="text-xs text-gray-500 whitespace-nowrap">({userRating.count})</span>
                )}
              </div>
            </div>
          </article>
          <article className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-primary/30 bg-primary/5 shadow-sm flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug line-clamp-2">{t("dashboard.statsAvailability")}</h3>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 break-words leading-tight">
                {availableToWork ? t("dashboard.statsAvailabilityActive") : t("dashboard.statsAvailabilityInactive")}
              </p>
            </div>
          </article>
        </section>

        {acceptedApplications.length > 0 && (
          <section className="mb-6 md:mb-8">
            <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between gap-2">
                <h2 className="font-bold text-gray-900 text-sm sm:text-base truncate">{t("dashboard.myAcceptedJobs") || "Joburile mele acceptate"}</h2>
              </div>
              {acceptedApplicationsVisible.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
                  {t("dashboard.allAcceptedJobsInArchive", "Toate joburile acceptate sunt în arhivă. Vezi secțiunea Joburi arhivate mai jos.")}
                </div>
              ) : (
              <div className="divide-y divide-gray-100">
                  {acceptedApplicationsVisible.map((app) => {
                    const todayWorkDate = getCurrentWorkDate();
                    const { session, effectiveWorkDate } = getEffectiveSession(app, todayWorkDate);
                  const isExpanded = expandedJobId === app.jobId;
                    const isLoading = checkInOutLoading?.startsWith(`${app.id}-${effectiveWorkDate}`);

                    const sessionsArr = app.workSessions ?? [];
                    const hasAnyCheckedIn =
                      !!(session?.checkedInAt ?? app.checkedInAt) ||
                      sessionsArr.some((s) => !!s.checkedInAt) ||
                      false;
                    const hasAnyCheckedOut =
                      !!(session?.checkedOutAt ?? app.checkedOutAt) ||
                      sessionsArr.some((s) => !!s.checkedOutAt) ||
                      false;
                    const checkedInAtToShow = session?.checkedInAt ?? app.checkedInAt;
                    const checkedOutAtToShow = session?.checkedOutAt ?? app.checkedOutAt;
                  
                  return (
                    <div key={app.id} className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <JobTitleIcon
                              jobId={getJobIconId(app.jobTitle)}
                              className="w-5 h-5 text-primary flex-shrink-0"
                              size={20}
                            />
                            <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{app.jobTitle || t("dashboard.job")}</h3>
                            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">
                              {t("dashboard.accepted")}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-sm text-gray-600">
                            {app.jobLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="truncate">{app.jobLocation}</span>
                              </div>
                            )}
                            {app.jobDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                                <span>{formatDate(app.jobDate)}{app.jobEndDate && app.jobEndDate !== app.jobDate ? ` - ${formatDate(app.jobEndDate)}` : ""}</span>
                              </div>
                            )}
                            {app.customerName && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{t("dashboard.customer") || "Client"}:</span>
                                <span className="font-medium">{app.customerName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex w-full min-w-0 flex-shrink-0 flex-col items-stretch gap-2 sm:mt-0 sm:w-52">
                          {!hasAnyCheckedIn ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmCheckIn({ applicationId: app.id, workDate: effectiveWorkDate, jobId: app.jobId }); }}
                              disabled={!!isLoading}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {isLoading ? "..." : t("dashboard.checkIn") || "Check-in"}
                            </button>
                          ) : !hasAnyCheckedOut ? (
                            <>
                              <p className="text-center text-xs text-gray-500 sm:text-right">
                                {t("dashboard.checkedInAt")} {formatTime(checkedInAtToShow)}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmCheckOut({ applicationId: app.id, workDate: effectiveWorkDate, jobId: app.jobId }); }}
                                disabled={!!isLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                {isLoading ? "..." : t("dashboard.checkOut") || "Check-out"}
                              </button>
                            </>
                          ) : (
                            <p className="py-1 text-center text-sm text-gray-600 sm:text-right">
                              {t("dashboard.checkedInAt")} {formatTime(checkedInAtToShow)} · {t("dashboard.checkedOutAt")} {formatTime(checkedOutAtToShow)}
                            </p>
                          )}
                          {hasAnyCheckedOut && !staffArchivedIds.has(app.id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                let checkedOutAt = app.checkedOutAt;
                                for (const s of sessionsArr) {
                                  if (!s.checkedOutAt) continue;
                                  if (!checkedOutAt || new Date(s.checkedOutAt) > new Date(checkedOutAt)) checkedOutAt = s.checkedOutAt;
                                }
                                addStaffArchivedJob(staffUserId, {
                                  applicationId: app.id,
                                  jobId: String(app.jobId ?? ""),
                                  jobTitle: app.jobTitle,
                                  jobLocation: app.jobLocation,
                                  customerName: app.customerName,
                                  checkedOutAt,
                                });
                                setStaffArchiveTick((n) => n + 1);
                                showToast(t("dashboard.jobArchivedToast", "Job mutat în arhivă."));
                              }}
                              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                            >
                              <Archive className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                              {t("dashboard.archiveJob", "Arhivează")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedJobId(isExpanded ? null : app.jobId)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/10 hover:shadow-md"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                              <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </span>
                            {isExpanded ? t("dashboard.hideDetails") || "Ascunde detalii" : t("dashboard.showDetails") || "Vezi detalii"}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">{t("dashboard.workSessions") || "Sesiuni de lucru"}</h4>
                              <div className="space-y-2">
                                {app.workSessions && app.workSessions.length > 0 ? (
                                  app.workSessions.map((s, idx) => (
                                    <div key={idx} className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                                      <div className="font-medium text-gray-900">{formatDate(s.workDate)}</div>
                                      {s.checkedInAt && (
                                        <div className="text-xs text-gray-600 mt-1">
                                          {t("dashboard.checkedInAt")} {formatTime(s.checkedInAt)}
                                        </div>
                                      )}
                                      {s.checkedOutAt && (
                                        <div className="text-xs text-gray-600">
                                          {t("dashboard.checkedOutAt")} {formatTime(s.checkedOutAt)}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-gray-500 text-xs">{t("dashboard.noWorkSessions") || "Nu există sesiuni de lucru"}</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">{t("dashboard.jobInformation") || "Informații job"}</h4>
                              <div className="space-y-2 text-xs text-gray-600">
                                <div>
                                  <span className="font-medium">{t("dashboard.applicationId") || "ID aplicație"}:</span> {app.id}
                                </div>
                                {app.createdAt && (
                                  <div>
                                    <span className="font-medium">{t("dashboard.appliedAt") || "Aplicat la"}:</span> {new Date(app.createdAt).toLocaleDateString("ro-RO")}
                                  </div>
                                )}
                                {app.ratingScore && (
                                  <div>
                                    <span className="font-medium">{t("dashboard.rating") || "Rating"}:</span> {app.ratingScore}/5
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </section>
        )}

        <section className="mb-6 md:mb-8">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl">
            <button
              type="button"
              onClick={() => setStaffJobsArchiveExpanded((v) => !v)}
              className="flex w-full items-center justify-between border-b border-gray-200 p-3 transition-colors hover:bg-gray-50 sm:p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Archive className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 text-left">
                  <h2 className="truncate text-sm font-bold text-gray-900 sm:text-base">
                    {t("dashboard.staffArchivedJobsTitle", "Joburi arhivate")}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t("dashboard.staffArchivedJobsDesc", "Joburi finalizate pe care le-ai mutat din listă.")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {staffArchivedList.length > 0 && (
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {staffArchivedList.length}
                  </span>
                )}
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${staffJobsArchiveExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${staffJobsArchiveExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              aria-hidden={!staffJobsArchiveExpanded}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {staffArchivedList.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-gray-500 sm:px-6">
                      {t("dashboard.staffArchivedJobsEmpty", "Niciun job arhivat. După check-out final, folosește „Arhivează” pe cardul jobului.")}
                    </div>
                  ) : (
                    staffArchivedList.map((entry) => (
                      <div
                        key={entry.applicationId}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{entry.jobTitle || t("dashboard.job")}</p>
                          {entry.jobLocation && (
                            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-gray-600">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="line-clamp-2">{entry.jobLocation}</span>
                            </p>
                          )}
                          {entry.customerName && (
                            <p className="mt-1 text-xs text-gray-500">
                              {t("dashboard.customer")}: <span className="font-medium text-gray-700">{entry.customerName}</span>
                            </p>
                          )}
                          {entry.checkedOutAt && (
                            <p className="mt-1 text-xs text-gray-500">
                              {t("dashboard.checkedOutAt")} {formatTime(entry.checkedOutAt)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            removeStaffArchivedJob(staffUserId, entry.applicationId);
                            setStaffArchiveTick((n) => n + 1);
                            showToast(t("dashboard.jobRestoredFromArchive", "Job readus în lista activă."));
                          }}
                          className="shrink-0 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/30 hover:bg-primary/5 hover:text-primary sm:self-center"
                        >
                          {t("dashboard.restoreFromArchive", "Restaurează")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 md:mb-8">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:rounded-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 p-3 sm:p-4">
              <h2 className="truncate text-sm font-bold text-gray-900 sm:text-base">{t("dashboard.recommendedJobs")}</h2>
              <Link to="/dashboard/joburi" className="flex-shrink-0 text-sm font-medium text-primary hover:underline">
                {t("dashboard.seeAll")}
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {jobsLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">{t("dashboard.loading") || "Se încarcă..."}</div>
              ) : recommendedJobs.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">{t("dashboard.noRecommendedJobs") || "Niciun job public disponibil."}</div>
              ) : (
                recommendedJobs.map((j, idx) => {
                  const appInfo = applicationsByJob[j.id];
                  const applied = !!appInfo;
                  return (
                    <div
                      key={`${j.id || "job"}-${idx}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50/50 sm:p-4"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900 sm:text-base">
                          {j.job}
                          {j.isPromoted && (
                            <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-xs font-medium text-white">
                              {t("dashboard.promovareBoosterShort", "Booster")}
                            </span>
                          )}
                        </p>
                        <span className="truncate text-xs text-gray-500 sm:text-sm">
                          {j.location}
                          {j.jobType ? ` · ${j.jobType}` : ""}
                        </span>
                      </div>
                      {applied ? (
                        <span className="flex-shrink-0 text-sm text-gray-500">
                          {appInfo?.status === "accepted" ? t("dashboard.accepted") : t("dashboard.pending")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApply(j)}
                          disabled={!!applyingId}
                          className="flex-shrink-0 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          {applyingId === j.id ? "..." : t("dashboard.apply")}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
