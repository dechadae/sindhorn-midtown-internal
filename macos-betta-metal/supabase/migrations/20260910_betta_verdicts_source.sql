-- betta_verdicts gains a provenance column, so a studio keep can never be
-- mistaken for a draw from the constitution.
--
-- Test 04's arm comparison rests on these rows. Every one of the 2,225 already
-- here came from a frame the constitution drew at random, which is exactly
-- what 'explorer' means — so the default backfills them truthfully rather than
-- guessing. Any query that wants the experiment alone adds one clause:
--
--   where source = 'explorer'
--
-- and any query that wants everything changes nothing at all.
--
-- style_id carries no foreign key on purpose. A verdict can be recorded on a
-- device that has not yet uploaded the style it refers to — the queue drains
-- when it drains — and a constraint would turn that ordinary case into a lost
-- judgement. Judgements are the expensive thing here; they are never dropped
-- for tidiness.

alter table public.betta_verdicts
  add column if not exists source   text not null default 'explorer',
  add column if not exists style_id text;

comment on column public.betta_verdicts.source is
  'Where the frame came from: explorer (the constitution drew it) or studio (words asked for it). Test 04 reads explorer rows only.';
comment on column public.betta_verdicts.style_id is
  'betta_styles.id when source = studio. Null for every explorer row.';

create index if not exists betta_verdicts_source_idx
  on public.betta_verdicts (source);
