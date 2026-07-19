import { test, expect } from "@playwright/test";
import { hasAppEnv, login, users } from "./helpers";
import path from "node:path";

// @app – Vorgänge, Bilder, CSV. Benötigt Test-Supabase + mind. einen Testvorgang.
// E2E_INCIDENT_ID = ID eines dem Test-Monteur zugewiesenen Vorgangs.
const INCIDENT = process.env.E2E_INCIDENT_ID ?? "";

test.describe("@app Vorgänge / Bilder / CSV", () => {
  test.skip(!hasAppEnv, "Benötigt Test-Supabase (E2E_* Umgebungsvariablen).");

  test("Vorgangsübersicht lädt und filtert", async ({ page }) => {
    await login(page, users.dispo);
    await page.goto("/vorgaenge");
    await expect(page.getByRole("heading", { name: "Vorgänge" })).toBeVisible();
    await page.getByPlaceholder("Volltextsuche…").fill("zzz-nichts-xyz");
    await expect(page.getByText(/Keine Vorgänge gefunden/i)).toBeVisible();
  });

  test("gefilterter CSV-Export lädt herunter", async ({ page }) => {
    await login(page, users.dispo);
    await page.goto("/vorgaenge");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "CSV-Export" }).click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/^vorgaenge_.*\.csv$/);
  });

  test("Vorgangsdetail + Timeline + Offline-fähige Notiz (online sofort)", async ({ page }) => {
    test.skip(!INCIDENT, "E2E_INCIDENT_ID nicht gesetzt.");
    await login(page, users.monteur);
    await page.goto(`/vorgaenge/${INCIDENT}`);
    await expect(page.getByRole("heading", { name: /Chronik/i })).toBeVisible();
    await page.getByLabel("Notiz").fill(`E2E-Notiz ${Date.now()}`);
    await page.getByRole("button", { name: "Notiz erfassen" }).click();
    await expect(page.getByText(/wird synchronisiert|vorgemerkt/i)).toBeVisible();
  });

  test("Bild-Upload (JPG) erscheint in der Galerie", async ({ page }) => {
    test.skip(!INCIDENT, "E2E_INCIDENT_ID nicht gesetzt.");
    await login(page, users.monteur);
    await page.goto(`/vorgaenge/${INCIDENT}`);
    const fixture = path.join(__dirname, "fixtures", "sample.jpg");
    await page.locator('input[type="file"][accept*="image/jpeg"]').first().setInputFiles(fixture);
    await page.getByRole("button", { name: /hochladen/i }).click();
    await expect(page.getByText(/Upload erfolgreich|hochgeladen/i)).toBeVisible();
  });

  test("unberechtigter Monteur sieht fremden Vorgang nicht", async ({ page }) => {
    test.skip(!INCIDENT, "E2E_INCIDENT_ID nicht gesetzt.");
    await login(page, users.monteurOhne);
    await page.goto(`/vorgaenge/${INCIDENT}`);
    await expect(page.getByText(/kein Zugriff|nicht berechtigt|NoAccess/i)).toBeVisible();
  });
});
