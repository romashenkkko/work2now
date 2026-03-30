import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  ChevronDown,
  Plus,
  Bell,
  Star,
  ListFilter,
  CheckCircle2,
  PlusCircle,
  Users,
  HandshakeIcon,
} from "lucide-react";

function MockupPostJob() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-primary/15 bg-white shadow-[0_4px_20px_rgba(122,99,241,0.08)] overflow-hidden text-left text-[13px] pointer-events-none select-none">
      <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
          <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-white font-semibold">{t("findStaff.mockupPostTitle")}</span>
      </div>
      <div className="p-4 space-y-2.5">
        <div className="w-full h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center px-3 text-gray-400 text-[13px]">{t("findStaff.mockupRolePlaceholder")}</div>
        <div className="flex gap-2.5">
          <div className="flex-1 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center px-3 text-gray-400">12:00</div>
          <div className="flex-1 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center px-3 text-gray-400">20:00</div>
        </div>
        <div className="h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center px-3 text-gray-400">{t("findStaff.mockupLocationPlaceholder")}</div>
        <div className="h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center px-3 text-gray-400">{t("findStaff.mockupSalaryPlaceholder")}</div>
        <div className="w-full h-10 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 mt-1 shadow-[0_4px_12px_rgba(122,99,241,0.25)] pointer-events-none select-none">
          <Plus className="w-4 h-4" /> {t("findStaff.mockupPostNow")}
        </div>
      </div>
    </div>
  );
}

function MockupCandidates() {
  const { t } = useTranslation();
  const candidates = [
    { name: "Alex I.", rating: 4.8, status: "new", exp: t("findStaff.mockupExp3") },
    { name: "Maria P.", rating: 4.5, status: "new", exp: t("findStaff.mockupExp1") },
    { name: "Ion D.", rating: 4.9, status: "applied", exp: t("findStaff.mockupExp5") },
  ];
  return (
    <div className="rounded-2xl border border-primary/15 bg-white shadow-[0_4px_20px_rgba(122,99,241,0.08)] overflow-hidden text-left text-[13px] pointer-events-none select-none">
      <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 flex items-center gap-2.5">
        <Bell className="w-4 h-4 text-white" />
        <span className="text-white font-semibold">{t("findStaff.mockupCandidatesTitle")}</span>
        <span className="ml-auto bg-white/25 text-white px-2 py-0.5 rounded-full text-[11px] font-bold">{t("findStaff.mockupCandidatesNewCount")}</span>
      </div>
      <div className="p-4 space-y-2.5">
        {candidates.map((c) => (
          <div key={c.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {c.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{c.name}</p>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{c.rating}</span>
                <span className="text-gray-300">·</span>
                <span>{c.exp}</span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.status === "new" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
              {c.status === "new" ? t("findStaff.mockupCandidateNew") : t("findStaff.mockupCandidateApplied")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupRecruit() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-primary/15 bg-white shadow-[0_4px_20px_rgba(122,99,241,0.08)] overflow-hidden text-left text-[13px] pointer-events-none select-none">
      <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3 flex items-center gap-2.5">
        <ListFilter className="w-4 h-4 text-white" />
        <span className="text-white font-semibold">{t("findStaff.mockupRecruitTitle")}</span>
      </div>
      <div className="p-4 space-y-2.5">
        <div className="flex gap-2">
          <div className="flex-1 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center px-2 text-primary font-semibold">Ospitar</div>
          <div className="flex-1 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center px-2 text-gray-400">Barman</div>
          <div className="flex-1 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center px-2 text-gray-400">Bucatar</div>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-green-50 border border-green-200">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400/30 to-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">Alex I.</p>
            <p className="text-[11px] text-green-600 font-medium">{t("findStaff.mockupAcceptedReady")}</p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-primary text-white text-[11px] font-semibold shadow-sm pointer-events-none select-none">{t("findStaff.mockupContact")}</span>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300/30 to-amber-400/10 flex items-center justify-center text-amber-600 font-bold text-sm">I</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">Ion D.</p>
            <p className="text-[11px] text-amber-600 font-medium">{t("findStaff.mockupInReview")}</p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[11px] font-semibold pointer-events-none select-none">{t("findStaff.mockupProfile")}</span>
        </div>
      </div>
    </div>
  );
}

const stepMockups = [MockupPostJob, MockupCandidates, MockupRecruit];
const stepIcons = [PlusCircle, Users, HandshakeIcon];

const steps = ["step1", "step2", "step3"] as const;

export default function FindStaff() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [openStep, setOpenStep] = useState(0);

  return (
    <div className="find-staff-page min-h-[60vh]">
      <div className="container mx-auto px-4 py-12 sm:py-16 max-w-6xl">
        {/* Card principal integrat – titlu + pași (mai mare, design rafinat) */}
        <section className="find-staff-hero-steps max-w-5xl mx-auto mb-14 sm:mb-20 rounded-[24px] sm:rounded-[32px] overflow-hidden border border-[rgba(224,216,247,0.5)] bg-white shadow-[0_0_0_1px_rgba(122,99,241,0.06),0_20px_50px_rgba(122,99,241,0.08),0_8px_24px_rgba(0,0,0,0.04)]">
          {/* Header glassmorphism */}
          <div className="relative px-8 sm:px-14 pt-14 sm:pt-20 pb-10 sm:pb-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(122,99,241,0.12)] via-[rgba(157,123,255,0.06)] to-[rgba(122,99,241,0.1)]" />
            <div className="absolute inset-0 backdrop-blur-[3px]" />
            <div className="relative">
              <p className="inline-flex items-center gap-2 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-widest text-primary/90 mb-6 px-4 py-2.5 rounded-full bg-white/70 border border-primary/15 shadow-[0_2px_12px_rgba(122,99,241,0.08)] backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/80" aria-hidden />
                {t("findStaff.badge")}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-extrabold tracking-tight mb-3 max-w-2xl mx-auto leading-[1.15]">
                <span className="bg-gradient-to-r from-[#1e1c2f] via-[#2d2a3f] to-primary bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(122,99,241,0.15)]">
                  {t("findStaff.title")}
                </span>
              </h1>
              <div className="w-20 h-1 sm:w-24 sm:h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mb-4 opacity-90" aria-hidden />
              <p className="text-primary font-medium text-sm sm:text-base max-w-md mx-auto">
                {t("findStaff.heroSub")}
              </p>
            </div>
          </div>

          {/* Acordion pași – carduri mai vizibile */}
          <div className="bg-[#f5f3fa] px-6 sm:px-10 pb-10 sm:pb-12 space-y-4">
            {steps.map((key, index) => {
              const isOpen = openStep === index;
              const Mockup = stepMockups[index];
              const StepIcon = stepIcons[index];
              return (
                <div
                  key={key}
                  className={`find-staff-step-card relative rounded-2xl sm:rounded-[22px] transition-all duration-300 overflow-hidden border-2 ${
                    isOpen
                      ? "border-primary/30 bg-white shadow-[0_6px_28px_rgba(122,99,241,0.15),0_0_0_1px_rgba(122,99,241,0.1)]"
                      : "border-primary/15 bg-white hover:border-primary/25 hover:shadow-[0_4px_16px_rgba(122,99,241,0.08)]"
                  }`}
                  style={isOpen ? undefined : undefined}
                >
                  {/* Accent stânga – liquid glass */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                      isOpen ? "w-1.5" : "w-0.5"
                    }`}
                    style={isOpen ? {
                      background: "linear-gradient(180deg, rgba(122,99,241,0.7) 0%, rgba(157,123,255,0.5) 40%, rgba(122,99,241,0.2) 100%)",
                      boxShadow: "0 0 16px rgba(122,99,241,0.35), 0 0 4px rgba(122,99,241,0.5)",
                      borderRadius: "0 6px 6px 0",
                    } : {
                      background: "rgba(200,195,220,0.35)",
                      borderRadius: "0 3px 3px 0",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setOpenStep(isOpen ? -1 : index)}
                    className="w-full flex items-center gap-3 sm:gap-5 pl-7 pr-5 sm:pl-9 sm:pr-7 py-5 sm:py-6 text-left"
                  >
                    <span
                      className={`flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        isOpen
                          ? "bg-primary text-white shadow-[0_6px_20px_rgba(122,99,241,0.35)]"
                          : "bg-white text-primary/70 border border-primary/15 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                      }`}
                    >
                      <StepIcon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={1.8} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-[15px] sm:text-base block transition-colors ${isOpen ? "text-[#1e1c2f]" : "text-gray-700"}`}>
                        {t(`findStaff.${key}Title`)}
                      </span>
                      {!isOpen && (
                        <span className="text-xs text-gray-400 hidden sm:block mt-0.5 line-clamp-1">{t(`findStaff.${key}Desc`)}</span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${isOpen ? "rotate-180 text-primary" : "text-gray-300"}`}
                      strokeWidth={2}
                    />
                  </button>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateRows: isOpen ? "1fr" : "0fr",
                      transition: "grid-template-rows 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="pl-7 pr-5 sm:pl-9 sm:pr-7 pb-7 sm:pb-9">
                        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
                          <p className="flex-1 text-gray-600 text-sm sm:text-[15px] leading-relaxed order-2 md:order-1 md:pt-1 min-w-0">
                            {t(`findStaff.${key}Desc`)}
                          </p>
                          <div className="w-full md:w-[320px] lg:w-[380px] flex-shrink-0 order-1 md:order-2">
                            <Mockup />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Beneficii */}
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

        {/* CTA */}
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
