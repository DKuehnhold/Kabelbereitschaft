"use client";

import { useEffect } from "react";

// Registriert den Service Worker (App-weit, auch auf /login). Ohne UI.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Registrierung fehlgeschlagen (z. B. unsicherer Kontext) – App läuft normal weiter. */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
