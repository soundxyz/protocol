import { constants } from '@soundxyz/common';
import { task } from 'hardhat/config';

const { baseURIs } = constants;

task('verify-contract', 'Verify a contract')
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

    console.log({ artistVersion });

    if (!artistVersion && (name === 'BeaconProxy' || name.toLowerCase().includes('artist'))) {
      throw new Error(
        `Invalid Artist contract name: ${name}. Must supply a version number, --artist-verision <versionNum>`
      );
    }

    console.log({ name, address, contract });

    const artistCreator = await ethers.getContract('ArtistCreator');
    let beaconAddress = await artistCreator.beaconAddress();

    let constructorArgs = [];
    if (name === 'BeaconProxy') {
      const baseURI = baseURIs[hardhat.network.name];
      const argsForArtistInit = [
        '0x955B6F06981d77f947F4d44CA4297D2e26a916d7', // owner/deployer address
        '28',
        `Pussy Riot`,
        `XXPUSSYX`,
        baseURI,
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
