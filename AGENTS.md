# Sanity Project

This is a Sanity-powered project. Use the Knowledge Router below to find Sanity guidance for your task.

## Commands

```bash
# MCP Setup
npx sanity@latest mcp configure  # Configure MCP for your AI editor

# Schema & Types
npx sanity schema deploy     # Deploy schema to Content Lake (REQUIRED before MCP!)
npx sanity schema extract    # Extract schema for TypeGen
npx sanity typegen generate  # Generate TypeScript types

# Development
npx sanity dev               # Start Studio dev server
npx sanity build             # Build Studio for production
npx sanity deploy            # Deploy Studio to Sanity hosting

# Help
npx sanity docs search "query"  # Search Sanity documentation
npx sanity --help               # List all CLI commands
```

## Knowledge Router

If the Sanity MCP server (`https://mcp.sanity.io`) is available, use `list_sanity_rules` and `get_sanity_rules` to load always up-to-date rules on demand. Otherwise, use the table below to find local rule files.

| Topic | Trigger Keywords | Rule File |
| :--- | :--- | :--- |
| **Project Structure** | `structure`, `monorepo`, `embedded studio`, `file naming` | `rules/sanity-project-structure.mdc` |
| **Onboarding** | `start`, `setup`, `init`, `new project` | `rules/sanity-get-started.mdc` |
| **Schema** | `schema`, `model`, `document`, `field`, `defineType` | `rules/sanity-schema.mdc` |
| **Deprecation** | `deprecate`, `remove field`, `legacy`, `migration` | `rules/sanity-schema.mdc` |
| **Import/Migration** | `import`, `wordpress`, `html`, `markdown`, `migrate` | `rules/sanity-migration.mdc` |
| **Next.js** | `next.js`, `app router`, `server component`, `fetch` | `rules/sanity-nextjs.mdc` |
| **Nuxt** | `nuxt`, `vue`, `nuxt.js` | `rules/sanity-nuxt.mdc` |
| **Astro** | `astro`, `islands` | `rules/sanity-astro.mdc` |
| **Remix/React Router** | `remix`, `react router`, `loader` | `rules/sanity-remix.mdc` |
| **Svelte** | `svelte`, `sveltekit`, `kit` | `rules/sanity-svelte.mdc` |
| **Visual Editing** | `stega`, `visual editing`, `clean`, `overlay`, `presentation`, `usePresentationQuery` | `rules/sanity-visual-editing.mdc` |
| **Page Builder** | `page builder`, `pageBuilder`, `block component`, `alignment`, `switch render` | `rules/sanity-page-builder.mdc` |
| **Rich Text** | `portable text`, `rich text`, `block content`, `serializer`, `PTE`, `marks`, `annotations` | `rules/sanity-portable-text.mdc` |
| **Images** | `image`, `urlFor`, `crop`, `hotspot`, `lqip` | `rules/sanity-image.mdc` |
| **Studio Structure** | `structure`, `desk`, `sidebar`, `singleton`, `grouping` | `rules/sanity-studio-structure.mdc` |
| **Localization** | `i18n`, `translation`, `localization`, `language`, `multilingual`, `localized singleton` | `rules/sanity-localization.mdc` |
| **SEO** | `seo`, `metadata`, `sitemap`, `og image`, `open graph`, `json-ld`, `redirect` | `rules/sanity-seo.mdc` |
| **Shopify/Hydrogen** | `shopify`, `hydrogen`, `e-commerce`, `storefront`, `sanity connect` | `rules/sanity-hydrogen.mdc` |
| **GROQ** | `groq`, `query`, `defineQuery`, `projection`, `filter`, `order` | `rules/sanity-groq.mdc` |
| **TypeGen** | `typegen`, `typescript`, `types`, `infer`, `satisfies`, `type generation` | `rules/sanity-typegen.mdc` |
| **Blueprints** | `blueprints`, `infrastructure`, `IaC`, `defineBlueprint`, `stack`, `function` | `rules/sanity-blueprints.mdc` |

### Using the Knowledge Router

**Before modifying any code:**
1. Identify which topics from the table above apply to your task
2. Read the corresponding rule file(s) using the file path
3. Follow the patterns and constraints defined in those rules

Example: If asked to "create a blog post schema", read `rules/sanity-schema.mdc` first.

## Agent Behavior

- Specialize in **Structured Content**, **GROQ**, and **Sanity Studio** configuration.
- Write best-practice, type-safe code using **Sanity TypeGen**.
- Build scalable content platforms, not just websites.
- **Detect the user's framework** from `package.json` and consult the appropriate rule file.

## MCP Server (Preferred for Content Operations)

**ALWAYS** use MCP tools instead of writing scripts:

| Tool | Use For |
|------|---------|
| `query_documents` | Run GROQ queries |
| `create_document_from_markdown` | Create content from markdown |
| `patch_document` | Modify existing documents |
| `deploy_schema` | Deploy schema to Content Lake |
| `get_schema` | Inspect deployed schema |
| `transform_image` | Edit images with AI |

**Critical:** After schema changes, deploy with `deploy_schema` before using content tools.

## Boundaries
- **Always:**
  - Use `defineQuery` for all GROQ queries.
  - Use MCP tools for content operations (query, create, update, patch).
  - Run `deploy_schema` after schema changes — required before using content tools. If a local Studio exists, update schema files first to keep them in sync with the deployed schema.
  - Follow the "Deprecation Pattern" when removing fields (ReadOnly -> Hidden -> Deprecated).
  - Run `npm run typegen` after schema or query changes.
- **Ask First:**
  - Before modifying `sanity.config.ts`.
  - Before deleting any schema definition file.
- **Never:**
  - Hardcode API tokens (use `process.env`).
  - Use loose types (`any`) for Sanity content.
  - Generate NDJSON import scripts for simple content tasks (use MCP).
