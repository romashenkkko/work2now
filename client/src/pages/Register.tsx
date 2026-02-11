import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/client";

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role: roleParam } = useParams<{ role: string }>();
  const [name, setName] = useState("");
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
  const [idnp, setIdnp] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  
  // Business/Customer fields
  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [idno, setIdno] = useState("");
  const [companyCategory, setCompanyCategory] = useState("1");
  const [infoForStaff, setInfoForStaff] = useState("");
  // Branch fields (at least one branch required)
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [branchCountry, setBranchCountry] = useState("Moldova");
  const [branchPhone, setBranchPhone] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }
    
    // Validate role-specific required fields
    if (role === "staff") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Numele și prenumele sunt obligatorii.");
        return;
      }
      if (!idnp.trim()) {
        setError("IDNP-ul este obligatoriu.");
        return;
      }
      if (!dateOfBirth) {
        setError("Data nașterii este obligatorie.");
        return;
      }
    } else if (role === "customer") {
      if (!companyName.trim()) {
        setError("Numele companiei este obligatoriu.");
        return;
      }
      if (!contactFirstName.trim() || !contactLastName.trim()) {
        setError("Numele și prenumele persoanei de contact sunt obligatorii.");
        return;
      }
      if (!idno.trim()) {
        setError("IDNO-ul este obligatoriu.");
        return;
      }
      if (!branchName.trim() || !branchAddress.trim() || !branchCity.trim() || !branchPhone.trim()) {
        setError("Toate câmpurile filialei sunt obligatorii.");
        return;
      }
    }
    
    setLoading(true);
    try {
      // MIGRATION FIX: Build registration data with profile information
      const registerData: any = { 
        name: role === "staff" ? `${firstName.trim()} ${lastName.trim()}` : companyName.trim(), // For backward compatibility
        email, 
        password, 
        role 
      };
      
      if (role === "staff") {
        registerData.employeeProfile = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          idnp: idnp.trim(),
          dateOfBirth: dateOfBirth,
          aboutMe: aboutMe.trim() || "Nu am adăugat informații despre mine.",
        };
      } else if (role === "customer") {
        registerData.businessProfile = {
          companyName: companyName.trim(),
          contactFirstName: contactFirstName.trim(),
          contactLastName: contactLastName.trim(),
          idno: idno.trim(),
          companyCategory: parseInt(companyCategory, 10),
          infoForStaff: infoForStaff.trim() || "Nu am adăugat informații suplimentare.",
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
      setSuccess("Cont creat cu succes. Acum te poti autentifica.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la inregistrare.");
    } finally {
      setLoading(false);
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
      <div className="auth-card">
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
              <h3 style={{ marginTop: "24px", marginBottom: "12px", fontSize: "18px", fontWeight: "600" }}>
                Informații personale
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Prenume <span style={{ color: "red" }}>*</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  Nume <span style={{ color: "red" }}>*</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
              </div>
              <label>
                IDNP <span style={{ color: "red" }}>*</span>
                <input
                  type="text"
                  value={idnp}
                  onChange={(e) => setIdnp(e.target.value)}
                  required
                  placeholder="13 cifre"
                  pattern="[0-9]{13}"
                  maxLength={13}
                />
              </label>
              <label>
                Data nașterii <span style={{ color: "red" }}>*</span>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                  max={new Date().toISOString().split("T")[0]}
                />
              </label>
              <label>
                Despre mine
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  rows={4}
                  placeholder="Descrie-te pe scurt (opțional)"
                />
              </label>
            </>
          )}
          
          {/* Business/Customer specific fields */}
          {role === "customer" && (
            <>
              <h3 style={{ marginTop: "24px", marginBottom: "12px", fontSize: "18px", fontWeight: "600" }}>
                Informații companie
              </h3>
              <label>
                Nume companie <span style={{ color: "red" }}>*</span>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Prenume persoană contact <span style={{ color: "red" }}>*</span>
                  <input
                    type="text"
                    value={contactFirstName}
                    onChange={(e) => setContactFirstName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  Nume persoană contact <span style={{ color: "red" }}>*</span>
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
                IDNO <span style={{ color: "red" }}>*</span>
                <input
                  type="text"
                  value={idno}
                  onChange={(e) => setIdno(e.target.value)}
                  required
                  placeholder="Cod fiscal"
                />
              </label>
              <label>
                Categoria companiei <span style={{ color: "red" }}>*</span>
                <select
                  value={companyCategory}
                  onChange={(e) => setCompanyCategory(e.target.value)}
                  required
                >
                  <option value="1">Cantină</option>
                  <option value="2">Catering</option>
                  <option value="3">Café</option>
                  <option value="4">Restaurant</option>
                  <option value="5">Club de noapte</option>
                  <option value="6">Hotel</option>
                  <option value="7">Bar</option>
                </select>
              </label>
              <label>
                Informații pentru angajați
                <textarea
                  value={infoForStaff}
                  onChange={(e) => setInfoForStaff(e.target.value)}
                  rows={3}
                  placeholder="Informații suplimentare pentru angajați (opțional)"
                />
              </label>
              
              <h3 style={{ marginTop: "24px", marginBottom: "12px", fontSize: "18px", fontWeight: "600" }}>
                Filială principală
              </h3>
              <label>
                Nume filială <span style={{ color: "red" }}>*</span>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  placeholder="ex: Filiala Centru"
                />
              </label>
              <label>
                Adresă <span style={{ color: "red" }}>*</span>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  required
                  placeholder="Strada, număr"
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <label>
                  Oraș <span style={{ color: "red" }}>*</span>
                  <input
                    type="text"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Țară <span style={{ color: "red" }}>*</span>
                  <input
                    type="text"
                    value={branchCountry}
                    onChange={(e) => setBranchCountry(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                Telefon <span style={{ color: "red" }}>*</span>
                <input
                  type="tel"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  required
                  placeholder="+373XXXXXXXX"
                />
              </label>
            </>
          )}
          
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50" style={{ marginTop: "24px" }}>
            {loading ? "..." : t("auth.submitRegister")}
          </button>
        </form>
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
