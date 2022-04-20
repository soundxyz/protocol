import { helpers as commonHelpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import Config from '../Config';

const { getPresaleSignature } = commonHelpers;

export async function endToEndTests(config: Config) {
  const { setUpContract, provider, EDITION_ID, EMPTY_SIGNATURE } = config;

  it(`successfully buys during public sale, and successfully withdraws`, async () => {
    const quantity = 10;
    const { artistContract, fundingRecipient, price, miscAccounts, soundOwner } = await setUpContract({
      quantity: BigNumber.from(quantity),
    });

    const artistWalletInitBalance = await provider.getBalance(fundingRecipient.address);
    const artistContractInitBalance = await provider.getBalance(artistContract.address);

    for (let count = 1; count <= quantity; count++) {
      const revenue = price.mul(count);
      const currentBuyer = miscAccounts[count];
      const ticketNumber = count;
      await artistContract.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, ticketNumber, {
        value: price,
      });
      const contractBalance = await provider.getBalance(artistContract.address);
      await expect(contractBalance.toString()).to.eq(revenue.add(artistContractInitBalance).toString());
    }

    // using soundOwner to withdraw so we don't have to encorporate gas fee when making assertions
    await artistContract.connect(soundOwner).withdrawFunds(EDITION_ID);

    const postWithdrawBalance = await provider.getBalance(artistContract.address);
    const recipientBalance = await provider.getBalance(fundingRecipient.address);
    const totalRevenue = price.mul(quantity);

    // All the funds are withdrawn
    await expect(postWithdrawBalance.toString()).to.eq('0');
    await expect(recipientBalance.toString()).to.eq(artistWalletInitBalance.add(totalRevenue));
  });

  it(`successfully buys during permissioned sale beyond quantity and reverts additional purchases after public sale start time`, async () => {
    const chainId = (await provider.getNetwork()).chainId;
    const quantity = 1;
    const permissionedQuantity = quantity + 1;

    const blockNum = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNum);
    const secondsUntilStart = 10;
    const startTime = BigNumber.from(block.timestamp).add(secondsUntilStart);

    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(quantity),
      permissionedQuantity: BigNumber.from(permissionedQuantity),
      startTime,
    });

    const artistContractInitBalance = await provider.getBalance(artistContract.address);

    for (let count = 1; count <= permissionedQuantity; count++) {
      const revenue = price.mul(count);
      const currentBuyer = miscAccounts[count];
      const ticketNumber = count.toString();
      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        ticketNumber,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: currentBuyer.address,
      });

      await artistContract.connect(currentBuyer).buyEdition(EDITION_ID, signature, ticketNumber, {
        value: price,
      });

      const contractBalance = await provider.getBalance(artistContract.address);
      await expect(contractBalance.toString()).to.eq(revenue.add(artistContractInitBalance).toString());
    }

    // Jump to after the startTime
    await provider.send('evm_setNextBlockTimestamp', [startTime.add(100).toNumber()]);

    const finalBuyer = miscAccounts[permissionedQuantity + 1];
    const finalTicketNum = (permissionedQuantity + 1).toString();
    const signature = await getPresaleSignature({
      chainId,
      provider,
      editionId: EDITION_ID,
      ticketNumber: finalTicketNum,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: finalBuyer.address,
    });

    const revertedTx = artistContract.connect(finalBuyer).buyEdition(EDITION_ID, signature, finalTicketNum, {
      value: price,
    });

    await expect(revertedTx).to.be.revertedWith('This edition is already sold out');
  });

  it(`successfully buys during permissioned sale, and after public sale if quantity hasn't been reached`, async () => {
    const chainId = (await provider.getNetwork()).chainId;
    const quantity = 10;
    const permissionedQuantity = quantity;

    const blockNum = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNum);
    const secondsUntilStart = 10;
    const startTime = BigNumber.from(block.timestamp).add(secondsUntilStart);

    const { artistContract, price, miscAccounts } = await setUpContract({
      quantity: BigNumber.from(quantity),
      permissionedQuantity: BigNumber.from(permissionedQuantity),
      startTime,
    });

    const artistContractInitBalance = await provider.getBalance(artistContract.address);

    for (let count = 1; count <= permissionedQuantity - 1; count++) {
      const revenue = price.mul(count);
      const currentBuyer = miscAccounts[count];
      const ticketNumber = count.toString();
      const signature = await getPresaleSignature({
        chainId,
        provider,
        editionId: EDITION_ID,
        ticketNumber,
        privateKey: process.env.ADMIN_PRIVATE_KEY,
        contractAddress: artistContract.address,
        buyerAddress: currentBuyer.address,
      });

      await artistContract.connect(currentBuyer).buyEdition(EDITION_ID, signature, ticketNumber, {
        value: price,
      });

      const contractBalance = await provider.getBalance(artistContract.address);
      await expect(contractBalance.toString()).to.eq(revenue.add(artistContractInitBalance).toString());
    }

    // Jump to after the startTime
    await provider.send('evm_setNextBlockTimestamp', [startTime.add(100).toNumber()]);

    const finalBuyer = miscAccounts[permissionedQuantity + 1];
    const finalTicketNum = (permissionedQuantity + 1).toString();
    const signature = await getPresaleSignature({
      chainId,
      provider,
      editionId: EDITION_ID,
      ticketNumber: finalTicketNum,
      privateKey: process.env.ADMIN_PRIVATE_KEY,
      contractAddress: artistContract.address,
      buyerAddress: finalBuyer.address,
    });

    const editionInfo = await artistContract.editions(EDITION_ID);

    // There should be one more token left at this point
    expect(editionInfo.numSold).to.equal(quantity - 1);

    const tx = await artistContract.connect(finalBuyer).buyEdition(EDITION_ID, signature, finalTicketNum, {
      value: price,
    });

    const receipt = await tx.wait();

    await expect(receipt.status).to.equal(1);
  });
}
