<!--
  Thanks for contributing to uoplan! Please fill out the sections below.
  Keep the PR title in Conventional Commit form, e.g. `fix(web): …` — it becomes
  the squash-merge subject and feeds release-please.
-->

## What does this PR do?

<!-- A clear, concise description of the change and the motivation behind it. -->

## Related issues

<!-- e.g. "Closes #123", "Fixes #456". Leave blank if none. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behaviour)
- [ ] Data correction (course / schedule / grade / prerequisite data)
- [ ] Docs / chore / tooling

## Areas touched

<!-- Tick the workspaces this PR changes. -->

- [ ] `apps/web`
- [ ] `apps/worker`
- [ ] `apps/scraper`
- [ ] `apps/native`
- [ ] `apps/cli`
- [ ] `packages/*` (engine / core / proto / data / …)
- [ ] docs / CI / repo config

## Checklist

- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` pass
- [ ] `pnpm test` passes (and `pnpm --filter @uoplan/engine test:rust` if the engine changed)
- [ ] `pnpm check:arch`, `pnpm check:i18n`, and `pnpm check:fallow` pass
- [ ] New/changed user-facing strings are translated in **both** English and French (`pnpm i18n:sync`)
- [ ] Tests added/updated for the behaviour I changed
- [ ] Relevant `docs/` pages updated (if I touched a documented subsystem)

> Native-only changes: verify with `pnpm --filter native exec tsc --noEmit`,
> `pnpm --filter native test`, and `pnpm exec oxfmt <files you touched>`.

## Screenshots / recordings

<!-- For UI changes, before/after screenshots or a short clip are very helpful. -->

## Additional notes

<!-- Anything else reviewers should know: trade-offs, follow-ups, open questions. -->
