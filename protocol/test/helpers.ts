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
export const getRandomInt = (max?: number) => Math.floor(Math.random() * (max || MAX_UINT32));
export const getRandomBN = (max?: number) => {
  const rando = BigNumber.from(ethers.utils.randomBytes(4));
  if (max) {
    return rando.mod(max.toString());
  }
  return rando;
};

export const deployArtistBeacon = async (soundOwner: SignerWithAddress) => {
  const Artist = await ethers.getContractFactory('Artist');

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
