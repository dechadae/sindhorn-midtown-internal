-- betta_styles — the studio's output, where both devices can reach it.
--
-- A seed is the whole story of an explorer picture, so a seed and a crop are
-- all betta_verdicts ever needed. A studio style is a seed plus a patch, and
-- the patch is where the intent lives, so the numbers themselves have to be
-- stored. This is the same record the Mac keeps in
-- Application Support/Betta Explorer/styles/<id>.json.
--
-- id is the hash of the resolved numbers: the same picture always answers to
-- the same name, whichever device made it, so re-sending a style is a no-op
-- rather than a duplicate.

create table if not exists public.betta_styles (
  id           text primary key,
  prompt       text        not null default '',
  seed         text        not null,
  constitution text,
  device       text,
  session_id   text,
  -- Provenance: the patch as written, or the room's transcript. Kept beside
  -- the numbers, never as the source of truth — replaying a patch depends on
  -- the constitution that drew the seed, and constitutions change.
  patch        text,
  -- The resolved style: every number the engine needs, and nothing else.
  style        jsonb       not null,
  created_at   timestamptz not null default now()
);

alter table public.betta_styles enable row level security;

-- Insert, like the verdicts: the publishable key ships in the clients by
-- design, and a copy of it may add rows.
create policy betta_styles_anon_insert
  on public.betta_styles for insert
  to anon, authenticated
  with check (true);

-- Select, UNLIKE the verdicts, and deliberately. A verdict is the owner's
-- attention and nobody needs to read it back; a style has to be readable or
-- the phone cannot draw one. The rows are engine numbers, not personal data.
create policy betta_styles_anon_select
  on public.betta_styles for select
  to anon, authenticated
  using (true);

create index if not exists betta_styles_created_at_idx
  on public.betta_styles (created_at desc);
