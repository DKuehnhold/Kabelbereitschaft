import { PRIORITY_LABELS, PRIORITY_TONE, type Priority } from "@/lib/priority";
import { Badge } from "@/components/ui/primitives";

// AP11: nutzt das AP8-Badge-Primitive (Tokens/Tones), keine Farbklassen.
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
