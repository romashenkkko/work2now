import { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext } from "./DashboardLayout";
import { jobsApi } from "../api/client";
import StarRating from "../components/StarRating";

function PieChart({ data, t }: { data: Array<{ code: number | string; title: string; count: number }>; t: (key: string) => string }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return (
      <div className="w-48 h-48 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-500">{t("dashboard.noData") || "Fără date"}</span>
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
    <svg width="140" height="140" viewBox="0 0 140 140" className="w-48 h-48">
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
    () => [
      { labelKey: "statsApplications", value: String(totalApplications), icon: STATS_ICONS.applications },
      { labelKey: "statsRating", value: ratingReviews === 0 ? "—" : String(ratingValue), icon: STATS_ICONS.rating, isRating: true, ratingAverage: ratingValue, ratingCount: ratingReviews },
    ],
    [totalApplications, ratingValue, ratingReviews]
  );


  return (
    <>
      <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">Rapoarte</h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md">Generează rapoarte despre activitate și performanță.</p>
      </header>

      {/* Statistics Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-6 md:mb-8">
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

      {/* Job fill rate, People Hired, Job Categories Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 md:mb-8">
        {/* Job fill rate */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard.jobFillRate")}</h3>
          <div className="flex justify-center">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(229 231 235)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(122 99 241)" strokeWidth="10" strokeDasharray={`${jobFillRate * 2.64} 264`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-gray-900">{jobFillRate}%</span>
            </div>
          </div>
        </div>
        {/* People Hired */}
        {generalStats && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard.peopleHired") || "Oameni angajați"}</h3>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl sm:text-5xl font-bold text-primary mb-2">{generalStats.totalEmployees ?? 0}</p>
                <p className="text-sm text-gray-500">{t("dashboard.totalEmployeesWorked") || "angajați au lucrat"}</p>
              </div>
            </div>
          </div>
        )}
        {/* Job Categories Pie Chart */}
        {generalStats && generalStats.categoriesByJobCount.length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard.jobCategoriesDistribution") || "Distribuția joburilor pe categorii"}</h3>
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              {/* Pie Chart */}
              <div className="flex-shrink-0">
                <PieChart data={generalStats.categoriesByJobCount} t={t} />
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {generalStats.categoriesByJobCount.map((cat, idx) => {
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
                  const total = generalStats.categoriesByJobCount.reduce((sum, c) => sum + c.count, 0);
                  const percentage = total > 0 ? Math.round((cat.count / total) * 100) : 0;
                  return (
                    <div key={cat.code} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700 flex-1 truncate">{cat.title}</span>
                      <span className="text-sm font-semibold text-gray-900">{cat.count}</span>
                      <span className="text-xs text-gray-500">({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Branches Pie Chart */}
      {generalStats && generalStats.branchesByJobCount.length > 0 && (
        <section className="mb-6 md:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard.branchesDistribution") || "Distribuția joburilor pe filiale"}</h3>
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              {/* Pie Chart */}
              <div className="flex-shrink-0">
                <PieChart 
                  data={generalStats.branchesByJobCount.map((b, idx) => ({ code: idx, title: b.branchName, count: b.count }))} 
                  t={t} 
                />
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
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
                  const total = generalStats.branchesByJobCount.reduce((sum, b) => sum + b.count, 0);
                  const percentage = total > 0 ? Math.round((branch.count / total) * 100) : 0;
                  return (
                    <div key={branch.branchId} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700 flex-1 truncate">{branch.branchName}</span>
                      <span className="text-sm font-semibold text-gray-900">{branch.count}</span>
                      <span className="text-xs text-gray-500">({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
