-- =====================================================================
-- Kabelbereitschaft – Storage (Migration 0002)
-- Privater Bucket fuer Vorgangsbilder + Zugriffsrichtlinien.
-- Pfadkonvention: incidents/<incident_id>/<dateiname>
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('incident-images', 'incident-images', false)
on conflict (id) do nothing;

-- Lesen: Disposition/Admin oder zugewiesener Monteur des Vorgangs
create policy "incident_images_read"
on storage.objects for select
using (
  bucket_id = 'incident-images'
  and (storage.foldername(name))[1] = 'incidents'
  and (
    public.is_staff()
    or public.is_assigned_to_incident(((storage.foldername(name))[2])::uuid)
  )
);

-- Hochladen: Disposition/Admin oder zugewiesener Monteur
create policy "incident_images_insert"
on storage.objects for insert
with check (
  bucket_id = 'incident-images'
  and (storage.foldername(name))[1] = 'incidents'
  and (
    public.is_staff()
    or public.is_assigned_to_incident(((storage.foldername(name))[2])::uuid)
  )
);

-- Loeschen: nur Administrator
create policy "incident_images_delete"
on storage.objects for delete
using (bucket_id = 'incident-images' and public.is_admin());
