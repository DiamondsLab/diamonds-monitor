# Changelog

All notable changes to the `@diamondslab/diamonds-monitor` package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Version headings are intentionally unlinked: no release tags are published to the
     `DiamondsLab/diamonds-monitor` remote yet (`git ls-remote --tags origin` is empty as
     of 2026-07-06). Once tags are pushed, replace these headings with compare links, e.g.
     `## [1.1.0]` → `[1.1.0]: https://github.com/DiamondsLab/diamonds-monitor/compare/v1.0.4...v1.1.0`.
     Note on version skew: npm has published `@diamondslab/diamonds-monitor@1.0.4`, but the
     pre-1.0 entries below were labeled `0.x` in the original changelog; they predate the
     `1.0.x` publish line and are kept for history. -->

## [Unreleased]

## [1.1.0] - 2026-07-06

Packaging and repository-hygiene release. No public API or runtime behavior changes.

### Added

- `exports` back-compat subpaths: `./dist/*` (deep imports of any built module) and
  `./package.json`, alongside the existing `.` (main) and `./standalone` entry points.
- `@eslint/js`, `@eslint/eslintrc`, and `globals` are now self-declared as
  `devDependencies` (previously resolved only via monorepo workspace hoisting), so the
  package's own lint works outside the monorepo.

### Changed

- `repository` URL casing corrected to `DiamondsLab` and switched to the `git+https://`
  form.
- `files` whitelist is dist-only now — the built `dist/` and `src/` are no longer both
  shipped; **source is removed from the tarball**. git-URL installs must build the package;
  the npm tarball is unaffected (it ships prebuilt `dist/`).
- Source and declaration maps are no longer emitted.
- Single ignore strategy: the `files` whitelist is the sole mechanism (legacy `.npmignore`
  removed).
- `hardhat` peer/dev dependency pinned to `2.28.0` (down from the Hardhat 3.x line) to
  match the rest of the toolchain.

### Fixed

- The `LICENSE` file was 0 bytes; it now ships the full MIT license text.
- `clean` now also removes `tsconfig.tsbuildinfo`, so a clean build always emits `dist/`
  (this prevented a possible source-only / dist-less publish where an up-to-date build info
  file suppressed emit).
- `lint` script repointed from a monorepo-root escape to the package's own ESLint config.
- Standalone entry-point wiring for `@diamondslab/diamonds` corrected.

### Removed

- Legacy `.npmignore` (superseded by the `files` whitelist).

## [1.0.4] - 2025-12-16

### Changed

- Removed `hardhat` from `devDependencies` and applied peer-dependency fixes for
  `@diamondslab/diamonds`. This is the version published to npm.

## [1.0.2] - 2025-11-25

### Changed

- Peer-dependency corrections for the `@diamondslab/diamonds` workspace package.

## [1.0.0] - 2025-11-25

Initial published `1.0.x` release under the `@diamondslab/diamonds-monitor` scope. Feature
set (carried forward from the pre-1.0 draft below):

### Added

- **`DiamondMonitor` class**: real-time monitoring for ERC-2535 Diamond Proxy contracts —
  health-check system with customizable intervals, DiamondCut event logging, an alert
  system for failed checks and slow responses, graceful shutdown with cleanup, and
  configurable thresholds/polling intervals.
- **`FacetManager`** and diamond utilities for facet analysis, selector validation, and
  building diamond cuts.
- **Standalone utility / CLI** for monitoring deployed diamonds via environment-variable
  configuration.
- **TypeScript support**: full type definitions and exported interfaces
  (`DiamondMonitorConfig`, `HealthStatus`/`HealthCheckResult`, `FacetInfo`), with ESM and
  CommonJS output.
- Comprehensive unit, integration, RPC, upgrade, and stress/stability test suites.

### Changed

- Adopted the `@diamondslab/diamonds` workspace package; improved error handling, logging,
  and event-listener cleanup on shutdown.

### Fixed

- Event-listener memory leaks on shutdown, race conditions in concurrent health checks, and
  handling of network disconnections.

## [0.2.0] - 2025-11-25

Pre-publication draft (labeled `0.2.0` in the original changelog); its contents shipped as
the `1.0.0` release above.

## [0.1.0] - 2024 (initial draft — not published)

### Added

- Initial project structure, basic monitoring concepts, and a preliminary test framework.
