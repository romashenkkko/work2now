import { useTranslation } from "react-i18next";
import { getApiBase } from "../api/client";

type Props = {
  mode: "login" | "register";
  role?: "staff" | "customer";
  className?: string;
};

export default function GoogleAuthButton({ mode, role, className = "" }: Props) {
  const { t } = useTranslation();
  const params = new URLSearchParams({ mode });
  if (role) params.set("role", role);
  const href = `${getApiBase()}/auth/google?${params.toString()}`;

  return (
    <a
      href={href}
      className={`google-auth-btn flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 ${className}`.trim()}
    >
      <img
        src="/gmail-logo.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 object-contain"
        aria-hidden
      />
      {t("auth.continueWithGoogle")}
    </a>
  );
}
