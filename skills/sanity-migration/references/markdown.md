# Markdown to Sanity

## What to Determine First

Before writing migration code, determine:

- Source shape: Markdown files, MDX, GitHub README-style content, static-site content, AI-generated Markdown, or Markdown exported from a CMS.
- File count, directory structure, and whether paths encode slugs, dates, sections, or locales.
- Frontmatter fields and formats.
- Markdown extensions: GFM tables, callouts, directives, footnotes, raw HTML, code fences, embeds, local images, and MDX JSX.
- Target Sanity document type and Portable Text field name.
- Allowed Portable Text styles, lists, decorators, annotations, and custom object types.
- Whether tags, authors, categories, and images are references, inline fields, or separate documents.

## Default Conversion Path

Use direct Markdown -> Portable Text conversion with `@portabletext/markdown`.

```bash
npm install @portabletext/markdown
```

```ts
import {markdownToPortableText} from '@portabletext/markdown'

const body = markdownToPortableText(markdown)
```

Do not call Markdown -> HTML -> `htmlToBlocks` "direct conversion." That is an HTML fallback path. Use it only when the Markdown pipeline cannot handle source-specific syntax that is easier to normalize as HTML.

## Schema-Constrained Conversion

For a Sanity block array schema, convert it with `@portabletext/sanity-bridge`:

```bash
npm install @portabletext/markdown @portabletext/sanity-bridge
```

```ts
import {markdownToPortableText} from '@portabletext/markdown'
import {sanitySchemaToPortableTextSchema} from '@portabletext/sanity-bridge'

const schema = sanitySchemaToPortableTextSchema(sanityBlockArraySchema)
const body = markdownToPortableText(markdown, {schema})
```

Use custom matchers when Markdown syntax must become specific Sanity objects:

```ts
const body = markdownToPortableText(markdown, {
  schema,
  types: {
    table: ({context, value}) => ({
      _type: 'table',
      _key: context.keyGenerator(),
      rows: value.rows,
      headerRows: value.headerRows,
    }),
  },
})
```

Only emit custom types that exist in the target schema.

## Frontmatter Mapping

Use a frontmatter parser such as `gray-matter`:

```bash
npm install gray-matter
```

Map common fields deliberately:

- `title` -> document title.
- `slug` or file path -> `slug.current`.
- `date`, `published`, `updated` -> explicit datetime fields such as `publishedAt`.
- `author` -> reference, string, or author document depending on target schema.
- `tags` and `categories` -> reference documents when they power filtering/navigation.
- `description`, `canonical`, `ogImage` -> SEO object if the target schema has one.
- Source file path -> migration metadata for debugging.

Do not put frontmatter into the Portable Text body unless it is actual editorial content.

## Asset Handling

Markdown images need explicit handling:

- Remote image: use `_sanityAsset: "image@https://..."` in NDJSON or upload through the client.
- Local image: use an absolute `file:///...` URI in NDJSON, package assets into a tarball, or upload through the client.
- Prefer the largest original image, not resized derivatives.
- Preserve alt text from `![alt](src)` and title text when present.
- Rewrite image paths before conversion if Markdown uses relative paths.
- Log unresolved images; do not silently keep broken local paths.

If images should remain inline inside Portable Text, ensure the Portable Text schema allows an image object. If images belong in a separate field such as `mainImage`, extract them before conversion.

## Document IDs and Import

Use stable IDs:

- File path slug: `post-my-folder-my-file`.
- Frontmatter ID: `post-<sourceId>`.
- Hash only when no stable source ID/path exists.

For bulk imports, prefer NDJSON:

```json
{"_id":"post-example","_type":"post","title":"Example","body":[{"_type":"block","_key":"a","style":"normal","children":[{"_type":"span","_key":"b","text":"Hello","marks":[]}],"markDefs":[]}]}
```

Then import with:

```bash
npx sanity dataset import import.ndjson <dataset> --replace
```

Use client `createOrReplace` for smaller imports or incremental syncs.

## Keep Markdown Native

Only keep Markdown native when the project intentionally wants Markdown editing/rendering instead of Portable Text querying and structured blocks.

If keeping Markdown native, use a Markdown field/plugin and document the tradeoff: simpler migration and editing for Markdown-first teams, but weaker structured querying, references, annotations, and block-level content reuse.

## Validation Checklist

- Confirm every document has `_id`, `_type`, title/slug where required, and a Portable Text array.
- Confirm no body field is a raw Markdown string unless the target intentionally stores native Markdown.
- Confirm all Portable Text custom `_type` values exist in the schema.
- Confirm all image references resolve to remote URLs, absolute local file URLs, or uploaded Sanity asset IDs.
- Confirm frontmatter dates parse to valid ISO datetime strings.
- Confirm tags/authors/categories resolve according to the target model.
- Confirm rerunning the transform produces the same IDs.
- Confirm MDX JSX is mapped to Sanity objects, stripped, or logged for manual cleanup.
