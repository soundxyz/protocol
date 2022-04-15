import './tasks/buyEdition';
import './tasks/createEdition';
import './tasks/deployEgg';
import './tasks/deployProxy';
import './tasks/deployUpgrade';
import './tasks/getBeacon';
import './tasks/nftTransfer';
import './tasks/prepSplit';
import './tasks/setAdmin';
import './tasks/transferOwnership';
import './tasks/upgradeBeacon';
import './tasks/verifyContract';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-solhint';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.5.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    settings: {
      // todo: turn on optimizer only when deploying to testnet or prod
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: './typechain',
  },
  networks: {
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      chainId: 1337,
      saveDeployments: true,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
      mining: {
        auto: true,
        interval: 5_000,
      },
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    // TODO: figure out why this breaks the build ("Error: could not detect network (event="noNetwork", code=NETWORK_ERROR")
    // mainnet: {
    //   url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
    //   accounts: [process.env.ADMIN_PRIVATE_KEY!],
    // },
  },
  paths: {
    deployments: 'src/deployments',
    artifacts: 'src/artifacts',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
