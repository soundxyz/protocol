import { helpers as commonHelpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import Config from '../Config';
import { currentSeconds, deployArtistProxy, getTokenId } from '../helpers';

const { getPresaleSignature } = commonHelpers;

export function buyEditionTests(config: Config) {
  const {
    setUpContract,
    provider,
    EDITION_ID,
    MAX_UINT32,
    EXAMPLE_ARTIST_ID,
    BASE_URI,
    EMPTY_SIGNATURE,
    INVALID_PRIVATE_KEY,
    NULL_TICKET_NUM,
    CHAIN_ID,
  } = config;

  it(`reverts with "Edition does not exist" when expected`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract();

    const tx = artistContract.connect(miscAccounts[0]).buyEdition('69420', EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });
    await expect(tx).to.be.revertedWith('Edition does not exist');
  });

  it(`reverts with "This edition is already sold out" when expected`, async () => {
    const quantity = 5;
    const { artistContract, price, miscAccounts } = await setUpContract({ quantity: BigNumber.from(quantity) });

    for (let i = 1; i <= quantity; i++) {
      await artistContract.connect(miscAccounts[i]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });
    }

    const tx = artistContract
      .connect(miscAccounts[quantity + 1])
      .buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });
    await expect(tx).to.be.revertedWith('This edition is already sold out');
  });

  it(`reverts if there are no permissioned tokens and open auction hasn't started`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      startTime: BigNumber.from(currentSeconds() + 99999999),
      permissionedQuantity: BigNumber.from(0),
    });

    const purchaser = miscAccounts[0];

    const tx = artistContract.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });
    await expect(tx).to.be.revertedWith(`No permissioned tokens available & open auction not started`);
  });

  it(`reverts if permissioned quantity is sold out and open auction hasn't started`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(2),
      permissionedQuantity: BigNumber.from(1),
      startTime: BigNumber.from(currentSeconds() + 99999999),
      editionCount: 0,
    });

    const buyer = miscAccounts[0];
    const ticketNumber = '0';
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber: ticketNumber,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });

    const tx1 = await artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, {
      value: price,
    });
    const receipt = await tx1.wait();

    const tx2 = artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, {
      value: price,
    });

    await expect(receipt.status).to.equal(1);

    await expect(tx2).to.be.revertedWith('No permissioned tokens available & open auction not started');
  });

  it(`reverts if ticket number exceeds maximum`, async () => {
    // permissioned quantity max == uint32.max - 1
    const permissionedQuantity = BigNumber.from(MAX_UINT32);

    const { artistContract, price } = await setUpContract({
      permissionedQuantity,
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });
    const [_, buyer] = await ethers.getSigners();

    const ticketNum1 = permissionedQuantity.add(1); // add one to put it out of range
    const presaleSig1 = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber: ticketNum1.toString(),
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });
    const tx1 = artistContract.connect(buyer).buyEdition(EDITION_ID, presaleSig1, ticketNum1, {
      value: price,
    });

    await expect(tx1).to.be.revertedWith('Ticket number exceeds max');
  });

  it(`reverts with "Auction has ended" when expected`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      endTime: BigNumber.from(currentSeconds() - 1),
    });

    const purchaser = miscAccounts[0];
    const tx = artistContract.connect(purchaser).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });

    await expect(tx).to.be.revertedWith(`Auction has ended`);
  });

  it(`reverts if signature is null`, async () => {
    const { artistContract, price } = await setUpContract({
      permissionedQuantity: BigNumber.from(1),
      quantity: BigNumber.from(1),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });

    const ticketNumber = '0';
    const tx = artistContract.buyEdition(EDITION_ID, EMPTY_SIGNATURE, ticketNumber, {
      value: price,
    });

    await expect(tx).to.be.revertedWith('ECDSA: invalid signature');
  });

  it(`reverts if signature is for the wrong artist contract`, async () => {
    const { artistContract, price, soundOwner, miscAccounts } = await setUpContract({
      permissionedQuantity: BigNumber.from(1),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });

    const wrongArtistContract = await deployArtistProxy(miscAccounts[0], soundOwner);
    const buyer = miscAccounts[1];
    const ticketNumber = '0';
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: wrongArtistContract.address,
      buyerAddress: buyer.address,
    });

    const tx = artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, {
      value: price,
    });

    await expect(tx).to.be.revertedWith('Invalid signer');
  });

  it(`reverts if signature is signed by wrong address`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      permissionedQuantity: BigNumber.from(1),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });

    const buyer = miscAccounts[10];
    const ticketNumber = '0';
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber,
      privateKey: INVALID_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });

    const tx = artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, {
      value: price,
    });

    await expect(tx).to.be.revertedWith('Invalid signer');
  });

  it(`reverts if signature is for the wrong edition during permissioned sale`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      permissionedQuantity: BigNumber.from(1),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });

    const buyer = miscAccounts[0];
    const wrongEditionId = '666';
    const ticketNumber = '0';
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: wrongEditionId,
      ticketNumber,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });

    const tx = artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, {
      value: price,
    });

    await expect(tx).to.be.revertedWith('Invalid signer');
  });

  it(`reverts if buyer attempts to reuse ticket`, async () => {
    const quantity = 10;

    const { artistContract, price, miscAccounts } = await setUpContract({
      permissionedQuantity: BigNumber.from(quantity),
      quantity: BigNumber.from(quantity),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });

    for (let ticketNumber = 0; ticketNumber < quantity - 1; ticketNumber++) {
      const buyer = miscAccounts[ticketNumber];

      const signature = await getPresaleSignature({
        chainId: CHAIN_ID,
        provider,
        editionId: EDITION_ID,
        ticketNumber: ticketNumber.toString(),
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: buyer.address,
      });

      await artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, { value: price });
      const tx2 = artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, {
        value: price,
      });
      await expect(tx2).to.be.revertedWith('Invalid ticket number or NFT already claimed');
    }
  });

  it(`enables open editions: signed purchases can exceed quantity prior to the public sale start time`, async () => {
    const quantity = 25;
    const permissionedQuantity = 1_000_000;

    const { artistContract, price } = await setUpContract({
      quantity: BigNumber.from(quantity),
      permissionedQuantity: BigNumber.from(permissionedQuantity),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });
    const [_, buyer] = await ethers.getSigners();

    // Test some purchases in order
    for (let ticketNumber = 0; ticketNumber <= quantity * 2; ticketNumber++) {
      const presaleSignature = await getPresaleSignature({
        chainId: CHAIN_ID,
        provider,
        editionId: EDITION_ID,
        ticketNumber: ticketNumber.toString(),
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: buyer.address,
      });

      const tx = await artistContract.connect(buyer).buyEdition(EDITION_ID, presaleSignature, ticketNumber, {
        value: price,
      });
      const receipt = await tx.wait();

      await expect(receipt.status).to.equal(1);
    }

    // test a couple purchases out of order in the higher end of the presale quantity
    const ticketNum1 = (permissionedQuantity - 69).toString();
    const presaleSig1 = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber: ticketNum1,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });
    const tx1 = await artistContract.connect(buyer).buyEdition(EDITION_ID, presaleSig1, ticketNum1, {
      value: price,
    });
    const receipt1 = await tx1.wait();
    await expect(receipt1.status).to.equal(1);

    const ticketNum2 = (permissionedQuantity - 42069).toString();
    const presaleSig2 = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber: ticketNum2,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });
    const tx2 = await artistContract.connect(buyer).buyEdition(EDITION_ID, presaleSig2, ticketNum2, {
      value: price,
    });
    const receipt2 = await tx2.wait();
    await expect(receipt2.status).to.equal(1);
  });

  // This test is to ensure that even if the permissioned doesn't sell out, people can buy during the open sale without needing a signature
  it(`doesn't require signature if public sale has started, permissioned hasn't sold out, and its not a fully whitelisted sale (permissionedQuantity < quantity)`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      permissionedQuantity: BigNumber.from(1),
      quantity: BigNumber.from(2),
      startTime: BigNumber.from(currentSeconds() - 1000),
    });

    const buyer = miscAccounts[0];

    const tx = await artistContract.connect(buyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
      value: price,
    });
    const receipt = await tx.wait();

    await expect(receipt.status).to.equal(1);
  });

  it(`creates an event log for the purchase`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      permissionedQuantity: BigNumber.from(MAX_UINT32),
      quantity: BigNumber.from(5),
      startTime: BigNumber.from(currentSeconds() + 99999999),
    });

    const purchaser = miscAccounts[0];
    const ticketNum = 1;
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      contractAddress: artistContract.address,
      provider,
      editionId: EDITION_ID,
      buyerAddress: purchaser.address,
      ticketNumber: ticketNum.toString(),
      privateKey: process.env.ADMIN_PRIVATE_KEY,
    });
    const tx = await artistContract.connect(purchaser).buyEdition(EDITION_ID, signature, ticketNum, {
      value: price,
    });
    const receipt = await tx.wait();
    const purchaseEvent = artistContract.interface.parseLog(receipt.events[1]).args;

    const TOKEN_COUNT = 1;
    const tokenId = getTokenId(EDITION_ID, TOKEN_COUNT);

    await expect(purchaseEvent.editionId.toString()).to.eq(EDITION_ID);
    await expect(purchaseEvent.tokenId.toString()).to.eq(tokenId);
    await expect(purchaseEvent.buyer.toString()).to.eq(purchaser.address);
    await expect(purchaseEvent.numSold.toString()).to.eq('1');
    await expect(purchaseEvent.ticketNumber.toString()).to.eq(ticketNum.toString());
  });

  it(`updates the number sold for the editions`, async () => {
    const quantity = 5;
    const { artistContract, price, miscAccounts } = await setUpContract({ quantity: BigNumber.from(quantity) });
    let editionData;

    for (let count = 1; count <= quantity; count++) {
      await artistContract.connect(miscAccounts[count]).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });
      editionData = await artistContract.editions(EDITION_ID);
      await expect(editionData.numSold.toString()).to.eq(count.toString());
    }
  });

  it('ownerOf returns the correct owner', async () => {
    const quantity = 5;
    const { artistContract, price, miscAccounts } = await setUpContract({ quantity: BigNumber.from(quantity) });

    for (let tokenSerialNum = 1; tokenSerialNum < quantity; tokenSerialNum++) {
      const currentBuyer = miscAccounts[tokenSerialNum];
      await artistContract
        .connect(miscAccounts[tokenSerialNum])
        .buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
          value: price,
        });
      const tokenId = getTokenId(EDITION_ID, tokenSerialNum);
      const owner = await artistContract.ownerOf(tokenId);
      await expect(owner).to.eq(currentBuyer.address);
    }
  });

  it('increments the balance of the artist contract', async () => {
    const quantity = 5;
    const { artistContract, price, miscAccounts } = await setUpContract({ quantity: BigNumber.from(quantity) });
    const initialBalance = await provider.getBalance(artistContract.address);

    for (let count = 1; count <= quantity; count++) {
      const revenue = price.mul(count);
      const currentBuyer = miscAccounts[count];
      await artistContract.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });
      const finalBalance = await provider.getBalance(artistContract.address);
      await expect(finalBalance.toString()).to.eq(revenue.add(initialBalance).toString());
    }
  });

  it(`sends funds directly to fundingRecipient if not assigned to artist's wallet`, async () => {
    const quantity = 5;
    const signers = await ethers.getSigners();

    // using custom fundingRecipient because the default fundingRecipient is the artist's wallet
    const fundingRecipient = signers[signers.length - 1];

    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(quantity),
      fundingRecipient,
    });

    const initialBalance = await provider.getBalance(fundingRecipient.address);

    for (let count = 1; count <= quantity; count++) {
      const revenue = price.mul(count);
      const currentBuyer = miscAccounts[count];
      await artistContract.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });
      const finalBalance = await provider.getBalance(fundingRecipient.address);
      const artistContractBalance = await provider.getBalance(artistContract.address);

      await expect(finalBalance.toString()).to.eq(revenue.add(initialBalance).toString());
      await expect(artistContractBalance.toString()).to.eq('0');
    }
  });

  it(`tokenURI returns expected string`, async () => {
    const quantity = 10;
    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(quantity),
      editionCount: 3,
    });

    const editionId = 3;

    for (let tokenSerialNum = 1; tokenSerialNum < quantity; tokenSerialNum++) {
      const currentBuyer = miscAccounts[tokenSerialNum % miscAccounts.length];

      await artistContract.connect(currentBuyer).buyEdition(editionId, EMPTY_SIGNATURE, NULL_TICKET_NUM, {
        value: price,
      });

      const tokenId = getTokenId(editionId, tokenSerialNum.toString());
      const resp = await artistContract.tokenURI(tokenId);
      const tokenURI = `${BASE_URI}${EXAMPLE_ARTIST_ID}/${editionId}/${tokenId.toString()}`;

      await expect(resp).to.eq(tokenURI);
    }
  });

  it(`allows purchase if no permissioned exists and quantity remains`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(1),
      permissionedQuantity: BigNumber.from(0),
    });

    const buyer = miscAccounts[0];

    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber: '1',
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });

    const tx = await artistContract.connect(buyer).buyEdition(EDITION_ID, signature, NULL_TICKET_NUM, { value: price });
    const receipt = await tx.wait();

    await expect(receipt.status).to.equal(1);
  });

  it(`allows purchase during permissioned sale`, async () => {
    const quantity = 10;
    const permissionedQuantity = 10;
    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(quantity),
      permissionedQuantity: BigNumber.from(permissionedQuantity),
    });

    for (let i = 0; i < quantity; i++) {
      const buyer = miscAccounts[i];
      const ticketNumber = i + 1;
      const signature = await getPresaleSignature({
        chainId: CHAIN_ID,
        provider,
        editionId: EDITION_ID,
        ticketNumber: ticketNumber.toString(),
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: buyer.address,
      });

      const tx = await artistContract.connect(buyer).buyEdition(EDITION_ID, signature, ticketNumber, { value: price });
      const receipt = await tx.wait();
      await expect(receipt.status).to.equal(1);
    }
  });

  it(`signature is ignored during the open/public sale`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(2),
      permissionedQuantity: BigNumber.from(1),
    });
    const buyer = miscAccounts[0];

    const ticketNumber = '0';
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });

    const purchase1 = await artistContract
      .connect(buyer)
      .buyEdition(EDITION_ID, signature, ticketNumber, { value: price });
    await purchase1.wait();

    const purchase2 = await artistContract.buyEdition(EDITION_ID, EMPTY_SIGNATURE, NULL_TICKET_NUM, { value: price });
    const purchase2Receipt = await purchase2.wait();

    await expect(purchase2Receipt.status).to.equal(1);
  });

  it(`allows purchase if permissioned is sold out but quantity remains`, async () => {
    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(2),
      permissionedQuantity: BigNumber.from(1),
    });
    const buyer = miscAccounts[0];

    const ticketNumber = '0';
    const signature = await getPresaleSignature({
      chainId: CHAIN_ID,
      provider,
      editionId: EDITION_ID,
      ticketNumber,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: buyer.address,
    });

    const purchase1 = await artistContract
      .connect(buyer)
      .buyEdition(EDITION_ID, signature, ticketNumber, { value: price });
    await purchase1.wait();

    const purchase2 = await artistContract.buyEdition(EDITION_ID, signature, NULL_TICKET_NUM, { value: price });
    const purchase2Receipt = await purchase2.wait();

    await expect(purchase2Receipt.status).to.equal(1);
  });
}
