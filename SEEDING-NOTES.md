# Seeding notes (initial import, 2026-10-11)

Where every value in `source/` came from, where the inputs disagreed, and which calls need a
reviewer. Plan: `hq/plans/vocabulary-registry-2026-10.md` (Part 1, countries + sites;
organizations deferred).

## Inputs

| Input | Used for |
| --- | --- |
| `workers/serve-keeptrack-api/src/models/countryMapList.ts` | Canonical code list and English names (290 keys, not the 288 the plan quotes) |
| `keeptrack-space/src/app/data/catalogs/countries.ts` (app) | Flags (preferred on conflict), extra raw codes |
| `keeptrack-home/src/components/satellite/countries.ts` (home) | Flags (fallback), extra raw codes, legacy site keys |
| `keeptrack-home/src/utils/satelliteSlugs.ts` | Group folding (by display name), `ORG_COUNTRY_NAMES` -> `kind: org`, `EXCLUDED_COUNTRY_NAMES` -> `kind: special` |
| `keeptrack-space/src/app/data/catalogs/locales/<lang>.src.json` (`countries`) | 11 non-English languages |
| `keeptrack-home/src/data/launch-site-countries.ts` (`SITE_STATE`) | The 62 GCAT site codes with orbital/deep-space launches, and their state |
| `workers/serve-keeptrack-api/src/models/launchSiteMap.ts`, home/app `launchSiteMap`, app `launch-sites.ts` | Space-Track and legacy aliases, wiki URLs |
| `ai-satellite-summaries/data/sites.tsv` and `orgs.tsv` (local GCAT copies dated 2026-03-04) | Site names, lat/lon, GCAT state codes and periods. No network access was used. |

## Countries

**Rule:** codes that share an English display name in the API map become ONE entry (the GCAT
state code is canonical, everything else an alias). This reproduces today's by-code names
exactly and today's hub groups (home folds by name), so the hub URL set is unchanged except
for the deliberate fixes below.

Result: 200 entries, 109 aliases, 309 codes (290 API keys + 18 extra raw codes + `UNKNOWN`),
194 groups (6 special entries have none).

### Extra aliases not in the API map

From the app/home maps (raw values seen in the COUNTRY column): `ES`, `Spain` -> E;
`France` -> F; `Japan`, `JP` -> J; `NO` -> N; `NZL`, `New Zealand` -> NZ; `Russia` -> RU;
`United States` -> US; `MNG` -> MN; `MUS` -> MU; `MDA` -> MD; `KWT` -> KW; `JOR` -> JO;
`BOTS` -> BW; `AE` -> UAE; `CAN` -> CA (added 2026-10-11 after keeptrack-home's
registry check found one catalog object with COUNTRY=CAN). Plus `UNKNOWN` -> TBD (the consumer fallback key).

Home's `countryFlagIconMap` has an empty-string key `'' -> GD` (a typo for `GRD`); GRD gets
flag `gd`.

### Names changed (URL-affecting changes marked)

| Code | Was | Now | Hub URL impact |
| --- | --- | --- | --- |
| AF | Afganistan | Afghanistan | `/afganistan` -> `/afghanistan` **(redirect needed)** |
| PH (+RP) | Phillipines (PH) and Philippines (RP) were two groups | one entry, Philippines | `/phillipines` -> `/philippines` **(redirect needed)** |
| I-NATO (+NATO) | "North Atlantic Treaty Organization" and "North Atlantic Treaty Org" were two groups | one entry, the long name | `/north-atlantic-treaty-org` -> `/north-atlantic-treaty-organization` **(redirect needed)** |
| AAT, BAT, TTPI | AAT, BAT, TTPI | full names | none (special, no page) |
| HK | China(Hong Kong) in home/app | China (Hong Kong), as the API already had | none (same slug) |

The old spellings stay as `legacyNames`, so `countries.by-name.en.json` still resolves what
the API emits today. New groups (no existing home page): `croatia`, `djibouti`, `oman`,
`senegal`, `zimbabwe` (in the API map, missing from home's copy).

Not changed, proposed for a later PR (each changes a URL): GCAT short forms such as
`Cayman Is.`, `Marshall Is.`, `Neth. Antilles`, `Arg. Antarctic`, `Ross Dep.`, `French SAL`,
`Wake I.`, `Canary Is`, `St Helena`; and `ISS` (I-ISS) vs `International` (ISS), which are the
same partnership split across two groups.

### Kinds

- `special`: Analyst Satellite, All, Unknown (TBD), AAT, BAT, TTPI (home's excluded set, as
  the plan says).
- `org`: home's `ORG_COUNTRY_NAMES` minus the special ones, PLUS Asia Broadcast Satellite
  (ABS), AsiaSat Corp (AC), ISS (I-ISS) and European Space Agency/Japan (ESA/JAXA), which the
  task names as org-type. Home's `isOrg` badge will newly appear on those four pages.
- `historical` (ruling 2): SU, CSSR (+CSFR, CZCH), DD, DR, DX, KGSR, ZR, COLP, HKUK, BGN, PCZ,
  ANTN (+KORS, KORSA). Each is its own group, never folded.
- `state`: everything else, including the joint codes CIS (USSR/Russia), CHBZ, FGER, FRIT,
  STCT, TMMC, USBZ (kept `state` so home's `isOrg` does not change for them).

Periods use the state's political existence, not its space era: SU 1922-1991 (the plan's
example said 1957-1991), CSSR 1918-1992, DD 1949-1990, DR 1933-1945, DX 1945-1949, KGSR
1936-1991, ZR 1971-1997, COLP 1960-1971, HKUK 1841-1997, BGN 1946-1990, PCZ 1903-1979,
ANTN 1954-2010.

Successors: SU -> RU first, then the other 14 post-Soviet states (UA BY KZ UZ TM TJ KG AM AZ
GE MD EE LV LT). CSSR -> CZ, SK. DD -> D. DR -> DX. DX -> D, DD. KGSR -> KG. ZR -> CD.
COLP -> ZR. HKUK -> HK. BGN -> BG. PCZ -> PAR. ANTN -> none (Curacao and Sint Maarten have no
code here).

**Yugoslavia** is named in ruling 2 but has no code in any input (GCAT has no Yugoslav state
code and no catalog object uses one), so there is no entry. Add `YU` with `kind: historical`
if one ever appears.

GCAT oddities kept as data, flagged here: GCAT dates `BG` 1944-1989 and `BGN` 1989-present
but names BGN "PR Bulgaria" and uses it for 1975-1987 objects, so the dates are swapped in
GCAT; the registry follows the names. `PLRL` (People's Republic of Poland) and `AGUK`/`BBUK`
(colonial Antigua/Barbados) share their successor's name in the API map, so they are aliases,
not historical entries. `KORS` is Curacao (2010-) in GCAT but named "Neth. Antilles" in the API
map, so it is an alias of ANTN for now.

### Flags: app vs home disagreements

| Code | App | Home | Chosen | Why |
| --- | --- | --- | --- | --- |
| CSSR, CSFR | CZ | CSSR/CSFR (no image) | `cz` | app copy; Czechia kept the Czechoslovak flag |
| I-NATO | I-NATO (app-only CSS) | NATO | `custom:nato` | app value is not flag-icons or a declared custom id |
| ITSO | ITSO (app-only CSS) | LU | `lu` | same; ITSO's name is Luxembourg |
| RASC | RASC (app-only CSS) | MU | `mu` | same; RASC's name is Mauritius |
| ESA/JAXA | ESA/JAXA (no image) | ESA | `custom:esa` | same |

Rule applied: app value if it is a flag-icons code or one of the 5 custom ids, else home's,
else null. Hand overrides: COLP `cd` (home said `CG`, the Republic of the Congo; GCAT COLP is
Congo-Leopoldville, the DR Congo's predecessor); I-EU `eu` (flag-icons ships the EU flag);
I-ISS `custom:iss`; GRD `gd`; DD, DR, DX null (flag-icons has no historical German flags).
Historical entries otherwise keep their sources' modern flags (KGSR `kg`, ZR `cd`, BGN `bg`,
HKUK `hk`); revisit if custom historical flags are added.

The app ships extra custom flag images (fi-i-arab, fi-i-eu, fi-eume, fi-eute, fi-i-inm,
fi-itso, fi-rasc) that home does not. They are NOT declared custom ids here (the declared set
is cis su nato esa iss), so Arabsat, EUMETSAT, EUTELSAT, INMARSAT, INTELSAT and RASCOM have
`flag: null`. Declaring them means shipping the images in home too.

### Translations

All 11 non-English languages came from the keeptrack-space locales, looked up by canonical
code (falling back to an alias key). Every canonical code had a locale entry, but several were
untranslated placeholders. Claude translated or corrected:

- Added (41): AAT, BAT, TTPI in cs de es fr it ja ko pl ru uk (zh existed); ESA/JAXA in all 11
  (the locales had the literal "ESA/JAXA").
- Corrected (7): zh TW "中国" -> "台湾"; zh STCT "新加坡/中国" -> "新加坡/台湾"; zh AG "安提瓜和巴布达"
  (Antigua and Barbuda) -> "安提瓜"; zh KGSR truncated -> "吉尔吉斯苏维埃社会主义共和国"; ru and uk
  NZRD abbreviations -> full "Ross Dependency" forms; ru PG spelled with a spaced em dash -> "Папуа-Новая Гвинея" (repo mandate: no em dashes; the hyphenated form is also standard).

## Launch sites

65 entries, 57 aliases. Canonical = GCAT site code; the set is home's `SITE_STATE` (62 sites
with orbital/deep-space launches), coordinates from GCAT, names hand-written in English, wiki
URLs from the app where it had one.

**Starbase:** GCAT code `STB` (Starbase, 2022-) is confirmed in the local sites.tsv
(UCode BCB; the 2016-2022 "Texas Launch Site" is a separate GCAT code `BCB`, not seeded).
Space-Track `BOCA` and `STARB` (27 Starship objects; added after keeptrack-home's registry
check) and the app's `STARBASE` are aliases of STB. Not provisional.

**Added after keeptrack-home's registry check (2026-10-11, version 2026.10.11-2):** two GCAT
site codes seen in 2026 launch history.

- `SDSC`: confirmed in the local sites.tsv (Satish Dhawan Space Ctr, Sriharikota, IN,
  2002-present, UCode SHAR, 13.621, 80.303). A separate GCAT era code from `SHAR`
  (1971-2002); Space-Track `SRI`/`SRILR` stay aliases of SHAR. Not provisional.
- `ECS`: NOT in the local sites.tsv (newer than the 2026-03-04 copy).

**Provisional sites:**

| Code | What | Why provisional |
| --- | --- | --- |
| `AMH` | Sutherland Spaceport (A' Mhoine), state SCOT, (58.51, -4.52) | Not in GCAT (no launch yet); keeps the legacy KeepTrack code as canonical. Replace when GCAT assigns a code. |
| `ECS` | East China Sea Launch Area, state CN, (29.0, 123.5), wiki East_China_Sea | Code absent from the local GCAT copy. Name and state are inferred (Chinese sea-launch areas: HHAI Yellow Sea, YJ Yangjiang); coordinates are the sea's centroid, not a launch point. Confirm against a current GCAT sites.tsv and correct name/lat/lon. |

Space-Track / legacy alias mapping calls a reviewer should confirm:

| Alias | Mapped to | Note |
| --- | --- | --- |
| AFETR | CC | Space-Track's Eastern Range also covers KSC; KSC stays its own GCAT site |
| ERAS (Pegasus East) | CC | air launch; mapped to the departure base |
| WRAS (Pegasus West) | V | air launch; mapped to the pre-2021 Vandenberg code |
| AFWTR | VSFB | current Vandenberg code |
| CAS (Canaries airspace) | GANC | GCAT state ESCN, so attribution moves from "United States" (API sitec) to Canary Is |
| KYMTR, KYMSC | GTsMP-4 | current Kapustin Yar code |
| PKMTR, PLMSC | GIK-1 | |
| SADOL, SUBL | BLA | Barents Sea submarine area |
| SEAL | KLA | also a COUNTRY code (Russia); separate collection, no clash |
| KWAJ | KMR | state TTPI (special) per GCAT |
| OREN, DLS | YAS | Yasny/Dombarovsky |
| RLLC, RLLB | MAHIA | the app named RLLB "Rocket Lab Launch Complex 2" (Wallops) but attributed it to New Zealand; home said NZ |
| SCSLA | YJ | Yangjiang sea area |
| YSLA | HHAI | Yellow Sea (Huang Hai) |
| SVOB, SVOBO | GIK-2 | `SVOB` is also a GCAT site code (Svobodniy 1990-); collides if that GCAT site is ever seeded |
| SRI, SRILR | SHAR | |
| KSCUT | USC | KASC (pre-2003 name) stays separate |
| ALCSC, ANDSP, BOS, SHASC, SPKII, STARBASE | ALCA, AND, BOWEN, SHAHR, KII, STB | app keys |

Dropped: `ANALSAT` (no location; consumers fall back to `UNKNOWN`). App pad-level keys
(`AFETR-LC39A`, `TTMTR-1`, ...) and planned sites with no GCAT code (ELAREN, OSATC, SPSWE,
MARLS, MASC, EHLC, PBNB, VIKRAM, ALEUT-SPIN, FRGUI-ELV/ELA4) are out of scope for a
site-level table.

**State calls:**

- `GIK-5` (Baikonur, Russian era) has `state: RU`, as GCAT and home's `SITE_STATE` say. The
  plan's example showed `KZ`; using KZ would move every Russian-era Baikonur launch to
  Kazakhstan on home's year pages.
- `GTsMP-4` (Kapustin Yar, 1999-) is hand-corrected from GCAT's `SU` to `RU`.
- `BLA` (Barents Sea, 1960-present) and `NIIP-5` keep `SU`. Post-1991 submarine launches and
  GCAT's occasional legacy tagging (home's comment: the 2026 Soyuz-5 debut came through as
  NIIP-5) still need home's `year > 1991 -> RU` fallback. The plan's Part 2 step 4 says to
  ignore `year`; keep the fallback for SU-coded sites instead.
- Home's `STATE_COUNTRY` re-attributes some states to the operating nation (GUF -> Europe,
  KE -> Italy, DZ -> France, KI -> Sea Launch, TTPI -> United States). That is a launch-page
  presentation choice, not registry data; Part 2 must keep it in home or add a field.

Coordinates are GCAT's, which are coarse for some sites (Baikonur 46.0, 63.0). The app's
pad-level coordinates are more precise but describe pads, not sites.
