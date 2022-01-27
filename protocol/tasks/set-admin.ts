import { ethers } from 'ethers';
import { task } from 'hardhat/config';

const MAX_GAS_PRICE = 140_000_000_000; // wei

task('set-admin')
  .addParam('admin', 'The address of the new admin')
  .setAction(async (args, hardhat) => {
    const { admin } = args;
    const { ethers, deployments } = hardhat;
    const [soundDeployer] = await ethers.getSigners();

    // await deployments.g
    const gasPrice = await ethers.provider.getGasPrice();
    const ArtistCreator = await deployments.get('ArtistCreator');
    const artistCreator = new ethers.Contract(ArtistCreator.address, ArtistCreator.abi, soundDeployer);

    const currentAdmin = await artistCreator.admin();

    console.log({ currentAdmin });

    // Bail out if we're deploying to mainnet and gas is too high
    if (gasPrice.gt(MAX_GAS_PRICE)) {
      console.log(`Gas price is too high!: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
      return;
    }

    const tx = await artistCreator.setAdmin(admin, {
      gasLimit: 50_000,
    });
    console.log('transaction started:', tx.hash);
    const receipt = await tx.wait();

    console.log(receipt);

    const expectedAdmin = await artistCreator.admin();
    console.log('new admin: ', expectedAdmin);
  });
