import type { TFunction } from "i18next";
import { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext } from "./DashboardLayout";
import { jobsApi } from "../api/client";
import StarRating from "../components/StarRating";
import JobOccupancyRateCard from "../components/JobOccupancyRateCard";
import PeopleEmployedStatCard from "../components/PeopleEmployedStatCard";
import JobCategoriesPieCard from "../components/JobCategoriesPieCard";

function PieChart({
  data,
  t,
  className = "w-44 h-44",
}: {
  data: Array<{ code: number | string; title: string; count: number }>;
  t: TFunction;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const size = className;

  if (total === 0) {
    return (
      <div className={`${size} rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-2">
          <svg className="w-7 h-7 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 6.75h4.5M9 10h6M9 14h6m-5.25 4h4.5M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-sm font-medium text-gray-600">{t("dashboard.noData", "Fără date")}</span>
        </div>
      </div>
    );
  }

  const colors = [
    "rgb(122 99 241)", // primary
    "rgb(139 92 246)", // purple-500
    "rgb(168 85 247)", // purple-400
    "rgb(192 132 252)", // purple-300
    "rgb(217 70 239)", // fuchsia-500
    "rgb(236 72 153)", // pink-500
    "rgb(251 113 133)", // rose-400
    "rgb(249 115 22)", // orange-500
  ];

  let currentAngle = -90; // Start from top
  const radius = 60;
  const centerX = 70;
  const centerY = 70;

  const paths = data.map((item, idx) => {
    const percentage = item.count / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    return (
      <path
        key={item.code}
        d={pathData}
        fill={colors[idx % colors.length]}
        stroke="white"
        strokeWidth="2"
      />
    );
  });

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className={size}>
      {paths}
    </svg>
  );
}

const STATS_ICONS = {
  applications: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  rating: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
};

export default function DashboardRapoarte() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { jobsAdded, userRating } = useContext(DashboardContext);
  const isAdmin = user?.role === "admin";
  const [generalStats, setGeneralStats] = useState<{ 
    totalEmployees: number; 
    categoriesByJobCount: Array<{ code: number; title: string; count: number }>;
    branchesByJobCount: Array<{ branchId: string; branchName: string; count: number }>;
  } | null>(null);

  const fetchGeneralStats = useCallback(() => {
    if (!user?.id) return;
    jobsApi
      .getStatistics()
      .then((stats) => {
        setGeneralStats(stats);
      })
      .catch(() => setGeneralStats(null));
  }, [user?.id]);

  useEffect(() => {
    fetchGeneralStats();
  }, [fetchGeneralStats]);

  const allJobs = useMemo(() => [...jobsAdded], [jobsAdded]);

  const totalApplications = useMemo(
    () => allJobs.reduce((sum, j) => sum + (j.applicationsCount ?? 0), 0),
    [allJobs]
  );
  const ratingValue = userRating?.average ?? 0;
  const ratingReviews = userRating?.count ?? 0;

  const jobFillRate = useMemo(() => {
    const totalSlots = allJobs.reduce((sum, j) => sum + (parseInt(String(j.peopleNeeded ?? "1"), 10) || 1), 0);
    if (totalSlots === 0) return 0;
    const filled = allJobs.reduce((sum, j) => sum + (j.applicationsCount ?? 0), 0);
    return Math.min(100, Math.round((filled / totalSlots) * 100));
  }, [allJobs]);

  const statsWithValues = useMemo(
    () => {
      if (isAdmin) return [];
      return [
        { labelKey: "statsApplications", value: String(totalApplications), icon: STATS_ICONS.applications },
        {
          labelKey: "statsRating",
          value: ratingReviews === 0 ? "—" : String(ratingValue),
          icon: STATS_ICONS.rating,
          isRating: true,
          ratingAverage: ratingValue,
          ratingCount: ratingReviews,
        },
      ];
    },
    [isAdmin, totalApplications, ratingValue, ratingReviews]
  );

  const branchesTotal = generalStats?.branchesByJobCount.reduce((sum, c) => sum + c.count, 0) ?? 0;


  return (
    <>
      <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">Rapoarte</h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md">Generează rapoarte despre activitate și performanță.</p>
      </header>

      {!isAdmin && (
        <>
          {/* Statistics Section */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-6 md:mb-8">
            {statsWithValues.map((s) => {
              const isRating = "isRating" in s && s.isRating;
              const ratingAverage = isRating && "ratingAverage" in s ? (s as { ratingAverage: number }).ratingAverage : 0;
              const ratingCount = isRating && "ratingCount" in s ? (s as { ratingCount: number }).ratingCount : 0;
              return (
                <article
                  key={s.labelKey}
                  className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3 sm:gap-4"
                >
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
        </>
      )}

      {/* Job fill rate, People Hired, Job Categories Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-6 md:mb-8">
        {/* Job fill rate */}
        {!isAdmin && <JobOccupancyRateCard title={t("dashboard.jobFillRate")} value={jobFillRate} />}
        {/* People Hired */}
        {generalStats && (
          <PeopleEmployedStatCard
            title={t("dashboard.peopleHired") || "Oameni angajați"}
            description={t("dashboard.totalEmployeesWorked") || "angajați au lucrat"}
            value={generalStats.totalEmployees ?? 0}
          />
        )}
        {/* Job Categories Pie Chart */}
        {generalStats && generalStats.categoriesByJobCount.length > 0 && (
          <JobCategoriesPieCard
            title={t("dashboard.jobCategoriesDistribution") || "Distribuția joburilor pe categorii"}
            data={generalStats.categoriesByJobCount}
            t={t}
          />
        )}
      </section>

      {/* Branches Pie Chart */}
      {generalStats && generalStats.branchesByJobCount.length > 0 && (
        <section className="mb-6 md:mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("dashboard.branchesDistribution") || "Distribuția joburilor pe filiale"}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {branchesTotal > 0 ? "Distribuție pe filiale." : "Încă nu există date pentru filiale."}
                </p>
              </div>
            </div>

            {branchesTotal === 0 ? (
              <div className="min-h-[260px] flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/40">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 6.75h4.5M9 10h6M9 14h6m-5.25 4h4.5M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-semibold text-gray-900">
                  {t("dashboard.noData", "Fără date")}
                </p>
                <p className="mt-1 text-xs text-gray-500 max-w-sm text-center">
                  {t("dashboard.noJobsYetShort", "Nu există încă joburi disponibile.")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <div className="flex-shrink-0">
                  <PieChart
                    data={generalStats.branchesByJobCount.map((b, idx) => ({ code: idx, title: b.branchName, count: b.count }))}
                    t={t}
                  />
                </div>

                <div className="flex-1 w-full max-w-[360px] space-y-2">
                  {generalStats.branchesByJobCount.map((branch, idx) => {
                    const colors = [
                      "rgb(122 99 241)", // primary
                      "rgb(139 92 246)", // purple-500
                      "rgb(168 85 247)", // purple-400
                      "rgb(192 132 252)", // purple-300
                      "rgb(217 70 239)", // fuchsia-500
                      "rgb(236 72 153)", // pink-500
                      "rgb(251 113 133)", // rose-400
                      "rgb(249 115 22)", // orange-500
                    ];
                    const color = colors[idx % colors.length];
                    const percentage = branchesTotal > 0 ? Math.round((branch.count / branchesTotal) * 100) : 0;
                    return (
                      <div
                        key={branch.branchId}
                        className="grid grid-cols-[16px_1fr_auto] items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/30 px-3 py-2"
                      >
                        <div className="w-4 h-4 rounded-md flex-shrink-0" style={{ backgroundColor: color }} aria-hidden />
                        <span className="text-sm text-gray-800 leading-tight break-words">{branch.branchName}</span>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-gray-900 tabular-nums">{branch.count}</div>
                          <div className="text-xs text-gray-500">({percentage}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
