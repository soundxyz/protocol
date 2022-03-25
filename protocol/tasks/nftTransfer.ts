import { task } from 'hardhat/config';

task('nftTransfer', 'Transfer ownership of an NFT')
  .addParam('contractAddress', 'The address of the NFT')
  .addParam('tokenId', 'The tokenId')
  .addParam('senderPk', 'The private key of the sender')
  .addParam('recipient', 'The address of the recipient')
  .setAction(async (args, hardhat) => {
    const { contractAddress, tokenId, senderPk, recipient } = args;
    const { ethers, network } = hardhat;

    console.log(
      `Transferring ownership of tokenId ${tokenId} from contract ${contractAddress} to ${recipient} on ${network.name}`
    );
    const sender = new ethers.Wallet(senderPk, ethers.provider);

    const ownedContract = await ethers.getContractAt('Artist', contractAddress, sender);

    const initialRecipientBalance = await ownedContract.balanceOf(recipient);

    const tx = await ownedContract.transferFrom(sender.address, recipient, tokenId);
    console.log('transaction started:', tx.hash);
    await tx.wait();

    const senderBalance = await ownedContract.balanceOf(sender.address);
    const finalRecipientBalance = await ownedContract.balanceOf(recipient);

    if (senderBalance.toNumber() > 0 || !finalRecipientBalance.gt(initialRecipientBalance)) {
      throw new Error(
        `Balances not as expected. Sender: ${senderBalance.toString()}, Recipient: ${finalRecipientBalance.toString()}`
      );
    } else {
      console.log('Transfer successful!');
    }
  });
