require("@nomicfoundation/hardhat-toolbox");

const ETHERSCAN_KEY = vars.get("ETHERSCAN_KEY");
const SEPOLIA_RPC = vars.get("SEPOLIA_RPC")
const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  networks: {
    sepolia: {
      url: SEPOLIA_RPC,
      accounts:
        [SEPOLIA_PRIVATE_KEY]
    },
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_KEY,
    },
    // customChains: [
    //   {
    //     network: 'sepolia',
    //     chainId: 11155111,
    //     urls: {
    //       apiURL: 'https://sepolia.etherscan.io//api',
    //       browserURL: 'https://sepolia.etherscan.io/',
    //     },
    //   },
    // ],
  },
};
