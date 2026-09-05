# Flipgazine source snapshot — provenance

Fifteen files, 285,990 bytes, read on 6 September 2026 from Flipgazine's
`site_files` table (`path`, `content`) the way Flipgazine's own gate shell
reads them: an anonymous `select` with the publishable key that shell
embeds. Nothing in Flipgazine's repository or database was modified, and
nothing here is deployed anywhere.

| File | Role |
|---|---|
| `claude-code.html` | the page under test, "Moving to Claude Code" (7 style blocks, 2 inline style attributes, `main[data-fg-controller]`) |
| `fg-head.html` | shared head: pre-paint palette restore, `fg-head-core` style |
| `fg-header.html` | shared header: logo, fullscreen / theme / editorial switches, progress rule, header styles |
| `fg-nav.js` | mounts the page controller named by `data-fg-controller` |
| `fg-page-claude-code.js` | the page's controller: copy buttons, rail, scroll tracking |
| `fg-runtime.js`, `fg-chrome.js`, `fg-prefetch.js`, `fg-devnav.js`, `fg-sound.js` | shell runtime; not carried into the rebuild |
| `fg-theme.js` | period palette engine (preserved; see `../after/engines/`) |
| `fg-atmos.js` | WebGL atmosphere (preserved) |
| `fg-glyph.js` | glyph field (preserved) |
| `fg-motion.js` | motion runtime (preserved) |
| `fg-clock.js` | day clock (preserved) |

## Redaction

Flipgazine's anonymous key is embedded in four of these files. It is
replaced by the literal `FG_ANON_KEY_REDACTED` at
`fg-devnav.js:11`, `fg-header.html:67`, `fg-prefetch.js:10` and
`fg-theme.js:152`. The carried engine copies in `../after/engines/` contain
no key and no Supabase host (`measure.mjs` and the transfer smoke check
for both strings). The key was used only to read `site_files`; it must not
be used for anything else or copied anywhere.

`../before/claude-code.composed.html` is `measure.mjs`'s composition of
`fg-head.html` + `fg-header.html` + `claude-code.html`, which is what the
browser rendered for the before-metrics.
