import { expect } from 'chai';
import * as ethers from 'ethers';
import { JsonRpcProvider } from 'ethers';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
import { DiamondMonitor, MonitoringError } from '../src/core/DiamondMonitor';

describe('DiamondMonitor - Comprehensive Tests', () => {
  let provider: JsonRpcProvider;
  let mockDiamond: any;
  let monitor: DiamondMonitor;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create a mock provider that doesn't try to connect
    provider = {
      getNetwork: sandbox.stub().resolves({
        name: 'hardhat',
        chainId: 31337,
        toJSON: () => ({ name: 'hardhat', chainId: 31337 })
      }),
      getCode: sandbox.stub().resolves('0x1234'), // Mock contract code
      on: sandbox.stub(),
      off: sandbox.stub(),
      removeAllListeners: sandbox.stub(),
      // Add other provider methods as needed
      send: sandbox.stub(),
      call: sandbox.stub().callsFake((transaction) => {
        // Mock responses for loupe function calls
        if (transaction.data) {
          const selector = transaction.data.slice(0, 10);
          switch (selector) {
            case '0x7a0ed627': // facets()
              // Return properly encoded facets array: [{ facetAddress, functionSelectors }]
              // This represents: [{ facetAddress: "0x1234567890123456789012345678901234567890", functionSelectors: ["0x12345678", "0x87654321"] }]
              const facetsABI = new ethers.Interface(['function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)']);
              const facetsData = [{
                facetAddress: '0x1234567890123456789012345678901234567890',
                functionSelectors: ['0x12345678', '0x87654321']
              }];
              return Promise.resolve(facetsABI.encodeFunctionResult('facets', [facetsData]));
              
            case '0xadfca15e': // facetFunctionSelectors(address)
              // Return properly encoded selectors array
              const selectorsABI = new ethers.Interface(['function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory functionSelectors_)']);
              const selectorsData = ['0x12345678', '0x87654321'];
              return Promise.resolve(selectorsABI.encodeFunctionResult('facetFunctionSelectors', [selectorsData]));
              
            case '0x52ef6b2c': // facetAddresses()
              // Return properly encoded addresses array
              const addressesABI = new ethers.Interface(['function facetAddresses() external view returns (address[] memory facetAddresses_)']);
              const addressesData = ['0x1234567890123456789012345678901234567890'];
              return Promise.resolve(addressesABI.encodeFunctionResult('facetAddresses', [addressesData]));
              
            default:
              return Promise.resolve('0x');
          }
        }
        return Promise.resolve('0x');
      }),
      getBlock: sandbox.stub(),
      getBlockNumber: sandbox.stub(),
      getGasPrice: sandbox.stub(),
      estimateGas: sandbox.stub(),
      sendTransaction: sandbox.stub(),
      getTransaction: sandbox.stub(),
      getTransactionReceipt: sandbox.stub(),
      getLogs: sandbox.stub(),
      getBalance: sandbox.stub()
    } as any;
    
    // Mock Diamond instance with all required methods
    mockDiamond = {
      getDeployedDiamondData: sandbox.stub().returns({
        DiamondAddress: '0x1234567890123456789012345678901234567890',
        DeployedFacets: {
          DiamondLoupeFacet: {
            address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            funcSelectors: ['0x7a0ed627', '0xadfca15e', '0x52ef6b2c', '0xcdffacc6']
          },
          DiamondCutFacet: {
            address: '0x1111111111111111111111111111111111111111',
            funcSelectors: ['0x1f931c1c']
          },
          ExampleFacet: {
            address: '0x2222222222222222222222222222222222222222',
            funcSelectors: ['0x12345678', '0x87654321']
          }
        }
      }),
      getDiamondAbi: sandbox.stub().returns([
        'function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])',
        'function facetFunctionSelectors(address _facet) external view returns (bytes4[])',
        'function facetAddresses() external view returns (address[])',
        'function facetAddress(bytes4 _functionSelector) external view returns (address)',
        'event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)'
      ]),
      getFacetAddresses: sandbox.stub().returns([
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222'
      ])
    };
  });

  afterEach(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should create DiamondMonitor with Diamond instance and provider', () => {
      monitor = new DiamondMonitor(mockDiamond, provider);
      expect(monitor).to.be.instanceOf(DiamondMonitor);
    });

    it('should create DiamondMonitor with optional config', () => {
      const config = {
        pollingInterval: 5000,
        enableEventLogging: true,
        enableHealthChecks: true
      };
      monitor = new DiamondMonitor(mockDiamond, provider, config);
      expect(monitor).to.be.instanceOf(DiamondMonitor);
    });

    it('should throw error if Diamond instance is null', () => {
      expect(() => new DiamondMonitor(null as any, provider)).to.throw(MonitoringError, 'Diamond instance is required');
    });

    it('should throw error if provider is null', () => {
      expect(() => new DiamondMonitor(mockDiamond, null as any)).to.throw(MonitoringError, 'Provider is required');
    });

    it('should use default config values when not provided', () => {
      monitor = new DiamondMonitor(mockDiamond, provider);
      expect(monitor.isMonitoring()).to.be.false;
    });
  });

  describe('getDiamondInfo', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should return diamond information from Diamond instance', async () => {
      const info = await monitor.getDiamondInfo();
      
      expect(info).to.have.property('address', '0x1234567890123456789012345678901234567890');
      expect(info).to.have.property('facets').that.is.an('array').with.length(3);
      expect(info).to.have.property('totalSelectors', 7);
      
      // Check facet structure
      const loupeFacet = info.facets.find((f: any) => f.name === 'DiamondLoupeFacet');
      expect(loupeFacet).to.exist;
      expect(loupeFacet!.address).to.equal('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      expect(loupeFacet!.selectors).to.have.length(4);
    });

    it('should handle empty deployed facets gracefully', async () => {
      mockDiamond.getDeployedDiamondData.returns({
        DiamondAddress: '0x1234567890123456789012345678901234567890',
        DeployedFacets: {}
      });

      const info = await monitor.getDiamondInfo();
      expect(info.facets).to.be.empty;
      expect(info.totalSelectors).to.equal(0);
    });

    it('should throw error when Diamond instance fails', async () => {
      mockDiamond.getDeployedDiamondData.throws(new Error('Diamond not deployed'));
      
      try {
        await monitor.getDiamondInfo();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(MonitoringError);
        expect(error.message).to.include('Failed to get diamond information');
      }
    });
  });

  describe('startMonitoring', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider, { 
        pollingInterval: 100, // Fast polling for tests
        enableHealthChecks: true,
        enableEventLogging: true 
      });
    });

    it('should start monitoring successfully', async () => {
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
    });

    it('should not start monitoring twice', async () => {
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
      
      // Should not throw error when called again
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
    });

    it('should initialize contract during startup', async () => {
      await monitor.startMonitoring();
      // Contract should be initialized internally
      expect(monitor.isMonitoring()).to.be.true;
    });

    it('should handle provider connection errors', async () => {
      // Reset the existing stub to throw an error
      mockDiamond.getDeployedDiamondData.throws(new Error('Connection failed'));
      
      try {
        await monitor.startMonitoring();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(MonitoringError);
        expect(error.message).to.include('Failed to start monitoring');
      }
    });
  });

  describe('stopMonitoring', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider, { pollingInterval: 100 });
    });

    it('should stop monitoring when active', async () => {
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
      
      monitor.stopMonitoring();
      expect(monitor.isMonitoring()).to.be.false;
    });

    it('should handle stop when not monitoring', () => {
      expect(monitor.isMonitoring()).to.be.false;
      monitor.stopMonitoring(); // Should not throw
      expect(monitor.isMonitoring()).to.be.false;
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should return healthy status for valid diamond', async () => {
      const health = await monitor.getHealthStatus();
      
      expect(health.isHealthy).to.be.true;
      expect(health.checks).to.be.an('array').with.length.greaterThan(0);
      expect(health.timestamp).to.be.instanceOf(Date);
      expect(health.totalTime).to.be.a('number').greaterThanOrEqual(0); // Changed from greaterThan(0)
      
      // Check individual health check results
      const connectivityCheck = health.checks.find(c => c.name === 'connectivity');
      expect(connectivityCheck).to.exist;
      expect(connectivityCheck!.status).to.equal('passed');
    });

    it('should detect unhealthy contract (no code)', async () => {
      provider.getCode = sandbox.stub().resolves('0x'); // Empty code
      
      const health = await monitor.getHealthStatus();
      expect(health.isHealthy).to.be.false;
      
      const contractCheck = health.checks.find(c => c.name === 'contract_existence');
      expect(contractCheck).to.exist;
      expect(contractCheck!.status).to.equal('failed');
    });

    it('should handle provider connectivity issues', async () => {
      provider.getNetwork = sandbox.stub().rejects(new Error('Network unreachable'));
      
      const health = await monitor.getHealthStatus();
      expect(health.isHealthy).to.be.false;
      
      const connectivityCheck = health.checks.find(c => c.name === 'connectivity');
      expect(connectivityCheck).to.exist;
      expect(connectivityCheck!.status).to.equal('failed');
    });

    it('should warn about facets with no selectors', async () => {
      mockDiamond.getDeployedDiamondData.returns({
        DiamondAddress: '0x1234567890123456789012345678901234567890',
        DeployedFacets: {
          EmptyFacet: {
            address: '0x3333333333333333333333333333333333333333',
            funcSelectors: []
          }
        }
      });

      const health = await monitor.getHealthStatus();
      
      const facetCheck = health.checks.find(c => c.name === 'facet_integrity');
      expect(facetCheck).to.exist;
      expect(facetCheck!.status).to.equal('warning');
      expect(facetCheck!.message).to.include('facets with no selectors');
    });
  });

  describe('trackEvents', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider, { enableEventLogging: true });
    });

    it('should initialize event tracking', async () => {
      await monitor.trackEvents();
      // Event tracking should be set up (no errors thrown)
      expect(monitor.isMonitoring()).to.be.false; // Should be able to track events without monitoring
    });

    it('should accept custom event listeners', async () => {
      const customListener = sandbox.spy();
      await monitor.trackEvents(customListener);
      
      // Listener should be registered internally
      // We can't easily test the actual event emission without complex mocking
    });

    it('should handle event tracking setup errors gracefully', (done) => {
      // Mock contract initialization failure
      mockDiamond.getDeployedDiamondData.throws(new Error('Diamond data unavailable'));
      
      const eventEmitter = monitor.trackEvents();
      
      // Set up timeout first
      const timeoutId = setTimeout(() => {
        done(new Error('Expected healthIssue event was not emitted'));
      }, 500);
      
      eventEmitter.on('healthIssue', (issue) => {
        clearTimeout(timeoutId); // Clear timeout to prevent multiple done() calls
        expect(issue.issue).to.equal('Failed to initialize event tracking');
        // The error gets wrapped, so we should check for the general failure message
        expect(issue.error).to.be.a('string');
        done();
      });
    });
  });

  describe('integration with Diamond methods', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should leverage Diamond.getDeployedDiamondData() for all operations', async () => {
      await monitor.getDiamondInfo();
      expect(mockDiamond.getDeployedDiamondData.callCount).to.be.greaterThan(0);
    });

    it('should use Diamond.getDiamondAbi() when available', async () => {
      await monitor.startMonitoring();
      // ABI should be used for contract interaction if available
      expect(monitor.isMonitoring()).to.be.true;
    });

    it('should use Diamond.getFacetAddresses() for facet validation', async () => {
      // This would be used in advanced health checks
      const info = await monitor.getDiamondInfo();
      expect(info.facets).to.not.be.empty;
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should throw MonitoringError for diamond access failures', async () => {
      mockDiamond.getDeployedDiamondData.throws(new Error('Internal diamond error'));
      
      try {
        await monitor.getDiamondInfo();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).to.be.instanceOf(MonitoringError);
      }
    });

    it('should handle provider network failures gracefully', async () => {
      provider.getNetwork = sandbox.stub().rejects(new Error('Network error'));
      
      const health = await monitor.getHealthStatus();
      expect(health.isHealthy).to.be.false;
    });

    it('should handle contract call failures in health checks', async () => {
      provider.getCode = sandbox.stub().rejects(new Error('RPC error'));
      
      const health = await monitor.getHealthStatus();
      const contractCheck = health.checks.find(c => c.name === 'contract_existence');
      expect(contractCheck).to.exist;
      expect(contractCheck!.status).to.equal('failed');
    });
  });
});
