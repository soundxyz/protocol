import { helpers as commonHelpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import Config from '../Config';
import { getRandomBN, getRandomInt, getTokenId } from '../helpers';

const { getPresaleSignature } = commonHelpers;

export function setSignerAddressTests(config: Config) {
  const { setUpContract, EDITION_ID, NULL_ADDRESS } = config;

  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract();

    const tx = artistContract.connect(miscAccounts[0]).setSignerAddress(EDITION_ID, NULL_ADDRESS);

    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('prevents attempt to set null address', async () => {
    const { artistContract, artistAccount } = await setUpContract();

    const tx = artistContract.connect(artistAccount).setSignerAddress(EDITION_ID, NULL_ADDRESS);

    await expect(tx).to.be.revertedWith('Signer address cannot be 0');
  });

  it('sets a new signer address for the edition', async () => {
    const { artistContract, artistAccount, miscAccounts } = await setUpContract();
    const newSigner = miscAccounts[0];

    const tx = await artistContract.connect(artistAccount).setSignerAddress(EDITION_ID, newSigner.address);
    await tx.wait();

    const editionInfo = await artistContract.editions(EDITION_ID);

    await expect(editionInfo.signerAddress).to.equal(newSigner.address);
  });

  it('emits event', async () => {
    const { artistContract, artistAccount, miscAccounts } = await setUpContract();
    const newSigner = miscAccounts[0];

    const tx = await artistContract.connect(artistAccount).setSignerAddress(EDITION_ID, newSigner.address);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === 'SignerAddressSet');

    await expect(event.args.editionId.toString()).to.eq(EDITION_ID);
    await expect(event.args.signerAddress).to.eq(newSigner.address);
  });
}

export function setPermissionedQuantityTests(config: Config) {
  const { setUpContract, EDITION_ID } = config;

  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract();
    const notOwner = miscAccounts[0];

    const tx = artistContract.connect(notOwner).setPermissionedQuantity(EDITION_ID, 69);

    await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('prevents attempt to set permissioned quantity when there is no signer address', async () => {
    const { artistContract, artistAccount } = await setUpContract({ quantity: BigNumber.from(69), signer: null });

    const tx = artistContract.connect(artistAccount).setPermissionedQuantity(EDITION_ID, 1);

    await expect(tx).to.be.revertedWith('Edition must have a signer');
  });

  it('sets a new permissioned quantity for the edition', async () => {
    const newPermissionedQuantity = 420;
    const { artistContract, artistAccount } = await setUpContract({
      quantity: BigNumber.from(420),
      permissionedQuantity: BigNumber.from(69),
    });

    const tx = await artistContract.connect(artistAccount).setPermissionedQuantity(EDITION_ID, newPermissionedQuantity);
    await tx.wait();

    const editionInfo = await artistContract.editions(EDITION_ID);

    await expect(editionInfo.permissionedQuantity.toString()).to.equal(newPermissionedQuantity.toString());
  });

  it('emits event', async () => {
    const newPermissionedQuantity = 420;
    const { artistContract, artistAccount } = await setUpContract({
      quantity: BigNumber.from(420),
      permissionedQuantity: BigNumber.from(69),
    });
    const tx = await artistContract.connect(artistAccount).setPermissionedQuantity(EDITION_ID, newPermissionedQuantity);
    const receipt = await tx.wait();

    const event = receipt.events.find((e) => e.event === 'PermissionedQuantitySet');

    await expect(event.args.editionId.toString()).to.equal(EDITION_ID);
    await expect(event.args.permissionedQuantity.toString()).to.equal(newPermissionedQuantity.toString());
  });
}

export async function getApprovedTests(config: Config) {
  const { setUpContract, EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM } = config;

  it('returns the receiver address', async () => {
    const TOKEN_COUNT = '1';
    const { artistContract, miscAccounts, price } = await setUpContract();

    const [receiver, buyer] = miscAccounts;

    await artistContract.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });

    const tokenId = getTokenId(EDITION_ID, TOKEN_COUNT);
    await artistContract.connect(buyer).approve(receiver.address, tokenId);
    const approved = await artistContract.getApproved(tokenId);
    await expect(approved).to.eq(receiver.address);
  });
}

export async function transferFromTests(config: Config) {
  const { setUpContract, EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM } = config;

  it('reverts when not approved', async () => {
    const { price, artistContract, miscAccounts } = await setUpContract();

    const [receiver, buyer] = miscAccounts;

    await artistContract.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });

    const tokenId = getTokenId(EDITION_ID, '1');
    const tx = artistContract.transferFrom(buyer.address, receiver.address, tokenId);

    await expect(tx).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
  });

  it('transfers when approved', async () => {
    const { artistContract, miscAccounts, price } = await setUpContract();

    const [receiver, buyer] = miscAccounts;
    const TOKEN_COUNT = '1';

    await artistContract.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });

    const tokenId = getTokenId(EDITION_ID, TOKEN_COUNT);

    await artistContract.connect(buyer).approve(receiver.address, tokenId);
    await artistContract.connect(receiver).transferFrom(buyer.address, receiver.address, tokenId);

    const owner = await artistContract.ownerOf(tokenId);
    const buyerBalance = await artistContract.balanceOf(buyer.address);
    const receiverBalance = await artistContract.balanceOf(receiver.address);

    await expect(owner).to.eq(receiver.address);
    await expect(buyerBalance.toString()).to.eq('0');
    await expect(receiverBalance.toString()).to.eq('1'); // now owns one token
  });
}

export async function totalSupplyTests(config: Config) {
  const { setUpContract, EMPTY_SIGNATURE, NULL_TICKET_NUM } = config;

  it('returns correct total supply', async () => {
    const totalQuantity = 30;
    const editionCount = 3;
    const { miscAccounts, price, artistContract } = await setUpContract({
      editionCount,
      quantity: BigNumber.from(totalQuantity / editionCount),
    });

    for (let tokenId = 1; tokenId <= totalQuantity; tokenId++) {
      let currentEditionId = (tokenId % editionCount) + 1; // loops through editions
      const currentBuyer = miscAccounts[tokenId % miscAccounts.length];
      await artistContract.connect(currentBuyer).buyEdition(currentEditionId, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });
      const totalSupply = await artistContract.totalSupply();
      await expect(totalSupply.toString()).to.eq(tokenId.toString());
    }
    const totalSupply = await artistContract.totalSupply();
    await expect(totalSupply.toString()).to.eq(totalQuantity.toString());
  });
}

export async function contractURITests(config: Config) {
  const { setUpContract, BASE_URI, EXAMPLE_ARTIST_ID } = config;

  it('returns expected URI', async () => {
    const { artistContract } = await setUpContract();

    const uri = await artistContract.contractURI();

    expect(uri).to.equal(`${BASE_URI}${EXAMPLE_ARTIST_ID}/storefront`);
  });
}

export async function royaltyInfoTests(config: Config) {
  const { provider, setUpContract, NULL_ADDRESS, EDITION_ID, CHAIN_ID } = config;

  it('returns no royalty info for non-existent token', async () => {
    const { artistContract } = await setUpContract();

    const royalty = BigNumber.from(10_000);
    await setUpContract({ royaltyBPS: BigNumber.from(royalty) });

    const secondarySalePrice = ethers.utils.parseEther(getRandomBN().toString());
    const expectedRoyaltyInfo = await artistContract.royaltyInfo('1', secondarySalePrice);

    await expect(expectedRoyaltyInfo.royaltyAmount.toString()).to.eq('0');
    await expect(expectedRoyaltyInfo.fundingRecipient).to.eq(NULL_ADDRESS);
  });

  it('returns royalty info', async () => {
    const royalty = BigNumber.from(getRandomInt(1, 10_000));

    for (let i = 1; i < 5; i++) {
      const { miscAccounts, artistContract, fundingRecipient, price } = await setUpContract({
        royaltyBPS: BigNumber.from(royalty),
        editionCount: i,
      });
      const editionId = i;
      const currentBuyer = miscAccounts[i];
      const secondarySalePrice = ethers.utils.parseEther(getRandomBN().toString());

      const ticketNumber = i.toString();
      const signature = await getPresaleSignature({
        chainId: CHAIN_ID,
        provider,
        editionId: EDITION_ID,
        ticketNumber,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: currentBuyer.address,
      });
      const tx = await artistContract.connect(currentBuyer).buyEdition(editionId, signature, ticketNumber, {
        value: price,
      });
      await tx.wait();

      // Since we instantiate the contract and only buy 1 token each time, the token id will always be 1
      const tokenId = getTokenId(editionId, 1);
      const expectedRoyaltyInfo = await artistContract.royaltyInfo(tokenId, secondarySalePrice);
      const royaltyAmount = royalty.mul(secondarySalePrice).div(BigNumber.from(10_000));

      await expect(expectedRoyaltyInfo.royaltyAmount.toString()).to.eq(royaltyAmount.toString());
      await expect(expectedRoyaltyInfo.fundingRecipient).to.eq(fundingRecipient.address);
    }
  });
}

export async function editionCountTests(config: Config) {
  const { setUpContract } = config;

  it('returns the correct number of editions', async () => {
    const editionCount = 42;
    const { artistContract } = await setUpContract({ editionCount });

    const expectedCount = await artistContract.editionCount();

    await expect(editionCount).to.eq(expectedCount.toNumber());
  });
}

export async function ownersOfTokenIdsTests(config: Config) {
  const { setUpContract, EMPTY_SIGNATURE, EDITION_ID } = config;

  it('returns the correct list of owners', async () => {
    const editionQuantity = 10;
    const editionCount = 3;
    const { miscAccounts, artistContract, price } = await setUpContract({ editionCount, quantity: BigNumber.from(10) });

    const tokenIds = [];
    const expectedOwners = [];
    for (let editionId = 1; editionId <= editionCount; editionId++) {
      for (let ticketNumber = 0; ticketNumber < editionQuantity; ticketNumber++) {
        const currentBuyer = miscAccounts[ticketNumber % miscAccounts.length]; // loops over buyers
        await artistContract.connect(currentBuyer).buyEdition(editionId, EMPTY_SIGNATURE, ticketNumber, {
          value: price,
        });
        const numSold = ticketNumber + 1;
        const expectedTokenId = getTokenId(editionId, numSold);
        expectedOwners.push(currentBuyer.address);
        tokenIds.push(expectedTokenId);
      }
    }
    const actualOwners = await artistContract.ownersOfTokenIds(tokenIds);
    await expect(expectedOwners).to.deep.eq(actualOwners);
  });

  it('reverts when passed a nonexistent token', async () => {
    const { artistContract, price } = await setUpContract();
    const [_, buyer] = await ethers.getSigners();

    const tokenIds = [];
    const expectedOwners = [];
    await artistContract.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, 1, {
      value: price,
    });
    const expectedTokenId = getTokenId(EDITION_ID, 1);
    expectedOwners.push(buyer.address);
    tokenIds.push(expectedTokenId.add(69));

    const ownersResponse = artistContract.ownersOfTokenIds(tokenIds);
    await expect(ownersResponse).to.be.revertedWith('ERC721: owner query for nonexistent token');
  });
}
