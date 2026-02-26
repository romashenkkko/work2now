import { useState, useEffect } from "react";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import { branchesApi, type Branch } from "../api/client";

interface BranchesSectionProps {
  onBack: () => void;
  t: (key: string) => string;
}

// We extend Branch locally so this file compiles even if api/client.ts type isn't updated yet.
type BranchExt = Branch & {
  contactPersonName?: string;
  contactPersonSurname?: string;
};

export default function BranchesSection({ onBack, t }: BranchesSectionProps) {
  const [branches, setBranches] = useState<BranchExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "", // branch name
    contactPersonName: "",
    contactPersonSurname: "",
    address: "",
    city: "",
    country: "Moldova",
    phoneNumber: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await branchesApi.list();
      // cast to BranchExt to allow the new optional fields
      setBranches((data.branches as BranchExt[]) || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      name: "",
      contactPersonName: "",
      contactPersonSurname: "",
      address: "",
      city: "",
      country: "Moldova",
      phoneNumber: "",
    });
    setShowForm(true);
    setMessage(null);
  };

  const handleEdit = (branch: BranchExt) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      contactPersonName: branch.contactPersonName || "",
      contactPersonSurname: branch.contactPersonSurname || "",
      address: branch.address,
      city: branch.city,
      country: branch.country,
      phoneNumber: branch.phoneNumber,
    });
    setShowForm(true);
    setMessage(null);
  };

  const handleDelete = async (id: string) => {
    const confirmMsg = t("profile.branches.confirmDelete") || "Are you sure you want to delete this branch?";
    if (!confirm(confirmMsg)) return;
    try {
      await branchesApi.delete(id);
      setMessage({ type: "success", text: t("profile.branches.deleted") || "Branch deleted successfully" });
      loadBranches();
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.contactPersonName.trim() ||
      !formData.contactPersonSurname.trim() ||
      !formData.address.trim() ||
      !formData.city.trim() ||
      !formData.phoneNumber.trim()
    ) {
      setMessage({
        type: "error",
        text: t("profile.branches.allFieldsRequired") || "All fields are required",
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await branchesApi.update(editingId, formData as any);
        setMessage({ type: "success", text: t("profile.branches.updated") || "Branch updated successfully" });
      } else {
        await branchesApi.create(formData as any);
        setMessage({ type: "success", text: t("profile.branches.created") || "Branch created successfully" });
      }
      setShowForm(false);
      loadBranches();
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

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

      <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("profile.branches.title") || "Manage Branches"}</h2>
      <p className="text-gray-600 text-sm mb-4">
        {t("profile.branches.description") || "Add and manage your business branches"}
      </p>

      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-xl text-sm ${
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={handleCreate}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("profile.branches.addBranch") || "Add Branch"}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-md font-semibold text-gray-900 mb-4">
            {editingId ? t("profile.branches.editBranch") || "Edit Branch" : t("profile.branches.newBranch") || "New Branch"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Branch name */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t("profile.branches.branchName")} *
              </span>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </label>

            {/* Phone */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("profile.branches.phoneNumber")} *</span>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </label>

            {/* Contact person name */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t("profile.branches.contactName")} *
              </span>
              <input
                type="text"
                value={formData.contactPersonName}
                onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </label>

            {/* Contact person surname */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t("profile.branches.contactSurname")} *
              </span>
              <input
                type="text"
                value={formData.contactPersonSurname}
                onChange={(e) => setFormData({ ...formData, contactPersonSurname: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </label>

            {/* Address */}
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700">{t("profile.branches.address")} *</span>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </label>

            {/* City */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("profile.branches.city")} *</span>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </label>

            {/* Country */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("profile.branches.country")}</span>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </label>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "..." : editingId ? t("profile.branches.update") || "Update" : t("profile.branches.create") || "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setMessage(null);
              }}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              {t("profile.branches.cancel") || "Cancel"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t("profile.branches.loading") || "Loading..."}</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {t("profile.branches.noBranches") || "No branches yet. Add your first branch!"}
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <div key={branch.id} className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{branch.name}</h4>

                  {(branch.contactPersonName || branch.contactPersonSurname) && (
                    <p className="text-sm text-gray-600 mb-1">
                      {t("profile.branches.contact") || "Contact"}:{" "}
                      {[branch.contactPersonName, branch.contactPersonSurname].filter(Boolean).join(" ")}
                    </p>
                  )}

                  <p className="text-sm text-gray-600 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {branch.address}, {branch.city}, {branch.country}
                  </p>
                  <p className="text-sm text-gray-600">{branch.phoneNumber}</p>

                  {!branch.isActive && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                      {t("profile.branches.inactive") || "Inactive"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(branch)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title={t("profile.branches.edit") || "Edit"}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(branch.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={t("profile.branches.delete") || "Delete"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
