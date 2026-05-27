import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi, jobsApi } from "../api/client";
import AddressPickerModal from "../components/AddressPickerModal";
import DatePicker from "../components/DatePicker";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { TERMS_AND_CONDITIONS_RO, TERMS_AND_CONDITIONS_EN } from "../content/termsAndConditions";
import { foldForSearch } from "../utils/foldForSearch";

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

/** Set to true to require phone + Twilio OTP before registration (must match server unless PHONE_REGISTRATION_OTP_REQUIRED=false). */
const PHONE_OTP_ENABLED = false;

/** Build +373 E.164 from local digits (8 digits for MD mobile). */
function buildMoldovaPhone(localDigits: string): string {
  return `+373${localDigits.replace(/\D/g, "")}`;
}

function isValidMoldovaLocalPhone(localDigits: string): boolean {
  return /^\d{8}$/.test(localDigits.replace(/\D/g, ""));
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { role: roleParam } = useParams<{ role: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const role = roleParam === "staff" || roleParam === "customer" ? roleParam : "user";
  
  // Staff/Employee fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dateOfBirthError, setDateOfBirthError] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(""); // Staff phone number (without prefix)
  
  // Business/Customer fields
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactDateOfBirth, setContactDateOfBirth] = useState("");
  const [contactDateOfBirthError, setContactDateOfBirthError] = useState("");
  const [contactPhoneNumber, setContactPhoneNumber] = useState(""); // Customer contact phone number (without prefix)
  const [companyCategory, setCompanyCategory] = useState("1");
  const [companyCategoryOpen, setCompanyCategoryOpen] = useState(false);
  const companyCategoryRef = useRef<HTMLDivElement>(null);
  const [infoForStaff, setInfoForStaff] = useState("");
  // Branch fields (at least one branch required)
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [branchCountry, setBranchCountry] = useState("Moldova");
  const [branchPhone, setBranchPhone] = useState(""); // without prefix
  // Raion dropdown for customer registration
  const [raioane, setRaioane] = useState<Array<{ id: number; name: string; type: string }>>([]);
  const [selectedRaionId, setSelectedRaionId] = useState<number | null>(null);
  const [raionSearch, setRaionSearch] = useState("");
  const [raionDropdownOpen, setRaionDropdownOpen] = useState(false);
  const raionDropdownRef = useRef<HTMLDivElement>(null);

  const filteredRegisterRaioane = useMemo(() => {
    if (!raionSearch.trim()) return raioane;
    const fq = foldForSearch(raionSearch);
    return raioane.filter((r) => foldForSearch(r.name).includes(fq));
  }, [raioane, raionSearch]);
  const [showBranchAddressModal, setShowBranchAddressModal] = useState(false);

  // OTP verification state
  const [otpStep, setOtpStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [googleRegisterToken, setGoogleRegisterToken] = useState("");
  const [isGoogleRegister, setIsGoogleRegister] = useState(false);
  const [googlePrefillLoading, setGooglePrefillLoading] = useState(false);
  const [otpTestMode, setOtpTestMode] = useState(false);

  // Terms & Conditions modal state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [termsAcceptLoading, setTermsAcceptLoading] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);

  const calculateAgeFromYmd = (value: string): number | null => {
    if (!value) return null;
    const [yStr, mStr, dStr] = value.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!y || !m || !d) return null;
    const dob = new Date(y, m - 1, d);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const validateMinAge18 = (value: string): string => {
    if (!value) return "";
    const age = calculateAgeFromYmd(value);
    if (age === null || age < 18) return t("auth.ageRestriction18");
    return "";
  };

  useEffect(() => {
    const token = searchParams.get("googleToken");
    if (!token || role === "user") return;

    setGooglePrefillLoading(true);
    authApi
      .googleRegisterPrefill(token)
      .then((prefill) => {
        if (prefill.role !== role) {
          navigate(`/register/${prefill.role}?googleToken=${encodeURIComponent(token)}`, { replace: true });
          return;
        }
        setGoogleRegisterToken(token);
        setIsGoogleRegister(true);
        setEmail(prefill.email);
        if (role === "staff") {
          setFirstName(prefill.firstName);
          setLastName(prefill.lastName);
          if (prefill.dateOfBirth) {
            setDateOfBirth(prefill.dateOfBirth);
            setDateOfBirthError(validateMinAge18(prefill.dateOfBirth));
          }
        } else {
          setContactFirstName(prefill.firstName);
          setContactLastName(prefill.lastName);
          if (prefill.dateOfBirth) {
            setContactDateOfBirth(prefill.dateOfBirth);
            setContactDateOfBirthError(validateMinAge18(prefill.dateOfBirth));
          }
        }
        const next = new URLSearchParams(searchParams);
        next.delete("googleToken");
        setSearchParams(next, { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("auth.googleLoginFailed"));
      })
      .finally(() => setGooglePrefillLoading(false));
  }, [role, searchParams, navigate, setSearchParams, t]);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (companyCategoryRef.current && !companyCategoryRef.current.contains(e.target as Node)) {
        setCompanyCategoryOpen(false);
      }
      if (raionDropdownRef.current && !raionDropdownRef.current.contains(e.target as Node)) {
        setRaionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  // Fetch raioane for customer registration
  useEffect(() => {
    if (role !== "customer") return;
    jobsApi
      .getRaioane()
      .then((r) => {
        // Include: 32 raioane + municipiile UTA Găgăuzia (denumiri cu diacritice ca în API)
        const gagauziaCities = ["Comrat", "Ceadîr-Lunga", "Vulcănești"];
        const raioaneOnly = (r.raioane || []).filter((raion) => 
          raion.type === "raion" || 
          (raion.type === "municipiu" && gagauziaCities.includes(raion.name))
        );
        setRaioane(raioaneOnly);
      })
      .catch((err) => {
        console.error("Failed to load raioane:", err);
        setRaioane([]);
      });
  }, [role]);

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

  async function finalizeRegistration(otpToken?: string) {
    setLoading(true);
    try {
      const registerData: any = {
        name: role === "staff" ? `${firstName.trim()} ${lastName.trim()}` : companyName.trim(),
        email,
        role,
      };
      const localDigits = role === "staff" ? phoneNumber.trim() : contactPhoneNumber.trim();
      if (PHONE_OTP_ENABLED && verifiedPhone) {
        registerData.phoneNumber = verifiedPhone;
        if (otpToken) registerData.phoneVerificationToken = otpToken;
      } else if (isValidMoldovaLocalPhone(localDigits)) {
        registerData.phoneNumber = buildMoldovaPhone(localDigits);
      }
      if (isGoogleRegister && googleRegisterToken) {
        registerData.googleRegisterToken = googleRegisterToken;
      } else {
        registerData.password = password;
      }

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
        registerData.contactDateOfBirth = contactDateOfBirth;
        registerData.branch = {
          name: branchName.trim(),
          address: branchAddress.trim(),
          city: branchCity.trim(),
          country: branchCountry.trim() || "Moldova",
          phoneNumber: `+373${branchPhone.trim()}`,
          raionId: selectedRaionId,
        };
      }

      const registerResult = await authApi.register(registerData);

      if (registerResult.token) {
        localStorage.setItem("token", registerResult.token);
        if (cvFile && role === "staff") {
          try {
            await authApi.uploadCv(cvFile);
          } catch {
            /* best-effort */
          }
        }
        navigate("/dashboard", { replace: true });
        return;
      }

      if (cvFile && role === "staff" && password) {
        try {
          const loginResult = await authApi.login(email, password);
          localStorage.setItem("token", loginResult.token);
          await authApi.uploadCv(cvFile);
          localStorage.removeItem("token");
        } catch {
          /* best-effort */
        }
      }

      setSuccess(t("auth.registerSuccess"));
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setOtpError("");
    
    if (!isGoogleRegister && password !== confirm) {
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
      const dobErr = validateMinAge18(dateOfBirth);
      if (dobErr) {
        setDateOfBirthError(dobErr);
        setError(dobErr);
        return;
      }
      if (!isValidMoldovaLocalPhone(phoneNumber)) {
        setError(t("auth.phoneNumberInvalid") || "Introduceți un număr valid de 8 cifre (ex: 69123456).");
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
      if (!contactDateOfBirth) {
        setError(t("auth.dateOfBirthRequired"));
        return;
      }
      const contactDobErr = validateMinAge18(contactDateOfBirth);
      if (contactDobErr) {
        setContactDateOfBirthError(contactDobErr);
        setError(contactDobErr);
        return;
      }
      if (!isValidMoldovaLocalPhone(contactPhoneNumber)) {
        setError(t("auth.contactPhoneNumberInvalid") || "Introduceți un număr de contact valid de 8 cifre.");
        return;
      }
      if (!branchName.trim() || !branchAddress.trim() || !branchCity.trim() || !branchPhone.trim()) {
        setError(t("auth.branchFieldsRequired"));
        return;
      }
      if (!selectedRaionId || selectedRaionId <= 0) {
        setError(t("auth.raionRequired") || "Selectați raionul");
        return;
      }
    }

    // If OTP is not verified yet, validate data first, then show Terms & Conditions modal
    if (otpStep === "form") {
      // Build validation data
      const validationData: any = {
        name: role === "staff" ? `${firstName.trim()} ${lastName.trim()}` : companyName.trim(),
        email,
        role,
        phoneNumber:
          role === "staff" ? buildMoldovaPhone(phoneNumber) : buildMoldovaPhone(contactPhoneNumber),
      };
      if (isGoogleRegister && googleRegisterToken) {
        validationData.googleRegisterToken = googleRegisterToken;
      } else {
        validationData.password = password;
      }

      if (role === "staff") {
        validationData.employeeProfile = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth: dateOfBirth,
          aboutMe: aboutMe.trim() || t("auth.aboutMeDefault"),
        };
      } else if (role === "customer") {
        validationData.businessProfile = {
          companyName: companyName.trim(),
          contactFirstName: contactFirstName.trim(),
          contactLastName: contactLastName.trim(),
          companyCategory: parseInt(companyCategory, 10),
          infoForStaff: infoForStaff.trim() || t("auth.infoForStaffDefault"),
        };
        validationData.contactDateOfBirth = contactDateOfBirth;
        validationData.branch = {
          name: branchName.trim(),
          address: branchAddress.trim(),
          city: branchCity.trim(),
          country: branchCountry.trim() || "Moldova",
          phoneNumber: `+373${branchPhone.trim()}`,
          raionId: selectedRaionId,
        };
      }

      // Validate data with backend (checks email existence, etc.)
      setLoading(true);
      try {
        await authApi.validateRegistration(validationData);
        // Validation passed, show Terms & Conditions modal
        setLoading(false);
        setShowTermsModal(true);
        return;
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : t("auth.registerError"));
        return;
      }
    }

    if (PHONE_OTP_ENABLED && otpStep === "otp") {
      if (!otpCode.trim() || otpCode.trim().length < 6) {
        setOtpError(t("auth.otpCodeRequired"));
        return;
      }
      if (!verifiedPhone) {
        setOtpError(t("auth.otpSendError"));
        return;
      }

      setOtpLoading(true);
      setOtpError("");
      try {
        const verifyResult = await authApi.verifyOTP(verifiedPhone, otpCode.trim());
        if (!verifyResult.verified || !verifyResult.phoneVerificationToken) {
          setOtpError(t("auth.otpInvalid"));
          return;
        }
        await finalizeRegistration(verifyResult.phoneVerificationToken);
        return;
      } catch (err) {
        setOtpError(err instanceof Error ? err.message : t("auth.otpVerifyError"));
        return;
      } finally {
        setOtpLoading(false);
      }
    }

    await finalizeRegistration();
  }

  async function handleAcceptTerms() {
    const localDigits = role === "staff" ? phoneNumber.trim() : contactPhoneNumber.trim();
    if (!isValidMoldovaLocalPhone(localDigits)) {
      setOtpError(t("auth.phoneNumberInvalid") || "Introduceți un număr valid de 8 cifre (ex: 69123456).");
      return;
    }

    if (!PHONE_OTP_ENABLED) {
      setShowTermsModal(false);
      await finalizeRegistration();
      return;
    }

    const phoneToVerify = buildMoldovaPhone(localDigits);

    setTermsAcceptLoading(true);
    setOtpError("");
    try {
      const sendResult = await authApi.sendOTP(phoneToVerify);
      setOtpTestMode(sendResult.testMode === true);
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
      const sendResult = await authApi.sendOTP(verifiedPhone);
      setOtpTestMode(sendResult.testMode === true);
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
        {googlePrefillLoading ? (
          <p className="auth-muted text-sm mb-3">{t("auth.googleProcessing")}</p>
        ) : null}
        {isGoogleRegister ? (
          <div className="auth-alert success mb-3 text-sm">{t("auth.googleRegisterHint")}</div>
        ) : null}
        <GoogleAuthButton mode="register" role={role === "staff" || role === "customer" ? role : undefined} className="mb-4" />
        <p className="auth-muted text-center text-sm mb-4">{t("auth.orContinueWithEmail")}</p>
        <form
          onSubmit={handleSubmit}
          className="auth-form"
          style={PHONE_OTP_ENABLED && otpStep === "otp" ? { display: "none" } : undefined}
        >
          <input type="hidden" name="role" value={role} />
          
          {/* Common fields */}
          <label>
            {t("auth.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={isGoogleRegister}
              className={isGoogleRegister ? "bg-gray-50" : undefined}
            />
          </label>
          {!isGoogleRegister ? (
          <>
          <label>
            {t("auth.password")}
            <input
              type="password"
              value={password}
              onChange={(e) => {
                const val = e.target.value;
                setPassword(val);
                setPasswordStrength(getPasswordStrength(val));
              }}
              required
              minLength={6}
            />
            <div className="mt-1">
              <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={
                    "h-full transition-all duration-200 " +
                    (passwordStrength === 0
                      ? "w-0"
                      : passwordStrength === 1
                        ? "w-1/4 bg-red-500"
                        : passwordStrength === 2
                          ? "w-1/2 bg-yellow-400"
                          : passwordStrength === 3
                            ? "w-3/4 bg-yellow-400"
                            : "w-full bg-green-500")
                  }
                />
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {t("profile.passwordStrength")}{" "}
                <span className="font-medium">
                  {t(
                    `profile.passwordStrength${
                      ["None", "Weak", "Fair", "Good", "Strong"][passwordStrength]
                    }`
                  )}
                </span>
              </div>
            </div>
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
          </>
          ) : null}
          
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
              <div>
                <DatePicker
                  name="dateOfBirth"
                  value={dateOfBirth}
                  onChange={(v) => {
                    setDateOfBirth(v);
                    setDateOfBirthError(validateMinAge18(v));
                  }}
                  label={t("auth.dateOfBirth")}
                  className={`auth-date-wrap${dateOfBirthError ? " [&_.date-picker-trigger]:border-red-400" : ""}`}
                  openUpward
                  disablePastDates={false}
                  hideFooter
                />
                {dateOfBirthError ? (
                  <p className="mt-1 text-sm text-red-600" role="alert">{dateOfBirthError}</p>
                ) : null}
              </div>
              {PHONE_OTP_ENABLED ? (
              <label>
                {t("auth.phoneNumber")} <span className="text-red-500">*</span>
                <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all mt-1">
                  <span className="px-3 py-2.5 text-sm font-medium text-gray-500 bg-gray-50 border-r border-gray-200 select-none shrink-0">+373</span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                    placeholder="69123456"
                    className="!border-0 !ring-0 !shadow-none !rounded-none flex-1 !mt-0"
                  />
                </div>
                <small className="text-gray-500 text-xs mt-1 block">{t("auth.phoneNumberHint") || "Introduceți numărul fără prefix"}</small>
              </label>
              ) : null}
              <label>
                {t("auth.aboutMe")}
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  rows={4}
                  placeholder={t("auth.aboutMePlaceholder")}
                />
              </label>
              <label>
                {t("auth.cvUpload")}
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <small className="text-gray-500 text-xs mt-1 block">{t("auth.cvUploadHint")}</small>
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
              <div>
                <DatePicker
                  name="contactDateOfBirth"
                  value={contactDateOfBirth}
                  onChange={(v) => {
                    setContactDateOfBirth(v);
                    setContactDateOfBirthError(validateMinAge18(v));
                  }}
                  label={t("auth.dateOfBirth")}
                  className={`auth-date-wrap${contactDateOfBirthError ? " [&_.date-picker-trigger]:border-red-400" : ""}`}
                  openUpward
                  disablePastDates={false}
                  hideFooter
                />
                {contactDateOfBirthError ? (
                  <p className="mt-1 text-sm text-red-600" role="alert">{contactDateOfBirthError}</p>
                ) : null}
              </div>
              {PHONE_OTP_ENABLED ? (
              <label>
                {t("auth.contactPhoneNumber")} <span className="text-red-500">*</span>
                <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all mt-1">
                  <span className="px-3 py-2.5 text-sm font-medium text-gray-500 bg-gray-50 border-r border-gray-200 select-none shrink-0">+373</span>
                  <input
                    type="tel"
                    value={contactPhoneNumber}
                    onChange={(e) => setContactPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                    placeholder="69123456"
                    className="!border-0 !ring-0 !shadow-none !rounded-none flex-1 !mt-0"
                  />
                </div>
                <small className="text-gray-500 text-xs mt-1 block">{t("auth.phoneNumberHint") || "Introduceți numărul fără prefix"}</small>
              </label>
              ) : null}
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
              <div className="grid gap-1.5">
                <span className="font-semibold text-[#34324a] text-[0.9rem]">
                  {t("auth.branchAddress")}
                </span>
                <button
                  type="button"
                  onClick={() => setShowBranchAddressModal(true)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 bg-white text-left text-sm font-medium text-gray-700 hover:border-primary/40 hover:bg-primary/5 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {branchAddress.trim() ? (
                    <span className="truncate flex-1 text-left">{branchAddress}</span>
                  ) : (
                    <span>{t("dashboard.addAddress")}</span>
                  )}
                </button>
                <p className="mt-1 text-xs text-gray-500">{t("profile.branches.addressPickerHint")}</p>
              </div>
              <div className="grid gap-1.5">
                <span className="font-semibold text-[#34324a] text-[0.9rem]">
                  {t("dashboard.raionLabel")} <span className="text-red-500">*</span>
                </span>
                <div className="relative" ref={raionDropdownRef}>
                  <input
                    type="text"
                    value={raionSearch}
                    onChange={(e) => {
                      setRaionSearch(e.target.value);
                      setRaionDropdownOpen(true);
                    }}
                    onFocus={() => setRaionDropdownOpen(true)}
                    placeholder={t("dashboard.raionPlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-white/80"
                    aria-autocomplete="list"
                    aria-expanded={raionDropdownOpen}
                    aria-controls="register-raion-suggestions"
                  />
                  {raionDropdownOpen && filteredRegisterRaioane.length > 0 && (
                    <div
                      id="register-raion-suggestions"
                      className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1.5"
                      role="listbox"
                      aria-label={t("dashboard.raionLabel")}
                    >
                      {filteredRegisterRaioane.map((raion) => (
                        <button
                          key={raion.id}
                          type="button"
                          role="option"
                          aria-selected={selectedRaionId === raion.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedRaionId(raion.id);
                            setRaionSearch(raion.name);
                            setRaionDropdownOpen(false);
                          }}
                          className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                            selectedRaionId === raion.id
                              ? "bg-primary/10 text-primary"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{raion.name}</span>
                            <span className="text-xs text-gray-500 capitalize shrink-0">{raion.type}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedRaionId ? (
                  <p className="text-xs text-gray-500">
                    {t("dashboard.selectedRaion")}: {raioane.find((r) => r.id === selectedRaionId)?.name}
                  </p>
                ) : null}
              </div>
              <div className="auth-field-row auth-field-row--address">
                <label>
                  Oraș
                  <input
                    type="text"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    required
                    placeholder="ex: Corlateni"
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
                <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all mt-1">
                  <span className="px-3 py-2.5 text-sm font-medium text-gray-500 bg-gray-50 border-r border-gray-200 select-none shrink-0">+373</span>
                  <input
                    type="tel"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                    placeholder="69123456"
                    className="!border-0 !ring-0 !shadow-none !rounded-none flex-1 !mt-0"
                  />
                </div>
              </label>
            </>
          )}
          
          {otpStep === "form" && (
            <button type="submit" disabled={loading || otpLoading} className="btn-primary w-full py-3.5 disabled:opacity-50" style={{ marginTop: "24px" }}>
              {loading
                ? (t("auth.validating") || "Se validează...")
                : PHONE_OTP_ENABLED
                  ? otpLoading
                    ? (t("auth.sendingOTP") || "Se trimite codul...")
                    : (t("auth.continueToOTP") || "Continuă cu verificarea")
                  : (t("auth.submitRegister") || "Înregistrare")}
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!termsAcceptLoading && termsScrolledToBottom) {
                      handleAcceptTerms();
                    }
                  }}
                  disabled={termsAcceptLoading || !termsScrolledToBottom}
                  className="btn-primary flex-1 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
        {PHONE_OTP_ENABLED && otpStep === "otp" && (
          <div className="auth-otp-section">
            <div className="auth-otp-header">
              <h3>{t("auth.verifyPhoneNumber") || "Verifică numărul de telefon"}</h3>
              <p className="auth-muted">
                {otpTestMode ? t("auth.otpTestModeHint") : (
                  <>
                    {t("auth.otpSentTo")} <strong>{verifiedPhone}</strong>
                  </>
                )}
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
                  placeholder={otpTestMode ? "123456" : "000000"}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </label>
              
              <button 
                type="submit" 
                disabled={loading || otpLoading || otpCode.length < 6} 
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

        {role === "customer" &&
          createPortal(
            <AddressPickerModal
              open={showBranchAddressModal}
              onClose={() => setShowBranchAddressModal(false)}
              onConfirm={(address) => {
                setBranchAddress(address);
                setShowBranchAddressModal(false);
              }}
              initialAddress={branchAddress}
              defaultRadiusM={200}
              purpose="branch"
            />,
            document.body
          )}
      </div>
    </div>
  );
}
