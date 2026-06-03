# Strapi to Sanity

## What to Determine First

Before writing migration code, determine:

- Strapi version, especially v4 vs v5.
- Access level: public REST, authenticated REST, GraphQL, Document Service / Entity Service, repository access, admin token, or database.
- Whether drafts, private fields, unpublished entries, and hidden types are in scope.
- Whether i18n is enabled and how locales are represented.
- Rich text/body format: Strapi blocks, Markdown, HTML, CKEditor, or custom JSON.
- Dynamic zones and the complete set of `__component` values.
- Asset provider: local disk, S3, Cloudinary, Strapi Cloud media CDN, or another provider.

## Extraction Paths

Access changes extraction completeness more than downstream complexity:

| Access | Best use | Main risk |
| --- | --- | --- |
| Repository | Prove schemas, components, dynamic zones | Does not contain content values |
| Public REST | Fast published-content extraction | Omits drafts/private fields and cannot prove completeness |
| Admin/authenticated API | Drafts, unpublished entries, private fields | Requires approved credentials |
| GraphQL | Typed extraction when enabled | Introspection may be disabled |
| Database | Completeness checks, hidden data | Requires manual joins through relation/morph tables |

REST with `populate` is often better than raw database extraction because Strapi returns joined relationships and components.

Snapshot all extracted records before transformation. For REST extraction, explicitly request deep population for nested components and dynamic zones.

## Schema Discovery Commands

When repository or admin access is available, prove the schema before sampling content:

```bash
# Content type schemas
ls src/api/*/content-types/*/schema.json

# Component schemas
ls src/components/*/*.json

# Strapi configuration snapshot
npx strapi configuration:dump --file strapi-config.json
```

With admin API access, inspect the content-type builder:

```bash
curl "http://localhost:1337/admin/content-type-builder/content-types" \
  -H "Authorization: Bearer <admin-token>"
```

Each Strapi schema file contains `info`, `attributes`, and `options`. Use these to find field types, validations, draft/publish settings, timestamps, components, dynamic zones, media, and relations.

## Mapping to Sanity

- Strapi collection types become Sanity document types when they are independently managed.
- Strapi single types usually become Sanity singleton documents with fixed IDs.
- Strapi components become Sanity object types.
- Strapi dynamic zones become arrays of named object types, one Sanity `_type` per `__component`.
- Strapi relations become Sanity references.
- Strapi media objects become Sanity image/file fields and assets.
- Strapi v5 `documentId` is the best stable source key. Use it for deterministic Sanity IDs and locale grouping.
- Strapi i18n variants usually map well to document-level localization with `language` fields and translation metadata.

For localized Strapi v5 content, a useful deterministic ID pattern is `<type>.<documentId>.<locale>`.

Field mapping defaults:

- `string` maps to `string`.
- `text` maps to `text`.
- `richtext` maps to Portable Text.
- `number`, `integer`, `float`, and `decimal` map to `number`.
- `date`, `datetime`, and `time` map to the closest Sanity date/datetime strategy the frontend expects.
- `media` maps to `image`, `file`, or arrays of those.
- `relation` maps to `reference` or an array of references.
- `component` maps to a named object type.
- `dynamiczone` maps to an array of union object types.

## Transformation Notes

- Enumerate `__component` values across all records, not a sample.
- Derive IDs from `documentId` in Strapi v5. For v4, choose a stable fallback such as content type plus numeric ID or slug, and document the risk.
- Build maps for relationships and media before transforming documents that reference them.
- Deduplicate assets by media `hash` when available.
- Keep the raw source body temporarily until rich text fidelity is verified.
- Use weak references or deterministic IDs during bulk import so order does not create duplicate referenced documents.

Body conversion depends on editor format:

- **Strapi blocks:** map structurally to Portable Text or custom Portable Text objects.
- **Markdown:** use `@portabletext/markdown`, with custom handling for GFM tables, fenced code, and inline images.
- **HTML / CKEditor:** use `@portabletext/block-tools` with `JSDOM` or a custom converter if the HTML is inconsistent.

## Asset Pipeline

1. Extract every Strapi media object from fields, dynamic zones, and rich text bodies.
2. Dedupe by `hash` when present; otherwise use source URL/path plus filename.
3. Download from the configured provider: local uploads, S3, Cloudinary, Strapi Cloud media CDN, or another adapter.
4. Upload once to Sanity and store `oldUrl/hash -> asset _id`.
5. Rewrite image/file fields and inline body media to Sanity asset references.
6. Log missing or private media URLs as quality issues, not silent omissions.

## Gotchas

- Public REST returns published content only. Draft state requires admin/API/database access.
- Strapi v5 `documentId` is stable across locales and draft/published variants; numeric IDs are less useful for cross-locale identity.
- `populate` depth limits can hide nested dynamic-zone data. Test deeply nested examples.
- The API can only infer shapes from returned content; repo access proves the full schema.
- Components can drift between object and array shapes depending on configuration and historical data.
- GraphQL may be disabled or too restricted for migration use.
- Some pages may be hardcoded in the frontend rather than Strapi-driven. Audit frontend routes before assuming Strapi contains every page.
- If only frontend code is available, inspect API calls, `populate` parameters, component usage, custom plugin fields, and expected response shapes.

## Validation Checklist

- Compare collection, single type, locale, and asset counts with Strapi admin/API/database counts.
- Confirm every component and dynamic-zone `__component` value is mapped or intentionally skipped.
- Confirm draft/unpublished scope is explicitly handled.
- Spot-check content with deepest nested dynamic zones.
- Confirm relationship refs use deterministic Sanity IDs and resolve.
- Confirm media deduplication and all migrated assets render in Studio and the frontend.
