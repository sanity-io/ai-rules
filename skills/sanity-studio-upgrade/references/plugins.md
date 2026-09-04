# Plugins

Plugins are the most common thing that actually blocks a Studio upgrade. The Studio itself usually bumps cleanly; a plugin whose peer range does not accept the target major stops the whole job.

## Contents

1. Verify every plugin, assume nothing
2. Enumerate what is installed
3. Determine ownership
4. Assess compatibility
5. Plugin versions for intermediate stops
6. Verify the API shape before writing a snippet
7. Path A: plugins in the `sanity-io` org
8. Path B: plugins outside it
9. What never to recommend
10. Drafting a useful issue
11. Reporting

---

## 1. Verify every plugin, assume nothing

Both directions of assumption produce wrong answers in front of a customer.

**Assuming a Sanity-published plugin is compatible** is wrong because a plugin can lag a Studio major by days or weeks. Sanity plugins are *expected* to have a compatible release, and usually do, but "expected" is not "verified." Asserting it is the same freshness failure this skill exists to prevent.

**Assuming a third-party plugin is stale** is wrong because plenty are actively maintained and current. Telling a customer that a well-maintained plugin is abandoned is both inaccurate and unfair to whoever maintains it, and some of those maintainers are active in the Sanity community.

So keep two questions separate:

- **Is it compatible?** Answered by the peer range and publish data. Same method for every plugin regardless of who owns it.
- **Who can fix it if it isn't?** Answered by ownership. This determines the path, not the verdict.

## 2. Enumerate what is installed

Collect from every source, because the config and the manifest do not always agree:

- The `plugins` array in `sanity.config.*`, including any workspace-specific arrays
- Every dependency matching `sanity-plugin-*` or the `@sanity/*` scope
- Anything imported in the config that registers Studio behavior but is named neither way

Check `devDependencies` too. Plugins land there by accident and still get bundled at build time, which is worth flagging on its own.

Note any package that does not resolve from the public registry. That means a private or internal registry, and nobody outside the customer's own organization can assess or fix it. Report those by name and hand them to their team rather than guessing.

## 3. Determine ownership

**Use the `repository` field on the registry manifest. Do not use the package name, and do not maintain a list of plugin names.**

```sh
npm view <plugin> repository --json
```

A `repository.url` containing `sanity-io/` means the package lives in a Sanity-owned GitHub repository, most often the plugin monorepo at `github.com/sanity-io/plugins`, where the manifest also carries a `directory` pointing at the specific package.

**Why the package name is the wrong test.** `sanity-plugin-media` is an unscoped name, and it lives in `sanity-io/plugins` with Sanity.io as its author. Classifying by the `@sanity/` scope would report a plugin Sanity publishes as unmaintained third-party software. The `repository` field gets it right, costs one field on a query you already make, and never goes stale.

**What being in the monorepo does and does not mean.** The monorepo's own README describes it as the home for Studio plugins maintained by Sanity staff *and the community*, and it holds dozens of packages across both. So presence there means releases are coordinated and someone has commit access. It is not a published support tier. There is currently no per-plugin maintenance-status metadata, so do not state or imply a support level. Describe what you can verify: where it lives, when it last published, and whether its peer range accepts the target.

## 4. Assess compatibility

Run the same checks for every plugin.

```sh
npm view <plugin>@latest version peerDependencies dependencies --json
npm view <plugin> time.modified --json
```

| Check | What it tells you |
| --- | --- |
| **Does *every* peer range resolve, not just `sanity`?** | The most commonly botched check. A plugin declaring `sanity ^3.0.0` can be simultaneously unsatisfiable on `@sanity/ui ^1.2.2`, `styled-components ^5.3.8`, and `react ^18.2.0`. Reading only the `sanity` peer produces a "compatible" verdict for a plugin that will not install. Read the whole `peerDependencies` object and check each entry against what the tree will actually provide. |
| If not, does *any* published version work? | `npm view <plugin> versions --json`, then inspect recent ones. Customers pin and forget; support may already exist. |
| Does the plugin's own `@sanity/*` dependency cross a major relative to what the target `sanity` depends on? | Two majors of a shared package in one tree causes duplicate-context errors and unstyled components. A *patch* release of a plugin can do this, so check the specific version you plan to install, not just `latest`. When it happens, look for an earlier patch that still matches core, and pin to it. |
| Are the plugin's `peerDependencies` all present in the project's `package.json`? | Missing peers often work by accident through hoisting and stop working once the tree is rebuilt. |
| How long since the last publish? | Evidence, not a verdict. Report the date and let the reader judge. |
| How far is the installed version behind the latest? | A large gap often means the plugin's own breaking changes are in scope too, not just the Studio's. |

**A plugin already violating its own peers today belongs in the report's "needs attention before you start" section** (section 3 of `report-template.md`), not only in the upgrade blockers. If a plugin only installs because peer resolution is relaxed, that is true before anyone touches a version, and it means the plugin has to leave at the *first* stop rather than travelling as far as its `sanity` range suggests.

Read the plugin's own release notes for the versions being crossed. A plugin major has its own migration requirements, and those belong in the plan alongside the Studio's.

## 5. Plugin versions for intermediate stops

Section 4 answers whether a plugin has a version that works with the **target**. A multi-stop sequence needs that answer for **every stop along the way**, and this is the step most easily skipped, because a plugin's current version usually peers only recent Studio majors.

The trap is concrete. A plugin whose latest peers `^5 || ^6.0.0-0` tells you nothing about whether any published version peers `^4`. If the plan recommends stopping at the last v4 release, every plugin needs a version whose range accepts v4, or that stop is not reachable at all and the sequence is wrong.

Resolve it by walking versions backwards from the newest:

```sh
npm view <plugin> versions --json
npm view <plugin>@<version> peerDependencies --json
```

**The selection criterion has two halves, and taking only the first is the most common way a stop goes wrong.** You are looking for the newest version that satisfies both:

1. Its `sanity` peer range accepts that stop's major.
2. **Its own dependencies on shared packages match what that stop's core depends on.** `@sanity/ui` and `@sanity/icons` are the ones that matter, because they carry theme and context.

Check the second half explicitly, per candidate version:

```sh
npm view sanity@<stop-version> dependencies --json | grep -E '@sanity/(ui|icons)'
npm view <plugin>@<candidate> dependencies peerDependencies --json | grep -E '@sanity/(ui|icons)'
```

Half one alone points at `latest` almost every time, and `latest` tracks *current* core, not the core at an intermediate stop. Following it puts two majors of a theming package in the tree at exactly the stop you were trying to isolate.

**When the two halves disagree, walk back further.** A plugin's shared-package dependency usually crosses a major at a *patch* release, so there is normally a slightly older patch on the same feature line that keeps everything you need and still matches core. Find it rather than accepting the duplicate.

Note the asymmetry that keeps this tractable: a plugin peering a range that spans several majors can stay on one version across all of those stops. Only the boundaries where a range ends need a different version. So the work is proportional to the number of range boundaries, not stops times plugins.

### Two rules that make a stop real

**A preparatory stop must pin.** A stop described as "clean things up without changing `sanity`" that leaves the existing caret ranges in place is not a stop, it is a fresh resolve against whatever the registry happens to hold that day. In practice it resolves to the *newest* patch of every plugin, which is frequently a worse dependency tree than the carefully chosen set at the next stop. Pin a preparatory stop to the versions the current lockfile already resolves, which is what "don't change anything yet" actually means. This is doubly important when the plan elsewhere identifies unpinned ranges as the cause of deployment drift; keeping them in stop zero contradicts that finding.

**Check a candidate version's peers against the rest of that stop's tree, not just against core.** A plugin can satisfy the stop's `sanity` version and still fail against a sibling. The failure looks like `unmet peer @sanity/mutator@^3.36.4: found 4.22.1`, where the 4.x copy arrived through a different plugin in the same set. Compatibility is a property of the whole set at that stop, not of each plugin against core individually.

**Never accept a duplicate major without first proving no version avoids it.** This is the rule that catches the mistake above after the fact, and it is worth stating separately because the failure has a distinctive shape: the plan takes `latest` for a plugin, notices the duplicate, and then *argues* for it, with language like "accept the temporary duplicate, keep this stop short, and do not ship it to editors for long." That paragraph is a tell. Reasoning appears exactly where the version walk should have been, because no walk happened.

A worked example of what the walk finds. Suppose the stop is the last v5 release, whose core depends on `@sanity/ui ^3.2.0`, and a plugin is needed at its v5 feature line because that is where a data migration ships:

- The plugin's `latest`, 5.2.4, depends on `@sanity/ui ^4.0.7`. Taking it means two majors of `@sanity/ui` at this stop.
- Walking back: `@sanity/ui 4` first appears at 5.1.26. Every version from 5.0.3 to 5.1.25 stays on `@sanity/ui` 3.x.
- 5.1.2 depends on `@sanity/ui ^3.2.0`, which is exactly what the stop's core depends on, and it still carries the v5 migration.

So the duplicate was never necessary, and the correct pin is the older patch. Move the plugin to `latest` at the *next* stop, where core has moved to `@sanity/ui` 4 and the two agree again.

**If a stop genuinely has no version that satisfies both halves**, say so, name the versions you checked and what each depends on, and only then accept the duplicate. And do not schedule anything that depends on a working Studio UI at that stop: a data migration verified through a Studio with two theme contexts is a migration verified in the one state this whole file exists to avoid.

Three outcomes, and the plan has to say which one applies for each stop:

- **A version exists.** Name it in the sequence, at that stop. Not "check at execution time."
- **No published version accepts that major.** The stop is unreachable with that plugin installed. The options are to skip the stop and cross two majors at once, remove the plugin for the intermediate hop and reinstall it at the end, or drop it entirely. Recommend one and say why.
- **You could not determine it.** Mark that stop **provisional** and state exactly what needs checking before anyone commits to the sequence.

Deferring this to "at execution time" reads as thoroughness but is the plan handing back its hardest unanswered question, dressed as a next step. A sequence presented as validated when its middle stop was never resolved is worse than one that admits the gap, because the reader will schedule work against it.

If resolving every plugin at every stop is genuinely too much work for the span, reduce the number of stops rather than leaving them unresolved. Fewer, verified stops beat more, hypothetical ones.

### Never assert what the dependency tree will contain

**You cannot compute a deduplicated tree from declared dependencies, so do not claim one.**

This is a hard limit, not a matter of care. Reading each plugin's declared `@sanity/ui` version tells you nothing about what its own transitive dependencies pull, and nothing about the other shared packages (`@sanity/icons`, `@sanity/client`, `@sanity/util`, `@sanity/types`) that the same set drags along. A set assembled so that every plugin declares the same `@sanity/ui` major routinely resolves to two majors of it anyway, plus doubled copies of three or four other packages. Only a resolver knows.

A read-only planner has no resolver. So the honest form is an expectation plus the command that settles it:

> Expected at this stop: a single `@sanity/ui` 3.5.x. **Unverified** - dependency resolution is the only thing that can confirm it. Check before committing to this stop:
> ```sh
> pnpm install --lockfile-only && pnpm why @sanity/ui @sanity/icons @sanity/client
> ```

Write it that way at every stop, and in the final dependency section. Phrases like "a clean tree is achievable" or "expect exactly one version each" read as findings and are predictions; if one turns out wrong, every other verified claim in the document loses credibility with it.

The same limit applies to peer satisfaction across a whole set. You can confirm that each declared range *could* be satisfied; you cannot confirm the set resolves. Say which of the two you did.

When the reader has already run a resolve and shared the output, that is evidence and you can report it as fact, attributed to the run.

## 6. Verify the API shape before writing a snippet

A plugin's *version* being compatible says nothing about its *API* being what you remember. Plugin majors rename exports, move helpers behind subpaths, and change signatures, and those are exactly the details a reader copies straight out of the plan into their editor.

So: **any snippet you write that names an import path, an export, a signature, or a subpath is either read from the package or marked unverified at the snippet itself.** Two checks, both cheap and both read-only:

```sh
# Does the subpath exist, and what does it point at?
npm view <plugin>@<version> exports --json

# What does the plugin document as the current API?
# Fetch the README for the specific version, not the repo's main branch,
# which may be ahead of what the reader will install.
npm view <plugin>@<version> readme
```

### A name in an export list is not a working export

**The presence of a symbol is not evidence that it works, and confusing the two is worse than not checking at all**, because it produces a verified-sounding "no change needed" on something that is broken.

Sanity's house deprecation pattern across packages is to **keep the name and type it `never`**, so the reader gets a targeted error instead of a bare module-resolution failure. `@sanity/ui` v4 does it for removed props. `@sanity/icons` v5 does it for root-entry icon exports from 5.1.0 on. A grep for the name in `export {...}` or in `dist/index.d.ts` finds it in every one of those cases, and it is removed in every one of those cases.

So the check is three questions, not one:

1. **Is the name exported?** Necessary, not sufficient.
2. **What is its declared type?** `never` means removed. Treat it as absent.
3. **Does it carry `@deprecated`?** The tag text usually names the replacement, which is the fastest route to the correct snippet.

```sh
npm pack <pkg>@<version> && tar xzf <pkg>-<version>.tgz
grep -B4 "declare const <Name>" package/dist/index.d.ts   # type plus any @deprecated block
```

The failure this prevents is specific and expensive: a symbol that resolves, types as `never`, is silently `undefined` at runtime, and gets written into the report's "already satisfied" section as needing no edit. That moves a silent failure into the one place the reader has been told not to look.

If both confirm the shape, write the snippet plainly. If either is unavailable or ambiguous, keep the snippet and mark it inline, per section 8 of `report-template.md`:

```ts
// VERIFY: export name and signature - check the plugin README and its
// package.json `exports` map before running this
import {someHelper} from 'some-plugin/subpath'
```

A parenthetical in the surrounding paragraph does not count. The snippet leaves the document; the paragraph stays behind.

### The internationalization plugins specifically

`sanity-plugin-internationalized-array` and `@sanity/document-internationalization` are among the most widely installed plugins across Sanity's customer base, so a wrong snippet for either one is wrong in many places at once. Two shapes come up in almost every plan that touches them, and both need verifying rather than recalling:

- **The field-level filter helper.** Plans commonly prescribe an `internationalizedArrayLanguageFilter`-style export as a drop-in `filterField`. Confirm the export name, whether it is a factory or a plain function, and what arguments it takes, from the README of the version being installed.
- **The migration subpath.** Plans commonly prescribe a migration imported from a `/migrations` subpath. Confirm that subpath is in the `exports` map for that version, and that the named migration is exported from it.

Neither check needs the project installed. If you skip them, the snippet gets the inline marker.

## 7. Path A: plugins in the `sanity-io` org

**If a compatible version exists**, which is the expected case: recommend the specific version, note any configuration changes from the plugin's own release notes, and move on. Keep it brief; this is routine.

**If no compatible version exists**, treat it as unexpected and handle it differently from a third-party gap.

Do not send the customer to open a GitHub issue about Sanity's own plugin. That reads as being passed back to yourself, and it is the wrong queue.

Instead, report it as a Sanity-side gap with everything needed to escalate:

- Plugin name and the resolved installed version
- Its current latest version and publish date
- Its declared peer `sanity` range
- The target Studio version the range does not accept
- What breaks without it, in one line

Then flag it explicitly for the Sanity contact on the account. In the report, put it under a heading that makes the ownership clear, for example "Blocked on a Sanity-maintained plugin", so nobody mistakes it for the customer's homework.

Give the customer honest interim options and no more: hold the upgrade until the plugin ships support, or proceed without that plugin if the functionality is genuinely replaceable. Say plainly that Sanity is being asked, rather than implying a date.

## 8. Path B: plugins outside the `sanity-io` org

Report what you found as evidence rather than as a judgment: last publish date, peer range, whether the repository is archived, and whether an issue or pull request already references the target version. Let the reader draw the conclusion; a plugin that last published two years ago speaks for itself without being called abandoned.

Then work this ladder in order. It is ordered by what Sanity can stand behind.

**1. Check whether a newer version already works.** Projects pin, then forget they pinned. This resolves the problem more often than expected and costs one query.

**2. Look for existing work on it.** An open issue or pull request referencing the target major means someone is already on it. Link it, and suggest adding their use case as a comment rather than opening a duplicate. A maintainer seeing real users blocked is more likely to ship.

**3. Open a specific, useful issue.** See section 10. This is a good use of the skill's time, because it holds the exact versions and errors a maintainer needs.

**4. Ask whether the plugin is still needed.** Underrated, and often the answer. Studio core absorbs plugin functionality over releases, so something added several majors ago may be solving a problem the Studio now solves natively. Check the current Studio feature set against what the plugin actually does before assuming it has to be replaced. Deleting a dependency is the cheapest possible fix.

**5. Replace or reimplement.** A maintained alternative, or the narrow piece they actually use rebuilt as a custom input. Scope this against what the project uses, not against the plugin's full feature set, which is usually much larger.

**6. Defer, explicitly and temporarily.** Hold the Studio at its current major until the plugin catches up, or vendor the plugin into the project. If the reader chooses this, it needs an exit condition and an owner, or it becomes permanent. Say that.

## 9. What never to recommend

The skill does not recommend forking a third party's plugin, `patch-package`, or installing with relaxed peer resolution as a *solution*.

The reasoning matters more than the rule. These are all decisions to take on permanent maintenance of someone else's code, or to suppress the mechanism that would otherwise warn you about incompatibility. A customer's team may legitimately choose one, but it should be their choice made with open eyes, not a recommendation carrying Sanity's name.

If the customer's team raises one, describe the tradeoff accurately and move on. Specifically on relaxed peer resolution: note that it silences the main signal that would tell them a plugin is incompatible with a future core, which matters most on exactly the upgrade they are doing.

## 10. Drafting a useful issue

When the ladder reaches step 3, draft it. A vague issue gets ignored; a precise one often gets a release. Include:

- **Title:** plugin name, "support for Sanity Studio v\<target major\>"
- The plugin version currently installed and the target Studio version
- The plugin's declared peer `sanity` range, quoted
- The exact install or runtime error, quoted
- Whether the plugin appears to work despite the peer range, if that was tested. Maintainers often only need to widen a range.
- What the project uses the plugin for, in one sentence. This is what tells a maintainer whether the fix is small.
- An offer to test a prerelease

Hand the draft to the reader to post. Do not post it for them.

## 11. Reporting

Give plugins their own section in the report. A table for the routine cases, then a subsection per blocked plugin.

| Plugin | Installed | Latest | Peer `sanity` | Owner | Verdict |
| --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | `sanity-io` / third party / private | compatible, bump to X / **blocked** / needs a decision |

For the owner column, state what the `repository` field showed rather than a support level.

For each blocked plugin, a short subsection: what it is used for, why it blocks, which path applies, and the recommended next step from that path. One paragraph each. If a first-party plugin is blocking, make sure that lands somewhere an SA will see it and forward it.
