"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";

import {
  isLocale,
  detectLocale,
  translateText,
  type Locale,
} from "@/lib/i18n";

const LANGUAGE_PREFERENCE_KEY = "crawfort-language";
const LOCALE_CHANGE_EVENT = "crawfort-locale-change";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const CUSTOMER_ROUTE = /^\/(?:$|foreigner(?:\/|$)|vcsa-sg(?:\/|$)|apply(?:\/|$)|v2(?:\/|$)|axs(?:\/|$)|aip(?:\/|$)|pending(?:\/|$)|rejected(?:\/|$)|dev\/approval-preview(?:\/|$))/;

let manualLocale: Locale | null = null;

function getLocaleSnapshot(): Locale {
  if (manualLocale) return manualLocale;

  try {
    const saved = window.localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    if (isLocale(saved)) return saved;
  } catch (error) {
    console.warn("Could not read the saved language preference.", error);
  }

  return detectLocale(
    window.navigator.languages.length
      ? window.navigator.languages
      : [window.navigator.language],
  );
}

function subscribeToLocaleChanges(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
  };
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale: Locale = useSyncExternalStore(
    subscribeToLocaleChanges,
    getLocaleSnapshot,
    (): Locale => "en",
  );
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    manualLocale = nextLocale;
    try {
      window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, nextLocale);
    } catch (error) {
      console.warn("Could not save the language preference.", error);
    }
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  const t = useCallback((text: string) => translateText(text, locale), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
      {CUSTOMER_ROUTE.test(pathname) ? <LocaleSwitcher /> : null}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider.");
  return context;
}

function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label
      className="fixed right-3 z-[80] inline-flex items-center rounded-full border border-black/10 bg-white/95 px-2 shadow-sm backdrop-blur-sm sm:right-5"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <span className="sr-only">{t("Choose a language")}</span>
      <select
        aria-label={t("Choose a language")}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
        className="min-h-9 cursor-pointer appearance-none bg-transparent py-1 pl-1 pr-5 text-xs font-semibold text-[var(--text-primary)] outline-none"
      >
        <option value="en">English</option>
        <option value="zh-CN">简体中文</option>
        <option value="ms">Bahasa Melayu</option>
      </select>
      <span className="pointer-events-none absolute right-2 text-[10px]" aria-hidden="true">
        ▾
      </span>
    </label>
  );
}
