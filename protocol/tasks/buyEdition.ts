import { parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';

export const EMPTY_SIGNATURE =
  '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

task('buyEdition', 'Buy NFT edition')
  .addParam('address', 'Artist contract address')
  .addParam('editionId', 'edition id')
  .addParam('artistVersion', 'artist contract version')
  .setAction(async (args, hardhat) => {
    const { ethers, network } = hardhat;

    console.log({ network: network.name, ...args });

    const [deployer, account2] = await ethers.getSigners();

    const artistContract = await ethers.getContractAt(`ArtistV${args.artistVersion}`, args.address, deployer);

    const tx = await artistContract.connect(account2).buyEdition(args.editionId, EMPTY_SIGNATURE, '0x0', {
      value: parseEther('0.1'),
      gasLimit: 500_000,
    });

    console.log(`Transaction initiated. hash: ${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      console.error('Transaction failed.');
    } else {
      console.log(`Transaction confirmed.`);
    }
  });
