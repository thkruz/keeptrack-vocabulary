# keeptrack-vocabulary

One source of truth for the vocabulary KeepTrack's catalog speaks: country/state codes,
launch sites, flags, display groups and localized country names. Hand-curated YAML in
`source/` is validated and denormalized by `pnpm build` into plain JSON lookup tables, so
every consumer does a dictionary lookup and nothing else.

Published two ways from the same CI build, with the same version string:

| Channel | Where | Used by |
| --- | --- | --- |
| R2 (live) | `https://r2.keeptrack.space/vocabulary/v1/<file>` (latest) and `.../vocabulary/v1/<version>/<file>` (pinned, immutable) | API, Pro, networked surfaces |
| npm (bundled fallback) | `@kruczek-labs/keeptrack-vocabulary` | OSS builds, build-time consumers, the fallback when R2 is unreachable |

The catalog keeps RAW codes (`COUNTRY`, `LAUNCH_SITE`). Resolution happens at read time by
looking the raw code up in these tables.

## Consumer contract

That is the whole contract:

```ts
const table = (await tryFetch(R2_URL)) ?? bundled;   // replace or keep
const entry = table[code] ?? table.UNKNOWN;            // dictionary lookup
```

Rules:

1. **Replace, never merge.** When a fetched copy satisfies
   `remote.schema === local.schema && remote.version > local.version`, use it instead of the
   bundled one. Otherwise keep the bundle. A fetch failure or a schema mismatch keeps the
   bundle and logs once.
2. **Version comparison is a string comparison.** `version` is `YYYY.MM.DD-N` with a
   zero-padded date and N in 1..9, so `>` on the strings orders versions correctly. (npm needs
   semver, so the npm package version drops the zero padding: `2026.10.11-1` on R2 is
   `2026.10.11-1` on npm, `2026.01.05-2` is `2026.1.5-2`. The `version` field inside the files is
   always the padded form.)
3. **Every by-code table has an `UNKNOWN` key**, so `table[code] ?? table.UNKNOWN` always yields
   an entry.
4. **Aliases are already expanded.** `USA`, `US` and `GLOB` are three keys pointing at the same
   entry; the entry's `code` is the canonical one. Never implement alias logic downstream.
5. **`flagClass` is final** (`fi-us`, `fi-gb-sct`, or a custom `fi-esa` / `fi-su` / `fi-cis` /
   `fi-nato` / `fi-iss`). Render `<span class="fi {flagClass}">`. `null` means there is no flag
   image; omit the flag. The custom images ship in each client's CSS; the registry only names
   them.
6. **Ignore unknown fields.** New optional fields can appear without a schema bump. A schema
   bump means a breaking shape change.

## Files

Every file is one JSON object. Next to its data keys it carries
`{ "schema": 1, "version": "2026.10.11-1", "generatedAt": "<ISO 8601>" }`; no code, alias or
name is ever one of those three keys.

| File | Shape | Notes |
| --- | --- | --- |
| `countries.by-code.json` | `{ [code or alias]: { code, name, flagClass, group, kind, period?, successors? } }` | `period` and `successors` only on `kind: "historical"` |
| `countries.by-name.en.json` | `{ [English name]: same entry }` | Transitional, for consumers that only have the English name (keeptrack-home until the API emits codes). Also keyed by legacy spellings (`Afganistan`). Removed when the last name-keyed consumer is gone. |
| `countries.names.<lang>.json` | `{ [code or alias]: localized name }` | 12 languages: cs de en es fr it ja ko pl ru uk zh. Load one. |
| `countries.groups.json` | `{ [group]: { name, slug, codes: [...] } }` | Hub pages and filter menus. `codes` lists every raw code (canonical and alias) to query. `slug` uses keeptrack-home's `slugify` rule. |
| `sites.by-code.json` | `{ [code or alias]: { code, name, state, lat, lon, wiki } }` | `state` is a canonical country code. The `UNKNOWN` entry has `lat`/`lon` null. |
| `manifest.json` | `{ schema, version, generatedAt, counts, files: { [file]: { sha256, bytes, keys } } }` | Written last on publish. |
| `types.d.ts` (npm only) | TypeScript types for all of the above | `import type { CountriesByCode } from '@kruczek-labs/keeptrack-vocabulary/types'` |

npm usage:

```ts
import byCode from '@kruczek-labs/keeptrack-vocabulary/countries.by-code.json' with { type: 'json' };
```

### Country kinds

| kind | Meaning |
| --- | --- |
| `state` | A state, territory, region, or a joint/multinational catalog code (`USSR/Russia`, `France/Germany`) |
| `org` | An international organization or operator used in the COUNTRY column (ESA, NATO, EUMETSAT, ISS, ABS) |
| `historical` | A state that no longer exists (USSR, Czechoslovakia, East Germany, ...). Always its own entry and its own group, never folded into a successor. Carries `period` ("1922-1991") and `successors` (canonical codes). Show a "Historical state" badge with the period and link the successors; list historical groups at the bottom of filter menus. |
| `special` | Not a real grouping (Unknown, All, Analyst Satellite, AAT, BAT, TTPI). `group` is null; never gets a page. |

## Editing the vocabulary

All changes are PRs against `source/`:

```
source/
  countries.yaml            one entry per canonical code
  sites.yaml                one entry per canonical launch site (GCAT code is canonical)
  i18n/countries.<lang>.yaml  canonical code -> name, 12 languages
scripts/
  build.ts                  validate + emit dist/
  diff.ts                   snapshot diff between two builds (CI posts it on PRs)
  publish.ts                upload dist/ to R2 (CI only)
  next-version.ts           next YYYY.MM.DD-N from the live R2 manifest (CI only)
  harvest-gcat-sites.ts     documented stub for the GCAT site harvest
```

Country entry:

```yaml
- code: 'US'                       # canonical (quote codes: 'NO' and 'N' are booleans in YAML 1.1)
  aliases: ['GLOB', 'NICO', 'ORB', 'USA', 'United States']
  name: United States              # English; other languages in i18n/
  flag: us                         # flag-icons code, custom:<id> (cis su nato esa iss), or null
  group: united-states             # the head entry's name slugifies to its group
  kind: state                      # state | org | historical | special
```

Historical entries add `period: '1922-1991'` and `successors: ['RU', ...]`. Any entry may add
`legacyNames: [...]` (former English spellings, emitted only into the by-name table).

Site entry:

```yaml
- code: 'GIK-5'                    # GCAT site code; GCAT codes carry the era (NIIP-5 is Soviet-era Baikonur)
  aliases: ['TTMTR', 'TYMSC']      # Space-Track and legacy KeepTrack codes
  name: Baikonur Cosmodrome
  state: 'RU'                      # canonical country code of the attributed state
  lat: 46
  lon: 63
  wiki: https://en.wikipedia.org/wiki/Baikonur_Cosmodrome
```

### Validation (the build fails on any violation)

- Every code and alias is unique across its collection; no alias equals another code.
- Every country has a name in all 12 languages; no empty strings; the English file matches
  `name`; i18n files contain no aliases or unknown codes.
- Every `flag` is a real flag-icons code or one of the declared custom ids.
- Every site has numeric `lat`/`lon` in range and a `state` that is a canonical country code.
- Every `group` referenced exists exactly once as a canonical entry (exactly one head entry
  whose name slugifies to the group). Special entries have no group; everything else has one.
- Historical entries have a valid `period` and canonical `successors`; nothing else has them.
- English names (including legacy names) are unique; no code or name collides with the
  metadata keys; some entry claims `UNKNOWN`; no unknown fields (catches typos).
- The PR job prints a snapshot diff (added / removed / renamed codes, alias remaps, field
  changes) against the base branch in the job summary.

The report lists every problem grouped by file with line numbers.

### PR checklist

- [ ] `pnpm build` and `pnpm test` pass locally.
- [ ] A new country has all 12 names (Claude translates; there are no human translators, and
      there is no provenance field).
- [ ] A rename or merge that changes a group slug changes a public URL on keeptrack-home: note
      the redirect in the PR.
- [ ] CHANGELOG.md updated.

## Local commands

```sh
pnpm install
pnpm build            # validate + write dist/ (version from VOCAB_VERSION, default today's -1)
pnpm validate         # validate only
pnpm test             # vitest
pnpm lint             # biome + tsc
pnpm diff <baseDist>  # compare two builds
pnpm publish:r2 --dry-run   # show what CI would upload
```

Publishing is CI-only (push to `main`): it needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` and `NPM_TOKEN` secrets in the `production` environment.

## License

AGPL-3.0-only, Theodore Kruczek. Launch-site codes and coordinates derive from Jonathan McDowell's
[GCAT](https://planet4589.org/space/gcat/) (CC-BY); country codes from GCAT and Space-Track.
