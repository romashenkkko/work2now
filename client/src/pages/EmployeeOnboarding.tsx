import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { experiencesApi } from "../api/client";
import { useAuth } from "../hooks/useAuth";

// Job categories matching the enum
enum JobCategory {
  Waiter = 1,
  Chef = 2,
  Dishwasher = 3,
  Barista = 4,
  Bartender = 5,
  Cleaner = 6,
  Receptionist = 7,
  CookAssistant = 8,
}

// Experience duration matching the enum
enum ExperienceDuration {
  NoExperience = 1,
  LessThanOneYear = 2,
  OneToFiveYears = 3,
  MoreThanFiveYears = 4,
}

const JOB_CATEGORIES = [
  { id: JobCategory.Waiter, name: "Waiter", icon: "🍽️" },
  { id: JobCategory.Chef, name: "Chef", icon: "👨‍🍳" },
  { id: JobCategory.Dishwasher, name: "Dishwasher", icon: "🧽" },
  { id: JobCategory.Barista, name: "Barista", icon: "☕" },
  { id: JobCategory.Bartender, name: "Bartender", icon: "🍸" },
  { id: JobCategory.Cleaner, name: "Cleaner", icon: "🧹" },
  { id: JobCategory.Receptionist, name: "Receptionist", icon: "📞" },
  { id: JobCategory.CookAssistant, name: "Cook Assistant", icon: "👨‍🍳" },
];

const EXPERIENCE_DURATIONS = [
  { id: ExperienceDuration.NoExperience, name: "No Experience", label: "Fără experiență" },
  { id: ExperienceDuration.LessThanOneYear, name: "LessThanOneYear", label: "Mai puțin de 1 an" },
  { id: ExperienceDuration.OneToFiveYears, name: "OneToFiveYears", label: "1-5 ani" },
  { id: ExperienceDuration.MoreThanFiveYears, name: "MoreThanFiveYears", label: "Mai mult de 5 ani" },
];

export default function EmployeeOnboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  // Redirect if not logged in or not staff
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role?.toLowerCase() !== "staff") {
    return <Navigate to="/dashboard" replace />;
  }
  const [selectedCategories, setSelectedCategories] = useState<JobCategory[]>([]);
  const [categoryDurations, setCategoryDurations] = useState<Record<number, ExperienceDuration>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (categoryId: JobCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        // Remove category and its duration
        const newDurations = { ...categoryDurations };
        delete newDurations[categoryId];
        setCategoryDurations(newDurations);
        return prev.filter((id) => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    setError(null);
  };

  const handleCategoryNext = () => {
    if (selectedCategories.length === 0) {
      setError("Vă rugăm să selectați cel puțin o categorie de job.");
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

  const handleSubmit = async () => {
    // Validate all selected categories have durations
    const missingDurations = selectedCategories.filter((catId) => !categoryDurations[catId]);
    if (missingDurations.length > 0) {
      setError("Vă rugăm să selectați durata experienței pentru toate categoriile alese.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const experiences = selectedCategories.map((categoryId) => ({
        jobCategory: categoryId,
        duration: categoryDurations[categoryId],
      }));

      await experiencesApi.submitOnboarding(experiences);
      // Redirect to dashboard after successful onboarding
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError((e as Error).message || "Eroare la salvarea experiențelor.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= 1 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
            }`}>
              1
            </div>
            <div className={`h-1 w-20 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= 2 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
            }`}>
              2
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">
            Pas {step} din 2
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 sm:p-8">
          {step === 1 && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Bine ai venit, {user?.name}!
              </h1>
              <p className="text-gray-600 mb-6">
                Selectează categoriile de joburi în care ai experiență. Poți selecta mai multe.
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm">
                  {error}
                </div>
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
                      <div className={`text-sm font-medium ${
                        isSelected ? "text-primary" : "text-gray-700"
                      }`}>
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
                  Continuă →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Durata experienței
              </h1>
              <p className="text-gray-600 mb-6">
                Selectează durata experienței pentru fiecare categorie de job selectată.
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6">
                {selectedCategories.map((categoryId) => {
                  const category = JOB_CATEGORIES.find((c) => c.id === categoryId);
                  const selectedDuration = categoryDurations[categoryId];

                  return (
                    <div
                      key={categoryId}
                      className="p-4 border border-gray-200 rounded-xl bg-gray-50"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{category?.icon}</span>
                        <h3 className="font-semibold text-gray-900">{category?.name}</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {EXPERIENCE_DURATIONS.map((duration) => (
                          <button
                            key={duration.id}
                            type="button"
                            onClick={() => handleDurationChange(categoryId, duration.id)}
                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                              selectedDuration === duration.id
                                ? "border-primary bg-primary text-white"
                                : "border-gray-200 hover:border-gray-300 text-gray-700"
                            }`}
                          >
                            {duration.label}
                          </button>
                        ))}
                      </div>
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
                  ← Înapoi
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || selectedCategories.some((catId) => !categoryDurations[catId])}
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Salvare..." : "Finalizează"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

