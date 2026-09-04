# Version lookup and changelog retrieval

Version facts must come from a live source at the time the plan is generated. This file is how.

## Contents

1. Why this is non-negotiable
2. Current versions from the registry
3. Confirm every version you recommend actually exists
4. What a target release depends on
5. Choosing a target version
6. Claims about what a package requires
7. Changelog retrieval
8. When lookups are unavailable

---

## 1. Why this is non-negotiable

A model's training data contains a snapshot of the npm ecosystem from some point in the past. Sanity Studio ships roughly weekly. Any version number recalled rather than retrieved will eventually be wrong, and it will be wrong in the most damaging way: stated confidently, in a document someone refactors against.

Concrete failure modes this prevents:

- Recommending a "latest" that is several majors behind, or ahead of what exists
- Missing that a shared package published a new major since training
- Missing that a plugin's patch release quietly bumped a major dependency, so the safe pin is an earlier patch
- Telling someone a package's peer range accepts their target when it does not

Every version in the report should be traceable to the lockfile or to a query run during this session.

## 2. Current versions from the registry

Prefer whichever of these works in the environment.

```sh
# All dist-tags at once: latest, stable, next, and any prerelease channels
npm view sanity dist-tags --json

# A single package's current latest, with its requirements
npm view sanity@latest version engines peerDependencies --json
npm view @sanity/ui@latest version engines peerDependencies --json
```

Direct registry endpoints, if `npm` is unavailable or blocked:

| Endpoint | Returns |
| --- | --- |
| `https://registry.npmjs.org/-/package/<pkg>/dist-tags` | All dist-tags. Small response. |
| `https://registry.npmjs.org/<pkg>/latest` | Full manifest for `latest`: version, `engines`, `dependencies`, `peerDependencies` |
| `https://registry.npmjs.org/<pkg>/<version>` | Same, for a specific version |

Scoped package names need URL encoding in some clients: `@sanity/ui` becomes `@sanity%2Fui`.

Query at minimum: `sanity`, `@sanity/vision`, and every `@sanity/*` and `sanity-plugin-*` the project depends on directly.

A note on dist-tag listings: some Sanity packages carry a large number of prerelease and feature-branch tags. The `sanity` package carries well over a hundred, most of them long-dead feature branches. When a listing is long, read the tags you need by name rather than trusting a summary of the whole list. If a tag listing and a `/latest` manifest disagree, the `/latest` manifest wins.

**`latest` is the target. `stable` is a different tag and it lags.** Observed 2026-09-04: `latest` was 6.12.0 while `stable` was 6.7.0, five minors behind. Do not treat `stable` as a more trustworthy `latest`, and do not recommend it because the name sounds safer. If a plan is going to deviate from `latest`, that has to come from a constraint the reader stated, not from a tag name.

Two other tags on this package are genuinely useful, because they name the terminal release of a maintenance line, which is exactly what an intermediate stop needs: `maintenance-v4` and `maintenance-v5`. Read them rather than assuming the highest minor is the last release of a line, because both point at a patch above it.

**Dist-tags do not tell you what exists.** A tag is a pointer someone has to move; a version can be published without `latest` following it, so the highest published version is often ahead of what `latest` points at. Reading `latest` as "the set of releases that exist" produces a specific wrong conclusion: declaring a real version nonexistent because a tag lags behind it.

So use dist-tags to answer "what should I target" and the version list or a direct manifest fetch to answer "does this version exist". They are different questions with different sources:

```sh
npm view <pkg> dist-tags --json      # what to target
npm view <pkg> versions --json       # what exists
npm view <pkg>@<version> version     # does this specific one exist
```

## 3. Confirm every version you recommend actually exists

**Before any version number goes into the report, confirm that exact version was published.**

This sounds redundant next to section 1, but it catches a distinct and worse failure. Section 1 prevents *stale* versions. This prevents *invented* ones: a version number that looks right because it pattern-matches something else in the plan, and was never published at all.

The damage is asymmetric. A stale version installs and works, just not on the newest release. A nonexistent version fails at install, and the reader's first experience of the plan is an error.

```sh
# Does this exact version exist?
npm view <pkg>@<version> version

# Or list what exists and check
npm view <pkg> versions --json
```

The pattern that produces this mistake: assuming one package's version tracks another's because their numbers look alike, then writing the number rather than querying it. Any package you are about to label "lockstep", "matches core", or "same version as" needs an existence check, because that reasoning is exactly what generates a plausible number nobody published.

Run the check on every pinned version in the dependency block, not just the ones that felt uncertain.

## 4. What a target release depends on

This step is what prevents the most common upgrade failure. Before recommending a version for any `@sanity/*` package the project depends on directly, find out what the *target* `sanity` release depends on:

```sh
npm view sanity@<target-version> dependencies --json
```

Then match that range rather than the package's own `latest`. See `package-coupling.md` for why.

Also record the target's requirements:

```sh
npm view sanity@<target-version> engines peerDependencies --json
```

`engines.node` and the `react` / `react-dom` / `styled-components` peer ranges are the hard requirements the plan opens with.

## 5. Choosing a target version

**Target `latest`. Recommend it, and say why.**

Two reasons, and the second is the one people miss.

The obvious one: the point of the upgrade is to stop being behind. Landing short means doing the whole job and still needing another cycle sooner, and the second cycle costs nearly as much as the first because the same testing has to happen again.

The one that actually decides it: **plugin ecosystems track `latest`, so an older core with current plugins is frequently less coherent than `latest` with current plugins.** Current plugin versions depend on the shared packages that recent core releases depend on. Aim at an older release and you can land on a core whose `@sanity/ui` major differs from what every plugin needs, which is a duplicate-major tree - the exact failure `package-coupling.md` exists to prevent. Choosing a "safer" older release can therefore produce a *worse* dependency graph than the newest one.

So `latest` is the recommendation. Not "latest unless it feels new."

### What still gets reported

Retrieve and state these. They are disclosure so the reader can apply constraints you cannot see, not hedges, and they do not change the recommendation.

```sh
npm view sanity dist-tags --json
npm view sanity time --json     # publish dates per version
```

- **The target version and its publish date.** If it is days old, say so in one clause.
- **The one-line fallback**, and only one: the previous minor, or `stable`. Give the version and what differs, in a sentence. Do not build out a parallel plan for it.

Frame it as recommendation plus disclosure: "Target 6.12.0 (`latest`, published two days ago). If your change process needs more soak time, 6.11.0 has the same dependency shape." That is a decision the reader can act on, with the information to overrule it.

### Dependency majors inside a minor release

Still check this, but it no longer argues for landing earlier:

```sh
npm view sanity@<target> dependencies --json
npm view sanity@<previous-minor> dependencies --json
```

If a shared package crossed a major somewhere in the recent minors, that migration is **inside the target**. Name it in the plan and scope it as part of the work, rather than proposing an older release to avoid it. Avoiding it usually means inheriting a duplicate-major tree instead, which is worse and harder to explain.

### When something blocks `latest`

If a plugin's peer range accepts no version of the target, that is a plugin problem, not a reason to aim at an older core. Work `plugins.md` - is a compatible version available, is the plugin still needed, can it be replaced. Retargeting the whole upgrade around one unmaintained dependency is almost never the right trade.

### The only reason to deviate

A constraint the reader has actually stated: a change freeze, a pinned platform runtime, a policy requiring N weeks of soak. Then pin, name `latest` as the eventual destination, and give the pin a review date so it does not become permanent by default.

Absent a stated constraint, recommend `latest`.

## 6. Claims about what a package requires

**Every statement of the form "package X requires Y" comes from X's own manifest, read during this session.** Never from memory, never from a docs page, never inferred from a sibling package.

```sh
npm view <pkg>@<version> engines peerDependencies dependencies repository --json
```

The fields that carry requirements: `engines` for runtime floors, `peerDependencies` for what the host must supply, and the presence or absence of `typesVersions` and `exports` for whether legacy TypeScript resolution still works.

Four ways this goes wrong, all of which produce confident, wrong, sequencing-relevant claims.

**Reading a range instead of evaluating it.** Having the manifest in front of you is not the same as knowing what it accepts. Compound ranges are the trap: `>=20.19 <22 || >=22.12` looks like it excludes Node 21 and accepts all of Node 22, and it does the opposite of both, accepting every 21.x and rejecting 22.0 through 22.11. Space-separated comparators are an AND, not an OR, so `>=20.19 >=22.12.0` is just `>=22.12.0` with a dead clause in front of it.

Any range with a `||`, a `<`, or two comparators in one clause gets evaluated before it goes in the report:

```sh
node -e "console.log(require('semver').satisfies('<version>','<range>'))"
```

Test the version the project is actually on, and the boundary values either side of every comparator. This costs one command and prevents the worst version of a requirements error: telling a reader to change a runtime that was already inside the supported range.

**Inventing a constraint.** Asserting that something requires the newest major when it accepts several tells the reader to defer work they could do immediately. The plan is then not merely inaccurate, it is ordered wrong as a consequence.

**Attributing one package's field to another.** Quoting a version range and naming the wrong package makes a correct finding uncheckable, and it is easy to do when you have several manifests open. State the requirement and the package you read it from in the same breath: "`sanity@4.4.0` declares `engines.node: >=20.19 >=22.12.0`." If two packages express the same constraint differently, quote each from its own manifest rather than normalizing them into one string.

**Assuming a requirement carries backwards across majors.** A constraint introduced in v4 of a package is not evidence that v3 had it. `typesVersions` is the trap here: a package can drop it in one major while the previous major still ships it, so the `moduleResolution` requirement applies at one stop and not the earlier one. Check the specific version the plan installs at each stop, not the newest.

**Where a docs page and a manifest disagree**, say so and treat the manifest as what will install and the docs as what is supported. Do not silently pick one.

### Replacement packages specifically

When pointing at a successor for something deprecated, do all of the above plus:

- **Check the version number.** Below 1.0.0 is a different proposition: the API may still move and its peer ranges may narrow. Recommending one is often still right, particularly when it is the documented successor, but say the version and note that it is pre-1.0.
- **Record where it lives** via `repository`, so the reader knows whether the same people maintain it as the thing it replaces.

## 7. Changelog retrieval

The references in this skill cover known items up to a fixed date. For anything after it, and to catch items released in minor versions without a breaking-change label, read the changelog.

**Via the Sanity MCP server, if connected.** `search_docs` and `read_docs` are the most reliable route and return clean markdown.

```
search_docs("Studio v6 breaking changes")
read_docs("https://www.sanity.io/docs/studio/upgrade")
```

**Changelog URLs.** Entries live at `https://www.sanity.io/docs/changelog/<id>`. Appending `.md` returns the entry as markdown, which is easier to parse:

```
https://www.sanity.io/docs/changelog/<id>.md
```

Some entries use a slug of the form `studio-<base64 of a version string>`, for example `studio-NS4zMS4w`. This lets you construct candidate URLs directly, but treat it as a heuristic: the encoded version does not always match the version the entry states. Verify by reading the entry rather than trusting the slug.

The category-filtered index is a useful starting point:

```
https://www.sanity.io/docs/changelog?category=studio
```

**Raw CHANGELOG.** The repository's generated changelog is the most complete source, and it contains items that never made it into a curated entry:

```
https://raw.githubusercontent.com/sanity-io/sanity/main/CHANGELOG.md
```

It is large. Fetch it with a specific question rather than reading it whole, and search for `BREAKING`, `breaking change`, `deprecat`, `removed`, and `no longer`.

**It starts at 3.91.0.** Verified 2026-09-04: the file on `main` covers 3.91.0 onward, and the tagged trees for older releases do not contain it either. So there is **no consolidated changelog for 3.0.0 through 3.90.x**, and a fetch aimed at that range comes back nearly empty.

Do not read that emptiness as an absence of breaking changes. It is an absence of *source*, and the two must not be reported the same way. Say which range you could not cover, and see the v3 line note in `boundaries.md` for the wording. The per-release changelog entries on the docs site remain the fallback for individual older releases, but they are not a substitute for a continuous history of a hundred minors.

**One useful lower-bound anchor that does not depend on the changelog:** the registry manifest for any release is always available, so requirement fields such as `engines.node` and `peerDependencies` can be read for *any* version, including ones the changelog never covered. When the narrative history is missing, the requirement history is still verifiable. Use it, and say that is what you did.

**Migration guides.** Confirmed to exist:

| Boundary | Document |
| --- | --- |
| v3 to v4 | `https://www.sanity.io/docs/help/v3-to-v4` |
| v4 to v5 | Changelog entry `fd3ab62e-9264-4e7b-825a-fd4f99abd481` |
| v5 to v6 | Changelog entry `studio-NS4zMS4w`, plus the blog post `https://www.sanity.io/blog/sanity-studio-v6` |
| General | `https://www.sanity.io/docs/studio/upgrade` |

Studio v2 is out of scope for this skill and is a hard stop; see the scope section of `SKILL.md`. When redirecting a v2 project, point the reader at the current v2 to v3 migration guide on the docs site rather than reciting a URL or its contents from memory.

**Third-party plugins.** For anything not published by Sanity, read the package's own repository releases. Peer ranges in the registry manifest tell you compatibility; the release notes tell you what changed.

### Confirm you read the range you claim to have read

The raw CHANGELOG is a large file, and whatever fetches it may truncate it without saying so. That produces a specific and damaging failure: reporting "scanned 6.9.2 through 6.12.0, no breaking changes found" when the content actually stopped at 6.9.1, so the newest releases were never examined at all and the report implies otherwise.

Before claiming a range, check the highest version present in the content you received. If it stops short of your target, say what you actually covered and mark the remainder unverified. An honest "I reviewed through X, and X to Y still needs checking" is useful; a claimed scan that did not happen is how an unsupported finding ends up in a report looking like the product of research.

When the raw file truncates, fall back to the per-release changelog entries, which are small enough to retrieve individually.

### Citations

**If you cite an issue or pull request number, you must have retrieved it.** Do not attach one to a change you learned about elsewhere.

Issue numbers are trivially easy to produce and effectively impossible for a reader to sanity-check without clicking through, so a wrong one makes an otherwise accurate finding unverifiable, and it undermines every other citation in the document. If you know a change shipped but not its issue, cite the release it shipped in and describe the change. That is both more useful and checkable.

## 8. When lookups are unavailable

If the environment has no network access, or registry queries fail:

1. Say so at the top of the report, prominently.
2. Report the resolved current versions from the lockfile, which do not need network access, and the applicability findings from the repository, which also do not.
3. Do not name any target version. Instead, state the commands the reader should run.
4. Frame the output as a partial plan pending version verification.

A partial plan that is honest about its gap is useful. A complete-looking plan built on remembered version numbers is a liability.
