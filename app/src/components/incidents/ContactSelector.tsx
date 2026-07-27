"use client";

import { useMemo, useState } from "react";
import type { IncidentFormContact } from "@/lib/incidents";

export function ContactSelector({
  contacts,
  customerId,
  initialContactId = "",
  initialPhoneId = "",
}: {
  contacts: IncidentFormContact[];
  customerId: string;
  initialContactId?: string;
  initialPhoneId?: string;
}) {
  const [contactId, setContactId] = useState(initialContactId);
  const [phoneId, setPhoneId] = useState(initialPhoneId);
  const available = useMemo(() => contacts.filter((c) => c.customer_id === customerId), [contacts, customerId]);
  const contact = available.find((c) => c.id === contactId);
  const selectedContactId = contact?.id ?? "";
  const selectedPhoneId = contact?.phones.some((p) => p.id === phoneId) ? phoneId : "";

  const changeContact = (id: string) => {
    setContactId(id);
    const next = available.find((c) => c.id === id);
    setPhoneId(next?.phones[0]?.id ?? "");
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contact_id">Ansprechpartner</label>
        <select id="contact_id" name="contact_id" value={selectedContactId} onChange={(e) => changeContact(e.target.value)} className="input">
          <option value="">— Freitext verwenden —</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.function ? ` – ${c.function}` : ""}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="contact_phone_number_id">Operative Telefonnummer</label>
        <select
          id="contact_phone_number_id"
          name="contact_phone_number_id"
          value={selectedPhoneId}
          onChange={(e) => setPhoneId(e.target.value)}
          disabled={!contact}
          className="input"
        >
          <option value="">— keine —</option>
          {contact?.phones.map((p) => (
            <option key={p.id} value={p.id}>{p.phone} ({p.phone_type})</option>
          ))}
        </select>
      </div>
    </div>
  );
}
