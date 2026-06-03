# Payload to Sanity

## What to Determine First

Before writing migration code, determine:

- Payload version and whether the app is Payload standalone or integrated with Next.js.
- Whether repository access is available. Payload config is the best source of truth for collections, globals, fields, uploads, localization, access control, drafts, versions, and hooks.
- Access level: Local API, REST API, GraphQL API, database dump, or the official import/export plugin.
- Which collections, globals, upload collections, drafts, versions, localized fields, and hidden fields are in scope.
- Which rich text editor is used, such as Lexical or a legacy editor, and whether custom blocks are present.
- Which database and upload storage adapter are used.

## Extraction Paths

Prefer source paths in this order:

- **Repository + Local API:** best path when available. Import Payload with `getPayload({ config })`, then use `payload.find`, `payload.findGlobal`, and version APIs from a script running in the project context.
- **Import/export plugin:** official `@payloadcms/plugin-import-export` can export collection data as JSON or CSV. Prefer JSON for migration because it preserves nested objects, arrays, rich text structures, relationship references, and native field shapes.
- **REST API:** every collection and global has generated REST endpoints under the API route prefix, usually `/api`. Use `depth`, `locale`, `fallback-locale`, `select`, `populate`, `limit`, `page`, `sort`, and `where`.
- **GraphQL API:** useful if enabled and if the schema exposes all needed fields.
- **Database dump:** complete but usually lower-level than Payload's APIs. Use when the app cannot run or when API access is insufficient.

The Local API has server-only options that are useful for migration: `depth`, `locale`, `fallbackLocale`, `select`, `populate`, `overrideAccess`, `showHiddenFields`, and `pagination: false`.

Important: Local API operations skip access control by default. Do not export auth collections, user secrets, password hashes, tokens, or hidden operational fields unless the migration explicitly requires them and the user has approved the scope.

## Import/Export Plugin Details

The official `@payloadcms/plugin-import-export` can export collection data as CSV or JSON. Use JSON for Sanity migrations unless there is a strong reason to flatten to CSV.

Export routes/options to know:

- Direct download streams a file from `POST /api/exports/download`.
- Saved exports create an upload document in the `exports` collection.
- Local API can create an export document, for example with collection slug and `format: "json"`.
- Jobs Queue can run `createCollectionExport`; ensure a job runner exists or set synchronous behavior for small/test exports.
- Export parameters include `locale` and `drafts`; `locale: "all"` is useful for multi-locale export, and `drafts: true` includes draft versions for collections with drafts enabled.

JSON export preserves nested structures, rich text, relationship references, and native field shapes. CSV export flattens nested fields with underscore notation and coerces values, so it is worse for rich text and relationship-heavy migrations.

## Local API Examples

Initialize Payload in a script:

```ts
import {getPayload} from 'payload'
import config from '@payload-config'

const payload = await getPayload({config})
```

Extract a collection:

```ts
const result = await payload.find({
  collection: 'pages',
  depth: 0,
  page: 1,
  limit: 100,
  locale: 'en',
  fallbackLocale: false,
  showHiddenFields: true,
})
```

Extract a global:

```ts
const header = await payload.findGlobal({
  slug: 'header',
  depth: 0,
  locale: 'en',
  fallbackLocale: false,
  showHiddenFields: true,
})
```

Use `depth: 0` when building deterministic Sanity references from relationship fields; populated relationship objects are useful for inspection but can hide the source ID shape and create circular/large payloads.

For draft-enabled collections, `draft: true` returns the latest version, which may be a draft. It is not "drafts only." Decide whether to migrate that latest draft as `drafts.<id>`, published content as `<id>`, or both.

## Mapping to Sanity

- Payload collections usually become Sanity document types.
- Payload globals usually become Sanity singleton documents with fixed IDs.
- Payload blocks map to Sanity named object types, page builder objects, or Portable Text custom objects.
- Payload relationships map to Sanity references.
- Payload uploads map to Sanity image/file fields and assets.
- Payload localized fields can map to Sanity field-level localization or document-level localization depending on the target workflow.
- Payload drafts and versions require an explicit decision: migrate only published content, migrate draft variants as Sanity drafts, or archive version history outside Sanity.

Use Payload config files to distinguish actual content architecture from incidental database shape.

## Transformation Notes

- Use collection slug and source document ID for deterministic Sanity IDs, such as `post-<payloadId>` or `<collectionSlug>-<payloadId>`.
- For localized document-level migrations, prefer IDs such as `payload.<collection>.<id>.<locale>` or the project's existing translation ID convention.
- Build maps for relationships and uploads before transforming documents that reference them.
- Export one locale at a time or export all locales and normalize into the chosen Sanity localization model.
- For globals, assign fixed IDs such as `global-header`, `settings`, or the existing project convention.
- For uploads, extract original file URL/path, filename, mime type, alt text, dimensions, and any focal/crop metadata if present.
- For rich text, map the editor's JSON tree structurally. Do not stringify Lexical or block JSON into Sanity fields.
- If using the import/export plugin, configure export format as JSON and include locale/draft options when needed.

## Gotchas

- REST and GraphQL responses are governed by access control and selected fields. Local API with `overrideAccess` and `showHiddenFields` is better for complete migration snapshots.
- Hooks can mutate values during API reads or writes. Decide whether to run through Payload APIs for normalized behavior or read raw database rows for historical fidelity.
- Uploads may be stored locally, in S3, Cloudinary, or another adapter. API documents may not contain directly fetchable public URLs.
- `depth` controls relationship/upload population. Too shallow loses data; too deep can make huge payloads or circular shapes.
- Draft and version data are separate concerns. The import/export plugin can include drafts for draft-enabled collections; version history may need separate extraction through version APIs if it is in scope.
- Localized fields can be exported as a single locale or all locales. Do not accidentally collapse fallback values into translations.
- JSON export preserves nested structures; CSV flattens and coerces values and is less suitable for rich migration transforms.

## Validation Checklist

- Compare collection, global, upload, locale, draft, and version counts against Payload admin/API/database.
- Confirm every collection and global in the Payload config is mapped, skipped, or intentionally consolidated.
- Confirm relationships resolve to deterministic Sanity IDs.
- Confirm upload URLs or files are accessible to the Sanity import/upload process.
- Spot-check rich text with custom blocks, links, embeds, and nested structures.
- Confirm localized content preserves missing translations and fallback behavior according to the migration plan.
- Confirm singleton/global documents have stable IDs and frontend queries can retrieve them.
