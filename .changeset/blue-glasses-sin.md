---
'@soundxyz/protocol': minor
---

- Bitpacks editionId into top bits of tokenId
- Deprecates atTokenId and in favor of bit-packed editionId with tokenId
- Adds presale quantity and signature setters
- Adds editionCount view function
- Sends ETH directly to fundingRecipient during buyEdition call
