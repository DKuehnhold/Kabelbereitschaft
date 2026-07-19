// Handgepflegte Typen fuer das Kabelbereitschaft-Datenmodell.
// Spiegeln die Migration supabase/migrations/0001_init.sql wider.
// Koennen spaeter durch `supabase gen types typescript` ersetzt werden.

export type UserRole = "admin" | "disponent" | "monteur";

export type IncidentStatus =
  | "neu"
  | "monteur_zugewiesen"
  | "einsatz_angenommen"
  | "anfahrt"
  | "vor_ort"
  | "zustandsaufnahme"
  | "in_bearbeitung"
  | "warten_auf_material"
  | "warten_auf_db"
  | "uebergabe_erforderlich"
  | "provisorisch_instandgesetzt"
  | "technisch_abgeschlossen"
  | "dokumentation_vollstaendig"
  | "durch_disposition_geprueft"
  | "abgeschlossen"
  | "storniert"
  | "fehlalarm";

export type ConditionRating =
  | "keine_beschaedigung"
  | "geringfuegig_beschaedigt"
  | "funktionsfaehig_mit_einschraenkung"
  | "provisorisch_instandgesetzt"
  | "nicht_betriebsbereit"
  | "sofortiger_handlungsbedarf"
  | "weitere_pruefung_erforderlich";

export type IncidentPriority = "niedrig" | "normal" | "hoch" | "kritisch";

export type ImageCategory =
  | "uebersicht"
  | "zugang"
  | "schadstelle"
  | "zustand_vor_arbeit"
  | "arbeitsausfuehrung"
  | "materialeinsatz"
  | "zustand_nach_arbeit"
  | "restmangel"
  | "sonstige_dokumentation"
  // AP4 additiv:
  | "schaden"
  | "detail"
  | "reparatur"
  | "abschluss"
  | "material"
  | "sonstiges";

export type StorageLocationType =
  | "zentrallager"
  | "fahrzeuglager"
  | "baustellenlager"
  | "materialcontainer"
  | "temporaeres_lager";

export type MovementType =
  | "wareneingang"
  | "entnahme_vorgang"
  | "rueckgabe"
  | "umbuchung"
  | "korrektur"
  | "verlust"
  | "beschaedigung"
  | "verbrauch";

export type LocationCorrectionStatus =
  | "vorgeschlagen"
  | "akzeptiert"
  | "abgelehnt";

type AuditCols = {
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
} & AuditCols;

export type ConstructionStage = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
} & AuditCols;

export type OnCallNumber = {
  id: string;
  number: string;
  label: string | null;
  is_active: boolean;
} & AuditCols;

export type Incident = {
  id: string;
  incident_no: number;
  status: IncidentStatus;
  condition_rating: ConditionRating | null;
  priority: IncidentPriority;
  on_call_number_id: string | null;
  call_received_at: string | null;
  call_taken_by: string | null;
  caller_name: string | null;
  caller_contact: string | null;
  construction_stage_id: string;
  vzg_line_number: string;
  km_from: number;
  km_to: number | null;
  operating_point: string | null;
  track: string | null;
  direction: string | null;
  object_type: string | null;
  object_designation: string | null;
  location_description: string | null;
  external_reference: string | null;
  title: string | null;
  description: string | null;
  internal_note: string | null;
  closing_note: string | null;
  closed_at: string | null;
  closed_by: string | null;
} & AuditCols;

export type IncidentAssignment = {
  id: string;
  incident_id: string;
  monteur_id: string;
  assigned_by: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  is_active: boolean;
};

export type IncidentStatusHistory = {
  id: string;
  incident_id: string;
  old_status: IncidentStatus | null;
  new_status: IncidentStatus;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type IncidentNote = {
  id: string;
  incident_id: string;
  note_type: string;
  body: string;
  created_at: string;
  created_by: string | null;
  image_id: string | null;
};

export type IncidentImage = {
  id: string;
  incident_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  category: ImageCategory;
  description: string | null;
  file_hash: string | null;
  exif_present: boolean;
  taken_at: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  orientation: number | null;
  camera_model: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type IncidentLocationCorrection = {
  id: string;
  incident_id: string;
  gps_lat: number | null;
  gps_lon: number | null;
  description: string | null;
  status: LocationCorrectionStatus;
  proposed_by: string | null;
  proposed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type Material = {
  id: string;
  material_no: string | null;
  name: string;
  category: string | null;
  manufacturer: string | null;
  unit: string;
  min_stock: number | null;
  purchase_price: number | null;
  note: string | null;
  is_active: boolean;
} & AuditCols;

export type StorageLocation = {
  id: string;
  name: string;
  location_type: StorageLocationType;
  address: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  responsible_person: string | null;
  note: string | null;
  is_active: boolean;
} & AuditCols;

export type InventoryMovement = {
  id: string;
  material_id: string;
  quantity: number;
  unit: string;
  movement_type: MovementType;
  source_location_id: string | null;
  target_location_id: string | null;
  incident_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

export type AuditEvent = {
  id: string;
  entity: string;
  entity_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  actor: string | null;
  created_at: string;
};

export type MaterialStock = {
  material_id: string;
  location_id: string;
  quantity: number;
};

// AP6: Deduplizierung/Idempotenz der Offline-Synchronisation.
export type SyncAction = {
  id: string;
  actor: string;
  client_action_id: string;
  kind: string;
  incident_id: string | null;
  applied_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      construction_stages: Table<ConstructionStage>;
      on_call_numbers: Table<OnCallNumber>;
      incidents: Table<Incident>;
      incident_assignments: Table<IncidentAssignment>;
      incident_status_history: Table<IncidentStatusHistory>;
      incident_notes: Table<IncidentNote>;
      incident_images: Table<IncidentImage>;
      incident_location_corrections: Table<IncidentLocationCorrection>;
      materials: Table<Material>;
      storage_locations: Table<StorageLocation>;
      inventory_movements: Table<InventoryMovement>;
      audit_events: Table<AuditEvent>;
      sync_actions: Table<SyncAction>;
    };
    Views: {
      material_stock: { Row: MaterialStock; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      incident_status: IncidentStatus;
      condition_rating: ConditionRating;
      incident_priority: IncidentPriority;
      image_category: ImageCategory;
      storage_location_type: StorageLocationType;
      movement_type: MovementType;
      location_correction_status: LocationCorrectionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
