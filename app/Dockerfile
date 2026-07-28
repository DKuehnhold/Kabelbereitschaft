# syntax=docker/dockerfile:1.7
#
# Kabelbereitschaft - Produktionsimage (AP14 / Arbeitspaket A)
#
# Grundsaetze:
#   - Multi-Stage: Build-Werkzeuge landen nicht im Laufzeitimage.
#   - Reproduzierbar: ausschliesslich "npm ci" gegen package-lock.json.
#   - Nicht als root: die Anwendung laeuft als Benutzer "node" (uid 1000).
#   - Dateien gehoeren root, laufen aber unter "node" -> die Anwendung kann
#     ihren eigenen Code nicht veraendern; Betrieb mit read_only moeglich.
#   - Keine Secrets, keine .env-Dateien, keine Git-Metadaten im Image
#     (siehe .dockerignore). Konfiguration ausschliesslich zur Laufzeit.
#   - Kein ARG fuer Geheimnisse. Vertrauliche Werte werden nie eingebrannt.
#
# HINWEIS zur Laufzeitkonfiguration: NEXT_PUBLIC_*-Werte werden von Next.js
# zur BUILDZEIT in die Client-Bundles eingebrannt. Solange die Anwendung
# NEXT_PUBLIC_SUPABASE_URL/-ANON_KEY benoetigt, ist ein Image
# umgebungsspezifisch. Die Promotion eines unveraenderten Digests von Stage
# nach Produktion wird erst mit Arbeitspaket B moeglich, das diese beiden
# Variablen ersatzlos entfernt. Siehe deploy/README.md, Abschnitt
# "Konfiguration".
#
# Der Basis-Tag ist bewusst explizit. Eine Digest-Pinnung
# (node:22-bookworm-slim@sha256:...) ist vorgesehen, sobald der Digest der
# freigegebenen Version einmal verifiziert vorliegt.

# ---------------------------------------------------------------------------
# Stage 1: Abhaengigkeiten (inkl. devDependencies, fuer den Build notwendig)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# "next build" setzt NODE_ENV selbst auf production.
# Erzeugt .next/standalone (siehe next.config.ts: output "standalone").
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Laufzeit
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone-Ausgabe: server.js + minimale node_modules.
# Statische Assets und public/ muessen separat uebernommen werden.
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --from=build --chown=root:root /app/.next/static ./.next/static
COPY --from=build --chown=root:root /app/public ./public

# Betriebsskripte des Images (Startvalidierung, Healthcheck).
COPY --chown=root:root docker/ ./docker/
RUN chmod 0755 ./docker/entrypoint.sh

USER node
EXPOSE 3000

# Healthcheck ohne curl/wget: Node 22 bringt fetch mit.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD ["node", "/app/docker/healthcheck.mjs"]

# Der Entrypoint prueft zuerst die Pflichtvariablen und bricht bei fehlender
# Konfiguration mit klarer Meldung ab (kein stiller Start mit Platzhaltern).
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "server.js"]
