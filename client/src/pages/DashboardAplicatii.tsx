import { useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, getApplications, setApplications, JobTitleIcon, JOB_TITLE_OPTIONS, type Application } from "./DashboardLayout";
import { jobsApi, ratingsApi } from "../api/client";
import { MapPin, Calendar, User, Mail } from "lucide-react";
import StarRating from "../components/StarRating";

function ApplicantAvatar({ staffAvatar }: { staffAvatar?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = staffAvatar && !imgFailed;
  useEffect(() => setImgFailed(false), [staffAvatar]);
  return (
    <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border border-gray-200">
      {showImg ? (
        <img
          src={staffAvatar}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <User className="w-5 h-5 text-primary" />
      )}
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

export default function DashboardAplicatii() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { jobsAdded, refreshJobs } = useContext(DashboardContext);
  const [applications, setApplicationsState] = useState<Record<string, Application[]>>({});

  const refreshApplications = () => {
    if (user?.role !== "customer") return;
    jobsApi
      .applications()
      .then((r) => {
        const map: Record<string, Application[]> = {};
        Object.keys(r.applications || {}).forEach((jobId) => {
          map[jobId] = (r.applications![jobId] || []).map((a: Record<string, unknown>) => {
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
              completedAt: a.completedAt as string | undefined,
              checkedInAt: a.checkedInAt as string | undefined,
              checkedOutAt: a.checkedOutAt as string | undefined,
              workSessions: Array.isArray(a.workSessions) ? a.workSessions as { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] : undefined,
              ratingScore: a.ratingScore != null ? Number(a.ratingScore) : undefined,
            };
          });
        });
        setApplicationsState(map);
      })
      .catch(() => setApplicationsState(getApplications()));
  };

  useEffect(() => {
    if (user?.role === "customer") refreshApplications();
    else setApplicationsState(getApplications());
  }, [user?.role, user?.id]);

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null);

  const markComplete = (applicationId: string) => {
    setCompletingId(applicationId);
    jobsApi
      .completeApplication(applicationId)
      .then(() => refreshApplications())
      .finally(() => setCompletingId(null));
  };

  const submitRating = (applicationId: string, score: number) => {
    setRatingSubmitting(applicationId);
    ratingsApi
      .submit(applicationId, score)
      .then(() => refreshApplications())
      .finally(() => setRatingSubmitting(null));
  };

  const setStatus = (jobId: string, applicationId: string, status: "accepted" | "refused") => {
    jobsApi
      .setApplicationStatus(applicationId, status)
      .then(() => {
        refreshApplications();
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
  const myJobs = isCustomer ? jobsAdded : [];

  /** Iconița jobului după titlu (Ospătar -> waiter, Barman -> bartender, etc.) */
  const getJobIconId = (jobTitle: string | undefined): string => {
    if (!jobTitle) return "";
    const opt = JOB_TITLE_OPTIONS.find((o) => t(o.labelKey) === jobTitle);
    return opt?.id ?? "";
  };

  // Staff: istoricul aplicațiilor (joburi la care a aplicat)
  type StaffAppItem = {
    jobId: string;
    job?: { id: string; job: string; location?: string; date?: string; endDate?: string; status?: string };
    app: { status: string; applicationId: string; workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] };
  };
  const [staffHistory, setStaffHistory] = useState<StaffAppItem[]>([]);
  const [staffHistoryLoading, setStaffHistoryLoading] = useState(false);
  useEffect(() => {
    if (user?.role !== "staff") return;
    setStaffHistoryLoading(true);
    Promise.all([jobsApi.myApplications(), jobsApi.list()])
      .then(([appRes, jobsRes]) => {
        const byJob = appRes.byJob ?? {};
        const jobs = (jobsRes.jobs || []) as { id: string; job: string; location?: string; date?: string; endDate?: string; status?: string }[];
        const list: StaffAppItem[] = Object.entries(byJob).map(([jobId, app]) => ({
          jobId,
          job: jobs.find((j) => String(j.id) === jobId),
          app: {
            status: app.status,
            applicationId: app.applicationId,
            workSessions: app.workSessions ?? [],
          },
        }));
        setStaffHistory(list);
      })
      .catch(() => setStaffHistory([]))
      .finally(() => setStaffHistoryLoading(false));
  }, [user?.role, user?.id]);

  if (!isCustomer) {
    return (
      <>
        <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.aplicatii")}</h1>
          <p className="text-gray-500 text-sm mt-1.5 max-w-md">{t("dashboard.myApplications")}</p>
        </header>
        {staffHistoryLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">Se încarcă aplicațiile...</p>
          </div>
        ) : staffHistory.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500">Aici vor apărea aplicațiile tale la joburi.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {staffHistory.map(({ jobId, job, app }) => (
              <article
                key={jobId}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <JobTitleIcon jobId={getJobIconId(job?.job)} className="w-5 h-5 text-primary shrink-0" size={20} />
                        {job?.job ?? `Job #${jobId}`}
                      </h2>
                      {job?.location && (
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{job.location}</span>
                        </p>
                      )}
                      {job?.date && (
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 shrink-0" />
                          {job.date}
                          {job.endDate && job.endDate !== job.date ? ` – ${job.endDate}` : ""}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-medium shrink-0 ${
                      app.status === "accepted" ? "bg-green-100 text-green-800" :
                      app.status === "refused" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {app.status === "accepted" ? t("dashboard.accepted") : app.status === "refused" ? t("dashboard.refused") : t("dashboard.pending")}
                    </span>
                  </div>
                  {app.workSessions && app.workSessions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">{t("dashboard.workSessions")}</h3>
                      <ul className="space-y-1.5 text-sm text-gray-600">
                        {app.workSessions.map((s) => (
                          <li key={s.workDate} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="font-medium">{formatAppDate(s.workDate)}</span>
                            {s.checkedInAt && <span>{t("dashboard.checkedInAt")} {formatAppTime(s.checkedInAt)}</span>}
                            {s.checkedOutAt && <span>{t("dashboard.checkedOutAt")} {formatAppTime(s.checkedOutAt)}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </>
    );
  }

  const jobsWithApplicants = myJobs
    .map((job) => ({
      job,
      applicants: (applications[job.id ?? ""] || []).filter((a) => a.staffId),
    }))
    .filter(({ applicants }) => applicants.length > 0);

  return (
    <>
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
          {jobsWithApplicants.map(({ job, applicants }) => (
            <section
              key={job.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <JobTitleIcon jobId={getJobIconId(job.job)} className="w-5 h-5 text-primary shrink-0" size={20} />
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
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("dashboard.applicants")} ({applicants.length})</h3>
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
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                            a.status === "accepted" ? "bg-green-100 text-green-800" :
                            a.status === "refused" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {a.status === "accepted" ? t("dashboard.accepted") : a.status === "refused" ? t("dashboard.refused") : t("dashboard.pending")}
                          </span>
                          {a.status === "accepted" && (() => {
                            const sessions = a.workSessions && a.workSessions.length > 0 ? a.workSessions : (a.checkedInAt ? [{ workDate: "", checkedInAt: a.checkedInAt, checkedOutAt: a.checkedOutAt }] : []);
                            if (sessions.length === 0) return null;
                            return (
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
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
                          {a.status === "accepted" && !a.completedAt && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => markComplete(a.id)}
                                disabled={completingId === a.id}
                                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                              >
                                {completingId === a.id ? "..." : t("dashboard.markCompleted")}
                              </button>
                            </div>
                          )}
                          {a.status === "accepted" && a.completedAt && (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {a.ratingScore != null ? (
                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                  {t("dashboard.rated")}:
                                  <StarRating value={a.ratingScore} size={16} />
                                </span>
                              ) : (
                                <>
                                  <span className="text-sm text-gray-600">{t("dashboard.rateWork")}:</span>
                                  <StarRating
                                    value={0}
                                    editable
                                    onSelect={(score) => submitRating(a.id, score)}
                                  />
                                  {ratingSubmitting === a.id && <span className="text-xs text-gray-500">...</span>}
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
                            onClick={() => job.id && setStatus(job.id, a.id, "accepted")}
                            className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
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
          ))}
        </div>
      )}
    </>
  );
}
