---
title: Nuxt & Sanity Integration Rules
description: Integration guide for Nuxt, including @nuxtjs/sanity, visual editing, and data fetching.
---

# Nuxt & Sanity Integration Rules

## 1. Setup & Configuration

### Scaffold a new Nuxt app

```bash
npm create nuxt@latest my-app -- -t ui -M "" --packageManager npm --no-gitInit
cd my-app
```

`-t ui` selects the Nuxt UI starter. `-M ""` skips the interactive module-selection prompt (empty string = no extra modules). `--packageManager npm` and `--no-gitInit` suppress the other two prompts so the scaffold runs end-to-end without input.

### Installation

```bash
npx nuxi@latest module add sanity
npm install @sanity/image-url groq
```

`nuxi module add sanity` resolves to the official `@nuxtjs/sanity` module and registers it in `nuxt.config.ts` automatically. `@sanity/image-url` builds image URLs. `groq` provides the `groq` template tag used by the examples below.

### Configuration (`nuxt.config.ts`)
Use the official `@nuxtjs/sanity` module.

**Important:** Ensure the `minimal` client is NOT enabled if you want full features.

```typescript
export default defineNuxtConfig({
  modules: ["@nuxtjs/sanity"],
  sanity: {
    projectId: process.env.NUXT_SANITY_PROJECT_ID,
    dataset: process.env.NUXT_SANITY_DATASET,
    apiVersion: "2026-02-01",
    // Live Visual Editing Configuration
    visualEditing: {
      studioUrl: process.env.NUXT_SANITY_STUDIO_URL,
      token: process.env.NUXT_SANITY_API_READ_TOKEN, // Required for fetching drafts
      stega: true, // Enable stega for visual editing
      mode: 'live-visual-editing', // Default: enables live updates
    },
  },
});
```

## 2. Data Fetching

### `useSanityQuery`
Use the composable provided by the module for reactive fetching. It automatically handles preview state when configured.

```vue
<!-- app/pages/posts.vue -->
<script setup lang="ts">
const query = groq`*[_type == "post" && defined(slug.current)]{ _id, title, slug }`
const { data: posts } = await useSanityQuery<Array<{ _id: string; title?: string; slug?: { current?: string } }>>(query)
</script>

<template>
  <ul>
    <li v-for="post in posts || []" :key="post._id">
      <NuxtLink :to="`/${post.slug?.current}`">{{ post.title }}</NuxtLink>
    </li>
  </ul>
</template>
```

### Dynamic Routes (`[slug].vue`)

Pull the slug off `useRoute()` and pass it as a query parameter. The `<SanityContent>` component (provided by `@nuxtjs/sanity`) renders Portable Text — note the prop is `value`, not `blocks` (renamed in v2).

```vue
<!-- app/pages/[slug].vue -->
<script setup lang="ts">
const route = useRoute()
const query = groq`*[_type == "post" && slug.current == $slug][0]{ _id, title, body }`
const { data: post } = await useSanityQuery<{ _id: string; title?: string; body?: unknown[] }>(
  query,
  { slug: route.params.slug }
)
</script>

<template>
  <article v-if="post">
    <h1>{{ post.title }}</h1>
    <SanityContent v-if="post.body" :value="post.body" />
  </article>
</template>
```

## 3. Visual Editing (Live Preview)

### Automatic Setup
When `visualEditing` is configured in `nuxt.config.ts`, the module handles:
1.  Injecting the Visual Editing overlays.
2.  Refreshing data when content changes in the Studio.
3.  Enabling Stega encoding.

### Handling Stega in Logic
Just like Next.js, if you use stega-encoded strings in logic (e.g. `v-if="post.layout === 'full'"`), you must clean them.

```typescript
import { stegaClean } from "@sanity/client/stega";

const layout = computed(() => stegaClean(props.layout));
```

## 4. Components

### Portable Text
Use the `<PortableText>` component (if installed via `@portabletext/vue` or provided by the module).

```vue
<PortableText :value="post.body" :components="customComponents" />
```

### Images
Use `@sanity/image-url` helper or a dedicated image component.

```typescript
import imageUrlBuilder from '@sanity/image-url'
const builder = imageUrlBuilder(useSanity().client)
// ... url generation logic
```
