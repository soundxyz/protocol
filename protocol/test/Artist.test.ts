import '@nomiclabs/hardhat-ethers';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers as commonHelpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, waffle } from 'hardhat';

import {
  BASE_URI,
  currentSeconds,
  deployArtistImplementation,
  deployArtistProxy,
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

const { getPresaleSignature } = commonHelpers;

const { provider } = waffle;

type CustomMintArgs = {
  quantity?: BigNumber;
  price?: BigNumber;
  startTime?: BigNumber;
  endTime?: BigNumber;
  editionCount?: number;
  royaltyBPS?: BigNumber;
  fundingRecipient?: SignerWithAddress;
  permissionedQuantity?: BigNumber;
  skipCreateEditions?: boolean;
  signer?: SignerWithAddress;
};

describe('Artist prototype', () => {
  testArtistContract(deployArtistImplementation, EXAMPLE_ARTIST_NAME);
});

describe('Artist proxy', () => {
  testArtistContract(deployArtistProxy, EXAMPLE_ARTIST_NAME);
});

async function testArtistContract(deployContract: Function, name: string) {
  const EDITION_ID = '1';
  let artist: Contract;
  let eventData;
  let soundOwner: SignerWithAddress;
  let fundingRecipient: SignerWithAddress;
  let artistAccount: SignerWithAddress;
  let miscAccounts: SignerWithAddress[];
  let price: BigNumber;
  let quantity: BigNumber;
  let royaltyBPS: BigNumber;
  let startTime: BigNumber;
  let endTime: BigNumber;
  let permissionedQuantity: BigNumber;
  let signerAddress: string;

  const setUpContract = async (customConfig: CustomMintArgs = {}) => {
    const editionCount = customConfig.editionCount || 1;

    const signers = await ethers.getSigners();
    const [deployer, artistSigner, ...others] = signers;
    soundOwner = deployer;
    artistAccount = artistSigner;
    miscAccounts = others;
    fundingRecipient = customConfig.fundingRecipient || artistAccount;

    artist = await deployContract(artistAccount, soundOwner);

    price = customConfig.price || parseEther('0.1');
    quantity = customConfig.quantity || getRandomBN();
    royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    endTime = customConfig.endTime || BigNumber.from(MAX_UINT32);
    permissionedQuantity = customConfig.permissionedQuantity || BigNumber.from(0);
    signerAddress = customConfig.signer === null ? NULL_ADDRESS : soundOwner.address;

    if (!customConfig.skipCreateEditions) {
      for (let i = 0; i < editionCount; i++) {
        const createEditionTx = await artist
          .connect(artistAccount)
          .createEdition(
            fundingRecipient.address,
            price,
            quantity,
            royaltyBPS,
            startTime,
            endTime,
            permissionedQuantity,
            signerAddress
          );

        const editionReceipt = await createEditionTx.wait();
        const contractEvent = artist.interface.parseLog(editionReceipt.events[0]);

        // note: if editionCount > 1, this will be the last event emitted
        eventData = contractEvent.args;
      }
    }
  };

  describe('deployment', () => {
    it('deploys contract with basic attributes', async () => {
      await setUpContract();
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
      await expect(eventData.permissionedQuantity).to.eq(permissionedQuantity);
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
      await expect(edition.permissionedQuantity).to.eq(permissionedQuantity);
      await expect(edition.signerAddress).to.eq(signerAddress);
    });

    it(`only allows the owner to create an edition`, async () => {
      await setUpContract();

      for (const notOwner of miscAccounts) {
        const tx = artist
          .connect(notOwner)
          .createEdition(
            notOwner.address,
            price,
            quantity,
            royaltyBPS,
            startTime,
            endTime,
            permissionedQuantity,
            notOwner.address
          );
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it(`reverts if permissioned quantity is too high`, async () => {
      await setUpContract({ skipCreateEditions: true });

      permissionedQuantity = BigNumber.from(70);
      quantity = BigNumber.from(69);

      const tx = artist
        .connect(artistAccount)
        .createEdition(
          fundingRecipient.address,
          price,
          quantity,
          royaltyBPS,
          startTime,
          endTime,
          permissionedQuantity,
          signerAddress
        );

      await expect(tx).to.be.revertedWith('Permissioned quantity too big');
    });

    it(`reverts if no quantity is given`, async () => {
      await setUpContract({ skipCreateEditions: true });

      quantity = BigNumber.from(0);
      const tx = artist
        .connect(artistAccount)
        .createEdition(
          fundingRecipient.address,
          price,
          quantity,
          royaltyBPS,
          startTime,
          endTime,
          permissionedQuantity,
          signerAddress
        );

      await expect(tx).to.be.revertedWith('Must set quantity');
    });

    it(`reverts if no fundingRecipient is given`, async () => {
      await setUpContract({ skipCreateEditions: true });

      const fundingRecipient = NULL_ADDRESS;
      const tx = artist
        .connect(artistAccount)
        .createEdition(
          fundingRecipient,
          price,
          quantity,
          royaltyBPS,
          startTime,
          endTime,
          permissionedQuantity,
          signerAddress
        );

      await expect(tx).to.be.revertedWith('Must set fundingRecipient');
    });

    it(`reverts if end time exceeds start time`, async () => {
      await setUpContract({ skipCreateEditions: true });

      startTime = BigNumber.from(1);
      endTime = BigNumber.from(0);

      const tx = artist
        .connect(artistAccount)
        .createEdition(
          fundingRecipient.address,
          price,
          quantity,
          royaltyBPS,
          startTime,
          endTime,
          permissionedQuantity,
          signerAddress
        );

      await expect(tx).to.be.revertedWith('End time must be greater than start time');
    });

    it(`reverts if signature not provided for permissioned`, async () => {
      await setUpContract({ skipCreateEditions: true });

      const tx = artist
        .connect(artistAccount)
        .createEdition(artistAccount.address, price, 2, royaltyBPS, startTime, endTime, 1, NULL_ADDRESS);

      await expect(tx).to.be.revertedWith('Signer address cannot be 0');
    });
  });

  describe('buyEdition', () => {
    it(`reverts with "Edition does not exist" when expected`, async () => {
      await setUpContract();
      const tx = artist.connect(miscAccounts[0]).buyEdition('69420', EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith('Edition does not exist');
    });

    it(`reverts with "This edition is already sold out" when expected`, async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });

      for (let i = 1; i <= quantity; i++) {
        await artist.connect(miscAccounts[i]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
      }

      const tx = artist.connect(miscAccounts[quantity + 1]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith('This edition is already sold out');
    });

    it(`reverts if there are no permissioned tokens and open auction hasn't started`, async () => {
      await setUpContract({
        startTime: BigNumber.from(currentSeconds() + 99999999),
        permissionedQuantity: BigNumber.from(0),
      });

      const purchaser = miscAccounts[0];

      const tx = artist.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith(`No permissioned tokens available & open auction not started`);
    });

    it(`reverts if permissioned is sold out and open auction hasn't started`, async () => {
      await setUpContract({
        quantity: BigNumber.from(2),
        permissionedQuantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });
      const buyer = miscAccounts[0];
      const chainId = (await provider.getNetwork()).chainId;

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const purchase1 = await artist.connect(buyer).buyEdition(EDITION_ID, signature, {
        value: price,
      });
      await purchase1.wait();

      const purchase2 = artist.connect(buyer).buyEdition(EDITION_ID, signature, {
        value: price,
      });

      await expect(purchase2).to.be.revertedWith(`No permissioned tokens available & open auction not started`);
    });

    it(`reverts with "Auction has ended" when expected`, async () => {
      await setUpContract({ endTime: BigNumber.from(currentSeconds() - 1) });
      const purchaser = miscAccounts[0];
      const tx = artist.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      await expect(tx).to.be.revertedWith(`Auction has ended`);
    });

    it(`reverts if signature is invalid during permissioned`, async () => {
      await setUpContract({
        permissionedQuantity: BigNumber.from(1),
        quantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });

      const tx = artist.buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });

      await expect(tx).to.be.revertedWith('ECDSA: invalid signature');
    });

    it(`reverts if signature is signed by wrong address during permissioned`, async () => {
      await setUpContract({
        permissionedQuantity: BigNumber.from(1),
        quantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });

      const chainId = (await provider.getNetwork()).chainId;

      const buyer = miscAccounts[10];

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        privateKey: INVALID_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const tx = artist.connect(buyer).buyEdition(EDITION_ID, signature, {
        value: price,
      });

      await expect(tx).to.be.revertedWith('Invalid signer');
    });

    it(`reverts if signature is for the wrong edition during permissioned`, async () => {
      await setUpContract({
        permissionedQuantity: BigNumber.from(1),
        quantity: BigNumber.from(1),
        startTime: BigNumber.from(currentSeconds() + 99999999),
      });

      const chainId = (await provider.getNetwork()).chainId;
      const buyer = miscAccounts[0];

      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: '666',
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artist.address,
        buyerAddress: buyer.address,
      });

      const tx = artist.connect(buyer).buyEdition(EDITION_ID, signature, {
        value: price,
      });

      await expect(tx).to.be.revertedWith('Invalid signer');
    });

    // This test is to ensure that even if the permissioned doesn't sell out, people can buy during the open sale without needing a signature
    it(`doesn't require signature if public sale has started, permissioned hasn't sold out, and its not a fully whitelisted sale (permissionedQuantity < quantity)`, async () => {
      await setUpContract({
        permissionedQuantity: BigNumber.from(1),
        quantity: BigNumber.from(2),
        startTime: BigNumber.from(currentSeconds() - 1000),
      });

      const buyer = miscAccounts[0];

      const tx = await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      const receipt = await tx.wait();

      await expect(receipt.status).to.equal(1);
    });

    it(`creates an event log for the purchase`, async () => {
      await setUpContract();
      const purchaser = miscAccounts[0];
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

      for (let count = 1; count <= quantity; count++) {
        await artist.connect(miscAccounts[count]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
        editionData = await artist.editions(EDITION_ID);
        await expect(editionData.numSold.toString()).to.eq(count.toString());
      }
    });

    it('ownerOf returns the correct owner', async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });

      for (let tokenSerialNum = 1; tokenSerialNum < quantity; tokenSerialNum++) {
        const currentBuyer = miscAccounts[tokenSerialNum];
        await artist.connect(miscAccounts[tokenSerialNum]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
        const tokenId = getTokenId(EDITION_ID, tokenSerialNum);
        const owner = await artist.ownerOf(tokenId);
        await expect(owner).to.eq(currentBuyer.address);
      }
    });

    it('increments the balance of the funding recipient', async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const initialBalance = await provider.getBalance(fundingRecipient.address);

      for (let count = 1; count <= quantity; count++) {
        const revenue = price.mul(count);
        const currentBuyer = miscAccounts[count];
        await artist.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
          value: price,
        });
        const finalBalance = await provider.getBalance(fundingRecipient.address);
        expect(finalBalance.toString()).to.eq(revenue.add(initialBalance).toString());
      }
    });

    it(`tokenURI returns expected string`, async () => {
      const quantity = 10;
      await setUpContract({ quantity: BigNumber.from(quantity), editionCount: 3 });

      const editionId = 3;

      for (let tokenSerialNum = 1; tokenSerialNum < quantity; tokenSerialNum++) {
        const currentBuyer = miscAccounts[tokenSerialNum % miscAccounts.length];

        await artist.connect(currentBuyer).buyEdition(editionId, EMPTY_SIGNATURE, {
          value: price,
        });

        const tokenId = getTokenId(editionId, tokenSerialNum.toString());
        const resp = await artist.tokenURI(tokenId);
        const tokenURI = `${BASE_URI}${EXAMPLE_ARTIST_ID}/${editionId}/${tokenId.toString()}`;

        await expect(resp).to.eq(tokenURI);
      }
    });

    it(`allows purchase if no permissioned exists and quantity remains`, async () => {
      await setUpContract({ quantity: BigNumber.from(1), permissionedQuantity: BigNumber.from(0) });
      const buyer = miscAccounts[0];
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

    it(`allows purchase during permissioned`, async () => {
      await setUpContract({ quantity: BigNumber.from(2), permissionedQuantity: BigNumber.from(1) });
      const buyer = miscAccounts[0];
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
      await setUpContract({ quantity: BigNumber.from(2), permissionedQuantity: BigNumber.from(1) });
      const buyer = miscAccounts[0];
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

    it(`allows purchase if permissioned is sold out but quantity remains`, async () => {
      await setUpContract({ quantity: BigNumber.from(2), permissionedQuantity: BigNumber.from(1) });
      const buyer = miscAccounts[0];
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

      const originalRecipientBalance = await provider.getBalance(fundingRecipient.address);

      for (let count = 1; count <= quantity; count++) {
        const currentBuyer = miscAccounts[count];
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
      for (const notOwner of miscAccounts) {
        const tx = artist.connect(notOwner).setStartTime(EDITION_ID, newTime);
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('sets the start time for the edition', async () => {
      await setUpContract();
      const tx = await artist.connect(artistAccount).setStartTime(EDITION_ID, newTime);
      await tx.wait();
      const editionInfo = await artist.editions(EDITION_ID);
      await expect(editionInfo.startTime.toString()).to.eq(newTime.toString());
    });

    it('emits event', async () => {
      await setUpContract();
      const tx = await artist.connect(artistAccount).setStartTime(EDITION_ID, newTime);
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
      for (const notOwner of miscAccounts) {
        const tx = artist.connect(notOwner).setEndTime(EDITION_ID, newTime);
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('sets the end time for the edition', async () => {
      await setUpContract();
      const tx = await artist.connect(artistAccount).setEndTime(EDITION_ID, newTime);
      await tx.wait();
      const editionInfo = await artist.editions(EDITION_ID);
      await expect(editionInfo.endTime.toString()).to.eq(newTime.toString());
    });

    it('emits event', async () => {
      await setUpContract();
      const tx = await artist.connect(artistAccount).setEndTime(EDITION_ID, newTime);
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

      const tx = artist.connect(miscAccounts[0]).setSignerAddress(EDITION_ID, NULL_ADDRESS);

      await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('prevents attempt to set null address', async () => {
      await setUpContract();

      const tx = artist.connect(artistAccount).setSignerAddress(EDITION_ID, NULL_ADDRESS);

      await expect(tx).to.be.revertedWith('Signer address cannot be 0');
    });

    it('sets a new signer address for the edition', async () => {
      await setUpContract();
      const newSigner = miscAccounts[0];

      const tx = await artist.connect(artistAccount).setSignerAddress(EDITION_ID, newSigner.address);
      await tx.wait();

      const editionInfo = await artist.editions(EDITION_ID);

      await expect(editionInfo.signerAddress).to.equal(newSigner.address);
    });

    it('emits event', async () => {
      await setUpContract();
      const newSigner = miscAccounts[0];

      const tx = await artist.connect(artistAccount).setSignerAddress(EDITION_ID, newSigner.address);
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === 'SignerAddressSet');

      expect(event.args.editionId.toString()).to.eq(EDITION_ID);
      expect(event.args.signerAddress).to.eq(newSigner.address);
    });
  });

  describe('setPermissionedQuantity', () => {
    it('only allows owner to call function', async () => {
      await setUpContract();
      const notOwner = miscAccounts[0];

      const tx = artist.connect(notOwner).setPermissionedQuantity(EDITION_ID, 69);

      await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('prevents attempt to set permissioned quantity higher than quantity', async () => {
      await setUpContract({ quantity: BigNumber.from(69) });

      const tx = artist.connect(artistAccount).setPermissionedQuantity(EDITION_ID, 70);

      expect(tx).to.be.revertedWith('Must not exceed quantity');
    });

    it('prevents attempt to set permissioned quantity when there is no signer address', async () => {
      await setUpContract({ quantity: BigNumber.from(69), signer: null });

      const tx = artist.connect(artistAccount).setPermissionedQuantity(EDITION_ID, 1);

      expect(tx).to.be.revertedWith('Edition must have a signer');
    });

    it('sets a new permissioned quantity for the edition', async () => {
      const newPermissionedQuantity = 420;
      await setUpContract({ quantity: BigNumber.from(420), permissionedQuantity: BigNumber.from(69) });
      const tx = await artist.connect(artistAccount).setPermissionedQuantity(EDITION_ID, newPermissionedQuantity);
      await tx.wait();

      const editionInfo = await artist.editions(EDITION_ID);

      await expect(editionInfo.permissionedQuantity.toString()).to.equal(newPermissionedQuantity.toString());
    });

    it('emits event', async () => {
      const newPermissionedQuantity = 420;
      await setUpContract({ quantity: BigNumber.from(420), permissionedQuantity: BigNumber.from(69) });
      const tx = await artist.connect(artistAccount).setPermissionedQuantity(EDITION_ID, newPermissionedQuantity);
      const receipt = await tx.wait();

      const event = receipt.events.find((e) => e.event === 'PermissionedQuantitySet');

      await expect(event.args.editionId.toString()).to.equal(EDITION_ID);
      await expect(event.args.permissionedQuantity.toString()).to.equal(newPermissionedQuantity.toString());
    });
  });

  describe('getApproved', () => {
    it('returns the receiver address', async () => {
      const TOKEN_COUNT = '1';
      await setUpContract();
      const [receiver, buyer] = miscAccounts;

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
      const [receiver, buyer] = miscAccounts;

      await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });

      const tokenId = getTokenId(EDITION_ID, '1');
      const tx = artist.transferFrom(buyer.address, receiver.address, tokenId);

      await expect(tx).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
    });

    it('transfers when approved', async () => {
      await setUpContract();
      const [receiver, buyer] = miscAccounts;
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

      for (let tokenId = 1; tokenId <= totalQuantity; tokenId++) {
        let currentEditionId = (tokenId % editionCount) + 1; // loops through editions
        const currentBuyer = miscAccounts[tokenId % miscAccounts.length];
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
      const chainId = (await provider.getNetwork()).chainId;

      for (let i = 1; i < 5; i++) {
        const editionId = i;
        const currentBuyer = miscAccounts[i];
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

  describe('editionCount', () => {
    it('returns the correct number of editions', async () => {
      const editionCount = 42;
      await setUpContract({ editionCount });

      const expectedCount = await artist.editionCount();

      expect(editionCount).to.eq(expectedCount.toNumber());
    });
  });

  describe('ownersOfTokenIds', () => {
    it('returns the correct list of owners', async () => {
      const editionQuantity = 10;
      const editionCount = 3;
      await setUpContract({ editionCount, quantity: BigNumber.from(10) });

      const tokenIds = [];
      const expectedOwners = [];
      for (let editionId = 1; editionId <= editionCount; editionId++) {
        for (let serialNum = 1; serialNum <= editionQuantity; serialNum++) {
          const currentBuyer = miscAccounts[serialNum % miscAccounts.length]; // loops over buyers
          await artist.connect(currentBuyer).buyEdition(editionId, EMPTY_SIGNATURE, {
            value: price,
          });
          const expectedTokenId = getTokenId(editionId, serialNum);
          expectedOwners.push(currentBuyer.address);
          tokenIds.push(expectedTokenId);
        }
      }
      const actualOwners = await artist.ownersOfTokenIds(tokenIds);
      await expect(expectedOwners).to.deep.eq(actualOwners);
    });

    it('reverts when passed a nonexistent token', async () => {
      await setUpContract();
      const [_, buyer] = await ethers.getSigners();

      const tokenIds = [];
      const expectedOwners = [];
      await artist.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, {
        value: price,
      });
      const expectedTokenId = getTokenId(EDITION_ID, 1);
      expectedOwners.push(buyer.address);
      tokenIds.push(expectedTokenId.add(69));

      const ownersResponse = artist.ownersOfTokenIds(tokenIds);
      await expect(ownersResponse).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });
  });
}
