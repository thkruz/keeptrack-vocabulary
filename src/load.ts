import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from 'yaml';
import { LANGS, type Lang } from './constants.ts';
import type { Issue } from './issues.ts';
import type { Located, RawRecord, SourceBundle } from './types.ts';

export const COUNTRIES_FILE = 'countries.yaml';
export const SITES_FILE = 'sites.yaml';
export const i18nFile = (lang: Lang): string => `i18n/countries.${lang}.yaml`;

export interface LoadResult {
  bundle: SourceBundle;
  /** Parse-level problems (bad YAML, wrong top-level shape). Validation adds the rest. */
  issues: Issue[];
}

/** Parse a YAML text that must be a list of mappings; return each mapping with its 1-based line. */
export function parseList(text: string, file: string, issues: Issue[]): Located<RawRecord>[] {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: true, uniqueKeys: true });
  for (const err of doc.errors) {
    issues.push({ file, line: err.linePos?.[0]?.line ?? 0, message: `YAML error: ${err.message.split('\n')[0]}` });
  }
  if (doc.errors.length > 0) {
    return [];
  }
  const root = doc.contents;
  if (root === null) {
    return [];
  }
  if (!isSeq(root)) {
    issues.push({ file, line: 1, message: 'top level must be a YAML list of entries' });
    return [];
  }
  const out: Located<RawRecord>[] = [];
  for (const item of root.items) {
    const line = lineCounter.linePos(isMap(item) || isScalar(item) ? (item.range?.[0] ?? 0) : 0).line;
    let value: unknown = null;
    if (isMap(item)) {
      value = item.toJSON();
    } else if (isScalar(item)) {
      value = item.value;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ file, line, message: 'every list item must be a mapping (code: ..., name: ...)' });
      continue;
    }
    out.push({ value: value as RawRecord, file, line });
  }
  return out;
}

/** Parse a YAML text that must be a flat mapping of code -> string. */
export function parseNameMap(text: string, file: string, issues: Issue[]): Map<string, { name: unknown; line: number }> {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: true, uniqueKeys: true });
  const names = new Map<string, { name: unknown; line: number }>();
  for (const err of doc.errors) {
    issues.push({ file, line: err.linePos?.[0]?.line ?? 0, message: `YAML error: ${err.message.split('\n')[0]}` });
  }
  if (doc.errors.length > 0) {
    return names;
  }
  const root = doc.contents;
  if (root === null) {
    return names;
  }
  if (!isMap(root)) {
    issues.push({ file, line: 1, message: 'top level must be a mapping of code: name' });
    return names;
  }
  for (const pair of root.items) {
    const key = isScalar(pair.key) ? pair.key.value : null;
    const line = isScalar(pair.key) ? lineCounter.linePos(pair.key.range?.[0] ?? 0).line : 0;
    if (typeof key !== 'string') {
      issues.push({ file, line, message: `key ${JSON.stringify(key)} must be a string code (quote it)` });
      continue;
    }
    let name: unknown = null;
    if (isScalar(pair.value)) {
      name = pair.value.value;
    } else if (pair.value !== null) {
      name = pair.value.toJSON();
    }
    names.set(key, { name, line });
  }
  return names;
}

/** Read and parse every source file under `sourceDir`. File names in issues are relative to `rootDir`. */
export function loadSource(sourceDir: string, rootDir = join(sourceDir, '..')): LoadResult {
  const issues: Issue[] = [];
  const rel = (p: string) => relative(rootDir, join(sourceDir, p)).replaceAll('\\', '/');
  const read = (p: string): string | null => {
    try {
      return readFileSync(join(sourceDir, p), 'utf8');
    } catch {
      issues.push({ file: rel(p), line: 0, message: 'file is missing' });
      return null;
    }
  };

  const countriesText = read(COUNTRIES_FILE);
  const sitesText = read(SITES_FILE);
  const countries = countriesText === null ? [] : parseList(countriesText, rel(COUNTRIES_FILE), issues);
  const sites = sitesText === null ? [] : parseList(sitesText, rel(SITES_FILE), issues);

  const i18n = {} as SourceBundle['i18n'];
  for (const lang of LANGS) {
    const file = rel(i18nFile(lang));
    const text = read(i18nFile(lang));
    i18n[lang] = { file, names: text === null ? new Map() : parseNameMap(text, file, issues) };
  }
  return { bundle: { countries, sites, i18n }, issues };
}
