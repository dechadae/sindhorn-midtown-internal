create or replace function public.sindhorn_fnb_touch_parent_promotion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_promotion_id text;
  v_activation_id text;
begin
  if tg_table_name = 'sindhorn_fnb_promotion_activations' then
    if tg_op = 'DELETE' then v_promotion_id := old.promotion_id; else v_promotion_id := new.promotion_id; end if;
  elsif tg_table_name in ('sindhorn_fnb_artwork_requirements','sindhorn_fnb_activation_links') then
    if tg_op = 'DELETE' then v_activation_id := old.activation_id; else v_activation_id := new.activation_id; end if;
    select a.promotion_id into v_promotion_id
    from public.sindhorn_fnb_promotion_activations a
    where a.id = v_activation_id;
  end if;

  if v_promotion_id is not null then
    update public.sindhorn_fnb_promotions
    set updated_at = now()
    where id = v_promotion_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sindhorn_fnb_activations_touch_parent on public.sindhorn_fnb_promotion_activations;
create trigger sindhorn_fnb_activations_touch_parent
after insert or update or delete on public.sindhorn_fnb_promotion_activations
for each row execute function public.sindhorn_fnb_touch_parent_promotion();

drop trigger if exists sindhorn_fnb_artworks_touch_parent on public.sindhorn_fnb_artwork_requirements;
create trigger sindhorn_fnb_artworks_touch_parent
after insert or update or delete on public.sindhorn_fnb_artwork_requirements
for each row execute function public.sindhorn_fnb_touch_parent_promotion();

drop trigger if exists sindhorn_fnb_links_touch_parent on public.sindhorn_fnb_activation_links;
create trigger sindhorn_fnb_links_touch_parent
after insert or update or delete on public.sindhorn_fnb_activation_links
for each row execute function public.sindhorn_fnb_touch_parent_promotion();
