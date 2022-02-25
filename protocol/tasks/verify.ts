import { constants } from '@soundxyz/common';
import { task } from 'hardhat/config';

const { baseURIs } = constants;

task('verify-contract', 'Verify a contract')
  .addParam('name', 'The name of the contract')
  .addParam('address', 'The address of the contract to verify')
  .setAction(async (args, hardhat) => {
    const { ethers, run, deployments } = hardhat;
    const { name, address } = args;
    const version = name.split('ArtistV')[1];

    if (!version) {
      throw new Error(`Invalid contract name: ${name}. Must have a version number`);
    }

    const baseURI = baseURIs[hardhat.network.name];

    const argsForArtistInit = [
      '0xB0A36b3CeDf210f37a5E7BC28d4b8E91D4E3C412', // deployer address
      '0',
      `Sound.xyz ArtistV${version}.sol`,
      `SOUND V${version}`,
      baseURI,
    ];

    const artistCreator = await ethers.getContract('ArtistCreator');
    let beaconAddress = await artistCreator.beaconAddress();

    const artistArtifact = await deployments.getArtifact(name);
    const iface = new ethers.utils.Interface(artistArtifact.abi);
    const functionSelector = iface.encodeFunctionData('initialize', argsForArtistInit);
    const beaconConstructorArgs = [beaconAddress, functionSelector];

    await run('verify:verify', {
      address: address,
      constructorArguments: name == 'UpgradeableBeacon' ? beaconConstructorArgs : [],
    });
  });
