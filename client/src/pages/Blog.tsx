import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRef, useEffect, useState } from "react";

const POSTS = [
  { date: "15 Ianuarie 2026", title: "Cum sa iti creezi un profil atractiv pe Work2Now", desc: "Sfaturi practice pentru a-ti optimiza profilul si a atrage mai multe oferte de joburi.", icon: "📝" },
  { date: "10 Ianuarie 2026", title: "Recrutare flexibila: viitorul angajarii", desc: "De ce joburile flexibile devin din ce in ce mai populare si cum beneficiaza angajatorii si angajatii.", icon: "💼" },
  { date: "5 Ianuarie 2026", title: "Work2Now se extinde in Romania", desc: "Lansarea platformei in Romania si cum poti beneficia de serviciile noastre.", icon: "🚀" },
  { date: "28 Decembrie 2025", title: "Plata rapida: cum functioneaza", desc: "Salariul in maxim 48 de ore dupa finalizarea jobului.", icon: "💰" },
  { date: "20 Decembrie 2025", title: "Aplicatia mobila Work2Now", desc: "Gestionare joburi, notificari, plata si multe altele.", icon: "📱" },
  { date: "15 Decembrie 2025", title: "Sfaturi pentru angajatori", desc: "Cum sa scrii anunturi eficiente si sa gasesti personalul potrivit rapid.", icon: "⭐" },
];

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function Blog() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="min-h-[60vh] bg-gradient-to-b from-transparent via-[rgba(122,99,241,0.02)] to-transparent">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        {/* Hero */}
        <section
          className="rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[rgba(122,99,241,0.14)] via-[rgba(157,123,255,0.10)] to-[rgba(122,99,241,0.16)] border border-[rgba(122,99,241,0.25)] shadow-[0_8px_32px_rgba(122,99,241,0.15)] mb-20 py-14 sm:py-20 px-6 sm:px-12 text-center"
          aria-label={t("blogPage.title")}
        >
          <p className="inline-block text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.2em] text-[#7a63f1] mb-5 px-4 py-2.5 rounded-full bg-white/70 border border-[rgba(122,99,241,0.25)]">
            {t("blogPage.label", "Blog")}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1e1c2f] tracking-tight mb-4">
            {t("blogPage.title")}
          </h1>
          <div className="w-20 h-1 rounded-full bg-gradient-to-r from-transparent via-[#7a63f1]/60 to-transparent mx-auto mb-5" aria-hidden />
          <p className="text-[#3d3a4a] text-lg sm:text-xl leading-relaxed max-w-xl mx-auto">
            {t("blogPage.lead")}
          </p>
        </section>

        {/* Aranjament zigzag: conținut alternat stânga / dreapta, accent vertical, separatori eleganti */}
        <div className="space-y-0">
          {POSTS.map((post, i) => (
            <Strip
              key={post.title}
              post={post}
              index={i}
              visible={visible}
              readMoreLabel={t("blogPage.readMore")}
              alignRight={i % 2 === 1}
            />
          ))}
        </div>

        {/* Secțiune încheiere – CTA */}
        <footer className="mt-20 sm:mt-24 pt-12 pb-8 border-t border-[#e8e4f5]/60 text-center rounded-2xl bg-[rgba(122,99,241,0.04)]/50">
          <p className="text-[#5a5276] text-sm sm:text-base mb-6">
            {t("blogPage.ctaTitle", "Continua explorarea")}
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link
              to="/find-jobs"
              className="inline-flex items-center gap-2 text-[#7a63f1] font-semibold hover:gap-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:ring-offset-2 rounded-lg px-2 py-1"
            >
              {t("blogPage.ctaJobs", "Vezi joburile")}
              <span aria-hidden>→</span>
            </Link>
            <span className="text-[#c4bed8]" aria-hidden>·</span>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-[#7a63f1] font-semibold hover:gap-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:ring-offset-2 rounded-lg px-2 py-1"
            >
              {t("blogPage.ctaContact", "Contact")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Strip({
  post,
  index,
  visible,
  readMoreLabel,
  alignRight,
}: {
  post: (typeof POSTS)[0];
  index: number;
  visible: boolean;
  readMoreLabel: string;
  alignRight: boolean;
}) {
  const { ref, inView } = useInView(0.1);
  const show = visible && inView;
  const isFirst = index === 0;
  const fromRight = index % 2 === 0;

  return (
    <article
      ref={ref}
      style={
        show
          ? {
              animation: `${fromRight ? "blog-in-from-right" : "blog-in-from-left"} 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
              animationDelay: `${index * 0.08}s`,
            }
          : { opacity: 0, transform: fromRight ? "translateX(48px)" : "translateX(-48px)" }
      }
    >
      <a
        href="#"
        className={`group relative block w-full py-12 sm:py-16 px-4 sm:px-8 md:px-12 transition-colors duration-300 hover:bg-[rgba(122,99,241,0.06)] ${
          index < POSTS.length - 1 ? "border-b border-[#e8e4f5]/60" : ""
        }`}
      >
        {/* Accent vertical – gradient pe latura activă */}
        <div
          className={`absolute top-8 bottom-8 w-0.5 bg-gradient-to-b from-[#7a63f1]/30 via-[#9d7bff]/40 to-[#7a63f1]/30 hidden sm:block ${
            alignRight ? "right-4 md:right-8" : "left-4 md:left-8"
          }`}
          aria-hidden
        />
        <div
          className={`relative max-w-2xl ${alignRight ? "ml-auto text-right" : "mr-auto text-left"}`}
        >
          <time
            className="block text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[#7a63f1] mb-2"
            dateTime="2026-01-15"
          >
            {post.date}
          </time>
          <div
            className={`h-px w-12 mb-4 ${alignRight ? "ml-auto bg-gradient-to-l from-[#7a63f1]/50 to-transparent" : "bg-gradient-to-r from-[#7a63f1]/50 to-transparent"}`}
            aria-hidden
          />
          <h2
            className={`font-extrabold text-[#1e1c2f] leading-tight mb-3 group-hover:text-[#7a63f1] transition-colors duration-200 ${
              isFirst ? "text-2xl sm:text-3xl md:text-4xl" : "text-xl sm:text-2xl md:text-3xl"
            }`}
          >
            {post.title}
          </h2>
          <p className={`text-[#5a5276] text-sm sm:text-base leading-relaxed mb-5 ${alignRight ? "text-right" : "text-left"}`}>
            {post.desc}
          </p>
          <span className={`inline-flex items-center gap-2 text-sm font-semibold text-[#7a63f1] group-hover:gap-3 transition-all duration-200 ${alignRight ? "flex-row-reverse" : ""}`}>
            {readMoreLabel}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden>→</span>
          </span>
        </div>
      </a>
    </article>
  );
}
