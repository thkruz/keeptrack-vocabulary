/**
 * Print the version the next publish should carry, based on the newest version already
 * on R2 (vocabulary/v1/manifest.json). Same UTC day: N + 1. New day: N = 1.
 *
 *   VOCAB_VERSION=$(pnpm -s next-version)
 *
 * Run by CI before `pnpm build`. A 404 means nothing is published yet; any other failure
 * exits non-zero so CI never guesses a version.
 */
import { R2_PUBLIC_BASE } from '../src/constants.ts';
import { nextVersion } from '../src/version.ts';

const url = process.env.VOCAB_MANIFEST_URL ?? `${R2_PUBLIC_BASE}/manifest.json`;

const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
let previous: string | null = null;
if (res.status === 404) {
  previous = null;
} else if (res.ok) {
  const manifest = (await res.json()) as { version?: unknown };
  if (typeof manifest.version !== 'string') {
    throw new Error(`${url} has no version field`);
  }
  previous = manifest.version;
} else {
  throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
}
console.log(nextVersion(previous, new Date()));
