/**
 * Upload dist/ to R2 through the S3-compatible API.
 *
 *   pnpm publish:r2 --target pinned    vocabulary/v1/<version>/<file>  (immutable, never overwritten)
 *   pnpm publish:r2 --target latest    vocabulary/v1/<file>            (short cache, manifest.json last)
 *   pnpm publish:r2 --dry-run          print the plan, touch nothing (no credentials needed)
 *
 * CI order on push to main: pinned -> npm publish -> latest, so "latest" on R2 never points at a
 * version npm does not have. Refuses to publish a version that is not newer than what R2 serves.
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (default "keeptrack",
 * the bucket served at https://r2.keeptrack.space).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { R2_PREFIX, R2_PUBLIC_BASE, SCHEMA } from '../src/constants.ts';
import { FILES } from '../src/emit.ts';
import { isValidVersion } from '../src/version.ts';

interface Manifest {
  schema: number;
  version: string;
  files: Record<string, { sha256: string; bytes: number }>;
}

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: 'all' },
    'dry-run': { type: 'boolean', default: false },
    dir: { type: 'string', default: 'dist' },
  },
});
const target = values.target;
if (target !== 'pinned' && target !== 'latest' && target !== 'all') {
  throw new Error(`--target must be pinned, latest or all (got ${target})`);
}
const dryRun = values['dry-run'];
const dir = resolve(values.dir);

// ── Local integrity: the manifest must describe exactly the files on disk ─────
const manifest = JSON.parse(readFileSync(join(dir, FILES.manifest), 'utf8')) as Manifest;
if (manifest.schema !== SCHEMA) {
  throw new Error(`dist schema ${manifest.schema} != ${SCHEMA}`);
}
if (!isValidVersion(manifest.version)) {
  throw new Error(`dist version "${manifest.version}" is not YYYY.MM.DD-N`);
}
const bodies = new Map<string, Buffer>();
for (const [name, meta] of Object.entries(manifest.files)) {
  const body = readFileSync(join(dir, name));
  const sha = createHash('sha256').update(body).digest('hex');
  if (sha !== meta.sha256) {
    throw new Error(`${name} does not match manifest.json (rebuild dist/)`);
  }
  bodies.set(name, body);
}
bodies.set(FILES.manifest, readFileSync(join(dir, FILES.manifest)));
const dataFiles = [...bodies.keys()].filter((n) => n !== FILES.manifest).sort();
const version = manifest.version;

const PINNED_CACHE = 'public, max-age=31536000, immutable';
const LATEST_CACHE = 'public, max-age=300';
const plan: { key: string; name: string; cache: string }[] = [];
if (target === 'pinned' || target === 'all') {
  for (const name of [...dataFiles, FILES.manifest]) {
    plan.push({ key: `${R2_PREFIX}/${version}/${name}`, name, cache: PINNED_CACHE });
  }
}
if (target === 'latest' || target === 'all') {
  // manifest.json last: a reader that sees the new manifest finds every new file already in place
  for (const name of [...dataFiles, FILES.manifest]) {
    plan.push({ key: `${R2_PREFIX}/${name}`, name, cache: LATEST_CACHE });
  }
}

if (dryRun) {
  console.log(`[dry-run] would upload ${plan.length} objects for version ${version}:`);
  for (const p of plan) {
    console.log(`  ${p.key}  (${bodies.get(p.name)?.length ?? 0} bytes, ${p.cache})`);
  }
  process.exit(0);
}

// ── Remote guards ─────────────────────────────────────────────────────────────
const env = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    throw new Error(`missing env ${name}`);
  }
  return v;
};
const bucket = process.env.R2_BUCKET ?? 'keeptrack';
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
});

const live = await fetch(`${R2_PUBLIC_BASE}/${FILES.manifest}`, { headers: { 'cache-control': 'no-cache' } });
if (live.ok) {
  const remote = (await live.json()) as { version?: string; schema?: number };
  const pinnedOnlyRetry = target === 'latest' && remote.version === version;
  if (typeof remote.version === 'string' && remote.version >= version && !pinnedOnlyRetry) {
    throw new Error(`R2 already serves ${remote.version}; refusing to publish ${version} (versions must increase)`);
  }
} else if (live.status !== 404) {
  throw new Error(`could not read the live manifest: ${live.status} ${live.statusText}`);
}

let uploads = plan;
if (target === 'pinned' || target === 'all') {
  const pinnedManifest = `${R2_PREFIX}/${version}/${FILES.manifest}`;
  let pinnedExists = false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: pinnedManifest }));
    pinnedExists = true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404) {
      throw err;
    }
  }
  if (pinnedExists) {
    // A CI run that failed after the pinned upload (npm step, network) re-runs with the same
    // version. Identical content is a resume, not an overwrite: skip the pinned objects.
    // Different content under the same version is the immutability violation and still fails.
    const res = await fetch(`${R2_PUBLIC_BASE}/${version}/${FILES.manifest}`, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) {
      throw new Error(`${pinnedManifest} exists but could not be read: ${res.status} ${res.statusText}`);
    }
    const remote = (await res.json()) as Manifest;
    // Every file embeds generatedAt, so sha256 differs between builds of the same data. Compare
    // the data with that field removed; the emitter writes keys in a stable order.
    const stripped = (text: string): string => {
      const v = JSON.parse(text) as Record<string, unknown>;
      delete v.generatedAt;
      return JSON.stringify(v);
    };
    const checks = await Promise.all(
      dataFiles.map(async (n) => {
        const r = await fetch(`${R2_PUBLIC_BASE}/${version}/${n}`, { headers: { 'cache-control': 'no-cache' } });
        return r.ok && stripped(await r.text()) === stripped(bodies.get(n)?.toString('utf8') ?? '');
      })
    );
    const same = remote.version === version && remote.schema === manifest.schema && checks.every(Boolean);
    if (!same) {
      throw new Error(`${pinnedManifest} already exists with different content; pinned versions are immutable`);
    }
    console.log(`pinned ${version} is already on R2 with identical content; skipping ${dataFiles.length + 1} objects (resume)`);
    uploads = plan.filter((p) => !p.key.startsWith(`${R2_PREFIX}/${version}/`));
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────
for (const p of uploads) {
  // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose; manifest.json must land last and the set is small
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: p.key, Body: bodies.get(p.name), ContentType: 'application/json; charset=utf-8', CacheControl: p.cache }));
  console.log(`uploaded ${p.key}`);
}
console.log(`Published ${version} (${target}) to r2://${bucket}/${R2_PREFIX}`);
