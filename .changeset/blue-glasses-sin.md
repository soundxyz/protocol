---
'@soundxyz/protocol': minor
---

- Removes 0xSplit deployment code (no longer needed)
- Fresh rinkeby deployment
- Bitpacks editionId into top bits of tokenId
- Deprecates atTokenId and in favor of bit-packed editionId with tokenId
- Adds presale quantity and signature setters
- Adds editionCount view function
- Sends ETH directly to fundingRecipient during buyEdition call
