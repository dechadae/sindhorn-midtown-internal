begin;

alter table public.fg_shortlinks add column if not exists destination_type text;
update public.fg_shortlinks set destination_type = 'redirect' where destination_type is null;
alter table public.fg_shortlinks alter column destination_type set default 'redirect', alter column destination_type set not null;
alter table public.fg_shortlinks drop constraint if exists fg_shortlinks_destination_type_check;
alter table public.fg_shortlinks add constraint fg_shortlinks_destination_type_check check (destination_type in ('redirect','business_card'));
alter table public.fg_shortlinks drop constraint if exists fg_shortlinks_destination_contract;
alter table public.fg_shortlinks add constraint fg_shortlinks_destination_contract check ((destination_type = 'redirect' and length(target_path) > 0) or (destination_type = 'business_card' and target_path = 'business_card:' || code and length(code) = 6));

alter table public.sindhorn_hotel_profile add column if not exists hotel_logo_path text;
update public.sindhorn_hotel_profile set hotel_name = 'Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG', hotel_logo_path = '/assets/brand/sindhorn-midtown-vignette-white.png' where profile_key = 'primary';
alter table public.sindhorn_hotel_profile alter column hotel_logo_path set not null;
alter table public.sindhorn_hotel_profile drop constraint if exists sindhorn_hotel_profile_logo_path_len;
alter table public.sindhorn_hotel_profile add constraint sindhorn_hotel_profile_logo_path_len check (length(hotel_logo_path) between 1 and 500);

do $$
begin
  if exists (select 1 from public.sindhorn_business_cards c join public.fg_shortlinks s on s.code = c.public_slug where s.destination_type <> 'business_card') then
    raise exception 'Existing short-link collision blocks business-card reservation';
  end if;
end $$;

insert into public.fg_shortlinks(code, target_path, label, active, destination_type)
select c.public_slug, 'business_card:' || c.public_slug, 'Business card', false, 'business_card'
from public.sindhorn_business_cards c
on conflict (code) do nothing;

alter table public.sindhorn_business_cards drop constraint if exists sindhorn_business_cards_public_slug_shortlink_fkey;
alter table public.sindhorn_business_cards add constraint sindhorn_business_cards_public_slug_shortlink_fkey foreign key (public_slug) references public.fg_shortlinks(code) on update restrict on delete restrict;

create or replace function sindhorn_private.sindhorn_business_card_base_slug(p_display_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_normalized text; v_parts text[]; v_first text := ''; v_last text := ''; v_first_take text := ''; v_base text := ''; v_needed integer := 0;
begin
  v_normalized := lower(extensions.unaccent(coalesce(p_display_name, '')));
  v_normalized := trim(regexp_replace(v_normalized, '[[:space:]]+', ' ', 'g'));
  if v_normalized <> '' then
    v_parts := regexp_split_to_array(v_normalized, ' ');
    v_first := regexp_replace(coalesce(v_parts[1], ''), '[^a-z0-9]+', '', 'g');
    if coalesce(array_length(v_parts, 1), 0) > 1 then v_last := regexp_replace(coalesce(v_parts[array_length(v_parts, 1)], ''), '[^a-z0-9]+', '', 'g'); end if;
  end if;
  if v_first = '' or v_last = '' then raise exception 'English first and last name required for business card slug' using errcode = '22023'; end if;
  v_first_take := left(v_first, least(5, length(v_first)));
  v_needed := greatest(0, 6 - length(v_first_take));
  v_base := v_first_take || left(v_last, v_needed);
  if length(v_base) < 6 then v_base := v_base || left(md5(v_normalized), 6 - length(v_base)); end if;
  return left(v_base, 6);
end;
$$;

create or replace function sindhorn_private.sindhorn_allocate_business_card_slug(p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text; v_normalized text; v_parts text[]; v_first text := ''; v_last text := ''; v_first_take text := ''; v_needed integer := 0; v_base text; v_stem text; v_candidate text; v_inserted text; v_index integer; v_attempt integer;
  v_alphabet constant text := '23456789abcdefghijklmnopqrstuvwxyz0';
  v_pair_alphabet constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
begin
  select e.display_name into v_display_name from public.sindhorn_employees e where e.id = p_employee_id for update;
  if v_display_name is null or btrim(v_display_name) = '' then raise exception 'English display name required for business card slug' using errcode = '22023'; end if;
  select c.public_slug into v_candidate from public.sindhorn_business_cards c where c.employee_id = p_employee_id;
  if v_candidate is not null then return v_candidate; end if;

  v_normalized := lower(extensions.unaccent(v_display_name));
  v_normalized := trim(regexp_replace(v_normalized, '[[:space:]]+', ' ', 'g'));
  v_parts := regexp_split_to_array(v_normalized, ' ');
  v_first := regexp_replace(coalesce(v_parts[1], ''), '[^a-z0-9]+', '', 'g');
  if coalesce(array_length(v_parts, 1), 0) > 1 then v_last := regexp_replace(coalesce(v_parts[array_length(v_parts, 1)], ''), '[^a-z0-9]+', '', 'g'); end if;
  if v_first = '' or v_last = '' then raise exception 'English first and last name required for business card slug' using errcode = '22023'; end if;
  v_first_take := left(v_first, least(5, length(v_first)));
  v_needed := greatest(0, 6 - length(v_first_take));
  v_base := sindhorn_private.sindhorn_business_card_base_slug(v_display_name);
  v_stem := left(v_base, 5);

  v_candidate := v_base;
  insert into public.fg_shortlinks(code, target_path, label, active, destination_type) values (v_candidate, 'business_card:' || v_candidate, 'Business card', false, 'business_card') on conflict (code) do nothing returning code into v_inserted;
  if v_inserted is not null then return v_inserted; end if;

  if length(v_last) > v_needed then
    for v_index in (v_needed + 1)..length(v_last) loop
      v_candidate := v_stem || substr(v_last, v_index, 1);
      insert into public.fg_shortlinks(code, target_path, label, active, destination_type) values (v_candidate, 'business_card:' || v_candidate, 'Business card', false, 'business_card') on conflict (code) do nothing returning code into v_inserted;
      if v_inserted is not null then return v_inserted; end if;
    end loop;
  end if;

  for v_index in 1..length(v_alphabet) loop
    v_candidate := v_stem || substr(v_alphabet, v_index, 1);
    insert into public.fg_shortlinks(code, target_path, label, active, destination_type) values (v_candidate, 'business_card:' || v_candidate, 'Business card', false, 'business_card') on conflict (code) do nothing returning code into v_inserted;
    if v_inserted is not null then return v_inserted; end if;
  end loop;

  for v_attempt in 0..1295 loop
    v_candidate := left(v_base, 4) || substr(v_pair_alphabet, (v_attempt / 36) + 1, 1) || substr(v_pair_alphabet, (v_attempt % 36) + 1, 1);
    insert into public.fg_shortlinks(code, target_path, label, active, destination_type) values (v_candidate, 'business_card:' || v_candidate, 'Business card', false, 'business_card') on conflict (code) do nothing returning code into v_inserted;
    if v_inserted is not null then return v_inserted; end if;
  end loop;
  raise exception 'Could not allocate unique six-character business card slug' using errcode = '23505';
end;
$$;

revoke all on function sindhorn_private.sindhorn_business_card_base_slug(text) from public, anon, authenticated;
revoke all on function sindhorn_private.sindhorn_allocate_business_card_slug(uuid) from public, anon, authenticated;

create or replace function public.sindhorn_public_business_card(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_slug text; v_result jsonb;
begin
  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9]{6}$' then return null; end if;
  select jsonb_build_object(
    'slug', c.public_slug,
    'displayName', e.display_name,
    'positionTitle', case when c.field_visibility @> '{"positionTitle":true}'::jsonb then e.position_title else null end,
    'workEmail', case when c.field_visibility @> '{"workEmail":true}'::jsonb then e.work_email else null end,
    'businessMobile', case when c.field_visibility @> '{"businessMobile":true}'::jsonb then c.business_mobile_e164 else null end,
    'directPhone', case when c.field_visibility @> '{"directPhone":true}'::jsonb then c.direct_phone else null end,
    'hotelName', h.hotel_name,
    'hotelMainPhone', case when c.field_visibility @> '{"hotelPhone":true}'::jsonb then h.hotel_main_phone else null end,
    'hotelAddress', case when c.field_visibility @> '{"hotelAddress":true}'::jsonb then h.hotel_address else null end,
    'hotelWebsite', case when c.field_visibility @> '{"hotelWebsite":true}'::jsonb then h.hotel_website else null end,
    'hotelLogoPath', h.hotel_logo_path
  ) into v_result
  from public.sindhorn_business_cards c
  join public.sindhorn_employees e on e.id = c.employee_id and e.active = true
  join public.fg_shortlinks s on s.code = c.public_slug and s.destination_type = 'business_card'
  join public.sindhorn_hotel_profile h on h.profile_key = 'primary'
  where c.public_slug = v_slug and c.published = true;
  return v_result;
end;
$$;
revoke all on function public.sindhorn_public_business_card(text) from public, anon, authenticated;
grant execute on function public.sindhorn_public_business_card(text) to anon, authenticated;

create or replace function public.sindhorn_business_card_self()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_employee_id uuid; v_slug text; v_result jsonb;
begin
  if not public.sindhorn_has_capability('business_card.read') then raise exception 'business card access required' using errcode = '42501'; end if;
  v_employee_id := sindhorn_private.current_employee_id();
  if v_employee_id is null then raise exception 'active employee required' using errcode = '42501'; end if;
  if not exists (select 1 from public.sindhorn_business_cards c where c.employee_id = v_employee_id) then
    if not public.sindhorn_has_capability('business_card.manage_self') then raise exception 'business card management required' using errcode = '42501'; end if;
    v_slug := sindhorn_private.sindhorn_allocate_business_card_slug(v_employee_id);
    insert into public.sindhorn_business_cards(employee_id, public_slug) values (v_employee_id, v_slug) on conflict (employee_id) do nothing;
  end if;
  select jsonb_build_object(
    'ok', true,
    'card', jsonb_build_object('publicSlug', c.public_slug,'displayName', e.display_name,'positionTitle', e.position_title,'workEmail', e.work_email,'businessMobile', c.business_mobile_e164,'directPhone', c.direct_phone,'published', c.published,'fieldVisibility', c.field_visibility),
    'hotel', jsonb_build_object('hotelName', h.hotel_name,'hotelMainPhone', h.hotel_main_phone,'hotelAddress', h.hotel_address,'hotelWebsite', h.hotel_website,'hotelLogoPath', h.hotel_logo_path)
  ) into v_result
  from public.sindhorn_business_cards c
  join public.sindhorn_employees e on e.id = c.employee_id and e.active = true
  join public.fg_shortlinks s on s.code = c.public_slug and s.destination_type = 'business_card'
  join public.sindhorn_hotel_profile h on h.profile_key = 'primary'
  where c.employee_id = v_employee_id;
  return v_result;
end;
$$;
revoke all on function public.sindhorn_business_card_self() from public, anon, authenticated;
grant execute on function public.sindhorn_business_card_self() to authenticated;

commit;
