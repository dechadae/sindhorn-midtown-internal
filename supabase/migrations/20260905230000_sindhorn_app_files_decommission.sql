-- Sindhorn Midtown Internal: decommission the presentation pack store.
--
-- public.sindhorn_app_files held the versioned UI packs (packs 1-49) that the
-- pre-r30 shell fetched at boot and the old /share pages were cut from. Since
-- r30 (SW v108, 5 Sep 2026) nothing reads it: the shell and every page are
-- static files in the repository, the public share is generated from the
-- shell, and F&B data comes from the sindhorn_fnb_* RPCs. Owner-approved
-- decommission, 5 Sep 2026 ("delete it"). A backup of the row manifest and
-- the last enabled pack (49) was taken before this ran.
--
-- Verified before dropping: no foreign keys, functions, views or triggers
-- reference the table; its only policy was the anon/authenticated read of
-- enabled rows. Nothing else in this database is touched.

drop table if exists public.sindhorn_app_files;
