# diamonds-monitor API Documentation

A comprehensive Node.js package for monitoring ERC-2535 Diamond Proxy contracts with real-time event tracking, health checks, and facet management capabilities.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [DiamondMonitor](#diamondmonitor)
  - [FacetManager](#facetmanager)
  - [EventHandlers](#eventhandlers)
- [Types](#types)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Installation

### External Projects

```bash
npm install @diamondslab/diamonds-monitor @diamondslab/diamonds
```

### Monorepo Workspace

Already available via workspace dependencies. No installation needed.

## Quick Start

```typescript
import { DiamondMonitor, FacetManager } from '@diamondslab/diamonds-monitor/standalone';
import { Diamond } from '@diamondslab/diamonds';
import { JsonRpcProvider } from 'ethers';

// Create Diamond and provider
const diamond = new Diamond('MyDiamond', 'mainnet');
const provider = new JsonRpcProvider('https://mainnet.infura.io/v3/YOUR-KEY');

// Create monitor
const monitor = new DiamondMonitor(diamond, provider, {
  alertThresholds: {
    maxResponseTime: 5000,
    maxFailedChecks: 3
  }
});

// Start real-time monitoring
const eventEmitter = monitor.trackEvents();

eventEmitter.on('facetChanged', (event) => {
  console.log('Facet changed:', event.impact.summary);
});

eventEmitter.on('healthIssue', (issue) => {
  console.error('Health issue:', issue.issue);
});
```

## API Reference

### DiamondMonitor

The main monitoring class for Diamond contracts.

#### Constructor

```typescript
new DiamondMonitor(diamond: Diamond, provider: Provider, config?: DiamondMonitorConfig)
```

**Parameters:**

- `diamond` - Diamond instance from the diamonds module
- `provider` - Ethers.js provider instance
- `config` - Optional configuration object

**Configuration Options:**

```typescript
interface DiamondMonitorConfig {
  pollingInterval?: number;           // Health check interval (default: 30000ms)
  enableEventLogging?: boolean;       // Enable event logging (default: true)
  enableHealthChecks?: boolean;       // Enable health checks (default: true)
  fromBlock?: number | 'latest';      // Starting block (default: 'latest')
  logger?: winston.Logger;            // Custom logger instance
  alertThresholds?: {
    maxResponseTime?: number;         // Max response time in ms (default: 5000)
    maxFailedChecks?: number;         // Max failed checks (default: 3)
  };
}
```

#### Methods

##### `startMonitoring(): Promise<void>`

Starts automated health monitoring with the configured polling interval.

```typescript
await monitor.startMonitoring();
console.log('Monitoring started');
```

##### `stopMonitoring(): void`

Stops automated health monitoring.

```typescript
monitor.stopMonitoring();
console.log('Monitoring stopped');
```

##### `getHealthStatus(): Promise<HealthCheckResult>`

Performs comprehensive health checks and returns detailed results.

```typescript
const health = await monitor.getHealthStatus();
console.log('Health:', health.isHealthy);
console.log('Checks:', health.checks.length);
console.log('Metadata:', health.metadata);
```

##### `trackEvents(listener?: EventListener): EventEmitter`

Returns an EventEmitter for real-time monitoring. Optionally accepts a custom event listener.

```typescript
const eventEmitter = monitor.trackEvents();

eventEmitter.on('facetChanged', (event: FacetChangedEvent) => {
  // Handle facet changes
});

eventEmitter.on('healthIssue', (issue: HealthIssueEvent) => {
  // Handle health issues
});
```

##### `getDiamondInfo(): Promise<DiamondInfo>`

Gets comprehensive information about the diamond contract.

```typescript
const info = await monitor.getDiamondInfo();
console.log('Diamond address:', info.address);
console.log('Facets:', info.facets.length);
```

##### `getDiamondAddress(): string`

Gets the diamond contract address.

```typescript
const address = monitor.getDiamondAddress();
console.log('Diamond at:', address);
```

### FacetManager

Utility class for managing diamond facets and analyzing diamond cuts.

#### Constructor

```typescript
new FacetManager(diamond: Diamond, provider: Provider)
```

#### Methods

##### `listFacets(): Promise<FacetInfo[]>`

Lists all facets in the diamond.

```typescript
const facets = await facetManager.listFacets();
facets.forEach(facet => {
  console.log(`${facet.name}: ${facet.selectors.length} selectors`);
});
```

##### `getSelectorsForFacet(facetIdentifier: string): Promise<string[]>`

Gets function selectors for a specific facet (by name or address).

```typescript
const selectors = await facetManager.getSelectorsForFacet('DiamondLoupeFacet');
console.log('Selectors:', selectors);
```

##### `validateSelectors(): Promise<ValidationResult>`

Validates that no selectors conflict in the current deployment.

```typescript
const validation = await facetManager.validateSelectors();
if (!validation.isValid) {
  console.error('Conflicts:', validation.conflicts);
}
```

##### `analyzeFacets(): Promise<FacetAnalysis>`

Analyzes the current facet deployment for insights.

```typescript
const analysis = await facetManager.analyzeFacets();
console.log('Total selectors:', analysis.totalSelectors);
console.log('Average per facet:', analysis.averageSelectorsPerFacet);
```

##### `createAddFacetCut(facetAddress: string, selectors: string[]): DiamondCut`

Creates a diamond cut for adding a new facet.

```typescript
const cut = facetManager.createAddFacetCut(
  '0x1234567890123456789012345678901234567890',
  ['0x12345678', '0x87654321']
);
```

##### `createReplaceFacetCut(facetAddress: string, selectors: string[]): DiamondCut`

Creates a diamond cut for replacing function selectors.

```typescript
const cut = facetManager.createReplaceFacetCut(
  '0x1234567890123456789012345678901234567890',
  ['0x12345678']
);
```

##### `createRemoveFacetCut(selectors: string[]): DiamondCut`

Creates a diamond cut for removing function selectors.

```typescript
const cut = facetManager.createRemoveFacetCut(['0x12345678']);
```

##### `validateDiamondCut(cuts: DiamondCut[]): ValidationResult`

Validates a proposed diamond cut for conflicts.

```typescript
const validation = facetManager.validateDiamondCut([cut1, cut2]);
if (!validation.isValid) {
  console.error('Cut validation failed:', validation.conflicts);
}
```

### EventHandlers

Utility class for parsing and analyzing diamond events.

#### Constructor

```typescript
new EventHandlers(logger: winston.Logger)
```

#### Methods

##### `parseDiamondCutEvent(event: EventLog): ParsedDiamondCutEvent`

Parses a raw DiamondCut event into a structured format.

```typescript
const parsed = eventHandlers.parseDiamondCutEvent(rawEvent);
console.log('Changes:', parsed.changes.length);
console.log('Transaction:', parsed.transactionHash);
```

##### `analyzeCutImpact(parsed: ParsedDiamondCutEvent): ImpactAnalysis`

Analyzes the impact of a diamond cut.

```typescript
const impact = eventHandlers.analyzeCutImpact(parsed);
console.log('Severity:', impact.severity);
console.log('Summary:', impact.summary);
console.log('Details:', impact.details);
```

##### `shouldAlert(parsed: ParsedDiamondCutEvent, thresholds?: AlertThresholds): boolean`

Determines if a diamond cut should trigger an alert.

```typescript
const shouldAlert = eventHandlers.shouldAlert(parsed, {
  maxFacetChanges: 5,
  maxSelectorChanges: 20,
  alertOnRemove: true
});
```

##### `formatEventForLog(parsed: ParsedDiamondCutEvent): object`

Formats an event for structured logging.

```typescript
const logData = eventHandlers.formatEventForLog(parsed);
logger.info('Diamond cut processed', logData);
```

## Types

### Core Types

```typescript
interface FacetChangedEvent {
  changes: DiamondCutAction[];
  init: string;
  calldata: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  timestamp: string;
  impact: ImpactAnalysis;
  shouldAlert: boolean;
}

interface HealthIssueEvent {
  issue: string;
  severity?: 'low' | 'medium' | 'high';
  error?: string;
  details?: any;
  timestamp: string;
}

interface DiamondCutAction {
  facetAddress: string;
  action: 'Add' | 'Replace' | 'Remove';
  functionSelectors: string[];
}

interface ImpactAnalysis {
  severity: 'low' | 'medium' | 'high';
  summary: string;
  details: string[];
}
```

### Health Check Types

```typescript
interface HealthCheckResult {
  isHealthy: boolean;
  checks: HealthCheck[];
  timestamp: Date;
  totalTime: number;
  metadata?: {
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
  };
}

interface HealthCheck {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  duration: number;
  details?: any;
}
```

### Facet Types

```typescript
interface FacetInfo {
  name: string;
  address: string;
  selectors: string[];
}

interface DiamondInfo {
  address: string;
  facets: FacetInfo[];
  totalSelectors: number;
}

interface ValidationResult {
  isValid: boolean;
  conflicts?: SelectorConflict[];
  warnings?: string[];
}

interface SelectorConflict {
  selector: string;
  facets: string[];
}

interface FacetAnalysis {
  totalFacets: number;
  totalSelectors: number;
  averageSelectorsPerFacet: number;
  largestFacet: { name: string; selectors: number };
  smallestFacet: { name: string; selectors: number };
  duplicateSelectors: SelectorConflict[];
}
```

## Examples

### Complete Monitoring Setup

```typescript
import { DiamondMonitor, FacetManager, EventHandlers } from '@diamondslab/diamonds-monitor/standalone';
import { Diamond } from '@diamondslab/diamonds';
import { JsonRpcProvider } from 'ethers';
import winston from 'winston';

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'diamond-monitor.log' })
  ]
});

// Create instances
const diamond = new Diamond('MyDiamond', 'mainnet');
const provider = new JsonRpcProvider(process.env.RPC_URL);
const monitor = new DiamondMonitor(diamond, provider, {
  logger,
  alertThresholds: {
    maxResponseTime: 5000,
    maxFailedChecks: 3
  }
});

const facetManager = new FacetManager(diamond, provider);
const eventHandlers = new EventHandlers(logger);

// Start monitoring
async function startMonitoring() {
  // Initial health check
  const health = await monitor.getHealthStatus();
  logger.info('Initial health check', { isHealthy: health.isHealthy });

  // List current facets
  const facets = await facetManager.listFacets();
  logger.info('Current facets', { count: facets.length });

  // Start automated monitoring
  await monitor.startMonitoring();

  // Setup event monitoring
  const eventEmitter = monitor.trackEvents();

  eventEmitter.on('facetChanged', async (event) => {
    logger.info('Facet changed', eventHandlers.formatEventForLog(event));

    // Validate new state
    const validation = await facetManager.validateSelectors();
    if (!validation.isValid) {
      logger.error('Validation failed after change', validation.conflicts);
    }

    // Send alerts for high-impact changes
    if (event.impact.severity === 'high') {
      await sendAlert('High-impact diamond change detected', event);
    }
  });

  eventEmitter.on('healthIssue', (issue) => {
    logger.error('Health issue detected', issue);
    
    // Handle specific issues
    if (issue.issue.includes('Provider error')) {
      logger.warn('Considering provider switch due to errors');
    }
  });

  logger.info('Diamond monitoring started successfully');
}

// Graceful shutdown
process.on('SIGINT', () => {
  monitor.stopMonitoring();
  logger.info('Monitoring stopped gracefully');
  process.exit(0);
});

startMonitoring().catch(console.error);
```

### Custom Health Monitoring

```typescript
// Extended health monitoring with custom checks
class ExtendedDiamondMonitor extends DiamondMonitor {
  async getExtendedHealth(): Promise<ExtendedHealthResult> {
    const baseHealth = await this.getHealthStatus();
    
    // Add custom checks
    const gasPrice = await this.provider.getFeeData();
    const latestBlock = await this.provider.getBlockNumber();
    
    return {
      ...baseHealth,
      gasPrice: gasPrice.gasPrice?.toString(),
      latestBlock,
      lastCheck: new Date().toISOString()
    };
  }

  async performSecurityCheck(): Promise<SecurityCheckResult> {
    const facets = await this.facetManager.listFacets();
    const analysis = await this.facetManager.analyzeFacets();
    
    // Check for suspicious patterns
    const warnings = [];
    if (analysis.duplicateSelectors.length > 0) {
      warnings.push('Duplicate selectors detected');
    }
    
    if (facets.some(f => f.selectors.length === 0)) {
      warnings.push('Empty facets detected');
    }

    return {
      isSecure: warnings.length === 0,
      warnings,
      facetCount: facets.length,
      selectorCount: analysis.totalSelectors
    };
  }
}
```

### Real-time Dashboard Data

```typescript
// WebSocket server for real-time dashboard
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Set<WebSocket>();

// Broadcast to all connected clients
function broadcast(data: any) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Setup monitoring
const eventEmitter = monitor.trackEvents();

eventEmitter.on('facetChanged', (event) => {
  broadcast({
    type: 'facetChanged',
    data: {
      timestamp: event.timestamp,
      changes: event.changes.length,
      severity: event.impact.severity,
      transaction: event.transactionHash
    }
  });
});

eventEmitter.on('healthIssue', (issue) => {
  broadcast({
    type: 'healthIssue',
    data: {
      timestamp: issue.timestamp,
      issue: issue.issue,
      severity: issue.severity
    }
  });
});

// Periodic health updates
setInterval(async () => {
  const health = await monitor.getHealthStatus();
  broadcast({
    type: 'healthUpdate',
    data: {
      isHealthy: health.isHealthy,
      checks: health.checks.map(c => ({
        name: c.name,
        status: c.status,
        duration: c.duration
      })),
      metadata: health.metadata
    }
  });
}, 30000);

// WebSocket connection handling
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected, total:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected, total:', clients.size);
  });

  // Send initial state
  monitor.getHealthStatus().then(health => {
    ws.send(JSON.stringify({
      type: 'initialState',
      data: health
    }));
  });
});
```

## Error Handling

The package provides comprehensive error handling:

```typescript
import { MonitoringError } from '@diamondslab/diamonds-monitor/standalone';

try {
  const health = await monitor.getHealthStatus();
} catch (error) {
  if (error instanceof MonitoringError) {
    console.error('Monitoring error:', error.message);
    console.error('Cause:', error.cause);
  } else {
    console.error('Unexpected error:', error);
  }
}

// Event-based error handling
eventEmitter.on('healthIssue', (issue) => {
  switch (issue.issue) {
    case 'Failed to initialize event tracking':
      // Retry initialization
      setTimeout(() => {
        const newEmitter = monitor.trackEvents();
        setupEventHandlers(newEmitter);
      }, 5000);
      break;
      
    case 'Provider error':
      // Consider switching providers
      console.warn('Provider issues detected, consider switching');
      break;
      
    case 'High-impact facet change detected':
      // Immediate attention required
      sendCriticalAlert(issue);
      break;
  }
});
```

## Performance Considerations

1. **Health Check Frequency**: Adjust `pollingInterval` based on your needs (default: 30s)
2. **Event Filtering**: Use alert thresholds to avoid noise
3. **Provider Selection**: Use reliable providers for consistent monitoring
4. **Memory Management**: Monitor EventEmitter listeners to prevent memory leaks

```typescript
// Proper cleanup
const eventEmitter = monitor.trackEvents();

// Store listener references for cleanup
const facetChangedHandler = (event) => { /* handle event */ };
const healthIssueHandler = (issue) => { /* handle issue */ };

eventEmitter.on('facetChanged', facetChangedHandler);
eventEmitter.on('healthIssue', healthIssueHandler);

// Cleanup when done
eventEmitter.removeListener('facetChanged', facetChangedHandler);
eventEmitter.removeListener('healthIssue', healthIssueHandler);
```
