import { Provider, Contract, EventLog } from 'ethers';
import { Diamond } from 'diamonds';
import winston from 'winston';

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
      fromBlock: config.fromBlock ?? 'latest'
    };

    this.logger = this.config.logger;
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
      // For now, we'll use a basic Diamond ABI - this can be enhanced later
      const basicAbi = [
        'event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)',
        'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
        'function facetFunctionSelectors(address _facet) external view returns (bytes4[])',
        'function facetAddresses() external view returns (address[])',
        'function facetAddress(bytes4 _functionSelector) external view returns (address)'
      ];
      
      this.contract = new Contract(diamondAddress, basicAbi, this.provider);
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

    return {
      isHealthy,
      checks,
      timestamp: new Date(),
      totalTime
    };
  }

  /**
   * Set up event tracking for diamond contract events
   * 
   * @param listener - Optional custom event listener
   * @returns Promise that resolves when event tracking is set up
   */
  public async trackEvents(listener?: EventListener): Promise<void> {
    if (!this.contract) {
      await this.initializeContract();
    }

    if (listener) {
      this.eventListeners.push(listener);
    }

    if (this.config.enableEventLogging) {
      this.setupEventLogging();
    }

    this.logger.info('Event tracking initialized');
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
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'connectivity',
        status: 'failed',
        message: `Provider connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
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
          duration: Date.now() - startTime,
          details: { address: diamondAddress }
        };
      }

      return {
        name: 'contract_existence',
        status: 'passed',
        message: 'Diamond contract exists and has code',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'contract_existence',
        status: 'failed',
        message: `Contract check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
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
          duration: Date.now() - startTime
        };
      }

      // Check for empty selectors
      const emptyFacets = info.facets.filter(facet => facet.selectors.length === 0);
      if (emptyFacets.length > 0) {
        return {
          name: 'facet_integrity',
          status: 'warning',
          message: `Found ${emptyFacets.length} facets with no selectors`,
          duration: Date.now() - startTime,
          details: { emptyFacets }
        };
      }

      return {
        name: 'facet_integrity',
        status: 'passed',
        message: `All ${info.facets.length} facets have selectors`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'facet_integrity',
        status: 'failed',
        message: `Facet integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
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
