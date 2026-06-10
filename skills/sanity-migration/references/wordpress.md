# WordPress to Sanity

## What to Determine First

Before writing migration code, determine:

- Source format: REST API, WXR/XML export, WPGraphQL, WP-CLI, database dump, static HTML, or individual page-builder exports.
- Whether the site uses Gutenberg blocks, Classic editor HTML, Advanced Custom Fields, custom post types, custom taxonomies, multilingual plugins, WooCommerce, Yoast, or page builders.
- Whether drafts, private posts, scheduled posts, revisions, menus, comments, and users are in scope.
- Whether media files are public, behind auth, on WordPress uploads, on a CDN, or in a third-party DAM.
- Whether WordPress IDs can be preserved in deterministic Sanity IDs.

## Extraction Paths

Choose the extraction route by available access:

- **WordPress REST API:** good for live, paginated, public content. Use `/wp-json/wp/v2`, `per_page=100`, and response headers such as `x-wp-total` and `x-wp-totalpages` for counts.
- **Authenticated REST API:** needed for `context=edit`, raw Gutenberg content, drafts, private fields, and some plugin data. Use application passwords or another approved auth flow; store credentials in environment variables.
- **WXR/XML export:** common for handoff scenarios and good for a repeatable file-based migration. Parse namespaced fields and unwrap CDATA or parser objects before transformation.
- **WPGraphQL:** useful when installed and configured to expose the needed fields.
- **WP-CLI/database:** useful with direct server access, custom fields, and completeness checks.
- **Static HTML:** fallback only when structured access is unavailable.

If a WXR/XML file is present and complete, default to parsing it rather than requiring WP-CLI access.

REST URLs:

- Standard site: `https://<domain>/wp-json/wp/v2`.
- Multisite: `https://<domain>/<site-name>/wp-json/wp/v2`.
- Count check: `curl -sI "<base>/posts?per_page=100"`.

Authenticated raw content example:

```bash
curl -u "$WP_USER:$WP_APP_PASSWORD" \
  "<base>/posts?context=edit&per_page=100"
```

If REST is blocked by Cloudflare or security plugins, use one of these before scraping rendered HTML: ask for a WXR export, run WordPress locally with a production database copy, have the customer save JSON from an authenticated browser session, or pass a valid `cf_clearance` cookie only with explicit approval.

## Schema Discovery

With WordPress access, export schema signals before modeling:

```bash
wp post-type list --format=json > post-types.json
wp taxonomy list --format=json > taxonomies.json
wp acf export --format=json > acf-fields.json
```

If WP-CLI is unavailable, inspect:

- `register_post_type()` calls in themes/plugins.
- `register_taxonomy()` calls.
- ACF `get_field()` usage and exported field groups.
- Template files such as `single-*.php`, `archive-*.php`, and page templates.
- `wp_posts`, `wp_postmeta`, and `wp_term_taxonomy` when database access exists.

ACF defaults:

- Text/Textarea maps to `string` or `text`.
- WYSIWYG maps to Portable Text.
- Image maps to `image`.
- Gallery maps to an array of images.
- Repeater maps to an array of objects.
- Flexible Content maps to an array of union object types.
- Relationship maps to a reference or array of references.

## Mapping to Sanity

- Posts and pages may become `post`, `page`, or more semantic document types such as `article`, `person`, `location`, `event`, or `caseStudy`.
- Custom post types usually deserve explicit Sanity document types, not a generic `postType` field.
- Users often become `author` or `person` documents. Treat them separately from Sanity project members.
- Categories, tags, and useful custom taxonomies should become reference documents when they power navigation, filtering, SEO, or editorial reuse.
- ACF field groups map to Sanity fields, objects, or references depending on reuse and lifecycle.
- Yoast and other SEO metadata can map to an `seo` object if the target project uses one.
- Menus can become navigation singleton documents or frontend configuration, depending on the target architecture.

Use page templates and custom post types as signals for content trapped in presentational structures.

## Transformation Notes

- Use deterministic IDs such as `post-123`, `page-123`, `author-41`, `category-news`, or a project-specific semantic prefix.
- Create authors and taxonomy documents before posts/pages that reference them.
- Build attachment maps before transforming content:
  - `_thumbnail_id` postmeta points to an attachment post.
  - Attachment records contain URLs and metadata such as alt text.
  - Featured images should become Sanity image fields with `_sanityAsset` or uploaded asset references.
- Decode HTML entities in titles, excerpts, taxonomy names, and author names.
- Store editorial dates in explicit fields such as `publishedAt` and `modifiedAt`; do not rely on `_createdAt` / `_updatedAt` for source publication dates.
- Omit empty fields instead of storing empty CDATA objects, empty strings, or `null`.
- Keep a per-document quality log for missing authors, failed media, malformed HTML, unsupported blocks, duplicate slugs, and skipped post types.

## WXR/XML Field Map

When parsing WXR/XML, always unwrap parser output before writing Sanity documents. Prefer `fast-xml-parser` so CDATA is captured consistently:

```ts
import {XMLParser} from 'fast-xml-parser'
import {readFile} from 'node:fs/promises'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  cdataPropName: '_cdata',
  textNodeName: '_text',
})

const xml = await readFile('wordpress-export.xml', 'utf8')
const parsed = parser.parse(xml)

function text(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return text(value[0])
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return text(record._cdata ?? record._text)
  }
  return ''
}
```

Run every XML field through a helper like `text()` before writing Sanity documents. Never store raw parser objects.

Key WXR fields:

- `title` -> title.
- `wp:post_name` -> `slug.current`.
- `content:encoded` -> body or content source, converted to Portable Text.
- `excerpt:encoded` -> excerpt; omit when empty.
- `wp:post_date_gmt` -> `publishedAt` or equivalent source publication field.
- `dc:creator` -> author lookup key; prefer mapping to WordPress author ID when possible.
- `wp:post_type` -> content type routing.
- `wp:post_id` -> source ID for deterministic Sanity IDs.
- `wp:postmeta[]` -> ACF, `_thumbnail_id`, Yoast, Elementor, and other plugin data.
- `category[]` with `domain` attributes -> categories, tags, or custom taxonomies.

Build a flat postmeta map:

```ts
const meta: Record<string, string> = {}
for (const item of post['wp:postmeta'] || []) {
  const key = text(item['wp:meta_key'])
  const value = text(item['wp:meta_value'])
  if (key) meta[key] = value
}
```

Featured image is not in the main post body. Build an attachment map from `wp:post_type === "attachment"` records, then resolve `meta["_thumbnail_id"]` to `{url, alt}` and set an image field with `_sanityAsset`.

Map common Yoast fields only when non-empty:

- `_yoast_wpseo_title` -> `seo.metaTitle`.
- `_yoast_wpseo_metadesc` -> `seo.metaDescription`.
- `_yoast_wpseo_focuskw` -> `seo.focusKeyword`.
- `_yoast_wpseo_meta-robots-noindex === "1"` -> `seo.noIndex`.

Also inspect Rank Math or other SEO plugin postmeta if present; do not assume Yoast is the only SEO source.

## Rich Text

WordPress body content is the highest-risk part of most migrations.

- **Rendered REST HTML (`content.rendered`):** convert to Portable Text with HTML tooling, but expect loss of block/editor structure.
- **Raw Gutenberg content (`content.raw` with `context=edit`):** parse with `@wordpress/block-serialization-default-parser`, then map each block type to Portable Text blocks or custom objects.
- **Classic editor or WXR HTML:** prefer a custom JSDOM traversal when the markup includes WordPress artifacts, shortcodes, inconsistent links, or legacy editor cruft. `@portabletext/block-tools` is acceptable only after testing on real posts and confirming markDefs and custom blocks are correct.
- **Shortcodes:** identify project-specific shortcodes before conversion. Some become custom objects; others can be stripped or logged for editorial cleanup.
- **Inline images:** resolve through media/attachment maps when possible; otherwise use `_sanityAsset` from the discovered URL and log unresolved metadata.

For links, remember that Portable Text annotations live in a block's `markDefs`; spans reference annotation keys through `marks`. The link mark definition belongs on the block, not the span.

Before running full conversion, test 3-5 real posts and confirm:

- The body is an array of Portable Text blocks, not a string.
- No raw HTML tags remain in text spans.
- Links have `markDefs` on the block.
- Empty blocks are filtered out.
- Unsupported shortcodes or custom blocks are logged.

Common Gutenberg mappings:

- `core/paragraph`, `core/heading`, `core/list`, `core/quote`: Portable Text blocks.
- `core/image`: image block with resolved attachment or `_sanityAsset`.
- `core/embed`: custom embed object or logged external embed.
- `core/columns` and `core/column`: custom Portable Text object or page builder object if layout matters.
- `core/button` / `core/buttons`: CTA object, link annotation, or page-level CTA based on reuse.
- `core/table`: custom table object; do not flatten unless table semantics are not needed.
- `core/code` / `core/preformatted`: code block object when code content matters.

## Elementor and Page Builders

Elementor stores structured page data in `_elementor_data`, not in normal REST `content.rendered`.

- Prefer Elementor template JSON exports from WordPress admin or WXR/database access to `_elementor_data`.
- The exported JSON has a root `content` array of sections, columns, containers, and widgets.
- Work at section/container level. Classify sections by widget mix and editorial purpose, then map to Sanity page builder objects.
- Use `widgetType` to identify content fields, but avoid creating one Sanity type per low-level widget.
- If only rendered HTML is available, treat it as a lossy fallback and plan human review.
- Rewrite private or environment-specific media URLs to public URLs before using `_sanityAsset`.

Common Elementor widget fields:

- `heading`: `settings.title`, `settings.header_size`.
- `text-editor`: `settings.editor` HTML.
- `image`: `settings.image` as object or JSON string with URL/ID/alt.
- `button`: `settings.text`, `settings.link`, `settings._css_classes`.
- `counter`: `settings.ending_number`, `settings.prefix`, `settings.suffix`, `settings.title`.
- `icon-list`: `settings.icon_list[]`.
- `html`: `settings.html`; inspect for forms, carousels, or embeds.
- `template`: `settings.template_id`; resolve global Elementor templates separately.

Other page builders such as Divi and Beaver Builder have similar risks: rendered HTML loses source structure and usually requires custom handling.

## Gotchas

- REST API access can be blocked by security plugins, Cloudflare, or custom hardening.
- WXR/XML parser output can wrap values in objects such as `_cdata`; unwrap every field before writing Sanity documents.
- `content.rendered` has shortcodes and filters already applied; `content.raw` requires auth but preserves Gutenberg block comments.
- ACF fields may not appear in REST unless configured.
- Author display names are fragile join keys. Prefer WordPress author IDs when available.
- Attachment URLs may point to staging domains, private CDN domains, or resized variants. Prefer the best available original asset URL.
- Multilingual plugins differ significantly; inspect the plugin-specific relationship data before choosing Sanity's localization shape.

## Validation Checklist

- Count documents by `wp:post_type` or REST endpoint and compare to Sanity document counts.
- Confirm skipped WordPress types are intentional, such as `attachment`, `nav_menu_item`, `wp_block`, or ACF definitions.
- Spot-check at least five rich text documents across old/new content and different editors.
- Search generated output for raw `<p`, `_cdata`, and `[object Object]`.
- Confirm featured images resolve from `_thumbnail_id` or another source-specific image field.
- Confirm author and taxonomy references point to existing documents.
- Confirm at least one document has a real image `_sanityAsset` directive or uploaded asset reference, not a TODO/null placeholder.
- Confirm the author pass uses WordPress author IDs or a documented fallback map, not display-name matching alone.
- Confirm Yoast/SEO objects are omitted when all source values are empty.
- Verify old URLs, slugs, canonical metadata, and redirects.
