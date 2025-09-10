import { Provider, Contract, EventLog } from 'ethers';
import { Diamond } from 'diamonds';
import * as winston from 'winston';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { EventHandlers, ParsedDiamondCutEvent } from '../utils/eventHandlers';

/**
 * Configuration options for DiamondMonitor
 */
export interface DiamondMonitorConfig {
  /** Polling interval in milliseconds for health checks (default: 30000) */
  pollingInterval?: number;
  /** Enable event logging (default: true) */
  enableEventLogging?: boolean;
  /** Enable automated health checks (default: true) */
  enableHealthChecks?: boolean;
  /** Custom logger instance */
  logger?: winston.Logger;
  /** Block number to start monitoring from */
  fromBlock?: number | 'latest';
  /** Alert thresholds for health monitoring */
  alertThresholds?: {
    /** Maximum response time in ms for health checks */
    maxResponseTime?: number;
    /** Maximum number of failed health checks before alert */
    maxFailedChecks?: number;
  };
}

/**
 * Internal configuration with all required properties
 */
interface InternalConfig {
  pollingInterval: number;
  enableEventLogging: boolean;
  enableHealthChecks: boolean;
  logger: winston.Logger;
  fromBlock: number | 'latest';
  alertThresholds: {
    maxResponseTime: number;
    maxFailedChecks: number;
  };
}

/**
 * Diamond information structure
 */
export interface DiamondInfo {
  /** Diamond contract address */
  address: string;
  /** Array of facet information */
  facets: FacetInfo[];
  /** Total number of function selectors */
  totalSelectors: number;
  /** Diamond ABI */
  abi?: any[];
}

/**
 * Facet information structure
 */
export interface FacetInfo {
  /** Facet contract address */
  address: string;
  /** Function selectors handled by this facet */
  selectors: string[];
  /** Facet name (if available) */
  name?: string;
}

/**
 * Health check result structure
 */
export interface HealthCheckResult {
  /** Overall health status */
  isHealthy: boolean;
  /** Individual health checks */
  checks: HealthCheck[];
  /** Timestamp of the health check */
  timestamp: Date;
  /** Total time taken for all checks */
  totalTime: number;
  /** Additional metadata about the checks */
  metadata?: {
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
  };
}

/**
 * Individual health check structure
 */
export interface HealthCheck {
  /** Name of the health check */
  name: string;
  /** Check status */
  status: 'passed' | 'failed' | 'warning';
  /** Check message */
  message: string;
  /** Time taken for this check */
  duration: number;
  /** Additional details */
  details?: any;
}

/**
 * Event listener function type
 */
export type EventListener = (event: EventLog) => void;

/**
 * Monitoring errors
 */
export class MonitoringError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MonitoringError';
  }
}

/**
 * Main DiamondMonitor class for monitoring ERC-2535 Diamond Proxy contracts
 * 
 * This class provides comprehensive monitoring capabilities including:
 * - Real-time event monitoring
 * - Health checks and diagnostics
 * - Facet management and analysis
 * - Integration with the diamonds module
 */
export class DiamondMonitor {
  private readonly diamond: Diamond;
  private readonly provider: Provider;
  private readonly config: InternalConfig;
  private readonly logger: winston.Logger;
  private readonly eventHandlers: EventHandlers;
  
  private isActive = false;
  private contract?: Contract;
  private eventListeners: EventListener[] = [];
  private healthCheckInterval?: NodeJS.Timeout;

  /**
   * Creates a new DiamondMonitor instance
   * 
   * @param diamond - Diamond instance from the diamonds module
   * @param provider - Ethereum provider (ethers.js)
   * @param config - Optional configuration
   */
  constructor(
    diamond: Diamond,
    provider: Provider,
    config: DiamondMonitorConfig = {}
  ) {
    if (!diamond) {
      throw new MonitoringError('Diamond instance is required');
    }
    if (!provider) {
      throw new MonitoringError('Provider is required');
    }

    this.diamond = diamond;
    this.provider = provider;
    
    // Merge config with defaults
    this.config = {
      pollingInterval: config.pollingInterval ?? 30000,
      enableEventLogging: config.enableEventLogging ?? true,
      enableHealthChecks: config.enableHealthChecks ?? true,
      logger: config.logger ?? this.createDefaultLogger(),
      fromBlock: config.fromBlock ?? 'latest',
      alertThresholds: {
        maxResponseTime: config.alertThresholds?.maxResponseTime ?? 5000,
        maxFailedChecks: config.alertThresholds?.maxFailedChecks ?? 3,
      },
    };

    this.logger = this.config.logger;
    this.eventHandlers = new EventHandlers(this.logger);
    
    this.logger.info('DiamondMonitor initialized', {
      diamondAddress: this.getDiamondAddress(),
      config: this.config
    });
  }

  /**
   * Create default winston logger
   */
  private createDefaultLogger(): winston.Logger {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Get diamond address from Diamond instance
   */
  private getDiamondAddress(): string {
    try {
      const deployedData = this.diamond.getDeployedDiamondData();
      return deployedData?.DiamondAddress || '';
    } catch (error) {
      throw new MonitoringError('Failed to get diamond address from Diamond instance', error as Error);
    }
  }

  /**
   * Initialize contract instance for monitoring
   */
  private async initializeContract(): Promise<void> {
    try {
      const diamondAddress = this.getDiamondAddress();
      
      // Try to get ABI from Diamond instance first
      let abi: string[] = [];
      try {
        const abiPath = this.diamond.getDiamondAbiFilePath();
        if (abiPath && fs.existsSync(abiPath)) {
          const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
          abi = abiData.abi || abiData; // Handle both {abi: [...]} and [...] formats
        }
      } catch (error) {
        // Fallback to basic Diamond ABI if file reading fails
        this.logger.debug('Failed to read Diamond ABI file, using fallback', { error });
      }
      
      // Use basic Diamond ABI as fallback
      if (abi.length === 0) {
        abi = [
          'event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)',
          'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
          'function facetFunctionSelectors(address _facet) external view returns (bytes4[])',
          'function facetAddresses() external view returns (address[])',
          'function facetAddress(bytes4 _functionSelector) external view returns (address)'
        ];
      }
      
      this.contract = new Contract(diamondAddress, abi, this.provider);
      this.logger.debug('Contract initialized', { address: diamondAddress });
    } catch (error) {
      throw new MonitoringError('Failed to initialize contract', error as Error);
    }
  }

  /**
   * Get comprehensive diamond information
   * 
   * @returns Promise resolving to diamond information
   */
  public async getDiamondInfo(): Promise<DiamondInfo> {
    try {
      const deployedData = this.diamond.getDeployedDiamondData();
      
      // Transform deployed facets data to our format
      const facets: FacetInfo[] = [];
      if (deployedData?.DeployedFacets) {
        Object.entries(deployedData.DeployedFacets).forEach(([name, facetData]) => {
          if (facetData?.address && facetData?.funcSelectors) {
            facets.push({
              address: facetData.address,
              selectors: facetData.funcSelectors,
              name: name
            });
          }
        });
      }

      const totalSelectors = facets.reduce((total, facet) => total + facet.selectors.length, 0);

      return {
        address: deployedData?.DiamondAddress || '',
        facets,
        totalSelectors,
        abi: [] // ABI will be populated separately if needed
      };
    } catch (error) {
      throw new MonitoringError('Failed to get diamond information', error as Error);
    }
  }

  /**
   * Start monitoring the diamond contract
   * 
   * @returns Promise that resolves when monitoring is started
   */
  public async startMonitoring(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Monitoring is already active');
      return;
    }

    try {
      await this.initializeContract();
      
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      this.isActive = true;
      this.logger.info('Diamond monitoring started');
    } catch (error) {
      throw new MonitoringError('Failed to start monitoring', error as Error);
    }
  }

  /**
   * Stop monitoring the diamond contract
   */
  public stopMonitoring(): void {
    if (!this.isActive) {
      return;
    }

    this.stopHealthChecks();
    this.eventListeners = [];
    this.isActive = false;
    
    this.logger.info('Diamond monitoring stopped');
  }

  /**
   * Check if monitoring is currently active
   * 
   * @returns True if monitoring is active
   */
  public isMonitoring(): boolean {
    return this.isActive;
  }

  /**
   * Perform comprehensive health checks on the diamond contract
   * 
   * @returns Promise resolving to health check results
   */
  public async getHealthStatus(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    try {
      // Connectivity check
      const connectivityCheck = await this.performConnectivityCheck();
      checks.push(connectivityCheck);

      // Contract existence check
      const contractCheck = await this.performContractCheck();
      checks.push(contractCheck);

      // Facet integrity check
      const facetCheck = await this.performFacetIntegrityCheck();
      checks.push(facetCheck);

      // Enhanced loupe function checks
      const loupeChecks = await this.performLoupeChecks();
      checks.push(...loupeChecks);

      // Response time check using alert thresholds
      const responseTimeCheck = await this.performResponseTimeCheck();
      checks.push(responseTimeCheck);

    } catch (error) {
      checks.push({
        name: 'health_check_error',
        status: 'failed',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        details: { error }
      });
    }

    const totalTime = Date.now() - startTime;
    const isHealthy = checks.every(check => check.status === 'passed');
    const warningCount = checks.filter(check => check.status === 'warning').length;

    return {
      isHealthy,
      checks,
      timestamp: new Date(),
      totalTime,
      metadata: {
        totalChecks: checks.length,
        passedChecks: checks.filter(check => check.status === 'passed').length,
        warningChecks: warningCount,
        failedChecks: checks.filter(check => check.status === 'failed').length
      }
    };
  }

  /**
   * Set up event tracking for diamond contract events
   * Returns an EventEmitter that emits 'facetChanged' and 'healthIssue' events
   * 
   * @param listener - Optional custom event listener
   * @returns EventEmitter for real-time monitoring
   */
  public trackEvents(listener?: EventListener): EventEmitter {
    const eventEmitter = new EventEmitter();
    
    if (!this.config.enableEventLogging) {
      this.logger.warn('Event logging is disabled in configuration');
      return eventEmitter;
    }

    // Add optional listener if provided
    if (listener) {
      this.eventListeners.push(listener);
    }

    // Start async initialization
    this.initializeEventTracking(eventEmitter).catch(error => {
      this.logger.error('Failed to initialize event tracking', { error });
      eventEmitter.emit('healthIssue', {
        issue: 'Failed to initialize event tracking',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    });

    return eventEmitter;
  }

  /**
   * Initialize event tracking asynchronously
   */
  private async initializeEventTracking(eventEmitter: EventEmitter): Promise<void> {
    try {
      if (!this.contract) {
        await this.initializeContract();
      }

      if (this.config.enableEventLogging) {
        this.setupEventLogging();
      }

      // Get the diamond contract to listen for DiamondCut events
      const diamondData = this.diamond.getDeployedDiamondData();
      const diamondAddress = diamondData.DiamondAddress;
      
      if (!diamondAddress) {
        throw new Error('Diamond address not found in deployed data');
      }

      const diamondContract = new Contract(
        diamondAddress,
        ['event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)'],
        this.provider
      );

      // Listen for DiamondCut events
      diamondContract.on('DiamondCut', async (diamondCutData, init, calldata, event) => {
        try {
          const cutEvent = {
            diamondCutData,
            init,
            calldata,
            blockNumber: event.blockNumber,
            blockHash: event.blockHash,
            transactionHash: event.transactionHash,
            timestamp: new Date().toISOString()
          };

          this.logger.info('DiamondCut event detected', cutEvent);

          // Handle the cut event and emit facetChanged
          await this.handleCutEvent(event, eventEmitter);

          // Perform health check after facet change
          if (this.config.enableHealthChecks) {
            const healthStatus = await this.getHealthStatus();
            if (!healthStatus.isHealthy) {
              eventEmitter.emit('healthIssue', {
                issue: 'Health check failed after facet change',
                details: healthStatus,
                timestamp: new Date().toISOString()
              });
            }
          }

        } catch (error) {
          this.logger.error('Error processing DiamondCut event', { error });
          eventEmitter.emit('healthIssue', {
            issue: 'Event processing error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle provider errors
      this.provider.on('error', (error) => {
        this.logger.error('Provider error during event tracking', { error });
        eventEmitter.emit('healthIssue', {
          issue: 'Provider error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });

      this.logger.info('Event tracking initialized with real-time monitoring');
      
    } catch (error) {
      this.logger.error('Failed to initialize event tracking', { error });
      throw error;
    }
  }

  /**
   * Handle DiamondCut events and emit appropriate events
   */
  private async handleCutEvent(event: EventLog, eventEmitter: EventEmitter): Promise<void> {
    try {
      // Parse the DiamondCut event using EventHandlers
      const parsedEvent = this.eventHandlers.parseDiamondCutEvent(event);
      
      // Analyze the impact of the change
      const impact = this.eventHandlers.analyzeCutImpact(parsedEvent);
      
      // Check if this should trigger an alert
      const shouldAlert = this.eventHandlers.shouldAlert(parsedEvent, {
        maxFacetChanges: 5,
        maxSelectorChanges: this.config.alertThresholds.maxResponseTime / 100, // Scale threshold
        alertOnRemove: true
      });

      // Emit the facetChanged event with enhanced data
      eventEmitter.emit('facetChanged', {
        ...parsedEvent,
        impact,
        shouldAlert
      });

      // Log the event in a structured format
      const logData = this.eventHandlers.formatEventForLog(parsedEvent);
      this.logger.info('Facet change processed', { 
        ...logData,
        impact: impact.summary,
        severity: impact.severity
      });

      // If high severity or should alert, emit health issue
      if (impact.severity === 'high' || shouldAlert) {
        eventEmitter.emit('healthIssue', {
          issue: 'High-impact facet change detected',
          severity: impact.severity,
          details: impact.details,
          parsedEvent,
          timestamp: parsedEvent.timestamp
        });
      }

    } catch (error) {
      this.logger.error('Error handling cut event', { error, event });
      eventEmitter.emit('healthIssue', {
        issue: 'Failed to parse DiamondCut event',
        error: error instanceof Error ? error.message : String(error),
        eventData: {
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start automated health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        if (!health.isHealthy) {
          this.logger.warn('Health check failed', { checks: health.checks });
        }
      } catch (error) {
        this.logger.error('Health check error', { error });
      }
    }, this.config.pollingInterval);
  }

  /**
   * Stop automated health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Perform connectivity check
   */
  private async performConnectivityCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      await this.provider.getNetwork();
      
      return {
        name: 'connectivity',
        status: 'passed',
        message: 'Provider connectivity is healthy',
        duration: Math.max(1, Date.now() - startTime) // Ensure minimum 1ms duration
      };
    } catch (error) {
      return {
        name: 'connectivity',
        status: 'failed',
        message: `Provider connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Perform contract existence check
   */
  private async performContractCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const diamondAddress = this.getDiamondAddress();
      const code = await this.provider.getCode(diamondAddress);
      
      if (code === '0x') {
        return {
          name: 'contract_existence',
          status: 'failed',
          message: 'Diamond contract not found at address',
          duration: Math.max(1, Date.now() - startTime),
          details: { address: diamondAddress }
        };
      }

      return {
        name: 'contract_existence',
        status: 'passed',
        message: 'Diamond contract exists and has code',
        duration: Math.max(1, Date.now() - startTime)
      };
    } catch (error) {
      return {
        name: 'contract_existence',
        status: 'failed',
        message: `Contract check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Perform facet integrity check
   */
  private async performFacetIntegrityCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const info = await this.getDiamondInfo();
      
      if (info.facets.length === 0) {
        return {
          name: 'facet_integrity',
          status: 'warning',
          message: 'No facets found in diamond',
          duration: Math.max(1, Date.now() - startTime)
        };
      }

      // Check for empty selectors
      const emptyFacets = info.facets.filter(facet => facet.selectors.length === 0);
      if (emptyFacets.length > 0) {
        return {
          name: 'facet_integrity',
          status: 'warning',
          message: `Found ${emptyFacets.length} facets with no selectors`,
          duration: Math.max(1, Date.now() - startTime),
          details: { emptyFacets }
        };
      }

      return {
        name: 'facet_integrity',
        status: 'passed',
        message: `All ${info.facets.length} facets have selectors`,
        duration: Math.max(1, Date.now() - startTime)
      };
    } catch (error) {
      return {
        name: 'facet_integrity',
        status: 'failed',
        message: `Facet integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Perform comprehensive loupe function checks
   */
  private async performLoupeChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Check facets() function
    const facetsCheck = await this.performFacetsLoupeCheck();
    checks.push(facetsCheck);

    // Check facetFunctionSelectors() function
    const selectorsCheck = await this.performSelectorsLoupeCheck();
    checks.push(selectorsCheck);

    // Check facetAddresses() function  
    const addressesCheck = await this.performAddressesLoupeCheck();
    checks.push(addressesCheck);

    return checks;
  }

  /**
   * Check facets() loupe function
   */
  private async performFacetsLoupeCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const diamondData = this.diamond.getDeployedDiamondData();
      const diamondAddress = diamondData.DiamondAddress;
      
      if (!diamondAddress) {
        throw new Error('Diamond address not found');
      }

      // Create contract with loupe interface
      const loupeContract = new Contract(
        diamondAddress,
        ['function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)'],
        this.provider
      );

      const facets = await loupeContract.facets();
      
      if (!Array.isArray(facets) || facets.length === 0) {
        return {
          name: 'loupe_facets',
          status: 'warning',
          message: 'No facets returned by facets() function',
          duration: Math.max(1, Date.now() - startTime)
        };
      }

      // Validate facet structure
      const invalidFacets = facets.filter((facet: any) => 
        !facet.facetAddress || !Array.isArray(facet.functionSelectors)
      );

      if (invalidFacets.length > 0) {
        return {
          name: 'loupe_facets',
          status: 'warning',
          message: `${invalidFacets.length} facets have invalid structure`,
          duration: Math.max(1, Date.now() - startTime),
          details: { invalidFacets }
        };
      }

      return {
        name: 'loupe_facets',
        status: 'passed',
        message: `Successfully retrieved ${facets.length} facets via loupe`,
        duration: Math.max(1, Date.now() - startTime),
        details: { facetCount: facets.length }
      };
    } catch (error) {
      return {
        name: 'loupe_facets',
        status: 'failed',
        message: `Loupe facets() check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Check facetFunctionSelectors() loupe function
   */
  private async performSelectorsLoupeCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const diamondData = this.diamond.getDeployedDiamondData();
      const diamondAddress = diamondData.DiamondAddress;
      
      if (!diamondAddress) {
        throw new Error('Diamond address not found');
      }

      const loupeContract = new Contract(
        diamondAddress,
        [
          'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)',
          'function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_)'
        ],
        this.provider
      );

      // Get first facet to test
      const facets = await loupeContract.facets();
      if (facets.length === 0) {
        return {
          name: 'loupe_selectors',
          status: 'warning',
          message: 'No facets available to test selectors',
          duration: Math.max(1, Date.now() - startTime)
        };
      }

      const firstFacet = facets[0];
      const selectors = await loupeContract.facetFunctionSelectors(firstFacet.facetAddress);

      if (!Array.isArray(selectors)) {
        return {
          name: 'loupe_selectors',
          status: 'failed',
          message: 'facetFunctionSelectors did not return array',
          duration: Math.max(1, Date.now() - startTime)
        };
      }

      // Compare with expected selectors from facets()
      const expectedSelectors = firstFacet.functionSelectors;
      const selectorsMatch = selectors.length === expectedSelectors.length &&
        selectors.every((sel: string) => expectedSelectors.includes(sel));

      if (!selectorsMatch) {
        return {
          name: 'loupe_selectors',
          status: 'warning',
          message: 'Selector mismatch between facets() and facetFunctionSelectors()',
          duration: Math.max(1, Date.now() - startTime),
          details: { 
            expected: expectedSelectors.length, 
            actual: selectors.length 
          }
        };
      }

      return {
        name: 'loupe_selectors',
        status: 'passed',
        message: `Selector consistency verified for facet ${firstFacet.facetAddress}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { selectorCount: selectors.length }
      };
    } catch (error) {
      return {
        name: 'loupe_selectors',
        status: 'failed',
        message: `Loupe selectors check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Check facetAddresses() loupe function
   */
  private async performAddressesLoupeCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const diamondData = this.diamond.getDeployedDiamondData();
      const diamondAddress = diamondData.DiamondAddress;
      
      if (!diamondAddress) {
        throw new Error('Diamond address not found');
      }

      const loupeContract = new Contract(
        diamondAddress,
        [
          'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)',
          'function facetAddresses() external view returns (address[] memory facetAddresses_)'
        ],
        this.provider
      );

      const [facets, addresses] = await Promise.all([
        loupeContract.facets(),
        loupeContract.facetAddresses()
      ]);

      if (!Array.isArray(addresses)) {
        return {
          name: 'loupe_addresses',
          status: 'failed',
          message: 'facetAddresses() did not return array',
          duration: Math.max(1, Date.now() - startTime)
        };
      }

      // Extract unique addresses from facets
      const expectedAddresses = Array.from(new Set(facets.map((f: any) => f.facetAddress)));
      
      // Check if all expected addresses are present
      const missingAddresses = expectedAddresses.filter(addr => !addresses.includes(addr));
      const extraAddresses = addresses.filter(addr => !expectedAddresses.includes(addr));

      if (missingAddresses.length > 0 || extraAddresses.length > 0) {
        return {
          name: 'loupe_addresses',
          status: 'warning',
          message: 'Address mismatch between facets() and facetAddresses()',
          duration: Math.max(1, Date.now() - startTime),
          details: { 
            missing: missingAddresses,
            extra: extraAddresses
          }
        };
      }

      return {
        name: 'loupe_addresses',
        status: 'passed',
        message: `All ${addresses.length} facet addresses verified via loupe`,
        duration: Math.max(1, Date.now() - startTime),
        details: { addressCount: addresses.length }
      };
    } catch (error) {
      return {
        name: 'loupe_addresses',
        status: 'failed',
        message: `Loupe addresses check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Perform response time check using alert thresholds
   */
  private async performResponseTimeCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple network call to measure response time
      const networkStartTime = Date.now();
      await this.provider.getBlockNumber();
      const responseTime = Date.now() - networkStartTime;

      const maxResponseTime = this.config.alertThresholds.maxResponseTime;
      
      if (responseTime > maxResponseTime) {
        return {
          name: 'response_time',
          status: 'warning',
          message: `Response time ${responseTime}ms exceeds threshold ${maxResponseTime}ms`,
          duration: Math.max(1, Date.now() - startTime),
          details: { responseTime, threshold: maxResponseTime }
        };
      }

      return {
        name: 'response_time',
        status: 'passed',
        message: `Response time ${responseTime}ms within threshold`,
        duration: Math.max(1, Date.now() - startTime),
        details: { responseTime, threshold: maxResponseTime }
      };
    } catch (error) {
      return {
        name: 'response_time',
        status: 'failed',
        message: `Response time check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Math.max(1, Date.now() - startTime),
        details: { error }
      };
    }
  }

  /**
   * Setup event logging for contract events
   */
  private setupEventLogging(): void {
    if (!this.contract) {
      return;
    }

    // Listen for DiamondCut events
    this.contract.on('DiamondCut', (...args) => {
      const event = args[args.length - 1] as EventLog;
      this.logger.info('DiamondCut event detected', { event });
      
      // Notify all listeners
      this.eventListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          this.logger.error('Event listener error', { error });
        }
      });
    });

    this.logger.debug('Event logging setup completed');
  }
}
