---
name: sanity-migration
description: Plans, implements, and reviews migrations from other CMSes and content systems into Sanity. Use when migrating or replatforming to Sanity from AEM, Adobe Experience Manager, Contentful, Strapi, Webflow, WordPress, Payload, Drupal, Markdown/MDX/frontmatter files, WXR/XML exports, CMS APIs, database dumps, static HTML, or when designing extraction, transformation, Portable Text conversion, asset migration, redirects, validation, and cutover workflows.
---

# Sanity Migration

Use this skill for CMS-to-Sanity migration work. Treat migration as a content strategy and ETL project, not a blind lift-and-shift.

## Required Workflow

1. Read `references/general.md` first.
2. If the source platform is known, also read its guide:
   - AEM / Adobe Experience Manager: `references/aem.md`
   - Contentful: `references/contentful.md`
   - Strapi: `references/strapi.md`
   - Webflow: `references/webflow.md`
   - WordPress / WXR / Elementor: `references/wordpress.md`
   - Payload: `references/payload.md`
   - Drupal: `references/drupal.md`
   - Markdown / MDX / frontmatter files: `references/markdown.md`
3. Before writing code, produce a short migration plan covering source access, content scope, schema decisions, extraction, transformation, import, validation, redirects, and cutover.
4. Prefer deterministic, repeatable scripts for real migrations. Write and review migration scripts, mappings, and validation checks; do not rely on one-off content operations for large content volumes.

## Deliverables to Produce

For implementation or planning tasks, produce these artifacts or explain why they are not needed:

- Content inventory: source types, counts, locales, status/draft scope, assets, and relationship types.
- Source-to-Sanity mapping: document types, object types, references, Portable Text fields, asset fields, IDs, and skipped content.
- Extraction approach: credentials/access needed, API/export commands, raw snapshot location, and known blind spots.
- Transform/import plan: deterministic IDs, write order, asset handling, rich text conversion, validation, and rerun strategy.
- Cutover plan: delta sync/content freeze, redirects, broken-link checks, SEO metadata, and manual cleanup.

## Defaults

- Use stable document IDs derived from source IDs, slugs, paths, or hashes.
- Use `createOrReplace`, `createIfNotExists`, or `sanity dataset import --replace` so reruns converge.
- Snapshot extracted source data to disk before transforming it.
- Import or create referenced documents before documents that reference them.
- Convert rich text to Portable Text instead of storing raw HTML or Markdown strings.
- Upload assets to Sanity or the Media Library; do not leave production content dependent on legacy CDN URLs.
- Track per-document quality issues and produce a validation summary before cutover.
- Preserve legacy URLs and source IDs for redirects, QA, and future debugging.

## Sanity Guardrails

- Model what content is, not how the old site rendered it.
- Use documents for reusable or independently managed entities; use objects for content owned by one document.
- Use `defineType`, `defineField`, and `defineArrayMember` if authoring Sanity schemas.
- Use image/file fields with uploaded Sanity assets or Media Library assets, not legacy CDN URLs.
- Use Portable Text arrays for rich text and custom blocks; do not store raw HTML as the canonical body.
- Run schema extraction and TypeGen after schema or GROQ query changes when the project uses TypeScript.
- Deploy or apply schema changes before using MCP/content tools against the target dataset.

For deeper Sanity implementation guidance, use `sanity-best-practices` if it is already available. If it is not installed, tell the user they can add it with:

```bash
npx skills add sanity-io/agent-toolkit --skill sanity-best-practices
```

## Stop and Ask

Stop before coding when any of these are unclear:

- Source access path, credentials, export file, or database connection.
- Target Sanity project/dataset or whether a scratch dataset should be used.
- Draft, archived, scheduled, locale, or version history scope.
- Whether media files should be migrated and whether asset URLs/files are accessible.
- Whether the destination schema exists or should be designed as part of the migration.

## Do Not Do This

- Do not create random IDs for source-backed documents.
- Do not fetch-then-create referenced documents; use deterministic IDs and `createIfNotExists`/`createOrReplace`.
- Do not run bulk migrations through MCP content tools when NDJSON or scripts are appropriate.
- Do not flatten locale fallback values into translations unless requested.
- Do not leave TODOs for required media, authors, references, or rich text conversion.
- Do not declare a migration done without count checks, sample checks, reference checks, and route/redirect checks.

## Reference Map

Use `references/general.md` for shared migration principles and the platform references for source-specific extraction routes, modeling traps, and validation checks.

For source systems not explicitly covered, apply `references/general.md` and adapt the closest platform pattern:
- API-first CMSes: start from Contentful, Strapi, or Payload.
- Monolithic/page-builder systems: start from WordPress, Drupal, Webflow, or AEM.
- HTML-heavy exports: start from the WordPress and Webflow rich-text guidance.
- Markdown-first sources: start from `references/markdown.md`.
