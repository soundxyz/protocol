import { parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';

const MAX_UINT32 = 4294967295;
const currentSeconds = () => Math.floor(Date.now() / 1000);

task('createEdition', 'Create NFT edition')
  .addParam('address', 'Artist contract address')
  .addParam('artistVersion', 'Artist contract version number')
  .setAction(async (args, hardhat) => {
    const { ethers, network } = hardhat;

    console.log({ network: network.name });

    const [deployer] = await ethers.getSigners();
    const artistContract = await ethers.getContractAt(`ArtistV${args.artistVersion}`, args.address, deployer);

    const tx = await artistContract.createEdition(
      deployer.address, // funding recipient
      parseEther('0.1'), // price
      1, // quantity
      0, // royalty
      currentSeconds(), // start time
      MAX_UINT32, // end time
      0, // permissioned quantity
      deployer.address, // signer
      { gasLimit: 1_000_000 }
    );

    console.log(`Transaction initiated. hash: ${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      console.error('Transaction failed.');
    } else {
      console.log(`Transaction confirmed.`);
    }
  });
