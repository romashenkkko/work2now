import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError(t("contactPage.error"));
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 max-w-6xl">
      {/* Header */}
      <header className="text-center max-w-2xl mx-auto mb-14 md:mb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1e1c2f] mb-4 tracking-tight">
          {t("contactPage.title")}
        </h1>
        <p className="text-[#4d5874] text-lg leading-relaxed">
          {t("contactPage.lead")}
        </p>
      </header>

      {success && (
        <div className="mb-8 p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-medium text-center shadow-sm">
          {t("contactPage.success")}
        </div>
      )}
      {error && (
        <div className="mb-8 p-5 rounded-2xl bg-red-50 border border-red-200/80 text-red-700 font-medium text-center shadow-sm">
          {error}
        </div>
      )}

      {/* Two columns: contact info + form */}
      <div className="grid lg:grid-cols-[1fr_1.35fr] gap-10 lg:gap-14 items-start">
        {/* Left: contact cards */}
        <div className="space-y-5">
          <a
            href="mailto:contact@work2now.local"
            className="contact-card group flex items-center gap-5 p-5 rounded-2xl bg-white/90 border border-[rgba(224,216,247,0.5)] shadow-[0_4px_24px_-4px_rgba(122,99,241,0.12)] hover:shadow-[0_12px_40px_-8px_rgba(122,99,241,0.2)] hover:border-[rgba(122,99,241,0.35)] transition-all duration-300"
          >
            <span className="contact-card__icon flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] flex items-center justify-center text-white shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#7a63f1] mb-1">{t("contactPage.email")}</span>
              <span className="text-[#1e1c2f] font-semibold group-hover:text-[#6c58d6] transition-colors">contact@work2now.local</span>
            </div>
          </a>
          <a
            href="tel:+37360123456"
            className="contact-card group flex items-center gap-5 p-5 rounded-2xl bg-white/90 border border-[rgba(224,216,247,0.5)] shadow-[0_4px_24px_-4px_rgba(122,99,241,0.12)] hover:shadow-[0_12px_40px_-8px_rgba(122,99,241,0.2)] hover:border-[rgba(122,99,241,0.35)] transition-all duration-300"
          >
            <span className="contact-card__icon flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] flex items-center justify-center text-white shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#7a63f1] mb-1">{t("contactPage.phone")}</span>
              <span className="text-[#1e1c2f] font-semibold group-hover:text-[#6c58d6] transition-colors">+373 60 123 456</span>
            </div>
          </a>
          <div className="contact-card flex items-center gap-5 p-5 rounded-2xl bg-white/90 border border-[rgba(224,216,247,0.5)] shadow-[0_4px_24px_-4px_rgba(122,99,241,0.12)]">
            <span className="contact-card__icon flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7a63f1] to-[#9d7bff] flex items-center justify-center text-white shadow-lg shadow-primary/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#7a63f1] mb-1">{t("contactPage.location")}</span>
              <span className="text-[#1e1c2f] font-semibold">Chisinau, Moldova</span>
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="rounded-3xl bg-white border border-[rgba(224,216,247,0.6)] shadow-[0_20px_50px_-12px_rgba(75,60,120,0.15),0_8px_24px_-8px_rgba(122,99,241,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8 md:p-10">
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-[#1e1c2f] mb-2">{t("contactPage.fullName")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="contact-input w-full px-4 py-3.5 rounded-xl border border-[rgba(224,216,247,0.6)] bg-[#faf9ff]/80 text-[#1e1c2f] placeholder:text-[#9b9fb0] focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:border-[#7a63f1] transition-all"
                  placeholder={t("contactPage.fullName")}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1e1c2f] mb-2">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="contact-input w-full px-4 py-3.5 rounded-xl border border-[rgba(224,216,247,0.6)] bg-[#faf9ff]/80 text-[#1e1c2f] placeholder:text-[#9b9fb0] focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:border-[#7a63f1] transition-all"
                  placeholder="email@exemplu.com"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1e1c2f] mb-2">{t("contactPage.subject")}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="contact-input w-full px-4 py-3.5 rounded-xl border border-[rgba(224,216,247,0.6)] bg-[#faf9ff]/80 text-[#1e1c2f] placeholder:text-[#9b9fb0] focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:border-[#7a63f1] transition-all"
                placeholder={t("contactPage.subject")}
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm font-semibold text-[#1e1c2f] mb-2">{t("contactPage.message")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="contact-input w-full px-4 py-3.5 rounded-xl border border-[rgba(224,216,247,0.6)] bg-[#faf9ff]/80 text-[#1e1c2f] placeholder:text-[#9b9fb0] focus:outline-none focus:ring-2 focus:ring-[#7a63f1]/50 focus:border-[#7a63f1] transition-all resize-none"
                placeholder={t("contactPage.message")}
              />
            </div>
            <button type="submit" className="btn-primary w-full sm:w-auto min-w-[200px]">
              {t("contactPage.send")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
