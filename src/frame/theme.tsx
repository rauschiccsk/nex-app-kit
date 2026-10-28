// Light or dark, each person their own, as in the cockpit: kept in this browser under `nex_dark_<login>`, dark until
// the person switches. The `dark` class on <html> turns on Tailwind's `dark:` variants.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface ThemeValue {
  isDark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function darkModeKey(username: string): string {
  return `nex_dark_${username}`;
}

function readDark(username: string | undefined): boolean {
  if (!username) return true;
  try {
    const stored = window.localStorage.getItem(darkModeKey(username));
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function ThemeProvider({ username, children }: { username: string | undefined; children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => readDark(username));

  useEffect(() => setIsDark(readDark(username)), [username]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (username) {
        try {
          window.localStorage.setItem(darkModeKey(username), String(next));
        } catch {
          /* storage disabled — the switch still holds until the page is reloaded */
        }
      }
      return next;
    });
  }, [username]);

  const value = useMemo(() => ({ isDark, toggleDark }), [isDark, toggleDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <TemplateApp>");
  return value;
}
