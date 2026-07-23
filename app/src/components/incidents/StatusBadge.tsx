import { STATUS_LABELS, STATUS_TONE, type IncidentStatus } from "@/lib/status";
import { Badge } from "@/components/ui/primitives";

// AP11: nutzt das AP8-Badge-Primitive (Tokens/Tones), keine Farbklassen.
export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}
