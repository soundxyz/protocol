import { task } from 'hardhat/config';

task('upgrade-beacon', 'Calls upgradeTo on an UpgradeableBeacon that points to Artist.sol implementation)')
  .addParam('beaconAddress', 'The address of the beacon contract')
  .addParam('newImplementation', 'The address of the new Artist.sol implementation')
  .setAction(async (args, hardhat) => {
    const { beaconAddress, newImplementation } = args;
    const { network, ethers } = hardhat;

    console.log(`Upgrading the beacon implementation to ${newImplementation} on ${network.name}`);
    const [soundDeployer] = await ethers.getSigners();

    const beacon = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundDeployer);
    const currentOwner = await beacon.owner();
    console.log({ currentOwner });

    if (currentOwner !== soundDeployer.address) {
      throw new Error(`The beacon is not owned by the deployer`);
    }
    const tx = await beacon.upgradeTo(newImplementation);
    console.log('transaction started:', tx.hash);
    await tx.wait();

    const expectedImplementation = await beacon.implementation();
    if (expectedImplementation !== newImplementation) {
      throw new Error(`The beacon implementation was not upgraded to ${newImplementation}`);
    } else {
      console.log(`Beacon implementation upgraded to ${newImplementation}`);
    }
  });
