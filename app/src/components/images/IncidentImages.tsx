import { listIncidentImages } from "@/lib/images-server";
import { ImageGallery } from "@/components/images/ImageGallery";

// Server-Wrapper: lädt (RLS-gefiltert) die nicht gelöschten Bilder inkl.
// signierter URLs und rendert die interaktive Galerie.
export async function IncidentImages({
  incidentId,
  currentUserId,
  isStaff,
}: {
  incidentId: string;
  currentUserId: string;
  isStaff: boolean;
}) {
  const images = await listIncidentImages(incidentId);
  return (
    <ImageGallery
      incidentId={incidentId}
      images={images}
      canUpload={true}
      currentUserId={currentUserId}
      isStaff={isStaff}
    />
  );
}
