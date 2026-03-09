import { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { jobsApi, type StaffApplicationItem } from "../api/client";
import { DashboardContext } from "./DashboardLayout";
import StarRating from "../components/StarRating";
import { MapPin, Clock, Calendar, Briefcase, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";

const RATING_ICON = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

type JobItem = { id: string; job: string; location: string; jobType?: string; isPromoted?: boolean };

export default function DashboardHomeStaff() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userRating, availableToWork } = useContext(DashboardContext);
  const [toast, setToast] = useState<string | null>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<JobItem[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string }>>({});
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
          .slice(0, 3)
          .map((j) => ({
            id: String(j.id ?? ""),
            job: String((j as any).job ?? ""),
            location: String((j as any).location ?? ""),
            jobType: (j as any).jobType != null ? String((j as any).jobType) : undefined,
            isPromoted: !!(j as any).isPromoted,
          }));
        setRecommendedJobs(list);
        setApplicationsByJob(appRes.byJob ?? {});
        const accepted = (appsListRes.applications || []).filter((app) => app.status === "accepted");
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

  const getCurrentSession = (app: StaffApplicationItem, workDate: string) => {
    // First check workSessions (for multi-day jobs)
    const session = app.workSessions?.find((s) => normDate(s.workDate) === normDate(workDate));
    if (session) return { ...session, workDate: normDate(workDate) };
    // Fallback: check checkedInAt/checkedOutAt directly on the app (for single-day jobs or legacy data)
    if (app.checkedInAt) {
      const checkedInDate = normDate(app.checkedInAt);
      if (checkedInDate === normDate(workDate)) {
        return { workDate: normDate(workDate), checkedInAt: app.checkedInAt, checkedOutAt: app.checkedOutAt };
      }
    }
    return null;
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
    const weekdays = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
    const months = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
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

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 mb-6 md:mb-8">
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.statsMyApplications")}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </article>
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.statsAcceptedJobs") || "Joburi acceptate"}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{acceptedJobsCount}</p>
            </div>
          </article>
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.statsFinishedJobs") || "Joburi finisate"}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{finishedJobsCount}</p>
            </div>
          </article>
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {RATING_ICON}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.statsMyRating")}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <StarRating value={userRating?.average ?? 0} size={18} />
                {userRating && userRating.count > 0 && (
                  <span className="text-xs text-gray-500">({userRating.count})</span>
                )}
              </div>
            </div>
          </article>
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-primary/30 bg-primary/5 shadow-sm flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.statsAvailability")}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
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
              <div className="divide-y divide-gray-100">
                {acceptedApplications.map((app) => {
                  const workDate = getCurrentWorkDate();
                  const session = getCurrentSession(app, workDate);
                  const isExpanded = expandedJobId === app.jobId;
                  const isLoading = checkInOutLoading?.startsWith(`${app.id}-${workDate}`);
                  
                  return (
                    <div key={app.id} className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="w-5 h-5 text-primary flex-shrink-0" />
                            <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{app.jobTitle || t("dashboard.job")}</h3>
                            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">
                              {t("dashboard.accepted")}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-sm text-gray-600">
                            {app.jobLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{app.jobLocation}</span>
                              </div>
                            )}
                            {app.jobDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
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
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {!session?.checkedInAt ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmCheckIn({ applicationId: app.id, workDate, jobId: app.jobId }); }}
                              disabled={!!isLoading}
                              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {isLoading ? "..." : t("dashboard.checkIn") || "Check-in"}
                            </button>
                          ) : !session?.checkedOutAt ? (
                            <>
                              <p className="text-xs text-gray-500 text-right">{t("dashboard.checkedInAt")} {formatTime(session.checkedInAt)}</p>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmCheckOut({ applicationId: app.id, workDate, jobId: app.jobId }); }}
                                disabled={!!isLoading}
                                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                {isLoading ? "..." : t("dashboard.checkOut") || "Check-out"}
                              </button>
                            </>
                          ) : (
                            <p className="text-sm text-gray-600 text-right py-1">
                              {t("dashboard.checkedInAt")} {formatTime(session.checkedInAt)} · {t("dashboard.checkedOutAt")} {formatTime(session.checkedOutAt)}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedJobId(isExpanded ? null : app.jobId)}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {isExpanded ? t("dashboard.hideDetails") || "Ascunde detalii" : t("dashboard.showDetails") || "Vezi detalii"}
                            <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
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
            </div>
          </section>
        )}

        <section>
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between gap-2">
              <h2 className="font-bold text-gray-900 text-sm sm:text-base truncate">{t("dashboard.recommendedJobs")}</h2>
              <Link to="/dashboard/joburi" className="text-sm text-primary font-medium hover:underline flex-shrink-0">
                {t("dashboard.seeAll")}
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {jobsLoading ? (
                <div className="p-4 text-center text-gray-500 text-sm">{t("dashboard.loading") || "Se încarcă..."}</div>
              ) : recommendedJobs.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">{t("dashboard.noRecommendedJobs") || "Niciun job public disponibil."}</div>
              ) : (
                recommendedJobs.map((j) => {
                  const appInfo = applicationsByJob[j.id];
                  const applied = !!appInfo;
                  return (
                    <div
                      key={j.id}
                      className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base truncate flex items-center gap-2">
                          {j.job}
                          {j.isPromoted && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-800 text-white">
                              {t("dashboard.promovareBoosterShort", "Booster")}
                            </span>
                          )}
                        </p>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {j.location}{j.jobType ? ` · ${j.jobType}` : ""}
                        </span>
                      </div>
                      {applied ? (
                        <span className="text-gray-500 text-sm flex-shrink-0">
                          {appInfo?.status === "accepted" ? t("dashboard.accepted") : t("dashboard.pending")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApply(j)}
                          disabled={!!applyingId}
                          className="text-primary text-sm font-medium flex-shrink-0 hover:underline disabled:opacity-50"
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
