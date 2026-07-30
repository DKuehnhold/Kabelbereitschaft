# Benutzerverwaltung

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1
>
> **Achtung (2026-07-28):** Die Abschnitte ab „Benutzer anlegen“ beschreiben den
> Supabase-Bestand aus AP1–AP13 und sind **abzulösender Altbestand**. Verbindlich
> für die Zielplattform ist ADR-011; der Anmeldeteil ist mit AP14/B umgesetzt.
> Der nachfolgende Abschnitt ist der gültige Ablauf für eine neue Instanz.

## Ersten Administrator bootstrappen (AP14/B, ADR-011 / 2.11)

Einmaliges, nicht-visuelles Betreiberkommando. Voraussetzung: Bootstrap und
Migrationen bis `0013` sind angewendet und es existiert noch **kein**
anmeldefähiger Administrator.

```
cd app
BOOTSTRAP_DATABASE_URL=<Verbindung der Migrationsrolle> \
  node scripts/bootstrap-admin.mjs --email <adresse> --name "<Anzeigename>"
```

Unter Windows PowerShell entsprechend:

```
Set-Location app
$env:BOOTSTRAP_DATABASE_URL = "<Verbindung der Migrationsrolle>"
& "C:\Program Files\nodejs\node.exe" scripts/bootstrap-admin.mjs --email <adresse> --name "<Anzeigename>"
Remove-Item Env:\BOOTSTRAP_DATABASE_URL
```

Verbindliche Eigenschaften:

- **Das Kennwort wird verdeckt am Terminal abgefragt** (zweimal, mit Vergleich).
  Es steht **nie** in einem Argument, einer Datei, einer Umgebungsvariablen, im
  Protokoll oder in Git. Mindestlänge 12 Zeichen.
- `BOOTSTRAP_DATABASE_URL` ist die Verbindung der **Migrations-/Eigentümerrolle**,
  nicht die der Anwendung: die Anwendungsrolle `app_user` darf kein Profil
  anlegen (`profiles_insert` verlangt `is_admin()`), und genau den gibt es vorher
  noch nicht.
- Argon2id über die zentrale Implementierung `src/lib/auth-password.ts` — es gibt
  keinen zweiten Parametersatz.
- **Fail-closed und idempotent:** existiert bereits ein anmeldefähiger
  Administrator, wird nichts geändert. Ist es genau das angeforderte Konto, ist
  der Lauf ein unveränderter Leerlauf. Jede andere unklare Ausgangslage bricht ab.
- Genau eine Transaktion mit Vorschaltsperre (`pg_advisory_xact_lock`); jeder
  Fehler rollt vollständig zurück.

Exit-Codes: `0` erfolgreich oder unverändert · `1` Aufruf-/Konfigurationsfehler ·
`2` Kennwortregel verletzt · `3` Ausgangslage nicht zulässig · `4` Datenbankfehler.

Danach wird über diesen Administrator alles Weitere eingerichtet. Ein
Kennwortwechsel gehört ausdrücklich **nicht** in das Bootstrap.

> Ein Kennwortwechsel-Zwang (`must_change_password`) ist für administrativ
> gesetzte Übergangskennwörter vorgesehen. Das selbst eingegebene Bootstrap-Kennwort
> setzt ihn deshalb nicht.

## Passwortwechsel (AP14/B, ADR-011 / 2.3)

Umgesetzt und wirksam. Es gibt keinen öffentlichen „Passwort vergessen"-Weg und
keinen SMTP-Anschluss (ADR-011 / 2.3).

- Setzt ein Administrator `auth_accounts.must_change_password = true` (Übergangs-
  kennwort), erreicht das Konto nach der Anmeldung **ausschließlich**
  `/passwort-aendern`. Jede andere Seite, jede Server Action und jede geschützte
  API sind serverseitig gesperrt; offen bleiben nur der Wechselpfad, die
  Auth-Endpunkte und die Abmeldung.
- Der Wechsel verlangt aktuelles Passwort, neues Passwort und Bestätigung.
  Mindestlänge 12 Zeichen — dieselbe zentrale Regel wie im Bootstrap
  (`src/lib/auth-password.ts`).
- Ein erfolgreicher Wechsel widerruft in derselben Transaktion **alle** Sitzungen
  des Kontos. Danach ist eine erneute Anmeldung zwingend.
- Auditiert werden der Wechsel selbst (`auth_accounts` / `password_changed`) und
  jeder Sitzungswiderruf (`auth_sessions` / `revoke`, Grund `password_changed`) —
  jeweils mit Zeitpunkt, Urheber und betroffenem Konto, **ohne** Kennwort oder
  Hash. Die Erneuerung eines veralteten Argon2-Parametersatzes bei der Anmeldung
  erzeugt bewusst **keinen** Wechsel-Auditsatz.
- Ein Übergangskennwort wird außerhalb des Systems übergeben und nicht
  protokolliert.

---

## Altbestand (Supabase, AP1–AP13)

Benutzer werden über Supabase Auth verwaltet; die fachliche Rolle liegt in `profiles.role`.

## Benutzer anlegen

1. Benutzer in **Supabase Auth** anlegen (E-Mail + Passwort, oder Einladung).
2. Zu jedem Auth-Benutzer existiert ein Datensatz in `profiles` (per Trigger beim Anlegen erzeugt oder manuell ergänzt).
3. Im Profil die **Rolle** setzen: `administrator`, `disponent` oder `monteur`.

## Rollenzuweisung

- Die Rolle steuert Navigation und Zugriff (RLS).
- Änderung der Rolle erfolgt über das Feld `profiles.role` (nur durch Administrator).
- Ein Monteur benötigt zusätzlich Zuweisungen (`incident_assignments`), um Vorgänge zu sehen.

## Deaktivierung

- Benutzer werden nicht gelöscht, sondern über `is_active` (Feld auf `profiles`) deaktiviert.
- Deaktivierte Benutzer erscheinen nicht mehr in Auswahllisten (z. B. Monteur-Zuweisung) und erhalten keinen fachlichen Zugriff.
- Optional zusätzlich der Auth-Zugang in Supabase sperren.

## Ersteinrichtung Administrator

1. Ersten Benutzer in Supabase Auth anlegen.
2. Dessen `profiles`-Datensatz sicherstellen und `role = 'administrator'` setzen (initial per Supabase-SQL-Editor / Seed).
3. Über diesen Admin alle weiteren Benutzer und Rollen einrichten.

> Sicherheitshinweis: Der initiale Admin-Zugang ist besonders zu schützen; Standard-/Testpasswörter vor Produktivbetrieb ändern.
