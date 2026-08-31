-- Private recovery archive for the retired seasonal/weather WebGL visual stack.
-- Source rows were copied from immutable Git commit
-- 29b0c99941163582b84d376982e459fdf6ead85b before removal from the deployed app.

create table if not exists private.legacy_weather_webgl_archive (
  archive_key text not null,
  repository text not null,
  commit_sha text not null,
  file_path text not null,
  source_text text not null,
  source_bytes bigint not null,
  source_sha256 text not null,
  archived_at timestamptz not null default now(),
  notes text,
  primary key (archive_key, file_path)
);

comment on table private.legacy_weather_webgl_archive is
  'Private immutable-style source archive for the retired Sindhorn Midtown legacy weather/seasonal WebGL visual stack. Not exposed to app clients.';

alter table private.legacy_weather_webgl_archive enable row level security;
revoke all on table private.legacy_weather_webgl_archive from public, anon, authenticated;
