/**
 * Access Control Monitoring Module for Hardhat Diamond Monitor Plugin
 *
 * Monitors access control mechanisms in the diamond including role-based access,
 * ownership patterns, and privilege escalation protection.
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
 * Access control role information
 */
interface AccessRole {
  roleHash: string;
  roleName: string;
  adminRole?: string;
  members: string[];
  memberCount: number;
}

/**
 * Ownership information
 */
interface OwnershipInfo {
  owner: string;
  pendingOwner?: string;
  transferrable: boolean;
  renounced: boolean;
}

/**
 * Access control analysis result
 */
interface AccessControlAnalysis {
  hasOwnership: boolean;
  hasRoleBasedAccess: boolean;
  ownershipInfo?: OwnershipInfo;
  roles: AccessRole[];
  totalRoles: number;
  privilegedAddresses: string[];
  hasMultiSig: boolean;
  hasTimelock: boolean;
  securityIssues: string[];
}

/**
 * Configuration for access control module
 */
interface AccessControlModuleConfig {
  checkOwnership?: boolean;
  checkRoles?: boolean;
  checkMultiSig?: boolean;
  checkTimelock?: boolean;
  maxPrivilegedAddresses?: number;
  requireMultiSig?: boolean;
  allowZeroAddressOwner?: boolean;
  expectedRoles?: string[];
  bannedAddresses?: string[];
}

/**
 * Access Control Monitoring Module
 *
 * Monitors various access control mechanisms in diamond contracts including
 * ownership, role-based access control, and security best practices.
 */
export class AccessControlModule implements MonitoringModule {
  public readonly id = 'access-control';
  public readonly name = 'Access Control Monitoring';
  public readonly description =
    'Monitors ownership, roles, and access control mechanisms in diamond contracts';
  public readonly version = '1.0.0';
  public readonly category = 'security';

  // Standard access control interface selectors
  private readonly standardSelectors = {
    // Ownable
    ownership: {
      owner: '0x8da5cb5b',
      transferOwnership: '0xf2fde38b',
      renounceOwnership: '0x715018a6',
    },
    // AccessControl (OpenZeppelin)
    accessControl: {
      hasRole: '0x91d14854',
      getRoleAdmin: '0x248a9ca3',
      grantRole: '0x2f2ff15d',
      revokeRole: '0xd547741f',
      renounceRole: '0x36568abe',
    },
    // AccessControlEnumerable
    enumerable: {
      getRoleMember: '0x9010d07c',
      getRoleMemberCount: '0xca15c873',
    },
  };

  // Standard role hashes
  private readonly standardRoles = {
    DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000',
    MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE')),
    BURNER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE')),
    PAUSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('PAUSER_ROLE')),
    UPGRADER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('UPGRADER_ROLE')),
  };

  /**
   * Get configuration requirements for this module
   */
  public getRequiredConfig(): ConfigRequirement[] {
    return [
      {
        key: 'checkOwnership',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor ownership patterns',
        defaultValue: true,
      },
      {
        key: 'checkRoles',
        type: 'boolean',
        required: false,
        description: 'Whether to monitor role-based access control',
        defaultValue: true,
      },
      {
        key: 'checkMultiSig',
        type: 'boolean',
        required: false,
        description: 'Whether to check for multi-signature requirements',
        defaultValue: true,
      },
      {
        key: 'checkTimelock',
        type: 'boolean',
        required: false,
        description: 'Whether to check for timelock mechanisms',
        defaultValue: true,
      },
      {
        key: 'maxPrivilegedAddresses',
        type: 'number',
        required: false,
        description: 'Maximum number of privileged addresses allowed',
        defaultValue: 5,
      },
      {
        key: 'requireMultiSig',
        type: 'boolean',
        required: false,
        description: 'Whether multi-signature should be required for critical operations',
        defaultValue: false,
      },
      {
        key: 'allowZeroAddressOwner',
        type: 'boolean',
        required: false,
        description: 'Whether zero address owner is allowed (renounced ownership)',
        defaultValue: false,
      },
    ];
  }

  /**
   * Validate module configuration
   */
  public validateConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate config types
    const booleanFields = [
      'checkOwnership',
      'checkRoles',
      'checkMultiSig',
      'checkTimelock',
      'requireMultiSig',
      'allowZeroAddressOwner',
    ];
    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }

    if (
      config.maxPrivilegedAddresses !== undefined &&
      (typeof config.maxPrivilegedAddresses !== 'number' || config.maxPrivilegedAddresses < 0)
    ) {
      errors.push('maxPrivilegedAddresses must be a non-negative number');
    }

    if (config.expectedRoles !== undefined && !Array.isArray(config.expectedRoles)) {
      errors.push('expectedRoles must be an array');
    }

    if (config.bannedAddresses !== undefined && !Array.isArray(config.bannedAddresses)) {
      errors.push('bannedAddresses must be an array');
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
   * Execute access control monitoring
   */
  public async monitor(context: MonitoringContext): Promise<MonitoringResult> {
    const startTime = Date.now();
    const issues: MonitoringIssue[] = [];
    const moduleConfig = this.getModuleConfig<AccessControlModuleConfig>(context);

    this.log(context, 'info', '🔐 Starting access control monitoring...');

    try {
      // Analyze access control mechanisms
      const analysis = await this.analyzeAccessControl(context);

      // Monitor ownership if enabled
      if (moduleConfig.checkOwnership) {
        issues.push(...this.monitorOwnership(analysis, moduleConfig));
      }

      // Monitor roles if enabled
      if (moduleConfig.checkRoles) {
        issues.push(...this.monitorRoles(analysis, moduleConfig));
      }

      // Monitor multi-signature requirements if enabled
      if (moduleConfig.checkMultiSig) {
        issues.push(...this.monitorMultiSig(analysis, moduleConfig));
      }

      // Monitor timelock mechanisms if enabled
      if (moduleConfig.checkTimelock) {
        issues.push(...this.monitorTimelock(analysis, moduleConfig));
      }

      // Check for security issues
      issues.push(...this.checkSecurityIssues(analysis, moduleConfig));

      const executionTime = Date.now() - startTime;
      this.log(context, 'info', `✅ Access control monitoring completed in ${executionTime}ms`);

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
      this.log(
        context,
        'error',
        `❌ Access control monitoring failed: ${(error as Error).message}`
      );

      issues.push(
        this.createIssue(
          'access-control-error',
          'Access Control Monitoring Failed',
          `Failed to analyze access control: ${(error as Error).message}`,
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
   * Analyze access control mechanisms in the diamond
   */
  private async analyzeAccessControl(context: MonitoringContext): Promise<AccessControlAnalysis> {
    const { diamond, provider } = context;

    const analysis: AccessControlAnalysis = {
      hasOwnership: false,
      hasRoleBasedAccess: false,
      roles: [],
      totalRoles: 0,
      privilegedAddresses: [],
      hasMultiSig: false,
      hasTimelock: false,
      securityIssues: [],
    };

    // Check for ownership pattern
    analysis.ownershipInfo = await this.checkOwnership(diamond.address, provider);
    analysis.hasOwnership = !!analysis.ownershipInfo;

    // Check for role-based access control
    const roles = await this.checkRoles(diamond.address, provider);
    analysis.roles = roles;
    analysis.totalRoles = roles.length;
    analysis.hasRoleBasedAccess = roles.length > 0;

    // Collect all privileged addresses
    const privilegedAddresses = new Set<string>();
    if (analysis.ownershipInfo?.owner && analysis.ownershipInfo.owner !== ethers.ZeroAddress) {
      privilegedAddresses.add(analysis.ownershipInfo.owner);
    }
    for (const role of roles) {
      for (const member of role.members) {
        privilegedAddresses.add(member);
      }
    }
    analysis.privilegedAddresses = Array.from(privilegedAddresses);

    // Check for multi-signature and timelock (simplified check)
    analysis.hasMultiSig = await this.checkMultiSigPattern(diamond.address, provider);
    analysis.hasTimelock = await this.checkTimelockPattern(diamond.address, provider);

    return analysis;
  }

  /**
   * Check ownership pattern
   */
  private async checkOwnership(address: string, provider: any): Promise<OwnershipInfo | undefined> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return undefined;
      }

      // Try to call owner() function
      const contract = new ethers.Contract(
        ethers.getAddress(address),
        ['function owner() view returns (address)'],
        provider
      );
      const owner = await contract.owner();

      return {
        owner,
        transferrable: true, // Assume transferrable unless proven otherwise
        renounced: owner === ethers.ZeroAddress,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Check role-based access control
   */
  private async checkRoles(address: string, provider: any): Promise<AccessRole[]> {
    const roles: AccessRole[] = [];

    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return roles;
      }

      const contract = new ethers.Contract(
        ethers.getAddress(address),
        [
          'function hasRole(bytes32 role, address account) view returns (bool)',
          'function getRoleMemberCount(bytes32 role) view returns (uint256)',
          'function getRoleMember(bytes32 role, uint256 index) view returns (address)',
        ],
        provider
      );

      // Check standard roles
      for (const [roleName, roleHash] of Object.entries(this.standardRoles)) {
        try {
          const memberCount = await contract.getRoleMemberCount(roleHash);
          if (memberCount > 0) {
            const members: string[] = [];
            for (let i = 0; i < Math.min(memberCount, 10); i++) {
              // Limit to first 10 members
              try {
                const member = await contract.getRoleMember(roleHash, i);
                members.push(member);
              } catch {
                break;
              }
            }

            roles.push({
              roleHash,
              roleName,
              members,
              memberCount: Number(memberCount),
            });
          }
        } catch {
          // Role doesn't exist or not accessible
        }
      }
    } catch {
      // Contract doesn't implement role-based access control
    }

    return roles;
  }

  /**
   * Check for multi-signature pattern (simplified)
   */
  private async checkMultiSigPattern(address: string, provider: any): Promise<boolean> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return false;
      }

      // Check for common multi-sig interface patterns
      const contract = new ethers.Contract(
        ethers.getAddress(address),
        [
          'function getOwners() view returns (address[])',
          'function required() view returns (uint256)',
        ],
        provider
      );

      await contract.getOwners();
      await contract.required();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for timelock pattern (simplified)
   */
  private async checkTimelockPattern(address: string, provider: any): Promise<boolean> {
    try {
      // Ensure address is properly formatted
      if (!ethers.isAddress(address)) {
        return false;
      }

      // Check for common timelock interface patterns
      const contract = new ethers.Contract(
        ethers.getAddress(address),
        ['function delay() view returns (uint256)'],
        provider
      );

      await contract.delay();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Monitor ownership patterns
   */
  private monitorOwnership(
    analysis: AccessControlAnalysis,
    config: AccessControlModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    if (!analysis.hasOwnership) {
      issues.push(
        this.createIssue(
          'no-ownership',
          'No Ownership Pattern Detected',
          'Diamond does not implement ownership pattern',
          SeverityLevel.WARNING,
          'ownership',
          'Consider implementing ownership pattern for administrative functions'
        )
      );
      return issues;
    }

    const ownership = analysis.ownershipInfo!;

    // Check for zero address owner
    if (ownership.owner === ethers.ZeroAddress) {
      if (!config.allowZeroAddressOwner) {
        issues.push(
          this.createIssue(
            'renounced-ownership',
            'Ownership Renounced',
            'Contract ownership has been renounced (owner is zero address)',
            SeverityLevel.WARNING,
            'ownership',
            'Ensure this is intentional and proper governance mechanisms are in place'
          )
        );
      }
    } else {
      // Check if owner is an EOA (simplified check)
      if (ownership.owner.length === 42) {
        // Standard address length
        issues.push(
          this.createIssue(
            'eoa-owner',
            'EOA Owner Detected',
            'Contract owner appears to be an EOA rather than a contract',
            SeverityLevel.INFO,
            'ownership',
            'Consider using a multi-signature wallet or governance contract as owner'
          )
        );
      }
    }

    return issues;
  }

  /**
   * Monitor role-based access control
   */
  private monitorRoles(
    analysis: AccessControlAnalysis,
    config: AccessControlModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    if (!analysis.hasRoleBasedAccess) {
      issues.push(
        this.createIssue(
          'no-rbac',
          'No Role-Based Access Control',
          'Diamond does not implement role-based access control',
          SeverityLevel.INFO,
          'roles',
          'Consider implementing role-based access control for better security'
        )
      );
      return issues;
    }

    // Check for excessive privileged addresses
    if (
      config.maxPrivilegedAddresses &&
      analysis.privilegedAddresses.length > config.maxPrivilegedAddresses
    ) {
      issues.push(
        this.createIssue(
          'excessive-privileged-addresses',
          'Excessive Privileged Addresses',
          `Found ${analysis.privilegedAddresses.length} privileged addresses, exceeds limit of ${config.maxPrivilegedAddresses}`,
          SeverityLevel.WARNING,
          'roles',
          'Review and minimize the number of privileged addresses'
        )
      );
    }

    // Check each role
    for (const role of analysis.roles) {
      if (role.memberCount === 0) {
        issues.push(
          this.createIssue(
            'empty-role',
            'Empty Role Detected',
            `Role ${role.roleName} has no members`,
            SeverityLevel.WARNING,
            'roles',
            'Review if empty roles are intentional'
          )
        );
      }

      if (role.memberCount === 1 && role.roleName === 'DEFAULT_ADMIN_ROLE') {
        issues.push(
          this.createIssue(
            'single-admin',
            'Single Admin Role Member',
            'Default admin role has only one member, creating single point of failure',
            SeverityLevel.WARNING,
            'roles',
            'Consider having multiple admin role members for redundancy'
          )
        );
      }
    }

    return issues;
  }

  /**
   * Monitor multi-signature requirements
   */
  private monitorMultiSig(
    analysis: AccessControlAnalysis,
    config: AccessControlModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    if (config.requireMultiSig && !analysis.hasMultiSig) {
      issues.push(
        this.createIssue(
          'missing-multisig',
          'Missing Multi-Signature',
          'Multi-signature is required but not detected',
          SeverityLevel.ERROR,
          'multisig',
          'Implement multi-signature mechanism for critical operations'
        )
      );
    }

    return issues;
  }

  /**
   * Monitor timelock mechanisms
   */
  private monitorTimelock(
    analysis: AccessControlAnalysis,
    config: AccessControlModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    if (!analysis.hasTimelock) {
      issues.push(
        this.createIssue(
          'no-timelock',
          'No Timelock Mechanism',
          'No timelock mechanism detected for critical operations',
          SeverityLevel.INFO,
          'timelock',
          'Consider implementing timelock for critical administrative functions'
        )
      );
    }

    return issues;
  }

  /**
   * Check for security issues
   */
  private checkSecurityIssues(
    analysis: AccessControlAnalysis,
    config: AccessControlModuleConfig
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];

    // Check for banned addresses
    if (config.bannedAddresses) {
      for (const bannedAddress of config.bannedAddresses) {
        if (analysis.privilegedAddresses.includes(bannedAddress)) {
          issues.push(
            this.createIssue(
              'banned-address',
              'Banned Address in Privileged Position',
              `Banned address ${bannedAddress} has privileged access`,
              SeverityLevel.CRITICAL,
              'security',
              'Remove banned address from privileged positions immediately'
            )
          );
        }
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
      metadata,
    };
  }
}
