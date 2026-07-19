"use client";

import { useEffect, useRef, useState } from "react";

// Registriert den Service Worker (app-weit) und zeigt bei einer neuen Version eine
// dezente Aktualisierungsanzeige. Ein Update lädt die Seite neu (löscht KEINE
// nicht synchronisierten Offline-Aktionen – diese liegen in IndexedDB).
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (reg.waiting && navigator.serviceWorker.controller) {
          waitingRef.current = reg.waiting;
          setUpdateReady(true);
        }
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              waitingRef.current = reg.waiting ?? nw;
              setUpdateReady(true);
            }
          });
        });
      } catch {
        /* Registrierung fehlgeschlagen (z. B. unsicherer Kontext) – App läuft normal weiter. */
      }
    };

    const onControllerChange = () => {
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-blue-900 px-4 py-2 text-sm text-white"
    >
      <span>Neue Version verfügbar</span>
      <button
        type="button"
        onClick={() => { waitingRef.current?.postMessage("SKIP_WAITING"); }}
        className="rounded-md bg-white px-3 py-1 text-xs font-medium text-blue-900 hover:bg-blue-50"
      >
        Jetzt aktualisieren
      </button>
      <button
        type="button"
        onClick={() => setUpdateReady(false)}
        className="rounded-md border border-white/50 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
      >
        Später
      </button>
    </div>
  );
}
