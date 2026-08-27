-- Phase 9 — trusted broker access to the multi-login identity map.
-- Browser clients remain read-only through RLS; only service_role may link identities.

grant select,insert,update,delete on public.sindhorn_employee_identities to service_role;
