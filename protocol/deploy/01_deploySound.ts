import { constants, helpers } from '@soundxyz/common';
import { ethers } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

type ContractConfig = {
  implementation?: string;
  proxy?: string;
  args?: any[];
  contractPath?: string;
};

const { NETWORK_MAP } = constants;
const { getAuthSignature } = helpers;
const MAX_GAS_PRICE = 140_000_000_000; // wei
const gasLimits = {
  ARTIST_CREATOR_INIT: 3_000_000,
  ARTIST_INIT: 300_000,
};

const func: DeployFunction = async function ({ ethers, deployments, network, run, waffle }: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();
  const chainId = parseInt(await network.provider.send('eth_chainId'));
  const networkName = NETWORK_MAP[chainId];
  const gasPrice = await ethers.provider.getGasPrice();
  const dummyArgsForArtistInit = [
    deployer.address,
    '1',
    'Sound.xyz Artist.sol',
    'IMPLEMENTATION',
    'https://sound.xyz/api/metadata/',
  ];

  // Bail out if we're deploying to mainnet and gas is too high
  if (chainId === 1 && gasPrice.gt(MAX_GAS_PRICE)) {
    console.log(`Gas price is too high!: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
    return;
  }

  console.log(`Starting deployment on ${networkName} (chainId ${chainId})`);

  // ============= Deployment ============= //
  const artistCreator = await deployments.deploy('ArtistCreator', {
    from: deployer.address,
    gasLimit: 5_000_000,
    log: true,
    proxy: {
      owner: deployer.address,
      proxyContract: 'ArtistCreatorProxy',
      execute: {
        methodName: 'initialize',
        args: [],
      },
    },
  });

  console.log({ artistCreator: artistCreator.address });
  console.log(`Deployed ArtistCreator.sol to ${networkName} (chainId ${chainId}): ${artistCreator.address}`);

  //=========== Initialize the implementation contracts (recommended security measure)========//
  console.log('Starting initialization of implementation contracts');

  let estimatedGas: ethers.BigNumber;
  let gasFee: ethers.BigNumber;
  let receipt: { [key: string]: any };

  // ArtistCreator.sol
  const artistCreatorImp = await ethers.getContract('ArtistCreator_Implementation', deployer);
  let artistBeaconAddress = await artistCreatorImp.beaconAddress();

  // If no beacon address, it means the contract hasn't been initialized
  console.log({ artistBeaconAddress });
  if (artistBeaconAddress === '0x0000000000000000000000000000000000000000') {
    estimatedGas = await artistCreatorImp.estimateGas.initialize();
    gasFee = gasPrice.mul(estimatedGas);
    console.log(`Initializating ArtistCreator.sol. Estimated gas fee: ${ethers.utils.formatEther(estimatedGas)} ETH`);
    const initArtistCreatorTx = await artistCreatorImp.initialize();
    console.log(`Executed initialize on ArtistCreator.sol implementation: ${initArtistCreatorTx.hash}`);
    receipt = await initArtistCreatorTx.wait();
    if (receipt.status === 1) {
      console.log(`Confirmed!`);
    }
  } else {
    console.log('\nArtistCreator.sol is already initialized\n');
  }

  // Artist.sol
  artistBeaconAddress = await artistCreatorImp.beaconAddress();
  console.log({ artistBeaconAddress });
  const UpgradeableBeacon = await ethers.getContractFactory('UpgradeableBeacon');
  const beaconContract = new ethers.Contract(artistBeaconAddress, UpgradeableBeacon.interface, deployer);
  const artistImplAddress = await beaconContract.implementation();
  console.log({ artistImplAddress });
  const Artist = await ethers.getContractFactory('Artist');
  const artistContract = new ethers.Contract(artistImplAddress, Artist.interface, deployer);
  const artistName = await artistContract.name();

  if (artistName === '') {
    estimatedGas = await artistContract.estimateGas.initialize(...dummyArgsForArtistInit);
    gasFee = gasPrice.mul(estimatedGas);
    console.log(`Initializating Artist.sol. Estimate gas fee: ${ethers.utils.formatEther(estimatedGas)} ETH`);
    const initArtistTx = await artistContract.initialize(...dummyArgsForArtistInit, {
      gasLimit: gasLimits.ARTIST_INIT,
    });
    console.log(`Executed initialize on Artist.sol: ${initArtistTx.hash}`);
    receipt = await initArtistTx.wait();
    if (receipt.status === 1) {
      console.log(`Confirmed!`);
    }
  } else {
    console.log('\nArtist.sol is already initialized\n');
  }

  //============= Etherscan verification ==============//

  // To verify on etherscan, we need the implemention address, proxy address, and arguments to the proxy contructor
  // only allow rinkeby -- switch to mainnet manually when needed
  if (chainId !== 1337) {
    const contracts: ContractConfig[] = [];

    const creatorImpAddress = artistCreatorImp.address;

    // Verify ArtistCreator
    contracts.push({
      proxy: artistCreator.address,
      implementation: creatorImpAddress,
      args: [creatorImpAddress, deployer.address, '0x'], // args supplied to ArtistCreatorProxy
      contractPath: 'contracts/ArtistCreatorProxy.sol:ArtistCreatorProxy',
    });

    if (chainId === 1) {
      console.log('Connected to mainnet. Skipping Artist.sol proxy deployment for etherscan verification.');
    } else {
      // Deploy an artist proxy via the ArtistCreator to verify
      const authSignature = await getAuthSignature({
        deployerAddress: deployer.address,
        chainId,
        privateKey: process.env.ADMIN_PRIVATE_KEY as string,
        provider: ethers.provider,
      });

      const artistCreatorContract = await ethers.getContractAt('ArtistCreator', artistCreator.address, deployer);
      const artistDeployTx = await artistCreatorContract.createArtist(
        authSignature,
        ...dummyArgsForArtistInit.slice(2),
        {
          gasLimit: 1_000_000,
        }
      );
      const receipt = await artistDeployTx.wait();
      const artistProxyAddress = receipt.events[3].args.artistAddress;

      // Gather arguments for the artist BeaconProxy
      const artistArtifact = await deployments.getArtifact('Artist');
      const iface = new ethers.utils.Interface(artistArtifact.abi);
      const functionSelector = iface.encodeFunctionData('initialize', dummyArgsForArtistInit);
      const beaconConstructorArgs = [artistBeaconAddress, functionSelector];

      contracts.push({
        proxy: artistProxyAddress,
        implementation: artistImplAddress,
        args: beaconConstructorArgs,
      });
    }

    // Verify everything on etherscan (wait 30 sec for etherscan to process it first)
    // console.log('\nWaiting for etherscan to index the bytecode...');
    // await new Promise((res) => setTimeout(res, 30_000));

    // for (const contract of contracts) {
    //   // verify implementation
    //   console.log('Verifying implementation:', contract.implementation);
    //   await verifyContract(contract.implementation);
    //   // verify proxy
    //   console.log('Verifying proxy:', contract.proxy);
    //   await verifyContract(contract.proxy, contract.args, contract.contractPath);
    // }
  }

  async function verifyContract(address: string, constructorArguments: any[] = [], contractPath?: string) {
    let verified = false;
    let attempts = 0;
    while (!verified) {
      try {
        const options: any = { address, constructorArguments };
        if (contractPath) {
          options.contract = contractPath;
        }
        //// Verify contract on etherscan
        await run('verify:verify', options);
        verified = true;
      } catch (err) {
        console.log(err);
        if (attempts > 1 || err.message === 'Contract source code already verified') {
          break;
        } else {
          console.log('\nWaiting 5 seconds...');
          await new Promise((res) => setTimeout(res, 5_000));
        }
      }
      attempts++;
    }
  }
};

export default func;
