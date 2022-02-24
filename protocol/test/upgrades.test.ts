import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber, Contract, utils } from 'ethers';
import { ethers, upgrades, waffle } from 'hardhat';

import {
  BASE_URI,
  createArtist,
  EMPTY_SIGNATURE,
  EXAMPLE_ARTIST_NAME,
  EXAMPLE_ARTIST_SYMBOL,
  getRandomBN,
  MAX_UINT32,
  NULL_ADDRESS,
} from './helpers';

enum TimeType {
  START = 0,
  END = 1,
}

type CustomMintArgs = {
  quantity?: BigNumber;
  price?: BigNumber;
  startTime?: BigNumber;
  endTime?: BigNumber;
  editionCount?: number;
  royaltyBPS?: BigNumber;
  fundingRecipient?: SignerWithAddress;
};

const { provider } = waffle;

const { getPresaleSignature } = helpers;

const EDITION_ID = '1';

describe('Upgrades', () => {
  let artistCreator: Contract;
  let soundOwnerSigner: SignerWithAddress;
  let artistWalletSigner: SignerWithAddress;
  let recipientSigner: SignerWithAddress;
  let fundingRecipient: SignerWithAddress;
  let attackerSigners: SignerWithAddress[];
  let artistPreUpgradeProxy: Contract;
  let artistPostUpgradeProxy: Contract;
  let price: BigNumber;
  let quantity: BigNumber;
  let royaltyBPS: BigNumber;
  let startTime: BigNumber;
  let endTime: BigNumber;

  const setUp = async (customConfig: CustomMintArgs = {}) => {
    [soundOwnerSigner, artistWalletSigner, recipientSigner, ...attackerSigners] = await ethers.getSigners();

    const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
    artistCreator = await upgrades.deployProxy(ArtistCreator, { kind: 'uups' });
    await artistCreator.deployed();

    const tx = await createArtist(
      artistCreator,
      artistWalletSigner,
      EXAMPLE_ARTIST_NAME,
      EXAMPLE_ARTIST_SYMBOL,
      BASE_URI
    );

    const receipt = await tx.wait();
    const artistPreUpgradeProxyAddress = receipt.events[3].args.artistAddress;
    artistPreUpgradeProxy = await ethers.getContractAt('Artist', artistPreUpgradeProxyAddress, artistWalletSigner);

    const editionCount = customConfig.editionCount ?? 1;
    fundingRecipient = customConfig.fundingRecipient || recipientSigner;
    price = customConfig.price || getRandomBN(MAX_UINT32);
    quantity = customConfig.quantity || getRandomBN();
    royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    endTime = customConfig.endTime || BigNumber.from(MAX_UINT32);

    // Create some editions
    await createEditions(artistPreUpgradeProxy, editionCount);
  };

  const upgradeArtistImplementation = async (contractVersion: string) => {
    // Deploy v2 artist implementation
    const ArtistNewVersion = await ethers.getContractFactory(contractVersion);
    const artistNewImpl = await ArtistNewVersion.deploy();
    await artistNewImpl.deployed();

    // Upgrade beacon
    const beaconAddress = await artistCreator.beaconAddress();
    const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundOwnerSigner);
    const beaconTx = await beaconContract.upgradeTo(artistNewImpl.address);
    await beaconTx.wait();

    // Deploy upgraded proxy
    const createArtistTx = await createArtist(
      artistCreator,
      artistWalletSigner,
      EXAMPLE_ARTIST_NAME,
      EXAMPLE_ARTIST_SYMBOL,
      BASE_URI
    );
    const receipt = await createArtistTx.wait();
    const artistPostUpgradeProxyAddress = receipt.events[3].args.artistAddress;

    // Reinstantiate v1 proxy
    artistPreUpgradeProxy = await ethers.getContractAt(
      contractVersion,
      artistPreUpgradeProxy.address,
      artistWalletSigner
    );
    // Instantiate v2 proxy
    artistPostUpgradeProxy = await ethers.getContractAt(
      contractVersion,
      artistPostUpgradeProxyAddress,
      artistWalletSigner
    );
  };

  //================== Artist.sol ==================/

  // ArtistV1 -> ArtistV2 TESTS

  describe('Artist.sol -> ArtistV2.sol', () => {
    describe('Artist proxy deployed before upgrade', () => {
      it('existing storage data remains intact', async () => {
        await setUp();

        /// Purchase something before the upgrade to compare numSold
        const tx = await artistPreUpgradeProxy.buyEdition(EDITION_ID, { value: price });
        await tx.wait();
        const preUpgradeEditionInfo = await artistPreUpgradeProxy.editions(EDITION_ID);

        // Perform upgrade
        await upgradeArtistImplementation('ArtistV2');

        const postUpgradeEditionInfo = await artistPreUpgradeProxy.editions(EDITION_ID);

        expect(postUpgradeEditionInfo.numSold).to.equal(preUpgradeEditionInfo.numSold);
        expect(postUpgradeEditionInfo.quantity).to.equal(preUpgradeEditionInfo.quantity);
        expect(postUpgradeEditionInfo.startTime).to.equal(preUpgradeEditionInfo.startTime);
        expect(postUpgradeEditionInfo.endTime).to.equal(preUpgradeEditionInfo.endTime);
        expect(postUpgradeEditionInfo.royaltyBPS).to.equal(preUpgradeEditionInfo.royaltyBPS);
        expect(postUpgradeEditionInfo.price.toString()).to.equal(preUpgradeEditionInfo.price.toString());
        expect(postUpgradeEditionInfo.fundingRecipient).to.equal(preUpgradeEditionInfo.fundingRecipient);
      });

      it('storage includes new variables', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        expect(await artistPreUpgradeProxy.PRESALE_TYPEHASH()).is.not.undefined;
      });

      it('returns correct royalty from royaltyInfo (fixes bug in v1)', async () => {
        const edition1Royalty = BigNumber.from(69);
        const saleAmount = utils.parseUnits('1.0', 'ether');

        await setUp({ editionCount: 0 });

        const edition1Tx = await artistPreUpgradeProxy.createEdition(
          fundingRecipient.address,
          price,
          quantity,
          edition1Royalty,
          startTime,
          endTime
        );
        await edition1Tx.wait();

        const buy1Tx = await artistPreUpgradeProxy.buyEdition(1, { value: price });
        await buy1Tx.wait();
        const buy2Tx = await artistPreUpgradeProxy.buyEdition(1, { value: price });
        await buy2Tx.wait();

        // At this point, there are 2 tokens bought from edition 1.
        // Calling royaltyInfo(2) should return nothing because editionId 2 hasn't been created.
        const royaltyInfoPreUpgrade = await artistPreUpgradeProxy.royaltyInfo(2, saleAmount);

        // Verify pre-upgrade royaltyInfo is null
        expect(royaltyInfoPreUpgrade.fundingRecipient).to.equal('0x0000000000000000000000000000000000000000');
        expect(royaltyInfoPreUpgrade.royaltyAmount).to.equal(BigNumber.from(0));

        // Perform upgrade
        await upgradeArtistImplementation('ArtistV2');

        // Calling royaltyInfo(2) should return data because royaltyInfo is now fixed and tokenId 2 has been created.
        const royaltyInfoPostUpgrade = await artistPreUpgradeProxy.royaltyInfo(2, saleAmount);

        // Verify post-upgrade royaltyInfo is correct
        const expectedRoyalty = saleAmount.mul(edition1Royalty).div(10_000);
        expect(royaltyInfoPostUpgrade.fundingRecipient).to.equal(fundingRecipient.address);
        expect(royaltyInfoPostUpgrade.royaltyAmount).to.equal(expectedRoyalty);
      });

      it('emits event from setStartTime', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await setStartTimeTest(artistPreUpgradeProxy);
      });

      it('emits event from setEndTime', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await setEndTimeTest(artistPreUpgradeProxy);
      });

      it('requires signature for presale purchases', async () => {
        await setUp({ editionCount: 0 });
        await upgradeArtistImplementation('ArtistV2');
        await rejectPresalePurchaseTest(artistPreUpgradeProxy);
      });

      it('sells open sale NFTs', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await openSalePurchaseTest(artistPreUpgradeProxy);
      });

      it('sells NFTs of v1 editions after an upgrade', async () => {
        await setUp();

        await artistPreUpgradeProxy.buyEdition(EDITION_ID, { value: price });

        await upgradeArtistImplementation('ArtistV2');

        const tx = await artistPreUpgradeProxy.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });
        const receipt = await tx.wait();
        const totalSupply = await artistPreUpgradeProxy.totalSupply();

        expect(receipt.status).to.equal(1);
        expect(totalSupply.toNumber()).to.equal(2);
      });
    });

    describe('Artist proxy deployed after upgrade', () => {
      it('returns correct royalty from royaltyInfo (fixes bug in v1)', async () => {
        await setUp({ editionCount: 0 });
        await upgradeArtistImplementation('ArtistV2');

        const edition1Royalty = BigNumber.from(69);
        const saleAmount = utils.parseUnits('1.0', 'ether');

        const presaleQuantity = 1;
        const signerAddress = soundOwnerSigner.address;
        const editionTx = await artistPostUpgradeProxy.createEdition(
          fundingRecipient.address,
          price,
          quantity,
          edition1Royalty,
          startTime,
          endTime,
          presaleQuantity,
          signerAddress
        );
        await editionTx.wait();

        const chainId = (await provider.getNetwork()).chainId;
        const signers = await ethers.getSigners();
        const buyer = signers[10];

        const signature = await getPresaleSignature({
          chainId,
          provider,
          editionId: EDITION_ID,
          privateKey: process.env.ADMIN_PRIVATE_KEY,
          contractAddress: artistPostUpgradeProxy.address,
          buyerAddress: buyer.address,
        });

        const buy1Tx = await artistPostUpgradeProxy.connect(buyer).buyEdition(1, signature, { value: price });
        await buy1Tx.wait();
        const buy2Tx = await artistPostUpgradeProxy.connect(buyer).buyEdition(1, signature, { value: price });
        await buy2Tx.wait();

        const royaltyInfo = await artistPostUpgradeProxy.royaltyInfo(2, saleAmount);

        const expectedRoyalty = saleAmount.mul(edition1Royalty).div(10_000);

        // If the upgrade didn't work, royaltyInfo(2) would return null values because only one edition was created.
        expect(royaltyInfo.fundingRecipient).to.equal(fundingRecipient.address);
        expect(royaltyInfo.royaltyAmount).to.equal(expectedRoyalty);
      });

      it('emits event from setStartTime', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await setStartTimeTest(artistPostUpgradeProxy);
      });

      it('emits event from setEndTime', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await setEndTimeTest(artistPostUpgradeProxy);
      });

      it('requires signature for presale purchases', async () => {
        await setUp({ editionCount: 0 });
        await upgradeArtistImplementation('ArtistV2');
        await rejectPresalePurchaseTest(artistPostUpgradeProxy);
      });

      it('sells open sale NFTs', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await openSalePurchaseTest(artistPostUpgradeProxy);
      });
    });

    describe('v3 upgrade with new storage variables', () => {
      it('pre-upgrade contracts return new data', async () => {
        await setUp();
        await upgradeArtistImplementation('ArtistV2');
        await upgradeArtistImplementation('ArtistV3Test');

        const SOME_NUMBER = 103979370;
        const tx = await artistPreUpgradeProxy.setSomeNumber(SOME_NUMBER);
        await tx.wait();
        const someNumber = await artistPreUpgradeProxy.someNumber();
        expect(someNumber).to.equal(SOME_NUMBER);

        const helloWorld = await artistPreUpgradeProxy.helloWorld();
        expect(helloWorld).to.equal('hello world');
      });
    });
  });

  //================== ArtistCreator.sol ==================/

  describe('ArtistCreator.sol', async () => {
    it('prevents attackers from upgrading Artist beacon', async () => {
      await setUp();
      // Deploy v2 implementation
      const ArtistV2 = await ethers.getContractFactory('ArtistV2');
      const artistV2Impl = await ArtistV2.deploy();
      await artistV2Impl.deployed();
      for (const attacker of attackerSigners) {
        // upgrade beacon
        const beaconAddress = await artistCreator.beaconAddress();
        const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, attacker);
        const beaconTx = beaconContract.upgradeTo(artistV2Impl.address);
        expect(beaconTx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('allows soundOwnerSigner to upgrade twice', async () => {
      await setUp();

      const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
      const artistCreatorV2 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreator);
      await artistCreatorV2.deployed();

      const ArtistCreatorV3Test = await ethers.getContractFactory('ArtistCreatorUpgradeTest');
      const artistCreatorV3 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV3Test);
      await artistCreatorV3.deployed();

      const v3testFuncResponse = await artistCreatorV3.testFunction();
      expect(v3testFuncResponse.toString()).to.equal('666');
    });

    it('prevents attacker from upgrading', async () => {
      await setUp();

      // deploy v2 ArtistCreator
      const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
      const artistCreatorV2 = await ArtistCreator.deploy();
      await artistCreatorV2.deployed();

      const artistCreatorV1 = await ethers.getContractAt('ArtistCreator', artistCreator.address, attackerSigners[0]);
      const tx = artistCreatorV1.upgradeTo(artistCreatorV2.address);

      expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  //================== TEST HELPERS ==================/

  const setStartTimeTest = async (artistContract: Contract) => {
    const newTime = 1743324758;

    const tx = await artistContract.setStartTime(EDITION_ID, newTime);
    const receipt = await tx.wait();

    const { args } = artistContract.interface.parseLog(receipt.events[0]);
    expect(args.newTime).to.equal(newTime);
    expect(args.timeType).to.equal(TimeType.START);
  };

  const setEndTimeTest = async (artistContract: Contract) => {
    const newTime = 1843325072;

    const tx = await artistContract.setEndTime(EDITION_ID, newTime);
    const receipt = await tx.wait();

    const { args } = artistContract.interface.parseLog(receipt.events[0]);
    expect(args.newTime).to.equal(newTime);
    expect(args.timeType).to.equal(TimeType.END);
  };

  const rejectPresalePurchaseTest = async (artistContract: Contract) => {
    const startTime = BigNumber.from(Math.floor(Date.now() / 1000) + 999999);
    const presaleQuantity = 1;
    const signerAddress = soundOwnerSigner.address;
    const editionTx = await artistContract.createEdition(
      fundingRecipient.address,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
      presaleQuantity,
      signerAddress
    );
    await editionTx.wait();

    const tx = artistContract.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });

    await expect(tx).to.be.revertedWith('ECDSA: invalid signature');
  };

  const openSalePurchaseTest = async (artistContract: Contract) => {
    const startTime = BigNumber.from(0);
    const presaleQuantity = 0;
    const signerAddress = soundOwnerSigner.address;
    const editionTx = await artistContract.createEdition(
      fundingRecipient.address,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
      presaleQuantity,
      signerAddress
    );
    await editionTx.wait();

    const tx = await artistContract.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });
    const receipt = await tx.wait();

    expect(receipt.status).to.equal(1);
  };

  const createEditions = async (artistContract: Contract, editionCount: number, postV2?: boolean) => {
    const args: any[] = [fundingRecipient.address, price, quantity, royaltyBPS, startTime, endTime];

    if (postV2) {
      args.push(0); // presaleQuantity
      args.push(NULL_ADDRESS); // signerAddress
    }

    for (let i = 0; i < editionCount; i++) {
      await artistContract.createEdition(...args);
    }
  };
});
