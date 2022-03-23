import { expect } from 'chai';

import Config from '../Config';
import { currentSeconds } from '../helpers';

export function setStartTimeTests(config: Config) {
  const { setUpContract, EDITION_ID } = config;

  const newTime = currentSeconds() + 100;

  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract();

    for (const notOwner of miscAccounts) {
      const tx = artistContract.connect(notOwner).setStartTime(EDITION_ID, newTime);
      await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    }
  });

  it('sets the start time for the edition', async () => {
    const { artistContract, artistAccount } = await setUpContract();

    const tx = await artistContract.connect(artistAccount).setStartTime(EDITION_ID, newTime);
    await tx.wait();
    const editionInfo = await artistContract.editions(EDITION_ID);

    await expect(editionInfo.startTime.toString()).to.eq(newTime.toString());
  });

  it('emits event', async () => {
    const { artistContract, artistAccount } = await setUpContract();

    const tx = await artistContract.connect(artistAccount).setStartTime(EDITION_ID, newTime);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === 'AuctionTimeSet');

    await expect(event.args.timeType).to.eq(0);
    await expect(event.args.editionId.toString()).to.eq(EDITION_ID.toString());
    await expect(event.args.newTime.toString()).to.eq(newTime.toString());
  });
}

export function setEndTimeTests(config: Config) {
  const { setUpContract, EDITION_ID } = config;

  const newTime = currentSeconds() + 100;

  it('only allows owner to call function', async () => {
    const { artistContract, miscAccounts } = await setUpContract();

    for (const notOwner of miscAccounts) {
      const tx = artistContract.connect(notOwner).setEndTime(EDITION_ID, newTime);

      await expect(tx).to.be.revertedWith('Ownable: caller is not the owner');
    }
  });

  it('sets the end time for the edition', async () => {
    const { artistContract, artistAccount } = await setUpContract();

    const tx = await artistContract.connect(artistAccount).setEndTime(EDITION_ID, newTime);
    await tx.wait();
    const editionInfo = await artistContract.editions(EDITION_ID);

    await expect(editionInfo.endTime.toString()).to.eq(newTime.toString());
  });

  it('emits event', async () => {
    const { artistContract, artistAccount } = await setUpContract();

    const tx = await artistContract.connect(artistAccount).setEndTime(EDITION_ID, newTime);
    const receipt = await tx.wait();
    const event = receipt.events.find((e) => e.event === 'AuctionTimeSet');

    await expect(event.args.timeType).to.eq(1);
    await expect(event.args.editionId.toString()).to.eq(EDITION_ID.toString());
    await expect(event.args.newTime.toString()).to.eq(newTime.toString());
  });
}
