import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/shadcn/accordion";
import {
  listVzgLines,
  getActiveStageOptions,
  listStages,
  getActiveOnCallOptions,
  listContacts,
  getActiveCustomers,
  getActiveContactFunctionOptions,
  listCustomers,
  listTechnicians,
  listProfileOptions,
  listQualifications,
  listTechnicianQualificationLinks,
  listTeams,
  getActiveTechnicians,
  listCableTypes,
  listTrades,
  listContactFunctions,
  listObjectTypes,
  listOnCallNumbers,
  getAppSettings,
} from "@/lib/masterdata";
import { VzgLinesClient } from "@/components/masterdata/VzgLinesClient";
import { StagesClient } from "@/components/masterdata/StagesClient";
import { ContactsClient } from "@/components/masterdata/ContactsClient";
import { CustomersClient } from "@/components/masterdata/CustomersClient";
import { TechniciansClient } from "@/components/masterdata/TechniciansClient";
import { TeamsClient } from "@/components/masterdata/TeamsClient";
import { CableTypesClient } from "@/components/masterdata/CableTypesClient";
import { TradesClient } from "@/components/masterdata/TradesClient";
import { ContactFunctionsClient } from "@/components/masterdata/ContactFunctionsClient";
import { ObjectTypesClient } from "@/components/masterdata/ObjectTypesClient";
import { QualificationsClient } from "@/components/masterdata/QualificationsClient";
import { OnCallNumbersClient } from "@/components/masterdata/OnCallNumbersClient";
import { SettingsClient } from "@/components/masterdata/SettingsClient";

export const dynamic = "force-dynamic";

// AUFTRAG_16: Übersichtsseite /stammdaten - alle 13 Pflegearten als
// Akkordeon, Aufklappen zeigt die Pflege inline (keine Seitennavigation).
// Die 13 Einzelrouten bleiben unverändert bestehen und weiterhin direkt
// aufrufbar (Link "Einzelseite öffnen" je Abschnitt). Reihenfolge laut
// Entscheidung Dennis vom 2026-08-18: VzG-Strecken, Bauabschnitte,
// Ansprechpartner fest vorgegeben, danach die bestehende Reihenfolge aus
// lib/roles.ts (NAV_GROUPS "Stammdaten"). Jede Client-Komponente wird
// unverändert mit denselben Props wie auf ihrer Einzelseite eingebunden.
export default async function StammdatenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;

  // Eine gemeinsame Ladung fuer alle 13 Abschnitte - Vereinigung der
  // Promise.all-Bloecke der Einzelseiten. Mehrfach benoetigte
  // Optionslisten (getActiveStageOptions, getActiveOnCallOptions,
  // getActiveCustomers, listQualifications) werden hier einmal geladen und
  // unten an mehrere Abschnitte weitergereicht.
  const [
    vzgLines,
    stageOptions,
    stages,
    onCallOptions,
    contacts,
    activeCustomers,
    contactFunctionOptions,
    customers,
    technicians,
    profileOptions,
    qualifications,
    technicianQualificationLinks,
    teams,
    activeTechnicians,
    cableTypes,
    trades,
    contactFunctions,
    objectTypes,
    onCallNumbers,
    settings,
  ] = await Promise.all([
    listVzgLines(),
    getActiveStageOptions(),
    listStages(),
    getActiveOnCallOptions(),
    listContacts(),
    getActiveCustomers(),
    getActiveContactFunctionOptions(),
    listCustomers(),
    listTechnicians(),
    listProfileOptions(),
    listQualifications(),
    listTechnicianQualificationLinks(),
    listTeams(),
    getActiveTechnicians(),
    listCableTypes(),
    listTrades(),
    listContactFunctions(),
    listObjectTypes(),
    listOnCallNumbers(),
    getAppSettings(),
  ]);

  // Monteure: Qualifikations-Zuordnung wie auf der Einzelseite gruppieren.
  const qualificationIdsByTechnician: Record<string, string[]> = {};
  for (const link of technicianQualificationLinks) {
    (qualificationIdsByTechnician[link.technician_id] ??= []).push(link.qualification_id);
  }

  // Teams: Monteur-Optionen wie auf der Einzelseite ableiten.
  const technicianOptions = activeTechnicians.map((t) => ({
    id: t.id,
    label: `${t.last_name}, ${t.first_name}`,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stammdaten"
        subtitle="Alle Stammdatenarten an einem Ort - aufklappen zum Pflegen, ohne Seitenwechsel."
      />
      <Accordion type="multiple" className="rounded-md border bg-surface">
        <AccordionSection
          value="vzg"
          title="VzG-Strecken"
          subtitle="Vierstellige Streckennummern je Bauabschnitt."
          href="/stammdaten/vzg"
        >
          <VzgLinesClient lines={vzgLines} stageOptions={stageOptions} />
        </AccordionSection>

        <AccordionSection
          value="bauabschnitte"
          title="Bauabschnitte"
          subtitle="Baustufen inkl. WUS-BST und Standard-Bereitschaftsnummer."
          href="/stammdaten/bauabschnitte"
        >
          <StagesClient stages={stages} onCallOptions={onCallOptions} />
        </AccordionSection>

        <AccordionSection
          value="ansprechpartner"
          title="Ansprechpartner"
          subtitle="Kontakte je Kunde inkl. Telefonnummern und Bauabschnitts-Zuordnung."
          href="/stammdaten/ansprechpartner"
        >
          <ContactsClient
            contacts={contacts}
            customers={activeCustomers}
            stageOptions={stageOptions}
            functionOptions={contactFunctionOptions}
          />
        </AccordionSection>

        <AccordionSection
          value="kunden"
          title="Kunden"
          subtitle="Stammdaten der Auftraggeber (intern)."
          href="/stammdaten/kunden"
        >
          <CustomersClient customers={customers} />
        </AccordionSection>

        <AccordionSection
          value="monteure"
          title="Monteure"
          subtitle="Monteur-Stammdaten mit optionalem CSV-Import."
          href="/stammdaten/monteure"
        >
          <TechniciansClient
            technicians={technicians}
            profileOptions={profileOptions}
            qualifications={qualifications}
            qualificationIdsByTechnician={qualificationIdsByTechnician}
          />
        </AccordionSection>

        <AccordionSection
          value="teams"
          title="Teams"
          subtitle="Teams und Mitglieder (Mehrfachmitgliedschaft möglich)."
          href="/stammdaten/teams"
        >
          <TeamsClient teams={teams} technicianOptions={technicianOptions} />
        </AccordionSection>

        <AccordionSection
          value="kabelarten"
          title="Kabelarten"
          subtitle="Referenzliste der Kabelarten inkl. Unbekannt."
          href="/stammdaten/kabelarten"
        >
          <CableTypesClient cableTypes={cableTypes} />
        </AccordionSection>

        <AccordionSection
          value="gewerke"
          title="Gewerke"
          subtitle="Referenzliste der Gewerke."
          href="/stammdaten/gewerke"
        >
          <TradesClient trades={trades} />
        </AccordionSection>

        <AccordionSection
          value="funktionen"
          title="Funktionen"
          subtitle="Referenzliste der Funktionen des Anrufenden/Ansprechpartners."
          href="/stammdaten/funktionen"
        >
          <ContactFunctionsClient functions={contactFunctions} />
        </AccordionSection>

        <AccordionSection
          value="objektarten"
          title="Objektarten"
          subtitle="Referenzliste der Objektarten (Anlagen, inkl. LST-Elemente)."
          href="/stammdaten/objektarten"
        >
          <ObjectTypesClient objectTypes={objectTypes} />
        </AccordionSection>

        <AccordionSection
          value="qualifikationen"
          title="Qualifikationen"
          subtitle="Rangfolge und Farbe je Qualifikation - die höchste Qualifikation eines Monteurs bestimmt seine Farbe im Dispo-Board."
          href="/stammdaten/qualifikationen"
        >
          <QualificationsClient qualifications={qualifications} />
        </AccordionSection>

        <AccordionSection
          value="bereitschaftsnummern"
          title="Bereitschaftsnummern"
          subtitle="Operative Rufnummern für Bereitschaftsvorgänge verwalten."
          href="/stammdaten/bereitschaftsnummern"
        >
          <OnCallNumbersClient rows={onCallNumbers} />
        </AccordionSection>

        <AccordionSection
          value="einstellungen"
          title="Einstellungen"
          subtitle="Standardkunde und Standard-Bereitschaftsnummer."
          href="/stammdaten/einstellungen"
        >
          <SettingsClient settings={settings} customers={activeCustomers} onCallOptions={onCallOptions} />
        </AccordionSection>
      </Accordion>
    </div>
  );
}

function AccordionSection({
  value,
  title,
  subtitle,
  href,
  children,
}: {
  value: string;
  title: string;
  subtitle: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-b px-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <AccordionTrigger className="py-4">
            <div className="text-left">
              <div className="font-semibold text-foreground">{title}</div>
              <p className="mt-0.5 text-sm font-normal text-muted">{subtitle}</p>
            </div>
          </AccordionTrigger>
        </div>
        <Link
          href={href}
          className="mt-4 shrink-0 text-sm text-primary underline-offset-4 hover:underline"
        >
          Einzelseite öffnen
        </Link>
      </div>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}
