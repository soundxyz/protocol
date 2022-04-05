import { Wallet } from '@ethersproject/wallet';

import type { Provider } from '@ethersproject/providers';

type CreateArtistWhiteListArgs = {
  chainId: number;
  artistWalletAddr: string;
  privateKey: string;
  provider: Provider;
};

export async function getAuthSignature({
  chainId,
  artistWalletAddr,
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
    artistWallet: artistWalletAddr,
  });

  return signature;
}

type PresaleWhiteListArgs = {
  chainId: number;
  contractAddress: string;
  buyerAddress: string;
  editionId: string;
  privateKey: string;
  provider: Provider;
  ticketNumber?: string;
};

export async function getPresaleSignature({
  chainId,
  contractAddress,
  buyerAddress,
  editionId,
  privateKey,
  provider,
  ticketNumber,
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

  const data: {
    contractAddress: string;
    buyerAddress: string;
    editionId: string;
    ticketNumber?: string;
  } = {
    contractAddress: contractAddress.toLowerCase(),
    buyerAddress,
    editionId,
  };

  // only include requested token id if it is not undefined
  if (ticketNumber !== undefined) {
    EditionInfo.push(
      // Needed to prevent multiple purchases from the same address
      { name: 'ticketNumber', type: 'uint256' },
    );

    data.ticketNumber = ticketNumber;
  }

  const signature = await wallet._signTypedData(domainSeparator, { EditionInfo }, data);

  return signature;
}
