# General Sanity Migration Playbook

## Core Stance

Replatforming to Sanity is a chance to improve the content model, editorial workflow, and frontend data contract. Do not recreate the source CMS shape unless the project explicitly needs a temporary lift-and-shift phase.

Use a two-phase approach when risk or timeline is high:

1. **Stabilize:** migrate into a close, understandable model with stable IDs, complete assets, and working frontend queries.
2. **Improve:** remodel page-shaped content into semantic documents, references, page builder sections, or reusable entities after fidelity is proven.

For large migrations, write deterministic migration scripts, review mappings carefully, and identify edge cases before import. The migration must be repeatable and idempotent.

## Discovery Questions

Before writing code, establish:

- **Source access:** live API, admin API, export file, database dump, repository access, static HTML, crawler, or manual exports.
- **Content scope:** which content types, locales, drafts, archived content, redirects, menus, authors, taxonomies, assets, and metadata are in scope.
- **Volume:** document counts per type, asset counts, and which types are high-risk because of rich text or nested components.
- **Rich text formats:** HTML, Markdown, WordPress blocks, Strapi blocks, Lexical, Contentful Rich Text, custom JSON, or page-builder structures.
- **Relationships:** authors, taxonomies, products, reusable CTAs, testimonials, media, related content, and cross-locale links.
- **Destination schema:** existing Sanity schema, new schema, temporary lift-and-shift schema, or a planned remodel.
- **Frontend contract:** which routes and queries must keep working, which legacy URLs need redirects, and which pages can be intentionally retired.
- **Cutover strategy:** one-time import, delta sync, content freeze, incremental rollout, or parallel publishing.

## Migration Phases

1. **Inventory:** enumerate source types, fields, volumes, relationships, assets, URLs, locales, and data quality issues.
2. **Map:** decide Sanity document types, object types, references, Portable Text fields, asset fields, localization strategy, and migration metadata.
3. **Extract:** pull source data into raw JSON/XML/CSV files and keep them as repeatable snapshots.
4. **Transform:** convert raw source records into Sanity-shaped documents with deterministic IDs and explicit quality logging.
5. **Load:** import documents and assets using the CLI, migration tooling, or client mutations depending on volume and workflow.
6. **Validate:** compare counts, references, Portable Text shape, asset availability, required fields, frontend rendering, redirects, and editor usability.
7. **Cut over:** rerun against the latest source content, apply redirects, monitor broken links, and keep legacy source IDs for debugging.

## Agent Workflow

For agent-assisted migrations, require one human checkpoint before anything writes to Sanity:

1. Read the source export/API shape and the target Sanity project.
2. Print a migration plan: content types, fields, relationships, assets, locales, draft/status handling, and proposed Sanity types.
3. Flag judgment calls for review, such as page-shaped content, free-text taxonomies, rich text blocks, and localization strategy.
4. After approval, generate schemas, transform scripts, import scripts, config, and validation scripts.
5. Stop before running destructive or high-volume writes. The user should review the generated files and choose when to run them.

The useful AI pattern is "analyze, plan, generate, then let the user run," not "silently migrate everything."

## Recommended Project Layout

For implementation work, keep migration artifacts out of the application root unless the repo already has a convention:

```text
migration/
  extracted/       # raw source snapshots, usually gitignored
  transformed/     # generated Sanity-shaped JSON/NDJSON, usually gitignored
  reports/         # counts, quality issues, skipped records, validation output
  scripts/
    extract.ts
    transform.ts
    validate.ts
  import.ndjson
```

Make generated data reproducible. Commit migration scripts and mapping docs; gitignore large exports, credentials, raw customer data, and generated imports unless the project explicitly wants fixtures.

## Modeling Guidance

Model content by meaning, not by legacy storage or frontend layout.

- Split generic page/template records into semantic types when the page represents a real entity: `person`, `location`, `event`, `product`, `caseStudy`, `article`.
- Consolidate near-duplicates such as `Author`, `Staff`, `Presenter`, and `Expert` when they represent the same real-world entity.
- Use references for reusable or independently managed content: authors, people, products, categories, tags, companies, reusable testimonials, shared CTAs.
- Use embedded objects for content that only belongs inside one document: SEO metadata, page-specific hero content, one-off sections, migration metadata.
- Preserve source IDs and legacy URLs in a `migration` or `migrationMetadata` object unless the project already has a standard field shape.
- Add schema fields before migration code depends on them, then run schema extract and TypeGen if the project uses TypeScript.

## Extraction Patterns

Prefer the most structured source available:

- **Repository access:** read schemas, component definitions, and route/query code to prove completeness.
- **Admin or Local API:** best for drafts, hidden fields, private entries, full locale data, and complete relationship expansion.
- **Public API:** good for published content and fast prototypes, but document blind spots.
- **Export files:** reliable snapshots for repeatable transforms; inspect parser output carefully.
- **Database dumps:** complete but usually more work because relationships and media often require manual joins.
- **Static HTML or crawling:** viable fallback when no structured export exists, but plan for lower fidelity and manual review.

Prefer an official bulk export when it exists. It is usually safer than hand-crafting API calls because it is more likely to include drafts, scheduled content, assets, field definitions, and metadata. If required access or credentials are missing, stop and ask for read-only credentials or an export file rather than guessing.

Always snapshot raw extraction results before transformation. This makes the slowest part of migration, transform iteration, offline and repeatable.

## Transformation Patterns

Make transforms deterministic:

- Derive `_id` from source IDs, paths, slugs, locale IDs, or stable content hashes.
- Use stable `_key` values for generated arrays when rerun stability matters.
- Leave empty fields unset. Avoid `null`, empty objects, raw parser artifacts, and `"[object Object]"`.
- Keep raw source body fields temporarily only when they help verify rich text fidelity; hide or remove them after sign-off.
- Create lookup maps for every referenced type before transforming documents that reference them.
- Track quality issues per source record: missing required data, unresolved references, failed asset lookup, rich text conversion warnings, unsupported blocks, duplicate slugs.

Rich text is usually the long pole. Pick the converter by source format:

- Markdown: use `@portabletext/markdown`.
- Markdown that must be constrained to the Sanity schema: use `@portabletext/sanity-bridge`.
- Clean HTML: use `@portabletext/block-tools` with `JSDOM` and schema-aware custom deserializers.
- CMS-specific block JSON: map structurally to Portable Text or custom objects.
- Messy page-builder HTML: inspect real samples, define custom objects only for patterns that are consistent enough to preserve.

## Import Patterns

Choose the write path by migration size and repeatability:

- **NDJSON + `sanity dataset import`:** best for large initial loads and export-file migrations. Supports `_sanityAsset` directives and `--replace`.
- **`sanity migration`:** good for reproducible scripted imports inside a Studio project, dry runs, and batched mutations.
- **`sanity exec` or custom scripts with `@sanity/client`:** good for custom extraction/import loops, incremental syncs, or complex asset upload flows.
- **Sanity MCP/content tools:** good for small targeted operations, inspection, and patches. Avoid them for bulk content loads when a script or NDJSON import is more reliable.

Write order:

1. Assets or asset manifests.
2. Shared reference documents: authors, people, companies, categories, tags, products.
3. Primary content documents.
4. Translation metadata, redirect documents, and post-import relationship fixes.

For relationship-heavy migrations, use a Sanity-safe multi-pass import:

1. Upload assets and build source asset ID -> Sanity asset ID maps.
2. Promote reusable string lists, tags, categories, authors, products, or other shared values into reference documents.
3. Create primary documents with deterministic IDs and scalar fields.
4. Link references after every target document ID is known, either by emitting deterministic refs in NDJSON or by running a patch pass.

This pattern applies to Sanity because references are just document IDs. It is especially useful when the source stores relationships as nested objects, links, string arrays, or IDs that need lookup tables before they can become Sanity references.

## NDJSON and Asset Directives

For bulk imports, generate one valid JSON document per line. Every document needs `_type`; `_id` is optional but should be set for rerunnable migrations.

Use `_sanityAsset` where an asset reference would normally go:

```json
{"_id":"post-123","_type":"post","mainImage":{"_type":"image","_sanityAsset":"image@https://example.com/original.jpg"}}
```

Rules:

- Use `image@...` for images and `file@...` for files.
- Prefer the largest available original asset. Do not import multiple resized variants of the same source image.
- For local files, use absolute `file:///...` URIs or package the NDJSON and assets into a `.tar`, `.tar.gz`, or `.tgz`.
- During CLI import, Sanity temporarily imports references as weak and strengthens them after all documents are present; this is why `_updatedAt` can change for documents with references.
- Use `--replace` for idempotent reruns, `--missing` when only filling gaps, and `--allow-failing-assets` only when missing assets should be logged for later cleanup.
- Disable or pause webhooks that would be triggered by high-volume imports.

When using `@sanity/client` instead of CLI import:

- Use low-concurrency queues and batched transactions.
- Keep mutation payloads below API limits.
- Prefer mutation visibility `deferred` for large imports when immediate queryability is unnecessary.
- Use `_weak: true` in JSON references when creating references before targets exist. In schema definitions the property is `weak`; in client JSON the property is `_weak`.

## Validation and Cutover

Validate before declaring the migration ready:

- Compare source and Sanity counts by content type, locale, and status.
- Remember schema validation rules run in Studio, not automatically on API/client mutations. Validate in transform code before import.
- Spot-check representative documents from each type, including old, new, long, short, media-heavy, and locale variants.
- Confirm Portable Text fields are arrays of blocks, not raw HTML strings.
- Confirm all references have non-empty `_ref` values and the targets exist.
- Confirm images/files are Sanity assets or Media Library assets, with alt text and captions where available.
- Run `npx sanity@latest documents validate` when the destination schema is available.
- Crawl the legacy site and the new frontend to verify route coverage, redirects, canonical URLs, metadata, and broken links.
- For high-value or high-volume pages, run visual regression or screenshot checks against representative legacy and migrated pages.
- Keep a migration report with skipped content, known cleanup tasks, and fields that require editorial review.

## Sanity Implementation Guardrails

- Schema validation rules run in Studio and document validation commands, not automatically on API/client writes. Validate transformed documents before import.
- Use `defineType`, `defineField`, and `defineArrayMember` when creating schema files.
- Prefer image fields with `hotspot: true` and an `alt` field when editorial images need cropping or accessibility metadata.
- Use `defineQuery` for GROQ queries when the project uses TypeGen.
- Run schema extraction and TypeGen after schema/query changes when TypeScript types are part of the project.
- Deploy or apply schema changes before using MCP/content tools against the target dataset.
- Keep migration metadata small and useful: source system, source ID, source type, legacy URL, migrated timestamp, and quality flags.
