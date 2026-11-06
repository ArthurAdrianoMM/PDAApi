# Releasing

npm is the single channel. Every way of running this project starts from the npm package: `npx`, a global install, the MCP client configs, and the `.mcpb` bundle attached to each GitHub Release.

A release is a version tag. Pushing it runs [.github/workflows/release.yml](../.github/workflows/release.yml), which tests, builds, publishes to npm and creates the GitHub Release. Nothing is published from a laptop after the first version.

## Cut a release

On `main`, with a clean working tree:

```sh
npm version patch   # or minor, or major; see "Which number" below
git push --follow-tags
```

`npm version` does the rest locally, and stops before tagging if anything fails:

1. `preversion`: typecheck and tests.
2. Bumps `version` in `package.json` and `package-lock.json`.
3. `version`: regenerates `openapi.json` (it carries the version) and stages it.
4. Commits as `0.2.0` and tags `v0.2.0`.

The push starts the workflow. Follow it under the repository's **Actions** tab. When it's green, the version is on npm with a provenance badge, and the release page has notes generated from the commits plus `portal-aluno-<version>.mcpb`.

Release notes come from commit subjects, so keep using conventional commits (`feat(mcp): …`, `fix(core): …`). Edit the notes on GitHub afterwards if a release needs a sentence of explanation.

## Which number

Ask whether anyone's existing setup would break.

| Bump | When | Examples |
|---|---|---|
| patch `0.2.1` | A fix; nothing anyone relies on changes. | Handle a new shape of a portal response. |
| minor `0.3.0` | Something is added. | A new route or MCP tool, a new response field, a new flag. |
| major `2.0.0` | Something is removed, renamed or changes meaning. | An HTTP route, an MCP tool name or input, a response field, a CLI flag or environment variable. |

While the version is `0.x`, npm treats a minor bump as possibly breaking, so put breaking changes in a minor and everything else in a patch. Move to `1.0.0` once the routes and tool names are settled; from then on, users can follow `@1` and never get a breaking change.

## Pre-releases

To let someone try a change before everyone gets it:

```sh
npm version prerelease --preid beta   # 0.3.0-beta.0, then 0.3.0-beta.1, …
git push --follow-tags
```

The workflow publishes it under the npm tag `next`, and marks the GitHub Release as a pre-release. `@latest` doesn't move, so nobody gets it by accident. Try it with `npx portal-aluno@next serve`. When it's ready, `npm version minor` (or `patch`) releases `0.3.0` to everyone.

## When a release goes wrong

- **The workflow failed before "Publish to npm".** Nothing was published. Fix the problem on `main`, then move the tag to the fixed commit and push it again:

  ```sh
  git tag -f v0.3.0 && git push -f origin v0.3.0
  ```

  Only do this when npm doesn't have the version yet (`npm view portal-aluno versions`).

- **It failed after publishing.** Re-run the failed job from the Actions tab. The publish step skips a version npm already has.

- **A published version is broken.** Don't unpublish, and never reuse a version number. Release a fixed patch, then point users away from the broken one:

  ```sh
  npm deprecate portal-aluno@0.3.0 "Quebrada: use 0.3.1 ou mais nova."
  ```

## How users get new versions

| How it runs | How it updates |
|---|---|
| MCP clients, configured with `npx -y portal-aluno@latest mcp` | On their own: each client start resolves the newest release. Without `@latest`, npx may keep running a cached old version. |
| `npx portal-aluno@latest serve` | On its own, the same way. |
| `npm install -g portal-aluno` | `npm install -g portal-aluno@latest`. `serve` prints a notice when a newer release exists ([src/cli/update-check.ts](../src/cli/update-check.ts)). |
| Claude Desktop (`.mcpb`) | Download the new bundle from the latest GitHub Release and open it. |

That's why the docs always write `@latest`. After `1.0.0`, `@1` is the safer choice: updates, but never a breaking one.

## One-time setup

Done once, by the package owner.

1. **First publish, by hand.** npm can only trust a workflow for a package that already exists.

   ```sh
   npm login
   npm publish        # runs the tests and the build first (prepublishOnly)
   ```

2. **Trust the workflow.** On npmjs.com, open the package → **Settings** → **Trusted Publisher** → **GitHub Actions**:
   - Organization or user: `ArthurAdrianoMM`
   - Repository: `PDAApi`
   - Workflow filename: `release.yml`
   - Environment: leave empty

3. **Turn off token publishing.** Same page, **Publishing access** → *Require two-factor authentication and disallow tokens*. From then on only the workflow can publish.

4. **Protect the tags (optional).** On GitHub, **Settings** → **Rules** → a tag ruleset for `v*` that only you can create, so a collaborator's push can't start a release.

The trusted publisher matches the repository and the workflow file name exactly. Rename either one and npm refuses the publish with a 404 until the setting is updated.
