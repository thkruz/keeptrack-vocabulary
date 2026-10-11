import { LANGS } from '../src/constants.ts';
import type { Issue } from '../src/issues.ts';
import { parseList, parseNameMap } from '../src/load.ts';
import type { SourceBundle } from '../src/types.ts';

export const FLAGS = new Set(['us', 'ru', 'gb', 'gb-sct', 'de', 'cz', 'sk', 'kz']);

/** Minimal valid fixture: US (with UNKNOWN on TBD), USSR (historical) -> RU, Russia, ESA (custom flag), TBD. */
export const COUNTRIES = `
- code: 'US'
  aliases: ['USA']
  name: United States
  flag: us
  group: united-states
  kind: state
- code: 'RU'
  aliases: []
  name: Russia
  flag: ru
  group: russia
  kind: state
- code: 'SU'
  aliases: []
  name: USSR
  flag: custom:su
  group: ussr
  kind: historical
  period: '1922-1991'
  successors: ['RU']
- code: 'I-ESA'
  aliases: ['ESA']
  name: European Space Agency
  flag: custom:esa
  group: european-space-agency
  kind: org
- code: 'TBD'
  aliases: ['UNKNOWN']
  name: Unknown
  flag: null
  group: null
  kind: special
`;

export const SITES = `
- code: 'STB'
  aliases: ['BOCA']
  name: Starbase
  state: 'US'
  lat: 25.9964
  lon: -97.1536
  wiki: https://en.wikipedia.org/wiki/SpaceX_Starbase
`;

const NAMES: Record<string, string> = { US: 'United States', RU: 'Russia', SU: 'USSR', 'I-ESA': 'European Space Agency', TBD: 'Unknown' };

export function i18nYaml(names: Record<string, string> = NAMES): string {
  return Object.entries(names)
    .map(([k, v]) => `'${k}': ${JSON.stringify(v)}`)
    .join('\n');
}

export interface FixtureOverrides {
  countries?: string;
  sites?: string;
  /** Per-language YAML text; languages not given get the default English names. */
  i18n?: Partial<Record<(typeof LANGS)[number], string>>;
}

export function fixture(o: FixtureOverrides = {}): { bundle: SourceBundle; parseIssues: Issue[] } {
  const parseIssues: Issue[] = [];
  const i18n = {} as SourceBundle['i18n'];
  for (const lang of LANGS) {
    const file = `source/i18n/countries.${lang}.yaml`;
    i18n[lang] = { file, names: parseNameMap(o.i18n?.[lang] ?? i18nYaml(), file, parseIssues) };
  }
  return {
    bundle: {
      countries: parseList(o.countries ?? COUNTRIES, 'source/countries.yaml', parseIssues),
      sites: parseList(o.sites ?? SITES, 'source/sites.yaml', parseIssues),
      i18n,
    },
    parseIssues,
  };
}
