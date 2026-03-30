import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import { branchesApi, jobsApi, type Branch } from "../api/client";
import AddressPickerModal from "./AddressPickerModal";
import { foldForSearch } from "../utils/foldForSearch";

interface BranchesSectionProps {
  onBack: () => void;
  t: (key: string) => string;
}

// We extend Branch locally so this file compiles even if api/client.ts type isn't updated yet.
type BranchExt = Branch & {
  contactPersonName?: string;
  contactPersonSurname?: string;
};

function filterRaioaneForForm(raioane: Array<{ id: number; name: string; type: string }>) {
  const gagauziaCities = ["Comrat", "Ceadîr-Lunga", "Vulcănești"];
  return raioane.filter(
    (raion) =>
      raion.type === "raion" || (raion.type === "municipiu" && gagauziaCities.includes(raion.name))
  );
}

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
    raionId: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [raioane, setRaioane] = useState<Array<{ id: number; name: string; type: string }>>([]);
  const [raionSearch, setRaionSearch] = useState("");
  const [raionDropdownOpen, setRaionDropdownOpen] = useState(false);
  const raionDropdownRef = useRef<HTMLDivElement>(null);

  const filteredBranchRaioane = useMemo(() => {
    if (!raionSearch.trim()) return raioane;
    const fq = foldForSearch(raionSearch);
    return raioane.filter((r) => foldForSearch(r.name).includes(fq));
  }, [raioane, raionSearch]);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    jobsApi
      .getRaioane()
      .then((r) => setRaioane(filterRaioaneForForm(r.raioane || [])))
      .catch(() => setRaioane([]));
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (raionDropdownRef.current && !raionDropdownRef.current.contains(e.target as Node)) {
        setRaionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
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
      raionId: null,
    });
    setRaionSearch("");
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
      raionId: branch.raionId ?? null,
    });
    setRaionSearch(
      branch.raionId ? (raioane.find((r) => r.id === branch.raionId)?.name ?? "") : ""
    );
    setShowForm(true);
    setMessage(null);
  };

  useEffect(() => {
    if (!showForm || formData.raionId == null || raioane.length === 0) return;
    const name = raioane.find((r) => r.id === formData.raionId)?.name;
    if (!name) return;
    setRaionSearch((prev) => (prev === "" ? name : prev));
  }, [showForm, formData.raionId, raioane]);

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
      !formData.phoneNumber.trim() ||
      !formData.raionId ||
      formData.raionId <= 0
    ) {
      setMessage({
        type: "error",
        text: t("profile.branches.allFieldsRequired") || "All fields are required",
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    const payload = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      country: formData.country.trim() || "Moldova",
      phoneNumber: formData.phoneNumber.trim(),
      raionId: formData.raionId!,
    };
    try {
      if (editingId) {
        await branchesApi.update(editingId, payload);
        setMessage({ type: "success", text: t("profile.branches.updated") || "Branch updated successfully" });
      } else {
        await branchesApi.create(payload);
        setMessage({ type: "success", text: t("profile.branches.created") || "Branch created successfully" });
      }
      setShowForm(false);
      setShowAddressModal(false);
      setRaionSearch("");
      setRaionDropdownOpen(false);
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

            {/* Address — același flux ca la publicarea jobului (căutare Mapbox + hartă) */}
            <div className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700 mb-1 block">
                {t("dashboard.address")} <span className="text-red-500">*</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddressModal(true)}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 bg-white text-left text-sm font-medium text-gray-700 hover:border-primary/40 hover:bg-primary/5 transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {formData.address.trim() ? (
                  <span className="truncate flex-1 text-left">{formData.address}</span>
                ) : (
                  <span>{t("dashboard.addAddress")}</span>
                )}
              </button>
              <p className="mt-1 text-xs text-gray-500">{t("profile.branches.addressPickerHint")}</p>
            </div>

            {/* Raion / municipiu — căutare ca la publicarea jobului */}
            <div className="block md:col-span-2">
              <span className="text-sm font-medium text-gray-700 mb-1 block">
                {t("profile.branches.raionLabel")} <span className="text-red-500">*</span>
              </span>
              <div ref={raionDropdownRef} className="relative">
                <input
                  type="text"
                  value={raionSearch}
                  onChange={(e) => {
                    setRaionSearch(e.target.value);
                    setRaionDropdownOpen(true);
                  }}
                  onFocus={() => setRaionDropdownOpen(true)}
                  placeholder={t("dashboard.raionPlaceholder")}
                  className="mt-1 block w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  aria-autocomplete="list"
                  aria-expanded={raionDropdownOpen}
                  aria-controls="branch-raion-suggestions"
                />
                {raionDropdownOpen && filteredBranchRaioane.length > 0 && (
                  <div
                    id="branch-raion-suggestions"
                    className="absolute left-0 right-0 top-full z-[70] mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1.5 dropdown-enter origin-top"
                    role="listbox"
                    aria-label={t("profile.branches.raionLabel")}
                  >
                    {filteredBranchRaioane.map((raion) => (
                      <button
                        key={raion.id}
                        type="button"
                        role="option"
                        aria-selected={formData.raionId === raion.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData((prev) => ({ ...prev, raionId: raion.id }));
                          setRaionSearch(raion.name);
                          setRaionDropdownOpen(false);
                        }}
                        className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                          formData.raionId === raion.id
                            ? "bg-primary/10 text-primary"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{raion.name}</span>
                          <span className="text-xs text-gray-500 capitalize shrink-0">{raion.type}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {formData.raionId ? (
                <p className="mt-1 text-xs text-gray-500">
                  {t("dashboard.selectedRaion")}: {raioane.find((r) => r.id === formData.raionId)?.name}
                </p>
              ) : null}
            </div>

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
                setShowAddressModal(false);
                setRaionSearch("");
                setRaionDropdownOpen(false);
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
                    {branch.address}, {branch.city}
                    {branch.raionId ? `, ${raioane.find((r) => r.id === branch.raionId)?.name ?? ""}` : ""}, {branch.country}
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

      {showForm &&
        createPortal(
          <AddressPickerModal
            open={showAddressModal}
            onClose={() => setShowAddressModal(false)}
            onConfirm={(address) => {
              setFormData((prev) => ({ ...prev, address: address.trim() }));
            }}
            initialAddress={formData.address}
            defaultRadiusM={200}
            purpose="branch"
          />,
          document.body
        )}
    </section>
  );
}
