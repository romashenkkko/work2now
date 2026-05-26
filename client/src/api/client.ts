/**
 * Baza URL pentru API.
 *
 * - VITE_API_URL setat → URL absolut (recomandat în producție pe hosting separat).
 * - PROD pe localhost/127.0.0.1 și portul paginii ≠ portul API (VITE_API_PORT sau 5600) →
 *   `http://host:PORT/api` ca să nu trimită `/api` către Apache/Vite pe același port (404).
 * - În rest → `/api` (proxy Vite în dev sau Express care servește UI+API pe același port).
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "/api";
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    const base = envUrl.trim().replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  const proto = window.location.protocol;
  if (proto !== "http:" && proto !== "https:") return "/api";
  const host = window.location.hostname;
  const pagePort = window.location.port; // gol = 80/443 implicit
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  const apiPort = String(import.meta.env.VITE_API_PORT || "5600").trim() || "5600";
  /**
   * Comparăm portul „vizibil” al paginii cu cel al API-ului.
   * http://localhost fără port în bară → pagePort "" dar browserul folosește 80; API e pe 5600 → redirect explicit.
   */
  const samePortAsApi = pagePort === apiPort || (!pagePort && (apiPort === "80" || apiPort === "443"));
  if (import.meta.env.PROD && isLocalHost && !samePortAsApi) {
    return `${proto}//${host}:${apiPort}/api`;
  }
  return "/api";
}

/** URL absolut pentru asset-uri `/api/...` (ex. imagini job, atașamente) când API e pe alt port. */
export function resolveApiAssetUrl(apiPath: string): string {
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const base = getApiBase();
  if (base.endsWith("/api")) {
    const root = base.slice(0, -4);
    return root ? `${root}${p}` : p;
  }
  return `${base}${p}`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const isGet = (options.method ?? "GET").toUpperCase() === "GET";
  const fetchOpts: RequestInit = { ...options, headers };
  if (isGet && !("cache" in (options ?? {}))) fetchOpts.cache = "no-store";
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, fetchOpts);
  } catch (e) {
    const err = e as Error;
    throw new Error(err.message || "Serverul nu raspunde. Verifica ca backend-ul ruleaza (npm run dev).");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403 && (data as { code?: string }).code === "ACCOUNT_BLOCKED") {
      window.dispatchEvent(new CustomEvent("account-blocked"));
    }
    const serverDown =
      res.status === 500 || res.status === 502 || res.status === 503;
    const defaultMsg =
      serverDown
        ? "Eroare server. Verifica ca backend-ul ruleaza. Porneste din rădăcina proiectului: npm run dev (backend + frontend)."
        : res.statusText;
    const msg =
      (data as { error?: string }).error ??
      (data as { message?: string }).message ??
      defaultMsg;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { method: "POST", headers, body: formData });
  } catch (e) {
    const err = e as Error;
    throw new Error(err.message || "Serverul nu raspunde. Verifica ca backend-ul ruleaza (npm run dev).");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg =
      (data as { error?: string }).error ??
      (data as { message?: string }).message ??
      res.statusText;
    if (res.status === 404 && (!msg || msg === "Not Found")) {
      msg =
        "API 404: ruta nu există sau cererea nu ajunge la serverul Node. Dacă folosești XAMPP, pornește API-ul (npm run dev din rădăcina proiectului sau npm run start în server) și, la nevoie, setează în client/.env VITE_API_URL=http://localhost:5600 apoi rebuild.";
    }
    throw new Error(msg);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: { id: number; name: string; email: string; role?: string; avatar?: string; isActive?: boolean } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  sendOTP: (phoneNumber: string) =>
    api<{ message: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    }),
  verifyOTP: (phoneNumber: string, code: string) =>
    api<{ verified: boolean; message?: string }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, code }),
    }),
  validateRegistration: (body: {
    name: string;
    email: string;
    password: string;
    role?: string;
    employeeProfile?: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      aboutMe: string;
    };
    businessProfile?: {
      companyName: string;
      contactFirstName: string;
      contactLastName: string;
      companyCategory: number;
      infoForStaff: string;
    };
    branch?: {
      name: string;
      address: string;
      city: string;
      country: string;
      phoneNumber: string;
      raionId?: number;
    };
    contactDateOfBirth?: string;
  }) =>
    api<{ valid: boolean }>("/auth/validate-registration", { method: "POST", body: JSON.stringify(body) }),
  register: (body: {
    name: string;
    email: string;
    password: string;
    role?: string;
    employeeProfile?: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      aboutMe: string;
    };
    businessProfile?: {
      companyName: string;
      contactFirstName: string;
      contactLastName: string;
      companyCategory: number;
      infoForStaff: string;
    };
    branch?: {
      name: string;
      address: string;
      city: string;
      country: string;
      phoneNumber: string;
      raionId?: number | null;
    };
  }) =>
    api<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  me: () => api<{ id: number; name: string; email: string; role: string; avatar?: string; isActive?: boolean; boosterUntil?: string; cvFileUrl?: string; cvOriginalName?: string }>("/auth/me"),
  updateProfile: (data: { name?: string; avatar?: string | null }) =>
    api<{ id: number; name: string; email: string; role: string; avatar?: string }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  uploadCv: async (file: File) => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("cv", file);
    const res = await fetch(`${getApiBase()}/auth/cv/upload`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "CV upload failed.");
    return data as { ok: boolean; cvFileUrl: string; cvOriginalName: string };
  },
  deleteCv: () => api<{ ok: boolean }>("/auth/cv", { method: "DELETE" }),
  getCvUrl: (userId: string) => `${getApiBase()}/auth/cv/${encodeURIComponent(userId)}`,
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  /** Lista conturi (doar admin) */
  users: () =>
    api<{ users: { id: number; name: string; email: string; role: string; isActive?: boolean; phone?: string; boosterUntil?: string }[] }>("/auth/users"),
  /** Admin: blochează/deblochează cont (active = true deblochează, false blochează). Folosește POST cu userId în body. */
  setUserStatus: (userId: string, active: boolean) =>
    api<{ ok: boolean; active: boolean }>("/auth/users/set-status", {
      method: "POST",
      body: JSON.stringify({ userId: String(userId).trim(), active }),
    }),

  /** Support/Admin: list staff or businesses */
  supportListUsers: (role: "staff" | "customer") =>
    api<{ users: Array<any> }>(`/auth/support/users?role=${encodeURIComponent(role)}`),

  /** Support/Admin: create staff or business */
  supportCreateUser: (payload: any) =>
    api<{ ok: true; userId: string }>("/auth/support/users", { method: "POST", body: JSON.stringify(payload) }),

  /** Support/Admin: update staff or business */
  supportUpdateUser: (id: string, payload: any) =>
    api<{ ok: true }>("/auth/support/users/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(payload) }),

  /** Support/Admin: deactivate staff or business (soft delete) */
  supportDeactivateUser: (id: string) =>
    api<{ ok: true; isActive: false }>("/auth/support/users/" + encodeURIComponent(id), { method: "DELETE" }),

  /** Support/Admin: activity logs */
  supportGetLogs: (limit = 200, offset = 0) =>
    api<{ logs: Array<any> }>(`/auth/support/logs?limit=${limit}&offset=${offset}`),
  /** Admin: setează subscription booster pentru customer – joburile lui apar primele. boosterUntil: ISO string sau null pentru anulare. */
  setUserBooster: (userId: string, boosterUntil: string | null) =>
    api<{ ok: boolean; boosterUntil?: string }>("/auth/users/set-booster", {
      method: "POST",
      body: JSON.stringify({ userId: String(userId).trim(), boosterUntil }),
    }),
};

export type JobPayload = {
  job: string; // Custom title (max 30 chars) - required
  location: string;
  status?: string;
  statusClass?: string;
  date: string;
  endDate?: string;
  jobType?: string;
  startTime?: string;
  endTime?: string;
  peopleNeeded?: string;
  duration?: string;
  estimatedSalary?: string;


  // ✅ NEW: required for server validation
  jobCategoryCode: number;   // matches enum code
  hourlyRateBase: number;    // MDL/hour (will be validated against minHourly)
  checkInLat?: number;
  checkInLng?: number;
  checkInRadiusM?: number;
  
  // ✅ NEW: region tracking for precise statistics
  raionId?: number;          // ID from raioane table
  localitate?: string;       // City/village name (max 200 chars)

  /** Filială business (opțional; trebuie să aparțină angajatorului) */
  branchId?: string;

  /** URL imagine copertă (ex. după POST /jobs/upload-image) */
  imageUrl?: string;
  /** URL-uri galerie (aceeași sursă ca imageUrl) */
  galleryImageUrls?: string[];

  /** Documente încărcate cu POST /jobs/upload-attachment (url + nume afișat) */
  jobAttachments?: { url: string; name: string }[];

};


export type JobResponse = {
  imageUrl: string | undefined;
  postedBy: string | undefined;
  id: string;
  job: string; // Custom title (max 30 chars)
  jobCategoryTitle?: string; // Category name from job_categories
  location: string;
  status: string;
  statusClass: string;
  date: string;
  endDate?: string;
  jobType?: string;
  applicationsCount?: number;
  acceptedCount?: number;
  startTime?: string;
  endTime?: string;
  peopleNeeded?: string;
  duration?: string;
  estimatedSalary?: string;
  posted_by_name?: string;

  // ✅ NEW
  jobCategoryCode?: number;
  hourlyRateBase?: number;
  postedById?: string;
  postedByRole?: string;
  postedByAvatar?: string;
  /** Locație pentru check-in (geo-fencing): lat, lng, raza în m */
  checkInLat?: number;
  checkInLng?: number;
  checkInRadiusM?: number;
  /** Filială asociată jobului (dacă a fost trimisă la creare) */
  branchId?: string;
  galleryImageUrls?: string[];
  jobAttachments?: { url: string; name: string }[];
};

export type ApplicationPaymentApiResponse = {
  payment: {
    id: string;
    applicationId: string;
    status: string;
    currency: string;
    workedMinutes: number;
    hourlyRateSnapshot: string;
    amountDue: string;
    paynetOrderId: string | null;
    customerConfirmedAt: string | null;
    paymentStartedAt: string | null;
    paidAt: string | null;
    failedAt?: string | null;
    lastError?: string | null;
  };
  paynet: {
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string;
  };
};

export type ApplicationPayoutSummary = {
  status: string;
  netPayoutAmount: string;
  currency: string;
  payoutDueAt?: string | null;
  payoutPendingAt?: string | null;
};

export type StaffApplicationItem = {
  id: string;
  jobId: string;
  status: "pending" | "accepted" | "refused";
  createdAt?: string;

  jobTitle?: string;
  jobLocation?: string;
  jobDate?: string;
  jobEndDate?: string;

  customerName?: string;

  checkedInAt?: string;
  checkedOutAt?: string;
  workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];

  ratingScore?: number;
  payout?: ApplicationPayoutSummary;
};

export type JobPaymentReservationDto = {
  id: string;
  jobId: string;
  status: string;
  provider: string;
  currency: string;
  plannedMinutesSnapshot: number;
  hourlyRateSnapshot: string;
  reservedAmount: string;
  paynetOrderId: string | null;
  paynetTransactionId: string | null;
  reservedAt: string | null;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublishAndReserveResponse = {
  ok: true;
  state: "live" | "payment_pending";
  jobId: number;
  jobStatus: string;
  jobStatusClass: string;
  publishedAt: string | null;
  publishBlockedReason: string | null;
  repaired?: boolean;
  reservation: JobPaymentReservationDto | null;
  paynet: {
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string | null;
    alreadySubmitted: boolean;
  };
};

export type JobPaymentReservationStatusResponse = {
  jobId: number;
  jobStatus: string;
  jobStatusClass: string;
  publishedAt: string | null;
  publishBlockedReason: string | null;
  reservation: JobPaymentReservationDto | null;
  paynet: {
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string | null;
  };
};

export type ConfirmCompletionBody = {
  confirmed: boolean;
  approvedOvertimeMinutes?: number;
  refused?: boolean;
};

export type ConfirmCompletionResponse = {
  ok: true;
  refused: boolean;
  alreadyConfirmed: boolean;
  payout: ApplicationPayoutSummary | null;
};

export type AdminPayoutListItem = {
  id: string;
  applicationId: string;
  jobTitle: string;
  staffName: string;
  customerName: string;
  amount: string;
  currency: string;
  payoutDueAt: string | null;
  status: string;
  payoutProvider?: string | null;
  providerPayoutId?: string | null;
  providerReference?: string | null;
  retryCount?: number;
  nextRetryAt?: string | null;
  manualOverride?: boolean;
};

export type AdminPayoutDetail = AdminPayoutListItem & {
  payoutPendingAt: string | null;
  actualMinutesSnapshot: number;
  plannedMinutesSnapshot: number;
  approvedOvertimeMinutes: number;
  overtimeAmount: string;
  grossAmount: string;
  payoutAmount: string;
  lastError: string | null;
  paidAt: string | null;
  failedAt: string | null;
  disputed: boolean;
  queuedAt?: string | null;
  processingStartedAt?: string | null;
};

export type StaffPayoutAccountDto = {
  id: string;
  staffUserId: string;
  isDefault: boolean;
  status: string;
  type: string;
  beneficiaryName: string;
  beneficiaryCountry: string | null;
  iban: string | null;
  bankName: string | null;
  phoneE164: string | null;
  walletProvider: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export const payoutAccountsApi = {
  list: () => api<{ accounts: StaffPayoutAccountDto[] }>("/payout-accounts"),
  upsert: (body: {
    type: "iban" | "phone";
    beneficiaryName: string;
    beneficiaryCountry?: string;
    iban?: string;
    bankName?: string;
    phoneE164?: string;
    walletProvider?: string;
  }) =>
    api<{ ok: true; account: StaffPayoutAccountDto }>("/payout-accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export type JobCategory = {
  code: number;
  title: string;
  hourlyMin: number;
  checkInLat?: number;
  checkInLng?: number;
  checkInRadiusM?: number;
  postedBy?: string;
  postedById?: string;
  postedByRole?: string;
  postedByAvatar?: string;

};

export const jobsApi = {
  list: () => api<{ jobs: JobResponse[] }>("/jobs"),
  getCategories: () => api<{ categories: JobCategory[] }>("/jobs/categories"),
  uploadJobImage: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return apiFormData<{ url: string }>("/jobs/upload-image", fd);
  },
  uploadJobAttachment: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFormData<{ url: string; originalName: string }>("/jobs/upload-attachment", fd);
  },
  create: (payload: JobPayload) =>
    api<JobResponse>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  delete: (id: string) => api<{ ok: boolean }>(`/jobs/${id}`, { method: "DELETE" }),
  apply: (jobId: string) =>
    api<{ ok: boolean }>(`/jobs/${jobId}/apply`, { method: "POST" }),
  myApplications: () =>
    api<{ byJob: Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }> }>("/jobs/my-applications"),
  /** Staff: full list of my applications with job details, sessions, rating (GET /api/jobs/my-applications/list). */
  myApplicationsList: () =>
    api<{ applications: StaffApplicationItem[] }>("/jobs/my-applications/list"),
  applications: () =>
    api<{
      applications: Record<
        string,
        {
          id: string;
          jobId: string;
          staffId: string;
          staffName: string;
          staffEmail?: string;
          staffAvatar?: string;
          staffCvFileUrl?: string;
          staffCvOriginalName?: string;
          status: string;
          checkedInAt?: string;
          checkedOutAt?: string;
          businessConfirmedAt?: string;
          isBusinessConfirmed?: boolean;
          workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];
          ratingScore?: number;
          payout?: ApplicationPayoutSummary;
        }[]
      >;
    }>("/jobs/applications"),
  setApplicationStatus: (applicationId: string, status: "accepted" | "refused") =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  completeApplication: (applicationId: string) =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}/complete`, { method: "PATCH" }),
  /** Customer: confirm or refuse job completion (after staff checkout). */
  confirmCompletion: (applicationId: string, body: ConfirmCompletionBody) =>
    api<ConfirmCompletionResponse>(`/jobs/applications/${applicationId}/confirm-completion`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  /** Customer: publish Draft job and start Paynet reservation. */
  publishAndReserve: (jobId: string) =>
    api<PublishAndReserveResponse>(`/jobs/${jobId}/publish-and-reserve`, { method: "POST" }),
  /** Customer: poll reservation + job publish status. */
  getJobPaymentReservation: (jobId: string) =>
    api<JobPaymentReservationStatusResponse>(`/jobs/${jobId}/payment-reservation`, { method: "GET" }),
  retryJobPaymentReservation: (jobId: string) =>
    api<{
      ok: true;
      jobId: number;
      paynetOrderId: string | null;
      redirectUrl: string | null;
      alreadySubmitted: boolean;
      reservationStatus: string;
    }>(`/jobs/${jobId}/payment-reservation/retry`, { method: "POST" }),
  /** Customer/staff: read current payment state for an application. */
  getApplicationPayment: (applicationId: string) =>
    api<ApplicationPaymentApiResponse>(`/payments/applications/${applicationId}`, { method: "GET" }),
  /** Customer: start the Paynet redirect flow for a confirmed application. */
  startApplicationPayment: (applicationId: string, idempotencyKey: string) =>
    api<ApplicationPaymentApiResponse>(`/payments/applications/${applicationId}/start`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  checkIn: (applicationId: string, workDate?: string, geo?: { lat: number; lng: number }) =>
    api<{ ok: boolean; alreadyDone?: boolean }>(`/jobs/applications/${applicationId}/check-in`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(workDate ? { workDate } : {}),
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      }),
    }),
  checkOut: (applicationId: string, workDate?: string, geo?: { lat: number; lng: number }) =>
    api<{ ok: boolean; alreadyDone?: boolean }>(`/jobs/applications/${applicationId}/check-out`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(workDate ? { workDate } : {}),
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      }),
    }),
  /** Customer/Admin: set job promoted (booster) on/off */
  setPromoted: (jobId: string, promoted: boolean) =>
    api<{ ok: boolean; promoted: boolean }>(`/jobs/${jobId}/promote`, {
      method: "PATCH",
      body: JSON.stringify({ promoted }),
    }),
  /** Customer/Business: get general statistics (employees count, job categories distribution, branches distribution) */
  getStatistics: () =>
    api<{
      totalEmployees: number;
      categoriesByJobCount: Array<{ code: number; title: string; count: number }>;
      branchesByJobCount: Array<{ branchId: string; branchName: string; count: number }>;
    }>("/jobs/statistics"),
  /** Admin only: salary by domain/region, financial, company ranking */
  getAdminStatistics: () =>
    api<{
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
    }>("/jobs/admin/statistics"),
  /** Get raioane (districts/municipalities) with optional search */
  getRaioane: (search?: string) =>
    api<{
      raioane: Array<{ id: number; name: string; type: string }>;
    }>(`/jobs/raioane${search ? `?search=${encodeURIComponent(search)}` : ""}`),
};

export const adminApi = {
  listOrphanReservations: () => api<{ orphans: Array<{
    reservationId: string;
    jobId: string;
    jobStatus: string;
    reservationStatus: string;
    paynetOrderId: string | null;
    issue: string;
  }> }>("/admin/payments/orphans"),
  expireStaleReservations: () =>
    api<{ expiredCount: number }>("/admin/payments/expire-stale", { method: "POST" }),
  reconcileJobReservation: (jobId: string) =>
    api<{ ok: true; repaired: boolean; jobStatus: string; reservationStatus: string }>(
      `/admin/payments/jobs/${jobId}/reconcile`,
      { method: "POST" }
    ),
  reconcileByPaynetOrderId: (paynetOrderId: string) =>
    api<{ ok: true; jobId: number; repaired: boolean }>("/admin/payments/reconcile-by-order", {
      method: "POST",
      body: JSON.stringify({ paynetOrderId }),
    }),
  listPayouts: (status = "payout_pending") =>
    api<{ payouts: AdminPayoutListItem[] }>(`/admin/payouts?status=${encodeURIComponent(status)}`),
  getPayout: (payoutId: string) => api<AdminPayoutDetail>(`/admin/payouts/${payoutId}`),
  markPayoutPaid: (payoutId: string, note?: string) =>
    api<{ ok: true; payout: AdminPayoutDetail }>(`/admin/payouts/${payoutId}/mark-paid`, {
      method: "POST",
      body: JSON.stringify(note != null && note.trim() ? { note: note.trim() } : {}),
    }),
  markPayoutFailed: (payoutId: string, note?: string) =>
    api<{ ok: true; payout: AdminPayoutDetail }>(`/admin/payouts/${payoutId}/mark-failed`, {
      method: "POST",
      body: JSON.stringify(note != null && note.trim() ? { note: note.trim() } : {}),
    }),
  markPayoutDisputed: (payoutId: string, note?: string) =>
    api<{ ok: true; payout: AdminPayoutDetail }>(`/admin/payouts/${payoutId}/mark-disputed`, {
      method: "POST",
      body: JSON.stringify(note != null && note.trim() ? { note: note.trim() } : {}),
    }),
  markPayoutRetry: (payoutId: string, note?: string) =>
    api<{ ok: true; payout: AdminPayoutDetail }>(`/admin/payouts/${payoutId}/retry`, {
      method: "POST",
      body: JSON.stringify(note != null && note.trim() ? { note: note.trim() } : {}),
    }),
  verifyStaffPayoutAccount: (accountId: string) =>
    api<{ ok: true; account: StaffPayoutAccountDto }>(`/admin/payout-accounts/${accountId}/verify`, { method: "POST" }),
  rejectStaffPayoutAccount: (accountId: string, reason?: string) =>
    api<{ ok: true; account: StaffPayoutAccountDto }>(`/admin/payout-accounts/${accountId}/reject`, {
      method: "POST",
      body: JSON.stringify(reason?.trim() ? { note: reason.trim() } : {}),
    }),
};

export type ReviewItem = {
  id: string;
  applicationId: string;
  jobTitle?: string;
  otherPartyName?: string;
  otherPartyUserId?: string;
  otherPartyAvatar?: string;
  otherPartyRole?: string;
  otherPartyRatingAverage?: number;
  otherPartyRatingCount?: number;
  score: number;
  comment?: string;
  photoUrl?: string;
  createdAt?: string;
};

export const ratingsApi = {
  submit: (applicationId: string, score: number, comment?: string, photoUrl?: string, jobTitle?: string) =>
    api<{ ok: boolean }>("/ratings", {
      method: "POST",
      body: JSON.stringify({
        applicationId: String(applicationId),
        score: Number(score),
        ...(comment != null && comment !== "" && { comment }),
        ...(photoUrl != null && photoUrl !== "" && { photoUrl }),
        ...(jobTitle != null && jobTitle.trim() !== "" && { jobTitle: jobTitle.trim() }),
      }),
    }),
  getUserRating: (userId: number | string) =>
    api<{ average: number; count: number }>(`/ratings/user/${userId}`),
  getReviewsReceivedBy: (userId: number | string) =>
    api<{ reviews: ReviewItem[] }>(`/ratings/received/${userId}`),
  /** Summary + lista recenzii primite în același răspuns (același userId) */
  getProfileRatings: (userId: number | string) =>
    api<{ average: number; count: number; reviews: ReviewItem[] }>(`/ratings/profile/${userId}`),
  myReviews: () =>
    api<{ given: ReviewItem[]; received: ReviewItem[] }>("/ratings/me"),
};

export type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phoneNumber: string;
  raionId: number | null;
  isActive: boolean;
  createdAt: string;
};

export const branchesApi = {
  list: () => api<{ branches: Branch[] }>("/branches"),
  create: (data: {
    name: string;
    address: string;
    city: string;
    country?: string;
    phoneNumber: string;
    raionId: number;
  }) =>
    api<Branch>("/branches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: {
      name?: string;
      address?: string;
      city?: string;
      country?: string;
      phoneNumber?: string;
      raionId?: number;
      isActive?: boolean;
    }
  ) =>
    api<Branch>(`/branches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    api<{ ok: boolean; message: string }>(`/branches/${id}`, {
      method: "DELETE",
    }),
};

export type Experience = {
  id: string;
  jobCategory: number;
  duration: number;
  description: string;
};

export const experiencesApi = {
  checkOnboarding: () => api<{ needsOnboarding: boolean }>("/experiences/check-onboarding"),
  submitOnboarding: (experiences: { jobCategory: number; duration: number; description: string }[]) =>
    api<{ ok: boolean; message: string }>("/experiences/onboarding", {
      method: "POST",
      body: JSON.stringify({ experiences }),
    }),
  list: () => api<{ experiences: Experience[] }>("/experiences"),
  listByUser: (userId: string) =>
    api<{ experiences: Experience[] }>(`/experiences/user/${encodeURIComponent(userId)}`),
  create: (data: { jobCategory: number; duration: number; description?: string }) =>
    api<Experience>("/experiences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { duration?: number; description?: string }) =>
    api<{ ok: boolean; message: string }>(`/experiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    api<{ ok: boolean; message: string }>(`/experiences/${id}`, {
      method: "DELETE",
    }),
};
