import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { helpers } from '@soundxyz/common';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers, upgrades, waffle } from 'hardhat';

import { createArtist } from './helpers';

const { getAuthSignature } = helpers;
const EXAMPLE_ARTIST_NAME = 'Alpha & Omega';
const EXAMPLE_ARTIST_SYMBOL = 'AOMEGA';
const BASE_URI = `https://sound-staging.vercel.app/api/metadata/`;
const { provider } = waffle;

describe('ArtistCreator', () => {
  let artistCreator: Contract;
  let soundOwner: SignerWithAddress;

  const setUp = async () => {
    soundOwner = (await ethers.getSigners())[0];

    const ArtistCreator = await ethers.getContractFactory('ArtistCreator');

    artistCreator = await upgrades.deployProxy(ArtistCreator, { kind: 'uups' });
    await artistCreator.deployed();
  };

  it('deploys', async () => {
    await setUp();
    const deployedByteCode = await provider.getCode(artistCreator.address);
    expect(deployedByteCode).to.not.be.null;
  });

  describe('ownership', () => {
    it('returns expected owner', async () => {
      expect(await artistCreator.owner()).to.equal(soundOwner.address);
    });

    it('transfers to a new owner', async () => {
      const [_, owner1, owner2, owner3] = await ethers.getSigners();

      await artistCreator.transferOwnership(owner1.address);
      expect(await artistCreator.owner()).to.equal(owner1.address);

      await artistCreator.connect(owner1).transferOwnership(owner2.address);
      expect(await artistCreator.owner()).to.equal(owner2.address);

      await artistCreator.connect(owner2).transferOwnership(owner3.address);
      expect(await artistCreator.owner()).to.equal(owner3.address);
    });

    it(`'allows owner to set admin`, async () => {
      await setUp();
      const [_, admin1] = await ethers.getSigners();

      await artistCreator.setAdmin(admin1.address);
      expect(await artistCreator.admin()).to.equal(admin1.address);
    });

    it(`'allows admin to set admin`, async () => {
      await setUp();
      const [_, admin1, admin2] = await ethers.getSigners();

      await artistCreator.setAdmin(admin1.address);
      await artistCreator.connect(admin1).setAdmin(admin2.address);
      expect(await artistCreator.admin()).to.equal(admin2.address);
    });

    it(`'prevents non-owner or non-admin from setting admin`, async () => {
      await setUp();
      const [_, attacker1, attacker2] = await ethers.getSigners();

      const tx1 = artistCreator.connect(attacker1).setAdmin(attacker1.address);
      expect(tx1).to.be.revertedWith('invalid authorization');

      const tx2 = artistCreator.connect(attacker2).setAdmin(attacker2.address);
      expect(tx2).to.be.revertedWith('invalid authorization');
    });
  });

  describe('createArtist', () => {
    it('deploys artist contracts with expected event data', async () => {
      await setUp();
      const artistEOAs = await ethers.getSigners();

      for (let i = 1; i < 10; i++) {
        const tx = await createArtist(
          artistCreator,
          artistEOAs[i],
          EXAMPLE_ARTIST_NAME + i,
          EXAMPLE_ARTIST_SYMBOL + i,
          BASE_URI
        );

        const receipt = await tx.wait();
        const eventData = artistCreator.interface.parseLog(receipt.events[3]);

        expect(eventData.args.name).to.equal(EXAMPLE_ARTIST_NAME + i);
      }
    });

    it(`prevents deployment if admin signature is invalid`, async () => {
      await setUp();
      const artistEOAs = await ethers.getSigners();

      const chainId = (await provider.getNetwork()).chainId;

      for (let i = 0; i < 10; i++) {
        const artistEOA = artistEOAs[i];
        const signature = await getAuthSignature({
          artistWalletAddr: `0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000`,
          privateKey: process.env.ADMIN_PRIVATE_KEY,
          chainId,
          provider,
        });
        const tx = artistCreator
          .connect(artistEOA)
          .createArtist(signature, EXAMPLE_ARTIST_NAME + i, EXAMPLE_ARTIST_SYMBOL + i, BASE_URI);

        expect(tx).to.be.revertedWith('invalid authorization signature');
      }
    });
  });
});
