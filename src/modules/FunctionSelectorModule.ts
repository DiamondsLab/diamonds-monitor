/**
 * Function Selector Monitoring Module for Hardhat Diamond Monitor Plugin
 *
 * Comprehensive selector validation using diamonds module utilities for accurate
 * comparison between deployment configuration and on-chain state.
 */

import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import * as path from 'path';

import {
  MonitoringModule,
  MonitoringContext,
  MonitoringResult,
  MonitoringIssue,
  DiamondInfo,
  NetworkInfo,
  ValidationResult,
  ConfigRequirement,
  SeverityLevel,
  MonitoringStatus,
} from '../core/types';

/**
 * Facet structure from diamonds module
 */
interface FacetStruct {
  facetAddress: string;
  functionSelectors: string[];
}

/**
 * Enhanced selector information for detailed tracking
 */
interface SelectorInfo {
  selector: string;
  functionSignature?: string;
  facetAddress: string;
  facetName?: string;
  source: 'deployment' | 'onchain' | 'abi';
  verified?: boolean;
}

/**
 * Deployed diamond data structure matching the deployment files
 */
interface DeployedDiamondData {
  DiamondAddress?: string;
  DeployerAddress?: string;
  DeployedFacets?: Record<
    string,
    {
      address?: string;
      funcSelectors?: string[];
      tx_hash?: string;
      version?: number;
      verified?: boolean;
      abi?: any[];
    }
  >;
  FacetDeployedInfo?: Record<
    string,
    {
      address?: string;
      funcSelectors?: string[];
      tx_hash?: string;
      version?: number;
      verified?: boolean;
      abi?: any[];
    }
  >;
}

/**
 * Configuration for the function selector module
 */
interface FunctionSelectorModuleConfig {
  strictMode?: boolean;
  ignoreSelectors?: string[];
  allowAddressChanges?: boolean;
  customAbiPath?: string;
  skipValidation?: string[];
  ignoreVerificationIssues?: boolean;
  customConfigPath?: string;
  enableSelectorConflictCheck?: boolean;
  enableOrphanCheck?: boolean;
}

/**
 * Function Selector Monitoring Module
 *
 * Comprehensive validation using diamonds module utilities for accurate
 * comparison between deployment configuration and on-chain state.
 */
export class FunctionSelectorModule implements MonitoringModule {
  public readonly id = 'function-selectors';
  public readonly name = 'Function Selector Monitoring';
  public readonly description =
    'Validates function selector registry against diamond configuration and deployment artifacts with comprehensive selector analysis';
  public readonly version = '1.0.0';
  public readonly category = 'structural';

  // Diamond Loupe ABI for querying facets
  private readonly diamondLoupeABI = [
    'function facets() view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
  ];

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'strictMode',
        type: 'boolean',
        required: false,
        description: 'Enable strict validation mode requiring exact matching',
        defaultValue: false,
      },
      {
        key: 'ignoreSelectors',
        type: 'array',
        required: false,
        description: 'Array of function selectors to ignore during validation',
      },
      {
        key: 'allowAddressChanges',
        type: 'boolean',
        required: false,
        description: 'Allow facet address changes for existing selectors',
        defaultValue: false,
      },
      {
        key: 'customAbiPath',
        type: 'string',
        required: false,
        description: 'Path to custom ABI file for function signature resolution',
      },
      {
        key: 'skipValidation',
        type: 'array',
        required: false,
        description: 'Array of validation types to skip (e.g., "orphaned", "conflicts")',
      },
      {
        key: 'ignoreVerificationIssues',
        type: 'boolean',
        required: false,
        description: 'Ignore verification status issues',
        defaultValue: true,
      },
      {
        key: 'customConfigPath',
        type: 'string',
        required: false,
        description: 'Path to custom deployment configuration file',
      },
      {
        key: 'enableSelectorConflictCheck',
        type: 'boolean',
        required: false,
        description: 'Enable checking for selector conflicts across facets',
        defaultValue: true,
      },
      {
        key: 'enableOrphanCheck',
        type: 'boolean',
        required: false,
        description: 'Enable checking for orphaned selectors',
        defaultValue: true,
      },
    ];
  }

  /**
   * Validate module configuration
   */
  public validateConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.strictMode !== undefined && typeof config.strictMode !== 'boolean') {
      errors.push('strictMode must be a boolean');
    }

    if (config.ignoreSelectors !== undefined && !Array.isArray(config.ignoreSelectors)) {
      errors.push('ignoreSelectors must be an array of strings');
    }

    if (
      config.allowAddressChanges !== undefined &&
      typeof config.allowAddressChanges !== 'boolean'
    ) {
      errors.push('allowAddressChanges must be a boolean');
    }

    if (config.customAbiPath !== undefined && typeof config.customAbiPath !== 'string') {
      errors.push('customAbiPath must be a string');
    }

    if (config.skipValidation !== undefined && !Array.isArray(config.skipValidation)) {
      errors.push('skipValidation must be an array of strings');
    }

    if (
      config.ignoreVerificationIssues !== undefined &&
      typeof config.ignoreVerificationIssues !== 'boolean'
    ) {
      errors.push('ignoreVerificationIssues must be a boolean');
    }

    if (config.customConfigPath !== undefined && typeof config.customConfigPath !== 'string') {
      errors.push('customConfigPath must be a string');
    }

    if (
      config.enableSelectorConflictCheck !== undefined &&
      typeof config.enableSelectorConflictCheck !== 'boolean'
    ) {
      errors.push('enableSelectorConflictCheck must be a boolean');
    }

    if (config.enableOrphanCheck !== undefined && typeof config.enableOrphanCheck !== 'boolean') {
      errors.push('enableOrphanCheck must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if this module can monitor the given diamond
   */
  public async canMonitor(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean> {
    return true;
  }

  /**
   * Execute comprehensive function selector monitoring
   */
  public async monitor(context: MonitoringContext): Promise<MonitoringResult> {
    const startTime = Date.now();
    const issues: MonitoringIssue[] = [];
    const moduleConfig = this.getModuleConfig<FunctionSelectorModuleConfig>(context);

    this.log(context, 'info', '🔍 Starting comprehensive function selector monitoring...');

    try {
      // 1. Load expected selectors from deployment configuration
      this.log(context, 'info', '📋 Loading expected selectors from deployment configuration...');
      const expectedSelectors = await this.loadExpectedSelectors(context);

      if (expectedSelectors.length === 0) {
        issues.push(
          this.createIssue(
            'no-expected-selectors',
            'No Expected Selectors Found',
            'Could not load expected function selectors from deployment configuration',
            SeverityLevel.WARNING,
            'configuration',
            'Ensure deployment configuration files exist and contain function selector data'
          )
        );
      }

      // 2. Query on-chain selectors via Diamond Loupe
      this.log(context, 'info', '🌐 Querying on-chain selectors via Diamond Loupe...');
      let onChainSelectors: SelectorInfo[] = [];
      let onChainQueryFailed = false;

      try {
        onChainSelectors = await this.queryOnChainSelectors(context);
      } catch (error) {
        onChainQueryFailed = true;
        this.log(context, 'error', `❌ On-chain query failed: ${(error as Error).message}`);

        issues.push(
          this.createIssue(
            'onchain-query-failed',
            'On-Chain Query Failed',
            `Failed to query on-chain selectors: ${(error as Error).message}`,
            SeverityLevel.CRITICAL,
            'network-connectivity',
            'Check network connectivity, diamond address, and ensure DiamondLoupe facet is properly deployed',
            {
              error: (error as Error).message,
              diamondAddress: context.diamond.address,
              network: context.diamond.network.name,
            }
          )
        );
      }

      if (onChainSelectors.length === 0 && !onChainQueryFailed) {
        issues.push(
          this.createIssue(
            'empty-diamond',
            'Empty Diamond Contract',
            'No function selectors found on the diamond contract',
            SeverityLevel.CRITICAL,
            'structural',
            'Verify the diamond contract is properly deployed and initialized'
          )
        );
      }

      this.log(
        context,
        'info',
        `✅ Found ${expectedSelectors.length} expected and ${onChainSelectors.length} on-chain selectors`
      );

      // 3. Compare selectors and detect issues (only if we have on-chain data)
      if (!onChainQueryFailed && onChainSelectors.length > 0) {
        this.log(context, 'info', '⚖️  Comparing selectors and analyzing differences...');
        const comparisonIssues = await this.compareSelectors(
          expectedSelectors,
          onChainSelectors,
          moduleConfig
        );
        issues.push(...comparisonIssues);
      } else if (expectedSelectors.length > 0) {
        // If we have expected selectors but can't query on-chain, report this
        this.log(
          context,
          'info',
          '📋 Analyzing expected selectors (on-chain comparison unavailable)...'
        );
        issues.push(
          this.createIssue(
            'comparison-unavailable',
            'Selector Comparison Unavailable',
            `Found ${expectedSelectors.length} expected selectors but cannot compare with on-chain state due to query failure`,
            SeverityLevel.WARNING,
            'validation-incomplete',
            'Fix the on-chain query issue to enable full selector validation',
            {
              expectedSelectorsCount: expectedSelectors.length,
              expectedFacets: [...new Set(expectedSelectors.map(s => s.facetName).filter(Boolean))],
            }
          )
        );
      }

      // 4. Validate selector integrity (only if we have on-chain data)
      if (!onChainQueryFailed && !moduleConfig.skipValidation?.includes('integrity')) {
        this.log(context, 'info', '🔒 Validating selector integrity...');
        const integrityIssues = await this.validateSelectorIntegrity(context, onChainSelectors);
        issues.push(...integrityIssues);
      }

      // 5. Check for orphaned selectors (only if we have on-chain data)
      if (
        !onChainQueryFailed &&
        moduleConfig.enableOrphanCheck &&
        !moduleConfig.skipValidation?.includes('orphaned')
      ) {
        this.log(context, 'info', '🕵️ Checking for orphaned selectors...');
        const orphanIssues = await this.checkForOrphanedSelectors(context, onChainSelectors);
        issues.push(...orphanIssues);
      }

      // 6. Check for selector conflicts (only if we have on-chain data)
      if (
        !onChainQueryFailed &&
        moduleConfig.enableSelectorConflictCheck &&
        !moduleConfig.skipValidation?.includes('conflicts')
      ) {
        this.log(context, 'info', '⚠️  Checking for selector conflicts...');
        const conflictIssues = await this.checkSelectorConflicts(onChainSelectors);
        issues.push(...conflictIssues);
      }

      const criticalIssues = issues.filter(i => i.severity === SeverityLevel.CRITICAL).length;
      const status =
        criticalIssues > 0
          ? MonitoringStatus.FAIL
          : issues.length > 0
            ? MonitoringStatus.WARNING
            : MonitoringStatus.PASS;

      this.log(context, 'info', `✅ Function selector monitoring completed with status: ${status}`);

      return {
        status,
        executionTime: Date.now() - startTime,
        issues,
        metadata: {
          totalChecks: issues.length,
          onChainSelectors: onChainSelectors.length,
          expectedSelectors: expectedSelectors.length,
          criticalIssues,
          warningIssues: issues.filter(i => i.severity === SeverityLevel.WARNING).length,
          infoIssues: issues.filter(i => i.severity === SeverityLevel.INFO).length,
        },
      };
    } catch (error) {
      this.log(
        context,
        'error',
        `❌ Function selector monitoring failed: ${(error as Error).message}`
      );

      issues.push(
        this.createIssue(
          'monitoring-error',
          'Function Selector Monitoring Failed',
          `Monitoring failed with error: ${(error as Error).message}`,
          SeverityLevel.CRITICAL,
          'system',
          'Check network connectivity and diamond contract deployment'
        )
      );

      return {
        status: MonitoringStatus.FAIL,
        executionTime: Date.now() - startTime,
        issues,
        metadata: {
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Get module-specific configuration
   */
  private getModuleConfig<T>(context: MonitoringContext): T {
    return (context.moduleConfig[this.id] || {}) as T;
  }

  /**
   * Log messages with context awareness
   */
  private log(context: MonitoringContext, level: string, message: string): void {
    if (context.verbose) {
      console.log(`[${this.name}] ${message}`);
    }
  }

  /**
   * Create a monitoring issue with standardized format
   */
  private createIssue(
    id: string,
    title: string,
    description: string,
    severity: SeverityLevel,
    category: string,
    recommendation?: string,
    metadata?: any
  ): MonitoringIssue {
    return {
      id,
      title,
      description,
      severity,
      category,
      recommendation,
      metadata,
    };
  }

  /**
   * Load expected selectors from deployment configuration files
   */
  private async loadExpectedSelectors(context: MonitoringContext): Promise<SelectorInfo[]> {
    const { diamond } = context;
    const moduleConfig = this.getModuleConfig<FunctionSelectorModuleConfig>(context);
    const selectors: SelectorInfo[] = [];

    try {
      // Try multiple potential paths for deployment configuration
      // Include patterns with chain ID suffixes for Sepolia (11155111) and other networks
      const configPaths = [
        moduleConfig.customConfigPath,
        // Standard paths
        path.join(process.cwd(), 'diamonds', diamond.name, `deployed_${diamond.network.name}.json`),
        path.join(process.cwd(), 'deployments', diamond.network.name, `${diamond.name}.json`),
        path.join(process.cwd(), 'deployments', diamond.network.name, `GeniusDiamond.json`),
        path.join(
          process.cwd(),
          'diamonds',
          'GeniusDiamond',
          `deployed_${diamond.network.name}.json`
        ),
        // Chain ID suffix patterns (common deployment naming)
        path.join(
          process.cwd(),
          'diamonds',
          'GeniusDiamond',
          'deployments',
          `${diamond.name.toLowerCase()}-${diamond.network.name}-${diamond.network.chainId}.json`
        ),
        path.join(
          process.cwd(),
          'diamonds',
          'GeniusDiamond',
          'deployments',
          `geniusdiamond-${diamond.network.name}-${diamond.network.chainId}.json`
        ),
        // Try with real Sepolia chain ID if the network is sepolia
        ...(diamond.network.name === 'sepolia'
          ? [
              path.join(
                process.cwd(),
                'diamonds',
                'GeniusDiamond',
                'deployments',
                `geniusdiamond-sepolia-11155111.json`
              ),
              path.join(
                process.cwd(),
                'diamonds',
                'GeniusDiamond',
                'deployments',
                `GeniusDiamond-sepolia-11155111.json`
              ),
            ]
          : []),
        // Additional patterns based on file structure
        path.join(
          process.cwd(),
          'diamonds',
          'GeniusDiamond',
          'deployments',
          `${diamond.network.name}.json`
        ),
        path.join(process.cwd(), 'diamonds', 'GeniusDiamond', 'deployments', `sepolia.json`),
      ].filter(Boolean);

      this.log(
        context,
        'info',
        `🔍 Trying ${configPaths.length} potential deployment file paths...`
      );

      for (const configPath of configPaths) {
        try {
          this.log(context, 'info', `📁 Checking: ${configPath}`);
          const configContent = await fs.readFile(configPath!, 'utf-8');
          const config: DeployedDiamondData = JSON.parse(configContent);

          this.log(context, 'info', `✅ Found deployment file: ${configPath}`);

          // Extract selectors from DeployedFacets or FacetDeployedInfo
          const facetData = config.DeployedFacets || config.FacetDeployedInfo || {};

          if (Object.keys(facetData).length === 0) {
            this.log(context, 'info', `⚠️  No facet data found in ${configPath}`);
            continue;
          }

          this.log(
            context,
            'info',
            `📋 Processing ${Object.keys(facetData).length} facets from deployment config...`
          );

          for (const [facetName, facetInfo] of Object.entries(facetData)) {
            if (facetInfo.funcSelectors && Array.isArray(facetInfo.funcSelectors)) {
              this.log(
                context,
                'info',
                `   🔧 ${facetName}: ${facetInfo.funcSelectors.length} selectors`
              );
              for (const selector of facetInfo.funcSelectors) {
                selectors.push({
                  selector,
                  facetAddress: facetInfo.address || '',
                  facetName,
                  source: 'deployment',
                  verified: facetInfo.verified,
                });
              }
            }
          }

          if (selectors.length > 0) {
            this.log(
              context,
              'info',
              `✅ Loaded ${selectors.length} expected selectors from deployment config`
            );
            break;
          }
        } catch (error) {
          // Try next path
          continue;
        }
      }

      // Try to load from custom ABI if provided
      if (moduleConfig.customAbiPath && selectors.length === 0) {
        try {
          const abiContent = await fs.readFile(moduleConfig.customAbiPath, 'utf-8');
          const abi = JSON.parse(abiContent);

          this.log(
            context,
            'info',
            `📁 Loading selectors from custom ABI: ${moduleConfig.customAbiPath}`
          );

          for (const fragment of abi) {
            if (fragment.type === 'function') {
              const signature = `${fragment.name}(${fragment.inputs.map((i: any) => i.type).join(',')})`;
              const selector = ethers.id(signature).slice(0, 10);

              selectors.push({
                selector,
                functionSignature: signature,
                facetAddress: '',
                source: 'abi',
              });
            }
          }
        } catch (error) {
          this.log(context, 'info', `⚠️  Failed to load custom ABI: ${(error as Error).message}`);
        }
      }

      return selectors;
    } catch (error) {
      this.log(
        context,
        'error',
        `❌ Failed to load expected selectors: ${(error as Error).message}`
      );
      return [];
    }
  }

  /**
   * Query on-chain selectors via Diamond Loupe
   */
  private async queryOnChainSelectors(context: MonitoringContext): Promise<SelectorInfo[]> {
    const { diamond, provider } = context;

    if (!ethers.isAddress(diamond.address)) {
      throw new Error(`Invalid diamond address: ${diamond.address}`);
    }

    this.log(context, 'info', `🔗 Connecting to diamond at: ${diamond.address}`);
    this.log(
      context,
      'info',
      `🌐 Network: ${diamond.network.name} (Chain ID: ${diamond.network.chainId})`
    );

    // First check if the contract exists
    try {
      const code = await provider.getCode(diamond.address);
      if (code === '0x' || code === '0x0') {
        throw new Error(`No contract found at diamond address: ${diamond.address}`);
      }
      this.log(context, 'info', `✅ Contract exists at diamond address (${code.length} bytes)`);
    } catch (error) {
      throw new Error(`Failed to check contract existence: ${(error as Error).message}`);
    }

    const loupe = new ethers.Contract(
      ethers.getAddress(diamond.address),
      this.diamondLoupeABI,
      provider
    );

    try {
      this.log(context, 'info', `🔍 Calling facets() on diamond...`);
      const facets = await loupe.facets();
      this.log(context, 'info', `✅ Successfully queried facets, found ${facets.length} facets`);

      const selectors: SelectorInfo[] = [];

      for (const facet of facets as FacetStruct[]) {
        this.log(
          context,
          'info',
          `   📦 Facet ${facet.facetAddress}: ${facet.functionSelectors.length} selectors`
        );
        for (const selector of facet.functionSelectors) {
          selectors.push({
            selector,
            facetAddress: facet.facetAddress,
            source: 'onchain',
          });
        }
      }

      return selectors;
    } catch (error) {
      // Try to provide more detailed error information
      const errorMessage = (error as Error).message;

      if (errorMessage.includes('could not decode result data')) {
        throw new Error(
          `Diamond Loupe query failed - the diamond may not have DiamondLoupe facet properly implemented or the network may be incorrect. Error: ${errorMessage}`
        );
      } else if (errorMessage.includes('call revert exception')) {
        throw new Error(
          `Diamond Loupe call reverted - check if the diamond contract supports the facets() function. Error: ${errorMessage}`
        );
      } else {
        throw new Error(`Failed to query facets from diamond: ${errorMessage}`);
      }
    }
  }

  /**
   * Compare expected and on-chain selectors to detect discrepancies
   */
  private async compareSelectors(
    expected: SelectorInfo[],
    onChain: SelectorInfo[],
    config: FunctionSelectorModuleConfig
  ): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    const onChainMap = new Map<string, SelectorInfo>();
    for (const selector of onChain) {
      onChainMap.set(selector.selector, selector);
    }

    const expectedMap = new Map<string, SelectorInfo>();
    for (const selector of expected) {
      expectedMap.set(selector.selector, selector);
    }

    // Check for missing selectors (expected but not on-chain)
    for (const expectedSelector of expected) {
      if (config.ignoreSelectors?.includes(expectedSelector.selector)) {
        continue;
      }

      const onChainSelector = onChainMap.get(expectedSelector.selector);

      if (!onChainSelector) {
        issues.push(
          this.createIssue(
            `missing-selector-${expectedSelector.selector}`,
            'Missing Function Selector',
            `Expected selector ${expectedSelector.selector} (${expectedSelector.functionSignature || 'unknown function'}) from facet ${expectedSelector.facetName || expectedSelector.facetAddress} not found on-chain`,
            SeverityLevel.CRITICAL,
            'missing-functionality',
            'Verify the facet was properly deployed and cut into the diamond',
            {
              selector: expectedSelector.selector,
              expectedFacet: expectedSelector.facetName,
              expectedAddress: expectedSelector.facetAddress,
              functionSignature: expectedSelector.functionSignature,
            }
          )
        );
      } else {
        // Check for address mismatches
        if (
          expectedSelector.facetAddress &&
          onChainSelector.facetAddress &&
          expectedSelector.facetAddress.toLowerCase() !==
            onChainSelector.facetAddress.toLowerCase() &&
          !config.allowAddressChanges
        ) {
          issues.push(
            this.createIssue(
              `address-mismatch-${expectedSelector.selector}`,
              'Facet Address Mismatch',
              `Selector ${expectedSelector.selector} expected on facet ${expectedSelector.facetAddress} but found on ${onChainSelector.facetAddress}`,
              SeverityLevel.WARNING,
              'address-mismatch',
              'Verify the deployment configuration matches the actual diamond state',
              {
                selector: expectedSelector.selector,
                expectedAddress: expectedSelector.facetAddress,
                actualAddress: onChainSelector.facetAddress,
                functionSignature: expectedSelector.functionSignature,
              }
            )
          );
        }
      }
    }

    // Check for unexpected selectors (on-chain but not expected)
    for (const onChainSelector of onChain) {
      if (config.ignoreSelectors?.includes(onChainSelector.selector)) {
        continue;
      }

      const expectedSelector = expectedMap.get(onChainSelector.selector);

      if (!expectedSelector) {
        const severity = config.strictMode ? SeverityLevel.CRITICAL : SeverityLevel.WARNING;

        issues.push(
          this.createIssue(
            `unexpected-selector-${onChainSelector.selector}`,
            'Unexpected Function Selector',
            `Found unexpected selector ${onChainSelector.selector} on facet ${onChainSelector.facetAddress}`,
            severity,
            'unexpected-functionality',
            'Verify this selector should be present or update the deployment configuration',
            {
              selector: onChainSelector.selector,
              facetAddress: onChainSelector.facetAddress,
            }
          )
        );
      }
    }

    return issues;
  }

  /**
   * Validate the integrity of function selectors
   */
  private async validateSelectorIntegrity(
    context: MonitoringContext,
    selectors: SelectorInfo[]
  ): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];
    const { provider } = context;

    for (const selector of selectors) {
      try {
        // Check if the facet contract exists
        const code = await provider.getCode(selector.facetAddress);

        if (code === '0x' || code === '0x0') {
          issues.push(
            this.createIssue(
              `missing-facet-${selector.facetAddress}`,
              'Missing Facet Contract',
              `Facet contract at ${selector.facetAddress} for selector ${selector.selector} has no code`,
              SeverityLevel.CRITICAL,
              'missing-contract',
              'Verify the facet contract is properly deployed',
              {
                selector: selector.selector,
                facetAddress: selector.facetAddress,
              }
            )
          );
        }
      } catch (error) {
        issues.push(
          this.createIssue(
            `integrity-check-failed-${selector.selector}`,
            'Selector Integrity Check Failed',
            `Failed to verify integrity of selector ${selector.selector}: ${(error as Error).message}`,
            SeverityLevel.WARNING,
            'verification-error',
            'Check network connectivity and contract deployment',
            {
              selector: selector.selector,
              facetAddress: selector.facetAddress,
              error: (error as Error).message,
            }
          )
        );
      }
    }

    return issues;
  }

  /**
   * Check for orphaned selectors (selectors that exist but should not)
   */
  private async checkForOrphanedSelectors(
    context: MonitoringContext,
    selectors: SelectorInfo[]
  ): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    // Common system selectors that are expected to be present
    const systemSelectors = [
      '0x01ffc9a7', // supportsInterface(bytes4)
      '0x7a0ed627', // diamondCut(tuple[],address,bytes)
      '0x48e2b093', // facets()
      '0xcdffacc6', // facetFunctionSelectors(address)
      '0xadfca15e', // facetAddresses()
      '0x52ef6b2c', // facetAddress(bytes4)
      '0x8da5cb5b', // owner()
      '0xf2fde38b', // transferOwnership(address)
    ];

    for (const selector of selectors) {
      // Skip system selectors
      if (systemSelectors.includes(selector.selector)) {
        continue;
      }

      // For now, we'll just log unusual selectors
      // More sophisticated orphan detection would require
      // comparing against a comprehensive ABI database
      if (selector.source === 'onchain' && !selector.functionSignature) {
        issues.push(
          this.createIssue(
            `unknown-selector-${selector.selector}`,
            'Unknown Function Selector',
            `Found selector ${selector.selector} on facet ${selector.facetAddress} with unknown function signature`,
            SeverityLevel.INFO,
            'unknown-functionality',
            'Consider adding function signature mapping or verifying this selector is intentional',
            {
              selector: selector.selector,
              facetAddress: selector.facetAddress,
            }
          )
        );
      }
    }

    return issues;
  }

  /**
   * Check for function selector conflicts across facets
   */
  private async checkSelectorConflicts(selectors: SelectorInfo[]): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];
    const selectorMap = new Map<string, SelectorInfo[]>();

    // Group selectors by their signature
    for (const selector of selectors) {
      const existing = selectorMap.get(selector.selector) || [];
      existing.push(selector);
      selectorMap.set(selector.selector, existing);
    }

    // Check for conflicts (same selector on different facets)
    for (const [selectorValue, selectorInfos] of selectorMap.entries()) {
      if (selectorInfos.length > 1) {
        const facetAddresses = [...new Set(selectorInfos.map(s => s.facetAddress))];

        if (facetAddresses.length > 1) {
          issues.push(
            this.createIssue(
              `selector-conflict-${selectorValue}`,
              'Function Selector Conflict',
              `Selector ${selectorValue} is present on multiple facets: ${facetAddresses.join(', ')}`,
              SeverityLevel.CRITICAL,
              'selector-conflict',
              'Remove duplicate selector implementations from conflicting facets',
              {
                selector: selectorValue,
                conflictingFacets: facetAddresses,
                selectorInfos: selectorInfos,
              }
            )
          );
        }
      }
    }

    return issues;
  }
}
