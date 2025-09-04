/**
 * Hardhat Integration Utilities for Diamond Monitoring
 *
 * Utility functions for integrating with Hardhat environment,
 * handling deployment artifacts, and network configurations.
 */

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Provider } from 'ethers';
import { promises as fs } from 'fs';
import * as path from 'path';

import { NetworkInfo, DiamondInfo } from '../core/types';

/**
 * Get network information from Hardhat configuration
 */
export function getNetworkInfo(hre: HardhatRuntimeEnvironment): NetworkInfo {
  const network = hre.network;
  const config = network.config;

  // Handle different network types
  let rpcUrl = 'unknown';
  if ('url' in config) {
    rpcUrl = config.url;
  } else if (network.name === 'hardhat') {
    rpcUrl = 'http://localhost:8545';
  }

  return {
    name: network.name,
    chainId: network.config.chainId || 0,
    rpcUrl,
    blockExplorerUrl: (config as any).blockExplorerUrl,
    blockExplorerApiKey: (config as any).blockExplorerApiKey,
  };
}

/**
 * Create a provider for the current network
 */
export function createProvider(hre: HardhatRuntimeEnvironment): Provider {
  // Access ethers through the extensions
  const ethers = (hre as any).ethers;
  if (!ethers) {
    throw new Error('Hardhat ethers plugin is required');
  }
  return ethers.provider;
}

/**
 * Load deployment information for a diamond
 */
export async function loadDeploymentInfo(
  hre: HardhatRuntimeEnvironment,
  diamondName: string,
  networkName: string
): Promise<DiamondInfo | null> {
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  const networkDir = path.join(deploymentsDir, networkName);
  const diamondFile = path.join(networkDir, `${diamondName}.json`);

  try {
    await fs.access(diamondFile);
    const deploymentData = JSON.parse(await fs.readFile(diamondFile, 'utf8'));

    // Handle nested network structure (e.g., { "polygon_amoy": { "DiamondAddress": "..." } })
    let diamondData = deploymentData;
    if (deploymentData[networkName]) {
      diamondData = deploymentData[networkName];
    }

    return {
      name: diamondName,
      address: diamondData.address || diamondData.diamond?.address || diamondData.DiamondAddress,
      configPath: findDiamondConfig(diamondName),
      deploymentBlock: diamondData.receipt?.blockNumber || diamondData.blockNumber,
      network: getNetworkInfo(hre),
    };
  } catch {
    // Try alternative paths including GNUS.AI specific structure
    const networkInfo = getNetworkInfo(hre);
    const chainId = networkInfo.chainId;

    const alternativePaths = [
      path.join(
        process.cwd(),
        'diamonds',
        diamondName,
        'deployments',
        `${diamondName.toLowerCase()}-${networkName}-${chainId}.json`
      ),
      path.join(process.cwd(), 'diamonds', diamondName, 'deployments', `${networkName}.json`),
      path.join(process.cwd(), 'diamonds', diamondName, 'deployment.json'),
      path.join(process.cwd(), 'config', 'diamonds', `${diamondName}.json`),
      path.join(process.cwd(), 'deployments-test', networkName, `${diamondName}.json`),
    ];

    for (const altPath of alternativePaths) {
      try {
        await fs.access(altPath);
        const deploymentData = JSON.parse(await fs.readFile(altPath, 'utf8'));

        // Handle nested network structure (e.g., { "polygon_amoy": { "DiamondAddress": "..." } })
        let diamondData = deploymentData;
        if (deploymentData[networkName]) {
          diamondData = deploymentData[networkName];
        }

        return {
          name: diamondName,
          address:
            diamondData.address || diamondData.diamond?.address || diamondData.DiamondAddress,
          configPath: findDiamondConfig(diamondName),
          deploymentBlock: diamondData.receipt?.blockNumber || diamondData.blockNumber,
          network: networkInfo,
        };
      } catch {
        continue;
      }
    }

    return null;
  }
}

/**
 * Find diamond configuration file
 */
export function findDiamondConfig(diamondName: string): string | undefined {
  const possiblePaths = [
    path.join(process.cwd(), 'diamonds', diamondName, `${diamondName.toLowerCase()}.config.json`),
    path.join(process.cwd(), 'diamonds', diamondName, 'diamond.json'),
    path.join(process.cwd(), 'diamonds', diamondName, 'config.json'),
    path.join(process.cwd(), 'config', 'diamonds', `${diamondName}.json`),
    path.join(process.cwd(), 'config', `${diamondName}.json`),
    path.join(process.cwd(), `${diamondName}.diamond.json`),
  ];

  for (const configPath of possiblePaths) {
    try {
      require('fs').accessSync(configPath);
      return configPath;
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * Get available diamonds from deployments directory
 */
export async function getAvailableDiamonds(
  hre: HardhatRuntimeEnvironment,
  networkName: string
): Promise<string[]> {
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  const networkDir = path.join(deploymentsDir, networkName);

  try {
    await fs.access(networkDir);
    const files = await fs.readdir(networkDir);

    const diamonds = files
      .filter(file => file.endsWith('.json') && !file.startsWith('.'))
      .map(file => file.replace('.json', ''))
      .filter(name => !['solcInputs'].includes(name)); // Filter out non-diamond files

    return diamonds;
  } catch {
    return [];
  }
}

/**
 * Validate Hardhat environment setup
 */
export function validateHardhatEnvironment(hre: HardhatRuntimeEnvironment): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if ethers is available
  const ethers = (hre as any).ethers;
  if (!ethers) {
    errors.push('Hardhat ethers plugin is required but not found');
  }

  // Check if artifacts are available
  if (!hre.artifacts) {
    errors.push('Hardhat artifacts are not available');
  }

  // Check network configuration
  if (!hre.network) {
    errors.push('Hardhat network configuration is not available');
  }

  // Check if provider is available
  try {
    const provider = ethers?.provider;
    if (!provider) {
      errors.push('Ethereum provider is not available');
    }
  } catch {
    errors.push('Failed to access Ethereum provider');
  }

  // Warn about common issues
  if (hre.network?.name === 'hardhat') {
    warnings.push('Using Hardhat local network - monitoring may not work as expected');
  }

  if (!process.env.HARDHAT_NETWORK && hre.network?.name === 'localhost') {
    warnings.push('No HARDHAT_NETWORK environment variable set');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format address for display
 */
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get contract name from bytecode or address
 */
export async function getContractName(
  hre: HardhatRuntimeEnvironment,
  address: string
): Promise<string | undefined> {
  try {
    // This is a simplified implementation
    // In practice, you might want to query contract monitoring services
    // or maintain a local mapping of addresses to contract names
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if an address is a contract
 */
export async function isContract(
  hre: HardhatRuntimeEnvironment,
  address: string
): Promise<boolean> {
  try {
    const ethers = (hre as any).ethers;
    if (!ethers) {
      throw new Error('Hardhat ethers plugin is required');
    }
    const code = await ethers.provider.getCode(address);
    return code !== '0x';
  } catch {
    return false;
  }
}

/**
 * Get block timestamp
 */
export async function getBlockTimestamp(
  hre: HardhatRuntimeEnvironment,
  blockNumber?: number
): Promise<number> {
  try {
    const ethers = (hre as any).ethers;
    if (!ethers) {
      throw new Error('Hardhat ethers plugin is required');
    }
    const block = await ethers.provider.getBlock(blockNumber || 'latest');
    return block?.timestamp || 0;
  } catch {
    return 0;
  }
}

/**
 * Parse Hardhat network URL
 */
export function parseNetworkUrl(url: string): {
  protocol: string;
  host: string;
  port?: number;
  path?: string;
} {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : undefined,
      path: parsed.pathname !== '/' ? parsed.pathname : undefined,
    };
  } catch {
    return {
      protocol: 'unknown',
      host: 'unknown',
    };
  }
}
