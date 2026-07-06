# Release Runbook — `@diamondslab/diamonds-monitor`

Tag-triggered OIDC publish (`.github/workflows/release.yml`). **[Eng]** = any
maintainer; **[Owner]** = DiamondsLab org admin + npm `@diamondslab` access.

- **Package:** `@diamondslab/diamonds-monitor` (public) · **Registry:** npmjs.com
- **Repo:** <https://github.com/DiamondsLab/diamonds-monitor> (submodule of diamonds-dev-env)
- **Toolchain:** Node ≥ 18, Yarn 4.10.3 · **Tag = publish trigger**
- No git hooks (instant push). No standalone `yarn.lock` — CI/publish use
  `yarn install --no-immutable`.

> Kit-instantiated (M3-E5). First cut on this runbook: **v1.1.0** (from 1.0.4).
> **Publishing is irreversible**; recovery is forward-only (§7). Replace `X.Y.Z`.

---

## 0. Preflight — [Eng], gated by [Owner]

- [ ] Clean tree on `release/vX.Y.Z`.
- [ ] `yarn build && yarn lint && yarn test` green locally.
- [ ] CI green on origin (Actions).
- [ ] **[Owner]** npm Trusted Publisher for `@diamondslab/diamonds-monitor` bound to
      `DiamondsLab/diamonds-monitor` + `release.yml`, **exact org casing** (`DiamondsLab`),
      **"Allow npm Stage publish" on**. Existing package → direct bind (no bootstrap).
- [ ] **[Owner]** §B rulesets (branch + `v*` tag with releaser bypass, B4 self-test).
- [ ] Consumer-green fast+full.

## 1. Version bump — [Eng]

```bash
npm pkg set version=X.Y.Z     # 1.1.0 for this cut
node -p "require('./package.json').version"
```

## 2. Finalize the changelog — [Eng]

- [ ] `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD`; fresh `[Unreleased]` above.
- [ ] Version headings unlinked until tags exist on the remote (zero remote tags at 1.1.0).

## 3. Build + pack audit — [Eng]

```bash
yarn build
npm pack --dry-run
```

- [ ] Manifest matches the **M3-E2 baseline: 62 files** (~94 kB): `dist/**` (no `.map`),
      `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json`. **Excludes** `src/`.
- [ ] `npm pack`; install into a throwaway project; probe `.`, `./standalone`, `./package.json`.

```bash
git add package.json CHANGELOG.md && git commit -m "chore(release): vX.Y.Z"
```

## 4. Merge to `main` + tag — [Owner]

- [ ] **[Owner]** merge PR `release/vX.Y.Z` → `main` (CI green).
- [ ] **[Owner]** push the tag — **triggers the irreversible publish**:

```bash
git checkout main && git pull
git tag vX.Y.Z && git push origin vX.Y.Z
```

> Tag-only trigger. If a ruleset blocks the push, create the ref via
> `gh api repos/DiamondsLab/diamonds-monitor/git/refs -f ref=refs/tags/vX.Y.Z -f sha=<sha>`.

## 5. Verify — [Owner/Eng]

- [ ] `Release` workflow green.
- [ ] `npm view @diamondslab/diamonds-monitor version` → `X.Y.Z`; provenance badge.
- [ ] Clean install resolves `.`, `./standalone`, `./package.json`.
- [ ] Diagnose a publish failure with `npm publish --loglevel http`: id-token GET 200 then
      registry `oidc/token/exchange` POST 404 = npm-side config mismatch (fix + re-run; no new tag).

## 6. Dry-run rehearsal — [Eng] (before §4)

```bash
npm publish --dry-run
npm pack
```
Then root `yarn compile` + consumer-green fast+full.

## 7. Rollback / recovery

Pre-tag: don't push the tag; revert the `main` merge. Post-publish (irreversible):

```bash
npm deprecate '@diamondslab/diamonds-monitor@X.Y.Z' 'Broken release — use X.Y.(Z+1)'
# fix forward: repeat with X.Y.(Z+1)
npm dist-tag add @diamondslab/diamonds-monitor@X.Y.(Z+1) latest
```

## 8. Post-release — [Eng] + [Owner]

- [ ] Bump the monorepo root submodule pointer; root builds green; consumer-green.
- [ ] **[Owner] §G:** npm Publishing access → "Require 2FA and disallow tokens" (after the
      trusted publisher binds) — blocks manual/token publishes so provenance can't be skipped.
- [ ] (Optional) GitHub Release with the `[X.Y.Z]` changelog section.
