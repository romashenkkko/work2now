/**
 * Baza URL pentru API.
 *
 * - Dacă VITE_API_URL este setat (production / hosting custom) → îl folosim ca absolut.
 * - În rest → folosim mereu `/api` pe același host și port ca frontend-ul,
 *   iar Vite sau serverul Node se ocupă de proxy/route.
 */
function getApiBase(): string {
  if (typeof window === "undefined") return "/api";
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    const base = envUrl.trim().replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  // Same-origin: frontend și backend pe același host:port (Vite proxy sau Node servește build-ul)
  return "/api";
}

function getToken(): string | null {
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
    };
  }) =>
    api<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  me: () => api<{ id: number; name: string; email: string; role: string; avatar?: string; isActive?: boolean; boosterUntil?: string }>("/auth/me"),
  updateProfile: (data: { name?: string; avatar?: string | null }) =>
    api<{ id: number; name: string; email: string; role: string; avatar?: string }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
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
  create: (payload: JobPayload) =>
    api<JobResponse>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  delete: (id: string) => api<{ ok: boolean }>(`/jobs/${id}`, { method: "DELETE" }),
  apply: (jobId: string) =>
    api<{ ok: boolean }>(`/jobs/${jobId}/apply`, { method: "POST" }),
  myApplications: () =>
    api<{ byJob: Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }> }>("/jobs/my-applications"),
  /** Staff: full list of my applications with job details, sessions, rating (GET /api/jobs/my-applications/list). */
  myApplicationsList: () =>
    api<{ applications: Array<{
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
    }> }>("/jobs/my-applications/list"),
  applications: () =>
    api<{ applications: Record<string, { id: string; jobId: string; staffId: string; staffName: string; staffEmail?: string; status: string; checkedInAt?: string; checkedOutAt?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }[]> }>("/jobs/applications"),
  setApplicationStatus: (applicationId: string, status: "accepted" | "refused") =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  completeApplication: (applicationId: string) =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}/complete`, { method: "PATCH" }),
  /** Customer: confirm job finished (after staff checkout); application then moves to history. */
  confirmCompletion: (applicationId: string) =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}/confirm-completion`, { method: "PATCH" }),
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
};

export type ReviewItem = {
  id: string;
  applicationId: string;
  jobTitle?: string;
  otherPartyName?: string;
  otherPartyAvatar?: string;
  otherPartyRole?: string;
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
  isActive: boolean;
  createdAt: string;
};

export const branchesApi = {
  list: () => api<{ branches: Branch[] }>("/branches"),
  create: (data: { name: string; address: string; city: string; country?: string; phoneNumber: string }) =>
    api<Branch>("/branches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; address?: string; city?: string; country?: string; phoneNumber?: string; isActive?: boolean }) =>
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
  submitOnboarding: (experiences: { jobCategory: number; duration: number }[]) =>
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
