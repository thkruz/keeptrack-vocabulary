/**
 * Registry versions are "YYYY.MM.DD-N" with N in 1..9 (zero-padded date, single-digit
 * build number). Because every part is fixed width, plain string comparison orders
 * versions correctly, which is all a consumer needs: `remote.version > local.version`.
 */
export const VERSION_RE = /^(\d{4})\.(\d{2})\.(\d{2})-([1-9])$/u;

export function isValidVersion(version: string): boolean {
  const m = VERSION_RE.exec(version);
  if (!m) {
    return false;
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** UTC calendar date as "YYYY.MM.DD". */
export function datePart(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** Negative when a < b, 0 when equal, positive when a > b. Same result as comparing the strings. */
export function compareVersions(a: string, b: string): number {
  if (!isValidVersion(a) || !isValidVersion(b)) {
    throw new Error(`cannot compare invalid versions "${a}" and "${b}"`);
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/**
 * The version to publish next, given the newest published one (null when nothing is
 * published yet). Same day: bump N. New day: N = 1. Refuses to go backwards or past N = 9.
 */
export function nextVersion(previous: string | null, now: Date): string {
  const today = datePart(now);
  if (previous === null) {
    return `${today}-1`;
  }
  const m = VERSION_RE.exec(previous);
  if (!m || !isValidVersion(previous)) {
    throw new Error(`published version "${previous}" is not YYYY.MM.DD-N`);
  }
  const prevDate = `${m[1]}.${m[2]}.${m[3]}`;
  if (prevDate > today) {
    throw new Error(`published version ${previous} is dated after today (${today}); check the CI clock`);
  }
  if (prevDate < today) {
    return `${today}-1`;
  }
  const n = Number(m[4]) + 1;
  if (n > 9) {
    throw new Error(`already published 9 versions on ${today}; the format allows N = 1..9 per day`);
  }
  return `${today}-${n}`;
}

/**
 * npm needs semver, which forbids leading zeros: "2026.01.05-2" -> "2026.1.5-2".
 * The data files keep the zero-padded form; this is only the package.json version.
 */
export function toNpmVersion(version: string): string {
  const m = VERSION_RE.exec(version);
  if (!m) {
    throw new Error(`"${version}" is not YYYY.MM.DD-N`);
  }
  return `${Number(m[1])}.${Number(m[2])}.${Number(m[3])}-${m[4]}`;
}
