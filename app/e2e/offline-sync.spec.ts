import { test, expect } from "@playwright/test";
import { hasAppEnv, login, users } from "./helpers";

// @app – Offline, Wiederverbindung, Synchronisation, Idempotenz, Konflikt.
// Nutzt echte Browser-Netzwerksteuerung (context.setOffline). Benötigt Test-Supabase.
const INCIDENT = process.env.E2E_INCIDENT_ID ?? "";

test.describe("@app Offline & Synchronisation", () => {
  test.skip(!hasAppEnv || !INCIDENT, "Benötigt Test-Supabase + E2E_INCIDENT_ID.");

  test("Offline-Erkennung wird angezeigt", async ({ page, context }) => {
    await login(page, users.monteur);
    await page.goto(`/vorgaenge/${INCIDENT}`);
    await context.setOffline(true);
    await expect(page.getByText(/^Offline$/).first()).toBeVisible();
    await context.setOffline(false);
  });

  test("Offline-Notiz bleibt nach Reload erhalten und synchronisiert bei Reconnect", async ({ page, context }) => {
    await login(page, users.monteur);
    await page.goto(`/vorgaenge/${INCIDENT}`);
    await context.setOffline(true);
    await page.getByLabel("Notiz").fill(`Offline-Notiz ${Date.now()}`);
    await page.getByRole("button", { name: "Notiz erfassen" }).click();
    await expect(page.getByText(/offline vorgemerkt/i)).toBeVisible();

    // Persistenz nach Reload (Aktion bleibt in IndexedDB).
    await page.reload();
    await expect(page.getByRole("button", { name: /Offline-Status/i })).toContainText(/offen/);

    // Reconnect → automatische Synchronisation, Warteschlange leert sich.
    await context.setOffline(false);
    await expect(page.getByRole("button", { name: /Offline-Status/i })).toContainText(/✓|Online/, { timeout: 15_000 });
  });

  test("Offline-Statusänderung wird vorgemerkt", async ({ page, context }) => {
    await login(page, users.monteur);
    await page.goto(`/vorgaenge/${INCIDENT}`);
    await context.setOffline(true);
    await page.getByLabel("Status vormerken").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Status übernehmen" }).click();
    await expect(page.getByText(/offline vorgemerkt/i)).toBeVisible();
    await context.setOffline(false);
  });

  test("keine gespeicherten Tokens/Secrets in IndexedDB", async ({ page }) => {
    await login(page, users.monteur);
    await page.goto("/dashboard");
    const leak = await page.evaluate(async () => {
      const dump: string[] = [];
      const req = indexedDB.open("kb-offline");
      await new Promise<void>((res) => { req.onsuccess = () => res(); req.onerror = () => res(); });
      const db = req.result;
      for (const store of Array.from(db.objectStoreNames)) {
        await new Promise<void>((res) => {
          const g = db.transaction(store).objectStore(store).getAll();
          g.onsuccess = () => { dump.push(JSON.stringify(g.result)); res(); };
          g.onerror = () => res();
        });
      }
      const all = dump.join("");
      return /access_token|refresh_token|service_role|apikey|password|bearer /i.test(all);
    });
    expect(leak).toBeFalsy();
  });
});
