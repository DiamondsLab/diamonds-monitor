# Diamonds Monitor

Professional monitoring and reporting tools for ERC-2535 Diamond Proxy contracts that utilize the Diamonds module. 

## Features

- 💎 **Diamond Contract Monitoring**: Real-time monitoring of diamond proxy contracts
- 📊 **Health Checks**: Automated health monitoring and diagnostics
- 🚨 **Event Monitoring**: Track diamond cut events and contract changes
- 🛠️ **Developer Tools**: Utilities for diamond development and debugging
- 📈 **Analytics**: Performance metrics and usage analytics
- 🔧 **Dual Usage**: Works as a Hardhat plugin or standalone library

## Installation

```bash
npm install diamonds-monitor
# or
yarn add diamonds-monitor
```

## Usage

### Standalone API (Direct Diamond Integration)

Use this approach when you have a `Diamond` instance from the diamonds module:

```typescript
import { DiamondMonitor, FacetManager } from 'diamonds-monitor';
import { Diamond } from 'diamonds';
import { ethers } from 'ethers';

// Assuming you have a Diamond instance from the diamonds module
const diamond = new Diamond(config, repository);
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');

// Create monitor instance
const monitor = new DiamondMonitor(diamond, provider, {
  pollingInterval: 30000,
  enableEventLogging: true,
  enableHealthChecks: true
});

// Start monitoring
await monitor.startMonitoring();

// Get diamond information
const info = await monitor.getDiamondInfo();
console.log(`Diamond at ${info.address} has ${info.facets.length} facets`);

// Perform health check
const health = await monitor.getHealthStatus();
if (health.isHealthy) {
  console.log('Diamond is healthy ✅');
} else {
  console.error('Diamond has issues:', health.checks.filter(c => c.status === 'failed'));
}

// Track events
await monitor.trackEvents((event) => {
  console.log('DiamondCut event detected:', event);
});

// Use FacetManager for facet operations
const facetManager = new FacetManager(diamond, provider);

// List all facets
const facets = await facetManager.listFacets();
console.log('Facets:', facets);

// Analyze facets
const analysis = await facetManager.analyzeFacets();
console.log(`Analysis: ${analysis.totalFacets} facets, ${analysis.totalSelectors} selectors`);

// Validate selectors
const validation = await facetManager.validateSelectors();
if (!validation.isValid) {
  console.warn('Selector conflicts detected:', validation.conflicts);
}

// Create diamond cuts
const addCut = facetManager.createAddFacetCut(
  '0x1234567890123456789012345678901234567890',
  ['0x12345678', '0x87654321']
);

const validation = await facetManager.validateDiamondCut([addCut]);
if (validation.isValid) {
  console.log('Diamond cut is valid');
} else {
  console.error('Diamond cut errors:', validation.errors);
}
```

### Hardhat Plugin API

Use this approach when working within a Hardhat environment:

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import 'diamonds-monitor';

// Your Hardhat config
const config: HardhatUserConfig = {
  // ... other config
};

// In your Hardhat scripts/tasks
async function main() {
  // Monitor a deployed diamond
  const report = await hre.diamondMonitor.monitorDiamond({
    diamondAddress: '0x...',
    network: 'localhost',
    modules: ['function-selectors', 'diamond-structure']
  });
  
  console.log('Monitoring report:', report);
  
  // List available monitoring modules
  const modules = hre.diamondMonitor.listModules();
  console.log('Available modules:', modules);
}

```typescript
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
