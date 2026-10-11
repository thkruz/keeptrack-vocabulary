export interface Issue {
  /** Source file, relative to the repo root (e.g. "source/countries.yaml"). */
  file: string;
  /** 1-based line, or 0 when the problem is not tied to one line. */
  line: number;
  message: string;
}

/** Human-readable report: issues grouped by file, sorted by line. */
export function formatReport(issues: readonly Issue[]): string {
  if (issues.length === 0) {
    return 'Validation passed: no issues.';
  }
  const byFile = new Map<string, Issue[]>();
  for (const issue of issues) {
    const list = byFile.get(issue.file) ?? [];
    list.push(issue);
    byFile.set(issue.file, list);
  }
  const lines: string[] = [`Validation FAILED: ${issues.length} issue${issues.length === 1 ? '' : 's'}`, ''];
  for (const file of [...byFile.keys()].sort()) {
    const list = (byFile.get(file) ?? []).sort((a, b) => a.line - b.line);
    lines.push(`${file} (${list.length})`);
    for (const issue of list) {
      lines.push(`  ${issue.line > 0 ? `line ${String(issue.line).padStart(4)}` : '         '}  ${issue.message}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
