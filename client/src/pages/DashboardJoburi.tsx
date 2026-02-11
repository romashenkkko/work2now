import { useContext, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext, getApplications, setApplications, type JobRow } from "./DashboardLayout";
import { jobsApi } from "../api/client";
import JobsMapModal from "../components/JobsMapModal";
import JobScheduleModal from "../components/JobScheduleModal";
import { MapPin, Clock, Users, Banknote, Calendar, Briefcase, Map, Search } from "lucide-react";

export default function DashboardJoburi() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { jobsAdded, openPostJobModal, removeJob, jobsLoadError } = useContext(DashboardContext);
  const [showMapModal, setShowMapModal] = useState(false);
  const [scheduleJob, setScheduleJob] = useState<JobRow | null>(null);

  const roleLower = user?.role?.toLowerCase?.();
  const isCustomer = roleLower === "customer";
  const isStaff = roleLower === "staff";
  const jobs = isCustomer ? jobsAdded : [];
  const jobsWithLocation = jobs.filter((j) => j.location?.trim());

  type MyAppInfo = { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] };
  const [publicJobs, setPublicJobs] = useState<JobRow[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, MyAppInfo>>({});
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);
  const [checkInOutLoading, setCheckInOutLoading] = useState<string | null>(null);
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

  const refreshStaffData = () => {
    if (!isStaff) return;
    setStaffLoading(true);
    setStaffLoadError(null);
    Promise.all([jobsApi.list(), jobsApi.myApplications()])
      .then(([jobsRes, appRes]) => {
        const list = (jobsRes.jobs || []).map((j: Record<string, unknown>) => ({
          id: j.id,
          job: j.job,
          location: j.location,
          status: j.status,
          statusClass: j.statusClass ?? "bg-gray-100 text-gray-700",
          date: j.date,
          endDate: j.endDate,
          jobType: j.jobType,
          applicationsCount: j.applicationsCount ?? 0,
          startTime: j.startTime,
          endTime: j.endTime,
          peopleNeeded: j.peopleNeeded,
          duration: j.duration,
          estimatedSalary: j.estimatedSalary,
          imageUrl: j.imageUrl,
          postedBy: j.postedBy ?? (j.posted_by_name as string),
        }));
        setPublicJobs(list);
        setApplicationsByJob(appRes.byJob ?? {});
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
      .finally(() => setStaffLoading(false));
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
  const handleCheckIn = (e: React.MouseEvent, applicationId: string, workDate?: string) => {
    e?.stopPropagation?.();
    const key = workDate ? `${applicationId}-${workDate}` : applicationId;
    setCheckInOutLoading(key);
    jobsApi.checkIn(applicationId, workDate).then(() => refreshStaffData()).finally(() => setCheckInOutLoading(null));
  };
  const handleCheckOut = (e: React.MouseEvent, applicationId: string, workDate?: string) => {
    e?.stopPropagation?.();
    const key = workDate ? `${applicationId}-${workDate}` : applicationId;
    setCheckInOutLoading(key);
    jobsApi.checkOut(applicationId, workDate).then(() => refreshStaffData()).finally(() => setCheckInOutLoading(null));
  };
  const handleCheckInFromModal = (applicationId: string, workDate: string) => {
    setCheckInOutLoading(`${applicationId}-${workDate}`);
    jobsApi.checkIn(applicationId, workDate).then(() => refreshStaffData()).finally(() => setCheckInOutLoading(null));
  };
  const handleCheckOutFromModal = (applicationId: string, workDate: string) => {
    setCheckInOutLoading(`${applicationId}-${workDate}`);
    jobsApi.checkOut(applicationId, workDate).then(() => refreshStaffData()).finally(() => setCheckInOutLoading(null));
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
  const getTodaySession = (app: MyAppInfo) => {
    const fromSessions = app.workSessions?.find((s) => s.workDate === todayYMD);
    if (fromSessions) return { ...fromSessions, workDate: todayYMD };
    if (app.checkedInAt) return { workDate: todayYMD, checkedInAt: app.checkedInAt, checkedOutAt: app.checkedOutAt };
    return null;
  };

  if (isStaff) {
    const myApp = (jobId: string) => applicationsByJob[jobId];
    const staffJobsWithLocation = publicJobs.filter((j) => j.location?.trim());
    const q = searchQuery.trim().toLowerCase();
    const filteredJobs = publicJobs.filter((row) => {
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
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.joburi")}</h1>
            <p className="text-gray-600">{t("dashboard.staffJoburiDesc")}</p>
          </div>
          {staffJobsWithLocation.length > 0 && (
            <div className="flex justify-end sm:flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                aria-label={t("dashboard.showMap")}
                title={t("dashboard.showMap")}
                className="flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-primary bg-white text-primary hover:bg-primary hover:text-white transition-colors shadow-sm"
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
            {filteredJobs.map((row, i) => {
              const app = myApp(row.id ?? "");
              const status = app?.status;
              const isAccepted = status === "accepted";
              return (
                <article
                  key={row.id ?? `pj-${i}`}
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
                            <img src="/LogoTime2Go.png" alt="" className="w-7 h-7 object-contain" />
                          </div>
                          <span className="text-white font-semibold text-base">Time2Go</span>
                        </div>
                      </>
                    )}
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium bg-white/25 text-white backdrop-blur-sm">
                      {row.status}
                    </span>
                  </div>
                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    <h2 className="text-lg font-bold text-gray-900 mb-3">{row.job}</h2>
                    <ul className="space-y-2 text-sm text-gray-600 flex-1">
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
                      {row.estimatedSalary && (
                        <li className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-primary shrink-0" />
                          <span>{row.estimatedSalary}</span>
                        </li>
                      )}
                    </ul>
                    {row.postedBy && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {row.postedBy.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600">
                          {t("dashboard.postedBy")}: <span className="font-medium text-gray-900">{row.postedBy}</span>
                        </span>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      {!app ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleApply(row); }}
                          className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
                        >
                          {t("dashboard.apply")}
                        </button>
                      ) : !isAccepted ? (
                        <span className={`inline-block w-full py-2.5 rounded-xl text-center text-sm font-medium ${
                          status === "refused" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {status === "refused" ? t("dashboard.refused") : t("dashboard.pending")}
                        </span>
                      ) : (() => {
                        const todaySession = getTodaySession(app);
                        const loadingKey = `${app.applicationId}-${todayYMD}`;
                        const loading = checkInOutLoading === app.applicationId || checkInOutLoading === loadingKey;
                        const hasMultipleDays = (app.workSessions?.length ?? 0) > 0 || (row.date && row.endDate && row.endDate !== row.date);
                        return (
                          <>
                            {!todaySession?.checkedInAt ? (
                              <button
                                type="button"
                                onClick={(e) => handleCheckIn(e, app.applicationId, todayYMD)}
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
                                  onClick={(e) => handleCheckOut(e, app.applicationId, todayYMD)}
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
                            {hasMultipleDays && (
                              <p className="text-xs text-primary mt-1">
                                {t("dashboard.upcomingJobs")} → {t("dashboard.listView")}
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
          jobs={staffJobsWithLocation.map((j) => ({ job: j.job, location: j.location ?? "" }))}
        />
        <JobScheduleModal
          open={scheduleJob !== null}
          onClose={() => setScheduleJob(null)}
          job={scheduleJob}
          myAppInfo={scheduleJob?.id && applicationsByJob[scheduleJob.id]?.status === "accepted" ? { applicationId: applicationsByJob[scheduleJob.id].applicationId, workSessions: applicationsByJob[scheduleJob.id].workSessions ?? [] } : null}
          onCheckIn={handleCheckInFromModal}
          onCheckOut={handleCheckOutFromModal}
          checkInOutLoading={checkInOutLoading}
        />
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
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.joburi")}</h1>
          <p className="text-gray-600">Gestionează anunțurile de joburi publicate.</p>
        </div>
        <div className="flex justify-end sm:flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            aria-label={t("dashboard.showMap")}
            title={t("dashboard.showMap")}
            className="flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-primary bg-white text-primary hover:bg-primary hover:text-white transition-colors shadow-sm"
          >
            <Map className="w-6 h-6 shrink-0" />
          </button>
        </div>
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
              {/* Fără imagine: logo Time2Go + violet. Cu imagine: doar imaginea customerului. */}
              <div className="relative h-24 sm:h-28 bg-primary flex items-center justify-center overflow-hidden">
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
                    <div className="relative flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-full bg-white/95 shadow flex items-center justify-center overflow-hidden ring-2 ring-white/50">
                        <img src="/LogoTime2Go.png" alt="" className="w-7 h-7 object-contain" />
                      </div>
                      <span className="text-white font-semibold text-base drop-shadow-sm">Time2Go</span>
                    </div>
                  </>
                )}
                <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium bg-white/25 text-white backdrop-blur-sm">
                  {row.status}
                </span>
              </div>

              {/* Body: titlu + rânduri cu icoane */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
                <h2 className="text-lg font-bold text-gray-900 mb-4 leading-tight">{row.job}</h2>

                <ul className="space-y-2.5 flex-1">
                  <li className="flex items-center gap-3 text-gray-600 text-sm">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-primary" />
                    </span>
                    <span className="truncate">{row.job}</span>
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
                  {row.estimatedSalary && (
                    <li className="flex items-center gap-3 text-gray-600 text-sm">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Banknote className="w-4 h-4 text-primary" />
                      </span>
                      <span>{row.estimatedSalary}</span>
                    </li>
                  )}
                  {row.peopleNeeded && (
                    <li className="flex items-center gap-3 text-gray-600 text-sm">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </span>
                      <span>{row.peopleNeeded}</span>
                    </li>
                  )}
                </ul>

                {row.postedBy && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {row.postedBy.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {t("dashboard.postedBy")}: <span className="font-medium text-gray-900">{row.postedBy}</span>
                    </span>
                  </div>
                )}

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

      <JobsMapModal
        open={showMapModal}
        onClose={() => setShowMapModal(false)}
        jobs={jobs.map((j) => ({ job: j.job, location: j.location ?? "" }))}
      />
      <JobScheduleModal
        open={scheduleJob !== null}
        onClose={() => setScheduleJob(null)}
        job={scheduleJob}
      />
    </>
  );
}
