import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/client";
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

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-gray-900">{title}</h2>;
}

export default function DashboardHomeSupport() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
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
      const [staffData, customerData, logsData] = await Promise.all([
        authApi.supportListUsers("staff"),
        authApi.supportListUsers("customer"),
        authApi.supportGetLogs(200, 0),
      ]);
      setStaff((staffData as any).users ?? []);
      setCustomers((customerData as any).users ?? []);
      setLogs((logsData as any).logs ?? []);
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
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Activitate (logs)" />
          </div>

          <div className="mt-3 overflow-auto max-h-[520px] border border-gray-100 rounded-xl">
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
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Nu există logs încă.
                    </td>
                  </tr>
                ) : null}
                {logs.map((l) => (
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
                disableFutureDates
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
                disableFutureDates
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

