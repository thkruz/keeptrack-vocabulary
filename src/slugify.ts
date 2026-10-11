/**
 * Shared slug rule, identical to keeptrack-home `src/utils/launchSlugs.ts`:
 * lowercase, every run of non [a-z0-9] becomes one hyphen, trim hyphens.
 * "United States" -> "united-states", "China (Hong Kong)" -> "china-hong-kong".
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}
