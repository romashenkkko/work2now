import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Star, MessageSquare, Image, FileText } from "lucide-react";
import StarRating from "../components/StarRating";
import { ratingsApi, type ReviewItem } from "../api/client";

export default function DashboardRecenzii() {
  const { t } = useTranslation();
  const [given, setGiven] = useState<ReviewItem[]>([]);
  const [received, setReceived] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ratingsApi
      .myReviews()
      .then((r) => {
        setGiven(r.given ?? []);
        setReceived(r.received ?? []);
      })
      .catch(() => {
        setGiven([]);
        setReceived([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onFocus = () => {
      ratingsApi.myReviews().then((r) => {
        setGiven(r.given ?? []);
        setReceived(r.received ?? []);
      }).catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <>
      <header className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-white via-[#faf8ff] to-[#f3efff] border border-[rgba(122,99,241,0.12)] shadow-[0_4px_20px_rgba(122,99,241,0.08)]">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1e1c2f]">{t("dashboard.review", "Review")}</h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md">{t("dashboard.reviewSubtitle", "Recenziile tale și cele de făcut.")}</p>
      </header>

      <div className="space-y-6">
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("dashboard.deFacutReview", "De făcut review")}
            </h2>
            <Link
              to="/dashboard/aplicatii"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              {t("dashboard.aplicatii")}
            </Link>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-sm text-gray-600">
              {t("dashboard.deFacutReviewHint", "Aplicațiile finalizate la care poți lăsa un review (stele, comentariu, poză) se găsesc în Aplicații. Apasă butonul de mai sus.")}
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              {t("dashboard.recenziileMele", "Recenziile mele")}
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">{t("dashboard.loading")}</div>
          ) : (
            <div className="p-4 sm:p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t("dashboard.receivedReviews", "Primite")}</h3>
                {received.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("dashboard.noReceivedReviews", "Nu ai primit încă niciun review.")}</p>
                ) : (
                  <ul className="space-y-3">
                    {received.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100">
                        <StarRating value={r.score} size={16} />
                        {r.otherPartyName && <span className="text-sm font-medium text-gray-900">← {r.otherPartyName}</span>}
                        {r.jobTitle && <span className="text-sm text-gray-600">· {r.jobTitle}</span>}
                        <span className="text-xs text-gray-500">(app. {r.applicationId})</span>
                        {r.comment && (
                          <p className="w-full text-sm text-gray-700 flex items-start gap-1 mt-1">
                            <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                            {r.comment}
                          </p>
                        )}
                        {r.photoUrl && (
                          <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
                            <Image className="w-4 h-4" /> {t("dashboard.photo", "Poză")}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t("dashboard.givenReviews", "Date")}</h3>
                {given.length === 0 ? (
                  <p className="text-sm text-gray-500">{t("dashboard.noGivenReviews", "Nu ai dat încă niciun review.")}</p>
                ) : (
                  <ul className="space-y-3">
                    {given.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start gap-2 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100">
                        <StarRating value={r.score} size={16} />
                        {r.otherPartyName && <span className="text-sm font-medium text-gray-900">→ {r.otherPartyName}</span>}
                        {r.jobTitle && <span className="text-sm text-gray-600">· {r.jobTitle}</span>}
                        <span className="text-xs text-gray-500">(app. {r.applicationId})</span>
                        {r.comment && (
                          <p className="w-full text-sm text-gray-700 flex items-start gap-1 mt-1">
                            <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                            {r.comment}
                          </p>
                        )}
                        {r.photoUrl && (
                          <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
                            <Image className="w-4 h-4" /> {t("dashboard.photo", "Poză")}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
