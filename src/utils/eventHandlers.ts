import { EventLog } from 'ethers';
import * as winston from 'winston';

/**
 * Represents a parsed DiamondCut action
 */
export interface DiamondCutAction {
  facetAddress: string;
  action: 'Add' | 'Replace' | 'Remove';
  functionSelectors: string[];
}

/**
 * Represents a parsed DiamondCut event
 */
export interface ParsedDiamondCutEvent {
  changes: DiamondCutAction[];
  init: string;
  calldata: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  timestamp: string;
}

/**
 * Event handler utilities for Diamond monitoring
 */
export class EventHandlers {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Parse a DiamondCut event from an EventLog
   */
  public parseDiamondCutEvent(event: EventLog): ParsedDiamondCutEvent {
    try {
      const [diamondCutData, init, calldata] = event.args;
      
      const changes: DiamondCutAction[] = diamondCutData.map((cut: any) => ({
        facetAddress: cut.facetAddress,
        action: this.parseAction(cut.action),
        functionSelectors: cut.functionSelectors,
      }));

      return {
        changes,
        init,
        calldata,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        transactionHash: event.transactionHash,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to parse DiamondCut event', { error, event });
      throw new Error(`Failed to parse DiamondCut event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse DiamondCut action from numeric value
   */
  private parseAction(action: number): 'Add' | 'Replace' | 'Remove' {
    switch (action) {
      case 0: return 'Add';
      case 1: return 'Replace';
      case 2: return 'Remove';
      default: 
        this.logger.warn('Unknown DiamondCut action', { action });
        return 'Add'; // Default fallback
    }
  }

  /**
   * Analyze the impact of a DiamondCut event
   */
  public analyzeCutImpact(parsed: ParsedDiamondCutEvent): {
    severity: 'low' | 'medium' | 'high';
    summary: string;
    details: string[];
  } {
    const { changes } = parsed;
    const actionCounts = {
      Add: changes.filter(c => c.action === 'Add').length,
      Replace: changes.filter(c => c.action === 'Replace').length,
      Remove: changes.filter(c => c.action === 'Remove').length
    };

    const totalSelectors = changes.reduce((sum, change) => sum + change.functionSelectors.length, 0);
    
    let severity: 'low' | 'medium' | 'high' = 'low';
    const details: string[] = [];
    
    // Determine severity based on the type and scale of changes
    if (actionCounts.Remove > 0) {
      severity = 'high';
      details.push(`${actionCounts.Remove} facet(s) removed`);
    } else if (actionCounts.Replace > 0) {
      severity = 'medium';
      details.push(`${actionCounts.Replace} facet(s) replaced`);
    }
    
    if (totalSelectors > 10) {
      severity = severity === 'low' ? 'medium' : 'high';
      details.push(`Large number of function selectors affected: ${totalSelectors}`);
    }

    if (actionCounts.Add > 0) {
      details.push(`${actionCounts.Add} new facet(s) added`);
    }

    const summary = `Diamond upgrade: ${Object.entries(actionCounts)
      .filter(([, count]) => count > 0)
      .map(([action, count]) => `${count} ${action}`)
      .join(', ')} affecting ${totalSelectors} function(s)`;

    return { severity, summary, details };
  }

  /**
   * Check if a DiamondCut event should trigger an alert
   */
  public shouldAlert(parsed: ParsedDiamondCutEvent, thresholds: {
    maxFacetChanges?: number;
    maxSelectorChanges?: number;
    alertOnRemove?: boolean;
  } = {}): boolean {
    const {
      maxFacetChanges = 5,
      maxSelectorChanges = 20,
      alertOnRemove = true
    } = thresholds;

    const { changes } = parsed;
    const totalSelectors = changes.reduce((sum, change) => sum + change.functionSelectors.length, 0);
    const hasRemoval = changes.some(change => change.action === 'Remove');

    return (
      changes.length > maxFacetChanges ||
      totalSelectors > maxSelectorChanges ||
      (alertOnRemove && hasRemoval)
    );
  }

  /**
   * Format a DiamondCut event for logging
   */
  public formatEventForLog(parsed: ParsedDiamondCutEvent): object {
    const { changes, init, calldata, blockNumber, transactionHash, timestamp } = parsed;
    
    return {
      timestamp,
      blockNumber,
      transactionHash,
      summary: `${changes.length} facet change(s)`,
      changes: changes.map(change => ({
        action: change.action,
        facet: change.facetAddress,
        selectorCount: change.functionSelectors.length,
        selectors: change.functionSelectors.slice(0, 3), // First 3 selectors for brevity
        truncated: change.functionSelectors.length > 3
      })),
      hasInit: init !== '0x0000000000000000000000000000000000000000',
      hasCalldata: calldata !== '0x'
    };
  }
}
