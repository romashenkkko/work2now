import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, getApplications, setApplications, type JobRow, type Application, type JobType } from "./DashboardLayout";
import { jobsApi } from "../api/client";
import JobsMapModal from "../components/JobsMapModal";
import JobScheduleModal from "../components/JobScheduleModal";
import CustomerProfileModal from "../components/CustomerProfileModal";
import StaffProfileModal from "../components/StaffProfileModal";
import { MapPin, Clock, Users, Banknote, Calendar, Briefcase, Map, Search, TrendingUp } from "lucide-react";
import { getBusinessTotal, roundMoney } from "../utils/salary";

/** Minutes from "HH:mm". Returns NaN if invalid. */
function timeToMinutes(s: string | undefined): number {
  if (!s || typeof s !== "string") return NaN;
  const parts = s.trim().split(/[:\s]+/);
  const h = parseInt(parts[0], 10);
  const m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}
/** Hours between start and end; if end <= start, treats end as next day. */
function hoursBetweenTimes(startStr: string | undefined, endStr: string | undefined): number {
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const minsPerDay = 24 * 60;
  const durationMins = end <= start ? minsPerDay - start + end : end - start;
  return durationMins / 60;
}

/** Base total (rate × hours) for a job row. */
function getCardBaseTotal(row: JobRow): number | null {
  const rate = row.hourlyRateBase != null ? Number(row.hourlyRateBase) : (row.estimatedSalary ? parseFloat(String(row.estimatedSalary).replace(/,/g, ".")) : NaN);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const durationHours = row.duration ? parseFloat(String(row.duration)) : (row.startTime && row.endTime ? hoursBetweenTimes(row.startTime, row.endTime) : NaN);
  if (!Number.isFinite(durationHours) || durationHours <= 0) return null;
  return Math.round(rate * durationHours * 100) / 100;
}

/** Display total on card: business sees base + tax + platform, staff sees base (without taxes). */
function getCardDisplayTotal(row: JobRow, viewerIsStaff: boolean): number | null {
  const base = getCardBaseTotal(row);
  if (base == null) return null;
  // Staff sees base salary without taxes on the list page
  return roundMoney(viewerIsStaff ? base : getBusinessTotal(base));
}

export default function DashboardJoburi() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobsAdded, openPostJobModal, removeJob, refreshJobs } = useContext(DashboardContext);
  const [showMapModal, setShowMapModal] = useState(false);
  const [scheduleJob, setScheduleJob] = useState<JobRow | null>(null);
  const [customerProfileModal, setCustomerProfileModal] = useState<{
    customerId: string;
    customerName?: string;
    customerAvatar?: string;
    applicationIdForReview?: string;
  } | null>(null);
  const [staffProfileModal, setStaffProfileModal] = useState<{
    staffId: string;
    staffName?: string;
    staffEmail?: string;
    staffAvatar?: string;
    applicationId?: string;
  } | null>(null);

  const roleLower = user?.role?.toLowerCase?.();
  const isCustomer = roleLower === "customer";
  const isStaff = roleLower === "staff";
  const jobs = isCustomer ? jobsAdded : [];

  /** Customer: applications per job (for "In process" / "Finished" and confirm). */
  const [customerApplicationsByJob, setCustomerApplicationsByJob] = useState<Record<string, Application[]>>({});
  const loadCustomerApplications = useCallback(() => {
    if (!isCustomer) return Promise.resolve();
    return jobsApi
      .applications()
      .then((r) => {
        const raw = r?.applications ?? {};
        const byJob: Record<string, Application[]> = {};
        Object.keys(raw).forEach((jobId) => {
          const list = raw[jobId];
          if (!Array.isArray(list)) return;
          byJob[jobId] = list.map((a: Record<string, unknown>) => ({
            id: String(a.id ?? ""),
            jobId: String(a.jobId ?? jobId),
            staffId: String(a.staffId ?? ""),
            staffName: String(a.staffName ?? ""),
            staffEmail: a.staffEmail != null ? String(a.staffEmail) : undefined,
            staffAvatar: a.staffAvatar != null ? String(a.staffAvatar) : undefined,
            status: (a.status ?? "pending") as "pending" | "accepted" | "refused",
            checkedInAt: a.checkedInAt != null ? String(a.checkedInAt) : undefined,
            checkedOutAt: a.checkedOutAt != null ? String(a.checkedOutAt) : undefined,
            businessConfirmedAt: a.businessConfirmedAt != null ? String(a.businessConfirmedAt) : undefined,
            isBusinessConfirmed: !!(a.isBusinessConfirmed ?? (a.businessConfirmedAt != null && String(a.businessConfirmedAt).trim() !== "")),
            workSessions: Array.isArray(a.workSessions) ? (a.workSessions as { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]) : undefined,
            ratingScore: a.ratingScore != null ? Number(a.ratingScore) : undefined,
          }));
        });
        setCustomerApplicationsByJob(byJob);
      });
  }, [isCustomer]);
  useEffect(() => {
    if (!isCustomer) return;
    loadCustomerApplications();
  }, [isCustomer, loadCustomerApplications]);

  /** Customer: derive "in_process" | "finished" and first check-in time for a job. */
  const getCustomerJobStatus = (jobId: string): { status: "in_process" | "finished" | null; firstCheckedInAt?: string } => {
    const apps = customerApplicationsByJob[String(jobId)] ?? [];
    const accepted = apps.filter((a) => a.status === "accepted");
    const anyCheckedOut = accepted.some((a) => a.checkedOutAt);
    const anyCheckedIn = accepted.some((a) => a.checkedInAt);
    const firstCheckedInAt = accepted.map((a) => a.checkedInAt).filter(Boolean)[0] as string | undefined;
    if (anyCheckedOut) return { status: "finished", firstCheckedInAt };
    if (anyCheckedIn) return { status: "in_process", firstCheckedInAt };
    return { status: null };
  };

  /** Customer: primul angajat acceptat pentru un job (pentru afișare pe card). */
  const getFirstAcceptedStaff = (jobId: string): Application | undefined => {
    const apps = customerApplicationsByJob[String(jobId)] ?? [];
    return apps.find((a) => a.status === "accepted");
  };

  type MyAppInfo = { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] };
  const [publicJobs, setPublicJobs] = useState<JobRow[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, MyAppInfo>>({});
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);
  const [checkInOutLoading, setCheckInOutLoading] = useState<string | null>(null);
  const [checkInOutConfirm, setCheckInOutConfirm] = useState<{ type: "checkin" | "checkout"; time: string } | null>(null);
  const [checkInOutError, setCheckInOutError] = useState<string | null>(null);
  const [promoteLoadingId, setPromoteLoadingId] = useState<string | null>(null);
  const [confirmCheckIn, setConfirmCheckIn] = useState<{ applicationId: string; workDate?: string; jobId?: string } | null>(null);
  const [confirmCheckOut, setConfirmCheckOut] = useState<{ applicationId: string; workDate?: string; jobId?: string } | null>(null);
  const optimisticStorageKey = `work2now_optimistic_sessions_${user?.id ?? ""}`;
  const [optimisticSessions, setOptimisticSessions] = useState<Record<string, { checkedInAt?: string; checkedOutAt?: string }>>(() => {
    if (typeof window === "undefined" || !user?.id) return {};
    try {
      const raw = sessionStorage.getItem(`work2now_optimistic_sessions_${user.id}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, { checkedInAt?: string; checkedOutAt?: string }>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const persistOptimistic = (next: Record<string, { checkedInAt?: string; checkedOutAt?: string }>) => {
    try {
      sessionStorage.setItem(optimisticStorageKey, JSON.stringify(next));
    } catch (_) {}
  };
  const getOptimisticBase = (): Record<string, { checkedInAt?: string; checkedOutAt?: string }> => {
    try {
      const raw = sessionStorage.getItem(optimisticStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, { checkedInAt?: string; checkedOutAt?: string }>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [professionOpen, setProfessionOpen] = useState(false);
  const [professionFilter, setProfessionFilter] = useState<string>("all");
  const categoryRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const professionRef = useRef<HTMLDivElement>(null);

  const refreshStaffData = (opts?: { silent?: boolean }): Promise<void> => {
    if (!isStaff) return Promise.resolve();
    const silent = opts?.silent === true;
    if (!silent) {
      setStaffLoading(true);
      setStaffLoadError(null);
    }
    return Promise.all([jobsApi.list(), jobsApi.myApplications()])
      .then(([jobsRes, appRes]) => {
        const list: JobRow[] = (jobsRes.jobs || []).map((j) => ({
          id: j.id,
          job: j.job,
          location: j.location,
          status: j.status,
          statusClass: j.statusClass ?? "bg-gray-100 text-gray-700",
          date: j.date,
          endDate: j.endDate,
          jobType: j.jobType as JobType | undefined,
          applicationsCount: j.applicationsCount ?? 0,
          acceptedCount: j.acceptedCount ?? 0,
          startTime: j.startTime,
          endTime: j.endTime,
          peopleNeeded: j.peopleNeeded,
          duration: j.duration,
          estimatedSalary: j.estimatedSalary,
          imageUrl: j.imageUrl,
          postedBy: j.postedBy ?? (j.posted_by_name as string),
          jobCategoryCode: (j as any).jobCategoryCode,
          hourlyRateBase: (j as any).hourlyRateBase,
          jobCategoryTitle: (j as any).jobCategoryTitle,
          postedById: j.postedById,
          postedByRole: j.postedByRole,
          postedByAvatar: j.postedByAvatar,
          checkInLat: j.checkInLat != null ? Number(j.checkInLat) : undefined,
          checkInLng: j.checkInLng != null ? Number(j.checkInLng) : undefined,
          checkInRadiusM: j.checkInRadiusM != null ? Number(j.checkInRadiusM) : undefined,
        }));
        setPublicJobs(list);
        const byJob = appRes.byJob ?? {};
        const nextByJob = typeof byJob === "object" && byJob !== null ? { ...byJob } : {};
        Object.keys(nextByJob).forEach((k) => {
          const v = nextByJob[k];
          if (v && typeof v === "object" && Array.isArray((v as { workSessions?: unknown }).workSessions)) {
            (nextByJob as Record<string, MyAppInfo>)[k] = { ...v, workSessions: [...(v as MyAppInfo).workSessions!] };
          }
        });
        setApplicationsByJob(nextByJob);
        setOptimisticSessions((prev) => {
          let next = { ...prev };
          let changed = false;
          Object.keys(next).forEach((key) => {
            const dash = key.indexOf("-");
            if (dash <= 0) return;
            const jobId = key.slice(0, dash);
            const wd = key.slice(dash + 1).trim().slice(0, 10);
            const sessions = (nextByJob as Record<string, MyAppInfo>)[jobId]?.workSessions ?? [];
            const serverSession = sessions.find((s) => (s.workDate || "").trim().slice(0, 10) === wd);
            const opt = prev[key];
            // Șterge optimistul doar când serverul confirmă aceeași stare (evită loop la răspuns întârziat)
            if (serverSession && opt) {
              const serverHasIn = !!serverSession.checkedInAt;
              const serverHasOut = !!serverSession.checkedOutAt;
              const optHasIn = !!opt.checkedInAt;
              const optHasOut = !!opt.checkedOutAt;
              if (optHasIn && !serverHasIn) return;
              if (optHasOut && !serverHasOut) return;
              delete next[key];
              changed = true;
            }
          });
          if (changed) persistOptimistic(next);
          return next;
        });
      })
      .catch((err) => {
        setStaffLoadError(err instanceof Error ? err.message : "Eroare la încărcare");
        const app = getApplications();
        const byJob: Record<string, MyAppInfo> = {};
        Object.keys(app).forEach((jobId) => {
          const myApp = (app[jobId] || []).find((a) => a.staffId === String(user?.id));
          if (myApp) byJob[jobId] = { status: myApp.status, applicationId: myApp.id };
        });
        setApplicationsByJob(byJob);
        setPublicJobs([]);
      })
      .finally(() => { if (!silent) setStaffLoading(false); });
  };
  useEffect(() => {
    if (!isStaff) return;
    refreshStaffData();
  }, [isStaff, user?.id]);
  useEffect(() => {
    if (!isStaff) return;
    const onFocus = () => refreshStaffData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isStaff]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) setLocationOpen(false);
      if (professionRef.current && !professionRef.current.contains(e.target as Node)) setProfessionOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const handleApply = (job: JobRow) => {
    if (!user || !job.id) return;
    if (applicationsByJob[job.id]) return;
    jobsApi
      .apply(job.id)
      .then(() => refreshStaffData())
      .catch(() => {
        const app = getApplications();
        const list = app[job.id!] || [];
        const newApp = {
          id: `app-${Date.now()}`,
          jobId: job.id!,
          staffId: String(user.id),
          staffName: user.name,
          staffEmail: user.email,
          status: "pending" as const,
        };
        app[job.id!] = [...list, newApp];
        setApplications(app);
        setApplicationsByJob((prev) => ({ ...prev, [job.id!]: { status: "pending", applicationId: newApp.id } }));
      });
  };
  const showCheckInOutConfirm = (type: "checkin" | "checkout") => {
    const time = new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    setCheckInOutError(null);
    setCheckInOutConfirm({ type, time });
    setTimeout(() => setCheckInOutConfirm(null), 5000);
  };
  const normDate = (s: string) => (s || "").trim().slice(0, 10);
  const normJobId = (id: string | number | undefined) => (id == null ? "" : String(id));
  const applyCheckInOptimistic = (applicationId: string, workDate: string, jobIdHint?: string) => {
    const wd = normDate(workDate);
    const hint = normJobId(jobIdHint);
    setApplicationsByJob((prev) => {
      const jobId = hint && prev[hint] ? hint : Object.entries(prev).find(([, a]) => String(a.applicationId) === String(applicationId))?.[0];
      if (!jobId || !prev[jobId]) return prev;
      const app = prev[jobId];
      const now = new Date().toISOString();
      const sessions = [...(app.workSessions || [])];
      const idx = sessions.findIndex((s) => normDate(s.workDate) === wd);
      if (idx >= 0) {
        sessions[idx] = { ...sessions[idx], checkedInAt: now };
      } else {
        sessions.push({ workDate: wd, checkedInAt: now });
      }
      return { ...prev, [jobId]: { ...app, workSessions: sessions } };
    });
  };
  const applyCheckOutOptimistic = (applicationId: string, workDate: string, jobIdHint?: string) => {
    const wd = normDate(workDate);
    const hint = normJobId(jobIdHint);
    setApplicationsByJob((prev) => {
      const jobId = hint && prev[hint] ? hint : Object.entries(prev).find(([, a]) => String(a.applicationId) === String(applicationId))?.[0];
      if (!jobId || !prev[jobId]) return prev;
      const app = prev[jobId];
      const now = new Date().toISOString();
      const sessions = [...(app.workSessions || [])];
      const idx = sessions.findIndex((s) => normDate(s.workDate) === wd);
      if (idx >= 0) {
        sessions[idx] = { ...sessions[idx], checkedOutAt: now };
      } else {
        sessions.push({ workDate: wd, checkedInAt: app.workSessions?.[0]?.checkedInAt ?? now, checkedOutAt: now });
      }
      return { ...prev, [jobId]: { ...app, workSessions: sessions } };
    });
  };
  const handleCheckIn = (e: React.MouseEvent, applicationId: string, workDate?: string, jobId?: string) => {
    e?.stopPropagation?.();
    const key = workDate ? `${applicationId}-${workDate}` : applicationId;
    const wd = workDate ?? (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
    const jid = normJobId(jobId);
    setConfirmCheckIn(null);
    setConfirmCheckOut(null);
    setCheckInOutLoading(key);
    setCheckInOutError(null);
    const now = new Date().toISOString();
    const sessionKey = jid ? `${jid}-${wd}` : (Object.entries(applicationsByJob).find(([, a]) => String(a.applicationId) === String(applicationId))?.[0] ?? "") + "-" + wd;
    const job = jobId ? publicJobs.find((j) => String(j.id) === String(jobId)) : null;
    const jobRow = job as { checkInLat?: number; checkInLng?: number; checkInRadiusM?: number } | undefined;
    const needsGeo = jobRow?.checkInLat != null && jobRow?.checkInLng != null && jobRow?.checkInRadiusM != null;

    // Do not show "Început" / Check-out until server confirms; for geo jobs, verify location first, then check-in
    const applyOptimisticCheckIn = () => {
      if (sessionKey.length > wd.length + 1) {
        setOptimisticSessions((prev) => {
          const base = { ...getOptimisticBase(), ...prev };
          const next = { ...base, [sessionKey]: { ...base[sessionKey], checkedInAt: now } };
          persistOptimistic(next);
          return next;
        });
      }
      applyCheckInOptimistic(applicationId, wd, jobId);
    };

    const clearOptimisticForSession = () => {
      if (sessionKey.length <= wd.length + 1) return;
      setOptimisticSessions((prev) => {
        const next = { ...prev };
        delete next[sessionKey];
        persistOptimistic(next);
        return next;
      });
    };

    const doCheckIn = (geo?: { lat: number; lng: number }) => {
      jobsApi
        .checkIn(applicationId, wd, geo)
        .then(async () => {
          applyOptimisticCheckIn();
          showCheckInOutConfirm("checkin");
          try {
            await new Promise((r) => setTimeout(r, 350));
            await refreshStaffData({ silent: true });
          } catch (_) {}
        })
        .catch(async (err) => {
          setConfirmCheckIn(null);
          setConfirmCheckOut(null);
          clearOptimisticForSession();
          const msg = err instanceof Error ? err.message : (typeof err === "object" && err !== null && "error" in (err as { error?: string }) ? (err as { error: string }).error : String(err)) || "Eroare la check-in";
          const msgLower = String(msg).toLowerCase();
          if (msgLower.includes("deja efectuat") || msgLower.includes("already")) {
            try { await refreshStaffData({ silent: true }); } catch (_) {}
            showCheckInOutConfirm("checkin");
          } else {
            try { await refreshStaffData({ silent: true }); } catch (_) {}
            setCheckInOutError(
              /not within the allowed location radius/i.test(msg) ? t("dashboard.locationRadiusError") : msg
            );
            setTimeout(() => setCheckInOutError(null), 5000);
          }
        })
        .finally(() => setCheckInOutLoading(null));
    };

    if (needsGeo && typeof navigator !== "undefined" && navigator.geolocation) {
      // 1. Request location permission and get coordinates
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // 2. Send check-in with lat/lng; server validates distance ≤ 200 m
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
      // Job without geo: apply optimistic then call API
      applyOptimisticCheckIn();
      doCheckIn();
    }
  };
  const handleCheckOut = (e: React.MouseEvent, applicationId: string, workDate?: string, jobId?: string) => {
    e?.stopPropagation?.();
    const key = workDate ? `${applicationId}-${workDate}` : applicationId;
    const wdOut = workDate ?? (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
    const jid = normJobId(jobId);
    setConfirmCheckIn(null);
    setConfirmCheckOut(null);
    setCheckInOutLoading(key);
    setCheckInOutError(null);
    const now = new Date().toISOString();
    const sessionKeyOut = jid ? `${jid}-${wdOut}` : (Object.entries(applicationsByJob).find(([, a]) => String(a.applicationId) === String(applicationId))?.[0] ?? "") + "-" + wdOut;
    const jobOut = jobId ? publicJobs.find((j) => String(j.id) === String(jobId)) : null;
    const jobOutRow = jobOut as { checkInLat?: number; checkInLng?: number; checkInRadiusM?: number } | undefined;
    const needsGeoOut = jobOutRow?.checkInLat != null && jobOutRow?.checkInLng != null && jobOutRow?.checkInRadiusM != null;

    const applyOptimisticCheckOut = () => {
      if (sessionKeyOut.length > wdOut.length + 1) {
        setOptimisticSessions((prev) => {
          const base = { ...getOptimisticBase(), ...prev };
          const next = { ...base, [sessionKeyOut]: { ...base[sessionKeyOut], checkedOutAt: now } };
          persistOptimistic(next);
          return next;
        });
      }
      applyCheckOutOptimistic(applicationId, wdOut, jobId);
    };

    const clearOptimisticForSessionOut = () => {
      if (sessionKeyOut.length <= wdOut.length + 1) return;
      setOptimisticSessions((prev) => {
        const next = { ...prev };
        delete next[sessionKeyOut];
        persistOptimistic(next);
        return next;
      });
    };

    const doCheckOut = (geo?: { lat: number; lng: number }) => {
      jobsApi
        .checkOut(applicationId, wdOut, geo)
        .then(async () => {
          applyOptimisticCheckOut();
          showCheckInOutConfirm("checkout");
          try {
            await new Promise((r) => setTimeout(r, 350));
            await refreshStaffData({ silent: true });
          } catch (_) {}
        })
        .catch(async (err) => {
          setConfirmCheckIn(null);
          setConfirmCheckOut(null);
          clearOptimisticForSessionOut();
          const msg = err instanceof Error ? err.message : (typeof err === "object" && err !== null && "error" in (err as { error?: string }) ? (err as { error: string }).error : String(err)) || "Eroare la check-out";
          const msgLower = String(msg).toLowerCase();
          if (msgLower.includes("deja efectuat") || msgLower.includes("already")) {
            try { await refreshStaffData({ silent: true }); } catch (_) {}
            showCheckInOutConfirm("checkout");
          } else {
            try { await refreshStaffData({ silent: true }); } catch (_) {}
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
        (pos) => doCheckOut({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          setCheckInOutError(t("dashboard.checkInShareLocation"));
          setTimeout(() => setCheckInOutError(null), 5000);
          setCheckInOutLoading(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      applyOptimisticCheckOut();
      doCheckOut();
    }
  };
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };
  const todayYMD = (() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  })();
  const formatWorkDateLabel = (ymd: string | undefined) => {
    if (!ymd || normDate(ymd) === todayYMD) return null;
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
  };
  const getTodaySession = (app: MyAppInfo) => {
    const session = app.workSessions?.find((s) => normDate(s.workDate) === todayYMD);
    if (session) return { ...session, workDate: todayYMD };
    if (app.checkedInAt) return { workDate: todayYMD, checkedInAt: app.checkedInAt, checkedOutAt: app.checkedOutAt };
    return null;
  };
  const getTodaySessionWithOptimistic = (app: MyAppInfo, jobId: string) => {
    const fromApp = getTodaySession(app);
    const optKey = `${normJobId(jobId)}-${todayYMD}`;
    const opt = optimisticSessions[optKey];
    if (!opt) return fromApp;
    return { workDate: todayYMD, ...fromApp, ...opt } as { workDate: string; checkedInAt?: string; checkedOutAt?: string };
  };

  const isJobFull = (row: JobRow) => {
    const needed = parseInt(String(row.peopleNeeded ?? "1"), 10) || 1;
    return (row.acceptedCount ?? 0) >= needed;
  };

  /** Badge text for job card: "0/2", "1/2", "2/2" or "Full" when full; otherwise row.status. */
  const getJobSlotBadge = (row: JobRow) => {
    const needed = parseInt(String(row.peopleNeeded ?? "1"), 10) || 1;
    const accepted = row.acceptedCount ?? 0;
    if (needed >= 1) return `${accepted}/${needed}`;
    return isJobFull(row) ? t("dashboard.jobFull") : row.status;
  };

  if (isStaff) {
    const myApp = (jobId: string) => applicationsByJob[String(jobId)];
    const isAcceptedToJob = (row: JobRow) => myApp(normJobId(row.id))?.status === "accepted";
    const showJobForStaff = (row: JobRow) => !isJobFull(row) || isAcceptedToJob(row);
    const staffJobsForMap = publicJobs.filter((j) => showJobForStaff(j) && ((j.location?.trim()) || (j.checkInLat != null && j.checkInLng != null)));
    const q = searchQuery.trim().toLowerCase();
    const filteredJobs = publicJobs.filter((row) => {
      if (!showJobForStaff(row)) return false;
      const matchSearch = !q || (row.job?.toLowerCase().includes(q) || (row.location ?? "").toLowerCase().includes(q));
      const matchCategory = categoryFilter === "all" || (row.jobType ?? "") === categoryFilter;
      const matchLocation = locationFilter === "all" || (row.location?.trim() ?? "") === locationFilter;
      const matchProfession = professionFilter === "all" || (row.job?.trim() ?? "") === professionFilter;
      return matchSearch && matchCategory && matchLocation && matchProfession;
    });
    const uniqueLocations = [...new Set(publicJobs.map((j) => j.location?.trim()).filter(Boolean))].sort() as string[];
    const professionLabelKeys = [
      "dashboard.jobTitleBarista",
      "dashboard.jobTitleBartender",
      "dashboard.jobTitleChef",
      "dashboard.jobTitleCleaner",
      "dashboard.jobTitleDishwasher",
      "dashboard.jobTitleEventCrew",
      "dashboard.jobTitleGrocery",
      "dashboard.jobTitleMaintenance",
      "dashboard.jobTitleReceptionist",
      "dashboard.jobTitleTrainingEvent",
      "dashboard.jobTitleWaiter",
    ];
    const fixedProfessionOptions = professionLabelKeys.map((key) => ({ value: t(key), label: t(key) }));
    const uniqueFromData = [...new Set(publicJobs.map((j) => j.job?.trim()).filter(Boolean))].filter(
      (name) => !fixedProfessionOptions.some((o) => o.value === name)
    ).sort() as string[];
    const professionOptions = [
      { value: "all", label: t("findJobs.allProfessions") },
      ...fixedProfessionOptions,
      ...uniqueFromData.map((name) => ({ value: name, label: name })),
    ];
    const categoryOptions = [
      { value: "all", label: t("findJobs.allCategories") },
      { value: "one-day", label: t("dashboard.oneDayJob") },
      { value: "multi-day", label: t("dashboard.multiDayJob") },
      { value: "full-time", label: t("dashboard.fullTimeRecruitment") },
    ];
    const locationOptions = [
      { value: "all", label: t("findJobs.allLocations") },
      ...uniqueLocations.map((loc) => ({ value: loc, label: loc })),
    ];
    return (
      <>
        {checkInOutConfirm && (
          <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[70]">
            <div className={`rounded-2xl shadow-lg border-2 p-4 flex items-center gap-3 ${
              checkInOutConfirm.type === "checkin"
                ? "bg-green-50 border-green-200 text-green-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                checkInOutConfirm.type === "checkin" ? "bg-green-200" : "bg-amber-200"
              }`}>
                <span className="text-lg font-bold">
                  {checkInOutConfirm.type === "checkin" ? "✓" : "✓"}
                </span>
              </div>
              <div>
                <p className="font-semibold">
                  {checkInOutConfirm.type === "checkin" ? t("dashboard.checkInConfirm") : t("dashboard.checkOutConfirm")}
                </p>
                <p className="text-sm opacity-90">
                  {checkInOutConfirm.type === "checkin"
                    ? t("dashboard.checkInAtTime", { time: checkInOutConfirm.time })
                    : t("dashboard.checkOutAtTime", { time: checkInOutConfirm.time })}
                </p>
              </div>
            </div>
          </div>
        )}
        {checkInOutError && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[70] px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg">
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
                      const j = publicJobs.find((job) => String(job.id) === String(confirmCheckIn!.jobId)) as { checkInLat?: number; checkInLng?: number; checkInRadiusM?: number } | undefined;
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
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.joburi")}</h1>
            <p className="text-gray-500 text-sm mt-1.5 max-w-md">{t("dashboard.staffJoburiDesc")}</p>
          </div>
          {staffJobsForMap.length > 0 && (
            <div className="flex justify-end sm:flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                aria-label={t("dashboard.showMap")}
                title={t("dashboard.showMap")}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[#9d7bff] text-white shadow-[0_8px_20px_rgba(122,99,241,0.3)] hover:shadow-[0_12px_28px_rgba(122,99,241,0.4)] hover:-translate-y-0.5 transition-all duration-200"
              >
                <Map className="w-6 h-6 shrink-0" />
              </button>
            </div>
          )}
        </header>
        {!staffLoading && publicJobs.length > 0 && (
          <div className="mb-6 py-5 px-4 rounded-2xl bg-gradient-to-r from-[#f5f2ff] via-[#f0ebfa] to-[#ebe5f7]">
            <div className="flex flex-col sm:flex-row rounded-[24px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
              <div className="flex-1 min-w-0 flex items-center border-0 bg-transparent relative rounded-t-[24px] sm:rounded-t-none sm:rounded-l-[24px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none shrink-0" />
                <input
                  type="text"
                  placeholder={t("findJobs.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 border-0 bg-transparent text-gray-900 placeholder:text-[#A0A0A0] focus:ring-0 focus:outline-none"
                />
              </div>
              <div ref={categoryRef} className="custom-dropdown in-bar flex items-stretch">
                <button
                  type="button"
                  className={`dropdown-btn in-bar ${categoryOpen ? "active" : ""}`}
                  onClick={() => { setLocationOpen(false); setProfessionOpen(false); setCategoryOpen((o) => !o); }}
                  aria-expanded={categoryOpen}
                  aria-haspopup="listbox"
                >
                  <span className="dropdown-text truncate">{categoryOptions.find((o) => o.value === categoryFilter)?.label ?? t("findJobs.allCategories")}</span>
                  <span className="chevron" aria-hidden>▾</span>
                </button>
                <div className={`dropdown-menu ${categoryOpen ? "active" : ""}`} role="listbox">
                  {categoryOptions.map((opt) => (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={categoryFilter === opt.value}
                      className={`dropdown-item ${categoryFilter === opt.value ? "selected" : ""}`}
                      onClick={() => { setCategoryFilter(opt.value); setCategoryOpen(false); }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div ref={locationRef} className="custom-dropdown in-bar flex items-stretch">
                <button
                  type="button"
                  className={`dropdown-btn in-bar ${locationOpen ? "active" : ""}`}
                  onClick={() => { setCategoryOpen(false); setProfessionOpen(false); setLocationOpen((o) => !o); }}
                  aria-expanded={locationOpen}
                  aria-haspopup="listbox"
                >
                  <span className="dropdown-text truncate">{locationFilter === "all" ? t("findJobs.allLocations") : locationFilter}</span>
                  <span className="chevron" aria-hidden>▾</span>
                </button>
                <div className={`dropdown-menu ${locationOpen ? "active" : ""}`} role="listbox">
                  {locationOptions.map((opt) => (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={locationFilter === opt.value}
                      className={`dropdown-item truncate ${locationFilter === opt.value ? "selected" : ""}`}
                      onClick={() => { setLocationFilter(opt.value); setLocationOpen(false); }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div ref={professionRef} className="custom-dropdown in-bar flex items-stretch">
                <button
                  type="button"
                  className={`dropdown-btn in-bar ${professionOpen ? "active" : ""}`}
                  onClick={() => { setCategoryOpen(false); setLocationOpen(false); setProfessionOpen((o) => !o); }}
                  aria-expanded={professionOpen}
                  aria-haspopup="listbox"
                >
                  <span className="dropdown-text truncate">{professionOptions.find((o) => o.value === professionFilter)?.label ?? t("findJobs.allProfessions")}</span>
                  <span className="chevron" aria-hidden>▾</span>
                </button>
                <div className={`dropdown-menu ${professionOpen ? "active" : ""}`} role="listbox">
                  {professionOptions.map((opt) => (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={professionFilter === opt.value}
                      className={`dropdown-item truncate ${professionFilter === opt.value ? "selected" : ""}`}
                      onClick={() => { setProfessionFilter(opt.value); setProfessionOpen(false); }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setLocationFilter("all"); setProfessionFilter("all"); }}
                className="h-12 px-6 shrink-0 bg-[#8A63F2] text-white font-semibold text-sm hover:opacity-90 transition-opacity rounded-b-[24px] sm:rounded-b-none sm:rounded-r-[24px]"
              >
                {t("findJobs.searchBtn")}
              </button>
            </div>
          </div>
        )}
        {staffLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t("dashboard.loading")}</p>
          </div>
        ) : staffLoadError ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-red-600 mb-4">{staffLoadError}</p>
            <button type="button" onClick={() => refreshStaffData()} className="text-primary font-medium hover:underline">
              {t("dashboard.retry", "Reîncearcă")}
            </button>
          </div>
        ) : publicJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t("dashboard.noJobsAvailable")}</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">{t("dashboard.noJobsMatchFilter", "Niciun job nu corespunde filtrelor.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
            {filteredJobs.map((row) => {
              const app = myApp(normJobId(row.id));
              const status = app?.status;
              const isAccepted = status === "accepted";
              const todaySession = app ? getTodaySessionWithOptimistic(app, normJobId(row.id)) : null;
              return (
                <article
                  key={`job-${normJobId(row.id)}-${todaySession?.checkedInAt ?? ""}-${todaySession?.checkedOutAt ?? ""}`}
                  className="job-card-enter bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col cursor-pointer opacity-0"
                  onClick={() => setScheduleJob(row)}
                >
                  <div className="relative h-24 sm:h-28 bg-primary flex items-center justify-center overflow-hidden">
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
                        <div className="relative flex items-center gap-2.5">
                          <div className="w-11 h-11 rounded-full bg-white/95 shadow flex items-center justify-center overflow-hidden ring-2 ring-white/50">
                            <img src="/LogoWork2Now.png" alt="" className="w-7 h-7 object-contain" />
                          </div>
                          <span className="text-white font-semibold text-base">Work2Now</span>
                        </div>
                      </>
                    )}
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium bg-white/25 text-white backdrop-blur-sm">
                      {getJobSlotBadge(row)}
                    </span>
                  </div>
                  <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">{row.job}</h2>
                    <ul className="space-y-2 text-sm text-gray-600 flex-1">
                      <li className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-primary shrink-0" />
                        <span>{row.jobCategoryTitle || "—"}</span>
                      </li>
                      {(row.startTime || row.endTime) && (
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary shrink-0" />
                          <span>{row.startTime ?? "—"} – {row.endTime ?? "—"}</span>
                        </li>
                      )}
                      {row.location && (
                        <li className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{row.location}</span>
                        </li>
                      )}
                      {(() => {
                        const total = getCardDisplayTotal(row, isStaff);
                        return (total != null || row.estimatedSalary) ? (
                          <li className="flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-primary shrink-0" />
                            <span>{total != null ? total.toFixed(2) : row.estimatedSalary}</span>
                          </li>
                        ) : null;
                      })()}
                    </ul>
                    {isStaff && (row.postedBy || row.postedByAvatar) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!row.postedById) return;
                          const myApp = applicationsByJob[normJobId(row.id)];
                          const applicationIdForReview =
                            myApp?.checkedOutAt && myApp?.applicationId ? myApp.applicationId : undefined;
                          setCustomerProfileModal({
                            customerId: row.postedById,
                            customerName: row.postedBy,
                            customerAvatar: row.postedByAvatar,
                            applicationIdForReview,
                          });
                        }}
                        className="w-full flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-left rounded-xl px-3 py-2.5 -mx-0.5 bg-primary/5 border border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset disabled:opacity-60 disabled:pointer-events-none"
                        aria-label={t("dashboard.viewCustomerReviews", "Deschide recenziile clientului")}
                        disabled={!row.postedById}
                      >
                        <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center overflow-hidden shadow-sm">
                          <span className="text-primary font-semibold text-sm">{(row.postedBy || "?").charAt(0).toUpperCase()}</span>
                          {row.postedByAvatar && (
                            <img src={row.postedByAvatar} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{row.postedBy || "—"}</p>
                          <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25">
                            {t("dashboard.roleCustomer")}
                          </span>
                        </div>
                      </button>
                    )}
                    {isCustomer && row.id && (() => {
                      const staff = getFirstAcceptedStaff(row.id);
                      if (!staff) {
                        return (
                          <div className="mt-3 pt-3 border-t border-gray-100 px-3 py-2.5 -mx-0.5 rounded-xl bg-gray-50/80 border border-gray-100">
                            <p className="text-sm text-gray-500">{t("dashboard.noStaffAccepted", "Niciun angajat acceptat")}</p>
                          </div>
                        );
                      }
                      const name = staff.staffName || t("dashboard.staff", "Staff");
                      return staff.staffId ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setStaffProfileModal({ staffId: staff.staffId, staffName: staff.staffName, staffEmail: staff.staffEmail, staffAvatar: staff.staffAvatar, applicationId: staff.checkedOutAt && staff.ratingScore == null ? staff.id : undefined }); }}
                          className="w-full flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-left rounded-xl px-3 py-2.5 -mx-0.5 bg-primary/5 border border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset"
                          aria-label={t("dashboard.viewProfile", "Vezi profil")}
                        >
                          <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center overflow-hidden shadow-sm">
                            <span className="text-primary font-semibold text-sm">{(name || "S").charAt(0).toUpperCase()}</span>
                            {staff.staffAvatar && (
                              <img src={staff.staffAvatar} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col gap-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                            <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25">{t("dashboard.roleStaff")}</span>
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 px-3 py-2.5 -mx-0.5 rounded-xl bg-gray-50/80 border border-gray-100">
                          <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                            <span className="text-primary font-semibold text-sm">{(name || "S").charAt(0).toUpperCase()}</span>
                            {staff.staffAvatar && (
                              <img src={staff.staffAvatar} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col gap-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                            <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25">{t("dashboard.roleStaff")}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      {!app ? (
                        <button
                          type="button"
                          disabled={isJobFull(row)}
                          onClick={(e) => { e.stopPropagation(); handleApply(row); }}
                          className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isJobFull(row) ? t("dashboard.jobFull") : t("dashboard.apply")}
                        </button>
                      ) : !isAccepted ? (
                        <span className={`inline-block w-full py-2.5 rounded-xl text-center text-sm font-medium ${
                          status === "refused" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {status === "refused" ? t("dashboard.refused") : t("dashboard.pending")}
                        </span>
                      ) : (() => {
                        const loadingKey = `${app.applicationId}-${todayYMD}`;
                        const loading = checkInOutLoading === app.applicationId || checkInOutLoading === loadingKey;
                        return (
                          <>
                            {!todaySession?.checkedInAt ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmCheckIn({ applicationId: app.applicationId, workDate: todayYMD, jobId: String(row.id ?? "") }); }}
                                disabled={!!checkInOutLoading}
                                className="w-full py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {loading ? "..." : t("dashboard.checkIn")}
                              </button>
                            ) : !todaySession?.checkedOutAt ? (
                              <>
                                <p className="text-xs text-gray-500">{t("dashboard.checkedInAt")} {formatTime(todaySession.checkedInAt)}</p>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setConfirmCheckOut({ applicationId: app.applicationId, workDate: todayYMD, jobId: String(row.id ?? "") }); }}
                                  disabled={!!checkInOutLoading}
                                  className="w-full py-2.5 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                                >
                                  {loading ? "..." : t("dashboard.checkOut")}
                                </button>
                              </>
                            ) : (
                              <p className="text-sm text-gray-600 py-1">
                                {t("dashboard.checkedInAt")} {formatTime(todaySession.checkedInAt)} · {t("dashboard.checkedOutAt")} {formatTime(todaySession.checkedOutAt)}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <JobsMapModal
          open={showMapModal}
          onClose={() => setShowMapModal(false)}
          jobs={staffJobsForMap.map((j) => ({
            job: j.job,
            location: j.location ?? "",
            lat: j.checkInLat,
            lng: j.checkInLng,
          }))}
          showMyLocation={isStaff}
        />
        <JobScheduleModal
          open={scheduleJob !== null}
          onClose={() => setScheduleJob(null)}
          job={scheduleJob}
          viewerIsStaff={isStaff}
          myAppInfo={scheduleJob?.id && applicationsByJob[String(scheduleJob.id)]?.status === "accepted" ? (() => {
            const jid = normJobId(scheduleJob!.id);
            const app = applicationsByJob[jid];
            const baseSessions = app?.workSessions ?? [];
            const merged: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] = baseSessions.map((s) => {
              const wd = normDate(s.workDate);
              const opt = optimisticSessions[`${jid}-${wd}`];
              return opt ? { ...s, workDate: wd, ...opt } : { ...s, workDate: wd };
            });
            Object.keys(optimisticSessions).forEach((key) => {
              if (!key.startsWith(jid + "-")) return;
              const wd = key.slice(jid.length + 1);
              if (merged.some((s) => normDate(s.workDate) === wd)) return;
              merged.push({ workDate: wd, ...optimisticSessions[key] });
            });
            return { applicationId: app!.applicationId, workSessions: merged };
          })() : null}
          onCheckIn={(applicationId, workDate) => {
            setConfirmCheckIn({ applicationId, workDate, jobId: scheduleJob?.id != null ? String(scheduleJob.id) : undefined });
            setScheduleJob(null);
          }}
          onCheckOut={(applicationId, workDate) => {
            setConfirmCheckOut({ applicationId, workDate, jobId: scheduleJob?.id != null ? String(scheduleJob.id) : undefined });
            setScheduleJob(null);
          }}
          checkInOutLoading={checkInOutLoading}
        />
        {customerProfileModal && (
          <CustomerProfileModal
            open={!!customerProfileModal}
            onClose={() => setCustomerProfileModal(null)}
            customerId={customerProfileModal.customerId}
            customerName={customerProfileModal.customerName}
            customerAvatar={customerProfileModal.customerAvatar}
            currentUserId={user?.id != null ? String(user.id) : undefined}
            applicationIdForReview={customerProfileModal.applicationIdForReview}
            onReviewSubmitted={() => refreshStaffData()}
          />
        )}
      </>
    );
  }

  if (!isCustomer) {
    return (
      <>
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.joburi")}</h1>
          <p className="text-gray-600">{t("dashboard.staffSubtitle")}</p>
        </header>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500">Aici vor apărea joburile tale.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.joburi")}</h1>
          <p className="text-gray-500 text-sm mt-1.5 max-w-md">Gestionează anunțurile de joburi publicate.</p>
        </div>
        {/* Harta (joburi + locația mea) – doar pentru staff; customer nu o vede */}
      </header>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 md:p-12 text-center">
          <p className="text-gray-500 mb-6">Aici vor apărea joburile tale. Folosește „Posteaza un job” din meniu pentru a adăuga un anunț nou.</p>
          <button
            type="button"
            onClick={openPostJobModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            {t("dashboard.postJob")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
          {jobs.map((row, i) => (
            <article
              key={row.id ?? `job-${i}-${row.job}-${row.location}`}
              role="button"
              tabIndex={0}
              onClick={() => setScheduleJob(row)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setScheduleJob(row); } }}
              className="job-card-enter bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-200 flex flex-col cursor-pointer opacity-0"
            >
              {/* Fără imagine: logo Work2Now + violet. Cu imagine: doar imaginea customerului. */}
              <div className="relative h-24 sm:h-28 bg-primary flex items-center justify-center overflow-hidden">
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
                    <div className="relative flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-full bg-white/95 shadow flex items-center justify-center overflow-hidden ring-2 ring-white/50">
                        <img src="/LogoWork2Now.png" alt="" className="w-7 h-7 object-contain" />
                      </div>
                      <span className="text-white font-semibold text-base drop-shadow-sm">Work2Now</span>
                    </div>
                  </>
                )}
                {row.isPromoted && (
                  <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-900/80 text-white backdrop-blur-sm">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {t("dashboard.promovareBooster", "Promovare Booster")}
                  </span>
                )}
                <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium bg-white/25 text-white backdrop-blur-sm">
                  {getJobSlotBadge(row)}
                </span>
                {row.id && (() => {
                  const { status } = getCustomerJobStatus(row.id);
                  if (status === "in_process") {
                    return (
                      <span className="absolute right-3 bottom-3 w-auto px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/90 text-white backdrop-blur-sm">
                        {t("dashboard.inProcess")}
                      </span>
                    );
                  }
                  if (status === "finished") {
                    return (
                      <span className="absolute right-3 bottom-3 w-auto px-3 py-1.5 rounded-full text-xs font-medium bg-green-600/90 text-white backdrop-blur-sm">
                        {t("dashboard.finished")}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Body: titlu + rânduri cu icoane */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight flex-1 min-w-0">{row.job}</h2>
                  {isCustomer && row.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!row.id || promoteLoadingId) return;
                        setPromoteLoadingId(row.id);
                        jobsApi.setPromoted(row.id, !row.isPromoted)
                          .then(() => refreshJobs())
                          .catch(() => {})
                          .finally(() => setPromoteLoadingId(null));
                      }}
                      disabled={!!promoteLoadingId}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${row.isPromoted ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      {promoteLoadingId === row.id ? "..." : (row.isPromoted ? t("dashboard.promovareBoosterOn", "Booster ON") : t("dashboard.promovareBoosterOff", "Booster"))}
                    </button>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1">
                  <li className="flex items-center gap-3 text-gray-600 text-sm">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-primary" />
                    </span>
                    <span className="truncate">{row.jobCategoryTitle || "—"}</span>
                  </li>
                  {(row.startTime || row.endTime) && (
                    <li className="flex items-center gap-3 text-gray-600 text-sm">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-primary" />
                      </span>
                      <span>{row.startTime ?? "—"} – {row.endTime ?? "—"}</span>
                    </li>
                  )}
                  {row.location && (
                    <li className="flex items-center gap-3 text-gray-600 text-sm min-w-0">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-primary" />
                      </span>
                      <span className="truncate">{row.location}</span>
                    </li>
                  )}
                  {(() => {
                    const total = getCardDisplayTotal(row, isStaff);
                    return (total != null || row.estimatedSalary) ? (
                      <li className="flex items-center gap-3 text-gray-600 text-sm">
                        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Banknote className="w-4 h-4 text-primary" />
                        </span>
                        <span>{total != null ? total.toFixed(2) : row.estimatedSalary}</span>
                      </li>
                    ) : null;
                  })()}
                  {row.peopleNeeded && (
                    <li className="flex items-center gap-3 text-gray-600 text-sm">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </span>
                      <span>{row.peopleNeeded}</span>
                    </li>
                  )}
                </ul>

                {isCustomer && row.id && (() => {
                  const staff = getFirstAcceptedStaff(row.id);
                  if (!staff) {
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100 px-3 py-2.5 -mx-0.5 rounded-xl bg-gray-50/80 border border-gray-100">
                        <p className="text-sm text-gray-500">{t("dashboard.noStaffAccepted", "Niciun angajat acceptat")}</p>
                      </div>
                    );
                  }
                  const name = staff.staffName || t("dashboard.staff", "Staff");
                  return staff.staffId ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setStaffProfileModal({ staffId: staff.staffId, staffName: staff.staffName, staffEmail: staff.staffEmail, staffAvatar: staff.staffAvatar, applicationId: staff.checkedOutAt && staff.ratingScore == null ? staff.id : undefined }); }}
                      className="w-full flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-left rounded-xl px-3 py-2.5 -mx-0.5 bg-primary/5 border border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset"
                      aria-label={t("dashboard.viewProfile", "Vezi profil")}
                    >
                      <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center overflow-hidden shadow-sm">
                        <span className="text-primary font-semibold text-sm">{(name || "S").charAt(0).toUpperCase()}</span>
                        {staff.staffAvatar && (
                          <img src={staff.staffAvatar} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25">{t("dashboard.roleStaff")}</span>
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 px-3 py-2.5 -mx-0.5 rounded-xl bg-gray-50/80 border border-gray-100">
                      <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                        <span className="text-primary font-semibold text-sm">{(name || "S").charAt(0).toUpperCase()}</span>
                        {staff.staffAvatar && (
                          <img src={staff.staffAvatar} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25">{t("dashboard.roleStaff")}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Footer: dată + acțiuni */}
                <div className="border-t border-gray-100 mt-4 pt-4 flex items-center justify-between gap-3 flex-wrap">
                  {row.date ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{row.date}</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setScheduleJob(row); }}
                      className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      {t("dashboard.viewSchedule")}
                      <span aria-hidden className="ml-0.5">›</span>
                    </button>
                    <span className="text-gray-300">·</span>
                    {row.id && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeJob(row.id!); }}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        {t("dashboard.delete")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Harta cu joburi + geolocația staff – nu se afișează pentru customer */}
      <JobScheduleModal
        open={scheduleJob !== null}
        onClose={() => setScheduleJob(null)}
        job={scheduleJob}
        viewerIsStaff={false}
        jobApplications={scheduleJob?.id ? (customerApplicationsByJob[String(scheduleJob.id)] ?? []) : []}
      />
      {customerProfileModal && (
        <CustomerProfileModal
          open={!!customerProfileModal}
          onClose={() => setCustomerProfileModal(null)}
          customerId={customerProfileModal.customerId}
          customerName={customerProfileModal.customerName}
          customerAvatar={customerProfileModal.customerAvatar}
          currentUserId={user?.id != null ? String(user.id) : undefined}
          applicationIdForReview={customerProfileModal.applicationIdForReview}
          onReviewSubmitted={() => refreshStaffData()}
        />
      )}
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
            loadCustomerApplications();
          }}
        />
      )}
    </>
  );
}
