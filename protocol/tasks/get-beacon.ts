import { task } from 'hardhat/config';

task('get-beacon', async (_args, hardhat) => {
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
