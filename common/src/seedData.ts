import { ethers } from 'ethers';
import slugify from 'slugify';
import { v4 as uuid } from 'uuid';

const MAX_UINT32 = 4294967295;

export const artistNames = [
  'Oshi',
  'VÉRITÉ',
  'Com Truise',
  'Ben Kessler',
  'Abaco Island boa',
  'Burrowing viper',
  'Russian Toy',
  'Kurilian Bobtail',
  'Fulvous Whistling-Duck',
  'Wild Turkey',
  'Munchkin',
  'Russian Blue',
  'Pumi',
];

export const releaseTitles = [
  'Childhood',
  'Olive rich',
  'Lime Rubber',
  'Red Republic',
  'Azure Cloned',
  'Lavender Function-based',
  'Yellow Product',
  'Maroon empower',
  'Orchid e-commerce',
  'Grey action-items',
  'Lime connecting',
  'Turquoise Turkmenistan',
  'Ivory leverage',
  'Grey digital',
  'Turquoise Kids',
  'Blue synthesize',
  'Maroon synergize',
  'Teal Down-sized',
  'Mint green input',
  'Black Health',
  'Gold Underpass',
  'Mint green Shirt',
  'Sky blue structure',
  'Blue Handcrafted',
  'Red synergize',
];

export const imageKeys = [
  'artist-uploads/733090ce-1a25-4dda-8c94-a0e59da6483b/RELEASE_COVER_IMAGE/9271028-childhood-gif.gif',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/145161-pd43-5-28-ploy-01.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/157924-7313409494_16bb4686ab_o.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/1966599-upwk61807774-wikimedia-image.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/2078349-pdfamousartists3-052-nap.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/2322949-7313407896_090068644a_o.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/2688586-pd215-11_2.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/3628433-pd59batch65-38-nap_1_1.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/4126294-pd59batch65-39-nap_1_1.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/4696923-7313406474_889887fdc4_o.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/5572656-upwk62084569-wikimedia-image.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/5590336-Vintage%2B%2BWatching%2BEye.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/5889194-upwk62119166-wikimedia-image.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/713498-pdwilliammorris-045-nap_1.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/724823-7313409708_287aa8c92b_o.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/7317467-7313405992_ebc6031ea0_o.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/7326073-7313406140_5745b49ecd_o.jpeg',
  'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/IMAGE/9342863-pdagb1-01.jpeg',
];

export const audioData = [
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/1268745-01-01-%20Buggin.mp3',
    duration: 240,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/1848896-01_-_sound-stream_-_live-goes-on.mp3',
    duration: 516,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/2244428-01-03-%20Veronica.mp3',
    duration: 202,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/2301745-02%20Castles%20In%20The%20Sky.mp3',
    duration: 380,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/2398408-01-01-%20Do%20It%20Right%20%5Bfeat%20Tkay%20Maidza%5D.mp3',
    duration: 213,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/319078-01%20Maximilian%20Skiba%20-%20One%20To%20Pray%20To%20(feat.%20Snax%2C%20Beg%20To%20Differ%20Remix).mp3',
    duration: 443,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/379758-01-01-%20Compromise%20(Radio%20Mix)%20%5Bfeat%20Sinead%20Harnett%2C%20Goldlink%20%26%20Secai.mp3',
    duration: 212,
  },
  {
    key: 'artist-uploads/538f1d82-4ebd-40f9-b057-8fa017b6d524/AUDIO/4321193-01-01-%20Okay.mp3',
    duration: 359,
  },
];

export const loremSentences = [
  'Iusto perferendis temporibus totam. Sint qui maxime.',
  'Et ipsa possimus temporibus. Fugiat ullam natus odit et sequi est.',
  'Vel sed et inventore mollitia quia enim occaecati accusamus. Officiis ut fuga magnam facere. Repellat quidem qui qui atque eos et et quam. Aut quae ea.',
  'Non corporis maiores enim voluptas magni est est. Aut officiis reiciendis vitae consequatur. Aspernatur enim dolores minima. Amet facilis ut vel ea. Id ullam eaque est sequi quas.',
  'Animi eligendi in. Numquam earum et qui dignissimos suscipit ipsum temporibus. Assumenda nisi corrupti sequi alias maxime. Similique neque nesciunt ut illum totam. Aperiam non voluptatibus quia repudiandae. Ducimus quia nihil iste adipisci rerum et.',
  'Velit fugit quo earum nemo aperiam dicta tempore. Maiores ut reiciendis ab culpa qui praesentium ut amet vel. Maiores animi provident eligendi blanditiis expedita ut natus distinctio. Voluptas deserunt suscipit provident iure sit. Laboriosam fuga odio omnis quidem quis molestias sed saepe. Atque tenetur nihil necessitatibus consectetur enim nobis quia aliquam.',
  'Rem ut aperiam rerum qui. Qui totam qui tempore quidem.',
  'Est fugiat nihil. Fuga ut vero rerum dolorem omnis nam id et. Quo id quos iure ipsum beatae quasi. Aut consequatur eum fugiat quaerat. Vel vel et eos molestias exercitationem est voluptatum nulla ullam. Saepe dicta laudantium dolorem repellat repudiandae quaerat.',
  'Nihil dignissimos officia delectus. Dolor iusto odio consequatur molestias. Rerum non omnis similique blanditiis eos qui voluptatem saepe ex. Quibusdam eum sed error alias rerum amet molestiae qui illo.',
  'Quae debitis eligendi. Corporis earum ipsa eum non. Aliquid quos at. Neque a et ea distinctio maiores repudiandae provident qui officiis.',
  'Laboriosam voluptas sint est aut repudiandae. Iste molestiae atque. Quia unde consequuntur veniam. Velit sint amet.',
];

export const loremParagraphs = [
  `Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum. Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.

  Iste doloremque nesciunt sit officia rerum dolorem in. Qui aut rerum laborum. Id commodi quia quaerat. Voluptatem eligendi porro eius sint sit possimus.
  
  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.`,
  `Iste doloremque nesciunt sit officia rerum dolorem in. Qui aut rerum laborum. Id commodi quia quaerat. Voluptatem eligendi porro eius sint sit possimus.

  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.`,
  `Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum. Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.

  Iste doloremque nesciunt sit officia rerum dolorem in. Qui aut rerum laborum. Id commodi quia quaerat. Voluptatem eligendi porro eius sint sit possimus.
  
  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.
  
  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum. Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.
  
  Iste doloremque nesciunt sit officia rerum dolorem in. Qui aut rerum laborum. Id commodi quia quaerat. Voluptatem eligendi porro eius sint sit possimus.
  
  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.
  
  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum. Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.
  
  Iste doloremque nesciunt sit officia rerum dolorem in. Qui aut rerum laborum. Id commodi quia quaerat. Voluptatem eligendi porro eius sint sit possimus.
  
  Eos vitae dolore sunt. Sed quaerat ullam omnis expedita deleniti fugiat vero eveniet. Optio iure fugiat amet quia adipisci provident nemo maiores consequuntur. Dolor dicta eum deserunt. Quaerat officiis molestias quam non impedit nobis adipisci vero. Nesciunt tempora eum.`,
];

// The public addresses correspond to the addresses generated by hardhat
export const usersData = [
  {
    publicAddress: '0xb0a36b3cedf210f37a5e7bc28d4b8e91d4e3c412',
    email: 'a@sharklasers.com',
    hasArtistRole: true,
    twitterHandle: 'oshimakesmusic',
    displayName: 'Joshua Brennan',
  },
  {
    publicAddress: '0x6fc4792b1bbe0df6b0d80e9cc7bd61d872bf2768',
    email: 'b@sharklasers.com',
    hasArtistRole: true,
    twitterHandle: 'Vérité',
    displayName: 'Kelsey Regina Byrne',
  },
  {
    publicAddress: '0xe34056ad5a4dbe825ea93cfb5b62ab5f2548c294',
    email: 'c@sharklasers.com',
    hasArtistRole: true,
    twitterHandle: 'comtruise',
    displayName: 'Seth Haley',
  },
  {
    publicAddress: '0x1372c547e54733ea35f28ef3ab00d4816a488208',
    email: 'd@sharklasers.com',
    hasArtistRole: true,
    twitterHandle: 'benkesslermusic',
    displayName: 'Ben Kessler',
  },
  {
    publicAddress: '0xde8cdc32a83854e55928ad0f881664e08ec4465a',
    email: 'e@sharklasers.com',
    hasArtistRole: true,
    displayName: 'Paul McCartney',
  },
  {
    publicAddress: '0x42a28518375295f360724f6559cf1d6e02ac72b0',
    email: 'f@sharklasers.com',
    hasArtistRole: true,
    displayName: 'Nadia Boulanger',
  },
  {
    publicAddress: '0x3ecc3baa27bef0c35e6f0c5f1469d0a39a6b21d3',
    email: 'g@sharklasers.com',
    displayName: 'Quincy Jones',
  },
  {
    publicAddress: '0x97934d9e5e6fe17afdf38d2233b21c58e6516dc7',
    email: 'h@sharklasers.com',
    displayName: 'Missy Elliot',
  },
  {
    publicAddress: '0x17e545f5a1c5a4a88fd9ad919656f54187150d25',
  },
  {
    publicAddress: '0xc142dea48fb99fee575ee485aa881886b7bea6ff',
  },
  {
    publicAddress: '0x569f85642ae42bbff029008f5ec19630e46b8836',
  },
  {
    publicAddress: '0xe7a8e275583d7d66e900c8afaa6bcbd83710c1e4',
  },
  {
    publicAddress: '0xd60bc3c567ca08fcf040cc0e4d25b1282d002c74',
  },
  {
    publicAddress: '0xf90bc874d033f8f09fe0cf16ef611a0ae183e6de',
  },
];

type ArtistData = {
  name: string;
  description: string;
  soundHandle: string;
  openseaCollectionUrl: string;
  user: { connect: { publicAddress: string } };
}[];

export const artistsData: ArtistData = [];

usersData
  .filter((u, i) => u.hasArtistRole && i < 3)
  .forEach((u, i) => {
    artistsData.push({
      name: artistNames[i],
      description: loremSentences[i % loremSentences.length],
      soundHandle: slugify(artistNames[i]).toLocaleLowerCase(),
      openseaCollectionUrl: `https://opensea.io/collection/${slugify(
        artistNames[i],
      ).toLocaleLowerCase()}`,
      user: { connect: { publicAddress: u.publicAddress.toLowerCase() } },
    });
  });

export const artistContracts = [
  '0xc5627C5c94Ac304Ab35EfC00613c8281aF26C64f',
  '0x44D9f85E1B015aD53Aea6b8cB0952c7a88105dA9',
  '0xeEE6F0DDd6a83A69aFBf53d0f9071420A9de43e7',
];

export const auctionParams: Omit<
  ReleaseDatum,
  'releaseId' | 'title' | 'titleSlug' | 'imageKey' | 'goldenEggImageKey' | 'audioKey' | 'duration'
>[] = [
  {
    price: ethers.utils.parseUnits('0.02', 'ether'),
    quantity: 30,
    royaltyBPS: 0,
    startTime: ethers.BigNumber.from(0),
    endTime: ethers.BigNumber.from(MAX_UINT32),
  },
  {
    price: ethers.utils.parseUnits('0.05', 'ether'),
    quantity: 3,
    royaltyBPS: 500,
    startTime: ethers.BigNumber.from(0),
    endTime: ethers.BigNumber.from(MAX_UINT32),
  },
  {
    price: ethers.utils.parseUnits('0.01', 'ether'),
    quantity: 10,
    royaltyBPS: 100,
    startTime: ethers.BigNumber.from(Math.floor(Date.now() / 1000) - 86400), // yesterday
    endTime: ethers.BigNumber.from(MAX_UINT32),
  },
];

export const releaseIds = releaseTitles.map(() => uuid());

type ReleaseDatum = {
  price: ethers.BigNumber;
  quantity: number;
  royaltyBPS: number;
  startTime: ethers.BigNumber;
  endTime: ethers.BigNumber;
  releaseId: string;
  title: string;
  titleSlug: string;
  imageKey: string;
  goldenEggImageKey: string;
  audioKey: string;
  duration: number;
};

export const releaseData: ReleaseDatum[] = releaseIds.map((releaseId, idx) => {
  const data = { ...auctionParams[idx % auctionParams.length] } as ReleaseDatum;
  data.releaseId = releaseId;
  data.title = releaseTitles[idx % releaseTitles.length];
  data.titleSlug = slugify(data.title);
  data.imageKey = imageKeys[idx % imageKeys.length];
  data.goldenEggImageKey = imageKeys[idx + (1 % imageKeys.length)];
  data.audioKey = audioData[idx % audioData.length].key;
  data.duration = audioData[idx % audioData.length].duration;
  return data;
});

export const creditSplits = [
  {
    splitAddress: '0xb28Ad73ebCE83861105B4354bB8F241040533026',
    allocations: [
      {
        ownerAddress: usersData[0].publicAddress.toLowerCase(),
        percent: 60,
        role: 'ARTIST',
      },
      {
        ownerAddress: usersData[1].publicAddress.toLowerCase(),
        percent: 20,
        role: 'PRODUCER',
      },
      {
        ownerAddress: usersData[2].publicAddress.toLowerCase(),
        percent: 15,
        role: 'MANAGER',
      },
      {
        ownerAddress: usersData[3].publicAddress.toLowerCase(),
        percent: 5,
        role: 'ARTWORK_ARTIST',
      },
    ],
  },
];

export const normalizedPeakData = [
  28, 60, 91, 83, 84, 65, 50, 44, 57, 40, 49, 31, 54, 46, 40, 49, 40, 39, 32, 47, 39, 37, 40, 39,
  42, 34, 48, 55, 37, 46, 47, 57, 44, 57, 51, 53, 58, 53, 61, 70, 81, 66, 66, 67, 42, 54, 57, 43,
  50, 67, 65, 46, 46, 49, 49, 65, 46, 45, 39, 38, 34, 33, 42, 39, 48, 42, 58, 43, 39, 43, 69, 80,
  50, 61, 46, 47, 38, 36, 37, 35, 55, 60, 46, 42, 46, 54, 63, 68, 60, 72, 61, 57, 70, 61, 69, 49,
  77, 58, 61, 80, 61, 86, 61, 69, 63, 62, 65, 70, 77, 56, 87, 72, 91, 88, 83, 96, 96, 99, 98, 99,
  98, 98, 99, 87, 98, 95, 91, 97, 86, 93, 80, 89, 67, 72, 64, 44, 56, 31, 31, 24, 26, 20, 24, 23,
  17, 17, 16, 16, 20, 24, 17, 22, 23, 23, 25, 24, 24, 30, 27, 31, 28, 68, 91, 94, 65, 59, 54, 43,
  49, 42, 36, 44, 46, 35, 33, 39, 50, 38, 37, 46, 38, 34, 39, 36, 45, 41, 50, 56, 37, 48, 52, 56,
  45, 54, 55, 58, 58, 53, 66, 61, 70, 71, 73, 80, 56, 54, 52, 41, 50, 72, 69, 57, 54, 50, 58, 54,
  41, 51, 43, 57, 43, 40, 37, 37, 43, 39, 47, 38, 46, 51, 51, 59, 46, 63, 43, 46, 56, 39, 47, 42,
  59, 49, 65, 46, 44, 56, 62, 87, 65, 69, 82, 68, 76, 65, 61, 65, 76, 83, 64, 64, 67, 80, 66, 66,
  60, 70, 69, 61, 76, 68, 79, 73, 94, 95, 61, 98, 79, 95, 98, 99, 99, 96, 95, 90, 98, 90, 92, 94,
  92, 91, 71, 79, 71, 54, 86, 64, 63, 43, 33, 28, 30, 24, 19, 20, 17, 21, 16, 20, 17, 17, 18, 15,
  22, 15, 21, 23, 22, 25, 25, 25, 68, 51, 64, 57, 43, 57, 46, 60, 50, 35, 81, 45, 42, 38, 46, 41,
  57, 45, 36, 55, 64, 53, 57, 40, 56, 66, 49, 45, 64, 69, 90, 61, 69, 68, 57, 81, 74, 65, 55, 67,
  68, 64, 87, 72, 44, 50, 50, 54, 69, 56, 89, 80, 66, 72, 51, 63, 68, 61, 72, 70, 76, 71, 83, 94,
  92, 94, 90, 81, 92, 87, 94, 92, 98, 94, 96, 100, 100, 98, 99, 100, 94, 97, 87, 83, 92, 69, 51, 61,
  54, 43, 76, 51, 47, 51, 63, 43, 66, 41, 45, 58, 64, 55, 50, 46, 54, 68, 50, 53, 57, 71, 93, 58,
  75, 61, 65, 90, 84, 67, 54, 72, 69, 68, 87, 65, 46, 54, 55, 61, 75, 51, 91, 80, 65, 74, 52, 65,
  67, 55, 71, 73, 72, 84, 87, 94, 96, 91, 87, 76, 94, 90, 94, 94, 99, 96, 97, 99, 98, 99, 99, 100,
  91, 70, 70, 54, 46, 54, 39, 57, 50, 34, 83, 50, 46, 44, 47, 42, 62, 46, 38, 50, 66, 55, 56, 35,
  60, 69, 47, 48, 59, 69, 88, 60, 69, 67, 59, 80, 75, 65, 56, 68, 69, 65, 87, 72, 44, 50, 50, 54,
  69, 55, 88, 80, 66, 72, 52, 64, 68, 62, 72, 70, 76, 72, 83, 94, 92, 94, 89, 81, 94, 86, 94, 92,
  100, 94, 96, 99, 100, 99, 100, 100, 94, 98, 85, 79, 87, 62, 46, 57, 57, 55, 82, 54, 59, 51, 62,
  46, 64, 45, 42, 55, 60, 56, 57, 48, 54, 72, 50, 49, 57, 70, 90, 61, 76, 63, 64, 88, 83, 66, 55,
  72, 70, 72, 83, 69, 46, 57, 64, 64, 75, 57, 91, 86, 79, 84, 80, 76, 80, 94, 83, 93, 98, 98, 91,
  91, 93, 98, 93, 98, 99, 94, 100, 98, 99, 90, 92, 100, 99, 99, 100, 100, 90, 75, 64, 61, 61, 94,
  72, 59, 54, 35, 100, 91, 70, 74, 52, 46, 61, 45, 42, 50, 96, 68, 52, 40, 57, 80, 53, 70, 63, 79,
  100, 88, 71, 63, 60, 94, 81, 98, 88, 76, 65, 66, 86, 71, 45, 88, 62, 53, 71, 56, 99, 80, 82, 72,
  58, 65, 69, 70, 73, 72, 95, 81, 83, 93, 93, 96, 90, 81, 94, 91, 98, 93, 99, 95, 97, 100, 97, 100,
  100, 100, 95, 96, 87, 81, 89, 92, 84, 61, 68, 56, 100, 86, 70, 77, 61, 49, 65, 43, 42, 55, 95, 67,
  54, 46, 55, 83, 49, 69, 62, 77, 99, 89, 76, 65, 65, 93, 87, 94, 91, 73, 69, 70, 88, 65, 46, 91,
  61, 61, 76, 59, 100, 83, 84, 73, 59, 72, 67, 63, 72, 72, 98, 90, 87, 91, 96, 95, 88, 76, 97, 89,
  100, 96, 99, 98, 97, 100, 98, 99, 99, 100, 93, 74, 63, 76, 61, 96, 73, 57, 54, 34, 100, 91, 72,
  74, 50, 45, 61, 46, 40, 50, 98, 69, 53, 39, 61, 79, 53, 69, 61, 76, 100, 86, 70, 61, 61, 93, 82,
  97, 85, 76, 68, 66, 86, 72, 44, 89, 63, 53, 71, 56, 100, 78, 83, 73, 58, 66, 69, 70, 73, 73, 96,
  80, 83, 93, 92, 98, 91, 81, 94, 90, 100, 93, 99, 96, 96, 100, 98, 100, 100, 100, 97, 98, 87, 80,
  89, 93, 83, 61, 68, 56, 100, 92, 70, 77, 61, 49, 66, 43, 42, 55, 94, 68, 55, 44, 56, 87, 50, 68,
  62, 76, 100, 86, 76, 65, 65, 92, 87, 94, 89, 72, 67, 72, 83, 69, 47, 57, 62, 65, 73, 57, 90, 85,
  80, 83, 80, 77, 83, 96, 86, 95, 99, 99, 95, 93, 93, 100, 91, 95, 100, 91, 100, 99, 98, 95, 98,
  100, 91, 99, 91, 98, 91, 97, 82, 77, 83, 83, 81, 68, 70, 74, 75, 69, 63, 61, 54, 46, 53, 55, 55,
  58, 99, 98, 98, 78, 73, 65, 67, 56, 50, 55, 52, 54, 61, 71, 72, 99, 95, 72, 52, 61, 98, 92, 92,
  88, 91, 88, 94, 95, 89, 61, 97, 91, 86, 87, 79, 80, 74, 71, 66, 72, 90, 92, 82, 87, 77, 79, 75,
  71, 66, 71, 75, 8, 6, 6, 4, 3, 2, 1, 1, 1, 98, 98, 88, 80, 83, 84, 83, 68, 71, 73, 99, 69, 65, 61,
  54, 50, 53, 54, 56, 58, 97, 98, 98, 79, 73, 64, 67, 65, 51, 55, 96, 57, 66, 72, 72, 99, 94, 72,
  52, 59, 98, 91, 91, 89, 90, 89, 94, 95, 88, 59, 97, 95, 89, 83, 75, 76, 69, 69, 61, 65, 96, 89,
  73, 76, 68, 69, 66, 61, 59, 61, 82, 20, 9, 6, 4, 2, 2, 2, 5, 11, 100, 89, 79, 81, 75, 99, 78, 69,
  61, 62, 98, 87, 60, 64, 43, 79, 70, 52, 54, 57, 95, 93, 97, 76, 67, 91, 66, 76, 88, 52, 100, 77,
  56, 65, 66, 99, 94, 100, 85, 73, 99, 83, 83, 83, 85, 99, 90, 94, 90, 57, 99, 89, 92, 88, 78, 99,
  85, 98, 74, 90, 98, 93, 88, 83, 73, 90, 75, 81, 90, 73, 97, 43, 26, 22, 3, 2, 2, 1, 1, 1, 99, 92,
  87, 91, 82, 99, 87, 81, 74, 72, 100, 83, 69, 68, 51, 90, 87, 70, 74, 80, 98, 97, 91, 77, 79, 99,
  73, 80, 87, 64, 100, 87, 86, 79, 85, 100, 77, 100, 98, 75, 100, 91, 94, 98, 94, 100, 96, 100, 94,
  87, 96, 96, 99, 100, 84, 100, 86, 92, 98, 94, 98, 100, 100, 100, 94, 100, 98, 93, 92, 88, 87, 64,
  62, 41, 32, 54, 56, 53, 32, 11, 99, 78, 78, 78, 78, 77, 76, 76, 76, 73, 96, 87, 61, 57, 54, 77,
  86, 79, 54, 14, 100, 76, 80, 79, 76, 87, 50, 98, 78, 77, 95, 83, 69, 49, 5, 98, 98, 96, 87, 76,
  99, 77, 81, 80, 77, 85, 31, 99, 80, 77, 98, 87, 73, 55, 6, 99, 98, 95, 88, 84, 99, 75, 79, 78, 76,
  87, 76, 76, 78, 74, 95, 88, 61, 61, 57, 84, 92, 65, 46, 2, 100, 79, 82, 80, 78, 80, 77, 83, 79,
  73, 96, 87, 61, 57, 54, 76, 83, 79, 25, 14, 99, 76, 80, 79, 76, 87, 77, 99, 76, 76, 98, 85, 69,
  48, 5, 99, 98, 98, 89, 76, 99, 77, 80, 80, 77, 80, 62, 99, 80, 76, 98, 89, 69, 12, 2, 99, 98, 97,
  91, 77, 98, 74, 79, 77, 76, 87, 77, 76, 78, 74, 99, 93, 93, 92, 89, 86, 76, 67, 56, 46, 99, 78,
  82, 80, 77, 80, 77, 83, 79, 73, 95, 89, 61, 57, 54, 77, 86, 79, 53, 13, 99, 76, 80, 79, 76, 87,
  38, 99, 79, 77, 97, 82, 69, 79, 10, 98, 97, 96, 85, 76, 99, 77, 81, 80, 77, 80, 14, 99, 80, 77,
  98, 91, 75, 80, 7, 99, 98, 95, 89, 81, 98, 73, 79, 78, 76, 87, 77, 76, 79, 74, 94, 87, 62, 61, 57,
  84, 93, 64, 55, 29, 99, 79, 83, 80, 78, 80, 77, 83, 78, 73, 98, 91, 61, 57, 54, 76, 84, 59, 31,
  12, 100, 75, 79, 79, 77, 87, 77, 99, 76, 77, 97, 83, 69, 70, 14, 99, 97, 98, 87, 83, 98, 83, 90,
  92, 14, 46, 0, 0, 0, 0, 0, 0, 0, 0, 90, 90, 91, 92, 19, 45, 0, 0, 0, 0, 0, 0, 0, 0, 91, 90, 92,
  93, 56, 44, 43, 0, 0, 0, 0, 0, 0, 91, 90, 92, 53, 93, 14, 46, 3, 0, 0, 0, 0, 99, 90, 89, 91, 87,
  100, 94, 83, 83, 77, 100, 94, 87, 72, 58, 83, 48, 45, 44, 6, 99, 86, 84, 79, 77, 87, 52, 99, 96,
  82, 100, 79, 80, 65, 14, 98, 90, 100, 100, 87, 98, 78, 88, 78, 80, 99, 45, 99, 84, 76, 100, 94,
  96, 87, 15, 98, 80, 94, 83, 74, 99, 83, 84, 84, 77, 84, 78, 94, 95, 77, 100, 94, 67, 72, 59, 96,
  62, 100, 80, 26, 99, 91, 90, 91, 86, 100, 94, 83, 83, 78, 100, 96, 87, 69, 58, 83, 47, 43, 13, 3,
  100, 86, 84, 79, 77, 87, 80, 99, 97, 80, 100, 79, 80, 64, 14, 98, 91, 100, 100, 90, 98, 78, 88,
  78, 80, 98, 71, 99, 85, 76, 100, 94, 87, 40, 12, 98, 81, 95, 84, 76, 98, 83, 85, 83, 77, 84, 78,
  94, 95, 77, 100, 94, 85, 89, 85, 85, 81, 69, 61, 50, 100, 91, 88, 89, 86, 100, 94, 82, 82, 78,
  100, 98, 87, 71, 58, 83, 48, 45, 39, 3, 100, 84, 83, 79, 77, 87, 39, 99, 95, 82, 100, 77, 80, 82,
  17, 100, 91, 99, 97, 91, 98, 78, 87, 78, 80, 99, 27, 98, 83, 77, 100, 95, 95, 98, 17, 98, 80, 94,
  84, 73, 98, 83, 84, 84, 77, 85, 78, 94, 95, 77, 100, 91, 68, 72, 59, 97, 62, 99, 91, 54, 99, 91,
  90, 92, 85, 100, 95, 83, 83, 77, 100, 96, 87, 69, 58, 83, 50, 28, 13, 2, 100, 87, 83, 79, 77, 87,
  80, 100, 95, 80, 100, 80, 80, 74, 19, 99, 90, 100, 98, 89, 100, 92, 94, 93, 89, 91, 77, 99, 91,
  94, 95, 92, 88, 82, 2, 100, 94, 95, 94, 90, 97, 87, 87, 87, 86, 84, 83, 80, 74, 68, 61, 54, 47,
  40, 35, 31, 27, 22, 20, 17, 49, 31, 17, 23, 13, 54, 43, 65, 56, 15, 74, 73, 24, 17, 15, 66, 27,
  28, 24, 15, 84, 29, 30, 13, 18, 66, 12, 14, 15, 13, 84, 61, 56, 41, 17, 81, 13, 48, 31, 20, 39,
  18, 15, 10, 13, 59, 34, 70, 52, 15, 72, 68, 20, 10, 9, 66, 17, 45, 51, 9, 94, 24, 21, 13, 5, 9, 4,
  4, 5, 3, 73, 72, 20, 6, 4, 6, 6, 3, 3, 4, 39, 13, 9, 4, 5, 59, 32, 70, 52, 13, 73, 69, 17, 2, 3,
  65, 15, 15, 7, 5, 91, 24, 21, 8, 2, 61, 2, 2, 2, 1, 82, 73, 50, 34, 6, 82, 6, 52, 34, 5, 39, 15,
  9, 2, 1, 57, 30, 73, 48, 12, 73, 68, 17, 1, 1, 63, 17, 48, 50, 8, 72, 47, 49, 9, 3, 98, 53, 8, 1,
  4, 89, 66, 48, 10, 3, 5, 2, 2, 2, 2, 51, 17, 21, 7, 1, 54, 31, 71, 53, 12, 72, 69, 20, 7, 1, 62,
  17, 25, 7, 4, 91, 27, 24, 13, 2, 61, 4, 17, 6, 0, 1, 88, 69, 46, 36, 5, 80, 6, 57, 38, 6, 50, 17,
  21, 7, 1, 54, 33, 71, 52, 11, 72, 69, 20, 7, 1, 62, 17, 57, 50, 7, 91, 27, 24, 13, 2, 17, 2, 17,
  6, 0, 1, 82, 62, 17, 3, 2, 4, 1, 2, 2, 2, 51, 18, 21, 6, 1, 54, 32, 74, 50, 11, 72, 68, 20, 7, 2,
  63, 17, 26, 7, 5, 91, 26, 24, 13, 2, 62, 4, 17, 6, 0, 1, 72, 72, 21, 7, 2, 17, 2, 17, 6, 2, 90,
  90, 91, 92, 14, 46, 0, 0, 0, 0, 0, 0, 0, 0, 90, 90, 91, 92, 19, 46, 0, 0, 0, 0, 0, 0, 0, 0, 91,
  91, 92, 93, 54, 43, 43, 0, 0, 0, 0, 0, 0, 91, 91, 92, 55, 93, 14, 46, 3, 0, 0, 0, 0, 99, 80, 80,
  80, 78, 83, 83, 88, 89, 71, 96, 86, 61, 57, 54, 94, 93, 80, 65, 15, 100, 75, 77, 76, 76, 91, 49,
  98, 78, 77, 94, 81, 74, 61, 8, 99, 94, 94, 80, 76, 100, 79, 79, 79, 77, 86, 42, 99, 81, 76, 97,
  85, 72, 55, 6, 98, 98, 96, 87, 76, 99, 73, 76, 75, 76, 87, 76, 76, 78, 74, 95, 89, 61, 61, 57, 79,
  88, 69, 37, 2, 100, 80, 80, 80, 78, 83, 83, 88, 90, 70, 95, 87, 61, 57, 54, 94, 87, 69, 27, 9,
  100, 74, 76, 76, 76, 90, 76, 99, 76, 76, 94, 81, 75, 60, 7, 100, 95, 97, 88, 76, 99, 78, 80, 79,
  76, 83, 68, 100, 82, 76, 97, 88, 69, 12, 2, 99, 96, 97, 91, 76, 98, 81, 80, 72, 75, 92, 81, 71,
  73, 72, 99, 94, 91, 85, 86, 83, 76, 67, 57, 46, 99, 80, 80, 80, 77, 83, 83, 90, 91, 70, 96, 86,
  61, 57, 54, 94, 88, 83, 54, 13, 100, 74, 76, 76, 76, 90, 38, 99, 78, 77, 98, 80, 74, 78, 13, 99,
  97, 96, 81, 76, 99, 78, 80, 79, 77, 83, 35, 98, 80, 76, 97, 90, 74, 80, 8, 99, 98, 95, 83, 73,
  100, 73, 75, 74, 76, 86, 76, 76, 79, 74, 94, 87, 61, 61, 57, 84, 93, 64, 55, 29, 99, 80, 80, 80,
  78, 83, 84, 87, 90, 69, 94, 89, 61, 57, 54, 96, 85, 57, 27, 12, 100, 74, 76, 76, 76, 90, 76, 99,
  76, 76, 94, 81, 74, 69, 15, 99, 96, 97, 83, 76, 99, 92, 93, 91, 89, 85, 76, 99, 92, 94, 93, 91,
  88, 80, 2, 99, 94, 94, 93, 90, 97, 87, 88, 87, 86, 85, 83, 80, 74, 69, 62, 55, 48, 42, 37, 33, 30,
  28, 26, 22, 96, 84, 87, 72, 84, 76, 74, 62, 67, 50, 76, 65, 44, 38, 42, 98, 91, 90, 87, 90, 74,
  70, 57, 47, 57, 95, 88, 91, 91, 90, 94, 91, 87, 89, 61, 100, 94, 94, 93, 83, 94, 94, 86, 72, 44,
  99, 83, 93, 94, 83, 98, 94, 75, 75, 53, 98, 94, 96, 98, 95, 84, 94, 91, 94, 93, 95, 91, 83, 94,
  87, 94, 99, 100, 94, 96, 100, 100, 98, 100, 100, 100, 98, 92, 95, 98, 93, 83, 57, 73, 50, 77, 69,
  54, 53, 60, 99, 93, 89, 89, 85, 81, 83, 74, 62, 51, 94, 96, 95, 98, 77, 72, 76, 78, 65, 65, 98,
  97, 92, 94, 90, 72, 66, 87, 65, 46, 94, 90, 95, 96, 82, 98, 91, 86, 91, 61, 99, 95, 99, 98, 97,
  99, 90, 94, 97, 89, 100, 92, 95, 91, 93, 91, 92, 98, 94, 96, 98, 94, 100, 100, 100, 95, 89, 92,
  87, 83, 80, 73, 64, 70, 50, 74, 69, 47, 44, 45, 95, 93, 88, 91, 87, 83, 80, 76, 54, 62, 92, 87,
  91, 91, 91, 95, 90, 91, 90, 61, 98, 94, 94, 91, 86, 94, 94, 86, 72, 44, 98, 83, 93, 95, 83, 98,
  93, 75, 74, 53, 98, 91, 99, 98, 96, 91, 95, 90, 94, 91, 97, 91, 82, 94, 86, 99, 98, 100, 94, 96,
  100, 100, 99, 99, 100, 100, 98, 94, 93, 98, 91, 83, 57, 75, 49, 77, 69, 55, 52, 60, 99, 91, 88,
  90, 85, 80, 85, 73, 62, 50, 93, 93, 96, 98, 76, 76, 78, 77, 65, 65, 98, 95, 94, 94, 90, 78, 72,
  83, 69, 46, 97, 95, 94, 98, 83, 96, 91, 86, 96, 77, 98, 94, 100, 97, 91, 100, 98, 93, 94, 89, 97,
  99, 100, 98, 100, 100, 100, 99, 90, 91, 100, 100, 100, 99, 98, 97, 94, 94, 94, 97, 99, 95, 69, 87,
  83, 98, 94, 95, 75, 71, 98, 92, 85, 87, 89, 91, 76, 55, 44, 40, 94, 88, 90, 89, 77, 100, 85, 69,
  59, 60, 98, 87, 100, 94, 72, 84, 76, 55, 41, 24, 100, 88, 94, 90, 73, 100, 85, 69, 59, 58, 95, 89,
  96, 94, 86, 91, 80, 81, 60, 61, 78, 61, 56, 87, 63, 97, 90, 85, 77, 81, 98, 86, 100, 99, 99, 98,
  93, 87, 93, 86, 94, 87, 52, 61, 36, 100, 89, 60, 72, 46, 98, 93, 91, 91, 87, 93, 79, 57, 42, 29,
  92, 94, 96, 93, 69, 100, 83, 45, 59, 65, 94, 89, 100, 95, 72, 44, 41, 57, 37, 25, 100, 90, 92, 93,
  71, 100, 82, 87, 72, 59, 97, 87, 95, 92, 84, 100, 78, 81, 74, 61, 97, 90, 93, 94, 87, 79, 86, 81,
  76, 73, 98, 91, 98, 97, 98, 100, 93, 95, 94, 94, 99, 96, 70, 87, 87, 99, 91, 94, 76, 69, 96, 92,
  83, 87, 86, 91, 78, 54, 46, 42, 94, 89, 91, 90, 77, 100, 85, 69, 58, 58, 98, 88, 100, 93, 71, 84,
  76, 55, 42, 24, 100, 89, 94, 90, 72, 99, 84, 69, 58, 59, 95, 89, 99, 94, 87, 91, 79, 76, 60, 61,
  79, 61, 55, 87, 63, 98, 91, 86, 78, 81, 98, 88, 100, 100, 100, 99, 90, 90, 91, 86, 94, 85, 51, 62,
  35, 100, 88, 60, 74, 45, 99, 93, 91, 88, 85, 93, 82, 54, 43, 29, 92, 92, 95, 93, 68, 99, 85, 45,
  46, 58, 94, 91, 100, 95, 72, 65, 70, 83, 69, 46, 57, 63, 65, 75, 58, 91, 85, 78, 83, 80, 76, 80,
  93, 83, 92, 98, 98, 91, 91, 91, 98, 93, 98, 98, 94, 100, 98, 98, 91, 92, 99, 100, 99, 100, 98, 99,
  97, 81, 77, 83, 83, 82, 68, 69, 73, 75, 69, 63, 61, 54, 46, 53, 56, 55, 58, 98, 98, 98, 78, 73,
  64, 67, 56, 51, 55, 52, 55, 61, 72, 72, 99, 94, 72, 52, 61, 98, 92, 92, 88, 91, 88, 94, 95, 89,
  61, 97, 91, 86, 87, 78, 80, 74, 71, 65, 72, 90, 92, 82, 87, 77, 79, 75, 71, 66, 71, 75, 8, 6, 6,
  4, 3, 2, 1, 1, 1, 99, 97, 87, 79, 80, 81, 79, 65, 67, 69, 99, 65, 60, 56, 50, 45, 46, 49, 49, 52,
  95, 97, 95, 73, 64, 55, 57, 57, 43, 45, 95, 49, 57, 61, 61, 99, 92, 61, 46, 50, 95, 83, 82, 80,
  84, 84, 89, 93, 83, 54, 96, 94, 83, 77, 69, 69, 66, 65, 58, 63, 94, 87, 75, 76, 67, 70, 69, 63,
  59, 64, 83, 20, 9, 6, 4, 2, 2, 1, 1, 0, 99, 90, 81, 82, 78, 100, 80, 71, 64, 65, 99, 81, 61, 69,
  43, 80, 76, 51, 55, 63, 100, 94, 93, 80, 76, 91, 70, 76, 90, 52, 98, 76, 73, 77, 80, 99, 93, 99,
  87, 75, 100, 86, 87, 85, 83, 99, 89, 98, 96, 56, 99, 95, 87, 95, 88, 99, 82, 97, 77, 92, 94, 91,
  82, 80, 78, 91, 86, 75, 99, 84, 98, 42, 13, 6, 6, 4, 3, 2, 2, 1, 99, 93, 96, 94, 93, 99, 96, 87,
  83, 84, 100, 77, 76, 84, 72, 96, 89, 80, 86, 83, 100, 95, 97, 93, 94, 95, 80, 94, 95, 76, 100, 91,
  90, 87, 91, 99, 79, 100, 99, 65, 100, 89, 94, 99, 94, 99, 96, 100, 94, 85, 98, 94, 98, 100, 93,
  100, 87, 94, 98, 94, 99, 97, 99, 100, 91, 100, 100, 94, 92, 91, 87, 63, 62, 41, 35, 40, 58, 46,
  35, 2, 99, 65, 48, 25, 14, 54, 30, 72, 53, 9, 73, 69, 18, 2, 2, 65, 68, 48, 36, 13, 100, 69, 59,
  28, 13, 58, 5, 99, 70, 59, 86, 61, 51, 35, 5, 99, 92, 91, 54, 14, 99, 66, 48, 25, 13, 55, 32, 72,
  49, 10, 72, 65, 19, 1, 1, 65, 57, 57, 58, 15, 100, 70, 60, 28, 13, 9, 4, 2, 2, 2, 72, 70, 18, 2,
  2, 43, 63, 49, 31, 4, 99, 66, 48, 25, 14, 55, 31, 70, 52, 9, 72, 69, 17, 2, 2, 67, 61, 43, 35, 14,
  100, 70, 59, 28, 13, 58, 6, 99, 70, 59, 85, 59, 51, 35, 5, 99, 96, 80, 57, 15, 98, 66, 48, 25, 13,
  55, 32, 72, 48, 11, 73, 68, 17, 1, 1, 65, 57, 60, 57, 9, 98, 79, 72, 24, 13, 98, 56, 9, 2, 6, 72,
  46, 47, 9, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 99, 67, 48, 29, 14, 52, 30, 72, 54, 10, 72, 68, 20, 6, 2,
  66, 68, 61, 35, 14, 99, 71, 58, 31, 13, 59, 6, 99, 72, 60, 89, 58, 46, 37, 4, 99, 92, 92, 57, 14,
  99, 67, 48, 29, 14, 52, 33, 72, 52, 11, 72, 69, 20, 8, 1, 65, 59, 69, 59, 15, 100, 71, 60, 31, 13,
  24, 6, 17, 7, 2, 83, 61, 18, 3, 2, 44, 63, 47, 31, 5, 100, 67, 48, 29, 14, 52, 31, 72, 54, 9, 72,
  68, 20, 6, 2, 64, 60, 44, 36, 14, 100, 70, 57, 33, 13, 59, 7, 99, 72, 60, 89, 58, 46, 37, 5, 100,
  96, 80, 58, 14, 88, 90, 91, 92, 14, 46, 0, 0, 0, 0, 0, 0, 0, 0, 91, 90, 91, 93, 21, 45, 0, 0, 0,
  0, 0, 0, 0, 0, 91, 90, 91, 93, 54, 44, 43, 0, 0, 0, 0, 0, 0, 91, 91, 91, 54, 93, 14, 46, 3, 0, 0,
  0, 0, 100, 83, 85, 80, 81, 100, 97, 86, 87, 73, 100, 92, 86, 70, 59, 95, 93, 78, 65, 16, 100, 83,
  82, 77, 79, 91, 50, 98, 96, 82, 100, 79, 80, 65, 13, 99, 98, 98, 99, 83, 98, 78, 88, 77, 80, 98,
  48, 99, 85, 76, 100, 92, 96, 87, 15, 99, 95, 94, 91, 80, 99, 83, 79, 81, 76, 85, 78, 94, 95, 77,
  100, 94, 66, 72, 59, 97, 88, 99, 90, 25, 100, 80, 84, 79, 78, 99, 96, 88, 87, 72, 100, 95, 87, 71,
  59, 96, 84, 67, 33, 16, 100, 84, 80, 78, 77, 91, 80, 99, 95, 80, 100, 79, 80, 64, 14, 100, 97,
  100, 94, 81, 98, 78, 88, 78, 80, 99, 72, 99, 88, 76, 100, 94, 87, 40, 12, 99, 95, 95, 90, 76, 98,
  81, 76, 77, 76, 94, 83, 91, 94, 76, 100, 96, 91, 86, 86, 84, 76, 67, 56, 46, 100, 80, 83, 79, 77,
  100, 95, 89, 87, 72, 100, 95, 87, 71, 59, 96, 88, 83, 53, 13, 100, 83, 80, 78, 77, 91, 38, 100,
  97, 82, 100, 78, 80, 83, 18, 99, 98, 100, 100, 83, 98, 77, 88, 78, 80, 98, 41, 99, 86, 76, 100,
  94, 95, 98, 17, 99, 97, 95, 86, 75, 100, 80, 78, 81, 76, 85, 78, 94, 95, 77, 100, 91, 69, 72, 59,
  98, 94, 99, 91, 52, 99, 80, 84, 80, 78, 100, 94, 89, 89, 72, 99, 96, 87, 70, 58, 98, 86, 60, 28,
  13, 100, 83, 80, 78, 77, 93, 79, 99, 96, 80, 100, 80, 80, 75, 18, 99, 97, 100, 94, 85, 95, 44, 39,
  40, 31, 40, 35, 31, 34, 31, 77, 38, 58, 66, 50, 72, 61, 81, 63, 62, 97, 87, 95, 74, 61, 94, 86,
  91, 95, 79, 100, 80, 85, 98, 68, 98, 92, 95, 94, 87, 99, 91, 88, 91, 86, 100, 94, 83, 83, 77, 100,
  94, 87, 71, 58, 94, 92, 80, 69, 14, 100, 85, 84, 79, 77, 87, 52, 99, 96, 82, 100, 79, 80, 65, 14,
  98, 99, 100, 95, 88, 98, 78, 88, 78, 80, 99, 45, 99, 84, 76, 100, 94, 96, 87, 15, 99, 95, 95, 91,
  83, 99, 84, 85, 84, 77, 85, 78, 94, 95, 77, 100, 94, 67, 72, 59, 97, 88, 100, 91, 25, 99, 91, 90,
  91, 86, 100, 94, 83, 83, 78, 100, 96, 87, 69, 58, 91, 86, 66, 32, 15, 100, 86, 84, 79, 77, 87, 80,
  99, 97, 80, 100, 79, 80, 64, 14, 100, 97, 99, 98, 90, 98, 78, 88, 78, 80, 98, 71, 99, 86, 76, 100,
  94, 87, 40, 12, 98, 96, 96, 91, 76, 98, 83, 85, 83, 77, 84, 78, 94, 95, 77, 99, 88, 89, 88, 87,
  85, 76, 68, 57, 46, 100, 90, 89, 89, 86, 100, 94, 82, 82, 77, 100, 98, 87, 71, 58, 95, 91, 81, 57,
  15, 100, 85, 83, 79, 77, 87, 39, 99, 95, 82, 100, 77, 80, 82, 18, 98, 98, 100, 99, 90, 98, 78, 88,
  78, 80, 99, 27, 98, 83, 77, 100, 95, 95, 98, 17, 98, 97, 94, 86, 75, 99, 83, 84, 83, 77, 85, 78,
  94, 95, 77, 99, 91, 69, 72, 59, 97, 93, 99, 91, 52, 99, 91, 90, 91, 86, 100, 95, 83, 83, 77, 100,
  96, 87, 69, 58, 92, 87, 59, 41, 11, 100, 86, 83, 79, 77, 87, 80, 99, 95, 80, 100, 80, 80, 74, 19,
  98, 96, 99, 94, 89, 100, 92, 94, 93, 89, 91, 77, 99, 92, 94, 95, 92, 88, 82, 2, 100, 94, 95, 94,
  90, 97, 87, 87, 87, 85, 84, 83, 80, 74, 68, 61, 54, 47, 40, 35, 31, 27, 22, 20, 17, 100, 90, 88,
  91, 85, 100, 95, 83, 83, 78, 100, 94, 87, 72, 58, 83, 48, 45, 44, 6, 100, 86, 84, 79, 77, 86, 52,
  99, 97, 82, 100, 79, 80, 65, 14, 99, 90, 99, 100, 87, 98, 78, 88, 78, 80, 99, 45, 99, 84, 76, 100,
  95, 96, 87, 15, 98, 80, 94, 84, 74, 99, 84, 85, 84, 77, 85, 78, 94, 95, 77, 100, 94, 67, 72, 59,
  96, 62, 100, 81, 26, 99, 91, 90, 91, 85, 100, 94, 83, 83, 79, 100, 96, 87, 69, 58, 83, 47, 43, 13,
  3, 100, 86, 84, 80, 77, 86, 80, 99, 96, 80, 100, 79, 80, 64, 14, 98, 91, 100, 100, 89, 98, 78, 88,
  78, 80, 99, 71, 99, 86, 76, 100, 92, 87, 40, 12, 98, 80, 95, 84, 76, 98, 83, 84, 83, 77, 85, 78,
  94, 95, 77, 100, 88, 89, 87, 87, 85, 76, 68, 57, 46, 100, 90, 88, 90, 85, 100, 95, 82, 82, 78,
  100, 98, 87, 72, 58, 83, 48, 45, 39, 3, 100, 85, 83, 79, 77, 86, 39, 99, 96, 81, 100, 77, 80, 82,
  17, 99, 91, 100, 98, 89, 98, 78, 88, 78, 80, 99, 27, 99, 84, 77, 100, 94, 95, 98, 17, 98, 80, 94,
  84, 73, 99, 83, 85, 84, 77, 85, 78, 94, 95, 77, 100, 91, 69, 72, 59, 97, 62, 99, 91, 54, 99, 91,
  90, 92, 85, 100, 95, 83, 83, 79, 100, 96, 87, 70, 58, 83, 50, 28, 13, 2, 100, 86, 84, 79, 77, 87,
  80, 99, 95, 80, 100, 79, 80, 74, 19, 99, 89, 100, 99, 90, 100, 92, 94, 94, 89, 91, 77, 99, 92, 94,
  95, 92, 88, 82, 2, 99, 94, 96, 94, 91, 97, 87, 87, 87, 85, 84, 83, 80, 74, 68, 61, 54, 47, 40, 35,
  31, 27, 22, 20, 15, 0, 0,
];
