import { COUNTRY_KINDS, type CountryKind, CUSTOM_FLAG_IDS, LANGS, META_KEYS, UNKNOWN_KEY } from './constants.ts';
import type { Issue } from './issues.ts';
import { slugify } from './slugify.ts';
import type { Located, RawRecord, SourceBundle } from './types.ts';

const COUNTRY_FIELDS = new Set(['code', 'aliases', 'name', 'flag', 'group', 'kind', 'period', 'successors', 'legacyNames']);
const SITE_FIELDS = new Set(['code', 'aliases', 'name', 'state', 'lat', 'lon', 'wiki']);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PERIOD_RE = /^(\d{4})-(\d{4})$/u;
const META = new Set<string>(META_KEYS);
const CUSTOM = new Set<string>(CUSTOM_FLAG_IDS);

export interface ValidateOptions {
  /** Lowercase flag-icons codes (`us`, `gb-sct`, `eu`, ...). */
  flagCodes: ReadonlySet<string>;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim() === v;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Checks shared by both collections: field set, code, aliases, name; returns the codes this record claims. */
function checkCommon(rec: Located<RawRecord>, allowed: Set<string>, what: string, issues: Issue[]): string[] {
  const v = rec.value;
  const at = (message: string) => issues.push({ file: rec.file, line: rec.line, message });
  const label = typeof v.code === 'string' ? v.code : '(no code)';

  for (const key of Object.keys(v)) {
    if (!allowed.has(key)) {
      at(`${what} ${label}: unknown field "${key}" (allowed: ${[...allowed].join(', ')})`);
    }
  }
  if (!isNonEmptyString(v.code)) {
    at(`${what}: "code" must be a non-empty string without surrounding spaces (quote codes like 'NO')`);
  }
  if (!isNonEmptyString(v.name)) {
    at(`${what} ${label}: "name" must be a non-empty string without surrounding spaces`);
  } else if (META.has(v.name)) {
    at(`${what} ${label}: name "${v.name}" is reserved for file metadata`);
  }
  if (!isStringArray(v.aliases)) {
    at(`${what} ${label}: "aliases" must be a list of strings (use [] for none)`);
    return isNonEmptyString(v.code) ? [v.code] : [];
  }
  const codes = isNonEmptyString(v.code) ? [v.code] : [];
  for (const alias of v.aliases) {
    if (!isNonEmptyString(alias)) {
      at(`${what} ${label}: alias ${JSON.stringify(alias)} must be a non-empty string without surrounding spaces`);
    } else {
      codes.push(alias);
    }
  }
  for (const c of codes) {
    if (META.has(c)) {
      at(`${what} ${label}: code "${c}" is reserved for file metadata (${META_KEYS.join(', ')})`);
    }
  }
  return codes;
}

/** Every code and alias unique across the collection; no alias equals another code. */
function checkUnique(owners: Map<string, Located<RawRecord>[]>, what: string, issues: Issue[]): void {
  for (const [code, recs] of owners) {
    if (recs.length < 2) {
      continue;
    }
    const where = recs.map((r) => `${String(r.value.code)} (line ${r.line})`).join(', ');
    for (const r of recs) {
      issues.push({ file: r.file, line: r.line, message: `${what} code/alias "${code}" is claimed more than once: ${where}` });
    }
  }
}

export function validate(bundle: SourceBundle, opts: ValidateOptions): Issue[] {
  const issues: Issue[] = [];

  // ── Countries ──────────────────────────────────────────────────────────────
  const countryOwners = new Map<string, Located<RawRecord>[]>();
  const canonical = new Map<string, Located<RawRecord>>();
  const aliasOf = new Map<string, string>();

  for (const rec of bundle.countries) {
    const codes = checkCommon(rec, COUNTRY_FIELDS, 'country', issues);
    for (const c of codes) {
      countryOwners.set(c, [...(countryOwners.get(c) ?? []), rec]);
    }
    if (isNonEmptyString(rec.value.code)) {
      canonical.set(rec.value.code, rec);
      for (const a of codes.slice(1)) {
        aliasOf.set(a, rec.value.code);
      }
    }
  }
  checkUnique(countryOwners, 'country', issues);
  if (bundle.countries.length > 0 && !countryOwners.has(UNKNOWN_KEY)) {
    issues.push({
      file: bundle.countries[0]?.file ?? 'source/countries.yaml',
      line: 0,
      message: `no country entry claims "${UNKNOWN_KEY}" (the consumer fallback key); add it as an alias of the unknown entry`,
    });
  }

  const names = new Map<string, Located<RawRecord>[]>();
  const groupRefs = new Map<string, Located<RawRecord>[]>();
  const groupHeads = new Map<string, Located<RawRecord>[]>();

  for (const rec of bundle.countries) {
    const v = rec.value;
    const label = String(v.code);
    const at = (message: string) => issues.push({ file: rec.file, line: rec.line, message: `country ${label}: ${message}` });

    // kind
    if (!COUNTRY_KINDS.includes(v.kind as CountryKind)) {
      at(`"kind" must be one of ${COUNTRY_KINDS.join(' | ')} (got ${JSON.stringify(v.kind)})`);
    }
    const kind = v.kind as CountryKind;

    // flag
    if (v.flag === undefined) {
      at('"flag" is required (use null when there is no flag image)');
    } else if (v.flag !== null) {
      if (typeof v.flag !== 'string') {
        at('"flag" must be a string or null');
      } else if (v.flag.startsWith('custom:')) {
        const id = v.flag.slice('custom:'.length);
        if (!CUSTOM.has(id)) {
          at(`unknown custom flag "${id}" (declared custom ids: ${CUSTOM_FLAG_IDS.join(', ')})`);
        }
      } else if (!opts.flagCodes.has(v.flag)) {
        at(`flag "${v.flag}" is not a flag-icons code${opts.flagCodes.has(v.flag.toLowerCase()) ? ` (did you mean "${v.flag.toLowerCase()}"?)` : ''}`);
      }
    }

    // group
    if (v.group === undefined) {
      at('"group" is required (use null for entries that never get a page)');
    } else if (v.group !== null && (typeof v.group !== 'string' || !SLUG_RE.test(v.group))) {
      at(`"group" must be a lowercase slug or null (got ${JSON.stringify(v.group)})`);
    }
    if (kind === 'special' && v.group !== null && v.group !== undefined) {
      at('kind "special" entries never get a page, so "group" must be null');
    }
    if (kind !== 'special' && v.group === null) {
      at(`kind "${String(kind)}" entries need a "group"`);
    }
    if (typeof v.group === 'string') {
      groupRefs.set(v.group, [...(groupRefs.get(v.group) ?? []), rec]);
      if (typeof v.name === 'string' && slugify(v.name) === v.group) {
        groupHeads.set(v.group, [...(groupHeads.get(v.group) ?? []), rec]);
      }
    }

    // historical
    if (kind === 'historical') {
      const m = typeof v.period === 'string' ? PERIOD_RE.exec(v.period) : null;
      if (!m) {
        at(`historical entries need "period" as "YYYY-YYYY" (got ${JSON.stringify(v.period)})`);
      } else if (Number(m[1]) > Number(m[2])) {
        at(`period ${v.period} ends before it starts`);
      }
      if (!isStringArray(v.successors)) {
        at('historical entries need "successors" as a list of codes (use [] for none)');
      }
    } else {
      if (v.period !== undefined) {
        at(`"period" is only allowed on kind historical (this is ${String(kind)})`);
      }
      if (v.successors !== undefined) {
        at(`"successors" is only allowed on kind historical (this is ${String(kind)})`);
      }
    }

    // legacy names
    if (v.legacyNames !== undefined && !(isStringArray(v.legacyNames) && v.legacyNames.every(isNonEmptyString))) {
      at('"legacyNames" must be a list of non-empty strings');
    }
    const allNames = [v.name, ...(isStringArray(v.legacyNames) ? v.legacyNames : [])].filter(isNonEmptyString);
    for (const n of allNames) {
      if (META.has(n)) {
        at(`name "${n}" is reserved for file metadata`);
      }
      names.set(n, [...(names.get(n) ?? []), rec]);
    }
  }

  // successors must be canonical, not self (checked after all canonicals are known)
  for (const rec of bundle.countries) {
    const v = rec.value;
    if (v.kind !== 'historical' || !isStringArray(v.successors)) {
      continue;
    }
    for (const s of v.successors) {
      const at = (message: string) => issues.push({ file: rec.file, line: rec.line, message: `country ${String(v.code)}: ${message}` });
      if (s === v.code) {
        at('lists itself as a successor');
      } else if (aliasOf.has(s)) {
        at(`successor "${s}" is an alias; use the canonical code "${aliasOf.get(s)}"`);
      } else if (!canonical.has(s)) {
        at(`successor "${s}" is not a country code`);
      }
    }
  }

  // English names (and legacy names) must be unique: they key countries.by-name.en.json
  for (const [name, recs] of names) {
    if (recs.length < 2) {
      continue;
    }
    const where = recs.map((r) => `${String(r.value.code)} (line ${r.line})`).join(', ');
    for (const r of recs) {
      issues.push({ file: r.file, line: r.line, message: `English name "${name}" is used by more than one entry: ${where}` });
    }
  }

  // Every group referenced exists exactly once as a canonical entry (the head: group === slugify(name))
  for (const [group, refs] of groupRefs) {
    const heads = groupHeads.get(group) ?? [];
    if (heads.length === 1) {
      continue;
    }
    const first = refs[0];
    if (!first) {
      continue;
    }
    if (heads.length === 0) {
      const who = refs.map((r) => String(r.value.code)).join(', ');
      issues.push({
        file: first.file,
        line: first.line,
        message: `group "${group}" (used by ${who}) has no head entry: exactly one entry must have group "${group}" and a name that slugifies to "${group}"`,
      });
    } else {
      const where = heads.map((r) => `${String(r.value.code)} (line ${r.line})`).join(', ');
      for (const h of heads) {
        issues.push({ file: h.file, line: h.line, message: `group "${group}" has ${heads.length} head entries (${where}); a group must exist exactly once` });
      }
    }
  }

  // ── i18n ───────────────────────────────────────────────────────────────────
  for (const lang of LANGS) {
    const { file, names: map } = bundle.i18n[lang];
    for (const [code, rec] of canonical) {
      const entry = map.get(code);
      if (!entry) {
        issues.push({ file, line: 0, message: `missing ${lang} name for country "${code}" (${String(rec.value.name)})` });
        continue;
      }
      if (!isNonEmptyString(entry.name)) {
        issues.push({ file, line: entry.line, message: `"${code}": ${lang} name must be a non-empty string without surrounding spaces (got ${JSON.stringify(entry.name)})` });
      } else if (lang === 'en' && entry.name !== rec.value.name) {
        issues.push({ file, line: entry.line, message: `"${code}": en name "${entry.name}" does not match countries.yaml name "${String(rec.value.name)}"` });
      }
    }
    for (const [code, entry] of map) {
      if (canonical.has(code)) {
        continue;
      }
      const hint = aliasOf.has(code) ? `it is an alias; use the canonical code "${aliasOf.get(code)}"` : 'no such country code';
      issues.push({ file, line: entry.line, message: `"${code}": ${hint}` });
    }
  }

  // ── Sites ──────────────────────────────────────────────────────────────────
  const siteOwners = new Map<string, Located<RawRecord>[]>();
  for (const rec of bundle.sites) {
    const codes = checkCommon(rec, SITE_FIELDS, 'site', issues);
    for (const c of codes) {
      siteOwners.set(c, [...(siteOwners.get(c) ?? []), rec]);
    }
    const v = rec.value;
    const at = (message: string) => issues.push({ file: rec.file, line: rec.line, message: `site ${String(v.code)}: ${message}` });

    if (codes.includes(UNKNOWN_KEY)) {
      at(`"${UNKNOWN_KEY}" is reserved; the build adds the fallback site itself`);
    }
    if (typeof v.lat !== 'number' || !Number.isFinite(v.lat) || v.lat < -90 || v.lat > 90) {
      at(`"lat" must be a number in [-90, 90] (got ${JSON.stringify(v.lat)})`);
    }
    if (typeof v.lon !== 'number' || !Number.isFinite(v.lon) || v.lon < -180 || v.lon > 180) {
      at(`"lon" must be a number in [-180, 180] (got ${JSON.stringify(v.lon)})`);
    }
    if (!isNonEmptyString(v.state)) {
      at('"state" must be a country code');
    } else if (aliasOf.has(v.state)) {
      at(`state "${v.state}" is an alias; use the canonical country code "${aliasOf.get(v.state)}"`);
    } else if (!canonical.has(v.state)) {
      at(`state "${v.state}" does not exist in countries.yaml`);
    }
    if (v.wiki === undefined) {
      at('"wiki" is required (use null when there is no article)');
    } else if (v.wiki !== null && (typeof v.wiki !== 'string' || !/^https:\/\/\S+$/u.test(v.wiki))) {
      at(`"wiki" must be an https URL or null (got ${JSON.stringify(v.wiki)})`);
    }
  }
  checkUnique(siteOwners, 'site', issues);

  return issues;
}
