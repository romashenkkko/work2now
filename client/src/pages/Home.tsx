import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Building2, UserRound, Zap, Monitor, Sparkles, CalendarClock, ClipboardList, UsersRound, Landmark } from "lucide-react";
import { useRoleModal } from "../context/RoleModalContext";
import { useInView } from "../hooks/useInView";

const statsIcons = [ClipboardList, UsersRound, Landmark] as const;
const STATS_ANIMATION_DURATION_MS = 900;

export default function Home() {
  const { t } = useTranslation();
  const roleModal = useRoleModal();
  const statsInView = useInView({ threshold: 0.15 });
  const [statsAnimationLocked, setStatsAnimationLocked] = useState(false);
  useEffect(() => {
    if (!statsInView.inView || statsAnimationLocked) return;
    const id = setTimeout(() => setStatsAnimationLocked(true), STATS_ANIMATION_DURATION_MS);
    return () => clearTimeout(id);
  }, [statsInView.inView, statsAnimationLocked]);
  const featuresInView = useInView({ threshold: 0.08 });
  const forWhoInView = useInView({ threshold: 0.08 });
  const stepsInView = useInView({ threshold: 0.1 });
  const testimonialsInView = useInView({ threshold: 0.08 });
  const ctaInView = useInView({ threshold: 0.2 });
  const phoneInView = useInView({ threshold: 0.2, rootMargin: "0px 0px -100px 0px" });

  const testimonials = [
    { img: "/Illustration/AvatarWhiteGirl.png", quote: "t1", author: "author1", role: "role1" },
    { img: "/Illustration/AvatarWhiteGuy.png", quote: "t2", author: "author2", role: "role2" },
    { img: "/Illustration/AvatarWhiteGirl2.png", quote: "t3", author: "author3", role: "role3" },
  ];

  const featureIcons = [
    Zap,       // Plata in 48h – rapid
    Monitor,   // 100% Digital
    Sparkles,  // Matching inteligent
    CalendarClock, // Flexibilitate totala
  ];
  const features = [
    { key: "pay48", desc: "pay48Desc", primary: true },
    { key: "digital", desc: "digitalDesc", primary: false },
    { key: "matching", desc: "matchingDesc", primary: false },
    { key: "flex", desc: "flexDesc", primary: false },
  ];

  return (
    <>
      {/* Hero – redesign: eyebrow, titlu, lead, butoane */}
      <section className="hero-section relative overflow-hidden">
        <div
          className="hero-section__bg absolute inset-0 z-0 pointer-events-none animate-hero-gradient-shift"
          style={{
            background: "linear-gradient(135deg, rgba(122,99,241,0.12) 0%, rgba(107,84,224,0.1) 25%, rgba(122,99,241,0.15) 50%, rgba(107,84,224,0.1) 75%, rgba(122,99,241,0.12) 100%), radial-gradient(circle at 20% 30%, rgba(122,99,241,0.18) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(107,84,224,0.15) 0%, transparent 50%)",
            backgroundSize: "400% 400%, 200% 200%, 180% 180%",
            backgroundPosition: "0% 50%, 0% 0%, 100% 100%",
          }}
        />
        <div className="hero-section__fade absolute left-0 right-0 bottom-0 h-16 md:h-20 z-[1] pointer-events-none bg-gradient-to-b from-transparent via-white/40 to-[#f3efff]/90" />

        <div className="container relative z-[2] mx-auto px-4 sm:px-6 py-8 sm:py-14 md:py-28 max-w-[1100px] min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 sm:gap-10 md:gap-20 items-center">
            <div className="hero-content order-1 text-center md:text-left min-w-0">
              <p className="hero-eyebrow animate-fade-in-up opacity-100 mx-auto md:mx-0" style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}>
                {t("hero.eyebrow")}
              </p>
              <h1 className="hero-title animate-fade-in-up opacity-100" style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}>
                {(() => {
                  const title = t("hero.title");
                  const parts = title.split("2");
                  if (parts.length === 2) {
                    return (
                      <>
                        {parts[0]}
                        <span className="hero-title__two">2</span>
                        {parts[1]}
                      </>
                    );
                  }
                  return title;
                })()}
              </h1>
              <p className="hero-lead animate-fade-in-up opacity-100 mx-auto md:mx-0" style={{ animationDelay: "0.35s", animationFillMode: "forwards" }}>
                {t("hero.lead")}
              </p>
              <div className="hero-actions animate-fade-in-up opacity-100 flex flex-col sm:flex-row flex-wrap justify-center md:justify-start gap-3 sm:gap-3" style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}>
                <Link to="/about" className="hero-btn hero-btn--primary w-full sm:w-auto min-w-0">
                  {t("hero.details")}
                </Link>
                <Link to="/how-it-works" className="hero-btn hero-btn--secondary w-full sm:w-auto min-w-0">
                  {t("hero.howItWorks")}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[160px] sm:min-h-[260px] md:min-h-[420px] flex items-center justify-center order-2 w-full max-w-[280px] sm:max-w-[340px] md:max-w-none mx-auto">
              <div className="relative flex justify-center items-end w-full h-full">
                <img
                  src="/Illustration/White human coffe.png"
                  alt="Work2Now"
                  className="hero-illus relative z-[1] w-full h-auto max-h-[38vh] sm:max-h-[320px] md:max-h-none object-contain object-bottom drop-shadow-[0_20px_40px_rgba(122,99,241,0.15)] hover:-translate-y-1 hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats – Work2Now în cifre – carduri aliniate */}
      <section ref={statsInView.ref} className="stats-section py-12 sm:py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1100px] min-w-0">
          <h2
            className={`stats-section__title text-center text-[#1e1c2f] mb-8 sm:mb-10 md:mb-12 ${statsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={statsInView.inView ? { animationDelay: "0s", animationFillMode: "both" } : undefined}
          >
            {t("stats.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-3xl sm:max-w-none mx-auto">
            {[
              { value: "500+", labelKey: "jobs", position: "left" as const },
              { value: "2.000+", labelKey: "workers", position: "center" as const },
              { value: "150+", labelKey: "companies", position: "right" as const },
            ].map((stat, i) => {
              const Icon = statsIcons[i];
              const animClass = statsAnimationLocked
                ? "stats-card--done"
                : statsInView.inView
                  ? stat.position === "center"
                    ? "stats-card--center-in"
                    : stat.position === "left"
                      ? "stats-card--slide-left"
                      : "stats-card--slide-right"
                  : stat.position === "center"
                    ? "stats-card--center-out"
                    : stat.position === "left"
                      ? "stats-card--slide-left-out"
                      : "stats-card--slide-right-out";
              return (
                <div
                  key={stat.labelKey}
                  className={`stats-card stats-card--${stat.position} flex flex-col items-center text-center rounded-2xl border border-[rgba(224,216,247,0.6)] bg-white/80 backdrop-blur-sm px-6 py-8 sm:px-8 sm:py-10 shadow-[0_8px_24px_rgba(122,99,241,0.08)] ${animClass}`}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl bg-primary/10 mb-4 sm:mb-5">
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-primary" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="stats-card__value text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1e1c2f] tracking-tight mb-1.5">
                    {stat.value}
                  </p>
                  <p className="stats-card__label text-xs sm:text-sm font-semibold uppercase tracking-wider text-primary">
                    {t(`stats.${stat.labelKey}`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features – De ce Work2Now? – 2x2 grid, responsive */}
      <section ref={featuresInView.ref} className="py-12 sm:py-16 md:py-24 bg-transparent">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1100px] min-w-0">
          <h2
            className={`text-center text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1e1c2f] mb-4 sm:mb-6 ${featuresInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={featuresInView.inView ? { animationFillMode: "both" } : undefined}
          >
            {t("features.title")}
          </h2>
          <p
            className={`text-center text-[#4d5874] text-base sm:text-lg mb-8 sm:mb-12 max-w-2xl mx-auto px-1 ${featuresInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={featuresInView.inView ? { animationDelay: "0.08s", animationFillMode: "both" } : undefined}
          >
            {t("features.subtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7 max-w-[1000px] mx-auto">
            {features.map((f, i) => (
              <div
                key={f.key}
                data-feature-card={i + 1}
                className={`rounded-2xl sm:rounded-[28px] p-6 sm:p-8 md:p-10 border-2 border-[rgba(224,216,247,0.6)] backdrop-blur-xl text-left flex flex-col ${f.primary
                  ? "bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] text-white shadow-[0_20px_40px_rgba(75,60,120,0.12)]"
                  : "card-soft"
                } ${
                  featuresInView.inView
                    ? `feature-card-enter-${i + 1}`
                    : i === 0
                      ? "opacity-0 -translate-x-16 -translate-y-10 rotate-[-7deg] scale-95"
                      : i === 1
                        ? "opacity-0 translate-x-16 -translate-y-10 rotate-[7deg] scale-95"
                        : i === 2
                          ? "opacity-0 -translate-x-14 translate-y-14 rotate-[5deg] scale-95"
                          : "opacity-0 translate-x-14 translate-y-14 rotate-[-5deg] scale-95"
                }`}
                style={featuresInView.inView ? { animationDelay: `${0.14 + i * 0.12}s`, animationFillMode: "both" } : undefined}
              >
                <div className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-4 sm:mb-6 flex-shrink-0 rounded-2xl ${f.primary ? "bg-white/20" : "bg-primary/10"}`}>
                  {(() => {
                    const Icon = featureIcons[i];
                    return Icon ? <Icon className={f.primary ? "w-8 h-8 sm:w-10 sm:h-10 text-white" : "w-8 h-8 sm:w-10 sm:h-10 text-primary"} strokeWidth={2} /> : null;
                  })()}
                </div>
                <h3 className={`font-bold text-base sm:text-lg mb-2 sm:mb-3 ${f.primary ? "text-white" : "text-[#1e1c2f]"}`}>{t(`features.${f.key}`)}</h3>
                <p className={`${f.primary ? "text-white/95" : "text-[#6b748a]"} text-sm sm:text-base leading-relaxed`}>{t(`features.${f.desc}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For who – two paths: staff vs employer, with illustration */}
      <section ref={forWhoInView.ref} className="py-16 sm:py-20 md:py-28 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl min-w-0">
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4 ${forWhoInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={forWhoInView.inView ? { animationFillMode: "both" } : undefined}
          >
            {t("forWho.title")}
          </h2>
          <p
            className={`text-center text-gray-600 text-base sm:text-lg mb-10 sm:mb-14 md:mb-16 max-w-2xl mx-auto px-1 ${forWhoInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={forWhoInView.inView ? { animationDelay: "0.06s", animationFillMode: "both" } : undefined}
          >
            {t("forWho.subtitle")}
          </p>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-10 items-stretch">
            <div
              className={`rounded-3xl border-2 border-[#6366F1]/30 bg-white p-6 sm:p-8 md:p-10 shadow-soft hover:-translate-y-2 hover:shadow-soft-lg hover:border-[#6366F1]/50 flex flex-col transition-transform duration-300 ${forWhoInView.inView ? "for-who-card-left-enter" : "opacity-0 -translate-x-24"}`}
              style={forWhoInView.inView ? { animationDelay: "0.12s", animationFillMode: "both" } : undefined}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center mb-6 shadow-soft">
                <UserRound className="w-8 h-8 text-white" strokeWidth={2.2} />
              </div>
              <h3 className="font-bold text-gray-900 text-xl mb-3">{t("forWho.staffTitle")}</h3>
              <p className="text-gray-600 leading-relaxed flex-1 mb-8">{t("forWho.staffDesc")}</p>
              <Link to="/find-jobs" className="btn-primary w-fit hover:scale-[1.02] active:scale-[0.98] transition-transform">
                {t("forWho.staffCta")}
              </Link>
            </div>
            <div
              className={`rounded-3xl border-2 border-[#FB7185]/30 bg-white p-6 sm:p-8 md:p-10 shadow-soft hover:-translate-y-2 hover:shadow-soft-lg hover:border-[#FB7185]/50 flex flex-col relative overflow-hidden transition-transform duration-300 ${forWhoInView.inView ? "for-who-card-right-enter" : "opacity-0 translate-x-24"}`}
              style={forWhoInView.inView ? { animationDelay: "0.22s", animationFillMode: "both" } : undefined}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FB7185] to-[#F9A8D4] flex items-center justify-center mb-6 shadow-soft">
                <Building2 className="w-8 h-8 text-white" strokeWidth={2.2} />
              </div>
              <h3 className="font-bold text-gray-900 text-xl mb-3">{t("forWho.employerTitle")}</h3>
              <p className="text-gray-600 leading-relaxed flex-1 mb-8">{t("forWho.employerDesc")}</p>
              <Link to="/find-staff" className="btn-accent w-fit hover:scale-[1.02] active:scale-[0.98] transition-transform">
                {t("forWho.employerCta")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works – PHP style: step-index circle violet, card-soft */}
      <section ref={stepsInView.ref} className="py-16 sm:py-20 md:py-24 bg-transparent">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1100px] min-w-0">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1e1c2f] mb-5 ${stepsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={stepsInView.inView ? { animationFillMode: "both" } : undefined}
          >
            {t("howItWorks.title")}
          </h2>
          <p
            className={`text-[#4d5874] text-lg leading-[1.8] mb-8 ${stepsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={stepsInView.inView ? { animationDelay: "0.06s", animationFillMode: "both" } : undefined}
          >
                {t("howItWorks.lead")}
              </p>
              <div className="grid gap-7 mt-8">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`card-soft p-6 sm:p-8 rounded-[24px] ${stepsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                    style={stepsInView.inView ? { animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: "both" } : undefined}
                  >
                    <span className="inline-flex w-12 h-12 rounded-full bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] text-white font-extrabold text-lg items-center justify-center mb-5 shadow-[0_8px_20px_rgba(122,99,241,0.3)] border-[3px] border-white/50">
                      {i}
                    </span>
                    <h3 className="font-bold text-[#1e1c2f] text-lg mb-2">{t(`howItWorks.step${i}`)}</h3>
                    <p className="text-[#6b748a] leading-relaxed">{t(`howItWorks.step${i}Desc`)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={stepsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"} style={stepsInView.inView ? { animationDelay: "0.2s", animationFillMode: "both" } : undefined}>
              <img
                src="/Illustration/Colleagues sharing laptop screen, Teamwork and collaboration, Digital project review.png"
                alt=""
                className="w-full rounded-[24px] shadow-[0_20px_40px_rgba(66,50,120,0.15)] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials – PHP style: avatar 90px circle, border-top gradient, author #7a63f1, role #9a8bc4 */}
      <section ref={testimonialsInView.ref} className="py-16 sm:py-20 md:py-24 bg-transparent">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1100px] min-w-0">
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-extrabold text-center text-[#1e1c2f] mb-4 ${testimonialsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={testimonialsInView.inView ? { animationFillMode: "both" } : undefined}
          >
            {t("testimonials.title")}
          </h2>
          <p
            className={`text-center text-[#6b748a] text-lg mb-14 ${testimonialsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={testimonialsInView.inView ? { animationDelay: "0.08s", animationFillMode: "both" } : undefined}
          >
            {t("testimonials.subtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((item, i) => (
              <div
                key={item.author}
                className={`testimonial-card-php relative rounded-[32px] border-2 border-[rgba(224,216,247,0.6)] bg-white/95 backdrop-blur-xl p-6 pt-14 sm:p-8 sm:pt-16 md:p-10 md:pt-16 text-center shadow-[0_20px_50px_rgba(66,50,120,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] cursor-default flex flex-col h-full ${testimonialsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                style={testimonialsInView.inView ? { animationDelay: `${0.15 + i * 0.1}s`, animationFillMode: "both" } : undefined}
              >
                <div className="testimonial-card-php__avatar absolute -top-5 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full overflow-hidden border-[5px] border-white/95 shadow-[0_12px_28px_rgba(122,99,241,0.25)] bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] flex items-center justify-center z-[2]">
                  <img src={item.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="testimonial-card-php__quote text-[3rem] text-[rgba(122,99,241,0.15)] font-serif leading-none mb-5">"</div>
                <p className="text-[#1e1c2f] italic text-[1.08rem] leading-[1.9] mb-6 flex-1">{t(`testimonials.${item.quote}`)}</p>
                <div className="pt-6 border-t-2 border-[rgba(224,216,247,0.5)] relative w-full">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#7a63f1] to-transparent" />
                  <p className="text-[#7a63f1] font-bold text-[1.15rem] mb-1">{t(`testimonials.${item.author}`)}</p>
                  <p className="text-[#9a8bc4] text-[0.95rem] font-medium">{t(`testimonials.${item.role}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secțiune telefoane – copiată din PHP: centru + două ies din spate stânga/dreapta */}
      <section
        ref={phoneInView.ref}
        className={`section alt phone-section py-12 sm:py-16 md:py-[90px] bg-transparent flex items-center justify-center relative overflow-x-hidden md:overflow-visible ${phoneInView.inView ? "animate-phones" : ""}`}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-[1100px] min-w-0 w-full">
          <div className="phone-stack-container">
            <img
              src="/Illustration/LeftIphone.png"
              alt=""
              role="presentation"
              className="phone-behind phone-left"
            />
            <img
              src="/Illustration/MainIphone13.png"
              alt="Work2Now – aplicație mobilă"
              className="phone-main"
            />
            <img
              src="/Illustration/RightIphone.png"
              alt=""
              role="presentation"
              className="phone-behind phone-right"
            />
          </div>
        </div>
      </section>

      {/* CTA – PHP style: glass-like bg, centered */}
      <section
        ref={ctaInView.ref}
        className="relative py-16 sm:py-20 md:py-24 overflow-hidden bg-white/60 backdrop-blur-xl border-t border-b border-[rgba(224,216,247,0.9)] text-center"
      >
        <div className="container relative mx-auto px-4 sm:px-6 max-w-[1100px] min-w-0">
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#1e1c2f] mb-5 ${ctaInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={ctaInView.inView ? { animationFillMode: "both" } : undefined}
          >
            {t("cta.title")}
          </h2>
          <p
            className={`text-[#4d5874] text-lg mb-8 max-w-2xl mx-auto ${ctaInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={ctaInView.inView ? { animationDelay: "0.08s", animationFillMode: "both" } : undefined}
          >
            {t("cta.lead")}
          </p>
          <div
            className={`flex flex-wrap justify-center gap-4 ${ctaInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={ctaInView.inView ? { animationDelay: "0.16s", animationFillMode: "both" } : undefined}
          >
            <button
              type="button"
              onClick={() => roleModal?.openRoleModal()}
              className="btn-primary rounded-full px-6 py-3"
            >
              {t("cta.signup")}
            </button>
            <Link
              to="/find-jobs"
              className="btn-secondary rounded-full px-6 py-3"
            >
              {t("cta.viewJobs")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
