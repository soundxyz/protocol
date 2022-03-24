import { parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';

import { currentSeconds, MAX_UINT32, NULL_ADDRESS } from '../helpers';

task('create-edition', 'Create NFT edition')
  .addParam('address', 'Artist contract address')
  .setAction(async (args, hardhat) => {
    const { ethers } = hardhat;

    if (!args.artistAddress) {
      throw new Error('Must include artistAddress');
    }

    const [deployer] = await ethers.getSigners();
    const artistContract = await ethers.getContractAt(`ArtistV${args.artistVersion}`, args.artistAddress, deployer);

    const tx = await artistContract.createEdition(
      deployer.address, // funding recipient
      parseEther('0.1'), // price
      10, // quantity
      0, // royalty
      currentSeconds(), // start time
      MAX_UINT32, // end time
      0, // permissioned quantity
      NULL_ADDRESS // signer
    );

    console.log(`Transaction initiated. hash: ${tx.hash}`);
    console.log('Waiting for 5 network confirmations...');

    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      console.error('Transaction failed.');
    } else {
      console.log(`Transaction confirmed.`);
    }
  });
