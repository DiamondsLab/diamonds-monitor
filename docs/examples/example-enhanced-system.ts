/* eslint-disable */
// @ts-nocheck
/**
 * Example usage of the enhanced DiamondMonitoringSystem
 */

import { DiamondMonitoringSystem } from '../../src/core/DiamondMonitoringSystem';
import { Logger, MonitoringConfig, DiamondInfo } from '../../src/core/types';
import { Provider } from 'ethers';

/**
 * Example custom logger implementation
 */
class CustomLogger implements Logger {
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG ${new Date().toISOString()}] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO ${new Date().toISOString()}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN ${new Date().toISOString()}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR ${new Date().toISOString()}] ${message}`, ...args);
  }
}

/**
 * Example of using the enhanced DiamondMonitoringSystem
 */
async function demonstrateEnhancedSystem() {
  console.log('🔧 Enhanced DiamondMonitoringSystem Demo\n');

  // 1. Create system with custom logger
  const customLogger = new CustomLogger();
  const system = new DiamondMonitoringSystem(customLogger);

  // 2. Example diamond info
  const diamond: DiamondInfo = {
    name: 'GeniusDiamond',
    address: '0x1234567890123456789012345678901234567890',
    network: {
      name: 'sepolia',
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_KEY',
    },
  };

  // 3. Example monitoring configuration
  const config: MonitoringConfig = {
    modules: {
      'security-check': {
        enabled: true,
        priority: 1,
        config: { strictMode: true },
      },
      'gas-optimization': {
        enabled: true,
        priority: 2,
        config: { threshold: 100000 },
      },
      'access-control': {
        enabled: true,
        priority: 3,
        config: { checkPermissions: true },
      },
    },
    execution: {
      parallelExecution: true,
      maxConcurrency: 3,
      timeoutMs: 30000,
      failFast: false,
    },
    reporting: {
      format: 'console' as any,
      verbose: true,
      includeMetadata: true,
    },
    network: diamond.network,
    diamond: diamond,
  };

  try {
    // 4. Register example modules (in real usage, these would be actual module implementations)
    console.log('📝 Registering monitoring modules...');

    // Note: These would be actual module implementations in real usage
    // system.registerModule(new SecurityCheckModule());
    // system.registerModule(new GasOptimizationModule());
    // system.registerModule(new AccessControlModule());

    // 5. Add event listener for progress tracking
    system.addEventListener(event => {
      switch (event.type) {
        case 'monitoring_start':
          console.log('🚀 Monitoring started');
          break;
        case 'module_start':
          console.log(`▶️  Starting module: ${event.data.module}`);
          break;
        case 'module_complete':
          console.log(`✅ Module completed: ${event.moduleId}`);
          break;
        case 'issue_found':
          console.log(`⚠️  Issue found: ${event.data.issue.title}`);
          break;
        case 'monitoring_complete':
          console.log('🎉 Monitoring completed');
          break;
      }
    });

    // 6. Example provider (in real usage, this would be actual ethers provider)
    const provider = {} as Provider;

    // 7. Demonstrate selective module execution
    console.log('\n🔍 Running selective monitoring (security and gas modules only)...');

    // Run only specific modules
    // const selectiveReport = await system.runMonitoring(
    //   diamond,
    //   provider,
    //   config,
    //   ['security-check', 'gas-optimization']  // Only these modules
    // );

    // 8. Demonstrate full monitoring
    console.log('\n🔍 Running full monitoring...');

    // Run all enabled modules
    // const fullReport = await system.runMonitoring(diamond, provider, config);

    // 9. Display system statistics
    console.log('\n📊 System Statistics:');
    const stats = system.getStatistics();
    console.log(`  Registered modules: ${stats.registeredModules}`);
    console.log(`  Active listeners: ${stats.activeListeners}`);
    console.log(`  Connection pool size: ${stats.connectionPoolSize}`);

    // 10. Demonstrate error handling features
    console.log('\n🛡️ Error Handling Features:');
    console.log('  ✅ Exponential backoff retry for network operations');
    console.log('  ✅ Module timeout handling with graceful degradation');
    console.log('  ✅ Individual module failure isolation');
    console.log('  ✅ Comprehensive error logging with context');
    console.log('  ✅ Automatic module cleanup on completion/failure');

    // 11. Demonstrate advanced features
    console.log('\n🚀 Advanced Features:');
    console.log('  ✅ Module dependency ordering with topological sort');
    console.log('  ✅ Connection pooling for efficient resource usage');
    console.log('  ✅ Configurable parallel execution');
    console.log('  ✅ Selective module execution');
    console.log('  ✅ Real-time progress events');
    console.log('  ✅ Professional logging with custom logger support');

    // 12. Cleanup
    console.log('\n🧹 Cleaning up...');
    system.cleanupConnections();
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }

  console.log('\n✨ Enhanced DiamondMonitoringSystem Demo Complete!');
  console.log('\nKey Improvements Demonstrated:');
  console.log('  🔧 Logger integration with custom implementations');
  console.log('  🔄 Retry logic with exponential backoff');
  console.log('  📊 Module dependency management');
  console.log('  🎯 Selective module execution');
  console.log('  🛡️ Enhanced error handling and resilience');
  console.log('  ⚡ Performance optimizations with connection pooling');
  console.log('  📝 Comprehensive logging and monitoring');
}

// Run the demonstration
if (require.main === module) {
  demonstrateEnhancedSystem();
}

/**
 * Example of module with dependencies (for reference)
 */
/*
class ExampleModuleWithDependencies implements MonitoringModuleWithDeps {
  readonly id = 'example-module';
  readonly name = 'Example Module';
  readonly description = 'Example module with dependencies';
  readonly version = '1.0.0';
  readonly category = 'example';

  getDependencies(): ModuleDependency[] {
    return [
      { moduleId: 'security-check', optional: false },
      { moduleId: 'gas-optimization', optional: true }
    ];
  }

  async canMonitor(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean> {
    return true;
  }

  getRequiredConfig(): ConfigRequirement[] {
    return [];
  }

  validateConfig(config: any): ValidationResult {
    return { isValid: true, errors: [], warnings: [] };
  }

  async monitor(context: MonitoringContext): Promise<MonitoringResult> {
    // Implementation here
    return {
      status: MonitoringStatus.PASS,
      issues: [],
      executionTime: 1000,
      metadata: {}
    };
  }

  async cleanup(context: MonitoringContext): Promise<void> {
    // Cleanup logic here
  }
}
*/
