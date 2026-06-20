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
