import type { Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';

type SignWhiteListArgs = {
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
}: SignWhiteListArgs) {
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
