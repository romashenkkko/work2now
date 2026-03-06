import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, Clock, Banknote } from "lucide-react";
import { jobsApi } from "../api/client";
import type { JobResponse } from "../api/client";

function jobTypeToLabel(jobType?: string): string {
  if (!jobType) return "—";
  const t: Record<string, string> = {
    "one-day": "Ocazional",
    "multi-day": "Part-time",
    "full-time": "Full-time",
  };
  return t[jobType] ?? jobType;
}

function mapJobToCard(j: JobResponse): {
  id: string;
  title: string;
  type: string;
  location: string;
  desc: string;
  tags: string[];
  pay: string;
} {
  const tags: string[] = [];
  if (j.jobCategoryTitle) tags.push(j.jobCategoryTitle);
  if (j.jobType) tags.push(jobTypeToLabel(j.jobType));
  const descParts: string[] = [];
  if (j.date) descParts.push(j.date);
  if (j.startTime) descParts.push(j.startTime);
  if (j.duration) descParts.push(j.duration);
  const desc = descParts.length ? descParts.join(" · ") : (j.location ? `${j.location}.` : "");
  return {
    id: j.id,
    title: j.job,
    type: jobTypeToLabel(j.jobType),
    location: j.location || "—",
    desc: desc || "—",
    tags: tags.length ? tags : ["Flexibil"],
    pay: j.estimatedSalary || "—",
  };
}

const CATEGORY_OPTIONS = [
  { value: "all", labelKey: "allCategories" },
  { value: "hospitality", labelKey: "hospitality" },
  { value: "services", labelKey: "services" },
  { value: "retail", labelKey: "retail" },
  { value: "events", labelKey: "events" },
] as const;

const LOCATION_OPTIONS = [
  { value: "all", labelKey: "allLocations" },
  { value: "chisinau", labelKey: "chisinau" },
  { value: "bucuresti", labelKey: "bucuresti" },
  { value: "iasi", labelKey: "iasi" },
] as const;

function CustomDropdown<T extends string>({
  value,
  onChange,
  options,
  t,
  closeOthers,
  isOpen,
  onToggle,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; labelKey: string }[];
  t: (key: string) => string;
  closeOthers: () => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [isOpen, onToggle]);

  const selectedLabel = options.find((o) => o.value === value)?.labelKey ?? options[0].labelKey;

  return (
    <div ref={ref} className="custom-dropdown">
      <button
        type="button"
        className={`dropdown-btn ${isOpen ? "active" : ""}`}
        onClick={() => {
          closeOthers();
          onToggle();
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="dropdown-text">{t(`findJobs.${selectedLabel}`)}</span>
        <span className="chevron" aria-hidden>▾</span>
      </button>
      <div className={`dropdown-menu ${isOpen ? "active" : ""}`} role="listbox">
        {options.map((opt) => (
          <div
            key={opt.value}
            role="option"
            aria-selected={value === opt.value}
            className={`dropdown-item ${value === opt.value ? "selected" : ""}`}
            onClick={() => {
              onChange(opt.value as T);
              onToggle();
            }}
          >
            {t(`findJobs.${opt.labelKey}`)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FindJobs() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [jobCards, setJobCards] = useState<ReturnType<typeof mapJobToCard>[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  useEffect(() => {
    setJobsLoading(true);
    setJobsError(null);
    jobsApi
      .list()
      .then((res) => {
        const list = (res.jobs || []).map(mapJobToCard);
        setJobCards(list);
      })
      .catch((err) => {
        setJobsError(err instanceof Error ? err.message : "Eroare la încărcare");
        setJobCards([]);
      })
      .finally(() => setJobsLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 sm:py-16 max-w-6xl">
      {/* Hero banner – nuanțe violet brand (primary #7a63f1 / secondary #9d7bff) */}
      <section
        className="rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[rgba(122,99,241,0.14)] via-[rgba(157,123,255,0.10)] to-[rgba(122,99,241,0.16)] border border-[rgba(122,99,241,0.25)] shadow-[0_8px_32px_rgba(122,99,241,0.15)] mb-12 sm:mb-14 py-14 sm:py-20 px-6 sm:px-12 text-center"
        aria-label={t("findJobs.title")}
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1e1c2f] tracking-tight mb-4 max-w-2xl mx-auto">
          {t("findJobs.title")}
        </h1>
        <p className="text-[#3d3a4a] text-lg sm:text-xl leading-relaxed max-w-xl mx-auto font-normal">
          {t("findJobs.lead")}
        </p>
      </section>

      <div className="flex flex-wrap gap-3 mb-12 p-4 rounded-2xl bg-white border border-secondary/10 shadow-soft">
        <input
          type="text"
          placeholder={t("findJobs.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-3 rounded-xl border border-secondary/20 focus:ring-2 focus:ring-primary focus:border-primary bg-slate-50/50"
        />
        <CustomDropdown
          value={category}
          onChange={setCategory}
          options={CATEGORY_OPTIONS}
          t={t}
          closeOthers={() => { setLocationOpen(false); }}
          isOpen={categoryOpen}
          onToggle={() => setCategoryOpen((o) => !o)}
        />
        <CustomDropdown
          value={location}
          onChange={setLocation}
          options={LOCATION_OPTIONS}
          t={t}
          closeOthers={() => { setCategoryOpen(false); }}
          isOpen={locationOpen}
          onToggle={() => setLocationOpen((o) => !o)}
        />
        <button type="button" className="btn-primary">
          {t("findJobs.searchBtn")}
        </button>
      </div>

      {jobsLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white border-2 border-[rgba(224,216,247,0.6)] shadow-[0_4px_20px_rgba(122,99,241,0.08)] animate-pulse">
              <div className="h-10 bg-[#7a63f1]/20" />
              <div className="p-6">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-4" />
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-4/5" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="flex gap-2 mb-5">
                  <span className="h-6 w-16 bg-gray-100 rounded-lg" />
                  <span className="h-6 w-14 bg-gray-100 rounded-lg" />
                </div>
                <div className="h-11 bg-gray-200 rounded-xl w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : jobsError ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
          <p className="text-amber-800 font-medium mb-2">{t("findJobs.loginRequired")}</p>
          <p className="text-amber-700 text-sm mb-4">{t("findJobs.realJobsHint")}</p>
          <Link to="/login" className="btn-primary py-2 px-4 text-sm">{t("nav.login")}</Link>
        </div>
      ) : jobCards.length === 0 ? (
        <div className="rounded-2xl bg-white border border-secondary/20 p-8 text-center">
          <p className="text-gray-600 mb-4">{t("findJobs.notFound")}</p>
          <Link to="/contact" className="btn-secondary">{t("findJobs.contactUs")}</Link>
        </div>
      ) : (
      <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {jobCards.map((job) => (
          <article key={job.id} className="rounded-2xl overflow-hidden bg-white border-2 border-[rgba(224,216,247,0.6)] shadow-[0_4px_20px_rgba(122,99,241,0.08)] hover:border-[rgba(122,99,241,0.3)] hover:shadow-[0_8px_28px_rgba(122,99,241,0.12)] transition-all duration-300">
            <header className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#7a63f1] to-[#9d7bff]">
              <span className="text-white font-semibold text-sm">Work2Now</span>
              <span className="text-white/95 text-xs font-medium">{job.type}</span>
            </header>
            <div className="p-6">
              <h2 className="font-bold text-lg text-[#1e1c2f] mb-4">{job.title}</h2>
              <ul className="space-y-2 mb-4 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#7a63f1] shrink-0 mt-0.5" />
                  <span className="break-words">{job.location}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#7a63f1] shrink-0 mt-0.5" />
                  <span>{job.desc}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Banknote className="w-4 h-4 text-[#7a63f1] shrink-0 mt-0.5" />
                  <span className="font-medium text-[#1e1c2f]">{job.pay}</span>
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 mb-5">
                {job.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-lg bg-[rgba(122,99,241,0.12)] text-[#7a63f1] text-xs font-medium">{tag}</span>
                ))}
              </div>
              <Link to="/dashboard/joburi" className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#7a63f1] to-[#9d7bff] text-white font-semibold text-center text-sm hover:opacity-95 transition-opacity">
                {t("findJobs.apply")}
              </Link>
            </div>
          </article>
        ))}
      </div>
      </>
      )}

      <div className="text-center mt-14">
        <p className="text-gray-600 mb-4">{t("findJobs.notFound")}</p>
        <Link to="/contact" className="btn-secondary">
          {t("findJobs.contactUs")}
        </Link>
      </div>
    </div>
  );
}
