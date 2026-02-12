import { useState, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext } from "./DashboardLayout";
import StarRating from "../components/StarRating";

const STATS_ICONS = {
  applications: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  checkin: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  rating: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
};

export default function DashboardHomeCustomer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openPostJobModal, jobsAdded, removeJob } = useContext(DashboardContext);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const allJobs = useMemo(() => [...jobsAdded], [jobsAdded]);

  const totalApplications = useMemo(
    () => allJobs.reduce((sum, j) => sum + (j.applicationsCount ?? 0), 0),
    [allJobs]
  );
  const totalCheckins = 0;
  const ratingValue = 0;
  const ratingReviews = 0;

  const statsWithValues = useMemo(
    () => [
      { labelKey: "statsApplications", value: String(totalApplications), icon: STATS_ICONS.applications },
      { labelKey: "statsCheckin", value: String(totalCheckins), icon: STATS_ICONS.checkin },
      { labelKey: "statsRating", value: ratingReviews === 0 ? "—" : String(ratingValue), icon: STATS_ICONS.rating, isRating: true, ratingAverage: ratingValue, ratingCount: ratingReviews },
    ],
    [totalApplications, totalCheckins, ratingValue, ratingReviews]
  );

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      <div className="page-enter-stagger">
      <header className="mb-6 md:mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{t("dashboard.hello", { name: user?.name ?? "" })}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-0.5">{t("dashboard.subtitleToday")}</p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 md:mb-8">
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
                            className="text-red-600 text-xs sm:text-sm font-medium hover:underline"
                          >
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

      </div>
    </>
  );
}
