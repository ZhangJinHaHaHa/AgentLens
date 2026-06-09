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
