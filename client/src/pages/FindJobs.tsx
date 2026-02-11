import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const JOB_CARDS = [
  { title: "Ospatar", type: "Part-time", location: "Restaurant Central, Chisinau", desc: "Cautam ospatar pentru servire clienti in weekend. Experienta preferabila dar nu obligatorie.", tags: ["Weekend", "Flexibil"], pay: "150-200 MDL/shift" },
  { title: "Casier", type: "Full-time", location: "Supermarket, Bucuresti", desc: "Cautam casier pentru program flexibil. Training inclus. Plata rapida.", tags: ["Zi de zi", "Training"], pay: "2500-3000 RON/luna" },
  { title: "Event Staff", type: "Ocazional", location: "Evenimente, Iasi", desc: "Personal pentru evenimente: conferinte, petreceri, lansari. Program flexibil.", tags: ["Evenimente", "Ocazional"], pay: "200-300 RON/event" },
];

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

  return (
    <div className="container mx-auto px-4 py-20 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{t("findJobs.title")}</h1>
      <p className="text-gray-600 text-lg mb-10">{t("findJobs.lead")}</p>

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {JOB_CARDS.map((job) => (
          <div key={job.title} className="card-soft p-6 hover:border-secondary/30">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-bold text-lg text-gray-900">{job.title}</h2>
              <span className="px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-semibold shadow-accent">{job.type}</span>
            </div>
            <p className="text-gray-500 text-sm mb-2">{job.location}</p>
            <p className="text-gray-700 mb-4 leading-relaxed text-sm">{job.desc}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {job.tags.map((tag) => (
                <span key={tag} className="px-3 py-1.5 rounded-xl bg-secondary/15 text-primary text-sm font-medium">{tag}</span>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-secondary/10">
              <span className="font-bold text-primary">{job.pay}</span>
              <button type="button" className="btn-primary py-2 px-4 text-sm">
                {t("findJobs.apply")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-14">
        <p className="text-gray-600 mb-4">{t("findJobs.notFound")}</p>
        <Link to="/contact" className="btn-secondary">
          {t("findJobs.contactUs")}
        </Link>
      </div>
    </div>
  );
}
