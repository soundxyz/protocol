import { task } from 'hardhat/config';

const constructorArgs = {
  mainnet: {
    subscriptionId: '',
    admin: '',
    vrfCoordinator: '',
    linkToken: '',
    gasLaneKeyHash: '',
  },
  rinkeby: {
    subscriptionId: 818,
    admin: '0xB0A36b3CeDf210f37a5E7BC28d4b8E91D4E3C412',
    vrfCoordinator: '0x6168499c0cFfCaCD319c818142124B7A15E857ab',
    linkToken: '0x01BE23585060835E02B77ef475b0Cc51aA1e0709',
    gasLaneKeyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
  },
};

task('deployEgg', 'Deploy GoldenEgg VRF contract').setAction(async (args, hardhat) => {
  const { ethers, run } = hardhat;

  console.log(`Deploying GoldenEgg contract on ${hardhat.network.name}`);

  const goldenEggFactory = await ethers.getContractFactory('GoldenEgg');

  const argsForCurrentNetwork = Object.values(constructorArgs[hardhat.network.name]);
  const goldenEgg = await goldenEggFactory.deploy(...argsForCurrentNetwork);

  console.log(`Deployed GoldenEgg at ${goldenEgg.address}. hash: ${goldenEgg.deployTransaction.hash}`);

  console.log(`Waiting for 3 confirmations before verifying on etherscan...`);

  await goldenEgg.deployTransaction.wait(3);

  await run('verify:verify', { address: goldenEgg.address, constructorArguments: argsForCurrentNetwork });
});
