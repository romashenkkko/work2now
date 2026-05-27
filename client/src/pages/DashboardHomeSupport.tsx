import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/client";
import { useTranslation } from "react-i18next";
import DatePicker from "../components/DatePicker";

type StaffRow = {
  id: string;
  email: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  aboutMe?: string;
  avatar?: string | null;
};

type CustomerRow = {
  id: string;
  email: string;
  isActive: boolean;
  companyName?: string;
  contactFirstName?: string;
  contactLastName?: string;
  companyCategory?: number;
  infoForStaff?: string;
  branch?: { name: string; address: string; city: string; country: string; phoneNumber: string };
  avatar?: string | null;
};

type ActivityLogRow = {
  id: number;
  createdAt: string;
  actorEmail?: string | null;
  actionType: string;
  targetType?: string | null;
  targetJobId?: number | null;
  targetApplicationId?: number | null;
  staffName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  workDate?: string | null;
  workSessionCheckedInAt?: string | null;
  workSessionCheckedOutAt?: string | null;
  summary?: string | null;
};

type SupportMetrics = {
  kpi: {
    openCount: number;
    acceptedCount: number;
    closedCount: number;
    waitingUserCount: number;
    waitingSupportCount: number;
    slaBreachedCount: number;
    firstResponseAvgMinutes: number;
    resolutionAvgMinutes: number;
    reopenRate: number;
    csatAvg: number;
    csatResponses: number;
    escalatedCount: number;
    reassignedCount: number;
    highPriorityOpenCount: number;
  };
  topAgents: Array<{ supportEmail: string; closedCount: number }>;
  slaMinutes: number;
};

function parseFilterDate(value: string, endOfDay = false): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  // Accept both yyyy-mm-dd and dd/mm/yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const iso = `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00"}`;
    const ts = new Date(iso).getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    const iso = `${yyyy}-${mm}-${dd}T${endOfDay ? "23:59:59.999" : "00:00:00"}`;
    const ts = new Date(iso).getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  return null;
}

function parseToDate(value: string): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function formatDateDdMmYyyy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-gray-900">{title}</h2>;
}

export default function DashboardHomeSupport() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role?.toLowerCase();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staffPanelOpen, setStaffPanelOpen] = useState(false);
  const [staffMode, setStaffMode] = useState<"create" | "edit">("create");
  const [staffForm, setStaffForm] = useState({
    id: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    aboutMe: "",
    avatar: "",
  });

  const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
  const [logsPanelOpen, setLogsPanelOpen] = useState(true);
  const [logsActorFilter, setLogsActorFilter] = useState("all");
  const [logsActionFilter, setLogsActionFilter] = useState("all");
  const [logsDateFrom, setLogsDateFrom] = useState("");
  const [logsDateTo, setLogsDateTo] = useState("");
  const [logsActorOpen, setLogsActorOpen] = useState(false);
  const [logsActionOpen, setLogsActionOpen] = useState(false);
  const [logsDatePickerOpen, setLogsDatePickerOpen] = useState<"from" | "to" | null>(null);
  const [logsCalendarMonth, setLogsCalendarMonth] = useState<Date>(() => new Date());
  const [logsDatePickerPos, setLogsDatePickerPos] = useState<{ top: number; left: number } | null>(null);
  const logsActorRef = useRef<HTMLDivElement | null>(null);
  const logsActionRef = useRef<HTMLDivElement | null>(null);
  const logsDateFromRef = useRef<HTMLDivElement | null>(null);
  const logsDateToRef = useRef<HTMLDivElement | null>(null);
  const [customerMode, setCustomerMode] = useState<"create" | "edit">("create");
  const [customerForm, setCustomerForm] = useState({
    id: "",
    email: "",
    password: "",
    companyName: "",
    contactFirstName: "",
    contactLastName: "",
    companyCategory: 1,
    infoForStaff: "",
    contactDateOfBirth: "",
    branchName: "",
    branchAddress: "",
    branchCity: "",
    branchCountry: "Moldova",
    branchPhoneNumber: "",
  });

  const loadAll = async () => {
    if (role !== "support" && role !== "admin") return;
    setLoading(true);
    setError(null);
    try {
      const [staffData, customerData, logsData, metricsData] = await Promise.all([
        authApi.supportListUsers("staff"),
        authApi.supportListUsers("customer"),
        authApi.supportGetLogs(200, 0),
        authApi.supportChatMetrics(),
      ]);
      setStaff((staffData as any).users ?? []);
      setCustomers((customerData as any).users ?? []);
      setLogs((logsData as any).logs ?? []);
      setMetrics((metricsData as SupportMetrics) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const refreshLogs = async () => {
    try {
      const logsData = await authApi.supportGetLogs(200, 0);
      setLogs((logsData as any).logs ?? []);
    } catch {
      // ignore
    }
  };

  const openStaffCreate = () => {
    setStaffMode("create");
    setStaffForm({
      id: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      aboutMe: "",
      avatar: "",
    });
    setStaffPanelOpen(true);
  };

  const openStaffEdit = (row: StaffRow) => {
    setStaffMode("edit");
    setStaffForm({
      id: row.id,
      email: row.email,
      password: "",
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      dateOfBirth: row.dateOfBirth ?? "",
      aboutMe: row.aboutMe ?? "",
      avatar: row.avatar ?? "",
    });
    setStaffPanelOpen(true);
  };

  const submitStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      if (staffMode === "create") {
        await authApi.supportCreateUser({
          role: "staff",
          email: staffForm.email,
          password: staffForm.password,
          avatar: staffForm.avatar || null,
          firstName: staffForm.firstName,
          lastName: staffForm.lastName,
          dateOfBirth: staffForm.dateOfBirth,
          aboutMe: staffForm.aboutMe,
        });
      } else {
        await authApi.supportUpdateUser(staffForm.id, {
          role: "staff",
          email: staffForm.email,
          password: staffForm.password,
          avatar: staffForm.avatar || null,
          firstName: staffForm.firstName,
          lastName: staffForm.lastName,
          dateOfBirth: staffForm.dateOfBirth,
          aboutMe: staffForm.aboutMe,
        });
      }
      setStaffPanelOpen(false);
      await loadAll();
      await refreshLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la staff");
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async (id: string, name: string) => {
    if (!window.confirm(`Dezactivezi contul ${name}?`)) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportDeactivateUser(id);
      await loadAll();
      await refreshLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la dezactivare");
    } finally {
      setLoading(false);
    }
  };

  const openCustomerCreate = () => {
    setCustomerMode("create");
    setCustomerForm({
      id: "",
      email: "",
      password: "",
      companyName: "",
      contactFirstName: "",
      contactLastName: "",
      companyCategory: 1,
      infoForStaff: "",
      contactDateOfBirth: "",
      branchName: "",
      branchAddress: "",
      branchCity: "",
      branchCountry: "Moldova",
      branchPhoneNumber: "",
    });
    setCustomerPanelOpen(true);
  };

  const openCustomerEdit = (row: CustomerRow) => {
    setCustomerMode("edit");
    setCustomerForm({
      id: row.id,
      email: row.email,
      password: "",
      companyName: row.companyName ?? "",
      contactFirstName: row.contactFirstName ?? "",
      contactLastName: row.contactLastName ?? "",
      companyCategory: row.companyCategory ?? 1,
      infoForStaff: row.infoForStaff ?? "",
      contactDateOfBirth: "", // not persisted; user should re-enter for validation
      branchName: row.branch?.name ?? "",
      branchAddress: row.branch?.address ?? "",
      branchCity: row.branch?.city ?? "",
      branchCountry: row.branch?.country ?? "Moldova",
      branchPhoneNumber: row.branch?.phoneNumber ?? "",
    });
    setCustomerPanelOpen(true);
  };

  const submitCustomer = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        role: "customer",
        email: customerForm.email,
        password: customerForm.password,
        avatar: "",
        companyName: customerForm.companyName,
        contactFirstName: customerForm.contactFirstName,
        contactLastName: customerForm.contactLastName,
        companyCategory: Number(customerForm.companyCategory),
        infoForStaff: customerForm.infoForStaff,
        contactDateOfBirth: customerForm.contactDateOfBirth,
        branch: {
          name: customerForm.branchName,
          address: customerForm.branchAddress,
          city: customerForm.branchCity,
          country: customerForm.branchCountry,
          phoneNumber: customerForm.branchPhoneNumber,
        },
      };

      if (customerMode === "create") {
        await authApi.supportCreateUser(payload);
      } else {
        await authApi.supportUpdateUser(customerForm.id, payload);
      }
      setCustomerPanelOpen(false);
      await loadAll();
      await refreshLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la business");
    } finally {
      setLoading(false);
    }
  };

  const staffRows = useMemo(() => staff ?? [], [staff]);
  const customerRows = useMemo(() => customers ?? [], [customers]);
  const logsActorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const actor = String(l.actorEmail ?? "").trim();
      if (actor) set.add(actor);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);
  const logsActionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const action = String(l.actionType ?? "").trim();
      if (action) set.add(action);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);
  const filteredLogs = useMemo(() => {
    const fromTs = parseFilterDate(logsDateFrom, false);
    const toTs = parseFilterDate(logsDateTo, true);
    return logs.filter((l) => {
      if (logsActorFilter !== "all" && String(l.actorEmail ?? "") !== logsActorFilter) return false;
      if (logsActionFilter !== "all" && String(l.actionType ?? "") !== logsActionFilter) return false;
      const ts = l.createdAt ? new Date(l.createdAt).getTime() : NaN;
      if (fromTs != null && Number.isFinite(ts) && ts < fromTs) return false;
      if (toTs != null && Number.isFinite(ts) && ts > toTs) return false;
      return true;
    });
  }, [logs, logsActorFilter, logsActionFilter, logsDateFrom, logsDateTo]);
  const exportLogsCsv = () => {
    const rows = filteredLogs.map((l) => ({
      timp: l.createdAt ? new Date(l.createdAt).toLocaleString("ro-MD") : "—",
      actor: l.actorEmail ?? "—",
      actiune: l.actionType ?? "—",
      tinta: `${l.staffName ? `Staff: ${l.staffName}` : ""}${l.jobTitle ? ` ${l.jobTitle}` : ""}${l.targetJobId != null ? ` (job #${l.targetJobId})` : ""}${l.targetApplicationId != null ? ` (app #${l.targetApplicationId})` : ""}`.trim() || "—",
      rezumat: l.summary ?? "—",
    }));
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
    const header = ["Timp", "Actor", "Actiune", "Tinta", "Rezumat"];
    const csv = [header.map(escape).join(","), ...rows.map((r) => [r.timp, r.actor, r.actiune, r.tinta, r.rezumat].map(escape).join(","))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `support_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const calendarMonthStart = useMemo(
    () => new Date(logsCalendarMonth.getFullYear(), logsCalendarMonth.getMonth(), 1),
    [logsCalendarMonth]
  );
  const calendarCells = useMemo(() => {
    const start = new Date(calendarMonthStart);
    const firstWeekdayMondayBased = (start.getDay() + 6) % 7; // Mon=0
    start.setDate(start.getDate() - firstWeekdayMondayBased);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [calendarMonthStart]);
  const fromDateObj = useMemo(() => parseToDate(logsDateFrom), [logsDateFrom]);
  const toDateObj = useMemo(() => parseToDate(logsDateTo), [logsDateTo]);
  const openDatePicker = (kind: "from" | "to", currentValue: string, anchor: HTMLElement | null) => {
    const seed = parseToDate(currentValue) ?? new Date();
    setLogsCalendarMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
    if (anchor && typeof window !== "undefined") {
      const rect = anchor.getBoundingClientRect();
      const popupWidth = 280;
      const top = rect.bottom + 2;
      const left = Math.min(Math.max(0, rect.left), Math.max(0, window.innerWidth - popupWidth));
      setLogsDatePickerPos({ top, left });
    } else {
      setLogsDatePickerPos(null);
    }
    setLogsDatePickerOpen((v) => (v === kind ? null : kind));
  };

  useEffect(() => {
    if (!logsActorOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!logsActorRef.current) return;
      if (!logsActorRef.current.contains(ev.target as Node)) setLogsActorOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [logsActorOpen]);

  useEffect(() => {
    if (!logsActionOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!logsActionRef.current) return;
      if (!logsActionRef.current.contains(ev.target as Node)) setLogsActionOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [logsActionOpen]);

  useEffect(() => {
    if (!logsDatePickerOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const fromHas = logsDateFromRef.current?.contains(target);
      const toHas = logsDateToRef.current?.contains(target);
      if (!fromHas && !toHas) setLogsDatePickerOpen(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [logsDatePickerOpen]);

  if (!user || (role !== "support" && role !== "admin")) {
    return (
      <div className="p-6 text-gray-700">
        Nu aveți acces la pagina de support.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support Technician</h1>
          <p className="text-sm text-gray-600">Gestionați angajați, business-uri și vedeți activitatea.</p>
        </div>
        <button
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md transition"
          onClick={() => void loadAll()}
          disabled={loading}
        >
          {loading ? "Se încarcă..." : "Actualizează"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title={t("dashboard.supportKpiTitle")} />
            <span className="text-xs text-gray-500">
              {t("dashboard.supportKpiSla", { minutes: metrics?.slaMinutes ?? 15 })}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            {[
              [t("dashboard.supportKpiOpen"), metrics?.kpi.openCount ?? 0],
              [t("dashboard.supportKpiAccepted"), metrics?.kpi.acceptedCount ?? 0],
              [t("dashboard.supportKpiClosed"), metrics?.kpi.closedCount ?? 0],
              [t("dashboard.supportKpiWaitingUser"), metrics?.kpi.waitingUserCount ?? 0],
              [t("dashboard.supportKpiWaitingSupport"), metrics?.kpi.waitingSupportCount ?? 0],
              [t("dashboard.supportKpiSlaBreached"), metrics?.kpi.slaBreachedCount ?? 0],
              [t("dashboard.supportKpiFirstResponse"), metrics?.kpi.firstResponseAvgMinutes ?? 0],
              [t("dashboard.supportKpiResolution"), metrics?.kpi.resolutionAvgMinutes ?? 0],
              [t("dashboard.supportKpiReopenRate"), metrics?.kpi.reopenRate ?? 0],
              [t("dashboard.supportKpiCsatAvg"), metrics?.kpi.csatAvg ?? 0],
              [t("dashboard.supportKpiCsatResponses"), metrics?.kpi.csatResponses ?? 0],
              [t("dashboard.supportKpiEscalated"), metrics?.kpi.escalatedCount ?? 0],
              [t("dashboard.supportKpiReassigned"), metrics?.kpi.reassignedCount ?? 0],
              [t("dashboard.supportKpiHighPriority"), metrics?.kpi.highPriorityOpenCount ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-gray-100 bg-gray-50/60 p-2.5">
                <div className="text-[11px] text-gray-500">{label}</div>
                <div className="text-lg font-semibold text-gray-900">{value as number}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">{t("dashboard.supportTopAgentsTitle")}</div>
            {metrics?.topAgents?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {metrics.topAgents.map((a) => (
                  <div key={a.supportEmail} className="rounded-lg border border-gray-100 px-3 py-2 text-sm flex items-center justify-between">
                    <span className="text-gray-700 truncate">{a.supportEmail}</span>
                    <span className="font-semibold text-gray-900">{a.closedCount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">{t("dashboard.supportTopAgentsNoData")}</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Angajați (staff)" />
            <button
              className="rounded-xl border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 transition"
              onClick={openStaffCreate}
              disabled={loading}
            >
              + Adaugă
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {staffRows.length === 0 ? <div className="text-sm text-gray-500">Nu există angajați.</div> : null}
            {staffRows.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{s.email}</div>
                  <div className="text-xs text-gray-500">
                    Status: {s.isActive ? "Activ" : "Dezactivat"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 transition"
                    onClick={() => openStaffEdit(s)}
                    disabled={loading}
                  >
                    Editează
                  </button>
                  <button
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 transition"
                    onClick={() => void deactivateUser(s.id, s.email)}
                    disabled={loading}
                    title="Dezactivează cont"
                  >
                    Dezactivează
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Business-uri (customer)" />
            <button
              className="rounded-xl border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 transition"
              onClick={openCustomerCreate}
              disabled={loading}
            >
              + Adaugă
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {customerRows.length === 0 ? <div className="text-sm text-gray-500">Nu există business-uri.</div> : null}
            {customerRows.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{c.companyName || c.email}</div>
                  <div className="text-xs text-gray-500 truncate">{c.email}</div>
                  <div className="text-xs text-gray-500">{c.branch ? `Filială: ${c.branch.city}` : "Filială: —"}</div>
                  <div className="text-xs text-gray-500">Status: {c.isActive ? "Activ" : "Dezactivat"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 transition"
                    onClick={() => openCustomerEdit(c)}
                    disabled={loading}
                  >
                    Editează
                  </button>
                  <button
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 transition"
                    onClick={() => void deactivateUser(c.id, c.email)}
                    disabled={loading}
                    title="Dezactivează cont"
                  >
                    Dezactivează
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 lg:col-span-2">
          <button
            type="button"
            onClick={() => setLogsPanelOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 rounded-xl px-2 py-1 hover:bg-gray-50 transition-colors"
            aria-expanded={logsPanelOpen}
            aria-controls="support-logs-panel"
          >
            <SectionTitle title="Activitate (logs)" />
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${logsPanelOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div id="support-logs-panel" className={`admin-panel-expand mt-3 ${logsPanelOpen ? "open" : "closed"}`}>
            <div className="mb-3 rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/70 p-3 shadow-sm">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Filtre logs</div>
              <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-gray-600">
                Actor
                <div className="relative mt-1 min-w-[170px]" ref={logsActorRef}>
                  <button
                    type="button"
                    onClick={() => setLogsActorOpen((v) => !v)}
                    className="flex h-10 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  >
                    <span className="truncate">{logsActorFilter === "all" ? "Toți" : logsActorFilter}</span>
                    <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform ${logsActorOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {logsActorOpen && (
                    <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                      {[{ id: "all", label: "Toți" }, ...logsActorOptions.map((a) => ({ id: a, label: a }))].map((opt) => {
                        const active = logsActorFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setLogsActorFilter(opt.id);
                              setLogsActorOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                              active ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="truncate">{opt.label}</span>
                            {active ? <span>✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </label>
              <label className="text-xs text-gray-600">
                Acțiune
                <div className="relative mt-1 min-w-[190px]" ref={logsActionRef}>
                  <button
                    type="button"
                    onClick={() => setLogsActionOpen((v) => !v)}
                    className="flex h-10 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  >
                    <span className="truncate">{logsActionFilter === "all" ? "Toate" : logsActionFilter}</span>
                    <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform ${logsActionOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {logsActionOpen && (
                    <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                      {[{ id: "all", label: "Toate" }, ...logsActionOptions.map((a) => ({ id: a, label: a }))].map((opt) => {
                        const active = logsActionFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setLogsActionFilter(opt.id);
                              setLogsActionOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                              active ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="truncate">{opt.label}</span>
                            {active ? <span>✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </label>
              <label className="text-xs text-gray-600">
                De la
                <div className="relative mt-1 min-w-[170px]" ref={logsDateFromRef}>
                  <button
                    type="button"
                    onClick={(e) => openDatePicker("from", logsDateFrom, e.currentTarget)}
                    className="flex h-10 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  >
                    <span className={logsDateFrom ? "" : "text-gray-400"}>{logsDateFrom || "dd/mm/yyyy"}</span>
                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M8 2v3M16 2v3M3.5 9.5h17M5 5.5h14a1.5 1.5 0 011.5 1.5v12A1.5 1.5 0 0119 20.5H5A1.5 1.5 0 013.5 19V7A1.5 1.5 0 015 5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  {logsDatePickerOpen === "from" && (
                    <div
                      className="fixed z-[70] w-[280px] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl"
                      style={{
                        top: `${logsDatePickerPos?.top ?? 0}px`,
                        left: `${logsDatePickerPos?.left ?? 0}px`,
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => setLogsCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        >
                          ←
                        </button>
                        <div className="text-sm font-semibold text-gray-800">
                          {calendarMonthStart.toLocaleString("en-US", { month: "long", year: "numeric" })}
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => setLogsCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        >
                          →
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500 mb-1">
                        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                          <div key={d} className="py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((d) => {
                          const sameMonth = d.getMonth() === calendarMonthStart.getMonth();
                          const selected = !!fromDateObj && d.toDateString() === fromDateObj.toDateString();
                          return (
                            <button
                              key={d.toISOString()}
                              type="button"
                              onClick={() => {
                                setLogsDateFrom(formatDateDdMmYyyy(d));
                                setLogsDatePickerOpen(null);
                              }}
                              className={`h-8 rounded-lg text-xs transition-colors ${
                                selected ? "bg-primary text-white" : sameMonth ? "text-gray-800 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-50"
                              }`}
                            >
                              {d.getDate()}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <button type="button" className="text-xs text-primary" onClick={() => setLogsDateFrom("")}>
                          Clear
                        </button>
                        <button
                          type="button"
                          className="text-xs text-primary"
                          onClick={() => {
                            setLogsDateFrom(formatDateDdMmYyyy(new Date()));
                            setLogsDatePickerOpen(null);
                          }}
                        >
                          Today
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <label className="text-xs text-gray-600">
                Până la
                <div className="relative mt-1 min-w-[170px]" ref={logsDateToRef}>
                  <button
                    type="button"
                    onClick={(e) => openDatePicker("to", logsDateTo, e.currentTarget)}
                    className="flex h-10 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  >
                    <span className={logsDateTo ? "" : "text-gray-400"}>{logsDateTo || "dd/mm/yyyy"}</span>
                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M8 2v3M16 2v3M3.5 9.5h17M5 5.5h14a1.5 1.5 0 011.5 1.5v12A1.5 1.5 0 0119 20.5H5A1.5 1.5 0 013.5 19V7A1.5 1.5 0 015 5.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  {logsDatePickerOpen === "to" && (
                    <div
                      className="fixed z-[70] w-[280px] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl"
                      style={{
                        top: `${logsDatePickerPos?.top ?? 0}px`,
                        left: `${logsDatePickerPos?.left ?? 0}px`,
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => setLogsCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        >
                          ←
                        </button>
                        <div className="text-sm font-semibold text-gray-800">
                          {calendarMonthStart.toLocaleString("en-US", { month: "long", year: "numeric" })}
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => setLogsCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        >
                          →
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500 mb-1">
                        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                          <div key={d} className="py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((d) => {
                          const sameMonth = d.getMonth() === calendarMonthStart.getMonth();
                          const selected = !!toDateObj && d.toDateString() === toDateObj.toDateString();
                          return (
                            <button
                              key={d.toISOString()}
                              type="button"
                              onClick={() => {
                                setLogsDateTo(formatDateDdMmYyyy(d));
                                setLogsDatePickerOpen(null);
                              }}
                              className={`h-8 rounded-lg text-xs transition-colors ${
                                selected ? "bg-primary text-white" : sameMonth ? "text-gray-800 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-50"
                              }`}
                            >
                              {d.getDate()}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <button type="button" className="text-xs text-primary" onClick={() => setLogsDateTo("")}>
                          Clear
                        </button>
                        <button
                          type="button"
                          className="text-xs text-primary"
                          onClick={() => {
                            setLogsDateTo(formatDateDdMmYyyy(new Date()));
                            setLogsDatePickerOpen(null);
                          }}
                        >
                          Today
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <button
                type="button"
                className="h-10 rounded-2xl border border-gray-200 bg-white px-4 text-xs font-medium text-gray-700 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-gray-50"
                onClick={() => {
                  setLogsActorFilter("all");
                  setLogsActionFilter("all");
                  setLogsDateFrom("");
                  setLogsDateTo("");
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="h-10 rounded-2xl border border-primary/30 bg-primary/5 px-4 text-xs font-semibold text-primary shadow-sm transition-all hover:-translate-y-[1px] hover:bg-primary/10"
                onClick={exportLogsCsv}
              >
                Export CSV
              </button>
              </div>
            </div>
            <div className={`overflow-auto max-h-[520px] border border-gray-100 rounded-xl ${logsPanelOpen ? "admin-panel-open" : ""}`}>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs text-gray-600">
                    <th className="px-3 py-2">Timp</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Acțiune</th>
                    <th className="px-3 py-2">Țintă</th>
                    <th className="px-3 py-2">Rezumat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                        Nu există logs încă.
                      </td>
                    </tr>
                  ) : null}
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString("ro-MD") : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                        {l.actorEmail ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                        {l.actionType}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {l.staffName ? `Staff: ${l.staffName}` : ""}
                        {l.jobTitle ? ` ${l.jobTitle}` : ""}
                        {l.targetJobId != null ? ` (job #${l.targetJobId})` : ""}
                        {l.targetApplicationId != null ? ` (app #${l.targetApplicationId})` : ""}
                        {!l.staffName && !l.jobTitle && l.targetJobId == null && l.targetApplicationId == null ? "—" : null}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {l.summary ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {staffPanelOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setStaffPanelOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {staffMode === "create" ? "Creează angajat" : "Editează angajat"}
                </h3>
                <p className="text-sm text-gray-600">Completați câmpurile obligatorii.</p>
              </div>
              <button className="text-gray-500 hover:text-gray-900" onClick={() => setStaffPanelOpen(false)} disabled={loading}>
                Închide
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {staffMode === "create" ? (
                <>
                  <label className="text-sm text-gray-700">
                    Email
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
                  </label>
                  <label className="text-sm text-gray-700">
                    Parolă
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} />
                  </label>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-gray-700">
                  Prenume
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={staffForm.firstName} onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })} />
                </label>
                <label className="text-sm text-gray-700">
                  Nume
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={staffForm.lastName} onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })} />
                </label>
              </div>

              <DatePicker
                name="supportStaffDob"
                value={staffForm.dateOfBirth}
                onChange={(v) => setStaffForm({ ...staffForm, dateOfBirth: v })}
                label="Data nașterii"
                disablePastDates={false}
                hideFooter
                className="[&_.date-picker-label]:text-sm [&_.date-picker-label]:font-normal [&_.date-picker-label]:text-gray-700"
              />

              <label className="text-sm text-gray-700">
                About me
                <textarea className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={staffForm.aboutMe} onChange={(e) => setStaffForm({ ...staffForm, aboutMe: e.target.value })} rows={3} />
              </label>

              <label className="text-sm text-gray-700">
                Avatar (opțional)
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={staffForm.avatar} onChange={(e) => setStaffForm({ ...staffForm, avatar: e.target.value })} />
              </label>

              <button
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md transition"
                onClick={() => void submitStaff()}
                disabled={loading}
              >
                {staffMode === "create" ? "Creează" : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customerPanelOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setCustomerPanelOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {customerMode === "create" ? "Creează business" : "Editează business"}
                </h3>
                <p className="text-sm text-gray-600">Includeți filiala (branch) și data de naștere a contactului.</p>
              </div>
              <button className="text-gray-500 hover:text-gray-900" onClick={() => setCustomerPanelOpen(false)} disabled={loading}>
                Închide
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {customerMode === "create" ? (
                <>
                  <label className="text-sm text-gray-700">
                    Email
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                  </label>
                  <label className="text-sm text-gray-700">
                    Parolă
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="password" value={customerForm.password} onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })} />
                  </label>
                </>
              ) : null}

              <label className="text-sm text-gray-700">
                Nume companie
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.companyName} onChange={(e) => setCustomerForm({ ...customerForm, companyName: e.target.value })} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-gray-700">
                  Contact prenume
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.contactFirstName} onChange={(e) => setCustomerForm({ ...customerForm, contactFirstName: e.target.value })} />
                </label>
                <label className="text-sm text-gray-700">
                  Contact nume
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.contactLastName} onChange={(e) => setCustomerForm({ ...customerForm, contactLastName: e.target.value })} />
                </label>
              </div>

              <DatePicker
                name="supportContactDob"
                value={customerForm.contactDateOfBirth}
                onChange={(v) => setCustomerForm({ ...customerForm, contactDateOfBirth: v })}
                label="Data nașterii contactului"
                disablePastDates={false}
                hideFooter
                className="[&_.date-picker-label]:text-sm [&_.date-picker-label]:font-normal [&_.date-picker-label]:text-gray-700"
              />

              <label className="text-sm text-gray-700">
                Company category (code)
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  type="number"
                  value={customerForm.companyCategory}
                  onChange={(e) => setCustomerForm({ ...customerForm, companyCategory: Number(e.target.value) })}
                />
              </label>

              <label className="text-sm text-gray-700">
                Info for staff
                <textarea className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.infoForStaff} onChange={(e) => setCustomerForm({ ...customerForm, infoForStaff: e.target.value })} rows={3} />
              </label>

              <div className="mt-2 text-sm font-semibold text-gray-900">Filială (branch)</div>
              <label className="text-sm text-gray-700">
                Nume filială
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.branchName} onChange={(e) => setCustomerForm({ ...customerForm, branchName: e.target.value })} />
              </label>
              <label className="text-sm text-gray-700">
                Adresă
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.branchAddress} onChange={(e) => setCustomerForm({ ...customerForm, branchAddress: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-gray-700">
                  Oraș
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.branchCity} onChange={(e) => setCustomerForm({ ...customerForm, branchCity: e.target.value })} />
                </label>
                <label className="text-sm text-gray-700">
                  Țară
                  <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.branchCountry} onChange={(e) => setCustomerForm({ ...customerForm, branchCountry: e.target.value })} />
                </label>
              </div>
              <label className="text-sm text-gray-700">
                Telefon
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={customerForm.branchPhoneNumber} onChange={(e) => setCustomerForm({ ...customerForm, branchPhoneNumber: e.target.value })} />
              </label>

              <button
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md transition"
                onClick={() => void submitCustomer()}
                disabled={loading}
              >
                {customerMode === "create" ? "Creează" : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

