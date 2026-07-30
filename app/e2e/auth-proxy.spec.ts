import { test, expect } from "@playwright/test";

// @public – AP14/B: Verhalten des Next-16-Proxy (Ersatz fuer middleware.ts).
// Laeuft OHNE Datenbank und ohne AUTH_SECRET: geprueft wird ausschliesslich der
// Zustand "keine Sitzung". Die angemeldeten Faelle gehoeren in die @app-Suite
// und sind erst mit lauffaehigem Stack nachweisbar.
test.describe("@public Proxy-Zugriffsschutz", () => {
  test("geschützte Seiten leiten ohne Sitzung auf /login", async ({ page }) => {
    for (const path of ["/", "/dashboard", "/vorgaenge", "/benutzer", "/export"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
  });

  test("Passwortwechsel ist ohne Sitzung nicht erreichbar", async ({ page }) => {
    // Der Wechselpfad ist die einzige geschützte Route, die ein Konto mit
    // `must_change_password` erreicht. Ohne Sitzung muss er ebenso gesperrt sein
    // wie jede andere geschützte Seite - sonst wäre das Formular öffentlich.
    for (const path of ["/passwort-aendern", "/passwort-aendern/hilfe"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
  });

  test("Wechselpfad mit ähnlichem Präfix ist nicht der Wechselpfad", async ({ page }) => {
    await page.goto("/passwort-aendernx");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Serveraktion des Passwortwechsels ist ohne Sitzung nicht nutzbar", async ({
    request,
    baseURL,
  }) => {
    // Ein unmittelbarer POST auf die Route umgeht Seite und Client-Komponente.
    // Zulässig ist alles außer einem 200 mit Formularantwort: Next weist eine
    // Serveraktion ohne gültige Aktionskennung ab, und ohne Sitzung leitet die
    // Seite ohnehin auf /login.
    const res = await request.post(`${baseURL}/passwort-aendern`, {
      form: {
        currentPassword: "synthetisch-aktuell-2026",
        newPassword: "synthetisch-neu-2026-x",
        confirmPassword: "synthetisch-neu-2026-x",
      },
      maxRedirects: 0,
    });
    expect(res.status()).not.toBe(200);
    const body = await res.text();
    expect(body).not.toContain("Aktuelles Passwort");
  });

  test("Pfade mit ähnlichem Präfix sind nicht öffentlich", async ({ page }) => {
    // Die abgeloeste Middleware prüfte Präfixe ohne Trennzeichen; damit galten
    // solche Pfade versehentlich als öffentlich.
    for (const path of ["/loginfremd", "/authentifizierung", "/offline-bericht"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
  });

  test("Anmeldeseite ist ohne Sitzung erreichbar und wird nicht umgeleitet", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  });

  test("Auth.js-Route ist erreichbar und liefert keine Serverfehlerseite", async ({
    request,
    baseURL,
  }) => {
    // Ohne AUTH_SECRET antwortet Auth.js mit einem Konfigurationsfehler (500),
    // mit Konfiguration mit einer Sitzungsantwort. Beides ist zulaessig -
    // unzulaessig waere eine Umleitung auf /login (die Route waere dann fuer
    // die Anmeldung unbenutzbar) oder ein 404 (Route nicht eingebunden).
    const res = await request.get(`${baseURL}/api/auth/session`, {
      maxRedirects: 0,
    });
    expect([200, 400, 500]).toContain(res.status());

    // Fail-closed: der Route Handler gibt entweder eine ausgewertete
    // Sitzungsauskunft oder den neutralen Rumpf `null` heraus - in jedem Fall
    // lesbares JSON. Eine durchgereichte, nicht ausgewertete Antwort (etwa eine
    // HTML-Fehlerseite) wäre genau der Fall, der hier ausgeschlossen wird.
    const body = await res.text();
    if (body !== "") {
      expect(() => JSON.parse(body) as unknown).not.toThrow();
      expect(body).not.toContain("<html");
      expect(body).not.toContain('"sid"');
    }
  });

  test("Abmelderoute akzeptiert kein GET und keine fremde Herkunft", async ({
    request,
    baseURL,
  }) => {
    const viaGet = await request.get(`${baseURL}/auth/signout`, { maxRedirects: 0 });
    expect(viaGet.status()).toBe(405);

    const crossOrigin = await request.post(`${baseURL}/auth/signout`, {
      headers: { origin: "https://fremde-seite.invalid" },
      maxRedirects: 0,
    });
    expect(crossOrigin.status()).toBe(403);
  });

  test("Abmeldung ohne Sitzung führt auf /login", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/auth/signout`, {
      headers: { "sec-fetch-site": "same-origin" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(303);
    expect(res.headers()["location"]).toContain("/login");
  });

  test("keine Sitzungscookies ohne Anmeldung", async ({ page, context }) => {
    await page.goto("/login");
    const cookies = await context.cookies();
    const sessionCookies = cookies.filter((c) => c.name.includes("session-token"));
    expect(sessionCookies).toHaveLength(0);
  });
});
