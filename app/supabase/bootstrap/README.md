# PostgreSQL-Bootstrap

Dieser Bootstrap stellt auf einer **leeren PostgreSQL-18-Instanz** ausschließlich
die Voraussetzungen her, welche die unveränderte Historie `0001`–`0011`
erwartet.

Reihenfolge:

1. `01_roles.sql`
2. `02_compat_auth.sql`
3. `03_compat_storage.sql`
4. Migrationen `0001`–`0011`
5. `0012_ap14b_platform_auth.sql`
6. `0013_ap14b_drop_supabase_compat.sql`

`auth` und `storage` sind keine Zielarchitektur. Sie existieren nur während
des Neuaufbaus und werden durch `0013` zwingend entfernt. Bestehende
Migrationen werden nicht verändert.

`app_user` ist eine NOLOGIN-Gruppenrolle. Die interne IT legt pro Umgebung
einen separaten Login mit zufälligem Kennwort an und gewährt diesem
`app_user`. Kennwörter oder Verbindungszeichenfolgen gehören nicht ins
Repository.
