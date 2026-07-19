// Vorgangsstatus und technische Zustandsbewertung (getrennte Felder).
// Codes entsprechen den PostgreSQL-Enums der Migration.

export const INCIDENT_STATUS = [
  "neu",
  "monteur_zugewiesen",
  "einsatz_angenommen",
  "anfahrt",
  "vor_ort",
  "zustandsaufnahme",
  "in_bearbeitung",
  "warten_auf_material",
  "warten_auf_db",
  "uebergabe_erforderlich",
  "provisorisch_instandgesetzt",
  "technisch_abgeschlossen",
  "dokumentation_vollstaendig",
  "durch_disposition_geprueft",
  "abgeschlossen",
  "storniert",
  "fehlalarm",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUS)[number];

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  neu: "Neu",
  monteur_zugewiesen: "Monteur zugewiesen",
  einsatz_angenommen: "Einsatz angenommen",
  anfahrt: "Anfahrt",
  vor_ort: "Vor Ort",
  zustandsaufnahme: "Zustandsaufnahme",
  in_bearbeitung: "In Bearbeitung",
  warten_auf_material: "Warten auf Material",
  warten_auf_db: "Warten auf DB",
  uebergabe_erforderlich: "Übergabe erforderlich",
  provisorisch_instandgesetzt: "Provisorisch instandgesetzt",
  technisch_abgeschlossen: "Technisch abgeschlossen",
  dokumentation_vollstaendig: "Dokumentation vollständig",
  durch_disposition_geprueft: "Durch Disposition geprüft",
  abgeschlossen: "Abgeschlossen",
  storniert: "Storniert",
  fehlalarm: "Fehlalarm",
};

// Status, die Monteure nicht selbst setzen duerfen (nur Disposition/Admin).
export const STAFF_ONLY_STATUS: IncidentStatus[] = [
  "durch_disposition_geprueft",
  "abgeschlossen",
  "storniert",
];

export const CONDITION_RATING = [
  "keine_beschaedigung",
  "geringfuegig_beschaedigt",
  "funktionsfaehig_mit_einschraenkung",
  "provisorisch_instandgesetzt",
  "nicht_betriebsbereit",
  "sofortiger_handlungsbedarf",
  "weitere_pruefung_erforderlich",
] as const;

export type ConditionRating = (typeof CONDITION_RATING)[number];

export const CONDITION_LABELS: Record<ConditionRating, string> = {
  keine_beschaedigung: "Keine Beschädigung erkennbar",
  geringfuegig_beschaedigt: "Geringfügig beschädigt",
  funktionsfaehig_mit_einschraenkung: "Funktionsfähig mit Einschränkung",
  provisorisch_instandgesetzt: "Provisorisch instandgesetzt",
  nicht_betriebsbereit: "Nicht betriebsbereit",
  sofortiger_handlungsbedarf: "Sofortiger Handlungsbedarf",
  weitere_pruefung_erforderlich: "Weitere Prüfung erforderlich",
};

export const IMAGE_CATEGORIES = [
  "uebersicht",
  "zugang",
  "schadstelle",
  "zustand_vor_arbeit",
  "arbeitsausfuehrung",
  "materialeinsatz",
  "zustand_nach_arbeit",
  "restmangel",
  "sonstige_dokumentation",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  uebersicht: "Übersicht",
  zugang: "Zugang",
  schadstelle: "Schadstelle",
  zustand_vor_arbeit: "Zustand vor Arbeit",
  arbeitsausfuehrung: "Arbeitsausführung",
  materialeinsatz: "Materialeinsatz",
  zustand_nach_arbeit: "Zustand nach Arbeit",
  restmangel: "Restmangel",
  sonstige_dokumentation: "Sonstige Dokumentation",
};

export const MOVEMENT_TYPES = [
  "wareneingang",
  "entnahme_vorgang",
  "rueckgabe",
  "umbuchung",
  "korrektur",
  "verlust",
  "beschaedigung",
  "verbrauch",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  wareneingang: "Wareneingang",
  entnahme_vorgang: "Entnahme für Vorgang",
  rueckgabe: "Rückgabe",
  umbuchung: "Umbuchung",
  korrektur: "Korrektur",
  verlust: "Verlust",
  beschaedigung: "Beschädigung",
  verbrauch: "Verbrauch",
};

export const STORAGE_LOCATION_TYPES = [
  "zentrallager",
  "fahrzeuglager",
  "baustellenlager",
  "materialcontainer",
  "temporaeres_lager",
] as const;

export type StorageLocationType = (typeof STORAGE_LOCATION_TYPES)[number];

export const STORAGE_LOCATION_TYPE_LABELS: Record<StorageLocationType, string> = {
  zentrallager: "Zentrallager",
  fahrzeuglager: "Fahrzeuglager",
  baustellenlager: "Baustellenlager",
  materialcontainer: "Materialcontainer",
  temporaeres_lager: "Temporäres Lager",
};
