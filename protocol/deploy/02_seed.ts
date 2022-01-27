import { constants, helpers, seedData } from '@soundxyz/common';
import { Contract } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const { getAuthSignature } = helpers;

const { artistsData, releaseData } = seedData;

const { NETWORK_MAP, baseURIs } = constants;

const func: DeployFunction = async function ({ ethers, waffle, deployments }: HardhatRuntimeEnvironment) {
  const signers = await ethers.getSigners();
  const chainId = (await waffle.provider.getNetwork()).chainId;
  const networkName = NETWORK_MAP[chainId];

  // Only seed on rinkeby when DEPLOY_SEED_DATA = true
  if (networkName === 'mainnet' || (networkName === 'rinkeby' && !process.env.DEPLOY_SEED_DATA)) return;

  console.log(`Deploying seed contracts on ${networkName}...`);

  const addresses = {
    dummyArtists: {},
    editions: {},
  };
  const artistCreatorDeployment = await deployments.get('ArtistCreator');
  const artistCreator = new Contract(artistCreatorDeployment.address, artistCreatorDeployment.abi, signers[0]);

  // Deploy artist contracts
  const artists = [];
  for (let i = 0; i < artistsData.length; i++) {
    const artistDatum = artistsData[i];
    const currentArtist = signers[i];

    const authSignature = await getAuthSignature({
      deployerAddress: currentArtist.address,
      chainId,
      privateKey: process.env.ADMIN_PRIVATE_KEY as string,
      provider: waffle.provider,
    });

    const tx = await artistCreator
      .connect(currentArtist)
      .createArtist(
        authSignature,
        artistDatum.name,
        artistDatum.name.replace(/\s+/g, '-').toUpperCase().slice(0, 8),
        baseURIs[networkName],
        {
          gasLimit: 1_000_000,
        }
      );

    const receipt = await tx.wait();
    const contractAddress = receipt.events[0].address;

    console.log(`Deployed ${artistDatum.name}; address: ${contractAddress}`);
    artists.push({ ...artistDatum, contractAddress });
    addresses.dummyArtists = { ...addresses.dummyArtists, [artistDatum.soundHandle]: contractAddress };
  }

  const artistDeployment = await deployments.getArtifact('Artist');

  // Mint NFT editions
  for (const [index, releaseDatum] of Object.entries(releaseData)) {
    const artistIdx = Number(index) % artists.length;
    const artistDatum = artists[artistIdx];
    const currentSigner = signers[artistIdx];
    const artistContract = new Contract(artistDatum.contractAddress, artistDeployment.abi, currentSigner);

    const { price, quantity, royaltyBPS, startTime, endTime, releaseId } = releaseDatum;
    const tx = await artistContract.createEdition(
      currentSigner.address,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
      { gasLimit: 200_000 }
    );

    console.log(`Created edition for ${artistDatum.name}. releaseId: ${releaseId} txHash: ${tx.hash}`);
    addresses.editions = { ...addresses.editions, [releaseDatum.titleSlug]: releaseId };

    // Move block.timestamp forward 10 seconds to avoid startTime conflicts
    await waffle.provider.send('evm_increaseTime', [10]);
    await waffle.provider.send('evm_mine', []);
  }
};

export default func;
