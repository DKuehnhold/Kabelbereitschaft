# Roadmap AP12–AP15 und Git-Sicherungsplan

> **Version 1.12** · Stand: 2026-07-27 ·
> **Verbindlicher Arbeitsort (Entscheidung Dennis, 2026-07-26):** einziger Projekt- und
> Arbeitsort ist der Kabelbereitschaft-Vault
> `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`.
> Die frühere Festlegung, `C:\dev\Kabelbereitschaft` sei der führende Arbeits-Clone, ist
> **durch Dennis ausdrücklich aufgehoben**; jener Ordner war ein vorübergehender technischer
> Clone und wurde nach Abschluss der Rückführung über den Windows-Papierkorb entfernt.
> **Status (V0/AP12): Roadmap unter Auflagen als Planungsgrundlage freigegeben; AP12 wurde
> durch Dennis am 2026-07-27 ausdrücklich freigegeben und ist technisch abgeschlossen.**
> Die Entscheidungen **V2, V3, V4**, zur **Repository-Struktur** sowie die vier AP12-Detailpunkte
> **Menge/Einheit, `condition_code`, Monteur-Kontaktzugriff und Infrastrukturzeitpunkt** sind
> getroffen (siehe B.1/B.7); **V1 (Datenschutz) bleibt offen und wirkt als Produktionssperre.**
> Die **AP12-Startfreigabe-Checkliste (B.8)** ist vollständig abgearbeitet; die erforderliche
> ausdrückliche Freigabe durch Dennis wurde am 2026-07-27 erteilt.
> Grundlage: read-only Git-Prüfung vom 2026-07-25, `00-Projektsteuerung/ARCHITEKTEN_UEBERSICHT.md`
> und die Freigabeentscheidungen vom 2026-07-25 (V0-Auflagen und AP12-Detailentscheidungen).
> Dieses Dokument überschreibt nichts und ersetzt kein bestehendes Dokument.

---

# Teil A — Git-Zustand und Bereinigungsplan

## A.1 Verifizierter Git-Zustand (read-only, 2026-07-25)

Alle Befehle mit `git --no-optional-locks` ausgeführt; kein Push, Pull, Reset, Checkout, Rebase,
Merge, Umzug, kein Löschen, kein Staging.

| Merkmal | Befund |
|---|---|
| Branch / `HEAD` | `main` → `1b8d0711957e789568b5b20542d994674d651289` (`.git/HEAD` = `ref: refs/heads/main`) |
| Refs zum Prüfzeitpunkt | nur zwei: `refs/heads/main` = `1b8d071`, `refs/remotes/origin/main` = `1cac409` |
| `origin` | `https://github.com/DKuehnhold/Kabelbereitschaft.git` (fetch + push) |
| ahead / behind | **3 voraus / 0 zurück** |
| Integrität (`git fsck --connectivity-only`) | **keine Korruption**, keine fehlenden Objekte; 2 dangling commits |
| Index | lesbar, 222 Dateien, 24.339 B, mtime 2026-07-23 13:22 |
| `packed-refs` / `FETCH_HEAD` / `ORIG_HEAD` | nicht vorhanden |
| Objektlage | 616 loose objects (1,73 MiB), **0 Packfiles** — nie `gc`/`repack` gelaufen |
| **Garbage** | **616 Dateien `tmp_obj_*` in `.git/objects/`, 845 KiB** |
| `.git` gesamt | 1,9 MiB |

### Die zum Prüfzeitpunkt drei nicht gepushten Commits — vollständig und erreichbar

| Commit | Datum | Autor | Betreff | Vorfahre von HEAD |
|---|---|---|---|---|
| `008f648` | 2026-07-22 23:13:05 +0200 | Dennis Kühnhold | feat: implement master data management (AP9) | ja |
| `156e43f` | 2026-07-23 09:51:19 +0200 | Dennis Kühnhold | feat: integrate master data into incident creation (AP10) | ja |
| `1b8d071` | 2026-07-23 13:22:33 +0200 | Dennis Kühnhold | feat: implement operational incident list (AP11) | ja |

Der Reflog ist lückenlos von der Erstanlage (`380a651`, 2026-07-19 15:53) bis AP11 vorhanden. **Es
ist nichts verloren.**

### Uncommittete Arbeitskopie

```
 M Willkommen.md
 M app/src/app/globals.css
 M app/src/app/layout.tsx
 M app/src/app/login/page.tsx
 M app/src/app/manifest.ts
 M app/src/components/Logo.tsx
?? app/public/branding/wus-technik.svg          ← AP8.1-Branding
?? 00-Projektsteuerung/ARCHITEKTEN_UEBERSICHT.md ← am 2026-07-25 neu erstellt
?? 00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md ← dieses Dokument
```

Umfang der Änderungen: 6 Dateien, +80 / −65 Zeilen. Weder gestaged noch verändert noch verworfen.

### Dangling Commits — beide unkritisch

| Commit | Datum | Autor | Betreff | Einordnung |
|---|---|---|---|---|
| `df9a3e9` | 2026-07-23 09:50:55 | Dennis Kühnhold | *feat: integrate master data into incident creation (AP10)* | Vorgängerfassung von `156e43f` (24 s später), gleicher Parent `008f648` → **verworfener Versuch/Amend** |
| `9b6da7d` | 2026-07-19 15:56:28 | **Kabelbereitschaft** | *AP1: .env.example versionieren + .gitignore-Anpassung* | Vorgängerfassung von `714e374`, gleicher Parent `380a651`; abweichender Autorname → **Amend zur Autorkorrektur** |

Beide sind Reste von Amend-Operationen, deren Ergebnis in der Historie steht. Kein Datenverlust.

## A.2 Aktive Git-Prozesse

In der Prüfumgebung (isolierte Linux-Sandbox) läuft **kein** Git-Prozess. **Einschränkung, die
festgehalten werden muss:** die Sandbox sieht keine Windows-Prozesse. Ob auf dem Arbeitsplatz gerade
ein `git.exe`, ein Editor-Git-Integration (VS Code, Obsidian-Git-Plugin) oder der OneDrive-Client auf
das Repository zugreift, ist von hier aus **nicht feststellbar**. Vor jeder Bereinigung ist dies auf
dem Windows-Rechner selbst zu prüfen (`Get-Process git*`, VS Code / Obsidian schließen,
OneDrive-Synchronisierung pausieren).

## A.3 Vollständiges Inventar verdächtiger `.git`-Dateien

**24 Dateien** direkt in `.git` bzw. `.git/objects` (ohne die 616 `tmp_obj_*`):

| Datei | Größe | mtime | Mutmaßliche Herkunft |
|---|---|---|---|
| `HEAD.lock` | 0 B | 2026-07-23 13:22 | **Rest des AP11-Commits** (identische Minute) |
| `index.lock` | 0 B | 2026-07-23 13:22 | **Rest des AP11-Commits** (identische Minute) |
| `HEAD.lock.1784793077` | 0 B | 2026-07-22 23:13 | beiseitegeschobene Lock zum AP9-Commit |
| `HEAD.lock.1784805752` | 0 B | 2026-07-23 09:51 | beiseitegeschobene Lock zum AP10-Commit |
| `index.lock.1784793077` | 0 B | 2026-07-23 09:50 | dito (AP10-Vorversuch) |
| `index.lock.1784805741` | 0 B | 2026-07-23 09:51 | dito (AP10) |
| `index.lock.stale` | 0 B | 2026-07-22 23:13 | dito (AP9) |
| `HEAD.lock.bak` · `index.lock.bak` | 0 B | 2026-07-19 15:53/15:54 | Erstanlage AP1 |
| `objects/maintenance.lock.bak` | 0 B | 2026-07-19 15:53 | Rest von `git maintenance` |
| `HEAD.lock.stale.1784484387` | 0 B | 2026-07-19 20:02 | AP3-Zeitfenster |
| `HEAD.lock.t1784487001236094026` | 0 B | 2026-07-19 20:49 | AP4-Commit |
| `HEAD.lock.t1784488940576015590` | 0 B | 2026-07-19 21:22 | AP5-Commit |
| `HEAD.lock.t1784491209386578963` | 0 B | 2026-07-19 21:59 | AP6-Commit |
| `HEAD.lock.t1784492340735801428` | 0 B | 2026-07-19 22:18 | AP7-Commit |
| `HEAD.lock.t1784493658000533330` | 0 B | 2026-07-19 22:40 | AP8-Commit |
| `HEAD.lock.trash.1784484572030236622` | 0 B | 2026-07-19 20:08 | Repo-Umstellung auf `main` |
| `index.lock.trash.1784484505895357197` | 0 B | 2026-07-19 20:02 | dito |
| `index.lock.trash.1784484506543367197` | 0 B | 2026-07-19 20:08 | dito |
| `index.lock.trash.1784484572017566778` | 0 B | 2026-07-19 20:09 | dito |
| `master.lock.stale.1784484387.trash` | 0 B | 2026-07-19 20:05 | Umbenennung `master` → `main` |
| **`master.removed.trash`** | 41 B | 2026-07-19 20:02 | **entfernte Ref `refs/heads/master`**; Inhalt = `ac7b4d1` (AP3) — dieser Commit ist Teil der `main`-Historie, die Datei ist reiner Rest |
| `_rot_test_target.bak` | 2 B (`B\n`) | 2026-07-19 20:01 | Schreib-/Rotationstest eines Werkzeugs |
| `tX1d0fQ` | 0 B | 2026-07-19 15:53 | temporäre Datei bei der Erstanlage |
| `objects/*/tmp_obj_*` | **616 Dateien, 845 KiB** | 477× 07-19, 59× 07-22, 80× 07-23 | **abgebrochene Objektschreibvorgänge** — größte: 82 kB, 82 kB, 81 kB |

**Herkunftsbewertung.** Die Namensmuster `.stale`, `.trash.<ns>`, `.t<ns>`, `.bak`, `.<epoch>` sind
kein Git-Verhalten — Git löscht seine Locks oder lässt genau eine liegen. Das Muster deutet auf ein
**automatisiertes Werkzeug, das Sperrdateien systematisch beiseitegeschoben hat, um trotz
OneDrive-Sperren weiterarbeiten zu können**, in Kombination mit OneDrive-Sync (der `.bak`-/
Konfliktkopien anlegt). Die 616 `tmp_obj_*` entstehen, wenn Git ein Objekt schreibt und das
anschließende atomare Umbenennen fehlschlägt — der typische Effekt eines Cloud-Sync-Clients, der die
Datei im Zugriff hält.

## A.4 Bewertung: was das praktisch bedeutet

1. **Das Repository ist intakt.** Historie, Objekte und Index sind konsistent; `fsck` meldet keinen
   Fehler. Es besteht keine Eile im Sinne von Datenverlust.
2. **Das Repository ist aber derzeit nicht schreibfähig für indexschreibende Operationen.**
   `.git/index.lock` und `.git/HEAD.lock` existieren. Solange `index.lock` liegt, verweigert Git
   jede Operation, die den Index schreibt (`git add`, `git commit`, `git stash`) mit „Unable to
   create '.git/index.lock': File exists". Das erklärt, warum die Branding-Dateien nicht committet
   werden konnten. **Ein Push bereits vorhandener Commits wird durch `index.lock` normalerweise
   nicht blockiert. Die tatsächliche Ursache dafür, dass AP9–AP11 nicht gepusht wurden, ist nicht
   belegt** und bleibt offen (mögliche Kandidaten: fehlende Zugangsdaten, Abbruch, schlicht nicht
   ausgeführt).
3. **Das Risiko wächst mit jeder weiteren Aktion im OneDrive-Ordner**, nicht mit der Zeit.

## A.5 Bereinigungsplan (risikoarm, in dieser Reihenfolge)

> Noch **nicht** ausgeführt. Jeder Schritt ist einzeln freizugeben. **Verbindliche
> Sicherungsreihenfolge (Entscheidung 2026-07-25):** vollständige Dateisystemkopie inkl. `.git` →
> Windows-Prozessprüfung → nur die beiden echten, nachweislich verwaisten Locks entfernen →
> Git-Status und Integrität erneut prüfen → Git-Bundle anlegen → AP9–AP11 pushen → Dokumentation
> und Branding in getrennten Commits bzw. Branches sichern → frischer Clone außerhalb OneDrive.

### Schritt 0 — Vollsicherung, bevor irgendetwas angefasst wird

Dateisystem-Kopie des gesamten Ordners (inklusive `.git`) auf ein Ziel **außerhalb** von OneDrive,
z. B. `C:\Backup\Kabelbereitschaft_2026-07-25\`. Reine Kopie, kein Git-Befehl. Danach ist jeder
folgende Schritt reversibel.

### Schritt 1 — Umgebung ruhigstellen

OneDrive-Synchronisierung pausieren; VS Code, Obsidian und alle Editoren schließen; auf dem
Windows-Rechner prüfen, dass kein `git`-Prozess läuft (`Get-Process git*`). Erst danach weiter.

### Schritt 2 — Nur die beiden echten Locks entfernen, sonst nichts

**Entfernt werden ausschließlich (2 Dateien, echte Git-Sperren):**

- `.git/index.lock` und `.git/HEAD.lock` — **nur** nachdem auf dem Windows-Rechner OneDrive
  pausiert, alle Editoren geschlossen und aktive Git-Prozesse ausgeschlossen sind (Schritt 1).

**Alles andere bleibt unangetastet:**

- Die 23 beiseitegeschobenen Dateien (`.bak`, `.stale`, `.trash`, `.t*`, `.<epoch>`,
  `master.removed.trash`, `_rot_test_target.bak`, `tX1d0fQ`) **müssen nicht einzeln gelöscht
  werden**. Sie sind funktionslos, stören den Betrieb nicht und entfallen ohnehin mit dem frischen
  Clone (Schritt 5).
- Die **beiden dangling Commits** und sämtliche **616 `tmp_obj_*`** bleiben im alten Repository
  **unangetastet**. **Kein `git gc --prune=now`** und kein `repack` im alten Repository — es bleibt
  vollständig als Sicherung erhalten; bereinigt wird ausschließlich über den frischen Clone.

**Danach:** `git --no-optional-locks status` und `git fsck --connectivity-only` erneut ausführen
und mit dem Befund aus A.1 vergleichen. Erst bei unverändertem Ergebnis weiter mit Schritt 3.

### Schritt 3 — AP9–AP11 sichern und pushen

1. `git --no-optional-locks status` zur Kontrolle (schreibt nichts).
2. **Git-Bundle als unabhängige lokale Sicherung außerhalb des OneDrive-Repositories,
   unabhängig von GitHub:**
   `git bundle create C:\Backup\kabelbereitschaft_main_2026-07-25.bundle main`
   Das Bundle enthält die gesamte Historie inklusive AP9–AP11 und ist ohne Netzzugang
   wiederherstellbar. Empfohlen **vor** dem Push. **Hinweis (1.3):** Ein Bundle auf demselben
   Rechner ist **keine** Off-Site-Sicherung. Optionaler nachgelagerter Sicherheitsschritt: Kopie
   des Bundles auf einen getrennten Datenträger oder einen freigegebenen externen Speicherort —
   erst diese zweite Kopie darf als Off-Site-Sicherung bezeichnet werden.
3. `git push origin main` — überträgt genau die drei Commits `008f648`, `156e43f`, `1b8d071`.
   Voraussetzung: GitHub-Zugangsdaten bzw. PAT (das Repository ist privat).
4. Kontrolle: `git rev-parse origin/main` muss anschließend `1b8d071` ergeben.

### Schritt 4 — Dokumentation und Branding in getrennten Commits bzw. Branches sichern

Die 6 geänderten Dateien plus `app/public/branding/wus-technik.svg` gehören inhaltlich zusammen
(Logo, Login-Seite, Manifest, Designtokens) und sind **nicht** Teil von AP9–AP11. Vorschlag:

1. Eigener Branch: `git switch -c feat/ap8.1-branding` (nach dem Push von `main`).
2. Ein Commit mit klarer Zuordnung, z. B.
   `feat: apply W&S Technik branding (AP8.1)`, inklusive der neuen SVG.
3. Vor dem Merge nach `main`: `npm run lint`, `npx tsc --noEmit`, `npx next build` — die Änderungen
   berühren `globals.css`, `layout.tsx` und `manifest.ts` und damit den Build.
4. `Willkommen.md` ist eine Obsidian-Datei ohne Codebezug — separat committen oder mitnehmen, aber
   im Commit-Text erwähnen.

**Nicht empfohlen:** die Änderungen mit einem fachlichen AP zusammen committen. Sie sind seit AP9
bewusst getrennt gehalten worden; das sollte so bleiben.

Die beiden neuen Dokumente (`ARCHITEKTEN_UEBERSICHT.md`, dieses Dokument) sind Dokumentation und
sollten in einem eigenen `docs:`-Commit landen, nicht im Branding-Commit.

### Schritt 5 — Standortentscheidung: Vault bleibt alleiniger Arbeitsort (überholt Version 1.8)

> **AUFGEHOBEN durch Dennis am 2026-07-26.** Der nachfolgend beschriebene Umzug aus OneDrive
> wurde 2026-07-25 entschieden und 2026-07-26 als Clone `C:\dev\Kabelbereitschaft` ausgeführt,
> ist als Standortentscheidung aber **ausdrücklich zurückgenommen**. Verbindlich gilt: einziger
> Projekt- und Arbeitsort ist der Kabelbereitschaft-Vault
> `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`.
> Der Dev-Clone wird über den Windows-Papierkorb entfernt. Das bekannte Risiko von
> Git-Schreiboperationen in OneDrive bleibt bewusst akzeptiert und wird transparent geführt
> (Schutzmaßnahmen: Vollsicherung, Git-Bundle, GitHub-Remote, Lockprüfung). **Solange Dennis
> diese Entscheidung nicht ausdrücklich ändert, wird kein erneuter Umzug aus OneDrive
> vorgeschlagen.** Der folgende Text bleibt als Historie erhalten.

**Entschieden (2026-07-25, inzwischen aufgehoben):** Dokumentation und App bleiben zunächst in
einem **gemeinsamen Repository**. Das vollständige Repository wird aus OneDrive in einen
**lokalen, nicht synchronisierten Pfad** verlagert (z. B. `C:\dev\Kabelbereitschaft\`). ADR 1
(„App-Code im Unterordner `app/` des Vaults") wird dadurch **nicht aufgehoben**.

Der **frische Clone ist die bevorzugte Bereinigung** — alle Altlasten in `.git` entfallen damit
automatisch, ohne dass im alten Repository etwas gelöscht werden muss:

1. Push aus Schritt 3 muss erfolgreich sein; Doku- und Branding-Commits/-Branch aus Schritt 4
   ebenfalls gepusht.
2. `git clone https://github.com/DKuehnhold/Kabelbereitschaft.git C:\dev\Kabelbereitschaft`
3. Vergleich: `git log --oneline -5` und `git status` im neuen Clone müssen dem alten Stand
   entsprechen; zusätzlich `app/.env.local` (nicht versioniert) manuell übernehmen.
4. **Das alte Repository bleibt zunächst vollständig als Sicherung erhalten**, wird aber
   **umbenannt** (z. B. `Kabelbereitschaft-App_ALT_2026-07-25`), damit nicht versehentlich
   weitergearbeitet wird.
5. Erst nach mindestens einem erfolgreichen Arbeitszyklus im neuen Pfad den Altordner archivieren.
6. Der Ordner ist zugleich ein Obsidian-Vault: nach dem Umzug den Vault in Obsidian auf den neuen
   Pfad zeigen lassen.

**Ausdrücklich nicht vorgesehen:** `git gc`, `repack` oder manuelles Löschen von Objekten,
dangling Commits oder `tmp_obj_*` im alten OneDrive-Ordner. Die Lock-Entfernung aus Schritt 2 dient
nur dazu, das Repository für Bundle und Push wieder schreibfähig zu machen.

---

# Teil B — Roadmap AP12–AP15

## B.1 Zuordnung der 14 Entscheidungen (Stand 2026-07-25)

Aus `ARCHITEKTEN_UEBERSICHT.md` §8. „V" = zwingende Vorentscheidung, die **vor** dem jeweiligen AP
getroffen sein muss.

| # | Thema | Zuordnung / Status |
|---|---|---|
| 1 | Roadmap AP12–AP15 | **V0 — Planungsgrundlage seit 2026-07-25 unter Auflagen freigegeben; AP12-Implementierung am 2026-07-27 durch Dennis ausdrücklich freigegeben und in Umsetzung** |
| 13 | Repository-Ort | **Neu entschieden (2026-07-26):** gemeinsames Repository und ausschließliche Arbeit im Kabelbereitschaft-Vault; temporären C:-dev-Clone nach Abschlusskontrolle entfernen; OneDrive-Risiko bekannt und akzeptiert |
| 8 | Aufbewahrungsfristen GPS/Audit | **V1 — OFFEN, wirkt als Produktionssperre.** Fristen werden nicht technisch erfunden. Bis zur fachlichen/datenschutzrechtlichen Entscheidung: Stage und Test **nur mit synthetischen Personen-, EXIF- und GPS-Daten**; produktiver Datenanfall gesperrt. Dokumentation in AP14; technische Löschroutinen erst nach RC1 |
| 4 | Offline-Scope (Neuanlage, Offline-Liste) | **V2 — entschieden:** Offline-Neuanlage vollständiger Vorgänge und vollständige Offline-Vorgangsliste gehören **nicht** zu RC1; eigenes Ausbaupaket nach RC1. Bestehende Offline-Funktionen (Outbox, Synchronisation, Bilder) bleiben Bestandteil der AP14-Abnahme |
| 10 | `technicians` ↔ `profiles` / SSO | **V3 — entschieden:** `technicians.profile_id` bleibt bis RC1 eine optionale, informative Zuordnung; keine zwingende Login-, SSO- oder Identitätskopplung in AP12 |
| 7 | Rate Limiting | **V4 — entschieden (Grundsatz):** bevorzugt auf Hosting-, Edge- oder Reverse-Proxy-Ebene; endgültige Umsetzung nach Wahl der Zielplattform in AP14 |
| 9 | `contacts` ↔ Vorgänge | **AP12** — Zugriffs- und Historisierungsregeln entschieden (1.2, siehe B.2/B.7) |
| 11 | Kabelpositionen: Menge/Zustand, mehrere Positionen | **AP12** — Datenmodell entschieden (1.2): `quantity_value`/`quantity_unit` und `condition_code` (siehe B.2/B.7) |
| 12 | Pflege-UI Bereitschaftsnummern | **AP12** |
| 2 | Echtes Aufgaben-/Hinweismodell | **AP13** |
| 3 | Auditierbare Massenaktionen | **AP13** |
| 5 | `middleware` → `proxy` | **AP14** (verlangt volle E2E-Abdeckung) |
| 6 | CSP durchsetzend | **AP14** — erst nach Auswertung über einen CSP-Report-Endpunkt |
| 14 | Tag/Release `v1.0.0-rc.1` | **AP15** — gesonderte, ausdrückliche Entscheidung durch Dennis |

Zusätzlich aus §10 der Architektenübersicht: die **Konsolidierung der doppelten Steuerungsdokumente**
(zwei `PROJEKTSTATUS.md`, zwei `CHANGELOG.md`, `BACKUP.md` / `BACKUP_UND_RECOVERY.md`, fehlender
AP8-Bericht, `_sandbox_write_test`) wird **geteilt (Entscheidung 2026-07-25):**

- **vor Beginn von AP12 (verbindliche Auflage):** die führenden Statusdokumente eindeutig
  kennzeichnen und auf den tatsächlichen Projektstand bringen. Veraltete Dubletten **nicht löschen**,
  sondern deutlich als „historisch" bzw. „abgelöst" markieren;
- **AP15:** endgültige Konsolidierung und kontrollierte Archivierung.

**Nach RC1 (bewusst nicht eingeplant):** Offline-Ausbaupaket gemäß V2 (Offline-Neuanlage
vollständiger Vorgänge, vollständige Offline-Vorgangsliste), Kartenansicht der GPS-Standorte,
Background-Sync/Push, granularer Upload-Fortschritt je Datei, Bereinigungsprozess für soft-gelöschte
Storage-Objekte, Lighthouse-PWA-Audit, WebCrypto, Login-/SSO-Kopplung `technicians` ↔ `profiles`,
technische Löschroutinen für Aufbewahrungsfristen.

---

## B.2 AP12 — Vorgangsdetail und fehlende fachliche Verknüpfungen

**Ziel und fachlicher Nutzen.** Der Vorgang wird zur vollständigen fachlichen Akte. Heute sind die in
AP9 angelegten Stammdaten nur teilweise angebunden: Ansprechpartner stehen als Freitext-Snapshot im
Vorgang, Kabelpositionen kennen keine Menge und keinen Zustand, und für Bereitschaftsnummern gibt es
überhaupt keine Pflegeoberfläche. Für Disposition und Nachweisführung heißt das: Daten müssen
doppelt gepflegt oder außerhalb des Systems nachgehalten werden.

**Verbindlicher Umfang.**

1. Vorgangsdetailseite (`/vorgaenge/[id]`) überarbeiten: konsolidierte Sicht auf Stammdaten,
   Kabelpositionen, Material, Bilder, Chronik.
2. `contacts` ↔ Vorgang verknüpfen: Auswahl echter Ansprechpartner (mit Telefonnummern) statt
   Freitext; Bestandsdaten behalten ihren Snapshot als Fallback.
3. `incident_cable_positions` um **Menge** (`quantity_value` + `quantity_unit`) und
   **Zustandsbewertung** (`condition_code`) je Position erweitern; mehrere Positionen je Vorgang
   vollständig unterstützen (Anlegen, Ändern, Entfernen).
4. Pflege-UI für `on_call_numbers` (CRUD, `is_active`), analog zu den AP9-Stammdatenseiten.
5. Zuordnung Monteur ↔ `technicians` in der Anzeige vereinheitlichen (ohne Login-Kopplung).

**Ausdrücklich ausgeschlossen.** Aufgaben-/Hinweismodell (AP13). Massenaktionen (AP13).
Offline-Neuanlage (gemäß V2: nach RC1). SSO/Login-Kopplung `technicians` ↔ `auth.users` (nach RC1,
gemäß V3). Dashboard-Umstellung (AP15). Kartenansicht der GPS-Daten (nach RC1).

**Architektur- und Datenmodellentscheidungen.**

- Verknüpfung als **nullable FK** `incidents.contact_id` → `contacts(id)`. Historische Kontaktdaten
  dürfen **nicht durch spätere Stammdatenänderungen unbemerkt verfälscht** werden: deshalb FK
  (aktueller Bezug) **plus dokumentierter Snapshot** der zum Vorgangszeitpunkt gültigen Kontaktdaten
  oder eine gleichwertige Historisierung. Der bestehende Freitext-Snapshot bleibt erhalten und wird
  nicht migriert (Nachvollziehbarkeit historischer Vorgänge).
- Menge/Zustand **auf der Position**, nicht am Vorgang — konsistent zur AP10-Entscheidung gegen
  `incidents.cable_type_id`. **Entschieden (1.2):**
  - Menge getrennt modelliert als **`quantity_value numeric(12,3)`** + **`quantity_unit text`**;
    zulässige Einheiten **`piece`** und **`meter`**; Wert muss **größer als 0** sein; bei `piece`
    sind nur **ganze Werte** zulässig.
  - Zustand als **`condition_code`** mit dokumentiertem Wertebereich: **`ready`** (einsatzbereit),
    **`restricted`** (eingeschränkt einsatzbereit), **`damaged`** (beschädigt), **`unusable`**
    (nicht einsatzbereit). Absicherung durch **Check-Constraint, kein PostgreSQL-Enum**.
  - **Bestandsdatensätze dürfen `NULL` behalten** (Anzeige als „nicht erfasst"); **kein
    automatischer Backfill**. Neue oder bearbeitete Positionen benötigen Wert, Einheit und einen
    gültigen `condition_code`.
  - **Ergänzt (1.3) — NULL-Regel in der Datenbank:** `quantity_value` und `quantity_unit` müssen
    **entweder beide `NULL` oder beide gesetzt** sein; Teilzustände (Wert ohne Einheit, Einheit
    ohne Wert) sind unzulässig. Sind beide gesetzt, gilt: `quantity_value > 0`,
    `quantity_unit IN ('piece', 'meter')`, bei `piece` muss `quantity_value` ganzzahlig sein.
  - **Ergänzt (1.3) — Bearbeitungsregel in den RPCs:** Die Datenbank allein kann nicht erkennen,
    ob eine historische Position fachlich bearbeitet wurde. Deshalb: `create_incident_ap12`
    verlangt für **jede neue** Position `quantity_value`, `quantity_unit` und `condition_code`;
    `update_incident_ap12` verlangt diese Felder für **jede neu angelegte oder fachlich
    veränderte** Position. **Unverändert übernommene historische Positionen dürfen weiterhin
    `NULL` enthalten.** Die RPC muss zwischen unverändert übernommenen und fachlich veränderten
    Positionen eindeutig unterscheiden.
- Schreibpfade weiter über transaktionale RPCs, aber die AP10-RPCs werden **nicht durch
  Signaturänderungen überladen**: neue versionierte RPCs **`create_incident_ap12`** /
  **`update_incident_ap12`** (`SECURITY INVOKER`). **Korrigiert (1.3) — kein ausführbarer
  Altpfad:** `create_incident_ap10` / `update_incident_ap10` dürfen als **Datenbankobjekte**
  zunächst bestehen bleiben; beim AP12-Cutover werden jedoch ihre **`EXECUTE`-Rechte für die
  Anwendungsrollen entzogen**. Neue Schreibzugriffe erfolgen ausschließlich über die
  `*_ap12`-RPCs. Alternativ wäre nur zulässig, dass die AP10-RPCs intern dieselben
  AP12-Validierungen erzwingen; **bevorzugt wird der Rechteentzug**. Es darf keinen ausführbaren
  Altpfad geben, über den neue oder bearbeitete Kabelpositionen ohne Menge, Einheit oder Zustand
  gespeichert werden können. Die Umstellung erfolgt **atomar mit der Auslieferung der neuen
  Anwendung**.
- Keine neue Auditlösung: `tg_audit` bleibt die einzige (AP9-Entscheidung).
- Zuordnung Monteur ↔ `technicians` gemäß V3: rein informative Anzeige, keine Login-Kopplung.

**Abhängigkeiten und Voraussetzungen.** V0 unter Auflagen erteilt — die Implementierungsfreigabe
für AP12 steht noch aus. V3 ist entschieden (informative Zuordnung); Menge/Einheit,
`condition_code` und der Monteur-Kontaktzugriff sind fachlich entschieden (Version 1.2). Vor
Beginn: **alle Punkte der AP12-Startfreigabe-Checkliste (B.8) abgearbeitet.** Fachlich: reale
Bereitschaftsnummern und Ansprechpartner müssen geliefert werden, sonst ist die Oberfläche nicht
abnehmbar (steht als offener Punkt beim Auftraggeber).

**Akzeptanzkriterien.**

- Ein Vorgang kann mit ≥ 2 Kabelpositionen inklusive Menge (`quantity_value` + `quantity_unit`)
  und Zustand (`condition_code`) angelegt und geändert werden.
- Validierung wirksam: `quantity_value` und `quantity_unit` beide `NULL` oder beide gesetzt —
  Teilzustände (Wert ohne Einheit, Einheit ohne Wert) werden abgewiesen; wenn gesetzt: Wert > 0,
  nur `piece`/`meter`, bei `piece` nur ganze Werte; nur gültige `condition_code`-Werte;
  Bestandspositionen mit `NULL` werden als „nicht erfasst" angezeigt.
- Ein zugewiesener Monteur sieht über die minimierte Projektion ausschließlich Vorgangs-ID,
  Kontaktname, Funktion/Rolle und die ausgewählte operative Telefonnummer des Vorgangskontakts;
  auf fremde Vorgänge, die Kontaktliste und die Kontaktpflege hat er keinen Zugriff, und er erhält
  **weder direkt noch über die Projektion** weitere Kontaktspalten oder Telefonnummern (Nachweis
  über `is_assigned_to_incident()` und die View-/RPC-Definition).
- Ein Ansprechpartner aus `contacts` ist auswählbar. Anzeige präzisiert (1.3): **Staff** sieht die
  im Stammdatenpfad freigegebenen Kontaktinformationen; der **zugewiesene Monteur** sieht
  ausschließlich die ausgewählte operative Snapshot-Telefonnummer.
- Nach dem AP12-Cutover können Anwendungsrollen `create_incident_ap10` / `update_incident_ap10`
  nicht mehr aufrufen (Smoke-Nachweis); es existiert kein ausführbarer Altpfad, der neue oder
  bearbeitete Positionen ohne Menge, Einheit oder Zustand speichert.
- Bestandsvorgänge ohne `contact_id` bleiben vollständig lesbar (Snapshot sichtbar).
- Eine nachträgliche Änderung der Kontakt-Stammdaten verändert die im Vorgang dokumentierten
  historischen Kontaktdaten nicht (Snapshot-/Historisierungsnachweis).
- Bereitschaftsnummern sind über die Oberfläche pflegbar; Deaktivierung wirkt in der Auswahl.
- RLS unverändert wirksam: Monteur sieht nur zugewiesene Vorgänge (Nachweis im Smoke-Test).
- `lint` = 0, `tsc` = 0, `next build` = PASS, alle Bestands-Smokes 10–16 unverändert grün.

**Migrationen.** `0010_ap12_incident_details.sql` — additiv/idempotent: `incidents.contact_id`
(nullable FK) inklusive Snapshot-/Historisierungsregel; `incident_cable_positions.quantity_value
numeric(12,3)` + `quantity_unit text` (Check-Constraints: **beide `NULL` oder beide gesetzt**;
wenn gesetzt: Wert > 0, Einheit in `piece`/`meter`, bei `piece` ganzzahlig) und `condition_code`
(Check-Constraint auf `ready`/`restricted`/`damaged`/`unusable`, **kein** PostgreSQL-Enum); neue
RPCs `create_incident_ap12` / `update_incident_ap12` (mit eindeutiger Unterscheidung zwischen
unverändert übernommenen und fachlich veränderten Positionen); minimierte
`security_invoker`-Projektion (View oder RPC) für den Monteur-Kontaktzugriff über
`is_assigned_to_incident()` — **kein direktes `SELECT`-Grant** auf `contacts` /
`contact_phone_numbers` für Monteure; RLS-Ergänzung für `on_call_numbers` auf `is_staff()`;
**`REVOKE EXECUTE`** auf `create_incident_ap10` / `update_incident_ap10` für die Anwendungsrollen
beim Cutover, **atomar mit der Auslieferung der neuen Anwendung**. **Kein** `NOT NULL` auf
Bestandsspalten, **kein** automatischer Backfill, **kein** `DELETE` von Altdaten, **keine**
Änderung der AP10-RPC-Signaturen.

**Sicherheit / Datenschutz / Offline / Audit.**

- Datenschutz: `contacts` und `contact_phone_numbers` sind personenbezogen. **Entschieden (1.2),
  technisch präzisiert (1.3):** Pflege der Stammdaten (Anlegen, Ändern, Deaktivieren)
  ausschließlich über `is_staff()`. **RLS begrenzt Zeilen, nicht die sichtbaren Spalten** — eine
  RLS-Regel auf `contacts` reicht deshalb nicht aus. Monteure erhalten **kein direktes
  `SELECT`-Recht** auf `contacts` oder `contact_phone_numbers`. Der Zugriff erfolgt über eine
  **explizit minimierte `security_invoker`-View oder eine gleichwertige SECURITY-INVOKER-RPC**,
  die ausschließlich **Vorgangs-ID, Kontaktname, Funktion/Rolle und die ausgewählte operative
  Telefonnummer** ausgibt — und nur dann, wenn **`is_assigned_to_incident()`** für den aktuellen
  Benutzer und Vorgang erfüllt ist. Weitere Kontaktfelder und weitere Telefonnummern dürfen nicht
  ausgegeben werden. Staff verwendet für Pflege und vollständige Anzeige den bestehenden
  staff-geschützten Stammdatenpfad. FK plus Snapshot: spätere Stammdatenänderungen verändern
  historische Vorgänge nicht rückwirkend.
- Offline: bestehende Offline-Funktionen müssen regressionsfrei bleiben; **keine** Erweiterung der
  Outbox in AP12.
- Audit: neue Felder werden von `tg_audit` feldgenau erfasst (kein Zusatzaufwand, aber zu verifizieren).

**Erforderliche Tests.** Neuer Smoke `17_ap12_details.sql`:

- Positionen mit Menge/Einheit und `condition_code` inklusive Constraint-Verletzungen —
  ausdrücklich abzudecken (1.3): **Teil-NULL** (Wert ohne Einheit, Einheit ohne Wert),
  **ungültige Einheit**, **nicht ganzzahlige Stückzahl** bei `piece`, **ungültiger Zustandscode**
  sowie die **Bearbeitung einer historischen NULL-Position** (muss Menge, Einheit und Zustand
  verlangen); unverändert übernommene historische NULL-Positionen bleiben zulässig.
- Contact-FK + Snapshot; RLS auf `on_call_numbers`; Auditfelder.
- **AP10-Altpfad:** Nachweis, dass Anwendungsrollen `create_incident_ap10` /
  `update_incident_ap10` nach dem Cutover nicht mehr aufrufen dürfen.
- **Kontaktzugriff mit drei Benutzerprofilen** (zugewiesener Monteur, fremder Monteur, nicht
  berechtigter Benutzer); zusätzlich Nachweis, dass ein Monteur **weder direkt noch über die
  Projektion** weitere Kontaktspalten oder weitere Telefonnummern erhält.

Regression 11/13/14/15/16. E2E-Spec `incidents.spec.ts` erweitern (@app, lauffähig erst mit
Test-Supabase → wird in AP14 nachgeholt).

**Abbruch- / Freigabekriterien.** Abbruch, wenn die neuen `*_ap12`-RPCs nicht einführbar sind,
ohne Bestandsvorgänge zu brechen, oder wenn der `EXECUTE`-Entzug der AP10-RPCs nicht atomar mit
der Auslieferung der neuen Anwendung erfolgen kann — dann Rücklauf in die Architekturklärung.
Freigabe durch Dennis auf Basis von Umsetzungsbericht + Smoke-Ergebnissen.

---

## B.3 AP13 — Aufgaben-/Hinweismodell und auditierbare Massenaktionen

**Ziel und fachlicher Nutzen.** Aus abgeleiteten Hinweisen wird ein steuerbares Arbeitsmittel.
Heute berechnet die Liste „offene Hinweise" aus dem Vorgangszustand — niemand ist zuständig, nichts
ist quittierbar, nichts hat eine Frist. Gleichzeitig sind die Massenaktionen in der Liste sichtbar,
aber deaktiviert; die Disposition muss Vorgänge einzeln anfassen.

**Verbindlicher Umfang.**

1. Aufgaben-/Hinweismodell: eigene Tabelle mit Typ, Zuständigkeit, Fälligkeit, Quittierung
   (wer/wann), Bezug auf `incidents`.
2. Ableitungsregeln der bisherigen Hinweise in **echte, persistierte** Einträge überführen; Erzeugung
   serverseitig und idempotent.
3. Anzeige in Liste und Vorgangsdetail; Filter „hat offene Aufgabe".
4. Massenaktionen aktivieren: **Status ändern** und **Monteur zuweisen** über Bulk-Server-Actions.
5. Vollständige Auditierung und Konfliktbehandlung der Massenaktionen.

**Ausdrücklich ausgeschlossen.** Benachrichtigungen (E-Mail/Push). Eskalationsstufen und SLA-Logik.
Freie Aufgaben ohne Vorgangsbezug. **Offline-Bearbeitung von Aufgaben — für RC1 ausgeschlossen
(V2 entschieden).** Dashboard-Integration (AP15).

**Architektur- und Datenmodellentscheidungen.**

- Neue Tabelle `incident_tasks` (Arbeitstitel) mit Enum-Typ; **keine** Erweiterung von
  `incident_notes` (das sind unveränderbare Chronikeinträge — Grundsatz aus ADR 7).
- Zuständigkeit passend zu V3: Zuweisung bevorzugt an **`profiles`**, Teams oder Rollen — **keine**
  zwingende Kopplung an `technicians`.
- Aufgaben sind **veränderbar** (Quittierung), ihre Zustandsänderungen werden über `tg_audit`
  protokolliert. Die Chronik bleibt unveränderbar; Aufgaben sind ein zweites, klar getrenntes Konzept.
- Massenaktionen unterscheiden klar zwischen **Gesamtauftrag** (der ausgewählten Menge) und
  **Einzeltransaktionen** (je Vorgang). Teilerfolg erfordert kontrollierte Einzeltransaktionen oder
  eine entsprechend entworfene Datenbankfunktion — keine einzelne Sammeltransaktion, die bei einem
  Fehler alles verwirft oder einen inkonsistenten Zwischenstand hinterlässt. Ergebnis als
  Teilerfolgsbericht („x von y geändert, z abgelehnt"). **Keine** stille Überschreibung: Vorgänge,
  die sich seit dem Laden geändert haben (`updated_at`), werden abgelehnt und benannt — dasselbe
  Prinzip wie in der Offline-Konfliktbehandlung.
- Jede Einzeländerung bleibt separat auditierbar. Statuswechsel laufen ausschließlich über die
  bestehenden Trigger/Guards (`tg_incident_status_history`, `tg_incident_guard`) — die Massenaktion
  umgeht **weder RLS noch Status-Guards noch Chroniktrigger**.
- Keine Service-Role: Massenaktionen wirken unter der Benutzersession, RLS entscheidet.

**Abhängigkeiten und Voraussetzungen.** AP12 abgeschlossen (Detailseite als Anzeigeort). **V2 ist
entschieden:** AP13 ist online-only; Aufgaben werden **nicht** in die Outbox aufgenommen und
`sync_actions` wird nicht erweitert. Bestehende Offline-Funktionen müssen regressionsfrei bleiben.

**Akzeptanzkriterien.**

- Eine Aufgabe kann erzeugt, zugewiesen, quittiert und nicht gelöscht werden (nur Statuswechsel).
- Die bisherigen abgeleiteten Hinweise sind vollständig durch persistierte Aufgaben abgedeckt;
  keine doppelte Anzeige.
- Massenaktion über ≥ 20 ausgewählte Vorgänge: alle Berechtigten geändert, nicht Berechtigte
  abgelehnt und benannt, je Vorgang ein Chronik- und ein Auditeintrag.
- Ein zwischenzeitlich fremdgeänderter Vorgang wird abgelehnt, nicht überschrieben.
- Monteur kann keine Massenaktion ausführen (RLS + UI).
- `lint` / `tsc` / `build` grün; Smokes 10–17 unverändert grün.

**Migrationen.** `0011_ap13_tasks_bulk.sql` — `incident_tasks` + Enum, Indizes, RLS
(`is_staff()` schreibend, Monteur lesend auf zugewiesene Vorgänge), `tg_audit`-Anbindung,
optional Bulk-RPC. Additiv/idempotent.

**Sicherheit / Datenschutz / Offline / Audit.**

- Sicherheit: höchstes Missbrauchspotenzial des Projekts (Massenänderung). Rechteprüfung
  ausschließlich serverseitig; Obergrenze je Aufruf (Vorschlag 200 Vorgänge, analog zum CSV-Cap 5.000).
- Audit: **jede** Einzeländerung einer Massenaktion muss einzeln auditiert sein — keine
  Sammelbuchung, sonst ist die Nachvollziehbarkeit verloren.
- Datenschutz: Zuständigkeiten sind Personendaten; Anzeige auf `is_staff()` begrenzen.
- Offline: gemäß V2 für RC1 ausgeschlossen — AP13 bleibt online-only; bestehende Offline-Funktionen
  unverändert (Regressionsnachweis erforderlich).

**Erforderliche Tests.** Smoke `18_ap13_tasks.sql` (Lebenszyklus, RLS, Audit je Änderung,
Idempotenz der Ableitung). Bulk-Test mit Konfliktfall und Teilerfolg. Regression aller Vorgänger-Smokes.
E2E: Auswahl + Bulk in `incidents.spec.ts` (@app).

**Abbruch- / Freigabekriterien.** Abbruch, wenn Massenaktionen ohne Einzelaudit oder ohne
Konfliktprüfung umsetzbar wären — dann Rücklauf. Freigabe durch Dennis; die Massenaktionen bleiben
bis zur Freigabe deaktiviert.

---

## B.4 AP14 — Reale Supabase-, Browser-, Offline-, Sicherheits- und Betriebsabnahme

**Ziel und fachlicher Nutzen.** Der Nachweis, dass die Anwendung tatsächlich funktioniert. Alle
bisherigen Freigaben beruhen auf Build- und Datenbankprüfungen; Upload, signierte URLs,
Offline-Reconnect, Konflikt-UI, Installation und Rollenwechsel sind **nie im Browser gelaufen**.
Ohne dieses AP ist RC1 nicht verantwortbar.

**Verbindlicher Umfang.**

1. Supabase-Projekt (Stage) bereitstellen; Migrationen 0001–0011 einspielen; Administrator anlegen;
   Baustufen- und VzG-Stammdaten laden. **Auflage aus V1: Stage und automatisierte Tests verwenden
   bis zur V1-Entscheidung ausschließlich synthetische Personen-, EXIF- und GPS-Daten; produktiver
   Datenanfall bleibt gesperrt.**
2. Zweites Supabase-Projekt oder Schema als **Test-Instanz** für die `@app`-E2E; Testbenutzer je Rolle.
3. CI erweitern: `playwright install --with-deps chromium`, `@app`-Suite scharfschalten.
4. Vollständige E2E-Abnahme: Auth, Rollen, Vorgänge, Material, Bilder (Upload/EXIF/signierte URLs),
   CSV-Download, Liste/Filter/Pagination, Massenaktionen, a11y (axe im Browser).
5. Offline-Abnahme im Browser: Installation, Cache, Offline-Erfassung, Reconnect-Sync, Idempotenz,
   Konflikt-UI, SW-Update, Benutzerwechsel/Datentrennung.
6. Sicherheit: **CSP-Report-Endpunkt** (oder eine andere nachvollziehbare Auswertungsmethode)
   einrichten, Reports auswerten und **erst danach** CSP von Report-Only auf durchsetzend schalten;
   Sicherheitsheader verifizieren, Upload-Härtung (Typ-/Größen-Whitelist, Hash) prüfen;
   Rate Limiting gemäß V4 bevorzugt auf Hosting-, Edge- oder Reverse-Proxy-Ebene — endgültige
   Festlegung nach Wahl der Zielplattform.
7. `middleware` → `proxy`-Migration (Next 16) inklusive vollständigem E2E-Nachweis.
8. Betrieb: Deployment auf die Zielinfrastruktur, Backup/Recovery-Test, Monitoring, Health-Check,
   Performance-Messung an realen Datenmengen.
9. **Dokumentation** der Aufbewahrungsfristen gemäß V1 (Entscheidung Dennis/Recht) in
   `07-Betrieb/DATENSCHUTZ.md`.

**Ausdrücklich ausgeschlossen.** Neue Fachfunktionen. Technische Löschroutinen für Aufbewahrungsfristen
(nach RC1). Lighthouse-PWA-Audit als Freigabekriterium. Background-Sync/Push.

**Architektur- und Datenmodellentscheidungen.** Keine geplanten Modelländerungen — AP14 ist ein
Abnahme-AP. Ausnahme: `middleware` → `proxy` ändert den Auth-Session-Pfad und ist damit strukturell.
Falls die Abnahme Fehler aufdeckt, entstehen Korrekturen als eigene, benannte Findings mit ggf.
Migration `0012_ap14_findings.sql`.

**Abhängigkeiten und Voraussetzungen.** **Alles hängt an der Infrastruktur.** Ohne Supabase-Projekt,
Testinstanz und Zielumgebung ist AP14 nicht startfähig — das ist die kritische
Beschaffungsabhängigkeit der gesamten Roadmap. V4 ist dem Grundsatz nach entschieden
(Hosting-/Edge-/Proxy-Ebene); die konkrete Umsetzung folgt der Plattformwahl in AP14. V1 bleibt
offen und sperrt ausschließlich den produktiven Datenanfall — die AP14-Abnahme ist mit
synthetischen Daten vollständig durchführbar.

**Akzeptanzkriterien.**

- Alle E2E-Tests (`@public` **und** `@app`) laufen in der CI grün, einschließlich a11y.
- Offline-Zyklus im Browser vollständig nachgewiesen: offline erfassen → Reconnect → keine Dublette
  (Idempotenz) → Konflikt korrekt angezeigt und auflösbar.
- Bildupload im Browser: Vorschau, EXIF/GPS, signierte URL, Soft-Delete, Chronikeintrag.
- CSP-Report-Endpunkt (oder gleichwertige Auswertung) in Betrieb; CSP durchsetzend aktiv, keine
  funktionalen Verstöße in den Reports.
- Deployment reproduzierbar; Recovery aus Backup erfolgreich getestet.
- `middleware`→`proxy` migriert, E2E unverändert grün.
- Aufbewahrungsfristen sind gemäß V1-Entscheidung **dokumentiert** (nicht erfunden) und
  freigegeben; solange V1 offen ist, bleibt der produktive Datenanfall gesperrt.

**Migrationen.** Keine geplant. Nur reaktiv aus Findings.

**Sicherheit / Datenschutz / Offline / Audit.** Dies ist das Sicherheits-AP: CSP (mit
Report-Endpunkt vor der Durchsetzung), Header, Upload-Härtung, Rate Limiting (V4), Rollentrennung
im echten Browser, Datentrennung im Offline-Speicher. Die Offline-Abnahme (Outbox, Synchronisation,
Bilder) bleibt gemäß V2 Bestandteil von AP14. Datenschutz: **V1 wirkt als Produktionssperre** —
Aufbewahrungsfristen werden nicht technisch erfunden; bis zur fachlichen bzw.
datenschutzrechtlichen Entscheidung verwenden Stage und Tests ausschließlich synthetische
Personen-, EXIF- und GPS-Daten, produktiver Datenanfall ist gesperrt. Die Fristen aus V1 müssen
vor dem produktiven Datenanfall entschieden sein, nicht danach.

**Erforderliche Tests.** Vollständige Playwright-Suite im Browser; axe-Läufe; manuelle Checkliste
für PWA-Installation und SW-Update; Recovery-Test; Lastmessung (Vorschlag: 5.000 Vorgänge gegen die
Listen-View, da der CSV-Cap dort liegt).

**Abbruch- / Freigabekriterien.** Abbruch bei einem sicherheitsrelevanten Fund (Rechteumgehung,
Datenleck über signierte URLs, Rollenverwechslung) — Rücklauf vor jeder weiteren Arbeit. Freigabe nur
mit vollständigem Testprotokoll; „nicht ausführbar" ist in AP14 **kein** akzeptables Ergebnis mehr.

---

## B.5 AP15 — Dashboard auf die operative Liste umstellen und RC1 vorbereiten

**Ziel und fachlicher Nutzen.** Ein konsistenter Einstieg und ein freigabefähiger Release-Kandidat.
Das Dashboard nutzt bis heute die alte Tabellenabfrage, während `/vorgaenge` serverseitig über
`incident_list_view` arbeitet — zwei Wege zu denselben Daten mit unterschiedlichem Verhalten.

**Verbindlicher Umfang.**

1. Dashboard-Kennzahlen und -Listen auf `incident_list_view` bzw. die `incident-list`-Reads umstellen.
2. Rollenspezifische Dashboards (Disponent/Admin, Monteur) inklusive Aufgaben aus AP13.
3. Alte, dann ungenutzte Reads entfernen — **eine** Leseschicht für Vorgangslisten (Vermeidung der
   Doppelführung).
4. **Endgültige** Konsolidierung der Steuerungsdokumentation und **kontrollierte Archivierung**
   (die Kennzeichnung der führenden Dokumente und die Statusaktualisierung erfolgen bereits als
   Auflage **vor AP12**, siehe B.1): eine führende `PROJEKTSTATUS.md`, eine führende
   `CHANGELOG.md`, eine führende Backup-Doku, AP8-Bericht ergänzen oder Fehlen begründen,
   `_sandbox_write_test` entfernen, `README.md` auf Migrationen 0001–00xx korrigieren. Die vor AP12
   als „historisch/abgelöst" markierten Dubletten werden erst hier kontrolliert archiviert.
5. RC1: Release-Checkliste abarbeiten, Release-Notes finalisieren, Tag `v1.0.0-rc.1` **nach
   ausdrücklicher Freigabe**.

**Ausdrücklich ausgeschlossen.** Neue Fachfunktionen. Benachrichtigungen. Kartenansicht. Alles, was
in „nach RC1" verschoben ist.

**Architektur- und Datenmodellentscheidungen.**

- Genau **eine** Leseschicht für Vorgangslisten (Single Source of Truth auf Code-Ebene). Das ist die
  eigentliche Architekturleistung dieses AP.
- Dashboard-Aggregate möglichst in der Datenbank (View oder Count-Queries), nicht in der Anwendung —
  konsistent zur AP11-Entscheidung gegen N+1.
- Falls eine eigene Kennzahlen-View nötig wird: `security_invoker`, damit RLS greift.

**Abhängigkeiten und Voraussetzungen.** AP13 (Aufgaben für das Dashboard) und **AP14 abgeschlossen**
— ein RC ohne bestandene reale Abnahme ist nicht sinnvoll. Für den Tag zusätzlich die Git-Maßnahmen
aus Teil A (Push, Branding, Umzug).

**Akzeptanzkriterien.**

- Dashboard und `/vorgaenge` liefern für identische Filter identische Zahlen.
- Keine doppelte Leseimplementierung mehr im Code (nachweisbar durch entfernte Module).
- Monteur-Dashboard zeigt ausschließlich eigene Vorgänge und Aufgaben (RLS-Nachweis).
- Dokumentenlage konsistent: je Thema genau ein führendes Dokument.
- Release-Checkliste vollständig abgearbeitet; Release-Notes entsprechen dem tatsächlichen Stand.
- `lint` / `tsc` / `build` grün; vollständige E2E-Suite grün; alle Smokes grün.

**Migrationen.** Voraussichtlich keine. Falls eine Kennzahlen-View entsteht:
`0013_ap15_dashboard_view.sql`, additiv/idempotent.

**Sicherheit / Datenschutz / Offline / Audit.** Keine neuen Datenflüsse. Zu prüfen: das Dashboard
darf über Aggregate keine Vorgänge sichtbar machen, die RLS verbirgt (klassische Zählfalle) —
explizit zu testen. Offline-Dashboardkennzahlen bleiben unverändert. Kein Audit durch Lesezugriffe.

**Abbruch- / Freigabekriterien.** Abbruch, wenn Dashboard und Liste unterschiedliche Zahlen liefern
und die Ursache nicht eindeutig geklärt ist. Tag/Release ausschließlich nach ausdrücklicher Freigabe
durch Dennis.

---

## B.6 Reihenfolge und kritischer Pfad

```
V0 unter Auflagen erteilt — Implementierung noch nicht freigegeben
  ├─ Auflage vor AP12: führende Statusdokumente kennzeichnen + aktualisieren
  └─ Teil A: Vollsicherung → Locks → Bundle → Push AP9–AP11 → Doku/Branding → frischer Clone
       ├─ V3 ENTSCHIEDEN (informativ) ──→ AP12  (0010, RPCs *_ap12)
       │                                    └─ V2 ENTSCHIEDEN (online-only) ──→ AP13  (0011)
       │                                                                          │
       ├─ V1 Aufbewahrungsfristen (OFFEN — Produktionssperre) ──────────┐         │
       └─ V4 ENTSCHIEDEN (Ebene); Festlegung mit Plattformwahl ─────────┤         │
                                                                        ▼         ▼
                 Infrastruktur (Supabase Stage + Test) → AP14 (nur synthetische Daten)
                                                          │
                                                          ▼
                                        AP15 → RC1 (gesonderte Freigabe durch Dennis)
```

**Kritischer Pfad ist nicht die Entwicklung, sondern die Infrastruktur.** AP12 und AP13 lassen sich
lokal umsetzen und per SQL-Smoke prüfen; AP14 ist ohne Supabase-Projekt und Zielumgebung überhaupt
nicht startfähig. **Entschieden (1.2):** Die Beschaffung wird **ab sofort parallel zur
Repository-Stabilisierung und AP12-Vorbereitung** angestoßen. Bis zur V1-Entscheidung werden dabei
ausschließlich synthetische Daten verwendet.

---

## B.7 Entscheidungsstand (2026-07-25)

| ID | Entscheidung | Wer | Status |
|---|---|---|---|
| V0 | Roadmap AP12–AP15 | Dennis | **ENTSCHIEDEN (2026-07-25): unter Auflagen als Planungsgrundlage freigegeben; Implementierung noch nicht freigegeben** |
| — | Bereinigungsplan Teil A schrittweise freigeben | Dennis | **Offen** — Korrekturen aus Version 1.1 eingearbeitet; jeder Schritt einzeln freizugeben |
| V1 | **Aufbewahrungsfristen für GPS-/EXIF- und Auditdaten** — fachlich/datenschutzrechtlich festzulegen, technisch nicht erfindbar | Dennis, ggf. mit Rechtsberatung/DSB | **OFFEN — Produktionssperre.** Bis zur Entscheidung nur synthetische Personen-, EXIF- und GPS-Daten in Stage/Test; produktiver Datenanfall gesperrt |
| V2 | Offline-Scope (Neuanlage, Offline-Liste) | Dennis | **ENTSCHIEDEN:** nicht in RC1; eigenes Ausbaupaket nach RC1. Bestehende Offline-Funktionen (Outbox, Sync, Bilder) bleiben Teil der AP14-Abnahme |
| V3 | `technicians` ↔ `profiles` | Dennis | **ENTSCHIEDEN:** `profile_id` bleibt bis RC1 optionale, informative Zuordnung; keine Login-/SSO-/Identitätskopplung in AP12 |
| V4 | Rate Limiting | Dennis | **ENTSCHIEDEN (Grundsatz):** bevorzugt Hosting-/Edge-/Reverse-Proxy-Ebene; endgültige Umsetzung nach Plattformwahl in AP14 |
| — | Repository-Struktur / Arbeitsort | Dennis | **NEU ENTSCHIEDEN (2026-07-26):** gemeinsames Repository und ausschließliche Arbeit im Kabelbereitschaft-Vault; frühere C:-dev-Festlegung aufgehoben; kein Ersatzpfad ohne ausdrückliche Freigabe |
| — | Doku-Konsolidierung | Dennis | **ENTSCHIEDEN (geteilt):** Kennzeichnung + Statusaktualisierung vor AP12; endgültige Konsolidierung und Archivierung in AP15 |
| — | Zeitpunkt der Infrastruktur-Beschaffung | Dennis | **ENTSCHIEDEN (1.2):** ab sofort parallel zur Repository-Stabilisierung und AP12-Vorbereitung; bis zur V1-Entscheidung ausschließlich synthetische Daten |
| — | Menge/Einheit der Kabelpositionen | Dennis / Fachseite | **ENTSCHIEDEN (1.2, präzisiert 1.3):** `quantity_value numeric(12,3)` + `quantity_unit text`; **beide `NULL` oder beide gesetzt** (Teilzustände unzulässig); wenn gesetzt: Wert > 0, Einheiten `piece`/`meter`, bei `piece` ganzzahlig; Bestand darf `NULL` behalten, kein automatischer Backfill; neue/fachlich veränderte Positionen benötigen Wert, Einheit und Zustand; die RPCs unterscheiden eindeutig zwischen unverändert übernommenen und fachlich veränderten Positionen |
| — | Wertebereich für `condition_code` (Zustandsbewertung) | Dennis / Fachseite | **ENTSCHIEDEN (1.2):** `ready` (einsatzbereit), `restricted` (eingeschränkt einsatzbereit), `damaged` (beschädigt), `unusable` (nicht einsatzbereit); Check-Constraint, kein PostgreSQL-Enum; Bestand darf `NULL` bleiben (Anzeige „nicht erfasst"); neue/bearbeitete Positionen benötigen gültigen Code |
| — | Monteur-Lesezugriff auf Kontaktdaten zugewiesener Vorgänge | Dennis | **ENTSCHIEDEN (1.2, technisch präzisiert 1.3):** kein direktes `SELECT`-Recht auf `contacts`/`contact_phone_numbers`; Zugriff nur über explizit minimierte `security_invoker`-View oder gleichwertige SECURITY-INVOKER-RPC mit ausschließlich Vorgangs-ID, Kontaktname, Funktion/Rolle und ausgewählter operativer Telefonnummer; Daten nur bei erfülltem `is_assigned_to_incident()`; keine weiteren Felder oder Nummern; Staff nutzt den staff-geschützten Stammdatenpfad; FK + Snapshot gegen rückwirkende Verfälschung; Tests: drei Benutzerprofile plus Nachweis der Spaltenminimierung (direkt und über die Projektion) |
| — | AP10-RPC-Altpfad (`create_incident_ap10` / `update_incident_ap10`) | Dennis | **ENTSCHIEDEN (1.3):** bleiben zunächst als Datenbankobjekte bestehen; beim AP12-Cutover `EXECUTE`-Entzug für die Anwendungsrollen, atomar mit der Auslieferung der neuen Anwendung; neue Schreibzugriffe ausschließlich über `*_ap12`; Alternative (AP10 intern mit AP12-Validierungen) nur nachrangig zulässig; Smoke-Nachweis, dass Anwendungsrollen die AP10-RPCs nach dem Cutover nicht mehr aufrufen können |
| — | Implementierungsfreigabe je AP (beginnend mit AP12) | Dennis | **Offen** — Voraussetzung: AP12-Startfreigabe-Checkliste (B.8) vollständig abgearbeitet |
| — | Tag `v1.0.0-rc.1` | Dennis | **Offen** — gesonderte, ausdrückliche Entscheidung in AP15 |

---

## B.8 AP12-Startfreigabe-Checkliste

Die Implementierung von AP12 ist erst zulässig, wenn **alle** Punkte abgehakt sind **und** Dennis
die Startfreigabe ausdrücklich erteilt hat. Stand 2026-07-26 (Version 1.10): **Alle acht
technischen Vorbedingungen sind abgeschlossen.** Die ausdrückliche AP12-Implementierungsfreigabe
durch Dennis steht weiterhin aus.

- [x] Vollsicherung: vollständige Dateisystemkopie einschließlich `.git` außerhalb OneDrive
      (Teil A, Schritt 0) — **abgeschlossen am 2026-07-25.**
      Sicherungspfad: `C:\Backup\Kabelbereitschaft_2026-07-25_191847`;
      Quelle: `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`;
      **1.511 Dateien** und **3.327.487 Bytes** auf beiden Seiten identisch;
      **vollständiger SHA-256-Vergleich aller Dateien: 0 Abweichungen** (Quelle vor/nach der Kopie
      und Quelle gegen Sicherung); `.git` vollständig enthalten (`.git\objects` mit 1.234 Dateien,
      `.git\HEAD` und `.git\index` vorhanden); Robocopy 1.511 von 1.511 Dateien, 0 Fehler,
      0 Extras. Keine Git-Operation, keine Lockdatei entfernt oder verändert, keine Quelldatei
      gelöscht, verschoben oder fachlich verändert.
- [x] Windows-Prozessprüfung und sichere Lock-Behandlung: OneDrive pausiert, Editoren geschlossen,
      kein aktiver Git-Prozess; ausschließlich die beiden echten, nachweislich verwaisten Locks
      entfernt (Teil A, Schritte 1–2) — **abgeschlossen am 2026-07-26.**
      Wiederherstellbar entfernt (verschoben, nicht gelöscht) wurden ausschließlich
      **`.git\index.lock`** und **`.git\HEAD.lock`**, je **0 Bytes**, SHA-256 je
      `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855`
      (SHA-256 der leeren Datei).
      Quarantäne: `C:\Backup\Kabelbereitschaft_Lockquarantaene_2026-07-26_093108`; beide Locks
      dort vorhanden und hashidentisch zu den Exemplaren in der Vollsicherung
      `C:\Backup\Kabelbereitschaft_2026-07-25_191847\.git` (dort weiterhin vorhanden).
      Vollständiger `.git`-Vergleich: **1.282 → 1.280 Dateien, genau zwei erwartete Entfernungen**
      (`index.lock`, `HEAD.lock`), **0 zusätzliche** und **0 inhaltlich veränderte** Dateien — alle
      übrigen `.lock.*`, `.bak`, `.trash`, `.stale` und `tmp_obj_*` unangetastet. Keine
      Git-Operation ausgeführt.
      **Hinweis zur Freigabe:** Während der manuellen PowerShell-Eingabe trat ein Parserfehler auf;
      die vom Skript ausgegebene Erfolgszeile ist daher **nicht** der Nachweis. Die Freigabe dieses
      Punktes beruht ausschließlich auf der **nachgelagerten unabhängigen Prüfung des tatsächlichen
      Dateisystem-Endzustands** (Anwesenheit/Abwesenheit der Locks, Größen, SHA-256-Vergleich,
      vollständiger `.git`-Dateivergleich).
- [x] Erneute Git-Integritätsprüfung: `git --no-optional-locks status` und
      `git fsck --connectivity-only` mit unverändertem Befund gegenüber A.1 (Teil A, Schritt 2)
      — **abgeschlossen am 2026-07-26.** `status` läuft fehlerfrei durch (kein Lock-Fehler mehr):
      Branch `main`, **3 Commits voraus**, 6 modifizierte und 3 unversionierte Dateien wie in A.1
      dokumentiert. `fsck --connectivity-only`: **keine Korruption, keine fehlenden Objekte**,
      ausschließlich die zwei bekannten dangling commits `df9a3e9` und `9b6da7d` — Befund
      unverändert gegenüber A.1. Refs bestätigt: `main` = `1b8d071`, `origin/main` = `1cac409`;
      Historie `1b8d071` ← `156e43f` ← `008f648`. Beide Prüfungen read-only, keine schreibende
      Git-Operation.
- [x] Git-Bundle als unabhängige lokale Sicherung außerhalb des OneDrive-Repositories angelegt
      (Teil A, Schritt 3) — **abgeschlossen am 2026-07-26.**
      Pfad: `C:\Backup\kabelbereitschaft_main_2026-07-26.bundle`; Größe: **429.458 Bytes**.
      `git bundle verify` bestätigt ein vollständiges Bundle mit der gesamten Historie von
      `main` bis `1b8d071`. Optional nachgelagert: Kopie auf einen getrennten Datenträger oder
      einen freigegebenen externen Speicherort — erst diese zweite Kopie gilt als
      Off-Site-Sicherung.
- [x] Push AP9–AP11 erfolgreich (Teil A, Schritt 3) — **abgeschlossen am 2026-07-26.**
      GitHub bestätigte `1cac409..1b8d071 main -> main`; anschließend
      `git rev-parse main` = `git rev-parse origin/main` =
      `1b8d0711957e789568b5b20542d994674d651289`.
- [x] Dokumentation und Branding in getrennten Commits bzw. Branches gesichert
      (Teil A, Schritt 4) — **abgeschlossen am 2026-07-26.**
      Dokumentation: Commit `cf7d330` auf `main`, nach GitHub gepusht.
      Branding: Commit `04253a2` auf `feat/ap8.1-branding`, nach GitHub gepusht.
      Im frischen Clone geprüft mit der echten Node-Laufzeit
      `C:\Program Files\nodejs\node.exe`: TypeScript ohne Fehler, ESLint ohne Fehler,
      Next.js-Produktions-Build erfolgreich. Bekannte, nicht blockierende Warnung:
      `middleware`-Dateikonvention ist veraltet und soll in AP14 durch `proxy` ersetzt werden.
- [x] **Rückführung in den Vault abgeschlossen** (ersetzt den früheren Punkt „frischer Clone
      außerhalb OneDrive", Teil A, Schritt 5) — **abgeschlossen am 2026-07-26.**
      *Historie:* Am 2026-07-26 wurde ein frischer Clone unter `C:\dev\Kabelbereitschaft`
      angelegt und verifiziert (Remote `https://github.com/DKuehnhold/Kabelbereitschaft.git`,
      `main` = `origin/main` = `cf7d330`) und zunächst als führender Arbeitsort festgelegt.
      **Diese Standortentscheidung hat Dennis am 2026-07-26 ausdrücklich aufgehoben.** Der
      Kabelbereitschaft-Vault ist wieder alleiniger Projekt- und Arbeitsort;
      `C:\dev\Kabelbereitschaft` gilt nur noch als vorübergehender, zu entfernender Clone.
      *Neue Zielbedingungen für diesen Punkt:*
      1. Der Vault ist alleiniger Projekt- und Arbeitsort.
      2. Die Inhalte von `C:\dev\Kabelbereitschaft` sind vollständig kontrolliert.
      3. Dort verbleiben keine einzigartigen relevanten Dateien (Inventarstand 2026-07-26:
         **keine** Datei existiert ausschließlich im Dev-Ordner).
      4. Commit `455c71d` und der Branding-Branch `04253a2` sind im Vault **und** auf GitHub
         vorhanden.
      5. `C:\dev\Kabelbereitschaft` wurde über den **Windows-Papierkorb** entfernt
         (keine permanente Löschung; `C:\dev` selbst bleibt bestehen).
      *Abschlussnachweis:* Alle fünf Bedingungen sind erfüllt. Die Standortkorrektur wurde als
      Commit `efdadfb` nach `origin/main` gepusht. Der Clone wurde nach erneuter Prüfung
      (saubere Arbeitskopie, 226 relevante Dateien, 0 ausschließlich dort vorhandene Dateien,
      lokale Commits auf GitHub gesichert) in den Windows-Papierkorb verschoben.
      `C:\dev` selbst blieb bestehen. Der Vault blieb sauber und `Willkommen.md` hashidentisch.
      **AP12 wurde am 2026-07-27 ausdrücklich durch Dennis freigegeben.**
- [x] Führende Statusdokumente eindeutig gekennzeichnet und auf den tatsächlichen Projektstand
      gebracht; veraltete Dubletten als „historisch/abgelöst" markiert, nicht gelöscht
      (Auflage aus B.1) — **abgeschlossen am 2026-07-26.** Führend: `PROJEKTSTATUS.md`
      (Repository-Wurzel), `00-Projektsteuerung/CHANGELOG.md`, `07-Betrieb/BACKUP_UND_RECOVERY.md`.
      Als „historisch/abgelöst" markiert (nicht gelöscht): `00-Projektsteuerung/PROJEKTSTATUS.md`
      (Stand AP2), `CHANGELOG.md` (Wurzel, Stand AP8 ohne AP9–AP11), `07-Betrieb/BACKUP.md`
      (Stand AP1). Die führende `PROJEKTSTATUS.md` wurde auf den tatsächlichen Stand gebracht
      (AP9–AP11 abgeschlossen und inzwischen gepusht, `main` = `origin/main` = `1b8d071`,
      Integritätsbefund, Vollsicherung und Lock-Quarantäne, offene Punkte inkl.
      V1-Produktionssperre, fehlender AP8-Bericht, `_sandbox_write_test`); der überholte Abschnitt
      „Git / Push" ist ausdrücklich als veraltet gekennzeichnet. Endgültige Konsolidierung und
      Archivierung bleiben AP15 vorbehalten.

---

## Änderungshistorie

| Version | Datum | Änderung | Bearbeiter |
|---|---|---|---|
| 1.0 (Entwurf) | 2026-07-25 | Erstanlage: Git-Zustand (read-only verifiziert), Inventar der `.git`-Altlasten, fünfstufiger Bereinigungsplan, Roadmap AP12–AP15 mit je 10 Feldern, Zuordnung der 14 offenen Entscheidungen, kritischer Pfad, Entscheidungsliste | Claude (KI) |
| 1.1 | 2026-07-25 | Freigabe V0 unter Auflagen eingearbeitet (Planungsgrundlage, keine Implementierungsfreigabe). Entscheidungen V2 (Offline-Ausbau nach RC1), V3 (informative Zuordnung), V4 (Rate Limiting auf Plattformebene) und Repository-Struktur (gemeinsames Repo, Umzug aus OneDrive, ADR 1 bleibt) als getroffen dokumentiert; V1 als offene Produktionssperre mit Auflage „nur synthetische Daten". Git-Plan korrigiert: `index.lock` blockiert Push nicht (Ursache des fehlenden Pushs unbelegt), `git gc --prune=now` entfernt, dangling Commits und `tmp_obj_*` bleiben unangetastet, frischer Clone als bevorzugte Bereinigung, verbindliche Sicherungsreihenfolge ergänzt. AP12: neue versionierte RPCs `create_incident_ap12`/`update_incident_ap12` (AP10-RPCs bleiben), `condition_code` mit validiertem Wertebereich, Menge/Einheit-Klärung, widerspruchsfreier Kontaktzugriff, FK + Snapshot/Historisierung. AP13: Zuweisung bevorzugt an `profiles`/Teams/Rollen, Gesamtauftrag vs. Einzeltransaktionen bei Massenaktionen, offline für RC1 ausgeschlossen. AP14/AP15: synthetische Daten bis V1, CSP-Report-Endpunkt vor Durchsetzung, Doku-Konsolidierung geteilt (Kennzeichnung vor AP12, Konsolidierung in AP15) | Claude (KI) nach Vorgaben von Dennis |
| 1.2 | 2026-07-25 | Die vier in 1.1 offenen AP12-Punkte verbindlich entschieden: (1) Menge als `quantity_value numeric(12,3)` + `quantity_unit text` (`piece`/`meter`, Wert > 0, bei `piece` ganzzahlig, Bestand darf `NULL` behalten, kein Backfill); (2) `condition_code` mit Wertebereich `ready`/`restricted`/`damaged`/`unusable` per Check-Constraint (kein Enum), Bestand `NULL` = „nicht erfasst"; (3) Monteur-Kontaktzugriff: vorgangsbezogen Name, Funktion/Rolle und ausgewählte operative Telefonnummer, RLS über `is_assigned_to_incident()`, keine generelle Leseberechtigung, FK + Snapshot, RLS-Tests für drei Benutzerprofile; (4) Infrastruktur-Beschaffung ab sofort parallel zur Repository-Stabilisierung und AP12-Vorbereitung, bis V1 nur synthetische Daten. Neue AP12-Startfreigabe-Checkliste (B.8). Kopf, B.1, B.2, B.6, B.7 konsistent aktualisiert. V1 weiterhin offen (Produktionssperre); AP12-Implementierung weiterhin nicht freigegeben | Claude (KI) nach Vorgaben von Dennis |
| 1.3 | 2026-07-25 | Technische Konsistenzkorrektur: (1) AP10-Altpfad geschlossen — AP10-RPCs bleiben als Datenbankobjekte, aber `EXECUTE`-Entzug für Anwendungsrollen beim AP12-Cutover, atomar mit dem Anwendungs-Deployment; Schreibzugriffe nur noch über `*_ap12`; Smoke-Nachweis ergänzt. (2) Kontaktzugriff spaltenbezogen minimiert — kein direktes `SELECT` für Monteure auf `contacts`/`contact_phone_numbers`; minimierte `security_invoker`-View bzw. SECURITY-INVOKER-RPC mit ausschließlich Vorgangs-ID, Kontaktname, Funktion/Rolle und ausgewählter operativer Telefonnummer, nur bei erfülltem `is_assigned_to_incident()`; Akzeptanzkriterium Staff/Monteur präzisiert; Projektionstests ergänzt. (3) NULL-/Bearbeitungsregeln — `quantity_value`/`quantity_unit` beide `NULL` oder beide gesetzt, Teilzustände unzulässig; RPCs unterscheiden unverändert übernommene und fachlich veränderte Positionen; Testfälle Teil-NULL, ungültige Einheit, nicht ganzzahlige Stückzahl, ungültiger Zustand, Bearbeitung historischer NULL-Position. (4) Git-Bundle korrekt als unabhängige lokale Sicherung außerhalb des OneDrive-Repositories bezeichnet; Off-Site erst durch nachgelagerte Kopie auf getrennten Datenträger/externen Speicherort; B.8 angepasst. Status unverändert: V1 offen (Produktionssperre), AP12-Implementierung nicht freigegeben, alle B.8-Checkboxen offen | Claude (KI) nach Vorgaben von Dennis |
| 1.4 | 2026-07-25 | B.8 Schritt 1 abgeschlossen: vollständige Dateisystemkopie einschließlich `.git` außerhalb OneDrive angelegt und vollständig hashidentisch verifiziert. Nachweis in B.8 dokumentiert (`C:\Backup\Kabelbereitschaft_2026-07-25_191847`, 1.511 Dateien, 3.327.487 Bytes, SHA-256-Vergleich mit 0 Abweichungen, `.git\objects` 1.234 Dateien, Robocopy 0 Fehler / 0 Extras). Status unverändert: V1 offen (Produktionssperre), AP12-Implementierung nicht freigegeben, die sieben übrigen B.8-Punkte offen | Claude (KI) nach Vorgaben von Dennis |
| 1.5 | 2026-07-26 | B.8 Punkt 2 abgeschlossen: sichere Lock-Behandlung durchgeführt — ausschließlich `.git\index.lock` und `.git\HEAD.lock` (je 0 Bytes, SHA-256 `E3B0C442…7852B855`) wiederherstellbar nach `C:\Backup\Kabelbereitschaft_Lockquarantaene_2026-07-26_093108` verschoben, hashidentisch zu den Exemplaren in der Vollsicherung. Vollständiger `.git`-Vergleich 1.282 → 1.280 Dateien mit genau zwei erwarteten Entfernungen, 0 zusätzlichen und 0 veränderten Dateien; alle übrigen Altlasten unangetastet; keine Git-Operation. Die Freigabe beruht wegen eines Parserfehlers bei der manuellen PowerShell-Eingabe ausdrücklich auf der nachgelagerten unabhängigen Endzustandsprüfung, nicht auf der Skript-Erfolgszeile. Status unverändert: V1 offen (Produktionssperre), AP12-Implementierung nicht freigegeben, die sechs übrigen B.8-Punkte offen | Claude (KI) nach Vorgaben von Dennis |
| 1.6 | 2026-07-26 | B.8 Punkt 3 abgeschlossen: read-only Integritätsprüfung nach der Lock-Entfernung — `git --no-optional-locks status` fehlerfrei (Branch `main`, 3 Commits voraus, Arbeitskopie wie in A.1), `git fsck --connectivity-only` ohne Korruption mit ausschließlich den zwei bekannten dangling commits; `main` = `1b8d071`, `origin/main` = `1cac409`. B.8 Punkt 8 abgeschlossen: führende Statusdokumente gekennzeichnet (`PROJEKTSTATUS.md` Wurzel, `00-Projektsteuerung/CHANGELOG.md`, `07-Betrieb/BACKUP_UND_RECOVERY.md`), Dubletten als historisch/abgelöst markiert statt gelöscht (`00-Projektsteuerung/PROJEKTSTATUS.md`, `CHANGELOG.md` Wurzel, `07-Betrieb/BACKUP.md`), führende `PROJEKTSTATUS.md` auf den tatsächlichen Stand AP9–AP11 inklusive Git-, Sicherungs- und Sperrstatus gebracht. Weiterhin offen: B.8 Punkte 4–7 (Bundle, Push, getrennte Commits, frischer Clone) — blockiert durch fehlenden Zugriff auf `C:\Backup`/`C:\dev` und fehlende GitHub-Anmeldung in der Arbeitsumgebung. Status unverändert: V1 offen (Produktionssperre), AP12-Implementierung nicht freigegeben, kein RC1-Tag | Claude (KI) nach Vorgaben von Dennis |
| 1.7 | 2026-07-26 | B.8 Punkt 4 abgeschlossen: vollständiges Git-Bundle `C:\Backup\kabelbereitschaft_main_2026-07-26.bundle` (429.458 Bytes) angelegt und mit `git bundle verify` geprüft. B.8 Punkt 5 abgeschlossen: AP9–AP11 nach GitHub gepusht (`1cac409..1b8d071`), `main` und `origin/main` stehen identisch auf `1b8d071`. Der zuvor dokumentierte Umgebungsblocker ist damit entfallen. Weiterhin offen: B.8 Punkte 6–7 (getrennte Dokumentations-/Branding-Sicherung und frischer Clone). Status unverändert: V1 offen (Produktionssperre), AP12-Implementierung nicht freigegeben, kein RC1-Tag | Codex (KI) nach Vorgaben von Dennis |
| 1.8 | 2026-07-26 | B.8 Punkt 6 abgeschlossen: Dokumentation separat als `cf7d330` auf `main`, Branding separat als `04253a2` auf `feat/ap8.1-branding` gesichert und jeweils nach GitHub gepusht; Branding im frischen Clone mit TypeScript, ESLint und Next.js-Produktions-Build erfolgreich geprüft. B.8 Punkt 7 abgeschlossen: frischer, sauberer GitHub-Clone unter `C:\dev\Kabelbereitschaft` verifiziert. Der OneDrive-Ordner bleibt wegen des wieder aktiven Obsidian-Vaults am bestehenden Pfad vollständig erhalten; weitere Git-/Entwicklungsarbeit erfolgt ausschließlich im neuen Clone. Damit sind alle acht technischen B.8-Punkte erledigt. Status unverändert: V1 offen (Produktionssperre), AP12-Implementierung wartet weiterhin auf die ausdrückliche Freigabe durch Dennis, kein RC1-Tag | Codex (KI) nach Vorgaben von Dennis |
| 1.9 | 2026-07-26 | **Standortentscheidung geändert:** Dennis hebt die Festlegung auf `C:\dev\Kabelbereitschaft` als führenden Arbeits-Clone ausdrücklich auf. Einziger Projekt- und Arbeitsort ist wieder der Kabelbereitschaft-Vault `…\Kabelbereitschaft-App\Kabelbereitschaft-App`; der Dev-Clone gilt als vorübergehender technischer Clone und wird über den Windows-Papierkorb entfernt (`C:\dev` bleibt bestehen). Teil A Schritt 5 als aufgehoben gekennzeichnet, Historie erhalten; keine Empfehlung für einen erneuten Umzug aus OneDrive. B.8 angepasst: Punkte 1–6 und 8 bleiben abgeschlossen, Punkt 7 wieder offen und als „in Rückführung" mit fünf neuen Zielbedingungen geführt (Vault alleiniger Arbeitsort, Dev-Inhalte kontrolliert, keine einzigartigen Dateien dort, Commit und Branding-Branch in Vault und GitHub vorhanden, Dev-Ordner über Papierkorb entfernt). Rückführungsstand: Vault auf `main` = `origin/main` = `455c71d`, `origin/feat/ap8.1-branding` = `04253a2`, Arbeitskopie nach Windows-Reparatur sauber, Inventar ohne einzigartige Dev-Dateien; offen bleiben Dokumentations-Commit mit Push, finale Gegenprüfung und die Entfernung des Dev-Ordners. Branding bleibt separat und ungemergt; AP12 gesperrt; V1 weiterhin Produktionssperre; kein RC1-Tag | Claude (KI) nach Vorgaben von Dennis |
| 1.10 | 2026-07-26 | Rückführung abgeschlossen: Standortkorrektur als `efdadfb` nach `origin/main` gepusht; temporären Clone `C:\dev\Kabelbereitschaft` nach erneuter Kontrolle über den Windows-Papierkorb entfernt, `C:\dev` beibehalten. Vault anschließend sauber auf `main` = `origin/main`, `Willkommen.md` unverändert. B.8 Punkt 7 geschlossen; alle acht technischen Vorbedingungen sind erledigt. `PROJEKT_WISSEN.md` ist die zentrale Projektübersicht. AP12 wartet nur noch auf die ausdrückliche Freigabe durch Dennis; V1 bleibt Produktionssperre | Codex (KI) nach Vorgaben von Dennis |
| 1.11 | 2026-07-27 | Dennis erteilt mit „Mach jetzt weiter“ die ausdrückliche AP12-Implementierungsfreigabe. AP12 in Umsetzung: Migration `0010_ap12_incident_details.sql`, neue AP12-RPCs, Mehrfach-Kabelpositionen mit Menge/Einheit/Zustand, Kontakt-FK und Snapshot, minimierte Monteur-Kontaktprojektion, überarbeitete Vorgangsoberfläche und Bereitschaftsnummern-CRUD implementiert. TypeScript, ESLint und Next.js-Produktions-Build erfolgreich. Der lokale PostgreSQL-18-Lauf ist mit `app/supabase/test/run_ap12_local.ps1` vorbereitet und wartet ausschließlich auf die verdeckte Kennworteingabe durch Dennis; AP12 deshalb noch nicht abgeschlossen. V1 bleibt Produktionssperre | Codex (KI) |
| 1.12 | 2026-07-27 | AP12 technisch abgeschlossen: vollständiger lokaler PostgreSQL-18-Lauf mit Migrationen 0001–0010 und AP10–AP12-Smoke-Tests erfolgreich. Nachgewiesen sind insbesondere Mengen-/Einheiten-/Zustandsregeln, historische NULL-Positionen, Kontakt-Snapshot, minimierte Monteur-Projektion, RLS, Staff-CRUD und der Entzug des AP10-Schreibaltpfads. Teststarter gegen harmlose PostgreSQL-NOTICE-Ausgaben gehärtet; AP11-Zähltests fixture-spezifisch gemacht; temporäre Testdatenbank entfernt. V1 bleibt unverändert Produktionssperre | Codex (KI) |
