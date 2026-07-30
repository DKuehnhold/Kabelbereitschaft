// AP14/B: die Sitzungs-ID verlaesst den Server nicht.
//
// Ausgangslage: der `session`-Rueckruf in `src/auth.ts` muss `sid` enthalten,
// weil `getSessionProfile()` sie fuer den serverseitigen Widerruf bei der
// Abmeldung braucht. Auth.js v5 bietet keinen Weg, ein Feld nur serverseitig zu
// fuehren: `auth()` ruft `Auth()` unmittelbar auf und liest dieselbe
// JSON-Antwort, die auch der Browser bei `GET /api/auth/session` erhaelt.
//
// Getrennt wird deshalb dort, wo sich die beiden Wege tatsaechlich
// unterscheiden: `auth()` umgeht den Route Handler dieser Anwendung, der
// Browser nicht. Der Route Handler entfernt `sid` aus der Antwort. Damit
// bleibt die Kennung serverseitig verfuegbar und erscheint nicht im
// clientseitigen Sitzungsobjekt - ohne das Sitzungscookie selbst zu
// entschluesseln.
//
// Bewusst ohne "server-only" und ohne Next-Import, damit die Regel isoliert
// testbar ist (app/test/ap14b-auth.test.mjs).

/** Kopfzeilen uebernehmen, ohne mehrere `Set-Cookie` zu einer zu verschmelzen. */
function copyHeaders(source: Headers, contentType?: string): Headers {
  const target = new Headers();
  source.forEach((value, name) => {
    // `forEach` liefert mehrere Set-Cookie-Zeilen zusammengefasst; sie werden
    // unten einzeln uebernommen. Die Laenge aendert sich mit dem neuen Rumpf.
    if (name === "set-cookie" || name === "content-length") return;
    target.set(name, value);
  });
  if (contentType !== undefined) target.set("content-type", contentType);
  for (const cookie of source.getSetCookie()) {
    target.append("set-cookie", cookie);
  }
  return target;
}

/** True fuer ein einfaches JSON-Objekt (kein Array, kein `null`). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Antwort mit unveraendertem Status, Statustext und allen Cookies, aber
 * ausgetauschtem Rumpf.
 */
function withBody(response: Response, body: string): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: copyHeaders(response.headers, "application/json"),
  });
}

/**
 * Bereinigt eine Sitzungsantwort fuer den Browser.
 *
 * FAIL-CLOSED: unveraendert weitergegeben wird ausschliesslich eine Antwort,
 * die als Sitzungsauskunft LESBAR ist und nachweislich kein `sid` enthaelt.
 * Jede andere nichtleere Form - kein JSON, unlesbares JSON, kein Objekt, ein
 * Objekt ohne `user`, ein `user` das kein Objekt ist - wird durch den neutralen
 * Rumpf `null` ersetzt.
 *
 * Begruendung: dieser Handler ist die einzige Stelle, die zwischen dem
 * serverseitigen Sitzungsobjekt (mit `sid`) und dem Browser steht. Gibt er eine
 * Antwort durch, die er nicht auswerten konnte, gibt er moeglicherweise genau
 * die interne Auskunft heraus, die er entfernen sollte. Ein Durchreichen "weil
 * es wahrscheinlich harmlos ist" waere eine Annahme ueber unbekannten Inhalt.
 * Auch ein Objekt ohne `user` ist so ein Fall: es kann beliebige weitere Felder
 * tragen, ohne dass diese Stelle sie geprueft hat.
 *
 * Status, Statustext und alle Kopfzeilen einschliesslich mehrerer
 * `Set-Cookie`-Zeilen bleiben in JEDEM Fall erhalten - die stille
 * Tokenerneuerung darf nicht verloren gehen.
 *
 * Regulaere Antworten, die unveraendert bleiben:
 *   * ohne Rumpf (z. B. 204/304) - sie koennen keine Auskunft enthalten;
 *   * JSON `null` - die ausdrueckliche Antwort "keine Sitzung";
 *   * JSON-Objekt mit `user`-Objekt ohne `sid`.
 */
export async function withoutSessionId(response: Response): Promise<Response> {
  // Ohne Rumpf gibt es nichts zu schuetzen - und ein Status wie 204/304 darf
  // ueberhaupt keinen Rumpf tragen.
  if (response.body === null) return response;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return sealed(response, "kein JSON-Inhaltstyp");
  }

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    return sealed(response, "unlesbares JSON");
  }

  // "keine Sitzung": JSON `null` ist die einzige regulaere Antwort ohne `user`.
  if (payload === null) return response;

  if (!isPlainObject(payload)) {
    return sealed(response, "kein JSON-Objekt");
  }

  // Ohne geprueftes `user`-Objekt darf nichts passieren. `undefined` kann in
  // JSON nicht auftreten; ein fehlendes Feld liest sich hier deshalb genauso.
  if (!("user" in payload)) {
    return sealed(response, "Objekt ohne user");
  }

  const user = payload.user;
  if (!isPlainObject(user)) {
    return sealed(response, "user ist kein Objekt");
  }

  if (!("sid" in user)) return response;

  const publicUser: Record<string, unknown> = { ...user };
  delete publicUser.sid;
  return withBody(response, JSON.stringify({ ...payload, user: publicUser }));
}

/**
 * Ersetzt eine nicht auswertbare Antwort durch den neutralen Rumpf `null`.
 *
 * Die Protokollzeile nennt ausschliesslich den Grund und den Status, niemals den
 * Rumpf - er koennte genau die Auskunft enthalten, die hier zurueckgehalten wird.
 */
function sealed(response: Response, reason: string): Response {
  console.error(
    "Sitzungsauskunft nicht auswertbar und deshalb zurueckgehalten",
    `Grund: ${reason}; Status: ${response.status}`,
  );
  return withBody(response, "null");
}
