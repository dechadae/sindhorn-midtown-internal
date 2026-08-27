-- AFTER trigger return values are ignored. Return NULL explicitly so this generic
-- audit trigger never depends on composite-record COALESCE behavior.
create or replace function sindhorn_private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  old_data jsonb;
  new_data jsonb;
  row_id text;
begin
  if tg_op = 'INSERT' then
    old_data := null;
    new_data := to_jsonb(new);
    row_id := new_data->>'id';
  elsif tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    new_data := to_jsonb(new);
    row_id := coalesce(new_data->>'id', old_data->>'id');
  else
    old_data := to_jsonb(old);
    new_data := null;
    row_id := old_data->>'id';
  end if;

  insert into sindhorn_private.audit_log(actor_user_id,action,entity_type,entity_id,before_json,after_json)
  values(actor,lower(tg_op),tg_table_name,row_id,old_data,new_data);
  return null;
end
$$;
