create extension if not exists unaccent with schema extensions;

create table public.sindhorn_hotel_profile (
  profile_key text primary key,
  hotel_name text not null,
  hotel_main_phone text,
  hotel_address text,
  hotel_website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_hotel_profile_singleton check (profile_key = 'primary'),
  constraint sindhorn_hotel_profile_name_len check (length(hotel_name) between 1 and 240),
  constraint sindhorn_hotel_profile_phone_len check (hotel_main_phone is null or length(hotel_main_phone) <= 64),
  constraint sindhorn_hotel_profile_address_len check (hotel_address is null or length(hotel_address) <= 500),
  constraint sindhorn_hotel_profile_website_len check (hotel_website is null or length(hotel_website) <= 500)
);

alter table public.sindhorn_hotel_profile enable row level security;
revoke all on table public.sindhorn_hotel_profile from public, anon, authenticated;

create table public.sindhorn_business_cards (
  employee_id uuid primary key references public.sindhorn_employees(id) on delete cascade,
  public_slug text not null unique,
  business_mobile_e164 text,
  direct_phone text,
  photo_path text,
  published boolean not null default false,
  field_visibility jsonb not null default '{"positionTitle":true,"workEmail":true,"businessMobile":true,"directPhone":true,"hotelPhone":true,"hotelAddress":true,"hotelWebsite":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sindhorn_business_cards_slug_format check (public_slug ~ '^[a-z0-9]{6}$'),
  constraint sindhorn_business_cards_mobile_format check (business_mobile_e164 is null or business_mobile_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint sindhorn_business_cards_direct_phone_len check (direct_phone is null or length(direct_phone) <= 64),
  constraint sindhorn_business_cards_photo_path_len check (photo_path is null or length(photo_path) <= 500),
  constraint sindhorn_business_cards_visibility_object check (jsonb_typeof(field_visibility) = 'object')
);

alter table public.sindhorn_business_cards enable row level security;
revoke all on table public.sindhorn_business_cards from public, anon, authenticated;

create or replace function sindhorn_private.sindhorn_business_card_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function sindhorn_private.sindhorn_business_card_touch_updated_at() from public, anon, authenticated;

create trigger sindhorn_business_cards_touch_updated_at before update on public.sindhorn_business_cards for each row execute function sindhorn_private.sindhorn_business_card_touch_updated_at();
create trigger sindhorn_hotel_profile_touch_updated_at before update on public.sindhorn_hotel_profile for each row execute function sindhorn_private.sindhorn_business_card_touch_updated_at();

create or replace function sindhorn_private.sindhorn_business_card_base_slug(p_display_name text)
returns text language plpgsql stable set search_path = '' as $$
declare v_normalized text; v_parts text[]; v_first text := ''; v_last text := ''; v_first_take text := ''; v_base text := '';
begin
  v_normalized := lower(extensions.unaccent(coalesce(p_display_name, '')));
  v_normalized := trim(regexp_replace(v_normalized, '[[:space:]]+', ' ', 'g'));
  if v_normalized <> '' then
    v_parts := regexp_split_to_array(v_normalized, ' ');
    v_first := regexp_replace(coalesce(v_parts[1], ''), '[^a-z0-9]+', '', 'g');
    if coalesce(array_length(v_parts,1),0)>1 then v_last := regexp_replace(coalesce(v_parts[array_length(v_parts,1)], ''), '[^a-z0-9]+', '', 'g'); end if;
  end if;
  v_first_take := left(v_first,least(5,length(v_first)));
  v_base := v_first_take || left(v_last,greatest(0,6-length(v_first_take)));
  if length(v_base)<6 then v_base := v_base || left(md5(v_normalized),6-length(v_base)); end if;
  return left(v_base,6);
end;
$$;
revoke all on function sindhorn_private.sindhorn_business_card_base_slug(text) from public, anon, authenticated;

create or replace function sindhorn_private.sindhorn_allocate_business_card_slug(p_employee_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_display_name text; v_base text; v_candidate text; v_attempt integer;
begin
  select e.display_name into v_display_name from public.sindhorn_employees e where e.id=p_employee_id;
  if v_display_name is null or btrim(v_display_name)='' then raise exception 'English display name required for business card slug' using errcode='22023'; end if;
  v_base := sindhorn_private.sindhorn_business_card_base_slug(v_display_name);
  for v_attempt in 0..63 loop
    if v_attempt=0 then v_candidate:=v_base; else v_candidate:=left(v_base||'sm',2)||left(md5(p_employee_id::text||':'||v_attempt::text),4); end if;
    if v_candidate=any(array['assets','static','public','images']) then continue; end if;
    if not exists(select 1 from public.sindhorn_business_cards c where c.public_slug=v_candidate)
       and not exists(select 1 from public.fg_shortlinks s where lower(s.code)=v_candidate) then return v_candidate; end if;
  end loop;
  raise exception 'Could not allocate unique six-character business card slug' using errcode='23505';
end;
$$;
revoke all on function sindhorn_private.sindhorn_allocate_business_card_slug(uuid) from public, anon, authenticated;

insert into public.sindhorn_hotel_profile(profile_key,hotel_name,hotel_main_phone,hotel_address,hotel_website)
values('primary','Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG','+66-2-7968888','68 Soi Langsuan, Lumpini, Pathumwan, Bangkok 10330, Thailand','https://www.ihg.com/vignettecollection/hotels/us/en/bangkok/bkksn/hoteldetail');

insert into public.sindhorn_capabilities(key,label,description,sort_order,active) values
('business_card.read','Business card','View the employee business-card surface in Settings.',140,true),
('business_card.manage_self','Manage own business card','Edit and publish the signed-in employee business card.',150,true)
on conflict(key) do update set label=excluded.label,description=excluded.description,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();

insert into public.sindhorn_capability_grants(subject_type,subject_key,capability_key,allowed,scope,active) values
('account_type','developer','business_card.read',true,'{}'::jsonb,true),
('account_type','developer','business_card.manage_self',true,'{}'::jsonb,true),
('role','admin','business_card.read',true,'{}'::jsonb,true),
('role','admin','business_card.manage_self',true,'{}'::jsonb,true),
('role','super_admin','business_card.read',true,'{}'::jsonb,true),
('role','super_admin','business_card.manage_self',true,'{}'::jsonb,true)
on conflict(subject_type,subject_key,capability_key) do update set allowed=excluded.allowed,scope=excluded.scope,active=excluded.active,updated_at=now();

insert into public.sindhorn_business_cards(employee_id,public_slug,published,field_visibility)
select e.id,'dechak',true,'{"positionTitle":true,"workEmail":true,"businessMobile":true,"directPhone":true,"hotelPhone":true,"hotelAddress":true,"hotelWebsite":true}'::jsonb
from public.sindhorn_employees e where e.employee_number='10639' and lower(e.display_name)='decha kokaew'
on conflict(employee_id) do nothing;

create or replace function public.sindhorn_business_card_self()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_employee_id uuid; v_slug text; v_result jsonb;
begin
  if not public.sindhorn_has_capability('business_card.read') then raise exception 'business card access required' using errcode='42501'; end if;
  v_employee_id:=sindhorn_private.current_employee_id();
  if v_employee_id is null then raise exception 'active employee required' using errcode='42501'; end if;
  if not exists(select 1 from public.sindhorn_business_cards c where c.employee_id=v_employee_id) then
    if not public.sindhorn_has_capability('business_card.manage_self') then raise exception 'business card management required' using errcode='42501'; end if;
    v_slug:=sindhorn_private.sindhorn_allocate_business_card_slug(v_employee_id);
    insert into public.sindhorn_business_cards(employee_id,public_slug) values(v_employee_id,v_slug) on conflict(employee_id) do nothing;
  end if;
  select jsonb_build_object('ok',true,
    'card',jsonb_build_object('publicSlug',c.public_slug,'displayName',e.display_name,'positionTitle',e.position_title,'workEmail',e.work_email,'businessMobile',c.business_mobile_e164,'directPhone',c.direct_phone,'published',c.published,'fieldVisibility',c.field_visibility),
    'hotel',jsonb_build_object('hotelName',h.hotel_name,'hotelMainPhone',h.hotel_main_phone,'hotelAddress',h.hotel_address,'hotelWebsite',h.hotel_website))
  into v_result from public.sindhorn_business_cards c join public.sindhorn_employees e on e.id=c.employee_id and e.active=true join public.sindhorn_hotel_profile h on h.profile_key='primary' where c.employee_id=v_employee_id;
  return v_result;
end;
$$;
revoke all on function public.sindhorn_business_card_self() from public,anon,authenticated;
grant execute on function public.sindhorn_business_card_self() to authenticated;

create or replace function public.sindhorn_business_card_update_self(
  p_business_mobile_e164 text,p_direct_phone text,p_published boolean,p_show_position_title boolean,p_show_work_email boolean,p_show_business_mobile boolean,p_show_direct_phone boolean,p_show_hotel_phone boolean,p_show_hotel_address boolean,p_show_hotel_website boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_employee_id uuid; v_mobile text; v_direct text; v_slug text;
begin
  if not public.sindhorn_has_capability('business_card.manage_self') then raise exception 'business card management required' using errcode='42501'; end if;
  v_employee_id:=sindhorn_private.current_employee_id();
  if v_employee_id is null then raise exception 'active employee required' using errcode='42501'; end if;
  v_mobile:=nullif(btrim(coalesce(p_business_mobile_e164,'')),''); v_direct:=nullif(btrim(coalesce(p_direct_phone,'')),'');
  if v_mobile is not null and v_mobile !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid business mobile' using errcode='22023'; end if;
  if v_direct is not null and length(v_direct)>64 then raise exception 'invalid direct phone' using errcode='22023'; end if;
  if not exists(select 1 from public.sindhorn_business_cards c where c.employee_id=v_employee_id) then
    v_slug:=sindhorn_private.sindhorn_allocate_business_card_slug(v_employee_id);
    insert into public.sindhorn_business_cards(employee_id,public_slug) values(v_employee_id,v_slug) on conflict(employee_id) do nothing;
  end if;
  update public.sindhorn_business_cards set business_mobile_e164=v_mobile,direct_phone=v_direct,published=coalesce(p_published,false),field_visibility=jsonb_build_object('positionTitle',coalesce(p_show_position_title,false),'workEmail',coalesce(p_show_work_email,false),'businessMobile',coalesce(p_show_business_mobile,false),'directPhone',coalesce(p_show_direct_phone,false),'hotelPhone',coalesce(p_show_hotel_phone,false),'hotelAddress',coalesce(p_show_hotel_address,false),'hotelWebsite',coalesce(p_show_hotel_website,false)) where employee_id=v_employee_id;
  return public.sindhorn_business_card_self();
end;
$$;
revoke all on function public.sindhorn_business_card_update_self(text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.sindhorn_business_card_update_self(text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.sindhorn_public_business_card(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_slug text; v_result jsonb;
begin
  v_slug:=lower(btrim(coalesce(p_slug,''))); if v_slug !~ '^[a-z0-9]{6}$' then return null; end if;
  select jsonb_build_object('slug',c.public_slug,'displayName',e.display_name,
    'positionTitle',case when c.field_visibility @> '{"positionTitle":true}'::jsonb then e.position_title else null end,
    'workEmail',case when c.field_visibility @> '{"workEmail":true}'::jsonb then e.work_email else null end,
    'businessMobile',case when c.field_visibility @> '{"businessMobile":true}'::jsonb then c.business_mobile_e164 else null end,
    'directPhone',case when c.field_visibility @> '{"directPhone":true}'::jsonb then c.direct_phone else null end,
    'hotelName',h.hotel_name,'hotelMainPhone',case when c.field_visibility @> '{"hotelPhone":true}'::jsonb then h.hotel_main_phone else null end,
    'hotelAddress',case when c.field_visibility @> '{"hotelAddress":true}'::jsonb then h.hotel_address else null end,
    'hotelWebsite',case when c.field_visibility @> '{"hotelWebsite":true}'::jsonb then h.hotel_website else null end)
  into v_result from public.sindhorn_business_cards c join public.sindhorn_employees e on e.id=c.employee_id and e.active=true join public.sindhorn_hotel_profile h on h.profile_key='primary' where c.public_slug=v_slug and c.published=true;
  return v_result;
end;
$$;
revoke all on function public.sindhorn_public_business_card(text) from public,anon,authenticated;
grant execute on function public.sindhorn_public_business_card(text) to anon,authenticated;
