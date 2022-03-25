// import { smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, waffle } from 'hardhat';

import { BASE_URI, getRandomBN } from './helpers';

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
    const [soundOwner, artistAccount, goldenEggImpersonator, ...miscAccounts] = signers;

    // const fakeGoldenEggContract = await smock.fake<Contract>(
    //   await ethers.getContractFactory('GoldenEgg'),
    //   { address: await goldenEggImpersonator.getAddress() } // This allows us to use an ethers override {from: Mock__L2CrossDomainMessenger.address} to mock calls
    // );
    const artistContract = await this.deployContract(artistAccount, soundOwner);

    const price = customConfig.price || parseEther('0.1');
    const quantity = customConfig.quantity || getRandomBN();
    const royaltyBPS = customConfig.royaltyBPS || BigNumber.from(0);
    const startTime = customConfig.startTime || BigNumber.from(0x0); // default to start of unix epoch
    const endTime = customConfig.endTime || BigNumber.from(this.MAX_UINT32);
    const fundingRecipient = customConfig.fundingRecipient || artistAccount;
    const permissionedQuantity = customConfig.permissionedQuantity || 0;
    const signerAddress = customConfig.signer === null ? this.NULL_ADDRESS : soundOwner.address;
    const baseURL = BASE_URI;
    const name = 'ample time';
    const description = `Time is the greatest currency.`;
    const externalURL = 'https://www.sound.xyz/oshi/ample-time';
    const imageURI = 'QmXzvK4ByYa6yytBULcQzTueRoAV2efPETKUMFCMF5iXDp';
    const audioURI = 'QmTLiCvEvs5DS8qQb7mHCwqyfuiKFfdW8P2R9h7vTc1D8m';
    const animationURI = 'QmTLiCvEvs5DS8qQb7mHCwqyfuiKFfdW8P2R9h7vTc1D8m';
    const commentWallURI = 'QmcfyRynEGx2E5w1pTYFNX6CQjZWAYxqbuzki9XUkt2zqG';
    const attributes = JSON.stringify([
      {
        trait_type: 'ample time',
        value: 'Golden Egg',
      },
    ]);
    const metadata = [
      name,
      description,
      externalURL,
      imageURI,
      audioURI,
      animationURI,
      commentWallURI,
      attributes,
      baseURL,
    ];

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
            signerAddress,
            metadata
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
