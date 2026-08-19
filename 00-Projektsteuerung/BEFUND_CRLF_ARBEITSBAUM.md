# BEFUND: 152 Dateien im Arbeitsbaum auf CRLF umgestellt — Commit-Blocker

> **NACHTRAG 2026-08-18, 13:45 — weitgehend erledigt.** Neu gemessen tragen nur noch **39**
> versionierte Dateien CR: **32 unter `.claude/`** (für Claude gesperrt, kosmetisch, für die CI
> ohne Bedeutung) und **7 Binärdateien** (`.xlsx`, `.png`, `.jpg`, `.ico`), deren CR-Bytes auch
> in HEAD so stehen — dort ist **nichts zu tun**. **Alle sieben Shell-Skripte,
> `app/Dockerfile`, `deploy/compose*.yml` und beide Workflows sind wieder LF**; der Blocker für
> den CI-Job `database` und den Containerstart ist damit weg (`app/supabase/test/run_db_tests.sh`
> beginnt wieder mit `#!/usr/bin/env bash$` statt `bash^M$`).
>
> **Rest für Dennis** — die 32 Dateien unter `.claude/`, in einem Durchgang:
>
> ```powershell
> Set-Location "C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App"
> Get-ChildItem .claude -Recurse -File | ForEach-Object {
>   $t = [System.IO.File]::ReadAllText($_.FullName) -replace "`r`n", "`n"
>   [System.IO.File]::WriteAllText($_.FullName, $t, (New-Object System.Text.UTF8Encoding($false)))
> }
> ```
>
> Der ursprüngliche Befund bleibt unten als Historie stehen; die dortige Dateiliste und die
> Zahlen beschreiben den Stand vom Vormittag.

## Historie (ursprünglicher Befund)

> Erhoben vom Orchestrator/Review-Chat am 2026-08-18 bei der Nachmessung zu AUFTRAG_15.
> **Entscheidung und Ausführung liegen bei Dennis** (Arbeitsbaum-Wiederherstellung ist
> destruktiv; `.claude/**` ist für Claude gesperrt).

## Was gemessen wurde

`git status --porcelain` nennt **207** geänderte Dateien. Das ist weit mehr, als AUFTRAG
11–14 berührt hat. Ursache: ein Großteil der Dateien wurde von LF auf **CRLF**
(Windows-Zeilenenden) umgeschrieben, ohne inhaltliche Änderung.

Eigene Messung, Datei für Datei (HEAD-Inhalt gegen Arbeitsbaum-Inhalt nach Entfernen von
`\r`):

| Kategorie | Anzahl |
| --- | --- |
| Dateien mit CRLF im Arbeitsbaum, LF in HEAD | **152** |
| davon **inhaltlich identisch** zu HEAD (reine Zeilenendeänderung) | **141** |
| davon **zusätzlich echte Inhaltsänderung** | **11** |
| echte Inhaltsänderungen ohne CRLF-Problem | 32 |
| echte Inhaltsänderungen insgesamt (`git diff --stat -w`) | **43** Dateien, 1547+/443− |

Weder eine `.gitattributes` existiert im Repo, noch sind `core.autocrlf` oder `core.eol`
gesetzt. Git normalisiert die Zeilenenden also **nicht** — was im Arbeitsbaum steht, landet
so im Commit.

## Warum das ein Blocker ist (nicht nur Kosmetik)

Betroffen sind **alle sieben Shell-Skripte** und die Container-Bausteine:

```
app/supabase/test/run_db_tests.sh      (655 CR)   <-- vom CI-Job `database` ausgeführt
app/docker/entrypoint.sh               ( 14 CR)   <-- Containerstart
deploy/scripts/deploy.sh               (111 CR)
deploy/scripts/rollback.sh             ( 53 CR)
deploy/scripts/db-restore.sh           ( 55 CR)
deploy/scripts/db-backup.sh            ( 46 CR)
deploy/scripts/healthcheck.sh          ( 40 CR)
app/Dockerfile, deploy/compose*.yml, .github/workflows/ci.yml,
.github/workflows/container-image.yml, app/supabase/test/run_ap14b_local.ps1
```

Belegt, `run_db_tests.sh`, erste drei Zeilen mit sichtbaren Zeilenenden:

```
HEAD:        #!/usr/bin/env bash$
Arbeitsbaum: #!/usr/bin/env bash^M$
```

Ein Shebang mit angehängtem `\r` bedeutet auf Linux, dass der Kernel einen Interpreter
namens `bash\r` sucht. Der CI-Job `database` beginnt laut Protokoll mit
`Run chmod +x supabase/test/run_db_tests.sh` und ruft das Skript direkt auf — dieser Aufruf
schlägt dann **vor der ersten SQL-Anweisung** fehl (`env: 'bash\r': No such file or
directory`). Derselbe Mechanismus trifft `entrypoint.sh` im Job `container`.

Daraus folgt: **die Korrektur aus AUFTRAG_15 allein macht die CI nicht grün.** Würde der
Arbeitsbaum so committet, fiele der Job `database` künftig sofort aus, ohne Smoke 28
überhaupt zu erreichen — mit einem Fehlerbild, das nichts mit Z7 zu tun hat und leicht als
neuer Fachfehler missgedeutet wird. Der bisher rote Lauf zu `3c1343f` ist davon **nicht**
betroffen, weil dort noch die LF-Fassung im Commit steht.

## Vorgeschlagenes Vorgehen (Entscheidung Dennis)

Zwei getrennte Schritte, weil sie unterschiedlich riskant sind.

**Schritt 1 — 141 rein zeilenende-geänderte Dateien verwerfen.** Sie sind inhaltlich
identisch zu HEAD; `git checkout --` stellt die LF-Fassung her, es geht **keine Arbeit**
verloren (nachgemessen: Inhalt nach Entfernen von `\r` ist byteweise gleich HEAD).

**Schritt 2 — 11 Dateien konvertieren, nicht verwerfen.** Sie tragen echte Änderungen aus
AUFTRAG 11–14. Hier darf nur `\r` am Zeilenende entfernt werden:

```
.github/workflows/ci.yml
app/src/app/globals.css
app/src/app/layout.tsx
app/src/app/login/LoginForm.tsx
app/src/app/manifest.ts
app/src/app/passwort-aendern/PasswordChangeForm.tsx
app/src/components/Logo.tsx
app/src/lib/masterdata-actions.ts
app/src/lib/masterdata.ts
app/supabase/test/run_ap14b_local.ps1
app/supabase/test/run_db_tests.sh
```

Kopierfertig für PowerShell (im Repo-Wurzelordner ausführen; Schritt 1 verwirft
Änderungen — vorher `git status` ansehen):

```powershell
Set-Location "C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App"

# Schritt 0: Sicherung des aktuellen Stands
git diff > "$env:TEMP\kb_arbeitsbaum_2026-08-18.patch"

# Schritt 2 ZUERST: die 11 gemischten Dateien auf LF bringen (Inhalt bleibt erhalten)
$gemischt = @(
  ".github/workflows/ci.yml",
  "app/src/app/globals.css",
  "app/src/app/layout.tsx",
  "app/src/app/login/LoginForm.tsx",
  "app/src/app/manifest.ts",
  "app/src/app/passwort-aendern/PasswordChangeForm.tsx",
  "app/src/components/Logo.tsx",
  "app/src/lib/masterdata-actions.ts",
  "app/src/lib/masterdata.ts",
  "app/supabase/test/run_ap14b_local.ps1",
  "app/supabase/test/run_db_tests.sh"
)
foreach ($f in $gemischt) {
  $t = [System.IO.File]::ReadAllText($f) -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))
}

# Schritt 1: alle uebrigen rein zeilenende-geaenderten Dateien verwerfen
git status --porcelain | ForEach-Object { $_.Substring(3).Trim('"') } |
  Where-Object { $gemischt -notcontains $_ } |
  ForEach-Object {
    $roh = git show "HEAD:$_" 2>$null
    if ($LASTEXITCODE -eq 0) {
      $arbeit = (Get-Content -Raw -LiteralPath $_ -ErrorAction SilentlyContinue) -replace "`r`n", "`n"
      if ($arbeit -eq (($roh -join "`n") + "`n")) { git checkout -- $_ }
    }
  }

# Kontrolle: es sollten nur noch die echten Aenderungen uebrig sein
git status --porcelain | Measure-Object -Line
git diff --stat | Select-Object -Last 1
```

Erwartung nach dem Lauf: rund **43** geänderte Dateien statt 207, und
`git ls-files '*.sh' | ForEach-Object { Select-String "`r" $_ }` findet keinen Treffer mehr.

**Zusätzlich empfohlen, aber ausdrücklich Dennis' Entscheidung:** eine `.gitattributes` mit
`* text=auto eol=lf` und `*.ps1 text eol=crlf` verhindert die Wiederholung. Das ist ein
repo-weiter Eingriff (Git normalisiert danach beim Einchecken alles) und deshalb hier nur
als Vorschlag notiert, nicht umgesetzt.

## Was NICHT geklärt ist

- **Ursache** der Umstellung. Kandidaten sind ein Editor-/Werkzeuglauf über den Vault oder
  die OneDrive-Synchronisation. Ohne diese Klärung kann es erneut passieren — das ist das
  eigentliche Argument für die `.gitattributes`.
- Ob unter den 141 „rein zeilenende-geänderten" Dateien eine ist, in der Dennis bewusst
  gearbeitet hat. Die Messung sagt: inhaltlich identisch zu HEAD, also nein — aber die
  Sicherung in Schritt 0 sollte trotzdem angelegt werden.
