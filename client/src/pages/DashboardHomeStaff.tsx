import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { jobsApi } from "../api/client";
import { DashboardContext } from "./DashboardLayout";
import StarRating from "../components/StarRating";

const STATS_KEYS = [
  { labelKey: "statsMyApplications", metaKey: "statsMyApplicationsMeta", value: "5" },
  { labelKey: "statsSavedJobs", metaKey: "statsSavedJobsMeta", value: "12" },
  { labelKey: "statsMyRating", metaKey: "statsMyRatingMeta", isRating: true },
  { labelKey: "statsAvailability", metaKey: "statsAvailabilityMeta", value: "—", highlight: true },
];

type JobItem = { id: string; job: string; location: string; jobType?: string };

export default function DashboardHomeStaff() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userRating } = useContext(DashboardContext);
  const [toast, setToast] = useState<string | null>(null);
  const [recommendedJobs, setRecommendedJobs] = useState<JobItem[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string }>>({});
  const [jobsLoading, setJobsLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (user?.role !== "staff") return;
    setJobsLoading(true);
    Promise.all([jobsApi.list(), jobsApi.myApplications()])
      .then(([jobsRes, appRes]) => {
        const list = (jobsRes.jobs || [])
          .slice(0, 3)
          .map((j: Record<string, unknown>) => ({
            id: String(j.id ?? ""),
            job: String(j.job ?? ""),
            location: String(j.location ?? ""),
            jobType: j.jobType != null ? String(j.jobType) : undefined,
          }));
        setRecommendedJobs(list);
        setApplicationsByJob(appRes.byJob ?? {});
      })
      .catch(() => setRecommendedJobs([]))
      .finally(() => setJobsLoading(false));
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
      })
      .catch(() => showToast(t("dashboard.applyError") || "Nu s-a putut trimite aplicarea."))
      .finally(() => setApplyingId(null));
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      <div className="page-enter-stagger">
        <header className="mb-6 md:mb-8 w-full flex items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{t("dashboard.hello", { name: user?.name ?? "" })}</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-0.5">{t("dashboard.staffSubtitle")}</p>
          </div>
          <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 md:mb-8">
          {STATS_KEYS.map((s) => {
            const isRating = "isRating" in s && s.isRating;
            const value = isRating
              ? (userRating && userRating.count > 0 ? Number(userRating.average).toFixed(1) : "—")
              : s.value;
            const meta = isRating && userRating && userRating.count > 0
              ? t("dashboard.statsRatingMetaReviews", { count: userRating.count })
              : t(`dashboard.${s.metaKey}`);
            return (
              <article
                key={s.labelKey}
                className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm ${s.highlight ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t(`dashboard.${s.labelKey}`)}</h3>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
                <span className="text-xs sm:text-sm text-gray-500 truncate block">{meta}</span>
                {isRating && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <StarRating value={userRating?.average ?? 0} size={18} />
                    {userRating && userRating.count > 0 && (
                      <span className="text-xs text-gray-500">({userRating.count})</span>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>

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
                        <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{j.job}</p>
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
