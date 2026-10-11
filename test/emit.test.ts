import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { build } from '../scripts/build.ts';
import { LANGS, META_KEYS, UNKNOWN_KEY } from '../src/constants.ts';
import { diffTables } from '../src/diff.ts';
import { type Emitted, emit, FILES, serialize } from '../src/emit.ts';
import { flagClass } from '../src/flags.ts';
import { slugify } from '../src/slugify.ts';
import type { CountryEntry, GroupEntry, Meta, SiteEntry } from '../src/types.ts';
import { compareVersions, isValidVersion, nextVersion, toNpmVersion } from '../src/version.ts';
import { fixture } from './helpers.ts';

const META: Meta = { schema: 1, version: '2026.10.11-1', generatedAt: '2026-10-11T00:00:00.000Z' };
const data = <T>(file: Record<string, unknown> | undefined): Record<string, T> =>
  Object.fromEntries(Object.entries(file ?? {}).filter(([k]) => !(META_KEYS as readonly string[]).includes(k))) as Record<string, T>;

let files: Emitted;
beforeAll(() => {
  const result = build(join(import.meta.dirname, '..', 'source'), META);
  if (!result.ok || !result.files) {
    throw new Error(result.report);
  }
  files = result.files;
});

describe('emitted files', () => {
  it('emits exactly the planned file set', () => {
    expect(Object.keys(files).sort()).toEqual(
      [FILES.countriesByCode, FILES.countriesByNameEn, FILES.countriesGroups, FILES.sitesByCode, FILES.manifest, ...LANGS.map((l) => FILES.countryNames(l))].sort()
    );
  });

  it('every file carries { schema: 1, version, generatedAt }', () => {
    for (const [name, value] of Object.entries(files)) {
      expect(value.schema, name).toBe(1);
      expect(value.version, name).toBe(META.version);
      expect(value.generatedAt, name).toBe(META.generatedAt);
    }
  });

  it('countries.by-code: entry shape, aliases expanded, UNKNOWN present', () => {
    const t = data<CountryEntry>(files[FILES.countriesByCode]);
    for (const [key, e] of Object.entries(t)) {
      expect(Object.keys(e).sort(), key).toEqual(
        e.kind === 'historical' ? ['code', 'flagClass', 'group', 'kind', 'name', 'period', 'successors'] : ['code', 'flagClass', 'group', 'kind', 'name']
      );
      expect(t[e.code], `${key} -> ${e.code} must itself be a key`).toEqual(e);
    }
    expect(t.USA).toEqual(t.US);
    expect(t.US).toEqual({ code: 'US', name: 'United States', flagClass: 'fi-us', group: 'united-states', kind: 'state' });
    expect(t.ESA?.flagClass).toBe('fi-esa');
    expect(t.SCOT?.flagClass).toBe('fi-gb-sct');
    expect(t.ANALSAT?.flagClass).toBeNull();
    expect(t[UNKNOWN_KEY]?.kind).toBe('special');
    expect(t.SU).toMatchObject({ kind: 'historical', period: '1922-1991', flagClass: 'fi-su' });
    expect(t.SU?.successors?.[0]).toBe('RU');
    expect(t.CSFR?.code).toBe('CSSR');
  });

  it('countries.by-name.en: keyed by English name and legacy spellings', () => {
    const t = data<CountryEntry>(files[FILES.countriesByNameEn]);
    expect(t['United States']?.code).toBe('US');
    expect(t.Afganistan).toEqual(t.Afghanistan);
    expect(t['North Atlantic Treaty Org']?.code).toBe('I-NATO');
  });

  it('countries.names.<lang>: 12 files, every by-code key present with a non-empty name', () => {
    const codes = Object.keys(data(files[FILES.countriesByCode])).sort();
    for (const lang of LANGS) {
      const t = data<string>(files[FILES.countryNames(lang)]);
      expect(Object.keys(t).sort(), lang).toEqual(codes);
      for (const [code, name] of Object.entries(t)) {
        expect(typeof name === 'string' && name.length > 0, `${lang} ${code}`).toBe(true);
      }
    }
    expect(data<string>(files[FILES.countryNames('de')]).USA).toBe('Vereinigte Staaten');
  });

  it('countries.groups: { name, slug, codes }, slug follows slugify, specials excluded', () => {
    const groups = data<GroupEntry>(files[FILES.countriesGroups]);
    const byCode = data<CountryEntry>(files[FILES.countriesByCode]);
    for (const [key, g] of Object.entries(groups)) {
      expect(Object.keys(g).sort()).toEqual(['codes', 'name', 'slug']);
      expect(g.slug).toBe(key);
      expect(slugify(g.name)).toBe(g.slug);
      expect([...g.codes].sort()).toEqual(g.codes);
      for (const c of g.codes) {
        expect(byCode[c]?.group, c).toBe(key);
      }
    }
    expect(groups['united-states']?.codes).toContain('USA');
    expect(groups.czechoslovakia?.codes).toEqual(['CSFR', 'CSSR', 'CZCH']);
    expect(Object.values(groups).some((g) => g.codes.includes('TBD'))).toBe(false);
  });

  it('sites.by-code: shape, aliases expanded, BOCA resolves to Starbase, UNKNOWN fallback', () => {
    const t = data<SiteEntry>(files[FILES.sitesByCode]);
    const countries = data<CountryEntry>(files[FILES.countriesByCode]);
    for (const [key, s] of Object.entries(t)) {
      expect(Object.keys(s).sort(), key).toEqual(['code', 'lat', 'lon', 'name', 'state', 'wiki']);
      expect(countries[s.state], `${key} state ${s.state}`).toBeDefined();
      if (key !== UNKNOWN_KEY) {
        expect(typeof s.lat === 'number' && typeof s.lon === 'number').toBe(true);
      }
    }
    expect(t.BOCA?.code).toBe('STB');
    expect(t.TTMTR?.code).toBe('GIK-5');
    expect(t[UNKNOWN_KEY]).toMatchObject({ code: UNKNOWN_KEY, lat: null, lon: null });
  });

  it('manifest hashes match the serialized files', () => {
    const manifest = files[FILES.manifest] as { files: Record<string, { sha256: string; keys: number }>; counts: Record<string, number> };
    for (const [name, meta] of Object.entries(manifest.files)) {
      expect(createHash('sha256').update(serialize(files[name])).digest('hex'), name).toBe(meta.sha256);
    }
    expect(manifest.counts.countryCodes).toBe(Object.keys(data(files[FILES.countriesByCode])).length);
  });
});

describe('emit on the fixture', () => {
  it('builds the expected small tables', () => {
    const { bundle } = fixture();
    const out = emit(bundle, META);
    expect(data<CountryEntry>(out[FILES.countriesByCode]).ESA).toEqual({
      code: 'I-ESA',
      name: 'European Space Agency',
      flagClass: 'fi-esa',
      group: 'european-space-agency',
      kind: 'org',
    });
    expect(data<SiteEntry>(out[FILES.sitesByCode])[UNKNOWN_KEY]?.state).toBe('TBD');
  });
});

describe('helpers', () => {
  it('flagClass', () => {
    expect(flagClass('us')).toBe('fi-us');
    expect(flagClass('custom:nato')).toBe('fi-nato');
    expect(flagClass(null)).toBeNull();
  });

  it('slugify matches keeptrack-home launchSlugs', () => {
    expect(slugify('United States')).toBe('united-states');
    expect(slugify('China (Hong Kong)')).toBe('china-hong-kong');
    expect(slugify('China(Hong Kong)')).toBe('china-hong-kong');
    expect(slugify('USSR/Russia')).toBe('ussr-russia');
    expect(slugify('Neth. Antilles')).toBe('neth-antilles');
  });

  it('versions', () => {
    expect(isValidVersion('2026.10.11-1')).toBe(true);
    expect(isValidVersion('2026.02.30-1')).toBe(false);
    expect(isValidVersion('2026.10.11-10')).toBe(false);
    expect(isValidVersion('2026.1.5-1')).toBe(false);
    expect(compareVersions('2026.10.11-2', '2026.10.11-1')).toBe(1);
    expect(compareVersions('2026.09.30-9', '2026.10.01-1')).toBe(-1);
    const day = new Date(Date.UTC(2026, 9, 11, 23, 59));
    expect(nextVersion(null, day)).toBe('2026.10.11-1');
    expect(nextVersion('2026.10.11-1', day)).toBe('2026.10.11-2');
    expect(nextVersion('2026.10.10-4', day)).toBe('2026.10.11-1');
    expect(() => nextVersion('2026.10.11-9', day)).toThrow(/9 versions/u);
    expect(() => nextVersion('2026.10.12-1', day)).toThrow(/after today/u);
    expect(toNpmVersion('2026.01.05-2')).toBe('2026.1.5-2');
  });

  it('diffTables reports added, removed, renamed, remapped and changed', () => {
    const base = { schema: 1, A: { code: 'A', name: 'Alpha', flagClass: 'fi-a' }, AA: { code: 'A', name: 'Alpha', flagClass: 'fi-a' }, B: { code: 'B', name: 'Beta' } };
    const head = { schema: 1, A: { code: 'A', name: 'Alpha Prime', flagClass: 'fi-x' }, C: { code: 'C', name: 'Gamma' }, AA: { code: 'C', name: 'Gamma' } };
    const d = diffTables(base, head);
    expect(d.added).toEqual(['C']);
    expect(d.removed).toEqual(['B']);
    expect(d.renamed).toEqual([{ code: 'A', from: 'Alpha', to: 'Alpha Prime' }]);
    expect(d.remapped).toEqual([{ key: 'AA', from: 'A', to: 'C' }]);
    expect(d.changed).toEqual([{ code: 'A', field: 'flagClass', from: 'fi-a', to: 'fi-x' }]);
  });
});
