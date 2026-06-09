import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isSupportedLocale
} from "./config";

interface UseLocaleResult {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
  switchLocale: (next: SupportedLocale) => void;
  prefix: string;
  buildPath: (path: string, locale?: SupportedLocale) => string;
}

export function useLocale(): UseLocaleResult {
  const { i18n } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const paramLocale = params.locale;
  const locale: SupportedLocale = isSupportedLocale(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      void i18n.changeLanguage(next);
    },
    [i18n]
  );

  const buildPath = useCallback(
    (path: string, target?: SupportedLocale) => {
      const targetLocale = target ?? locale;
      const sanitised = path.startsWith("/") ? path : `/${path}`;
      const trimmed = sanitised === "/" ? "" : sanitised;
      return `/${targetLocale}${trimmed}`;
    },
    [locale]
  );

  const switchLocale = useCallback(
    (next: SupportedLocale) => {
      setLocale(next);
      const segments = location.pathname.split("/").filter(Boolean);
      if (segments.length > 0 && isSupportedLocale(segments[0])) {
        segments[0] = next;
      } else {
        segments.unshift(next);
      }
      const newPath = `/${segments.join("/")}`;
      navigate({ pathname: newPath, search: location.search, hash: location.hash });
    },
    [location.hash, location.pathname, location.search, navigate, setLocale]
  );

  return {
    locale,
    setLocale,
    switchLocale,
    prefix: `/${locale}`,
    buildPath
  };
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
