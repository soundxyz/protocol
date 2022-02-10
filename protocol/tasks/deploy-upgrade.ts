import { task } from 'hardhat/config';

const MAX_GAS_PRICE = 150_000_000_000; // wei

task('deploy-upgrade', 'Deploys an upgraded Artist.sol')
  .addParam('artistVersion', 'The version number of the new Artist.sol implementation')
  .addParam('gasPrice', 'The gas price to use for the transaction')
  .setAction(async (args, hardhat) => {
    const dummyArgsForArtistInit = [
      '0xB0A36b3CeDf210f37a5E7BC28d4b8E91D4E3C412', // rinkeby deployer address
      '0',
      `Sound.xyz ArtistV${args.artistVersion}.sol`,
      `SOUND V${args.artistVersion}`,
      'https://sound.xyz/api/metadata/',
    ];

    const { ethers, network } = hardhat;
    const gasPrice = ethers.utils.parseUnits(args.gasPrice, 'gwei');
    const currentGasPrice = await ethers.provider.getGasPrice();
    const gasPriceInGwei = ethers.utils.formatUnits(currentGasPrice, 'gwei');

    console.log({ currentGasPrice: gasPriceInGwei });

    // Bail out if we're deploying to mainnet and gas price is too high
    if (network.name === 'mainnet' && currentGasPrice.gt(MAX_GAS_PRICE)) {
      console.log(`Gas price is too high!: ${gasPriceInGwei} gwei`);
      return;
    }

    const ArtistFactory = await ethers.getContractFactory(`ArtistV${args.artistVersion}`);
    const artistUpgrade = await ArtistFactory.deploy({ gasPrice });

    console.log(
      `Deploying ArtistV${args.artistVersion}.sol on ${network}:`,
      `https://${network.name !== 'mainnet' ? network + '.' : ''}etherscan.io/tx/${
        artistUpgrade.deployTransaction.hash
      }`
    );

    const deployReceipt = await artistUpgrade.deployTransaction.wait();

    if (deployReceipt.status === 1) {
      console.log('Deployment confirmed');
      const initTx = await artistUpgrade.initialize(...dummyArgsForArtistInit, {
        gasLimit: 250_000,
        gasPrice,
      });
      console.log('Initialization started:', initTx.hash);
      await initTx.wait();
      console.log('Initialization confirmed');
    }
  });
