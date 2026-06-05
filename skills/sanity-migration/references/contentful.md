# Contentful to Sanity

## What to Determine First

Before writing migration code, determine:

- Space ID, environment, locales, and whether multiple environments must be reconciled.
- Access level: Content Delivery API, Content Preview API, Content Management API, CLI export, or export file.
- Whether drafts, archived entries, unpublished entries, and deleted entries are in scope.
- Whether the migration should use the `contentful-to-sanity` package for a first pass or a custom transform for remodeling.
- Rich text field formats, embedded entries/assets, and any custom app fields.
- Which content types should become Sanity documents, objects, page builder blocks, references, or be retired.

## Extraction Paths

Common options:

- **Contentful CLI export:** best for a complete file-based snapshot of content types, entries, assets, locales, and editor interface metadata.
- **Content Management API:** best when drafts, unpublished content, archived entries, or environment-specific migration logic are needed.
- **Content Delivery API:** good for published-only migrations and frontend parity work.
- **Content Preview API:** useful when draft or preview state matters but full management access is not available.
- **`contentful-to-sanity`:** Sanity-maintained tooling that can create a Sanity project/schema and prepare a `dataset.ndjson` from a Contentful space. Use it for quick lift-and-shift or as an exploration tool, then review the generated schema before committing to it.

Snapshot exports before transformation so field mappings can be iterated offline.

If using the official Contentful CLI directly:

```bash
npx contentful-cli login
npx contentful-cli space export --space-id <space-id> --export-dir ./contentful-export
```

The export JSON should contain `contentTypes`, `entries`, `assets`, and `locales`. Analyze those before designing the transform. If credentials are already configured locally, a management token may exist in `~/.contentfulrc.json`, but do not assume it is present or safe to use without user confirmation.

## Using `contentful-to-sanity`

Use `contentful-to-sanity` when the project needs a fast first-pass lift-and-shift, schema exploration, or a generated `dataset.ndjson` to inspect. Do not treat its generated schema as final without content modeling review.

Inputs to collect:

- Contentful space ID.
- Contentful Content Delivery API access token.
- Contentful Content Management API token.
- Destination Sanity project and dataset, usually a clean Studio or scratch dataset for review.

Typical workflow:

```bash
npm create sanity@latest -- --template clean --create-project "Migrated Contentful" --dataset production --output-path ./migrate
npx contentful-to-sanity@latest -s <space-id> -t <management-token> -a <delivery-token> ./migrate
cd ./migrate
npx sanity dataset import ./dataset.ndjson production
```

If the generated Studio imports schemas from `./schemas`, update it to use the generated schema export from `./schema` as instructed by the package output.

Review before using the output as production architecture:

- Generated document and field names.
- Contentful content types that should be consolidated, split, or remodeled.
- Reference fields and embedded entry handling.
- Rich Text conversion quality, especially embedded entries and assets.
- Locale behavior and fallback values.
- Asset metadata and missing alt text.
- Whether IDs are deterministic enough for reruns and future deltas.

Use custom extraction/transform code instead when:

- Drafts, archived entries, unpublished entries, or deleted entries are in scope.
- The target Sanity model intentionally differs from the Contentful model.
- Rich Text embedded entries need custom Portable Text or page builder objects.
- Locales need a document-level localization model rather than the generated default.
- The migration must run repeatedly for delta sync before cutover.
- You need detailed quality reports, custom validation, or source-specific cleanup.

## Content States and Locales

Contentful state needs explicit mapping:

- **Draft:** `fieldStatus` is `draft`, `publishedCounter` is `0`, and no published version exists. Import only a Sanity draft document: `drafts.<documentId>`.
- **Published:** `fieldStatus` is `published`; current data matches the live version. Import only the published Sanity document: `<documentId>`.
- **Changed:** the entry was published, then edited. Import two documents: `drafts.<documentId>` from the export/current draft data, and `<documentId>` from the Content Delivery API's last published data.

When the Contentful export contains more than one locale, use document-level localization unless the project explicitly uses a field-level model:

- Determine the base locale from the export, not from assumptions.
- Use the source `sys.id` for the base document ID.
- Use `<sys.id>__i18n_<locale>` for translation document IDs.
- Use `translation.<sys.id>` for translation metadata.
- Create translation documents only when that locale has actual field values.
- Omit missing localized fields instead of copying fallback values into translation documents.
- Apply the draft/published/changed logic to every locale variant.
- Convert Contentful Rich Text separately per locale.

## Mapping to Sanity

Map Contentful concepts deliberately:

- `Symbol` maps to `string`.
- `Text` maps to `text`.
- `RichText` maps to Portable Text.
- `Integer` and `Number` map to `number`.
- `Date` maps to `datetime`.
- `Media` maps to `image` or `file`.
- `Link` to Entry maps to `reference`.
- Arrays map to Sanity arrays, with array members chosen from the field's item type.
- Content types usually become Sanity document types when independently managed or queried.
- Contentful fields that are only meaningful inside one parent become Sanity object fields or named object types.
- Single-reference and multi-reference fields become Sanity references.
- Contentful assets become Sanity image/file assets with asset field metadata such as title, description, alt text, and source URL where useful.
- Contentful locales can map to field-level localization or document-level localization depending on the target editorial workflow.
- Contentful Rich Text should become Portable Text, preserving marks, embedded entries, embedded assets, hyperlinks, and custom blocks as supported by the target schema.

Use the migration to reduce over-generic content types and remove fields that exist only because of Contentful app or layout constraints.

If a Contentful field is an array of strings but behaves like a taxonomy, promote it to reference documents instead of preserving it as strings. Good candidates include product tags, article tags, topics, industries, audiences, and filters used by navigation/search. Create the taxonomy documents first, then reference them from migrated entries.

## Transformation Notes

- Preserve original Contentful entry IDs in deterministic Sanity IDs or migration metadata.
- Build ID maps for every entry and asset before transforming references.
- Convert Rich Text JSON structurally instead of rendering to HTML first when possible. Use `@portabletext/contentful-rich-text-to-portable-text` when it fits the target schema, then add custom handling for embedded entries/assets.
- Handle embedded entries with explicit mapping decisions: inline object, reference block, page builder object, or skipped unsupported block.
- Preserve locale fallbacks intentionally. Do not flatten fallback values into translated documents without recording that they were inherited.
- Import reusable taxonomies, people, and shared modules before documents that reference them.

## Gotchas

- Published-only APIs omit draft and unpublished content.
- Contentful locale fallbacks can hide missing translations. Decide whether to preserve missingness or fill with fallback content.
- Rich Text embedded entries often carry presentation-specific modules. They need custom Portable Text or page builder object mappings.
- Asset fields may store title/description but not enough accessibility metadata. Flag missing alt text for editorial review.
- Contentful asset exports can be incomplete or corrupt. Check downloaded asset files for zero-byte size, missing files, unexpected content type, and failed URLs before building `_sanityAsset` references.
- Some generated schemas from automated tools are a starting point, not a final content model.
- Contentful field validations and required flags do not guarantee every historical entry is clean.
- If only code is available, inspect `contentfulClient.getEntries({content_type: ...})`, GraphQL queries, Contentful TypeScript interfaces, component props, and `contentful/migrations/` files to reconstruct the content model.

## Validation Checklist

- Compare content type, entry, asset, and locale counts with the source export.
- Confirm every Contentful content type is mapped, skipped, or intentionally consolidated.
- Confirm all reference fields resolve to existing Sanity document IDs.
- Spot-check Rich Text entries with embedded assets, embedded entries, tables, lists, and links.
- Verify promoted string taxonomies have one canonical document per unique value and all source entries reference those documents.
- Verify every exported asset path exists and has a non-zero file size before import.
- Verify locale fallback behavior with real translated and untranslated entries.
- Verify draft, published, and changed entries produce the expected Sanity draft/published documents.
- Verify translation metadata documents link all language variants for each entry.
- Confirm frontend GROQ queries return shapes equivalent to the old Contentful queries or the agreed new contract.
