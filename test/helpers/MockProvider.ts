/**
 * Mock Provider for testing that doesn't try to connect to any network
 */
export class MockProvider {
  private networkPromise: Promise<any>;

  constructor() {
    // Create a resolved promise for network detection
    this.networkPromise = Promise.resolve({
      name: 'hardhat',
      chainId: 31337,
      ensAddress: null
    });
  }

  // Mock provider methods needed for testing
  async getNetwork() {
    return this.networkPromise;
  }

  async detectNetwork() {
    return this.networkPromise;
  }

  // Satisfy Provider interface minimally
  _detectNetwork() {
    return this.networkPromise;
  }

  // Mock other essential methods
  async getBlockNumber(): Promise<number> {
    return 1;
  }

  async getBlock(): Promise<any> {
    return {
      number: 1,
      timestamp: Math.floor(Date.now() / 1000),
      hash: '0x1234567890123456789012345678901234567890123456789012345678901234'
    };
  }

  async getCode(address: string): Promise<string> {
    // Return non-empty code to indicate contract exists
    return '0x608060405234801561001057600080fd5b50';
  }

  async call(): Promise<string> {
    return '0x';
  }

  async getLogs(): Promise<any[]> {
    return [];
  }

  // Mock event listening methods
  on() { return this; }
  off() { return this; }
  removeAllListeners() { return this; }

  // Mock other Provider interface requirements
  ready: Promise<any> = Promise.resolve(this);
  
  // Add any other methods that might be called
  async destroy(): Promise<void> {
    // Mock cleanup
  }
}

/**
 * Create a mock provider for testing
 */
export function createMockProvider(): MockProvider {
  return new MockProvider();
}
