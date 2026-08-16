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

// AP9: Telefonnummerntyp (Ansprechpartner).
export type PhoneType = "mobil" | "festnetz" | "leitstelle" | "sonstige";

type AuditCols = {
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

// AP9: Verknüpfungstabellen werden nicht aktualisiert (nur angelegt/entfernt).
type CreateCols = {
  created_at: string;
  created_by: string | null;
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
  // AP9 additiv:
  wus_bst: string | null;
  default_on_call_number_id: string | null;
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
  contact_id: string | null;
  contact_phone_number_id: string | null;
  contact_name_snapshot: string | null;
  contact_function_snapshot: string | null;
  contact_phone_snapshot: string | null;
  construction_stage_id: string;
  // AP10: fachliche Referenzen (Legacy-Snapshotfelder bleiben erhalten)
  customer_id: string | null;
  vzg_line_id: string | null;
  vzg_line_number: string | null;
  km_from: number | null;
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

// AP11: Flache Sicht für die operative Vorgangsliste (View, security_invoker).
export type IncidentListView = {
  id: string;
  incident_no: number;
  status: IncidentStatus;
  priority: IncidentPriority;
  customer_id: string | null;
  customer_name: string | null;
  construction_stage_id: string | null;
  stage_code: string | null;
  stage_name: string | null;
  vzg_line_id: string | null;
  vzg_line_number: string | null;
  vzg_line_ref: string | null;
  on_call_number_id: string | null;
  on_call_number: string | null;
  on_call_label: string | null;
  operating_point: string | null;
  km_from: number | null;
  km_to: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  created_date_local: string;
  image_count: number;
  cable_arts: string[];
  monteur_names: string[];
  monteur_ids: string[];
  no_monteur: boolean;
  no_images: boolean;
  no_cable: boolean;
  historic_vzg: boolean;
  search_text: string;
  // AP13 additiv: offen = Aufgabe im Status 'open' oder 'in_progress'.
  has_open_task: boolean;
  is_false_alarm: boolean;
};

// =====================================================================
// AP13: Aufgaben je Vorgang (incident_tasks) und auditierbare Massenaktionen.
// Wertebereiche sind `text` mit Check-Constraints (keine neuen Enums).
// =====================================================================
export type IncidentTaskType = "no_monteur" | "no_images" | "no_cable" | "historic_vzg" | "manual";
export type IncidentTaskSource = "derived" | "manual";
export type IncidentTaskStatus = "open" | "in_progress" | "acknowledged" | "void";
export type IncidentTaskPriority = "low" | "normal" | "high";

export type IncidentTaskRow = {
  id: string;
  incident_id: string;
  task_type: IncidentTaskType;
  source: IncidentTaskSource;
  title: string;
  body: string | null;
  status: IncidentTaskStatus;
  priority: IncidentTaskPriority;
  due_at: string | null;
  // Einzige berechtigungswirksame persönliche Zuständigkeit; Team und Rolle
  // sind rein informative Filter-/Anzeigeattribute.
  assignee_profile_id: string | null;
  assignee_team_id: string | null;
  assignee_role: UserRole | null;
  // Genau bei status = 'acknowledged' beide gesetzt, sonst beide NULL.
  acknowledged_at: string | null;
  acknowledged_by: string | null;
} & AuditCols;

// Minimierte Monteur-Projektion der SECURITY-DEFINER-RPC.
export type AssignedIncidentTaskRow = {
  incident_id: string;
  task_type: IncidentTaskType;
  title: string;
  status: IncidentTaskStatus;
  due_at: string | null;
};

// Ergebniscodes der Einzel-/Massenaktionen (stabil, sprachneutral).
export type AssignMonteurAp13Code = "ok" | "conflict" | "not_found" | "invalid_monteur";
export type IncidentBulkActionCode =
  | "ok"
  | "conflict"
  | "not_found"
  | "guard_rejected"
  | "invalid_status"
  | "invalid_monteur";

export type IncidentBulkActionResult = {
  incident_id: string;
  ok: boolean;
  code: IncidentBulkActionCode;
};

// p_items-Elemente der Bulk-RPCs (jsonb-Array).
export type IncidentBulkStatusItem = { id: string; expected_updated_at: string };
export type IncidentBulkAssignItem = IncidentBulkStatusItem & { expected_monteur_ids: string[] };

// =====================================================================
// AP9: Stammdaten & Einstellungen
// =====================================================================
export type Customer = {
  id: string;
  name: string;
  erp_id: string | null;
  is_active: boolean;
} & AuditCols;

export type VzgLine = {
  id: string;
  line_number: string;
  description: string | null;
  construction_stage_id: string;
  is_active: boolean;
} & AuditCols;

export type Contact = {
  id: string;
  customer_id: string;
  name: string;
  function: string | null;
  email: string | null;
  is_active: boolean;
} & AuditCols;

export type ContactPhoneNumber = {
  id: string;
  contact_id: string;
  phone: string;
  phone_type: PhoneType;
  sort_order: number;
} & AuditCols;

export type ConstructionStageContact = {
  id: string;
  construction_stage_id: string;
  contact_id: string;
} & CreateCols;

export type Technician = {
  id: string;
  first_name: string;
  last_name: string;
  profile_id: string | null;
  is_active: boolean;
} & AuditCols;

export type Team = {
  id: string;
  name: string;
  is_active: boolean;
} & AuditCols;

export type TeamMember = {
  id: string;
  team_id: string;
  technician_id: string;
} & CreateCols;

export type CableType = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
} & AuditCols;

export type AppSettings = {
  id: number;
  default_customer_id: string | null;
  default_on_call_number_id: string | null;
} & AuditCols;

// AP10: Kabelpositionen je Vorgang (Kabelart positionsbezogen).
export type IncidentCablePosition = {
  id: string;
  incident_id: string;
  cable_type_id: string;
  sort_order: number;
  quantity_value: number | null;
  quantity_unit: "piece" | "meter" | null;
  condition_code: "ready" | "restricted" | "damaged" | "unusable" | null;
} & AuditCols;

// AP10: Argumente der transaktionalen RPCs (Incident + Pflicht-Kabelposition).
export type CreateIncidentAp10Args = {
  p_customer_id: string;
  p_construction_stage_id: string;
  p_vzg_line_id: string;
  p_on_call_number_id: string | null;
  p_priority: IncidentPriority;
  p_description: string;
  p_operating_point: string | null;
  p_track: string | null;
  p_direction: string | null;
  p_object_type: string | null;
  p_object_designation: string | null;
  p_location_description: string | null;
  p_external_reference: string | null;
  p_km_from: number | null;
  p_km_to: number | null;
  p_caller_name: string | null;
  p_caller_contact: string | null;
  p_internal_note: string | null;
  p_cable_type_id: string;
};
export type UpdateIncidentAp10Args = { p_id: string } & CreateIncidentAp10Args;

export type IncidentCablePositionInput = {
  id?: string;
  cable_type_id: string;
  quantity_value: number | string | null;
  quantity_unit: "piece" | "meter" | null;
  condition_code: "ready" | "restricted" | "damaged" | "unusable" | null;
};

export type CreateIncidentAp12Args = Omit<CreateIncidentAp10Args, "p_cable_type_id"> & {
  p_contact_id: string | null;
  p_contact_phone_number_id: string | null;
  p_cable_positions: IncidentCablePositionInput[];
};
export type UpdateIncidentAp12Args = { p_id: string } & CreateIncidentAp12Args;

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
      // AP9
      customers: Table<Customer>;
      vzg_lines: Table<VzgLine>;
      contacts: Table<Contact>;
      contact_phone_numbers: Table<ContactPhoneNumber>;
      construction_stage_contacts: Table<ConstructionStageContact>;
      technicians: Table<Technician>;
      teams: Table<Team>;
      team_members: Table<TeamMember>;
      cable_types: Table<CableType>;
      app_settings: Table<AppSettings>;
      // AP10
      incident_cable_positions: Table<IncidentCablePosition>;
      // AP13 (kein Delete: weder Policy noch Tabellenrecht)
      incident_tasks: Table<IncidentTaskRow>;
    };
    Views: {
      material_stock: { Row: MaterialStock; Relationships: [] };
      incident_list_view: { Row: IncidentListView; Relationships: [] };
    };
    Functions: {
      create_incident_ap10: { Args: CreateIncidentAp10Args; Returns: string };
      update_incident_ap10: { Args: UpdateIncidentAp10Args; Returns: undefined };
      create_incident_ap12: { Args: CreateIncidentAp12Args; Returns: string };
      update_incident_ap12: { Args: UpdateIncidentAp12Args; Returns: undefined };
      get_assigned_incident_contact: {
        Args: { p_incident_id: string };
        Returns: {
          incident_id: string;
          contact_name: string | null;
          contact_function: string | null;
          operative_phone: string | null;
        }[];
      };
      // AP13
      get_assigned_incident_tasks: {
        Args: { p_incident_id: string };
        Returns: AssignedIncidentTaskRow[];
      };
      refresh_incident_tasks_ap13: {
        Args: { p_incident_id?: string | null };
        Returns: number;
      };
      assign_incident_monteur_ap13: {
        Args: {
          p_incident_id: string;
          p_monteur_id: string;
          p_expected_updated_at: string;
          p_expected_monteur_ids: string[];
        };
        Returns: AssignMonteurAp13Code;
      };
      bulk_update_incident_status_ap13: {
        Args: { p_items: IncidentBulkStatusItem[]; p_new_status: IncidentStatus };
        Returns: IncidentBulkActionResult[];
      };
      bulk_assign_incident_monteur_ap13: {
        Args: { p_items: IncidentBulkAssignItem[]; p_monteur_id: string };
        Returns: IncidentBulkActionResult[];
      };
    };
    Enums: {
      user_role: UserRole;
      incident_status: IncidentStatus;
      condition_rating: ConditionRating;
      incident_priority: IncidentPriority;
      image_category: ImageCategory;
      storage_location_type: StorageLocationType;
      movement_type: MovementType;
      location_correction_status: LocationCorrectionStatus;
      phone_type: PhoneType;
    };
    CompositeTypes: Record<string, never>;
  };
};
