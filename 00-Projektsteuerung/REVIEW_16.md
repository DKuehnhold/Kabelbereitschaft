# REVIEW_16 — Stammdaten-Übersicht `/stammdaten` als Akkordeon

> Verfasst vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: `AUFTRAG_16.md`,
> `MELDUNG_16.md` und **eigene Messungen**. Agentenaussagen sind nicht als Nachweis
> übernommen.

## Ergebnis: **grün**, mit zwei Auflagen und zwei Merkposten

## Eigene Messwerte

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| TypeScript, aus `app/`: `npx tsc --noEmit` | keine Ausgabe | **0** |
| Unit-Tests, aus `app/`: `node --test test/*.test.mjs` | `# tests 181 / # pass 181 / # fail 0` (Baseline 177 + 4 neue) | **0** |
| neuer Wächtertest allein | 4 Fälle, alle `ok` | 0 |
| Zeilenenden der drei neuen Dateien (`grep -c $'\r'`) | jeweils **0** (LF) | 0 |
| Umfang: in den letzten 3 Stunden geänderte Dateien unter `app/` (`find -newermt`) | genau `stammdaten/page.tsx`, `ui/shadcn/accordion.tsx`, `test/auftrag16-…test.mjs`, `lib/roles.ts` — plus die Artefakte `tsconfig.tsbuildinfo` (gitignoriert) und `testout.log` | 0 |

Der Umfang wurde **über Dateizeitstempel** geprüft, nicht über `git status`: der Arbeitsbaum
trägt bereits 200+ fremde Änderungen aus AUFTRAG 11–14 und die offene CRLF-Umstellung
(`BEFUND_CRLF_ARBEITSBAUM.md`), `git status` allein wäre hier kein Nachweis. Ergebnis: die
13 Client-Komponenten, die 13 Einzelseiten, `globals.css`, `package.json` und
`package-lock.json` sind von diesem Auftrag **nicht** angefasst — die dort sichtbaren
Änderungen sind älter und gehören zu AUFTRAG 11–14.

`roles.ts`-Diff eigenhändig gelesen: genau **eine** hinzugefügte Eintragszeile plus
Kommentar. Der zweite Hunk (`/stammdaten/qualifikationen`) stammt aus AUFTRAG_14 und war
vorher schon uncommitted vorhanden — **nicht** aus diesem Auftrag.

## Fachliche Prüfung (Stichproben im Code)

**Reihenfolge und Vollständigkeit** — 13 Abschnitte in der Auftragsreihenfolge, alle 13
Client-Komponenten importiert und verwendet. Der Wächtertest vergleicht die Positionen, ein
späteres stilles Umsortieren wird rot. Gut gelöst.

**Untertitel zeichengleich** — eigenhändig gegengeprüft: die 13 `subtitle`-Zeichenketten der
Einzelseiten und die 13 der Übersicht sind **mengengleich**; die einzige Abweichung ist der
neue eigene `PageHeader`-Untertitel der Übersichtsseite. Keine erfundenen Texte.

**Rollengate** — `requireSession()`, danach `admin`/`disponent` und `<NoAccess />`
**vor** dem `Promise.all`. Identisch zum Muster der Einzelseiten, kein SQL bei fehlender
Berechtigung.

**Tokens statt Farbwerten** — `accordion.tsx` nutzt ausschließlich Utility-Klassen
(`text-muted-foreground`, `border-ring`, `ring-ring`), die Seite `bg-surface`,
`text-foreground`, `text-muted`, `text-primary`. Alle zugehörigen `--color-*`-Variablen sind
in `globals.css` vorhanden (einzeln nachgezählt); kein Hex-Literal. Die Animationsnamen
`animate-accordion-up`/`-down` sind **nicht** erfunden: `tw-animate-css` (in `globals.css`
Zeile 5 importiert) definiert `--animate-accordion-down`/`-up` samt Keyframes gegen
`--radix-accordion-content-height` — nachgemessen in
`node_modules/tw-animate-css/dist/tw-animate.css`. Damit funktioniert die Auf-/Zuklappen-
Animation ohne neue Abhängigkeit und ohne Eingriff in die Tokens.

**Keine neue Abhängigkeit** — `radix-ui` war bereits vorhanden, `package.json` und
`package-lock.json` unberührt. Bestätigt.

**Bedienbarkeit** — alle Abschnitte starten zugeklappt, `type="multiple"` erlaubt mehrere
offene Abschnitte. Der Link „Einzelseite öffnen" liegt **außerhalb** des Triggers, also kein
verschachteltes interaktives Element — a11y-seitig richtig gelöst.

## Auflagen (offen)

1. **Sichtprüfung durch Dennis erforderlich.** Diese Scheibe ist sichtbare Oberfläche und in
   dieser Umgebung nicht darstellbar (`npm run build` und der Browser fehlen). `tsc` und die
   Wächtertests belegen Struktur und Typen, **nicht** das Aussehen. Zu prüfen sind: Abstände
   und Lesbarkeit der 13 Kopfzeilen, Verhalten im Dark Mode, Chevron-Drehung und die
   Trefferfläche des Triggers neben dem Link.
2. **`npm run build` und ESLint lokal.** Wie bei jeder Scheibe seit AUFTRAG_3
   umgebungsbedingt offen.

## Merkposten (kein Mangel, aber bewusst festgehalten)

1. **20 Ladeaufrufe je Seitenaufruf, DOM aller 13 Abschnitte.** Die Seite lädt in **einem**
   `Promise.all` 20 Listen (vier davon mehrfach verwendet: `getActiveStageOptions`,
   `getActiveOnCallOptions`, `getActiveCustomers`, `listQualifications` — einmal geladen,
   mehrfach übergeben; das ist sauber). Weil die Abschnitte serverseitig gerendert werden,
   steht das Markup **aller** 13 Pflegeoberflächen im HTML, auch im zugeklappten Zustand.
   Bei den heutigen Datenmengen unkritisch; wenn die Seite später träge wirkt, ist der
   Ausweg ein Laden je Abschnitt (`Suspense` mit eigener Server-Komponente) — das wäre eine
   eigene Scheibe und ist hier ausdrücklich **nicht** gemacht.
2. **`listContacts()` und `listTechnicians()` haben keine Obergrenze.** Vom Agenten gemeldet,
   von mir bestätigt: das ist unverändert der Bestand der Einzelseiten, also **kein** durch
   AUFTRAG_16 eingeführtes Risiko. Auf der Übersichtsseite treffen die beiden Vollmengen
   aber erstmals zusammen. Falls die Kontaktliste im echten Betrieb groß wird, gehört eine
   Obergrenze in die CSV-Import-/Kontakte-Scheibe.

## Aufräumen

Beim Testlauf des Agenten ist `app/testout.log` entstanden (0 Byte). Die Datei lässt sich aus
der Sandbox **nicht** löschen (`Operation not permitted`, OneDrive-/FUSE-Mount) und ist
**nicht** gitignoriert — sie würde bei einem `git add -A` mitkommen. **Bitte lokal
entfernen:**

```powershell
Remove-Item "C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App\app\testout.log"
```

## Kein Commit, kein Push

Weder durch den Ausführungsagenten noch durch mich.
