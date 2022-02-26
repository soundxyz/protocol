import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { ArtistV2__factory } from '@soundxyz/protocol/typechain';

import type { Provider } from '@ethersproject/providers';

type CreateArtistWhiteListArgs = {
  chainId: number;
  deployerAddress: string;
  privateKey: string;
  provider: Provider;
};

type PresaleWhiteListArgs = {
  chainId: number;
  contractAddress: string;
  buyerAddress: string;
  editionId: string;
  privateKey: string;
  provider: Provider;
};

/**
 * Generates auth signature for deploying artist contract
 */
export async function getAuthSignature({
  chainId,
  deployerAddress,
  privateKey,
  provider,
}: CreateArtistWhiteListArgs) {
  const wallet = new Wallet(privateKey, provider);

  const domainSeparator = {
    chainId,
  };

  const types = {
    Deployer: [{ name: 'artistWallet', type: 'address' }],
  };

  const signature = await wallet._signTypedData(domainSeparator, types, {
    artistWallet: deployerAddress,
  });

  return signature;
}

/**
 * Generates auth signature for buying a presale edition
 */
export async function getPresaleSignature({
  chainId,
  contractAddress,
  buyerAddress,
  editionId,
  privateKey,
  provider,
}: PresaleWhiteListArgs) {
  const wallet = new Wallet(privateKey, provider);

  const domainSeparator = {
    chainId,
  };

  const types = {
    EditionInfo: [
      // Needed to prevent reuse of signature from another artist contract
      { name: 'contractAddress', type: 'address' },
      // Needed to prevent reuse of signature from another buyer
      { name: 'buyerAddress', type: 'address' },
      // Needed to prevent reuse of signature from another edition
      { name: 'editionId', type: 'uint256' },
    ],
  };

  const signature = await wallet._signTypedData(domainSeparator, types, {
    contractAddress: contractAddress.toLowerCase(),
    buyerAddress,
    editionId,
  });

  return signature;
}

/**
 * Gets current on-chain NFT data for an edition by querying the event logs
 * @param contractAddress Artist contract address
 * @param editionId edition id
 * @param provider blockchain provider
 */
export async function getTokensOfEdition(
  contractAddress: string,
  editionId: string,
  provider: Provider,
) {
  const artistContract = ArtistV2__factory.connect(contractAddress, provider);
  const editionPurchasedFilter = artistContract.filters.EditionPurchased(BigNumber.from(editionId));
  const events = await artistContract.queryFilter(editionPurchasedFilter, 0, 'latest');

  return events;
}

const provider = new JsonRpcProvider(
  `https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
);

(async () => {
  const tokenData = await getTokensOfEdition(
    '0x3bF96aFe2291D76f2934350624080fAefEec9a46',
    '1',
    provider,
  );
  console.log(tokenData);
})();
