import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BookOpen, BriefcaseBusiness, Building2, CreditCard, Smartphone, Sparkles } from "lucide-react";
import { useInView } from "../hooks/useInView";

const POSTS = [
  { slug: "post1", dateTime: "2026-01-15", Icon: BookOpen },
  { slug: "post2", dateTime: "2026-01-10", Icon: BriefcaseBusiness },
  { slug: "post3", dateTime: "2026-01-05", Icon: Building2 },
  { slug: "post4", dateTime: "2025-12-28", Icon: CreditCard },
  { slug: "post5", dateTime: "2025-12-20", Icon: Smartphone },
  { slug: "post6", dateTime: "2025-12-15", Icon: Sparkles },
];

export default function Blog() {
  const { t } = useTranslation();
  const pageInView = useInView({ threshold: 0.08 });
  const featuredPost = POSTS[0];
  const secondaryPosts = POSTS.slice(1);

  return (
    <div ref={pageInView.ref} className="min-h-[60vh] bg-gradient-to-b from-transparent via-[rgba(122,99,241,0.03)] to-transparent">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        {/* Hero */}
        <section
          className={`rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[rgba(122,99,241,0.14)] via-[rgba(157,123,255,0.10)] to-[rgba(122,99,241,0.16)] border border-[rgba(122,99,241,0.25)] shadow-[0_8px_32px_rgba(122,99,241,0.15)] mb-10 sm:mb-12 py-14 sm:py-20 px-6 sm:px-12 text-center ${pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
          style={pageInView.inView ? { animationFillMode: "both" } : undefined}
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

        <section
          className={`mb-8 sm:mb-10 ${pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
          style={pageInView.inView ? { animationDelay: "0.08s", animationFillMode: "both" } : undefined}
        >
          <FeaturedPostCard post={featuredPost} readMoreLabel={t("blogPage.readMore")} />
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {secondaryPosts.map((post, index) => (
            <BlogPostCard
              key={post.slug}
              post={post}
              readMoreLabel={t("blogPage.readMore")}
              inView={pageInView.inView}
              index={index}
            />
          ))}
        </section>

        {/* Secțiune încheiere – CTA */}
        <footer
          className={`mt-16 sm:mt-20 pt-10 sm:pt-12 pb-8 border-t border-[#e8e4f5]/60 text-center rounded-2xl bg-[rgba(122,99,241,0.04)]/50 ${pageInView.inView ? "animate-fade-up" : "opacity-0 translate-y-5"}`}
          style={pageInView.inView ? { animationDelay: "0.18s", animationFillMode: "both" } : undefined}
        >
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

function FeaturedPostCard({
  post,
  readMoreLabel,
}: {
  post: (typeof POSTS)[0];
  readMoreLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <article>
      <a
        href="#"
        className="group relative block overflow-hidden rounded-[28px] border border-[rgba(224,216,247,0.7)] bg-white/90 backdrop-blur-sm p-6 sm:p-8 md:p-10 shadow-[0_18px_50px_rgba(122,99,241,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(122,99,241,0.14)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(157,123,255,0.16),transparent_38%)] pointer-events-none" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <post.Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <time className="block text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[#7a63f1] mb-2" dateTime={post.dateTime}>
              {t(`blogPage.posts.${post.slug}.date`)}
            </time>
            <h2 className="font-extrabold text-[#1e1c2f] leading-tight mb-3 text-2xl sm:text-3xl md:text-[2rem] group-hover:text-[#7a63f1] transition-colors duration-200">
              {t(`blogPage.posts.${post.slug}.title`)}
            </h2>
            <p className="text-[#5a5276] text-sm sm:text-base leading-relaxed mb-6 max-w-2xl">
              {t(`blogPage.posts.${post.slug}.desc`)}
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a63f1] group-hover:gap-3 transition-all duration-200">
              {readMoreLabel}
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden>→</span>
            </span>
          </div>
        </div>
      </a>
    </article>
  );
}

function BlogPostCard({
  post,
  readMoreLabel,
  inView,
  index,
}: {
  post: (typeof POSTS)[0];
  readMoreLabel: string;
  inView: boolean;
  index: number;
}) {
  const { t } = useTranslation();
  return (
    <article
      className={inView ? "animate-fade-up" : "opacity-0 translate-y-5"}
      style={inView ? { animationDelay: `${0.14 + index * 0.07}s`, animationFillMode: "both" } : undefined}
    >
      <a
        href="#"
        className="group block h-full rounded-[24px] border border-[rgba(224,216,247,0.7)] bg-white/90 backdrop-blur-sm p-6 sm:p-7 shadow-[0_12px_36px_rgba(122,99,241,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(122,99,241,0.35)] hover:shadow-[0_18px_44px_rgba(122,99,241,0.12)]"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <post.Icon className="w-6 h-6" strokeWidth={2} />
        </div>
        <time className="block text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[#7a63f1] mb-2" dateTime={post.dateTime}>
            {t(`blogPage.posts.${post.slug}.date`)}
        </time>
        <h2 className="font-bold text-[#1e1c2f] leading-tight mb-3 text-xl sm:text-2xl group-hover:text-[#7a63f1] transition-colors duration-200">
          {t(`blogPage.posts.${post.slug}.title`)}
        </h2>
        <p className="text-[#5a5276] text-sm sm:text-base leading-relaxed mb-5">
          {t(`blogPage.posts.${post.slug}.desc`)}
        </p>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a63f1] group-hover:gap-3 transition-all duration-200">
          {readMoreLabel}
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden>→</span>
        </span>
      </a>
    </article>
  );
}
