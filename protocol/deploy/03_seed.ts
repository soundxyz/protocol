import { constants, helpers, seedData } from '@soundxyz/common';
import { Contract } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { sortBy } from 'lodash';

const { getAuthSignature } = helpers;

const { artistsData, releaseData, usersData, creditSplits } = seedData;

const { NETWORK_MAP, baseURIs } = constants;

const func: DeployFunction = async function ({ ethers, waffle, deployments }: HardhatRuntimeEnvironment) {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
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
  const artistCreator = new Contract(artistCreatorDeployment.address, artistCreatorDeployment.abi, deployer);

  //============= Upgrade to latest version of Artist.sol (only for local dev)==================//

  console.log('Starting upgrade to V2');

  // Deploy new implemntation
  const ArtistFactory = await ethers.getContractFactory(`ArtistV2`);
  const artistUpgrade = await ArtistFactory.deploy();
  console.log('Deployment started:', artistUpgrade.deployTransaction.hash);
  const deployReceipt = await artistUpgrade.deployTransaction.wait();
  const newImplAddress = deployReceipt.contractAddress;

  const beaconAddress = await artistCreator.beaconAddress();
  console.log({ beaconAddress });

  const beacon = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, deployer);
  const tx = await beacon.upgradeTo(newImplAddress);
  await tx.wait();

  const expectedImplementation = await beacon.implementation();
  if (expectedImplementation !== newImplAddress) {
    throw new Error(`The Artist implementation was not upgraded to ${newImplAddress}`);
  } else {
    console.log(`Artist implementation upgraded to ${newImplAddress}`);
  }

  //==========  Deploy artist contracts ======================//

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

  const artistArtifact = await deployments.getArtifact('ArtistV2');
  const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, deployer);
  const implementationAddress = await beaconContract.implementation();
  console.log({ implementationAddress });
  const beaconOwner = await beaconContract.owner();
  console.log({ beaconOwner });

  //=============== Mint NFT editions ======================//

  for (const [index, releaseDatum] of Object.entries(releaseData)) {
    const artistIdx = Number(index) % artists.length;
    const { name, contractAddress } = artists[artistIdx];
    const currentSigner = signers[artistIdx];
    const artistContract = new Contract(contractAddress, artistArtifact.abi, currentSigner);

    console.log({ name, contractAddress });

    // TODO: when testing with presale, this may need to be changed
    const presaleQuantity = 0;
    const signerAddress = usersData[0].publicAddress;

    const { price, quantity, royaltyBPS, startTime, endTime, releaseId } = releaseDatum;

    const tx = await artistContract.createEdition(
      currentSigner.address,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
      presaleQuantity,
      signerAddress,
      { gasLimit: 200_000 }
    );

    const receipt = await tx.wait();
    if (receipt.status != 1) {
      throw new Error(`Failed to create edition for ${name}`);
    }

    console.log(`Created edition for ${name}. releaseId: ${releaseId} txHash: ${tx.hash}`);
    addresses.editions = { ...addresses.editions, [releaseDatum.titleSlug]: releaseId };

    // Move block.timestamp forward 10 seconds to avoid startTime conflicts
    await waffle.provider.send('evm_increaseTime', [10]);
    await waffle.provider.send('evm_mine', []);
  }

  //=============== Splits ======================//

  const PERCENTAGE_SCALE = ethers.BigNumber.from(1e6);

  console.log(`Deploying 0xSplit seed contracts on ${networkName}...`);

  const splitMainDeployment = await deployments.get('SplitMain');
  const splitMain = await ethers.getContractAt('SplitMain', splitMainDeployment.address);

  for (const splitData of creditSplits) {
    const artistWallet = signers[0];

    console.log('artistWallet: ', artistWallet.address);

    const orderedAllocations = sortBy(splitData.allocations, (o) => o.ownerAddress.toLowerCase());
    const ownerAddresses = orderedAllocations.map((allocation) => allocation.ownerAddress.toLowerCase());
    const percentAllocations = orderedAllocations.map((allocation) =>
      ethers.BigNumber.from(Math.round(PERCENTAGE_SCALE.toNumber() * +allocation.percent) / 100)
    );

    const splitTx = await splitMain.createSplit(
      ownerAddresses,
      percentAllocations,
      0, // splitter fee
      artistWallet.address,
      { gasLimit: 250_000 }
    );

    const splitReceipt = await splitTx.wait();
    console.log('SplitWallet proxy deployed: ', splitReceipt.events[0]?.args?.split);
  }
};

export default func;
