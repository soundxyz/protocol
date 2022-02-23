import '@nomiclabs/hardhat-ethers';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers as commonHelpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers, waffle } from 'hardhat';

import {
  BASE_URI,
  currentSeconds,
  deployArtistImplementation,
  EMPTY_SIGNATURE,
  EXAMPLE_ARTIST_ID,
  EXAMPLE_ARTIST_NAME,
  EXAMPLE_ARTIST_SYMBOL,
  getRandomBN,
  getRandomInt,
  getTokenId,
  INVALID_PRIVATE_KEY,
  MAX_UINT32,
  NULL_ADDRESS,
} from './helpers';

const { getAuthSignature, getPresaleSignature } = commonHelpers;

const { provider } = waffle;

const deployArtistProxy = async (soundOwner: SignerWithAddress) => {
  // Deploy & initialize ArtistCreator
  const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
  const artistCreator = await ArtistCreator.deploy();
  await artistCreator.initialize();
  await artistCreator.deployed();

  // Deploy ArtistV2 implementation
  const ArtistV2 = await ethers.getContractFactory('ArtistV2');
  const chainId = (await provider.getNetwork()).chainId;
  const artistV2Impl = await ArtistV2.deploy();
  await artistV2Impl.deployed();

  // Upgrade beacon to point to ArtistV2 implementation
  const beaconAddress = await artistCreator.beaconAddress();
  const beaconContract = await ethers.getContractAt('UpgradeableBeacon', beaconAddress, soundOwner);
  const beaconTx = await beaconContract.upgradeTo(artistV2Impl.address);
  await beaconTx.wait();

  // Get sound.xyz signature to approve artist creation
  const signature = await getAuthSignature({
    deployerAddress: soundOwner.address,
    privateKey: process.env.ADMIN_PRIVATE_KEY,
    chainId,
    provider,
  });

  const tx = await artistCreator.createArtist(signature, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL, BASE_URI);
  const receipt = await tx.wait();
  const contractAddress = receipt.events[3].args.artistAddress;

  return ethers.getContractAt('ArtistV2', contractAddress);
};

describe('Artist prototype', () => {
  testArtistContract(deployArtistImplementation, EXAMPLE_ARTIST_NAME);
});

describe('Artist proxy', () => {
  testArtistContract(deployArtistProxy, EXAMPLE_ARTIST_NAME);
});

function testArtistContract(deployContract: Function, name: string) {
  describe('deployment', () => {
    let artist: Contract;
    let soundOwner, artistEOA, buyers;

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      [soundOwner, artistEOA, ...buyers] = signers;
      artist = await deployContract(soundOwner, artistEOA);
    });

    it('deploys contract with basic attributes', async () => {
      await expect(await artist.name()).to.eq(name);
      await expect(await artist.symbol()).to.eq(EXAMPLE_ARTIST_SYMBOL);
    });

    it('supports interface 2981', async () => {
      const INTERFACE_ID_ERC2981 = 0x2a55205a;
      await expect(await artist.supportsInterface(INTERFACE_ID_ERC2981)).to.eq(true);
    });

    it('ownerOf reverts if called for non-existent tokens', async () => {
      const tx = artist.ownerOf(BigNumber.from(getRandomInt()));
      await expect(tx).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('tokenURI reverts if called for non-existent tokens', async () => {
      const tx = artist.tokenURI(BigNumber.from(getRandomInt()));
      await expect(tx).to.be.revertedWith('ERC721Metadata: URI query for nonexistent token');
    });

    it('balanceOf returns 0 for addresses without a balance', async () => {
      const signers = await ethers.getSigners();
      for (const signer of signers) {
        const result = await artist.balanceOf(signer.address);
        await expect(result.toString()).to.eq('0');
      }
    });
  });

  ///// Set up for testing functions ////

  const EDITION_ID = '1';
  let artist: Contract;
  let eventData;
  let fundingRecipient;
  let price: BigNumber;
  let quantity: BigNumber;
  let royaltyBPS: BigNumber;
  let startTime: BigNumber;
  let endTime: BigNumber;
  let presaleQuantity: BigNumber;
  let signerAddress: string;

  type CustomMintArgs = {
    quantity?: BigNumber;
    price?: BigNumber;
    startTime?: BigNumber;
    endTime?: BigNumber;
    editionCount?: number;
    royaltyBPS?: BigNumber;
    fundingRecipient?: SignerWithAddress;
    presaleQuantity?: BigNumber;
    skipCreateEditions?: boolean;
    signer?: SignerWithAddress;
  };

  const setUpContract = async (customConfig: CustomMintArgs = {}) => {
    const signers = await ethers.getSigners();
    const [soundOwner, artistEOA, recipient] = signers;
    const editionCount = customConfig.editionCount || 1;

    fundingRecipient = customConfig.fundingRecipient || recipient;
    artist = await deployContract(soundOwner, artistEOA);

    price = customConfig.price || getRandomBN(MAX_UINT32);
    quantity = customConfig.quantity || getRandomBN();
    royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    endTime = customConfig.endTime || BigNumber.from(MAX_UINT32);
    presaleQuantity = customConfig.presaleQuantity || BigNumber.from(0);
    signerAddress = customConfig.signer?.address || soundOwner.address;

    if (!customConfig.skipCreateEditions) {
      for (let i = 0; i < editionCount; i++) {
        const createEditionTx = await artist.createEdition(
          fundingRecipient.address,
          price,
          quantity,
          royaltyBPS,
          startTime,
          endTime,
          presaleQuantity,
          signerAddress
        );

        const editionReceipt = await createEditionTx.wait();
        const contractEvent = artist.interface.parseLog(editionReceipt.events[0]);

        // note: if editionCount > 1, this will be the last event emitted
        eventData = contractEvent.args;
      }
    }
  };

  describe('createEdition', () => {
    it(`event logs return correct info`, async () => {
      await setUpContract({ editionCount: 2 });

      await expect(eventData.editionId).to.eq(2);
      await expect(eventData.fundingRecipient).to.eq(fundingRecipient.address);
      await expect(eventData.quantity).to.eq(quantity);
      await expect(eventData.price).to.eq(price);
      await expect(eventData.royaltyBPS).to.eq(royaltyBPS);
      await expect(eventData.startTime).to.eq(startTime);
      await expect(eventData.endTime).to.eq(endTime);
      await expect(eventData.presaleQuantity).to.eq(presaleQuantity);
      await expect(eventData.signerAddress).to.eq(signerAddress);
    });

    it(`'editions(tokenId)' returns correct info`, async () => {
      await setUpContract({ editionCount: 2 });
      const edition = await artist.editions(EDITION_ID);

      await expect(edition.fundingRecipient).to.eq(fundingRecipient.address);
      await expect(edition.numSold.toString()).to.eq('0');
      await expect(edition.quantity).to.eq(quantity);
      await expect(edition.price).to.eq(price);
      await expect(edition.royaltyBPS).to.eq(royaltyBPS);
      await expect(edition.startTime).to.eq(startTime);
      await expect(edition.endTime).to.eq(endTime);
      await expect(edition.presaleQuantity).to.eq(presaleQuantity);
      await expect(edition.signerAddress).to.eq(signerAddress);
    });

    it(`only allows the owner to create an edition`, async () => {
      await setUpContract();
      const [_, ...notOwners] = await ethers.getSigners();

      for (const notOwner of notOwners) {
        const tx = artist
          .connect(notOwner)
          .createEdition(
            notOwner.address,
            price,
            quantity,
            royaltyBPS,
            startTime,
            endTime,
            presaleQuantity,
            notOwner.address
          );
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it(`reverts if presale quantity is too high`, async () => {
      await setUpContract({ skipCreateEditions: true });
      const signers = await ethers.getSigners();
      const [_, artistEOA] = signers;

      const tx = artist.createEdition(
        artistEOA.address,
        price,
        69,
        royaltyBPS,
        startTime,
        endTime,
        70,
        artistEOA.address
      );

      await expect(tx).to.be.revertedWith('Presale quantity too big');
    });

    it(`reverts if signature not provided for presale`, async () => {
      await setUpContract({ skipCreateEditions: true });
      const signers = await ethers.getSigners();
      const [_, artistEOA] = signers;

      const tx = artist.createEdition(artistEOA.address, price, 2, royaltyBPS, startTime, endTime, 1, NULL_ADDRESS);

      await expect(tx).to.be.revertedWith('Signer address cannot be 0');
    });
  });

  describe('buyEdition', () => {
    it(`reverts with "Edition does not exist" when expected`, async () => {
      await setUpContract();
      const [_, purchaser] = await ethers.getSigners();
      const tx = artist.connect(purchaser).buyEdition('69420', EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith('Edition does not exist');
    });

    it(`reverts with "This edition is already sold out" when expected`, async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let i = 1; i <= quantity; i++) {
        await artist.connect(buyers[i]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
      }

      const tx = artist.connect(buyers[quantity + 1]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith('This edition is already sold out');
    });

    it(`reverts if there are no presale tokens and open auction hasn't started`, async () => {
      await setUpContract({
        startTime: BigNumber.from(currentSeconds() + 99999999),
        presaleQuantity: BigNumber.from(0),
      });
      const [_, purchaser] = await ethers.getSigners();
      const tx = artist.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith(`No presale available & open auction not started`);
    });

    it(`reverts if presale is sold out and open auction hasn't started`, async () => {
      await setUpContract({
        quantity: BigNumber.from(2),
        presaleQuantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });
      const [_, buyer] = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      const presaleSignature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const purchase1 = await artist.connect(buyer).buyEdition(EDITION_ID, presaleSignature, {
        value: price,
      });
      await purchase1.wait();

      const purchase2 = artist.connect(buyer).buyEdition(EDITION_ID, presaleSignature, {
        value: price,
      });

      await expect(purchase2).to.be.revertedWith(`No presale available & open auction not started`);
    });

    it(`reverts with "Auction has ended" when expected`, async () => {
      await setUpContract({ endTime: BigNumber.from(currentSeconds() - 1) });
      const [_, purchaser] = await ethers.getSigners();
      const tx = artist.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith(`Auction has ended`);
    });

    it(`reverts if signature is invalid during presale`, async () => {
      await setUpContract({
        presaleQuantity: BigNumber.from(1),
        quantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });

      const tx = artist.buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });

      await expect(tx).to.be.revertedWith('ECDSA: invalid signature');
    });

    it(`reverts if signature is signed by wrong address during presale`, async () => {
      await setUpContract({
        presaleQuantity: BigNumber.from(1),
        quantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });

      const chainId = (await provider.getNetwork()).chainId;
      const signers = await ethers.getSigners();
      const buyer = signers[10];

      const presaleSignature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: INVALID_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const tx = artist.connect(buyer).buyEdition(EDITION_ID, presaleSignature, {
        value: price,
      });

      await expect(tx).to.be.revertedWith('Invalid signer');
    });

    it(`reverts if signature is for the wrong edition during presale`, async () => {
      await setUpContract({
        presaleQuantity: BigNumber.from(1),
        quantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });

      const chainId = (await provider.getNetwork()).chainId;
      const signers = await ethers.getSigners();
      const buyer = signers[10];

      const presaleSignature = await getPresaleSignature({
        chainId,
        provider,
        editionId: '666',
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const tx = artist.connect(buyer).buyEdition(EDITION_ID, presaleSignature, {
        value: price,
      });

      await expect(tx).to.be.revertedWith('Invalid signer');
    });

    // This test is to ensure that even if the presale doesn't sell out, people can buy during the open sale without needing a signature
    it(`doesn't require signature if public sale has started, presale hasn't sold out, and its not a fully whitelisted sale (presaleQuantity < quantity)`, async () => {
      await setUpContract({
        presaleQuantity: BigNumber.from(1),
        quantity: BigNumber.from(2),
        startTime: BigNumber.from(currentSeconds() - 1000),
      });

      const signers = await ethers.getSigners();
      const buyer = signers[10];

      const tx = await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      const receipt = await tx.wait();

      await expect(receipt.status).to.equal(1);
    });

    it(`creates an event log for the purchase`, async () => {
      await setUpContract();
      const [_, purchaser] = await ethers.getSigners();
      const tx = await artist.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      const receipt = await tx.wait();
      const purchaseEvent = artist.interface.parseLog(receipt.events[1]).args;

      const TOKEN_COUNT = 1;
      const tokenId = getTokenId(EDITION_ID, TOKEN_COUNT);

      await expect(purchaseEvent.editionId.toString()).to.eq(EDITION_ID);
      await expect(purchaseEvent.tokenId.toString()).to.eq(tokenId);
      await expect(purchaseEvent.buyer.toString()).to.eq(purchaser.address);
      await expect(purchaseEvent.numSold.toString()).to.eq('1');
    });

    it(`updates the number sold for the editions`, async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      let editionData;
      const [_, ...buyers] = await ethers.getSigners();

      for (let count = 1; count <= quantity; count++) {
        await artist.connect(buyers[count]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
        editionData = await artist.editions(EDITION_ID);
        await expect(editionData.numSold.toString()).to.eq(count.toString());
      }
    });

    it('ownerOf returns the correct owner', async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let tokenSerialNum = 1; tokenSerialNum < quantity; tokenSerialNum++) {
        const currentBuyer = buyers[tokenSerialNum];
        await artist.connect(buyers[tokenSerialNum]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
        const tokenId = getTokenId(EDITION_ID, tokenSerialNum);
        const owner = await artist.ownerOf(tokenId);
        await expect(owner).to.eq(currentBuyer.address);
      }
    });

    it('increments the balance of the contract', async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let count = 1; count <= quantity; count++) {
        const revenue = price.mul(count);
        const currentBuyer = buyers[count];

        await artist.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
        const balance = await provider.getBalance(artist.address);
        await expect(balance.toString()).to.eq(revenue.toString());
      }
    });

    it(`tokenURI returns expected string`, async () => {
      const quantity = 10;
      await setUpContract({ quantity: BigNumber.from(quantity), editionCount: 3 });
      const [_, ...buyers] = await ethers.getSigners();
      const editionId = 3;

      for (let tokenSerialNum = 1; tokenSerialNum < quantity; tokenSerialNum++) {
        const currentBuyer = buyers[tokenSerialNum % buyers.length];

        await artist.connect(currentBuyer).buyEdition(editionId, EMPTY_SIGNATURE, {
          value: price,
        });

        const tokenId = getTokenId(editionId, tokenSerialNum.toString());
        const resp = await artist.tokenURI(tokenId);
        const tokenURI = `${BASE_URI}${EXAMPLE_ARTIST_ID}/${editionId}/${tokenSerialNum.toString()}`;

        await expect(resp).to.eq(tokenURI);
      }
    });

    it(`allows purchase if no presale exists and quantity remains`, async () => {
      await setUpContract({ quantity: BigNumber.from(1), presaleQuantity: BigNumber.from(0) });
      const [_, buyer] = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const tx = await artist.connect(buyer).buyEdition(EDITION_ID, signature, { value: price });
      const receipt = await tx.wait();

      await expect(receipt.status).to.equal(1);
    });

    it(`allows purchase during presale`, async () => {
      await setUpContract({ quantity: BigNumber.from(2), presaleQuantity: BigNumber.from(1) });
      const [_, buyer] = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const tx = await artist.connect(buyer).buyEdition(EDITION_ID, signature, { value: price });
      const receipt = await tx.wait();

      await expect(receipt.status).to.equal(1);
    });

    it(`signature is ignored during the open/public sale`, async () => {
      await setUpContract({ quantity: BigNumber.from(2), presaleQuantity: BigNumber.from(1) });
      const [_, buyer] = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const purchase1 = await artist.connect(buyer).buyEdition(EDITION_ID, signature, { value: price });
      await purchase1.wait();

      const purchase2 = await artist.buyEdition(EDITION_ID, EMPTY_SIGNATURE, { value: price });
      const purchase2Receipt = await purchase2.wait();

      await expect(purchase2Receipt.status).to.equal(1);
    });

    it(`allows purchase if presale is sold out but quantity remains`, async () => {
      await setUpContract({ quantity: BigNumber.from(2), presaleQuantity: BigNumber.from(1) });
      const [_, buyer] = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const purchase1 = await artist.connect(buyer).buyEdition(EDITION_ID, signature, { value: price });
      await purchase1.wait();

      const purchase2 = await artist.buyEdition(EDITION_ID, signature, { value: price });
      const purchase2Receipt = await purchase2.wait();

      await expect(purchase2Receipt.status).to.equal(1);
    });
  });

  describe('withdrawFunds', () => {
    it('transfers edition funds to the fundingRecipient', async () => {
      const quantity = 10;
      await setUpContract({ quantity: BigNumber.from(quantity) });

      const [soundOwner, artistEOA, fundingRecipient, ...buyers] = await ethers.getSigners();
      const originalRecipientBalance = await provider.getBalance(fundingRecipient.address);

      for (let count = 1; count <= quantity; count++) {
        const currentBuyer = buyers[count];
        await artist.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
      }

      // any address can call withdrawFunds
      await artist.connect(soundOwner).withdrawFunds(EDITION_ID);

      const contractBalance = await provider.getBalance(artist.address);
      // All the funds are extracted.
      await expect(contractBalance.toString()).to.eq('0');

      const recipientBalance = await provider.getBalance(fundingRecipient.address);
      const revenue = price.mul(quantity);

      await expect(recipientBalance.toString()).to.eq(originalRecipientBalance.add(revenue));
    });
  });

  describe('setStartTime', () => {
    const newTime = currentSeconds() + 100;

    it('only allows owner to call function', async () => {
      await setUpContract();
      const [_, ...notOwners] = await ethers.getSigners();
      for (const notOwner of notOwners) {
        const tx = artist.connect(notOwner).setStartTime(EDITION_ID, newTime);
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('sets the start time for the edition', async () => {
      await setUpContract();
      const [owner] = await ethers.getSigners();
      const tx = await artist.connect(owner).setStartTime(EDITION_ID, newTime);
      await tx.wait();
      const editionInfo = await artist.editions(EDITION_ID);
      await expect(editionInfo.startTime.toString()).to.eq(newTime.toString());
    });

    it('emits event', async () => {
      await setUpContract();
      const [owner] = await ethers.getSigners();
      const tx = await artist.connect(owner).setStartTime(EDITION_ID, newTime);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'AuctionTimeSet');
      expect(event.args.timeType).to.eq(0);
      expect(event.args.editionId.toString()).to.eq(EDITION_ID.toString());
      expect(event.args.newTime.toString()).to.eq(newTime.toString());
    });
  });

  describe('setEndTime', () => {
    const newTime = currentSeconds() + 100;

    it('only allows owner to call function', async () => {
      await setUpContract();
      const [_, ...notOwners] = await ethers.getSigners();
      for (const notOwner of notOwners) {
        const tx = artist.connect(notOwner).setEndTime(EDITION_ID, newTime);
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('sets the end time for the edition', async () => {
      await setUpContract();
      const [owner] = await ethers.getSigners();
      const tx = await artist.connect(owner).setEndTime(EDITION_ID, newTime);
      await tx.wait();
      const editionInfo = await artist.editions(EDITION_ID);
      await expect(editionInfo.endTime.toString()).to.eq(newTime.toString());
    });

    it('emits event', async () => {
      await setUpContract();
      const [owner] = await ethers.getSigners();
      const tx = await artist.connect(owner).setEndTime(EDITION_ID, newTime);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'AuctionTimeSet');
      expect(event.args.timeType).to.eq(1);
      expect(event.args.editionId.toString()).to.eq(EDITION_ID.toString());
      expect(event.args.newTime.toString()).to.eq(newTime.toString());
    });
  });

  describe('setSignerAddress', () => {
    it('only allows owner to call function', async () => {
      await setUpContract();
      const [_, notOwner] = await ethers.getSigners();

      const tx = artist.connect(notOwner).setSignerAddress(EDITION_ID, NULL_ADDRESS);

      await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('prevents attempt to set null address', async () => {
      await setUpContract();

      const tx = artist.setSignerAddress(EDITION_ID, NULL_ADDRESS);

      expect(tx).to.be.revertedWith('Signer address cannot be 0');
    });

    it('sets a new signer address for the edition', async () => {
      await setUpContract();
      const [_, newSigner] = await ethers.getSigners();

      const tx = await artist.setSignerAddress(EDITION_ID, newSigner.address);
      await tx.wait();

      const editionInfo = await artist.editions(EDITION_ID);

      await expect(editionInfo.signerAddress).to.equal(newSigner.address);
    });

    it('emits event', async () => {
      await setUpContract();
      const [_, newSigner] = await ethers.getSigners();

      const tx = await artist.setSignerAddress(EDITION_ID, newSigner.address);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'SignerAddressSet');

      expect(event.args.signerAddress).to.eq(newSigner.address);
    });
  });

  describe('setPresaleQuantity', () => {
    it('only allows owner to call function', async () => {
      await setUpContract();
      const [_, notOwner] = await ethers.getSigners();

      const tx = artist.connect(notOwner).setPresaleQuantity(EDITION_ID, 69);

      await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('prevents attempt to set presale quantity higher than quantity', async () => {
      await setUpContract({ quantity: BigNumber.from(69) });

      const tx = artist.setPresaleQuantity(EDITION_ID, 70);

      expect(tx).to.be.revertedWith('Must not exceed quantity');
    });

    it('sets a new presale quantity for the edition', async () => {
      const newPresaleQuantity = 420;
      await setUpContract({ quantity: BigNumber.from(420), presaleQuantity: BigNumber.from(69) });
      const tx = await artist.setPresaleQuantity(EDITION_ID, newPresaleQuantity);
      await tx.wait();

      const editionInfo = await artist.editions(EDITION_ID);

      await expect(editionInfo.presaleQuantity.toString()).to.equal(newPresaleQuantity.toString());
    });

    it('emits event', async () => {
      const newPresaleQuantity = 420;
      await setUpContract({ quantity: BigNumber.from(420), presaleQuantity: BigNumber.from(69) });
      const tx = await artist.setPresaleQuantity(EDITION_ID, newPresaleQuantity);
      const receipt = await tx.wait();

      const event = receipt.events.find((e) => e.event === 'PresaleQuantitySet');

      await expect(event.args.presaleQuantity.toString()).to.equal(newPresaleQuantity.toString());
    });
  });

  describe('getApproved', () => {
    it('returns the receiver address', async () => {
      const TOKEN_COUNT = '1';
      await setUpContract();
      const [_, receiver, buyer] = await ethers.getSigners();

      await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });

      const tokenId = getTokenId(EDITION_ID, TOKEN_COUNT);
      await artist.connect(buyer).approve(receiver.address, tokenId);
      const approved = await artist.getApproved(tokenId);
      await expect(approved).to.eq(receiver.address);
    });
  });

  describe('transferFrom', () => {
    it('reverts when not approved', async () => {
      await setUpContract();
      const [_, receiver, buyer] = await ethers.getSigners();

      await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });

      const tokenId = getTokenId(EDITION_ID, '1');
      const tx = artist.transferFrom(buyer.address, receiver.address, tokenId);

      await expect(tx).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
    });

    it('transfers when approved', async () => {
      await setUpContract();
      const [_, receiver, buyer] = await ethers.getSigners();
      const TOKEN_COUNT = '1';

      await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });

      const tokenId = getTokenId(EDITION_ID, TOKEN_COUNT);

      await artist.connect(buyer).approve(receiver.address, tokenId);
      await artist.connect(receiver).transferFrom(buyer.address, receiver.address, tokenId);

      const owner = await artist.ownerOf(tokenId);
      const buyerBalance = await artist.balanceOf(buyer.address);
      const receiverBalance = await artist.balanceOf(receiver.address);

      await expect(owner).to.eq(receiver.address);
      await expect(buyerBalance.toString()).to.eq('0');
      await expect(receiverBalance.toString()).to.eq('1'); // now owns one token
    });
  });

  describe('totalSupply', () => {
    it('returns correct total supply', async () => {
      const totalQuantity = 30;
      const editionCount = 3;
      await setUpContract({ editionCount, quantity: BigNumber.from(totalQuantity / editionCount) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let tokenId = 1; tokenId <= totalQuantity; tokenId++) {
        let currentEditionId = (tokenId % editionCount) + 1; // loops through editions
        const currentBuyer = buyers[tokenId % buyers.length];
        await artist.connect(currentBuyer).buyEdition(currentEditionId, EMPTY_SIGNATURE, {
          value: price,
        });
        const totalSupply = await artist.totalSupply();
        await expect(totalSupply.toString()).to.eq(tokenId.toString());
      }
      const totalSupply = await artist.totalSupply();
      await expect(totalSupply.toString()).to.eq(totalQuantity.toString());
    });
  });

  describe('royaltyInfo', () => {
    it('returns royalty info', async () => {
      const [_, ...signers] = await ethers.getSigners();
      const chainId = (await provider.getNetwork()).chainId;

      for (let i = 1; i < 5; i++) {
        const editionId = i;
        const currentBuyer = signers[i];
        const fundingRecipient = signers[i + 1];
        const royalty = BigNumber.from(getRandomInt(1, 10_000));
        const secondarySalePrice = ethers.utils.parseEther(getRandomBN().toString());
        const signature = await getPresaleSignature({
          chainId,
          provider,
          editionId: EDITION_ID,
          privateKey: process.env.ADMIN_PRIVATE_KEY,
          contractAddress: artist.address,
          buyerAddress: currentBuyer.address,
        });

        await setUpContract({ royaltyBPS: BigNumber.from(royalty), fundingRecipient, editionCount: i });
        const tx = await artist.connect(currentBuyer).buyEdition(editionId, signature, {
          value: price,
        });
        await tx.wait();

        // Since we instantiate the contract and only buy 1 token each time, the token id will always be 1
        const tokenId = getTokenId(editionId, 1);
        const expectedRoyaltyInfo = await artist.royaltyInfo(tokenId, secondarySalePrice);
        const royaltyAmount = royalty.mul(secondarySalePrice).div(BigNumber.from(10_000));

        expect(expectedRoyaltyInfo.royaltyAmount.toString()).to.eq(royaltyAmount.toString());
        expect(expectedRoyaltyInfo.fundingRecipient).to.eq(fundingRecipient.address);
      }
    });
  });
}
