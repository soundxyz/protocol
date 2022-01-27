import './tasks/deploy-upgrade';
import './tasks/nft-transfer';
import './tasks/set-admin';
import './tasks/transfer-ownership';
import './tasks/upgrade-beacon';
import './tasks/verify';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-solhint';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';

import * as dotenv from 'dotenv';
import { HardhatUserConfig, task } from 'hardhat/config';

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.7',
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
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
      accounts: [process.env.ADMIN_PRIVATE_KEY!],
    },
  },
  etherscan: {
    /// TODO: set up sound.xyz etherscan account (the key below is from Matt's account)
    apiKey: '9YPP1TCA4DN9TIU7F9MV3N3VBVFR8428KI',
  },
  paths: {
    deployments: 'src/deployments',
    artifacts: 'src/artifacts',
  },
};

task('ad-hoc', async (args, hardhat) => {
  const { ethers, deployments } = hardhat;
  const [soundDeployer] = await ethers.getSigners();

  const artistCreatorDeployment = await deployments.get('ArtistCreator');
  const artistCreator = await ethers.getContractAt('ArtistCreator', artistCreatorDeployment.address);
  const beaconAddress = await artistCreator.beaconAddress();
  console.log({ beaconAddress });
  const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundDeployer);
  const implementationAddress = await beaconContract.implementation();
  console.log({ implementationAddress });
  const beaconOwner = await beaconContract.owner();
  console.log({ beaconOwner });
});

export default config;
