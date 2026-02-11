import { useState, useEffect } from "react";
import { Briefcase, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { experiencesApi } from "../api/client";

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
  { id: ExperienceDuration.NoExperience, name: "NoExperience", label: "Fără experiență" },
  { id: ExperienceDuration.LessThanOneYear, name: "LessThanOneYear", label: "Mai puțin de 1 an" },
  { id: ExperienceDuration.OneToFiveYears, name: "OneToFiveYears", label: "1-5 ani" },
  { id: ExperienceDuration.MoreThanFiveYears, name: "MoreThanFiveYears", label: "Mai mult de 5 ani" },
];

export type Experience = {
  id: string;
  jobCategory: number;
  duration: number;
  description: string;
};

interface ExperiencesSectionProps {
  onBack: () => void;
  t: (key: string) => string;
}

export default function ExperiencesSection({ onBack, t }: ExperiencesSectionProps) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    jobCategory: 0,
    duration: 0,
    description: "",
  });
  const [editingDescription, setEditingDescription] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadExperiences();
  }, []);

  const loadExperiences = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experiencesApi.list();
      setExperiences(data.experiences);
      // Initialize editing descriptions
      const descMap: Record<string, string> = {};
      data.experiences.forEach((exp) => {
        descMap[exp.id] = exp.description || "";
      });
      setEditingDescription(descMap);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ jobCategory: 0, duration: 0, description: "" });
    setShowForm(true);
    setMessage(null);
  };

  const handleEdit = (experience: Experience) => {
    setEditingId(experience.id);
    setFormData({
      jobCategory: experience.jobCategory,
      duration: experience.duration,
      description: experience.description || "",
    });
    setShowForm(true);
    setMessage(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sigur doriți să ștergeți această experiență?")) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await experiencesApi.delete(id);
      setExperiences((prev) => prev.filter((exp) => exp.id !== id));
      setMessage({ type: "success", text: "Experiența a fost ștearsă cu succes." });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.jobCategory || !formData.duration) {
      setMessage({ type: "error", text: "Vă rugăm să completați categoria și durata." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        // Update existing
        await experiencesApi.update(editingId, {
          duration: formData.duration,
          description: formData.description,
        });
        setExperiences((prev) =>
          prev.map((exp) =>
            exp.id === editingId
              ? { ...exp, duration: formData.duration, description: formData.description }
              : exp
          )
        );
        setMessage({ type: "success", text: "Experiența a fost actualizată cu succes." });
      } else {
        // Create new
        const newExp = await experiencesApi.create({
          jobCategory: formData.jobCategory,
          duration: formData.duration,
          description: formData.description,
        });
        setExperiences((prev) => [...prev, newExp]);
        setEditingDescription((prev) => ({ ...prev, [newExp.id]: newExp.description || "" }));
        setMessage({ type: "success", text: "Experiența a fost adăugată cu succes." });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ jobCategory: 0, duration: 0, description: "" });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDescription = async (id: string, description: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await experiencesApi.update(id, { description });
      setExperiences((prev) =>
        prev.map((exp) => (exp.id === id ? { ...exp, description } : exp))
      );
      setMessage({ type: "success", text: "Descrierea a fost actualizată." });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (categoryId: number) => {
    return JOB_CATEGORIES.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  const getCategoryIcon = (categoryId: number) => {
    return JOB_CATEGORIES.find((c) => c.id === categoryId)?.icon || "💼";
  };

  const getDurationLabel = (durationId: number) => {
    return EXPERIENCE_DURATIONS.find((d) => d.id === durationId)?.label || "Unknown";
  };

  const getUsedCategories = () => {
    return new Set(experiences.map((exp) => exp.jobCategory));
  };

  const availableCategories = JOB_CATEGORIES.filter(
    (cat) => !getUsedCategories().has(cat.id) || editingId !== null
  );

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("profile.back")}
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Experiențe profesionale</h2>
      <p className="text-sm text-gray-600 mb-6">
        Gestionați experiențele dvs. profesionale și adăugați descrieri detaliate.
      </p>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Se încarcă...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : (
        <>
          {!showForm && (
            <button
              type="button"
              onClick={handleCreate}
              className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-5 h-5" />
              Adaugă experiență
            </button>
          )}

          {showForm && (
            <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {editingId ? "Editează experiență" : "Adaugă experiență nouă"}
              </h3>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Categoria de job <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={formData.jobCategory}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, jobCategory: parseInt(e.target.value, 10) }))
                    }
                    disabled={editingId !== null}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value={0}>Selectează categoria</option>
                    {JOB_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Durata experienței <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value, 10) }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value={0}>Selectează durata</option>
                    {EXPERIENCE_DURATIONS.map((dur) => (
                      <option key={dur.id} value={dur.id}>
                        {dur.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Descriere (opțional)
                  </span>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                    placeholder="Adăugați detalii despre experiența dvs. în această categorie..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !formData.jobCategory || !formData.duration}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "Salvare..." : "Salvează"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setFormData({ jobCategory: 0, duration: 0, description: "" });
                      setMessage(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            </div>
          )}

          {experiences.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Nu aveți experiențe adăugate.</p>
              <p className="text-sm mt-1">Adăugați prima experiență pentru a începe.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{getCategoryIcon(exp.jobCategory)}</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{getCategoryName(exp.jobCategory)}</h4>
                        <p className="text-sm text-gray-600">{getDurationLabel(exp.duration)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(exp)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editează"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(exp.id)}
                        disabled={saving}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Șterge"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-700 mb-1.5 block">
                        Descriere
                      </span>
                      <textarea
                        value={editingDescription[exp.id] || ""}
                        onChange={(e) =>
                          setEditingDescription((prev) => ({
                            ...prev,
                            [exp.id]: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Adăugați detalii despre experiența dvs..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                      />
                      {editingDescription[exp.id] !== (exp.description || "") && (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateDescription(exp.id, editingDescription[exp.id] || "")}
                            disabled={saving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                          >
                            <Save className="w-3 h-3" />
                            Salvează descrierea
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingDescription((prev) => ({
                                ...prev,
                                [exp.id]: exp.description || "",
                              }))
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Anulează
                          </button>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

