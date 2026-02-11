import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/client";

const STATS_KEYS = [
  { labelKey: "adminTotalUsers", metaKey: "adminTotalUsersMeta", value: "1.2k" },
  { labelKey: "adminTotalJobs", metaKey: "adminTotalJobsMeta", value: "340" },
  { labelKey: "adminTotalApplications", metaKey: "adminTotalApplicationsMeta", value: "2.1k" },
];

type UserRow = { id: number; name: string; email: string; role: string };

export default function DashboardHomeAdmin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    authApi
      .users()
      .then((data) => { setUsers(data.users); setUsersError(null); })
      .catch((e) => setUsersError(e instanceof Error ? e.message : "Eroare la încărcare"))
      .finally(() => setUsersLoading(false));
  }, [user?.role]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
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
            <p className="text-sm sm:text-base text-gray-600 mt-0.5">{t("dashboard.adminSubtitle")}</p>
          </div>
          <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6 md:mb-8">
          {STATS_KEYS.map((s) => (
            <article
              key={s.labelKey}
              className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm"
            >
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 truncate">{t(`dashboard.${s.labelKey}`)}</h3>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{s.value}</p>
              <span className="text-xs sm:text-sm text-gray-500 truncate block">{t(`dashboard.${s.metaKey}`)}</span>
            </article>
          ))}
        </section>

        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6 md:mb-8">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">{t("dashboard.accountsCreated", "Conturi create")}</h2>
          {usersLoading && <p className="text-sm text-gray-500">{t("dashboard.loading", "Se încarcă...")}</p>}
          {usersError && <p className="text-sm text-red-600">{usersError}</p>}
          {!usersLoading && !usersError && users.length === 0 && (
            <p className="text-sm text-gray-500">{t("dashboard.noAccountsYet", "Niciun cont încă.")}</p>
          )}
          {!usersLoading && !usersError && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                    <th className="py-2 pr-4">{t("dashboard.name", "Nume")}</th>
                    <th className="py-2 pr-4">{t("dashboard.email", "Email")}</th>
                    <th className="py-2">{t("dashboard.role", "Rol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{u.name}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{u.email}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          u.role === "admin" ? "bg-purple-100 text-purple-800" :
                          u.role === "customer" ? "bg-blue-100 text-blue-800" :
                          u.role === "staff" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {u.role === "admin" ? t("dashboard.roleAdmin", "Admin") :
                            u.role === "customer" ? t("dashboard.roleCustomer", "Client") :
                            u.role === "staff" ? t("dashboard.roleStaff", "Staff") : u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </>
  );
}
