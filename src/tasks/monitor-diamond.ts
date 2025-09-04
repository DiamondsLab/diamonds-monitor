/**
 * Enhanced diamond monitoring task for Hardhat
 * 
 * Provides comprehensive CLI options, error handling, and professional user experience
 */

import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import { 
  TaskArgs, 
  DiamondInfo, 
  MonitoringConfig, 
  ReportFormat,
  MonitoringReport,
  MonitoringStatus 
} from '../core/types';
import { DiamondMonitoringSystem } from '../core/DiamondMonitoringSystem';
import { ReportGenerator } from '../reports/ReportGenerator';
import { ReportOptions } from '../reports/types';

/**
 * Extended task arguments with enhanced options
 */
interface EnhancedTaskArgs extends TaskArgs {
  targetNetwork?: string;
  outputFormat?: string;
  outputFile?: string;
  configPath?: string;
  deploymentPath?: string;
  debug?: boolean;
  failOnError?: boolean;
  watch?: boolean;
  dryRun?: boolean;
  parallel?: boolean;
  interval?: string;
}

task("monitor-diamond", "Monitor ERC-2535 Diamond contract deployment")
  .addPositionalParam("diamondName", "Name of the diamond contract to monitor")
  .addOptionalParam("targetNetwork", "Target network (overrides --network flag)")
  .addOptionalParam("modules", "Comma-separated list of modules to run", "all")
  .addOptionalParam("outputFormat", "Report format (console|json|html|markdown|csv)", "console")
  .addOptionalParam("outputFile", "Output file path for reports")
  .addOptionalParam("configPath", "Path to custom configuration file")
  .addOptionalParam("deploymentPath", "Path to diamond deployment files")
  .addOptionalParam("interval", "Watch mode interval in seconds", "300")
  .addFlag("debug", "Enable verbose logging and detailed output")
  .addFlag("failOnError", "Exit with error code if monitoring fails")
  .addFlag("watch", "Enable continuous monitoring mode")
  .addFlag("dryRun", "Preview monitoring without actual execution")
  .addFlag("parallel", "Enable parallel module execution")
  .setAction(async (taskArgs: EnhancedTaskArgs, hre: HardhatRuntimeEnvironment) => {
    const startTime = Date.now();
    
    try {
      // Print header
      console.log(chalk.blue.bold('\n🔍 Diamond Monitoring System'));
      console.log(chalk.blue('══════════════════════════════\n'));

      // Validate arguments
      await validateTaskArguments(taskArgs, hre);

      // Load configuration
      const config = await loadMonitoringConfiguration(taskArgs, hre);
      
      // Get diamond information
      const diamond = await loadDiamondInfo(taskArgs, hre);

      // Initialize monitoring system
      const monitoringSystem = new DiamondMonitoringSystem();
      
      // Register available modules
      await registerMonitoringModules(monitoringSystem, hre);

      // Setup progress tracking
      setupProgressTracking(monitoringSystem, taskArgs.debug);

      if (taskArgs.dryRun) {
        return await performDryRun(monitoringSystem, diamond, config, taskArgs);
      }

      if (taskArgs.watch) {
        return await runContinuousMonitoring(monitoringSystem, diamond, config, taskArgs, hre);
      } else {
        return await runSingleMonitoring(monitoringSystem, diamond, config, taskArgs, hre);
      }

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(chalk.red.bold(`\n❌ Diamond monitoring failed after ${duration}ms:`));
      console.error(chalk.red(`   ${(error as Error).message}\n`));
      
      if (taskArgs.debug) {
        console.error(chalk.gray('Stack trace:'));
        console.error(chalk.gray((error as Error).stack));
      }
      
      if (taskArgs.failOnError) {
        process.exit(1);
      }
      
      throw error;
    }
  });

// ========================================
// Implementation Functions
// ========================================

/**
 * Validate task arguments and environment
 */
async function validateTaskArguments(taskArgs: EnhancedTaskArgs, hre: HardhatRuntimeEnvironment): Promise<void> {
  if (taskArgs.debug) {
    console.log(chalk.blue('📋 Validating arguments and environment...'));
  }

  // Validate diamond name
  if (!taskArgs.diamondName || taskArgs.diamondName.trim() === '') {
    throw new Error('Diamond name is required');
  }

  // Validate output format
  const validFormats = ['console', 'json', 'html', 'markdown', 'csv'];
  if (taskArgs.outputFormat && !validFormats.includes(taskArgs.outputFormat)) {
    throw new Error(`Invalid output format '${taskArgs.outputFormat}'. Valid options: ${validFormats.join(', ')}`);
  }

  // Validate output file path if provided
  if (taskArgs.outputFile) {
    const dir = path.dirname(path.resolve(taskArgs.outputFile));
    if (!fs.existsSync(dir)) {
      throw new Error(`Output directory does not exist: ${dir}`);
    }
  }

  // Validate configuration file if provided
  if (taskArgs.configPath && !fs.existsSync(taskArgs.configPath)) {
    throw new Error(`Configuration file not found: ${taskArgs.configPath}`);
  }

  // Validate deployment path if provided
  if (taskArgs.deploymentPath && !fs.existsSync(taskArgs.deploymentPath)) {
    throw new Error(`Deployment path not found: ${taskArgs.deploymentPath}`);
  }

  // Validate watch interval
  if (taskArgs.interval) {
    const interval = parseInt(taskArgs.interval);
    if (isNaN(interval) || interval < 10) {
      throw new Error('Watch interval must be a number >= 10 seconds');
    }
  }

  // Validate network connectivity
  if (taskArgs.targetNetwork && !hre.config.networks[taskArgs.targetNetwork]) {
    throw new Error(`Network '${taskArgs.targetNetwork}' not configured in Hardhat config`);
  }

  if (taskArgs.debug) {
    console.log(chalk.green('✅ All arguments validated successfully'));
  }
}

/**
 * Load monitoring configuration from file or defaults
 */
async function loadMonitoringConfiguration(taskArgs: EnhancedTaskArgs, hre: HardhatRuntimeEnvironment): Promise<MonitoringConfig> {
  if (taskArgs.debug) {
    console.log(chalk.blue('⚙️  Loading monitoring configuration...'));
  }

  let config: Partial<MonitoringConfig> = {};

  // Load from configuration file if provided
  if (taskArgs.configPath) {
    try {
      const configContent = fs.readFileSync(taskArgs.configPath, 'utf8');
      config = JSON.parse(configContent);
      if (taskArgs.debug) {
        console.log(chalk.green(`✅ Loaded configuration from ${taskArgs.configPath}`));
      }
    } catch (error) {
      throw new Error(`Failed to load configuration from ${taskArgs.configPath}: ${(error as Error).message}`);
    }
  }

  // Parse modules list
  const modulesList = taskArgs.modules !== 'all' 
    ? taskArgs.modules?.split(',').map(m => m.trim()).filter(m => m) || []
    : [];

  // Default modules to enable when 'all' is specified or no modules provided
  const defaultModules = ['function-selectors', 'diamond-structure', 'access-control', 'token-supply', 'erc165-compliance'];
  const enableAllModules = taskArgs.modules === 'all' || !taskArgs.modules;

  // Create monitoring configuration
  const monitoringConfig: MonitoringConfig = {
    modules: config.modules || {},
    execution: {
      parallelExecution: taskArgs.parallel || config.execution?.parallelExecution || false,
      maxConcurrency: config.execution?.maxConcurrency || 3,
      timeoutMs: config.execution?.timeoutMs || 30000,
      failFast: taskArgs.failOnError || config.execution?.failFast || false
    },
    reporting: {
      format: (taskArgs.outputFormat as ReportFormat) || 'console',
      outputPath: taskArgs.outputFile,
      verbose: taskArgs.debug || false,
      includeMetadata: config.reporting?.includeMetadata || true
    },
    network: {
      name: taskArgs.targetNetwork || hre.network.name,
      chainId: 0, // Will be set when loading diamond info
      rpcUrl: '' // Will be set when loading diamond info
    },
    diamond: {} as DiamondInfo // Will be set when loading diamond info
  };

  // Configure specific modules if provided
  if (enableAllModules) {
    // Enable all default modules
    defaultModules.forEach(moduleId => {
      monitoringConfig.modules[moduleId] = {
        enabled: true,
        config: config.modules?.[moduleId]?.config || {}
      };
    });
  } else if (modulesList.length > 0) {
    // Enable only specified modules
    modulesList.forEach(moduleId => {
      monitoringConfig.modules[moduleId] = {
        enabled: true,
        config: config.modules?.[moduleId]?.config || {}
      };
    });
  }

  if (taskArgs.debug) {
    console.log(chalk.green('✅ Monitoring configuration loaded'));
  }

  return monitoringConfig;
}

/**
 * Load diamond information from deployment files
 */
async function loadDiamondInfo(taskArgs: EnhancedTaskArgs, hre: HardhatRuntimeEnvironment): Promise<DiamondInfo> {
  if (taskArgs.debug) {
    console.log(chalk.blue('💎 Loading diamond information...'));
  }

  const networkName = taskArgs.targetNetwork || hre.network.name;
  const deploymentPath = taskArgs.deploymentPath || path.join(hre.config.paths.root, 'deployments', networkName);

  // Try to find diamond deployment file
  const possiblePaths = [
    path.join(deploymentPath, `${taskArgs.diamondName}.json`),
    path.join(deploymentPath, `${taskArgs.diamondName}Diamond.json`),
    path.join(deploymentPath, 'Diamond.json'),
    path.join(hre.config.paths.root, 'diamond-deployments', networkName, `${taskArgs.diamondName}.json`),
    // Add diamonds directory structure support
    path.join(hre.config.paths.root, 'diamonds', taskArgs.diamondName, 'deployments', `${networkName}.json`),
    path.join(hre.config.paths.root, 'diamonds', taskArgs.diamondName, 'deployments', `deployed_${networkName}.json`),
    path.join(hre.config.paths.root, 'diamonds', taskArgs.diamondName, `deployed_${networkName}.json`)
  ];

  let diamondDeployment: any = null;
  let deploymentFilePath: string = '';

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        diamondDeployment = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        deploymentFilePath = filePath;
        break;
      } catch (error) {
        if (taskArgs.debug) {
          console.log(chalk.yellow(`⚠️  Failed to parse ${filePath}: ${(error as Error).message}`));
        }
      }
    }
  }

  if (!diamondDeployment) {
    throw new Error(`Diamond deployment not found for '${taskArgs.diamondName}' on network '${networkName}'. Searched paths:\n${possiblePaths.join('\n')}`);
  }

  // Get network configuration
  const networkConfig = hre.config.networks[networkName];
  let rpcUrl = '';
  let chainId = 0;

  if (networkConfig && 'url' in networkConfig) {
    rpcUrl = networkConfig.url || '';
  }

  try {
    // Get chain ID from provider
    const ethers = (hre as any).ethers;
    if (!ethers || !ethers.provider) {
      throw new Error('Ethers provider not available. Make sure @nomicfoundation/hardhat-ethers is installed.');
    }
    
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    chainId = Number(network.chainId);
  } catch (error) {
    if (taskArgs.debug) {
      console.log(chalk.yellow(`⚠️  Could not get chain ID: ${(error as Error).message}`));
    }
  }

  const diamond: DiamondInfo = {
    name: taskArgs.diamondName,
    address: diamondDeployment.address || diamondDeployment.diamond?.address || diamondDeployment.DiamondAddress,
    configPath: deploymentFilePath,
    deploymentBlock: diamondDeployment.receipt?.blockNumber,
    network: {
      name: networkName,
      chainId,
      rpcUrl
    }
  };

  if (!diamond.address) {
    throw new Error(`Diamond address not found in deployment file: ${deploymentFilePath}`);
  }

  if (taskArgs.debug) {
    console.log(chalk.green(`✅ Diamond loaded: ${diamond.name} at ${diamond.address}`));
    console.log(chalk.blue(`   Network: ${diamond.network.name} (Chain ID: ${diamond.network.chainId})`));
  }

  return diamond;
}

/**
 * Register available monitoring modules
 */
async function registerMonitoringModules(system: DiamondMonitoringSystem, hre: HardhatRuntimeEnvironment): Promise<void> {
  console.log(chalk.blue('📦 Registering monitoring modules...'));
  
  // Import and register all available monitoring modules
  const {
    FunctionSelectorModule,
    DiamondStructureModule,
    AccessControlModule,
    TokenSupplyModule,
    ERC165ComplianceModule
  } = await import('../modules');

  const modules = [
    new FunctionSelectorModule(),
    new DiamondStructureModule(),
    new AccessControlModule(),
    new TokenSupplyModule(),
    new ERC165ComplianceModule()
  ];

  // Register each module with the monitoring system
  modules.forEach(module => {
    system.registerModule(module);
  });
  
  console.log(chalk.green('✅ Monitoring modules registered'));
}

/**
 * Setup progress tracking for monitoring execution
 */
function setupProgressTracking(system: DiamondMonitoringSystem, verbose?: boolean): void {
  if (!verbose) return;

  console.log(chalk.blue('📊 Setting up progress tracking...'));

  let moduleCount = 0;
  let completedModules = 0;

  system.addEventListener((event) => {
    switch (event.type) {
      case 'monitoring_start':
        console.log(chalk.blue('🚀 Starting diamond monitoring...'));
        break;
        
      case 'module_start':
        moduleCount++;
        console.log(chalk.blue(`▶️  [${completedModules + 1}/${moduleCount}] Starting: ${event.data.module}`));
        break;
        
      case 'module_complete':
        completedModules++;
        console.log(chalk.green(`✅ [${completedModules}/${moduleCount}] Completed: ${event.moduleId}`));
        break;
        
      case 'module_error':
        completedModules++;
        console.log(chalk.red(`❌ [${completedModules}/${moduleCount}] Failed: ${event.moduleId}`));
        console.log(chalk.red(`   Error: ${event.data.error}`));
        break;
        
      case 'issue_found':
        const issue = event.data.issue;
        const severityColor = getSeverityColor(issue.severity);
        console.log(severityColor(`   🔍 Issue found: ${issue.title} (${issue.severity})`));
        break;
        
      case 'monitoring_complete':
        console.log(chalk.green('🎉 Diamond monitoring completed'));
        break;
    }
  });
}

/**
 * Get color function for severity level
 */
function getSeverityColor(severity: string): chalk.Chalk {
  switch (severity.toLowerCase()) {
    case 'critical': return chalk.red.bold;
    case 'error': return chalk.red;
    case 'warning': return chalk.yellow;
    case 'info': return chalk.blue;
    default: return chalk.gray;
  }
}

/**
 * Perform dry run to preview monitoring without execution
 */
async function performDryRun(
  system: DiamondMonitoringSystem, 
  diamond: DiamondInfo, 
  config: MonitoringConfig, 
  taskArgs: EnhancedTaskArgs
): Promise<any> {
  console.log(chalk.yellow.bold('\n🔍 DRY RUN MODE - Preview Only\n'));
  
  console.log(chalk.blue('📊 Monitoring Preview:'));
  console.log(chalk.blue(`   Diamond: ${diamond.name} (${diamond.address})`));
  console.log(chalk.blue(`   Network: ${diamond.network.name} (${diamond.network.chainId})`));
  console.log(chalk.blue(`   Modules: ${Object.keys(config.modules).join(', ') || 'all available'}`));
  console.log(chalk.blue(`   Output: ${config.reporting.format}${config.reporting.outputPath ? ` -> ${config.reporting.outputPath}` : ''}`));
  
  const modules = system.listModules();
  console.log(chalk.blue(`\n📦 Available Modules (${modules.length}):`));
  modules.forEach((module, index) => {
    console.log(chalk.blue(`   ${index + 1}. ${module.name} (${module.id})`));
  });
  
  console.log(chalk.yellow('\n✅ Dry run completed - no actual monitoring performed'));
  
  return {
    mode: 'dry-run',
    diamond,
    config,
    availableModules: modules.length
  };
}

/**
 * Run single monitoring execution
 */
async function runSingleMonitoring(
  system: DiamondMonitoringSystem,
  diamond: DiamondInfo, 
  config: MonitoringConfig,
  taskArgs: EnhancedTaskArgs,
  hre: HardhatRuntimeEnvironment
): Promise<MonitoringReport> {
  console.log(chalk.blue('🔍 Starting single monitoring execution...\n'));
  
  const provider = (hre as any).ethers.provider;
  const moduleIds = Object.keys(config.modules).length > 0 
    ? Object.keys(config.modules) 
    : undefined;

  // Execute monitoring
  const report = await system.runMonitoring(diamond, provider, config, moduleIds);
  
  // Generate and save report
  if (taskArgs.outputFile || taskArgs.outputFormat !== 'console') {
    await generateAndSaveReport(report, taskArgs);
  }
  
  // Display summary
  displayMonitoringSummary(report, taskArgs);
  
  // Handle exit code
  if (taskArgs.failOnError && report.summary.failed > 0) {
    console.log(chalk.red.bold(`\n❌ Monitoring failed with ${report.summary.failed} failed checks`));
    process.exit(1);
  }
  
  return report;
}

/**
 * Run continuous monitoring with watch mode
 */
async function runContinuousMonitoring(
  system: DiamondMonitoringSystem,
  diamond: DiamondInfo,
  config: MonitoringConfig,
  taskArgs: EnhancedTaskArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const interval = parseInt(taskArgs.interval || '300') * 1000;
  
  console.log(chalk.yellow.bold('\n👁️  CONTINUOUS MONITORING MODE'));
  console.log(chalk.yellow(`   Interval: ${interval / 1000} seconds`));
  console.log(chalk.yellow('   Press Ctrl+C to stop\n'));
  
  let runCount = 0;
  
  const runMonitoring = async () => {
    runCount++;
    console.log(chalk.blue(`\n[${new Date().toISOString()}] Monitoring run #${runCount}`));
    console.log(chalk.blue('═'.repeat(60)));
    
    try {
      await runSingleMonitoring(system, diamond, config, taskArgs, hre);
    } catch (error) {
      console.error(chalk.red(`❌ Monitoring run #${runCount} failed: ${(error as Error).message}`));
    }
  };
  
  // Setup signal handlers for graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Stopping continuous monitoring...'));
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n\n👋 Stopping continuous monitoring...'));
    process.exit(0);
  });
  
  // Run initial monitoring
  await runMonitoring();
  
  // Setup interval for continuous monitoring
  setInterval(runMonitoring, interval);
  
  // Keep process alive
  return new Promise(() => {});
}

/**
 * Generate and save monitoring report
 */
async function generateAndSaveReport(report: MonitoringReport, taskArgs: EnhancedTaskArgs): Promise<void> {
  if (!taskArgs.outputFormat || taskArgs.outputFormat === 'console') {
    return;
  }
  
  try {
    const format = taskArgs.outputFormat as ReportFormat;
    const outputPath = taskArgs.outputFile;
    
    const options: ReportOptions = {
      includeMetadata: true,
      includeDetails: taskArgs.debug,
      colorOutput: true,
      includeRecommendations: true
    };
    
    await ReportGenerator.generateReport(report, format, outputPath, options);
    
    if (outputPath) {
      console.log(chalk.green(`📄 Report saved: ${outputPath}`));
    }
  } catch (error) {
    console.error(chalk.red(`❌ Failed to generate report: ${(error as Error).message}`));
  }
}

/**
 * Display monitoring summary
 */
function displayMonitoringSummary(report: MonitoringReport, taskArgs: EnhancedTaskArgs): void {
  console.log(chalk.blue('\n📊 Monitoring Summary:'));
  console.log(chalk.blue('═'.repeat(30)));
  
  const { summary } = report;
  
  // Status indicator
  let statusIcon = '✅';
  let statusColor = chalk.green;
  
  if (summary.failed > 0) {
    statusIcon = '❌';
    statusColor = chalk.red;
  } else if (summary.warnings > 0) {
    statusIcon = '⚠️';
    statusColor = chalk.yellow;
  }
  
  console.log(statusColor(`${statusIcon} Overall Status: ${summary.status}`));
  console.log(chalk.blue(`📊 Total Checks: ${summary.totalChecks}`));
  console.log(chalk.green(`✅ Passed: ${summary.passed}`));
  
  if (summary.failed > 0) {
    console.log(chalk.red(`❌ Failed: ${summary.failed}`));
  }
  
  if (summary.warnings > 0) {
    console.log(chalk.yellow(`⚠️  Warnings: ${summary.warnings}`));
  }
  
  if (summary.skipped > 0) {
    console.log(chalk.gray(`⏭️  Skipped: ${summary.skipped}`));
  }
  
  console.log(chalk.blue(`⏱️  Duration: ${report.duration}ms`));
  
  // Module details
  if (taskArgs.debug && report.modules.length > 0) {
    console.log(chalk.blue('\n📦 Module Results:'));
    report.modules.forEach(module => {
      const statusIcon = getModuleStatusIcon(module.status);
      const statusColor = getModuleStatusColor(module.status);
      console.log(statusColor(`   ${statusIcon} ${module.moduleName} (${module.duration}ms)`));
      
      if (module.result.issues.length > 0) {
        module.result.issues.forEach(issue => {
          const severityColor = getSeverityColor(issue.severity);
          console.log(severityColor(`      • ${issue.title} (${issue.severity})`));
        });
      }
    });
  }
}

/**
 * Get status icon for module
 */
function getModuleStatusIcon(status: MonitoringStatus): string {
  switch (status) {
    case MonitoringStatus.PASS: return '✅';
    case MonitoringStatus.FAIL: return '❌';
    case MonitoringStatus.WARNING: return '⚠️';
    case MonitoringStatus.SKIPPED: return '⏭️';
    default: return '❓';
  }
}

/**
 * Get status color for module
 */
function getModuleStatusColor(status: MonitoringStatus): chalk.Chalk {
  switch (status) {
    case MonitoringStatus.PASS: return chalk.green;
    case MonitoringStatus.FAIL: return chalk.red;
    case MonitoringStatus.WARNING: return chalk.yellow;
    case MonitoringStatus.SKIPPED: return chalk.gray;
    default: return chalk.gray;
  }
}