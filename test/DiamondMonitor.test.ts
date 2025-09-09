import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { DiamondMonitor } from '../src/core/DiamondMonitor';
import { Diamond } from 'diamonds';
import { JsonRpcProvider } from 'ethers';

describe('DiamondMonitor', () => {
  let provider: JsonRpcProvider;
  let mockDiamond: any;
  let monitor: DiamondMonitor;

  beforeEach(() => {
    // Mock provider
    provider = new JsonRpcProvider('http://localhost:8545');
    
    // Mock Diamond instance
    mockDiamond = {
      getDeployedDiamondData: () => ({
        DiamondAddress: '0x1234567890123456789012345678901234567890',
        DeployedFacets: {
          ExampleFacet: {
            address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            funcSelectors: ['0x12345678', '0x87654321']
          }
        }
      }),
      getDiamondAbiPath: () => '/path/to/abi'
    };
  });

  afterEach(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
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
      expect(() => new DiamondMonitor(null as any, provider)).to.throw('Diamond instance is required');
    });

    it('should throw error if provider is null', () => {
      expect(() => new DiamondMonitor(mockDiamond, null as any)).to.throw('Provider is required');
    });
  });

  describe('getDiamondInfo', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should return diamond information from Diamond instance', async () => {
      const info = await monitor.getDiamondInfo();
      
      expect(info).to.have.property('address', '0x1234567890123456789012345678901234567890');
      expect(info).to.have.property('facets');
      expect(info.facets).to.have.length(1);
      expect(info.facets[0]).to.have.property('address', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      expect(info.facets[0].selectors).to.have.length(2);
    });
  });

  describe('startMonitoring', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should start monitoring without errors', async () => {
      try {
        await monitor.startMonitoring();
        expect(monitor.isMonitoring()).to.be.true;
      } catch (error) {
        throw new Error(`startMonitoring should not throw: ${error}`);
      }
    });

    it('should not start monitoring if already monitoring', async () => {
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
      
      // Starting again should not cause issues
      try {
        await monitor.startMonitoring();
      } catch (error) {
        throw new Error(`startMonitoring should not throw: ${error}`);
      }
    });
  });

  describe('stopMonitoring', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should stop monitoring', async () => {
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
      
      monitor.stopMonitoring();
      expect(monitor.isMonitoring()).to.be.false;
    });

    it('should be safe to call stopMonitoring when not monitoring', () => {
      expect(() => monitor.stopMonitoring()).to.not.throw;
      expect(monitor.isMonitoring()).to.be.false;
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should return health status with isHealthy property', async () => {
      const health = await monitor.getHealthStatus();
      
      expect(health).to.have.property('isHealthy');
      expect(health).to.have.property('checks');
      expect(health.checks).to.be.an('array');
    });

    it('should include basic connectivity check', async () => {
      const health = await monitor.getHealthStatus();
      
      const connectivityCheck = health.checks.find((check: any) => check.name === 'connectivity');
      expect(connectivityCheck).to.exist;
    });
  });

  describe('trackEvents', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should setup event tracking without errors', async () => {
      try {
        await monitor.trackEvents();
      } catch (error) {
        throw new Error(`trackEvents should not throw: ${error}`);
      }
    });

    it('should allow custom event listeners', async () => {
      let eventReceived = false;
      
      await monitor.trackEvents((event: any) => {
        eventReceived = true;
      });
      
      // Mock event emission would be tested in integration tests
      expect(eventReceived).to.be.false; // No events in unit test
    });
  });
});
