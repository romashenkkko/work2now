import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type DashboardThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "work2now_dashboard_theme";
const UNDO_MS = 5000;

function readStored(): DashboardThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "dark";
}

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function resolveDashboardTheme(choice: DashboardThemeChoice): "light" | "dark" {
  if (choice === "system") return getSystemDark() ? "dark" : "light";
  return choice;
}

type Ctx = {
  theme: DashboardThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (t: DashboardThemeChoice) => void;
  canUndoTheme: boolean;
  undoTheme: () => void;
};

const DashboardThemeContext = createContext<Ctx | null>(null);

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashboardThemeChoice>(() => readStored());
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const [systemDark, setSystemDark] = useState(() => getSystemDark());
  const [canUndoTheme, setCanUndoTheme] = useState(false);
  const undoFromRef = useRef<DashboardThemeChoice | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current != null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      clearUndoTimer();
    },
    [clearUndoTimer]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const resolvedTheme = useMemo(() => {
    if (theme === "system") return systemDark ? "dark" : "light";
    return theme;
  }, [theme, systemDark]);

  const setTheme = useCallback(
    (t: DashboardThemeChoice) => {
      const current = themeRef.current;
      if (t === current) return;
      undoFromRef.current = current;
      setThemeState(t);
      setCanUndoTheme(true);
      clearUndoTimer();
      undoTimerRef.current = setTimeout(() => {
        undoFromRef.current = null;
        setCanUndoTheme(false);
        undoTimerRef.current = null;
      }, UNDO_MS);
    },
    [clearUndoTimer]
  );

  const undoTheme = useCallback(() => {
    const prev = undoFromRef.current;
    if (prev == null) return;
    undoFromRef.current = null;
    setCanUndoTheme(false);
    clearUndoTimer();
    setThemeState(prev);
  }, [clearUndoTimer]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, canUndoTheme, undoTheme }),
    [theme, resolvedTheme, setTheme, canUndoTheme, undoTheme]
  );

  return <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>;
}

export function useDashboardTheme(): Ctx {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) {
    throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  }
  return ctx;
}
