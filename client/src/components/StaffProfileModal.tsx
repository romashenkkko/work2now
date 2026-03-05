import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Mail, User, MessageSquare, X, LayoutGrid } from "lucide-react";
import StarRating from "./StarRating";
import { ratingsApi, experiencesApi, type ReviewItem, type Experience } from "../api/client";
import { JobTitleIcon, JOB_TITLE_OPTIONS } from "../pages/DashboardLayout";

const DEFAULT_AVATAR = "/Illustration/AvatarWhiteGuy.png";

const JOB_CATEGORY_TO_ICON_ID: Record<number, string> = {
  1: "waiter",
  2: "chef",
  3: "dishwasher",
  4: "barista",
  5: "bartender",
  6: "cleaner",
  7: "receptionist",
  8: "chef",
};

function ReviewPhotoThumb({ photoUrl }: { photoUrl: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:ring-2 hover:ring-primary/30 w-14 h-14 object-cover block"
        aria-label={t("dashboard.photo", "Poză")}
      >
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white"
              aria-label={t("dashboard.close", "Închide")}
            >
              <X className="w-5 h-5" />
            </button>
            <img src={photoUrl} alt="" className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}

export type StaffProfileModalProps = {
  open: boolean;
  onClose: () => void;
  staffId: string;
  staffName?: string;
  staffEmail?: string;
  staffAvatar?: string;
};

export default function StaffProfileModal({
  open,
  onClose,
  staffId,
  staffName = "",
  staffEmail = "",
  staffAvatar = DEFAULT_AVATAR,
}: StaffProfileModalProps) {
  const { t } = useTranslation();
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [selectedExperienceJobLabel, setSelectedExperienceJobLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredReviews =
    selectedExperienceJobLabel != null
      ? reviews.filter((r) => (r.jobTitle ?? "").trim() === selectedExperienceJobLabel)
      : reviews;

  const uniqueExperiences = useMemo(() => {
    const byIconId = new Map<string, Experience>();
    for (const exp of experiences) {
      const iconId = JOB_CATEGORY_TO_ICON_ID[exp.jobCategory] ?? String(exp.jobCategory);
      const existing = byIconId.get(iconId);
      if (!existing || exp.duration > existing.duration) {
        byIconId.set(iconId, exp);
      }
    }
    return Array.from(byIconId.values());
  }, [experiences]);

  useEffect(() => {
    if (!open || !staffId?.trim()) return;
    setLoading(true);
    setError(null);
    Promise.all([
      ratingsApi.getUserRating(staffId).catch(() => ({ average: 0, count: 0 })),
      ratingsApi.getReviewsReceivedBy(staffId).catch(() => ({ reviews: [] as ReviewItem[] })),
      experiencesApi.listByUser(staffId).catch(() => ({ experiences: [] as Experience[] })),
    ])
      .then(([summary, received, expData]) => {
        setRatingSummary(summary);
        setReviews(received.reviews ?? []);
        setExperiences(expData.experiences ?? []);
        setSelectedExperienceJobLabel(null);
      })
      .catch(() => setError(t("dashboard.errorLoadingProfile", "Eroare la încărcarea profilului.")))
      .finally(() => setLoading(false));
  }, [open, staffId, t]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      className="modal-backdrop-anim fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-profile-title"
    >
      <div
        className="modal-panel-anim bg-white rounded-2xl shadow-xl max-w-4xl max-h-[95vh] w-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <h2 id="staff-profile-title" className="text-lg font-bold text-gray-900">
            {staffName || t("dashboard.staffMember", "Membru staff")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            aria-label={t("dashboard.close", "Închide")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="modal-element-anim flex flex-wrap items-center gap-4" style={{ animationDelay: "0.05s" }}>
            <div className="flex-shrink-0 w-16 h-16 rounded-full overflow-hidden bg-primary/10 border-2 border-primary/20">
              <img
                src={staffAvatar}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {staffName || t("dashboard.staffMember", "Membru staff")}
              </h3>
              {staffEmail && (
                <p className="text-gray-600 flex items-center gap-1.5 mt-1">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{staffEmail}</span>
                </p>
              )}
              {ratingSummary && ratingSummary.count > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <StarRating value={ratingSummary.average} size={20} />
                  <span className="text-sm text-gray-600">
                    {ratingSummary.average.toFixed(1)} ({ratingSummary.count} {ratingSummary.count === 1 ? t("dashboard.review", "review") : t("dashboard.reviews", "recenzii")})
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="modal-element-anim p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm" style={{ animationDelay: "0.08s" }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-500 text-sm">
              {t("dashboard.loading")}
            </div>
          ) : (
            <div className="modal-element-anim" style={{ animationDelay: "0.1s" }}>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">
                {t("dashboard.professionalExperiencesAll", "Experiențe profesionale (toate)")}
              </h3>
              {uniqueExperiences.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border border-gray-100">
                  {t("dashboard.noExperiencesYet", "Nicio experiență adăugată.")}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedExperienceJobLabel(null)}
                    className={`w-full text-left rounded-lg p-2.5 sm:p-3 border flex gap-2.5 transition-colors ${
                      selectedExperienceJobLabel == null
                        ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 flex items-center">
                      <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                        {t("dashboard.all", "Toate")}
                      </p>
                    </div>
                  </button>
                  {uniqueExperiences.map((exp) => {
                    const iconId = JOB_CATEGORY_TO_ICON_ID[exp.jobCategory] ?? "";
                    const labelKey = JOB_TITLE_OPTIONS.find((o) => o.id === iconId)?.labelKey;
                    const jobLabel = labelKey ? t(labelKey) : t("dashboard.experience", "Experiență");
                    const durationLabel =
                      exp.duration === 1
                        ? t("dashboard.experienceDurationNone", "Fără experiență")
                        : exp.duration === 2
                          ? t("dashboard.experienceDurationLessThanOne", "Mai puțin de 1 an")
                          : exp.duration === 3
                            ? t("dashboard.experienceDurationOneToFive", "1-5 ani")
                            : exp.duration === 4
                              ? t("dashboard.experienceDurationMoreThanFive", "Mai mult de 5 ani")
                              : "";
                    const descriptionText = exp.description?.trim() || t("dashboard.addedDuringOnboarding", "Added during onboarding");
                    const hasCustomDesc = exp.description?.trim() && exp.description.trim().toLowerCase() !== "added during onboarding";
                    const isSelected = selectedExperienceJobLabel === jobLabel;
                    return (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() => setSelectedExperienceJobLabel(isSelected ? null : jobLabel)}
                        className={`w-full text-left rounded-lg p-2.5 sm:p-3 border flex gap-2.5 transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <JobTitleIcon jobId={iconId} className="w-4 h-4 text-primary" size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{jobLabel}</p>
                          {durationLabel && (
                            <p className="text-xs text-gray-500 truncate">{durationLabel}</p>
                          )}
                          {hasCustomDesc && (
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{descriptionText}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <h3 className="modal-element-anim text-sm font-semibold text-gray-600 mb-3 mt-6" style={{ animationDelay: "0.18s" }}>
                {selectedExperienceJobLabel
                  ? t("dashboard.reviewsForJob", "Recenziile primite") + ` (${selectedExperienceJobLabel})`
                  : t("dashboard.reviewsReceived", "Recenziile primite")}
              </h3>
              {filteredReviews.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border border-gray-100">
                  {selectedExperienceJobLabel
                    ? t("dashboard.noReviewsForThisJob", "Nicio recenzie pentru acest job.")
                    : t("dashboard.noReviewsYet", "Încă nu are recenzii.")}
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredReviews.map((r, i) => (
                    <li
                      key={r.id}
                      className="review-card-anim bg-white rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StarRating value={r.score} size={18} />
                        {r.otherPartyName && <span className="text-sm font-semibold text-[#333]">— {r.otherPartyName}</span>}
                        {r.jobTitle && <span className="text-sm text-gray-500">{r.jobTitle}</span>}
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-700 flex items-start gap-1 mt-2">
                          <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                          {r.comment}
                        </p>
                      )}
                      {r.photoUrl && (
                        <div className="mt-2">
                          <ReviewPhotoThumb photoUrl={r.photoUrl} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
