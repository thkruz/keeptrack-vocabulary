/**
 * STUB: GCAT launch-site harvest (not implemented yet; nothing here touches the network).
 *
 * Intended behaviour, per hq/plans/vocabulary-registry-2026-10.md:
 *
 *   Source   GCAT sites table, https://planet4589.org/space/gcat/tsv/tables/sites.tsv
 *            (columns: #Site Code UCode Type StateCode TStart TStop ShortName Name Location
 *            Longitude Latitude Error Parent ShortEName EName Group UName). The
 *            keeptrack-data-updater already ingests this into the D1 `launch_sites` table,
 *            so reading D1 (launch_sites joined to launches, orbital/deep-space only) is an
 *            equally valid source and avoids a second fetch of planet4589.org.
 *   Scope    every Site that has hosted an orbital (O) or deep-space (D) launch, i.e. the
 *            SITE_STATE query in keeptrack-home src/data/launch-site-countries.ts.
 *   Merge    seeds NEW entries into source/sites.yaml with code, name (ShortName or Name),
 *            state (StateCode), lat, lon (Latitude, Longitude), aliases [] and wiki null.
 *            It NEVER overwrites hand-curated fields on existing entries (name, aliases, wiki,
 *            and a hand-corrected state such as GTsMP-4 -> RU). Differences between GCAT and
 *            an existing entry are printed for review instead.
 *   Output   a rewritten sites.yaml for a PR; `pnpm build` then validates it like any edit.
 *
 * The initial sites.yaml was seeded by hand from a local copy of sites.tsv dated
 * 2026-03-04; see SEEDING-NOTES.md.
 */
console.error('harvest-gcat-sites is a documented stub; see the header comment for the intended source and merge rules.');
process.exit(1);
