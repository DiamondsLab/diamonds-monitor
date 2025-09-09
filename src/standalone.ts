/**
 * Standalone Diamonds Monitor API
 * 
 * This module provides standalone access to diamond monitoring capabilities
 * without requiring Hardhat integration. Use this for direct integration
 * with Diamond instances from the diamonds module.
 */

// Core classes for standalone usage
export { DiamondMonitor } from './core/DiamondMonitor';
export { FacetManager } from './core/FacetManager';

// Utility functions
export * from './utils/DiamondUtils';

// Type definitions from DiamondMonitor
export type {
  DiamondMonitorConfig,
  DiamondInfo,
  FacetInfo as MonitorFacetInfo,
  HealthCheckResult,
  HealthCheck,
  EventListener,
  MonitoringError
} from './core/DiamondMonitor';

// Type definitions from FacetManager  
export type {
  FacetInfo,
  SelectorConflict,
  SelectorValidationResult,
  FacetAnalysisResult,
  FacetCutAction,
  DiamondCut,
  DiamondCutValidationResult,
  FacetManagerError
} from './core/FacetManager';

// Re-export utility types
export type { ComparisonResult } from './utils/DiamondUtils';
