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
  let artistV1Proxy: Contract;
  let artistV2Proxy: Contract;
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
    const artistV1ProxyAddress = receipt.events[3].args.artistAddress;
    artistV1Proxy = await ethers.getContractAt('Artist', artistV1ProxyAddress, artistWalletSigner);

    const editionCount = customConfig.editionCount === 0 ? 0 : 1;
    fundingRecipient = customConfig.fundingRecipient || recipientSigner;
    price = customConfig.price || getRandomBN(MAX_UINT32);
    quantity = customConfig.quantity || getRandomBN();
    royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    endTime = customConfig.endTime || BigNumber.from(MAX_UINT32);

    // Create some editions
    for (let i = 0; i < editionCount; i++) {
      await artistV1Proxy.createEdition(fundingRecipient.address, price, quantity, royaltyBPS, startTime, endTime);
    }
  };

  const upgradeArtistBeacon = async (contractVersion: string) => {
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
    artistV1Proxy = await ethers.getContractAt(contractVersion, artistV1Proxy.address, artistWalletSigner);
    // Instantiate v2 proxy
    artistV2Proxy = await ethers.getContractAt(contractVersion, artistPostUpgradeProxyAddress, artistWalletSigner);
  };

  //================== Artist.sol ==================/

  describe('Artist.sol -> ArtistV2.sol', () => {
    describe('Artist proxy deployed before upgrade', () => {
      it('existing storage data remains intact', async () => {
        await setUp();

        /// Purchase something before the upgrade to compare numSold
        const tx = await artistV1Proxy.buyEdition(EDITION_ID, { value: price });
        await tx.wait();
        const preUpgradeEditionInfo = await artistV1Proxy.editions(EDITION_ID);

        // Perform upgrade
        await upgradeArtistBeacon('ArtistV2');

        const postUpgradeEditionInfo = await artistV1Proxy.editions(EDITION_ID);

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
        await upgradeArtistBeacon('ArtistV2');
        expect(await artistV1Proxy.PRESALE_TYPEHASH()).is.not.undefined;
      });

      it('returns correct royalty from royaltyInfo (fixes bug in v1)', async () => {
        const edition1Royalty = BigNumber.from(69);
        const saleAmount = utils.parseUnits('1.0', 'ether');

        await setUp({ editionCount: 0 });

        const edition1Tx = await artistV1Proxy.createEdition(
          fundingRecipient.address,
          price,
          quantity,
          edition1Royalty,
          startTime,
          endTime
        );
        await edition1Tx.wait();

        const buy1Tx = await artistV1Proxy.buyEdition(1, { value: price });
        await buy1Tx.wait();
        const buy2Tx = await artistV1Proxy.buyEdition(1, { value: price });
        await buy2Tx.wait();

        // At this point, there are 2 tokens bought from edition 1.
        // Calling royaltyInfo(2) should return nothing because editionId 2 hasn't been created.
        const royaltyInfoPreUpgrade = await artistV1Proxy.royaltyInfo(2, saleAmount);

        // Verify pre-upgrade royaltyInfo is null
        expect(royaltyInfoPreUpgrade.fundingRecipient).to.equal('0x0000000000000000000000000000000000000000');
        expect(royaltyInfoPreUpgrade.royaltyAmount).to.equal(BigNumber.from(0));

        // Perform upgrade
        await upgradeArtistBeacon('ArtistV2');

        // Calling royaltyInfo(2) should return data because royaltyInfo is now fixed and tokenId 2 has been created.
        const royaltyInfoPostUpgrade = await artistV1Proxy.royaltyInfo(2, saleAmount);

        // Verify post-upgrade royaltyInfo is correct
        const expectedRoyalty = saleAmount.mul(edition1Royalty).div(10_000);
        expect(royaltyInfoPostUpgrade.fundingRecipient).to.equal(fundingRecipient.address);
        expect(royaltyInfoPostUpgrade.royaltyAmount).to.equal(expectedRoyalty);
      });

      it('emits event from setStartTime', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await setStartTimeTest(artistV1Proxy);
      });

      it('emits event from setEndTime', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await setEndTimeTest(artistV1Proxy);
      });

      it('requires signature for presale purchases', async () => {
        await setUp({ editionCount: 0 });
        await upgradeArtistBeacon('ArtistV2');
        await rejectPresalePurchaseTest(artistV1Proxy);
      });

      it('sells open sale NFTs', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await openSalePurchaseTest(artistV1Proxy);
      });

      it('sells NFTs of v1 editions after an upgrade', async () => {
        await setUp();

        await artistV1Proxy.buyEdition(EDITION_ID, { value: price });

        await upgradeArtistBeacon('ArtistV2');

        const tx = await artistV1Proxy.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });
        const receipt = await tx.wait();
        const totalSupply = await artistV1Proxy.totalSupply();

        expect(receipt.status).to.equal(1);
        expect(totalSupply.toNumber()).to.equal(2);
      });
    });

    describe('Artist proxy deployed after upgrade', () => {
      it('returns correct royalty from royaltyInfo (fixes bug in v1)', async () => {
        await setUp({ editionCount: 0 });
        await upgradeArtistBeacon('ArtistV2');

        const edition1Royalty = BigNumber.from(69);
        const saleAmount = utils.parseUnits('1.0', 'ether');

        const presaleQuantity = 1;
        const signerAddress = soundOwnerSigner.address;
        const editionTx = await artistV2Proxy.createEdition(
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
          contractAddress: artistV2Proxy.address,
          buyerAddress: buyer.address,
        });

        const buy1Tx = await artistV2Proxy.connect(buyer).buyEdition(1, signature, { value: price });
        await buy1Tx.wait();
        const buy2Tx = await artistV2Proxy.connect(buyer).buyEdition(1, signature, { value: price });
        await buy2Tx.wait();

        const royaltyInfo = await artistV2Proxy.royaltyInfo(2, saleAmount);

        const expectedRoyalty = saleAmount.mul(edition1Royalty).div(10_000);

        // If the upgrade didn't work, royaltyInfo(2) would return null values because only one edition was created.
        expect(royaltyInfo.fundingRecipient).to.equal(fundingRecipient.address);
        expect(royaltyInfo.royaltyAmount).to.equal(expectedRoyalty);
      });

      it('emits event from setStartTime', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await setStartTimeTest(artistV2Proxy);
      });

      it('emits event from setEndTime', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await setEndTimeTest(artistV2Proxy);
      });

      it('requires signature for presale purchases', async () => {
        await setUp({ editionCount: 0 });
        await upgradeArtistBeacon('ArtistV2');
        await rejectPresalePurchaseTest(artistV2Proxy);
      });

      it('sells open sale NFTs', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await openSalePurchaseTest(artistV2Proxy);
      });
    });

    describe('v3 upgrade with new storage variables', () => {
      it('pre-upgrade contracts return new data', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2');
        await upgradeArtistBeacon('ArtistV3Test');

        const SOME_NUMBER = 103979370;
        const tx = await artistV1Proxy.setSomeNumber(SOME_NUMBER);
        await tx.wait();
        const someNumber = await artistV1Proxy.someNumber();
        expect(someNumber).to.equal(SOME_NUMBER);

        const helloWorld = await artistV1Proxy.helloWorld();
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

      const ArtistCreatorV3Test = await ethers.getContractFactory('ArtistCreatorV3Test');
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
});
