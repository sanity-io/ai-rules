# AEM to Sanity

## What to Determine First

Adobe Experience Manager projects vary widely. Before writing migration code, determine:

- AEM 6.5 on-premise or AEM as a Cloud Service.
- Author-tier access, publish-tier access, or exported content only.
- Whether content is mostly pages with components, Content Fragments, Experience Fragments, DAM assets, or a mixture.
- Whether the site uses Core Components, custom components, or both.
- Whether Multi-Site Manager language copies are in scope.
- Whether unpublished drafts, inherited content, and Experience Fragments must be preserved.

## Authentication

- AEM 6.5/on-premise commonly supports HTTP Basic auth with a read-only service account.
- AEM as a Cloud Service production does not use Basic auth; use Adobe IMS/service credentials or another approved bearer-token flow.
- Publish tier exposes published content only. Use author-tier access when drafts, unpublished content, or inherited authoring state is in scope.

## Extraction Paths

Use the most structured source that covers the required scope:

- **Content Fragments:** use AEM GraphQL. Discover types from `/content/_cq_graphql/global/endpoint.GQLschema`, then query fragments through `/content/_cq_graphql/global/endpoint.json`.
- **Core Component pages:** use `.model.json` where Sling Model exporters are present.
- **Custom component pages:** use `.infinity.json` or `.tidy.infinity.json` to inspect raw JCR nodes under `jcr:content`.
- **Bulk discovery:** use QueryBuilder to enumerate pages, fragments, DAM assets, tags, and Experience Fragments.
- **DAM assets:** fetch binaries from `/content/dam/...` and metadata from `/content/dam/.../jcr:content/metadata.json`.
- **Dialog/schema discovery:** if repository or component paths are available, inspect `_cq_dialog.infinity.json` and `sling:resourceSuperType` chains to infer component fields.

Save raw extraction responses to disk before transforming. AEM APIs can be slow, auth-sensitive, and environment-specific.

## `aem-to-sanity` Toolkit Pattern

For large AEM migrations, use or mirror the staged `aem-to-sanity` toolkit pattern from `github.com/demo-repositories/aem-to-sanity`.

Pipeline stages:

- **Schemas (`migrate:schema`):** fetch `_cq_dialog.infinity.json`, walk Granite UI dialogs and `sling:resourceSuperType` chains, discover slots/container drop zones, and emit Sanity object/page builder schemas.
- **Types (`typegen`):** generate `sanity.types.ts` from emitted schemas.
- **Extract (`aem-extract`):** walk content roots through `.infinity.json`, following depth truncation markers, and write raw files under an AEM cache directory.
- **Tags (`aem-tags`):** emit taxonomy/category documents from `/content/cq:tags/...` when AEM tags are in scope.
- **Transform (`aem-transform`):** map `sling:resourceType` through the generated registry, coerce string booleans/numbers, convert HTML to Portable Text, and resolve tag refs.
- **Assets (`aem-assets`):** dedupe, download from AEM, upload to Sanity Media Library or assets, link into the dataset, and rewrite clean documents.
- **Import (`aem-import`):** commit documents with `transaction().createOrReplace()`, importing categories before pages.

Operational defaults from the toolkit:

- Dry-run by default; real writes require `MIGRATION_DRY_RUN=false`.
- Per-tenant folders hold credentials, component paths, content roots, tag roots, component exceptions, generated caches, and reports.
- Run a doctor step before migration to catch missing env/config drift.
- Use content-derived identity: JCR path -> `_id`, JCR UUID -> `_key`, DAM path -> asset manifest key.
- Treat unknown component shapes as findings in reports, not immediate fatal errors, unless config or schema validation is broken.

## Mapping to Sanity

Map AEM shapes by editorial meaning, not JCR structure:

- `cq:Page` with authored components can become a `page` document with a page builder array.
- Content Fragments usually become standalone document types.
- Reusable Content Fragments, Experience Fragments, tags, people, products, or snippets should become referenceable documents when reused.
- AEM text/RTE components become Portable Text fields or custom Portable Text objects.
- AEM image components become Sanity image fields with migrated asset references.
- AEM tags become taxonomy documents before content documents are written.
- MSM language copies can map to document-level localization with `language` fields and translation metadata documents.

Use `sling:resourceType` as the main discriminator for component-to-object mapping.

## Transformation Notes

- Strip JCR/system fields such as `jcr:primaryType`, `jcr:created`, and `sling:resourceType` unless they are needed in migration metadata.
- Convert RTE HTML to Portable Text with source-specific preprocessing for empty paragraphs, `&nbsp;` spacer rows, inline styles, spans, tables, and double-encoded entities.
- Normalize paths and slugs. AEM URLs often include `/content/<site>/<locale>/...` prefixes and `.html` extensions.
- Deduplicate DAM assets by full DAM path, asset UUID, or source URL before upload.
- Use deterministic IDs based on AEM paths or UUIDs.
- Create translations and parent/child references after all target documents exist.

## Load Order

1. Taxonomies/tags from `/content/cq:tags`.
2. DAM assets or asset manifest.
3. Content Fragments and reusable Experience Fragments.
4. Page/content documents.
5. Translation metadata and post-import relationship fixes.

## Gotchas

- `.model.json` can silently omit custom components without Sling Model exporters. Cross-check representative pages against `.infinity.json`.
- `.infinity.json` may be depth-limited or truncated on large trees. Detect truncation and recurse into child paths if needed.
- Publish-tier APIs expose published content only. Use author-tier access when drafts or unpublished changes are in scope.
- DAM URLs may require auth or point at internal hostnames. Verify asset fetchability before a large import.
- AEM tags are namespaced paths, not flat slugs.
- MSM inheritance can produce locale pages with inherited source-language fields. Detect identical translated fields before assuming content is localized.
- Experience Fragments live in a separate content tree and must be migrated before pages that reference them.
- Source-edited RTE content can contain layout tables, scripts, or arbitrary HTML that needs manual cleanup.

## Validation Checklist

- Compare page, fragment, tag, Experience Fragment, and DAM counts against source queries.
- For each major template, verify every `sling:resourceType` has an explicit Sanity mapping or an intentional skip.
- Spot-check `.model.json` and `.infinity.json` parity for custom components.
- Confirm language variants have correct slugs, `language` fields, and translation metadata.
- Confirm all DAM references resolve to Sanity assets or Media Library assets.
- Crawl old AEM URLs and verify redirects to the new frontend.
