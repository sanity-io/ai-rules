---
title: Import HTML to Portable Text
description: Use @portabletext/block-tools with JSDOM to convert HTML content
---

## Import HTML to Portable Text

Use `@portabletext/block-tools` with `JSDOM` to convert HTML from legacy CMSs to Portable Text.

### Setup

```bash
npm install @portabletext/block-tools jsdom
```

### Basic Conversion

```typescript
import { htmlToBlocks } from '@portabletext/block-tools'
import { JSDOM } from 'jsdom'

// Get block content type from your schema
const blockContentType = schema.get('blockContent')

const blocks = htmlToBlocks(htmlString, blockContentType, {
  parseHtml: html => new JSDOM(html).window.document,
})
```

### Custom Deserializers

Handle specific HTML patterns:

```javascript
const blocks = htmlToBlocks(htmlString, blockContentType, {
  parseHtml: html => new JSDOM(html).window.document,
  rules: [
    {
      deserialize(el, next, block) {
        // Custom link handling — links are inline annotations, not blocks.
        // Return an `__annotation` with a `markDef`, and recurse into the
        // child nodes via `next()` so the link text is preserved.
        if (el.tagName?.toLowerCase() === 'a') {
          const href = el.getAttribute('href')
          // An anchor with no `href` (named anchors, JS-driven links) isn't a
          // link. Fall through so the text survives without a dangling markDef.
          if (!href) return undefined
          return {
            _type: '__annotation',
            markDef: {
              _type: 'link',
              href,
              blank: el.getAttribute('target') === '_blank'
            },
            children: next(el.childNodes)
          }
        }
        // Custom image handling — block-level types are wrapped with `block()`
        if (el.tagName?.toLowerCase() === 'img') {
          const src = el.getAttribute('src')
          // Skip sourceless images rather than emitting `image@null`, which
          // the importer reports as a failed asset with no pointer to the node.
          if (!src) return undefined
          return block({
            _type: 'image',
            // NDJSON + `sanity datasets import` only — see the note below.
            _sanityAsset: `image@${src}`
          })
        }
        return undefined  // Fall through to default handling
      }
    }
  ]
})
```

> **`_sanityAsset` is only resolved by `sanity datasets import`.** The NDJSON
> importer fetches each `image@<url>` and swaps in a real asset reference. The
> mutation API does not interpret the directive, so the same blocks written
> through `@sanity/client`, `sanity exec`, or `defineMigration` are stored
> verbatim — leaving an image field with a stray `_sanityAsset` string and no
> `asset` reference. On those paths, upload the image first and emit an asset
> reference instead, as in [Image Upload](#image-upload) below.

### Pre-Processing HTML

Clean HTML before conversion:

```javascript
function cleanHtml(html) {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  
  // Remove layout elements
  doc.querySelectorAll('header, footer, nav, .sidebar').forEach(el => el.remove())
  
  // Extract metadata before processing body
  const title = doc.querySelector('title')?.textContent
  const description = doc.querySelector('meta[name="description"]')?.content
  
  return {
    body: doc.body.innerHTML,
    metadata: { title, description }
  }
}
```

### Image Upload

Don't just link external images—upload them:

```javascript
async function uploadImage(client, imageUrl) {
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()
  
  const asset = await client.assets.upload('image', Buffer.from(buffer), {
    filename: imageUrl.split('/').pop()
  })
  
  return {
    _type: 'image',
    asset: { _type: 'reference', _ref: asset._id }
  }
}
```

### Using in a Migration

Wrap this in `defineMigration` for controlled imports. This path writes through
the mutation API, so any custom rules used here must emit uploaded asset
references rather than `_sanityAsset` directives:

```typescript
// migrations/import-wordpress-posts/index.ts
import {defineMigration, create} from 'sanity/migrate'
import {htmlToBlocks} from '@portabletext/block-tools'

export default defineMigration({
  title: 'Import WordPress posts',
  async *migrate(documents, context) {
    const posts = await fetchWordPressPosts() // Your import source
    
    for (const post of posts) {
      const blocks = htmlToBlocks(post.content, blockContentType, {
        parseHtml: html => new JSDOM(html).window.document,
      })
      
      yield create({
        _type: 'post',
        title: post.title,
        slug: {_type: 'slug', current: post.slug},
        legacyId: String(post.id),
        body: blocks,
      })
    }
  }
})
```

Let Sanity generate document IDs for ordinary imported content. Add schema fields for legacy identifiers or slugs, then use GROQ lookups against those fields when you need to rerun an import, patch existing documents, or create references between imported records. Set `_id` directly only for singleton documents.

Run with: `sanity migrations run import-wordpress-posts --no-dry-run`

Reference: [Schema and Content Migrations](https://www.sanity.io/docs/content-lake/schema-and-content-migrations)
