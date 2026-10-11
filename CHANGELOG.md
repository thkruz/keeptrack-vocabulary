# Changelog

Versions are `YYYY.MM.DD-N` (npm: the same without zero padding). Every publish is listed.

## Unreleased (first publish, 2026.10.11-2)

Gaps found by keeptrack-home's registry check against the live catalog and launch history:

- Country alias `CAN` -> `CA`.
- Site alias `STARB` -> `STB` (Starbase; Space-Track code on Starship objects).
- Sites `SDSC` (Satish Dhawan Space Centre, GCAT 2002-present code) and `ECS` (East China
  Sea Launch Area, provisional; see SEEDING-NOTES.md).

Initial content (built as 2026.10.11-1, never published):

Initial registry MVP: countries and launch sites. Organizations are deferred.

- `source/countries.yaml`: 200 entries (309 codes with aliases), seeded from the API's
  `countryMapList`, flags from keeptrack-space and keeptrack-home, kinds and groups from
  keeptrack-home's hub-page rules. Historical states (USSR, Czechoslovakia, East Germany and
  others) are separate entries with `period` and `successors`.
- `source/i18n/`: country names in 12 languages (cs de en es fr it ja ko pl ru uk zh).
- `source/sites.yaml`: 65 launch sites with Space-Track and legacy aliases (BOCA, STARB ->
  Starbase `STB`).
- Emitted files: `countries.by-code.json`, `countries.by-name.en.json` (transitional),
  `countries.names.<lang>.json` x 12, `countries.groups.json`, `sites.by-code.json`,
  `manifest.json`, `types.d.ts`.
- Renames: Afganistan -> Afghanistan, Phillipines -> Philippines (merged with RP),
  North Atlantic Treaty Org -> North Atlantic Treaty Organization (merged with I-NATO). Old
  spellings remain keys of the by-name table. See SEEDING-NOTES.md.
