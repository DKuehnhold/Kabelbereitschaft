// shadcn/ui-Standardhelfer: kombiniert bedingte Klassennamen (clsx) und löst
// widersprüchliche Tailwind-Utilities zugunsten der zuletzt genannten auf
// (tailwind-merge). Wird ausschließlich von den Copy-in-Komponenten unter
// src/components/ui/shadcn/ genutzt; die bestehenden AP8-Primitive
// (src/components/ui/primitives.tsx) bleiben unverändert und unabhängig.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
