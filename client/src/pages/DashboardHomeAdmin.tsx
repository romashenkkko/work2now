import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { adminApi, authApi, jobsApi, type AdminPayoutListItem } from "../api/client";
import { payoutStatusClassName, payoutStatusLabel } from "../utils/applicationPayouts";

type UserRow = { id: number; name: string; email: string; role: string; isActive?: boolean; phone?: string; boosterUntil?: string };
type RoleFilter = "" | "staff" | "customer" | "admin";

const ROLE_FILTER_OPTIONS: { value: RoleFilter; labelKey: string }[] = [
  { value: "", labelKey: "dashboard.filterAllRoles" },
  { value: "staff", labelKey: "dashboard.roleStaff" },
  { value: "customer", labelKey: "dashboard.roleCustomer" },
  { value: "admin", labelKey: "dashboard.roleAdmin" },
];

type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalJobs: number;
  totalApplications: number;
  salaryByDomain: Array<{ categoryCode: number; categoryTitle: string; avgHourly: number; minHourly: number; maxHourly: number; jobCount: number }>;
  salaryByRegion: Array<{ region: string; avgHourly: number; jobCount: number }>;
  salaryByDomainAndRegion: Array<{ region: string; categoryCode: number; categoryTitle: string; avgHourly: number; jobCount: number }>;
  financial: { totalBase: number; taxesCollected: number; profit: number };
  companyRanking: Array<{ rank: number; companyName: string; userId: string; acceptedCount: number }>;
};

export default function DashboardHomeAdmin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const [copiedCell, setCopiedCell] = useState<{ id: string; field: "email" | "phone" } | null>(null);
  const [boosterUpdatingId, setBoosterUpdatingId] = useState<string | null>(null);
  const [accountsSectionOpen, setAccountsSectionOpen] = useState(true);
  const [salaryDomainOpen, setSalaryDomainOpen] = useState(true);
  const [salaryRegionOpen, setSalaryRegionOpen] = useState(true);
  const [companyRankingOpen, setCompanyRankingOpen] = useState(true);
  const [salaryByDomainAndRegionOpen, setSalaryByDomainAndRegionOpen] = useState(true);
  const [payouts, setPayouts] = useState<AdminPayoutListItem[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutActionId, setPayoutActionId] = useState<string | null>(null);
  const [payoutsSectionOpen, setPayoutsSectionOpen] = useState(true);
  const [orphans, setOrphans] = useState<Array<{
    reservationId: string;
    jobId: string;
    jobStatus: string;
    reservationStatus: string;
    paynetOrderId: string | null;
    issue: string;
  }>>([]);
  const [orphansLoading, setOrphansLoading] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  const [supportCreateForm, setSupportCreateForm] = useState({
    name: "",
    password: "",
    avatar: "",
  });
  const [supportCreateLoading, setSupportCreateLoading] = useState(false);
  const [supportCreateError, setSupportCreateError] = useState<string | null>(null);
  const [supportCreateSuccess, setSupportCreateSuccess] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string, field: "email" | "phone") => {
    if (!text || text === "—") return;
    const done = () => {
      setCopiedCell({ id, field });
      setTimeout(() => setCopiedCell(null), 1500);
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  };

  const fallbackCopy = (text: string, onDone: () => void) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      onDone();
    } catch {
      onDone();
    }
  };

  const fetchUsers = () => {
    if (user?.role !== "admin") return;
    setUsersLoading(true);
    authApi
      .users()
      .then((data) => { setUsers(data.users); setUsersError(null); })
      .catch((e) => setUsersError(e instanceof Error ? e.message : "Eroare la încărcare"))
      .finally(() => setUsersLoading(false));
  };

  const handleCreateSupportTechnician = async () => {
    if (user?.role !== "admin") return;
    setSupportCreateError(null);
    setSupportCreateSuccess(null);

    const name = supportCreateForm.name.trim();
    const password = supportCreateForm.password;
    const avatar = supportCreateForm.avatar.trim();

    if (!name || name.length < 2) {
      setSupportCreateError(t("dashboard.supportCreateNameRequired", "Numele este obligatoriu."));
      return;
    }
    if (!password || password.length < 6) {
      setSupportCreateError(t("dashboard.supportCreatePasswordMin", "Parola trebuie să aibă minim 6 caractere."));
      return;
    }

    setSupportCreateLoading(true);
    try {
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "support";
      const generatedEmail = `${slug}.${Date.now()}@work2now.local`;

      await authApi.supportCreateUser({
        role: "support",
        name,
        email: generatedEmail,
        password,
        avatar: avatar ? avatar : null,
      });
      setSupportCreateSuccess(t("dashboard.supportCreated", `Support technician creat. Email: ${generatedEmail}`));
      setSupportCreateForm({ name: "", password: "", avatar: "" });
      fetchUsers();
    } catch (e) {
      setSupportCreateError(e instanceof Error ? e.message : "Eroare la creare.");
    } finally {
      setSupportCreateLoading(false);
    }
  };

  const fetchAdminStats = () => {
    if (user?.role !== "admin") return;
    jobsApi
      .getAdminStatistics()
      .then((data) => { setAdminStats(data); setStatsError(null); })
      .catch((e) => setStatsError(e instanceof Error ? e.message : "Eroare statistici"));
  };

  const fetchOrphans = () => {
    if (user?.role !== "admin") return;
    setOrphansLoading(true);
    adminApi
      .listOrphanReservations()
      .then((data) => {
        setOrphans(data.orphans ?? []);
        setPayoutsError(null);
      })
      .catch((e) => setPayoutsError(e instanceof Error ? e.message : "Eroare la diagnostic"))
      .finally(() => setOrphansLoading(false));
  };

  const fetchPayouts = () => {
    if (user?.role !== "admin") return;
    setPayoutsLoading(true);
    adminApi
      .listPayouts("payout_pending")
      .then((data) => {
        setPayouts(data.payouts ?? []);
        setPayoutsError(null);
      })
      .catch((e) => setPayoutsError(e instanceof Error ? e.message : "Eroare la încărcarea plăților"))
      .finally(() => setPayoutsLoading(false));
  };

  const runPayoutAction = async (
    payoutId: string,
    action: "paid" | "failed" | "disputed"
  ) => {
    setPayoutActionId(payoutId);
    setPayoutsError(null);
    try {
      if (action === "paid") await adminApi.markPayoutPaid(payoutId);
      else if (action === "failed") await adminApi.markPayoutFailed(payoutId);
      else await adminApi.markPayoutDisputed(payoutId);
      fetchPayouts();
    } catch (e) {
      setPayoutsError(e instanceof Error ? e.message : "Eroare la actualizare");
    } finally {
      setPayoutActionId(null);
    }
  };

  const formatPayoutDue = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ro-RO");
    } catch {
      return iso;
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchUsers();
    fetchPayouts();
    fetchOrphans();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    setStatsLoading(true);
    jobsApi
      .getAdminStatistics()
      .then((data) => { setAdminStats(data); setStatsError(null); })
      .catch((e) => setStatsError(e instanceof Error ? e.message : "Eroare statistici"))
      .finally(() => setStatsLoading(false));
  }, [user?.role]);

  /* Actualizare statistici în timp real: la fiecare 30s și după acțiuni (block/unblock) */
  useEffect(() => {
    if (user?.role !== "admin") return;
    const interval = setInterval(fetchAdminStats, 30_000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const maxAvgDomain = Math.max(1, ...(adminStats?.salaryByDomain?.map((d) => d.avgHourly) ?? [0]));
  const maxAvgRegion = Math.max(1, ...(adminStats?.salaryByRegion?.map((r) => r.avgHourly) ?? [0]));

  const filteredUsers = roleFilter
    ? users.filter((u) => u.role === roleFilter)
    : users;

  const searchLower = searchQuery.trim().toLowerCase();
  const searchFilteredUsers = searchLower
    ? filteredUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      )
    : filteredUsers;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const currentLabel = ROLE_FILTER_OPTIONS.find((o) => o.value === roleFilter)?.labelKey ?? "dashboard.filterAllRoles";

  return (
    <>
      <div className="page-enter-stagger">
        <header className="mb-6 md:mb-8 w-full flex items-center justify-between gap-4 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f] truncate">{t("dashboard.hello", { name: user?.name ?? "" })}</h1>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md">{t("dashboard.adminSubtitle")}</p>
          </div>
          <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[#9d7bff] text-white shadow-[0_8px_20px_rgba(122,99,241,0.3)] items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </header>

        {statsError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{statsError}</div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6 md:mb-8">
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm min-w-0 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
              <div className="min-w-0 border-b sm:border-b-0 sm:border-r border-gray-100 pb-3 sm:pb-0 sm:pr-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.adminTotalUsers")} <span className="font-normal">{t("dashboard.adminTotalUsersMeta")}</span></h3>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{statsLoading ? "—" : (adminStats?.totalUsers ?? 0)}</p>
              </div>
              <div className="min-w-0 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-gray-100 pb-3 sm:pb-0 sm:pr-4">
                <span className="text-base sm:text-lg font-bold text-gray-900 tabular-nums">{(adminStats?.activeUsers ?? 0)}</span>
                <span className="text-[11px] sm:text-xs text-green-600 font-medium mt-0.5">{t("dashboard.adminActiveUsers", "activi")}</span>
                <span className="text-[10px] text-gray-400 mt-0.5 break-words">{t("dashboard.adminActiveUsersHint", "conectați în ultimele 15 min")}</span>
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <span className="text-base sm:text-lg font-bold text-gray-900 tabular-nums">{(adminStats?.inactiveUsers ?? 0)}</span>
                <span className="text-[11px] sm:text-xs text-amber-600 font-medium mt-0.5">{t("dashboard.adminInactiveUsers", "inactivi")}</span>
                <span className="text-[10px] text-gray-400 mt-0.5 break-words">{t("dashboard.adminInactiveUsersHint", "offline / pagină închisă sau delogare")}</span>
              </div>
            </div>
          </article>
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.adminTotalJobs")} <span className="font-normal">{t("dashboard.adminTotalJobsMeta")}</span></h3>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{statsLoading ? "—" : (adminStats?.totalJobs ?? 0)}</p>
          </article>
          <article className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm">
            <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t("dashboard.adminTotalApplications")} <span className="font-normal">{t("dashboard.adminTotalApplicationsMeta")}</span></h3>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{statsLoading ? "—" : (adminStats?.totalApplications ?? 0)}</p>
          </article>
        </section>

        {/* Salarii pe domenii și regiuni – pliabile cu animație */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8 items-start">
          {/* Salary by domain */}
          <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
            <button
              type="button"
              onClick={() => setSalaryDomainOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-gray-50/80 transition-colors"
              aria-expanded={salaryDomainOpen}
            >
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.adminSalaryByDomain", "Statistică salariilor pe domenii (MDL/oră)")}</h2>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform duration-200" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={salaryDomainOpen ? "rotate-180" : ""}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <div className={`admin-panel-expand ${salaryDomainOpen ? "open" : "closed"}`}>
              <div className="admin-panel-open px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
                {statsLoading && <p className="text-sm text-gray-500 pt-2">{t("dashboard.loading", "Se încarcă...")}</p>}
                {!statsLoading && (!adminStats?.salaryByDomain?.length) && <p className="text-sm text-gray-500 pt-2">{t("dashboard.noData", "Fără date")}</p>}
                {!statsLoading && adminStats?.salaryByDomain && adminStats.salaryByDomain.length > 0 && (
                  <div className="overflow-x-auto -mx-1 pt-2">
                    <table className="w-full text-sm min-w-[280px]">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                          <th className="py-2.5 pr-3 w-[40%]">{t("dashboard.adminDomain", "Domeniu")}</th>
                          <th className="py-2.5 pr-3">{t("dashboard.adminAvgPerHour", "Medie MDL/oră")}</th>
                          <th className="py-2.5 pr-3 whitespace-nowrap">{t("dashboard.adminMinMax", "Min – Max")}</th>
                          <th className="py-2.5 text-right">{t("dashboard.adminJobCount", "Nr. joburi")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminStats.salaryByDomain.map((d) => (
                          <tr key={d.categoryCode} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="py-2.5 pr-3 font-medium text-gray-900">{d.categoryTitle}</td>
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 sm:w-20 h-2 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(d.avgHourly / maxAvgDomain) * 100}%` }} />
                                </div>
                                <span className="text-gray-900 font-medium tabular-nums">{d.avgHourly.toFixed(0)}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 text-gray-600 text-xs sm:text-sm tabular-nums">{d.minHourly.toFixed(0)} – {d.maxHourly.toFixed(0)}</td>
                            <td className="py-2.5 text-right text-gray-700 tabular-nums">{d.jobCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Salary by region */}
          <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
            <button
              type="button"
              onClick={() => setSalaryRegionOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-gray-50/80 transition-colors"
              aria-expanded={salaryRegionOpen}
            >
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.adminSalaryByRegion", "Statistică salariilor pe regiuni (MDL/oră)")}</h2>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform duration-200" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={salaryRegionOpen ? "rotate-180" : ""}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <div className={`admin-panel-expand ${salaryRegionOpen ? "open" : "closed"}`}>
              <div className="admin-panel-open px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
                {statsLoading && <p className="text-sm text-gray-500 pt-2">{t("dashboard.loading", "Se încarcă...")}</p>}
                {!statsLoading && (!adminStats?.salaryByRegion?.length) && <p className="text-sm text-gray-500 pt-2">{t("dashboard.noData", "Fără date")}</p>}
                {!statsLoading && adminStats?.salaryByRegion && adminStats.salaryByRegion.length > 0 && (
                  <div className="overflow-x-auto -mx-1 pt-2">
                    <table className="w-full text-sm min-w-[240px]">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                          <th className="py-2.5 pr-3 w-[40%]">{t("dashboard.adminRegion", "Regiune / Oraș")}</th>
                          <th className="py-2.5 pr-3">{t("dashboard.adminAvgPerHour", "Medie MDL/oră")}</th>
                          <th className="py-2.5 text-right">{t("dashboard.adminJobCount", "Nr. joburi")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminStats.salaryByRegion.map((r) => (
                          <tr key={r.region} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="py-2.5 pr-3 font-medium text-gray-900">{r.region}</td>
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 sm:w-20 h-2 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(r.avgHourly / maxAvgRegion) * 100}%` }} />
                                </div>
                                <span className="text-gray-900 font-medium tabular-nums">{r.avgHourly.toFixed(0)}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right text-gray-700 tabular-nums">{r.jobCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Financial: Profit, taxes, total base */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6 md:mb-8">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">{t("dashboard.adminFinancial", "Statistică financiară")}</h2>
          {statsLoading && <p className="text-sm text-gray-500">{t("dashboard.loading", "Se încarcă...")}</p>}
          {!statsLoading && adminStats?.financial && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-500">{t("dashboard.adminTotalBase", "Baza totală (ore × tarif)")}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{adminStats.financial.totalBase.toFixed(2)} MDL</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-medium text-gray-500">{t("dashboard.adminTaxesCollected", "Taxe colectate (24%)")}</p>
                <p className="text-lg font-bold text-amber-800 mt-1">{adminStats.financial.taxesCollected.toFixed(2)} MDL</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                <p className="text-xs font-medium text-gray-500">{t("dashboard.adminProfit", "Profit platformă (10%)")}</p>
                <p className="text-lg font-bold text-green-800 mt-1">{adminStats.financial.profit.toFixed(2)} MDL</p>
              </div>
            </div>
          )}
        </section>

        {/* Company ranking - most active hirers (pliabil) */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 md:mb-8">
          <button
            type="button"
            onClick={() => setCompanyRankingOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-gray-50/80 transition-colors"
            aria-expanded={companyRankingOpen}
          >
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.adminCompanyRanking", "Clasament companii care angajează cel mai activ")}</h2>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform duration-200" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={companyRankingOpen ? "rotate-180" : ""}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          <div className={`admin-panel-expand ${companyRankingOpen ? "open" : "closed"}`}>
            <div className="admin-panel-open px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
              {statsLoading && <p className="text-sm text-gray-500 pt-2">{t("dashboard.loading", "Se încarcă...")}</p>}
              {!statsLoading && (!adminStats?.companyRanking?.length) && <p className="text-sm text-gray-500 pt-2">{t("dashboard.noData", "Fără date")}</p>}
              {!statsLoading && adminStats?.companyRanking && adminStats.companyRanking.length > 0 && (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                        <th className="py-2 pr-4 w-12">#</th>
                        <th className="py-2 pr-4">{t("dashboard.adminCompany", "Companie")}</th>
                        <th className="py-2">{t("dashboard.adminAcceptedCount", "Aplicații acceptate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminStats.companyRanking.map((c) => (
                        <tr key={c.userId || c.rank} className="border-b border-gray-100">
                          <td className="py-2.5 pr-4 font-medium text-gray-500">{c.rank}</td>
                          <td className="py-2.5 pr-4 font-medium text-gray-900">{c.companyName}</td>
                          <td className="py-2.5">{c.acceptedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Salary by domain AND region - pliabil */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 md:mb-8">
          <button
            type="button"
            onClick={() => setSalaryByDomainAndRegionOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-gray-50/80 transition-colors"
            aria-expanded={salaryByDomainAndRegionOpen}
          >
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.adminSalaryByDomainAndRegion", "Salarii pe domenii și regiuni (MDL/oră)")}</h2>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform duration-200" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={salaryByDomainAndRegionOpen ? "rotate-180" : ""}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          <div className={`admin-panel-expand ${salaryByDomainAndRegionOpen ? "open" : "closed"}`}>
            <div className="admin-panel-open px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
              {statsLoading && <p className="text-sm text-gray-500 pt-2">{t("dashboard.loading", "Se încarcă...")}</p>}
              {!statsLoading && (!adminStats?.salaryByDomainAndRegion?.length) && <p className="text-sm text-gray-500 pt-2">{t("dashboard.noData", "Fără date")}</p>}
              {!statsLoading && adminStats?.salaryByDomainAndRegion && adminStats.salaryByDomainAndRegion.length > 0 && (
                <div className="overflow-x-auto max-h-80 overflow-y-auto pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 font-medium sticky top-0 bg-white">
                        <th className="py-2 pr-4">{t("dashboard.adminRegion", "Regiune / Oraș")}</th>
                        <th className="py-2 pr-4">{t("dashboard.adminDomain", "Domeniu")}</th>
                        <th className="py-2 pr-4">{t("dashboard.adminAvgPerHour", "Medie MDL/oră")}</th>
                        <th className="py-2">{t("dashboard.adminJobCount", "Nr. joburi")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminStats.salaryByDomainAndRegion.map((row, i) => (
                        <tr key={`${row.region}-${row.categoryCode}-${i}`} className="border-b border-gray-100">
                          <td className="py-2 pr-4 text-gray-900">{row.region}</td>
                          <td className="py-2 pr-4 text-gray-700">{row.categoryTitle}</td>
                          <td className="py-2 pr-4 font-medium">{row.avgHourly.toFixed(0)}</td>
                          <td className="py-2">{row.jobCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 md:mb-8">
          <button
            type="button"
            onClick={() => setAccountsSectionOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-gray-50/80 transition-colors"
            aria-expanded={accountsSectionOpen}
          >
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.accountsCreated", "Conturi create")}</h2>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform duration-200" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accountsSectionOpen ? "rotate-180" : ""}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          <div className={`admin-panel-expand ${accountsSectionOpen ? "open" : "closed"}`}>
          <div className="admin-panel-open px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
          <div className="flex flex-col gap-3 mb-4 pt-4">
            <div className="rounded-2xl border border-[rgba(224,216,247,0.9)] bg-[rgba(250,248,255,0.8)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">{t("dashboard.createSupportTechnician", "Creează support technician")}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t("dashboard.supportTechnicianSubtitle", "Doar admin poate crea contul.")}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {t("dashboard.adminOnly", "Admin")}
                </span>
              </div>

              {supportCreateError ? (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {supportCreateError}
                </div>
              ) : null}
              {supportCreateSuccess ? (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  {supportCreateSuccess}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm text-gray-700">
                  {t("dashboard.name", "Nume")}
                  <input
                    value={supportCreateForm.name}
                    onChange={(e) => {
                      setSupportCreateForm((p) => ({ ...p, name: e.target.value }));
                      setSupportCreateError(null);
                      setSupportCreateSuccess(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-[rgba(224,216,247,0.9)] bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t("dashboard.fullNamePlaceholder", "Nume complet")}
                  />
                </label>
                <label className="text-sm text-gray-700">
                  {t("auth.password")}
                  <input
                    value={supportCreateForm.password}
                    type="password"
                    onChange={(e) => {
                      setSupportCreateForm((p) => ({ ...p, password: e.target.value }));
                      setSupportCreateError(null);
                      setSupportCreateSuccess(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-[rgba(224,216,247,0.9)] bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t("dashboard.passwordPlaceholder", "min. 6 caractere")}
                  />
                </label>
                <label className="text-sm text-gray-700">
                  {t("dashboard.avatarOptional")}
                  <input
                    value={supportCreateForm.avatar}
                    onChange={(e) => {
                      setSupportCreateForm((p) => ({ ...p, avatar: e.target.value }));
                      setSupportCreateError(null);
                      setSupportCreateSuccess(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-[rgba(224,216,247,0.9)] bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={t("dashboard.avatarPlaceholder", "URL sau id")}
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => void handleCreateSupportTechnician()}
                  disabled={supportCreateLoading}
                >
                  {supportCreateLoading
                    ? t("dashboard.creating", "Se creează...")
                    : t("dashboard.create", "Creează")}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 font-medium">{t("dashboard.filterByRole", "Filtrează după rol")}:</span>
                <div className="relative inline-block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex h-10 min-w-[152px] items-center justify-between gap-2 rounded-xl border border-[rgba(224,216,247,0.9)] bg-white px-4 py-2 text-left text-sm font-medium text-gray-800 shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-[rgba(177,163,241,0.6)] hover:bg-[rgba(250,248,255,0.8)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="listbox"
                  aria-label={t("dashboard.filterByRole", "Filtrează după rol")}
                >
                  <span>{t(currentLabel)}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-gray-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {dropdownOpen && (
                  <ul
                    role="listbox"
                    className="dropdown-open-anim absolute right-0 top-full z-20 mt-1.5 w-full min-w-[152px] overflow-hidden rounded-xl border border-[rgba(224,216,247,0.9)] bg-white py-1.5 shadow-[0_10px_40px_rgba(122,99,241,0.12)]"
                  >
                    {ROLE_FILTER_OPTIONS.map((opt) => {
                      const isSelected = roleFilter === opt.value;
                      return (
                        <li key={opt.value || "all"} role="option" aria-selected={isSelected}>
                          <button
                            type="button"
                            onClick={() => {
                              setRoleFilter(opt.value);
                              setDropdownOpen(false);
                            }}
                            className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors duration-150 ${
                              isSelected
                                ? "bg-primary/10 font-semibold text-primary"
                                : "text-gray-700 hover:bg-[rgba(250,248,255,0.9)] hover:text-gray-900"
                            }`}
                          >
                            {t(opt.labelKey)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                </div>
              </div>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("dashboard.searchAccountsPlaceholder", "Caută după nume sau email...")}
                className="h-10 w-full rounded-xl border border-[rgba(224,216,247,0.9)] bg-white pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 transition-[border-color] duration-200 hover:border-[rgba(177,163,241,0.5)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={t("dashboard.searchAccounts", "Caută conturi")}
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={t("dashboard.clearSearch", "Șterge căutarea")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {usersLoading && <p className="text-sm text-gray-500">{t("dashboard.loading", "Se încarcă...")}</p>}
          {usersError && <p className="text-sm text-red-600">{usersError}</p>}
          {statusError && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center justify-between gap-2">
              <span>{statusError}</span>
              <button type="button" onClick={() => setStatusError(null)} className="text-red-600 hover:underline shrink-0">
                {t("dashboard.close", "Închide")}
              </button>
            </div>
          )}
          {confirmStatus && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {confirmStatus.active
                    ? t("dashboard.confirmUnblockTitle", "Deblochezi contul?")
                    : t("dashboard.confirmBlockTitle", "Blochezi contul?")}
                </h3>
                <p className="text-gray-600 text-sm mb-6">
                  {confirmStatus.active
                    ? t("dashboard.confirmUnblockMessage", "Utilizatorul {{name}} va putea accesa din nou platforma.", { name: confirmStatus.name })
                    : t("dashboard.confirmBlockMessage", "Utilizatorul {{name}} nu va mai putea accesa platforma (cont blocat pentru încălcarea regulilor).", { name: confirmStatus.name })}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => { setConfirmStatus(null); setStatusError(null); }}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                  >
                    {t("dashboard.cancel", "Anulează")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusError(null);
                      setStatusUpdatingId(confirmStatus.id);
                      authApi.setUserStatus(confirmStatus.id, confirmStatus.active)
                        .then(() => { fetchUsers(); fetchAdminStats(); setConfirmStatus(null); })
                        .catch((e) => setStatusError(e instanceof Error ? e.message : "Eroare la actualizare"))
                        .finally(() => setStatusUpdatingId(null));
                    }}
                    disabled={statusUpdatingId === confirmStatus.id}
                    className={`px-4 py-2 rounded-xl font-medium text-white ${confirmStatus.active ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} disabled:opacity-50`}
                  >
                    {statusUpdatingId === confirmStatus.id ? t("dashboard.updating", "Se actualizează...") : confirmStatus.active ? t("dashboard.unblock", "Deblochează") : t("dashboard.block", "Blochează")}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!usersLoading && !usersError && users.length === 0 && (
            <p className="text-sm text-gray-500">{t("dashboard.noAccountsYet", "Niciun cont încă.")}</p>
          )}
          {!usersLoading && !usersError && users.length > 0 && filteredUsers.length === 0 && (
            <p className="text-sm text-gray-500">{t("dashboard.noUsersForRole", "Niciun utilizator pentru rolul ales.")}</p>
          )}
          {!usersLoading && !usersError && filteredUsers.length > 0 && searchFilteredUsers.length === 0 && (
            <p className="text-sm text-gray-500">{t("dashboard.noSearchResults", "Niciun rezultat pentru căutare.")}</p>
          )}
          {!usersLoading && users.length > 0 && searchFilteredUsers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                    <th className="py-2 pr-4">{t("dashboard.name", "Nume")}</th>
                    <th className="py-2 pr-4">{t("dashboard.email", "Email")}</th>
                    <th className="py-2 pr-4">{t("dashboard.phone", "Telefon")}</th>
                    <th className="py-2 pr-4">{t("dashboard.role", "Rol")}</th>
                    <th className="py-2">{t("dashboard.actions", "Acțiuni")}</th>
                  </tr>
                </thead>
                <tbody>
                  {searchFilteredUsers.map((u, index) => {
                    const isCurrentUser = String(user?.id) === String(u.id);
                    const isBlocked = u.isActive === false;
                    const updating = statusUpdatingId === String(u.id);
                    return (
                      <tr
                        key={u.id}
                        className="admin-table-row-enter border-b border-gray-100"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{u.name}</td>
                        <td className="py-2.5 pr-4 text-gray-600">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email, String(u.id), "email")}
                            className="inline-flex items-center gap-1.5 text-left hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-0.5 -mx-0.5"
                            title={t("dashboard.copy", "Copiază")}
                          >
                            {u.email}
                            <span className="inline-flex shrink-0 min-w-[3.25rem] justify-end">
                              {copiedCell?.id === String(u.id) && copiedCell?.field === "email" ? (
                                <span className="text-xs text-green-600 font-medium">{t("dashboard.copied", "Copiat!")}</span>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">
                          {(u.phone ?? "—") !== "—" ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.phone!, String(u.id), "phone")}
                              className="inline-flex items-center gap-1.5 text-left hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-0.5 -mx-0.5"
                              title={t("dashboard.copy", "Copiază")}
                            >
                              {u.phone}
                              <span className="inline-flex shrink-0 min-w-[3.25rem] justify-end">
                                {copiedCell?.id === String(u.id) && copiedCell?.field === "phone" ? (
                                  <span className="text-xs text-green-600 font-medium">{t("dashboard.copied", "Copiat!")}</span>
                                ) : (
                                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                )}
                              </span>
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                            u.role === "admin" ? "bg-purple-100 text-purple-800" :
                            u.role === "customer" ? "bg-blue-100 text-blue-800" :
                            u.role === "staff" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                          }`}>
                            {u.role === "admin" ? t("dashboard.roleAdmin", "Admin") :
                              u.role === "customer" ? t("dashboard.roleCustomer", "Client") :
                              u.role === "staff" ? t("dashboard.roleStaff", "Staff") : u.role}
                          </span>
                          {isBlocked && (
                            <span className="ml-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-red-100 text-red-800">
                              {t("dashboard.blocked", "Blocat")}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {u.role === "customer" && (
                              (() => {
                                const hasBooster = u.boosterUntil && new Date(u.boosterUntil) > new Date();
                                const busy = boosterUpdatingId === String(u.id);
                                return hasBooster ? (
                                  <>
                                    <span className="text-xs font-medium text-amber-700" title={u.boosterUntil ? new Date(u.boosterUntil).toLocaleDateString() : ""}>
                                      {t("dashboard.boosterActive", "Booster activ")}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => {
                                        setBoosterUpdatingId(String(u.id));
                                        authApi.setUserBooster(String(u.id), null)
                                          .then(() => { fetchUsers(); fetchAdminStats(); })
                                          .catch(() => {})
                                          .finally(() => setBoosterUpdatingId(null));
                                      }}
                                      className="text-xs font-medium text-gray-600 hover:text-gray-800 hover:underline disabled:opacity-50"
                                    >
                                      {busy ? t("dashboard.updating", "Se actualizează...") : t("dashboard.boosterCancel", "Anulează")}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      const until = new Date();
                                      until.setDate(until.getDate() + 30);
                                      setBoosterUpdatingId(String(u.id));
                                      authApi.setUserBooster(String(u.id), until.toISOString())
                                        .then(() => { fetchUsers(); fetchAdminStats(); })
                                        .catch(() => {})
                                        .finally(() => setBoosterUpdatingId(null));
                                    }}
                                    className="text-xs font-medium text-primary hover:text-primary/80 hover:underline disabled:opacity-50"
                                  >
                                    {busy ? t("dashboard.updating", "Se actualizează...") : t("dashboard.boosterGrant30", "Booster 30 zile")}
                                  </button>
                                );
                              })()
                            )}
                            {!isCurrentUser && (
                              isBlocked ? (
                                <button
                                  type="button"
                                  disabled={updating}
                                  onClick={() => setConfirmStatus({ id: String(u.id), name: u.name, active: true })}
                                  className="text-xs font-medium text-green-700 hover:text-green-800 hover:underline disabled:opacity-50"
                                >
                                  {updating ? t("dashboard.updating", "Se actualizează...") : t("dashboard.unblock", "Deblochează")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={updating}
                                  onClick={() => setConfirmStatus({ id: String(u.id), name: u.name, active: false })}
                                  className="text-xs font-medium text-red-700 hover:text-red-800 hover:underline disabled:opacity-50"
                                >
                                  {updating ? t("dashboard.updating", "Se actualizează...") : t("dashboard.block", "Blochează")}
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-2">
            {t("dashboard.adminPaymentDiagnostics", "Diagnostic plăți")}
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              disabled={maintenanceBusy}
              onClick={() => {
                setMaintenanceBusy(true);
                adminApi
                  .expireStaleReservations()
                  .then(() => {
                    fetchOrphans();
                    fetchPayouts();
                  })
                  .catch((e) => setPayoutsError(e instanceof Error ? e.message : "Eroare"))
                  .finally(() => setMaintenanceBusy(false));
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 disabled:opacity-50"
            >
              {t("dashboard.expireStaleReservations", "Expire rezervări expirate")}
            </button>
            <button
              type="button"
              disabled={orphansLoading}
              onClick={fetchOrphans}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {t("dashboard.refresh", "Reîmprospătează")}
            </button>
          </div>
          {orphansLoading ? (
            <p className="text-xs text-gray-600">{t("dashboard.loading", "Se încarcă...")}</p>
          ) : orphans.length === 0 ? (
            <p className="text-xs text-gray-600">{t("dashboard.adminNoOrphans", "Nicio rezervare problematică detectată.")}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {orphans.map((o) => (
                <li key={o.reservationId} className="rounded-lg border border-amber-200 bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Job #{o.jobId} · {o.reservationStatus} · {o.issue}
                    {o.paynetOrderId ? ` · ${o.paynetOrderId}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={maintenanceBusy}
                    onClick={() => {
                      setMaintenanceBusy(true);
                      adminApi
                        .reconcileJobReservation(o.jobId)
                        .then(() => {
                          fetchOrphans();
                          fetchPayouts();
                        })
                        .catch((e) => setPayoutsError(e instanceof Error ? e.message : "Eroare"))
                        .finally(() => setMaintenanceBusy(false));
                    }}
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {t("dashboard.reconcile", "Reconciliază")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6 md:mb-8 bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
          <button
            type="button"
            onClick={() => setPayoutsSectionOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 p-4 sm:p-6 text-left hover:bg-gray-50/80 transition-colors"
            aria-expanded={payoutsSectionOpen}
          >
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">
              {t("dashboard.adminPayoutQueue", "Coadă plăți (payout pending)")}
            </h2>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={payoutsSectionOpen ? "rotate-180" : ""}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          {payoutsSectionOpen && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
              {payoutsError && (
                <p className="mt-3 text-sm text-red-600">{payoutsError}</p>
              )}
              {payoutsLoading ? (
                <p className="mt-3 text-sm text-gray-500">{t("dashboard.loading", "Se încarcă...")}</p>
              ) : payouts.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">{t("dashboard.adminNoPayouts", "Nicio plată în așteptare.")}</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                        <th className="py-2 pr-3">{t("dashboard.job")}</th>
                        <th className="py-2 pr-3">{t("dashboard.roleStaff")}</th>
                        <th className="py-2 pr-3">{t("dashboard.roleCustomer")}</th>
                        <th className="py-2 pr-3">{t("dashboard.amount", "Sumă")}</th>
                        <th className="py-2 pr-3">{t("dashboard.payoutDueAt", "Scadență")}</th>
                        <th className="py-2 pr-3">{t("dashboard.status")}</th>
                        <th className="py-2 text-right">{t("dashboard.actions", "Acțiuni")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => {
                        const busy = payoutActionId === p.id;
                        return (
                          <tr key={p.id} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 pr-3 font-medium text-gray-900">{p.jobTitle}</td>
                            <td className="py-3 pr-3 text-gray-700">{p.staffName}</td>
                            <td className="py-3 pr-3 text-gray-700">{p.customerName}</td>
                            <td className="py-3 pr-3 text-gray-700 tabular-nums">
                              {p.amount} {p.currency}
                            </td>
                            <td className="py-3 pr-3 text-gray-600 text-xs">{formatPayoutDue(p.payoutDueAt)}</td>
                            <td className="py-3 pr-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${payoutStatusClassName(p.status)}`}>
                                {payoutStatusLabel(p.status, t)}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void runPayoutAction(p.id, "paid")}
                                  className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50"
                                >
                                  {busy ? "..." : t("dashboard.markPaid", "Marchează plătit")}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void runPayoutAction(p.id, "failed")}
                                  className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                                >
                                  {t("dashboard.markFailed", "Eșuat")}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void runPayoutAction(p.id, "disputed")}
                                  className="text-xs font-medium text-purple-700 hover:underline disabled:opacity-50"
                                >
                                  {t("dashboard.markDisputed", "Disputat")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                type="button"
                onClick={fetchPayouts}
                disabled={payoutsLoading}
                className="mt-4 text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {t("dashboard.refresh", "Reîmprospătează")}
              </button>
            </div>
          )}
        </section>

      </div>
    </>
  );
}
