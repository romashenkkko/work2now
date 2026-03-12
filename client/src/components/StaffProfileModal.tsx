import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Mail, User, MessageSquare, X, LayoutGrid, Calendar } from "lucide-react";
import StarRating from "./StarRating";
import { ratingsApi, experiencesApi, type ReviewItem, type Experience } from "../api/client";
import { JobTitleIcon, JOB_TITLE_OPTIONS } from "../pages/DashboardLayout";

const DEFAULT_AVATAR = "/Illustration/AvatarWhiteGuy.png";

function avatarSrc(url: string | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const s = url.trim();
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return typeof window !== "undefined" ? `${window.location.origin}${s}` : s;
  return s;
}

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
  /** ID-ul utilizatorului curent (ca să ascundem „Lasă recenzie” când vizualizezi propriul profil). */
  currentUserId?: string;
  /** ID aplicație finalizată la care poți lăsa recenzie pentru acest staff. */
  applicationIdForReview?: string;
  /** Callback după ce recenzia a fost trimisă cu succes (pentru refresh listă aplicații). */
  onReviewSubmitted?: (applicationId: string) => void;
  /** Rating din sidebar (când e profilul propriu), folosit dacă getProfileRatings returnează 0. */
  initialRating?: { average: number; count: number } | null;
  /** Rolul utilizatorului al cărui profil se afișează (customer = fără experiențe profesionale). */
  userRole?: string;
  /** La deschidere, face scroll la secțiunea „Recenziile primite” după încărcare. */
  scrollToReviewsOnOpen?: boolean;
};

export default function StaffProfileModal({
  open,
  onClose,
  staffId,
  staffName = "",
  staffEmail = "",
  staffAvatar = DEFAULT_AVATAR,
  currentUserId,
  applicationIdForReview,
  onReviewSubmitted,
  initialRating,
  userRole,
  scrollToReviewsOnOpen,
}: StaffProfileModalProps) {
  const isCustomer = (userRole ?? "").toLowerCase().trim() === "customer";
  const isOwnProfile = currentUserId != null && String(currentUserId).trim() === String(staffId).trim();
  const canLeaveReview = !isOwnProfile && applicationIdForReview != null && applicationIdForReview.trim() !== "";
  const { t } = useTranslation();
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [selectedExperienceJobLabel, setSelectedExperienceJobLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewJobTitle, setReviewJobTitle] = useState<string | null>(null);
  const [reviewExperienceDropdownOpen, setReviewExperienceDropdownOpen] = useState(false);
  const reviewExperienceDropdownRef = useRef<HTMLDivElement>(null);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);
  const reviewsAnimatedRef = useRef<HTMLDivElement>(null);
  const reviewsAnimatedInnerRef = useRef<HTMLDivElement>(null);
  const reviewsHeightInitializedRef = useRef(false);
  const reviewsHeightRafRef = useRef<number | null>(null);

  const filteredReviews =
    selectedExperienceJobLabel != null
      ? reviews.filter((r) => (r.jobTitle ?? "").trim().toLowerCase() === selectedExperienceJobLabel.trim().toLowerCase())
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

  const reviewExperienceOptions = useMemo(() => {
    return uniqueExperiences.map((exp) => {
      const iconId = JOB_CATEGORY_TO_ICON_ID[exp.jobCategory] ?? "";
      const labelKey = JOB_TITLE_OPTIONS.find((o) => o.id === iconId)?.labelKey;
      const label = labelKey ? t(labelKey) : t("dashboard.experience", "Experiență");
      return { value: label, label };
    });
  }, [uniqueExperiences, t]);

  useEffect(() => {
    if (!open || !staffId?.trim()) return;
    setLoading(true);
    setError(null);
    setReviewSubmitted(false);
    setReviewScore(0);
    setReviewComment("");
    setShowReviewForm(false);
    setReviewJobTitle(null);
    if (initialRating && initialRating.count > 0) {
      setRatingSummary(initialRating);
      setReviews((prev) => prev.length > 0 ? prev : []);
    } else {
      setRatingSummary(null);
    }

    const applyFallbackRating = () => {
      if (initialRating && initialRating.count > 0) {
        setRatingSummary(initialRating);
      }
      ratingsApi.getUserRating(staffId).then((r) => setRatingSummary((prev) => (prev && prev.count > 0 ? prev : { average: r.average, count: r.count }))).catch(() => {});
      ratingsApi.getReviewsReceivedBy(staffId).then((r) => setReviews((prev) => (prev.length > 0 ? prev : r.reviews ?? []))).catch(() => {});
      experiencesApi.listByUser(staffId).then((r) => setExperiences(r.experiences ?? [])).catch(() => {});
    };

    const loadProfile = ratingsApi.getProfileRatings(staffId).catch(() => ({ average: 0, count: 0, reviews: [] as ReviewItem[] }));
    const loadUserRating = !initialRating || initialRating.count === 0
      ? ratingsApi.getUserRating(staffId).catch(() => ({ average: 0, count: 0 }))
      : Promise.resolve(null as { average: number; count: number } | null);
    Promise.all([
      loadProfile,
      loadUserRating,
      experiencesApi.listByUser(staffId).catch(() => ({ experiences: [] as Experience[] })),
    ])
      .then(async ([profileRatings, userRating, expData]) => {
        const count = profileRatings.count ?? 0;
        let list = profileRatings.reviews ?? [];
        const fallbackRating = (userRating && userRating.count > 0) ? userRating : (initialRating && initialRating.count > 0 ? initialRating : null);
        const effectiveCount = count > 0 ? count : (fallbackRating?.count ?? 0);
        const effectiveAverage = count > 0 ? profileRatings.average : (fallbackRating?.average ?? 0);
        setRatingSummary(
          effectiveCount > 0
            ? { average: effectiveAverage, count: effectiveCount }
            : { average: profileRatings.average, count }
        );
        if (list.length === 0 && effectiveCount > 0) {
          try {
            const received = await ratingsApi.getReviewsReceivedBy(staffId);
            list = received.reviews ?? [];
          } catch {
            list = [];
          }
        }
        setReviews(list);
        setExperiences(expData.experiences ?? []);
        setSelectedExperienceJobLabel(null);
      })
      .catch(() => {
        setError(
          t("dashboard.errorLoadingProfileRatings", "Recenziile nu se pot încărca. Pornește serverul din rădăcina proiectului: npm run dev.")
        );
        setExperiences([]);
        applyFallbackRating();
      })
      .finally(() => setLoading(false));
  }, [open, staffId, t, initialRating]);

  useEffect(() => {
    if (reviewExperienceOptions.length > 0 && reviewJobTitle === null) {
      setReviewJobTitle(reviewExperienceOptions[0].value);
    }
  }, [reviewExperienceOptions, reviewJobTitle]);

  useEffect(() => {
    if (!reviewExperienceDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (reviewExperienceDropdownRef.current && !reviewExperienceDropdownRef.current.contains(e.target as Node)) {
        setReviewExperienceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reviewExperienceDropdownOpen]);

  const submitReview = () => {
    if (!applicationIdForReview || (reviewScore < 0.5 && reviewScore > 5)) return;
    const score = Math.max(0.5, Math.min(5, reviewScore)) || 1;
    setReviewSubmitting(true);
    ratingsApi
      .submit(applicationIdForReview, score, reviewComment.trim() || undefined, undefined, reviewJobTitle ?? undefined)
      .then(() => {
        setReviewSubmitted(true);
        setReviewComment("");
        setReviewScore(0);
        setReviewJobTitle(null);
        return ratingsApi.getProfileRatings(staffId).catch(() => ({ average: 0, count: 0, reviews: [] as ReviewItem[] }));
      })
      .then(async (profileRatings) => {
        setRatingSummary({ average: profileRatings.average, count: profileRatings.count });
        let list = profileRatings.reviews ?? [];
        if (list.length === 0) {
          try {
            const received = await ratingsApi.getReviewsReceivedBy(staffId);
            list = received.reviews ?? [];
          } catch {
            list = [];
          }
        }
        setReviews(list);
        setSelectedExperienceJobLabel(null);
        onReviewSubmitted?.(applicationIdForReview);
      })
      .finally(() => setReviewSubmitting(false));
  };

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

  useEffect(() => {
    if (!open || !scrollToReviewsOnOpen || loading) return;
    const tid = window.setTimeout(() => {
      reviewsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(tid);
  }, [open, scrollToReviewsOnOpen, loading]);

  useEffect(() => {
    if (!open) {
      reviewsHeightInitializedRef.current = false;
      if (reviewsHeightRafRef.current !== null) {
        window.cancelAnimationFrame(reviewsHeightRafRef.current);
        reviewsHeightRafRef.current = null;
      }
      const outer = reviewsAnimatedRef.current;
      if (outer) {
        outer.style.height = "auto";
        outer.style.overflow = "visible";
      }
      return;
    }

    const outer = reviewsAnimatedRef.current;
    const inner = reviewsAnimatedInnerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;

    const animateHeight = () => {
      const nextHeight = inner.getBoundingClientRect().height;
      if (!reviewsHeightInitializedRef.current) {
        outer.style.height = "auto";
        outer.style.overflow = "visible";
        reviewsHeightInitializedRef.current = true;
        return;
      }

      const currentHeight = outer.getBoundingClientRect().height;
      if (Math.abs(currentHeight - nextHeight) < 1) return;

      outer.style.height = `${currentHeight}px`;
      outer.style.overflow = "hidden";
      if (reviewsHeightRafRef.current !== null) {
        window.cancelAnimationFrame(reviewsHeightRafRef.current);
      }
      reviewsHeightRafRef.current = window.requestAnimationFrame(() => {
        outer.style.height = `${nextHeight}px`;
      });
    };

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "height") return;
      outer.style.height = "auto";
      outer.style.overflow = "visible";
    };

    const observer = new ResizeObserver(() => {
      animateHeight();
    });

    observer.observe(inner);
    outer.addEventListener("transitionend", handleTransitionEnd);
    animateHeight();

    return () => {
      observer.disconnect();
      outer.removeEventListener("transitionend", handleTransitionEnd);
      if (reviewsHeightRafRef.current !== null) {
        window.cancelAnimationFrame(reviewsHeightRafRef.current);
        reviewsHeightRafRef.current = null;
      }
    };
  }, [open]);

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
        className="modal-panel-anim bg-white rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.22)] max-w-4xl max-h-[95vh] w-full overflow-y-auto border border-white/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 relative overflow-hidden bg-gradient-to-r from-primary via-[#7d66ff] to-[#5f7cff] px-5 sm:px-6 py-5 flex items-start justify-between z-10 border-b border-white/20">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_45%)]" aria-hidden />
          <div className="relative min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/75 mb-2">
              Work2Now
            </p>
            <h2 id="staff-profile-title" className="text-xl sm:text-2xl font-bold text-white">
              {staffName || t("dashboard.staffMember", "Membru staff")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative flex-shrink-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors inline-flex items-center justify-center"
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
              {(() => {
                const fromSummary = ratingSummary && ratingSummary.count > 0 ? { average: ratingSummary.average, count: ratingSummary.count } : null;
                const fromReviews = reviews.length > 0 ? { average: reviews.reduce((s, r) => s + r.score, 0) / reviews.length, count: reviews.length } : null;
                const display = fromSummary ?? fromReviews ?? (initialRating && initialRating.count > 0 ? initialRating : null);
                if (!display || display.count === 0) return null;
                return (
                  <div className="flex items-center gap-2 mt-2">
                    <StarRating value={display.average} size={20} />
                    <span className="text-sm text-gray-600">
                      {display.average.toFixed(1)} ({display.count} {display.count === 1 ? t("dashboard.review", "review") : t("dashboard.reviews", "recenzii")})
                    </span>
                  </div>
                );
              })()}
              {isOwnProfile && (
                <p className="text-sm text-amber-700 mt-2">{t("dashboard.cannotReviewYourself", "Nu îți poți lăsa singur recenzie.")}</p>
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
              {!isCustomer && (
                <>
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
                </>
              )}

              <div ref={reviewsSectionRef} className="scroll-mt-4">
              <h3 className="modal-element-anim text-sm font-semibold text-gray-600 mb-3 mt-6" style={{ animationDelay: "0.18s" }}>
                {selectedExperienceJobLabel
                  ? t("dashboard.reviewsForJob", "Recenziile primite") + ` (${selectedExperienceJobLabel})`
                  : t("dashboard.reviewsReceived", "Recenziile primite")}
              </h3>
              <div
                ref={reviewsAnimatedRef}
                className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <div ref={reviewsAnimatedInnerRef}>
                  {filteredReviews.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border border-gray-100">
                      {selectedExperienceJobLabel ? (
                        <>
                          <p>{t("dashboard.noReviewsForThisJob", "Nicio recenzie pentru acest job.")}</p>
                          {reviews.length > 0 && (
                            <p className="mt-2">
                              <button
                                type="button"
                                onClick={() => setSelectedExperienceJobLabel(null)}
                                className="text-primary font-medium hover:underline"
                              >
                                {t("dashboard.showAllReviews", "Afișează toate recenziile")}
                              </button>
                            </p>
                          )}
                        </>
                      ) : (
                        t("dashboard.noReviewsYet", "Încă nu are recenzii.")
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto pr-1 sm:pr-2">
                      <ul className="space-y-3">
                      {filteredReviews.map((r, i) => (
                        <li
                          key={r.id}
                          className="review-card-anim bg-white rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                              {avatarSrc(r.otherPartyAvatar) ? (
                                <img src={avatarSrc(r.otherPartyAvatar)!} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
                              ) : null}
                              <span className={`text-primary font-semibold text-sm ${avatarSrc(r.otherPartyAvatar) ? "hidden" : ""}`}>
                                {(r.otherPartyName || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <StarRating value={r.score} size={18} />
                                <span className="text-xs font-medium text-primary px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25">
                                  {r.otherPartyRole === "staff" ? t("dashboard.roleStaff") : r.otherPartyRole === "admin" ? t("dashboard.roleAdmin") : t("dashboard.roleCustomer")}
                                </span>
                              </div>
                              {r.otherPartyName && (
                                <p className="text-sm font-medium text-gray-800 mt-1">
                                  {t("dashboard.reviewBy", "Recenzie de la")}: <span className="font-semibold text-[#333]">{r.otherPartyName}</span>
                                </p>
                              )}
                              {r.createdAt && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                                  {new Date(r.createdAt).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
                                </p>
                              )}
                            </div>
                          </div>
                          {r.comment ? (
                            <p className="text-sm text-gray-700 flex items-start gap-1.5 mt-2">
                              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                              <span>{r.comment}</span>
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic mt-2">{t("dashboard.noComment", "Fără comentariu.")}</p>
                          )}
                          {r.photoUrl && (
                            <div className="mt-2">
                              <ReviewPhotoThumb photoUrl={r.photoUrl} />
                            </div>
                          )}
                        </li>
                      ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                  {reviewSubmitted ? (
                    <p className="text-sm font-medium text-green-700">{t("dashboard.reviewThankYou", "Mulțumim, recenzia a fost trimisă.")}</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowReviewForm((v) => !v)}
                        className="flex items-center justify-between w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                        aria-expanded={showReviewForm}
                      >
                        <span>{t("dashboard.leaveReview", "Lasă recenzie")}</span>
                        <svg
                          className={`w-5 h-5 ml-2 transition-transform duration-300 ease-out ${showReviewForm ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                          showReviewForm ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                      >
                        {canLeaveReview ? (
                        <div className="p-4 mt-3 rounded-xl bg-gray-50 border border-gray-100">
                            {reviewExperienceOptions.length > 0 && (
                              <div className="mb-3">
                                <label className="block text-sm font-semibold text-gray-800 mb-1.5">{t("dashboard.reviewForExperience", "Pentru ce experiență profesională?")}</label>
                                <div ref={reviewExperienceDropdownRef} className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setReviewExperienceDropdownOpen((v) => !v)}
                                    aria-expanded={reviewExperienceDropdownOpen}
                                    aria-haspopup="listbox"
                                    aria-label={t("dashboard.reviewForExperience", "Pentru ce experiență profesională?")}
                                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-left text-sm shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                  >
                                    <span className={reviewJobTitle ? "text-gray-900 font-medium" : "text-gray-500"}>
                                      {reviewJobTitle ?? reviewExperienceOptions[0]?.value ?? t("dashboard.chooseExperience", "Alege experiența")}
                                    </span>
                                    <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 ${reviewExperienceDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </button>
                                  {reviewExperienceDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                                      <div className="overflow-y-auto max-h-64 py-1" role="listbox">
                                        {reviewExperienceOptions.map((opt) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            role="option"
                                            aria-selected={reviewJobTitle === opt.value}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              setReviewJobTitle(opt.value);
                                              setReviewExperienceDropdownOpen(false);
                                            }}
                                            className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                              reviewJobTitle === opt.value ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                            }`}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            <p className="text-sm font-semibold text-gray-800 mb-2">{t("dashboard.rateWork", "Evaluare (1-5 stele)")}</p>
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                              <StarRating value={reviewScore} editable onSelect={(s) => setReviewScore(s)} />
                            </div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{t("dashboard.commentOptional", "Comentariu (opțional)")}</label>
                            <textarea
                              rows={2}
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value.slice(0, 2000))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              placeholder={t("dashboard.commentOptional", "Comentariu (opțional)")}
                            />
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                type="button"
                                disabled={reviewScore < 0.5 || reviewSubmitting}
                                onClick={submitReview}
                                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                              >
                                {reviewSubmitting ? "..." : t("dashboard.submitReview", "Trimite review")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowReviewForm(false)}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                              >
                                {t("dashboard.cancel", "Anulare")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 mt-3 rounded-xl bg-gray-50 border border-gray-100">
                            <p className="text-sm text-gray-600">
                              {isOwnProfile
                                ? t("dashboard.leaveReviewOwnProfileHint", "Nu poți lăsa recenzie pentru propriul profil.")
                                : t("dashboard.leaveReviewFromApplicationsHint", "Poți lăsa recenzie din Aplicații sau Joburi, deschizând profilul angajatului la o aplicație finalizată.")}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
