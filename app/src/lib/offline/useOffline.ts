"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { offlineManager } from "@/lib/offline/manager";
import type { OfflineState } from "@/lib/offline/types";

export function useOffline(): OfflineState {
  const state = useSyncExternalStore(
    offlineManager.subscribe,
    offlineManager.getSnapshot,
    offlineManager.getServerSnapshot,
  );
  useEffect(() => {
    void offlineManager.init();
  }, []);
  return state;
}

export { offlineManager };
