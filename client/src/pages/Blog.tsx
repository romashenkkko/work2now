import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useInView } from "../hooks/useInView";

const FAQ_IDS = [
  "register",
  "roles",
  "verifyPhone",
  "applyJob",
  "applicationStatus",
  "checkin",
  "cv",
  "postJob",
  "applicants",
  "payment",
  "account",
  "contact",
] as const;

export default function Blog() {
  const { t } = useTranslation();
  const pageInView = useInView({ threshold: 0.08 });
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div ref={pageInView.ref} className="min-h-[60vh] bg-gradient-to-b from-transparent via-[rgba(122,99,241,0.03)] to-transparent">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <section
          className={`rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[rgba(122,99,241,0.14)] via-[rgba(157,123,255,0.10)] to-[rgba(122,99,241,0.16)] border border-[rgba(122,99,241,0.25)] shadow-[0_8px_32px_rgba(122,99,241,0.15)] mb-10 sm:mb-12 py-12 sm:py-16 px-6 sm:px-10 text-center ${pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
          style={pageInView.inView ? { animationFillMode: "both" } : undefined}
          aria-label={t("helpPage.title")}
        >
          <p className="inline-flex items-center gap-2 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.2em] text-[#7a63f1] mb-5 px-4 py-2.5 rounded-full bg-white/70 border border-[rgba(122,99,241,0.25)]">
            <HelpCircle className="w-4 h-4" aria-hidden />
            {t("helpPage.label")}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-[2.5rem] font-extrabold text-[#1e1c2f] tracking-tight mb-4">
            {t("helpPage.title")}
          </h1>
          <div className="w-20 h-1 rounded-full bg-gradient-to-r from-transparent via-[#7a63f1]/60 to-transparent mx-auto mb-5" aria-hidden />
          <p className="text-[#3d3a4a] text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            {t("helpPage.lead")}
          </p>
        </section>

        <section
          className={`space-y-3 sm:space-y-4 ${pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
          style={pageInView.inView ? { animationDelay: "0.08s", animationFillMode: "both" } : undefined}
          aria-label={t("helpPage.faqSectionAria")}
        >
          {FAQ_IDS.map((id, index) => {
            const isOpen = openId === id;
            const q = t(`helpPage.faq.${id}.q`);
            const a = t(`helpPage.faq.${id}.a`);
            return (
              <article
                key={id}
                className={pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}
                style={pageInView.inView ? { animationDelay: `${0.1 + index * 0.04}s`, animationFillMode: "both" } : undefined}
              >
                <div className="rounded-2xl border border-[rgba(224,216,247,0.85)] bg-white/95 shadow-[0_8px_28px_rgba(122,99,241,0.07)] overflow-hidden">
                  <button
                    type="button"
                    id={`faq-trigger-${id}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${id}`}
                    onClick={() => toggle(id)}
                    className="w-full flex items-center gap-4 text-left px-5 py-4 sm:px-6 sm:py-5 hover:bg-[rgba(122,99,241,0.04)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                  >
                    <span className="flex-1 min-w-0 font-semibold text-[#1e1c2f] text-[15px] sm:text-base leading-snug pr-2">
                      {q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 shrink-0 text-primary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  <div
                    id={`faq-panel-${id}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${id}`}
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 text-[#5a5276] text-sm sm:text-[15px] leading-relaxed border-t border-gray-100/80">
                        <p className="pt-4">{a}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <footer
          className={`mt-14 sm:mt-16 pt-10 sm:pt-12 pb-8 border-t border-[#e8e4f5]/60 text-center rounded-2xl bg-[rgba(122,99,241,0.04)]/50 ${pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
          style={pageInView.inView ? { animationDelay: "0.2s", animationFillMode: "both" } : undefined}
        >
          <p className="text-[#5a5276] text-sm sm:text-base mb-6">{t("helpPage.ctaTitle")}</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link
              to="/find-jobs"
              className="inline-flex items-center gap-2 text-[#7a63f1] font-semibold hover:gap-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:ring-offset-2 rounded-lg px-2 py-1"
            >
              {t("helpPage.ctaJobs")}
              <span aria-hidden>→</span>
            </Link>
            <span className="text-[#c4bed8]" aria-hidden>
              ·
            </span>
            <Link
              to="/find-staff"
              className="inline-flex items-center gap-2 text-[#7a63f1] font-semibold hover:gap-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:ring-offset-2 rounded-lg px-2 py-1"
            >
              {t("helpPage.ctaEmployers")}
              <span aria-hidden>→</span>
            </Link>
            <span className="text-[#c4bed8]" aria-hidden>
              ·
            </span>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-[#7a63f1] font-semibold hover:gap-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:ring-offset-2 rounded-lg px-2 py-1"
            >
              {t("helpPage.ctaContact")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
