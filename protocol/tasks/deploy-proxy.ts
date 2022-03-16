import { helpers } from '@soundxyz/common';
import { task } from 'hardhat/config';

const { getAuthSignature } = helpers;

task('deploy-proxy', 'Deploy Artist proxy & verify on etherscan')
  .addParam('artistVersion', 'Artist.sol version number')
  .setAction(async (args, hardhat, network) => {
    const { ethers, run, deployments } = hardhat;

    if (!args.artistVersion) {
      throw new Error('Must include artistVersion');
    }

    const contractName = `ArtistV${args.artistVersion}`;
    const [deployer] = await ethers.getSigners();
    const chainId = parseInt(await ethers.provider.send('eth_chainId', []));

    // Deploy an artist proxy via the ArtistCreator to verify
    const authSignature = await getAuthSignature({
      deployerAddress: deployer.address,
      chainId,
      privateKey: process.env.ADMIN_PRIVATE_KEY as string,
      provider: ethers.provider,
    });

    const artistCreator = await ethers.getContract('ArtistCreator');
    const artistCreatorContract = await ethers.getContractAt('ArtistCreator', artistCreator.address, deployer);
    const creationArgs = ['Sound.xyz', 'IMPLEMENTATION', 'https://sound.xyz/api/metadata/'];
    const artistDeployTx = await artistCreatorContract.createArtist(authSignature, ...creationArgs, {
      gasLimit: 1_000_000,
    });

    console.log(`Deployed ${contractName} on ${network.name}. Tx hash: ${artistDeployTx.hash}`);
    console.log('Waiting for 5 network confirmations...');

    const receipt = await artistDeployTx.wait(5);

    const artistId = receipt.events[3].args.artistId.toNumber();
    const proxyAddress = receipt.events[3].args.artistAddress;

    console.log(`${contractName} proxy address: ${proxyAddress}, id: ${artistId}`);

    // Gather arguments for the artist BeaconProxy
    const artistArtifact = await deployments.getArtifact(contractName);
    const iface = new ethers.utils.Interface(artistArtifact.abi);
    const functionSelector = iface.encodeFunctionData('initialize', [deployer.address, artistId, ...creationArgs]);
    const beaconAddress = await artistCreator.beaconAddress();
    const beaconConstructorArgs = [beaconAddress, functionSelector];

    const options: any = {
      address: proxyAddress,
      constructorArguments: beaconConstructorArgs,
    };

    await run('verify:verify', options);
  });
