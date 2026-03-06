import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { PiggyBank, Briefcase, Crown, Gem, Check, X, ChevronLeft, ChevronRight } from "lucide-react";

type PlanId = "basic" | "standard" | "premium" | "vip";

const CARD_WIDTH = 280;
const CARD_GAP = 24;

const PLANS: { id: PlanId; icon: typeof PiggyBank; popular?: boolean }[] = [
  { id: "basic", icon: PiggyBank },
  { id: "standard", icon: Briefcase },
  { id: "premium", icon: Crown, popular: true },
  { id: "vip", icon: Gem },
];

function PlanCard({
  plan,
  isCenter,
  t,
}: {
  plan: (typeof PLANS)[number];
  isCenter: boolean;
  t: (key: string, fallback?: string) => string;
}) {
  const Icon = plan.icon;
  const isPopular = plan.popular === true;
  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden bg-white border flex-shrink-0 transition-all duration-500 ease-out ${
        isCenter ? "shadow-xl scale-105 z-10 ring-2 ring-primary/20" : "shadow-lg scale-95 opacity-80"
      } ${isPopular ? "border-primary/30" : "border-gray-200"}`}
      style={{ width: CARD_WIDTH }}
    >
      {isPopular && (
        <div className="absolute top-0 right-0 z-10 overflow-hidden w-24 h-24">
          <div className="absolute top-4 right-[-32px] rotate-45 bg-primary text-white text-[10px] font-bold uppercase tracking-wider py-1 px-6 shadow-md">
            {t("dashboard.subscriptionPopular", "Popular")}
          </div>
        </div>
      )}
      <div className="relative bg-gray-800 text-white pt-6 pb-8 px-4">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-white/90">
          {t(`dashboard.plan.${plan.id}`, plan.id)}
        </p>
        <div className="flex justify-center mt-3">
          <div className="rounded-xl bg-white/10 p-3">
            <Icon className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
        </div>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
          style={{
            borderLeft: "24px solid transparent",
            borderRight: "24px solid transparent",
            borderTop: "14px solid #1f2937",
          }}
        />
      </div>
      <div className="flex-1 flex flex-col rounded-b-2xl bg-white px-5 pt-6 pb-5 -mt-px">
        <div className="text-center mb-4">
          <span className="text-3xl font-bold text-gray-900">
            {t(`dashboard.planPrice.${plan.id}`, plan.id === "basic" ? "0" : plan.id === "standard" ? "99" : plan.id === "premium" ? "199" : "399")}
          </span>
          <span className="text-gray-500 text-sm font-medium ml-1">
            {t("dashboard.planPerMonth", "MDL/lună")}
          </span>
        </div>
        <ul className="space-y-2.5 mb-6 flex-1 text-sm text-gray-600">
          {(t(`dashboard.planFeatures.${plan.id}`, "") as string)
            .split("|")
            .filter(Boolean)
            .map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                {line.startsWith("x:") ? (
                  <>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                      <X className="w-3 h-3 text-gray-500" />
                    </span>
                    <span>{line.slice(2)}</span>
                  </>
                ) : (
                  <>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </span>
                    <span>{line}</span>
                  </>
                )}
              </li>
            ))}
        </ul>
        <Link
          to="/contact"
          onClick={(e) => e.stopPropagation()}
          className={`block w-full py-3 px-4 rounded-xl text-center text-sm font-bold uppercase tracking-wider transition-colors ${
            isPopular
              ? "bg-gray-800 text-white border-2 border-gray-800 hover:bg-gray-700"
              : "bg-white text-gray-800 border-2 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {t("dashboard.planCta", "Solicită oferta")}
        </Link>
      </div>
    </div>
  );
}

export default function DashboardSubscription() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeIndex, setActiveIndex] = useState(2); // Premium în centru la început
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  const isCustomer = user?.role?.toLowerCase?.() === "customer";
  const hasBooster = user?.boosterUntil && new Date(user.boosterUntil) > new Date();
  const boosterUntilDate = user?.boosterUntil ? new Date(user.boosterUntil) : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.offsetWidth);
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const trackOffset = containerWidth / 2 - CARD_WIDTH / 2 - activeIndex * (CARD_WIDTH + CARD_GAP);
  const trackWidth = PLANS.length * CARD_WIDTH + (PLANS.length - 1) * CARD_GAP;

  if (!user) return <Navigate to="/login" replace />;
  if (!isCustomer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-600">{t("dashboard.subscriptionForCustomers", "Abonamentul Booster este disponibil pentru clienți (angajatori).")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      {hasBooster && boosterUntilDate && (
        <div className="subscription-banner-enter mb-8 rounded-2xl bg-gradient-to-r from-amber-50 to-primary/5 border border-amber-200/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold">
              {t("dashboard.boosterActive", "Booster activ")}
            </span>
            <span className="text-gray-700 text-sm sm:text-base">
              {t("dashboard.subscriptionActiveUntil", "Abonamentul tău Booster este activ până la {{date}}.", {
                date: boosterUntilDate.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
              })}
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="subscription-title-enter text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {t("dashboard.subscription", "Abonament")}
          </h1>
          <p className="mt-2 text-gray-600 max-w-xl mx-auto">
            {t("dashboard.subscriptionSubtitle", "Booster – joburile tale apar primele în listă pentru candidați.")}
          </p>
        </div>

        {/* Carousel: un card în centru, celelalte pe părți */}
        <div ref={containerRef} className="relative overflow-hidden">
        <div
          className="flex items-start transition-transform duration-500 ease-out"
          style={{
            width: trackWidth,
            transform: `translateX(${trackOffset}px)`,
            gap: CARD_GAP,
          }}
        >
          {PLANS.map((plan, index) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
              aria-label={t(`dashboard.plan.${plan.id}`, plan.id)}
            >
              <PlanCard plan={plan} isCenter={index === activeIndex} t={t} />
            </button>
          ))}
        </div>

        {/* Săgeți */}
        <button
          type="button"
          onClick={() => setActiveIndex((i) => (i > 0 ? i - 1 : PLANS.length - 1))}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/95 shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-white hover:border-primary/30 hover:text-primary transition-colors"
          aria-label={t("dashboard.previous", "Anterior")}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => setActiveIndex((i) => (i < PLANS.length - 1 ? i + 1 : 0))}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/95 shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-white hover:border-primary/30 hover:text-primary transition-colors"
          aria-label={t("dashboard.next", "Următor")}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

        {/* Indicatori (puncte) */}
        <div className="flex justify-center gap-2 mt-6">
          {PLANS.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-8 bg-primary" : "w-2 bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={t("dashboard.plan." + PLANS[index].id, PLANS[index].id)}
            />
          ))}
        </div>

        {/* Overlay blur + Coming soon */}
        <div
          className="absolute inset-0 top-0 bottom-0 left-0 right-0 rounded-2xl flex items-center justify-center bg-white/40 backdrop-blur-md pointer-events-auto"
          aria-hidden
        >
          <span className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight drop-shadow-sm">
            {t("dashboard.comingSoon", "Coming soon")}
          </span>
        </div>
      </div>

      <p className="subscription-footer-enter mt-8 text-center text-sm text-gray-500 max-w-xl mx-auto">
        {t("dashboard.subscriptionContact", "Pentru a activa un plan, contactează administratorul platformei sau solicită oferta prin secțiunea Contact.")}
      </p>
    </div>
  );
}
