# Webflow to Sanity

## What to Determine First

Before writing migration code, determine:

- Which content lives in Webflow CMS collections and which content exists only in static pages.
- Whether CSV export, Webflow Data API access, or static HTML export is available.
- Whether the site uses Webflow Components, component variants, symbols, or repeated section patterns.
- Which collection references and multi-references exist.
- Whether assets are public on Webflow CDN and must be moved before cutover.
- Which slugs and routes need to stay stable for SEO.

## Extraction Paths

Use different extraction paths for CMS content and static pages:

- **CMS collections:** export each collection as CSV or use the Webflow API if available. CSV is often sufficient and easy to audit.
- **References:** Webflow reference fields commonly export IDs. Build lookup maps from item IDs to target Sanity document IDs.
- **Static pages:** export HTML and analyze page sections separately from CMS collection data.
- **Components:** inventory components in the Webflow designer before relying on HTML export; exported HTML does not preserve component intent.
- **Assets:** collect asset URLs from CSV fields, rich text HTML, static page HTML, CSS, and Open Graph metadata.

Do not reorganize a live Webflow CMS just to make export cleaner. Audit and clean exported files instead.

## Mapping to Sanity

- Webflow collections usually become Sanity document types.
- Webflow references and multi-references become Sanity references.
- Webflow rich text fields become Portable Text.
- Webflow image/file fields become Sanity image/file fields.
- Static pages can become singleton documents, semantic document types, or page documents with a page builder array.
- Webflow components and repeated section patterns can inform page builder object types, but avoid copying visual class names into schema names.
- Use singleton documents with fixed IDs for unique pages that do not belong in a collection.

## Transformation Notes

- Normalize CSV values before import: empty columns, inconsistent taxonomy spellings, boolean-like strings, and duplicate slugs.
- Build a Webflow item ID to Sanity ID lookup before resolving references.
- Convert rich text HTML with explicit image/link handling.
- Upload or import assets before document import, then replace Webflow CDN URLs with Sanity asset references.
- For static pages, identify section patterns first, then design Sanity objects. Ask what fields editors need to manage, not what CSS classes exist.
- Use variant fields only when variants are editorially meaningful and stable, such as `tone`, `emphasis`, or `layoutIntent`.

## Import Order

1. Export and clean CMS collection CSVs.
2. Import leaf collections first: categories, tags, authors, locations, or other records referenced by others.
3. Import dependent collections using the Webflow item ID -> Sanity document ID lookup.
4. Migrate assets and replace Webflow CDN URLs in rich text and image/file fields.
5. Analyze static HTML and component inventory, then migrate singleton pages or page builder documents.

## Static Page and Page Builder Workflow

Before analyzing exported static HTML, inventory Webflow Components in the designer:

- Component name.
- Variants.
- Pages where each component appears.
- Whether the component represents reusable content, layout only, or a one-off section.

This inventory is not recoverable from exported HTML. Use it alongside static page HTML when designing Sanity page builder objects.

Analyze pages in this order:

1. Identify distinct section patterns before writing schemas.
2. Group visually similar structures and note where variants differ.
3. Decide whether each pattern is a page builder object, a singleton page field, a reference to a reusable document, or frontend-only layout.
4. Add variant fields only for stable editorial choices; do not encode CSS classes as schema names.

Singleton examples: `homePage`, `aboutPage`, `pricingPage`, `contactPage`.

A useful analysis prompt for agents:

```text
Identify all distinct content section patterns in this Webflow HTML. Group visually similar structures together, note where variants differ, and propose semantic Sanity fields for each section. Do not copy CSS class names into schema names.
```

## Cutover

Build a URL map before launch:

- Export/crawl every old Webflow route, including CMS item pages and static pages.
- Map unchanged slugs 1:1 where possible.
- Create 301 redirects for renamed, consolidated, or retired pages.
- Check sitemap, canonical URLs, Open Graph images, and high-value inbound links.

Missing redirects are the most common Webflow-to-Sanity SEO regression.

## Gotchas

- Webflow HTML export loses component metadata, variants, and designer intent.
- Webflow CMS reference fields can export opaque IDs; do not assume names or slugs are enough for reliable joins.
- Rich text exports as HTML strings and may include embedded Webflow-specific markup.
- Webflow-hosted assets can break after cutover. Do not leave production content dependent on Webflow CDN URLs.
- Webflow forms, interactions, memberships, ecommerce, and custom code often require separate frontend or service replacement.
- Static pages may contain content that should become structured documents rather than page builder sections.

## Validation Checklist

- Compare CSV row counts to Webflow collection item counts.
- Confirm every reference and multi-reference field resolves to a Sanity reference.
- Spot-check rich text fields with links, images, lists, and embeds.
- Confirm all Webflow CDN asset URLs have Sanity replacements or intentional external handling.
- Review the component inventory with a human before finalizing page builder schemas.
- Crawl old Webflow URLs and verify new pages or 301 redirects.
