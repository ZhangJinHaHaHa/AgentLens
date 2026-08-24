/**
 * 协调路由 locale、i18next、`<html lang>` 与本地语言缓存；路径参数优先，随后读取 pathname，最终回退默认语言。
 * 返回当前语言、仅改翻译状态的 `setLocale`、同时导航的 `switchLocale` 以及保留查询/片段的本地化路径构造器。
 * effect 和切换操作会写 localStorage、改变 i18n 状态、DOM 属性及浏览器历史，但不发网络请求；存储受限时静默保留 URL 作为事实来源。
 * 路由和查询字符串是不可信输入，语言必须通过白名单；`redirect` 只改写单斜杠开头的站内路径并拒绝协议相对地址，避免把语言切换变成开放跳转。
 * 跳转会保留普通查询项和 hash，已有语言前缀只替换首段；这些规则保证深链兼容，失败不自动重试且导航异常交由路由层处理。
 */
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isSupportedLocale
} from "./config";

const I18NEXT_STORAGE_KEY = "i18nextLng";

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
  const pathLocale = getLocaleFromPath(location.pathname);
  const locale: SupportedLocale = isSupportedLocale(paramLocale)
    ? paramLocale
    : pathLocale ?? DEFAULT_LOCALE;

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    cacheLocale(locale);
    document.documentElement.lang = locale;
  }, [i18n, locale]);

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      cacheLocale(next);
      void i18n.changeLanguage(next);
    },
    [i18n]
  );

  const buildPath = useCallback(
    (path: string, target?: SupportedLocale) => {
      const targetLocale = target ?? locale;
      const sanitised = path.startsWith("/") ? path : `/${path}`;
      const withoutLocale = stripLocalePrefix(sanitised);
      const trimmed = withoutLocale === "/" ? "" : withoutLocale;
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
      navigate({
        pathname: newPath,
        search: localizeRedirectSearch(location.search, next),
        hash: location.hash
      });
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

function getLocaleFromPath(pathname: string): SupportedLocale | undefined {
  const [firstSegment] = pathname.split("/").filter(Boolean);
  return isSupportedLocale(firstSegment) ? firstSegment : undefined;
}

function stripLocalePrefix(path: string): string {
  const [pathnameWithPrefix, suffix = ""] = splitPathSuffix(path);
  const segments = pathnameWithPrefix.split("/").filter(Boolean);
  if (segments.length > 0 && isSupportedLocale(segments[0])) {
    const stripped = `/${segments.slice(1).join("/")}`;
    return `${stripped === "/" ? "/" : stripped}${suffix}`;
  }
  return path;
}

function splitPathSuffix(path: string): [string, string] {
  const suffixIndex = path.search(/[?#]/u);
  if (suffixIndex < 0) {
    return [path, ""];
  }
  return [path.slice(0, suffixIndex), path.slice(suffixIndex)];
}

function localizeRedirectSearch(search: string, next: SupportedLocale): string {
  if (!search) {
    return search;
  }

  const params = new URLSearchParams(search);
  const redirect = params.get("redirect");
  if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
    params.set("redirect", replacePathLocale(redirect, next));
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

function replacePathLocale(path: string, next: SupportedLocale): string {
  const [pathname, suffix] = splitPathSuffix(path);
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isSupportedLocale(segments[0])) {
    segments[0] = next;
  } else {
    segments.unshift(next);
  }
  return `/${segments.join("/")}${suffix}`;
}

function cacheLocale(locale: SupportedLocale): void {
  try {
    window.localStorage.setItem(I18NEXT_STORAGE_KEY, locale);
  } catch {
    // Ignore restricted storage; the URL locale remains the source of truth.
  }
}
