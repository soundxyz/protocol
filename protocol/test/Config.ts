import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, waffle } from 'hardhat';

import { getRandomBN } from './helpers';

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

class Config {
  isInitialized = false;
  provider = waffle.provider;
  deployContract: Function;
  fundingRecipient: SignerWithAddress;

  EDITION_ID = '1';
  MAX_UINT32 = 4294967295;
  EXAMPLE_ARTIST_NAME = 'Alpha & Omega';
  EXAMPLE_ARTIST_ID = 1;
  EXAMPLE_ARTIST_SYMBOL = 'AOMEGA';
  BASE_URI = `https://sound-staging.vercel.app/api/metadata/`;
  NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
  EMPTY_SIGNATURE =
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  INVALID_PRIVATE_KEY = '0xb73249a6bf495f81385ce91b84cc2eff129011fea429ba7f1827d73b06390208';
  NULL_TICKET_NUM = '0x0';
  CHAIN_ID = 1337;

  constructor(deployContract) {
    this.deployContract = deployContract;
  }

  setUpContract = async (customConfig: CustomMintArgs = {}) => {
    const editionCount = customConfig.editionCount || 1;

    const signers = await ethers.getSigners();
    const [soundOwner, artistAccount, ...miscAccounts] = signers;

    const artistContract = await this.deployContract(artistAccount, soundOwner);

    const price = customConfig.price || parseEther('0.1');
    const quantity = customConfig.quantity || getRandomBN();
    const royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    const startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    const endTime = customConfig.endTime || BigNumber.from(this.MAX_UINT32);
    const fundingRecipient = customConfig.fundingRecipient || artistAccount;
    const permissionedQuantity = customConfig.permissionedQuantity || 0;
    const signerAddress = customConfig.signer === null ? this.NULL_ADDRESS : soundOwner.address;

    let eventData;

    if (!customConfig.skipCreateEditions) {
      for (let i = 0; i < editionCount; i++) {
        const createEditionTx = await artistContract
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
        const contractEvent = artistContract.interface.parseLog(editionReceipt.events[0]);

        // note: if editionCount > 1, this will be the last event emitted
        eventData = contractEvent.args;
      }
    }

    return {
      artistContract,
      fundingRecipient,
      price,
      quantity,
      royaltyBPS,
      startTime,
      endTime,
      permissionedQuantity,
      signerAddress,
      soundOwner,
      artistAccount,
      miscAccounts,
      eventData,
    };
  };
}

export default Config;
