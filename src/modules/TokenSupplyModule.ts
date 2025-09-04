/**
 * Token Supply Monitoring Module for Hardhat Diamond Monitor Plugin
 *
 * Monitors token supply mechanics including total supply, minting/burning,
 * supply caps, and token distribution patterns.
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
  MonitoringStatus,
} from '../core/types';

/**
 * Token supply information for ERC20-like tokens
 */
interface ERC20SupplyInfo {
  totalSupply: bigint;
  decimals: number;
  symbol: string;
  name: string;
  hasCap: boolean;
  cap?: bigint;
  remainingSupply?: bigint;
  isMintable: boolean;
  isBurnable: boolean;
  isPaused: boolean;
}

/**
 * Token supply information for ERC721-like tokens
 */
interface ERC721SupplyInfo {
  totalSupply: bigint;
  maxSupply?: bigint;
  remainingSupply?: bigint;
  isMintable: boolean;
  isBurnable: boolean;
  isPaused: boolean;
  baseURI?: string;
}

/**
 * Token supply information for ERC1155-like tokens
 */
interface ERC1155SupplyInfo {
  tokenIds: string[];
  totalSupplies: Record<string, bigint>;
  maxSupplies: Record<string, bigint>;
  isMintable: boolean;
  isBurnable: boolean;
  isPaused: boolean;
  uri?: string;
}

/**
 * Combined token analysis result
 */
interface TokenSupplyAnalysis {
  hasERC20: boolean;
  hasERC721: boolean;
  hasERC1155: boolean;
  erc20Info?: ERC20SupplyInfo;
  erc721Info?: ERC721SupplyInfo;
  erc1155Info?: ERC1155SupplyInfo;
  supplyIssues: string[];
  totalTokenContracts: number;
}

/**
 * Configuration for token supply module
 */
interface TokenSupplyModuleConfig {
  checkERC20?: boolean;
  checkERC721?: boolean;
  checkERC1155?: boolean;
  enforceSupplyCaps?: boolean;
  maxTotalSupply?: string; // String to handle BigInt
  minTotalSupply?: string;
  requireMintCap?: boolean;
  allowInfiniteSupply?: boolean;
  checkPauseState?: boolean;
  monitorSupplyChanges?: boolean;
  expectedTokenStandards?: string[];
}

/**
 * Token Supply Monitoring Module
 *
 * Monitors token supply mechanisms across different token standards (ERC20, ERC721, ERC1155)
 * implemented within the diamond contract.
 */
export class TokenSupplyModule implements MonitoringModule {
  public readonly id = 'token-supply';
  public readonly name = 'Token Supply Monitoring';
  public readonly description =
    'Monitors token supply mechanisms, caps, and distribution patterns across ERC20/721/1155 standards';
  public readonly version = '1.0.0';
  public readonly category = 'tokenomics';

  // Standard token interface selectors
  private readonly tokenSelectors = {
    // ERC20
    erc20: {
      totalSupply: '0x18160ddd',
      decimals: '0x313ce567',
      symbol: '0x95d89b41',
      name: '0x06fdde03',
      balanceOf: '0x70a08231',
    },
    // ERC721
    erc721: {
      totalSupply: '0x18160ddd',
      tokenByIndex: '0x4f6ccce7',
      tokenOfOwnerByIndex: '0x2f745c59',
      tokenURI: '0xc87b56dd',
    },
    // ERC1155
    erc1155: {
      balanceOf: '0x00fdd58e',
      balanceOfBatch: '0x4e1273f4',
      uri: '0x0e89341c',
    },
    // Common extensions
    capped: {
      cap: '0x355274ea',
    },
    mintable: {
      mint: '0x40c10f19',
      mintTo: '0x449a52f8',
    },
    burnable: {
      burn: '0x42966c68',
      burnFrom: '0x79cc6790',
    },
    pausable: {
      paused: '0x5c975abb',
      pause: '0x8456cb59',
      unpause: '0x3f4ba83a',
    },
  };

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'checkERC20',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor ERC20 token supply',
        defaultValue: true,
      },
      {
        key: 'checkERC721',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor ERC721 token supply',
        defaultValue: true,
      },
      {
        key: 'checkERC1155',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor ERC1155 token supply',
        defaultValue: true,
      },
      {
        key: 'enforceSupplyCaps',
        type: 'boolean',
        required: false,
        description: 'Whether to enforce supply cap validation',
        defaultValue: true,
      },
      {
        key: 'maxTotalSupply',
        type: 'string',
        required: false,
        description: 'Maximum allowed total supply (as string to handle large numbers)',
      },
      {
        key: 'minTotalSupply',
        type: 'string',
        required: false,
        description: 'Minimum expected total supply (as string to handle large numbers)',
      },
      {
        key: 'requireMintCap',
        type: 'boolean',
        required: false,
        description: 'Whether a minting cap should be required',
        defaultValue: false,
      },
      {
        key: 'allowInfiniteSupply',
        type: 'boolean',
        required: false,
        description: 'Whether infinite supply tokens are allowed',
        defaultValue: true,
      },
      {
        key: 'checkPauseState',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor pause state of tokens',
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

    // Validate boolean fields
    const booleanFields = [
      'checkERC20',
      'checkERC721',
      'checkERC1155',
      'enforceSupplyCaps',
      'requireMintCap',
      'allowInfiniteSupply',
      'checkPauseState',
    ];
    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }

    // Validate supply limits
    if (config.maxTotalSupply !== undefined) {
      try {
        BigInt(config.maxTotalSupply);
      } catch {
        errors.push('maxTotalSupply must be a valid number string');
      }
    }

    if (config.minTotalSupply !== undefined) {
      try {
        BigInt(config.minTotalSupply);
      } catch {
        errors.push('minTotalSupply must be a valid number string');
      }
    }

    if (
      config.expectedTokenStandards !== undefined &&
      !Array.isArray(config.expectedTokenStandards)
    ) {
      errors.push('expectedTokenStandards must be an array');
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
    return true; // This module can monitor any diamond
  }

  /**
   * Execute token supply monitoring
   */
  public async monitor(context: MonitoringContext): Promise<MonitoringResult> {
    const startTime = Date.now();
    const issues: MonitoringIssue[] = [];
    const moduleConfig = this.getModuleConfig<TokenSupplyModuleConfig>(context);

    this.log(context, 'info', '🪙 Starting token supply monitoring...');

    try {
      // Analyze token supply across different standards
      const analysis = await this.analyzeTokenSupply(context);

      // Monitor ERC20 tokens if enabled
      if (moduleConfig.checkERC20 && analysis.hasERC20) {
        issues.push(...this.monitorERC20Supply(analysis.erc20Info!, moduleConfig));
      }

      // Monitor ERC721 tokens if enabled
      if (moduleConfig.checkERC721 && analysis.hasERC721) {
        issues.push(...this.monitorERC721Supply(analysis.erc721Info!, moduleConfig));
      }

      // Monitor ERC1155 tokens if enabled
      if (moduleConfig.checkERC1155 && analysis.hasERC1155) {
        issues.push(...this.monitorERC1155Supply(analysis.erc1155Info!, moduleConfig));
      }

      // Check for general supply issues
      issues.push(...this.checkGeneralSupplyIssues(analysis, moduleConfig));

      const executionTime = Date.now() - startTime;
      this.log(context, 'info', `✅ Token supply monitoring completed in ${executionTime}ms`);

      return {
        status: issues.some(
          i => i.severity === SeverityLevel.ERROR || i.severity === SeverityLevel.CRITICAL
        )
          ? MonitoringStatus.FAIL
          : MonitoringStatus.PASS,
        issues,
        executionTime,
        metadata: {
          analysis,
          moduleConfig,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(context, 'error', `❌ Token supply monitoring failed: ${(error as Error).message}`);

      issues.push(
        this.createIssue(
          'token-supply-error',
          'Token Supply Monitoring Failed',
          `Failed to analyze token supply: ${(error as Error).message}`,
          SeverityLevel.ERROR,
          'execution'
        )
      );

      return {
        status: MonitoringStatus.FAIL,
        issues,
        executionTime,
        metadata: { error: (error as Error).message },
      };
    }
  }

  /**
   * Analyze token supply across different token standards
   */
  private async analyzeTokenSupply(context: MonitoringContext): Promise<TokenSupplyAnalysis> {
    const { diamond, provider } = context;

    const analysis: TokenSupplyAnalysis = {
      hasERC20: false,
      hasERC721: false,
      hasERC1155: false,
      supplyIssues: [],
      totalTokenContracts: 0,
    };

    // Check for ERC20 implementation
    try {
      analysis.erc20Info = await this.checkERC20Supply(diamond.address, provider);
      analysis.hasERC20 = !!analysis.erc20Info;
      if (analysis.hasERC20) analysis.totalTokenContracts++;
    } catch (error) {
      this.log(context, 'debug', `ERC20 check failed: ${(error as Error).message}`);
    }

    // Check for ERC721 implementation
    try {
      analysis.erc721Info = await this.checkERC721Supply(diamond.address, provider);
      analysis.hasERC721 = !!analysis.erc721Info;
      if (analysis.hasERC721) analysis.totalTokenContracts++;
    } catch (error) {
      this.log(context, 'debug', `ERC721 check failed: ${(error as Error).message}`);
    }

    // Check for ERC1155 implementation
    try {
      analysis.erc1155Info = await this.checkERC1155Supply(diamond.address, provider);
      analysis.hasERC1155 = !!analysis.erc1155Info;
      if (analysis.hasERC1155) analysis.totalTokenContracts++;
    } catch (error) {
      this.log(context, 'debug', `ERC1155 check failed: ${(error as Error).message}`);
    }

    return analysis;
  }

  /**
   * Check ERC20 token supply information
   */
  private async checkERC20Supply(
    address: string,
    provider: any
  ): Promise<ERC20SupplyInfo | undefined> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return undefined;
      }

      const contract = new ethers.Contract(
        ethers.getAddress(address),
        [
          'function totalSupply() view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function symbol() view returns (string)',
          'function name() view returns (string)',
          'function cap() view returns (uint256)',
          'function paused() view returns (bool)',
        ],
        provider
      );

      const totalSupply = await contract.totalSupply();
      const decimals = await contract.decimals();
      const symbol = await contract.symbol();
      const name = await contract.name();

      let cap: bigint | undefined;
      let hasCap = false;
      try {
        cap = await contract.cap();
        hasCap = true;
      } catch {
        // No cap function
      }

      let isPaused = false;
      try {
        isPaused = await contract.paused();
      } catch {
        // No pause function
      }

      return {
        totalSupply,
        decimals,
        symbol,
        name,
        hasCap,
        cap,
        remainingSupply: hasCap && cap ? cap - totalSupply : undefined,
        isMintable: await this.checkMintable(address, provider),
        isBurnable: await this.checkBurnable(address, provider),
        isPaused,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Check ERC721 token supply information
   */
  private async checkERC721Supply(
    address: string,
    provider: any
  ): Promise<ERC721SupplyInfo | undefined> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return undefined;
      }

      const contract = new ethers.Contract(
        ethers.getAddress(address),
        [
          'function totalSupply() view returns (uint256)',
          'function maxSupply() view returns (uint256)',
          'function paused() view returns (bool)',
        ],
        provider
      );

      const totalSupply = await contract.totalSupply();

      let maxSupply: bigint | undefined;
      try {
        maxSupply = await contract.maxSupply();
      } catch {
        // No maxSupply function
      }

      let isPaused = false;
      try {
        isPaused = await contract.paused();
      } catch {
        // No pause function
      }

      return {
        totalSupply,
        maxSupply,
        remainingSupply: maxSupply ? maxSupply - totalSupply : undefined,
        isMintable: await this.checkMintable(address, provider),
        isBurnable: await this.checkBurnable(address, provider),
        isPaused,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Check ERC1155 token supply information
   */
  private async checkERC1155Supply(
    address: string,
    provider: any
  ): Promise<ERC1155SupplyInfo | undefined> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return undefined;
      }

      const contract = new ethers.Contract(
        ethers.getAddress(address),
        ['function uri(uint256) view returns (string)', 'function paused() view returns (bool)'],
        provider
      );

      let uri: string | undefined;
      try {
        uri = await contract.uri(0); // Try to get URI for token ID 0
      } catch {
        // No URI or token doesn't exist
      }

      let isPaused = false;
      try {
        isPaused = await contract.paused();
      } catch {
        // No pause function
      }

      return {
        tokenIds: [], // Would need to track this from events
        totalSupplies: {}, // Would need to query specific token IDs
        maxSupplies: {}, // Would need contract-specific implementation
        isMintable: await this.checkMintable(address, provider),
        isBurnable: await this.checkBurnable(address, provider),
        isPaused,
        uri,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Check if contract supports minting
   */
  private async checkMintable(address: string, provider: any): Promise<boolean> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return false;
      }

      const contract = new ethers.Contract(
        ethers.getAddress(address),
        ['function mint(address,uint256) external'],
        provider
      );

      // Try to get the function (will throw if not present)
      contract.interface.getFunction('mint');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if contract supports burning
   */
  private async checkBurnable(address: string, provider: any): Promise<boolean> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return false;
      }

      const contract = new ethers.Contract(
        ethers.getAddress(address),
        ['function burn(uint256) external'],
        provider
      );

      // Try to get the function (will throw if not present)
      contract.interface.getFunction('burn');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Monitor ERC20 supply patterns
   */
  private monitorERC20Supply(
    erc20Info: ERC20SupplyInfo,
    config: TokenSupplyModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check total supply limits
    if (config.maxTotalSupply) {
      const maxSupply = BigInt(config.maxTotalSupply);
      if (erc20Info.totalSupply > maxSupply) {
        issues.push(
          this.createIssue(
            'erc20-supply-exceeded',
            'ERC20 Supply Exceeds Maximum',
            `Total supply ${erc20Info.totalSupply} exceeds maximum ${maxSupply}`,
            SeverityLevel.ERROR,
            'supply-limits'
          )
        );
      }
    }

    if (config.minTotalSupply) {
      const minSupply = BigInt(config.minTotalSupply);
      if (erc20Info.totalSupply < minSupply) {
        issues.push(
          this.createIssue(
            'erc20-supply-below-minimum',
            'ERC20 Supply Below Minimum',
            `Total supply ${erc20Info.totalSupply} is below minimum ${minSupply}`,
            SeverityLevel.WARNING,
            'supply-limits'
          )
        );
      }
    }

    // Check for supply cap requirements
    if (config.requireMintCap && !erc20Info.hasCap) {
      issues.push(
        this.createIssue(
          'erc20-missing-cap',
          'ERC20 Missing Supply Cap',
          'Token requires a supply cap but none is implemented',
          SeverityLevel.ERROR,
          'supply-caps'
        )
      );
    }

    // Check infinite supply
    if (!config.allowInfiniteSupply && !erc20Info.hasCap && erc20Info.isMintable) {
      issues.push(
        this.createIssue(
          'erc20-infinite-supply',
          'ERC20 Infinite Supply Risk',
          'Token is mintable without a supply cap, allowing infinite inflation',
          SeverityLevel.WARNING,
          'supply-caps'
        )
      );
    }

    // Check pause state
    if (config.checkPauseState && erc20Info.isPaused) {
      issues.push(
        this.createIssue(
          'erc20-paused',
          'ERC20 Token is Paused',
          'Token transfers are currently paused',
          SeverityLevel.WARNING,
          'pause-state'
        )
      );
    }

    return issues;
  }

  /**
   * Monitor ERC721 supply patterns
   */
  private monitorERC721Supply(
    erc721Info: ERC721SupplyInfo,
    config: TokenSupplyModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check if max supply is implemented
    if (config.requireMintCap && !erc721Info.maxSupply) {
      issues.push(
        this.createIssue(
          'erc721-missing-max-supply',
          'ERC721 Missing Max Supply',
          'NFT collection requires max supply but none is implemented',
          SeverityLevel.ERROR,
          'supply-caps'
        )
      );
    }

    // Check if max supply is reached
    if (erc721Info.maxSupply && erc721Info.totalSupply >= erc721Info.maxSupply) {
      issues.push(
        this.createIssue(
          'erc721-max-supply-reached',
          'ERC721 Max Supply Reached',
          'NFT collection has reached its maximum supply',
          SeverityLevel.INFO,
          'supply-limits'
        )
      );
    }

    // Check pause state
    if (config.checkPauseState && erc721Info.isPaused) {
      issues.push(
        this.createIssue(
          'erc721-paused',
          'ERC721 Token is Paused',
          'NFT transfers are currently paused',
          SeverityLevel.WARNING,
          'pause-state'
        )
      );
    }

    return issues;
  }

  /**
   * Monitor ERC1155 supply patterns
   */
  private monitorERC1155Supply(
    erc1155Info: ERC1155SupplyInfo,
    config: TokenSupplyModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check pause state
    if (config.checkPauseState && erc1155Info.isPaused) {
      issues.push(
        this.createIssue(
          'erc1155-paused',
          'ERC1155 Token is Paused',
          'Multi-token transfers are currently paused',
          SeverityLevel.WARNING,
          'pause-state'
        )
      );
    }

    // Check for URI implementation
    if (!erc1155Info.uri) {
      issues.push(
        this.createIssue(
          'erc1155-missing-uri',
          'ERC1155 Missing URI',
          'Token URI is not implemented or accessible',
          SeverityLevel.WARNING,
          'metadata'
        )
      );
    }

    return issues;
  }

  /**
   * Check for general supply issues
   */
  private checkGeneralSupplyIssues(
    analysis: TokenSupplyAnalysis,
    config: TokenSupplyModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check if any token implementation is found
    if (analysis.totalTokenContracts === 0) {
      issues.push(
        this.createIssue(
          'no-token-implementation',
          'No Token Implementation Found',
          'Diamond does not implement any standard token interfaces',
          SeverityLevel.INFO,
          'implementation'
        )
      );
    }

    // Check for multiple token standards
    if (analysis.totalTokenContracts > 1) {
      issues.push(
        this.createIssue(
          'multiple-token-standards',
          'Multiple Token Standards Detected',
          `Diamond implements ${analysis.totalTokenContracts} different token standards`,
          SeverityLevel.INFO,
          'implementation',
          'Ensure proper integration and avoid conflicts between different token standards'
        )
      );
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
      metadata,
    };
  }
}
