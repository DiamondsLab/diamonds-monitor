# Real-Time Diamond Monitoring with EventEmitter

The DiamondMonitor now provides real-time event monitoring capabilities through an EventEmitter-based API. This enables applications to respond immediately to diamond contract changes and health issues.

## Overview

The enhanced `trackEvents()` method now returns an EventEmitter that emits:

- `facetChanged` - When a DiamondCut event occurs
- `healthIssue` - When health problems are detected

## Quick Start

```typescript
import { DiamondMonitor } from 'diamonds-monitor/standalone';
import { Diamond } from 'diamonds';

// Create Diamond and provider instances
const diamond = new Diamond('MyDiamond', 'mainnet');
const provider = new JsonRpcProvider('https://mainnet.infura.io/v3/YOUR-KEY');

// Create monitor with alert thresholds
const monitor = new DiamondMonitor(diamond, provider, {
  alertThresholds: {
    maxResponseTime: 5000,    // Alert if responses take > 5s
    maxFailedChecks: 3        // Alert after 3 consecutive failures
  },
  enableEventLogging: true,
  enableHealthChecks: true
});

// Start real-time monitoring
const eventEmitter = monitor.trackEvents();

// Listen for facet changes
eventEmitter.on('facetChanged', (event) => {
  console.log('Diamond facet changed:', {
    changes: event.changes.length,
    impact: event.impact.severity,
    shouldAlert: event.shouldAlert,
    transaction: event.transactionHash
  });
  
  // Handle each change
  event.changes.forEach(change => {
    console.log(`${change.action}: ${change.facetAddress} (${change.functionSelectors.length} selectors)`);
  });
});

// Listen for health issues
eventEmitter.on('healthIssue', (issue) => {
  console.error('Health issue detected:', {
    issue: issue.issue,
    severity: issue.severity,
    timestamp: issue.timestamp
  });
  
  // Send alert to monitoring system
  sendAlert(issue);
});
```

## Event Types

### FacetChanged Event

Emitted when a DiamondCut transaction is detected:

```typescript
interface FacetChangedEvent {
  changes: DiamondCutAction[];        // Array of facet changes
  init: string;                       // Init contract address
  calldata: string;                   // Init calldata
  blockNumber: number;                // Block number of change
  blockHash: string;                  // Block hash
  transactionHash: string;            // Transaction hash
  timestamp: string;                  // ISO timestamp
  impact: {                           // Impact analysis
    severity: 'low' | 'medium' | 'high';
    summary: string;
    details: string[];
  };
  shouldAlert: boolean;               // Whether this should trigger alerts
}

interface DiamondCutAction {
  facetAddress: string;               // Address of the facet
  action: 'Add' | 'Replace' | 'Remove'; // Type of change
  functionSelectors: string[];        // Affected function selectors
}
```

### HealthIssue Event

Emitted when health problems are detected:

```typescript
interface HealthIssueEvent {
  issue: string;                      // Description of the issue
  severity?: 'low' | 'medium' | 'high'; // Severity level (for facet changes)
  error?: string;                     // Error message if applicable
  details?: any;                      // Additional details
  timestamp: string;                  // ISO timestamp
}
```

## Advanced Usage

### Custom Alert Thresholds

Configure when alerts should be triggered:

```typescript
const eventEmitter = monitor.trackEvents();

eventEmitter.on('facetChanged', (event) => {
  // Custom alerting logic
  if (event.impact.severity === 'high') {
    sendCriticalAlert(event);
  } else if (event.changes.some(change => change.action === 'Remove')) {
    sendWarningAlert(event);
  }
  
  // Log all changes for audit
  auditLog.write(event);
});
```

### Health Monitoring Integration

```typescript
// Automated health monitoring
eventEmitter.on('healthIssue', (issue) => {
  switch (issue.issue) {
    case 'High-impact facet change detected':
      // Trigger security review
      triggerSecurityReview(issue.details);
      break;
      
    case 'Provider error':
      // Switch to backup provider
      switchToBackupProvider();
      break;
      
    case 'Health check failed after facet change':
      // Rollback if possible
      considerRollback(issue.details);
      break;
  }
});

// Regular health checks
setInterval(async () => {
  const health = await monitor.getHealthStatus();
  if (!health.isHealthy) {
    console.warn('Health check failed:', health.checks.filter(c => c.status !== 'passed'));
  }
}, 30000);
```

## Enhanced Health Checks

The monitoring system now includes comprehensive health checks using Diamond loupe functions:

### Available Health Checks

1. **Connectivity Check** - Provider network connectivity
2. **Contract Check** - Diamond contract existence and bytecode
3. **Facet Integrity Check** - Basic facet validation
4. **Loupe Facets Check** - Validates `facets()` function
5. **Loupe Selectors Check** - Validates `facetFunctionSelectors()` consistency
6. **Loupe Addresses Check** - Validates `facetAddresses()` consistency
7. **Response Time Check** - Measures provider response times

### Health Check Results

```typescript
const health = await monitor.getHealthStatus();

console.log('Health Status:', {
  isHealthy: health.isHealthy,
  totalTime: health.totalTime,
  metadata: health.metadata,
  checks: health.checks.map(check => ({
    name: check.name,
    status: check.status,
    message: check.message,
    duration: check.duration
  }))
});
```

## Event Handlers Utility

The `EventHandlers` utility provides advanced event parsing and analysis:

```typescript
import { EventHandlers } from 'diamonds-monitor/standalone';

const eventHandlers = new EventHandlers(logger);

// Parse raw events
const parsed = eventHandlers.parseDiamondCutEvent(rawEvent);

// Analyze impact
const impact = eventHandlers.analyzeCutImpact(parsed);

// Check if should alert
const shouldAlert = eventHandlers.shouldAlert(parsed, {
  maxFacetChanges: 5,
  maxSelectorChanges: 20,
  alertOnRemove: true
});

// Format for logging
const logData = eventHandlers.formatEventForLog(parsed);
```

## Integration Examples

### Discord/Slack Notifications

```typescript
eventEmitter.on('facetChanged', (event) => {
  if (event.shouldAlert) {
    sendDiscordMessage({
      content: `🔄 Diamond Update Alert`,
      embeds: [{
        title: event.impact.summary,
        color: event.impact.severity === 'high' ? 0xff0000 : 0xffaa00,
        fields: [
          { name: 'Transaction', value: event.transactionHash, inline: true },
          { name: 'Block', value: event.blockNumber.toString(), inline: true },
          { name: 'Changes', value: event.changes.length.toString(), inline: true }
        ],
        description: event.impact.details.join('\n')
      }]
    });
  }
});
```

### Database Logging

```typescript
eventEmitter.on('facetChanged', async (event) => {
  await database.events.create({
    type: 'DiamondCut',
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber,
    changes: event.changes,
    impact: event.impact,
    timestamp: new Date(event.timestamp)
  });
});

eventEmitter.on('healthIssue', async (issue) => {
  await database.healthIssues.create({
    issue: issue.issue,
    severity: issue.severity,
    details: issue.details,
    timestamp: new Date(issue.timestamp)
  });
});
```

### Prometheus Metrics

```typescript
const facetChangesCounter = new prometheus.Counter({
  name: 'diamond_facet_changes_total',
  help: 'Total number of facet changes',
  labelNames: ['action', 'severity']
});

const healthChecksGauge = new prometheus.Gauge({
  name: 'diamond_health_status',
  help: 'Diamond health status (1=healthy, 0=unhealthy)'
});

eventEmitter.on('facetChanged', (event) => {
  event.changes.forEach(change => {
    facetChangesCounter.inc({
      action: change.action.toLowerCase(),
      severity: event.impact.severity
    });
  });
});

// Update health metrics regularly
setInterval(async () => {
  const health = await monitor.getHealthStatus();
  healthChecksGauge.set(health.isHealthy ? 1 : 0);
}, 30000);
```

## Configuration Options

### Alert Thresholds

```typescript
const monitor = new DiamondMonitor(diamond, provider, {
  alertThresholds: {
    maxResponseTime: 5000,        // Max acceptable response time (ms)
    maxFailedChecks: 3            // Max consecutive failed health checks
  }
});
```

### Polling and Logging

```typescript
const monitor = new DiamondMonitor(diamond, provider, {
  pollingInterval: 30000,         // Health check interval (ms)
  enableEventLogging: true,       // Enable event logging
  enableHealthChecks: true,       // Enable health checks
  fromBlock: 'latest'            // Block to start monitoring from
});
```

## Error Handling

The monitoring system handles errors gracefully:

```typescript
eventEmitter.on('healthIssue', (issue) => {
  switch (issue.issue) {
    case 'Failed to initialize event tracking':
      // Handle initialization failures
      console.error('Event tracking failed to start:', issue.error);
      // Try reconnecting or use backup strategy
      break;
      
    case 'Event processing error':
      // Handle event parsing errors
      console.error('Failed to process event:', issue.error);
      // Continue monitoring, event data may be in issue.eventData
      break;
      
    case 'Provider error':
      // Handle provider connectivity issues
      console.error('Provider error:', issue.error);
      // Consider switching providers
      break;
  }
});
```

## Best Practices

1. **Always handle both event types** - Listen for both `facetChanged` and `healthIssue` events
2. **Implement proper error handling** - Use try-catch blocks and handle healthIssue events
3. **Configure appropriate thresholds** - Set alert thresholds based on your monitoring needs
4. **Log events for audit** - Keep records of all diamond changes for compliance
5. **Monitor health regularly** - Call `getHealthStatus()` periodically for comprehensive health monitoring
6. **Use structured logging** - Include relevant context in log messages for debugging

## Migration from Promise-based API

If you were previously using the Promise-based `trackEvents()` method:

```typescript
// Old API (still supported with custom listeners)
await monitor.trackEvents(customListener);

// New API (recommended)
const eventEmitter = monitor.trackEvents();
eventEmitter.on('facetChanged', handleFacetChange);
eventEmitter.on('healthIssue', handleHealthIssue);
```

The EventEmitter-based API provides much more flexibility and enables real-time reactive monitoring patterns.
