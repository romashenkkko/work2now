import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRoleModal } from "../context/RoleModalContext";
import { useInView } from "../hooks/useInView";

/* Ilustrații SVG pentru secțiunea Stats – design rafinat, gradienturi, forme rotunjite */
function StatsIllusJobs() {
  return (
    <svg className="stats-illus stats-illus--pretty" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="stats-jobs-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9d7bff" />
          <stop offset="100%" stopColor="#7a63f1" />
        </linearGradient>
        <linearGradient id="stats-jobs-paper" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#f8f6ff" stopOpacity="0.98" />
        </linearGradient>
      </defs>
      {/* Clipboard / document elegant */}
      <rect x="28" y="18" width="64" height="68" rx="10" fill="url(#stats-jobs-paper)" stroke="url(#stats-jobs-grad)" strokeWidth="2.5" />
      <rect x="52" y="14" width="16" height="10" rx="4" fill="url(#stats-jobs-grad)" opacity="0.9" />
      <path d="M38 36h44v5H38zM38 46h36v4H38zM38 56h40v4H38zM38 66h28v4H38z" fill="url(#stats-jobs-grad)" fillOpacity="0.4" />
      <circle cx="78" cy="76" r="12" fill="url(#stats-jobs-grad)" />
      <path d="M74 76l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function StatsIllusWorkers() {
  return (
    <svg className="stats-illus stats-illus--pretty" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="stats-people-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b8a4ff" />
          <stop offset="100%" stopColor="#7a63f1" />
        </linearGradient>
        <linearGradient id="stats-people-grad2" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#6b54e0" />
          <stop offset="100%" stopColor="#9d7bff" />
        </linearGradient>
        <linearGradient id="stats-people-soft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8e2ff" />
          <stop offset="100%" stopColor="#d4c8ff" />
        </linearGradient>
        <filter id="stats-people-shadow" x="-20%" y="-10%" width="140%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#7a63f1" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* Trei siluete elegante – cap rotund, guler, umeri */}
      <g filter="url(#stats-people-shadow)">
        {/* Persoana stânga */}
        <g transform="translate(12, 28)">
          <ellipse cx="14" cy="10" rx="9" ry="10" fill="url(#stats-people-soft)" stroke="url(#stats-people-grad1)" strokeWidth="1.8" />
          <path d="M5 28c0-4 4-8 9-8s9 4 9 8v24H5V28z" fill="url(#stats-people-grad1)" fillOpacity="0.2" stroke="url(#stats-people-grad1)" strokeWidth="1.6" strokeLinejoin="round" />
        </g>
        {/* Persoana centru (mai mare) */}
        <g transform="translate(42, 18)">
          <ellipse cx="18" cy="12" rx="11" ry="12" fill="url(#stats-people-soft)" stroke="url(#stats-people-grad2)" strokeWidth="2" />
          <path d="M7 32c0-5 5-10 11-10s11 5 11 10v28H7V32z" fill="url(#stats-people-grad2)" fillOpacity="0.25" stroke="url(#stats-people-grad2)" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
        {/* Persoana dreapta */}
        <g transform="translate(78, 28)">
          <ellipse cx="14" cy="10" rx="9" ry="10" fill="url(#stats-people-soft)" stroke="url(#stats-people-grad1)" strokeWidth="1.8" />
          <path d="M5 28c0-4 4-8 9-8s9 4 9 8v24H5V28z" fill="url(#stats-people-grad1)" fillOpacity="0.2" stroke="url(#stats-people-grad1)" strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const roleModal = useRoleModal();
  const statsInView = useInView({ threshold: 0.15 });
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

  const features = [
    { icon: "img", img: "/Illustration/MobileIcon.png", key: "pay48", desc: "pay48Desc", primary: true },
    { icon: "img", img: "/Illustration/BancCardIcon.png", key: "digital", desc: "digitalDesc", primary: false },
    { icon: "🎯", key: "matching", desc: "matchingDesc", primary: false },
    { icon: "🔄", key: "flex", desc: "flexDesc", primary: false },
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

        <div className="container relative z-[2] mx-auto px-4 sm:px-5 py-10 sm:py-14 md:py-28 max-w-[1100px]">
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 sm:gap-10 md:gap-20 items-center">
            <div className="hero-content order-1 text-center md:text-left">
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
            <div className="relative min-h-[200px] sm:min-h-[280px] md:min-h-[420px] flex items-center justify-center order-2">
              <div className="relative flex justify-center items-center w-full max-w-[280px] sm:max-w-[340px] md:max-w-none mx-auto">
                <img
                  src="/Illustration/White human coffe.png"
                  alt="Work2Now"
                  className="relative z-[1] w-full max-w-[380px] object-contain object-bottom drop-shadow-[0_20px_40px_rgba(122,99,241,0.15)] hover:-translate-y-1 hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats – Work2Now în cifre cu ilustrații */}
      <section ref={statsInView.ref} className="stats-section py-12 sm:py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-[1100px]">
          <h2
            className={`stats-section__title text-center text-[#1e1c2f] mb-8 sm:mb-10 md:mb-16 ${statsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={statsInView.inView ? { animationDelay: "0s", animationFillMode: "both" } : undefined}
          >
            {t("stats.title")}
          </h2>
          <div className="stats-grid grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-8 sm:gap-x-8 sm:gap-y-6 md:gap-x-12 md:gap-y-8 lg:gap-16 justify-items-center items-center max-w-2xl sm:max-w-none mx-auto">
            {[
              { value: "500+", labelKey: "jobs", illustration: "jobs" },
              { value: "2.000+", labelKey: "workers", illustration: "workers" },
              { value: "150+", labelKey: "companies", illustration: "companies" },
            ].map((stat, i) => (
              <div
                key={`illus-${stat.labelKey}`}
                className={`stats-item__illus w-full flex justify-center items-center ${i === 0 ? "order-1" : i === 1 ? "order-4" : "order-7"} sm:order-none ${stat.labelKey === "companies" ? "stats-item__illus--companies" : ""} ${statsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                style={statsInView.inView ? { animationDelay: `${0.05 + i * 0.1}s`, animationFillMode: "both" } : undefined}
              >
                {stat.illustration === "jobs" && <StatsIllusJobs />}
                {stat.illustration === "workers" && <StatsIllusWorkers />}
                {stat.illustration === "companies" && (
                  <img src="/Illustration/Hands.png" alt="" className="stats-illus stats-illus--pretty object-contain" aria-hidden />
                )}
              </div>
            ))}
            {[
              { value: "500+", labelKey: "jobs" },
              { value: "2.000+", labelKey: "workers" },
              { value: "150+", labelKey: "companies" },
            ].map((stat, i) => (
              <p
                key={`value-${stat.labelKey}`}
                className={`stats-item__value w-full text-center ${i === 0 ? "order-2" : i === 1 ? "order-5" : "order-8"} sm:order-none ${statsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                style={statsInView.inView ? { animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: "both" } : undefined}
              >
                {stat.value}
              </p>
            ))}
            {[
              { labelKey: "jobs" },
              { labelKey: "workers" },
              { labelKey: "companies" },
            ].map((stat, i) => (
              <p
                key={`label-${stat.labelKey}`}
                className={`stats-item__label w-full text-center ${i === 0 ? "order-3" : i === 1 ? "order-6" : "order-9"} sm:order-none ${statsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                style={statsInView.inView ? { animationDelay: `${0.15 + i * 0.1}s`, animationFillMode: "both" } : undefined}
              >
                {t(`stats.${stat.labelKey}`)}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Features – De ce Work2Now? – 2x2 grid, responsive */}
      <section ref={featuresInView.ref} className="py-12 sm:py-16 md:py-24 bg-transparent">
        <div className="container mx-auto px-4 sm:px-5 max-w-[1100px]">
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
                className={`rounded-2xl sm:rounded-[28px] p-6 sm:p-8 md:p-10 border-2 border-[rgba(224,216,247,0.6)] backdrop-blur-xl text-left flex flex-col ${f.primary
                  ? "bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] text-white shadow-[0_20px_40px_rgba(75,60,120,0.12)]"
                  : "card-soft"
                } ${featuresInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                style={featuresInView.inView ? { animationDelay: `${0.12 + i * 0.1}s`, animationFillMode: "both" } : undefined}
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-4 sm:mb-6">
                  {f.icon === "img" && f.img ? (
                    <img src={f.img} alt="" className="w-full h-full object-contain brightness-110" />
                  ) : (
                    <span className="text-3xl sm:text-4xl drop-shadow-md">{f.icon}</span>
                  )}
                </div>
                <h3 className={`font-bold text-base sm:text-lg mb-2 sm:mb-3 ${f.primary ? "text-white" : "text-[#1e1c2f]"}`}>{t(`features.${f.key}`)}</h3>
                <p className={`${f.primary ? "text-white/95" : "text-[#6b748a]"} text-sm sm:text-base leading-relaxed`}>{t(`features.${f.desc}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For who – two paths: staff vs employer, with illustration */}
      <section ref={forWhoInView.ref} className="py-28 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2
            className={`text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4 ${forWhoInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={forWhoInView.inView ? { animationFillMode: "both" } : undefined}
          >
            {t("forWho.title")}
          </h2>
          <p
            className={`text-center text-gray-600 text-lg mb-16 max-w-2xl mx-auto ${forWhoInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
            style={forWhoInView.inView ? { animationDelay: "0.06s", animationFillMode: "both" } : undefined}
          >
            {t("forWho.subtitle")}
          </p>
          <div className="grid md:grid-cols-2 gap-10 items-stretch">
            <div
              className={`rounded-3xl border-2 border-[#6366F1]/30 bg-white p-10 shadow-soft hover:-translate-y-2 hover:shadow-soft-lg hover:border-[#6366F1]/50 flex flex-col transition-transform duration-300 ${forWhoInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
              style={forWhoInView.inView ? { animationDelay: "0.12s", animationFillMode: "both" } : undefined}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-3xl mb-6 shadow-soft">
                👤
              </div>
              <h3 className="font-bold text-gray-900 text-xl mb-3">{t("forWho.staffTitle")}</h3>
              <p className="text-gray-600 leading-relaxed flex-1 mb-8">{t("forWho.staffDesc")}</p>
              <Link to="/find-jobs" className="btn-primary w-fit hover:scale-[1.02] active:scale-[0.98] transition-transform">
                {t("forWho.staffCta")}
              </Link>
            </div>
            <div
              className={`rounded-3xl border-2 border-[#FB7185]/30 bg-white p-10 shadow-soft hover:-translate-y-2 hover:shadow-soft-lg hover:border-[#FB7185]/50 flex flex-col relative overflow-hidden transition-transform duration-300 ${forWhoInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
              style={forWhoInView.inView ? { animationDelay: "0.22s", animationFillMode: "both" } : undefined}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FB7185] to-[#F9A8D4] flex items-center justify-center text-3xl mb-6 shadow-soft">
                🏢
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
      <section ref={stepsInView.ref} className="py-24 bg-transparent">
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
          <h2
            className={`text-3xl md:text-4xl font-extrabold text-[#1e1c2f] mb-5 ${stepsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
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
                    className={`card-soft p-8 rounded-[24px] ${stepsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
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
      <section ref={testimonialsInView.ref} className="py-24 bg-transparent">
        <div className="container mx-auto px-4 max-w-[1100px]">
          <h2
            className={`text-3xl md:text-4xl font-extrabold text-center text-[#1e1c2f] mb-4 ${testimonialsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
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
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((item, i) => (
              <div
                key={item.author}
                className={`testimonial-card-php relative rounded-[32px] border-2 border-[rgba(224,216,247,0.6)] bg-white/95 backdrop-blur-xl p-10 pt-16 text-center shadow-[0_20px_50px_rgba(66,50,120,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] cursor-default ${testimonialsInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
                style={testimonialsInView.inView ? { animationDelay: `${0.15 + i * 0.1}s`, animationFillMode: "both" } : undefined}
              >
                <div className="testimonial-card-php__avatar absolute -top-5 left-1/2 -translate-x-1/2 w-[90px] h-[90px] rounded-full overflow-hidden border-[5px] border-white/95 shadow-[0_12px_28px_rgba(122,99,241,0.25)] bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] flex items-center justify-center z-[2]">
                  <img src={item.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="testimonial-card-php__quote text-[3rem] text-[rgba(122,99,241,0.15)] font-serif leading-none mb-5">"</div>
                <p className="text-[#1e1c2f] italic text-[1.08rem] leading-[1.9] mb-6">{t(`testimonials.${item.quote}`)}</p>
                <div className="pt-5 border-t-2 border-[rgba(224,216,247,0.5)] relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-0.5 bg-gradient-to-r from-transparent via-[#7a63f1] to-transparent" />
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
        className={`section alt phone-section py-[90px] bg-transparent flex items-center justify-center relative overflow-visible ${phoneInView.inView ? "animate-phones" : ""}`}
      >
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="phone-stack-container">
            <img
              src="/Illustration/Screenshot-iPhone15 Pro Max.png"
              alt="iPhone 15 Pro Max – Work2Now"
              className="phone-main"
            />
            <img
              src="/Illustration/Screenshot-iPhone1321.png"
              alt=""
              role="presentation"
              className="phone-behind phone-left"
            />
            <img
              src="/Illustration/Screenshot-iPhone1321.png"
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
        className="relative py-24 overflow-hidden bg-white/60 backdrop-blur-xl border-t border-b border-[rgba(224,216,247,0.9)] text-center"
      >
        <div className="container relative mx-auto px-4 max-w-[1100px]">
          <h2
            className={`text-3xl md:text-4xl font-extrabold text-[#1e1c2f] mb-5 ${ctaInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
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
