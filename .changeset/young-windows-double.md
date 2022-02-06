---
'@soundxyz/protocol': major
'@soundxyz/common': minor
---

@soundxyz/common-v2test

- adds getPresaleSignature helper function

@soundxyz/protocol-v2test

- adds natspec comments to contracts
- fixes royaltyInfo bug
- adds events to setStartTime and setEndTime
- implements presale whitelisting via signatures in Artist.sol:
  - adds presaleQuantity & signerAddress to Edition struct
  - adds PRESALE_TYPEHASH constant to storage
  - adds getSigner function
  - makes changes to buyEdition for whitelisting functionality
  - makes changes & additions to tests
