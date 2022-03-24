import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import Config from '../Config';
import { getRandomInt } from '../helpers';

export function deploymentTests(config: Config) {
  const { setUpContract, EXAMPLE_ARTIST_NAME, EXAMPLE_ARTIST_SYMBOL } = config;

  it('deploys contract with basic attributes', async () => {
    const { artistContract } = await setUpContract();
    await expect(await artistContract.name()).to.eq(EXAMPLE_ARTIST_NAME);
    await expect(await artistContract.symbol()).to.eq(EXAMPLE_ARTIST_SYMBOL);
  });

  it('supports interface 2981', async () => {
    const { artistContract } = await setUpContract();
    const INTERFACE_ID_ERC2981 = 0x2a55205a;
    await expect(await artistContract.supportsInterface(INTERFACE_ID_ERC2981)).to.eq(true);
  });

  it('ownerOf reverts if called for non-existent tokens', async () => {
    const { artistContract } = await setUpContract();
    const tx = artistContract.ownerOf(BigNumber.from(getRandomInt()));
    await expect(tx).to.be.revertedWith('ERC721: owner query for nonexistent token');
  });

  it('tokenURI reverts if called for non-existent tokens', async () => {
    const { artistContract } = await setUpContract();
    const tx = artistContract.tokenURI(BigNumber.from(getRandomInt()));
    await expect(tx).to.be.revertedWith('ERC721Metadata: URI query for nonexistent token');
  });

  it('balanceOf returns 0 for addresses without a balance', async () => {
    const { artistContract } = await setUpContract();
    const signers = await ethers.getSigners();
    for (const signer of signers) {
      const result = await artistContract.balanceOf(signer.address);
      await expect(result.toString()).to.eq('0');
    }
  });
}
