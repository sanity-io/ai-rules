# Major boundary knowledge

```
LAST_VERIFIED:            2026-09-04
BOUNDARIES_COVERED:       v3→v4, v4→v5, v5→v6
WITHIN_LINE_VERIFIED_FROM: sanity 4.0.0
WITHIN_LINE_VERIFIED_THROUGH: sanity 6.12.0
UPSTREAM_CHANGELOG_STARTS: sanity 3.91.0   ← see "the v3 line" below
```

**This file has two edges, and both matter.** Treat it as a cache with known limits, not as a complete list.

**Above the upper bound.** Anything released after `WITHIN_LINE_VERIFIED_THROUGH` is unknown here. Fetch the changelog for that remainder. This edge decays continuously: a new `sanity` minor ships most weeks, so assume it is stale and check rather than trusting the date above.

**Below the lower bound.** The major *boundary* sections below cover every crossing from v3 onward. The **within-line** sections start at 4.0.0. A project starting below that is inside the v3 line, which this file does not curate release by release, for the reason in the next paragraph.

So if the current version is below `WITHIN_LINE_VERIFIED_FROM`, **fetch what you can for the range from the current version up to that lower bound**, and read the rest of this note before reporting the result. A project on 3.76 crossing to 6.12 needs one fetch at the bottom, 3.76 to 4.0.0, and none at the top while the upper bound is current.

**The v3 line, and why its gap is different from an ordinary gap.** The upstream `CHANGELOG.md` in `sanity-io/sanity` begins at 3.91.0. There is no consolidated machine-readable changelog for 3.0.0 through 3.90.x in that repository, and the tagged trees for those releases do not contain the file either. So for a project starting mid-v3, the fetch instruction above **will come back thin, and thin is not clean.**

This is the one place where an empty result must never be reported as a finding. Say plainly that the release-by-release history for that range is not available from the changelog, that the v3→v4 boundary section below is verified while the interior of the v3 line is not, and put the residual risk in the human questions section. A project crossing the whole v3 line to v6 is dominated by the boundary changes and the curated v4, v5 and v6 line items anyway, so this gap is survivable when it is declared. It is only dangerous when it is silent.

The failure this whole note prevents: without the lower bound declared, an agent trusts the file for a range it never examined and reports "nothing in this boundary applies," which reads as a verified finding and is actually an unexamined gap. **Never assert that a range is clean unless it falls inside the two bounds above or you fetched it yourself and got real content back.**

Fetch instructions are in `version-lookup.md`.

Read only the sections for boundaries the project actually crosses.

Each item carries an applicability condition. If the condition cannot be evaluated from the repository, the item belongs in the human questions section of the report, not in the findings.

## Contents

1. Why minor releases matter as much as majors
2. v3 to v4
3. Within the v4 line
4. v4 to v5
5. Within the v5 line
6. v5 to v6
7. Within the v6 line
8. Cross-cutting deprecations

Studio v2 is out of scope. See the scope section of `SKILL.md`; detection and the stop behavior live there and in `detect.md`.

---

## 1. Why minor releases matter as much as majors

Across the whole span from 4.0.0 to 6.12.0, exactly three releases carried a formal breaking-change footer: 4.0.0, 5.0.0 and 6.0.0. Everything else in sections 3, 5 and 7 below shipped in a minor or patch release as a removal, a deprecation, or a changed default, without a breaking-change label.

The sharpest example is in section 3. The `engines.node` field changed shape four times inside the v4 line, and one of those changes made a minor release refuse to install on the Node version its own boundary guide told you to be on. Nothing about that carried a breaking-change label.

This is the single most useful thing this file contains, because nobody reads forty sets of minor release notes. When you fetch the changelog for the remainder of the span, look for the same pattern rather than only checking major boundaries.

---

## 2. v3 to v4

A deliberately small boundary. The official guide describes it as requiring minimal, if any, application changes.

| Change | Applicability condition |
| --- | --- |
| **Node.js 20.19 becomes the minimum.** `engines.node` goes from `>=18` on the v3 line to `>=20.19` at 4.0.0. | Check `engines.node`, `.nvmrc`, CI runner images, and the build host. Applies if any run Node 18, or Node 20 earlier than 20.19. |

**The patch component is not a detail to round off.** The floor is 20.19, not 20. A project on Node 20.9 satisfies "Node 20" and still fails to install. Read the resolved Node version to its patch and compare it to the range, rather than comparing majors.

The boundary itself is otherwise additive. **But do not carry "everything else in v4 is additive" into the v4 line**, which is what the official guide's framing invites and what section 3 exists to correct: the Node floor moves twice more inside the line, and several defaults change.

Source: `https://www.sanity.io/docs/help/v3-to-v4`

---

## 3. Within the v4 line

Shipped in minor releases. None of this carried a breaking-change label, and the boundary guide's "minimal, if any, application changes" framing does not cover it.

### The Node floor moves twice inside the line

This is the highest-value item in the section, because it breaks an upgrade that followed the boundary guide correctly. Verified two ways: the `engines.node` field read from the registry manifest for each release, then each range evaluated with `semver.satisfies` rather than by eye.

| Releases | `engines.node` | Accepts | Rejects |
| --- | --- | --- | --- |
| 4.0.0 to 4.3.x | `>=20.19` | 20.19 and newer | below 20.19, so Node 20.9 fails |
| **4.4.0 only** | `>=20.19 >=22.12.0` | **22.12 and newer, and nothing else** | 20.19, 21.x, 22.0 to 22.11 |
| 4.5.0 to 4.22.1, and the whole v5 line | `>=20.19 <22 \|\| >=22.12` | 20.19 through 21.x, plus 22.12 and newer | below 20.19, and **22.0 through 22.11** |

**4.4.0's range is an accident.** Two space-separated comparators are an AND in semver, so `>=20.19 >=22.12.0` collapses to `>=22.12.0` and the 20.19 clause is dead. A project on Node 20.19 installs 4.3.0 fine and cannot install 4.4.0. 4.5.0 fixed it.

Applicability: read the resolved Node version for local, CI, and the build host, then check it against the row for the stop being planned, not against the row for the target.

Two consequences worth stating in the plan:

- **A stop inside 4.4.0 is the wrong stop.** If a sequence lands there, move it to 4.5.0 or later. There is no reason to stop on the one release with a malformed range.
- **Node 22.0 through 22.11 is a dead band** from 4.5.0 all the way through the v5 line. It is easy to miss because it sits *above* the floor most people remember, so a team that upgraded Node to "22" to get ahead of the v6 requirement can land inside it and be rejected by releases that Node 21 installs fine. The fix is the same 22.12 move v6 needs anyway.

**Evaluate these ranges, do not read them.** `>=20.19 <22 || >=22.12` looks at a glance like it excludes Node 21, and it does not: `>=20.19 <22` accepts all of 21.x. Getting that backwards produces a confident, specific, wrong instruction to change a Node version that was already fine. One line settles it:

```sh
node -e "console.log(require('semver').satisfies('21.7.3','>=20.19 <22 || >=22.12'))"
```

### Defaults that changed

| Version | Change | Applicability condition |
| --- | --- | --- |
| 4.14.0 | **`scheduledDrafts` config option added, on by default.** | Applies to every project crossing this release. Relevant alongside the scheduled publishing deprecation in section 8: a project that deliberately avoided scheduled publishing gets scheduled drafts switched on without asking. Confirm which behavior the team wants rather than assuming the default is fine. |
| 4.16.0 | **The `typography` plugin for Portable Text inputs was added and then disabled by default in the same release.** | Matters mainly as context for the v5 boundary, where the same behavior is turned **on** by default. See section 4. A project crossing 4.16 to 4.22 saw straight quotes preserved; the v5 bump silently reverses that. |
| 4.16.0, then 4.18.0 | **`enhancedObjectDialog` default flipped on, reverted, then made opt-out.** | Only if the config sets `beta.form.enhancedObjectDialog`. The end state matters more than the churn: 5.12.0 removes the option and makes the dialog unconditional, per section 5. So a project holding the flag at `false` should plan for the dialog arriving regardless. |

### Removals and type changes

| Version | Change | Applicability condition |
| --- | --- | --- |
| 4.12.0 | **`useRawPerspective` removed** in favour of `perspective`. | `grep -rn "useRawPerspective" src/` |
| 4.6.0 | The `'strike'` and `'strike-through'` decorator names were disambiguated in the types. | Applies to Portable Text schemas that declare a strikethrough decorator, and to any code matching on the decorator name. Grep for both spellings. |
| 4.5.0 | **`image` data marked as required for TypeGen.** | Only if TypeGen is in use. Generated types for image fields change shape, so expect new type errors in consumers, which are often in another repository. |
| 4.20.0 | Internal `ServerStyleSheet` usage removed. | No action here. The related item that needs a code change is the removal of the re-export from `sanity` at 5.2.0, in section 5. |

### Notes

**4.22.1 is the final v4 release**, published under the `maintenance-v4` dist-tag. It is the right intermediate stop before v5, and it is a patch above the last minor, so do not stop at 4.22.0.

---

## 4. v4 to v5

Published 2025-12-15. Three declared breaking changes plus one default flip.

### Requirements

| Change | Applicability condition |
| --- | --- |
| **React 19.2.2 or newer required**, for both `react` and `react-dom`. | Read resolved React version from the lockfile. If already 19.2.2+, this is satisfied and should be stated as satisfied rather than listed as work. |

If the project is on React 18, recommend running `sanity dev` on React 18.3 first to clear deprecation warnings, and enabling `reactStrictMode: true` in `sanity.cli.ts` to surface effect-cleanup and concurrent-rendering issues before the React bump rather than after.

### Declared breaking changes

| Change | Applicability condition |
| --- | --- |
| **TypeGen re-cases `snake_case` query names.** `PAGE_QUERY` now yields `PAGE_QUERY_RESULT` rather than `PAGE_QUERYResult`; `page_query` yields `page_query_result`. camelCase and PascalCase are unaffected. | Only if TypeGen is in use. Check for `sanity.types.ts`, a `typegen` block, or `sanity typegen` in scripts. Then grep for `snake_case` query variable names. Note that consumers are often in a different repository. |
| **TypeGen hoists shared types.** Repeated object shapes and document references become standalone named types instead of being inlined at each use site. This changes the shape of `schema.json`, not only the generated TypeScript. | Applies to anything consuming `schema.json` programmatically, including homegrown generators that emit types for other languages. Those will not appear in any dependency list, so ask rather than only grepping. |
| **`TypeGenerator.generateTypes()` in `@sanity/codegen` simplified.** Returns generated code directly; progress via an optional `reporter` callback. | Only if the project has tooling that wraps `@sanity/codegen` programmatically. |

### Default flip

| Change | Applicability condition |
| --- | --- |
| **Smart typography in the Portable Text editor is on by default.** Straight quotes become curly quotes, double hyphens become dashes, three periods become an ellipsis, and these characters are written into stored content. **This reverses the 4.16.0 default**, where the same plugin shipped disabled, so a project coming from anywhere in the v4 line is getting a behavior change rather than a new feature. | Applies to any project with Portable Text fields, which is most. Raise it whenever content is consumed by something that cannot be patched quickly, matches strings exactly, or renders with a font that may lack those glyphs. Disable globally or per field in the Portable Text editor configuration. |

---

## 5. Within the v5 line

Shipped in minor and patch releases. Most are not labelled breaking.

### Requires a code or script change

| Version | Change | Applicability condition |
| --- | --- | --- |
| 5.3.0 | `unstable_use*` hooks deprecated in favour of `useUnstable*`. | `grep -rn "unstable_use" src/` |
| 5.12.0 | **`beta.form.enhancedObjectDialog` config option removed.** The dialog is now unconditional. | Grep the config for `enhancedObjectDialog`. |
| 5.14.0 | `SANITY_STUDIO_AGENT_API_HOST` environment override removed. | Grep for the variable name across source and CI. |
| 5.15.0 | **CLI errors on unknown flags** instead of ignoring them. A typo such as `--datset` now fails the command. | Audit every `sanity` invocation in `package.json` scripts and CI config. |
| 5.18.0 | **`sanity start` deprecated in favour of `sanity preview`.** `start` was an alias of `preview`, so `preview` is the one-to-one replacement. **`sanity dev` is not equivalent**: `dev` runs a development server, `preview` serves an already-built production bundle. Recommending `dev` silently changes what the script does. Several commands also gained plural forms, with the singular kept as aliases. | Grep scripts and CI for `sanity start`. If a `start` script exists alongside a `dev` script, the likely intent was `preview`; confirm rather than assume. |
| 5.18.0 | **`sanity schema extract` always appends `schema.json`** to the path argument. | Applies if any invocation passes a full filename rather than a directory. |
| 5.18.0 | **Structure `sheetList` removed.** The bundled Sanity Create plugin was also removed from core. | `grep -rn "sheetList" src/` |
| 5.18.0 | `useTimeLineStore` deprecated; use the events store to retrieve deleted documents. | Grep for the hook name. |
| 5.19.0 | `menuButton`'s `placement` prop deprecated in favour of `popover.placement`. | Grep for `menuButton`. |
| 5.21.0 | `extractSchema` in `@sanity/schema` returns a proper object type for fieldless object types instead of `unknown`. | Only if the project consumes the extract API. |
| 5.2.0 | The `ServerStyleSheet` re-export from `styled-components` was removed from `sanity`. | Grep for `ServerStyleSheet` imported from `sanity`. |
| 5.8.1 | **`auth.loginMethod` strictly enforced.** `'token'` no longer falls back to cookie auth when another Studio on the same domain left session cookies; `'cookie'` now ignores localStorage tokens. | Applies if `auth.loginMethod` is set, if several Studios share a domain, or if a Studio is embedded in a Dashboard. |

### Behavior changes editors will notice

No code change required, but they belong in the plan so whoever supports editors is not surprised.

| Version | Change |
| --- | --- |
| 5.8.0 | Pasting a URL into a Portable Text field now automatically creates a link annotation. Raise this wherever the rendering surface may not handle the `link` mark. |
| 5.14.0 | A preview's `media` falls back to the schema type icon when `media` is omitted from `prepare()`. Return `media: null` or `media: false` to suppress. |
| 5.14.0 | Duplicating an array item regenerates `_key` for all nested items, not only the top level. Relevant to anything caching or diffing on `_key`. |
| 5.26.0 | `options.disableNew` is now actually enforced on fields where uploads were meant to be disabled. |
| 5.26.0 | The Studio routes to the first workspace a user can see, rather than the configured default when that default is hidden from them. |
| 5.29.0 | Array `initialValue` precedence changed: a parent field's `initialValue` now takes precedence over a child's inside `defineArrayMember`, with the child still filling omitted keys. |
| 5.31.1 | Documented caveat that becomes live once v6 flips the search default: under `groq2024`, preview fields resolved through a reference do not contribute to search matching or ranking. See the v5 to v6 section. |

### Notes

**5.31.2 is the final v5 release**, published under the `maintenance-v5` dist-tag. It is the right intermediate stop before v6. Note that it is a patch above the last minor, so a sequence that stops at 5.31.1 or at "the last 5.31 minor" is stopping one release early. Confirm the terminal release of a line from the registry rather than assuming the highest minor is it.

TypeGen reached general availability in 5.10.0, and automatic generation plus `--watch` arrived in 5.8.0. If a project is not yet using TypeGen, crossing v5 means it lands on the GA version with nothing to migrate, which is worth mentioning as an opportunity rather than a task.

---

## 6. v5 to v6

Published 2026-06-11. A focused release: schemas, plugin APIs, configuration shape, and content APIs are unchanged.

### Requirements

| Change | Applicability condition |
| --- | --- |
| **Node.js 22.12 or newer required.** `engines.node` narrows from the v4 and v5 range of `>=20.19 <22 \|\| >=22.12` to a flat `>=22.12`. Node 20 reached end of life in April 2026. | Check `engines.node`, `.nvmrc`, CI images, and the build host. Affects build and development environments only, not the Content Lake or the browser bundle. |

Note for anyone arriving from the v4 or v5 line: **this is a genuine new requirement for Node 20.19 through 21.x**, which the whole v4 and v5 span accepted. The one band that was already rejected before v6 is Node 22.0 through 22.11, per section 3. A team sitting there has been out of range since 4.5.0 without necessarily knowing it, and the fix is the same move to 22.12.

### The change most likely to break a configuration

**`auth.providers` now replaces the built-in providers rather than appending to them, and `mode: 'append'` is no longer supported.**

Applicability: does `sanity.config.*` contain an `auth` block with `providers`?

This is the highest-severity item in the boundary because it affects login, and custom providers usually mean SSO or SAML. If the project has no `auth` block, it is unaffected, and saying so explicitly is valuable: it removes the scariest item from the plan.

Migration is to the callback form:

```ts
// before
auth: {providers: [{name: 'saml', title: 'SSO', url: '...'}], mode: 'append'}

// after
auth: {providers: (prev) => [...prev, {name: 'saml', title: 'SSO', url: '...'}]}
```

If the intent is to offer only the custom provider, the new default is already correct and the array form needs no change. Either way, recommend verifying the login screen with a real non-administrator account before production.

### Other declared changes

| Change | Applicability condition |
| --- | --- |
| **`enableLegacySearch` config option removed.** Use `search: {strategy: 'groqLegacy'}` instead. | Grep the config for `enableLegacySearch`. |
| **React strict mode on by default in development.** Opt out with `reactStrictMode: false` in `sanity.cli.ts`. | Applies to every project. It surfaces existing effect-cleanup and concurrent-rendering issues rather than creating new ones, so recommend leaving it on and fixing what it reports. |
| **Default search strategy changed from `groqLegacy` to `groq2024`.** Better performance on large datasets, deeper nested-content and Portable Text coverage, and wildcard, phrase, and negation syntax. Results, ordering, and counts shift because the query logic differs. | Applies unless `search.strategy` is already set. See below. |

**The specific search regression to test for:** under `groq2024`, preview fields resolved through a reference, such as `subtitle: 'author.name'`, no longer contribute to search matching or ranking. They did under `groqLegacy`.

Detect candidates with:

```sh
grep -rEn "(title|subtitle|description):\s*'[A-Za-z0-9_]+\.[A-Za-z0-9_.]+'" src/
```

Matches are candidates, not confirmations. Whether it matters depends on how editors search, which is a human question. `search: {strategy: 'groqLegacy'}` restores the old behavior as a temporary measure.

### Under the hood

**Vite 8.** Build times improved substantially in Sanity's internal testing, with smaller bundles from better tree shaking. The React plugin updates automatically.

Applicability: does `sanity.cli.ts` customize `vite`? If yes, this is the most likely source of a build failure on this boundary, and testing against the pre-release before committing is worth recommending. If no, this boundary loses its main build risk, and the plan should say so.

---

## 7. Within the v6 line

| Version | Change | Applicability condition |
| --- | --- | --- |
| **6.3.0** | **The Portable Text input dropped all legacy `data-slate-*` attributes, CSS classes, and non-`pt` data attributes from its editing DOM.** Migrate to the `data-pt-*` equivalents. | `grep -rn "data-slate"` across source, stylesheets, and test suites. **This is the highest-impact undeclared change in the v6 line and it fails silently.** Custom CSS stops applying and end-to-end selectors stop matching, with no error. |
| 6.2.0 | The markdown plugin's `config` prop deprecated in favour of `enabled`. | Only if `sanity-plugin-markdown` is configured with `config`. |
| 6.2.0 | Native browser autocomplete and autofill disabled on Studio form fields. | Informational. |
| 6.4.0 | `useDocumentVersionInfo` deprecated. | Grep for the hook. |
| 6.6.0 | **Invisible stega metadata stripped from text pasted into plain-text fields.** | Going forward, no action. Documents already containing stega characters need a one-time content migration using `stegaClean` from `@sanity/client/stega`. Only relevant if visual editing with stega is or was in use. |
| 6.6.0 | **`menuItems([])` in structure configuration is now honored**, so no default menu items are injected. | Applies if structure config uses `menuItems([])` and relied on the injected items appearing. |
| 6.6.0 | "Default sort" and "Default view" scoped to the individual document list rather than overriding every list of the same type. | Applies to structure customization that relied on the old spillover. |
| 6.6.0 | Opt-in table editing added to the Portable Text input, enabled with `plugins: {table: {enabled: true}}` on `components.portableText` plus a declared table schema. | Off by default, so no risk. Worth a note: do not enable it until every rendering surface can handle table blocks. |
| 6.7.0 | `Rule.uri({scheme})` respects a custom scheme when combined with other rules, so `mailto:` and `tel:` values are no longer wrongly rejected. | No action. Content that previously failed validation may now pass. |
| **6.9.0** | **`sanity build` and `sanity deploy` now honor `deployment.autoUpdates`**, which was previously ignored in some code paths. | Applies to every project with `autoUpdates` set. If a project set `false` but was receiving updates anyway, that stops. Verify which behavior the team expects. |
| 6.9.0 | `defineType`, `defineField`, and `defineArrayMember` preserve explicitly supplied optional properties on their return types. | Applies to any TypeScript project. Inferred types shift, so expect new type errors or newly redundant non-null assertions in schema-adjacent code. Usually quick to resolve. |
| **6.11.0** | **`useClient` deprecation narrowed to the no-argument call.** Calling `useClient()` without options warns; calling it with options, such as `useClient({apiVersion: '2024-01-01'})`, does not. | `grep -rEn "useClient\(\s*\)" src/`. The fix is to pass an explicit `apiVersion` rather than to stop using the hook. Worth doing regardless of the warning, because an implicit API version is its own latent problem. |
| 6.10.0 | The request-access screen was replaced with the shared `access-ui` package, which adds a `renderAction` slot. | Informational for most projects. Applies only if the access-request screen was customized or its markup was targeted by tests or CSS. |
| 6.12.0 | `displayName` assignments removed from `sanity` exports to unblock tree shaking. | Applies only to code or tests that identify components by `displayName`, including some snapshot and component-lookup patterns. Grep test suites, not just `src/`. |
| 6.12.0 | The mutator drops patch paths that cannot apply to the local document instead of throwing. | Informational. Relevant if custom code relied on the throw to detect a stale path. |

---

## 8. Cross-cutting deprecations

Not tied to a boundary, but worth checking on any span.

**Scheduled publishing** was deprecated in October 2025 and remains gated behind `scheduledPublishing: {enabled: true}`. If a project still uses it, migrating to Scheduled drafts or Content Releases is separate work and should be scoped separately rather than folded into a version upgrade.

**`studioHost` naming collision.** Two different things share this name, and conflating them causes unnecessary refactors:

- `studioHost` and `metadata.externalStudioHost` as **read** fields on the project information API response are deprecated, because a project can now host multiple Studios and a single field cannot represent them all. There is currently no public replacement for listing studio deployments programmatically. If a project reads either field from the projects API, that genuinely needs attention.
- `studioHost` as a **write** option in `defineCliConfig`, which tells `sanity deploy` which hostname to target, is a different surface. It is used throughout the hosting and deployment documentation, including the recommended pattern of configuring `projectId`, `dataset`, and `studioHost` via environment variables for building multiple Studios from one codebase. `sanity undeploy` also targets the host from CLI config.

Note that `studioHost` does not appear in the CLI configuration reference's property table while the deployment documentation uses it. That inconsistency is worth flagging to the reader as something to confirm, but it is not itself evidence that the CLI option is being removed. Describe the current documented state and do not speculate about future releases.

`deployment.appId` is **not** a replacement for `studioHost`. `appId` identifies an already-deployed Studio and exists to enable fine-grained auto-update version selection. The two are complementary, and `appId` provides little benefit while `autoUpdates` is `false`.

**Deploying and hostname assignment.** Hostname assignment happens through the CLI. A first `sanity deploy` prompts for a hostname interactively. `sanity deploy --url <hostname>` sets it non-interactively, `--title` names a newly created studio, and `--dry-run` reports what would be created without creating it, which is useful when rolling out across many deployments. Renaming, hiding from Dashboard, and removing a studio are available on the project's Studios tab in Sanity Manage.
