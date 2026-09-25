# Publishing ganttcraft

The library publishes from `.github/workflows/publish-npm.yml` when a GitHub release is published. The workflow checks that its `vX.Y.Z` tag matches `packages/ganttcraft/package.json`, that the tagged commit is on `main`, and that lint, tests, build, and consumer examples pass before publishing. Prereleases are skipped.

## One-time npm setup

After the workflow is merged to `main`, open the `ganttcraft` package settings on npm and add a GitHub Actions trusted publisher with these values:

| Setting | Value |
| --- | --- |
| GitHub user or organization | `Vietnoirien` |
| Repository | `GanttCraft` |
| Workflow filename | `publish-npm.yml` |
| Allowed action | `npm publish` |

Leave the environment name empty. Trusted publishing uses GitHub OIDC, so no `NPM_TOKEN` secret is needed. The workflow must run on a GitHub-hosted runner with Node 24 and npm 11.5.1 or newer.

## Release a version

1. Bump `packages/ganttcraft/package.json` to the next version and merge that change to `main`.
2. Create a `vX.Y.Z` tag on that `main` commit and publish a GitHub release for the tag.
3. Check the **Publish ganttcraft to npm** Actions run and the resulting npm package version.

Publishing an existing version will fail because npm versions are immutable. The documentation site's updater checks npm daily and opens a separate PR when the published version changes.

The GanttCraft-site repository has **Allow GitHub Actions to create and approve pull requests** enabled under **Settings → Actions → General → Workflow permissions**. Keep it enabled for site update PRs. Its updater uses the repository's scoped `GITHUB_TOKEN`; it does not need a cross-repository secret.
