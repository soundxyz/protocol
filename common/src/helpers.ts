import { Wallet } from '@ethersproject/wallet';

import type { Provider } from '@ethersproject/providers';

type CreateArtistWhiteListArgs = {
  chainId: number;
  deployerAddress: string;
  privateKey: string;
  provider: Provider;
};

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

type PresaleWhiteListArgs = {
  chainId: number;
  contractAddress: string;
  buyerAddress: string;
  editionId: string;
  requestedTokenId?: string;
  privateKey: string;
  provider: Provider;
};

export async function getPresaleSignature({
  chainId,
  contractAddress,
  buyerAddress,
  editionId,
  privateKey,
  provider,
  requestedTokenId,
}: PresaleWhiteListArgs) {
  const wallet = new Wallet(privateKey, provider);

  const domainSeparator = {
    chainId,
  };

  const EditionInfo = [
    // Needed to prevent reuse of signature from another artist contract
    { name: 'contractAddress', type: 'address' },
    // Needed to prevent reuse of signature from another buyer
    { name: 'buyerAddress', type: 'address' },
    // Needed to prevent reuse of signature from another edition
    { name: 'editionId', type: 'uint256' },
  ];

  // only include requested token id if it is not undefined
  if (requestedTokenId) {
    EditionInfo.push(
      // Needed to prevent multiple purchases from the same address
      { name: 'requestedTokenId', type: 'uint256' },
    );
  }

  const signature = await wallet._signTypedData(
    domainSeparator,
    { EditionInfo },
    {
      contractAddress: contractAddress.toLowerCase(),
      buyerAddress,
      editionId,
      requestedTokenId,
    },
  );

  return signature;
}
