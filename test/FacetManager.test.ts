import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { FacetManager } from '../src/core/FacetManager';
import { Diamond } from 'diamonds';
import { JsonRpcProvider } from 'ethers';

describe('FacetManager', () => {
  let provider: JsonRpcProvider;
  let mockDiamond: any;
  let facetManager: FacetManager;

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
          },
          OwnershipFacet: {
            address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            funcSelectors: ['0x11111111', '0x22222222']
          }
        }
      })
    };

    facetManager = new FacetManager(mockDiamond, provider);
  });

  describe('constructor', () => {
    it('should create FacetManager with Diamond instance and provider', () => {
      expect(facetManager).to.be.instanceOf(FacetManager);
    });

    it('should throw error if Diamond instance is null', () => {
      expect(() => new FacetManager(null as any, provider)).to.throw('Diamond instance is required');
    });

    it('should throw error if provider is null', () => {
      expect(() => new FacetManager(mockDiamond, null as any)).to.throw('Provider is required');
    });
  });

  describe('listFacets', () => {
    it('should return list of facets from Diamond instance', async () => {
      const facets = await facetManager.listFacets();
      
      expect(facets).to.have.length(2);
      expect(facets[0]).to.have.property('name', 'ExampleFacet');
      expect(facets[0]).to.have.property('address', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      expect(facets[0].selectors).to.have.length(2);
      
      expect(facets[1]).to.have.property('name', 'OwnershipFacet');
      expect(facets[1]).to.have.property('address', '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
      expect(facets[1].selectors).to.have.length(2);
    });
  });

  describe('getSelectorsForFacet', () => {
    it('should return selectors for a specific facet by name', async () => {
      const selectors = await facetManager.getSelectorsForFacet('ExampleFacet');
      
      expect(selectors).to.have.length(2);
      expect(selectors).to.include('0x12345678');
      expect(selectors).to.include('0x87654321');
    });

    it('should return selectors for a specific facet by address', async () => {
      const selectors = await facetManager.getSelectorsForFacet('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      
      expect(selectors).to.have.length(2);
      expect(selectors).to.include('0x12345678');
      expect(selectors).to.include('0x87654321');
    });

    it('should return empty array for non-existent facet', async () => {
      const selectors = await facetManager.getSelectorsForFacet('NonExistentFacet');
      
      expect(selectors).to.have.length(0);
    });
  });

  describe('validateSelectors', () => {
    it('should validate no conflicts in current deployment', async () => {
      const result = await facetManager.validateSelectors();
      
      expect(result).to.have.property('isValid', true);
      expect(result).to.have.property('conflicts');
      expect(result.conflicts).to.have.length(0);
    });

    it('should detect conflicts when provided with conflicting selectors', async () => {
      const newSelectors = ['0x12345678']; // Conflicts with ExampleFacet
      const result = await facetManager.validateSelectors(newSelectors);
      
      expect(result).to.have.property('isValid', false);
      expect(result.conflicts).to.have.length(1);
      expect(result.conflicts[0]).to.have.property('selector', '0x12345678');
      expect(result.conflicts[0]).to.have.property('existingFacet', 'ExampleFacet');
    });
  });

  describe('analyzeFacets', () => {
    it('should analyze facets and return statistics', async () => {
      const facets = await facetManager.listFacets();
      const analysis = await facetManager.analyzeFacets(facets);
      
      expect(analysis).to.have.property('totalFacets', 2);
      expect(analysis).to.have.property('totalSelectors', 4);
      expect(analysis).to.have.property('averageSelectorsPerFacet', 2);
      expect(analysis).to.have.property('conflicts');
      expect(analysis.conflicts).to.have.length(0);
    });

    it('should detect overlapping selectors between facets', async () => {
      // Create facets with overlapping selectors
      const facetsWithConflicts = [
        {
          name: 'Facet1',
          address: '0x1111111111111111111111111111111111111111',
          selectors: ['0x12345678', '0xabcdefab']
        },
        {
          name: 'Facet2', 
          address: '0x2222222222222222222222222222222222222222',
          selectors: ['0x12345678', '0xdeadbeef'] // 0x12345678 conflicts
        }
      ];
      
      const analysis = await facetManager.analyzeFacets(facetsWithConflicts);
      
      expect(analysis).to.have.property('totalFacets', 2);
      expect(analysis).to.have.property('totalSelectors', 3); // Unique selectors
      expect(analysis.conflicts).to.have.length(1);
      expect(analysis.conflicts[0]).to.have.property('selector', '0x12345678');
    });
  });

  describe('createAddFacetCut', () => {
    it('should create a valid add facet cut', () => {
      const facetAddress = '0x1111111111111111111111111111111111111111';
      const selectors = ['0xabcdefab', '0xdeadbeef'];
      
      const cut = facetManager.createAddFacetCut(facetAddress, selectors);
      
      expect(cut).to.have.property('facetAddress', facetAddress);
      expect(cut).to.have.property('action', 0); // FacetCutAction.Add
      expect(cut).to.have.property('functionSelectors');
      expect(cut.functionSelectors).to.have.length(2);
      expect(cut.functionSelectors).to.include('0xabcdefab');
      expect(cut.functionSelectors).to.include('0xdeadbeef');
    });
  });

  describe('createReplaceFacetCut', () => {
    it('should create a valid replace facet cut', () => {
      const facetAddress = '0x1111111111111111111111111111111111111111';
      const selectors = ['0xabcdefab', '0xdeadbeef'];
      
      const cut = facetManager.createReplaceFacetCut(facetAddress, selectors);
      
      expect(cut).to.have.property('facetAddress', facetAddress);
      expect(cut).to.have.property('action', 1); // FacetCutAction.Replace
      expect(cut).to.have.property('functionSelectors');
      expect(cut.functionSelectors).to.have.length(2);
    });
  });

  describe('createRemoveFacetCut', () => {
    it('should create a valid remove facet cut', () => {
      const selectors = ['0xabcdefab', '0xdeadbeef'];
      
      const cut = facetManager.createRemoveFacetCut(selectors);
      
      expect(cut).to.have.property('facetAddress', '0x0000000000000000000000000000000000000000');
      expect(cut).to.have.property('action', 2); // FacetCutAction.Remove
      expect(cut).to.have.property('functionSelectors');
      expect(cut.functionSelectors).to.have.length(2);
    });
  });

  describe('validateDiamondCut', () => {
    it('should validate a valid diamond cut', async () => {
      const currentFacets = await facetManager.listFacets();
      const cuts = [
        facetManager.createAddFacetCut(
          '0x1111111111111111111111111111111111111111',
          ['0xabcdefab', '0xdeadbeef']
        )
      ];
      
      const result = await facetManager.validateDiamondCut(cuts, currentFacets);
      
      expect(result).to.have.property('isValid', true);
      expect(result).to.have.property('errors');
      expect(result.errors).to.have.length(0);
    });

    it('should detect conflicts in diamond cut', async () => {
      const currentFacets = await facetManager.listFacets();
      const cuts = [
        facetManager.createAddFacetCut(
          '0x1111111111111111111111111111111111111111',
          ['0x12345678'] // Conflicts with existing selector
        )
      ];
      
      const result = await facetManager.validateDiamondCut(cuts, currentFacets);
      
      expect(result).to.have.property('isValid', false);
      expect(result.errors).to.have.length(1);
      expect(result.errors[0]).to.include('Selector 0x12345678 already exists');
    });
  });
});
