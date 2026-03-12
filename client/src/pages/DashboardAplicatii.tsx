import { useContext, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, getApplications, setApplications, JobTitleIcon, type Application, type JobRow } from "./DashboardLayout";
import { jobsApi, ratingsApi } from "../api/client";
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

function formatAppTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatAppDate(ymd: string): string {
  try {
    const [y, m, day] = ymd.split("-").map(Number);
    const d = new Date(y, (m ?? 1) - 1, day ?? 1);
    return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
  } catch {
    return ymd;
  }
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
  const { t } = useTranslation();
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
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null);
  const [ratingDraft, setRatingDraft] = useState<Record<string, { score: number; comment: string }>>({});

  const confirmCompletion = (applicationId: string) => {
    setConfirmingCompletionId(applicationId);
    jobsApi
      .confirmCompletion(applicationId)
      .then(() => {
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

    return (
      <>
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.aplicatii")}</h1>
          <p className="text-gray-600">{t("dashboard.myApplications")}</p>
        </header>

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
            <p className="text-gray-500">Aici vor apărea aplicațiile tale la joburi.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <JobTitleIcon
                        jobId={getJobIconId(a.jobTitle)}
                        className="w-5 h-5 text-primary shrink-0"
                        size={20}
                      />
                      <span className="truncate">{a.jobTitle || `Job #${a.jobId}`}</span>
                    </h3>

                    {(a.jobLocation || a.customerName) && (
                      <p className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {a.jobLocation && (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{a.jobLocation}</span>
                          </span>
                        )}
                        {a.customerName && (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <User className="w-4 h-4 shrink-0" />
                            <span className="truncate">{a.customerName}</span>
                          </span>
                        )}
                      </p>
                    )}

                    {(a.jobDate || a.createdAt) && (
                      <p className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {a.jobDate && (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            {a.jobDate}
                            {a.jobEndDate && a.jobEndDate !== a.jobDate ? ` – ${a.jobEndDate}` : ""}
                          </span>
                        )}
                        {a.createdAt && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-4 h-4 shrink-0" />
                            {new Date(a.createdAt).toLocaleString("ro-RO")}
                          </span>
                        )}
                      </p>
                    )}

                    {statusBadge(t, a.status)}

                    {a.status === "accepted" && a.checkedOutAt && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {a.ratingScore != null ? (
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            {t("dashboard.rated")}:
                            <StarRating value={a.ratingScore} size={16} />
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {t("dashboard.rated") || "Rated"}: —
                          </span>
                        )}
                      </div>
                    )}
                  </div>
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
          <p className="text-gray-500">Aici vor apărea aplicațiile tale la joburi.</p>
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

  return (
    <>
      {acceptConfirmModal}

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
                className="block"
              />
              <div className="block" ref={historyJobDropdownRef}>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{t("dashboard.job")}</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHistoryJobDropdownOpen((open) => !open)}
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[rgba(224,216,247,0.9)] bg-white px-4 py-2 text-left text-sm font-medium text-gray-800 shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-[rgba(177,163,241,0.6)] hover:bg-[rgba(250,248,255,0.8)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          <p className="text-gray-500">Aici vor apărea aplicațiile primite. Momentan nu există aplicații noi.</p>
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
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
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

                          {a.status === "accepted" && a.checkedOutAt && (
                            <div className="mt-2 space-y-2">
                              {!a.businessConfirmedAt && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => confirmCompletion(a.id)}
                                    disabled={confirmingCompletionId === a.id}
                                    className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                                  >
                                    {confirmingCompletionId === a.id ? "..." : t("dashboard.confirmFinished")}
                                  </button>
                                </div>
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
                                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
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
