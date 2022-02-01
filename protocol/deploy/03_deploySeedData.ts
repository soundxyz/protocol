import { constants, seedData } from '@soundxyz/common';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { sortBy } from 'lodash';

const { creditSplits } = seedData;

const { NETWORK_MAP } = constants;

const func: DeployFunction = async function ({ ethers, waffle, deployments }: HardhatRuntimeEnvironment) {
  const PERCENTAGE_SCALE = ethers.BigNumber.from(1e6);
  const signers = await ethers.getSigners();
  const chainId = (await waffle.provider.getNetwork()).chainId;
  const networkName = NETWORK_MAP[chainId];

  // Only seed on rinkeby when DEPLOY_SEED_DATA = true
  if (networkName === 'mainnet' || (networkName === 'rinkeby' && !process.env.DEPLOY_SEED_DATA)) return;

  console.log(`Deploying 0xSplit seed contracts on ${networkName}...`);

  const splitMainDeployment = await deployments.get('SplitMain');
  const splitMain = await ethers.getContractAt('SplitMain', splitMainDeployment.address);
  const splitData = creditSplits[0];

  const artistWallet = signers[0];

  console.log('artistWallet: ', artistWallet.address);

  const orderedAllocations = sortBy(splitData.allocations, (o) => o.ownerAddress.toLowerCase());
  const ownerAddresses = orderedAllocations.map((allocation) => allocation.ownerAddress.toLowerCase());
  const percentAllocations = orderedAllocations.map((allocation) =>
    ethers.BigNumber.from(Math.round(PERCENTAGE_SCALE.toNumber() * +allocation.percent) / 100)
  );

  const tx = await splitMain.createSplit(
    ownerAddresses,
    percentAllocations,
    0, // splitter fee
    artistWallet.address,
    { gasLimit: 250_000 }
  );

  const receipt = await tx.wait();
  console.log('SplitWallet proxy deployed: ', receipt.logs[0].address);
};

export default func;
