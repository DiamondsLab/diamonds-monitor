/**
 * Hardhat Diamond Monitor Plugin
 * 
 * Provides comprehensive ERC-2535 Diamond contract monitoring capabilities
 * through Hardhat's diamondMonitor API
  hre.diamondMonitor = {
    monitorDiamond: hre.diamondMonitor.monitorDiamond,
    createMonitoringSystem: hre.diamondMonitor.createMonitoringSystem,
    listModules: hre.diamondMonitor.listModules
  };
 */

import { extendConfig, extendEnvironment } from 'hardhat/config';
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types';

import './tasks/monitor-diamond';
import './tasks/list-modules';
import './tasks/monitor-continuous';
import './type-extensions';

import { DiamondMonitoringSystem } from './core/DiamondMonitoringSystem';
import {
  FunctionSelectorModule,
  DiamondStructureModule,
  AccessControlModule,
  TokenSupplyModule,
  ERC165ComplianceModule,
} from './modules';
import type {
  MonitoringReport as CoreMonitoringReport,
  ModuleResult as CoreModuleResult,
  MonitoringStatus,
  SeverityLevel,
} from './core/types';

/**
 * Type conversion functions to bridge core types and Hardhat plugin API types
 */
export function convertModuleResult(coreResult: CoreModuleResult): any {
  return {
    moduleId: coreResult.moduleId,
    moduleName: coreResult.moduleName,
    status: coreResult.status,
    issues: coreResult.result.issues,
    executionTime: coreResult.result.executionTime,
    metadata: coreResult.result.metadata,
  };
}

export function convertReport(coreReport: CoreMonitoringReport): any {
  return {
    summary: {
      totalChecks: coreReport.summary.totalChecks,
      passed: coreReport.summary.passed,
      failed: coreReport.summary.failed,
      warnings: coreReport.summary.warnings,
    },
    modules: coreReport.modules.map(convertModuleResult),
    diamond: coreReport.diamond,
    network: coreReport.network,
    timestamp: coreReport.timestamp,
    duration: coreReport.duration,
  };
}

// Extend Hardhat configuration
extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  // Set default configuration for diamond monitoring
  const defaultConfig = {
    defaultModules: [
      'function-selectors',
      'diamond-structure',
      'access-control',
      'token-supply',
      'erc165-compliance',
    ],
    outputPath: './monitoring-reports',
    enabledNetworks: [],
    moduleConfig: {},
  };

  config.diamondMonitor = {
    ...defaultConfig,
    ...userConfig.diamondMonitor,
  };
});

// Extend Hardhat Runtime Environment
extendEnvironment(hre => {
  // Add diamond monitoring API to HRE
  hre.diamondMonitor = {
    /**
     * Main monitoring entry point
     */
    monitorDiamond: async (diamondName: string, network: string, options: any = {}) => {
      const { DiamondMonitoringRunner } = await import('./core/DiamondMonitoringRunner');
      const runner = new DiamondMonitoringRunner(hre);
      const coreReport = await runner.run({
        diamondName,
        network,
        ...options,
      });
      return convertReport(coreReport);
    },

    /**
     * Create a new monitoring system instance with adapter
     */
    createMonitoringSystem: () => {
      const system = new DiamondMonitoringSystem();

      // Register all available modules
      system.registerModule(new FunctionSelectorModule());
      system.registerModule(new DiamondStructureModule());
      system.registerModule(new AccessControlModule());
      system.registerModule(new TokenSupplyModule());
      system.registerModule(new ERC165ComplianceModule());

      // Create adapter that matches the expected interface
      return {
        registerModule: (module: any) => system.registerModule(module),
        unregisterModule: (moduleId: string) => system.unregisterModule(moduleId),
        getRegisteredModules: () => system.listModules(),
        listModules: () => system.listModules(),
        runMonitoring: async (diamondInfo: any, options?: any) => {
          // Create a simplified adapter - in a real implementation you'd need proper provider and config setup
          const provider = (hre as any).ethers?.provider;
          if (!provider) {
            throw new Error('Ethers provider not available');
          }

          const config = {
            reporting: { verbose: true, format: 'console' as any, includeMetadata: true },
            execution: {
              parallelExecution: false,
              maxConcurrency: 1,
              timeoutMs: 30000,
              failFast: false,
            },
            modules: {},
            network: diamondInfo.network || {
              name: hre.network.name,
              chainId: hre.network.config.chainId || 0,
              rpcUrl: 'unknown',
            },
            diamond: diamondInfo,
          };

          const coreReport = await system.runMonitoring(diamondInfo, provider, config);
          return convertReport(coreReport);
        },
      };
    },

    /**
     * List all available monitoring modules
     */
    listModules: () => {
      const system = new DiamondMonitoringSystem();
      system.registerModule(new FunctionSelectorModule());
      system.registerModule(new DiamondStructureModule());
      system.registerModule(new AccessControlModule());
      system.registerModule(new TokenSupplyModule());
      system.registerModule(new ERC165ComplianceModule());

      return system.listModules();
    },
  };
});
