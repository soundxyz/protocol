import '@nomiclabs/hardhat-ethers';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers as commonHelpers } from '@soundxyz/common';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, waffle } from 'hardhat';

import {
  deployArtistImplementation,
  deployArtistProxy,
  EMPTY_SIGNATURE,
  EXAMPLE_ARTIST_NAME,
  getRandomBN,
  MAX_UINT32,
  NULL_ADDRESS,
} from './helpers';

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

const { getPresaleSignature } = commonHelpers;

const { provider } = waffle;

const chainId = 1337;

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

  describe('Artist end-to-end tests', () => {
    it(`successfully buys during public sale, and successfully withdraws`, async () => {
      const quantity = 10;
      await setUpContract({ quantity: BigNumber.from(quantity) });

      const artistWalletInitBalance = await provider.getBalance(fundingRecipient.address);
      const artistContractInitBalance = await provider.getBalance(artist.address);

      for (let count = 1; count <= quantity; count++) {
        const revenue = price.mul(count);
        const currentBuyer = miscAccounts[count];
        const ticketNumber = count;
        await artist.connect(currentBuyer).buyEdition(EDITION_ID, EMPTY_SIGNATURE, ticketNumber, {
          value: price,
        });
        const contractBalance = await provider.getBalance(artist.address);
        await expect(contractBalance.toString()).to.eq(revenue.add(artistContractInitBalance).toString());
      }

      // using soundOwner to withdraw so we don't have to encorporate gas fee when making assertions
      await artist.connect(soundOwner).withdrawFunds(EDITION_ID);

      const postWithdrawBalance = await provider.getBalance(artist.address);
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

      await setUpContract({
        quantity: BigNumber.from(quantity),
        permissionedQuantity: BigNumber.from(permissionedQuantity),
        startTime,
      });

      const artistContractInitBalance = await provider.getBalance(artist.address);

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
          contractAddress: artist.address,
          buyerAddress: currentBuyer.address,
        });

        await artist.connect(currentBuyer).buyEdition(EDITION_ID, signature, ticketNumber, {
          value: price,
        });

        const contractBalance = await provider.getBalance(artist.address);
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
        contractAddress: artist.address,
        buyerAddress: finalBuyer.address,
      });

      const revertedTx = artist.connect(finalBuyer).buyEdition(EDITION_ID, signature, finalTicketNum, {
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

      await setUpContract({
        quantity: BigNumber.from(quantity),
        permissionedQuantity: BigNumber.from(permissionedQuantity),
        startTime,
      });

      const artistContractInitBalance = await provider.getBalance(artist.address);

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
          contractAddress: artist.address,
          buyerAddress: currentBuyer.address,
        });

        await artist.connect(currentBuyer).buyEdition(EDITION_ID, signature, ticketNumber, {
          value: price,
        });

        const contractBalance = await provider.getBalance(artist.address);
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
        contractAddress: artist.address,
        buyerAddress: finalBuyer.address,
      });

      const editionInfo = await artist.editions(EDITION_ID);

      // There should be one more token left at this point
      expect(editionInfo.numSold).to.equal(quantity - 1);

      const tx = await artist.connect(finalBuyer).buyEdition(EDITION_ID, signature, finalTicketNum, {
        value: price,
      });

      const receipt = await tx.wait();

      await expect(receipt.status).to.equal(1);
    });
  });
}
