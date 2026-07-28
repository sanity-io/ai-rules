# Webflow to Sanity

This reference distills the Sanity Learn course _Migrating from Webflow to Sanity_ (https://www.sanity.io/learn/course/migrating-content-from-webflow-to-sanity). That URL is source and further reading only — everything needed to run a migration is below; no network fetch is required.

Before writing code, work through the audit and mapping guidance here, agree the content model, target framework, asset handling, and redirects with the user, and write the plan into `MIGRATION.md`. Track decisions and progress there so any later session can restore context and resume.

## What to Determine First

Before writing migration code, determine:

- Which content lives in Webflow CMS collections and which exists only in static pages.
- Access available: a Webflow Data API token (preferred), CSV export, and/or static HTML export. The Data API gives the cleanest migration.
- Whether Webflow Localization is in use — the API returns locale variants per item, so model localization before extraction.
- Whether e-commerce content exists — plan it as a separate workstream.
- Whether multiple Webflow projects consolidate into one Sanity project.
- Scope: published items only, or drafts and archived too. Every API item carries `isDraft` and `isArchived` booleans to filter on.
- Whether the site uses Webflow Components, component variants, symbols, or repeated section patterns.
- Which single- and multi-reference fields exist.
- Whether assets are on the Webflow CDN and must be moved before cutover.
- Which slugs and routes must stay stable for SEO.
- Integrations the API does not reach: Site Settings > Integrations (Google Analytics, Meta Pixel), marketplace Apps that inject scripts, and where form submissions currently go (notification emails, CRMs, webhooks). Record these by hand.

## Extraction Paths

Use different extraction paths for CMS content and static pages:

- **CMS collections (Data API, preferred):** `GET /v2/collections/{collectionId}/items`, paginate at `limit=100` with an offset, and stream to NDJSON (one item per line) so large collections never accumulate in memory. Reference fields come back as Webflow item ID strings — single-ref is one string, multi-ref an array — which gives clean ID-to-ID joins. Back off on `429` using the `retry-after` header.
- **CMS collections (CSV, fallback):** export each collection as CSV when API access is unavailable. Audit and normalize before import.
- **Site structure via API:** `GET /v2/sites/{siteId}/collections` (field types, reference targets), `/v2/sites/{siteId}/pages` (slugs + SEO metadata — this is your URL inventory, no sitemap XML needed), `/v2/sites/{siteId}/components` (component definitions), `/v2/sites/{siteId}/forms` (field schemas), and `/v2/sites/{siteId}/custom_code` (script inventory; Business plan or higher). Save each response as JSON and inspect before modeling.
- **Static pages (DOM API):** `GET /v2/pages/{pageId}/dom` returns only editable content nodes — `text`, `image`, and `component-instance` (each with a `propertyOverrides` array of the content set per instance). It carries no layout context; pair it with the HTML export, which is the only source of section structure.
- **Static pages (HTML export):** requires a paid Webflow plan. Analyze page sections separately from CMS collection data.
- **Components:** inventory components in the Webflow Designer (name, variants, pages used, reusable content vs. layout-only vs. one-off) before relying on HTML export — exported HTML does not preserve component intent. The Components API (`components.json`) lists definitions but not that editorial judgment.
- **Assets:** the Webflow Assets API only returns the Site Assets panel — it misses CMS-field and rich-text images. Instead scan for asset URLs across NDJSON field data, rich-text HTML, static-page HTML, CSS, and Open Graph metadata, plus local `images/` paths in the HTML export.

Webflow serves assets from multiple CDN domains depending on account age; scan all three: `uploads-ssl.webflow.com` (most common), `assets-global.website-files.com` (older accounts), and `cdn.prod.website-files.com` (newer accounts). If the asset map comes back short, grep the HTML export for `src=`/`href=` domains and reconcile.

Do not reorganize a live Webflow CMS just to make export cleaner. Audit and clean exported files instead.

## Mapping to Sanity

- Webflow collections usually become Sanity document types; references and multi-references become Sanity references; rich text becomes Portable Text; image/file fields become Sanity image/file fields.
- Static pages become singleton documents, semantic document types, or page documents with a page-builder array.
- Components and repeated section patterns can inform page-builder object types, but do not copy visual class names into schema names.
- Use singleton documents with fixed IDs for unique pages that do not belong in a collection (e.g. `homePage`, `aboutPage`, `pricingPage`, `contactPage`).

Webflow CMS constraints create anti-patterns worth fixing on the way in, not copying:

- A collection with no page of its own, only ever referenced by one parent → inline array of objects, not a document type.
- Numbered fields (`step_1_title`, `step_2_title`) → one typed array field.
- Pipe-separated text (`a | b | c`) → a proper array field.
- Rich text used as a catch-all for structured content → typed Portable Text blocks or dedicated fields.
- Redundant display-variant fields (`name`, `nameWithBrackets`, `navText`…) → store one source field and derive the rest in GROQ.
- Boolean proliferation (`isFeatured`, `isNew`, `isHidden`) that is really one editorial decision → a single `status` string with an options list.
- A reference collection used only to constrain a value to a fixed set → a string field with `options.list`; keep it a reference only if the target has real content and a public URL.
- A stored full-path field duplicating the slug → keep the slug, derive the URL at render time.

## Transformation Notes

- Prefer the Data API's item-ID references over slug/name joins; build a Webflow item ID → Sanity ID lookup (`id-map.json`) before resolving references.
- Use deterministic Sanity IDs of the form `<typeName>-<webflowItemId>` (e.g. `blog-664a0fba...`) so a document's type is readable from its ID and reruns stay idempotent.
- Normalize values before import: empty columns, inconsistent taxonomy spellings, boolean-like strings, and duplicate slugs (especially in CSV exports).
- Convert rich text with `htmlToBlocks()` from `@portabletext/block-tools`, adding custom deserializer rules for your export's image and embed patterns. Decide how each HTML pattern maps to a block type before writing code.
- Upload assets before document import, then reference the uploaded assets and replace Webflow CDN URLs in rich text and image/file fields. Upload SVGs and other non-raster files as `file`, not `image`.
- For static pages, identify section patterns first, then design Sanity objects. Ask what fields editors need to manage, not what CSS classes exist.
- Use variant fields only when variants are editorially meaningful and stable, such as `tone`, `emphasis`, or `layoutIntent`.
- Every array item written via the API needs a stable `_key` (Studio adds keys in the UI; the API does not). Applies to references, page sections, nav items, and tag lists.
- Nest SEO fields exactly as the schema expects (`seo.metaTitle`, not top-level) — wrong paths are silently accepted by the API and then silently absent in Studio.

## Import Order

Sanity validates references on write, so use a two-pass import rather than trying to topologically sort every dependency:

1. Export and clean CMS collection data (CSV normalization if applicable).
2. Upload assets and build `asset-map.json` first — documents that reference assets need them to exist.
3. **Pass 1:** create every document with `createOrReplace` and deterministic IDs, writing unresolved references as placeholders with `_weak: true` (weak references bypass integrity checks, so the API accepts them before targets exist). Order pass 1 leaf-collections-first — categories, tags, authors, locations, and other referenced records before the collections that reference them — so most refs resolve immediately. Write `id-map.json` as you go.
4. **Pass 2:** patch each placeholder using `id-map.json`, swapping in the real `_ref` and removing `_weak`.
5. Seed static-page and page-builder sections (needs `id-map.json` so their references resolve).
6. Generate `url-map.json` from `id-map.json` plus the pages list, then re-run the import so internal rich-text links become document references; re-run the reference-resolve pass after every re-import.

For collections over roughly 1,000 items, use `@sanity/import` with pre-assigned IDs instead of sequential `client.create()` calls.

## Static Page and Page Builder Workflow

Before analyzing exported static HTML, inventory Webflow Components in the Designer:

- Component name.
- Variants.
- Pages where each component appears.
- Whether the component is reusable content, layout only, or a one-off section.

This inventory is not recoverable from exported HTML. Use it alongside static-page HTML and the DOM API when designing Sanity page-builder objects.

Classify pages before writing schemas:

- **Simple stacked sections** → a page document with a page-builder `sections` array.
- **Split layouts** → a dedicated document type per pattern, with separate `mainContent` and `sidebarContent` arrays rather than one flat field.
- **CMS-collection-driven pages** (a fixed template rendering a collection record, same sidebar/CTA on every page) → no page document at all; the collection type is the content and the layout is a frontend template.
- **Custom or complex pages** → one singleton document type per page, content fields only, layout hardcoded in the frontend.

Then, for page-builder pages:

1. Identify distinct section patterns before writing schemas.
2. Group visually similar structures and note where variants differ.
3. Decide whether each pattern is a page-builder object, a singleton page field, a reference to a reusable document, or frontend-only layout.
4. Add variant fields only for stable editorial choices; do not encode CSS classes as schema names.

A useful analysis prompt for agents:

```text
Identify all distinct content section patterns in this Webflow HTML. Group visually similar structures together, note where variants differ, and propose semantic Sanity fields for each section. Do not copy CSS class names into schema names.
```

## Cutover

Build a URL map before launch:

- Use the Pages API list (every page's slug + SEO metadata) as the inventory of old routes; add CMS item pages (collection URL prefix + item slug) and static pages. No sitemap XML export needed.
- Map unchanged slugs 1:1; only changed slugs need redirects.
- Create 301 redirects for renamed, consolidated, or retired pages — e.g. a `vercel.json` `redirects` array with `"permanent": true`. On Enterprise plans fetch the existing list from `GET /v2/sites/{siteId}/redirects`; otherwise export the CSV from Site Settings > SEO > Redirects.
- Forms do not migrate — they are a full replacement (Formspree, HubSpot, or a custom API route). Use `forms.json` as the field spec; export submission history via `GET /v2/forms/{formId}/submissions` if you need it retained.
- Move analytics, consent, chat, and A/B testing scripts into the frontend layout, not Sanity.
- Generate `sitemap.xml` and `robots.txt` on the new stack (e.g. next-sitemap). Check canonical URLs, Open Graph images, and high-value inbound links.
- Lower DNS TTL to ~300s at least 24h before cutover; after cutover, watch the 404 rate for the first 24h and fix redirect gaps immediately. Keep the Webflow staging URL live for a couple of weeks for visual QA.

Missing redirects are the most common Webflow-to-Sanity SEO regression.

## Gotchas

- Webflow HTML export loses component metadata, variants, and designer intent.
- CMS reference fields export opaque item IDs; do not assume names or slugs are enough for reliable joins.
- The Webflow Assets API only covers the Site Assets panel; CMS-field and rich-text images must be scraped from data and HTML.
- Rich text exports as HTML strings and may include embedded Webflow-specific markup.
- Sanity rejects references to non-existent targets on write — use `_weak: true` placeholders in pass 1, then resolve.
- Array items written via the API need `_key`, or Studio shows "Missing keys on array items" and may block publishing.
- Webflow-hosted assets break after cutover — do not leave production content dependent on Webflow CDN URLs.
- Webflow forms, interactions, memberships, e-commerce, and custom code usually require separate frontend or service replacement.
- Static pages may contain content that should become structured documents rather than page-builder sections.
- The Data API rate-limits; honor `429` and its `retry-after` header on large fetches.

## Validation Checklist

- Compare imported document counts to Webflow collection item counts, per collection.
- Confirm every single- and multi-reference field resolves to a Sanity reference, with no `_weak: true` placeholders or `wf_*` refs left behind.
- Spot-check rich text fields with links, images, lists, and embeds.
- Confirm all Webflow CDN asset URLs have Sanity replacements or intentional external handling.
- Confirm every array field has a `_key` on each item.
- Confirm SEO fields landed at their expected nested paths, not the top level.
- Review the component inventory with a human before finalizing page-builder schemas.
- Crawl old Webflow URLs and verify a new page or a 301 redirect for each.
