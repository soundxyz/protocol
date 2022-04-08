import { waffle } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Dictionary } from 'lodash';

const NETWORK_MAP: Dictionary<string> = {
  '1': 'mainnet',
  '4': 'rinkeby',
  '1337': 'hardhat',
  '31337': 'hardhat',
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers } = hre;
  const { deploy, read } = deployments;
  const [deployer] = await ethers.getSigners();

  const chainId = (await waffle.provider.getNetwork()).chainId;

  console.log({ chainId, deployer: deployer.address }); // eslint-disable-line no-console// eslint-disable-line no-console

  if (chainId != 1337 && chainId != 31337) {
    console.log(`Skipping 0xSplits deployment since we're on ${NETWORK_MAP[chainId]}`);
    return;
  }

  const splitMain = await deploy('SplitMain', {
    from: deployer.address,
    log: true,
  });

  const info = {
    Contracts: {
      SplitMain: splitMain.address,
      SplitWallet: await read('SplitMain', 'walletImplementation'),
    },
  };

  console.log(info); // eslint-disable-line no-console

  if (chainId === 31337) {
    const multicall = await deploy('Multicall2', {
      from: deployer.address,
      log: true,
    });
    console.log('Multicall: ', multicall.address); // eslint-disable-line no-console
  }
};

export default func;
func.tags = ['SplitMain'];
