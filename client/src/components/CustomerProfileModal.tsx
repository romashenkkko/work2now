import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Mail, User, MessageSquare, X } from "lucide-react";
import StarRating from "./StarRating";
import { ratingsApi, type ReviewItem } from "../api/client";

const DEFAULT_AVATAR = "/Illustration/AvatarWhiteGuy.png";

export type CustomerProfileModalProps = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerAvatar?: string;
};

export default function CustomerProfileModal({
  open,
  onClose,
  customerId,
  customerName = "",
  customerEmail = "",
  customerAvatar = DEFAULT_AVATAR,
}: CustomerProfileModalProps) {
  const { t } = useTranslation();
  const [ratingSummary, setRatingSummary] = useState<{ average: number; count: number } | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customerId?.trim()) return;
    setLoading(true);
    setError(null);
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
        className="modal-panel-anim bg-white rounded-2xl shadow-xl max-w-2xl max-h-[95vh] w-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <h2 id="customer-profile-title" className="text-lg font-bold text-gray-900">
            {customerName || t("dashboard.customer", "Client")}
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
