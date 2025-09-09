import { Provider } from 'ethers';
import { Diamond } from 'diamonds';

/**
 * Facet information structure
 */
export interface FacetInfo {
  /** Facet name */
  name: string;
  /** Facet contract address */
  address: string;
  /** Function selectors handled by this facet */
  selectors: string[];
}

/**
 * Selector conflict information
 */
export interface SelectorConflict {
  /** The conflicting selector */
  selector: string;
  /** Name of the existing facet that has this selector */
  existingFacet: string;
  /** Address of the existing facet */
  existingFacetAddress: string;
}

/**
 * Selector validation result
 */
export interface SelectorValidationResult {
  /** Whether the selectors are valid (no conflicts) */
  isValid: boolean;
  /** Array of conflicts found */
  conflicts: SelectorConflict[];
  /** Additional validation messages */
  messages: string[];
}

/**
 * Facet analysis result
 */
export interface FacetAnalysisResult {
  /** Total number of facets */
  totalFacets: number;
  /** Total number of unique selectors */
  totalSelectors: number;
  /** Average selectors per facet */
  averageSelectorsPerFacet: number;
  /** Conflicts found during analysis */
  conflicts: SelectorConflict[];
  /** Additional analysis details */
  details: {
    /** Largest facet by selector count */
    largestFacet?: {
      name: string;
      selectorCount: number;
    };
    /** Smallest facet by selector count */
    smallestFacet?: {
      name: string;
      selectorCount: number;
    };
    /** Facets with no selectors */
    emptyFacets: string[];
  };
}

/**
 * Diamond cut action types
 */
export enum FacetCutAction {
  Add = 0,
  Replace = 1,
  Remove = 2
}

/**
 * Diamond cut structure
 */
export interface DiamondCut {
  /** Target facet address */
  facetAddress: string;
  /** Action to perform */
  action: FacetCutAction;
  /** Function selectors to operate on */
  functionSelectors: string[];
}

/**
 * Diamond cut validation result
 */
export interface DiamondCutValidationResult {
  /** Whether the cut is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Summary of changes */
  summary: {
    /** Number of selectors being added */
    addedSelectors: number;
    /** Number of selectors being replaced */
    replacedSelectors: number;
    /** Number of selectors being removed */
    removedSelectors: number;
  };
}

/**
 * FacetManager errors
 */
export class FacetManagerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'FacetManagerError';
  }
}

/**
 * FacetManager class for managing diamond facets
 * 
 * This class provides comprehensive facet management capabilities including:
 * - Listing and analyzing facets
 * - Validating function selectors
 * - Creating diamond cuts
 * - Validating diamond cuts before execution
 */
export class FacetManager {
  private readonly diamond: Diamond;
  private readonly provider: Provider;

  /**
   * Creates a new FacetManager instance
   * 
   * @param diamond - Diamond instance from the diamonds module
   * @param provider - Ethereum provider (ethers.js)
   */
  constructor(diamond: Diamond, provider: Provider) {
    if (!diamond) {
      throw new FacetManagerError('Diamond instance is required');
    }
    if (!provider) {
      throw new FacetManagerError('Provider is required');
    }

    this.diamond = diamond;
    this.provider = provider;
  }

  /**
   * List all facets in the diamond
   * 
   * @returns Promise resolving to array of facet information
   */
  public async listFacets(): Promise<FacetInfo[]> {
    try {
      const deployedData = this.diamond.getDeployedDiamondData();
      const facets: FacetInfo[] = [];

      if (deployedData?.DeployedFacets) {
        Object.entries(deployedData.DeployedFacets).forEach(([name, facetData]) => {
          if (facetData?.address && facetData?.funcSelectors) {
            facets.push({
              name,
              address: facetData.address,
              selectors: facetData.funcSelectors
            });
          }
        });
      }

      return facets;
    } catch (error) {
      throw new FacetManagerError('Failed to list facets', error as Error);
    }
  }

  /**
   * Get function selectors for a specific facet
   * 
   * @param facetIdentifier - Facet name or address
   * @returns Promise resolving to array of function selectors
   */
  public async getSelectorsForFacet(facetIdentifier: string): Promise<string[]> {
    try {
      const facets = await this.listFacets();
      
      // Search by name first, then by address
      const facet = facets.find(f => 
        f.name === facetIdentifier || 
        f.address.toLowerCase() === facetIdentifier.toLowerCase()
      );

      return facet ? facet.selectors : [];
    } catch (error) {
      throw new FacetManagerError(`Failed to get selectors for facet ${facetIdentifier}`, error as Error);
    }
  }

  /**
   * Validate function selectors for conflicts
   * 
   * @param newSelectors - Optional array of new selectors to validate against existing ones
   * @returns Promise resolving to validation result
   */
  public async validateSelectors(newSelectors?: string[]): Promise<SelectorValidationResult> {
    try {
      const facets = await this.listFacets();
      const conflicts: SelectorConflict[] = [];
      const messages: string[] = [];

      // Build map of existing selectors
      const existingSelectors = new Map<string, { facet: string; address: string }>();
      
      for (const facet of facets) {
        for (const selector of facet.selectors) {
          if (existingSelectors.has(selector)) {
            // Conflict within existing facets
            const existing = existingSelectors.get(selector)!;
            conflicts.push({
              selector,
              existingFacet: existing.facet,
              existingFacetAddress: existing.address
            });
          } else {
            existingSelectors.set(selector, {
              facet: facet.name,
              address: facet.address
            });
          }
        }
      }

      // Check new selectors against existing ones if provided
      if (newSelectors) {
        for (const selector of newSelectors) {
          if (existingSelectors.has(selector)) {
            const existing = existingSelectors.get(selector)!;
            conflicts.push({
              selector,
              existingFacet: existing.facet,
              existingFacetAddress: existing.address
            });
          }
        }
      }

      const isValid = conflicts.length === 0;
      
      if (!isValid) {
        messages.push(`Found ${conflicts.length} selector conflict(s)`);
      } else {
        messages.push('No selector conflicts detected');
      }

      return {
        isValid,
        conflicts,
        messages
      };
    } catch (error) {
      throw new FacetManagerError('Failed to validate selectors', error as Error);
    }
  }

  /**
   * Analyze facets for insights and potential issues
   * 
   * @param facets - Array of facets to analyze (defaults to current facets)
   * @returns Promise resolving to analysis result
   */
  public async analyzeFacets(facets?: FacetInfo[]): Promise<FacetAnalysisResult> {
    try {
      const facetsToAnalyze = facets || await this.listFacets();
      
      // Calculate basic statistics
      const totalFacets = facetsToAnalyze.length;
      const allSelectors = facetsToAnalyze.flatMap(f => f.selectors);
      const uniqueSelectors = new Set(allSelectors);
      const totalSelectors = uniqueSelectors.size;
      const averageSelectorsPerFacet = totalFacets > 0 ? Math.round((allSelectors.length / totalFacets) * 100) / 100 : 0;

      // Find conflicts
      const selectorMap = new Map<string, FacetInfo>();
      const conflicts: SelectorConflict[] = [];

      for (const facet of facetsToAnalyze) {
        for (const selector of facet.selectors) {
          if (selectorMap.has(selector)) {
            const existingFacet = selectorMap.get(selector)!;
            conflicts.push({
              selector,
              existingFacet: existingFacet.name,
              existingFacetAddress: existingFacet.address
            });
          } else {
            selectorMap.set(selector, facet);
          }
        }
      }

      // Find largest and smallest facets
      let largestFacet: { name: string; selectorCount: number } | undefined;
      let smallestFacet: { name: string; selectorCount: number } | undefined;
      const emptyFacets: string[] = [];

      for (const facet of facetsToAnalyze) {
        const selectorCount = facet.selectors.length;
        
        if (selectorCount === 0) {
          emptyFacets.push(facet.name);
        }

        if (!largestFacet || selectorCount > largestFacet.selectorCount) {
          largestFacet = { name: facet.name, selectorCount };
        }

        if (!smallestFacet || selectorCount < smallestFacet.selectorCount) {
          smallestFacet = { name: facet.name, selectorCount };
        }
      }

      return {
        totalFacets,
        totalSelectors,
        averageSelectorsPerFacet,
        conflicts,
        details: {
          largestFacet,
          smallestFacet,
          emptyFacets
        }
      };
    } catch (error) {
      throw new FacetManagerError('Failed to analyze facets', error as Error);
    }
  }

  /**
   * Create a diamond cut for adding a facet
   * 
   * @param facetAddress - Address of the facet to add
   * @param selectors - Function selectors to add
   * @returns Diamond cut structure
   */
  public createAddFacetCut(facetAddress: string, selectors: string[]): DiamondCut {
    return {
      facetAddress,
      action: FacetCutAction.Add,
      functionSelectors: [...selectors]
    };
  }

  /**
   * Create a diamond cut for replacing facet selectors
   * 
   * @param facetAddress - Address of the new facet
   * @param selectors - Function selectors to replace
   * @returns Diamond cut structure
   */
  public createReplaceFacetCut(facetAddress: string, selectors: string[]): DiamondCut {
    return {
      facetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: [...selectors]
    };
  }

  /**
   * Create a diamond cut for removing selectors
   * 
   * @param selectors - Function selectors to remove
   * @returns Diamond cut structure
   */
  public createRemoveFacetCut(selectors: string[]): DiamondCut {
    return {
      facetAddress: '0x0000000000000000000000000000000000000000',
      action: FacetCutAction.Remove,
      functionSelectors: [...selectors]
    };
  }

  /**
   * Validate a diamond cut before execution
   * 
   * @param cuts - Array of diamond cuts to validate
   * @param currentFacets - Current facets (defaults to current deployment)
   * @returns Promise resolving to validation result
   */
  public async validateDiamondCut(
    cuts: DiamondCut[], 
    currentFacets?: FacetInfo[]
  ): Promise<DiamondCutValidationResult> {
    try {
      const facets = currentFacets || await this.listFacets();
      const errors: string[] = [];
      const warnings: string[] = [];
      let addedSelectors = 0;
      let replacedSelectors = 0;
      let removedSelectors = 0;

      // Build current selector map
      const selectorMap = new Map<string, FacetInfo>();
      for (const facet of facets) {
        for (const selector of facet.selectors) {
          selectorMap.set(selector, facet);
        }
      }

      for (const cut of cuts) {
        const { facetAddress, action, functionSelectors } = cut;

        // Validate facet address format
        if (action !== FacetCutAction.Remove && !/^0x[a-fA-F0-9]{40}$/.test(facetAddress)) {
          errors.push(`Invalid facet address format: ${facetAddress}`);
        }

        // Validate selector format
        for (const selector of functionSelectors) {
          if (!/^0x[a-fA-F0-9]{8}$/.test(selector)) {
            errors.push(`Invalid selector format: ${selector}`);
          }
        }

        switch (action) {
          case FacetCutAction.Add:
            addedSelectors += functionSelectors.length;
            
            // Check for conflicts with existing selectors
            for (const selector of functionSelectors) {
              if (selectorMap.has(selector)) {
                const existingFacet = selectorMap.get(selector)!;
                errors.push(`Selector ${selector} already exists in facet ${existingFacet.name}`);
              }
            }
            break;

          case FacetCutAction.Replace:
            replacedSelectors += functionSelectors.length;
            
            // Check that selectors exist to replace
            for (const selector of functionSelectors) {
              if (!selectorMap.has(selector)) {
                warnings.push(`Selector ${selector} does not exist to replace`);
              }
            }
            break;

          case FacetCutAction.Remove:
            removedSelectors += functionSelectors.length;
            
            // Check that selectors exist to remove
            for (const selector of functionSelectors) {
              if (!selectorMap.has(selector)) {
                errors.push(`Selector ${selector} does not exist to remove`);
              }
            }
            
            // Validate zero address for remove action
            if (facetAddress !== '0x0000000000000000000000000000000000000000') {
              errors.push(`Remove action must use zero address, got: ${facetAddress}`);
            }
            break;

          default:
            errors.push(`Invalid cut action: ${action}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        summary: {
          addedSelectors,
          replacedSelectors,
          removedSelectors
        }
      };
    } catch (error) {
      throw new FacetManagerError('Failed to validate diamond cut', error as Error);
    }
  }
}
