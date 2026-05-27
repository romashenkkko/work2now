import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChefHat,
  LayoutGrid,
  MoreHorizontal,
  Search,
  Sparkles,
  Utensils,
  Wine,
} from "lucide-react";
import { experiencesApi } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { MIN_EXPERIENCE_DESCRIPTION_LENGTH } from "../constants/experienceDescription";

// Job categories matching the database enum (codes 1-22)
enum JobCategory {
  Barback = 1,
  Barista = 2,
  Bartender = 3,
  Cashier = 4,
  Chef = 5,
  ChefHead = 6,
  ChefPastry = 7,
  ChefSous = 8,
  ChefSushi = 9,
  Cleaner = 10,
  CocktailBartender = 11,
  Dishwasher = 12,
  EventCrew = 13,
  GroceryStoreWorker = 14,
  HeadWaiter = 15,
  Housekeeper = 16,
  Maintenance = 17,
  Pizzaiolo = 18,
  Receptionist = 19,
  Sommelier = 20,
  T2SAppTester = 21,
  Waiter = 22,
}

// Experience duration matching the enum
enum ExperienceDuration {
  NoExperience = 1,
  LessThanOneYear = 2,
  OneToFiveYears = 3,
  MoreThanFiveYears = 4,
}

type CategoryGroup = "kitchen" | "bar" | "service" | "cleaning" | "other";

type JobCategoryDef = {
  id: JobCategory;
  name: string;
  icon: string;
  image: string;
  group: CategoryGroup;
};

const ILLUSTRATION_BASE = "/Illustration/Experience";

const JOB_CATEGORIES: JobCategoryDef[] = [
  { id: JobCategory.Barback, name: "Barback", icon: "🍺", image: `${ILLUSTRATION_BASE}/barback.png`, group: "bar" },
  { id: JobCategory.Barista, name: "Barista", icon: "☕", image: `${ILLUSTRATION_BASE}/barista.png`, group: "bar" },
  { id: JobCategory.Bartender, name: "Bartender", icon: "🍸", image: `${ILLUSTRATION_BASE}/bartender.png`, group: "bar" },
  { id: JobCategory.Cashier, name: "Cashier", icon: "💰", image: `${ILLUSTRATION_BASE}/cashier.png`, group: "service" },
  { id: JobCategory.Chef, name: "Chef", icon: "👨‍🍳", image: `${ILLUSTRATION_BASE}/chef.png`, group: "kitchen" },
  { id: JobCategory.ChefHead, name: "Chef (Head)", icon: "👨‍🍳", image: `${ILLUSTRATION_BASE}/chef-head.png`, group: "kitchen" },
  { id: JobCategory.ChefPastry, name: "Chef (Pastry)", icon: "🧁", image: `${ILLUSTRATION_BASE}/chef-pastry.png`, group: "kitchen" },
  { id: JobCategory.ChefSous, name: "Chef (Sous)", icon: "👨‍🍳", image: `${ILLUSTRATION_BASE}/chef-sous.png`, group: "kitchen" },
  { id: JobCategory.ChefSushi, name: "Chef (Sushi)", icon: "🍣", image: `${ILLUSTRATION_BASE}/chef-sushi.png`, group: "kitchen" },
  { id: JobCategory.Cleaner, name: "Cleaner", icon: "🧹", image: `${ILLUSTRATION_BASE}/cleaner.png`, group: "cleaning" },
  { id: JobCategory.CocktailBartender, name: "Cocktail Bartender", icon: "🍹", image: `${ILLUSTRATION_BASE}/cocktail-bartender.png`, group: "bar" },
  { id: JobCategory.Dishwasher, name: "Dishwasher", icon: "🧽", image: `${ILLUSTRATION_BASE}/dishwasher.png`, group: "cleaning" },
  { id: JobCategory.EventCrew, name: "Event Crew", icon: "🎉", image: `${ILLUSTRATION_BASE}/event-crew.png`, group: "service" },
  { id: JobCategory.GroceryStoreWorker, name: "Grocery Store Worker", icon: "🛒", image: `${ILLUSTRATION_BASE}/grocery-store-worker.png`, group: "service" },
  { id: JobCategory.HeadWaiter, name: "Head Waiter", icon: "🍽️", image: `${ILLUSTRATION_BASE}/head-waiter.png`, group: "service" },
  { id: JobCategory.Housekeeper, name: "Housekeeper", icon: "🏠", image: `${ILLUSTRATION_BASE}/housekeeper.png`, group: "cleaning" },
  { id: JobCategory.Maintenance, name: "Maintenance", icon: "🔧", image: `${ILLUSTRATION_BASE}/maintenance.png`, group: "service" },
  { id: JobCategory.Pizzaiolo, name: "Pizzaiolo", icon: "🍕", image: `${ILLUSTRATION_BASE}/pizzaiolo.png`, group: "kitchen" },
  { id: JobCategory.Receptionist, name: "Receptionist", icon: "📞", image: `${ILLUSTRATION_BASE}/receptionist.png`, group: "service" },
  { id: JobCategory.Sommelier, name: "Sommelier", icon: "🍷", image: `${ILLUSTRATION_BASE}/sommelier.png`, group: "bar" },
  { id: JobCategory.T2SAppTester, name: "T2S App Tester", icon: "📱", image: `${ILLUSTRATION_BASE}/app-tester.png`, group: "other" },
  { id: JobCategory.Waiter, name: "Waiter", icon: "🍽️", image: `${ILLUSTRATION_BASE}/waiter.png`, group: "service" },
];

type GroupFilter = "all" | CategoryGroup;

const GROUP_FILTERS: Array<{ id: GroupFilter; labelKey: string; Icon: typeof LayoutGrid }> = [
  { id: "all", labelKey: "onboarding.filterAll", Icon: LayoutGrid },
  { id: "kitchen", labelKey: "onboarding.filterKitchen", Icon: ChefHat },
  { id: "bar", labelKey: "onboarding.filterBar", Icon: Wine },
  { id: "service", labelKey: "onboarding.filterService", Icon: Utensils },
  { id: "cleaning", labelKey: "onboarding.filterCleaning", Icon: Sparkles },
  { id: "other", labelKey: "onboarding.filterOther", Icon: MoreHorizontal },
];

function CategoryThumb({ category, className = "h-8 w-8" }: { category: JobCategoryDef; className?: string }) {
  return (
    <img
      src={category.image}
      alt=""
      aria-hidden
      className={`${className} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
      loading="lazy"
    />
  );
}

/** La onboarding nu oferim „Fără experiență” (id 1). */
const ONBOARDING_DURATION_IDS = [
  ExperienceDuration.LessThanOneYear,
  ExperienceDuration.OneToFiveYears,
  ExperienceDuration.MoreThanFiveYears,
] as const;

export default function EmployeeOnboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategories, setSelectedCategories] = useState<JobCategory[]>([]);
  const [categoryDurations, setCategoryDurations] = useState<Record<number, ExperienceDuration>>({});
  const [categoryDescriptions, setCategoryDescriptions] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      hasMountedRef.current = true;
    }, 900);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (authLoading || !user || user.role?.toLowerCase() !== "staff") return;
    experiencesApi
      .checkOnboarding()
      .then((r) => {
        if (!r.needsOnboarding) navigate("/dashboard", { replace: true });
      })
      .catch(() => {});
  }, [authLoading, user, navigate]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return JOB_CATEGORIES.filter((c) => {
      if (groupFilter !== "all" && c.group !== groupFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [searchQuery, groupFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        {t("onboarding.loading")}
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role?.toLowerCase() !== "staff") {
    return <Navigate to="/dashboard" replace />;
  }

  const toggleCategory = (categoryId: JobCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        const newDurations = { ...categoryDurations };
        delete newDurations[categoryId];
        setCategoryDurations(newDurations);
        const newDesc = { ...categoryDescriptions };
        delete newDesc[categoryId];
        setCategoryDescriptions(newDesc);
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
    setError(null);
  };

  const handleCategoryNext = () => {
    if (selectedCategories.length === 0) {
      setError(t("onboarding.selectOneCategory"));
      return;
    }
    setStep(2);
    setError(null);
  };

  const handleDurationChange = (categoryId: number, duration: ExperienceDuration) => {
    setCategoryDurations((prev) => ({
      ...prev,
      [categoryId]: duration,
    }));
    setError(null);
  };

  const handleDescriptionChange = (categoryId: number, value: string) => {
    setCategoryDescriptions((prev) => ({ ...prev, [categoryId]: value }));
    setError(null);
  };

  const step2Incomplete = selectedCategories.some((catId) => {
    if (!categoryDurations[catId]) return true;
    return (categoryDescriptions[catId] ?? "").trim().length < MIN_EXPERIENCE_DESCRIPTION_LENGTH;
  });

  const durationLabel = (id: ExperienceDuration) => {
    switch (id) {
      case ExperienceDuration.LessThanOneYear:
        return t("dashboard.experienceDurationLessThanOne");
      case ExperienceDuration.OneToFiveYears:
        return t("dashboard.experienceDurationOneToFive");
      case ExperienceDuration.MoreThanFiveYears:
        return t("dashboard.experienceDurationMoreThanFive");
      default:
        return "";
    }
  };

  const handleSubmit = async () => {
    const missingDurations = selectedCategories.filter((catId) => !categoryDurations[catId]);
    if (missingDurations.length > 0) {
      setError(t("onboarding.missingDurationError"));
      return;
    }

    const shortDesc = selectedCategories.find(
      (catId) => (categoryDescriptions[catId] ?? "").trim().length < MIN_EXPERIENCE_DESCRIPTION_LENGTH
    );
    if (shortDesc != null) {
      setError(t("onboarding.minDescriptionError", { min: MIN_EXPERIENCE_DESCRIPTION_LENGTH }));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const experiences = selectedCategories.map((categoryId) => ({
        jobCategory: categoryId,
        duration: categoryDurations[categoryId],
        description: (categoryDescriptions[categoryId] ?? "").trim(),
      }));

      await experiencesApi.submitOnboarding(experiences);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError((e as Error).message || t("onboarding.saveError"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/5 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold transition-colors duration-300 ${
                step >= 1 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              1
            </div>
            <div className={`h-1 w-12 sm:w-20 transition-colors duration-300 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold transition-colors duration-300 ${
                step >= 2 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              2
            </div>
          </div>
          <p className="text-center text-xs sm:text-sm text-gray-600">{t("onboarding.stepProgress", { step })}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 sm:p-6 md:p-8">
          {step === 1 && (
            <>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 onboarding-fade-down">
                {user?.name?.trim()
                  ? t("onboarding.welcome", { name: user.name.trim() })
                  : t("onboarding.welcomeNoName")}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 onboarding-fade-down" style={{ animationDelay: "60ms" }}>
                {t("onboarding.step1Lead")}
              </p>

              {error && (
                <div className="mb-4 sm:mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              <div className="mb-4 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
                <div
                  className="relative flex-1 onboarding-fade-down"
                  style={{ animationDelay: "120ms" }}
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("onboarding.searchPlaceholder")}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide -mx-1 px-1 sm:mx-0 sm:px-0">
                  {GROUP_FILTERS.map(({ id, labelKey, Icon }, idx) => {
                    const isActive = groupFilter === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setGroupFilter(id)}
                        style={{ animationDelay: `${160 + idx * 50}ms` }}
                        className={`onboarding-filter-enter inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredCategories.length === 0 ? (
                <div className="mb-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500 onboarding-fade-down">
                  {t("onboarding.noResults")}
                </div>
              ) : (
                <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {filteredCategories.map((category, idx) => {
                    const isSelected = selectedCategories.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        aria-pressed={isSelected}
                        style={!hasMountedRef.current ? { animationDelay: `${Math.min(idx * 30, 600)}ms` } : undefined}
                        className={`${
                          !hasMountedRef.current ? "onboarding-card-enter" : ""
                        } group relative aspect-square overflow-hidden rounded-2xl border bg-white transition-all duration-200 active:scale-[0.97] ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 shadow-md -translate-y-0.5"
                            : "border-gray-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                        }`}
                      >
                        <img
                          src={category.image}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          loading="lazy"
                        />

                        <div className="pointer-events-none absolute inset-x-0 top-0 px-2.5 pt-2 sm:px-3 sm:pt-3 text-left">
                          <span
                            className={`block text-xs sm:text-sm font-semibold leading-tight transition-colors ${
                              isSelected ? "text-primary" : "text-gray-900"
                            }`}
                            style={{
                              textShadow:
                                "0 1px 2px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.7)",
                            }}
                          >
                            {category.name}
                          </span>
                        </div>

                        {isSelected && (
                          <span
                            aria-hidden
                            className="onboarding-check-pop absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-2 ring-white"
                          >
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        )}

                        {isSelected && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/5"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end onboarding-fade-down" style={{ animationDelay: "200ms" }}>
                <button
                  type="button"
                  onClick={handleCategoryNext}
                  disabled={selectedCategories.length === 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm hover:shadow-md"
                >
                  {t("onboarding.continue")}
                  {selectedCategories.length > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-semibold">
                      {selectedCategories.length}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 onboarding-fade-down">
                {t("onboarding.step2Title")}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 onboarding-fade-down" style={{ animationDelay: "60ms" }}>
                {t("onboarding.step2Lead", { min: MIN_EXPERIENCE_DESCRIPTION_LENGTH })}
              </p>

              {error && (
                <div className="mb-4 sm:mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              <div className="space-y-4 sm:space-y-6 mb-6">
                {selectedCategories.map((categoryId, idx) => {
                  const category = JOB_CATEGORIES.find((c) => c.id === categoryId);
                  const selectedDuration = categoryDurations[categoryId];
                  const desc = categoryDescriptions[categoryId] ?? "";
                  const descLen = desc.trim().length;

                  return (
                    <div
                      key={categoryId}
                      className="onboarding-step-card-enter p-3 sm:p-4 border border-gray-200 rounded-xl bg-gray-50 transition-shadow hover:shadow-sm"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {category ? <CategoryThumb category={category} className="h-10 w-10 sm:h-12 sm:w-12" /> : null}
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{category?.name}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {ONBOARDING_DURATION_IDS.map((durationId) => (
                          <button
                            key={durationId}
                            type="button"
                            onClick={() => handleDurationChange(categoryId, durationId)}
                            className={`px-3 sm:px-4 py-2 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                              selectedDuration === durationId
                                ? "border-primary bg-primary text-white shadow-sm"
                                : "border-gray-200 hover:border-primary/40 text-gray-700 bg-white"
                            }`}
                          >
                            {durationLabel(durationId)}
                          </button>
                        ))}
                      </div>

                      {selectedDuration != null && (
                        <div key={`desc-${selectedDuration}`} className="onboarding-detail-expand mt-3 sm:mt-4 space-y-2">
                          <label
                            htmlFor={`exp-desc-${categoryId}`}
                            className="block text-xs sm:text-sm font-medium text-gray-800"
                          >
                            {t("onboarding.describeLabel")}
                          </label>
                          <textarea
                            id={`exp-desc-${categoryId}`}
                            rows={4}
                            value={desc}
                            onChange={(e) => handleDescriptionChange(categoryId, e.target.value)}
                            placeholder={t("onboarding.describePlaceholder")}
                            className={`w-full rounded-xl border px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${
                              descLen > 0 && descLen < MIN_EXPERIENCE_DESCRIPTION_LENGTH
                                ? "border-amber-300 ring-1 ring-amber-200"
                                : "border-gray-200"
                            }`}
                          />
                          <p
                            className={`text-xs transition-colors ${
                              descLen >= MIN_EXPERIENCE_DESCRIPTION_LENGTH ? "text-green-700" : "text-gray-500"
                            }`}
                          >
                            {t("onboarding.charsHint", {
                              current: descLen,
                              min: MIN_EXPERIENCE_DESCRIPTION_LENGTH,
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-0 onboarding-fade-down" style={{ animationDelay: "200ms" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all active:scale-95"
                >
                  {t("onboarding.back")}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || step2Incomplete}
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm hover:shadow-md"
                >
                  {loading ? t("onboarding.saving") : t("onboarding.finalize")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
