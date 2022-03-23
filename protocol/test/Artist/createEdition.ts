import { expect } from 'chai';
import { BigNumber } from 'ethers';

import Config from '../Config';
import { currentSeconds } from '../helpers';

export function createEditionTests(c: Config) {
  const { setUpContract, EDITION_ID, MAX_UINT32, NULL_ADDRESS } = c;

  it(`event logs return correct info`, async () => {
    const {
      eventData,
      fundingRecipient,
      quantity,
      price,
      royaltyBPS,
      startTime,
      endTime,
      permissionedQuantity,
      signerAddress,
    } = await setUpContract({ editionCount: 2 });

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
    const {
      artistContract,
      fundingRecipient,
      quantity,
      price,
      royaltyBPS,
      startTime,
      endTime,
      permissionedQuantity,
      signerAddress,
    } = await setUpContract({ editionCount: 2 });

    const edition = await artistContract.editions(EDITION_ID);

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
    const { artistContract, miscAccounts, quantity, price, royaltyBPS, startTime, endTime, permissionedQuantity } =
      await setUpContract();

    for (const notOwner of miscAccounts) {
      const tx = artistContract
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

  it(`allows setting permissioned quantity greater than quantity (open edition)`, async () => {
    const { artistContract, artistAccount, price, royaltyBPS, endTime, soundOwner } = await setUpContract({
      editionCount: 0,
    });
    const permissionedQuantity = BigNumber.from(MAX_UINT32);
    const quantity = BigNumber.from(25);
    const startTime = BigNumber.from(currentSeconds() + 99999999);

    const tx = await artistContract
      .connect(artistAccount)
      .createEdition(
        artistAccount.address,
        price,
        quantity,
        royaltyBPS,
        startTime,
        endTime,
        permissionedQuantity,
        soundOwner.address
      );

    const receipt = await tx.wait();

    await expect(receipt.status).to.equal(1);
  });

  it(`reverts if no quantity is given`, async () => {
    const {
      artistContract,
      artistAccount,
      price,
      royaltyBPS,
      endTime,
      fundingRecipient,
      startTime,
      permissionedQuantity,
      signerAddress,
    } = await setUpContract({ skipCreateEditions: true });

    const quantity = BigNumber.from(0);
    const tx = artistContract
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
    const {
      artistContract,
      artistAccount,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
      permissionedQuantity,
      signerAddress,
    } = await setUpContract({ skipCreateEditions: true });

    const fundingRecipient = NULL_ADDRESS;
    const tx = artistContract
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
    const {
      artistContract,
      artistAccount,
      fundingRecipient,
      price,
      quantity,
      royaltyBPS,
      permissionedQuantity,
      signerAddress,
    } = await setUpContract({ skipCreateEditions: true });

    const startTime = BigNumber.from(1);
    const endTime = BigNumber.from(0);

    const tx = artistContract
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

  it(`reverts if signature not provided for permissioned sale`, async () => {
    const { artistContract, artistAccount, price, royaltyBPS, startTime, endTime } = await setUpContract({
      skipCreateEditions: true,
    });

    const tx = artistContract
      .connect(artistAccount)
      .createEdition(artistAccount.address, price, 2, royaltyBPS, startTime, endTime, 1, NULL_ADDRESS);

    await expect(tx).to.revertedWith('Signer address cannot be 0');
  });
}
