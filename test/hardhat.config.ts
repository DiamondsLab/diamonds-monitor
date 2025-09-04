import { HardhatUserConfig } from 'hardhat/config';

// Import our plugin for testing
import '../src/index';

const config: HardhatUserConfig = {
  solidity: '0.8.19',

  // Diamond monitoring configuration
  diamondMonitor: {
    defaultModules: ['FunctionSelector', 'DiamondStructure'],
    outputPath: './test-reports',
    moduleConfig: {
      FunctionSelector: {
        strictMode: false,
      },
      DiamondStructure: {
        requireStandardFacets: true,
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 1337,
    },
  },
};

export default config;
