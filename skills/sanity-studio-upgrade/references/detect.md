# Detection: establishing repository ground truth

Everything here is read-only. Run it before consulting any breaking-change list, so the list can be filtered against facts rather than assumptions.

## Contents

1. Locate the Studio and check the version floor
2. Resolve installed versions
3. Read the configuration
4. Resolve the TypeScript setup
5. Detect custom code surface
6. Detect deprecated and removed API usage
7. Detect environment and CI
8. Record sheet

---

## 1. Locate the Studio and check the version floor

A Studio is the directory containing `sanity.config.ts` (v3 and later) or `sanity.json` (v2). It may not be the repository root.

```sh
# v3+ Studio
find . -name "sanity.config.*" -not -path "*/node_modules/*"
# v2 Studio
find . -name "sanity.json" -not -path "*/node_modules/*" -maxdepth 3
# v2-era packages, which have no `sanity` package at all
grep -E '"@sanity/(base|desk-tool|default-layout|dashboard)"' package.json
```

**Check the floor before anything else. Studio v2 is a hard stop for this skill.** Any of these means v2:

- The resolved `sanity` major is below 3
- There is no `sanity` dependency and the project depends on v2-era packages such as `@sanity/base` or `@sanity/desk-tool`
- There is a `sanity.json` and no `sanity.config.*`

If so, stop and report per the scope section of `SKILL.md`. Do not continue through the rest of this file, and do not write a plan file.

If both `sanity.json` and `sanity.config.*` exist, the resolved `sanity` version wins. A stray `sanity.json` in a v3+ project is cleanup worth mentioning, not a reason to stop.

If you find several Studios, ask which one to plan for, or plan for each and say so. Monorepos with one Studio per tenant or per environment are common.

## 2. Resolve installed versions

Read the lockfile, not `package.json`. `"sanity": "^4.20.0"` tells you what was requested; the lockfile tells you what is installed, and the gap between them is often several minor versions of breaking changes.

```sh
# Fastest reliable read, if node_modules exists
cat node_modules/sanity/package.json | grep '"version"'

# Otherwise, from the lockfile
grep -A2 '"sanity@' package-lock.json | head -20     # npm
grep -A2 "^  sanity@" yarn.lock | head -20           # yarn
grep -A2 "  sanity@" pnpm-lock.yaml | head -20       # pnpm

# Whole tree at once, if installed
npm ls sanity @sanity/vision @sanity/ui @sanity/icons @sanity/client styled-components react react-dom
```

Record the resolved version of: `sanity`, every `@sanity/*` package, `react`, `react-dom`, `styled-components`, and every third-party plugin (anything matching `sanity-plugin-*` or that appears in the config's `plugins` array).

Note the package manager and its version. It determines whether deduplication is `overrides`, `resolutions`, or `pnpm.overrides`, and pnpm's stricter resolution changes how duplicate majors behave.

### Report duplicates that already exist

**Any package appearing more than once in the tree is a finding to report now, not only something to verify after the upgrade.**

Two majors of a shared package such as `@sanity/ui`, or a plugin dragging in `@sanity/util` and `@sanity/types` from a different Studio major than the installed core, means the tree is already in the state that produces duplicate-context errors and unstyled components. That is worth telling the reader before they change anything, because it may explain bugs they already have, and because fixing it first removes a variable from the upgrade.

Read the dependency tree output rather than only the top-level list. Nested entries are where this shows up:

```sh
pnpm why @sanity/ui @sanity/icons @sanity/client @sanity/util @sanity/types react styled-components
# npm
npm ls --all @sanity/ui @sanity/icons @sanity/client @sanity/util @sanity/types react styled-components
```

If you read the lockfile directly instead, **anchor the package name and keep prerelease suffixes**, or you will report findings that do not exist. A loose pattern turns `babel-plugin-styled-components@5.1.36` into a styled-components v5 duplicate, `@sanity/ui@5.0.0-alpha.3` into a nonexistent stable 5.0.0, and `@sentry/react@8.55.2` into a React version:

```sh
grep -oE "[/'\"]@?[a-zA-Z0-9@/._-]+@[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?" pnpm-lock.yaml \
 | sed -E "s|^['\"/]+||" \
 | grep -E "^(@sanity/(ui|icons|client|util|types)|styled-components|react)@" \
 | sort -u
```

Put what you find in the report as a finding with the specific versions and which dependency pulled each one in. Do not reduce it to a generic "check for duplicates after installing" line.

This is the **observed** tree, so it is a finding. What the tree will look like after the upgrade is a prediction, and `package-coupling.md` covers why a planner must not assert it.

### Watch for more than one dependency tree

A repository can contain several installs, and they can disagree. Common shapes: a Studio in a subdirectory with its own lockfile while the repository root has another; a root manifest that depends on `sanity` for linting; a monorepo with a Studio and a frontend using different package managers.

When this happens:

- Record which tree you are planning for, and say so in the report header
- Record the sibling trees' `sanity` versions too, because two different Studio majors resolving in one repository will confuse editor TypeScript and can mislead anyone reading versions from the wrong place
- Take every version fact from the target tree's lockfile. A version read from the wrong tree looks authoritative and is simply about a different install
- If a deployment pipeline builds from a different tree or a different manifest than the one you are planning for, that mismatch is a finding on its own

## 3. Read the configuration

Read these in full, not by grep. They are short and they answer many questions at once.

- `sanity.config.ts` (or `.js`, or the workspace array if there are several)
- `sanity.cli.ts` (or `.js`)
- `package.json`, including the `scripts` block
- `sanity.json` if this is v2

From `sanity.config.*`, record whether each of these is present:

| Look for | Why it matters |
| --- | --- |
| `auth` block, `auth.providers`, `auth.mode`, `auth.loginMethod` | Highest-severity v6 change; affects login |
| `search` or `enableLegacySearch` | Whether the v6 search default change is already overridden |
| `plugins` array contents | Each entry needs a compatibility check |
| `document.actions` or `document.badges` | Custom actions need testing against newer document contexts |
| `tools` | Custom tools often reach into Studio internals |
| `form` or `beta.form` | Some of these options were removed |
| `scheduledPublishing` | Deprecated; separate migration |
| Multiple workspaces | Workspace routing behavior changed |
| `basePath` | Interacts with the CLI-level `basePath` |

From `sanity.cli.ts`, record:

| Look for | Why it matters |
| --- | --- |
| `deployment.autoUpdates` | Determines the whole auto-update section, and whether the 6.9.0 enforcement change matters |
| `deployment.appId` | Needed for version-channel selection |
| `studioHost` | See the trap note in `package-coupling.md` |
| `vite` | Custom Vite config is the most likely v6 build failure |
| `reactStrictMode` | Whether the v6 default is already set |
| `typegen`, `schemaExtraction` | Whether codegen is wired up |
| Values from a function or env vars | Signals multi-tenant or multi-environment deploys |

If config values come from a helper function or environment variables, read the helper. A templated `studioHost` or a per-tenant `projectId` means there are multiple deployments to upgrade, which belongs in the plan.

## 4. Resolve the TypeScript setup

```sh
cat tsconfig.json
```

You need the effective `moduleResolution`. Recent `@sanity/*` packages resolve types through `exports` and drop `typesVersions`, so legacy `node10` resolution cannot resolve subpath types at all.

If `tsconfig.json` has an `extends` pointing outside the repository, **follow it if you can and say so if you cannot.** An unresolved `moduleResolution` is a genuine blocker for any plan involving subpath imports, and it belongs in the human questions section by name rather than being quietly skipped.

```sh
# If TypeScript is available, this resolves the full inherited config
npx tsc --showConfig 2>/dev/null | head -40
```

Also record whether `typescript` and `@types/react-dom` are actual devDependencies or are being inherited from a workspace root.

## 5. Detect custom code surface

The size of the upgrade is mostly determined by this. Count, then look at examples.

```sh
# Which Sanity UI primitives are used, and how much
grep -rn "from '@sanity/ui'" src/ --include=*.ts --include=*.tsx | wc -l
grep -rn "from '@sanity/ui'" src/ --include=*.ts --include=*.tsx

# Icons: barrel imports break when @sanity/icons drops them
grep -rn "from '@sanity/icons'" src/ --include=*.ts --include=*.tsx

# Custom Studio components
grep -rln "defineField\|defineType\|defineArrayMember" src/ | wc -l
grep -rn "components:\s*{" src/ --include=*.ts --include=*.tsx | head -20

# Reaching into Studio internals: highest risk, no compatibility guarantee
grep -rEn "sanity/_internal|sanity/_singletons" src/

# Portable Text editor DOM coupling, in source, styles, and tests
grep -rn "data-slate" . --include=*.ts --include=*.tsx --include=*.js --include=*.css --include=*.scss --include=*.styl
grep -rn "data-slate" e2e/ tests/ cypress/ playwright/ 2>/dev/null
```

If `sanity/_internal` or `sanity/_singletons` imports exist, raise it prominently. Internal APIs carry no compatibility guarantee and change without changelog entries. A multi-major upgrade over internal APIs is a different, riskier project, and the honest recommendation may be to get off them first.

Look at one or two representative custom components rather than all of them. One example reveals the patterns in use, which is what determines whether a rename is twenty edits or four hundred.

## 6. Detect deprecated and removed API usage

```sh
grep -rEn "unstable_use|useTimeLineStore|useDocumentVersionInfo|enableLegacySearch|enhancedObjectDialog|sheetList|useClickOutside|useElementRect|useForwardedRef|useArrayProp|ConditionalWrapper" src/ sanity.config.* sanity.cli.*

# Sanity UI props removed in its v4
grep -rn "space={" src/ --include=*.tsx | wc -l
grep -rEn "<Grid[^>]*(columns|rows)=" src/ --include=*.tsx
grep -rEn "focusFirst|focusLast|boundaryElement|allowedAutoPlacements" src/ --include=*.tsx

# Previews that resolve through a reference: relevant to the search strategy change
grep -rEn "(title|subtitle|description):\s*'[A-Za-z0-9_]+\.[A-Za-z0-9_.]+'" src/
```

## 7. Detect environment and CI

```sh
node -v
cat .nvmrc .node-version 2>/dev/null
grep -n '"engines"' -A4 package.json

# Sanity CLI invocations: newer CLIs reject unknown flags instead of ignoring them
grep -rEn "sanity (start|dev|build|deploy|undeploy|schema|schemas|typegen|dataset|datasets|graphql|tokens|exec)" \
  package.json .github/ .gitlab-ci.yml Dockerfile* 2>/dev/null
```

The Node version that matters is the one in CI and on the build host, not the one on this machine. If you can only see the local version, say so and ask.

Also check whether the Studio shares a repository with other applications. If it does, a Node bump should be scoped to this project's CI job rather than the whole runner, and hoisted React may be shared with an app that pins a different version.

## 8. Record sheet

Carry this forward into the report. If a value is unknown, write "unknown" rather than guessing, and add it to the human questions.

```
Studio path:
Tree planned for:         path to the lockfile every version below came from
Other trees in repo:      paths + their resolved `sanity` versions
Config format:            sanity.config.* (v3+ required; v2 is a hard stop)
Workspaces:               names, count
Multiple deployments:     yes/no, how they differ

sanity (resolved):
@sanity/* (resolved):
Third-party plugins:
react / react-dom:
styled-components:
Duplicate packages:
Package manager:
Pre-existing duplicates:  package@version pairs + what pulled each in

Node: local / CI / build host
engines.node:
moduleResolution:         value, or unresolved and why
typescript a devDep:      yes/no/inherited

auth block:               absent | providers | mode | loginMethod
search config:            absent | strategy
autoUpdates:              true | false | unset
appId:                    set | unset
studioHost:               set | unset
custom vite config:       yes/no
reactStrictMode:          set | unset

@sanity/ui import sites:  count
@sanity/icons imports:    count, barrel or subpath
custom components:        count + kinds
document actions/badges:  yes/no
custom tools:             yes/no
structure customization:  yes/no
internal API imports:     yes/no  ← raise prominently if yes
data-slate references:    yes/no  ← raise prominently if yes
deprecated APIs found:
CLI invocations in CI:
```
