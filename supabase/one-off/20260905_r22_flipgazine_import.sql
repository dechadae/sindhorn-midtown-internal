-- RAN ONCE on 5 Sep 2026 (r22) against project sjpvhgxacsiorrtijqua via the
-- Supabase MCP: 52 rows inserted (39 done, 13 not-started), Flipgazine's
-- job_tracking_* rows untouched. Kept as the record of the import; it is
-- idempotent (on conflict do nothing) but is not meant to run again.

-- r22: one-time import of the Flipgazine job board into sindhorn_jobs under
-- Decha's employee row. Reads job_tracking_boards / job_tracking_status only.
-- Entity decoder for this run only (pg_temp, gone with the session).
create function pg_temp.unescape(t text) returns text language sql immutable as $f$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(t,
    '&mdash;', chr(8212)), '&ndash;', chr(8211)), '&rsquo;', chr(8217)), '&lsquo;', chr(8216)), '&middot;', chr(183)), '&times;', chr(215)),
    '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', chr(39)), '&amp;', '&');
$f$;
with b as (select content from public.job_tracking_boards where owner_id='513b72c7-336a-452e-9a84-450fe0a1c10e'),
cards as (
  select ord, chunk from b, regexp_split_to_table(content, '(?=<div class="job" data-job=")') with ordinality as t(chunk, ord)
  where chunk like '<div class="job" data-job="%'
),
raw as (
  select ord,
    substring(chunk from 'data-job="([^"]+)"') as key,
    substring(chunk from '<div class="job-title">([^<]*)</div>') as title,
    substring(chunk from '<div class="job-desc">([^<]*)</div>') as descr,
    substring(chunk from '<div class="sender">([^<]*)</div>') as sender,
    substring(chunk from '<div class="sender-role">([^<]*)</div>') as role,
    substring(chunk from '<div class="received">Received ([^<]*)</div>') as received,
    substring(chunk from '<div class="deadline[^"]*">([^<]*)</div>') as deadline,
    substring(chunk from '<div class="deadline-note">([^<]*)</div>') as deadline_note
  from cards
),
dec as (
  select ord, key,
    btrim(pg_temp.unescape(coalesce(title,''))) as title,
    btrim(pg_temp.unescape(coalesce(descr,''))) as descr,
    btrim(pg_temp.unescape(coalesce(sender,''))) as sender,
    btrim(pg_temp.unescape(coalesce(role,''))) as role,
    btrim(coalesce(received,'')) as received,
    btrim(pg_temp.unescape(coalesce(deadline,''))) as deadline,
    btrim(pg_temp.unescape(coalesce(deadline_note,''))) as deadline_note
  from raw
),
parsed as (
  select d.*,
    (case when received ~ '^\d{1,2} [A-Za-z]{3,9} \d{4}$' then received::date end) as received_on,
    case when deadline ~ '\d{1,2} [A-Za-z]{3,9} \d{4}'
         then (substring(deadline from '(\d{1,2} [A-Za-z]{3,9} \d{4})'))::date end as deadline_on,
    s.status, s.updated_at as status_at
  from dec d
  join public.job_tracking_status s on s.owner_id='513b72c7-336a-452e-9a84-450fe0a1c10e' and s.job_key=d.key
),
final as (
  select ord, key, title, descr, sender, role, received_on, deadline_on,
    left(case when deadline_on is not null then deadline_note
              when deadline_note <> '' then deadline || ' — ' || deadline_note
              else deadline end, 200) as deadline_note,
    status, status_at
  from parsed
)
insert into public.sindhorn_jobs (owner_employee_id, job_key, title, description, sender_name, sender_role, received_on, deadline_on, deadline_note, status, sort_order, source, created_at, updated_at)
select '4306cdff-e9b5-4294-b367-06c482028820', key, title, descr, sender, role, received_on, deadline_on, deadline_note, status, ord, 'flipgazine-import',
  coalesce(received_on::timestamptz, now()), greatest(coalesce(status_at, received_on::timestamptz), received_on::timestamptz)
from final
on conflict (owner_employee_id, job_key) do nothing
returning job_key, status, sort_order, received_on, deadline_on, deadline_note, left(title,50) as title;
