/**
 * Utility functions for diamond development and monitoring
 */

/**
 * Convert function signature to selector
 * 
 * @param signature - Function signature (e.g., "transfer(address,uint256)")
 * @returns Function selector (4-byte hex string)
 */
export function getSelector(signature: string): string {
  const { keccak256, toUtf8Bytes } = require('ethers');
  const hash = keccak256(toUtf8Bytes(signature));
  return hash.slice(0, 10); // First 4 bytes (8 hex characters + 0x)
}

/**
 * Convert multiple function signatures to selectors
 * 
 * @param signatures - Array of function signatures
 * @returns Array of function selectors
 */
export function getSelectors(signatures: string[]): string[] {
  return signatures.map(getSelector);
}

/**
 * Format Ethereum address for display
 * 
 * @param address - Ethereum address
 * @param length - Optional length to truncate to (default: full address)
 * @returns Formatted address
 */
export function formatAddress(address: string, length?: number): string {
  if (!isValidAddress(address)) {
    return address;
  }

  if (length && length < address.length) {
    const prefixLength = Math.floor((length - 3) / 2);
    const suffixLength = length - prefixLength - 3;
    return `${address.slice(0, 2 + prefixLength)}...${address.slice(-suffixLength)}`;
  }

  return address.toLowerCase();
}

/**
 * Validate Ethereum address format
 * 
 * @param address - Address to validate
 * @returns True if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Compare two arrays of selectors and return differences
 * 
 * @param oldSelectors - Original selector array
 * @param newSelectors - New selector array
 * @returns Comparison result with added, removed, and common selectors
 */
export function compareSelectors(
  oldSelectors: string[], 
  newSelectors: string[]
): ComparisonResult {
  const oldSet = new Set(oldSelectors);
  const newSet = new Set(newSelectors);
  
  const added = newSelectors.filter(selector => !oldSet.has(selector));
  const removed = oldSelectors.filter(selector => !newSet.has(selector));
  const common = oldSelectors.filter(selector => newSet.has(selector));

  return {
    added,
    removed,
    common,
    hasChanges: added.length > 0 || removed.length > 0
  };
}

/**
 * Comparison result interface
 */
export interface ComparisonResult {
  /** Selectors added in new array */
  added: string[];
  /** Selectors removed from old array */
  removed: string[];
  /** Selectors present in both arrays */
  common: string[];
  /** Whether there are any changes */
  hasChanges: boolean;
}

/**
 * Convert bytes to human-readable size string
 * 
 * @param bytes - Number of bytes
 * @returns Human-readable size (e.g., "1.5 KB", "2.3 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const decimals = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Convert wei to ether with formatting
 * 
 * @param wei - Wei amount as string or number
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted ether amount
 */
export function formatEther(wei: string | number, decimals = 4): string {
  const { formatEther: ethersFormatEther } = require('ethers');
  const ether = ethersFormatEther(wei.toString());
  const num = parseFloat(ether);
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Sleep utility for delays
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility for async operations
 * 
 * @param fn - Function to retry
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param delay - Delay between attempts in ms (default: 1000)
 * @returns Promise resolving to function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Validate function selector format
 * 
 * @param selector - Selector to validate
 * @returns True if valid 4-byte selector
 */
export function isValidSelector(selector: string): boolean {
  return /^0x[a-fA-F0-9]{8}$/.test(selector);
}

/**
 * Create a simple hash of a string for tracking purposes
 * 
 * @param input - String to hash
 * @returns Simple hash string
 */
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Deep clone an object (simple implementation)
 * 
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Check if a string is a valid URL
 * 
 * @param str - String to check
 * @returns True if valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate string with ellipsis
 * 
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.slice(0, maxLength - 3) + '...';
}
