# Frozen source — Origarium Papers

Captured 6 September 2026, after `PROTOCOL.md` and the predictions were
committed (`828ee41`) and before any reconstruction existed.

**Read only.** These rows belong to another application on the shared Supabase
project `sjpvhgxacsiorrtijqua`. Nothing here was written back, and nothing in
the reconstruction may write to them.

| File | Origin | Version | Characters | MD5 |
|---|---|---|---|---|
| `papers.html` | `site_files` row `path='/papers.html'` | **59** | 58,319 | `7fc246e81d09a1e9a84488b5b068f15e` |
| `loader.js` | `site_files` row `path='/loader.js'` | **4** | 1,520 | `9b3025cf761be9ac187e06b6fd359ed9` |
| `stage1-shell.html` | `https://origarium.pages.dev/papers` | — | 9,335 B | `28d5f7199a8dc60bae23af4906e1765d` |

**The anon key is redacted.** Each committed file carries
`ORIGARIUM_ANON_KEY_REDACTED` where the publishable Supabase key stood — one
occurrence in `papers.html`, one in `stage1-shell.html`, none in `loader.js` —
the same rule the carried Flipgazine source follows. The MD5s below are of the
**unredacted** rows as read from the database, which is what they are for:
re-reading the row and comparing proves the source has not moved.

Both MD5s were verified against `md5(content)` computed in the database, so the
snapshot is exact rather than approximately current. Row `length()` counts
characters; the files are larger in bytes because the content is UTF-8 with
multibyte characters.

## How the page is served

Cloudflare returns only `stage1-shell.html`. It sets `__wlPath =
location.pathname`, then fetches
`site_files?path=eq.<pathname>.html&select=content` with the anon key and
writes the result into the page. `/loader.js` — the stage-2 loader — describes
itself as *"ORIGARIUM stage-2 loader — lives in the database, updatable by
SQL. The Netlify shell (stage 1) fetches and runs this."*

## Staleness

`/papers.html` is a live row on a shared table and can change under this test.
If its version moves away from **59**, the run is annotated or repeated. It is
never silently carried forward.

To re-check without writing anything:

```sql
select path, version, md5(content) from site_files
where path in ('/papers.html','/loader.js');
```
