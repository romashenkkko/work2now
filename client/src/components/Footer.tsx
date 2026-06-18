import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const PAYMENT_LOGOS = [
  { src: "/Illustration/logosistemdeplata/visa.png", alt: "Visa" },
  { src: "/Illustration/logosistemdeplata/mastercard.png", alt: "Mastercard" },
  { src: "/Illustration/logosistemdeplata/paynet.png", alt: "Paynet" },
] as const;

export default function Footer() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <footer
      ref={ref}
      className={`footer-appear bg-white/50 backdrop-blur-[20px] border-t border-[rgba(224,216,247,0.6)] text-[#4d5874] py-14 mt-20 ${inView ? "footer-in-view" : ""}`}
    >
      <div className="container mx-auto px-4 max-w-[1100px]">
        <div className="flex flex-wrap justify-between items-start gap-10">
          <div className="footer-appear__block footer-appear__block--0 flex-1 min-w-[250px]">
            <Link to="/" className="flex items-center gap-2.5 mb-3" aria-label="Work2Now logo">
              <span className="grid place-items-center w-[34px] h-[34px] rounded-xl bg-[#7a63f1] flex-shrink-0">
                <img src="/LogoWork2Now.png" alt="" className="w-[80%] h-[80%] object-cover rounded-xl mt-0.5" />
              </span>
              <span className="font-bold text-[1.1rem] text-[#1e1c2f] hover:text-[#7a63f1] transition-colors">Work2Now</span>
            </Link>
            <p className="text-[#6b748a] text-[0.95rem] leading-relaxed mt-3">{t("footer.tagline")}</p>
            <address className="not-italic mt-5 pt-5 border-t border-[rgba(224,216,247,0.4)] flex flex-col gap-2 text-[0.88rem] text-[#6b748a] leading-relaxed">
              <p className="font-semibold text-[#1e1c2f]">{t("footer.companyLegalName")}</p>
              <p>
                <span className="font-medium text-[#4d5874]">{t("footer.addressLabel")}: </span>
                {t("footer.companyAddress")}
              </p>
              <p>
                <span className="font-medium text-[#4d5874]">{t("footer.emailLabel")}: </span>
                <a
                  href={`mailto:${t("footer.companyEmail")}`}
                  className="hover:text-[#7a63f1] transition-colors break-all"
                >
                  {t("footer.companyEmail")}
                </a>
              </p>
            </address>
          </div>
          <div className="footer-appear__block footer-appear__block--1 flex flex-col gap-2.5 min-w-[150px]">
            <Link to="/about" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.about")}</Link>
            <Link to="/how-it-works" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.howItWorks")}</Link>
            <Link to="/employers" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.employers")}</Link>
            <Link to="/app" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.app")}</Link>
          </div>
          <div className="footer-appear__block footer-appear__block--2 flex flex-col gap-2.5 min-w-[150px]">
            <Link to="/find-jobs" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.findJobs")}</Link>
            <Link to="/find-staff" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.findStaff")}</Link>
            <Link to="/blog" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.blog")}</Link>
            <Link to="/contact" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.contact")}</Link>
          </div>
          <div className="footer-appear__block footer-appear__block--3 flex flex-col gap-2.5 min-w-[150px]">
            <Link to="/login" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.login")}</Link>
            <Link to="/register" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.register")}</Link>
            <Link to="/locations" className="text-[#6b748a] text-[0.95rem] font-medium hover:text-[#7a63f1] transition-colors">{t("footer.locations")}</Link>
          </div>
        </div>
        <div className="footer-appear__block footer-appear__block--4 mt-10 pt-8 border-t border-[rgba(224,216,247,0.5)] flex flex-wrap justify-between items-center gap-6">
          <p className="text-[0.85rem] font-medium text-[#6b748a]">{t("footer.paymentMethods")}</p>
          <div className="flex flex-wrap items-center gap-3" aria-label={t("footer.paymentMethods")}>
            {PAYMENT_LOGOS.map((logo) => (
              <img
                key={logo.alt}
                src={logo.src}
                alt={logo.alt}
                className="h-6 w-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        </div>
        <div className="footer-appear__block footer-appear__block--5 mt-6 flex flex-wrap justify-between items-center gap-4 text-[0.9rem] text-[#9a8bc4]">
          <p>{t("footer.copyright")}</p>
          <div>
            <a href="#" className="text-[#9a8bc4] hover:text-[#7a63f1] transition-colors">{t("footer.privacy")}</a>
            <span className="mx-3">•</span>
            <a href="#" className="text-[#9a8bc4] hover:text-[#7a63f1] transition-colors">{t("footer.terms")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
