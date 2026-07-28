// Container-Healthcheck.
//
// Prueft ausschliesslich den oeffentlichen, DB-unabhaengigen Endpunkt
// /api/health (AP7). Der Endpunkt liefert status/version/time, keine
// internen Details und keine Datenbankinformationen.
//
// Bewusst kein curl/wget im Laufzeitimage: Node 22 bringt fetch mit,
// das haelt das Image klein und die Angriffsflaeche gering.
//
// Exit 0 = gesund, Exit 1 = ungesund. Ein fachlich defekter App-Prozess
// (kein Listener, 5xx, kein "ok") wird damit erkannt.

const port = process.env.PORT || "3000";
const url = `http://127.0.0.1:${port}/api/health`;
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 4000);

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { "cache-control": "no-store" },
  });

  if (!response.ok) {
    process.stderr.write(`health: HTTP ${response.status}\n`);
    process.exit(1);
  }

  const body = await response.json();
  if (body?.status !== "ok") {
    process.stderr.write(`health: unerwarteter Status "${body?.status}"\n`);
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`health: ${reason}\n`);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
