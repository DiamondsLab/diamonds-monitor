# Changelog

All notable changes to the `@diamondslab/diamonds-monitor` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-11-25

### Added
- **DiamondMonitor Class**: Real-time monitoring for ERC-2535 Diamond Proxy contracts
  - Health check system with customizable intervals
  - Event logging for DiamondCut operations
  - Alert system for failed checks and slow responses
  - Graceful shutdown support with cleanup
  - Configurable alert thresholds and polling intervals

- **Comprehensive Test Suite**:
  - Unit tests for DiamondMonitor with 90%+ coverage
  - Integration tests for deployment monitoring
  - RPC integration tests for Sepolia and Mainnet
  - Upgrade monitoring tests with pre/post validation
  - Performance and stress testing suite
  - Long-running stability tests
  - Concurrent monitoring support (5-10 diamonds)

- **TypeScript Support**:
  - Full type definitions for all APIs
  - Exported interfaces: `DiamondMonitorConfig`, `HealthStatus`, `FacetInfo`
  - ESM and CommonJS module support

- **Standalone Utility**:
  - Command-line interface for monitoring deployed diamonds
  - Environment variable configuration
  - Real-time health checks and event logging

### Changed
- Updated to use `@diamondslab/diamonds` workspace package
- Improved error handling and logging throughout
- Enhanced documentation with usage examples
- Better event listener cleanup on shutdown

### Fixed
- Event listener memory leaks on shutdown
- Race conditions in concurrent health checks
- Proper handling of network disconnections

### Dependencies
- ethers: ^6.4.0
- winston: ^3.17.0
- @diamondslab/diamonds: workspace:*

### Developer Notes
- Node.js >= 18.0.0 required
- Yarn >= 4.0.0 required for workspace protocol support
- See README.md for usage examples and API documentation

## [0.1.0] - 2024-XX-XX (Initial Draft - Not Published)

### Added
- Initial project structure
- Basic monitoring concepts
- Preliminary test framework

---

## Development Guidelines

### Version Numbers
- **MAJOR**: Breaking changes to public API
- **MINOR**: New features, backward-compatible
- **PATCH**: Bug fixes, backward-compatible

### Changelog Sections
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

### Release Process
1. Update version in `package.json`
2. Document changes in this CHANGELOG
3. Run full test suite: `yarn test`
4. Run linting: `yarn lint`
5. Build package: `yarn build`
6. Test package locally: `npm pack && npm install -g <tarball>`
7. Publish to npm: `npm publish` (or `npm publish --tag beta` for pre-releases)
