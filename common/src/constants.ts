export const NETWORK_MAP = {
  1: 'mainnet',
  4: 'rinkeby',
  1337: 'hardhat',
  31337: 'hardhat',
};

export const baseURIs: { [key: string]: string } = {
  hardhat: 'http://localhost:3000/api/metadata/',
  rinkeby: 'https://sound-staging.vercel.app/api/metadata/',
  mainnet: 'https://sound.xyz/api/metadata/',
};

export const genres = [
  'Alternative Rock',
  'Ambient',
  'Classical',
  'Country',
  'Dance & EDM',
  'Dancehall',
  'Deep House',
  'Disco',
  'Drum & Bass',
  'Dubstep',
  'Electronic',
  'Folk & Singer-Songwriter',
  'Hip-hop & Rap',
  'House',
  'Indie',
  'Jazz & Blues',
  'Latin',
  'Metal',
  'Piano',
  'Pop',
  'R&B & Soul',
  'Reggae',
  'Reggaeton',
  'Rock',
  'Soundtrack',
  'Techno',
  'Trance',
  'Trap',
  'Triphop',
  'World',
];

export const SOUND_ADMIN_PUBLIC_ADDRESS = '0xed0faf139565bae4d856eeaffad7c81515457246';
