import { constants } from '@soundxyz/common';
import { task } from 'hardhat/config';

const MAX_GAS_PRICE = 150_000_000_000; // wei
const { baseURIs } = constants;

task('deployUpgrade', 'Deploys an upgraded Artist.sol')
  .addParam('artistVersion', 'The version number of the new Artist.sol implementation')
  // .addParam('gasPrice', 'The gas price to use for the transaction')
  .setAction(async (args, hardhat) => {
    const baseURI = baseURIs[hardhat.network.name];
    const dummyArgsForArtistInit = [
      '0xB0A36b3CeDf210f37a5E7BC28d4b8E91D4E3C412', // rinkeby deployer address
      '0',
      `Sound.xyz ArtistV${args.artistVersion}.sol`,
      `SOUND V${args.artistVersion}`,
      baseURI,
    ];

    const { ethers, run, network } = hardhat;
    const currentGasPrice = await ethers.provider.getGasPrice();
    const gasPriceInGwei = ethers.utils.formatUnits(currentGasPrice, 'gwei');

    console.log({ currentGasPrice: gasPriceInGwei });

    // Bail out if we're deploying to mainnet and gas price is too high
    if (network.name === 'mainnet' && currentGasPrice.gt(MAX_GAS_PRICE)) {
      console.log(`Gas price is too high!: ${gasPriceInGwei} gwei`);
      return;
    }

    const ArtistFactory = await ethers.getContractFactory(`ArtistV${args.artistVersion}`);
    const artistUpgrade = await ArtistFactory.deploy();

    console.log(
      `Deploying ArtistV${args.artistVersion}.sol on ${network.name}:`,
      `https://${network.name !== 'mainnet' ? network.name + '.' : ''}etherscan.io/tx/${
        artistUpgrade.deployTransaction.hash
      }`
    );

    const deployReceipt = await artistUpgrade.deployTransaction.wait();

    if (deployReceipt.status === 1) {
      console.log(
        `Deployed: https://${network.name !== 'mainnet' ? network.name + '.' : ''}etherscan.io/address/${
          artistUpgrade.address
        }`
      );
      const initTx = await artistUpgrade.initialize(...dummyArgsForArtistInit, {
        gasLimit: 250_000,
      });

      console.log('Initialization started:', initTx.hash);
      await initTx.wait();

      console.log('Initialization confirmed. Verifying on etherscan...');

      const options: any = {
        address: artistUpgrade.address,
        constructorArguments: [],
      };

      await run('verify:verify', options);
    }
  });
