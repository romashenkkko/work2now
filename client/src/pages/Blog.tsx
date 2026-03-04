import { useTranslation } from "react-i18next";
import { useRef, useEffect, useState } from "react";

const POSTS = [
  { date: "15 Ianuarie 2026", title: "Cum sa iti creezi un profil atractiv pe Work2Now", desc: "Sfaturi practice pentru a-ti optimiza profilul si a atrage mai multe oferte de joburi. Afla ce fac angajatorii sa te aleaga.", icon: "📝" },
  { date: "10 Ianuarie 2026", title: "Recrutare flexibila: viitorul angajarii", desc: "De ce joburile flexibile devin din ce in ce mai populare si cum beneficiaza atat angajatorii cat si angajatii.", icon: "💼" },
  { date: "5 Ianuarie 2026", title: "Work2Now se extinde in Romania", desc: "Anuntam lansarea platformei in Romania. Afla cum poti beneficia de serviciile noastre in noul market.", icon: "🚀" },
  { date: "28 Decembrie 2025", title: "Plata rapida: cum functioneaza", desc: "Explicam procesul de plata rapida pe Work2Now si de ce primesti salariul in maxim 48 de ore dupa finalizarea jobului.", icon: "💰" },
  { date: "20 Decembrie 2025", title: "Aplicatia mobila Work2Now", desc: "Descopera functiile aplicatiei mobile: gestionare joburi, notificari, plata si multe altele.", icon: "📱" },
  { date: "15 Decembrie 2025", title: "Sfaturi pentru angajatori", desc: "Cum sa scrii anunturi eficiente si sa gasesti personalul potrivit rapid pe Work2Now.", icon: "⭐" },
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
    <div ref={sectionRef} className="blog-page">
      <div className="blog-page__inner">
        <header className="blog-page__header">
          <p className="blog-page__label">{t("blogPage.label", "Blog")}</p>
          <h1 className="blog-page__title">{t("blogPage.title")}</h1>
          <p className="blog-page__lead">{t("blogPage.lead")}</p>
        </header>

        <div className="blog-zigzag">
          {POSTS.map((post, i) => (
            <BlogItem
              key={post.title}
              post={post}
              index={i}
              visible={visible}
              readMoreLabel={t("blogPage.readMore")}
              isLast={i === POSTS.length - 1}
              alignRight={i % 2 === 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlogItem({
  post,
  index,
  visible,
  readMoreLabel,
  isLast,
  alignRight,
}: {
  post: (typeof POSTS)[0];
  index: number;
  visible: boolean;
  readMoreLabel: string;
  isLast: boolean;
  alignRight: boolean;
}) {
  const { ref, inView } = useInView(0.1);
  const show = visible && inView;
  const delay = index * 0.08;

  return (
    <article
      ref={ref}
      className={`blog-zigzag__item ${isLast ? "blog-zigzag__item--last" : ""} ${alignRight ? "blog-zigzag__item--right" : "blog-zigzag__item--left"}`}
      style={
        show
          ? {
              animation: "blog-zigzag-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards",
              animationDelay: `${delay}s`,
            }
          : { opacity: 0, transform: alignRight ? "translateX(12px)" : "translateX(-12px)" }
      }
    >
      <div className="blog-zigzag__center">
        <div className="blog-zigzag__node" aria-hidden>
          <span className="blog-zigzag__icon">{post.icon}</span>
        </div>
        <div className="blog-zigzag__line" aria-hidden />
      </div>
      {!alignRight ? (
        <a href="#" className="blog-zigzag__content blog-zigzag__content--left">
          <time className="blog-zigzag__date" dateTime="2026-01-15">{post.date}</time>
          <h2 className="blog-zigzag__title">{post.title}</h2>
          <p className="blog-zigzag__desc">{post.desc}</p>
          <span className="blog-zigzag__cta">
            {readMoreLabel}
            <span className="blog-zigzag__arrow" aria-hidden>→</span>
          </span>
        </a>
      ) : (
        <a href="#" className="blog-zigzag__content blog-zigzag__content--right">
          <time className="blog-zigzag__date" dateTime="2026-01-15">{post.date}</time>
          <h2 className="blog-zigzag__title">{post.title}</h2>
          <p className="blog-zigzag__desc">{post.desc}</p>
          <span className="blog-zigzag__cta">
            {readMoreLabel}
            <span className="blog-zigzag__arrow" aria-hidden>→</span>
          </span>
        </a>
      )}
    </article>
  );
}
