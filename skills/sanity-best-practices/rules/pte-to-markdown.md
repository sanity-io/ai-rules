---
title: Convert Between Portable Text and Markdown
description: Use @portabletext/markdown for bidirectional conversion between Portable Text and Markdown
tags: portable-text, markdown, ai, content-negotiation, rendering, migration
---

## Convert Between Portable Text and Markdown

Use `@portabletext/markdown` for bidirectional conversion between Portable Text and Markdown. This enables AI-friendly content routes, Markdown-based content ingestion, documentation exports, and multi-format delivery.

### Setup

```bash
npm install @portabletext/markdown
```

### Portable Text → Markdown

```typescript
import {portableTextToMarkdown} from '@portabletext/markdown'

const markdown = portableTextToMarkdown([
  {
    _type: 'block',
    _key: 'f4s8k2',
    style: 'h1',
    children: [{_type: 'span', _key: 'a9c3x1', text: 'Hello ', marks: []},
               {_type: 'span', _key: 'b7d2m5', text: 'world', marks: ['strong']}],
    markDefs: [],
  },
])
// # Hello **world**
```

Standard blocks, marks, and lists are handled automatically:

| Portable Text | Markdown |
|---------------|----------|
| `style: 'h1'`–`'h6'` | `#`–`######` |
| `marks: ['strong']` | `**bold**` |
| `marks: ['em']` | `_italic_` |
| `marks: ['code']` | `` `code` `` |
| `marks: ['strike-through']` | `~~text~~` |
| Link annotation | `[text](url)` |
| Bullet list | `- item` |
| Number list | `1. item` |
| Blockquote | `> text` |

#### Custom Renderers

Handle custom block types with renderer functions. The library exports default renderers for common types:

```typescript
import {
  portableTextToMarkdown,
  DefaultCodeBlockRenderer,
  DefaultImageRenderer,
  DefaultHorizontalRuleRenderer,
  DefaultTableRenderer,
} from '@portabletext/markdown'

const markdown = portableTextToMarkdown(blocks, {
  // Built-in renderers for standard block objects
  types: {
    'code': DefaultCodeBlockRenderer,           // {code, language?} → fenced code block
    'image': DefaultImageRenderer,              // {src, alt?, title?} → ![alt](src)
    'horizontal-rule': DefaultHorizontalRuleRenderer, // → ---
    'table': DefaultTableRenderer,              // {rows, headerRows?} → markdown table
  },
})
```

For custom types, write your own renderer:

```typescript
const markdown = portableTextToMarkdown(blocks, {
  types: {
    // Custom callout block
    callout: ({value}) => `> **${value.title}**\n> ${value.text}`,

    // Sanity image with CDN URL
    image: ({value, isInline}) => {
      if (isInline) return ''
      const url = imageUrlBuilder(client).image(value.asset).url()
      return `![${value.alt || ''}](${url})`
    },
  },

  // Override block style rendering
  block: {
    h1: ({children}) => `# ${children} #`,
  },

  // Override mark rendering
  marks: {
    internalLink: ({value, children}) => `[${children}](${value.href})`,
  },
})
```

Renderers receive contextual props:
- **Block renderers** (`block.*`): `{value, children, index}`
- **Mark renderers** (`marks.*`): `{value, children, text, markType, markKey}`
- **Type renderers** (`types.*`): `{value, index, isInline}`

### Markdown → Portable Text

```typescript
import {markdownToPortableText} from '@portabletext/markdown'

const blocks = markdownToPortableText('# Hello **world**')
// Returns valid Portable Text blocks with _type, _key, children, markDefs
```

The conversion respects a schema and uses matchers to map Markdown elements to Portable Text types.

#### With a Sanity Schema

Use `@portabletext/sanity-bridge` to convert your Sanity schema:

```typescript
import {markdownToPortableText} from '@portabletext/markdown'
import {sanitySchemaToPortableTextSchema} from '@portabletext/sanity-bridge'

const schema = sanitySchemaToPortableTextSchema(sanityBlockArraySchema)
const blocks = markdownToPortableText(markdown, {schema})
```

#### Custom Matchers

Control how Markdown elements map to your schema types:

```typescript
import {markdownToPortableText} from '@portabletext/markdown'
import {compileSchema, defineSchema} from '@portabletext/schema'

const blocks = markdownToPortableText(markdown, {
  schema: compileSchema(
    defineSchema({
      styles: [{name: 'normal'}, {name: 'heading 1'}],
    }),
  ),
  block: {
    h1: ({context}) => {
      const style = context.schema.styles.find((s) => s.name === 'heading 1')
      return style?.name
    },
  },
})
```

### Next.js Markdown Route Handler

Serve content as Markdown via a route handler:

```typescript
// app/docs/[slug]/markdown/route.ts
import {NextRequest, NextResponse} from 'next/server'
import {portableTextToMarkdown, DefaultCodeBlockRenderer} from '@portabletext/markdown'
import {client} from '@/sanity/lib/client'

export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{slug: string}>},
) {
  const {slug} = await params
  const doc = await client.fetch(
    `*[_type == "article" && slug.current == $slug][0]{
      title, "slug": slug.current, description, body
    }`,
    {slug},
  )

  if (!doc) return new NextResponse('Not found', {status: 404})

  const body = portableTextToMarkdown(doc.body, {
    types: {code: DefaultCodeBlockRenderer},
  })

  const parts = [`# ${doc.title}`, '']
  if (doc.description) parts.push(doc.description, '')
  parts.push('---', '', body)

  return new NextResponse(parts.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  })
}
```

### Why This Matters

- **AI agents** parse Markdown far more reliably than HTML
- **Content ingestion** — import Markdown docs directly into Portable Text
- **Bidirectional** — one library handles both directions
- **Schema-aware** — respects your content model in both directions
- **No content duplication** — one Portable Text source, multiple outputs

Reference: [Markdown Routes with Next.js](https://www.sanity.io/learn/course/markdown-routes-with-nextjs) · [Package README](https://github.com/portabletext/editor/tree/main/packages/markdown)
