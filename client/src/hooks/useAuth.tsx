import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/client";

type User = { id: number; name: string; email: string; role?: string; avatar?: string; isActive?: boolean; boosterUntil?: string } | null;

const AuthContext = createContext<{
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}>(null!);

function BlockedAccountModal({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("accountBlocked.title")}</h2>
        <p className="text-gray-600 mb-6">{t("accountBlocked.message")}</p>
        <button
          type="button"
          onClick={onLogout}
          className="w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 transition"
        >
          {t("accountBlocked.logout")}
        </button>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => setUser({ ...u, isActive: u.isActive !== false }))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setUser((prev) => (prev ? { ...prev, isActive: false } : null));
    window.addEventListener("account-blocked", handler);
    return () => window.removeEventListener("account-blocked", handler);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { token, user: u } = await authApi.login(email, password);
    localStorage.setItem("token", token);
    const userWithActive = { ...u, isActive: u.isActive !== false };
    setUser(userWithActive);
    return userWithActive;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const isBlocked = user && user.isActive === false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {isBlocked ? <BlockedAccountModal onLogout={logout} /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
