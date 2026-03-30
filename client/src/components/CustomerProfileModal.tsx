import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Mail, User, MessageSquare, X, Calendar } from "lucide-react";
import StarRating from "./StarRating";
import { ratingsApi, type ReviewItem } from "../api/client";

const DEFAULT_AVATAR = "/Illustration/AvatarWhiteGuy.png";

function avatarSrc(url: string | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const s = url.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return DEFAULT_AVATAR;
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return typeof window !== "undefined" ? `${window.location.origin}${s}` : s;
  if (s.startsWith("uploads/")) return typeof window !== "undefined" ? `${window.location.origin}/${s}` : `/${s}`;
  return typeof window !== "undefined" ? `${window.location.origin}/${s}` : `/${s}`;
}

export type CustomerProfileModalProps = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerAvatar?: string;
  /** ID utilizator curent (staff) – dacă e setat și diferit de customerId, poate lăsa recenzie. */
  currentUserId?: string;
  /** ID aplicație finalizată (check-out făcut) la care staff-ul poate lăsa recenzie pentru acest customer. */
  applicationIdForReview?: string;
  /** După ce recenzia a fost trimisă (refresh listă etc.). */
  onReviewSubmitted?: () => void;
};

export default function CustomerProfileModal({
  open,
  onClose,
  customerId,
  customerName = "",
  customerEmail = "",
  customerAvatar = DEFAULT_AVATAR,
  currentUserId,
  applicationIdForReview,
  onReviewSubmitted,
}: CustomerProfileModalProps) {
  const canLeaveReview =
    !!applicationIdForReview?.trim() &&
    currentUserId != null &&
    String(currentUserId).trim() !== String(customerId).trim();
  const { t } = useTranslation();
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (!open || !customerId?.trim()) return;
    setLoading(true);
    setError(null);
    setReviewSubmitted(false);
    setReviewScore(0);
    setReviewComment("");
    setShowReviewForm(false);
    Promise.all([
      ratingsApi.getUserRating(customerId).catch(() => ({ average: 0, count: 0 })),
      ratingsApi.getReviewsReceivedBy(customerId).catch(() => ({ reviews: [] as ReviewItem[] })),
    ])
      .then(([summary, received]) => {
        setRatingSummary(summary);
        setReviews(received.reviews ?? []);
      })
      .catch(() => setError(t("dashboard.errorLoadingProfile", "Eroare la încărcarea profilului.")))
      .finally(() => setLoading(false));
  }, [open, customerId, t]);

  const submitReview = () => {
    if (!applicationIdForReview?.trim() || reviewScore < 0.5) return;
    setReviewSubmitting(true);
    ratingsApi
      .submit(applicationIdForReview, reviewScore, reviewComment || undefined)
      .then(() => {
        setReviewSubmitted(true);
        setShowReviewForm(false);
        return Promise.all([
          ratingsApi.getUserRating(customerId).catch(() => ({ average: 0, count: 0 })),
          ratingsApi.getReviewsReceivedBy(customerId).catch(() => ({ reviews: [] as ReviewItem[] })),
        ]);
      })
      .then(([summary, received]) => {
        setRatingSummary(summary);
        setReviews(received.reviews ?? []);
        onReviewSubmitted?.();
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("dashboard.errorLoadingProfile", "Eroare la încărcarea profilului.")))
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

  if (!open) return null;

  const content = (
    <div
      className="modal-backdrop-anim fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-profile-title"
    >
      <div
        className="modal-panel-anim bg-white rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.22)] max-w-2xl max-h-[95vh] w-full overflow-y-auto border border-white/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 relative overflow-hidden bg-gradient-to-r from-primary via-[#7d66ff] to-[#5f7cff] px-5 sm:px-6 py-5 flex items-start justify-between z-10 border-b border-white/20">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_45%)]" aria-hidden />
          <div className="relative min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/75 mb-2">
              Work2Now
            </p>
            <h2 id="customer-profile-title" className="text-xl sm:text-2xl font-bold text-white">
              {customerName || t("dashboard.customer", "Client")}
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
                src={customerAvatar}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {customerName || t("dashboard.customer", "Client")}
              </h3>
              {customerEmail && (
                <p className="text-gray-600 flex items-center gap-1.5 mt-1">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{customerEmail}</span>
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <StarRating value={ratingSummary?.average ?? 0} size={20} />
                <span className="text-sm text-gray-600">
                  {(ratingSummary?.average ?? 0).toFixed(1)} ({ratingSummary?.count ?? 0} {ratingSummary?.count === 1 ? t("dashboard.review", "review") : t("dashboard.reviews", "recenzii")})
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="modal-element-anim p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm" style={{ animationDelay: "0.08s" }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">{t("dashboard.loading")}</div>
          ) : (
            <div className="modal-element-anim" style={{ animationDelay: "0.12s" }}>
              <h3 className="text-sm font-semibold text-gray-600 mb-3">
                {t("dashboard.reviewsReceived", "Recenziile primite")}
              </h3>
              {reviews.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border border-gray-100">
                  {t("dashboard.noReviewsYet", "Încă nu are recenzii.")}
                </div>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((r, i) => (
                    <li
                      key={r.id}
                      className="review-card-anim bg-white rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                          <img
                            src={avatarSrc(r.otherPartyAvatar) || DEFAULT_AVATAR}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR; }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* Stelele trebuie să reflecte scorul acestei recenzii, nu media profilului autorului */}
                            <StarRating value={Math.max(0, Math.min(5, Number(r.score) || 0))} size={18} />
                            {r.otherPartyRole && (
                              <span className="text-xs font-medium text-primary px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25">
                                {r.otherPartyRole === "staff" ? t("dashboard.roleStaff") : r.otherPartyRole === "admin" ? t("dashboard.roleAdmin") : t("dashboard.roleCustomer")}
                              </span>
                            )}
                          </div>
                          {r.otherPartyName && (
                            <p className="text-sm font-medium text-gray-800 mt-1">
                              {t("dashboard.reviewBy", "Recenzie de la")}: <span className="font-semibold text-[#333]">{r.otherPartyName}</span>
                              {r.jobTitle && <span className="text-gray-500 font-normal"> — {r.jobTitle}</span>}
                            </p>
                          )}
                          {(r.otherPartyRatingAverage != null || r.score != null) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {r.otherPartyRatingAverage != null
                                ? `${t("dashboard.profileRating", "Rating profil")}: ${r.otherPartyRatingAverage.toFixed(1)}${r.otherPartyRatingCount ? ` (${r.otherPartyRatingCount})` : ""}`
                                : ""}
                              {r.otherPartyRatingAverage != null ? " • " : ""}
                              {t("dashboard.reviewScore", "Scor recenzie")}: {r.score.toFixed(1)}
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
                      {r.comment && (
                        <p className="text-sm text-gray-700 flex items-start gap-1.5 mt-2">
                          <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                          <span>{r.comment}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canLeaveReview && (
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
                        <svg className={`w-5 h-5 ml-2 transition-transform duration-300 ease-out ${showReviewForm ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-out ${showReviewForm ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
                        <div className="p-4 mt-3 rounded-xl bg-gray-50 border border-gray-100">
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
                              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                              {reviewSubmitting ? t("dashboard.sending", "Se trimite...") : t("dashboard.submitReview", "Trimite recenzia")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
