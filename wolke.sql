-- Tabelle und Rechte für den Abgleich mit der Wolke.
--
-- Einmal im SQL-Editor des eigenen Supabase-Projekts ausführen.
-- Danach in den Einstellungen der App Adresse und öffentlichen Schlüssel
-- (Project URL und anon key) eintragen und anmelden.

create table if not exists public.karteikasten (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  id         text    not null,
  art        text    not null,
  daten      jsonb   not null default '{}'::jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

create index if not exists karteikasten_geaendert
  on public.karteikasten (user_id, updated_at);

alter table public.karteikasten enable row level security;

-- Jede Kennung sieht und ändert ausschließlich die eigenen Zeilen.
drop policy if exists "eigene zeilen lesen" on public.karteikasten;
create policy "eigene zeilen lesen" on public.karteikasten
  for select using (auth.uid() = user_id);

drop policy if exists "eigene zeilen schreiben" on public.karteikasten;
create policy "eigene zeilen schreiben" on public.karteikasten
  for insert with check (auth.uid() = user_id);

drop policy if exists "eigene zeilen aendern" on public.karteikasten;
create policy "eigene zeilen aendern" on public.karteikasten
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene zeilen loeschen" on public.karteikasten;
create policy "eigene zeilen loeschen" on public.karteikasten
  for delete using (auth.uid() = user_id);

-- Ablage für Bilder auf Karteikarten.
insert into storage.buckets (id, name, public)
  values ('bilder', 'bilder', false)
  on conflict (id) do nothing;

drop policy if exists "eigene bilder" on storage.objects;
create policy "eigene bilder" on storage.objects
  for all
  using (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text);

-- Den Zwischenspeicher der Schnittstelle neu einlesen. Ohne diese Zeile kann
-- es einen Moment dauern, bis die neue Tabelle gefunden wird; die Meldung
-- lautet dann "Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';
