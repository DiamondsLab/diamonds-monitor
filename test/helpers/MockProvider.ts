/**
 * Mock Provider for testing that doesn't try to connect to any network
 */
import { EventEmitter } from 'events';
import { TransactionRequest, AbiCoder, Provider, ProviderEvent, Listener } from 'ethers';

export class MockProvider implements Provider {
  private eventEmitter = new EventEmitter();
  private networkPromise: Promise<any>;
  private mockResponses: Map<string, any> = new Map();
  private delay = 0;

  constructor() {
    // Create a resolved promise for network detection
    this.networkPromise = Promise.resolve({
      name: 'hardhat',
      chainId: 31337,
      ensAddress: null
    });
  }

  // Implement Provider event handling interface
  async on(event: ProviderEvent, listener: Listener): Promise<this> {
    this.eventEmitter.on(event as string, listener);
    return this;
  }

  async off(event: ProviderEvent, listener?: Listener): Promise<this> {
    if (listener) {
      this.eventEmitter.off(event as string, listener);
    } else {
      this.eventEmitter.removeAllListeners(event as string);
    }
    return this;
  }

  async removeAllListeners(event?: ProviderEvent): Promise<this> {
    this.eventEmitter.removeAllListeners(event as string);
    return this;
  }

  async once(event: ProviderEvent, listener: Listener): Promise<this> {
    this.eventEmitter.once(event as string, listener);
    return this;
  }

  async listenerCount(event?: ProviderEvent): Promise<number> {
    return this.eventEmitter.listenerCount(event as string);
  }

  async listeners(event?: ProviderEvent): Promise<Array<Listener>> {
    return this.eventEmitter.listeners(event as string) as Array<Listener>;
  }

  // Add missing Provider interface methods
  async addListener(event: ProviderEvent, listener: Listener): Promise<this> {
    return this.on(event, listener);
  }

  async removeListener(event: ProviderEvent, listener: Listener): Promise<this> {
    return this.off(event, listener);
  }

  // Implement Provider emit interface
  async emit(event: ProviderEvent, ...args: any[]): Promise<boolean> {
    return this.eventEmitter.emit(event as string, ...args);
  }

  // Additional method for testing purposes
  emitSync(event: string | symbol, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  // Test helper methods
  setMockResponse(method: string, response: any) {
    this.mockResponses.set(method, response);
  }

  setDelay(ms: number) {
    this.delay = ms;
  }

  // Mock provider methods needed for testing
  async getNetwork() {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    return this.networkPromise;
  }

  async detectNetwork() {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    return this.networkPromise;
  }

  // Satisfy Provider interface minimally
  _detectNetwork() {
    return this.networkPromise;
  }

  // Mock other essential methods
  async getBlockNumber(): Promise<number> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    return 1;
  }

  async getBlock(): Promise<any> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    return {
      number: 1,
      timestamp: Math.floor(Date.now() / 1000),
      hash: '0x1234567890123456789012345678901234567890123456789012345678901234'
    };
  }

  async getCode(address: string): Promise<string> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    // Return non-empty code to indicate contract exists
    return '0x608060405234801561001057600080fd5b50';
  }

  async call(transaction: TransactionRequest): Promise<string> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    
    // Handle different function calls based on transaction data
    if (transaction.data) {
      // Extract function selector (first 4 bytes)
      const selector = transaction.data.slice(0, 10);
      
      // Map common selectors to mock responses
      switch (selector) {
        case '0x7a0ed627': // facets()
          const facetsResponse = this.mockResponses.get('facets');
          if (facetsResponse) {
            // Return properly encoded facets response
            return this.encodeFacetsResponse(facetsResponse);
          }
          // If no mock response, simulate a successful empty response
          return this.encodeFacetsResponse([]);
          
        case '0xadfca15e': // facetFunctionSelectors(address)
          const selectorsResponse = this.mockResponses.get('facetFunctionSelectors');
          if (selectorsResponse) {
            return this.encodeSelectorsResponse(selectorsResponse);
          }
          // If no mock response, simulate a successful empty response
          return this.encodeSelectorsResponse([]);
          
        case '0x52ef6b2c': // facetAddresses()
          const addressesResponse = this.mockResponses.get('facetAddresses');
          if (addressesResponse) {
            return this.encodeAddressesResponse(addressesResponse);
          }
          // If no mock response, simulate a successful empty response
          return this.encodeAddressesResponse([]);
      }
    }
    
    return '0x';
  }

  private encodeResponse(data: any): string {
    // Simple mock encoding - in reality this would be ABI-encoded
    if (Array.isArray(data)) {
      return '0x' + Buffer.from(JSON.stringify(data)).toString('hex');
    }
    return '0x' + Buffer.from(String(data)).toString('hex');
  }

  private encodeFacetsResponse(facets: any[]): string {
    // For facets(), return ABI-encoded tuple(address,bytes4[])[] array
    try {
      const abiCoder = AbiCoder.defaultAbiCoder();
      
      // Convert to the format expected by the ABI
      const formattedFacets = facets.map(facet => [
        facet.facetAddress,
        facet.functionSelectors
      ]);
      
      return abiCoder.encode(
        ['tuple(address,bytes4[])[]'],
        [formattedFacets]
      );
    } catch (error) {
      // Fallback to hardcoded response if ABI encoding fails
      return '0x0000000000000000000000000000000000000000000000000000000000000020' + // offset to array
             '0000000000000000000000000000000000000000000000000000000000000001' + // array length = 1
             '0000000000000000000000001234567890123456789012345678901234567890' + // facetAddress
             '0000000000000000000000000000000000000000000000000000000000000040' + // offset to selectors array
             '0000000000000000000000000000000000000000000000000000000000000002' + // selectors array length = 2
             '1234567800000000000000000000000000000000000000000000000000000000' + // selector 1
             '8765432100000000000000000000000000000000000000000000000000000000'; // selector 2
    }
  }

  private encodeSelectorsResponse(selectors: string[]): string {
    // For facetFunctionSelectors(), return ABI-encoded bytes4[] array
    try {
      const abiCoder = AbiCoder.defaultAbiCoder();
      return abiCoder.encode(['bytes4[]'], [selectors]);
    } catch (error) {
      // Fallback to manual encoding
      let encoded = '0x0000000000000000000000000000000000000000000000000000000000000020'; // offset
      encoded += selectors.length.toString(16).padStart(64, '0'); // array length
      selectors.forEach(selector => {
        encoded += selector.replace('0x', '').padEnd(64, '0'); // each selector padded
      });
      return encoded;
    }
  }

  private encodeAddressesResponse(addresses: string[]): string {
    // For facetAddresses(), return ABI-encoded address[] array
    try {
      const abiCoder = AbiCoder.defaultAbiCoder();
      return abiCoder.encode(['address[]'], [addresses]);
    } catch (error) {
      // Fallback to manual encoding
      let encoded = '0x0000000000000000000000000000000000000000000000000000000000000020'; // offset
      encoded += addresses.length.toString(16).padStart(64, '0'); // array length
      addresses.forEach(address => {
        encoded += address.replace('0x', '').padStart(64, '0'); // each address padded
      });
      return encoded;
    }
  }

  async getLogs(): Promise<any[]> {
    return [];
  }

  // Use EventEmitter's native event methods - don't override them
  // The MockProvider extends EventEmitter so it already has proper on/off/removeAllListeners methods

  // Additional Provider interface methods
  get provider(): any {
    return this;
  }

  async getFeeData(): Promise<any> {
    return {
      gasPrice: BigInt(20000000000),
      maxFeePerGas: BigInt(20000000000), 
      maxPriorityFeePerGas: BigInt(1000000000)
    };
  }

  async getBalance(address: string): Promise<bigint> {
    return BigInt('1000000000000000000'); // 1 ETH
  }

  async getTransactionCount(address: string): Promise<number> {
    return 1;
  }

  async estimateGas(transaction: any): Promise<bigint> {
    return BigInt(21000);
  }

  async getGasPrice(): Promise<bigint> {
    return BigInt(20000000000);
  }

  async sendTransaction(transaction: any): Promise<any> {
    throw new Error('sendTransaction not implemented in MockProvider');
  }

  async getTransaction(hash: string): Promise<any> {
    return null;
  }

  async getTransactionReceipt(hash: string): Promise<any> {
    return null;
  }

  async resolveName(name: string): Promise<string | null> {
    return null;
  }

  async lookupAddress(address: string): Promise<string | null> {
    return null;
  }

  async waitForTransaction(hash: string, confirmations?: number, timeout?: number): Promise<any> {
    return null;
  }

  async broadcastTransaction(transaction: string): Promise<any> {
    throw new Error('broadcastTransaction not implemented in MockProvider');
  }

  // Mock other Provider interface requirements
  ready: Promise<any> = Promise.resolve(this);
  
  // Add any other methods that might be called
  async destroy(): Promise<void> {
    // Mock cleanup
  }

  // Additional Provider interface methods required for TypeScript compatibility
  async getStorage(address: string, position: string): Promise<string> {
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  async getTransactionResult(hash: string): Promise<any> {
    return null;
  }

  async waitForBlock(blockTag?: number): Promise<any> {
    return {
      number: blockTag || 1,
      timestamp: Math.floor(Date.now() / 1000),
      hash: '0x1234567890123456789012345678901234567890123456789012345678901234'
    };
  }
}

/**
 * Create a mock provider for testing
 */
export function createMockProvider(): MockProvider {
  return new MockProvider();
}
