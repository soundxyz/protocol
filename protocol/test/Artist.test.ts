import '@nomiclabs/hardhat-ethers';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers, waffle } from 'hardhat';

import {
  BASE_URI,
  currentSeconds,
  deployArtistBeacon,
  EXAMPLE_ARTIST_ID,
  EXAMPLE_ARTIST_NAME,
  EXAMPLE_ARTIST_SYMBOL,
  getRandomBN,
  getRandomInt,
  MAX_UINT32,
} from './helpers';

const { getAuthSignature } = helpers;

const { provider } = waffle;

const deployArtistProxy = async (soundOwner: SignerWithAddress) => {
  const Artist = await ethers.getContractFactory('Artist');
  const chainId = (await provider.getNetwork()).chainId;
  // This contract's implementation is cloned for every new artist
  const protoArtist = await Artist.deploy();
  await protoArtist.deployed();

  const ArtistCreator = await ethers.getContractFactory('ArtistCreator');
  const artistCreator = await ArtistCreator.deploy();
  await artistCreator.initialize();
  await artistCreator.deployed();

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

  return ethers.getContractAt('Artist', contractAddress);
};

describe('Artist prototype', () => {
  testArtistContract(deployArtistBeacon, EXAMPLE_ARTIST_NAME);
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
      expect(await artist.name()).to.eq(name);
      expect(await artist.symbol()).to.eq(EXAMPLE_ARTIST_SYMBOL);
    });

    it('supports interface 2981', async () => {
      const INTERFACE_ID_ERC2981 = 0x2a55205a;
      expect(await artist.supportsInterface(INTERFACE_ID_ERC2981)).to.eq(true);
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
        expect(result.toString()).to.eq('0');
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

  type CustomMintArgs = {
    quantity?: BigNumber;
    price?: BigNumber;
    startTime?: BigNumber;
    endTime?: BigNumber;
    editionCount?: number;
    royaltyBPS?: BigNumber;
    fundingRecipient?: SignerWithAddress;
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

    for (let i = 0; i < editionCount; i++) {
      const createEditionTx = await artist.createEdition(
        fundingRecipient.address,
        price,
        quantity,
        royaltyBPS,
        startTime,
        endTime
      );

      const editionReceipt = await createEditionTx.wait();
      const contractEvent = artist.interface.parseLog(editionReceipt.events[0]);

      // note: if editionCount > 1, this will be the last event emitted
      eventData = contractEvent.args;
    }
  };

  describe('createEdition', () => {
    it(`event logs return correct info`, async () => {
      await setUpContract({ editionCount: 2 });

      expect(eventData.editionId).to.eq(2);
      expect(eventData.fundingRecipient).to.eq(fundingRecipient.address);
      expect(eventData.quantity).to.eq(quantity);
      expect(eventData.price).to.eq(price);
      expect(eventData.royaltyBPS).to.eq(royaltyBPS);
      expect(eventData.startTime).to.eq(startTime);
      expect(eventData.endTime).to.eq(endTime);
    });

    it(`'editions(tokenId)' returns correct info`, async () => {
      await setUpContract({ editionCount: 2 });
      const edition = await artist.editions(EDITION_ID);

      expect(edition.fundingRecipient).to.eq(fundingRecipient.address);
      expect(edition.numSold.toString()).to.eq('0');
      expect(edition.quantity).to.eq(quantity);
      expect(edition.price).to.eq(price);
      expect(edition.royaltyBPS).to.eq(royaltyBPS);
      expect(edition.startTime).to.eq(startTime);
      expect(edition.endTime).to.eq(endTime);
    });

    it(`only allows the owner to create an edition`, async () => {
      await setUpContract();
      const [_, ...notOwners] = await ethers.getSigners();
      for (const notOwner of notOwners) {
        const tx = artist
          .connect(notOwner)
          .createEdition(notOwner.address, price, quantity, royaltyBPS, startTime, endTime);
        await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });
  });

  describe('buyEdition', () => {
    it(`reverts with "Edition does not exist" when expected`, async () => {
      await setUpContract();
      const [_, purchaser] = await ethers.getSigners();
      const tx = artist.connect(purchaser).buyEdition('69420', {
        value: price,
      });
      await expect(tx).to.be.revertedWith('Edition does not exist');
    });

    it(`reverts with "This edition is already sold out" when expected`, async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let i = 1; i <= quantity; i++) {
        await artist.connect(buyers[i]).buyEdition(EDITION_ID, {
          value: price,
        });
      }

      const tx = artist.connect(buyers[quantity + 1]).buyEdition(EDITION_ID, {
        value: price,
      });
      await expect(tx).to.be.revertedWith('This edition is already sold out');
    });

    it(`reverts with "Auction hasn't started" when expected`, async () => {
      await setUpContract({ startTime: BigNumber.from(currentSeconds() + 99999999) });
      const [_, purchaser] = await ethers.getSigners();
      const tx = artist.connect(purchaser).buyEdition(EDITION_ID, {
        value: price,
      });
      await expect(tx).to.be.revertedWith(`Auction hasn't started`);
    });

    it(`reverts with "Auction has ended" when expected`, async () => {
      await setUpContract({ endTime: BigNumber.from(currentSeconds() - 1) });
      const [_, purchaser] = await ethers.getSigners();
      const tx = artist.connect(purchaser).buyEdition(EDITION_ID, {
        value: price,
      });
      await expect(tx).to.be.revertedWith(`Auction has ended`);
    });

    it(`creates an event log for the purchase`, async () => {
      await setUpContract();
      const [_, purchaser] = await ethers.getSigners();
      const tx = await artist.connect(purchaser).buyEdition(EDITION_ID, {
        value: price,
      });
      const receipt = await tx.wait();
      const purchaseEvent = artist.interface.parseLog(receipt.events[1]).args;

      expect(purchaseEvent.editionId.toString()).to.eq(EDITION_ID);
      expect(purchaseEvent.tokenId.toString()).to.eq('1');
      expect(purchaseEvent.buyer.toString()).to.eq(purchaser.address);
      expect(purchaseEvent.numSold.toString()).to.eq('1');
    });

    it(`updates the number sold for the editions`, async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      let editionData;
      const [_, ...buyers] = await ethers.getSigners();

      for (let count = 1; count <= quantity; count++) {
        await artist.connect(buyers[count]).buyEdition(EDITION_ID, {
          value: price,
        });
        editionData = await artist.editions(EDITION_ID);
        expect(editionData.numSold.toString()).to.eq(count.toString());
      }
    });

    it('ownerOf returns the correct owner', async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let tokenId = 1; tokenId < quantity; tokenId++) {
        const currentBuyer = buyers[tokenId];
        await artist.connect(buyers[tokenId]).buyEdition(EDITION_ID, {
          value: price,
        });
        const owner = await artist.ownerOf(tokenId);
        expect(owner).to.eq(currentBuyer.address);
      }
    });

    it('increments the balance of the contract', async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity) });
      const [_, ...buyers] = await ethers.getSigners();

      for (let count = 1; count <= quantity; count++) {
        const revenue = price.mul(count);
        const currentBuyer = buyers[count];

        await artist.connect(currentBuyer).buyEdition(EDITION_ID, {
          value: price,
        });
        const balance = await provider.getBalance(artist.address);
        expect(balance.toString()).to.eq(revenue.toString());
      }
    });

    it(`tokenURI returns expected string`, async () => {
      const quantity = 5;
      await setUpContract({ quantity: BigNumber.from(quantity), editionCount: 3 });
      const [_, ...buyers] = await ethers.getSigners();
      const editionId = 3;
      for (let tokenId = 1; tokenId < quantity; tokenId++) {
        const currentBuyer = buyers[tokenId];

        await artist.connect(currentBuyer).buyEdition(editionId, {
          value: price,
        });
        const tokenURI = `${BASE_URI}${EXAMPLE_ARTIST_ID}/${editionId}/${tokenId}`;
        const resp = await artist.tokenURI(tokenId);
        expect(resp).to.eq(tokenURI);
      }
    });
  });

  describe('withdrawFunds', () => {
    it('transfers base price funds to the fundingRecipient', async () => {
      const quantity = 10;
      await setUpContract({ quantity: BigNumber.from(quantity) });

      const [soundOwner, artistEOA, fundingRecipient, ...buyers] = await ethers.getSigners();
      const originalRecipientBalance = await provider.getBalance(fundingRecipient.address);

      for (let count = 1; count <= quantity; count++) {
        const currentBuyer = buyers[count];
        await artist.connect(currentBuyer).buyEdition(EDITION_ID, {
          value: price,
        });
      }

      // anyone address can call withdrawFunds
      await artist.connect(soundOwner).withdrawFunds(EDITION_ID);

      const contractBalance = await provider.getBalance(artist.address);
      // All the funds are extracted.
      expect(contractBalance.toString()).to.eq('0');

      const recipientBalance = await provider.getBalance(fundingRecipient.address);
      const revenue = price.mul(quantity);

      expect(recipientBalance.toString()).to.eq(originalRecipientBalance.add(revenue));
    });

    it('transfers all edition funds to the fundingRecipient', async () => {
      const quantity = 10;
      await setUpContract({ quantity: BigNumber.from(quantity) });

      const [soundOwner, artistEOA, fundingRecipient, ...buyers] = await ethers.getSigners();
      const originalRecipientBalance = await provider.getBalance(fundingRecipient.address);

      for (let count = 1; count <= quantity; count++) {
        const currentBuyer = buyers[count];
        await artist.connect(currentBuyer).buyEdition(EDITION_ID, {
          value: price.add(BigNumber.from(10)),
        });
      }

      // anyone address can call withdrawFunds
      await artist.connect(soundOwner).withdrawFunds(EDITION_ID);

      const contractBalance = await provider.getBalance(artist.address);
      // All the funds are extracted.
      expect(contractBalance.toString()).to.eq('0');

      const recipientBalance = await provider.getBalance(fundingRecipient.address);
      const basePricePaid = price.mul(quantity);
      const extraPaid = BigNumber.from(10 * quantity);

      expect(recipientBalance.toString()).to.eq(originalRecipientBalance.add(basePricePaid).add(extraPaid));
    });
  });

  describe('setStartTime', () => {
    it('only allows owner to call function', async () => {
      await setUpContract();
      const [_, ...notOwners] = await ethers.getSigners();
      const newTime = BigNumber.from(currentSeconds() + 100);
      for (const notOwner of notOwners) {
        const tx = artist.connect(notOwner).setStartTime(EDITION_ID, newTime);
        expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('sets the start time for the edition', async () => {
      await setUpContract();
      const [owner] = await ethers.getSigners();
      const newTime = BigNumber.from(currentSeconds() + 100);
      const tx = await artist.connect(owner).setStartTime(EDITION_ID, newTime);
      await tx.wait();
      const editionInfo = await artist.editions(EDITION_ID);
      expect(editionInfo.startTime.toString()).to.eq(newTime.toString());
    });
  });

  describe('setEndTime', () => {
    it('only allows owner to call function', async () => {
      await setUpContract();
      const [_, ...notOwners] = await ethers.getSigners();
      const newTime = BigNumber.from(currentSeconds() + 100);
      for (const notOwner of notOwners) {
        const tx = artist.connect(notOwner).setEndTime(EDITION_ID, newTime);
        expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
      }
    });

    it('sets the end time for the edition', async () => {
      await setUpContract();
      const [owner] = await ethers.getSigners();
      const newTime = BigNumber.from(currentSeconds() + 100);
      const tx = await artist.connect(owner).setEndTime(EDITION_ID, newTime);
      await tx.wait();
      const editionInfo = await artist.editions(EDITION_ID);
      expect(editionInfo.endTime.toString()).to.eq(newTime.toString());
    });
  });

  describe('getApproved', () => {
    it('returns the receiver address', async () => {
      const TOKEN_ID = '1';
      await setUpContract();
      const [_, receiver, buyer] = await ethers.getSigners();

      await artist.connect(buyer).buyEdition(EDITION_ID, {
        value: price,
      });

      await artist.connect(buyer).approve(receiver.address, TOKEN_ID);
      const approved = await artist.getApproved(TOKEN_ID);
      expect(approved).to.eq(receiver.address);
    });
  });

  describe('transferFrom', () => {
    it('reverts when not approved', async () => {
      await setUpContract();
      const [_, receiver, buyer] = await ethers.getSigners();

      await artist.connect(buyer).buyEdition(EDITION_ID, {
        value: price,
      });

      const tx = artist.transferFrom(buyer.address, receiver.address, '1');
      await expect(tx).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
    });

    it('transfers when approved', async () => {
      await setUpContract();
      const [_, receiver, buyer] = await ethers.getSigners();
      const TOKEN_ID = '1';

      await artist.connect(buyer).buyEdition(EDITION_ID, {
        value: price,
      });

      await artist.connect(buyer).approve(receiver.address, TOKEN_ID);
      await artist.connect(receiver).transferFrom(buyer.address, receiver.address, TOKEN_ID);

      const owner = await artist.ownerOf(TOKEN_ID);
      expect(owner).to.eq(receiver.address);
      const buyerBalance = await artist.balanceOf(buyer.address);
      expect(buyerBalance.toString()).to.eq('0');
      const receiverBalance = await artist.balanceOf(receiver.address);
      expect(receiverBalance.toString()).to.eq('1'); // now owns one token
    });
  });

  describe('getTokenIdsOfEdition', () => {
    it('returns correct list of ids', async () => {
      const totalQuantity = 30;
      const editionCount = 3;
      await setUpContract({ editionCount, quantity: BigNumber.from(totalQuantity / editionCount) });
      const [_, ...buyers] = await ethers.getSigners();

      const tokenIdsOfEditions = {
        1: [],
        2: [],
        3: [],
      };
      for (let tokenId = 1; tokenId < totalQuantity; tokenId++) {
        let currentEditionId = (tokenId % editionCount) + 1; // loops through editions
        const currentBuyer = buyers[tokenId % buyers.length]; // loops through buyers
        await artist.connect(currentBuyer).buyEdition(currentEditionId, {
          value: price,
        });
        tokenIdsOfEditions[currentEditionId].push(BigNumber.from(tokenId));
        const editionTokenIds = await artist.getTokenIdsOfEdition(currentEditionId);
        expect(editionTokenIds).to.deep.eq(tokenIdsOfEditions[currentEditionId]);
      }
    });
  });

  describe('getOwnersOfEdition', () => {
    it('returns correct list of owners', async () => {
      const totalQuantity = 30;
      const editionCount = 3;
      await setUpContract({ editionCount, quantity: BigNumber.from(totalQuantity / editionCount) });
      const [_, ...buyers] = await ethers.getSigners();

      const ownersOfEditions = {
        1: [],
        2: [],
        3: [],
      };
      for (let tokenId = 1; tokenId < totalQuantity; tokenId++) {
        let currentEditionId = (tokenId % editionCount) + 1; // loops through editions
        const currentBuyer = buyers[tokenId % buyers.length]; // loops through buyers
        await artist.connect(currentBuyer).buyEdition(currentEditionId, {
          value: price,
        });
        ownersOfEditions[currentEditionId].push(currentBuyer.address);
        const ownersOfEdition = await artist.getOwnersOfEdition(currentEditionId);
        expect(ownersOfEdition).to.deep.eq(ownersOfEditions[currentEditionId]);
      }
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
        await artist.connect(currentBuyer).buyEdition(currentEditionId, {
          value: price,
        });
        const totalSupply = await artist.totalSupply();
        expect(totalSupply.toString()).to.eq(tokenId.toString());
      }
      const totalSupply = await artist.totalSupply();
      expect(totalSupply.toString()).to.eq(totalQuantity.toString());
    });
  });

  describe('royaltyInfo', () => {
    it('returns royalty info', async () => {
      const [_, alice, bob, carl] = await ethers.getSigners();

      const royalty1 = BigNumber.from(10);
      const salePrice1 = ethers.utils.parseEther('1.123');
      await setUpContract({ royaltyBPS: BigNumber.from(royalty1), fundingRecipient: alice });
      const editionInfo1 = await artist.royaltyInfo(EDITION_ID, salePrice1);
      const royaltyAmount1 = royalty1.mul(salePrice1).div(BigNumber.from(10_000));

      expect(editionInfo1.royaltyAmount.toString()).to.eq(royaltyAmount1.toString());
      expect(editionInfo1.fundingRecipient).to.eq(alice.address);

      const royalty2 = BigNumber.from(750);
      const salePrice2 = ethers.utils.parseEther('5.398');
      await setUpContract({ royaltyBPS: BigNumber.from(royalty2), fundingRecipient: bob });
      const editionInfo2 = await artist.royaltyInfo(EDITION_ID, salePrice2);
      const royaltyAmount2 = royalty2.mul(salePrice2).div(BigNumber.from(10_000));

      expect(editionInfo2.royaltyAmount.toString()).to.eq(royaltyAmount2.toString());
      expect(editionInfo2.fundingRecipient).to.eq(bob.address);

      const royalty3 = BigNumber.from(9503);
      const salePrice3 = ethers.utils.parseEther('5035.1210003983');
      await setUpContract({ royaltyBPS: BigNumber.from(royalty3), fundingRecipient: carl });
      const editionInfo3 = await artist.royaltyInfo(EDITION_ID, salePrice3);
      const royaltyAmount3 = royalty3.mul(salePrice3).div(BigNumber.from(10_000));

      expect(editionInfo3.royaltyAmount.toString()).to.eq(royaltyAmount3.toString());
      expect(editionInfo3.fundingRecipient).to.eq(carl.address);
    });
  });
}
