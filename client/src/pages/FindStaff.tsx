import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

export default function FindStaff() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="find-staff-page min-h-[60vh]">
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-6xl">
        {/* Hero banner – nuanțe violet brand, aerisit, ca pe Find Jobs */}
        <section
          className="rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[rgba(122,99,241,0.14)] via-[rgba(157,123,255,0.10)] to-[rgba(122,99,241,0.16)] border border-[rgba(122,99,241,0.25)] shadow-[0_8px_32px_rgba(122,99,241,0.15)] mb-12 sm:mb-14 py-14 sm:py-20 px-6 sm:px-12 text-center"
          aria-label={t("findStaff.title")}
        >
          <p className="inline-flex items-center gap-2 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-widest text-primary/90 mb-5 px-4 py-2.5 rounded-full bg-white/70 border border-primary/20 shadow-[0_2px_10px_rgba(122,99,241,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80" aria-hidden />
            {t("findStaff.badge")}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1e1c2f] tracking-tight mb-4 max-w-2xl mx-auto">
            {t("findStaff.title")}
          </h1>
          <div className="w-20 h-1 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent mx-auto mb-5" aria-hidden />
          <p className="text-[#3d3a4a] text-lg sm:text-xl leading-relaxed max-w-xl mx-auto font-normal">
            {t("findStaff.lead")}
          </p>
        </section>

        {/* Carduri – layout bento: primul card lat, următoarele două alăturate */}
        <div className="find-staff-cards grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-14 sm:mb-20 max-w-4xl mx-auto">
          <div
            className="find-staff-card find-staff-card--feature group relative sm:col-span-2 rounded-[1.75rem] sm:rounded-[2rem] p-6 sm:p-10 text-center sm:text-left sm:flex sm:items-center sm:gap-10 bg-gradient-to-br from-white via-white to-primary/5 border-2 border-[rgba(224,216,247,0.6)] hover:border-primary/25 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 sm:w-2 bg-gradient-to-b from-primary to-secondary opacity-90" aria-hidden />
            <div className="relative">
              <div className="find-staff-card__icon w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] mx-auto sm:mx-0 mb-4 sm:mb-0 flex items-center justify-center text-2xl sm:text-3xl ring-2 ring-white/30 group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                <span className="inline-block [filter:brightness(0)_invert(1)]" aria-hidden>📋</span>
              </div>
            </div>
            <div className="relative flex-1 min-w-0">
              <h3 className="font-bold text-[#1e1c2f] mb-2 text-lg sm:text-xl">{t("findStaff.postJobs")}</h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{t("findStaff.postJobsDesc")}</p>
            </div>
          </div>
          <div
            className="find-staff-card find-staff-card--offset group relative rounded-[1.5rem] sm:rounded-[1.75rem] p-6 sm:p-8 text-center bg-white/95 backdrop-blur-sm border-2 border-[rgba(224,216,247,0.5)] hover:border-primary/30 hover:-translate-y-1 sm:translate-y-4 transition-all duration-300"
          >
            <div className="find-staff-card__icon w-16 h-16 sm:w-[4.25rem] sm:h-[4.25rem] rounded-2xl bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] mx-auto mb-5 flex items-center justify-center text-2xl sm:text-3xl ring-2 ring-white/30 group-hover:scale-105 transition-all duration-300">
              <span className="inline-block [filter:brightness(0)_invert(1)]" aria-hidden>👥</span>
            </div>
            <h3 className="font-bold text-[#1e1c2f] mb-2 sm:mb-3 text-base sm:text-lg">{t("findStaff.seeCandidates")}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{t("findStaff.seeCandidatesDesc")}</p>
          </div>
          <div
            className="find-staff-card find-staff-card--offset group relative rounded-[1.5rem] sm:rounded-[1.75rem] p-6 sm:p-8 text-center bg-white/95 backdrop-blur-sm border-2 border-[rgba(224,216,247,0.5)] hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="find-staff-card__icon w-16 h-16 sm:w-[4.25rem] sm:h-[4.25rem] rounded-2xl bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] mx-auto mb-5 flex items-center justify-center text-2xl sm:text-3xl ring-2 ring-white/30 group-hover:scale-105 transition-all duration-300">
              <span className="inline-block [filter:brightness(0)_invert(1)]" aria-hidden>⚡</span>
            </div>
            <h3 className="font-bold text-[#1e1c2f] mb-2 sm:mb-3 text-base sm:text-lg">{t("findStaff.fastRecruit")}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{t("findStaff.fastRecruitDesc")}</p>
          </div>
        </div>

        {/* Beneficii – bloc vizual distinct cu efect de adâncime */}
        <div className="find-staff-benefits rounded-3xl overflow-hidden bg-gradient-to-br from-[rgba(122,99,241,0.08)] via-[rgba(157,123,255,0.06)] to-[rgba(122,99,241,0.1)] border border-primary/15 p-8 sm:p-12 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-[#1e1c2f] mb-8 sm:mb-10">{t("findStaff.whyTitle")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            {[
              { value: "0%", labelKey: "noFees" },
              { value: "24/7", labelKey: "access24" },
              { value: "48h", labelKey: "pay48" },
            ].map((b) => (
              <div key={b.labelKey} className="find-staff-benefits__item relative rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_12px_32px_rgba(122,99,241,0.12)]">
                <div className="find-staff-benefits__value text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                  {b.value}
                </div>
                <p className="text-gray-600 text-sm sm:text-base font-medium">{t(`findStaff.${b.labelKey}`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA discret la final */}
        <p className="text-center text-gray-500 text-sm mt-10 sm:mt-14 px-4 py-3 rounded-2xl bg-gray-50/80 border border-gray-200/60 max-w-md mx-auto">
          {user ? (
            <Link to="/dashboard" className="text-primary font-semibold hover:text-primary-dark hover:underline transition-colors">{t("findStaff.postJob")}</Link>
          ) : (
            <>
              {t("findStaff.ctaLead")}{" "}
              <Link to="/register/customer" className="text-primary font-semibold hover:text-primary-dark hover:underline transition-colors">{t("findStaff.ctaBtn")}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
