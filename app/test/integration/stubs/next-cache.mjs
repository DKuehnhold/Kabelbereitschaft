// Ersatz fuer `next/cache` in den Integrationstests der Fachmodule.
//
// `revalidatePath()` gehoert zur Next-Laufzeit und existiert in einem reinen
// Node-Prozess nicht. Fuer die Pruefung der Server Actions ist nur eines
// wichtig: DASS revalidiert wird und mit welchem Pfad. Genau das wird hier
// protokolliert; ausgefuehrt wird nichts. Der zu pruefende Code bleibt
// unveraendert der echte.

/** Protokoll aller Aufrufe in Reihenfolge: { fn, args }. */
export const revalidateCalls = [];

export function revalidatePath(...args) {
  revalidateCalls.push({ fn: "revalidatePath", args });
}

export function revalidateTag(...args) {
  revalidateCalls.push({ fn: "revalidateTag", args });
}

/** Protokoll leeren - damit jeder Fall relativ zu seinem eigenen Stand messen kann. */
export function resetRevalidateCalls() {
  revalidateCalls.length = 0;
}

/** Nur die Pfade der `revalidatePath`-Aufrufe, in Aufrufreihenfolge. */
export function revalidatedPaths() {
  return revalidateCalls
    .filter((call) => call.fn === "revalidatePath")
    .map((call) => call.args[0]);
}
