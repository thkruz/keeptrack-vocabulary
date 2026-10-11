import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFlagIconCodes } from '../src/flags.ts';
import { formatReport } from '../src/issues.ts';
import { loadSource } from '../src/load.ts';
import { validate } from '../src/validate.ts';
import { COUNTRIES, FLAGS, fixture, i18nYaml, SITES } from './helpers.ts';

const run = (o: Parameters<typeof fixture>[0] = {}) => {
  const { bundle, parseIssues } = fixture(o);
  return [...parseIssues, ...validate(bundle, { flagCodes: FLAGS })];
};
const messages = (o: Parameters<typeof fixture>[0] = {}) => run(o).map((i) => i.message);

describe('real source/', () => {
  it('passes every rule', () => {
    const root = join(import.meta.dirname, '..');
    const { bundle, issues } = loadSource(join(root, 'source'), root);
    const all = [...issues, ...validate(bundle, { flagCodes: loadFlagIconCodes() })];
    expect(formatReport(all)).toBe('Validation passed: no issues.');
    expect(bundle.countries.length).toBeGreaterThan(150);
    expect(bundle.sites.length).toBeGreaterThan(50);
  });
});

describe('validate: fixture baseline', () => {
  it('accepts the minimal fixture', () => {
    expect(run()).toEqual([]);
  });
});

describe('validate: codes and aliases', () => {
  it('rejects an alias claimed by two entries', () => {
    const countries = COUNTRIES.replace('aliases: []\n  name: Russia', "aliases: ['USA']\n  name: Russia");
    expect(messages({ countries }).filter((m) => m.includes('"USA" is claimed more than once'))).toHaveLength(2);
  });

  it('rejects an alias that equals another canonical code', () => {
    const countries = COUNTRIES.replace('aliases: []\n  name: Russia', "aliases: ['US']\n  name: Russia");
    expect(messages({ countries }).some((m) => m.includes('"US" is claimed more than once'))).toBe(true);
  });

  it('rejects an alias equal to its own code', () => {
    const countries = COUNTRIES.replace("aliases: ['USA']", "aliases: ['US']");
    expect(messages({ countries }).some((m) => m.includes('"US" is claimed more than once'))).toBe(true);
  });

  it('rejects codes that collide with file metadata keys', () => {
    const countries = COUNTRIES.replace("aliases: ['USA']", "aliases: ['USA', 'version']");
    expect(messages({ countries }).some((m) => m.includes('reserved for file metadata'))).toBe(true);
  });

  it('requires some entry to claim UNKNOWN', () => {
    const countries = COUNTRIES.replace("aliases: ['UNKNOWN']", 'aliases: []');
    expect(messages({ countries }).some((m) => m.includes('no country entry claims "UNKNOWN"'))).toBe(true);
  });

  it('rejects unknown fields (typos)', () => {
    const countries = COUNTRIES.replace('  kind: org', '  kind: org\n  flg: esa');
    expect(messages({ countries }).some((m) => m.includes('unknown field "flg"'))).toBe(true);
  });

  it('reports the YAML line of the offending entry', () => {
    const countries = COUNTRIES.replace('flag: custom:esa', 'flag: xx');
    const issue = run({ countries }).find((i) => i.message.includes('"xx"'));
    expect(issue?.file).toBe('source/countries.yaml');
    expect(issue?.line).toBe(COUNTRIES.split('\n').findIndex((l) => l.includes("code: 'I-ESA'")) + 1);
  });
});

describe('validate: translations', () => {
  it('requires a name in every language', () => {
    const msgs = messages({ i18n: { ja: i18nYaml({ US: 'アメリカ合衆国', RU: 'ロシア', SU: 'ソ連', TBD: '不明' }) } });
    expect(msgs).toContain('missing ja name for country "I-ESA" (European Space Agency)');
  });

  it('rejects empty strings', () => {
    const msgs = messages({ i18n: { de: i18nYaml({ US: 'Vereinigte Staaten', RU: '', SU: 'UdSSR', 'I-ESA': 'ESA', TBD: 'Unbekannt' }) } });
    expect(msgs.some((m) => m.startsWith('"RU": de name must be a non-empty string'))).toBe(true);
  });

  it('rejects keys that are aliases or unknown codes', () => {
    const msgs = messages({ i18n: { fr: `${i18nYaml()}\n'USA': "États-Unis"\n'XX': "Nulle part"` } });
    expect(msgs).toContain('"USA": it is an alias; use the canonical code "US"');
    expect(msgs).toContain('"XX": no such country code');
  });

  it('requires en to match countries.yaml', () => {
    const msgs = messages({ i18n: { en: i18nYaml({ US: 'United States of America', RU: 'Russia', SU: 'USSR', 'I-ESA': 'European Space Agency', TBD: 'Unknown' }) } });
    expect(msgs.some((m) => m.includes('does not match countries.yaml name "United States"'))).toBe(true);
  });
});

describe('validate: flags', () => {
  it('rejects a flag that flag-icons does not ship', () => {
    expect(messages({ countries: COUNTRIES.replace('flag: ru', 'flag: zz') }).some((m) => m.includes('flag "zz" is not a flag-icons code'))).toBe(true);
  });

  it('hints at lowercase', () => {
    expect(messages({ countries: COUNTRIES.replace('flag: ru', 'flag: RU') }).some((m) => m.includes('did you mean "ru"'))).toBe(true);
  });

  it('rejects an undeclared custom flag id', () => {
    expect(messages({ countries: COUNTRIES.replace('custom:esa', 'custom:eumetsat') }).some((m) => m.includes('unknown custom flag "eumetsat"'))).toBe(true);
  });
});

describe('validate: groups', () => {
  it('rejects a group with no head entry', () => {
    const countries = COUNTRIES.replace('group: russia', 'group: russian-federation');
    expect(messages({ countries }).some((m) => m.includes('group "russian-federation" (used by RU) has no head entry'))).toBe(true);
  });

  it('accepts a non-head member joining a group', () => {
    const countries = `${COUNTRIES}- code: 'TUVA'\n  aliases: []\n  name: Tuva\n  flag: ru\n  group: russia\n  kind: state\n`;
    const i18n = Object.fromEntries(['cs', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'ru', 'uk', 'zh'].map((l) => [l, `${i18nYaml()}\n'TUVA': Tuva`]));
    expect(run({ countries, i18n })).toEqual([]);
  });

  it('rejects two head entries for one group (slug collision)', () => {
    const countries = `${COUNTRIES}- code: 'XRU'\n  aliases: []\n  name: RUSSIA\n  flag: ru\n  group: russia\n  kind: state\n`;
    expect(messages({ countries }).filter((m) => m.includes('group "russia" has 2 head entries'))).toHaveLength(2);
  });

  it('requires group null on special entries and non-null elsewhere', () => {
    const msgs = messages({ countries: COUNTRIES.replace('group: null\n  kind: special', 'group: unknown\n  kind: special').replace('group: russia', 'group: null') });
    expect(msgs.some((m) => m.includes('kind "special" entries never get a page'))).toBe(true);
    expect(msgs.some((m) => m.includes('kind "state" entries need a "group"'))).toBe(true);
  });

  it('rejects duplicate English names (by-name table keys)', () => {
    const countries = COUNTRIES.replace('kind: org', 'kind: org\n  legacyNames: [Russia]');
    expect(messages({ countries }).some((m) => m.includes('English name "Russia" is used by more than one entry'))).toBe(true);
  });
});

describe('validate: historical states', () => {
  it('requires period and successors', () => {
    const msgs = messages({ countries: COUNTRIES.replace("  period: '1922-1991'\n  successors: ['RU']\n", '') });
    expect(msgs.some((m) => m.includes('need "period"'))).toBe(true);
    expect(msgs.some((m) => m.includes('need "successors"'))).toBe(true);
  });

  it('rejects successors that are aliases or unknown', () => {
    const msgs = messages({ countries: COUNTRIES.replace("successors: ['RU']", "successors: ['USA', 'XX', 'SU']") });
    expect(msgs).toContain('country SU: successor "USA" is an alias; use the canonical code "US"');
    expect(msgs).toContain('country SU: successor "XX" is not a country code');
    expect(msgs).toContain('country SU: lists itself as a successor');
  });

  it('rejects period on a non-historical entry and reversed periods', () => {
    expect(
      messages({ countries: COUNTRIES.replace("kind: state\n- code: 'SU'", "kind: state\n  period: '1991-2000'\n- code: 'SU'") }).some((m) =>
        m.includes('"period" is only allowed on kind historical')
      )
    ).toBe(true);
    expect(messages({ countries: COUNTRIES.replace("'1922-1991'", "'1991-1922'") }).some((m) => m.includes('ends before it starts'))).toBe(true);
  });
});

describe('validate: sites', () => {
  it('requires lat/lon in range', () => {
    const msgs = messages({ sites: SITES.replace('lat: 25.9964', 'lat: 125').replace('  lon: -97.1536\n', '') });
    expect(msgs.some((m) => m.includes('"lat" must be a number in [-90, 90]'))).toBe(true);
    expect(msgs.some((m) => m.includes('"lon" must be a number in [-180, 180]'))).toBe(true);
  });

  it('requires state to be a canonical country', () => {
    expect(messages({ sites: SITES.replace("state: 'US'", "state: 'XX'") })).toContain('site STB: state "XX" does not exist in countries.yaml');
    expect(messages({ sites: SITES.replace("state: 'US'", "state: 'USA'") })).toContain('site STB: state "USA" is an alias; use the canonical country code "US"');
  });

  it('rejects duplicate site codes and the reserved UNKNOWN', () => {
    const sites = `${SITES}- code: 'BOCA'\n  aliases: ['UNKNOWN']\n  name: Boca Chica\n  state: 'US'\n  lat: 26\n  lon: -97\n  wiki: null\n`;
    const msgs = messages({ sites });
    expect(msgs.some((m) => m.includes('site code/alias "BOCA" is claimed more than once'))).toBe(true);
    expect(msgs.some((m) => m.includes('"UNKNOWN" is reserved'))).toBe(true);
  });

  it('requires https wiki or null', () => {
    expect(messages({ sites: SITES.replace('https://en.wikipedia.org/wiki/SpaceX_Starbase', 'http://example.com') }).some((m) => m.includes('"wiki" must be an https URL'))).toBe(
      true
    );
  });
});

describe('parse errors and report', () => {
  it('reports YAML syntax errors with a line', () => {
    const issues = run({ countries: "- code: 'US'\n  name: [unclosed\n" });
    expect(issues.some((i) => i.message.startsWith('YAML error') && i.line > 0)).toBe(true);
  });

  it('formats a grouped, line-sorted report', () => {
    const report = formatReport([
      { file: 'source/sites.yaml', line: 9, message: 'b' },
      { file: 'source/countries.yaml', line: 30, message: 'second' },
      { file: 'source/countries.yaml', line: 4, message: 'first' },
    ]);
    expect(report).toBe(
      ['Validation FAILED: 3 issues', '', 'source/countries.yaml (2)', '  line    4  first', '  line   30  second', '', 'source/sites.yaml (1)', '  line    9  b'].join('\n')
    );
  });
});
