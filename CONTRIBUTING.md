# Contributing to `@diamondslab/diamonds-monitor`

Thanks for your interest in contributing! This guide covers how to propose changes.

## Getting started

This package is developed with **Yarn 4** (`yarn@4.10.3`) and Node.js ≥ 18.

```bash
yarn install      # install dependencies
yarn build        # compile TypeScript (tsc --build)
yarn test         # run the test suite (mocha)
yarn lint         # eslint src
yarn lint:fix     # eslint src --fix
yarn format       # prettier --write "src/**/*.{ts,js,json}"
```

Additional scripts: `yarn test:coverage` (nyc + mocha), `yarn test:unit`,
`yarn test:integration`, and `yarn build:watch`.

## Workflow

1. **Fork** the repository and create a feature branch:
   `git checkout -b feature/your-change`.
2. Make your change with tests where appropriate; keep `yarn build`, `yarn test`, and
   `yarn lint` green.
3. Update `CHANGELOG.md` under the `[Unreleased]` section (Keep a Changelog format).
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/) — types
   map to SemVer bumps (e.g. `feat:` → minor, `fix:` → patch).
5. Push and open a **Pull Request** against `main`; fill in the PR template.

## Versioning

This project follows **Semantic Versioning** and **Keep a Changelog**. Releases (version
bump + tag) are cut by the maintainers; contributors only add entries under `[Unreleased]`.

## Reporting bugs & requesting features

Open an issue using the appropriate template under
[`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). For **security** issues, do **not**
open a public issue — follow [`SECURITY.md`](SECURITY.md).

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
