/**
 * 封装浏览器 PWA 安装生命周期：捕获一次性的 `beforeinstallprompt` 事件，监听安装完成，并为 iOS Safari 提供手动安装状态提示。
 * hook 输出可用性和显式 `install` 操作；调用操作会触发浏览器原生提示、等待用户选择并消费缓存事件，接受后更新本地 installed 状态。
 * 仅维护组件内存状态，不联网、不写存储；effect 会成对移除全局监听器，SSR 辅助检测返回 false，真实事件只在浏览器挂载后处理。
 * UA、display-mode 和浏览器事件只是客户端环境信号，不能证明安装包完整性或设备身份；安装与权限仍由浏览器平台控制。
 * 无提示事件时返回 unavailable，拒绝后必须等待浏览器再次派发事件；本层不重试，`prompt/userChoice` 的平台异常会原样拒绝给调用方处理。
 */
import { useCallback, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PwaInstallAvailability = "available" | "installed" | "ios-manual" | "unavailable";

export interface PwaInstallPromptState {
  availability: PwaInstallAvailability;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function usePwaInstallPrompt(): PwaInstallPromptState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosManual, setIosManual] = useState(false);

  useEffect(() => {
    const standalone = isStandaloneDisplay();
    setInstalled(standalone);
    setIosManual(isIosSafari() && !standalone);

    const handleBeforeInstallPrompt = (event: Event): void => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = (): void => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const availability = useMemo<PwaInstallAvailability>(() => {
    if (installed) return "installed";
    if (promptEvent) return "available";
    if (iosManual) return "ios-manual";
    return "unavailable";
  }, [installed, iosManual, promptEvent]);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!promptEvent) return "unavailable";
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    return choice.outcome;
  }, [promptEvent]);

  return { availability, install };
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standaloneMedia =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return standaloneMedia || nav.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}
