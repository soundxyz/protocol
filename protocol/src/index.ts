import Artist from './artifacts/contracts/Artist.sol/Artist.json';
import hardhat_ArtistCreator from './deployments/localhost/ArtistCreator.json';
import mainnet_ArtistCreator from './deployments/mainnet/ArtistCreator.json';
import rinkeby_ArtistCreator from './deployments/rinkeby/ArtistCreator.json';

type Addresses = {
  artistCreator?: string;
};

export const addresses: { [key: string]: Addresses } = {
  hardhat: { artistCreator: hardhat_ArtistCreator.address },
  rinkeby: { artistCreator: rinkeby_ArtistCreator.address },
  mainnet: { artistCreator: mainnet_ArtistCreator.address },
};

export const abis: { [key: string]: any } = {
  ArtistCreator: rinkeby_ArtistCreator.abi,
  Artist: Artist.abi,
};
