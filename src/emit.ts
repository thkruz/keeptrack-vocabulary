import { createHash } from 'node:crypto';
import { LANGS, SCHEMA, UNKNOWN_KEY } from './constants.ts';
import { flagClass } from './flags.ts';
import type { CountryEntry, CountrySource, GroupEntry, Meta, SiteEntry, SiteSource, SourceBundle } from './types.ts';

/** Emitted file name -> JSON value. Every value starts with the Meta keys. */
export type Emitted = Record<string, Record<string, unknown>>;

export const FILES = {
  countriesByCode: 'countries.by-code.json',
  countriesByNameEn: 'countries.by-name.en.json',
  countriesGroups: 'countries.groups.json',
  countryNames: (lang: string) => `countries.names.${lang}.json`,
  sitesByCode: 'sites.by-code.json',
  manifest: 'manifest.json',
} as const;

/** Code-point order (not locale order), so output is identical on every machine. */
const codePointCompare = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};
const byKey = <T>(entries: [string, T][]): Record<string, T> => Object.fromEntries(entries.sort(([a], [b]) => codePointCompare(a, b)));

function countryEntry(c: CountrySource): CountryEntry {
  const entry: CountryEntry = { code: c.code, name: c.name, flagClass: flagClass(c.flag), group: c.group, kind: c.kind };
  if (c.kind === 'historical') {
    entry.period = c.period;
    entry.successors = c.successors ?? [];
  }
  return entry;
}

function siteEntry(s: SiteSource): SiteEntry {
  return { code: s.code, name: s.name, state: s.state, lat: s.lat, lon: s.lon, wiki: s.wiki };
}

/**
 * Build every dist file from a VALIDATED bundle (run validate() first; this trusts the shapes).
 * The manifest is not included; see withManifest().
 */
export function emit(bundle: SourceBundle, meta: Meta): Emitted {
  const countries = bundle.countries.map((r) => r.value as unknown as CountrySource);
  const sites = bundle.sites.map((r) => r.value as unknown as SiteSource);
  const head = (): Meta => ({ schema: meta.schema, version: meta.version, generatedAt: meta.generatedAt });
  const out: Emitted = {};

  // countries.by-code.json: canonical code and every alias, each pointing at the same entry.
  const byCode: [string, CountryEntry][] = [];
  for (const c of countries) {
    const entry = countryEntry(c);
    for (const code of [c.code, ...c.aliases]) {
      byCode.push([code, entry]);
    }
  }
  out[FILES.countriesByCode] = { ...head(), ...byKey(byCode) };

  // countries.by-name.en.json: transitional, keyed by English name (and legacy spellings).
  const byName: [string, CountryEntry][] = [];
  for (const c of countries) {
    const entry = countryEntry(c);
    for (const name of [c.name, ...(c.legacyNames ?? [])]) {
      byName.push([name, entry]);
    }
  }
  out[FILES.countriesByNameEn] = { ...head(), ...byKey(byName) };

  // countries.names.<lang>.json: code (and alias) -> localized name.
  for (const lang of LANGS) {
    const names = bundle.i18n[lang].names;
    const rows: [string, string][] = [];
    for (const c of countries) {
      const localized = names.get(c.code)?.name;
      if (typeof localized !== 'string') {
        throw new Error(`emit: missing ${lang} name for ${c.code}; validate() should have caught this`);
      }
      for (const code of [c.code, ...c.aliases]) {
        rows.push([code, localized]);
      }
    }
    out[FILES.countryNames(lang)] = { ...head(), ...byKey(rows) };
  }

  // countries.groups.json: group -> { name, slug, codes }. The head entry (slugify(name) === group) names it.
  const groups = new Map<string, GroupEntry>();
  for (const c of countries) {
    if (c.group === null) {
      continue;
    }
    const g = groups.get(c.group) ?? { name: '', slug: c.group, codes: [] };
    g.codes.push(c.code, ...c.aliases);
    groups.set(c.group, g);
  }
  for (const c of countries) {
    const g = c.group === null ? undefined : groups.get(c.group);
    if (g && g.name === '' && c.group === g.slug) {
      // validate() guarantees exactly one head per group; it is the entry whose own slug equals the group
      g.name = c.name;
    }
  }
  for (const g of groups.values()) {
    g.codes.sort();
  }
  out[FILES.countriesGroups] = { ...head(), ...byKey([...groups.entries()]) };

  // sites.by-code.json, plus a synthetic UNKNOWN fallback (no location).
  const unknownCountry = countries.find((c) => c.code === UNKNOWN_KEY || c.aliases.includes(UNKNOWN_KEY));
  const siteRows: [string, SiteEntry][] = [];
  for (const s of sites) {
    const entry = siteEntry(s);
    for (const code of [s.code, ...s.aliases]) {
      siteRows.push([code, entry]);
    }
  }
  siteRows.push([UNKNOWN_KEY, { code: UNKNOWN_KEY, name: 'Unknown', state: unknownCountry?.code ?? UNKNOWN_KEY, lat: null, lon: null, wiki: null }]);
  out[FILES.sitesByCode] = { ...head(), ...byKey(siteRows) };

  return out;
}

/** Serialize a file exactly as it is written to dist/ (stable key order, 2-space indent, trailing newline). */
export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const DATA_KEYS = (v: Record<string, unknown>) => Object.keys(v).filter((k) => k !== 'schema' && k !== 'version' && k !== 'generatedAt');

/** Add manifest.json: every file's sha256, size and key count, plus headline counts. */
export function withManifest(files: Emitted, meta: Meta, counts: Record<string, number>): Emitted {
  const listing: Record<string, { sha256: string; bytes: number; keys: number }> = {};
  for (const name of Object.keys(files).sort()) {
    const value = files[name];
    if (!value) {
      continue;
    }
    const text = serialize(value);
    listing[name] = { sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text), keys: DATA_KEYS(value).length };
  }
  return { ...files, [FILES.manifest]: { schema: SCHEMA, version: meta.version, generatedAt: meta.generatedAt, counts, files: listing } };
}
