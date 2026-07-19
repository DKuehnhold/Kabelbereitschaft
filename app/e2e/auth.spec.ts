import { test, expect } from "@playwright/test";
import { hasAppEnv, login, logout, users } from "./helpers";

// @app – benötigt Test-Supabase + Testbenutzer. Ohne Env übersprungen.
test.describe("@app Authentifizierung & Rollen", () => {
  test.skip(!hasAppEnv, "Benötigt Test-Supabase (E2E_* Umgebungsvariablen).");

  test("gültiger Login führt zum Dashboard", async ({ page }) => {
    await login(page, users.admin);
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  });

  test("ungültiger Login zeigt Fehler", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill("nobody@example.invalid");
    await page.getByLabel("Passwort").fill("falsch-falsch");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/fehlgeschlagen|ungültig|Anmeldung/i)).toBeVisible();
  });

  test("Logout beendet die Sitzung", async ({ page }) => {
    await login(page, users.admin);
    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Monteur-Navigation ist rollenabhängig", async ({ page }) => {
    await login(page, users.monteur);
    await expect(page.getByRole("link", { name: "Meine Einsätze" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Material" })).toHaveCount(0);
  });

  test("direkter URL-Aufruf umgeht keine Berechtigung (Monteur → /material)", async ({ page }) => {
    await login(page, users.monteur);
    await page.goto("/material");
    await expect(page.getByText(/kein Zugriff|nicht berechtigt|NoAccess/i)).toBeVisible();
  });

  test("direkter API-Zugriff ohne Session ist geschützt", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/sync`, { data: { items: [] } });
    expect([401, 403]).toContain(res.status());
  });
});
