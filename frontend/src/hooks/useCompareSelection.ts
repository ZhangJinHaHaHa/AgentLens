/**
 * 在比较页 URL 与当前标签页 `sessionStorage` 之间协调最多四个条目 ID：URL 含 `ids` 时为主来源，否则恢复会话选择。
 * 解析会裁剪空白、去重并截断到上限，同时保留 `rawIds/hasOverflow` 供界面说明；增删清空会更新路由并同步会话存储。
 * 这是浏览器状态副作用，不发网络请求；SSR 读取安全返回空，隐私/受限模式下的存储异常被忽略，URL 状态仍可独立工作。
 * 查询参数和存储内容均不可信，本层只规范化字符串而不确认 ID 存在，消费端必须在目录索引中解析，绝不能据此授予租赁或运行权限。
 * 没有自动重试或跨标签同步；所有更新保留其他查询键，四项上限、去重和“显式 URL 优先”是分享链接兼容不变量。
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export const MAX_COMPARE_SELECTION = 4;
const COMPARE_SELECTION_STORAGE_KEY = "agentlens.compare.ids";

function parseCompareIds(value: string | null): string[] {
  if (!value) return [];
  return Array.from(new Set(value.split(",").map((id) => id.trim()).filter(Boolean)));
}

function readStoredCompareIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseCompareIds(window.sessionStorage.getItem(COMPARE_SELECTION_STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeStoredCompareIds(ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    if (ids.length > 0) {
      window.sessionStorage.setItem(COMPARE_SELECTION_STORAGE_KEY, ids.join(","));
    } else {
      window.sessionStorage.removeItem(COMPARE_SELECTION_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in restricted browser modes; URL state still works.
  }
}

export function useCompareSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const urlIds = parseCompareIds(idsParam);
  const rawIds = idsParam === null ? readStoredCompareIds() : urlIds;
  const ids = rawIds.slice(0, MAX_COMPARE_SELECTION);
  const hasOverflow = rawIds.length > MAX_COMPARE_SELECTION;

  useEffect(() => {
    if (idsParam !== null) {
      writeStoredCompareIds(ids);
    }
  }, [ids, idsParam]);

  const compareParams = new URLSearchParams(searchParams);
  if (ids.length > 0) {
    compareParams.set("ids", ids.join(","));
  } else {
    compareParams.delete("ids");
  }
  const compareSearch = compareParams.toString();
  const compareHref = `/compare${compareSearch ? `?${compareSearch}` : ""}`;

  const addId = (id: string) => {
    if (ids.includes(id)) return;
    if (ids.length >= MAX_COMPARE_SELECTION) return;
    const newIds = [...ids, id];
    writeStoredCompareIds(newIds);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("ids", newIds.join(","));
      return next;
    });
  };

  const removeId = (id: string) => {
    const newIds = ids.filter((i) => i !== id);
    writeStoredCompareIds(newIds);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newIds.length > 0) {
        next.set("ids", newIds.join(","));
      } else {
        next.delete("ids");
      }
      return next;
    });
  };

  const clearIds = () => {
    writeStoredCompareIds([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("ids");
      return next;
    });
  };

  return { ids, rawIds, hasOverflow, compareHref, addId, removeId, clearIds };
}
