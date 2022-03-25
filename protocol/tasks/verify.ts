import { constants } from '@soundxyz/common';
import { task } from 'hardhat/config';

const { baseURIs } = constants;

task('verifyContract', 'Verify a contract')
  .addParam('name', 'The name of the contract')
  .addParam('address', 'The address of the contract to verify')
  .addOptionalParam('artistVersion', 'Artist.sol version number')
  .addOptionalParam(
    'contract',
    `The contract's path. ex: If verifying an Artist proxy, use @openzeppelin/contracts/proxy/beacon/BeaconProxy.sol:BeaconProxy`
  )
  .setAction(async (args, hardhat) => {
    const { ethers, run, deployments } = hardhat;
    const { name, address, contract, artistVersion } = args;

    if (name.toLowerCase().includes('artist') && !artistVersion) {
      throw new Error(`Invalid Artist contract name: ${name}. Must have a version number`);
    }

    console.log({ name, address, contract });

    const artistCreator = await ethers.getContract('ArtistCreator');
    let beaconAddress = await artistCreator.beaconAddress();

    let constructorArgs = [];
    if (name === 'BeaconProxy') {
      // const baseURI = baseURIs[hardhat.network.name];
      const argsForArtistInit = [
        '0xb0a36b3cedf210f37a5e7bc28d4b8e91d4e3c412', // deployer address
        '1',
        'Sound.xyz',
        'IMPLEMENTATION',
        'https://sound.xyz/api/metadata/',
      ];
      const artistArtifact = await deployments.getArtifact(`ArtistV${artistVersion}`);
      const iface = new ethers.utils.Interface(artistArtifact.abi);
      const functionSelector = iface.encodeFunctionData('initialize', argsForArtistInit);
      constructorArgs = [beaconAddress, functionSelector];
    }

    const options: any = {
      address: address,
      constructorArguments: constructorArgs,
    };

    if (contract) {
      options.contract = contract;
    }

    await run('verify:verify', options);
  });
