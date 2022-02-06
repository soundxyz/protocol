# @soundxyz/protocol

## 2.0.1

### Patch Changes

- cedeba8: Remove unused dependencies
- Updated dependencies [cedeba8]
  - @soundxyz/common@1.3.1

## 2.0.0

### Major Changes

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

### Patch Changes

- Updated dependencies [9fe323f]
  - @soundxyz/common@1.3.0

## 1.4.0

### Minor Changes

- 6a7f07b: Adds creditSplit seed data & contract

### Patch Changes

- Updated dependencies [6a7f07b]
  - @soundxyz/common@1.1.0

## 1.3.1

### Patch Changes

- 1c57d7f: Set license as GPLv3
- Updated dependencies [1c57d7f]
  - @soundxyz/common@1.0.5

## 1.3.0

### Minor Changes

- fdc49ff: Adds 0xSplits contracts

## 1.2.3

### Patch Changes

- f673af1: Fix release
- Updated dependencies [7748c1a]
  - @soundxyz/common@1.0.3

## 1.0.5

### Patch Changes

- 08490af: Fix typechain .d.ts files

## 1.0.3

### Patch Changes

- e0cca98: change publish deployments target

  fixes race-conditions while importing

## 1.0.1

### Patch Changes

- 08bc665: Don't build json

## 1.0.0

### Major Changes

- 610e2f6: Release

### Patch Changes

- Updated dependencies [610e2f6]
  - @soundxyz/common@1.0.0
