# Drupal to Sanity

## What to Determine First

Before writing migration code, determine:

- Drupal major version.
- Whether Drush, database, admin UI, repository config, JSON:API, REST, or GraphQL access is available.
- Which node types, taxonomy vocabularies, Paragraphs, media entities, menus, Views, users, redirects, and translations are in scope.
- Whether content moderation, revisions, drafts, unpublished nodes, aliases, and redirects need to be preserved.
- Whether rich text is Filtered HTML, Full HTML, Markdown, CKEditor output, or embedded media/shortcode-like tokens.

## Schema Discovery

Use Drush and configuration export when available:

```bash
composer require drush/drush
drush config:export --destination=./drupal-config
drush config:get node.type --include-overridden
drush config:get field.storage --include-overridden
drush config:get field.field --include-overridden
drush entity:info node_type
```

Key config files:

- `node.type.*.yml`: content type definitions.
- `field.storage.*.yml`: reusable field storage definitions.
- `field.field.*.yml`: field instances on bundles.
- `core.entity_view_display.*.yml`: display config; useful for identifying presentation-only fields.
- `taxonomy.vocabulary.*.yml`: taxonomy vocabularies.
- Paragraphs config: paragraph bundles and fields when the Paragraphs module is used.

If Drush is unavailable, inspect exported config, custom modules, entity query usage, Twig templates, Views config exports, and field definitions in code.

## Extraction Paths

Choose the most complete source:

- **Drush/config + database:** best for full-fidelity migrations and schema discovery.
- **Drupal JSON:API:** useful for structured extraction when enabled; include relationships and pagination explicitly.
- **REST/GraphQL:** use when configured and complete enough for the target scope.
- **Database dump:** complete but requires joining entity tables, field tables, revisions, files, and taxonomy terms.
- **Static crawl:** fallback for public content only; loses entity relationships and editorial metadata.

Snapshot raw entity exports before transforming. Drupal field tables and revisions can be hard to reason about after the fact.

## Mapping to Sanity

- Node types become Sanity document types.
- Taxonomy vocabularies and terms become reference documents.
- Entity references become Sanity references.
- Paragraph bundles become Sanity object types, Portable Text custom objects, or page builder blocks.
- Media entities and file/image fields become Sanity image/file assets.
- Menus can become navigation singleton documents or frontend configuration.
- Views usually become frontend GROQ queries or route/listing logic, not migrated content.
- URL aliases and redirect entities become redirect data or frontend redirect config.

## Transformation Notes

- Use deterministic IDs from entity type, bundle, entity ID, and language, such as `node.article.123.en`.
- Import taxonomy terms, media, users/authors, and reusable referenced entities before nodes.
- Preserve `path.alias` or alias tables as legacy URLs for redirects.
- Convert rich text after applying or accounting for Drupal text filters. Filtered HTML may contain tokens, media embeds, or text-format-specific markup.
- Resolve file IDs to real file URLs or local file paths before using `_sanityAsset`.
- For Paragraphs, enumerate all paragraph bundle types across all content, not only from a sample node.

## Gotchas

- Drupal field storage and field instances are separate. Read both before mapping fields.
- Revisions and moderation states may contain unpublished content not visible through public APIs.
- Paragraphs can be deeply nested and reused differently across node types.
- Views are presentation/query configuration; do not blindly model every View as content.
- URL aliases, redirects, and menu links may live outside node records.
- Translations may be entity-level or field-level depending on site configuration.

## Validation Checklist

- Compare counts by node type, taxonomy vocabulary, media type, language, and published/moderation state.
- Confirm every field storage/field instance pair is mapped, skipped, or intentionally consolidated.
- Confirm every Paragraph bundle has a Sanity object/block mapping or an intentional skip.
- Confirm file/media references resolve to accessible assets.
- Confirm aliases and redirects cover old public URLs.
- Spot-check translated nodes and unpublished/draft content if they are in scope.
