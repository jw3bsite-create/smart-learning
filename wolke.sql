-- Tabelle und Rechte für den Abgleich mit der Wolke.
--
-- Einmal im SQL-Editor des eigenen Supabase-Projekts ausführen.
-- Danach in den Einstellungen der App Adresse und öffentlichen Schlüssel
-- (Project URL und anon key) eintragen und anmelden.
--
-- Fassung 5 (Oktober 2026). Wer eine frühere Fassung schon ausgeführt
-- hat, führt diese einfach noch einmal aus; jeder Schritt verträgt das.
-- Daten gehen dabei nicht verloren.
--
-- Nach dem Anlegen der eigenen Kennung: Authentication → Sign In / Providers
-- → "Allow new users to sign up" abschalten. Sonst kann sich jeder, der
-- Adresse und öffentlichen Schlüssel kennt, ein eigenes Konto anlegen. Deine
-- Daten sähe er nicht (dafür sorgen die Zeilenregeln), aber er könnte dein
-- kostenloses Kontingent füllen.

create table if not exists public.karteikasten (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  id         text    not null,
  art        text    not null,
  daten      jsonb   not null default '{}'::jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, art, id)
);

-- ---------------------------------------------------------------------
-- Die Art gehört in den Schlüssel (Fassung 3 dieser Datei).
--
-- Eine Karteikarte und ihr Übungsstand tragen dieselbe Kennung — die eine
-- liegt in `cards`, der andere in `progress`. Mit dem alten Schlüssel
-- (user_id, id) trafen beide auf dieselbe Zeile: Im selben Schwung geschickt,
-- brach der Abgleich mit „ON CONFLICT DO UPDATE command cannot affect row a
-- second time" ab, einzeln geschickt hätte der eine den anderen überschrieben.
--
-- Vorhandene Zeilen bleiben, wo sie sind: Der neue Schlüssel ist weiter
-- gefasst als der alte, Doppelungen kann es darum nicht geben.
-- ---------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where i.indrelid = 'public.karteikasten'::regclass
       and i.indisprimary
       and i.indnatts = 2
  ) then
    alter table public.karteikasten drop constraint karteikasten_pkey;
    alter table public.karteikasten add primary key (user_id, art, id);
  end if;
end $$;

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

-- ---------------------------------------------------------------------
-- Zeitstempel des Servers (Fassung 2 dieser Datei).
--
-- `updated_at` ist die Uhrzeit der Änderung auf dem Gerät. Danach zu fragen,
-- was seit dem letzten Abgleich neu ist, verliert Änderungen: Wer offline
-- lernt und erst abends hochlädt, schickt Zeilen mit einer Uhrzeit, die das
-- andere Gerät längst hinter sich hat. `geaendert` ist darum die Uhrzeit, zu
-- der die Zeile hier ankam — und die setzt der Server selbst.
-- ---------------------------------------------------------------------

alter table public.karteikasten add column if not exists geaendert bigint;
update public.karteikasten set geaendert = updated_at where geaendert is null;
alter table public.karteikasten
  alter column geaendert set default ((extract(epoch from clock_timestamp()) * 1000)::bigint);
alter table public.karteikasten alter column geaendert set not null;

create or replace function public.karteikasten_stempeln() returns trigger
  language plpgsql as $$
begin
  new.geaendert := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return new;
end $$;

drop trigger if exists karteikasten_stempeln on public.karteikasten;
create trigger karteikasten_stempeln
  before insert or update on public.karteikasten
  for each row execute function public.karteikasten_stempeln();

create index if not exists karteikasten_angekommen
  on public.karteikasten (user_id, geaendert);

-- Schreiben nur, wenn die Zeile neuer ist als die vorhandene. Ohne diese
-- Bedingung überschriebe ein Gerät mit altem Stand die Änderung eines
-- anderen, das inzwischen weiter war. Läuft mit den Rechten des Aufrufers:
-- Die Zeilenregeln oben gelten also auch hier.
create or replace function public.karteikasten_schreiben(zeilen jsonb) returns integer
  language plpgsql security invoker as $$
declare
  anzahl integer;
begin
  insert into public.karteikasten (user_id, id, art, daten, updated_at, deleted)
  -- distinct on: Kommt dieselbe Zeile zweimal im selben Schwung, zählt die
  -- jüngere. Postgres bräche sonst den ganzen Aufruf ab.
  select distinct on (z->>'art', z->>'id')
         auth.uid(), z->>'id', z->>'art', coalesce(z->'daten', '{}'::jsonb),
         (z->>'updated_at')::bigint, coalesce((z->>'deleted')::boolean, false)
    from jsonb_array_elements(zeilen) as z
   order by z->>'art', z->>'id', (z->>'updated_at')::bigint desc
  on conflict (user_id, art, id) do update
    set art = excluded.art, daten = excluded.daten,
        updated_at = excluded.updated_at, deleted = excluded.deleted
    where excluded.updated_at >= public.karteikasten.updated_at;
  get diagnostics anzahl = row_count;
  return anzahl;
end $$;

revoke all on function public.karteikasten_schreiben(jsonb) from public, anon;
grant execute on function public.karteikasten_schreiben(jsonb) to authenticated;

-- Ablage für Bilder auf Karteikarten.
insert into storage.buckets (id, name, public)
  values ('bilder', 'bilder', false)
  on conflict (id) do nothing;

drop policy if exists "eigene bilder" on storage.objects;
create policy "eigene bilder" on storage.objects
  for all
  using (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Push-Nachrichten (Fassung 4 dieser Datei).
--
-- Damit die Tageserinnerung auch bei geschlossener App kommt, schickt ein
-- Auftrag auf GitHub sie stündlich (werkzeug/push-senden.mjs). Er braucht
-- dafür drei Dinge, und nur diese:
--
--   anchor_push_zugang  je Kennung: der öffentliche Push-Schlüssel und der
--                       Fingerabdruck (SHA-256) des Geheimnisses, das nur
--                       noch als GitHub-Secret existiert
--   anchor_push_abo     je Gerät: wohin die Nachricht geht und ab wann
--   anchor_lage         je Kennung: wie viele Karten an den nächsten Tagen
--                       fällig sind — nur Zahlen, keine Inhalte
--
-- Die App liest und schreibt das wie alles andere nur mit den eigenen
-- Rechten (Zeilenregeln). Der Auftrag dagegen ist nicht angemeldet. Er ruft
-- zwei Funktionen auf, die nur antworten, wenn er das richtige Geheimnis
-- mitbringt, und dann nur Abonnements und Zahlen herausgeben. Den
-- service_role key braucht es dafür nicht.
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.anchor_push_zugang (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  oeffentlich     text not null,
  geheimnis_hash  text not null,
  geaendert       timestamptz not null default now()
);

create table if not exists public.anchor_push_abo (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null,
  abo        jsonb not null,
  stunde     integer not null default 17,
  zeitzone   text not null default 'Europe/Berlin',
  letzte     text,
  geaendert  timestamptz not null default now(),
  primary key (user_id, endpoint)
);

-- Mehrere Uhrzeiten je Wochentag (Fassung 5): { "1": ["07:00", "17:00"], … }.
-- Ohne Zeitplan gilt weiter die eine Stunde für jeden Tag; `letzte` hält
-- seitdem Tag und Uhrzeit der zuletzt gesendeten Nachricht.
alter table public.anchor_push_abo add column if not exists zeitplan jsonb;

create table if not exists public.anchor_lage (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  plan       jsonb not null default '{}'::jsonb,
  geaendert  timestamptz not null default now()
);

alter table public.anchor_push_zugang enable row level security;
alter table public.anchor_push_abo    enable row level security;
alter table public.anchor_lage        enable row level security;

drop policy if exists "eigener zugang" on public.anchor_push_zugang;
create policy "eigener zugang" on public.anchor_push_zugang
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene abos" on public.anchor_push_abo;
create policy "eigene abos" on public.anchor_push_abo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene lage" on public.anchor_lage;
create policy "eigene lage" on public.anchor_lage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Was der Auftrag sehen darf: Abonnements und Zahlen der Kennung, zu der
-- das Geheimnis gehört. Ohne passendes Geheimnis: nichts.
-- Die Spalten der Antwort haben sich mit Fassung 5 geändert; das lässt
-- Postgres nur zu, wenn die alte Funktion vorher weicht.
drop function if exists public.anchor_push_auftraege(text);
create function public.anchor_push_auftraege(geheimnis text)
  returns table (endpoint text, abo jsonb, stunde integer, zeitzone text, letzte text, plan jsonb,
                 zeitplan jsonb)
  language sql security definer set search_path = public, extensions as $$
  select a.endpoint, a.abo, a.stunde, a.zeitzone, a.letzte, coalesce(l.plan, '{}'::jsonb), a.zeitplan
    from public.anchor_push_zugang z
    join public.anchor_push_abo a on a.user_id = z.user_id
    left join public.anchor_lage l on l.user_id = z.user_id
   where length(coalesce(geheimnis, '')) >= 32
     and z.geheimnis_hash = encode(extensions.digest(geheimnis, 'sha256'), 'hex');
$$;

-- Was der Auftrag ändern darf: vermerken, dass heute gesendet wurde, oder
-- ein Abonnement entfernen, das der Push-Dienst nicht mehr kennt.
create or replace function public.anchor_push_vermerken(geheimnis text, endpunkt text,
  datum text, entfernen boolean default false)
  returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  kennung uuid;
begin
  if length(coalesce(geheimnis, '')) < 32 then return; end if;
  select user_id into kennung from public.anchor_push_zugang
   where geheimnis_hash = encode(extensions.digest(geheimnis, 'sha256'), 'hex');
  if kennung is null then return; end if;
  if entfernen then
    delete from public.anchor_push_abo where user_id = kennung and endpoint = endpunkt;
  else
    update public.anchor_push_abo set letzte = datum where user_id = kennung and endpoint = endpunkt;
  end if;
end $$;

revoke all on function public.anchor_push_auftraege(text) from public;
revoke all on function public.anchor_push_vermerken(text, text, text, boolean) from public;
grant execute on function public.anchor_push_auftraege(text) to anon, authenticated;
grant execute on function public.anchor_push_vermerken(text, text, text, boolean) to anon, authenticated;

-- Den Zwischenspeicher der Schnittstelle neu einlesen. Ohne diese Zeile kann
-- es einen Moment dauern, bis die neue Tabelle gefunden wird; die Meldung
-- lautet dann "Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';
