"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
      {CUSTOMER_ROUTE.test(pathname) ? <LocaleSwitcher pathname={pathname} /> : null}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider.");
  return context;
}

function LocaleSwitcher({ pathname }: { pathname: string }) {
  const { locale, setLocale, t } = useLocale();
  const [desktopRight, setDesktopRight] = useState<number | null>(null);
  const hideDesktopSwitcher =
    pathname === "/apply/review" ||
    pathname === "/v2/apply/review" ||
    pathname === "/apply/approval" ||
    pathname === "/v2/apply/approval" ||
    pathname === "/apply/choose-plan" ||
    pathname === "/v2/apply/choose-plan";
  const mobileOptions: { locale: Locale; label: string; name: string }[] = [
    { locale: "en", label: "ENGLISH", name: "English" },
    { locale: "ms", label: "MELAYU", name: "Bahasa Melayu" },
    { locale: "zh-CN", label: "中文", name: "简体中文" },
  ];

  useEffect(() => {
    let frame = 0;
    let active = true;
    const visualSelector =
      ".ios-card, [data-language-align], button, input, select, textarea, [role='button'], [role='radio'], [role='checkbox'], img, svg, canvas, video";
    const contentSelector =
      "[data-language-align], .apply-pane-fit-inner > .flex-1, .apply-pane-fit-natural-col > .flex-1";
    const resizeObserver = new ResizeObserver(() => measureContentRight());
    const observedElements = new Set<Element>();

    const measureContentRight = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active) return;

        if (window.innerWidth < 1024) {
          setDesktopRight(null);
          return;
        }

        const main = document.querySelector<HTMLElement>("main");
        if (!main) {
          setDesktopRight(null);
          return;
        }

        const mainRect = main.getBoundingClientRect();
        const isVisible = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0 &&
            !element.closest("[aria-hidden='true']") &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > mainRect.left &&
            rect.left < mainRect.right
          );
        };

        const visualElements = Array.from(
          main.querySelectorAll<HTMLElement>(visualSelector),
        ).filter(isVisible);
        const contentContainers = Array.from(
          main.querySelectorAll<HTMLElement>(contentSelector),
        ).filter(isVisible);
        const nextObservedElements = new Set<Element>([
          document.documentElement,
          main,
          ...(contentContainers.length ? contentContainers : visualElements),
        ]);
        observedElements.forEach((element) => {
          if (!nextObservedElements.has(element)) {
            resizeObserver.unobserve(element);
            observedElements.delete(element);
          }
        });
        nextObservedElements.forEach((element) => {
          if (!observedElements.has(element)) {
            resizeObserver.observe(element);
            observedElements.add(element);
          }
        });

        let rightEdge = contentContainers.length
          ? Math.max(...contentContainers.map((element) => element.getBoundingClientRect().right))
          : visualElements.length
            ? Math.max(...visualElements.map((element) => element.getBoundingClientRect().right))
            : 0;

        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent?.trim() || !(node.parentElement instanceof HTMLElement)) continue;
          if (!isVisible(node.parentElement)) continue;

          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width > 0 && rect.height > 0) rightEdge = Math.max(rightEdge, rect.right);
          }
        }

        if (!rightEdge) rightEdge = mainRect.right;
        const nextRight = Math.max(0, window.innerWidth - rightEdge);
        setDesktopRight((previous) =>
          previous !== null && Math.abs(previous - nextRight) < 0.5 ? previous : nextRight,
        );
      });
    };

    const mutationObserver = new MutationObserver(measureContentRight);
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

    window.addEventListener("resize", measureContentRight);
    document.fonts.ready.then(() => {
      if (active) measureContentRight();
    });
    measureContentRight();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      observedElements.clear();
      window.removeEventListener("resize", measureContentRight);
    };
  }, [pathname]);

  return (
    <>
      <div
        role="group"
        aria-label={t("Choose a language")}
        className="fixed right-3 z-[80] inline-flex items-center gap-0.5 rounded-xl border border-white/20 bg-[var(--brand-blue-hex)] p-1 shadow-[0_2px_8px_rgba(0,20,70,0.18)] lg:hidden"
        style={{ top: "calc(env(safe-area-inset-top) + 0.5625rem)" }}
      >
        {mobileOptions.map(({ locale: optionLocale, label, name }) => {
          const selected = locale === optionLocale;
          return (
            <button
              key={optionLocale}
              type="button"
              lang={optionLocale}
              aria-label={name}
              aria-pressed={selected}
              onClick={() => setLocale(optionLocale)}
              className={`min-h-6 rounded-lg px-1.5 text-[8px] font-bold tracking-[0.025em] transition-colors duration-150 active:scale-[0.97] ${
                selected
                  ? "bg-white text-[var(--brand-blue-hex)] shadow-sm"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!hideDesktopSwitcher ? (
        <label
          className="fixed right-3 z-[80] hidden h-6 items-center rounded-full border border-black/10 bg-white/95 px-2 shadow-sm backdrop-blur-sm lg:top-12 lg:inline-flex xl:top-16"
          style={
            desktopRight === null
              ? { visibility: "hidden" }
              : { right: `${desktopRight}px` }
          }
        >
          <span className="sr-only">{t("Choose a language")}</span>
          <select
            aria-label={t("Choose a language")}
            value={locale}
            onChange={(event) => {
              if (isLocale(event.target.value)) setLocale(event.target.value);
            }}
            className="h-6 min-h-6 cursor-pointer appearance-none bg-transparent py-0 pl-1 pr-5 text-xs font-semibold text-[var(--text-primary)] outline-none"
          >
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="ms">Bahasa Melayu</option>
          </select>
          <span className="pointer-events-none absolute right-2 text-[10px]" aria-hidden="true">
            ▾
          </span>
        </label>
      ) : null}
    </>
  );
}
