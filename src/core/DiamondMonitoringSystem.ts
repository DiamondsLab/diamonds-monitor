/**
 * Main Diamond Monitoring System for Hardhat Plugin
 * 
 * Orchestrates monitoring modules and manages the overall monitoring process
 * within the Hardhat environment.
 */

import { Provider } from 'ethers';
import chalk from 'chalk';

import {
  MonitoringModule,
  MonitoringConfig,
  MonitoringReport,
  MonitoringContext,
  MonitoringStatus,
  ModuleResult,
  DiamondInfo,
  NetworkInfo,
  MonitoringEvent,
  MonitoringEventListener,
  SeverityLevel,
  Logger,
  RetryConfig,
  ModuleDependency,
  MonitoringModuleWithDeps
} from './types';

/**
 * Main orchestration engine for diamond monitoring
 */
export class DiamondMonitoringSystem {
  private modules: Map<string, MonitoringModule> = new Map();
  private eventListeners: MonitoringEventListener[] = [];
  private logger: Logger;
  private readonly version = '1.0.0';
  private connectionPool: Map<string, Provider> = new Map();
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  };

  /**
   * Initialize the monitoring system
   * @param logger - Optional logger instance, defaults to console logger
   */
  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger();
  }

  /**
   * Create a default console logger
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, ...args: any[]) => {
        console.debug(chalk.gray(`[DEBUG] ${message}`), ...args);
      },
      info: (message: string, ...args: any[]) => {
        console.info(chalk.blue(`[INFO] ${message}`), ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(chalk.yellow(`[WARN] ${message}`), ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(chalk.red(`[ERROR] ${message}`), ...args);
      }
    };
  }

  /**
   * Register a monitoring module
   * @param module - The monitoring module to register
   * @throws Error if module ID is already registered
   */
  public registerModule(module: MonitoringModule): void {
    if (this.modules.has(module.id)) {
      const error = `Module with ID '${module.id}' is already registered`;
      this.logger.error(error);
      throw new Error(error);
    }

    this.modules.set(module.id, module);
    this.logger.info(`Registered module: ${module.name} (${module.id})`);
  }

  /**
   * Unregister a monitoring module
   * @param moduleId - The ID of the module to unregister
   * @returns true if module was unregistered, false if module was not found
   */
  public unregisterModule(moduleId: string): boolean {
    if (!this.modules.has(moduleId)) {
      this.logger.warn(`Module with ID '${moduleId}' is not registered`);
      return false;
    }

    this.modules.delete(moduleId);
    this.logger.info(`Unregistered module: ${moduleId}`);
    return true;
  }

  /**
   * List all registered modules
   * @returns Array of all registered monitoring modules
   */
  public listModules(): MonitoringModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get a specific module by ID
   * @param moduleId - The ID of the module to retrieve
   * @returns The module if found, undefined otherwise
   */
  public getModule(moduleId: string): MonitoringModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Add event listener for monitoring events
   * @param listener - Event listener function
   */
  public addEventListener(listener: MonitoringEventListener): void {
    this.eventListeners.push(listener);
    this.logger.debug('Added event listener');
  }

  /**
   * Remove event listener
   * @param listener - Event listener function to remove
   */
  public removeEventListener(listener: MonitoringEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
      this.logger.debug('Removed event listener');
    }
  }

  /**
   * Emit event to all listeners
   * @param event - The monitoring event to emit
   */
  public emitEvent(event: MonitoringEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error(`Error in event listener: ${(error as Error).message}`);
      }
    });
  }

  /**
   * Run monitoring with specified configuration
   * @param diamond - Diamond information
   * @param provider - Ethereum provider
   * @param config - Monitoring configuration
   * @param moduleIds - Optional array of specific module IDs to run
   * @param reportCallback - Optional callback for progress reporting
   * @returns Complete monitoring report
   */
  public async runMonitoring(
    diamond: DiamondInfo,
    provider: Provider,
    config: MonitoringConfig,
    moduleIds?: string[],
    reportCallback?: (report: MonitoringReport) => void
  ): Promise<MonitoringReport> {
    const startTime = Date.now();

    if (config.reporting.verbose) {
      this.logger.info('🔍 Starting Diamond Monitoring System');
      this.logger.info(`📍 Diamond: ${diamond.name} (${diamond.address})`);
      this.logger.info(`🌐 Network: ${diamond.network.name} (Chain ID: ${diamond.network.chainId})`);
    }

    this.emitEvent({
      type: 'monitoring_start',
      timestamp: new Date(),
      data: { diamond, config }
    });

    try {
      // Get modules to run based on configuration and optional filter
      const modulesToRun = this.getModulesToRun(config, moduleIds);

      if (modulesToRun.length === 0) {
        const error = moduleIds 
          ? `No specified modules found: ${moduleIds.join(', ')}`
          : 'No monitoring modules configured to run';
        this.logger.error(error);
        throw new Error(error);
      }

      // Order modules by dependencies
      const orderedModules = this.orderModulesByDependencies(modulesToRun);

      // Validate configurations for all modules
      await this.validateModuleConfigurations(orderedModules, { 
        diamond, 
        provider: this.getOrCreateProvider(provider, diamond.network), 
        config, 
        moduleConfig: {},
        hre: (config as any).hre
      } as MonitoringContext);

      if (config.reporting.verbose) {
        this.logger.info(`🧪 Running ${orderedModules.length} monitoring modules:`);
        orderedModules.forEach((module) => {
          this.logger.info(`   • ${module.name} (${module.id})`);
        });
      }

      // Create monitoring context
      const context: MonitoringContext = {
        diamond,
        provider,
        config,
        moduleConfig: config.modules || {},
        hre: (config as any).hre,
        verbose: config.reporting.verbose
      };

      // Execute modules
      const moduleResults = config.execution.parallelExecution
        ? await this.runModulesParallel(modulesToRun, context, config.execution.maxConcurrency)
        : await this.runModulesSequential(modulesToRun, context);

      // Generate final report
      const endTime = Date.now();
      const report = this.generateReport(moduleResults, diamond, config, startTime, endTime);

      this.emitEvent({
        type: 'monitoring_complete',
        timestamp: new Date(),
        data: { report }
      });

      if (config.reporting.verbose) {
        this.logger.info(`✅ Diamond monitoring completed in ${endTime - startTime}ms`);
      }

      if (reportCallback) {
        reportCallback(report);
      }

      return report;

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = (error as Error).message;
      
      this.logger.error(`❌ Diamond monitoring failed: ${errorMessage}`, {
        diamond: diamond.name,
        network: diamond.network.name,
        duration: endTime - startTime,
        error: error as Error
      });

      if (config.reporting.verbose) {
        this.logger.error(`❌ Diamond monitoring failed: ${errorMessage}`);
      }

      const report: MonitoringReport = {
        summary: {
          status: MonitoringStatus.FAIL,
          totalChecks: 0,
          passed: 0,
          failed: 1,
          warnings: 0,
          skipped: 0
        },
        modules: [],
        diamond,
        network: diamond.network,
        config,
        timestamp: new Date(startTime),
        duration: endTime - startTime
      };

      return report;
    }
  }

  /**
   * Validate configurations for all modules before execution
   * @param modules - Array of modules to validate
   * @param context - Monitoring context
   */
  private async validateModuleConfigurations(
    modules: MonitoringModule[],
    context: MonitoringContext
  ): Promise<void> {
    if (context.verbose) {
      this.logger.info('\n📋 Validating module configurations...');
    }

    for (const module of modules) {
      const moduleConfig = context.moduleConfig[module.id] || {};
      const validation = module.validateConfig(moduleConfig);
      
      if (!validation.isValid) {
        this.logger.error(`❌ Configuration validation failed for module '${module.id}':`);
        validation.errors.forEach(error => this.logger.error(`   • ${error}`));
        throw new Error(`Module '${module.id}' configuration validation failed`);
      }

      if (validation.warnings.length > 0 && context.verbose) {
        this.logger.warn(`⚠️  Configuration warnings for module '${module.id}':`);
        validation.warnings.forEach(warning => this.logger.warn(`   • ${warning}`));
      }
    }
  }

  /**
   * Get modules to run based on configuration and optional module filter
   * @param config - Monitoring configuration
   * @param moduleIds - Optional array of specific module IDs to run
   * @returns Array of modules to execute
   */
  private getModulesToRun(config: MonitoringConfig, moduleIds?: string[]): MonitoringModule[] {
    const availableModules = Array.from(this.modules.values());
    
    // Filter by specific module IDs if provided
    const filteredModules = moduleIds 
      ? availableModules.filter(module => moduleIds.includes(module.id))
      : availableModules;

    // Filter modules based on configuration
    const enabledModules = filteredModules.filter(module => {
      const moduleConfig = config.modules[module.id];
      return moduleConfig && moduleConfig.enabled !== false;
    });

    // Sort by priority if specified
    enabledModules.sort((a, b) => {
      const priorityA = config.modules[a.id]?.priority || 0;
      const priorityB = config.modules[b.id]?.priority || 0;
      return priorityA - priorityB;
    });

    return enabledModules;
  }

  /**
   * Order modules by their dependencies using topological sort
   * @param modules - Array of modules to order
   * @returns Modules ordered by dependencies
   */
  private orderModulesByDependencies(modules: MonitoringModule[]): MonitoringModule[] {
    const moduleMap = new Map<string, MonitoringModule>();
    const dependencyMap = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize maps
    modules.forEach(module => {
      moduleMap.set(module.id, module);
      inDegree.set(module.id, 0);
      
      // Get dependencies if module supports them
      const moduleWithDeps = module as MonitoringModuleWithDeps;
      if (moduleWithDeps.getDependencies) {
        const dependencies = moduleWithDeps.getDependencies()
          .filter(dep => moduleMap.has(dep.moduleId))
          .map(dep => dep.moduleId);
        dependencyMap.set(module.id, dependencies);
      } else {
        dependencyMap.set(module.id, []);
      }
    });

    // Calculate in-degrees
    dependencyMap.forEach((dependencies, moduleId) => {
      dependencies.forEach(depId => {
        if (inDegree.has(depId)) {
          inDegree.set(moduleId, (inDegree.get(moduleId) || 0) + 1);
        }
      });
    });

    // Topological sort
    const result: MonitoringModule[] = [];
    const queue: string[] = [];

    // Find modules with no dependencies
    inDegree.forEach((degree, moduleId) => {
      if (degree === 0) {
        queue.push(moduleId);
      }
    });

    while (queue.length > 0) {
      const moduleId = queue.shift()!;
      const module = moduleMap.get(moduleId)!;
      result.push(module);

      // Update in-degrees for dependent modules
      modules.forEach(m => {
        const deps = dependencyMap.get(m.id) || [];
        if (deps.includes(moduleId)) {
          const newDegree = (inDegree.get(m.id) || 0) - 1;
          inDegree.set(m.id, newDegree);
          if (newDegree === 0) {
            queue.push(m.id);
          }
        }
      });
    }

    // If not all modules were processed, there's a circular dependency
    if (result.length !== modules.length) {
      this.logger.warn('Circular dependency detected in modules, using original order');
      return modules;
    }

    return result;
  }

  /**
   * Get or create a provider with connection reuse
   * @param provider - Original provider
   * @param network - Network information
   * @returns Provider instance (reused if possible)
   */
  private getOrCreateProvider(provider: Provider, network: NetworkInfo): Provider {
    const cacheKey = `${network.name}-${network.chainId}`;
    
    if (this.connectionPool.has(cacheKey)) {
      this.logger.debug(`Reusing provider for ${network.name}`);
      return this.connectionPool.get(cacheKey)!;
    }

    this.connectionPool.set(cacheKey, provider);
    this.logger.debug(`Created new provider for ${network.name}`);
    return provider;
  }

  /**
   * Execute operation with exponential backoff retry
   * @param operation - Async operation to retry
   * @param operationName - Name for logging
   * @param retryConfig - Retry configuration
   * @returns Operation result
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryConfig: RetryConfig = this.defaultRetryConfig
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retryConfig.maxAttempts) {
          this.logger.error(`${operationName} failed after ${attempt} attempts: ${lastError.message}`);
          throw lastError;
        }

        const delay = Math.min(
          retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelayMs
        );

        this.logger.warn(`${operationName} failed (attempt ${attempt}/${retryConfig.maxAttempts}), retrying in ${delay}ms: ${lastError.message}`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run modules in parallel
   */
  private async runModulesParallel(
    modules: MonitoringModule[],
    context: MonitoringContext,
    maxConcurrency: number
  ): Promise<ModuleResult[]> {
    const results: ModuleResult[] = [];
    const semaphore = new Array(maxConcurrency).fill(null);
    
    const promises = modules.map(async (module, index) => {
      // Wait for available slot
      const slotIndex = index % maxConcurrency;
      await semaphore[slotIndex];
      
      const result = await this.runSingleModule(module, context);
      results.push(result);
      return result;
    });

    await Promise.all(promises);
    return results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Run modules sequentially
   */
  private async runModulesSequential(
    modules: MonitoringModule[],
    context: MonitoringContext
  ): Promise<ModuleResult[]> {
    const results: ModuleResult[] = [];

    for (const module of modules) {
      const result = await this.runSingleModule(module, context);
      results.push(result);

      // Check fail-fast configuration
      if (context.config.execution.failFast && result.status === MonitoringStatus.FAIL) {
        break;
      }
    }

    return results;
  }

  /**
   * Run a single monitoring module with retry logic and enhanced error handling
   * @param module - Module to execute
   * @param context - Monitoring context
   * @returns Module execution result
   */
  private async runSingleModule(
    module: MonitoringModule,
    context: MonitoringContext
  ): Promise<ModuleResult> {
    const startTime = new Date();

    this.emitEvent({
      type: 'module_start',
      timestamp: startTime,
      moduleId: module.id,
      data: { module: module.name }
    });

    if (context.verbose) {
      this.logger.info(`\n🔍 Running ${module.name}...`);
    }

    try {
      // Check if module can monitor this diamond with retry
      const canMonitor = await this.executeWithRetry(
        () => module.canMonitor(context.diamond, context.diamond.network),
        `${module.name} canMonitor check`
      );

      if (!canMonitor) {
        const endTime = new Date();
        const result: ModuleResult = {
          moduleId: module.id,
          moduleName: module.name,
          status: MonitoringStatus.SKIPPED,
          result: {
            status: MonitoringStatus.SKIPPED,
            issues: [],
            executionTime: endTime.getTime() - startTime.getTime(),
            metadata: { reason: 'Module cannot monitor this diamond' }
          },
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime()
        };

        if (context.verbose) {
          this.logger.info(`⏭️  Skipped ${module.name} (cannot monitor this diamond)`);
        }

        return result;
      }

      // Create module-specific context
      const moduleContext: MonitoringContext = {
        ...context,
        moduleConfig: context.moduleConfig[module.id] || {}
      };

      // Execute module monitoring with retry and timeout
      const moduleResult = await Promise.race([
        this.executeWithRetry(
          () => module.monitor(moduleContext),
          `${module.name} monitoring`
        ),
        this.createTimeoutPromise(context.config.execution.timeoutMs, module.name)
      ]);

      const endTime = new Date();
      const result: ModuleResult = {
        moduleId: module.id,
        moduleName: module.name,
        status: moduleResult.status,
        result: moduleResult,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime()
      };

      // Handle module issues
      if (moduleResult.issues.length > 0) {
        moduleResult.issues.forEach(issue => {
          this.emitEvent({
            type: 'issue_found',
            timestamp: new Date(),
            moduleId: module.id,
            data: { issue }
          });
        });
      }

      if (context.verbose) {
        const statusIcon = this.getStatusIcon(moduleResult.status);
        this.logger.info(`${statusIcon} ${module.name} completed in ${moduleResult.executionTime}ms`);
        
        if (moduleResult.issues.length > 0) {
          this.logger.warn(`   Found ${moduleResult.issues.length} issue(s)`);
        }
      }

      this.emitEvent({
        type: 'module_complete',
        timestamp: endTime,
        moduleId: module.id,
        data: { result: moduleResult }
      });

      return result;

    } catch (error) {
      const endTime = new Date();
      const errorMessage = (error as Error).message;
      
      this.logger.error(`Module '${module.name}' execution failed: ${errorMessage}`, { 
        moduleId: module.id, 
        duration: endTime.getTime() - startTime.getTime(),
        error: error as Error
      });

      const errorResult: ModuleResult = {
        moduleId: module.id,
        moduleName: module.name,
        status: MonitoringStatus.FAIL,
        result: {
          status: MonitoringStatus.FAIL,
          issues: [{
            id: 'module-error',
            title: 'Module Execution Error',
            description: `Module '${module.name}' failed: ${errorMessage}`,
            severity: SeverityLevel.CRITICAL,
            category: 'system',
            metadata: { 
              stackTrace: (error as Error).stack,
              timestamp: endTime.toISOString()
            }
          }],
          executionTime: endTime.getTime() - startTime.getTime(),
          metadata: { error: errorMessage }
        },
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: error as Error
      };

      if (context.verbose) {
        this.logger.error(`❌ ${module.name} failed: ${errorMessage}`);
      }

      this.emitEvent({
        type: 'module_error',
        timestamp: endTime,
        moduleId: module.id,
        data: { error: errorMessage }
      });

      return errorResult;
    } finally {
      // Cleanup if module supports it
      try {
        if (module.cleanup) {
          await module.cleanup(context);
        }
      } catch (cleanupError) {
        this.logger.warn(`Cleanup failed for module '${module.name}': ${(cleanupError as Error).message}`);
      }
    }
  }

  /**
   * Create a timeout promise for module execution
   */
  private createTimeoutPromise(timeoutMs: number, moduleName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Module '${moduleName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Generate final monitoring report
   */
  private generateReport(
    moduleResults: ModuleResult[],
    diamond: DiamondInfo,
    config: MonitoringConfig,
    startTime: number,
    endTime: number
  ): MonitoringReport {
    const totalChecks = moduleResults.reduce((sum, result) => sum + (result.result.issues?.length || 0) + 1, 0);
    const passed = moduleResults.filter(r => r.status === MonitoringStatus.PASS).length;
    const failed = moduleResults.filter(r => r.status === MonitoringStatus.FAIL).length;
    const warnings = moduleResults.filter(r => r.status === MonitoringStatus.WARNING).length;
    const skipped = moduleResults.filter(r => r.status === MonitoringStatus.SKIPPED).length;

    // Determine overall status
    let overallStatus = MonitoringStatus.PASS;
    if (failed > 0) {
      overallStatus = MonitoringStatus.FAIL;
    } else if (warnings > 0) {
      overallStatus = MonitoringStatus.WARNING;
    }

    return {
      summary: {
        status: overallStatus,
        totalChecks,
        passed,
        failed,
        warnings,
        skipped
      },
      modules: moduleResults,
      diamond,
      network: diamond.network,
      config,
      timestamp: new Date(startTime),
      duration: endTime - startTime
    };
  }

  /**
   * Get status icon for display
   */
  private getStatusIcon(status: MonitoringStatus): string {
    switch (status) {
      case MonitoringStatus.PASS:
        return '✅';
      case MonitoringStatus.FAIL:
        return '❌';
      case MonitoringStatus.WARNING:
        return '⚠️';
      case MonitoringStatus.SKIPPED:
        return '⏭️';
      default:
        return '❓';
    }
  }

  /**
   * Get system version
   * @returns System version string
   */
  public getVersion(): string {
    return this.version;
  }

  /**
   * Get system statistics
   * @returns System statistics
   */
  public getStatistics(): {
    registeredModules: number;
    activeListeners: number;
    connectionPoolSize: number;
  } {
    return {
      registeredModules: this.modules.size,
      activeListeners: this.eventListeners.length,
      connectionPoolSize: this.connectionPool.size
    };
  }

  /**
   * Clean up connection pool
   */
  public cleanupConnections(): void {
    this.connectionPool.clear();
    this.logger.debug('Connection pool cleared');
  }

  /**
   * Set custom logger
   * @param logger - Logger implementation
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Clear all modules and listeners (for testing)
   */
  public reset(): void {
    this.modules.clear();
    this.eventListeners.length = 0;
    this.connectionPool.clear();
    this.logger.debug('DiamondMonitoringSystem reset');
  }
}
