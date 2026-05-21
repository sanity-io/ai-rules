---
title: React Router (Remix) & Sanity Integration Rules
description: Integration guide for React Router v7 (and Remix v2) with Sanity, including loaders and visual editing.
---

# React Router (Remix) & Sanity Integration Rules

## Version Note

The primary examples below use **React Router v7** (the current shape — Remix v2 was renamed to React Router v7 starting with the v7 release). Import paths and the route-types file (`./+types/<route>`) come from the `react-router` package and the framework's typegen.

If you are on the older **Remix v2** stack, the integration shape is identical; only the import paths differ:

| React Router v7 | Remix v2 |
|-----------------|----------|
| `react-router` | `@remix-run/node` / `@remix-run/react` |
| `import type { Route } from "./+types/<route>"` | `import type { LoaderFunctionArgs } from "@remix-run/node"` + `useLoaderData<typeof loader>()` |
| `react-router.config.ts` | `remix.config.js` |

## 1. Setup & Client Pattern

### Scaffold a new React Router v7 app

```bash
npx create-react-router@latest my-app -y
cd my-app
npm install @sanity/client @sanity/react-loader @sanity/visual-editing @portabletext/react groq
```

`-y` accepts defaults. The Sanity packages cover server loaders (`@sanity/react-loader`, `@sanity/client`), live preview (`@sanity/visual-editing`), Portable Text rendering (`@portabletext/react`), and typed queries (`groq`).

To support both server-side fetching and client-side live previews, use the **Split Loader Pattern**.

### A. Shared Loader (`app/sanity/loader.ts`)
Defines the store config (SSR enabled, client deferred).

```typescript
import { createQueryStore } from '@sanity/react-loader'

export const {
  loadQuery,
  setServerClient,
  useQuery,
  useLiveMode,
} = createQueryStore({ client: false, ssr: true })
```

### B. Server Loader (`app/sanity/loader.server.ts`)
Initializes the server client.

```typescript
import { createClient } from '@sanity/client'
import { loadQuery, setServerClient } from './loader'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  useCdn: true,
  apiVersion: '2026-02-01',
  stega: {
    // Stega encodes invisible markers into string fields for click-to-edit
    // overlays in the Presentation tool. Those markers can leak into copy/paste,
    // screen readers, and some downstream renderers, so only enable when actually
    // previewing — gate on an env var that's only set in preview environments.
    enabled: Boolean(process.env.SANITY_STUDIO_URL),
    studioUrl: process.env.SANITY_STUDIO_URL,
  },
})

setServerClient(client)

export { loadQuery }
```

### C. Queries (`app/sanity/queries.ts`)
Keep query definitions in one place so route loaders, components, and TypeGen all read the same source.

```typescript
import { defineQuery } from "groq";

export const POSTS_QUERY = defineQuery(
  `*[_type == "post" && defined(slug.current)] | order(_createdAt desc){
    _id, title, slug
  }`
);

export const POST_QUERY = defineQuery(
  `*[_type == "post" && slug.current == $slug][0]{
    _id, title, body, image
  }`
);
```

## 2. Data Fetching (Loaders)

Use `loadQuery` from your **server** file in route loaders. Import the generated `Route` type from `./+types/<route>` — React Router writes one type module per route file.

```typescript
// app/routes/home.tsx
import type { Route } from "./+types/home";
import { loadQuery } from "~/sanity/loader.server";
import { POSTS_QUERY } from "~/sanity/queries";

export async function loader() {
  const initial = await loadQuery(POSTS_QUERY, {});
  return { initial, query: POSTS_QUERY, params: {} };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { initial } = loaderData;
  // …pass to component
}
```

For Remix v2: replace `Route.ComponentProps` / `Route.LoaderArgs` with `useLoaderData<typeof loader>()` and `LoaderFunctionArgs` from `@remix-run/node`.

## 3. Dynamic Routes (`:slug`)

Register the dynamic route in `app/routes.ts`:

```typescript
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(":slug", "routes/post.tsx"),
] satisfies RouteConfig;
```

Then in `app/routes/post.tsx`:

```typescript
import type { Route } from "./+types/post";
import { PortableText } from "@portabletext/react";
import { loadQuery } from "~/sanity/loader.server";
import { useQuery } from "~/sanity/loader";
import { POST_QUERY } from "~/sanity/queries";

export async function loader({ params }: Route.LoaderArgs) {
  const initial = await loadQuery(POST_QUERY, { slug: params.slug });
  return { initial, query: POST_QUERY, params: { slug: params.slug } };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { initial, query, params } = loaderData;
  const { data: post } = useQuery(query, params, { initial });

  return (
    <article>
      <h1>{post?.title}</h1>
      {post?.body && <PortableText value={post.body} />}
    </article>
  );
}
```

## 4. Real-time Preview & Visual Editing

### A. Use `useQuery` in Components
Import `useQuery` from your **shared** loader file.

```typescript
import { useQuery } from "~/sanity/loader";

export default function Page({ loaderData }: Route.ComponentProps) {
  const { initial, query, params } = loaderData;

  const { data, encodeDataAttribute } = useQuery(query, params, { initial });

  return (
    <h1 data-sanity={encodeDataAttribute("title")}>
      {data?.title}
    </h1>
  );
}
```

### B. Enable Live Mode (`VisualEditing.tsx`)
Create a component to handle the connection.

```typescript
import { enableVisualEditing } from '@sanity/visual-editing'
import { useLiveMode } from '~/sanity/loader'
import { client } from '~/sanity/client' // Your browser-safe client
import { useEffect } from 'react'

export default function VisualEditing() {
  useEffect(() => enableVisualEditing(), [])
  useLiveMode({ client })
  return null
}
```

Render this component in `root.tsx` only when valid (e.g., check env vars or user session).

## 5. Stega Cleaning
When using data for logic (routing, classNames), use `stegaClean`.

```typescript
import { stegaClean } from "@sanity/client/stega"
// ...
if (stegaClean(slug) === 'home') { ... }
```
