import { META_KEYS } from './constants.ts';

type Row = Record<string, unknown> & { code: string; name: string };
type TableLike = Record<string, unknown>;

const META = new Set<string>(META_KEYS);

function rows(table: TableLike | null): Map<string, Row> {
  const out = new Map<string, Row>();
  if (!table) {
    return out;
  }
  for (const [key, value] of Object.entries(table)) {
    if (META.has(key) || value === null || typeof value !== 'object') {
      continue;
    }
    out.set(key, value as Row);
  }
  return out;
}

export interface TableDiff {
  added: string[];
  removed: string[];
  renamed: { code: string; from: string; to: string }[];
  /** Keys (canonical or alias) that now resolve to a different canonical code, or appeared/disappeared as aliases. */
  remapped: { key: string; from: string | null; to: string | null }[];
  /** Other field changes on a canonical entry. */
  changed: { code: string; field: string; from: unknown; to: unknown }[];
}

/** Compare two by-code tables (countries or sites). Canonical rows are those whose key equals entry.code. */
export function diffTables(base: TableLike | null, head: TableLike | null): TableDiff {
  const b = rows(base);
  const h = rows(head);
  const canon = (m: Map<string, Row>) => new Map([...m].filter(([k, v]) => k === v.code));
  const bc = canon(b);
  const hc = canon(h);
  const d: TableDiff = { added: [], removed: [], renamed: [], remapped: [], changed: [] };

  for (const code of hc.keys()) {
    if (!bc.has(code)) {
      d.added.push(code);
    }
  }
  for (const code of bc.keys()) {
    if (!hc.has(code)) {
      d.removed.push(code);
    }
  }
  for (const [code, hv] of hc) {
    const bv = bc.get(code);
    if (!bv) {
      continue;
    }
    if (bv.name !== hv.name) {
      d.renamed.push({ code, from: bv.name, to: hv.name });
    }
    for (const field of new Set([...Object.keys(bv), ...Object.keys(hv)])) {
      if (field === 'code' || field === 'name') {
        continue;
      }
      if (JSON.stringify(bv[field]) !== JSON.stringify(hv[field])) {
        d.changed.push({ code, field, from: bv[field], to: hv[field] });
      }
    }
  }
  for (const key of new Set([...b.keys(), ...h.keys()])) {
    const from = b.get(key)?.code ?? null;
    const to = h.get(key)?.code ?? null;
    if (from === to) {
      continue;
    }
    // a brand-new or deleted canonical entry is already reported above
    if ((from === null && to === key) || (to === null && from === key)) {
      continue;
    }
    d.remapped.push({ key, from, to });
  }
  for (const list of [d.added, d.removed]) {
    list.sort();
  }
  d.renamed.sort((x, y) => x.code.localeCompare(y.code));
  d.remapped.sort((x, y) => x.key.localeCompare(y.key));
  d.changed.sort((x, y) => x.code.localeCompare(y.code) || x.field.localeCompare(y.field));
  return d;
}

const isEmpty = (d: TableDiff) => d.added.length + d.removed.length + d.renamed.length + d.remapped.length + d.changed.length === 0;

/** Markdown summary for a PR (GitHub step summary) or a terminal. */
export function formatDiff(sections: { title: string; diff: TableDiff }[], baseLabel: string): string {
  const out: string[] = [`## Vocabulary snapshot diff (vs ${baseLabel})`, ''];
  for (const { title, diff } of sections) {
    out.push(`### ${title}`);
    if (isEmpty(diff)) {
      out.push('', 'No changes.', '');
      continue;
    }
    out.push('');
    if (diff.added.length) {
      out.push(`- **Added** (${diff.added.length}): ${diff.added.map((c) => `\`${c}\``).join(', ')}`);
    }
    if (diff.removed.length) {
      out.push(`- **Removed** (${diff.removed.length}): ${diff.removed.map((c) => `\`${c}\``).join(', ')}`);
    }
    for (const r of diff.renamed) {
      out.push(`- **Renamed** \`${r.code}\`: "${r.from}" -> "${r.to}"`);
    }
    for (const r of diff.remapped) {
      out.push(`- **Alias** \`${r.key}\`: ${r.from === null ? 'new' : `\`${r.from}\``} -> ${r.to === null ? 'removed' : `\`${r.to}\``}`);
    }
    for (const c of diff.changed) {
      out.push(`- **Changed** \`${c.code}\`.${c.field}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
    }
    out.push('');
  }
  return out.join('\n');
}
