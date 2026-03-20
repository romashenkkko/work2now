import { useState, createContext, useRef, useEffect, useCallback, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Star,
  Settings,
  UtensilsCrossed,
  CreditCard,
  Trash2,
} from "lucide-react";
import { coffeemaker } from "@lucide/lab";
import { useAuth } from "../hooks/useAuth";
import { getBusinessTotal, roundMoney } from "../utils/salary";
import { jobsApi, ratingsApi, experiencesApi, type JobCategory } from "../api/client";
import TimePicker from "../components/TimePicker";
import StarRating from "../components/StarRating";
import DatePicker from "../components/DatePicker";
import AddressPickerModal from "../components/AddressPickerModal";
import DocumentsModal, { type DocItem } from "../components/DocumentsModal";
import StaffProfileModal from "../components/StaffProfileModal";

export type JobType = "one-day" | "multi-day" | "full-time";
export type JobRow = {
  id?: string;
  job: string; // Custom title (max 30 chars)
  jobCategoryTitle?: string; // Category name from job_categories
  location: string;
  status: string;
  statusClass: string;
  date: string;
  endDate?: string;
  jobType?: JobType;
  applicationsCount?: number;
  acceptedCount?: number;
  startTime?: string;
  endTime?: string;
  peopleNeeded?: string;
  duration?: string;
  estimatedSalary?: string;
  imageUrl?: string;
  postedBy?: string;
  jobCategoryCode?: number;
  hourlyRateBase?: number;
  postedById?: string;
  postedByRole?: string;
  postedByAvatar?: string;
  /** Locație pentru check-in (geo-fencing): lat, lng, raza în m */
  checkInLat?: number;
  checkInLng?: number;
  checkInRadiusM?: number;
  /** Promovare Booster: job afișat prioritar */
  isPromoted?: boolean;
};

export type JobTemplate = {
  id: string;
  categoryCode: number;
  title: string;
  jobType: JobType;
  jobTitle: string;
  eventName: string;
  staffCount: string;
  hourlyRateBase: string;
  startTime: string;
  endTime: string;
  unpaidBreak: "no" | "yes";
  raionId?: number | null;
  localitate?: string | null;
  checkInGeo?: { lat: number; lng: number; radiusM: number } | null;
  address?: string | null;
  staffPhone?: string | null;
  staffPhoneCountry?: string | null;
  description?: string | null;
};

export type Application = {
  id: string;
  jobId: string;
  staffId: string;
  staffName: string;
  staffEmail?: string;
  staffAvatar?: string;
  status: "pending" | "accepted" | "refused";
  checkedInAt?: string;
  checkedOutAt?: string;
  /** When set, business confirmed job finished; application moves to history (hidden from active list). */
  businessConfirmedAt?: string;
  /** Explicit boolean for business confirmation (true = confirmed by business). */
  isBusinessConfirmed?: boolean;
  workSessions?: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];
  ratingScore?: number;
};

const APPLICATIONS_KEY = "work2now_applications";
const PUBLIC_JOBS_KEY = "work2now_public_jobs";

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
  refreshJobs: () => void;
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
  review: Star as ComponentType<{ className?: string; size?: number }>,
  settings: Settings as ComponentType<{ className?: string; size?: number }>,
  creditCard: CreditCard as ComponentType<{ className?: string; size?: number }>,
};

const NAV_CUSTOMER = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
  { to: "/dashboard/joburi", labelKey: "dashboard.joburi", end: false, icon: "briefcase" },
  { to: "/dashboard/aplicatii", labelKey: "dashboard.aplicatii", end: false, icon: "fileText" },
  { to: "/dashboard/rapoarte", labelKey: "dashboard.rapoarte", end: false, icon: "barChart" },
];

const NAV_STAFF = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
  { to: "/dashboard/joburi", labelKey: "dashboard.joburi", end: false, icon: "briefcase" },
  { to: "/dashboard/aplicatii", labelKey: "dashboard.myApplications", end: false, icon: "fileText" },
];

const NAV_ADMIN = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
  { to: "/dashboard/joburi", labelKey: "dashboard.adminUsers", end: false, icon: "briefcase" },
  { to: "/dashboard/rapoarte", labelKey: "dashboard.rapoarte", end: false, icon: "barChart" },
  { to: "/dashboard/settings", labelKey: "dashboard.adminSettings", end: false, icon: "settings" },
];

const NAV_SUPPORT = [
  { to: "/dashboard", labelKey: "dashboard.home", end: true, icon: "home" },
];

function getNavForRole(role: string | undefined) {
  const r = role?.toLowerCase?.();
  if (r === "admin") return NAV_ADMIN;
  if (r === "staff") return NAV_STAFF;
  if (r === "support") return NAV_SUPPORT;
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

/** Iconițe joburi – ca în ecranul "Selectează titlul jobului": Barista (cafetieră), Barman (pahar), Bucătar (șef), Curățenie (spray), Spălător vase (ustensile), Echipă evenimente (echipă), Lucrător magazin (cart), Întreținere (cheie), Recepționer (telefon), Eveniment training (prezentare), Ospătar (cloche) */
const JOB_ICONS: Record<string, ComponentType<{ className?: string; size?: number }>> = {
  bartender: Wine as ComponentType<{ className?: string; size?: number }>,
  chef: ChefHat as ComponentType<{ className?: string; size?: number }>,
  cleaner: SprayCan as ComponentType<{ className?: string; size?: number }>,
  dishwasher: UtensilsCrossed as ComponentType<{ className?: string; size?: number }>,
  eventcrew: Users as ComponentType<{ className?: string; size?: number }>,
  grocery: ShoppingCart as ComponentType<{ className?: string; size?: number }>,
  maintenance: Wrench as ComponentType<{ className?: string; size?: number }>,
  receptionist: Phone as ComponentType<{ className?: string; size?: number }>,
  trainingevent: Presentation as ComponentType<{ className?: string; size?: number }>,
  waiter: ConciergeBell as ComponentType<{ className?: string; size?: number }>,
};

export function JobTitleIcon({ jobId, className = "w-8 h-8 text-primary shrink-0", size = 32 }: { jobId: string; className?: string; size?: number }) {
  const iconProps = { className, size };
  if (jobId === "barista") {
    return <Icon iconNode={coffeemaker} {...iconProps} />;
  }
  const JobIcon = JOB_ICONS[jobId] ?? Briefcase;
  return <JobIcon {...iconProps} />;
}

export { JOB_TITLE_OPTIONS };

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

const JOB_CATEGORY_LABEL_KEYS: Record<number, string> = {
  1: "dashboard.jobCategoryBarback",
  2: "dashboard.jobTitleBarista",
  3: "dashboard.jobTitleBartender",
  4: "dashboard.jobCategoryCashier",
  5: "dashboard.jobTitleChef",
  6: "dashboard.jobCategoryChefHead",
  7: "dashboard.jobCategoryChefPastry",
  8: "dashboard.jobCategoryChefSous",
  9: "dashboard.jobCategoryChefSushi",
  10: "dashboard.jobTitleCleaner",
  11: "dashboard.jobCategoryCocktailBartender",
  12: "dashboard.jobTitleDishwasher",
  13: "dashboard.jobTitleEventCrew",
  14: "dashboard.jobTitleGrocery",
  15: "dashboard.jobCategoryHeadWaiter",
  16: "dashboard.jobCategoryHousekeeper",
  17: "dashboard.jobTitleMaintenance",
  18: "dashboard.jobCategoryPizzaiolo",
  19: "dashboard.jobTitleReceptionist",
  20: "dashboard.jobCategorySommelier",
  21: "dashboard.jobCategoryAppTester",
  22: "dashboard.jobTitleWaiter",
};

export default function DashboardLayout() {
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPostJob, setShowPostJob] = useState(false);
  const [jobSubmitted, setJobSubmitted] = useState(false);
  const [postJobError, setPostJobError] = useState("");
  const [postJobFieldErrors, setPostJobFieldErrors] = useState<{
    hourlyRateBase?: string;
    jobCategoryCode?: string;
    raionId?: string;
    localitate?: string;
  }>({});
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [selectedJobCategory, setSelectedJobCategory] = useState<number | null>(null);
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [calculatedSalary, setCalculatedSalary] = useState<number | null>(null);
  
  const [postJobStep, setPostJobStep] = useState<"choose-type" | "how-to-post" | "form">("choose-type");
  const [selectedJobType, setSelectedJobType] = useState<"one-day" | "multi-day" | "full-time" | null>(null);
  const [postMethod, setPostMethod] = useState<"scratch" | "template" | null>(null);
  const [formStartTime, setFormStartTime] = useState("00:00");
  const [formEndTime, setFormEndTime] = useState("00:00");
  const [jobAddress, setJobAddress] = useState("");
  const [jobCheckInGeo, setJobCheckInGeo] = useState<{ lat: number; lng: number; radiusM: number } | null>(null);
  const [selectedRaionId, setSelectedRaionId] = useState<number | null>(null);
  const [raionSearch, setRaionSearch] = useState("");
  const [raioane, setRaioane] = useState<Array<{ id: number; name: string; type: string }>>([]);
  const [raionDropdownOpen, setRaionDropdownOpen] = useState(false);
  const raionDropdownRef = useRef<HTMLDivElement>(null);
  const [localitate, setLocalitate] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [jobEndDate, setJobEndDate] = useState("");
  const [jobImage, setJobImage] = useState<string | null>(null);
  const [, setJobImageName] = useState("");
  const [jobTitleSelected, setJobTitleSelected] = useState("");
  // Controlled inputs for job title/event name so templates can be applied before the form renders
  const [jobTitleDraft, setJobTitleDraft] = useState("");
  const [eventNameDraft, setEventNameDraft] = useState("");
  const [showJobTitleModal, setShowJobTitleModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [jobDocuments, setJobDocuments] = useState<DocItem[]>([]);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+373");
  const [phoneCountryOpen, setPhoneCountryOpen] = useState(false);
  const [staffPhoneNumber, setStaffPhoneNumber] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [templateSavedFeedback, setTemplateSavedFeedback] = useState(false);

  const getLocalizedJobCategory = useCallback(
    (category: Pick<JobCategory, "code" | "title">) =>
      t(JOB_CATEGORY_LABEL_KEYS[category.code] ?? "", category.title),
    [t]
  );
  const phoneCountryRef = useRef<HTMLDivElement>(null);
  const [staffCountSelect, setStaffCountSelect] = useState("1");
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const [salaryDropdownOpen, setSalaryDropdownOpen] = useState(false);
  const salaryDropdownRef = useRef<HTMLDivElement>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [unpaidBreak, setUnpaidBreak] = useState<"no" | "yes">("no");
  const [unpaidBreakOpen, setUnpaidBreakOpen] = useState(false);
  const unpaidBreakRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [deleteJobConfirmId, setDeleteJobConfirmId] = useState<string | null>(null);
  const [deleteTemplateConfirmId, setDeleteTemplateConfirmId] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<{ average: number; count: number } | null>(null);

  // Job templates (stored locally for the current user)
  const jobTemplatesStorageKey = user?.id ? `work2now_job_templates_customer_${user.id}` : "work2now_job_templates_customer_anon";
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [showTemplateSavePanel, setShowTemplateSavePanel] = useState(false);
  const [showTemplateCreateModal, setShowTemplateCreateModal] = useState(false);
  const [templateAction, setTemplateAction] = useState<"use" | "create">("use");
  const [templateSaveTitle, setTemplateSaveTitle] = useState("");
  const [templateSaveError, setTemplateSaveError] = useState<string>("");

  // (Controlled inputs) - kept without refs so templates can be applied before form mounts.

  // Drafts used only inside the "create template" modal,
  // to avoid pre-filling ("apply") the job-posting form.
  const [tplCreateJobTitle, setTplCreateJobTitle] = useState("");
  const [tplCreateEventName, setTplCreateEventName] = useState("");
  const [tplCreateHourlyRate, setTplCreateHourlyRate] = useState("");
  const [tplCreateStaffCount, setTplCreateStaffCount] = useState("1");
  const [tplCreateStartTime, setTplCreateStartTime] = useState("00:00");
  const [tplCreateEndTime, setTplCreateEndTime] = useState("00:00");
  const [tplCreateUnpaidBreak, setTplCreateUnpaidBreak] = useState<"no" | "yes">("no");

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);
  const [jobsAdded, setJobsAdded] = useState<JobRow[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("work2now_jobs_added");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as JobRow[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("work2now_jobs_added", JSON.stringify(jobsAdded));
    } catch {}
  }, [jobsAdded]);
  useEffect(() => {
    if (selectedJobType === "one-day") setJobEndDate("");
  }, [selectedJobType]);
  const [jobsLoadError, setJobsLoadError] = useState(false);
  const fetchJobsForCustomer = useCallback(() => {
    const role = user?.role?.toLowerCase?.().trim?.() ?? "";
    if (!user || role !== "customer") return;
    setJobsLoadError(false);
    jobsApi
      .list()
      .then((r) => {
        const list = (r.jobs || []).map((j) => ({
          id: j.id,
          job: j.job,
          jobCategoryTitle: (j as any).jobCategoryTitle,
          location: j.location,
          status: j.status,
          statusClass: j.statusClass ?? "bg-gray-100 text-gray-700",
          date: j.date,
          endDate: j.endDate,
          jobType: j.jobType as JobType | undefined,
          applicationsCount: j.applicationsCount ?? 0,
          acceptedCount: j.acceptedCount ?? 0,
          startTime: j.startTime,
          endTime: j.endTime,
          peopleNeeded: j.peopleNeeded,
          duration: j.duration,
          estimatedSalary: j.estimatedSalary,
          imageUrl: j.imageUrl,
          postedBy: j.postedBy,
          postedById: j.postedById,
          postedByRole: j.postedByRole,
          postedByAvatar: j.postedByAvatar,
          jobCategoryCode: (j as any).jobCategoryCode,
          hourlyRateBase: (j as any).hourlyRateBase,
        }));
        setJobsAdded(list);
        try {
          localStorage.setItem("work2now_jobs_added", JSON.stringify(list));
        } catch {
          // cache local pentru când serverul e indisponibil
        }
      })
      .catch(() => setJobsLoadError(true));
  }, [user?.id, user?.role]);
  // Încarcă joburile de pe server (persistate în MySQL – rămân după repornire)
  useEffect(() => {
    const role = user?.role?.toLowerCase?.().trim?.() ?? "";
    if (loading || !user || role !== "customer") return;
    fetchJobsForCustomer();
  }, [loading, user?.id, user?.role, fetchJobsForCustomer]);
  const MY_RATING_CACHE_KEY = "work2now_my_rating";
  useEffect(() => {
    if (!user?.id) {
      setUserRating(null);
      return;
    }
    const uid = String(user.id);
    ratingsApi
      .getUserRating(user.id)
      .then((r) => {
        const data = { average: r.average, count: r.count, userId: uid };
        setUserRating({ average: data.average, count: data.count });
        try {
          localStorage.setItem(MY_RATING_CACHE_KEY, JSON.stringify(data));
        } catch {}
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(MY_RATING_CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw) as { average: number; count: number; userId?: string };
            if (cached && String(cached.userId) === uid && (cached.count ?? 0) > 0) {
              setUserRating({ average: cached.average, count: cached.count });
              return;
            }
          }
        } catch {}
        setUserRating(null);
      });
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

  // Fetch job categories
  useEffect(() => {
    jobsApi
      .getCategories()
      .then((r) => {
        setJobCategories(r.categories || []);
      })
      .catch((err) => {
        console.error("Failed to load job categories:", err);
        setJobCategories([]);
      });
  }, []);

  // Load job templates (per customer) from localStorage
  useEffect(() => {
    try {
      if (!jobTemplatesStorageKey) return;
      const raw = localStorage.getItem(jobTemplatesStorageKey);
      if (!raw) {
        setJobTemplates([]);
        setActiveTemplateId(null);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      setJobTemplates(Array.isArray(parsed) ? (parsed as JobTemplate[]) : []);
      setActiveTemplateId(null);
    } catch {
      setJobTemplates([]);
      setActiveTemplateId(null);
    }
  }, [jobTemplatesStorageKey]);

  // Persist job templates to localStorage
  useEffect(() => {
    try {
      if (!jobTemplatesStorageKey) return;
      localStorage.setItem(jobTemplatesStorageKey, JSON.stringify(jobTemplates));
    } catch {}
  }, [jobTemplates, jobTemplatesStorageKey]);

  // Fetch raioane when form opens
  useEffect(() => {
    if (showPostJob && postJobStep === "form") {
      jobsApi
        .getRaioane()
        .then((r) => {
          setRaioane(r.raioane || []);
        })
        .catch((err) => {
          console.error("Failed to load raioane:", err);
          setRaioane([]);
        });
    }
  }, [showPostJob, postJobStep]);

  // Filter raioane based on search
  const filteredRaioane = raioane.filter((r) => {
    if (!raionSearch.trim()) return true;
    const searchLower = raionSearch.toLowerCase();
    return r.name.toLowerCase().includes(searchLower);
  });

  // Calculate salary based on hours and hourly rate
  useEffect(() => {
    if (!formStartTime || !formEndTime || !hourlyRate) {
      setCalculatedSalary(null);
      return;
    }

    const [startHour, startMin] = formStartTime.split(":").map(Number);
    const [endHour, endMin] = formEndTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      setCalculatedSalary(null);
      return;
    }

    const totalMinutes = endMinutes - startMinutes;
    const totalHours = totalMinutes / 60;
    const rate = parseFloat(hourlyRate);
    
    if (isNaN(rate) || rate <= 0) {
      setCalculatedSalary(null);
      return;
    }

    const baseTotal = totalHours * rate;
    setCalculatedSalary(roundMoney(getBusinessTotal(baseTotal)));
  }, [formStartTime, formEndTime, hourlyRate]);
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

  const addJob = async (job: Omit<JobRow, "id"> & { raionId?: number; localitate?: string }): Promise<boolean> => {
    if (job.jobCategoryCode == null || job.hourlyRateBase == null) return false;
    const payload = {
      job: job.job, // Custom title (max 30 chars)
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
      jobCategoryCode: job.jobCategoryCode ?? 1,
      hourlyRateBase: job.hourlyRateBase ?? 0,
      ...(job.raionId != null ? { raionId: job.raionId } : {}),
      ...(job.localitate != null && job.localitate.trim() ? { localitate: job.localitate.trim() } : {}),
      ...(job.checkInLat != null && job.checkInLng != null && job.checkInRadiusM != null
        ? { checkInLat: job.checkInLat, checkInLng: job.checkInLng, checkInRadiusM: job.checkInRadiusM }
        : {}),
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
          acceptedCount: created.acceptedCount ?? 0,
          startTime: created.startTime,
          endTime: created.endTime,
          peopleNeeded: created.peopleNeeded,
          duration: created.duration,
          estimatedSalary: created.estimatedSalary,
          imageUrl: created.imageUrl,
          postedBy: created.postedBy,
          jobCategoryCode: created.jobCategoryCode,
          hourlyRateBase: created.hourlyRateBase,
          jobCategoryTitle: created.jobCategoryTitle,
          postedById: created.postedById,
          postedByRole: created.postedByRole,
          postedByAvatar: created.postedByAvatar ?? (user?.avatar ?? undefined),
          ...(created.checkInLat != null && created.checkInLng != null && created.checkInRadiusM != null
            ? { checkInLat: created.checkInLat, checkInLng: created.checkInLng, checkInRadiusM: created.checkInRadiusM }
            : {}),
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

  const generateTemplateId = () => {
    try {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (crypto as any).randomUUID() as string;
      }
    } catch {}
    return `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const applyTemplateToForm = (tpl: JobTemplate) => {
    setPostMethod("template");
    setActiveTemplateId(tpl.id);
    setTemplateAction("use");
    setSelectedJobType(tpl.jobType);
    setHourlyRate(tpl.hourlyRateBase);
    setFormStartTime(tpl.startTime);
    setFormEndTime(tpl.endTime);
    setStaffCountSelect(tpl.staffCount);
    setUnpaidBreak(tpl.unpaidBreak);
    setLocalitate(tpl.localitate ?? "");

    setSelectedJobCategory(tpl.categoryCode);
    setJobTitleDraft(tpl.jobTitle);
    setEventNameDraft(tpl.eventName);

    if (tpl.raionId != null) {
      setSelectedRaionId(tpl.raionId);
      const match = raioane.find((r) => r.id === tpl.raionId);
      if (match) setRaionSearch(match.name);
    } else {
      setSelectedRaionId(null);
      setRaionSearch("");
    }

    setJobCheckInGeo(tpl.checkInGeo ?? null);
    setJobAddress(tpl.address ?? "");
    setStaffPhoneNumber(tpl.staffPhone ?? "");
    setPhoneCountryCode(tpl.staffPhoneCountry ?? "+373");
    setJobDescription(tpl.description ?? "");

    setPostJobFieldErrors({});
  };

  const saveCurrentFormAsTemplate = (): boolean => {
    setTemplateSaveError("");

    if (!selectedJobCategory) {
      setTemplateSaveError("Selectează categoria jobului înainte de a salva un șablon.");
      return false;
    }
    if (!selectedJobType) {
      setTemplateSaveError("Alege tipul jobului (o zi / mai multe zile / full-time) înainte de a salva un șablon.");
      return false;
    }
    const jobTitle = tplCreateJobTitle.trim();
    const eventName = tplCreateEventName.trim();
    if (!jobTitle) {
      setTemplateSaveError("Scrie un nume pentru job înainte de a salva ca șablon.");
      return false;
    }
    const rateNum = parseFloat(tplCreateHourlyRate);
    if (!tplCreateHourlyRate || isNaN(rateNum) || rateNum <= 0) {
      setTemplateSaveError("Introdu o valoare validă pentru rata orară înainte de a salva șablonul.");
      return false;
    }

    const id = generateTemplateId();
    const template: JobTemplate = {
      id,
      categoryCode: selectedJobCategory,
      title: (templateSaveTitle.trim() || jobTitle).slice(0, 60),
      jobType: selectedJobType,
      jobTitle,
      eventName,
      staffCount: tplCreateStaffCount,
      hourlyRateBase: tplCreateHourlyRate,
      startTime: tplCreateStartTime,
      endTime: tplCreateEndTime,
      unpaidBreak: tplCreateUnpaidBreak,
      raionId: selectedRaionId ?? null,
      localitate: localitate.trim() || null,
      checkInGeo: jobCheckInGeo ?? null,
    };

    setJobTemplates((prev) => {
      const next = [template, ...prev];
      return next;
    });
    setActiveTemplateId(id);
    setShowTemplateSavePanel(false);
    setTemplateSaveTitle("");
    setTemplateSaveError("");
    // După ce am creat șablonul, nu îl aplicăm în formularul de job.
    // Dacă utilizatorul apasă ulterior "Următorul", va merge pe fluxul "use".
    setTemplateAction("use");
    return true;
  };

  const saveFormAsTemplate = (): boolean => {
    if (!selectedJobCategory || !selectedJobType) return false;
    const jobTitle = jobTitleDraft.trim();
    if (!jobTitle) return false;

    const id = generateTemplateId();
    const template: JobTemplate = {
      id,
      categoryCode: selectedJobCategory,
      title: (templateSaveTitle.trim() || jobTitle).slice(0, 60),
      jobType: selectedJobType,
      jobTitle,
      eventName: eventNameDraft.trim(),
      staffCount: staffCountSelect,
      hourlyRateBase: hourlyRate,
      startTime: formStartTime,
      endTime: formEndTime,
      unpaidBreak,
      raionId: selectedRaionId ?? null,
      localitate: localitate.trim() || null,
      checkInGeo: jobCheckInGeo ?? null,
      address: jobAddress.trim() || null,
      staffPhone: staffPhoneNumber.trim() || null,
      staffPhoneCountry: phoneCountryCode,
      description: jobDescription.trim() || null,
    };

    setJobTemplates((prev) => [template, ...prev]);
    setActiveTemplateId(id);
    return true;
  };

  const performJobDelete = (id: string) => {
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
    setDeleteJobConfirmId(null);
  };
  const removeJob = (id: string) => {
    setDeleteJobConfirmId(id);
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

  useEffect(() => {
    if (!staffDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target as Node)) setStaffDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [staffDropdownOpen]);

  useEffect(() => {
    if (!raionDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (raionDropdownRef.current && !raionDropdownRef.current.contains(e.target as Node)) setRaionDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [raionDropdownOpen]);

  useEffect(() => {
    if (!salaryDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (salaryDropdownRef.current && !salaryDropdownRef.current.contains(e.target as Node)) setSalaryDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [salaryDropdownOpen]);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) setCategoryDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [categoryDropdownOpen]);

  // Keep page start consistent between dashboard sections. Must be before any conditional return (Rules of Hooks).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  if (loading) return <div className="container mx-auto px-4 py-16 text-center">{t("dashboard.loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  const userRole = user.role?.toLowerCase?.().trim?.() ?? "";
  const isCustomer = userRole === "customer";

  const closeSidebar = () => setSidebarOpen(false);

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
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0" onClick={closeSidebar} aria-label="Work2Now – acasă dashboard">
          <img src="/LogoWork2Now.png" alt="Work2Now" className="h-7 w-auto" />
          <span className="font-bold text-gray-900 truncate">Work2Now</span>
        </Link>
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
          w-[78vw] min-w-[78vw] max-w-[320px] md:w-64 md:min-w-64 md:max-w-64 h-screen md:h-screen md:self-start bg-white border-r border-secondary/10 flex flex-col shadow-soft overflow-y-auto overscroll-contain md:overflow-visible
          fixed top-0 left-0 z-50 md:sticky md:top-0 md:left-auto md:z-auto
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        <div className="p-4 border-b border-secondary/10 flex items-center justify-between gap-2 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={closeSidebar} aria-label="Work2Now – acasă dashboard">
            <img src="/LogoWork2Now.png" alt="Work2Now" className="h-8 w-auto" />
            <span className="font-bold text-gray-900">Work2Now</span>
          </Link>
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
        <nav className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 min-h-0">
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
          </div>
          {isCustomer && (
            <div className="mt-auto px-4 py-2 pt-2 border-t border-gray-200 flex-shrink-0">
              <NavLink
                to="/dashboard/subscription"
                end={false}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                <CreditCard className="w-5 h-5 flex-shrink-0" size={20} />
                {t("dashboard.subscription")}
              </NavLink>
            </div>
          )}
        </nav>
        <div className="mt-auto p-4 border-t border-gray-200 bg-gradient-to-b from-gray-50/80 to-white md:flex-shrink-0">
          <button
            type="button"
            onClick={() => { setShowMyProfileModal(true); closeSidebar(); }}
            className="w-full flex items-center gap-3 mb-3 rounded-xl p-1 -m-1 hover:bg-gray-100/80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
            aria-label={t("dashboard.viewMyProfileAndReviews", "Deschide profilul și recenziile")}
          >
            <span className="relative flex-shrink-0 rounded-full">
              <img
                src={user?.avatar || "/Illustration/AvatarWhiteGuy.png"}
                alt=""
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-md hover:opacity-90 transition-opacity"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  availableToWork ? "bg-green-500" : "bg-red-500"
                }`}
                title={availableToWork ? t("dashboard.availableToWork") : t("dashboard.unavailable")}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{user.name}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary capitalize">
                  {user.role?.toLowerCase?.() === "admin"
                    ? t("dashboard.roleAdmin", "Admin")
                    : user.role?.toLowerCase?.() === "support"
                      ? t("dashboard.roleSupport", "Support")
                      : user.role?.toLowerCase?.() === "customer"
                        ? t("dashboard.roleCustomer", "Customer")
                        : t("dashboard.roleStaff", "Staff")}
                </span>
                {user.role?.toLowerCase?.() === "customer" && user.boosterUntil && new Date(user.boosterUntil) > new Date() && (
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800" title={t("dashboard.boosterActiveUntil", "Booster activ până la {{date}}", { date: new Date(user.boosterUntil).toLocaleDateString() })}>
                    {t("dashboard.boosterActive", "Booster activ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <StarRating value={userRating?.average ?? 0} size={14} />
                {userRating && userRating.count > 0 && (
                  <span className="text-xs text-gray-500">({userRating.count})</span>
                )}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { navigate("/dashboard/settings"); closeSidebar(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200/80 transition-colors mt-2"
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

      {showMyProfileModal && user && (
        <StaffProfileModal
          open={showMyProfileModal}
          onClose={() => setShowMyProfileModal(false)}
          staffId={String(user.id)}
          staffName={user.name}
          staffEmail={user.email}
          staffAvatar={user.avatar}
          currentUserId={String(user.id)}
          userRole={user.role}
          scrollToReviewsOnOpen
          initialRating={
            userRating ??
            (() => {
              try {
                const raw = localStorage.getItem(MY_RATING_CACHE_KEY);
                if (!raw) return null;
                const c = JSON.parse(raw) as { average: number; count: number; userId?: string };
                if (c && String(c.userId) === String(user.id) && (c.count ?? 0) > 0) return { average: c.average, count: c.count };
                return null;
              } catch {
                return null;
              }
            })()
          }
        />
      )}

      <main key={location.pathname} className="flex-1 pt-14 md:pt-0 p-4 md:p-8 page-enter min-w-0 overflow-x-hidden">
        <DashboardContext.Provider value={{ openPostJobModal: () => setShowPostJob(true), jobsAdded, addJob, removeJob, refreshJobs: fetchJobsForCustomer, availableToWork, setAvailableToWork, jobsLoadError, userRating: userRating ?? null }}>
          <Outlet />
        </DashboardContext.Provider>
      </main>

      {/* Modal Posteaza un job – doar pentru Customer (portal în body pentru centrare viewport) */}
      {isCustomer && showPostJob && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
          onClick={() => {
            setShowPostJob(false);
            setPostJobStep("choose-type");
            setSelectedJobType(null);
            setPostMethod(null);
            setPostJobError("");
            setSelectedRaionId(null);
            setRaionSearch("");
            setLocalitate("");
            setActiveTemplateId(null);
            setShowTemplateSavePanel(false);
            setShowTemplateCreateModal(false);
            setTemplateSaveTitle("");
            setTemplateSaveError("");
            setJobTitleDraft("");
            setEventNameDraft("");
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden modal-content-enter"
            onClick={(e) => e.stopPropagation()}
          >
            {jobSubmitted ? (
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t("dashboard.jobSaved")}</h3>
                <p className="text-gray-600 mb-4">{t("dashboard.jobSavedDesc")}</p>
                <button
                  type="button"
                  onClick={() => { 
                    setJobSubmitted(false); 
                    setShowPostJob(false); 
                    setPostJobStep("choose-type"); 
                    setSelectedJobType(null);
                    setSelectedRaionId(null);
                    setRaionSearch("");
                    setLocalitate("");
                    setActiveTemplateId(null);
                    setShowTemplateSavePanel(false);
                    setShowTemplateCreateModal(false);
                    setTemplateSaveTitle("");
                    setTemplateSaveError("");
                    setJobTitleDraft("");
                    setEventNameDraft("");
                  }}
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
                  onClick={() => { 
                    setShowPostJob(false); 
                    setPostJobStep("choose-type"); 
                    setSelectedJobType(null); 
                    setPostMethod(null); 
                    setPostJobError("");
                    setSelectedRaionId(null);
                    setRaionSearch("");
                    setLocalitate("");
                    setActiveTemplateId(null);
                    setShowTemplateSavePanel(false);
                    setShowTemplateCreateModal(false);
                    setTemplateSaveTitle("");
                    setTemplateSaveError("");
                    setJobTitleDraft("");
                    setEventNameDraft("");
                  }}
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
                    onClick={() => { 
                      setShowPostJob(false); 
                      setPostJobStep("choose-type"); 
                      setSelectedJobType(null);
                      setSelectedRaionId(null);
                      setRaionSearch("");
                      setLocalitate("");
                      setActiveTemplateId(null);
                      setShowTemplateSavePanel(false);
                      setTemplateSaveTitle("");
                      setTemplateSaveError("");
                    }}
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
                    onClick={() => { 
                      setShowPostJob(false); 
                      setPostJobStep("choose-type"); 
                      setSelectedJobType(null); 
                      setPostMethod(null);
                      setSelectedRaionId(null);
                      setRaionSearch("");
                      setLocalitate("");
                      setActiveTemplateId(null);
                      setShowTemplateSavePanel(false);
                      setShowTemplateCreateModal(false);
                      setTemplateSaveTitle("");
                      setTemplateSaveError("");
                      setJobTitleDraft("");
                      setEventNameDraft("");
                    }}
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
                      onClick={() => { setPostMethod("scratch"); setPostJobStep("form"); }}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all border-gray-200 hover:border-primary/40 hover:bg-gray-50"
                    >
                      <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{t("dashboard.startFromScratch")}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{t("dashboard.startFromScratchDesc")}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  <>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Șabloanele tale</h4>
                    {jobTemplates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                        <p className="text-sm text-gray-400">Nu ai niciun șablon salvat încă.</p>
                        <p className="text-xs text-gray-400 mt-1">Completează un formular și apasă „Salvează șablon".</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {jobTemplates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 transition-all"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                applyTemplateToForm(tpl);
                                setPostJobStep("form");
                              }}
                              className="flex items-center gap-3 p-3 flex-1 min-w-0 text-left"
                            >
                              <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" /></svg>
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{tpl.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {tpl.jobType} · {tpl.hourlyRateBase} MDL/oră · {tpl.staffCount} {tpl.staffCount === "1" ? "persoană" : "persoane"}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTemplateConfirmId(tpl.id)}
                              className="flex-shrink-0 p-2 mr-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              aria-label="Șterge șablon"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                </div>
                <div className="flex gap-3 p-4 sm:p-6 pt-0 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setPostJobStep("choose-type")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-2.5 font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/10 hover:shadow-md"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </span>
                    {t("dashboard.back")}
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
                    onClick={() => {
                      setShowPostJob(false);
                      setPostJobStep("choose-type");
                      setSelectedJobType(null);
                      setPostMethod(null);
                      setPostJobError("");
                      setSelectedJobCategory(null);
                      setHourlyRate("");
                      setCalculatedSalary(null);
                      setSelectedRaionId(null);
                      setRaionSearch("");
                      setLocalitate("");
                      setPostJobFieldErrors({});
                      setActiveTemplateId(null);
                      setShowTemplateSavePanel(false);
                      setTemplateSaveTitle("");
                      setTemplateSaveError("");
                      setJobTitleDraft("");
                      setEventNameDraft("");
                    }}
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
                    setPostJobFieldErrors({});
                    const form = e.currentTarget;
                    // Use state variables directly since we're managing them with React state
                    const jobCategoryCode = selectedJobCategory;
                    const hourlyRateBase = hourlyRate ? Number(hourlyRate) : NaN;

                    // Validate job category
                    if (jobCategoryCode === null || jobCategoryCode === undefined || jobCategoryCode <= 0) {
                      setPostJobFieldErrors((prev) => ({ ...prev, jobCategoryCode: "Please select a job category" }));
                      return;
                    }

                    // Validate hourly rate
                    if (!hourlyRate || hourlyRate.trim() === "" || isNaN(hourlyRateBase) || hourlyRateBase <= 0) {
                      setPostJobFieldErrors((prev) => ({ ...prev, hourlyRateBase: "Please enter a valid hourly rate" }));
                      return;
                    }

                    // Validate raionId (required)
                    if (!selectedRaionId || selectedRaionId <= 0) {
                      setPostJobFieldErrors((prev) => ({ ...prev, raionId: "Please select a raion/municipiu" }));
                      return;
                    }

                    const jobTitle = jobTitleDraft.trim().slice(0, 30);
                    const address = jobAddress.trim() || (form.elements.namedItem("address") as HTMLInputElement)?.value?.trim();
                    const dateVal = jobDate || (form.elements.namedItem("jobDate") as HTMLInputElement)?.value?.trim();
                    const endDateVal = jobEndDate || (form.elements.namedItem("jobEndDate") as HTMLInputElement)?.value?.trim();
                    const peopleVal = (form.elements.namedItem("numberOfStaff") as HTMLInputElement | HTMLSelectElement)?.value?.trim();
                    const salaryVal = calculatedSalary !== null ? String(calculatedSalary.toFixed(2)) : (form.elements.namedItem("estimatedSalary") as HTMLInputElement | HTMLSelectElement)?.value?.trim();
                    const toYmdToday = () => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    };
                    const isYmd = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
                    const normalizedDate = isYmd(dateVal) ? dateVal : toYmdToday();
                    const normalizedEndDate = selectedJobType === "multi-day" && isYmd(endDateVal) ? endDateVal : undefined;
                    if (jobTitle && address && selectedJobType) {
                      const ok = await addJob({
                        job: jobTitle,
                        location: address,
                        status: "Draft",
                        statusClass: "bg-gray-100 text-gray-700",
                        date: normalizedDate,
                        endDate: normalizedEndDate,
                        jobType: selectedJobType,
                        jobCategoryCode,
                        hourlyRateBase,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        peopleNeeded: peopleVal || undefined,
                        estimatedSalary: salaryVal || undefined,
                        raionId: selectedRaionId,
                        localitate: localitate.trim() || undefined,
                        ...(jobCheckInGeo
                          ? { checkInLat: jobCheckInGeo.lat, checkInLng: jobCheckInGeo.lng, checkInRadiusM: jobCheckInGeo.radiusM }
                          : {}),
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
                    setJobCheckInGeo(null);
                    setJobDate("");
                    setJobEndDate("");
                    setJobDocuments([]);
                    setPhoneCountryCode("+373");
                    setStaffPhoneNumber("");
                    setJobDescription("");
                    setJobTitleSelected("");
                    setUnpaidBreak("no");
                    setUnpaidBreakOpen(false);
                    setPostJobError("");
                    setSelectedJobCategory(null);
                    setHourlyRate("");
                    setCalculatedSalary(null);
                    setSelectedRaionId(null);
                    setRaionSearch("");
                    setLocalitate("");
                    setPostJobFieldErrors({});
                    setActiveTemplateId(null);
                    setShowTemplateSavePanel(false);
                    setTemplateSaveTitle("");
                    setTemplateSaveError("");
                    setJobTitleDraft("");
                    setEventNameDraft("");
                    setTemplateSavedFeedback(false);
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
                    className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/10 hover:shadow-md"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </span>
                    {t("dashboard.back")}
                  </button>

                  {postMethod === "template" && selectedJobCategory != null && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900">{t("dashboard.useTemplateTitle")}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {getLocalizedJobCategory(jobCategories.find((c) => c.code === selectedJobCategory) ?? { code: selectedJobCategory, title: "—" })}
                          </p>
                        </div>
                        {activeTemplateId && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary whitespace-nowrap">
                            Șablon activ
                          </span>
                        )}
                      </div>

                      {(() => {
                        const list = jobTemplates.filter((tpl) => tpl.categoryCode === selectedJobCategory);
                        if (list.length === 0) {
                          return <p className="text-sm text-gray-500">{t("dashboard.noTemplatesYet")}</p>;
                        }
                        return (
                          <div className="space-y-2">
                            {list.map((tpl) => (
                              <div
                                key={tpl.id}
                                className={`flex items-start justify-between gap-3 p-3 rounded-xl bg-white border transition-all ${
                                  activeTemplateId === tpl.id ? "border-primary/40 shadow-sm" : "border-gray-200 hover:border-primary/20"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{tpl.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                                    {tpl.jobType} · {tpl.hourlyRateBase} MDL/oră · {tpl.staffCount} {tpl.staffCount === "1" ? "persoană" : "persoane"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applyTemplateToForm(tpl)}
                                  className="shrink-0 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
                                >
                                  {activeTemplateId === tpl.id ? "Aplicat" : "Folosește"}
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                    </div>
                  )}

                  <section>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">{t("dashboard.jobDetails")}</h4>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.jobTitleLabel")} <span className="text-red-500">*</span></span>
                        <input
                          name="job"
                          type="text"
                          maxLength={30}
                          placeholder={t("dashboard.jobTitleExample")}
                          value={jobTitleDraft}
                          onChange={(e) => {
                            setJobTitleDraft(e.target.value);
                          }}
                          className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">{t("dashboard.max30Characters")}</p>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.eventName")}</span>
                        <input
                          name="eventName"
                          type="text"
                          value={eventNameDraft}
                          onChange={(e) => {
                            setEventNameDraft(e.target.value);
                          }}
                          placeholder={t("dashboard.eventNamePlaceholder")}
                          className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                        />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block min-w-0">
                          <span className="text-sm font-medium text-gray-700">{t("dashboard.numberOfStaff")}</span>
                          <input type="hidden" name="numberOfStaff" value={staffCountSelect} readOnly />
                          <div ref={staffDropdownRef} className="mt-1 relative">
                            <button
                              type="button"
                              onClick={() => { setStaffDropdownOpen((v) => !v); setSalaryDropdownOpen(false); }}
                              aria-expanded={staffDropdownOpen}
                              aria-haspopup="listbox"
                              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-left text-gray-900 shadow-sm transition-all hover:border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary"
                            >
                              <span className="font-medium">{staffCountSelect}</span>
                              <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${staffDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {staffDropdownOpen && (
                              <div
                                role="listbox"
                                aria-label={t("dashboard.numberOfStaff")}
                                className="absolute left-0 right-0 top-full z-[70] mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1.5 dropdown-enter origin-top"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    role="option"
                                    aria-selected={staffCountSelect === String(n)}
                                    onMouseDown={(e) => { e.preventDefault(); setStaffCountSelect(String(n)); setStaffDropdownOpen(false); }}
                                    className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${staffCountSelect === String(n) ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"}`}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </label>
                        <label className="block min-w-0">
                          <span className="text-sm font-medium text-gray-700">{t("dashboard.selectJobCategory")} <span className="text-red-500">*</span></span>
                          <div ref={categoryDropdownRef} className="mt-1 relative">
                            <input type="hidden" name="jobCategoryCode" value={selectedJobCategory ?? ""} />
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryDropdownOpen((v) => !v);
                                setStaffDropdownOpen(false);
                                setSalaryDropdownOpen(false);
                              }}
                              aria-expanded={categoryDropdownOpen}
                              aria-haspopup="listbox"
                              aria-label={t("dashboard.selectJobCategory", "Selectează categoria jobului")}
                              className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl border bg-white text-left shadow-sm transition-all ${
                                postJobFieldErrors.jobCategoryCode ? "border-red-400 ring-1 ring-red-200" : "border-gray-200 hover:border-gray-300"
                              } focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary`}
                            >
                              <span className={selectedJobCategory ? "text-gray-900 font-medium" : "text-gray-500"}>
                                {selectedJobCategory
                                  ? getLocalizedJobCategory(jobCategories.find((c) => c.code === selectedJobCategory) ?? { code: selectedJobCategory, title: "—" })
                                  : t("dashboard.chooseCategory")}
                              </span>
                              <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${categoryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {categoryDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                                <div className="overflow-y-auto max-h-64 py-1">
                                  {jobCategories.map((cat) => (
                                    <button
                                      key={cat.code}
                                      type="button"
                                      role="option"
                                      aria-selected={selectedJobCategory === cat.code}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setSelectedJobCategory(cat.code);
                                        setPostJobFieldErrors((prev) => ({ ...prev, jobCategoryCode: undefined }));
                                        setHourlyRate("");
                                        setCalculatedSalary(null);
                                        setCategoryDropdownOpen(false);
                                      }}
                                      className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                        selectedJobCategory === cat.code
                                          ? "bg-primary/10 text-primary"
                                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                      }`}
                                    >
                                      {getLocalizedJobCategory(cat)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {postJobFieldErrors.jobCategoryCode && (
                            <p className="mt-1 text-sm text-red-600">{postJobFieldErrors.jobCategoryCode}</p>
                          )}
                        </label>

                        <label className="block min-w-0">
                          <span className="text-sm font-medium text-gray-700">{t("dashboard.hourlyRateLabel")} <span className="text-red-500">*</span></span>
                          <input
                            name="hourlyRateBase"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder={t("dashboard.hourlyRatePlaceholder")}
                            value={hourlyRate}
                            onChange={(e) => {
                              const value = e.target.value;
                              setHourlyRate(value);
                              setPostJobFieldErrors((prev) => ({ ...prev, hourlyRateBase: undefined }));
                            }}
                            className={`mt-1 block w-full px-4 py-2.5 rounded-xl border ${
                              postJobFieldErrors.hourlyRateBase ? "border-red-400" : "border-gray-200"
                            } focus:ring-2 focus:ring-primary focus:border-primary transition-colors`}
                          />
                          {postJobFieldErrors.hourlyRateBase && (
                            <p className="mt-1 text-sm text-red-600">{postJobFieldErrors.hourlyRateBase}</p>
                          )}
                        </label>
                        {calculatedSalary !== null && (
                          <div className="col-span-1 sm:col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">{t("dashboard.estimatedTotalCost", "Total (incl. 24% tax + 10% maintenance)")}</span>
                              <span className="text-lg font-bold text-primary">{calculatedSalary.toFixed(2)} MDL</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              Based on {formStartTime} – {formEndTime} ({((parseFloat(hourlyRate) || 0) > 0 ? (calculatedSalary / (1 + 0.24 + 0.1) / parseFloat(hourlyRate)).toFixed(2) : 0)} hours) × {hourlyRate} MDL/hour
                            </p>
                          </div>
                        )}

                      </div>

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
                      <div className={selectedJobType === "one-day" ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
                        <DatePicker
                          name="jobDate"
                          value={jobDate}
                          onChange={setJobDate}
                          label={selectedJobType === "one-day" ? t("dashboard.date") : t("dashboard.dateFrom")}
                        />
                        {selectedJobType === "multi-day" && (
                          <DatePicker
                            name="jobEndDate"
                            value={jobEndDate}
                            onChange={setJobEndDate}
                            label={t("dashboard.dateTo")}
                          />
                        )}
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
                      
                      {/* Raion Selection */}
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 mb-1 block">
                          {t("dashboard.raionLabel")} <span className="text-red-500">*</span>
                        </span>
                        <div ref={raionDropdownRef} className="relative">
                          <input
                            type="text"
                            value={raionSearch}
                            onChange={(e) => {
                              setRaionSearch(e.target.value);
                              setRaionDropdownOpen(true);
                              setPostJobFieldErrors((prev) => ({ ...prev, raionId: undefined }));
                            }}
                            onFocus={() => setRaionDropdownOpen(true)}
                            placeholder={t("dashboard.raionPlaceholder")}
                            className={`mt-1 block w-full px-4 py-2.5 rounded-xl border ${
                              postJobFieldErrors.raionId ? "border-red-400" : "border-gray-200"
                            } focus:ring-2 focus:ring-primary focus:border-primary transition-colors`}
                          />
                          {raionDropdownOpen && filteredRaioane.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-[70] mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1.5 dropdown-enter origin-top">
                              {filteredRaioane.map((raion) => (
                                <button
                                  key={raion.id}
                                  type="button"
                                  role="option"
                                  aria-selected={selectedRaionId === raion.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSelectedRaionId(raion.id);
                                    setRaionSearch(raion.name);
                                    setRaionDropdownOpen(false);
                                    setPostJobFieldErrors((prev) => ({ ...prev, raionId: undefined }));
                                  }}
                                  className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                                    selectedRaionId === raion.id
                                      ? "bg-primary/10 text-primary"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{raion.name}</span>
                                    <span className="text-xs text-gray-500 capitalize">{raion.type}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedRaionId && (
                            <div className="mt-1 text-xs text-gray-500">
                              {t("dashboard.selectedRaion")}: {raioane.find((r) => r.id === selectedRaionId)?.name}
                            </div>
                          )}
                        </div>
                        {postJobFieldErrors.raionId && (
                          <p className="mt-1 text-sm text-red-600">{postJobFieldErrors.raionId}</p>
                        )}
                      </label>

                      {/* Localitate Input */}
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 mb-1 block">
                          {t("dashboard.localityLabel")}
                        </span>
                        <input
                          type="text"
                          name="localitate"
                          value={localitate}
                          onChange={(e) => {
                            setLocalitate(e.target.value);
                            setPostJobFieldErrors((prev) => ({ ...prev, localitate: undefined }));
                          }}
                          placeholder={t("dashboard.localityPlaceholder")}
                          maxLength={200}
                          className={`mt-1 block w-full px-4 py-2.5 rounded-xl border ${
                            postJobFieldErrors.localitate ? "border-red-400" : "border-gray-200"
                          } focus:ring-2 focus:ring-primary focus:border-primary transition-colors`}
                        />
                        <p className="mt-1 text-xs text-gray-500">{t("dashboard.localityHint")}</p>
                        {postJobFieldErrors.localitate && (
                          <p className="mt-1 text-sm text-red-600">{postJobFieldErrors.localitate}</p>
                        )}
                      </label>

                      <div>
                        <span className="text-sm font-medium text-gray-700 mb-1 block">{t("dashboard.address")}</span>
                        <input type="hidden" name="address" value={jobAddress} readOnly />
                        <button
                          type="button"
                          onClick={() => setShowAddressModal(true)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 bg-white text-left text-sm font-medium text-gray-700 hover:border-primary/40 hover:bg-primary/5 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          {jobAddress ? (
                            <span className="truncate flex-1 text-left">{jobAddress}</span>
                          ) : (
                            <span>{t("dashboard.addAddress")}</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </section>

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
                              value={staffPhoneNumber}
                              onChange={(e) => setStaffPhoneNumber(e.target.value)}
                              className="flex-1 min-w-[16rem] sm:min-w-[20rem] w-full px-4 py-2.5 border-0 bg-transparent focus:ring-0 rounded-r-xl text-gray-900 placeholder:text-gray-400"
                            />
                          </div>
                        </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">{t("dashboard.description")}</span>
                        <textarea
                          name="description"
                          rows={3}
                          placeholder={t("dashboard.descriptionPlaceholder")}
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
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

                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                    {showTemplateSavePanel ? (
                      <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <p className="text-sm font-semibold text-gray-900">Salvează șablon</p>
                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">Nume șablon</span>
                          <input
                            type="text"
                            value={templateSaveTitle}
                            onChange={(e) => setTemplateSaveTitle(e.target.value)}
                            placeholder="Ex: Barista - 8 ore"
                            maxLength={60}
                            autoFocus
                            className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                          />
                        </label>
                        {templateSaveError && <p className="text-sm text-red-600">{templateSaveError}</p>}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => { setShowTemplateSavePanel(false); setTemplateSaveTitle(""); setTemplateSaveError(""); }}
                            className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Anulează
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!templateSaveTitle.trim()) {
                                setTemplateSaveError("Introdu un nume pentru șablon.");
                                return;
                              }
                              const ok = saveFormAsTemplate();
                              if (ok) {
                                setShowTemplateSavePanel(false);
                                setTemplateSaveTitle("");
                                setTemplateSaveError("");
                                setTemplateSavedFeedback(true);
                                setTimeout(() => setTemplateSavedFeedback(false), 2500);
                              }
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
                          >
                            Salvează
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setShowTemplateSavePanel(true); setTemplateSaveTitle(jobTitleDraft.trim()); setTemplateSaveError(""); }}
                        disabled={!jobTitleDraft.trim() || !selectedJobCategory || !selectedJobType}
                        className="w-full py-2.5 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        {templateSavedFeedback ? "Șablon salvat!" : "Salvează șablon"}
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { 
                          setShowPostJob(false); 
                          setPostJobStep("choose-type"); 
                          setSelectedJobType(null); 
                          setPostMethod(null);
                          setSelectedRaionId(null);
                          setRaionSearch("");
                          setLocalitate("");
                          setStaffPhoneNumber("");
                          setJobDescription("");
                          setTemplateSavedFeedback(false);
                          setShowTemplateSavePanel(false);
                          setTemplateSaveTitle("");
                          setTemplateSaveError("");
                        }}
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
                  </div>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal confirmare ștergere job */}
      {deleteJobConfirmId && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteJobConfirmId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-job-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 id="delete-job-title" className="text-lg font-semibold text-gray-900 mb-2">
                {t("dashboard.deleteJobTitle", "Șterge job")}
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                {t("dashboard.confirmDeleteJob", "Sigur vrei să ștergi acest job?")}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setDeleteJobConfirmId(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  {t("dashboard.cancel", "Anulare")}
                </button>
                <button
                  type="button"
                  onClick={() => deleteJobConfirmId && performJobDelete(deleteJobConfirmId)}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  {t("dashboard.delete", "Șterge")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal confirmare ștergere șablon */}
      {deleteTemplateConfirmId && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteTemplateConfirmId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-template-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 id="delete-template-title" className="text-lg font-semibold text-gray-900 mb-2">
                Șterge șablon
              </h3>
              <p className="text-gray-600 text-sm mb-1">
                Șablonul <span className="font-semibold text-gray-900">"{jobTemplates.find((t) => t.id === deleteTemplateConfirmId)?.title}"</span>
              </p>
              <p className="text-gray-500 text-sm mb-6">va fi șters definitiv.</p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setDeleteTemplateConfirmId(null)}
                  className="flex-1 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJobTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateConfirmId));
                    setDeleteTemplateConfirmId(null);
                  }}
                  className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Șterge
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isCustomer && createPortal(
        <AddressPickerModal
          open={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onConfirm={(address, geo) => {
            setJobAddress(address);
            setJobCheckInGeo(geo ? { lat: geo.lat, lng: geo.lng, radiusM: geo.radiusM ?? 200 } : null);
            setShowAddressModal(false);
          }}
          initialAddress={jobAddress}
          defaultRadiusM={200}
        />,
        document.body
      )}

      {isCustomer && showDocumentsModal && createPortal(
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
        />,
        document.body
      )}

      {isCustomer && showPostJob && postJobStep === "how-to-post" && showTemplateCreateModal && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
          onClick={() => setShowTemplateCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden modal-content-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{t("dashboard.useTemplateTitle")}</h3>
              <button
                type="button"
                onClick={() => setShowTemplateCreateModal(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label={t("dashboard.close")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <div className="mb-4 rounded-xl border border-primary/15 bg-primary/5 p-3">
                <p className="text-sm font-semibold text-gray-900">Categorie</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedJobCategory != null
                    ? getLocalizedJobCategory(jobCategories.find((c) => c.code === selectedJobCategory) ?? { code: selectedJobCategory, title: "—" })
                    : "—"}
                </p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Nume șablon</span>
                  <input
                    type="text"
                    value={templateSaveTitle}
                    onChange={(e) => setTemplateSaveTitle(e.target.value)}
                    placeholder="Ex: Barista - 8 ore"
                    maxLength={60}
                    className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Job title</span>
                    <input
                      type="text"
                      value={tplCreateJobTitle}
                      onChange={(e) => setTplCreateJobTitle(e.target.value)}
                      maxLength={30}
                      placeholder={t("dashboard.jobTitleExample")}
                      className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Event name</span>
                    <input
                      type="text"
                      value={tplCreateEventName}
                      onChange={(e) => setTplCreateEventName(e.target.value)}
                      placeholder={t("dashboard.eventNamePlaceholder")}
                      className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Rată (MDL/oră)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={tplCreateHourlyRate}
                      onChange={(e) => setTplCreateHourlyRate(e.target.value)}
                      className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Număr persoane</span>
                    <select
                      value={tplCreateStaffCount}
                      onChange={(e) => setTplCreateStaffCount(e.target.value)}
                      className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TimePicker
                    name="startTime"
                    value={tplCreateStartTime}
                    onChange={setTplCreateStartTime}
                    label={t("dashboard.startTime")}
                  />
                  <TimePicker
                    name="endTime"
                    value={tplCreateEndTime}
                    onChange={setTplCreateEndTime}
                    label={t("dashboard.endTime")}
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Pauză neplătită</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                        onClick={() => setTplCreateUnpaidBreak("no")}
                      className={`flex-1 px-3 py-2 rounded-xl border transition-colors ${
                          tplCreateUnpaidBreak === "no" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Nu
                    </button>
                    <button
                      type="button"
                        onClick={() => setTplCreateUnpaidBreak("yes")}
                      className={`flex-1 px-3 py-2 rounded-xl border transition-colors ${
                          tplCreateUnpaidBreak === "yes" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Da
                    </button>
                  </div>
                </div>

                {templateSaveError && <p className="text-sm text-red-600">{templateSaveError}</p>}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateSaveTitle("");
                      setTemplateSaveError("");
                      setTplCreateJobTitle("");
                      setTplCreateEventName("");
                      setTplCreateHourlyRate("");
                      setTplCreateStaffCount("1");
                      setTplCreateStartTime("00:00");
                      setTplCreateEndTime("00:00");
                      setTplCreateUnpaidBreak("no");
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Curăță
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = saveCurrentFormAsTemplate();
                      if (ok) setShowTemplateCreateModal(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
                  >
                    Creează șablon
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isCustomer && showJobTitleModal && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
