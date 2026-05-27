import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { experiencesApi } from "../api/client";

export default function GoogleCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const [message, setMessage] = useState(t("auth.googleProcessing"));

  useEffect(() => {
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      localStorage.setItem("token", token);
      (async () => {
        try {
          const { authApi } = await import("../api/client");
          const u = await authApi.me();
          const user = { ...u, isActive: u.isActive !== false };
          setUser(user);

          const role = user?.role?.toLowerCase?.();
          if (role === "staff") {
            try {
              const onboardingCheck = await experiencesApi.checkOnboarding();
              if (onboardingCheck.needsOnboarding) {
                navigate("/onboarding", { replace: true });
                return;
              }
            } catch {
              /* continue */
            }
          }
          navigate("/dashboard", { replace: true });
        } catch {
          setMessage(t("auth.googleLoginFailed"));
        }
      })();
      return;
    }

    if (error === "no_account") {
      setMessage(t("auth.googleNoAccount"));
      return;
    }
    if (error === "email_password_account") {
      setMessage(t("auth.googleUsePassword"));
      return;
    }
    if (error === "email_exists") {
      setMessage(t("auth.googleEmailExists"));
      return;
    }
    if (error === "google_account_mismatch") {
      setMessage(t("auth.googleAccountMismatch"));
      return;
    }
    if (error) {
      setMessage(decodeURIComponent(error));
      return;
    }
    setMessage(t("auth.googleLoginFailed"));
  }, [params, navigate, setUser, t]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t("auth.login")}</h1>
        <p className="auth-muted">{message}</p>
        <p className="auth-link mt-4">
          <Link to="/login">{t("auth.submitLogin")}</Link>
          {" · "}
          <Link to="/register">{t("auth.createAccount")}</Link>
        </p>
      </div>
    </div>
  );
}
