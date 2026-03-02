import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/client";
import DatePicker from "../components/DatePicker";
import { TERMS_AND_CONDITIONS_RO, TERMS_AND_CONDITIONS_EN } from "../content/termsAndConditions";

const COMPANY_CATEGORY_OPTIONS = [
  { value: "1", labelKey: "auth.companyCategoryCanteen" },
  { value: "2", labelKey: "auth.companyCategoryCatering" },
  { value: "3", labelKey: "auth.companyCategoryCafe" },
  { value: "4", labelKey: "auth.companyCategoryRestaurant" },
  { value: "5", labelKey: "auth.companyCategoryNightClub" },
  { value: "6", labelKey: "auth.companyCategoryHotel" },
  { value: "7", labelKey: "auth.companyCategoryBar" },
];

export default function Register() {
  const { t, i18n } = useTranslation();
  const termsContent = i18n.language?.startsWith("ro") ? TERMS_AND_CONDITIONS_RO : TERMS_AND_CONDITIONS_EN;
  const navigate = useNavigate();
  const { role: roleParam } = useParams<{ role: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const role = roleParam === "staff" || roleParam === "customer" ? roleParam : "user";
  
  // Staff/Employee fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(""); // Staff phone number
  
  // Business/Customer fields
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactPhoneNumber, setContactPhoneNumber] = useState(""); // Customer contact phone number
  const [companyCategory, setCompanyCategory] = useState("1");
  const [companyCategoryOpen, setCompanyCategoryOpen] = useState(false);
  const companyCategoryRef = useRef<HTMLDivElement>(null);
  const [infoForStaff, setInfoForStaff] = useState("");
  // Branch fields (at least one branch required)
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [branchCountry, setBranchCountry] = useState("Moldova");
  const [branchPhone, setBranchPhone] = useState("");

  // OTP verification state
  const [otpStep, setOtpStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  // Terms and Conditions modal – shown after form validation, before OTP
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAcceptLoading, setTermsAcceptLoading] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (companyCategoryRef.current && !companyCategoryRef.current.contains(e.target as Node)) {
        setCompanyCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  // La deschiderea modalului T&C: verificăm dacă conținutul e scurt (fără scroll necesar)
  useEffect(() => {
    if (!showTermsModal) {
      setTermsScrolledToBottom(false);
      return;
    }
    const check = () => {
      const el = termsScrollRef.current;
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight) setTermsScrolledToBottom(true);
    };
    check();
    const t = setTimeout(check, 100);
    return () => clearTimeout(t);
  }, [showTermsModal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setOtpError("");
    
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    
    // Validate role-specific required fields
    if (role === "staff") {
      if (!firstName.trim() || !lastName.trim()) {
        setError(t("auth.requiredNameSurname"));
        return;
      }
      if (!dateOfBirth) {
        setError(t("auth.dateOfBirthRequired"));
        return;
      }
      if (!phoneNumber.trim()) {
        setError(t("auth.phoneNumberRequired"));
        return;
      }
    } else if (role === "customer") {
      if (!companyName.trim()) {
        setError(t("auth.companyNameRequired"));
        return;
      }
      if (!contactFirstName.trim() || !contactLastName.trim()) {
        setError(t("auth.contactNameRequired"));
        return;
      }
      if (!contactPhoneNumber.trim()) {
        setError(t("auth.contactPhoneNumberRequired"));
        return;
      }
      if (!branchName.trim() || !branchAddress.trim() || !branchCity.trim() || !branchPhone.trim()) {
        setError(t("auth.branchFieldsRequired"));
        return;
      }
    }

    // If OTP is not verified yet, show Terms & Conditions modal first (user must accept before OTP)
    if (otpStep === "form") {
      setShowTermsModal(true);
      return;
    }

    // If OTP step, verify OTP first
    if (otpStep === "otp") {
      if (!otpCode.trim() || otpCode.trim().length < 4) {
        setOtpError(t("auth.otpCodeRequired"));
        return;
      }

      setOtpLoading(true);
      setOtpError("");
      try {
        const verifyResult = await authApi.verifyOTP(verifiedPhone, otpCode.trim());
        if (!verifyResult.verified) {
          setOtpError(t("auth.otpInvalid"));
          return;
        }
        // OTP verified, proceed with registration
      } catch (err) {
        setOtpError(err instanceof Error ? err.message : t("auth.otpVerifyError"));
        setOtpLoading(false);
        return;
      } finally {
        setOtpLoading(false);
      }
    }
    
    // Complete registration after OTP is verified
    setLoading(true);
    try {
      // MIGRATION FIX: Build registration data with profile information
      const registerData: any = { 
        name: role === "staff" ? `${firstName.trim()} ${lastName.trim()}` : companyName.trim(), // For backward compatibility
        email, 
        password, 
        role,
        phoneNumber: verifiedPhone, // Include verified phone number
      };
      
      if (role === "staff") {
        registerData.employeeProfile = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: dateOfBirth,
          aboutMe: aboutMe.trim() || t("auth.aboutMeDefault"),
        };
      } else if (role === "customer") {
        registerData.businessProfile = {
          companyName: companyName.trim(),
          contactFirstName: contactFirstName.trim(),
          contactLastName: contactLastName.trim(),
          companyCategory: parseInt(companyCategory, 10),
          infoForStaff: infoForStaff.trim() || t("auth.infoForStaffDefault"),
        };
        registerData.branch = {
          name: branchName.trim(),
          address: branchAddress.trim(),
          city: branchCity.trim(),
          country: branchCountry.trim() || "Moldova",
          phoneNumber: branchPhone.trim(),
        };
      }
      
      await authApi.register(registerData);
      setSuccess(t("auth.registerSuccess"));
      // Always redirect to login - onboarding will be checked after login
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptTerms() {
    const phoneToVerify = role === "staff" ? phoneNumber.trim() : contactPhoneNumber.trim();
    setTermsAcceptLoading(true);
    setOtpError("");
    try {
      await authApi.sendOTP(phoneToVerify);
      setVerifiedPhone(phoneToVerify);
      setShowTermsModal(false);
      setOtpStep("otp");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t("auth.otpSendError"));
    } finally {
      setTermsAcceptLoading(false);
    }
  }

  async function handleResendOTP() {
    setOtpLoading(true);
    setOtpError("");
    try {
      await authApi.sendOTP(verifiedPhone);
      setOtpCode("");
      setOtpError("");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t("auth.otpSendError"));
    } finally {
      setOtpLoading(false);
    }
  }

  const registerDesc = role === "staff" ? t("auth.registerDescStaff") : role === "customer" ? t("auth.registerDescCustomer") : t("auth.registerDesc");

  /* Când nu e ales niciun rol (URL /register), afișăm alegerea Staff / Customer */
  if (role === "user") {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--choose-role">
          <h1>{t("roleModal.title")}</h1>
          <p className="auth-muted">{t("roleModal.question")}</p>
          <div className="role-options role-options--page">
            <Link to="/register/staff" className="role-option">
              <div className="role-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor" />
                </svg>
              </div>
              <div className="role-info">
                <h3>{t("roleModal.staff")}</h3>
                <p>{t("roleModal.staffDesc")}</p>
              </div>
            </Link>
            <Link to="/register/customer" className="role-option">
              <div className="role-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M20 6H16L14 4H10L8 6H4C2.9 6 2 6.9 2 8V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V8C22 6.9 21.1 6 20 6ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" fill="currentColor" />
                </svg>
              </div>
              <div className="role-info">
                <h3>{t("roleModal.customer")}</h3>
                <p>{t("roleModal.customerDesc")}</p>
              </div>
            </Link>
          </div>
          <p className="auth-link" style={{ marginTop: "24px" }}>
            {t("auth.hasAccount")} <Link to="/login">{t("auth.submitLogin")}</Link>
          </p>
          <p className="auth-link">
            <Link to="/">{t("auth.backToSite")}</Link>
          </p>
        </div>
      </div>
    );
  }

  /* Formular înregistrare după ce s-a ales Staff sau Customer */
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--register">
        <h1>{t("auth.register")}</h1>
        <p className="auth-muted">{registerDesc}</p>
        {error && (
          <div className="auth-alert error">{error}</div>
        )}
        {success && (
          <div className="auth-alert success">{success}</div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          <input type="hidden" name="role" value={role} />
          
          {/* Common fields */}
          <label>
            {t("auth.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            {t("auth.password")}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label>
            {t("auth.confirmPassword")}
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          
          {/* Staff/Employee specific fields */}
          {role === "staff" && (
            <>
              <h3 className="auth-section-title">{t("auth.personalInfo")}</h3>
              <div className="auth-field-row">
                <label>
                  {t("auth.firstName")}
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  {t("auth.lastName")}
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
              </div>
              <DatePicker
                name="dateOfBirth"
                value={dateOfBirth}
                onChange={setDateOfBirth}
                label={t("auth.dateOfBirth")}
                className="auth-date-wrap"
                openUpward
                disableFutureDates
                disablePastDates={false}
              />
              <label>
                {t("auth.phoneNumber")} <span className="text-red-500">*</span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder={t("auth.phoneNumberPlaceholder") || "+37312345678"}
                />
                <small className="text-gray-500 text-xs mt-1 block">{t("auth.phoneNumberHint") || "Folosește formatul internațional (ex: +37312345678)"}</small>
              </label>
              <label>
                {t("auth.aboutMe")}
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  rows={4}
                  placeholder={t("auth.aboutMePlaceholder")}
                />
              </label>
            </>
          )}
          
          {/* Business/Customer specific fields */}
          {role === "customer" && (
            <>
              <h3 className="auth-section-title">{t("auth.companyInfo")}</h3>
              <label>
                {t("auth.companyName")}
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <div className="auth-field-row">
                <label>
                  {t("auth.contactFirstName")}
                  <input
                    type="text"
                    value={contactFirstName}
                    onChange={(e) => setContactFirstName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  {t("auth.contactLastName")}
                  <input
                    type="text"
                    value={contactLastName}
                    onChange={(e) => setContactLastName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
              </div>
              <label>
                {t("auth.contactPhoneNumber")} <span className="text-red-500">*</span>
                <input
                  type="tel"
                  value={contactPhoneNumber}
                  onChange={(e) => setContactPhoneNumber(e.target.value)}
                  required
                  placeholder={t("auth.phoneNumberPlaceholder") || "+37312345678"}
                />
                <small className="text-gray-500 text-xs mt-1 block">{t("auth.phoneNumberHint") || "Folosește formatul internațional (ex: +37312345678)"}</small>
              </label>
              <label>
                {t("auth.companyCategory")}
                <div className="auth-custom-dropdown" ref={companyCategoryRef}>
                  <button
                    type="button"
                    className={`auth-custom-dropdown__trigger ${companyCategoryOpen ? "is-open" : ""}`}
                    onClick={() => setCompanyCategoryOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={companyCategoryOpen}
                  >
                    <span>
                      {t(COMPANY_CATEGORY_OPTIONS.find((o) => o.value === companyCategory)?.labelKey ?? "auth.companyCategoryCanteen")}
                    </span>
                    <svg className="auth-custom-dropdown__chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {companyCategoryOpen && (
                    <ul className="auth-custom-dropdown__menu" role="listbox" aria-label={t("auth.companyCategory")}>
                      {COMPANY_CATEGORY_OPTIONS.map((opt) => (
                        <li key={opt.value}>
                          <button
                            type="button"
                            className={`auth-custom-dropdown__item ${companyCategory === opt.value ? "is-selected" : ""}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCompanyCategory(opt.value);
                              setCompanyCategoryOpen(false);
                            }}
                            role="option"
                            aria-selected={companyCategory === opt.value}
                          >
                            {t(opt.labelKey)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>
              <label>
                {t("auth.infoForStaff")}
                <textarea
                  value={infoForStaff}
                  onChange={(e) => setInfoForStaff(e.target.value)}
                  rows={3}
                  placeholder={t("auth.infoForStaffPlaceholder")}
                />
              </label>
              
              <h3 className="auth-section-title">{t("auth.mainBranch")}</h3>
              <label>
                {t("auth.branchName")}
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  placeholder={t("auth.branchNamePlaceholder")}
                />
              </label>
              <label>
                {t("auth.branchAddress")}
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  required
                  placeholder={t("auth.branchAddressPlaceholder")}
                />
              </label>
              <div className="auth-field-row auth-field-row--address">
                <label>
                  {t("auth.branchCity")}
                  <input
                    type="text"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    required
                  />
                </label>
                <label>
                  {t("auth.branchCountry")}
                  <input
                    type="text"
                    value={branchCountry}
                    onChange={(e) => setBranchCountry(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                {t("auth.phone")}
                <input
                  type="tel"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  required
                  placeholder={t("auth.branchPhonePlaceholder")}
                />
              </label>
            </>
          )}
          
          {otpStep === "form" && (
            <button type="submit" disabled={loading || otpLoading} className="btn-primary w-full py-3.5 disabled:opacity-50" style={{ marginTop: "24px" }}>
              {otpLoading ? t("auth.sendingOTP") || "Se trimite codul..." : t("auth.continueToOTP") || "Continuă cu verificarea"}
            </button>
          )}
        </form>

        {/* Terms & Conditions Modal – shown when user clicks Continue */}
        {showTermsModal && (
          <div className="auth-terms-overlay" onClick={() => { setShowTermsModal(false); setOtpError(""); setTermsScrolledToBottom(false); }} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
            <div className="auth-terms-modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="terms-modal-title" className="auth-terms-title">{t("auth.acceptTermsTitle")}</h2>
              <p className="auth-terms-subtitle">{t("auth.acceptTermsSubtitle")}</p>
              {otpError && <div className="auth-alert error" style={{ margin: "0 24px 16px" }}>{otpError}</div>}
              <div
                ref={termsScrollRef}
                className="auth-terms-scroll"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  // Dacă nu e nevoie de scroll (conținut scurt), considerăm că e la capăt
                  const hasScroll = el.scrollHeight > el.clientHeight;
                  const atBottom = !hasScroll || (el.scrollHeight - el.scrollTop - el.clientHeight < 8);
                  setTermsScrolledToBottom(atBottom);
                }}
              >
                <pre className="auth-terms-content">{termsContent.trim()}</pre>
              </div>
              {!termsScrolledToBottom && (
                <p className="auth-terms-scroll-hint">{t("auth.termsScrollHint")}</p>
              )}
              <div className="auth-terms-actions">
                <button
                  type="button"
                  onClick={handleAcceptTerms}
                  disabled={termsAcceptLoading || !termsScrolledToBottom}
                  className="btn-primary flex-1 py-3.5 disabled:opacity-50"
                >
                  {termsAcceptLoading ? t("auth.sendingOTP") : t("auth.acceptTerms")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="btn-secondary flex-1 py-3.5"
                >
                  {t("auth.termsDecline")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OTP Verification Screen */}
        {otpStep === "otp" && (
          <div className="auth-otp-section">
            <div className="auth-otp-header">
              <h3>{t("auth.verifyPhoneNumber") || "Verifică numărul de telefon"}</h3>
              <p className="auth-muted">
                {t("auth.otpSentTo") || "Am trimis un cod de verificare la"} <strong>{verifiedPhone}</strong>
              </p>
            </div>
            
            {otpError && (
              <div className="auth-alert error">{otpError}</div>
            )}
            
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="auth-form">
              <label>
                {t("auth.otpCode") || "Cod OTP"}
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtpCode(value);
                    setOtpError("");
                  }}
                  required
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </label>
              
              <button 
                type="submit" 
                disabled={loading || otpLoading || otpCode.length < 4} 
                className="btn-primary w-full py-3.5 disabled:opacity-50" 
                style={{ marginTop: "24px" }}
              >
                {loading ? t("auth.registering") || "Se înregistrează..." : otpLoading ? "..." : t("auth.verifyAndRegister") || "Verifică și înregistrează"}
              </button>
              
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={otpLoading}
                className="btn-secondary w-full py-2.5 mt-3 disabled:opacity-50"
              >
                {otpLoading ? "..." : t("auth.resendOTP") || "Retrimite codul"}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setOtpStep("form");
                  setOtpCode("");
                  setOtpError("");
                  setVerifiedPhone("");
                }}
                className="btn-text w-full py-2 mt-2"
              >
                {t("auth.backToForm") || "Înapoi la formular"}
              </button>
            </form>
          </div>
        )}
        <p className="auth-link">
          {t("auth.hasAccount")} <Link to="/login">{t("auth.submitLogin")}</Link>
        </p>
        <p className="auth-link">
          <Link to="/">{t("auth.backToSite")}</Link>
        </p>
      </div>
    </div>
  );
}
