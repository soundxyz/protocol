# sound.xyz protocol

We're enabling musicians to deploy a dedicated 721 that they control to mint editions of song NFTs.

Open questions:

- upgradeability patterns and implementation look reasonable?
- any optimizations we should consider?

## ArtistCreator.sol

Factory contract to deploy Artist.sol

- requires an auth signature we provide (ie: so attackers can't deploy "Kanye West")
- Currently using UUPS upgrade pattern, but we _might_ switch to beacon pattern for consistency (that's what Artist.sol is using)

## Artist.sol

- Modified ERC-721 forked from Mirror.xyz (Editions.sol) that mints editions of NFTs
- has some view functions that we will likely eventually remove (`getTokenIdsOfEdition` & `getOwnersOfEdition`). They currently only exist to aid in syncing our database.
- using beacon upgrade pattern
