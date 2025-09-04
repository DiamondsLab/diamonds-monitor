/**
 * Continuous diamond monitoring task for Hardhat
 *
 * Provides dedicated continuous monitoring with enhanced scheduling, alerting, and reporting
 */

import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import {
  DiamondInfo,
  MonitoringConfig,
  ReportFormat,
  MonitoringReport,
  MonitoringStatus,
} from '../core/types';
import { DiamondMonitoringSystem } from '../core/DiamondMonitoringSystem';
import { ReportGenerator } from '../reports/ReportGenerator';
import { ReportOptions } from '../reports/types';

/**
 * Extended task arguments for continuous monitoring
 */
interface ContinuousMonitoringArgs {
  diamondName: string;
  targetNetwork?: string;
  modules?: string;
  interval?: string;
  outputFormat?: string;
  outputDir?: string;
  configPath?: string;
  deploymentPath?: string;
  debug?: boolean;
  failOnError?: boolean;
  alertThreshold?: string;
  maxRuns?: string;
  logRotation?: boolean;
  autoRestart?: boolean;
}

task('monitor-continuous', 'Run continuous diamond monitoring with scheduling and alerting')
  .addPositionalParam('diamondName', 'Name of the diamond contract to monitor')
  .addOptionalParam('targetNetwork', 'Target network (overrides --network flag)')
  .addOptionalParam('modules', 'Comma-separated list of modules to run', 'all')
  .addOptionalParam('interval', 'Monitoring interval in seconds', '300')
  .addOptionalParam('outputFormat', 'Report format (console|json|html|markdown|csv)', 'console')
  .addOptionalParam('outputDir', 'Output directory for reports (auto-generated filenames)')
  .addOptionalParam('configPath', 'Path to custom configuration file')
  .addOptionalParam('deploymentPath', 'Path to diamond deployment files')
  .addOptionalParam('alertThreshold', 'Alert threshold (low|medium|high|critical)', 'high')
  .addOptionalParam('maxRuns', 'Maximum number of runs (0 = infinite)', '0')
  .addFlag('debug', 'Enable verbose logging and detailed output')
  .addFlag('failOnError', 'Exit with error code if monitoring fails')
  .addFlag('logRotation', 'Enable log rotation for output files')
  .addFlag('autoRestart', 'Automatically restart on critical failures')
  .setAction(async (taskArgs: ContinuousMonitoringArgs, hre: HardhatRuntimeEnvironment) => {
    const startTime = Date.now();

    try {
      // Print header
      console.log(chalk.blue.bold('\n👁️  Continuous Diamond Monitoring System'));
      console.log(chalk.blue('═'.repeat(45)));

      // Validate and setup monitoring
      await validateContinuousArgs(taskArgs, hre);

      const config = await loadContinuousConfiguration(taskArgs, hre);
      const diamond = await loadDiamondInfo(taskArgs, hre);

      // Initialize monitoring system
      const monitoringSystem = new DiamondMonitoringSystem();

      // Setup continuous monitoring
      await setupContinuousMonitoring(monitoringSystem, diamond, config, taskArgs, hre);
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Continuous monitoring setup failed:'));
      console.error(chalk.red(`   ${(error as Error).message}\n`));

      if (taskArgs.debug) {
        console.error(chalk.gray('Stack trace:'));
        console.error(chalk.gray((error as Error).stack));
      }

      process.exit(1);
    }
  });

// ========================================
// Implementation Functions
// ========================================

/**
 * Validate continuous monitoring arguments
 */
async function validateContinuousArgs(
  taskArgs: ContinuousMonitoringArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  if (taskArgs.debug) {
    console.log(chalk.blue('📋 Validating continuous monitoring arguments...'));
  }

  // Validate interval
  const interval = parseInt(taskArgs.interval || '300');
  if (isNaN(interval) || interval < 30) {
    throw new Error('Monitoring interval must be at least 30 seconds');
  }

  // Validate max runs
  if (taskArgs.maxRuns) {
    const maxRuns = parseInt(taskArgs.maxRuns);
    if (isNaN(maxRuns) || maxRuns < 0) {
      throw new Error('Max runs must be a non-negative number');
    }
  }

  // Validate alert threshold
  const validThresholds = ['low', 'medium', 'high', 'critical'];
  if (taskArgs.alertThreshold && !validThresholds.includes(taskArgs.alertThreshold)) {
    throw new Error(
      `Invalid alert threshold '${taskArgs.alertThreshold}'. Valid options: ${validThresholds.join(', ')}`
    );
  }

  // Validate output directory
  if (taskArgs.outputDir) {
    if (!fs.existsSync(taskArgs.outputDir)) {
      fs.mkdirSync(taskArgs.outputDir, { recursive: true });
      console.log(chalk.green(`📁 Created output directory: ${taskArgs.outputDir}`));
    }
  }

  if (taskArgs.debug) {
    console.log(chalk.green('✅ Arguments validated successfully'));
  }
}

/**
 * Load continuous monitoring configuration
 */
async function loadContinuousConfiguration(
  taskArgs: ContinuousMonitoringArgs,
  hre: HardhatRuntimeEnvironment
): Promise<MonitoringConfig> {
  if (taskArgs.debug) {
    console.log(chalk.blue('⚙️  Loading continuous monitoring configuration...'));
  }

  let config: Partial<MonitoringConfig> = {};

  // Load from configuration file if provided
  if (taskArgs.configPath) {
    try {
      const configContent = fs.readFileSync(taskArgs.configPath, 'utf8');
      config = JSON.parse(configContent);
    } catch (error) {
      throw new Error(
        `Failed to load configuration from ${taskArgs.configPath}: ${(error as Error).message}`
      );
    }
  }

  // Parse modules list
  const modulesList =
    taskArgs.modules !== 'all'
      ? taskArgs.modules
          ?.split(',')
          .map(m => m.trim())
          .filter(m => m) || []
      : [];

  // Create monitoring configuration
  const monitoringConfig: MonitoringConfig = {
    modules: config.modules || {},
    execution: {
      parallelExecution: config.execution?.parallelExecution || false,
      maxConcurrency: config.execution?.maxConcurrency || 3,
      timeoutMs: config.execution?.timeoutMs || 60000, // Increased for continuous
      failFast: config.execution?.failFast || false,
    },
    reporting: {
      format: (taskArgs.outputFormat as ReportFormat) || 'console',
      outputPath: taskArgs.outputDir,
      verbose: taskArgs.debug || false,
      includeMetadata: config.reporting?.includeMetadata || true,
    },
    network: {
      name: taskArgs.targetNetwork || hre.network.name,
      chainId: 0, // Will be set when loading diamond info
      rpcUrl: '', // Will be set when loading diamond info
    },
    diamond: {} as DiamondInfo, // Will be set when loading diamond info
  };

  // Configure specific modules if provided
  if (modulesList.length > 0) {
    modulesList.forEach(moduleId => {
      monitoringConfig.modules[moduleId] = {
        enabled: true,
        config: config.modules?.[moduleId]?.config || {},
      };
    });
  }

  if (taskArgs.debug) {
    console.log(chalk.green('✅ Configuration loaded for continuous monitoring'));
  }

  return monitoringConfig;
}

/**
 * Load diamond information for continuous monitoring
 */
async function loadDiamondInfo(
  taskArgs: ContinuousMonitoringArgs,
  hre: HardhatRuntimeEnvironment
): Promise<DiamondInfo> {
  if (taskArgs.debug) {
    console.log(chalk.blue('💎 Loading diamond information...'));
  }

  const networkName = taskArgs.targetNetwork || hre.network.name;
  const deploymentPath =
    taskArgs.deploymentPath || path.join(hre.config.paths.root, 'deployments', networkName);

  // Try to find diamond deployment file
  const possiblePaths = [
    path.join(deploymentPath, `${taskArgs.diamondName}.json`),
    path.join(deploymentPath, `${taskArgs.diamondName}Diamond.json`),
    path.join(deploymentPath, 'Diamond.json'),
    path.join(
      hre.config.paths.root,
      'diamond-deployments',
      networkName,
      `${taskArgs.diamondName}.json`
    ),
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
    throw new Error(
      `Diamond deployment not found for '${taskArgs.diamondName}' on network '${networkName}'`
    );
  }

  // Get network configuration
  const networkConfig = hre.config.networks[networkName];
  let rpcUrl = '';
  let chainId = 0;

  if (networkConfig && 'url' in networkConfig) {
    rpcUrl = networkConfig.url || '';
  }

  try {
    const provider = (hre as any).ethers.provider;
    const network = await provider.getNetwork();
    chainId = Number(network.chainId);
  } catch (error) {
    if (taskArgs.debug) {
      console.log(chalk.yellow(`⚠️  Could not get chain ID: ${(error as Error).message}`));
    }
  }

  const diamond: DiamondInfo = {
    name: taskArgs.diamondName,
    address: diamondDeployment.address || diamondDeployment.diamond?.address,
    configPath: deploymentFilePath,
    deploymentBlock: diamondDeployment.receipt?.blockNumber,
    network: {
      name: networkName,
      chainId,
      rpcUrl,
    },
  };

  if (!diamond.address) {
    throw new Error(`Diamond address not found in deployment file: ${deploymentFilePath}`);
  }

  if (taskArgs.debug) {
    console.log(chalk.green(`✅ Diamond loaded: ${diamond.name} at ${diamond.address}`));
  }

  return diamond;
}

/**
 * Setup and run continuous monitoring
 */
async function setupContinuousMonitoring(
  system: DiamondMonitoringSystem,
  diamond: DiamondInfo,
  config: MonitoringConfig,
  taskArgs: ContinuousMonitoringArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const interval = parseInt(taskArgs.interval || '300') * 1000;
  const maxRuns = parseInt(taskArgs.maxRuns || '0');

  console.log(chalk.yellow.bold('\n👁️  STARTING CONTINUOUS MONITORING'));
  console.log(chalk.yellow(`   Diamond: ${diamond.name} (${diamond.address})`));
  console.log(
    chalk.yellow(`   Network: ${diamond.network.name} (Chain ID: ${diamond.network.chainId})`)
  );
  console.log(chalk.yellow(`   Interval: ${interval / 1000} seconds`));
  console.log(chalk.yellow(`   Max Runs: ${maxRuns === 0 ? 'unlimited' : maxRuns}`));
  console.log(chalk.yellow(`   Alert Threshold: ${taskArgs.alertThreshold}`));
  console.log(chalk.yellow('   Press Ctrl+C to stop'));
  console.log(chalk.yellow('═'.repeat(60)));

  let runCount = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  // Setup signal handlers for graceful shutdown
  let isShuttingDown = false;
  process.on('SIGINT', () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      console.log(chalk.yellow('\n\n👋 Graceful shutdown initiated...'));
      console.log(chalk.blue(`📊 Total monitoring runs completed: ${runCount}`));
      console.log(chalk.blue('💾 Saving final state...'));
      process.exit(0);
    }
  });

  process.on('SIGTERM', () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      console.log(chalk.yellow('\n\n👋 Graceful shutdown initiated...'));
      process.exit(0);
    }
  });

  // Main monitoring loop
  const runMonitoring = async (): Promise<void> => {
    if (isShuttingDown) return;

    runCount++;
    const timestamp = new Date().toISOString();

    console.log(chalk.blue(`\n[${timestamp}] Monitoring run #${runCount}`));
    console.log(chalk.blue('─'.repeat(60)));

    try {
      const provider = (hre as any).ethers.provider;
      const moduleIds =
        Object.keys(config.modules).length > 0 ? Object.keys(config.modules) : undefined;

      // Execute monitoring
      const report = await system.runMonitoring(diamond, provider, config, moduleIds);

      // Handle results
      await handleMonitoringResults(report, taskArgs, runCount);

      // Check for alerts
      await checkAlerts(report, taskArgs);

      // Reset consecutive failures on success
      consecutiveFailures = 0;

      console.log(chalk.green(`✅ Run #${runCount} completed successfully`));
    } catch (error) {
      consecutiveFailures++;

      console.error(chalk.red(`❌ Run #${runCount} failed: ${(error as Error).message}`));

      if (taskArgs.debug) {
        console.error(chalk.gray((error as Error).stack));
      }

      // Check if we should restart or exit
      if (consecutiveFailures >= maxConsecutiveFailures) {
        if (taskArgs.autoRestart) {
          console.log(
            chalk.yellow(
              `🔄 Auto-restarting after ${maxConsecutiveFailures} consecutive failures...`
            )
          );
          consecutiveFailures = 0;
        } else {
          console.error(
            chalk.red.bold(`💥 Stopping after ${maxConsecutiveFailures} consecutive failures`)
          );
          process.exit(1);
        }
      }
    }
  };

  // Run initial monitoring
  await runMonitoring();

  // Check if we should exit after first run
  if (maxRuns === 1) {
    console.log(chalk.blue('\n✅ Single run completed'));
    return;
  }

  // Setup interval for continuous monitoring
  const intervalId = setInterval(async () => {
    if (isShuttingDown) {
      clearInterval(intervalId);
      return;
    }

    if (maxRuns > 0 && runCount >= maxRuns) {
      clearInterval(intervalId);
      console.log(chalk.blue(`\n✅ Completed maximum ${maxRuns} runs`));
      process.exit(0);
      return;
    }

    await runMonitoring();
  }, interval);

  // Keep process alive
  return new Promise(() => {});
}

/**
 * Handle monitoring results
 */
async function handleMonitoringResults(
  report: MonitoringReport,
  taskArgs: ContinuousMonitoringArgs,
  runCount: number
): Promise<void> {
  // Generate timestamped filename if output directory is specified
  if (taskArgs.outputDir && taskArgs.outputFormat !== 'console') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `monitoring-${taskArgs.diamondName}-${timestamp}-run${runCount}.${getFileExtension(taskArgs.outputFormat)}`;
    const outputPath = path.join(taskArgs.outputDir, filename);

    try {
      const format = taskArgs.outputFormat as ReportFormat;
      const options: ReportOptions = {
        includeMetadata: true,
        includeDetails: taskArgs.debug,
        colorOutput: false, // Disable colors for file output
        includeRecommendations: true,
      };

      await ReportGenerator.generateReport(report, format, outputPath, options);

      if (taskArgs.debug) {
        console.log(chalk.green(`📄 Report saved: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save report: ${(error as Error).message}`));
    }
  }

  // Display summary to console
  displayRunSummary(report, runCount, taskArgs.debug);
}

/**
 * Check for alerts based on threshold
 */
async function checkAlerts(
  report: MonitoringReport,
  taskArgs: ContinuousMonitoringArgs
): Promise<void> {
  const threshold = taskArgs.alertThreshold || 'high';
  const criticalIssues = report.modules.flatMap(m =>
    m.result.issues.filter(issue => shouldAlert(issue.severity, threshold))
  );

  if (criticalIssues.length > 0) {
    console.log(chalk.red.bold(`\n🚨 ALERT: ${criticalIssues.length} critical issue(s) detected!`));
    criticalIssues.forEach(issue => {
      console.log(chalk.red(`   • ${issue.title} (${issue.severity})`));
    });

    // Here you could integrate with alerting systems (email, Slack, PagerDuty, etc.)
    // await sendAlert(criticalIssues, taskArgs);
  }
}

/**
 * Check if issue severity should trigger alert
 */
function shouldAlert(severity: string, threshold: string): boolean {
  const severityLevels = { info: 0, warning: 1, error: 2, critical: 3 };
  const thresholdLevels = { low: 0, medium: 1, high: 2, critical: 3 };

  const severityLevel = severityLevels[severity.toLowerCase() as keyof typeof severityLevels] ?? 0;
  const thresholdLevel =
    thresholdLevels[threshold.toLowerCase() as keyof typeof thresholdLevels] ?? 2;

  return severityLevel >= thresholdLevel;
}

/**
 * Display run summary
 */
function displayRunSummary(report: MonitoringReport, runCount: number, verbose?: boolean): void {
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

  console.log(
    statusColor(`${statusIcon} Run #${runCount}: ${summary.status} (${report.duration}ms)`)
  );
  console.log(
    chalk.blue(
      `   Checks: ${summary.totalChecks} | Passed: ${summary.passed} | Failed: ${summary.failed} | Warnings: ${summary.warnings}`
    )
  );

  // Show module details in verbose mode
  if (verbose && report.modules.length > 0) {
    report.modules.forEach(module => {
      if (module.result.issues.length > 0) {
        console.log(chalk.blue(`   ${module.moduleName}: ${module.result.issues.length} issue(s)`));
      }
    });
  }
}

/**
 * Get file extension for report format
 */
function getFileExtension(format?: string): string {
  switch (format) {
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'markdown':
      return 'md';
    case 'csv':
      return 'csv';
    default:
      return 'txt';
  }
}
