/**
 * Core types and interfaces for the Hardhat Diamond Monitoring Plugin
 */

import { Provider } from 'ethers';
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Severity levels for monitoring issues
 */
export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning', 
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Overall monitoring status
 */
export enum MonitoringStatus {
  PASS = 'PASS',
  FAIL = 'FAIL', 
  WARNING = 'WARNING',
  SKIPPED = 'SKIPPED'
}

/**
 * Report output formats
 */
export enum ReportFormat {
  CONSOLE = 'console',
  JSON = 'json',
  HTML = 'html',
  CSV = 'csv'
}

/**
 * Network information for monitoring context
 */
export interface NetworkInfo {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorerUrl?: string;
  blockExplorerApiKey?: string;
}

/**
 * Diamond information for monitoring
 */
export interface DiamondInfo {
  name: string;
  address: string;
  configPath?: string;
  deploymentBlock?: number;
  network: NetworkInfo;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration requirements for monitoring modules
 */
export interface ConfigRequirement {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: (value: any) => boolean;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Individual monitoring issue
 */
export interface MonitoringIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: string;
  recommendation?: string;
  metadata?: Record<string, any>;
  location?: {
    contract?: string;
    function?: string;
    line?: number;
  };
}

/**
 * Result from executing a monitoring module
 */
export interface MonitoringResult {
  status: MonitoringStatus;
  issues: MonitoringIssue[];
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * Context provided to monitoring modules during execution
 */
export interface MonitoringContext {
  diamond: DiamondInfo;
  provider: Provider;
  config: MonitoringConfig;
  moduleConfig: Record<string, any>;
  hre: HardhatRuntimeEnvironment;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Result from a module execution
 */
export interface ModuleResult {
  moduleId: string;
  moduleName: string;
  status: MonitoringStatus;
  result: MonitoringResult;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: Error;
}

/**
 * Complete monitoring report
 */
export interface MonitoringReport {
  summary: {
    status: MonitoringStatus;
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  modules: ModuleResult[];
  diamond: DiamondInfo;
  network: NetworkInfo;
  config: MonitoringConfig;
  timestamp: Date;
  duration: number;
  recommendations?: string[];
}

/**
 * Monitoring module interface
 */
export interface MonitoringModule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;

  /**
   * Check if this module can monitor the given diamond
   */
  canMonitor(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean>;

  /**
   * Get configuration requirements for this module
   */
  getRequiredConfig(): ConfigRequirement[];

  /**
   * Validate module-specific configuration
   */
  validateConfig(config: any): ValidationResult;

  /**
   * Execute monitoring
   */
  monitor(context: MonitoringContext): Promise<MonitoringResult>;

  /**
   * Optional cleanup after monitoring
   */
  cleanup?(context: MonitoringContext): Promise<void>;
}

/**
 * Main monitoring configuration
 */
export interface MonitoringConfig {
  // Module configuration
  modules: Record<string, {
    enabled: boolean;
    priority?: number;
    config?: Record<string, any>;
  }>;

  // Execution configuration
  execution: {
    parallelExecution: boolean;
    maxConcurrency: number;
    timeoutMs: number;
    failFast: boolean;
  };

  // Reporting configuration
  reporting: {
    format: ReportFormat;
    outputPath?: string;
    verbose: boolean;
    includeMetadata: boolean;
  };

  // Network configuration
  network: NetworkInfo;

  // Diamond configuration
  diamond: DiamondInfo;
}

/**
 * Task arguments interface
 */
export interface TaskArgs {
  diamondName: string;
  network?: string;  // Optional since we derive from Hardhat context
  modules?: string;
  outputFormat?: string;
  outputFile?: string;
  verbose?: boolean;
  failOnError?: boolean;
  dryRun?: boolean;
}

/**
 * Monitoring event types
 */
export type MonitoringEventType = 
  | 'monitoring_start'
  | 'monitoring_complete'
  | 'module_start'
  | 'module_complete'
  | 'module_error'
  | 'issue_found';

/**
 * Monitoring event data
 */
export interface MonitoringEvent {
  type: MonitoringEventType;
  timestamp: Date;
  moduleId?: string;
  data: Record<string, any>;
}

/**
 * Monitoring event listener
 */
export type MonitoringEventListener = (event: MonitoringEvent) => void;

/**
 * Logger interface for monitoring system
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Retry configuration for network operations
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Module dependency information
 */
export interface ModuleDependency {
  moduleId: string;
  optional: boolean;
}

/**
 * Extended monitoring module interface with dependencies
 */
export interface MonitoringModuleWithDeps extends MonitoringModule {
  /**
   * Get module dependencies (optional)
   */
  getDependencies?(): ModuleDependency[];
}

/**
 * Diamond configuration from deployment files
 */
export interface DiamondConfig {
  name: string;
  address: string;
  deploymentBlock?: number;
  facets: Record<string, {
    address: string;
    selectors: string[];
  }>;
  protocolVersion?: string;
  metadata?: Record<string, any>;
}
