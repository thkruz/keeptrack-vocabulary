// Types for the JSON files in @keeptrack/vocabulary (also served at
// https://r2.keeptrack.space/vocabulary/v1/<file>). Data only; there is no runtime code.
//
//   import type { CountriesByCode } from '@keeptrack/vocabulary/types';
//   import byCode from '@keeptrack/vocabulary/countries.by-code.json' with { type: 'json' };

export type CountryKind = 'state' | 'org' | 'historical' | 'special';

/** Carried by every file, next to the data keys. */
export interface VocabularyMeta {
  /** Bumped only on a breaking shape change. Replace a bundled copy only when this matches. */
  schema: 1;
  /** "YYYY.MM.DD-N" (N 1..9). Fixed width, so `remote.version > local.version` orders correctly. */
  version: string;
  /** ISO 8601 build time. */
  generatedAt: string;
}

export interface CountryEntry {
  /** Canonical code; aliases resolve to the same entry. */
  code: string;
  /** English display name. */
  name: string;
  /** Final CSS class: "fi-us", "fi-gb-sct", or a custom "fi-esa" / "fi-su" / "fi-cis" / "fi-nato" / "fi-iss". Null when no flag image exists. */
  flagClass: string | null;
  /** Key into countries.groups.json, or null for entries that never get a page (kind "special"). */
  group: string | null;
  kind: CountryKind;
  /** kind "historical" only, e.g. "1922-1991". */
  period?: string;
  /** kind "historical" only: canonical codes of successor states. */
  successors?: string[];
}

export interface GroupEntry {
  name: string;
  slug: string;
  /** Every raw code (canonical and alias) in the group, sorted. */
  codes: string[];
}

export interface SiteEntry {
  code: string;
  name: string;
  /** Canonical country code (look it up in countries.by-code.json). */
  state: string;
  /** Null only on the UNKNOWN fallback entry. */
  lat: number | null;
  lon: number | null;
  wiki: string | null;
}

type Keyed<T> = VocabularyMeta & { [code: string]: T | VocabularyMeta[keyof VocabularyMeta] };

/** countries.by-code.json. Always has an UNKNOWN key. */
export type CountriesByCode = Keyed<CountryEntry>;
/** countries.by-name.en.json (transitional; removed once no consumer is name-keyed). */
export type CountriesByNameEn = Keyed<CountryEntry>;
/** countries.names.<lang>.json: code -> localized name. */
export type CountryNames = Keyed<string>;
/** countries.groups.json. */
export type CountryGroups = Keyed<GroupEntry>;
/** sites.by-code.json. Always has an UNKNOWN key. */
export type SitesByCode = Keyed<SiteEntry>;

export interface Manifest extends VocabularyMeta {
  counts: Record<string, number>;
  files: Record<string, { sha256: string; bytes: number; keys: number }>;
}
