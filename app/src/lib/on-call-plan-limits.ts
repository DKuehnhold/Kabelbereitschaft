// Obergrenze eines Zeitraums: 92 Tage (ein Quartal - das laengste
// Kalenderquartal, z. B. Juli-September, hat 92 Tage). Schutz gegen einen
// Tippfehler im Jahr (z. B. "Bis" versehentlich ein Jahr zu spaet gesetzt) -
// KEINE fachliche Wochentags- oder Serienregel (laut Negativliste nicht
// beauftragt). DIESELBE Zahl wird in OnCallPlanClient.tsx importiert und
// fuer die clientseitige Fruehwarnung VOR diesem Serverschritt verwendet -
// es gibt bewusst nur diese EINE Quelle, keinen zweiten, unabhaengig
// gepflegten Zahlenwert.
//
// AUFTRAG_24: eigenes, seiteneffektfreies Modul OHNE "use server". Next.js/
// Turbopack erlaubt in einer "use server"-Datei ausschliesslich
// `export async function`-Exporte (Typ-Exporte sind unschaedlich) - ein
// Wert-Export wie dieser wuerde dort ALLE Exporte des Moduls ungueltig
// machen (Build-Fehler "Only async functions are allowed to be exported in
// a 'use server' file", vgl. Dennis' lokalen Build vom 2026-08-18). Deshalb
// steht die Konstante hier, in einem reinen Daten-Modul ohne Import und
// ohne Seiteneffekt, und wird sowohl von on-call-plan-actions.ts (Server)
// als auch von OnCallPlanClient.tsx (Client) importiert. Bitte NICHT
// zurueck in on-call-plan-actions.ts verschieben.
export const MAX_RANGE_DAYS = 92;
