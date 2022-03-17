import { constants, helpers, seedData } from '@soundxyz/common';
import { Contract } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { sortBy } from 'lodash';

const { getAuthSignature } = helpers;

const { artistsData, releaseData, usersData, creditSplits } = seedData;

const { NETWORK_MAP, baseURIs, SOUND_ADMIN_PUBLIC_ADDRESS } = constants;

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

  console.log(`Starting upgrade to V${process.env.ARTIST_VERSION}`);

  // Deploy new implemntation
  const ArtistFactory = await ethers.getContractFactory(`ArtistV${process.env.ARTIST_VERSION}`);
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
      artistWalletAddr: currentArtist.address,
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

  const artistArtifact = await deployments.getArtifact(`ArtistV${process.env.ARTIST_VERSION}`);
  const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, deployer);
  const implementationAddress = await beaconContract.implementation();
  console.log({ implementationAddress });
  const beaconOwner = await beaconContract.owner();
  console.log({ beaconOwner });

  //=============== Deploy splits ======================//

  const PERCENTAGE_SCALE = ethers.BigNumber.from(1e6);

  console.log(`Deploying 0xSplit seed contracts on ${networkName}...`);

  const splitMainDeployment = await deployments.get('SplitMain');
  const splitMain = await ethers.getContractAt('SplitMain', splitMainDeployment.address);
  const testOshiWallet = signers[0];

  for (const splitData of creditSplits) {
    console.log('testOshiWallet: ', testOshiWallet.address);

    const orderedAllocations = sortBy(splitData.allocations, (o) => o.ownerAddress.toLowerCase());
    const ownerAddresses = orderedAllocations.map((allocation) => allocation.ownerAddress.toLowerCase());
    const percentAllocations = orderedAllocations.map((allocation) =>
      ethers.BigNumber.from(Math.round(PERCENTAGE_SCALE.toNumber() * +allocation.percent) / 100)
    );

    const splitTx = await splitMain.createSplit(
      ownerAddresses,
      percentAllocations,
      0, // splitter fee
      testOshiWallet.address,
      { gasLimit: 250_000 }
    );

    const splitReceipt = await splitTx.wait();
    console.log('SplitWallet proxy deployed: ', splitReceipt.events[0]?.args?.split);
  }

  //=============== Mint NFT editions ======================//

  for (const [index, releaseDatum] of Object.entries(releaseData)) {
    const splitData = creditSplits[index];
    const artistIdx = Number(index) % artists.length;
    const { name, contractAddress } = artists[artistIdx];
    const currentArtistWallet = signers[artistIdx];
    const artistContract = new Contract(contractAddress, artistArtifact.abi, currentArtistWallet);

    console.log({ name, contractAddress });

    // TODO: when testing with presale, this may need to be changed
    const presaleQuantity = 0;
    const signerAddress = SOUND_ADMIN_PUBLIC_ADDRESS;

    const { price, quantity, royaltyBPS, startTime, endTime, releaseId } = releaseDatum;

    // If splitData exists, then use that address, otherwise use the current artist's wallet
    if (splitData) {
      console.log(`Release ${releaseId} is getting split! Using: ${splitData.splitAddress} as fundingRecipient`);
    }
    const fundingRecipient = splitData?.splitAddress || currentArtistWallet.address;

    const tx = await artistContract.createEdition(
      fundingRecipient,
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

    const { editionId } = artistContract.interface.parseLog(receipt.events[0]).args;

    console.log({ editionId: editionId.toNumber(), startTime: new Date(startTime.toNumber() * 1000), releaseId });

    // Skip buying if the auction hasn't started for this edition
    if (startTime.mul(1000).gt(Date.now())) continue;

    // Buy the edition
    const buyer = signers[(+index + 1) % signers.length];
    const buyTx = await artistContract.connect(buyer).buyEdition(editionId, signerAddress, { value: price });

    console.log(`Bought edition for ${name}. txHash: ${buyTx.hash}`);

    await buyTx.wait();
  }
};

export default func;
