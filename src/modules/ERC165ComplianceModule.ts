/**
 * ERC165 Compliance Monitoring Module for Hardhat Diamond Monitor Plugin
 * 
 * Monitors ERC165 interface support compliance, ensuring proper interface
 * declarations and standard compliance across the diamond contract.
 */

import { ethers } from 'ethers';
import {
  MonitoringModule,
  MonitoringContext,
  MonitoringResult,
  MonitoringIssue,
  SeverityLevel,
  DiamondInfo,
  NetworkInfo,
  ConfigRequirement,
  ValidationResult,
  MonitoringStatus
} from '../core/types';

/**
 * Interface support information
 */
interface InterfaceInfo {
  interfaceId: string;
  name: string;
  isSupported: boolean;
  isRequired: boolean;
  standard: string;
}

/**
 * ERC165 compliance analysis result
 */
interface ERC165ComplianceAnalysis {
  supportsERC165: boolean;
  supportedInterfaces: InterfaceInfo[];
  unsupportedRequiredInterfaces: InterfaceInfo[];
  totalInterfacesChecked: number;
  complianceScore: number; // 0-100
  complianceIssues: string[];
}

/**
 * Configuration for ERC165 compliance module
 */
interface ERC165ComplianceModuleConfig {
  enforceERC165Support?: boolean;
  requiredInterfaces?: string[];
  checkStandardCompliance?: boolean;
  checkDiamondStandards?: boolean;
  allowPartialCompliance?: boolean;
  minimumComplianceScore?: number;
  customInterfaces?: Array<{
    interfaceId: string;
    name: string;
    required: boolean;
  }>;
}

/**
 * ERC165 Compliance Monitoring Module
 * 
 * Monitors ERC165 interface support and standard compliance across
 * various Ethereum standards implemented in the diamond contract.
 */
export class ERC165ComplianceModule implements MonitoringModule {
  public readonly id = 'erc165-compliance';
  public readonly name = 'ERC165 Compliance Monitoring';
  public readonly description = 'Monitors ERC165 interface support and standard compliance across implemented interfaces';
  public readonly version = '1.0.0';
  public readonly category = 'compliance';

  // Standard interface IDs (ERC165)
  private readonly standardInterfaces = {
    // Core interfaces
    ERC165: '0x01ffc9a7',
    
    // Token standards
    ERC20: '0x36372b07',
    ERC721: '0x80ac58cd',
    ERC721_METADATA: '0x5b5e139f',
    ERC721_ENUMERABLE: '0x780e9d63',
    ERC1155: '0xd9b67a26',
    ERC1155_METADATA: '0x0e89341c',
    
    // Diamond standards
    DIAMOND_CUT: '0x1f931c1c',
    DIAMOND_LOUPE: '0x48e2b093',
    
    // Access control
    ACCESS_CONTROL: '0x7965db0b',
    ACCESS_CONTROL_ENUMERABLE: '0x5a05180f',
    
    // Extensions
    OWNABLE: '0x7f5828d0',
    PAUSABLE: '0x5c975abb',
    
    // Governance
    GOVERNANCE: '0x6ba42aaa',
    VOTES: '0xe90fb3f6',
    
    // Royalty
    ERC2981: '0x2a55205a' // NFT Royalty Standard
  };

  // Interface categories for better organization
  private readonly interfaceCategories = {
    core: ['ERC165'],
    tokens: ['ERC20', 'ERC721', 'ERC721_METADATA', 'ERC721_ENUMERABLE', 'ERC1155', 'ERC1155_METADATA'],
    diamond: ['DIAMOND_CUT', 'DIAMOND_LOUPE'],
    access: ['ACCESS_CONTROL', 'ACCESS_CONTROL_ENUMERABLE', 'OWNABLE'],
    extensions: ['PAUSABLE', 'ERC2981'],
    governance: ['GOVERNANCE', 'VOTES']
  };

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'enforceERC165Support',
        type: 'boolean',
        required: false,
        description: 'Whether ERC165 support is mandatory',
        defaultValue: true
      },
      {
        key: 'requiredInterfaces',
        type: 'array',
        required: false,
        description: 'List of interface IDs that must be supported'
      },
      {
        key: 'checkStandardCompliance',
        type: 'boolean',
        required: false,
        description: 'Whether to check compliance with standard interfaces',
        defaultValue: true
      },
      {
        key: 'checkDiamondStandards',
        type: 'boolean',
        required: false,
        description: 'Whether to check diamond standard compliance',
        defaultValue: true
      },
      {
        key: 'allowPartialCompliance',
        type: 'boolean',
        required: false,
        description: 'Whether partial compliance is acceptable',
        defaultValue: false
      },
      {
        key: 'minimumComplianceScore',
        type: 'number',
        required: false,
        description: 'Minimum compliance score (0-100) required',
        defaultValue: 80
      }
    ];
  }

  /**
   * Validate module configuration
   */
  public validateConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate boolean fields
    const booleanFields = ['enforceERC165Support', 'checkStandardCompliance', 'checkDiamondStandards', 'allowPartialCompliance'];
    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }

    // Validate compliance score
    if (config.minimumComplianceScore !== undefined) {
      if (typeof config.minimumComplianceScore !== 'number' || config.minimumComplianceScore < 0 || config.minimumComplianceScore > 100) {
        errors.push('minimumComplianceScore must be a number between 0 and 100');
      }
    }

    // Validate arrays
    if (config.requiredInterfaces !== undefined && !Array.isArray(config.requiredInterfaces)) {
      errors.push('requiredInterfaces must be an array');
    }

    if (config.customInterfaces !== undefined) {
      if (!Array.isArray(config.customInterfaces)) {
        errors.push('customInterfaces must be an array');
      } else {
        for (const iface of config.customInterfaces) {
          if (!iface.interfaceId || !iface.name || typeof iface.required !== 'boolean') {
            errors.push('customInterfaces items must have interfaceId, name, and required properties');
            break;
          }
        }
      }
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
   * Execute ERC165 compliance monitoring
   */
  public async monitor(context: MonitoringContext): Promise<MonitoringResult> {
    const startTime = Date.now();
    const issues: MonitoringIssue[] = [];
    const moduleConfig = this.getModuleConfig<ERC165ComplianceModuleConfig>(context);

    this.log(context, 'info', '🔍 Starting ERC165 compliance monitoring...');

    try {
      // Analyze ERC165 compliance
      const analysis = await this.analyzeERC165Compliance(context);

      // Check ERC165 support requirement
      if (moduleConfig.enforceERC165Support && !analysis.supportsERC165) {
        issues.push(this.createIssue(
          'missing-erc165',
          'Missing ERC165 Support',
          'Contract does not support ERC165 interface detection',
          SeverityLevel.ERROR,
          'erc165-support',
          'Implement ERC165 interface support for better interoperability'
        ));
      }

      // Check standard compliance
      if (moduleConfig.checkStandardCompliance) {
        issues.push(...this.checkStandardCompliance(analysis, moduleConfig));
      }

      // Check diamond standards
      if (moduleConfig.checkDiamondStandards) {
        issues.push(...this.checkDiamondStandards(analysis, moduleConfig));
      }

      // Check required interfaces
      if (moduleConfig.requiredInterfaces) {
        issues.push(...this.checkRequiredInterfaces(analysis, moduleConfig.requiredInterfaces));
      }

      // Check custom interfaces
      if (moduleConfig.customInterfaces) {
        const customIssues = await this.checkCustomInterfaces(analysis, moduleConfig.customInterfaces, context);
        issues.push(...customIssues);
      }

      // Check compliance score
      if (moduleConfig.minimumComplianceScore && analysis.complianceScore < moduleConfig.minimumComplianceScore) {
        if (!moduleConfig.allowPartialCompliance) {
          issues.push(this.createIssue(
            'low-compliance-score',
            'Low Compliance Score',
            `Compliance score ${analysis.complianceScore}% is below minimum ${moduleConfig.minimumComplianceScore}%`,
            SeverityLevel.ERROR,
            'compliance-score',
            'Implement missing interfaces to improve compliance'
          ));
        } else {
          issues.push(this.createIssue(
            'partial-compliance',
            'Partial Compliance',
            `Compliance score ${analysis.complianceScore}% is below target ${moduleConfig.minimumComplianceScore}%`,
            SeverityLevel.WARNING,
            'compliance-score',
            'Consider implementing additional interfaces for better compliance'
          ));
        }
      }

      const executionTime = Date.now() - startTime;
      this.log(context, 'info', `✅ ERC165 compliance monitoring completed in ${executionTime}ms`);

      return {
        status: issues.some(i => i.severity === SeverityLevel.ERROR || i.severity === SeverityLevel.CRITICAL) 
          ? MonitoringStatus.FAIL : MonitoringStatus.PASS,
        issues,
        executionTime,
        metadata: {
          analysis,
          moduleConfig
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(context, 'error', `❌ ERC165 compliance monitoring failed: ${(error as Error).message}`);

      issues.push(this.createIssue(
        'erc165-compliance-error',
        'ERC165 Compliance Monitoring Failed',
        `Failed to analyze ERC165 compliance: ${(error as Error).message}`,
        SeverityLevel.ERROR,
        'execution'
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
   * Analyze ERC165 compliance for the diamond
   */
  private async analyzeERC165Compliance(context: MonitoringContext): Promise<ERC165ComplianceAnalysis> {
    const { diamond, provider } = context;
    
    const analysis: ERC165ComplianceAnalysis = {
      supportsERC165: false,
      supportedInterfaces: [],
      unsupportedRequiredInterfaces: [],
      totalInterfacesChecked: 0,
      complianceScore: 0,
      complianceIssues: []
    };

    // First check if ERC165 is supported
    analysis.supportsERC165 = await this.checkInterfaceSupport(diamond.address, this.standardInterfaces.ERC165, provider);

    // Check all standard interfaces
    const interfacesToCheck: InterfaceInfo[] = [];
    
    for (const [name, interfaceId] of Object.entries(this.standardInterfaces)) {
      interfacesToCheck.push({
        interfaceId,
        name,
        isSupported: false,
        isRequired: false, // Will be set based on configuration
        standard: this.getInterfaceStandard(name)
      });
    }

    // Check interface support
    for (const iface of interfacesToCheck) {
      iface.isSupported = await this.checkInterfaceSupport(diamond.address, iface.interfaceId, provider);
      analysis.totalInterfacesChecked++;
      
      if (iface.isSupported) {
        analysis.supportedInterfaces.push(iface);
      }
    }

    // Calculate compliance score
    const supportedCount = analysis.supportedInterfaces.length;
    analysis.complianceScore = analysis.totalInterfacesChecked > 0 
      ? Math.round((supportedCount / analysis.totalInterfacesChecked) * 100) 
      : 0;

    return analysis;
  }

  /**
   * Check if a specific interface is supported
   */
  private async checkInterfaceSupport(address: string, interfaceId: string, provider: any): Promise<boolean> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return false;
      }
      
      const contract = new ethers.Contract(ethers.getAddress(address), [
        'function supportsInterface(bytes4 interfaceId) view returns (bool)'
      ], provider);
      
      return await contract.supportsInterface(interfaceId);
    } catch {
      return false;
    }
  }

  /**
   * Get the standard category for an interface
   */
  private getInterfaceStandard(interfaceName: string): string {
    for (const [category, interfaces] of Object.entries(this.interfaceCategories)) {
      if (interfaces.includes(interfaceName)) {
        return category;
      }
    }
    return 'unknown';
  }

  /**
   * Check standard compliance
   */
  private checkStandardCompliance(analysis: ERC165ComplianceAnalysis, config: ERC165ComplianceModuleConfig): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check for consistent token standard implementation
    const tokenStandards = ['ERC20', 'ERC721', 'ERC1155'];
    const implementedTokenStandards = analysis.supportedInterfaces
      .filter(iface => tokenStandards.includes(iface.name))
      .map(iface => iface.name);

    if (implementedTokenStandards.length > 1) {
      issues.push(this.createIssue(
        'multiple-token-standards',
        'Multiple Token Standards',
        `Contract implements multiple token standards: ${implementedTokenStandards.join(', ')}`,
        SeverityLevel.WARNING,
        'standard-compliance',
        'Ensure proper separation and avoid conflicts between different token standards'
      ));
    }

    // Check for incomplete standard implementations
    const erc721Supported = analysis.supportedInterfaces.some(iface => iface.name === 'ERC721');
    const erc721MetadataSupported = analysis.supportedInterfaces.some(iface => iface.name === 'ERC721_METADATA');
    
    if (erc721Supported && !erc721MetadataSupported) {
      issues.push(this.createIssue(
        'incomplete-erc721',
        'Incomplete ERC721 Implementation',
        'ERC721 is supported but ERC721Metadata is not',
        SeverityLevel.WARNING,
        'standard-compliance',
        'Implement ERC721Metadata for complete NFT standard compliance'
      ));
    }

    const erc1155Supported = analysis.supportedInterfaces.some(iface => iface.name === 'ERC1155');
    const erc1155MetadataSupported = analysis.supportedInterfaces.some(iface => iface.name === 'ERC1155_METADATA');
    
    if (erc1155Supported && !erc1155MetadataSupported) {
      issues.push(this.createIssue(
        'incomplete-erc1155',
        'Incomplete ERC1155 Implementation',
        'ERC1155 is supported but ERC1155MetadataURI is not',
        SeverityLevel.WARNING,
        'standard-compliance',
        'Implement ERC1155MetadataURI for complete multi-token standard compliance'
      ));
    }

    return issues;
  }

  /**
   * Check diamond standard compliance
   */
  private checkDiamondStandards(analysis: ERC165ComplianceAnalysis, config: ERC165ComplianceModuleConfig): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    const diamondCutSupported = analysis.supportedInterfaces.some(iface => iface.name === 'DIAMOND_CUT');
    const diamondLoupeSupported = analysis.supportedInterfaces.some(iface => iface.name === 'DIAMOND_LOUPE');

    if (!diamondCutSupported) {
      issues.push(this.createIssue(
        'missing-diamond-cut',
        'Missing Diamond Cut Interface',
        'Diamond does not declare support for DiamondCut interface',
        SeverityLevel.WARNING,
        'diamond-compliance',
        'Implement ERC165 support for DiamondCut interface'
      ));
    }

    if (!diamondLoupeSupported) {
      issues.push(this.createIssue(
        'missing-diamond-loupe',
        'Missing Diamond Loupe Interface',
        'Diamond does not declare support for DiamondLoupe interface',
        SeverityLevel.WARNING,
        'diamond-compliance',
        'Implement ERC165 support for DiamondLoupe interface'
      ));
    }

    return issues;
  }

  /**
   * Check required interfaces
   */
  private checkRequiredInterfaces(analysis: ERC165ComplianceAnalysis, requiredInterfaces: string[]): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    for (const requiredInterfaceId of requiredInterfaces) {
      const isSupported = analysis.supportedInterfaces.some(iface => iface.interfaceId === requiredInterfaceId);
      
      if (!isSupported) {
        issues.push(this.createIssue(
          'missing-required-interface',
          'Missing Required Interface',
          `Required interface ${requiredInterfaceId} is not supported`,
          SeverityLevel.ERROR,
          'required-interfaces',
          'Implement the required interface and declare it in supportsInterface'
        ));
      }
    }

    return issues;
  }

  /**
   * Check custom interfaces
   */
  private async checkCustomInterfaces(
    analysis: ERC165ComplianceAnalysis, 
    customInterfaces: Array<{ interfaceId: string; name: string; required: boolean }>,
    context: MonitoringContext
  ): Promise<MonitoringIssue[]> {
    const issues: MonitoringIssue[] = [];

    for (const customInterface of customInterfaces) {
      const isSupported = await this.checkInterfaceSupport(
        context.diamond.address, 
        customInterface.interfaceId, 
        context.provider
      );

      if (customInterface.required && !isSupported) {
        issues.push(this.createIssue(
          'missing-custom-interface',
          'Missing Custom Interface',
          `Required custom interface ${customInterface.name} (${customInterface.interfaceId}) is not supported`,
          SeverityLevel.ERROR,
          'custom-interfaces',
          'Implement the custom interface and declare it in supportsInterface'
        ));
      }

      if (isSupported) {
        // Add to supported interfaces for tracking
        analysis.supportedInterfaces.push({
          interfaceId: customInterface.interfaceId,
          name: customInterface.name,
          isSupported: true,
          isRequired: customInterface.required,
          standard: 'custom'
        });
      }
    }

    return issues;
  }

  // Helper methods

  private getModuleConfig<T>(context: MonitoringContext): T {
    return (context.config.modules?.[this.id] || {}) as T;
  }

  private log(context: MonitoringContext, level: string, message: string): void {
    if (context.config.reporting?.verbose) {
      console.log(`[${this.id}] ${message}`);
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
}
