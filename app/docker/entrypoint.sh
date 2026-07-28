#!/bin/sh
# Startvalidierung des Containers.
#
# Zweck: fehlende Pflichtvariablen fuehren zu einem klaren Startabbruch statt
# zu einem scheinbar laufenden Container mit Platzhalterkonfiguration.
#
# Signalverhalten: "exec" ersetzt die Shell durch den Node-Prozess. Damit
# erreichen SIGTERM/SIGINT den Next.js-Server direkt (PID 1). Im Compose-Stack
# ist zusaetzlich "init: true" gesetzt, um Zombie-Prozesse auszuschliessen.
set -eu

node /app/docker/verify-runtime-config.mjs

exec "$@"
