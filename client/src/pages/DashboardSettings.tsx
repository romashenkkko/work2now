import { useState, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Eye, EyeOff, MapPin, Briefcase } from "lucide-react";
import StarRating from "../components/StarRating";
import { authApi } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { DashboardContext } from "./DashboardLayout";
import BranchesSection from "../components/BranchesSection";
import ExperiencesSection from "../components/ExperiencesSection";

/** Avatari din folderul Illustration care încep cu Avatar */
const AVATAR_OPTIONS = [
  "/Illustration/AvatarArab.png",
  "/Illustration/AvatarBlackGuy.png",
  "/Illustration/AvatarBlackGuy2.png",
  "/Illustration/AvatarWhiteGirl.png",
  "/Illustration/AvatarWhiteGirl2.png",
  "/Illustration/AvatarWhiteGuy.png",
  "/Illustration/AvatarWhiteGuy2.png",
  "/Illustration/AvatarWhiteGuy3.png",
];

const LANGUAGES = [
  { code: "ro", label: "Română" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
] as const;
const SUPPORT_AVATAR_URL = "/Illustration/SupportAvatar.png";

type Section = "change-password" | "change-language" | "account-privacy" | "faq" | "contact" | "job-preferences" | "profile-info" | "branches" | "experiences";

const MENU_ICONS: Record<Section, React.ReactNode> = {
  "change-password": (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  "change-language": (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  ),
  "account-privacy": (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  faq: (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  contact: (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  "job-preferences": (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  "profile-info": (
    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  branches: (
    <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
  ),
  experiences: (
    <Briefcase className="w-5 h-5 text-gray-500 flex-shrink-0" />
  ),
};

/** 0 = none, 1 = weak, 2 = fair, 3 = good, 4 = strong */
function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password.length) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return 1;
  if (score <= 2) return 2;
  if (score <= 3) return 3;
  return 4;
}

const MENU_BUTTONS: { id: Section; labelKey: string }[] = [
  { id: "change-password", labelKey: "profile.changePassword" },
  { id: "change-language", labelKey: "profile.changeLanguage" },
  { id: "account-privacy", labelKey: "profile.accountPrivacy" },
  { id: "faq", labelKey: "profile.faq" },
  { id: "contact", labelKey: "profile.contactUs" },
  { id: "job-preferences", labelKey: "profile.jobPreferences" },
  { id: "profile-info", labelKey: "profile.profileInfo" },
  { id: "branches", labelKey: "profile.branches.title" },
  { id: "experiences", labelKey: "profile.experiences.title" },
];

export default function DashboardSettings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { availableToWork, setAvailableToWork, userRating } = useContext(DashboardContext);
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const userRole = user?.role?.toLowerCase?.().trim?.() ?? "";
  const profileAvatar = userRole === "support" ? SUPPORT_AVATAR_URL : user?.avatar || "/Illustration/AvatarWhiteGuy.png";

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactError("");
    setContactSuccess(false);
    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setContactError(t("contactPage.error"));
      return;
    }
    setContactSuccess(true);
    setContactName("");
    setContactEmail("");
    setContactSubject("");
    setContactMessage("");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: t("profile.passwordErrorShort") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: t("profile.passwordErrorMismatch") });
      return;
    }
    setPasswordLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: t("profile.passwordSuccess") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({ type: "error", text: (err as Error).message || t("profile.passwordErrorShort") });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <header className="mb-6 md:mb-8 w-full max-w-6xl flex items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t("profile.title")}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-0.5">{t("profile.subtitle")}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <img
            src={profileAvatar}
            alt=""
            className={`w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-md ${
              userRole === "support" ? "object-[center_82%]" : ""
            }`}
          />
          <div className="min-w-0 hidden sm:block">
            <p className="font-semibold text-gray-900 truncate">{user?.name ?? ""}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email ?? ""}</p>
            <div className="flex items-center gap-1 mt-1">
              <StarRating value={userRating?.average ?? 0} size={14} />
              {userRating && userRating.count > 0 && (
                <span className="text-xs text-gray-500">({userRating.count})</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6 w-full max-w-6xl">
        {/* Meniu butoane – vizibil doar când nu e deschisă nici o secțiune */}
        {activeSection === null && (
          <section className="page-enter bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-2">
              {MENU_BUTTONS.filter(({ id }) => {
                // Show branches only for business users (customer role)
                if (id === "branches") {
                  return user?.role === "customer";
                }
                // Show experiences only for staff users
                if (id === "experiences") {
                  return user?.role === "staff";
                }
                return true;
              }).map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    {MENU_ICONS[id]}
                    {t(labelKey)}
                  </span>
                  <span className="text-gray-400 text-lg font-light">›</span>
                </button>
              ))}
            </div>

            {/* Available to work – toggle */}
            <div className="border-t border-gray-100 px-4 py-3.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-3 text-sm font-medium text-gray-800">
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {availableToWork ? t("profile.availableToWork") : t("profile.unavailable")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={availableToWork}
                onClick={() => setAvailableToWork(!availableToWork)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  availableToWork ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    availableToWork ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        {/* Conținut secțiune activă – pe aceeași pagină, cu animație, doar secțiunea deschisă + Înapoi */}
        {activeSection !== null && (
          <div className="page-enter">
            {activeSection === "change-password" && (
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors mb-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  {t("profile.back")}
                </button>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("profile.changePassword")}</h2>
            <p className="text-sm text-gray-500 mb-4">{t("profile.changePasswordDesc")}</p>
            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">{t("profile.currentPassword")}</span>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                    aria-label={showCurrentPw ? t("profile.hidePassword") : t("profile.showPassword")}
                  >
                    {showCurrentPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">{t("profile.newPassword")}</span>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                    aria-label={showNewPw ? t("profile.hidePassword") : t("profile.showPassword")}
                  >
                    {showNewPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">{t("profile.minChars")}</p>
                <div className="mt-3">
                  <div className="flex gap-0.5 mb-1.5" aria-hidden>
                    {[0, 1, 2, 3].map((i) => {
                      const strength = getPasswordStrength(newPassword);
                      const active = i < strength;
                      return (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-sm transition-colors ${
                            active
                              ? strength === 1
                                ? "bg-red-400"
                                : strength === 2
                                  ? "bg-amber-400"
                                  : strength === 3
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              : "bg-gray-200"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500">
                    {t("profile.passwordStrength")}{" "}
                    <span className="text-gray-700 font-medium">
                      {t(`profile.passwordStrength${["None", "Weak", "Fair", "Good", "Strong"][getPasswordStrength(newPassword)]}`)}
                    </span>
                  </p>
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">{t("profile.confirmNewPassword")}</span>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="block w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                    aria-label={showConfirmPw ? t("profile.hidePassword") : t("profile.showPassword")}
                  >
                    {showConfirmPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </label>
              {passwordMessage && (
                <p
                  className={`text-sm font-medium ${
                    passwordMessage.type === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {passwordMessage.text}
                </p>
              )}
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {passwordLoading ? t("profile.processing") : t("profile.submitChangePassword")}
              </button>
            </form>
          </section>
        )}

        {activeSection === "change-language" && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {t("profile.back")}
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("profile.language")}</h2>
            <p className="text-sm text-gray-500 mb-4">{t("profile.languageDesc")}</p>
            <div className="flex flex-wrap gap-3">
              {LANGUAGES.map(({ code, label }) => {
                const currentLang = (i18n.language || "").toLowerCase().split("-")[0];
                const isActive = currentLang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => i18n.changeLanguage(code)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeSection === "account-privacy" && (
          <PlaceholderSection title={t("profile.accountPrivacy")} backLabel={t("profile.back")} onBack={() => setActiveSection(null)}>
            {t("profile.placeholderAccount")}
          </PlaceholderSection>
        )}
        {activeSection === "faq" && (
          <PlaceholderSection title={t("profile.faq")} backLabel={t("profile.back")} onBack={() => setActiveSection(null)}>
            {t("profile.placeholderFaq")}
          </PlaceholderSection>
        )}
        {activeSection === "contact" && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 pb-4 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors mb-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                {t("profile.back")}
              </button>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">{t("profile.contactUs")}</h2>
              <p className="text-sm text-gray-500">{t("profile.placeholderContact")}</p>
            </div>

            <div className="p-6 pt-5">
              {contactSuccess && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
                  {t("contactPage.success")}
                </div>
              )}
              {contactError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                  {contactError}
                </div>
              )}

              <div className="grid lg:grid-cols-[1fr_1.25fr] gap-8 lg:gap-10 items-start">
                {/* Carduri contact – aliniate uniform */}
                <div className="space-y-3">
                  <a
                    href="mailto:contact@work2now.local"
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-primary mb-1">{t("contactPage.email")}</span>
                      <span className="block text-gray-900 font-medium text-sm truncate">contact@work2now.local</span>
                    </div>
                  </a>
                  <a
                    href="tel:+37360123456"
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-primary mb-1">{t("contactPage.phone")}</span>
                      <span className="block text-gray-900 font-medium text-sm">+373 60 123 456</span>
                    </div>
                  </a>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80">
                    <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-primary mb-1">{t("contactPage.location")}</span>
                      <span className="block text-gray-900 font-medium text-sm">Chisinau, Moldova</span>
                    </div>
                  </div>
                </div>

                {/* Formular – spațiere uniformă */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 shadow-sm">
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1.5">{t("contactPage.fullName")}</span>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-900 placeholder:text-gray-400"
                          placeholder={t("contactPage.fullName")}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1.5">{t("contactPage.email")}</span>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-900 placeholder:text-gray-400"
                          placeholder="email@exemplu.com"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">{t("contactPage.subject")}</span>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-900 placeholder:text-gray-400"
                        placeholder={t("contactPage.subject")}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">{t("contactPage.message")}</span>
                      <textarea
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        required
                        rows={4}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary text-gray-900 placeholder:text-gray-400 resize-none"
                        placeholder={t("contactPage.message")}
                      />
                    </label>
                    <div className="pt-1">
                      <button type="submit" className="w-full sm:w-auto min-w-[180px] px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark shadow-md hover:shadow-lg transition-all">
                        {t("contactPage.send")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>
        )}
        {activeSection === "job-preferences" && (
          <PlaceholderSection title={t("profile.jobPreferences")} backLabel={t("profile.back")} onBack={() => setActiveSection(null)}>
            {t("profile.placeholderJobPrefs")}
          </PlaceholderSection>
        )}
        {activeSection === "profile-info" && (
          <ProfileInfoSection
            onBack={() => setActiveSection(null)}
            t={t}
            avatarOptions={AVATAR_OPTIONS}
          />
        )}
        {activeSection === "branches" && (
          <BranchesSection
            onBack={() => setActiveSection(null)}
            t={t}
          />
        )}
        {activeSection === "experiences" && (
          <ExperiencesSection
            onBack={() => setActiveSection(null)}
            t={t}
          />
        )}
          </div>
        )}
      </div>
    </>
  );
}

function ProfileInfoSection({
  onBack,
  t,
  avatarOptions,
}: {
  onBack: () => void;
  t: (key: string) => string;
  avatarOptions: string[];
}) {
  const { user, setUser } = useAuth();
  const isSupportRole = (user?.role ?? "").toLowerCase().trim() === "support";
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sincronizează avatarul din context când user se actualizează (ex. după login/refresh)
  useEffect(() => {
    if (isSupportRole) {
      setAvatar(SUPPORT_AVATAR_URL);
      return;
    }
    if (user?.avatar != null) setAvatar(user.avatar);
  }, [user?.avatar, isSupportRole]);

  const currentAvatar = isSupportRole ? SUPPORT_AVATAR_URL : avatar || avatarOptions[0];

  const handleSave = async () => {
    const nameTrim = name.trim();
    if (nameTrim.length < 2) {
      setMessage({ type: "error", text: t("profile.nameMinLength") });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await authApi.updateProfile({ name: nameTrim, avatar: isSupportRole ? SUPPORT_AVATAR_URL : avatar || undefined });
      setUser(isSupportRole ? { ...updated, avatar: SUPPORT_AVATAR_URL } : updated);
      setMessage({ type: "success", text: t("profile.profileSaved") });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {t("profile.back")}
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("profile.profileInfo")}</h2>
      <p className="text-gray-600 text-sm mb-4">{t("profile.editProfileDescNoEmail")}</p>

      <div className="flex flex-col sm:flex-row gap-6 mb-6">
        <div className="flex flex-col items-center gap-2">
          <img
            src={currentAvatar}
            alt=""
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            onError={(e) => { (e.target as HTMLImageElement).src = avatarOptions[0]; }}
          />
          <span className="text-xs text-gray-500">{t("profile.profilePicture")}</span>
          <label
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              isSupportRole
                ? "cursor-not-allowed text-gray-400 border-gray-200 bg-gray-50"
                : "cursor-pointer text-primary border-primary/30 hover:bg-primary/5"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {isSupportRole ? t("profile.avatarLocked", "Avatar blocat pentru support") : t("profile.uploadPersonalPhoto")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={isSupportRole}
              onChange={(e) => {
                if (isSupportRole) return;
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
                const maxSize = 800 * 1024;
                if (file.size > maxSize) {
                  setMessage({ type: "error", text: t("profile.imageTooBig") });
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  setAvatar(dataUrl);
                  setMessage(null);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        <div className="flex-1 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("profile.nickname")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder={t("profile.nicknamePlaceholder")}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              disabled
              className="mt-1 block w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <span className="text-xs text-gray-500 mt-1 block">{t("profile.emailNotEditable")}</span>
          </label>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-2">{t("profile.chooseAvatar")}</h3>
        <p className="text-xs text-gray-500 mb-2">{t("profile.chooseAvatarOrUpload")}</p>
        {isSupportRole ? (
          <p className="text-xs text-gray-500">{t("profile.avatarLocked", "Avatar blocat pentru support")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {avatarOptions.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => { setAvatar(src); setMessage(null); }}
                className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-colors flex-shrink-0 ${
                  avatar === src ? "border-primary ring-2 ring-primary/30" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
      >
        {saving ? "..." : t("profile.save")}
      </button>
    </section>
  );
}

function PlaceholderSection({
  title,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {backLabel}
      </button>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-600">{children}</div>
    </section>
  );
}
