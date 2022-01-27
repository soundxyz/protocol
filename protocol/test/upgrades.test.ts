import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers, upgrades } from 'hardhat';

import { BASE_URI, createArtist, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL, getRandomBN, MAX_UINT32 } from './helpers';

type CustomMintArgs = {
  quantity?: BigNumber;
  price?: BigNumber;
  startTime?: BigNumber;
  endTime?: BigNumber;
  editionCount?: number;
  royaltyBPS?: BigNumber;
  fundingRecipient?: SignerWithAddress;
};

describe('Upgrades', () => {
  let artistCreator: Contract;
  let soundOwnerSigner: SignerWithAddress;
  let artistWalletSigner: SignerWithAddress;
  let recipientSigner: SignerWithAddress;
  let fundingRecipient: SignerWithAddress;
  let attackerSigners: SignerWithAddress[];
  let artistProxy: Contract;
  let artistPostUpgradeProxy: Contract;
  let price: BigNumber;
  let quantity: BigNumber;
  let royaltyBPS: BigNumber;
  let startTime: BigNumber;
  let endTime: BigNumber;
  let eventData: any;

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
    artistProxy = await ethers.getContractAt('Artist', artistV1ProxyAddress, artistWalletSigner);

    const editionCount = customConfig.editionCount || 1;
    fundingRecipient = customConfig.fundingRecipient || recipientSigner;
    price = customConfig.price || getRandomBN(MAX_UINT32);
    quantity = customConfig.quantity || getRandomBN();
    royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    endTime = customConfig.endTime || BigNumber.from(MAX_UINT32);

    // Create some editions
    for (let i = 0; i < editionCount; i++) {
      const createEditionTx = await artistProxy.createEdition(
        fundingRecipient.address,
        price,
        quantity,
        royaltyBPS,
        startTime,
        endTime
      );

      const editionReceipt = await createEditionTx.wait();
      const contractEvent = artistProxy.interface.parseLog(editionReceipt.events[0]);

      // note: if editionCount > 1, this will be the last event emitted
      eventData = contractEvent.args;
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
    artistProxy = await ethers.getContractAt(contractVersion, artistProxy.address, artistWalletSigner);
    // Instantiate v2 proxy
    artistPostUpgradeProxy = await ethers.getContractAt(
      contractVersion,
      artistPostUpgradeProxyAddress,
      artistWalletSigner
    );
  };

  //================== Artist.sol ==================/

  describe('Artist.sol', () => {
    it('prevents attackers from upgrading Artist beacon', async () => {
      await setUp();
      // Deploy v2 implementation
      const ArtistV2Test_addFunction = await ethers.getContractFactory('ArtistV2Test');
      const artistV2Impl = await ArtistV2Test_addFunction.deploy();
      await artistV2Impl.deployed();

      for (const attacker of attackerSigners) {
        // upgrade beacon
        const beaconAddress = await artistCreator.beaconAddress();
        const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, attacker);
        const beaconTx = beaconContract.upgradeTo(artistV2Impl.address);

        expect(beaconTx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    describe('v2 upgrade with new functions', () => {
      it('view function: pre-upgrade contract returns correct data', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2Test');

        const expectedResponse = await artistProxy.newViewFunction();
        expect(expectedResponse).to.equal(12345);
      });

      it('view function: post-upgrade contract returns correct data from new view function', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV2Test');
        const expectedResponse = await artistPostUpgradeProxy.newViewFunction();
        expect(expectedResponse).to.equal(12345);
      });

      it('pre-upgrade contract: data changes from function calls as expected after upgrade', async () => {
        await setUp({ editionCount: 5 });
        const NEW_PRICE = ethers.utils.parseEther('1.5397');
        const EDITION_ID_TO_CHANGE = 3;

        // Check pre-upgrade data
        const editionInfo = await artistProxy.editions(EDITION_ID_TO_CHANGE);
        expect(editionInfo.price).to.equal(price);

        await upgradeArtistBeacon('ArtistV2Test');

        // Check pre-upgrade contract data is correct after function call
        await artistProxy.changePriceOfEdition(EDITION_ID_TO_CHANGE, NEW_PRICE);
        const newEditionInfo = await artistProxy.editions(EDITION_ID_TO_CHANGE);

        expect(newEditionInfo.price).to.equal(NEW_PRICE);
      });
    });

    describe('v3 upgrade with new storage variables', () => {
      it('pre-upgrade contracts return new data', async () => {
        await setUp();
        await upgradeArtistBeacon('ArtistV3Test');

        const SOME_NUMBER = 103979370;
        const tx = await artistProxy.setSomeNumber(SOME_NUMBER);
        await tx.wait();
        const someNumber = await artistProxy.someNumber();
        expect(someNumber).to.equal(SOME_NUMBER);

        const helloWorld = await artistProxy.helloWorld();
        expect(helloWorld).to.equal('hello world');
      });
    });
  });

  //================== ArtistCreator.sol ==================/

  describe('ArtistCreator.sol', async () => {
    it('allows soundOwnerSigner to upgrade once', async () => {
      await setUp();

      const ArtistCreatorV2Test = await ethers.getContractFactory('ArtistCreatorV2Test');
      const artistCreatorV2 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV2Test);
      await artistCreatorV2.deployed();

      const v1ArtistAddress = await artistCreator.artistContracts(0);
      const v2ArtistAddress = await artistCreatorV2.artistContracts(0);

      const testFuncResponse = await artistCreatorV2.testFunction();

      expect(testFuncResponse.toString()).to.equal('12345');
      expect(v1ArtistAddress).to.equal(v2ArtistAddress);
    });

    it('allows soundOwnerSigner to upgrade twice', async () => {
      await setUp();

      const ArtistCreatorV2Test = await ethers.getContractFactory('ArtistCreatorV2Test');
      const artistCreatorV2 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV2Test);
      await artistCreatorV2.deployed();

      const ArtistCreatorV3Test = await ethers.getContractFactory('ArtistCreatorV3Test');
      const artistCreatorV3 = await upgrades.upgradeProxy(artistCreator.address, ArtistCreatorV3Test);
      await artistCreatorV3.deployed();

      const v3testFuncResponse = await artistCreatorV2.testFunction();
      expect(v3testFuncResponse.toString()).to.equal('666');
    });

    it('prevents attacker from upgrading', async () => {
      await setUp();

      // deploy v2 ArtistCreator
      const ArtistCreatorV2Test = await ethers.getContractFactory('ArtistCreatorV2Test');
      const artistCreatorV2 = await ArtistCreatorV2Test.deploy();
      await artistCreatorV2.deployed();

      const artistCreatorV1 = await ethers.getContractAt('ArtistCreator', artistCreator.address, attackerSigners[0]);
      const tx = artistCreatorV1.upgradeTo(artistCreatorV2.address);

      expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
