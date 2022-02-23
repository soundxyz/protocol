import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers } from '@soundxyz/common';
import { BigNumber, Contract } from 'ethers';
import { ethers, waffle } from 'hardhat';

const { getAuthSignature } = helpers;
const { provider } = waffle;

//========== Constants =========//
export const MAX_UINT32 = 4294967295;
export const EXAMPLE_ARTIST_NAME = 'Alpha & Omega';
export const EXAMPLE_ARTIST_ID = 1;
export const EXAMPLE_ARTIST_SYMBOL = 'AOMEGA';
export const BASE_URI = `https://sound-staging.vercel.app/api/metadata/`;
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const EMPTY_SIGNATURE =
  '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
export const INVALID_PRIVATE_KEY = '0xb73249a6bf495f81385ce91b84cc2eff129011fea429ba7f1827d73b06390208';
export const NULL_TOKEN_ID = '0x0';

//========= Helpers ==========//

export async function createArtist(
  artistCreator: Contract,
  signer: SignerWithAddress,
  artistName: string,
  symbol: string,
  baseURI: string
) {
  const chainId = (await provider.getNetwork()).chainId;

  // Get sound.xyz signature to approve artist creation
  const signature = await getAuthSignature({
    deployerAddress: signer.address,
    privateKey: process.env.ADMIN_PRIVATE_KEY,
    chainId,
    provider,
  });

  return artistCreator.connect(signer).createArtist(signature, artistName, symbol, baseURI);
}

export const currentSeconds = () => Math.floor(Date.now() / 1000);
export const getRandomInt = (min = 0, max = MAX_UINT32) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
export const getRandomBN = (max?: number) => {
  const rando = BigNumber.from(ethers.utils.randomBytes(4));
  if (max) {
    return rando.mod(max.toString());
  }
  return rando;
};

export const deployArtistImplementation = async (soundOwner: SignerWithAddress) => {
  const Artist = await ethers.getContractFactory('ArtistV2');

  const protoArtist = await Artist.deploy();
  await protoArtist.deployed();

  await protoArtist.initialize(
    soundOwner.address,
    EXAMPLE_ARTIST_ID,
    EXAMPLE_ARTIST_NAME,
    EXAMPLE_ARTIST_SYMBOL,
    BASE_URI
  );

  return protoArtist;
};

// shifts edition id to the left by 128 bits and adds the token id in the bottom bits
export const getTokenId = (editionId: number | string, numSold: number | string) => {
  const shiftFactor = BigNumber.from(1).mul(2).pow(128);
  return BigNumber.from(editionId).mul(shiftFactor).add(numSold);
};
