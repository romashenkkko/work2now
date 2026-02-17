/** URL-ul API: setează VITE_API_URL în .env când accesezi de pe alt PC (ex. http://192.168.1.5:5600/api). */
function getApiBase(): string {
  if (typeof window === "undefined") return "/api";
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    const base = envUrl.trim().replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "/api";
  // Use VITE_API_PORT from environment or default to 5600
  const apiPort = import.meta.env.VITE_API_PORT || "5600";
  return `http://${host}:${apiPort}/api`;
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
    api<{ token: string; user: { id: number; name: string; email: string; role?: string; avatar?: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
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
  me: () => api<{ id: number; name: string; email: string; role: string; avatar?: string }>("/auth/me"),
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
    api<{ users: { id: number; name: string; email: string; role: string }[] }>("/auth/users"),
};

export type JobPayload = {
  job: string;
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
};

export type JobResponse = {
  id: string;
  job: string;
  location: string;
  status: string;
  statusClass: string;
  date: string;
  endDate?: string;
  jobType?: string;
  applicationsCount?: number;
  startTime?: string;
  endTime?: string;
  peopleNeeded?: string;
  duration?: string;
  estimatedSalary?: string;
  imageUrl?: string;
  postedBy?: string;
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

  completedAt?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];

  ratingScore?: number;
};

export const jobsApi = {
  list: () => api<{ jobs: JobResponse[] }>("/jobs"),
  create: (payload: JobPayload) =>
    api<JobResponse>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  delete: (id: string) => api<{ ok: boolean }>(`/jobs/${id}`, { method: "DELETE" }),
  apply: (jobId: string) =>
    api<{ ok: boolean }>(`/jobs/${jobId}/apply`, { method: "POST" }),
  myApplications: () =>
    api<{ byJob: Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }> }>("/jobs/my-applications"),
  applications: () =>
    api<{ applications: Record<string, { id: string; jobId: string; staffId: string; staffName: string; staffEmail?: string; status: string; checkedInAt?: string; checkedOutAt?: string; workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }[]> }>("/jobs/applications"),
  setApplicationStatus: (applicationId: string, status: "accepted" | "refused") =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  completeApplication: (applicationId: string) =>
    api<{ ok: boolean }>(`/jobs/applications/${applicationId}/complete`, { method: "PATCH" }),
  checkIn: (applicationId: string, workDate?: string) =>
    api<{ ok: boolean; alreadyDone?: boolean }>(`/jobs/applications/${applicationId}/check-in`, { method: "PATCH", body: workDate ? JSON.stringify({ workDate }) : "{}" }),
  checkOut: (applicationId: string, workDate?: string) =>
    api<{ ok: boolean; alreadyDone?: boolean }>(`/jobs/applications/${applicationId}/check-out`, { method: "PATCH", body: workDate ? JSON.stringify({ workDate }) : "{}" }),
  myApplicationsList: () =>
    api<{ applications: StaffApplicationItem[] }>("/jobs/my-applications/list"),
};

export const ratingsApi = {
  submit: (applicationId: string, score: number) =>
    api<{ ok: boolean }>("/ratings", {
      method: "POST",
      body: JSON.stringify({ applicationId, score }),
    }),
  getUserRating: (userId: number | string) =>
    api<{ average: number; count: number }>(`/ratings/user/${userId}`),
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
