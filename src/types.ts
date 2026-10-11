import type { CountryKind, Lang } from './constants.ts';

// ── Source (hand-curated YAML) ───────────────────────────────────────────────

export interface CountrySource {
  /** Canonical code (GCAT state code where one exists). */
  code: string;
  /** Every other raw code that means this entry (Space-Track, legacy KeepTrack, dirty catalog values). */
  aliases: string[];
  /** English display name. Other languages live in source/i18n. */
  name: string;
  /** flag-icons ISO code (`us`, `gb-sct`), `custom:<id>`, or null when no flag image exists. */
  flag: string | null;
  /** Display group (hub page / filter menu bucket), or null for entries that never get a page. */
  group: string | null;
  kind: CountryKind;
  /** Historical entries only: "YYYY-YYYY". */
  period?: string;
  /** Historical entries only: canonical codes of successor states. */
  successors?: string[];
  /** Former English spellings, emitted only into the transitional countries.by-name.en.json. */
  legacyNames?: string[];
}

export interface SiteSource {
  /** Canonical code (GCAT site code where one exists). */
  code: string;
  /** Space-Track and legacy KeepTrack codes for the same site. */
  aliases: string[];
  name: string;
  /** Canonical registry country code of the attributed state. */
  state: string;
  lat: number;
  lon: number;
  wiki: string | null;
}

/** A parsed source record plus where it came from, for error messages. */
export interface Located<T> {
  value: T;
  file: string;
  line: number;
}

/** Raw records as parsed; validate() proves they match CountrySource / SiteSource. */
export type RawRecord = Record<string, unknown>;

export interface SourceBundle {
  countries: Located<RawRecord>[];
  sites: Located<RawRecord>[];
  /** lang -> canonical code -> localized name (with the line each key sits on). */
  i18n: Record<Lang, { file: string; names: Map<string, { name: unknown; line: number }> }>;
}

// ── Emitted (dist/) ──────────────────────────────────────────────────────────

export interface Meta {
  schema: 1;
  /** "YYYY.MM.DD-N", N in 1..9, so plain string comparison orders versions. */
  version: string;
  /** ISO 8601 build time. */
  generatedAt: string;
}

export interface CountryEntry {
  code: string;
  name: string;
  /** Final CSS class (`fi-us`, `fi-esa`), or null when there is no flag image. */
  flagClass: string | null;
  group: string | null;
  kind: CountryKind;
  /** Present on kind "historical" only. */
  period?: string;
  /** Present on kind "historical" only. */
  successors?: string[];
}

export interface GroupEntry {
  name: string;
  slug: string;
  /** Every raw code (canonical and alias) whose entry belongs to this group, sorted. */
  codes: string[];
}

export interface SiteEntry {
  code: string;
  name: string;
  state: string;
  /** Null only on the synthetic UNKNOWN entry. */
  lat: number | null;
  lon: number | null;
  wiki: string | null;
}

export type Table<T> = Meta & Record<string, T>;
