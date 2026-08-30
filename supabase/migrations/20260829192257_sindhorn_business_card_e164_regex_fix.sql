alter table public.sindhorn_business_cards drop constraint if exists sindhorn_business_cards_mobile_format;
alter table public.sindhorn_business_cards add constraint sindhorn_business_cards_mobile_format
  check (business_mobile_e164 is null or business_mobile_e164 ~ '^[+][1-9][0-9]{7,14}$');

create or replace function public.sindhorn_business_card_update_self(
  p_business_mobile_e164 text,
  p_direct_phone text,
  p_published boolean,
  p_show_position_title boolean,
  p_show_work_email boolean,
  p_show_business_mobile boolean,
  p_show_direct_phone boolean,
  p_show_hotel_phone boolean,
  p_show_hotel_address boolean,
  p_show_hotel_website boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee_id uuid;
  v_mobile text;
  v_direct text;
  v_slug text;
begin
  if not public.sindhorn_has_capability('business_card.manage_self') then
    raise exception 'business card management required' using errcode = '42501';
  end if;

  v_employee_id := sindhorn_private.current_employee_id();
  if v_employee_id is null then
    raise exception 'active employee required' using errcode = '42501';
  end if;

  v_mobile := nullif(btrim(coalesce(p_business_mobile_e164, '')), '');
  v_direct := nullif(btrim(coalesce(p_direct_phone, '')), '');

  if v_mobile is not null and v_mobile !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'invalid business mobile' using errcode = '22023';
  end if;
  if v_direct is not null and length(v_direct) > 64 then
    raise exception 'invalid direct phone' using errcode = '22023';
  end if;

  if not exists (select 1 from public.sindhorn_business_cards c where c.employee_id = v_employee_id) then
    v_slug := sindhorn_private.sindhorn_allocate_business_card_slug(v_employee_id);
    insert into public.sindhorn_business_cards(employee_id, public_slug)
    values (v_employee_id, v_slug)
    on conflict (employee_id) do nothing;
  end if;

  update public.sindhorn_business_cards c
  set business_mobile_e164 = v_mobile,
      direct_phone = v_direct,
      published = coalesce(p_published, false),
      field_visibility = jsonb_build_object(
        'positionTitle', coalesce(p_show_position_title, false),
        'workEmail', coalesce(p_show_work_email, false),
        'businessMobile', coalesce(p_show_business_mobile, false),
        'directPhone', coalesce(p_show_direct_phone, false),
        'hotelPhone', coalesce(p_show_hotel_phone, false),
        'hotelAddress', coalesce(p_show_hotel_address, false),
        'hotelWebsite', coalesce(p_show_hotel_website, false)
      )
  where c.employee_id = v_employee_id;

  return public.sindhorn_business_card_self();
end;
$function$;

revoke execute on function public.sindhorn_business_card_update_self(text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon, authenticated;
grant execute on function public.sindhorn_business_card_update_self(text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
