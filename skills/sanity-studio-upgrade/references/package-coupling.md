# Package coupling

Most upgrades that fail do not fail on the `sanity` package. They fail on the packages around it. A changelog cannot warn about this, because it depends on which packages a given project happens to depend on directly.

## Contents

1. The match-core rule
2. Lockstep packages
3. Shared packages with their own majors
4. Plugins
5. Missing peer dependencies
6. Duplicate detection and dedupe
7. Environment floors

---

## 1. The match-core rule

**For any `@sanity/*` package the project depends on directly, match the version that the target `sanity` release depends on, rather than that package's own `latest`.**

```sh
npm view sanity@<target-version> dependencies --json
```

The `sanity` package pulls in a set of `@sanity/*` packages as regular dependencies. When a project also depends on one of them directly, and takes `latest` for it, the two can land on different majors in the same tree.

For packages that carry React context or a styled-components theme, that is not a cosmetic problem. Two majors of a theming package in one tree produces missing-or-duplicate context errors and unstyled components, and those surface as runtime bugs that look unrelated to the upgrade. The Sanity docs have a dedicated troubleshooting page for exactly this failure, which is a good indication of how often it happens.

**The one case where taking a newer major is correct** is when the target `sanity` release itself depends on that newer major. Check first, then decide. This ordering matters: it turns a guess into a lookup.

**Watch for a major dependency bump inside a minor release of `sanity`.** Compare the target's dependency ranges against the previous minor. If a shared package crossed a major between two adjacent minors, then choosing the later one silently adds a second migration to the change set. Flag it and offer the earlier release as an option that keeps the two migrations separable.

## 2. Lockstep packages

`@sanity/vision` tracks the `sanity` major and declares a peer dependency on it. Pin it to the same version as `sanity` and move both together. A vision version from the previous major will produce a peer dependency error against the new core.

Treat any first-party package that declares a peer on `sanity` the same way: read its peer range, and pick a version whose range accepts the target.

## 3. Shared packages with their own majors

These are versioned independently of `sanity`, so they need explicit checks. Query the registry for current versions rather than relying on any list.

### `@sanity/icons`

The change that requires code edits: **a major of this package removed the per-icon barrel exports.** Each icon moves to its own subpath, `'@sanity/icons/Some'`. The root entry retains a dynamic `Icon` component and an `icons` map, with each icon behind lazy loading.

**How that removal presents is the part that fools a checker, and it changed inside the major.** Verified against the shipped `dist/index.d.ts` on 2026-09-04:

- At **5.0.0** the icon names are simply gone from the root entry. A barrel import fails to resolve.
- From **5.1.0** onward the names are back in the root `export {...}` list, each declared as `declare const SomeIcon: never` carrying `@deprecated <name> is no longer exported from the @sanity/icons root entry (removed in v5) - the icon itself still exists. Import it from its own subpath instead.`

So on 5.1.0 and later the import **resolves**, and a check that only asks "is this name exported from the root?" gets back yes. It is still removed. The value is typed `never`, the runtime export is gone, and the icon does not render. Passing it as a schema `icon` or writing `<SomeIcon />` yields a confusing type error at best and a missing icon at worst.

**Never conclude that a barrel import is fine because the name appears in the export list.** Read the declared type. This is the same `never`-stub technique `@sanity/ui` v4 uses for removed props, described below, and it is worth treating as this vendor's house deprecation pattern rather than a quirk of one package.

An earlier major made the package ESM-only, raised its Node floor, and dropped `forwardRef` in favour of React 19's ref-as-prop model.

Detection is a grep for barrel imports. The edit is mechanical, and the payoff is real bundle savings. Subpath type resolution requires `moduleResolution` of `node16`, `nodenext`, or `bundler`.

A project can stay on an older major if its React peer range still allows it, but doing so leaves two copies of the package in the tree when core depends on the newer one. Matching core is usually the better recommendation.

### `@sanity/ui`

A major of this package is a substantial migration in its own right, and its scope depends entirely on how many components a project touches. Count the import sites before sizing it.

Known shape of the v3 to v4 migration:

- ESM-only; no CommonJS consumers
- Raised floors for Node, React, and `styled-components`
- `moduleResolution` must be `node16`, `nodenext`, or `bundler`, because types resolve through `exports` and `typesVersions` is gone
- `@sanity/ui/styles.css` must be imported manually at the application entry point; styles are no longer injected automatically. Inside a Studio the core package loads the stylesheet, so custom components usually inherit it, but this is worth verifying visually rather than assuming
- Heavier components moved behind subpath entry points: toast, popover, tooltip, menu, autocomplete, breadcrumbs, and code each have their own subpath. The theme entry point did not move
- `space` renamed to `gap` on a list of layout and control components. This is typically the most frequent single edit
- Grid `columns` and `rows` became `gridTemplateColumns` and `gridTemplateRows`; the `column` and `row` prop families became their `gridColumn` and `gridRow` equivalents
- Several hooks and one component are removed. All of them ship as `never` stubs whose `@deprecated` text names the replacement, verified in 4.0.7's `dist/index.d.ts` on 2026-09-04: `useClickOutside` → `useClickOutsideEvent`, `useElementRect` → `useElementSize`, `useForwardedRef` → React's own `useImperativeHandle`, `useArrayProp` → `Array.isArray(x) ? x : [x]` inline, and `ConditionalWrapper` → inline the conditional wrapping. **Read the `@deprecated` text rather than this list**: it is generated from the package, it names the replacement precisely, and it cannot go stale the way a curated list can
- Tooltip and popover keep closed content mounted but hidden. A popover whose content renders another popover must gate the recursion on its open state, or the hidden tree recurses indefinitely. Tests asserting a tooltip is absent from the DOM need to assert it is not visible instead

**The failure mode is the important part to convey:** removed props and hooks are typed `never` and *ignored at runtime*. A missed `space` produces a confusing type error and silently lost spacing rather than an unknown-prop error. So the build will not catch everything, and the plan should say to visually diff the affected components.

Everything in the list above was verified against the shipped `@sanity/ui` 4.0.7 package on 2026-09-04: `type: module`, no `typesVersions`, `engines.node >=22.12`, peers `react ^19.2` and `styled-components ^6.1`, a `./styles.css` subpath, the seven component subpaths plus `./theme`, and `space?: never` present in the prop types. Re-confirm against the package and its migration guide at generation time rather than treating the list as current.

**Do not read the `never` stubs as evidence that these still work.** They are the same pattern as the `@sanity/icons` root exports above, and the general rule for both is in section 6 of `plugins.md`.

### `styled-components`

Match the range the target `sanity` release declares as a peer, and check what core depends on. A mismatch here is usually benign but can produce duplicate theme contexts.

### `groq` and `groq-js`

**Do not assume `groq` versions in lockstep with `sanity`. It does not.** Its major numbers happen to look similar, which makes the assumption easy and wrong.

Two separate packages with different roles:

- **`groq`** is the tagged-template helper that produces query strings, and the package TypeGen reads queries from. It is versioned independently and its `latest` can sit several minors behind the Studio's.
- **`groq-js`** is the query evaluation library, and it is what recent Studio majors actually depend on. Check which one the target release names.

So: query the registry for `groq` separately, and check what the target `sanity` release depends on rather than reusing the Studio's version number.

```sh
npm view groq dist-tags --json
npm view sanity@<target-version> dependencies --json | grep -i groq
```

Recommending `groq@<studio version>` when that version was never published produces an install failure, which is a worse outcome than a stale recommendation. See the existence check in `version-lookup.md`.

If the project uses the `groq` helper only to build query strings, aligning its version is tidiness rather than a requirement, and it can be handled separately from the Studio bump.

### `@sanity/client`

Frequently a direct dependency of a backend or frontend service rather than the Studio, in which case it is in a different tree and does not constrain the Studio upgrade at all. Say so if that is the situation, rather than implying a coupling that does not exist.

If it *is* a direct Studio dependency, apply the match-core rule.

If a service depends on it separately and a new major is available, treat that as its own change with its own risk profile and its own release window. A client major in a service that fronts production traffic has a different blast radius from a Studio upgrade that affects editors, and bundling them makes failures impossible to attribute. Note also that the `sanity` package may still depend on an older client major than the client's own `latest`; that is normal and is a useful maturity signal, not a constraint.

## 4. Plugins

Plugins get their own pass. See `references/plugins.md`, which covers enumeration, ownership determination from the registry `repository` field, the compatibility checks, and what to do when a plugin blocks the upgrade.

The one item that belongs in both places, because it is a coupling problem rather than a plugin problem: **a plugin's own `@sanity/*` dependency can cross a major relative to what the target `sanity` depends on**, putting two majors of a shared package in one tree. A *patch* release of a plugin can do this, so check the specific version you plan to install rather than only `latest`. When it happens, look for an earlier patch that still matches core and pin to it.

## 5. Missing peer dependencies

List every plugin's `peerDependencies` and verify each one appears in the project's own `package.json`.

A missing peer often works by accident through hoisting, and then stops working across a major bump when the tree is rebuilt. Adding it explicitly before the upgrade is cheap and removes a confusing failure mode.

Related: if the project currently installs with relaxed peer resolution, such as `--legacy-peer-deps`, then peer warnings have stopped being a usable signal. That matters, because peer ranges are the main mechanism that would otherwise tell the reader a plugin is incompatible with the new core. Recommend resolving the underlying conflicts and removing the flag as part of the upgrade, and note it as a risk if they keep it.

## 6. Duplicate detection and dedupe

**Report duplicates you observed. Never predict duplicates you did not.**

A read-only planner cannot resolve a dependency graph, so it cannot know what the tree will contain after a change. Declared dependencies do not determine the outcome: transitive dependencies and the other shared packages defeat any set assembled by matching one package's declared major. Predicting a clean tree and being wrong discredits the verified findings around it.

So there are two different statements, and the plan must not blur them:

- **Observed, from the current tree:** "`@sanity/ui` resolves to 1.9.3 and 2.14.0 today, pulled in by X and Y." This is a finding. State it.
- **Expected, after a change:** "a single `@sanity/ui` 4.0.x is expected here." This is a prediction. Label it unverified and attach the command.

```sh
# Observe the current tree (a finding)
pnpm why @sanity/ui @sanity/icons @sanity/client @sanity/util @sanity/types react
npm ls --all @sanity/ui @sanity/icons @sanity/client react

# Settle a prediction before committing to a stop
pnpm install --lockfile-only && pnpm why @sanity/ui @sanity/icons @sanity/client
```

More than one major of `sanity`, `@sanity/ui`, or `react` in an observed tree is a finding. Force deduplication with `overrides` for npm, `resolutions` for Yarn, or `pnpm.overrides` for pnpm, and note that the override itself needs verifying by a resolve.

**When reading a lockfile directly, anchor the package name and keep prerelease suffixes.** A loose pattern reports `styled-components@5.1.36` when the entry is `babel-plugin-styled-components@5.1.36`, reports `@sanity/ui@5.0.0` when the entry is `5.0.0-alpha.3`, and turns `@sentry/react@8.55.2` into a React version. All three produce confident wrong findings:

```sh
grep -oE "[/'\"]@?[a-zA-Z0-9@/._-]+@[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?" pnpm-lock.yaml \
 | sed -E "s|^['\"/]+||" \
 | grep -E "^(@sanity/(ui|icons|client|util|types)|styled-components|react)@" \
 | sort -u
```

A useful signal for pre-existing duplication: **unnecessary type casts on plugin calls in the config.** If the config casts plugin return values to the plugin options type, that usually means two copies of the `sanity` types are resolving, so the type returned by the plugin is not structurally identical to the one the config expects. Worth resolving during the upgrade rather than carrying forward, and a good test afterward is whether the casts can be deleted.

In a monorepo, also check whether React is hoisted to the workspace root and shared with other applications. If another application pins a different React version, satisfying the Studio's floor may require workspace-scoped resolution rather than a root bump.

## 7. Environment floors

Collect these from the target release rather than from memory:

```sh
npm view sanity@<target-version> engines peerDependencies --json
```

`engines.node` applies to development servers and build environments, not to the Content Lake or the browser bundle. Say that explicitly, because teams often assume a Node requirement implies a production infrastructure change.

If the Studio shares a repository or CI pipeline with other applications, recommend scoping the Node change to this project's job rather than the whole runner. A global runner bump can disturb other build toolchains that have their own supported ranges.
