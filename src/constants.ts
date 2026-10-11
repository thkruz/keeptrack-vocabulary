/** Schema version of every emitted file. Bump only on a breaking shape change. */
export const SCHEMA = 1 as const;

/** The 12 languages every country name must exist in (matches keeptrack-space locales). */
export const LANGS = ['cs', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'ru', 'uk', 'zh'] as const;
export type Lang = (typeof LANGS)[number];

/**
 * Flag ids that are not flag-icons ISO codes but have a custom image shipped in each
 * client's CSS (keeptrack-home src/assets/styles/flag-icons.css names them `fi-<id>`).
 * Written in countries.yaml as `custom:<id>`.
 */
export const CUSTOM_FLAG_IDS = ['cis', 'su', 'nato', 'esa', 'iss'] as const;

export const COUNTRY_KINDS = ['state', 'org', 'historical', 'special'] as const;
export type CountryKind = (typeof COUNTRY_KINDS)[number];

/** Keys every emitted file carries next to its data; no code, alias or name may use them. */
export const META_KEYS = ['schema', 'version', 'generatedAt'] as const;

/** Fallback key present in every by-code table (consumer contract: `table[code] ?? table.UNKNOWN`). */
export const UNKNOWN_KEY = 'UNKNOWN';

/** Public R2 location of the published tables. */
export const R2_PUBLIC_BASE = 'https://r2.keeptrack.space/vocabulary/v1';
/** Key prefix inside the R2 bucket. */
export const R2_PREFIX = 'vocabulary/v1';
