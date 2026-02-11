import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { experiencesApi } from "../api/client";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      const role = user?.role?.toLowerCase?.();
      
      // Check if staff needs onboarding
      if (role === "staff") {
        try {
          const onboardingCheck = await experiencesApi.checkOnboarding();
          if (onboardingCheck.needsOnboarding) {
            navigate("/onboarding", { replace: true });
            return;
          }
        } catch {
          // If check fails, proceed to dashboard
        }
      }
      
      const isCustomerOrStaff = role === "customer" || role === "staff";
      navigate(isCustomerOrStaff ? "/dashboard/joburi" : "/dashboard", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Autentificare esuata.";
      const isServerError = /Internal Server Error|Eroare|server|Failed to fetch|nu raspunde/i.test(msg);
      setError(
        isServerError
          ? `${msg} Verifica ca backend-ul ruleaza (npm run dev).`
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t("auth.login")}</h1>
        <p className="auth-muted">{t("auth.loginDesc")}</p>
        {error && (
          <div className="auth-alert error">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
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
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {loading ? "..." : t("auth.submitLogin")}
          </button>
        </form>
        <p className="auth-link">
          {t("auth.noAccount")} <Link to="/register">{t("auth.createAccount")}</Link>
        </p>
        <p className="auth-link">
          <Link to="/">{t("auth.backToSite")}</Link>
        </p>
      </div>
    </div>
  );
}
