import { type Page, expect } from "@playwright/test";

// App-Tests (mit Login/Daten) benötigen eine Test-Supabase-Instanz und Testbenutzer.
// Ohne diese Umgebungsvariablen werden die @app-Tests übersprungen (nicht als bestanden gewertet).
export const hasAppEnv = Boolean(
  process.env.E2E_ADMIN_EMAIL &&
    process.env.E2E_ADMIN_PASSWORD &&
    process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export type TestUser = { email: string; password: string };

export const users = {
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" },
  dispo: { email: process.env.E2E_DISPO_EMAIL ?? "", password: process.env.E2E_DISPO_PASSWORD ?? "" },
  monteur: { email: process.env.E2E_MONTEUR_EMAIL ?? "", password: process.env.E2E_MONTEUR_PASSWORD ?? "" },
  monteurOhne: { email: process.env.E2E_MONTEUR2_EMAIL ?? "", password: process.env.E2E_MONTEUR2_PASSWORD ?? "" },
};

export async function login(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(user.email);
  await page.getByLabel("Passwort").fill(user.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);
}
