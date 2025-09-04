/**
 * Enhanced list modules task for Hardhat
 *
 * Provides comprehensive module listing with filtering, detailed information, and professional output
 */

import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import { DiamondMonitoringSystem } from '../core/DiamondMonitoringSystem';
import { MonitoringModule } from '../core/types';

/**
 * Extended task arguments for enhanced module listing
 */
interface EnhancedListModulesArgs {
  filter?: string;
  category?: string;
  debug?: boolean;
  format?: string;
  outputFile?: string;
  showDependencies?: boolean;
  showConfig?: boolean;
  sortBy?: string;
}

task(
  'list-modules',
  'List available diamond monitoring modules with enhanced filtering and information'
)
  .addOptionalParam('filter', 'Filter modules by name or description (regex supported)')
  .addOptionalParam('category', 'Filter modules by category')
  .addOptionalParam('format', 'Output format (console|json|table)', 'console')
  .addOptionalParam('outputFile', 'Save output to file')
  .addOptionalParam('sortBy', 'Sort modules by (name|category)', 'name')
  .addFlag('debug', 'Show detailed module information')
  .addFlag('showDependencies', 'Show module dependencies')
  .addFlag('showConfig', 'Show module configuration requirements')
  .setAction(async (taskArgs: EnhancedListModulesArgs, hre: HardhatRuntimeEnvironment) => {
    try {
      // Print header
      console.log(chalk.blue.bold('\n📦 Available Diamond Monitoring Modules'));
      console.log(chalk.blue('═'.repeat(45)));

      // Import and instantiate modules directly
      const {
        FunctionSelectorModule,
        DiamondStructureModule,
        AccessControlModule,
        TokenSupplyModule,
        ERC165ComplianceModule,
      } = await import('../modules');

      const moduleInstances: MonitoringModule[] = [
        new FunctionSelectorModule(),
        new DiamondStructureModule(),
        new AccessControlModule(),
        new TokenSupplyModule(),
        new ERC165ComplianceModule(),
      ];

      // Get all available modules
      const allModules = moduleInstances;

      if (allModules.length === 0) {
        console.log(chalk.yellow('⚠️  No monitoring modules found'));
        console.log(
          chalk.blue('💡 Make sure monitoring modules are properly installed and registered')
        );
        return;
      }

      // Apply filters
      let filteredModules = filterModules(allModules, taskArgs);

      // Sort modules
      filteredModules = sortModules(filteredModules, taskArgs.sortBy || 'name');

      // Display results based on format
      switch (taskArgs.format) {
        case 'json':
          await displayModulesJSON(filteredModules, taskArgs);
          break;
        case 'table':
          displayModulesTable(filteredModules, taskArgs);
          break;
        default:
          displayModulesConsole(filteredModules, taskArgs);
      }

      // Save to file if requested
      if (taskArgs.outputFile) {
        await saveModulesToFile(filteredModules, taskArgs);
      }

      // Display summary
      displaySummary(allModules, filteredModules, taskArgs);
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Failed to list modules:'));
      console.error(chalk.red(`   ${(error as Error).message}\n`));

      if (taskArgs.debug) {
        console.error(chalk.gray('Stack trace:'));
        console.error(chalk.gray((error as Error).stack));
      }

      throw error;
    }
  });

// ========================================
// Implementation Functions
// ========================================

/**
 * Filter modules based on criteria
 */
function filterModules(
  modules: MonitoringModule[],
  args: EnhancedListModulesArgs
): MonitoringModule[] {
  let filtered = [...modules];

  // Filter by name/description
  if (args.filter) {
    const regex = new RegExp(args.filter, 'i');
    filtered = filtered.filter(
      module => regex.test(module.name) || regex.test(module.description) || regex.test(module.id)
    );
  }

  // Filter by category
  if (args.category) {
    filtered = filtered.filter(
      module => module.category?.toLowerCase() === args.category!.toLowerCase()
    );
  }

  return filtered;
}

/**
 * Sort modules by specified criteria
 */
function sortModules(modules: MonitoringModule[], sortBy: string): MonitoringModule[] {
  return modules.sort((a, b) => {
    switch (sortBy) {
      case 'category':
        const categoryA = a.category || '';
        const categoryB = b.category || '';
        return categoryA.localeCompare(categoryB);

      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

/**
 * Display modules in console format
 */
function displayModulesConsole(modules: MonitoringModule[], args: EnhancedListModulesArgs): void {
  if (modules.length === 0) {
    console.log(chalk.yellow('🔍 No modules match the specified filters\n'));
    return;
  }

  console.log(chalk.blue(`\n📋 Found ${modules.length} module(s):\n`));

  modules.forEach((module, index) => {
    // Module header
    console.log(chalk.green.bold(`${index + 1}. ${module.name}`));
    console.log(chalk.blue(`   ID: ${module.id}`));
    console.log(chalk.gray(`   ${module.description}`));

    // Category and version
    if (module.category) {
      console.log(chalk.cyan(`   Category: ${module.category}`));
    }
    if (module.version) {
      console.log(chalk.cyan(`   Version: ${module.version}`));
    }

    // Configuration requirements (if available)
    if (args.showConfig) {
      try {
        const configReqs = module.getRequiredConfig();
        if (configReqs && configReqs.length > 0) {
          console.log(chalk.magenta('   Configuration:'));
          configReqs.forEach(req => {
            const required = req.required ? chalk.red('*') : ' ';
            console.log(
              chalk.magenta(`     ${required} ${req.key} (${req.type}): ${req.description}`)
            );
          });
        }
      } catch (error) {
        console.log(chalk.gray('   Configuration: Not available'));
      }
    }

    console.log(); // Empty line between modules
  });
}

/**
 * Display modules in table format
 */
function displayModulesTable(modules: MonitoringModule[], args: EnhancedListModulesArgs): void {
  if (modules.length === 0) {
    console.log(chalk.yellow('🔍 No modules match the specified filters\n'));
    return;
  }

  console.log('\n');

  // Header
  const nameWidth = Math.max(20, Math.max(...modules.map(m => m.name.length)) + 2);
  const categoryWidth = Math.max(12, Math.max(...modules.map(m => (m.category || '').length)) + 2);
  const idWidth = Math.max(15, Math.max(...modules.map(m => m.id.length)) + 2);

  const headerFormat = `${chalk.blue.bold('Name'.padEnd(nameWidth))}${chalk.blue.bold('Category'.padEnd(categoryWidth))}${chalk.blue.bold('ID'.padEnd(idWidth))}${chalk.blue.bold('Description')}`;
  console.log(headerFormat);
  console.log('─'.repeat(nameWidth + categoryWidth + idWidth + 30));

  // Rows
  modules.forEach(module => {
    const name = module.name.padEnd(nameWidth);
    const category = (module.category || 'N/A').padEnd(categoryWidth);
    const id = module.id.padEnd(idWidth);
    const description =
      module.description.substring(0, 50) + (module.description.length > 50 ? '...' : '');

    console.log(
      `${chalk.green(name)}${chalk.cyan(category)}${chalk.gray(id)}${chalk.white(description)}`
    );
  });

  console.log();
}

/**
 * Display modules in JSON format
 */
async function displayModulesJSON(
  modules: MonitoringModule[],
  args: EnhancedListModulesArgs
): Promise<void> {
  const output = {
    timestamp: new Date().toISOString(),
    total: modules.length,
    filters: {
      filter: args.filter,
      category: args.category,
      sortBy: args.sortBy,
    },
    modules: modules.map(module => {
      const basicInfo = {
        id: module.id,
        name: module.name,
        description: module.description,
        category: module.category,
        version: module.version,
      };

      if (args.showConfig) {
        try {
          const configReqs = module.getRequiredConfig();
          return { ...basicInfo, configRequirements: configReqs };
        } catch (error) {
          return { ...basicInfo, configRequirements: null };
        }
      }

      return basicInfo;
    }),
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Save modules information to file
 */
async function saveModulesToFile(
  modules: MonitoringModule[],
  args: EnhancedListModulesArgs
): Promise<void> {
  if (!args.outputFile) return;

  try {
    const output = {
      timestamp: new Date().toISOString(),
      total: modules.length,
      filters: {
        filter: args.filter,
        category: args.category,
        sortBy: args.sortBy,
      },
      modules: modules.map(module => ({
        id: module.id,
        name: module.name,
        description: module.description,
        category: module.category,
        version: module.version,
      })),
    };

    const outputPath = path.resolve(args.outputFile);
    await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

    console.log(chalk.green(`📄 Module list saved to: ${outputPath}`));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to save to file: ${(error as Error).message}`));
  }
}

/**
 * Display summary information
 */
function displaySummary(
  allModules: MonitoringModule[],
  filteredModules: MonitoringModule[],
  args: EnhancedListModulesArgs
): void {
  console.log(chalk.blue('\n📊 Summary:'));
  console.log(chalk.blue('═'.repeat(20)));

  console.log(chalk.blue(`📦 Total modules available: ${allModules.length}`));

  if (args.filter || args.category) {
    console.log(chalk.blue(`🔍 Modules matching filters: ${filteredModules.length}`));
  }

  // Category breakdown
  const categories = allModules.reduce(
    (acc, module) => {
      const category = module.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (Object.keys(categories).length > 1) {
    console.log(chalk.blue('\n📋 By Category:'));
    Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(chalk.cyan(`   ${category}: ${count}`));
      });
  }

  // Show available filters
  const allCategories = [...new Set(allModules.map(m => m.category).filter(Boolean))];
  if (allCategories.length > 0) {
    console.log(chalk.blue(`\n🏷️  Available categories: ${allCategories.join(', ')}`));
  }

  console.log();
}
