import Artist from './artifacts/contracts/Artist.sol/Artist.json';
import hardhat_ArtistCreator from './deployments/localhost/ArtistCreator.json';
import hardhat_SplitMain from './deployments/localhost/SplitMain.json';
import mainnet_ArtistCreator from './deployments/mainnet/ArtistCreator.json';
import rinkeby_ArtistCreator from './deployments/rinkeby/ArtistCreator.json';
import rinkeby_SplitMain from './deployments/rinkeby/SplitMain.json';

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
    splitMain: rinkeby_SplitMain.address,
  },
  mainnet: {
    artistCreator: mainnet_ArtistCreator.address,
    // splitMain:
  },
};

export const abis: { [key: string]: any } = {
  ArtistCreator: rinkeby_ArtistCreator.abi,
  Artist: Artist.abi,
};
