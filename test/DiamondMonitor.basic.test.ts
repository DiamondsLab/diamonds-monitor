import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { DiamondMonitor } from '../src/core/DiamondMonitor';
import { Diamond } from 'diamonds';
import { JsonRpcProvider } from 'ethers';
import * as sinon from 'sinon';

describe('DiamondMonitor - Basic Tests', () => {
  let provider: any;
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
      getCode: sandbox.stub().resolves('0x1234'),
      on: sandbox.stub(),
      off: sandbox.stub(),
      removeAllListeners: sandbox.stub(),
      send: sandbox.stub(),
      call: sandbox.stub(),
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
    sandbox.restore();
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
  });

  describe('basic functionality', () => {
    beforeEach(() => {
      monitor = new DiamondMonitor(mockDiamond, provider);
    });

    it('should not be monitoring initially', () => {
      expect(monitor.isMonitoring()).to.be.false;
    });

    it('should get diamond info', async () => {
      const info = await monitor.getDiamondInfo();
      expect(info).to.have.property('address');
      expect(info).to.have.property('facets');
    });
  });
});
