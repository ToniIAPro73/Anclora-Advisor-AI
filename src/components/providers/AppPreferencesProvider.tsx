/* eslint-disable no-unused-vars */
"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LocaleCode } from "@/lib/i18n/messages";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type AppPreferencesContextValue = {
  locale: LocaleCode;
  setLocale(locale: LocaleCode): void;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode(themeMode: ThemeMode): void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed(collapsed: boolean): void;
};

const STORAGE_KEYS = {
  locale: "anclora.locale",
  themeMode: "anclora.theme_mode",
  sidebarCollapsed: "anclora.sidebar_collapsed",
} as const;

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyDocumentPreferences(locale: LocaleCode, themeMode: ThemeMode, sidebarCollapsed: boolean) {
  const resolvedTheme = resolveTheme(themeMode);
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.sidebar = sidebarCollapsed ? "collapsed" : "expanded";
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("es");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(STORAGE_KEYS.locale);
    const storedThemeMode = window.localStorage.getItem(STORAGE_KEYS.themeMode);
    const storedSidebarCollapsed = window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed);

    const nextLocale = storedLocale === "en" ? "en" : "es";
    const nextThemeMode: ThemeMode =
      storedThemeMode === "light" || storedThemeMode === "dark" || storedThemeMode === "system"
        ? storedThemeMode
        : "dark";
    const nextSidebarCollapsed = storedSidebarCollapsed === "true";

    setLocaleState(nextLocale);
    setThemeModeState(nextThemeMode);
    setSidebarCollapsedState(nextSidebarCollapsed);
    setResolvedTheme(resolveTheme(nextThemeMode));
    applyDocumentPreferences(nextLocale, nextThemeMode, nextSidebarCollapsed);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = () => {
      if (themeMode === "system") {
        const nextResolvedTheme = resolveTheme("system");
        setResolvedTheme(nextResolvedTheme);
        applyDocumentPreferences(locale, themeMode, sidebarCollapsed);
      }
    };

    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [locale, sidebarCollapsed, themeMode]);

  const setLocale = useCallback((nextLocale: LocaleCode) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEYS.locale, nextLocale);
    applyDocumentPreferences(nextLocale, themeMode, sidebarCollapsed);
  }, [sidebarCollapsed, themeMode]);

  const setThemeMode = useCallback((nextThemeMode: ThemeMode) => {
    setThemeModeState(nextThemeMode);
    setResolvedTheme(resolveTheme(nextThemeMode));
    window.localStorage.setItem(STORAGE_KEYS.themeMode, nextThemeMode);
    applyDocumentPreferences(locale, nextThemeMode, sidebarCollapsed);
  }, [locale, sidebarCollapsed]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(collapsed));
    applyDocumentPreferences(locale, themeMode, collapsed);
  }, [locale, themeMode]);

  const value = useMemo<AppPreferencesContextValue>(() => ({
    locale,
    setLocale,
    themeMode,
    resolvedTheme,
    setThemeMode,
    sidebarCollapsed,
    setSidebarCollapsed,
  }), [locale, resolvedTheme, setLocale, setSidebarCollapsed, setThemeMode, sidebarCollapsed, themeMode]);

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  }
  return context;
}
