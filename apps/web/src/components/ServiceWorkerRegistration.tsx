"use client";

import { useEffect } from "react";
import { isDesktopAppEnabled } from "@/lib/desktop-mode";

/** Registers /sw.js so the app is installable (Chrome/Edge's install prompt requires an active service worker) and
 *  gets a friendly offline fallback instead of a browser error page. Skipped in the Electron desktop build since
 *  that's a packaged app already, not a page users install from a browser. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (isDesktopAppEnabled()) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
