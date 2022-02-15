import Artist from './artifacts/contracts/Artist.sol/Artist.json';
import hardhat_ArtistCreator from './deployments/localhost/ArtistCreator.json';
import hardhat_SplitMain from './deployments/localhost/SplitMain.json';
import mainnet_ArtistCreator from './deployments/mainnet/ArtistCreator.json';
import rinkeby_ArtistCreator from './deployments/rinkeby/ArtistCreator.json';

type Addresses = {
  artistCreator?: string;
  splitMain?: string;
};

export const addresses: { [key: string]: Addresses } = {
  hardhat: {
    artistCreator: hardhat_ArtistCreator.address,
    splitMain: hardhat_SplitMain.address,
  },
  rinkeby: {
    artistCreator: rinkeby_ArtistCreator.address,
    splitMain: '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE',
  },
  mainnet: {
    artistCreator: mainnet_ArtistCreator.address,
    splitMain: '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE',
  },
};

export const abis: { [key: string]: any } = {
  ArtistCreator: rinkeby_ArtistCreator.abi,
  Artist: Artist.abi,
};
