import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useRoleModal } from "../context/RoleModalContext";

const LANGS = ["ro", "en", "ru"] as const;

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const roleModal = useRoleModal();
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerAnimated, setHeaderAnimated] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeaderAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [langOpen]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (mobileOverlayRef.current?.contains(target) || mobileToggleRef.current?.contains(target)) return;
      setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClickOutside);
    };
  }, [mobileOpen]);
  const handleSignUp = (e: React.MouseEvent) => {
    e.preventDefault();
    roleModal?.openRoleModal();
  };

  const nav = (
    <>
      <Link to="/" className="text-gray-600 hover:text-primary font-medium transition-colors">
        {t("nav.home")}
      </Link>
      <Link to="/find-jobs" className="text-gray-600 hover:text-primary font-medium transition-colors">
        {t("nav.findJobs")}
      </Link>
      <Link to="/find-staff" className="text-gray-600 hover:text-primary font-medium transition-colors">
        {t("nav.findStaff")}
      </Link>
      <Link to="/contact" className="text-gray-600 hover:text-primary font-medium transition-colors">
        {t("nav.contact")}
      </Link>
      <Link to="/blog" className="text-gray-600 hover:text-primary font-medium transition-colors">
        {t("nav.blog")}
      </Link>
    </>
  );

  return (
    <header
      className={`sticky top-0 z-50 bg-white/68 backdrop-blur-[16px] border-b border-[rgba(239,232,255,0.9)] shadow-[0_8px_20px_rgba(36,28,70,0.06)] origin-top ${
        headerAnimated ? "animate-nav-appear" : "opacity-0 -translate-y-[30px] scale-y-95"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-5 py-4 flex items-center justify-between gap-4 max-w-[1200px]">
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0" aria-label="Work2Now logo">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#7a63f1] text-white flex-shrink-0">
            <img src="/LogoWork2Now.png" alt="" className="w-[80%] h-[80%] object-cover rounded-xl mt-0.5" />
          </span>
          <span className="font-bold text-[1.1rem] text-[#1e1c2f] group-hover:text-[#6c58d6] transition-colors whitespace-nowrap">Work2Now</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 lg:gap-8 flex-1 justify-center font-semibold text-[#1e1c2f] [&_a]:text-[#1e1c2f] [&_a:hover]:text-[#6c58d6] [&_a:hover]:-translate-y-0.5 [&_a]:transition-all [&_a]:whitespace-nowrap">
          {nav}
        </nav>

        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          {user ? (
            <>
              <Link to="/dashboard" className="btn-signup-php py-2.5 px-4 text-sm min-w-0 max-w-[200px] truncate" title={user.name}>
                {t("nav.hello", { name: user.name })}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="btn-signin-php whitespace-nowrap"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-signin-php whitespace-nowrap">
                {t("nav.signIn")}
              </Link>
              <button type="button" onClick={handleSignUp} className="btn-signup-php py-2.5 px-5 text-sm whitespace-nowrap">
                {t("nav.signUp")}
              </button>
            </>
          )}
          <div ref={langDropdownRef} className={`lang-dropdown-wrap relative flex-shrink-0 ${langOpen ? "lang-dropdown-open" : ""}`}>
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="lang-btn-php flex items-center gap-1 px-4 h-11 rounded-full bg-white border border-[#e1dcff] shadow-sm text-[#2b2460] hover:bg-[#f4f1ff] hover:border-[#c4b6ff] hover:-translate-y-0.5 transition-all text-sm font-semibold"
              aria-expanded={langOpen}
              aria-haspopup="true"
            >
              <span className="uppercase">{i18n.language.slice(0, 2)}</span>
              <span className="text-[10px] opacity-70" aria-hidden>▾</span>
            </button>
            <div className="lang-dropdown-menu" role="menu" aria-hidden={!langOpen}>
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    i18n.changeLanguage(l);
                    setLangOpen(false);
                  }}
                  className="lang-dropdown-item uppercase text-sm font-semibold text-[#4b3bb4]"
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          ref={mobileToggleRef}
          type="button"
          className={`mobile-menu-toggle ${mobileOpen ? "active" : ""}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Închide meniul" : "Deschide meniul"}
          aria-expanded={mobileOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Overlay meniu mobil – structură și animații ca în PHP (slide overlay + slideInActions + slideInNav) */}
      <div ref={mobileOverlayRef} className={`mobile-menu-overlay ${mobileOpen ? "active" : ""}`}>
        <div className="mobile-menu-panel">
          <div className="mobile-menu-actions">
            {user ? (
              <>
                <Link to="/dashboard" className="btn btn-signup" onClick={() => setMobileOpen(false)}>{t("nav.hello", { name: user.name })}</Link>
                <button type="button" onClick={() => { logout(); setMobileOpen(false); }} className="btn btn-signin">
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-signin" onClick={() => setMobileOpen(false)}>{t("nav.signIn")}</Link>
                <button type="button" onClick={handleSignUp} className="btn btn-signup">
                  {t("nav.signUp")}
                </button>
              </>
            )}
            <div className="mobile-menu-lang">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => i18n.changeLanguage(l)}
                  className="mobile-lang-option"
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <nav className="mobile-menu-nav">
            <Link to="/" onClick={() => setMobileOpen(false)}>{t("nav.home")}</Link>
            <Link to="/find-jobs" onClick={() => setMobileOpen(false)}>{t("nav.findJobs")}</Link>
            <Link to="/find-staff" onClick={() => setMobileOpen(false)}>{t("nav.findStaff")}</Link>
            <Link to="/contact" onClick={() => setMobileOpen(false)}>{t("nav.contact")}</Link>
            <Link to="/blog" onClick={() => setMobileOpen(false)}>{t("nav.blog")}</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
