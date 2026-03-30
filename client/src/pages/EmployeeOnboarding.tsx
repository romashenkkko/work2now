import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const JOB_CATEGORIES = [
  { id: JobCategory.Barback, name: "Barback", icon: "🍺" },
  { id: JobCategory.Barista, name: "Barista", icon: "☕" },
  { id: JobCategory.Bartender, name: "Bartender", icon: "🍸" },
  { id: JobCategory.Cashier, name: "Cashier", icon: "💰" },
  { id: JobCategory.Chef, name: "Chef", icon: "👨‍🍳" },
  { id: JobCategory.ChefHead, name: "Chef (Head)", icon: "👨‍🍳" },
  { id: JobCategory.ChefPastry, name: "Chef (Pastry)", icon: "🧁" },
  { id: JobCategory.ChefSous, name: "Chef (Sous)", icon: "👨‍🍳" },
  { id: JobCategory.ChefSushi, name: "Chef (Sushi)", icon: "🍣" },
  { id: JobCategory.Cleaner, name: "Cleaner", icon: "🧹" },
  { id: JobCategory.CocktailBartender, name: "Cocktail Bartender", icon: "🍹" },
  { id: JobCategory.Dishwasher, name: "Dishwasher", icon: "🧽" },
  { id: JobCategory.EventCrew, name: "Event Crew", icon: "🎉" },
  { id: JobCategory.GroceryStoreWorker, name: "Grocery Store Worker", icon: "🛒" },
  { id: JobCategory.HeadWaiter, name: "Head Waiter", icon: "🍽️" },
  { id: JobCategory.Housekeeper, name: "Housekeeper", icon: "🏠" },
  { id: JobCategory.Maintenance, name: "Maintenance", icon: "🔧" },
  { id: JobCategory.Pizzaiolo, name: "Pizzaiolo", icon: "🍕" },
  { id: JobCategory.Receptionist, name: "Receptionist", icon: "📞" },
  { id: JobCategory.Sommelier, name: "Sommelier", icon: "🍷" },
  { id: JobCategory.T2SAppTester, name: "T2S App Tester", icon: "📱" },
  { id: JobCategory.Waiter, name: "Waiter", icon: "🍽️" },
];

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

  // Redirect if not logged in or not staff
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
  const [selectedCategories, setSelectedCategories] = useState<JobCategory[]>([]);
  const [categoryDurations, setCategoryDurations] = useState<Record<number, ExperienceDuration>>({});
  const [categoryDescriptions, setCategoryDescriptions] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= 1 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              1
            </div>
            <div className={`h-1 w-20 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= 2 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              2
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">{t("onboarding.stepProgress", { step })}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 sm:p-8">
          {step === 1 && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {user?.name?.trim()
                  ? t("onboarding.welcome", { name: user.name.trim() })
                  : t("onboarding.welcomeNoName")}
              </h1>
              <p className="text-gray-600 mb-6">{t("onboarding.step1Lead")}</p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                {JOB_CATEGORIES.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-md scale-105"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-3xl mb-2">{category.icon}</div>
                      <div className={`text-sm font-medium ${isSelected ? "text-primary" : "text-gray-700"}`}>
                        {category.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCategoryNext}
                  disabled={selectedCategories.length === 0}
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t("onboarding.continue")}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t("onboarding.step2Title")}</h1>
              <p className="text-gray-600 mb-6">
                {t("onboarding.step2Lead", { min: MIN_EXPERIENCE_DESCRIPTION_LENGTH })}
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm">{error}</div>
              )}

              <div className="space-y-6 mb-6">
                {selectedCategories.map((categoryId) => {
                  const category = JOB_CATEGORIES.find((c) => c.id === categoryId);
                  const selectedDuration = categoryDurations[categoryId];
                  const desc = categoryDescriptions[categoryId] ?? "";
                  const descLen = desc.trim().length;

                  return (
                    <div key={categoryId} className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{category?.icon}</span>
                        <h3 className="font-semibold text-gray-900">{category?.name}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {ONBOARDING_DURATION_IDS.map((durationId) => (
                          <button
                            key={durationId}
                            type="button"
                            onClick={() => handleDurationChange(categoryId, durationId)}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                              selectedDuration === durationId
                                ? "border-primary bg-primary text-white"
                                : "border-gray-200 hover:border-gray-300 text-gray-700"
                            }`}
                          >
                            {durationLabel(durationId)}
                          </button>
                        ))}
                      </div>

                      {selectedDuration != null && (
                        <div className="mt-4 space-y-2">
                          <label
                            htmlFor={`exp-desc-${categoryId}`}
                            className="block text-sm font-medium text-gray-800"
                          >
                            {t("onboarding.describeLabel")}
                          </label>
                          <textarea
                            id={`exp-desc-${categoryId}`}
                            rows={5}
                            value={desc}
                            onChange={(e) => handleDescriptionChange(categoryId, e.target.value)}
                            placeholder={t("onboarding.describePlaceholder")}
                            className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary ${
                              descLen > 0 && descLen < MIN_EXPERIENCE_DESCRIPTION_LENGTH
                                ? "border-amber-300 ring-1 ring-amber-200"
                                : "border-gray-200"
                            }`}
                          />
                          <p
                            className={`text-xs ${
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

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  {t("onboarding.back")}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || step2Incomplete}
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
