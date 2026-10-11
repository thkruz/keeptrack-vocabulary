/**
 * Print the npm (semver) form of a registry version: "2026.01.05-2" -> "2026.1.5-2".
 *
 *   npm version "$(pnpm -s npm-version "$VOCAB_VERSION")" --no-git-tag-version
 */
import { toNpmVersion } from '../src/version.ts';

const version = process.argv[2] ?? process.env.VOCAB_VERSION;
if (!version) {
  console.error('usage: pnpm npm-version <YYYY.MM.DD-N>  (or set VOCAB_VERSION)');
  process.exit(2);
}
console.log(toNpmVersion(version));
