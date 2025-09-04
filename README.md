# Diamonds Monitor

Professional monitoring and management tools for ERC-2535 Diamond Proxy contracts.

## Features

- 💎 **Diamond Contract Monitoring**: Real-time monitoring of diamond proxy contracts
- 🔍 **Facet Management**: Comprehensive tools for managing facets and function selectors
- 📊 **Health Checks**: Automated health monitoring and diagnostics
- 🚨 **Event Monitoring**: Track diamond cut events and contract changes
- 🛠️ **Developer Tools**: Utilities for diamond development and debugging
- 📈 **Analytics**: Performance metrics and usage analytics

## Installation

```bash
npm install diamonds-monitor
# or
yarn add diamonds-monitor
```

## Quick Start

```typescript
import { DiamondMonitor } from 'diamonds-monitor';
import { ethers } from 'ethers';

// Initialize provider and monitor
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const monitor = new DiamondMonitor({
  provider,
  diamondAddress: '0x...',
  enableEvents: true,
  enableMetrics: true
});

// Get diamond information
const info = await monitor.getDiamondInfo();
console.log(`Diamond has ${info.facets.length} facets`);

// Perform health check
const health = await monitor.healthCheck();
if (health.isHealthy) {
  console.log('Diamond is healthy ✅');
} else {
  console.error('Diamond has issues:', health.errors);
}

// Monitor events
const events = await monitor.monitorEvents();
console.log(`Found ${events.length} diamond cut events`);
```

## API Reference

### DiamondMonitor

Main class for monitoring diamond contracts.

#### Constructor

```typescript
constructor(config: MonitorConfig)
```

#### Methods

- `getDiamondInfo(): Promise<DiamondInfo>` - Get comprehensive diamond information
- `healthCheck(): Promise<HealthCheckResult>` - Perform health diagnostics
- `monitorEvents(fromBlock?: number): Promise<DiamondEvent[]>` - Monitor diamond events
- `getFacetBySelector(selector: string): Promise<string>` - Get facet for a function selector
- `getFacetSelectors(facetAddress: string): Promise<string[]>` - Get selectors for a facet
- `getFacetAddresses(): Promise<string[]>` - Get all facet addresses

### FacetManager

Tools for managing diamond facets.

#### Methods

- `analyzeFacets(facets: FacetInfo[]): Promise<AnalysisResult>` - Analyze facet conflicts and dependencies
- `createAddFacetCut(facetAddress: string, selectors: string[]): DiamondCut` - Create cut for adding facet
- `createReplaceFacetCut(facetAddress: string, selectors: string[]): DiamondCut` - Create cut for replacing facet
- `createRemoveFacetCut(selectors: string[]): DiamondCut` - Create cut for removing selectors
- `validateDiamondCut(cuts: DiamondCut[], currentFacets: FacetInfo[]): ValidationResult` - Validate cuts

### Utilities

Helpful utility functions for diamond development.

- `getSelector(signature: string): string` - Convert function signature to selector
- `getSelectors(signatures: string[]): string[]` - Convert multiple signatures to selectors
- `formatAddress(address: string, length?: number): string` - Format address for display
- `isValidAddress(address: string): boolean` - Validate Ethereum address
- `compareSelectors(old: string[], new: string[]): ComparisonResult` - Compare selector arrays

## Types

### MonitorConfig

```typescript
interface MonitorConfig {
  provider: Provider;
  diamondAddress: string;
  polling?: boolean;
  pollingInterval?: number;
  enableEvents?: boolean;
  enableMetrics?: boolean;
}
```

### DiamondInfo

```typescript
interface DiamondInfo {
  address: string;
  facets: FacetInfo[];
  selectors: string[];
  chainId: number;
  block: number;
}
```

### HealthCheckResult

```typescript
interface HealthCheckResult {
  isHealthy: boolean;
  facetCount: number;
  selectorCount: number;
  lastActivity: number;
  errors: string[];
  warnings: string[];
}
```

## Development

This package is part of the diamonds-monitor development environment. To contribute:

1. Clone the development repository
2. Install dependencies: `yarn install`
3. Build the package: `yarn monitor:build`
4. Run tests: `yarn monitor:test`
5. Run linting: `yarn monitor:lint`

## License

MIT © GeniusVentures

## Support

- 🐛 [Report Issues](https://github.com/GeniusVentures/diamonds-monitor/issues)
- 📖 [Documentation](https://github.com/GeniusVentures/diamonds-monitor#readme)
- 💬 [Discussions](https://github.com/GeniusVentures/diamonds-monitor/discussions)
