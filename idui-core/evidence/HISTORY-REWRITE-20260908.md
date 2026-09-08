# History rewrite — 8 September 2026

r60 (`f3c7c63`, 7 September 2026) committed two of the hotel's daily business
reports under `today-update/` to this public repository, against the security
boundary in `docs/DAILY-BUSINESS-DATA-INGEST-RUNBOOK.md`. On the owner's word
("Remove and purge history now", 8 September) the 23 commits from r60 to r72
were rewritten with `git filter-branch --index-filter 'git rm -r --cached
--ignore-unmatch today-update'` and `main` was force-pushed. The rewrite drops
those two paths and nothing else: the old tip `38fc4e6` and the new tip
`1c69f0c` differ by exactly the two files; every message, author and date is
unchanged. `today-update/` is ignored from this commit on.

Evidence records in this folder that cite a commit by its old hash
(`published.json` states, `blind-20260907/RESULT.md`, `owner-ratings.json`)
are left as written — `owner-ratings.json` is hash-pinned by
`scripts/build-betta.mjs` — and resolve through this map. The claim commit
`93971ec` (PROTOCOL.md A1) predates the rewrite and is untouched.

| old | new | commit |
|---|---|---|
| `38fc4e6` | `1c69f0c` | r72: the F&B head line runs the card's width; two stale /ci specimens |
| `fe4b9fb` | `2913d89` | The brief sees a hairline at 0.05; the Typography Gate waits its turn on the CI account |
| `f5ef676` | `2ad9246` | r71: the hairline that closes a card's head runs the card's width |
| `e15ddee` | `51111a7` | r70: the metric, the disclosure, the card skeleton and the retry row move to app-html.js |
| `d5f211f` | `fe6eeea` | r69: a caption frames its figure, the disclosure head keeps its hairline, F&B says when |
| `ce6c7fb` | `a94fa1a` | HANDOFF: the Jobs queue entry no longer claims the drag reorder r61 removed |
| `a4609c4` | `feeb660` | Launch Hardening waits for the Deploy run of its commit before signing in |
| `d5a3c3f` | `8192218` | HANDOFF: the release recipe with the brief, and r67/r68 in the history |
| `9cd41f6` | `e0d040f` | r68: the audit fixes, and the brief reads the signed-in app |
| `be49332` | `4e6de89` | r67: the third test published, and the footer swapping documents in place |
| `897a42e` | `87c3602` | r66: the grid at the edge, and the seam after a ruled section |
| `ff58868` | `0361b4e` | r65: one divider or the other, never both |
| `1d1ac42` | `525ce6e` | r64: the last row's rule, and a stylesheet that has to parse |
| `555e95b` | `b2b27ba` | r63: Today composed against the library it now has |
| `b5cc99e` | `cd9c7fb` | Test 04: the written rule's predictions, committed before the owner judges |
| `945ae96` | `fb546cd` | Test 04: blind rating result - Claude's taste is at chance |
| `c6a1f14` | `22f0865` | Test 04: Claude's blind ratings, committed before the owner's |
| `2ce1ee1` | `eff119c` | Test 04: first editorial acceptance, and two falsified hypotheses |
| `7e78022` | `296a61f` | Test 04: record that the renderer was never under test |
| `0506241` | `896c5cc` | r62: the toggle stays on the title's line |
| `8aa7ce5` | `f0049eb` | r61a: rebuild the documents for v140, and let the brief catch that |
| `ec8057f` | `4557e35` | r61: Jobs two-up, drag reorder removed, order by received date |
| `f3c7c63` | `f0503e0` | r60: two cards per row on a desktop, one on a phone |
