/**
 * Diamond Structure Monitoring Module for Hardhat Diamond Monitor Plugin
 * 
 * Monitors the overall structure and integrity of the diamond proxy.
 * This module checks fundamental diamond properties, facet relationships,
 * and structural consistency.
 */

import { ethers } from 'ethers';
import chalk from 'chalk';

import {
  MonitoringModule,
  MonitoringContext,
  MonitoringResult,
  MonitoringStatus,
  SeverityLevel,
  ConfigRequirement,
  MonitoringIssue,
  DiamondInfo,
  NetworkInfo,
  ValidationResult
} from '../core/types';

/**
 * Facet information from on-chain query
 */
interface FacetInfo {
  address: string;
  selectors: string[];
  name?: string;
  version?: string;
}

/**
 * Diamond structure analysis result
 */
interface DiamondStructureAnalysis {
  totalFacets: number;
  totalSelectors: number;
  diamondLoupePresent: boolean;
  diamondCutPresent: boolean;
  ownershipFacetPresent: boolean;
  duplicateSelectors: string[];
  orphanedSelectors: string[];
  zeroAddressFacets: string[];
  protocolVersion?: string;
}

/**
 * Configuration for diamond structure module
 */
interface DiamondStructureModuleConfig {
  requireDiamondLoupe?: boolean;
  requireDiamondCut?: boolean;
  requireOwnership?: boolean;
  allowZeroAddressFacets?: boolean;
  minFacetCount?: number;
  maxFacetCount?: number;
  protocolVersionCheck?: boolean;
  customChecks?: string[];
}

/**
 * Diamond Structure Monitoring Module for Hardhat Plugin
 * 
 * Performs comprehensive structural monitoring of diamond proxy contracts.
 */
export class DiamondStructureModule implements MonitoringModule {
  public readonly id = 'diamond-structure';
  public readonly name = 'Diamond Structure Monitoring';
  public readonly description = 'Monitors diamond proxy structure, facet relationships, and core functionality';
  public readonly version = '1.0.0';
  public readonly category = 'structural';

  // Standard diamond interface selectors
  private readonly standardSelectors = {
    // DiamondLoupe
    diamondLoupe: {
      facets: '0x7a0ed627',
      facetFunctionSelectors: '0xadfca15e',
      facetAddresses: '0x52ef6b2c',
      facetAddress: '0xcdffacc6'
    },
    // DiamondCut
    diamondCut: {
      diamondCut: '0x1f931c1c'
    },
    // Ownership
    ownership: {
      owner: '0x8da5cb5b',
      transferOwnership: '0xf2fde38b'
    },
    // ERC165
    erc165: {
      supportsInterface: '0x01ffc9a7'
    }
  };

  // Standard diamond ABIs
  private readonly diamondABIs = {
    loupe: [
      'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
      'function facetFunctionSelectors(address facet) external view returns (bytes4[])',
      'function facetAddresses() external view returns (address[])',
      'function facetAddress(bytes4 selector) external view returns (address)'
    ],
    cut: [
      'function diamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata) external'
    ],
    ownership: [
      'function owner() external view returns (address)',
      'function transferOwnership(address newOwner) external'
    ],
    erc165: [
      'function supportsInterface(bytes4 interfaceId) external view returns (bool)'
    ]
  };

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'requireDiamondLoupe',
        type: 'boolean',
        required: false,
        description: 'Whether DiamondLoupe facet is required',
        defaultValue: true
      },
      {
        key: 'requireDiamondCut',
        type: 'boolean',
        required: false,
        description: 'Whether DiamondCut facet is required',
        defaultValue: true
      },
      {
        key: 'requireOwnership',
        type: 'boolean',
        required: false,
        description: 'Whether ownership facet is required',
        defaultValue: true
      },
      {
        key: 'allowZeroAddressFacets',
        type: 'boolean',
        required: false,
        description: 'Whether to allow facets with zero address',
        defaultValue: false
      },
      {
        key: 'minFacetCount',
        type: 'number',
        required: false,
        description: 'Minimum number of facets required',
        defaultValue: 1
      },
      {
        key: 'maxFacetCount',
        type: 'number',
        required: false,
        description: 'Maximum number of facets allowed',
        defaultValue: 50
      },
      {
        key: 'protocolVersionCheck',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor protocol version',
        defaultValue: true
      }
    ];
  }

  /**
   * Validate module configuration
   */
  public validateConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate config types
    if (config.requireDiamondLoupe !== undefined && typeof config.requireDiamondLoupe !== 'boolean') {
      errors.push('requireDiamondLoupe must be a boolean');
    }

    if (config.requireDiamondCut !== undefined && typeof config.requireDiamondCut !== 'boolean') {
      errors.push('requireDiamondCut must be a boolean');
    }

    if (config.requireOwnership !== undefined && typeof config.requireOwnership !== 'boolean') {
      errors.push('requireOwnership must be a boolean');
    }

    if (config.allowZeroAddressFacets !== undefined && typeof config.allowZeroAddressFacets !== 'boolean') {
      errors.push('allowZeroAddressFacets must be a boolean');
    }

    if (config.minFacetCount !== undefined && (typeof config.minFacetCount !== 'number' || config.minFacetCount < 0)) {
      errors.push('minFacetCount must be a non-negative number');
    }

    if (config.maxFacetCount !== undefined && (typeof config.maxFacetCount !== 'number' || config.maxFacetCount < 1)) {
      errors.push('maxFacetCount must be a positive number');
    }

    if (config.minFacetCount !== undefined && config.maxFacetCount !== undefined && config.minFacetCount > config.maxFacetCount) {
      errors.push('minFacetCount cannot be greater than maxFacetCount');
    }

    if (config.protocolVersionCheck !== undefined && typeof config.protocolVersionCheck !== 'boolean') {
      errors.push('protocolVersionCheck must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if this module can monitor the given diamond
   */
  public async canMonitor(diamond: DiamondInfo, network: NetworkInfo): Promise<boolean> {
    return true; // This module can monitor any diamond
  }

  /**
   * Execute diamond structure monitoring
   */
  public async monitor(context: MonitoringContext): Promise<MonitoringResult> {
    const startTime = Date.now();
    const issues: MonitoringIssue[] = [];
    const moduleConfig = this.getModuleConfig<DiamondStructureModuleConfig>(context);

    this.log(context, 'info', '🏗️  Starting diamond structure monitoring...');

    try {
      // 1. Analyze diamond structure
      this.log(context, 'info', '🔍 Analyzing diamond structure...');
      const analysis = await this.analyzeDiamondStructure(context);

      // 2. Monitor basic diamond requirements
      this.log(context, 'info', '✅ Monitoring basic diamond requirements...');
      const basicIssues = this.monitorBasicRequirements(analysis, moduleConfig);
      issues.push(...basicIssues);

      // 3. Monitor standard facets
      this.log(context, 'info', '🧩 Monitoring standard facets...');
      const facetIssues = this.monitorStandardFacets(analysis, moduleConfig);
      issues.push(...facetIssues);

      // 4. Check for structural issues
      this.log(context, 'info', '🔧 Checking for structural issues...');
      const structuralIssues = this.checkStructuralIntegrity(analysis, moduleConfig);
      issues.push(...structuralIssues);

      // 5. Monitor protocol version if enabled
      if (moduleConfig.protocolVersionCheck && analysis.protocolVersion) {
        this.log(context, 'info', '📋 Monitoring protocol version...');
        const versionIssues = await this.monitorProtocolVersion(context, analysis.protocolVersion);
        issues.push(...versionIssues);
      }

      // 6. Test core functionality
      this.log(context, 'info', '⚙️  Testing core functionality...');
      const functionalityIssues = await this.testCoreFunctionality(context, analysis);
      issues.push(...functionalityIssues);

      const executionTime = Date.now() - startTime;
      this.log(context, 'info', `✅ Diamond structure monitoring completed in ${executionTime}ms`);

      // Determine overall status
      const criticalIssues = issues.filter(i => i.severity === SeverityLevel.CRITICAL);
      const errorIssues = issues.filter(i => i.severity === SeverityLevel.ERROR);
      const warningIssues = issues.filter(i => i.severity === SeverityLevel.WARNING);

      let status = MonitoringStatus.PASS;
      if (criticalIssues.length > 0) {
        status = MonitoringStatus.FAIL;
      } else if (errorIssues.length > 0) {
        status = MonitoringStatus.FAIL;
      } else if (warningIssues.length > 0) {
        status = MonitoringStatus.WARNING;
      }

      // Create detailed metadata
      const metadata = {
        analysis,
        moduleConfig
      };

      return {
        status,
        issues,
        executionTime,
        metadata
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(context, 'error', `❌ Diamond structure monitoring failed: ${(error as Error).message}`);

      issues.push(this.createIssue(
        'monitoring-error',
        'Diamond Structure Monitoring Failed',
        `Diamond structure monitoring failed: ${(error as Error).message}`,
        SeverityLevel.CRITICAL,
        'system'
      ));

      return {
        status: MonitoringStatus.FAIL,
        issues,
        executionTime,
        metadata: { error: (error as Error).message }
      };
    }
  }

  /**
   * Analyze the diamond structure
   */
  private async analyzeDiamondStructure(context: MonitoringContext): Promise<DiamondStructureAnalysis> {
    const { diamond, provider } = context;
    
    // Query facets using DiamondLoupe
    let facets: FacetInfo[] = [];
    let diamondLoupePresent = false;
    
    try {
      const diamondContract = new ethers.Contract(diamond.address, this.diamondABIs.loupe, provider);
      const facetData = await diamondContract.facets();
      
      facets = facetData.map((f: any) => ({
        address: f.facetAddress.toLowerCase(),
        selectors: f.functionSelectors.map((s: string) => s.toLowerCase()),
        name: this.identifyFacetName(f.facetAddress, f.functionSelectors)
      }));
      
      diamondLoupePresent = true;
    } catch (error) {
      this.log(context, 'warn', `Could not query facets via DiamondLoupe: ${(error as Error).message}`);
    }

    // Calculate totals and analyze structure
    const totalFacets = facets.length;
    const totalSelectors = facets.reduce((sum, facet) => sum + facet.selectors.length, 0);

    // Check for duplicate selectors
    const allSelectors = facets.flatMap(f => f.selectors);
    const selectorCounts = new Map<string, number>();
    for (const selector of allSelectors) {
      selectorCounts.set(selector, (selectorCounts.get(selector) || 0) + 1);
    }
    const duplicateSelectors = Array.from(selectorCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([selector, _]) => selector);

    // Find zero address facets
    const zeroAddressFacets = facets
      .filter(f => f.address === '0x0000000000000000000000000000000000000000')
      .flatMap(f => f.selectors);

    // Check for standard facets
    const diamondCutPresent = this.hasFunctionSelector(facets, this.standardSelectors.diamondCut.diamondCut);
    const ownershipFacetPresent = this.hasFunctionSelector(facets, this.standardSelectors.ownership.owner);

    // Try to get protocol version
    const protocolVersion = await this.getProtocolVersion(context);

    return {
      totalFacets,
      totalSelectors,
      diamondLoupePresent,
      diamondCutPresent,
      ownershipFacetPresent,
      duplicateSelectors,
      orphanedSelectors: [], // Will be populated if needed
      zeroAddressFacets,
      protocolVersion
    };
  }

  /**
   * Monitor basic diamond requirements
   */
  private monitorBasicRequirements(
    analysis: DiamondStructureAnalysis,
    config: DiamondStructureModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check minimum facet count
    if (config.minFacetCount && analysis.totalFacets < config.minFacetCount) {
      issues.push(this.createIssue(
        'min-facet-count',
        'Insufficient Facet Count',
        `Diamond has ${analysis.totalFacets} facets, but minimum required is ${config.minFacetCount}`,
        SeverityLevel.ERROR,
        'structure',
        'Add more facets to meet minimum requirements'
      ));
    }

    // Check maximum facet count
    if (config.maxFacetCount && analysis.totalFacets > config.maxFacetCount) {
      issues.push(this.createIssue(
        'max-facet-count',
        'Excessive Facet Count',
        `Diamond has ${analysis.totalFacets} facets, but maximum allowed is ${config.maxFacetCount}`,
        SeverityLevel.WARNING,
        'structure',
        'Consider reducing the number of facets for better gas efficiency'
      ));
    }

    // Check for empty diamond
    if (analysis.totalFacets === 0) {
      issues.push(this.createIssue(
        'empty-diamond',
        'Empty Diamond',
        'Diamond has no facets - this indicates a serious deployment issue',
        SeverityLevel.CRITICAL,
        'structure',
        'Monitor diamond deployment and ensure facets are properly added'
      ));
    }

    return issues;
  }

  /**
   * Monitor standard facets
   */
  private monitorStandardFacets(
    analysis: DiamondStructureAnalysis,
    config: DiamondStructureModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check DiamondLoupe requirement
    if (config.requireDiamondLoupe !== false && !analysis.diamondLoupePresent) {
      issues.push(this.createIssue(
        'missing-diamond-loupe',
        'Missing DiamondLoupe Facet',
        'DiamondLoupe facet is required for diamond introspection but not found',
        SeverityLevel.ERROR,
        'standard-facets',
        'Add DiamondLoupe facet to enable diamond introspection capabilities'
      ));
    }

    // Check DiamondCut requirement
    if (config.requireDiamondCut !== false && !analysis.diamondCutPresent) {
      issues.push(this.createIssue(
        'missing-diamond-cut',
        'Missing DiamondCut Facet',
        'DiamondCut facet is required for diamond upgrades but not found',
        SeverityLevel.ERROR,
        'standard-facets',
        'Add DiamondCut facet to enable diamond upgrade capabilities'
      ));
    }

    // Check Ownership requirement
    if (config.requireOwnership !== false && !analysis.ownershipFacetPresent) {
      issues.push(this.createIssue(
        'missing-ownership',
        'Missing Ownership Facet',
        'Ownership facet is required for access control but not found',
        SeverityLevel.WARNING,
        'standard-facets',
        'Add ownership facet to enable proper access control'
      ));
    }

    return issues;
  }

  /**
   * Check structural integrity
   */
  private checkStructuralIntegrity(
    analysis: DiamondStructureAnalysis,
    config: DiamondStructureModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check for duplicate selectors
    if (analysis.duplicateSelectors.length > 0) {
      issues.push(this.createIssue(
        'duplicate-selectors',
        'Duplicate Function Selectors',
        `Found ${analysis.duplicateSelectors.length} duplicate selectors: ${analysis.duplicateSelectors.join(', ')}`,
        SeverityLevel.CRITICAL,
        'integrity',
        'This indicates a critical diamond implementation error - remove duplicate selectors immediately'
      ));
    }

    // Check for zero address facets
    if (analysis.zeroAddressFacets.length > 0 && !config.allowZeroAddressFacets) {
      issues.push(this.createIssue(
        'zero-address-facets',
        'Zero Address Facets Detected',
        `Found ${analysis.zeroAddressFacets.length} selectors pointing to zero address`,
        SeverityLevel.ERROR,
        'integrity',
        'Remove or replace selectors pointing to zero address',
        { selectors: analysis.zeroAddressFacets }
      ));
    }

    return issues;
  }

  /**
   * Monitor protocol version
   */
  private async monitorProtocolVersion(context: MonitoringContext, version: string): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    // Basic version format check
    const versionPattern = /^\d+\.\d+\.\d+/;
    if (!versionPattern.test(version)) {
      issues.push(this.createIssue(
        'invalid-version-format',
        'Invalid Protocol Version Format',
        `Protocol version '${version}' does not follow semantic versioning`,
        SeverityLevel.WARNING,
        'version',
        'Use semantic versioning format (e.g., 1.0.0)'
      ));
    }

    return issues;
  }

  /**
   * Test core functionality
   */
  private async testCoreFunctionality(context: MonitoringContext, analysis: DiamondStructureAnalysis): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];
    const { diamond, provider } = context;

    // Test DiamondLoupe functions if present
    if (analysis.diamondLoupePresent) {
      try {
        const diamondContract = new ethers.Contract(diamond.address, this.diamondABIs.loupe, provider);
        
        // Test facets() function
        await diamondContract.facets();
        
        // Test facetAddresses() function
        await diamondContract.facetAddresses();
        
        this.log(context, 'info', '✅ DiamondLoupe functionality verified');
      } catch (error) {
        issues.push(this.createIssue(
          'loupe-functionality-error',
          'DiamondLoupe Functionality Error',
          `DiamondLoupe functions are not working properly: ${(error as Error).message}`,
          SeverityLevel.ERROR,
          'functionality'
        ));
      }
    }

    // Test ERC165 if present
    const erc165Present = this.hasFunctionSelector([...analysis.duplicateSelectors], this.standardSelectors.erc165.supportsInterface);
    if (erc165Present) {
      try {
        const diamondContract = new ethers.Contract(diamond.address, this.diamondABIs.erc165, provider);
        
        // Test supportsInterface for ERC165 itself
        const supportsERC165 = await diamondContract.supportsInterface('0x01ffc9a7');
        if (!supportsERC165) {
          issues.push(this.createIssue(
            'erc165-self-check-fail',
            'ERC165 Self-Check Failed',
            'Diamond does not report supporting ERC165 interface',
            SeverityLevel.WARNING,
            'functionality'
          ));
        }
      } catch (error) {
        issues.push(this.createIssue(
          'erc165-functionality-error',
          'ERC165 Functionality Error',
          `ERC165 interface is not working properly: ${(error as Error).message}`,
          SeverityLevel.WARNING,
          'functionality'
        ));
      }
    }

    return issues;
  }

  // Helper methods

  private getModuleConfig<T>(context: MonitoringContext): T {
    return (context.moduleConfig[this.id] || {}) as T;
  }

  private log(context: MonitoringContext, level: string, message: string): void {
    if (context.verbose) {
      console.log(message);
    }
  }

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
      metadata
    };
  }

  private hasFunctionSelector(facets: FacetInfo[] | string[], selector: string): boolean {
    if (Array.isArray(facets) && typeof facets[0] === 'string') {
      // Array of selectors
      return (facets as string[]).includes(selector.toLowerCase());
    } else {
      // Array of FacetInfo
      return (facets as FacetInfo[]).some(f => 
        f.selectors.includes(selector.toLowerCase())
      );
    }
  }

  private identifyFacetName(address: string, selectors: string[]): string | undefined {
    // Simple heuristic to identify common facets by their selectors
    const selectorSet = new Set(selectors.map(s => s.toLowerCase()));
    
    if (selectorSet.has(this.standardSelectors.diamondLoupe.facets)) {
      return 'DiamondLoupeFacet';
    }
    
    if (selectorSet.has(this.standardSelectors.diamondCut.diamondCut)) {
      return 'DiamondCutFacet';
    }
    
    if (selectorSet.has(this.standardSelectors.ownership.owner)) {
      return 'OwnershipFacet';
    }
    
    return undefined;
  }

  private async getProtocolVersion(context: MonitoringContext): Promise<string | undefined> {
    // This would try to get protocol version from various sources
    // For now, return undefined
    return undefined;
  }
}
