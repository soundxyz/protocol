import { task } from 'hardhat/config';

task('transfer-ownership', 'Transfer ownership of a contract')
  .addParam('contractAddress', 'The address to transfer ownership of')
  .addParam('contractName', 'The name of the contract (must be in the /artifacts dir)')
  .addParam('newOwner', 'The address of the new owner')
  .setAction(async (args, hardhat) => {
    const { contractAddress, contractName, newOwner } = args;
    const { network, ethers } = hardhat;

    console.log(`Transferring ownership of ${contractAddress} to ${newOwner} on ${network.name}`);
    const [soundDeployer] = await ethers.getSigners();

    const ownedContract = await ethers.getContractAt(contractName, contractAddress, soundDeployer);
    const currentOwner = await ownedContract.owner();
    console.log({ currentOwner });

    const tx = await ownedContract.transferOwnership(newOwner);
    console.log('transaction started:', tx.hash);
    await tx.wait();

    const expectedOwner = await ownedContract.owner();
    if (expectedOwner !== newOwner) {
      throw new Error(`Expected ${newOwner} but got ${expectedOwner}`);
    } else {
      console.log('Transfer successful!');
    }
  });
