import { useContext, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, getApplications, setApplications, JobTitleIcon, type Application, type JobRow } from "./DashboardLayout";
import { jobsApi, ratingsApi } from "../api/client";
import { Briefcase, MapPin, Calendar, User, Mail, Clock, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import StarRating from "../components/StarRating";

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
  const { user } = useAuth();
  const ctx = useContext(DashboardContext);
  const jobsAdded = ctx?.jobsAdded ?? [];
  const refreshJobs = ctx?.refreshJobs ?? (() => {});
  const [applications, setApplicationsState] = useState<Record<string, Application[]>>({});

  /** Accept confirmation: show "Are you sure you want to accept [Name]?" before calling setStatus(accepted). */
  const [acceptConfirm, setAcceptConfirm] = useState<{ jobId: string; applicationId: string; staffName: string } | null>(null);

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
                      <Briefcase className="w-5 h-5 text-primary" />
                      <span className="truncate">{a.jobTitle || `Job #${a.jobId}`}</span>
                    </h3>

                    {(a.jobLocation || a.customerName) && (
                      <p className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {a.jobLocation && (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-4 h-4 shrink-0" />
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
                            <Calendar className="w-4 h-4 shrink-0" />
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

                    {a.status === "accepted" && (() => {
                      const sessions =
                        a.workSessions && a.workSessions.length > 0
                          ? a.workSessions
                          : (a.checkedInAt ? [{ workDate: "", checkedInAt: a.checkedInAt, checkedOutAt: a.checkedOutAt }] : []);
                      if (sessions.length === 0) return null;
                      return (
                        <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                          {sessions.map((s) => (
                            <p key={s.workDate || "single"}>
                              {s.workDate && <span className="font-medium">{formatAppDate(s.workDate)}: </span>}
                              {s.checkedInAt && <span>{t("dashboard.checkedInAt")} {formatAppTime(s.checkedInAt)}</span>}
                              {s.checkedInAt && s.checkedOutAt && " · "}
                              {s.checkedOutAt && <span>{t("dashboard.checkedOutAt")} {formatAppTime(s.checkedOutAt)}</span>}
                            </p>
                          ))}
                        </div>
                      );
                    })()}

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

  // Helper function to extract job icon ID from job title or category
  const getJobIconId = (jobTitle?: string, jobCategoryTitle?: string): string => {
    if (!jobTitle && !jobCategoryTitle) return "waiter";
    const title = (jobCategoryTitle || jobTitle || "").toLowerCase();
    // Map common job titles/categories to icon IDs
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
    return "waiter"; // default
  };

  // -----------------------------
  // CUSTOMER VIEW (APPLICANTS)
  // -----------------------------

  const jobsWithApplicants = myJobs
    .map((job) => {
      const jobKey = String(job?.id ?? "").trim();
      const applicants = (applications[jobKey] || [])
        .filter((a) => a.staffId && !a.businessConfirmedAt);
      return { job, applicants };
    })
    .filter(({ applicants }) => applicants.length > 0);

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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.aplicatii")}</h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md">Vezi aplicațiile candidaților la joburile tale.</p>
      </header>

      {jobsWithApplicants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500">Aici vor apărea aplicațiile primite. Momentan nu există aplicații noi.</p>
        </div>
      ) : (
        <div className="space-y-6">
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
                        <ApplicantAvatar staffAvatar={a.staffAvatar} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{a.staffName}</p>
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

                          {a.status === "accepted" &&
                            (() => {
                              const sessions =
                                a.workSessions && a.workSessions.length > 0
                                  ? a.workSessions
                                  : a.checkedInAt
                                    ? [{ workDate: "", checkedInAt: a.checkedInAt, checkedOutAt: a.checkedOutAt }]
                                    : [];
                              if (sessions.length === 0) return null;
                              return (
                                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                  {sessions.map((s) => (
                                    <p key={s.workDate || "single"}>
                                      {s.workDate && <span className="font-medium">{formatAppDate(s.workDate)}: </span>}
                                      {s.checkedInAt && (
                                        <span>
                                          {t("dashboard.checkedInAt")} {formatAppTime(s.checkedInAt)}
                                        </span>
                                      )}
                                      {s.checkedInAt && s.checkedOutAt && " · "}
                                      {s.checkedOutAt && (
                                        <span>
                                          {t("dashboard.checkedOutAt")} {formatAppTime(s.checkedOutAt)}
                                        </span>
                                      )}
                                    </p>
                                  ))}
                                </div>
                              );
                            })()}

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
                                <>
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
                                </>
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
      )}
    </>
  );
}
