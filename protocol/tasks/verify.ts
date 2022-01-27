import { task } from 'hardhat/config';

const adddressToVerify = '0xff34bbab3df40d40e0f111d8f2527f574cf467e9';

task('verify-contract', async (_args, hardhat) => {
  const { ethers, run, deployments } = hardhat;
  const [soundDeployer] = await ethers.getSigners();

  console.log({ adddressToVerify });

  const argsForArtistInit = [
    '0x2F8f8FbF095345577b901d88EfA8bA4EC3FE8E39', // deployer address
    '1',
    'Gigamesh',
    'GIGAMESH',
    'https://sound.xyz/api/metadata/',
  ];

  const artistCreator = await ethers.getContract('ArtistCreator');
  let beaconAddress = await artistCreator.beaconAddress();

  const artistArtifact = await deployments.getArtifact('Artist');
  const iface = new ethers.utils.Interface(artistArtifact.abi);
  const functionSelector = iface.encodeFunctionData('initialize', argsForArtistInit);
  const beaconConstructorArgs = [beaconAddress, functionSelector];

  await run('verify:verify', {
    address: adddressToVerify,
    constructorArguments: beaconConstructorArgs,
  });
});
