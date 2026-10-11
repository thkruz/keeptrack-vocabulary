import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Every flag code flag-icons ships (lowercase ISO 3166-1 alpha-2 plus a few extras like gb-sct, eu). */
export function loadFlagIconCodes(): Set<string> {
  const list = require('flag-icons/country.json') as { code: string }[];
  return new Set(list.map((c) => c.code));
}

/** `us` -> `fi-us`, `custom:esa` -> `fi-esa` (keeptrack-home names custom classes `fi-<id>`), null -> null. */
export function flagClass(flag: string | null): string | null {
  if (flag === null) {
    return null;
  }
  return `fi-${flag.startsWith('custom:') ? flag.slice('custom:'.length) : flag}`;
}
