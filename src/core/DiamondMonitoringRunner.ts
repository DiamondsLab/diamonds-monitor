/**
 * Diamond Monitoring Runner for Hardhat
 *
 * This class orchestrates the monitoring process within the Hardhat environment,
 * providing integration with Hardhat's network configuration, provider system,
 * and deployment artifacts.
 */

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import chalk from 'chalk';

import { DiamondMonitoringSystem } from './DiamondMonitoringSystem';
import {
  FunctionSelectorModule,
  DiamondStructureModule,
  AccessControlModule,
  TokenSupplyModule,
  ERC165ComplianceModule,
} from '../modules';
import {
  loadDeploymentInfo,
  createProvider,
  validateHardhatEnvironment,
  generateReport,
  ReportOptions,
} from '../utils/index';
import {
  MonitoringModule,
  TaskArgs,
  MonitoringReport,
  MonitoringConfig,
  DiamondInfo,
  NetworkInfo,
  ReportFormat,
  MonitoringStatus,
} from './types';

/**
 * Main runner class that orchestrates diamond monitoring within Hardhat
 */
export class DiamondMonitoringRunner {
  private hre: HardhatRuntimeEnvironment;
  private monitoringSystem: DiamondMonitoringSystem;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
    this.monitoringSystem = new DiamondMonitoringSystem();

    // Register default modules
    this.registerDefaultModules();
  }

  /**
   * Run diamond monitoring with the provided task arguments
   */
  public async run(args: TaskArgs): Promise<MonitoringReport> {
    const { diamondName, outputFormat, outputFile, verbose, dryRun } = args;

    // Use current Hardhat network instead of requiring network parameter
    const network = this.hre.network.name;

    // Validate Hardhat environment
    const envValidation = validateHardhatEnvironment(this.hre);
    if (!envValidation.isValid) {
      throw new Error(`Hardhat environment validation failed:\n${envValidation.errors.join('\n')}`);
    }

    if (envValidation.warnings.length > 0 && verbose) {
      console.warn(chalk.yellow('⚠️  Environment warnings:'));
      envValidation.warnings.forEach((warning: string) =>
        console.warn(chalk.yellow(`   • ${warning}`))
      );
    }

    console.log(chalk.blue(`🔍 Starting diamond monitoring for ${diamondName} on ${network}`));

    try {
      // 1. Load diamond deployment info
      const diamondInfo = await this.loadDiamondInfo(diamondName, network);
      if (!diamondInfo) {
        throw new Error(
          `Diamond '${diamondName}' not found in deployments for network '${network}'`
        );
      }

      // 2. Create provider
      const provider = createProvider(this.hre);

      // 3. Build monitoring configuration
      const config = this.buildMonitoringConfig(args, diamondInfo);

      // 4. Execute monitoring
      const report = await this.monitoringSystem.runMonitoring(diamondInfo, provider, config);

      // 5. Generate output report
      await this.generateOutput(report, outputFormat as ReportFormat, outputFile, verbose);

      console.log(chalk.blue('✅ Diamond monitoring completed'));
      return report;
    } catch (error) {
      console.error(chalk.red(`❌ Diamond monitoring failed: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Create a new monitoring system instance
   */
  public createMonitoringSystem(): DiamondMonitoringSystem {
    const system = new DiamondMonitoringSystem();
    this.registerDefaultModules(system);
    return system;
  }

  /**
   * Get list of available monitoring modules
   */
  public getAvailableModules(): Array<{ id: string; name: string; description: string }> {
    return this.monitoringSystem.listModules().map((module: MonitoringModule) => ({
      id: module.id,
      name: module.name,
      description: module.description,
    }));
  }

  /**
   * Load diamond deployment information
   */
  private async loadDiamondInfo(
    diamondName: string,
    networkName: string
  ): Promise<DiamondInfo | null> {
    return await loadDeploymentInfo(this.hre, diamondName, networkName);
  }

  /**
   * Build monitoring configuration from task arguments
   */
  private buildMonitoringConfig(args: TaskArgs, diamondInfo: DiamondInfo): MonitoringConfig {
    const config: MonitoringConfig = {
      reporting: {
        verbose: args.verbose || false,
        format: (args.outputFormat as ReportFormat) || ReportFormat.CONSOLE,
        outputPath: args.outputFile,
        includeMetadata: true,
      },
      execution: {
        parallelExecution: true,
        maxConcurrency: 3,
        timeoutMs: 30000,
        failFast: false,
      },
      modules: {
        'function-selectors': {
          enabled: true,
          priority: 1,
        },
        'diamond-structure': {
          enabled: true,
          priority: 2,
        },
        'access-control': {
          enabled: true,
          priority: 3,
        },
        'token-supply': {
          enabled: true,
          priority: 4,
        },
        'erc165-compliance': {
          enabled: true,
          priority: 5,
        },
      },
      network: diamondInfo.network,
      diamond: diamondInfo,
    };

    // Add HRE and other context to config
    (config as any).hre = this.hre;
    (config as any).dryRun = args.dryRun;

    return config;
  }

  /**
   * Generate output report in the specified format
   */
  private async generateOutput(
    report: MonitoringReport,
    format: ReportFormat,
    outputFile?: string,
    verbose?: boolean
  ): Promise<void> {
    const reportOptions: ReportOptions = {
      format: format || 'console',
      outputFile,
      includeDetails: verbose,
      colorOutput: !outputFile, // Disable colors when writing to file
      sortBy: 'severity',
    };

    await generateReport(report, reportOptions);
  }

  /**
   * Register default monitoring modules
   */
  private registerDefaultModules(system?: DiamondMonitoringSystem): void {
    const targetSystem = system || this.monitoringSystem;

    // Register function selector module
    targetSystem.registerModule(new FunctionSelectorModule());

    // Register diamond structure module
    targetSystem.registerModule(new DiamondStructureModule());

    // Register access control module
    targetSystem.registerModule(new AccessControlModule());

    // Register token supply module
    targetSystem.registerModule(new TokenSupplyModule());

    // Register ERC165 compliance module
    targetSystem.registerModule(new ERC165ComplianceModule());
  }

  /**
   * Get monitoring system instance
   */
  public getMonitoringSystem(): DiamondMonitoringSystem {
    return this.monitoringSystem;
  }

  /**
   * Validate monitoring configuration
   */
  public validateConfig(config: MonitoringConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate reporting configuration
    if (config.reporting) {
      if (
        config.reporting.format &&
        !['console', 'json', 'html', 'csv'].includes(config.reporting.format)
      ) {
        errors.push(`Invalid reporting format: ${config.reporting.format}`);
      }
    }

    // Validate execution configuration
    if (config.execution) {
      if (config.execution.maxConcurrency && config.execution.maxConcurrency < 1) {
        errors.push('maxConcurrency must be at least 1');
      }

      if (config.execution.timeoutMs && config.execution.timeoutMs < 1000) {
        warnings.push('timeoutMs is very low, monitoring may fail');
      }
    }

    // Validate module configurations
    if (config.modules) {
      for (const [moduleId, moduleConfig] of Object.entries(config.modules)) {
        const module = this.monitoringSystem.getModule(moduleId);
        if (moduleConfig.enabled && !module) {
          warnings.push(`Module '${moduleId}' is enabled but not registered`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get network information
   */
  public getNetworkInfo(): NetworkInfo {
    const network = this.hre.network;
    const config = network.config;

    // Handle different network types
    let rpcUrl = 'unknown';
    if ('url' in config) {
      rpcUrl = config.url;
    } else if (network.name === 'hardhat') {
      rpcUrl = 'http://localhost:8545';
    }

    return {
      name: network.name,
      chainId: network.config.chainId || 0,
      rpcUrl,
      blockExplorerUrl: (config as any).blockExplorerUrl,
      blockExplorerApiKey: (config as any).blockExplorerApiKey,
    };
  }

  /**
   * Check if a diamond exists in deployments
   */
  public async isDiamondDeployed(diamondName: string, networkName: string): Promise<boolean> {
    const diamondInfo = await this.loadDiamondInfo(diamondName, networkName);
    return diamondInfo !== null;
  }
}
