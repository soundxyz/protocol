# @soundxyz/common

## 2.5.1

### Patch Changes

- e704ce2: Fixing last publish

## 2.5.0

### Minor Changes

- ebe83a3: Fixes creditSplits allocations and seed script
- e203bec: Adds edition to dummy editions

## 2.4.0

### Minor Changes

- 91a85d9: Sets some edition startTimes in the future

## 2.3.0

### Minor Changes

- 879d7bb: More decimals in credit allocations seed data

## 2.2.0

### Minor Changes

- c3d3fc8: Changes roles to CreditRole and increases seed data

## 2.1.0

### Minor Changes

- c7e28ae: - Makes Oshi's first 3 editions use the creditSplit.splitAddress for fundingRecipient
  - Adds SOUND_ADMIN_PUBLIC_ADDRESS to common/src/constants

## 2.0.0

### Major Changes

- 71c2e4d: Adds creditSplits & edition purchases

## 1.3.1

### Patch Changes

- cedeba8: Remove unused dependencies

## 1.3.0

### Minor Changes

- 9fe323f: @soundxyz/common

  - adds getPresaleSignature helper function

  @soundxyz/protocol

  - adds natspec comments to contracts
  - fixes royaltyInfo bug
  - adds events to setStartTime and setEndTime
  - implements presale whitelisting via signatures in Artist.sol:
    - adds presaleQuantity & signerAddress to Edition struct
    - adds PRESALE_TYPEHASH constant to storage
    - adds getSigner function
    - makes changes to buyEdition for whitelisting functionality
    - makes changes & additions to tests

## 1.2.0

### Minor Changes

- bd50a7c: Adds displayName to seed users

## 1.1.0

### Minor Changes

- 6a7f07b: Adds creditSplit seed data & contract

## 1.0.5

### Patch Changes

- 1c57d7f: Set license as GPLv3

## 1.0.4

### Patch Changes

- 3456d3b: Fix release

## 1.0.3

### Patch Changes

- 7748c1a: Fix release

## 1.0.2

### Patch Changes

- 08826b4: Adding more audio to seed data

## 1.0.1

### Patch Changes

- b961b9b: Add "UNLICENSED" to published package

## 1.0.0

### Major Changes

- 610e2f6: Release
