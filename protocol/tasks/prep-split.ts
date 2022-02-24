import { BigNumber, utils } from 'ethers';
import { task } from 'hardhat/config';
import { sortBy } from 'lodash';

const PERCENTAGE_SCALE = BigNumber.from(1e6);

const allocations = [
  // Soulection+
  {
    ownerAddress: '0xaBAEC7C7b385dD1bb0e4A95D0FF8DAC3703432bd',
    percent: 20,
  },
  // Andre Power
  {
    ownerAddress: '0x19aBaC4e0a9a41001D4685216359909e725ed949',
    percent: 5,
  },
  // Joe Kay
  {
    ownerAddress: '0x4c263ff896BA123Bd3e354d0C331EdBf7ac5bcA8',
    percent: 5,
  },
  // Monte Booker
  {
    ownerAddress: '0x6B5d5301b9Df208f349e3CD9926cf05778c55A6e',
    percent: 8.23,
  },
  // IAMNODBODI
  {
    ownerAddress: '0x9F3AaAd412cd42a85a75a4338E89df4125A530e5',
    percent: 8.23,
  },
  // J.ROBB
  {
    ownerAddress: '0x406627d7C8C2AC21C2CB7Ca838dfb96443626252',
    percent: 11.32,
  },
  // Jayla Darden
  {
    ownerAddress: '0x1DB842C3Ddf37DDf88ee734C4B536A3fa3Db01A8',
    percent: 4.11,
  },
  // Esta
  {
    ownerAddress: '0xe23E282dAf34a42eD654B5a56DA28e98F1E809b7',
    percent: 10.29,
  },
  // Jarreau Vandal
  {
    ownerAddress: '0xA15eC43f20eD0eF2E315058D9DbAAbCf5a65EAfF',
    percent: 2.05,
  },
  // Rose Gold
  {
    ownerAddress: '0x0112A2c6dFD5dE3C0C41594059EE35D44Dc37F93',
    percent: 2.05,
  },
  // Mars Today
  {
    ownerAddress: '0x65d817532ba6ab7e56a8761c9abcb30b6786e9d9',
    percent: 2.57,
  },
  // Kenyon Dixon
  {
    ownerAddress: '0xF1A8692992cFda464EEEbD9058Ba9077c7c5B7D4',
    percent: 1.02,
  },
  // Jordan Brooks
  {
    ownerAddress: '0x2D4b6F807d68c1d32Bcd8372bf0D1F323e9CF1e0',
    percent: 0.61,
  },
  // Krs
  {
    ownerAddress: '0xd0c283cbd379E892cf916A88B3cbCe72d1B14001',
    percent: 2.05,
  },
  // Jared Jackson
  {
    ownerAddress: '0xeF55DDb39345cCF7D6cc8B06E56dBb2844Af522D',
    percent: 5.14,
  },
  // Lakim
  {
    ownerAddress: '0x23dF5f9418C1f8bA0EC21FDbca8821A5D62377d9',
    percent: 6.17,
  },
  // Sango
  {
    ownerAddress: '0x1A4C949FC8fE4c899e8bba6F48C696785D61B3F8',
    percent: 4.11,
  },
  // Abjo
  {
    ownerAddress: '0xcF669804AC78CFc589bEaE782f045f961fC10381',
    percent: 2.05,
  },
];

export const getHash: (arg0: string[], arg1: number[], arg2: number) => string = (
  accounts,
  percentAllocations,
  distributorFee
) => {
  return utils.solidityKeccak256(['address[]', 'uint32[]', 'uint32'], [accounts, percentAllocations, distributorFee]);
};

task('prep-split', async (_args, _hardhat) => {
  const orderedAllocations = sortBy(allocations, (o) => o.ownerAddress.toLowerCase());
  const ownerAddresses = orderedAllocations.map((allocation) => allocation.ownerAddress.toLowerCase());
  const percentAllocations = orderedAllocations
    .map((allocation) => BigNumber.from(Math.round(PERCENTAGE_SCALE.toNumber() * +allocation.percent) / 100))
    .map((allocation) => allocation.toNumber());

  console.log('hash', getHash(ownerAddresses, percentAllocations, 0));

  console.log(JSON.stringify(ownerAddresses));
  console.log(JSON.stringify(percentAllocations));
});
