/**
 * Type extensions for Hardhat Diamond Monitor Plugin
 */

import "hardhat/types/config";
import "hardhat/types/runtime";
import { MonitoringReport, MonitoringModule, MonitoringStatus, MonitoringIssue, SeverityLevel, DiamondInfo, NetworkInfo, ModuleResult } from './core/types';

/**
 * Diamond monitoring configuration interface
 */
export interface DiamondMonitorConfig {
  /** Default modules to run if none specified */
  defaultModules: string[];
  
  /** Output directory for monitoring reports */
  outputPath: string;
  
  /** Networks where monitoring is enabled */
  enabledNetworks?: string[];
  
  /** Module-specific configuration */
  moduleConfig?: Record<string, any>;
}

/**
 * Diamond monitoring API interface
 */
export interface DiamondMonitorAPI {
  /**
   * Monitor a diamond contract
   */
  monitorDiamond(diamondName: string, network: string, options?: any): Promise<MonitoringReport>;
  
  /**
   * Create a new monitoring system instance
   */
  createMonitoringSystem(): any; // Using any to avoid circular dependency
  
  /**
   * List available monitoring modules
   */
  listModules(): MonitoringModule[];
}

// Extend Hardhat configuration types
declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    diamondMonitor?: DiamondMonitorConfig;
  }

  export interface HardhatConfig {
    diamondMonitor: DiamondMonitorConfig;
  }
}

// Extend Hardhat runtime environment types
declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    diamondMonitor: DiamondMonitorAPI;
  }
}
