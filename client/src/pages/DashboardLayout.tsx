import { useState, createContext, useRef, useEffect, type ComponentType } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Icon,
  Wine,
  ChefHat,
  SprayCan,
  Users,
  ShoppingCart,
  Wrench,
  Phone,
  ConciergeBell,
  Presentation,
  Briefcase,
  Home,
  FileText,
  BarChart2,
  Calendar,
  MessageCircle,
  Settings,
} from "lucide-react";
import { coffeemaker } from "@lucide/lab";
import { useAuth } from "../hooks/useAuth";
import { jobsApi, ratingsApi, experiencesApi } from "../api/client";
import TimePicker from "../components/TimePicker";
import StarRating from "../components/StarRating";
import DatePicker from "../components/DatePicker";
import AddressPickerModal from "../components/AddressPickerModal";
import DocumentsModal, { type DocItem } from "../components/DocumentsModal";

export type JobType = "one-day" | "multi-day" | "full-time";
export type JobRow = {
  id?: string;
  job: string;
  location: string;
  status: string;
  statusClass: string;
  date: string;
  endDate?: string;
  jobType?: JobType;
  applicationsCount?: number;
  startTime?: string;
  endTime?: string;
  peopleNeeded?: string;
  duration?: string;
  estimatedSalary?: string;
  imageUrl?: string;
  postedBy?: string;
};

export type Application = {
  id: string;
  jobId: string;
  staffId: string;
  staffName: string;
  staffEmail?: string;
  staffAvatar?: string;
  status: "pending" | "accepted" | "refused";
  completedAt?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];
  ratingScore?: number;
};

const APPLICATIONS_KEY = "time2go_applications";
const PUBLIC_JOBS_KEY = "time2go_public_jobs";

export function getApplications(): Record<string, Application[]> {
  try {
    const raw = localStorage.getItem(APPLICATIONS_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, Application[]>) : {};
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

export function setApplications(record: Record<string, Application[]>) {
  try {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(record));
  } catch {}
}

export function getPublicJobs(): JobRow[] {
  try {
    const raw = localStorage.getItem(PUBLIC_JOBS_KEY);
    const list = raw ? (JSON.parse(raw) as JobRow[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export const DashboardContext = createContext<{
  openPostJobModal: () => void;
  jobsAdded: JobRow[];
  addJob: (job: Omit<JobRow, "id">) => Promise<boolean>;
  removeJob: (id: string) => void;
  availableToWork: boolean;
  setAvailableToWork: (v: boolean) => void;
  jobsLoadError: boolean;
  userRating: { average: number; count: number } | null;
}>(null!);

const NAV_ICONS: Record<string, ComponentType<{ className?: string; size?: number }>> = {
  home: Home as ComponentType<{ className?: string; size?: number }>,
  briefcase: Briefcase as ComponentType<{ className?: string; size?: number }>,
  fileText: FileText as ComponentType<{ className?: string; size?: number }>,
  barChart: BarChart2 as ComponentType<{ className?: string; size?: number }>,
  calendar: Calendar as ComponentType<{ className?: string; size?: number }>,
  messageCircle: MessageCircle as ComponentType<{ className?: string; size?: number }>,
  settings: Settings as ComponentType<{ className?: string; size?: number }>,
};

const NAV_CUSTOMER = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
  { to: "/dashboard/joburi", labelKey: "dashboard.joburi", end: false, icon: "briefcase" },
  { to: "/dashboard/aplicatii", labelKey: "dashboard.aplicatii", end: false, icon: "fileText" },
  { to: "/dashboard/rapoarte", labelKey: "dashboard.rapoarte", end: false, icon: "barChart" },
  { to: "/dashboard/calendar", labelKey: "dashboard.calendar", end: false, icon: "calendar" },
  { to: "/dashboard/mesaje", labelKey: "dashboard.mesaje", end: false, icon: "messageCircle" },
];

const NAV_STAFF = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
  { to: "/dashboard/joburi", labelKey: "dashboard.joburi", end: false, icon: "briefcase" },
  { to: "/dashboard/aplicatii", labelKey: "dashboard.myApplications", end: false, icon: "fileText" },
  { to: "/dashboard/calendar", labelKey: "dashboard.calendar", end: false, icon: "calendar" },
  { to: "/dashboard/mesaje", labelKey: "dashboard.mesaje", end: false, icon: "messageCircle" },
];

const NAV_ADMIN = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
  { to: "/dashboard/joburi", labelKey: "dashboard.adminUsers", end: false, icon: "briefcase" },
  { to: "/dashboard/rapoarte", labelKey: "dashboard.rapoarte", end: false, icon: "barChart" },
  { to: "/dashboard/mesaje", labelKey: "dashboard.mesaje", end: false, icon: "messageCircle" },
  { to: "/dashboard/settings", labelKey: "dashboard.adminSettings", end: false, icon: "settings" },
];

function getNavForRole(role: string | undefined) {
  const r = role?.toLowerCase?.();
  if (r === "admin") return NAV_ADMIN;
  if (r === "staff") return NAV_STAFF;
  return NAV_CUSTOMER;
}

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+373", label: "MD" },
  { code: "+40", label: "RO" },
  { code: "+7", label: "RU" },
  { code: "+1", label: "US/CA" },
  { code: "+44", label: "UK" },
  { code: "+49", label: "DE" },
  { code: "+33", label: "FR" },
  { code: "+39", label: "IT" },
  { code: "+34", label: "ES" },
  { code: "+48", label: "PL" },
  { code: "+380", label: "UA" },
  { code: "+30", label: "GR" },
  { code: "+31", label: "NL" },
  { code: "+32", label: "BE" },
  { code: "+41", label: "CH" },
  { code: "+43", label: "AT" },
  { code: "+36", label: "HU" },
  { code: "+421", label: "SK" },
  { code: "+420", label: "CZ" },
  { code: "+355", label: "AL" },
  { code: "+381", label: "RS" },
  { code: "+359", label: "BG" },
  { code: "+994", label: "AZ" },
  { code: "+995", label: "GE" },
  { code: "+374", label: "AM" },
];

/** Icoană custom: farfurie + buretă/spumă + strălucire (spălare vase, stil referință) */
function DishwasherIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Farfurie (văzută din unghi) */}
      <ellipse cx="12" cy="14" rx="8" ry="3.2" />
      <path d="M4 14v1.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V14" />
      {/* Buretă / spumă pe farfurie */}
      <circle cx="14" cy="11.5" r="3" />
      {/* Strălucire (curățenie) */}
      <path d="M17.5 16.5v1M17.5 16.5v-1M17.5 16.5h1M17.5 16.5h-1" strokeWidth="1.2" />
    </svg>
  );
}

const JOB_ICONS: Record<string, ComponentType<{ className?: string; size?: number }>> = {
  bartender: Wine as ComponentType<{ className?: string; size?: number }>,
  chef: ChefHat as ComponentType<{ className?: string; size?: number }>,
  cleaner: SprayCan as ComponentType<{ className?: string; size?: number }>,
  eventcrew: Users as ComponentType<{ className?: string; size?: number }>,
  grocery: ShoppingCart as ComponentType<{ className?: string; size?: number }>,
  maintenance: Wrench as ComponentType<{ className?: string; size?: number }>,
  receptionist: Phone as ComponentType<{ className?: string; size?: number }>,
  trainingevent: Presentation as ComponentType<{ className?: string; size?: number }>,
  waiter: ConciergeBell as ComponentType<{ className?: string; size?: number }>,
};

function JobTitleIcon({ jobId }: { jobId: string }) {
  if (jobId === "barista") {
    return <Icon iconNode={coffeemaker} className="w-8 h-8 text-primary" size={32} />;
  }
  if (jobId === "dishwasher") {
    return <DishwasherIcon className="w-8 h-8 text-primary" />;
  }
  const JobIcon = JOB_ICONS[jobId] ?? Briefcase;
  return <JobIcon className="w-8 h-8 text-primary" size={32} />;
}

const JOB_TITLE_OPTIONS: { id: string; labelKey: string }[] = [
  { id: "barista", labelKey: "dashboard.jobTitleBarista" },
  { id: "bartender", labelKey: "dashboard.jobTitleBartender" },
  { id: "chef", labelKey: "dashboard.jobTitleChef" },
  { id: "cleaner", labelKey: "dashboard.jobTitleCleaner" },
  { id: "dishwasher", labelKey: "dashboard.jobTitleDishwasher" },
  { id: "eventcrew", labelKey: "dashboard.jobTitleEventCrew" },
  { id: "grocery", labelKey: "dashboard.jobTitleGrocery" },
  { id: "maintenance", labelKey: "dashboard.jobTitleMaintenance" },
  { id: "receptionist", labelKey: "dashboard.jobTitleReceptionist" },
  { id: "trainingevent", labelKey: "dashboard.jobTitleTrainingEvent" },
  { id: "waiter", labelKey: "dashboard.jobTitleWaiter" },
];

export default function DashboardLayout() {
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPostJob, setShowPostJob] = useState(false);
  const [jobSubmitted, setJobSubmitted] = useState(false);
  const [postJobError, setPostJobError] = useState("");
  const [postJobStep, setPostJobStep] = useState<"choose-type" | "how-to-post" | "form">("choose-type");
  const [selectedJobType, setSelectedJobType] = useState<"one-day" | "multi-day" | "full-time" | null>(null);
  const [postMethod, setPostMethod] = useState<"scratch" | "template" | null>(null);
  const [formStartTime, setFormStartTime] = useState("00:00");
  const [formEndTime, setFormEndTime] = useState("00:00");
  const [jobAddress, setJobAddress] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [jobEndDate, setJobEndDate] = useState("");
  const [jobImage, setJobImage] = useState<string | null>(null);
  const [jobTitleSelected, setJobTitleSelected] = useState("");
  const [showJobTitleModal, setShowJobTitleModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [jobDocuments, setJobDocuments] = useState<DocItem[]>([]);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+373");
  const [phoneCountryOpen, setPhoneCountryOpen] = useState(false);
  const phoneCountryRef = useRef<HTMLDivElement>(null);
  const [unpaidBreak, setUnpaidBreak] = useState<"no" | "yes">("no");
  const [unpaidBreakOpen, setUnpaidBreakOpen] = useState(false);
  const unpaidBreakRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRating, setUserRating] = useState<{ average: number; count: number } | null>(null);
  const [jobsAdded, setJobsAdded] = useState<JobRow[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("time2go_jobs_added");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as JobRow[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("time2go_jobs_added", JSON.stringify(jobsAdded));
    } catch {}
  }, [jobsAdded]);
  const [jobsLoadError, setJobsLoadError] = useState(false);
  // Încarcă joburile de pe server (persistate în MySQL – rămân după repornire)
  useEffect(() => {
    const role = user?.role?.toLowerCase?.().trim?.() ?? "";
    if (loading || !user || role !== "customer") return;
    setJobsLoadError(false);
    jobsApi
      .list()
      .then((r) => {
        const list = (r.jobs || []).map((j) => ({
          id: j.id,
          job: j.job,
          location: j.location,
          status: j.status,
          statusClass: j.statusClass ?? "bg-gray-100 text-gray-700",
          date: j.date,
          endDate: j.endDate,
          jobType: j.jobType as JobType | undefined,
          applicationsCount: j.applicationsCount ?? 0,
          startTime: j.startTime,
          endTime: j.endTime,
          peopleNeeded: j.peopleNeeded,
          duration: j.duration,
          estimatedSalary: j.estimatedSalary,
          imageUrl: j.imageUrl,
          postedBy: j.postedBy,
        }));
        setJobsAdded(list);
        try {
          localStorage.setItem("time2go_jobs_added", JSON.stringify(list));
        } catch {
          // cache local pentru când serverul e indisponibil
        }
      })
      .catch(() => setJobsLoadError(true));
  }, [loading, user?.id, user?.role]);
  useEffect(() => {
    if (!user?.id) {
      setUserRating(null);
      return;
    }
    ratingsApi
      .getUserRating(user.id)
      .then((r) => setUserRating({ average: r.average, count: r.count }))
      .catch(() => setUserRating(null));
  }, [user?.id]);

  // Check if staff user needs onboarding
  useEffect(() => {
    if (loading || !user || user.role?.toLowerCase() !== "staff") return;
    
    experiencesApi
      .checkOnboarding()
      .then((result) => {
        if (result.needsOnboarding && !location.pathname.includes("/onboarding")) {
          navigate("/onboarding", { replace: true });
        }
      })
      .catch(() => {
        // If check fails, allow access (don't block dashboard)
      });
  }, [loading, user?.id, user?.role, location.pathname, navigate]);
  const [availableToWork, setAvailableToWorkState] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("dashboard_availableToWork") !== "false";
    } catch {
      return true;
    }
  });
  const setAvailableToWork = (v: boolean) => {
    setAvailableToWorkState(v);
    try {
      localStorage.setItem("dashboard_availableToWork", String(v));
    } catch {}
  };

  const addJob = async (job: Omit<JobRow, "id">): Promise<boolean> => {
    const payload = {
      job: job.job,
      location: job.location,
      status: job.status,
      statusClass: job.statusClass,
      date: job.date,
      endDate: job.endDate,
      jobType: job.jobType,
      startTime: job.startTime,
      endTime: job.endTime,
      peopleNeeded: job.peopleNeeded,
      duration: job.duration,
      estimatedSalary: job.estimatedSalary,
      imageUrl: job.imageUrl ?? undefined,
    };
    try {
      const created = await jobsApi.create(payload);
        const newJob: JobRow = {
          id: created.id,
          job: created.job,
          location: created.location,
          status: created.status,
          statusClass: created.statusClass ?? "bg-gray-100 text-gray-700",
          date: created.date,
          endDate: created.endDate,
          jobType: created.jobType as JobType | undefined,
          applicationsCount: created.applicationsCount ?? 0,
          startTime: created.startTime,
          endTime: created.endTime,
          peopleNeeded: created.peopleNeeded,
          duration: created.duration,
          estimatedSalary: created.estimatedSalary,
          imageUrl: created.imageUrl,
          postedBy: created.postedBy,
        };
        setJobsAdded((prev) => [...prev, newJob]);
      setJobsLoadError(false);
      return true;
    } catch (err) {
      console.error("Failed to persist job on server:", err);
      setJobsLoadError(true);
      return false;
    }
  };
  const removeJob = (id: string) => {
    jobsApi
      .delete(id)
      .then(() => setJobsAdded((prev) => prev.filter((j) => j.id !== id)))
      .catch(() => {
        setJobsAdded((prev) => prev.filter((j) => j.id !== id));
        try {
          const raw = localStorage.getItem(PUBLIC_JOBS_KEY);
          const list: JobRow[] = raw ? (JSON.parse(raw) as JobRow[]) : [];
          if (Array.isArray(list)) {
            const next = list.filter((j) => j.id !== id);
            localStorage.setItem(PUBLIC_JOBS_KEY, JSON.stringify(next));
          }
          const appRaw = localStorage.getItem(APPLICATIONS_KEY);
          const app: Record<string, unknown> = appRaw ? JSON.parse(appRaw) : {};
          if (app[id]) {
            delete app[id];
            localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(app));
          }
        } catch {}
      });
  };

  useEffect(() => {
    if (!phoneCountryOpen) return;
    const close = (e: MouseEvent) => {
      if (phoneCountryRef.current && !phoneCountryRef.current.contains(e.target as Node)) setPhoneCountryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [phoneCountryOpen]);

  useEffect(() => {
    if (!unpaidBreakOpen) return;
    const close = (e: MouseEvent) => {
      if (unpaidBreakRef.current && !unpaidBreakRef.current.contains(e.target as Node)) setUnpaidBreakOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [unpaidBreakOpen]);

  if (loading) return <div className="container mx-auto px-4 py-16 text-center">{t("dashboard.loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  const userRole = user.role?.toLowerCase?.().trim?.() ?? "";
  const isCustomer = userRole === "customer";

  const closeSidebar = () => setSidebarOpen(false);

  // Keep page start consistent between dashboard sections.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Mobile header – vizibil doar pe ecrane mici */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Meniu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <img src="/LogoTime2Go.png" alt="Time2Go" className="h-7 w-auto" />
          <span className="font-bold text-gray-900 truncate">Time2Go</span>
        </div>
        {isCustomer && (
          <button
            type="button"
            onClick={() => { setShowPostJob(true); setPostJobError(""); closeSidebar(); }}
            className="p-2 rounded-xl bg-primary text-white font-semibold"
            aria-label={t("dashboard.postJob")}
          >
            <span className="text-lg leading-none">+</span>
          </button>
        )}
      </header>

      {/* Overlay pentru meniu mobil */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* Sidebar – pe desktop fix, pe mobil drawer peste overlay */}
      <aside
        className={`
          w-64 min-w-64 max-w-64 h-screen md:h-screen md:self-start bg-white border-r border-secondary/10 flex flex-col shadow-soft
          fixed top-0 left-0 z-50 md:sticky md:top-0 md:left-auto md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        <div className="p-4 border-b border-secondary/10 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img src="/LogoTime2Go.png" alt="Time2Go" className="h-8 w-auto" />
            <span className="font-bold text-gray-900">Time2Go</span>
          </div>
          <button type="button" onClick={closeSidebar} className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Închide">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {isCustomer && (
          <button
            type="button"
            onClick={() => { setShowPostJob(true); setPostJobError(""); closeSidebar(); }}
            className="m-4 py-3 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-dark shadow-soft transition-all flex items-center justify-center gap-2 flex-shrink-0"
          >
            <span>+</span>
            {t("dashboard.postJob")}
          </button>
        )}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 min-h-0">
          {getNavForRole(user.role).map(({ to, labelKey, end, icon }) => {
            const IconComponent = icon ? NAV_ICONS[icon] : null;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                {IconComponent && (
                  <IconComponent className="w-5 h-5 flex-shrink-0" size={20} />
                )}
                {t(labelKey)}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200 bg-gradient-to-b from-gray-50/80 to-white flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-shrink-0">
              <img
                src={user?.avatar || "/Illustration/AvatarWhiteGuy.png"}
                alt=""
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-md"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  availableToWork ? "bg-green-500" : "bg-red-500"
                }`}
                title={availableToWork ? t("dashboard.availableToWork") : t("dashboard.unavailable")}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{user.name}</p>
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary capitalize">
                {user.role?.toLowerCase?.() === "admin" ? t("dashboard.roleAdmin") : user.role?.toLowerCase?.() === "customer" ? t("dashboard.roleCustomer") : t("dashboard.roleStaff")}
              </span>
              <div className="flex items-center gap-1 mt-1">
                <StarRating value={userRating?.average ?? 0} size={14} />
                {userRating && userRating.count > 0 && (
                  <span className="text-xs text-gray-500">({userRating.count})</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { navigate("/dashboard/settings"); closeSidebar(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t("dashboard.profile")}
          </button>
          <button
            type="button"
            onClick={() => { logout(); closeSidebar(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200/80 transition-colors mt-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t("dashboard.logout")}
          </button>
        </div>
      </aside>

      <main key={location.pathname} className="flex-1 pt-14 md:pt-0 p-4 md:p-8 page-enter min-w-0">
        <DashboardContext.Provider value={{ openPostJobModal: () => setShowPostJob(true), jobsAdded, addJob, removeJob, availableToWork, setAvailableToWork, jobsLoadError, userRating: userRating ?? null }}>
          <Outlet />
        </DashboardContext.Provider>
      </main>

      {/* Modal Posteaza un job – doar pentru Customer */}
      {isCustomer && showPostJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
          onClick={() => {
            setShowPostJob(false);
            setPostJobStep("choose-type");
            setSelectedJobType(null);
            setPostMethod(null);
            setPostJobError("");
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden modal-content-enter"
            onClick={(e) => e.stopPropagation()}
          >
            {jobSubmitted ? (
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t("dashboard.jobSaved")}</h3>
                <p className="text-gray-600 mb-4">{t("dashboard.jobSavedDesc")}</p>
                <button
                  type="button"
                  onClick={() => { setJobSubmitted(false); setShowPostJob(false); setPostJobStep("choose-type"); setSelectedJobType(null); }}
                  className="w-full py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark"
                >
                  {t("dashboard.close")}
                </button>
              </div>
            ) : postJobStep === "choose-type" ? (
              <>
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">{t("dashboard.addJobTitle")}</h3>
                <button
                  type="button"
                  onClick={() => { setShowPostJob(false); setPostJobStep("choose-type"); setSelectedJobType(null); setPostMethod(null); setPostJobError(""); }}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  aria-label={t("dashboard.close")}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                </div>
                <div className="modal-step-enter">
                <div className="p-4 sm:p-6 space-y-3">
                  {[
                    { id: "one-day" as const, labelKey: "dashboard.oneDayJob", descKey: "dashboard.oneDayJobDesc", icon: "calendar" },
                    { id: "multi-day" as const, labelKey: "dashboard.multiDayJob", descKey: "dashboard.multiDayJobDesc", icon: "multi" },
                    { id: "full-time" as const, labelKey: "dashboard.fullTimeRecruitment", descKey: "dashboard.fullTimeRecruitmentDesc", icon: "lock" },
                  ].map(({ id, labelKey, descKey, icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedJobType(id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        selectedJobType === id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        {icon === "calendar" && (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                        {icon === "multi" && (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        )}
                        {icon === "lock" && (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{t(labelKey)}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{t(descKey)}</p>
                      </div>
                      {selectedJobType === id && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 p-4 sm:p-6 pt-0 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setShowPostJob(false); setPostJobStep("choose-type"); setSelectedJobType(null); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t("dashboard.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedJobType}
                    onClick={() => selectedJobType && setPostJobStep("how-to-post")}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("dashboard.next")}
                  </button>
                </div>
                </div>
              </>
            ) : postJobStep === "how-to-post" ? (
              <>
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">{t("dashboard.addJobTitle")}</h3>
                  <button
                    type="button"
                    onClick={() => { setShowPostJob(false); setPostJobStep("choose-type"); setSelectedJobType(null); setPostMethod(null); }}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    aria-label={t("dashboard.close")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="modal-step-enter">
                <div className="p-4 sm:p-6 modal-step-stagger">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("dashboard.howToPostTitle")}</h4>
                  <div className="space-y-3 mb-6">
                    <button
                      type="button"
                      onClick={() => setPostMethod("scratch")}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        postMethod === "scratch" ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{t("dashboard.startFromScratch")}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{t("dashboard.startFromScratchDesc")}</p>
                      </div>
                      {postMethod === "scratch" && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </span>
                      )}
                    </button>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">{t("dashboard.useTemplateTitle")}</h4>
                  <p className="text-sm text-gray-500 mb-4">{t("dashboard.noTemplatesYet")}</p>
                </div>
                <div className="flex gap-3 p-4 sm:p-6 pt-0 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setPostJobStep("choose-type")}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t("dashboard.back")}
                  </button>
                  <button
                    type="button"
                    disabled={postMethod !== "scratch"}
                    onClick={() => postMethod === "scratch" && setPostJobStep("form")}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("dashboard.next")}
                  </button>
                </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">{t("dashboard.postJobTitle")}</h3>
                  <button
                    type="button"
                    onClick={() => { setShowPostJob(false); setPostJobStep("choose-type"); setSelectedJobType(null); setPostMethod(null); setPostJobError(""); }}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={t("dashboard.close")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPostJobError("");
                    const form = e.currentTarget;
                    const jobTitle = jobTitleSelected ? t(JOB_TITLE_OPTIONS.find((o) => o.id === jobTitleSelected)?.labelKey ?? "") : (form.elements.namedItem("jobTitle") as HTMLInputElement)?.value?.trim();
                    const address = jobAddress.trim() || (form.elements.namedItem("address") as HTMLInputElement)?.value?.trim();
                    const dateVal = jobDate || (form.elements.namedItem("jobDate") as HTMLInputElement)?.value?.trim();
                    const endDateVal = jobEndDate || (form.elements.namedItem("jobEndDate") as HTMLInputElement)?.value?.trim();
                    const peopleVal = (form.elements.namedItem("numberOfStaff") as HTMLInputElement)?.value?.trim();
                    const salaryVal = (form.elements.namedItem("estimatedSalary") as HTMLInputElement)?.value?.trim();
                    const toYmdToday = () => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    };
                    const isYmd = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
                    const normalizedDate = isYmd(dateVal) ? dateVal : toYmdToday();
                    const normalizedEndDate = isYmd(endDateVal) ? endDateVal : undefined;
                    if (jobTitle && address && selectedJobType) {
                      const ok = await addJob({
                        job: jobTitle,
                        location: address,
                        status: "Draft",
                        statusClass: "bg-gray-100 text-gray-700",
                        date: normalizedDate,
                        endDate: normalizedEndDate,
                        jobType: selectedJobType,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        peopleNeeded: peopleVal || undefined,
                        estimatedSalary: salaryVal || undefined,
                        imageUrl: jobImage || undefined,
                      });
                      if (!ok) {
                        setPostJobError(t("dashboard.postJobFailed", "Nu am putut salva jobul. Verifică backend-ul și încearcă din nou."));
                        return;
                      }
                    } else {
                      setPostJobError(t("dashboard.postJobInvalid", "Completează câmpurile obligatorii."));
                      return;
                    }
                    setJobSubmitted(true);
                    setSelectedJobType(null);
                    setPostJobStep("choose-type");
                    setPostMethod(null);
                    setFormStartTime("00:00");
                    setFormEndTime("00:00");
                    setJobAddress("");
                    setJobDate("");
                    setJobEndDate("");
                    setJobImage(null);
                    setJobDocuments([]);
                    setPhoneCountryCode("+373");
                    setJobTitleSelected("");
                    setUnpaidBreak("no");
                    setUnpaidBreakOpen(false);
                    setPostJobError("");
                  }}
                  className="p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-12rem)]"
                >
                  <div className="modal-step-enter space-y-6">
                  {postJobError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {postJobError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPostJobStep("how-to-post")}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    {t("dashboard.back")}
                  </button>

                  <section>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("dashboard.jobDetails")}</h4>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.eventName")}</span>
                        <input
                          name="eventName"
                          type="text"
                          placeholder={t("dashboard.eventNamePlaceholder")}
                          className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                        />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block min-w-0">
                          <span className="text-sm font-medium text-gray-700">{t("dashboard.numberOfStaff")}</span>
                          <input
                            name="numberOfStaff"
                            type="text"
                            placeholder={t("dashboard.numberOfStaffPlaceholder")}
                            className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          />
                        </label>
                        <label className="block min-w-0">
                          <span className="text-sm font-medium text-gray-700">{t("dashboard.estimatedSalary")}</span>
                          <input
                            name="estimatedSalary"
                            type="text"
                            placeholder={t("dashboard.estimatedSalaryPlaceholder")}
                            className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.jobImage")}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:font-medium"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || !file.type.startsWith("image/")) return;
                            const reader = new FileReader();
                            reader.onload = () => setJobImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                        {jobImage && (
                          <div className="mt-2 relative inline-block">
                            <img src={jobImage} alt="" className="h-24 w-auto rounded-xl border border-gray-200 object-cover" />
                            <button type="button" onClick={() => setJobImage(null)} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-sm leading-none" aria-label={t("dashboard.removeImage")}>×</button>
                          </div>
                        )}
                      </label>
                      <label className="block min-w-0">
                          <span className="text-sm font-medium text-gray-700">{t("dashboard.staffContactPhone")}</span>
                          <div className="mt-1 flex rounded-xl border border-gray-200 bg-white overflow-visible focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-colors">
                            <div ref={phoneCountryRef} className="relative shrink-0">
                              <input type="hidden" name="phoneCountryCode" value={phoneCountryCode} readOnly />
                              <button
                                type="button"
                                onClick={() => setPhoneCountryOpen((v) => !v)}
                                className="h-full flex items-center gap-1.5 text-gray-700 pl-4 pr-2 py-2.5 border-r border-gray-200 bg-gray-50/80 hover:bg-gray-100/80 transition-colors rounded-l-xl min-h-[42px]"
                                aria-label={t("dashboard.countryCode")}
                                aria-expanded={phoneCountryOpen}
                                aria-haspopup="listbox"
                              >
                                <span className="text-sm font-medium whitespace-nowrap">
                                  {phoneCountryCode} {COUNTRY_CODES.find((c) => c.code === phoneCountryCode)?.label ?? ""}
                                </span>
                                <svg className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${phoneCountryOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              {phoneCountryOpen && (
                                <div
                                  className="absolute left-0 top-full mt-0.5 z-50 min-w-[10rem] max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1 dropdown-enter origin-top"
                                  role="listbox"
                                >
                                  {COUNTRY_CODES.map(({ code, label }) => (
                                    <button
                                      key={code}
                                      type="button"
                                      role="option"
                                      aria-selected={phoneCountryCode === code}
                                      onClick={() => { setPhoneCountryCode(code); setPhoneCountryOpen(false); }}
                                      className={`block w-full text-left px-3 py-2.5 text-sm font-medium transition-colors ${phoneCountryCode === code ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"}`}
                                    >
                                      {code} {label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input
                              name="staffPhone"
                              type="tel"
                              placeholder="(79) 14-37-02"
                              className="flex-1 min-w-[16rem] sm:min-w-[20rem] w-full px-4 py-2.5 border-0 bg-transparent focus:ring-0 rounded-r-xl text-gray-900 placeholder:text-gray-400"
                            />
                          </div>
                        </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.jobTitleLabel")}</span>
                        <input
                          name="jobTitle"
                          type="hidden"
                          value={jobTitleSelected ? t(JOB_TITLE_OPTIONS.find((o) => o.id === jobTitleSelected)?.labelKey ?? "") : ""}
                          required
                          readOnly
                        />
                        <button
                          type="button"
                          onClick={() => setShowJobTitleModal(true)}
                          className="mt-1 w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-left hover:border-primary/40 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                        >
                          <span className={jobTitleSelected ? "text-gray-900 font-medium" : "text-gray-400"}>
                            {jobTitleSelected ? t(JOB_TITLE_OPTIONS.find((o) => o.id === jobTitleSelected)?.labelKey ?? "") : t("dashboard.jobTitlePlaceholder")}
                          </span>
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.description")}</span>
                        <textarea
                          name="description"
                          rows={3}
                          placeholder={t("dashboard.descriptionPlaceholder")}
                          className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary resize-none"
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("dashboard.additionalDocuments")}</h4>
                    <p className="text-sm text-gray-500 mb-2">{t("dashboard.addDocumentsHint")}</p>
                    <button
                      type="button"
                      onClick={() => setShowDocumentsModal(true)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      {t("dashboard.addDocuments")}
                    </button>
                    {jobDocuments.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {jobDocuments.map((doc) => (
                          <li key={doc.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-red-600">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>
                            </span>
                            <span className="truncate flex-1">{doc.file.name}</span>
                            <button
                              type="button"
                              onClick={() => setJobDocuments((prev) => prev.filter((d) => d.id !== doc.id))}
                              className="text-gray-400 hover:text-red-600 p-1"
                              aria-label={t("dashboard.remove")}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("dashboard.timeAndDate")}</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <TimePicker
                          name="startTime"
                          value={formStartTime}
                          onChange={setFormStartTime}
                          label={t("dashboard.startTime")}
                        />
                        <TimePicker
                          name="endTime"
                          value={formEndTime}
                          onChange={setFormEndTime}
                          label={t("dashboard.endTime")}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <DatePicker
                          name="jobDate"
                          value={jobDate}
                          onChange={setJobDate}
                          label={t("dashboard.dateFrom")}
                        />
                        <DatePicker
                          name="jobEndDate"
                          value={jobEndDate}
                          onChange={setJobEndDate}
                          label={t("dashboard.dateTo")}
                        />
                      </div>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 mb-1 block">{t("dashboard.unpaidBreak")}</span>
                        <input type="hidden" name="unpaidBreak" value={unpaidBreak} />
                        <div ref={unpaidBreakRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setUnpaidBreakOpen((v) => !v)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-left text-sm font-medium text-gray-800 shadow-sm hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors inline-flex items-center justify-between"
                            aria-haspopup="listbox"
                            aria-expanded={unpaidBreakOpen}
                          >
                            <span>{unpaidBreak === "yes" ? t("dashboard.unpaidBreakYes") : t("dashboard.unpaidBreakNo")}</span>
                            <svg className={`w-4 h-4 text-gray-500 transition-transform ${unpaidBreakOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {unpaidBreakOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 bg-white shadow-lg p-1">
                              {[
                                { value: "no" as const, label: t("dashboard.unpaidBreakNo") },
                                { value: "yes" as const, label: t("dashboard.unpaidBreakYes") },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setUnpaidBreak(opt.value);
                                    setUnpaidBreakOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                                    unpaidBreak === opt.value ? "bg-primary text-white" : "text-gray-700 hover:bg-primary/10"
                                  }`}
                                  role="option"
                                  aria-selected={unpaidBreak === opt.value}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                      <div>
                        <span className="text-sm font-medium text-gray-700 mb-1 block">{t("dashboard.address")}</span>
                        <input type="hidden" name="address" value={jobAddress} readOnly />
                        <button
                          type="button"
                          onClick={() => setShowAddressModal(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors min-h-[52px]"
                        >
                          {jobAddress ? (
                            <span className="truncate text-left flex-1 font-medium text-gray-900">{jobAddress}</span>
                          ) : (
                            <>
                              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                              <span>{t("dashboard.addAddress")}</span>
                            </>
                          )}
                        </button>
                        {jobAddress && (
                          <p className="mt-1 text-xs text-gray-500">{t("dashboard.clickToChangeAddress")}</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setShowPostJob(false); setPostJobStep("choose-type"); setSelectedJobType(null); setPostMethod(null); }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t("dashboard.cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={!jobAddress.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("dashboard.postJob")}
                    </button>
                  </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {isCustomer && (
        <AddressPickerModal
          open={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onConfirm={(address) => { setJobAddress(address); setShowAddressModal(false); }}
          initialAddress={jobAddress}
        />
      )}

      {isCustomer && (
        <DocumentsModal
          open={showDocumentsModal}
          onClose={() => setShowDocumentsModal(false)}
          onAttach={(files) => {
                setJobDocuments((prev) => {
                  const ids = new Set(prev.map((d) => d.id));
                  const newOnes = files.filter((f) => !ids.has(f.id));
                  return [...prev, ...newOnes];
                });
                setShowDocumentsModal(false);
              }}
          existing={jobDocuments}
        />
      )}

      {isCustomer && showJobTitleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter" onClick={() => setShowJobTitleModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden modal-content-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{t("dashboard.addJobTitle")}</h3>
              <button type="button" onClick={() => setShowJobTitleModal(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label={t("dashboard.close")}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <p className="text-sm font-semibold text-gray-900 mb-1">{t("dashboard.selectJobTitle")}</p>
              <p className="text-sm text-gray-500 mb-4">{t("dashboard.selectJobTitleDesc")}</p>
              <div className="grid grid-cols-2 gap-3">
                {JOB_TITLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setJobTitleSelected(opt.id); setShowJobTitleModal(false); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${jobTitleSelected === opt.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/30 hover:bg-gray-50"}`}
                  >
                    <JobTitleIcon jobId={opt.id} />
                    <span className="text-sm font-medium text-gray-900">{t(opt.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
