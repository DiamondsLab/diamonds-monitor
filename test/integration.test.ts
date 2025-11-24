import { expect } from 'chai';
import { Provider } from 'ethers';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { DiamondMonitor, FacetManager } from '../src/standalone';
import { MockProvider } from './helpers/MockProvider';

describe('Integration Tests - Standalone API', () => {
  let provider: Provider;
  let mockDiamond: any;
  let monitor: DiamondMonitor;
  let facetManager: FacetManager;

  beforeEach(() => {
    // Use mock provider instead of real JsonRpcProvider
    provider = new MockProvider() as any as Provider;
    
    // Mock Diamond instance with more comprehensive data
    mockDiamond = {
      getDeployedDiamondData: () => ({
        DiamondAddress: '0x1234567890123456789012345678901234567890',
        DeployedFacets: {
          DiamondCutFacet: {
            address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            funcSelectors: ['0x1f931c1c'] // diamondCut selector
          },
          DiamondLoupeFacet: {
            address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            funcSelectors: ['0x7a0ed627', '0xadfca15e', '0x52ef6b2c', '0xcdffacc6']
          },
          OwnershipFacet: {
            address: '0x1111111111111111111111111111111111111111',
            funcSelectors: ['0x8da5cb5b', '0xf2fde38b']
          }
        }
      })
    };

    monitor = new DiamondMonitor(mockDiamond, provider, {
      pollingInterval: 5000,
      enableEventLogging: true,
      enableHealthChecks: false // Disable for testing
    });

    facetManager = new FacetManager(mockDiamond, provider);
  });

  afterEach(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
  });

  describe('End-to-End Diamond Monitoring Workflow', () => {
    it('should provide complete diamond monitoring capabilities', async () => {
      // 1. Get diamond information
      const diamondInfo = await monitor.getDiamondInfo();
      
      expect(diamondInfo.address).to.equal('0x1234567890123456789012345678901234567890');
      expect(diamondInfo.facets).to.have.length(3);
      expect(diamondInfo.totalSelectors).to.equal(7);

      // 2. List facets using FacetManager
      const facets = await facetManager.listFacets();
      
      expect(facets).to.have.length(3);
      const facetNames = facets.map(f => f.name);
      expect(facetNames).to.include('DiamondCutFacet');
      expect(facetNames).to.include('DiamondLoupeFacet');
      expect(facetNames).to.include('OwnershipFacet');

      // 3. Analyze facets
      const analysis = await facetManager.analyzeFacets(facets);
      
      expect(analysis.totalFacets).to.equal(3);
      expect(analysis.totalSelectors).to.equal(7);
      expect(analysis.averageSelectorsPerFacet).to.be.approximately(2.33, 0.1);
      expect(analysis.conflicts).to.have.length(0);
      expect(analysis.details.largestFacet?.name).to.equal('DiamondLoupeFacet');
      expect(analysis.details.largestFacet?.selectorCount).to.equal(4);

      // 4. Validate current selectors
      const validation = await facetManager.validateSelectors();
      
      expect(validation.isValid).to.be.true;
      expect(validation.conflicts).to.have.length(0);

      // 5. Test selector conflicts
      const conflictValidation = await facetManager.validateSelectors(['0x1f931c1c']); // Conflicts with DiamondCutFacet
      
      expect(conflictValidation.isValid).to.be.false;
      expect(conflictValidation.conflicts).to.have.length(1);
      expect(conflictValidation.conflicts[0].selector).to.equal('0x1f931c1c');
      expect(conflictValidation.conflicts[0].existingFacet).to.equal('DiamondCutFacet');

      // 6. Create and validate diamond cuts
      const newFacetAddress = '0x2222222222222222222222222222222222222222';
      const newSelectors = ['0x12345678', '0x87654321'];
      
      const addCut = facetManager.createAddFacetCut(newFacetAddress, newSelectors);
      const cutValidation = await facetManager.validateDiamondCut([addCut], facets);
      
      expect(cutValidation.isValid).to.be.true;
      expect(cutValidation.errors).to.have.length(0);
      expect(cutValidation.summary.addedSelectors).to.equal(2);

      // 7. Test invalid diamond cut
      const conflictingCut = facetManager.createAddFacetCut(newFacetAddress, ['0x1f931c1c']); // Conflicts
      const invalidCutValidation = await facetManager.validateDiamondCut([conflictingCut], facets);
      
      expect(invalidCutValidation.isValid).to.be.false;
      expect(invalidCutValidation.errors).to.have.length(1);
      expect(invalidCutValidation.errors[0]).to.include('Selector 0x1f931c1c already exists');

      // 8. Start and stop monitoring
      await monitor.startMonitoring();
      expect(monitor.isMonitoring()).to.be.true;
      
      monitor.stopMonitoring();
      expect(monitor.isMonitoring()).to.be.false;
    });

    it('should handle all types of diamond cuts', async () => {
      const facets = await facetManager.listFacets();
      const newFacetAddress = '0x3333333333333333333333333333333333333333';
      
      // Test Add cut
      const addCut = facetManager.createAddFacetCut(newFacetAddress, ['0xaaaaaaaa', '0xbbbbbbbb']);
      expect(addCut.action).to.equal(0); // FacetCutAction.Add
      expect(addCut.facetAddress).to.equal(newFacetAddress);
      expect(addCut.functionSelectors).to.have.length(2);

      // Test Replace cut
      const replaceCut = facetManager.createReplaceFacetCut(newFacetAddress, ['0x1f931c1c']);
      expect(replaceCut.action).to.equal(1); // FacetCutAction.Replace
      
      // Test Remove cut
      const removeCut = facetManager.createRemoveFacetCut(['0x1f931c1c']);
      expect(removeCut.action).to.equal(2); // FacetCutAction.Remove
      expect(removeCut.facetAddress).to.equal('0x0000000000000000000000000000000000000000');

      // Validate all cuts
      const cuts = [addCut, replaceCut, removeCut];
      const validation = await facetManager.validateDiamondCut(cuts, facets);
      
      expect(validation.summary.addedSelectors).to.equal(2);
      expect(validation.summary.replacedSelectors).to.equal(1);
      expect(validation.summary.removedSelectors).to.equal(1);
    });

    it('should provide comprehensive health checks', async () => {
      const health = await monitor.getHealthStatus();
      
      expect(health).to.have.property('isHealthy');
      expect(health).to.have.property('checks');
      expect(health).to.have.property('timestamp');
      expect(health).to.have.property('totalTime');
      
      expect(health.checks).to.be.an('array');
      expect(health.checks.length).to.be.greaterThan(0);
      
      // Check for required health checks
      const checkNames = health.checks.map((check: any) => check.name);
      expect(checkNames).to.include('connectivity');
      expect(checkNames).to.include('contract_existence');
      expect(checkNames).to.include('facet_integrity');
    });

    it('should support event tracking setup', async () => {
      let eventCallbackCalled = false;
      
      await monitor.trackEvents((event: any) => {
        eventCallbackCalled = true;
      });
      
      // Event callback should be registered but not called in unit tests
      expect(eventCallbackCalled).to.be.false;
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Diamond instances gracefully', () => {
      expect(() => new DiamondMonitor(null as any, provider)).to.throw('Diamond instance is required');
      expect(() => new FacetManager(null as any, provider)).to.throw('Diamond instance is required');
    });

    it('should handle invalid provider gracefully', () => {
      expect(() => new DiamondMonitor(mockDiamond, null as any)).to.throw('Provider is required');
      expect(() => new FacetManager(mockDiamond, null as any)).to.throw('Provider is required');
    });

    it('should handle non-existent facets gracefully', async () => {
      const selectors = await facetManager.getSelectorsForFacet('NonExistentFacet');
      expect(selectors).to.have.length(0);
      
      const selectorsByAddress = await facetManager.getSelectorsForFacet('0x0000000000000000000000000000000000000000');
      expect(selectorsByAddress).to.have.length(0);
    });
  });

  describe('Utility Functions Integration', () => {
    it('should work with utility functions from the package', async () => {
      // This test would import and use utility functions
      // For now, we'll just verify the main classes work as expected
      const facets = await facetManager.listFacets();
      const diamondInfo = await monitor.getDiamondInfo();
      
      expect(facets.length).to.equal(diamondInfo.facets.length);
      
      // Verify facet information matches
      for (const facet of facets) {
        const matchingDiamondFacet = diamondInfo.facets.find(f => f.address === facet.address);
        expect(matchingDiamondFacet).to.exist;
        expect(matchingDiamondFacet!.selectors).to.deep.equal(facet.selectors);
      }
    });
  });
});
