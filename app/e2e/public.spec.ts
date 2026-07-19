import { test, expect } from "@playwright/test";

// @public – läuft OHNE Test-Supabase (öffentliche PWA-/Auth-Guard-Routen).
// Diese Tests sind in der Build-Umgebung ausführbar.
test.describe("@public PWA & Auth-Guard", () => {
  test("Manifest erreichbar und korrekt", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    expect(m.name).toBe("Kabelbereitschaft");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#1e3a8a");
    const sizes = (m.icons ?? []).map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i: { purpose?: string }) => i.purpose === "maskable")).toBeTruthy();
  });

  test("App-Icons erreichbar (PNG)", async ({ request, baseURL }) => {
    for (const p of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]) {
      const res = await request.get(`${baseURL}${p}`);
      expect(res.ok(), p).toBeTruthy();
      expect(res.headers()["content-type"]).toContain("image/png");
    }
  });

  test("Service Worker wird ausgeliefert und ist versioniert", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/sw.js`);
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("CACHE_VERSION");
    expect(body).toContain("/offline");
  });

  test("Offline-Fallback-Seite erreichbar", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /Keine Verbindung/i })).toBeVisible();
  });

  test("Login-Seite rendert mit Manifest-Verknüpfung", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });

  test("geschützte Route ohne Session leitet auf /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("öffentliche PWA-Routen ohne Login erreichbar", async ({ request, baseURL }) => {
    for (const p of ["/manifest.webmanifest", "/sw.js", "/offline"]) {
      const res = await request.get(`${baseURL}${p}`);
      expect(res.status(), p).toBeLessThan(400);
    }
  });
});
