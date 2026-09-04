---
name: sanity-studio-upgrade
description: Produces a tailored Sanity Studio upgrade plan by inspecting the repository's installed versions, config, and source, then reporting only the breaking changes that actually apply. Covers Studio v3 and later; v2 projects are identified and redirected, not planned. Use this skill whenever someone wants to upgrade, migrate, or modernize a Sanity Studio across one or more major versions from v3 onward, asks what will break if they bump the `sanity` package, asks why their Studio broke after an upgrade, or asks how far behind their Studio is. Triggers on "upgrade sanity studio", "migrate our studio to v6", "bump sanity", "what breaks if we upgrade", "our studio is on an old version", "sanity upgrade plan", "is our studio out of date", "we are several majors behind". DO NOT load for upgrading non-Sanity dependencies, for Content Lake `apiVersion` questions, for content or schema migrations that change documents, or for setting up a new Sanity project.
compatibility: Requires network access to the npm registry and sanity.io docs for version and changelog lookups
---

# Sanity Studio upgrade planner

Generate an upgrade plan for the Sanity Studio in the current repository.

The plan's value is **subtraction**. A list of every breaking change between two versions already exists; it is called the changelog, and it is not useful to someone mid-upgrade. This skill produces the much shorter list of changes that apply to *this* repository, plus the questions only a human can answer.

## Three rules that determine whether the output is trustworthy

**1. Never state a version number from memory. Look it up, and confirm it exists.**

Package versions change weekly. Every version in the report must come from either the repository's lockfile (for current state) or a live registry query (for targets). If a lookup is not possible, say so in the report rather than guessing. A plan that names a stale "latest" is worse than no plan, because the reader will act on it.

There is a second, worse version of this failure: a version number that was never published at all, arrived at by assuming one package tracks another's numbering. That one fails at install. Any version you are about to describe as "lockstep" or "matches core" needs an existence check first.

The same applies to API names. An export, an import subpath, or a function signature recalled from memory is a guess, and it is a guess the reader will paste into their editor. Read it from the package's README or `exports` map, or mark it with an inline `// VERIFY:` comment **at the snippet itself**. See section 6 of `plugins.md` and section 8 of `report-template.md`.

**2. Read and report. Never modify.**

Inspect files, run read-only shell commands, query registries. Do not edit `package.json`, config files, or source. Do not run installs. The reader decides what to change; a planner that edits code will be turned off. If the user explicitly asks you to perform the upgrade afterward, that is a separate task they have consented to.

**3. Separate what you verified from what you inferred.**

Every finding lands in one of three buckets: confirmed applicable (you found the condition in the repo), needs a human answer (you cannot determine it from code), or not applicable (omit it entirely). Never pad the report with items you could not check. An honest short report beats a comprehensive-looking one.

One consequence is easy to miss and worth stating outright: **a read-only planner has no dependency resolver, so it cannot know what a tree will contain after a change.** Predictions about deduplication belong in the report as expectations with the verification command attached, never as findings. See `package-coupling.md`.

## Scope: v3 and later

This skill plans upgrades from Studio v3 onward. **Studio v2 is out of scope and is a hard stop.**

The reason is not that v2 is hard. It is that v2 to v3 is a rewrite of the Studio's configuration and plugin layer rather than a dependency upgrade: the config format changed, the "parts" system that v2 plugins and overrides were built on no longer exists, packages were consolidated, and much of the v2-era plugin ecosystem was never ported. A generated plan for that boundary would be a list of confident-sounding specifics that this skill cannot verify, handed to someone about to spend weeks on the work. That is the worst possible output.

**If you detect v2, stop and report** rather than planning. Step 1 covers detection and what to say. Do not write a plan file for a v2 project.

## Procedure

### Step 1: Establish ground truth, and check the version floor

Read `references/detect.md` and follow it. It lists the files to read, the commands to run, and the facts to record.

The single most common mistake is reading versions from `package.json`. Caret ranges are not installed versions. Get the resolved version from the lockfile.

The second most common mistake is reading them from the wrong lockfile. A repository can contain several installs that disagree, so decide which tree the plan is for, take every version fact from that tree, and name it in the report header.

If there is no Sanity Studio in this repository, say so and stop.

**Then check the floor before doing anything else.** If the resolved `sanity` major is below 3, or there is no `sanity` package and the project depends on v2-era packages such as `@sanity/base` or `@sanity/desk-tool`, or there is a `sanity.json` and no `sanity.config.*`, this is a v2 project. Stop there and tell the reader:

1. What you detected, and the evidence for it
2. That this skill covers v3 and later, and why v2 to v3 is a different kind of project: a rewrite of the configuration and plugin layer, not a version bump
3. That the right starting point is the official v2 to v3 migration guide, which they should find on the Sanity docs site rather than take from you second-hand
4. That every v2-era plugin needs its own compatibility check, since many were never ported
5. That once they are on v3, running this skill again will plan the rest of the span, which is a much smaller job

Be useful about it. A hard stop that explains itself and points somewhere is a good answer; a refusal is not. But do not soften it into a partial plan, and do not estimate the v2 to v3 work.

If both `sanity.json` and `sanity.config.*` are present, treat the resolved `sanity` version as authoritative. A leftover `sanity.json` in an otherwise v3+ project is worth mentioning as cleanup, not a reason to stop.

### Step 2: Determine the span

You need two versions: **from** (resolved, installed) and **to** (the target).

Read `references/version-lookup.md` for how to query current versions and changelogs authoritatively.

**The target is `latest`.** Recommend it and give the reasoning. Landing short means doing the whole job and still being behind, and more importantly, current plugin versions track current core, so an older core with current plugins often produces a worse dependency tree than the newest release does. Report the target's publish date and a one-line fallback so the reader can apply constraints you cannot see, but that is disclosure, not a hedge, and it does not change the recommendation. Deviate only for a constraint the reader has actually stated, and then give the pin a review date.

State the span explicitly in the report. A v3 project and a v5.31 project are completely different jobs and the reader needs to know which one they have.

### Step 3: Load only the boundaries you cross

Read `references/boundaries.md`, but only the sections for major boundaries in the span. A project on 5.31 crossing into v6 does not need the v3 to v4 or v4 to v5 sections, and loading them wastes context and invites irrelevant findings.

Then read `references/package-coupling.md`. It applies to every span.

### Step 4: Fetch what the references do not cover

`references/boundaries.md` declares **two** bounds on its within-line coverage, and both need respecting.

Fetch the changelog for any part of the span that falls **above the upper bound** or **below the lower bound**. A project starting below the lower bound needs two fetches: from its current version up to that bound, and from the upper bound to the target. The curated middle is used as-is.

The lower bound matters as much as the upper one, and it fails more quietly. Without it you will trust the file for a range it never examined and report that nothing there applies, which reads as a verified finding and is actually an unexamined gap. **Never state that a range is clean unless it sits inside the declared bounds or you fetched it yourself and got real content back.**

That last clause is not padding. Below the lower bound the upstream changelog does not exist at all, so the fetch returns almost nothing, and **an empty fetch is not a clean range.** `boundaries.md` says which range this affects and what to report instead. Reporting silence as "nothing applies" there is the single easiest way for this skill to produce a confident lie.

Pay particular attention to breaking changes that shipped in **minor** releases without being labelled as breaking. Those are the ones that surprise people, because nobody reads minor release notes across forty releases. The references list known examples; assume more exist.

### Step 5: Test applicability

For each candidate change, find the condition in the repository. If you cannot determine it from code, it goes in the human questions section, not in the findings.

Examples of the difference:

- "Custom auth providers now replace built-ins instead of appending" → grep the config for an `auth` block. Present or absent. **Determinable.**
- "Default search strategy changed, results will shift" → whether that matters depends on how editors search. **Not determinable. Ask.**

Prefer conditions you can actually evaluate. `grep -r "data-slate"` is a real test. "Do you have complex custom components?" is not.

### Step 6: Resolve the dependency graph

Apply `references/package-coupling.md`. This is where most upgrades actually break, and it is the part a changelog cannot tell you, because it depends on which packages this project happens to depend on directly.

The rule that matters most: for any `@sanity/*` package the project depends on **directly**, check what version the *target* `sanity` release depends on and match that, rather than taking the package's own `latest`. Taking `latest` for a shared package like `@sanity/ui` puts two majors of it in one dependency tree, which produces duplicate-context errors and unstyled components that look like unrelated bugs.

### Step 6b: Assess plugins

Read `references/plugins.md` and follow it whenever the project has any plugin, which is nearly always.

Plugins block more upgrades than the Studio itself does, so they get their own pass and their own section in the report. Three things to carry into it: verify every plugin's compatibility rather than assuming it from who publishes it; let ownership decide the *path* once something is incompatible, not the verdict; and verify the *API shape* of any snippet you write against the package, separately from verifying its version, because a compatible version can still have renamed the export you are about to recommend.

### Step 7: Write the report

Follow `references/report-template.md` exactly. Write it to `SANITY-UPGRADE-PLAN.md` in the repository root unless the user names a different path.

Write a file rather than only printing to the terminal. The plan usually needs to reach people who are not at this keyboard: a lead, a reviewer, a support engineer. A file can go into a pull request or be pasted into a thread; terminal output cannot.

## Judgment calls worth making explicitly

**Recommend a sequence, not a single jump.** Crossing several majors in one commit makes failures impossible to attribute. Suggest intermediate stops at the last release of each major, and say why: it isolates each set of changes.

But a stop is only real if it is reachable. Each one needs its plugin versions resolved, because a plugin peering only recent majors can make an intermediate stop impossible to install. If you cannot resolve a stop, label it provisional rather than presenting the sequence as validated. Fewer verified stops beat more hypothetical ones.

**Size the work honestly.** If the project has two files importing `@sanity/ui` and no custom auth, say the upgrade is small. Inflating scope to look thorough wastes the reader's week. Equally, if the project imports from `sanity/_internal` or has a large custom component surface, say the upgrade is substantial rather than producing a plan that makes hard work look easy.

**Make the plan survive being skimmed.** It will be. A multi-boundary plan runs to several thousand words, and the person reading it is about to spend a week on the work, not an afternoon studying the document. So the top of the plan carries the whole thing in one screen, everything below it is reference to be read as the work reaches it, and findings are grouped by what the reader has to do rather than by which release the change came from. The specific failure to design against: a change that fails silently, sitting in a uniform table between two cosmetic ones, at identical visual weight. Length is not the enemy; flat weighting is.

**Write for the engineer who has to do the work, and describe the tree rather than the team.** This plan is usually read by someone at the customer, often someone who did not make the decisions that produced the current state. Keep the evidence, the specificity and the severity exactly as strong as the facts support: softening a real blocker or a real cost is a disservice, and an engineer can tell. What to drop is the implied verdict. "The deploy pipeline builds from the caret ranges rather than the lockfile" and "whoever set this up got it wrong" contain the same finding, and only one of them gets acted on. Reserve "you" for what to do next. Stay inside the upgrade, too: an unused dependency is not an upgrade finding, and a plan that drifts into general code review spends the reader's attention on things that do not gate the work.

**Name what you could not see.** Monorepos hide things: a `tsconfig.json` that extends a base file outside the repository, a workspace root that hoists React, a CI config in another directory. If a fact you needed was out of reach, put it in the human questions section by name. "I could not read `moduleResolution` because your tsconfig extends a file outside this repo" is useful. Silently omitting it is not.

**Do not promise roadmaps.** If asked whether a deprecated API will return or be removed, describe its current documented state and stop. Never speculate about future releases.

## Reference files

| File | Read when |
| --- | --- |
| `references/detect.md` | Always, at step 1 |
| `references/version-lookup.md` | Always, at step 2 and step 4 |
| `references/boundaries.md` | Step 3, only the sections in the span (v3 onward) |
| `references/package-coupling.md` | Always, at step 6 |
| `references/plugins.md` | Step 6b, whenever the project has plugins |
| `references/report-template.md` | Step 7 |
