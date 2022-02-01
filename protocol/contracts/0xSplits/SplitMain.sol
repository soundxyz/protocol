// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.7;

import {ISplitMain} from './interfaces/ISplitMain.sol';
import {SplitWallet} from './SplitWallet.sol';
import {Clones} from './libraries/Clones.sol';
import {ERC20} from '@rari-capital/solmate/src/tokens/ERC20.sol';
import {SafeTransferLib} from '@rari-capital/solmate/src/utils/SafeTransferLib.sol';

/**
 * ERRORS
 */

/// @notice Unauthorized sender `sender`
error Unauthorized(address sender);
/// @notice Invalid number of accounts `accountsLength`, must have at least 2
error InvalidSplit__TooFewAccounts(uint256 accountsLength);
/// @notice Array lengths of accounts & percentAllocations don't match (`accountsLength` != `allocationsLength`)
error InvalidSplit__AccountsAndAllocationsMismatch(uint256 accountsLength, uint256 allocationsLength);
/// @notice Invalid percentAllocations sum `allocationsSum` must equal `PERCENTAGE_SCALE`
error InvalidSplit__InvalidAllocationsSum(uint32 allocationsSum);
/// @notice Invalid accounts ordering at `index`
error InvalidSplit__AccountsOutOfOrder(uint256 index);
/// @notice Invalid percentAllocation of zero at `index`
error InvalidSplit__AllocationMustBePositive(uint256 index);
/// @notice Invalid splitterFee `splitterFee` cannot be greater than 10% (1e5)
error InvalidSplit__InvalidSplitterFee(uint32 splitterFee);
/// @notice Invalid hash `hash` from split data (accounts, percentAllocations, splitterFee)
error InvalidSplit__InvalidHash(bytes32 hash);
/// @notice Invalid new controlling address `newOwner` for mutable split
error InvalidNewOwner(address newOwner);
/// @notice ETH withdrawal of `amount` failed
error ETHWithdrawalFailed(uint256 amount);
/// @notice ERC20 withdrawal of `amount` of `token` failed
error ERC20WithdrawalFailed(ERC20 token, uint256 amount);

/**
 * @title SplitMain
 * @author 0xSplits
 * @notice A composable and gas-efficient protocol for deploying splitter contracts.
 * @dev Split recipients, ownerships, and keeper fees are stored onchain as calldata & re-passed as args / validated
 * via hashing when needed. Each split gets its own address & proxy for maximum composability with other contracts onchain.
 * For these proxies, we extended EIP-1167 Minimal Proxy Contract to avoid `DELEGATECALL` for `receive()` to accept
 * hard gas-capped `sends` & `transfers`.
 */
contract SplitMain is ISplitMain {
    using SafeTransferLib for ERC20;

    /**
     * STRUCTS
     */

    /// @notice holds Split metadata
    struct Split {
        bytes32 hash;
        address owner;
        address newPotentialOwner;
    }

    /**
     * STORAGE
     */

    /**
     * STORAGE - CONSTANTS & IMMUTABLES
     */

    /// @notice constant to scale uints into percentages (1e6 == 100%)
    uint256 public constant PERCENTAGE_SCALE = 1e6;
    /// @notice maximum splitter fee; 1e5 = 10% * PERCENTAGE_SCALE
    uint256 internal constant MAX_SPLITTER_FEE = 1e5;
    /// @notice address of wallet implementation for split proxies
    address public immutable override walletImplementation;

    /**
     * STORAGE - VARIABLES - PRIVATE & INTERNAL
     */

    /// @notice mapping to account ETH balances
    mapping(address => uint256) internal ethBalances;
    /// @notice mapping to account ERC20 balances
    mapping(ERC20 => mapping(address => uint256)) internal erc20Balances;
    /// @notice mapping to Split metadata
    mapping(address => Split) internal splits;

    /**
     * MODIFIERS
     */

    /** @notice Reverts if the sender doesn't own the split `split`
     *  @param split Address to check for ownership
     */
    modifier onlySplitOwner(address split) {
        if (msg.sender != splits[split].owner) revert Unauthorized(msg.sender);
        _;
    }

    /** @notice Reverts if the sender isn't the new potential owner of split `split`
     *  @param split Address to check for new potential ownership
     */
    modifier onlySplitNewPotentialOwner(address split) {
        if (msg.sender != splits[split].newPotentialOwner) revert Unauthorized(msg.sender);
        _;
    }

    /** @notice Reverts if the split with owners represented by `accounts` and `percentAllocations` is malformed
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     */
    modifier validSplit(
        address[] memory accounts,
        uint32[] memory percentAllocations,
        uint32 splitterFee
    ) {
        if (accounts.length < 2) revert InvalidSplit__TooFewAccounts(accounts.length);
        if (accounts.length != percentAllocations.length)
            revert InvalidSplit__AccountsAndAllocationsMismatch(accounts.length, percentAllocations.length);
        if (getSum(percentAllocations) != PERCENTAGE_SCALE)
            revert InvalidSplit__InvalidAllocationsSum(getSum(percentAllocations));
        // overflows should be impossible in for-loop & array access math
        unchecked {
            for (uint256 i; i < accounts.length - 1; i++) {
                if (accounts[i] >= accounts[i + 1]) revert InvalidSplit__AccountsOutOfOrder(i);
                if (percentAllocations[i] == uint32(0)) revert InvalidSplit__AllocationMustBePositive(i);
            }
            if (percentAllocations[accounts.length - 1] == uint32(0))
                revert InvalidSplit__AllocationMustBePositive(accounts.length - 1);
        }
        if (splitterFee > MAX_SPLITTER_FEE) revert InvalidSplit__InvalidSplitterFee(splitterFee);
        _;
    }

    /** @notice Reverts if `newOwner` is the zero address
     *  @param newOwner Proposed new controlling address
     */
    modifier validNewOwner(address newOwner) {
        if (newOwner == address(0)) revert InvalidNewOwner(newOwner);
        _;
    }

    /**
     * CONSTRUCTOR
     */

    constructor() {
        walletImplementation = address(new SplitWallet());
    }

    /**
     * FUNCTIONS
     */

    /**
     * FUNCTIONS - PUBLIC & EXTERNAL
     */

    /** @notice Receive eth
     *  @dev Used by `SplitProxy` in `splitBalanceFor` to transfer ETH to `SplitMain`
     */
    receive() external payable {}

    /** @notice Creates a new split with recipients `accounts` with ownerships `percentAllocations`, a keeper fee for splitting of `splitterFee` and the controlling address `owner`
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     *  @param owner Controlling address (0x0 if immutable)
     */
    function createSplit(
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee,
        address owner
    ) external override validSplit(accounts, percentAllocations, splitterFee) returns (address split) {
        bytes32 splitHash = hashSplit(accounts, percentAllocations, splitterFee);
        if (owner == address(0)) {
            // create immutable split
            split = Clones.cloneDeterministic(walletImplementation, splitHash);
        } else {
            // create mutable split
            split = Clones.clone(walletImplementation);
            splits[split].owner = owner;
        }
        // store split's hash in storage for future verification
        splits[split].hash = splitHash;
        emit CreateSplit(split);
    }

    /** @notice Predicts the address for an immutable split created with recipients `accounts` with ownerships `percentAllocations` and a keeper fee for splitting of `splitterFee`
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     */
    function predictSplitAddress(
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee
    ) external view override validSplit(accounts, percentAllocations, splitterFee) returns (address split) {
        bytes32 splitHash = hashSplit(accounts, percentAllocations, splitterFee);
        split = Clones.predictDeterministicAddress(walletImplementation, splitHash);
    }

    /** @notice Updates an existing split with recipients `accounts` with ownerships `percentAllocations` and a keeper fee for splitting of `splitterFee`
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     */
    function updateSplit(
        address split,
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee
    ) external override onlySplitOwner(split) validSplit(accounts, percentAllocations, splitterFee) {
        bytes32 splitHash = hashSplit(accounts, percentAllocations, splitterFee);
        // store new hash in storage for future verification
        splits[split].hash = splitHash;
        emit UpdateSplit(split);
    }

    /** @notice Begins transfer of the controlling address of mutable split `split` to `newOwner`
     *  @dev Two-step ownership transfer inspired by [dharma](https://github.com/dharma-eng/dharma-smart-wallet/blob/master/contracts/helpers/TwoStepOwnable.sol)
     *  @param split Address of mutable split to transfer control for
     *  @param newOwner Address to begin transferring control to
     */
    function transferOwnership(address split, address newOwner)
        external
        override
        onlySplitOwner(split)
        validNewOwner(newOwner)
    {
        splits[split].newPotentialOwner = newOwner;
        // TODO: emit an event?
    }

    /** @notice Cancels transfer of the controlling address of mutable split `split`
     *  @param split Address of mutable split to cancel ownership transfer for
     */
    function cancelOwnershipTransfer(address split) external override onlySplitOwner(split) {
        delete splits[split].newPotentialOwner;
        // TODO: emit an event?
    }

    /** @notice Accepts transfer of the controlling address of mutable split `split`
     *  @param split Address of mutable split to accept ownership transfer for
     */
    function acceptOwnership(address split) external override onlySplitNewPotentialOwner(split) {
        delete splits[split].newPotentialOwner;
        emit OwnershipTransfer(split, splits[split].owner, msg.sender);
        splits[split].owner = msg.sender;
    }

    /** @notice Turns mutable split `split` immutable
     *  @param split Address of mutable split to turn immutable
     */
    function makeSplitImmutable(address split) external override onlySplitOwner(split) {
        delete splits[split].newPotentialOwner;
        emit OwnershipTransfer(split, splits[split].owner, address(0));
        splits[split].owner = address(0);
    }

    /** @notice Splits the eth balance for split `split`
     *  @dev `accounts`, `percentAllocations`, and `splitterFee` are verified by hashing & comparing to the hash in storage associated with split `split`
     *  @param split Address of split to split balance for
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     */
    function splitBalanceFor(
        address split,
        address[] memory accounts,
        uint32[] memory percentAllocations,
        uint32 splitterFee
    ) external override validSplit(accounts, percentAllocations, splitterFee) {
        // checks the hash from `accounts`, `percentAllocations`, and `splitterFee` against the hash stored for `split`
        bytes32 hash = hashSplit(accounts, percentAllocations, splitterFee);
        if (splits[split].hash != hash) revert InvalidSplit__InvalidHash(hash);
        // flush proxy funds to SplitMain before splitting
        uint256 proxyBalance = split.balance;
        if (proxyBalance > 0) SplitWallet(split).sendETHToMain(proxyBalance);
        // leave balance of 1 for gas efficiency
        uint256 amountToSplit = ethBalances[split] + proxyBalance - 1;
        // leave balance of 1 for gas efficiency
        ethBalances[split] = 1;
        // TODO: add [indexed] msg.sender, splitterFeeAmount as args?
        emit SplitBalance(split, amountToSplit);
        // given `amountToSplit`, calculate keeper fee
        uint256 splitterFeeAmount = scaleAmountByPercentage(amountToSplit, splitterFee);
        // credit keeper with fee
        ethBalances[msg.sender] += splitterFeeAmount;
        // given keeper fee, calculate how much to distribute to split recipients
        uint256 amountToSplitPostFee = amountToSplit - splitterFeeAmount;
        // distribute remaining split balance
        // TODO: confirm safe
        // overflows should be impossible in for-loop and with validSplit percentAllocations
        unchecked {
            for (uint256 i; i < accounts.length; i++) {
                ethBalances[accounts[i]] += scaleAmountByPercentage(amountToSplitPostFee, percentAllocations[i]);
            }
        }
    }

    /** @notice Splits the ERC20 `token` balance for split `split`
     *  @dev `accounts`, `percentAllocations`, and `splitterFee` are verified by hashing & comparing to the hash in storage associated with split `split`
     *  @param split Address of split to split balance for
     *  @param token Address of ERC20 to split balance for
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     */
    function splitERC20BalanceFor(
        address split,
        ERC20 token,
        address[] memory accounts,
        uint32[] memory percentAllocations,
        uint32 splitterFee
    ) external override validSplit(accounts, percentAllocations, splitterFee) {
        // checks the hash from `accounts`, `percentAllocations`, and `splitterFee` against the hash stored for `split`
        bytes32 hash = hashSplit(accounts, percentAllocations, splitterFee);
        if (splits[split].hash != hash) revert InvalidSplit__InvalidHash(hash);
        uint256 amountToSplit;
        // flush proxy funds to SplitMain before splitting
        uint256 proxyBalance = token.balanceOf(split);
        if (proxyBalance > 1) {
            // leave balance of 1 in ERC20 for gas efficiency
            proxyBalance -= 1;
            SplitWallet(split).sendERC20ToMain(token, proxyBalance);
            // leave balances of 1 in SplitMain for gas efficiency
            amountToSplit = erc20Balances[token][split] + proxyBalance - 1;
        } else {
            // leave balances of 1 in SplitMain for gas efficiency
            amountToSplit = erc20Balances[token][split] - 1;
        }
        // leave balance of 1 for gas efficiency
        erc20Balances[token][split] = 1;
        // TODO: add [indexed] msg.sender, splitterFeeAmount as args?
        emit SplitERC20Balance(split, token, amountToSplit);
        // given `amountToSplit`, calculate keeper fee
        uint256 splitterFeeAmount = scaleAmountByPercentage(amountToSplit, splitterFee);
        // credit keeper with fee
        erc20Balances[token][msg.sender] += splitterFeeAmount;
        // given keeper fee, calculate how much to distribute to split recipients
        uint256 amountToSplitPostFee = amountToSplit - splitterFeeAmount;
        // distribute remaining split balance
        // TODO: confirm safe
        // overflows should be impossible in for-loop and with validSplit percentAllocations
        unchecked {
            for (uint256 i; i < accounts.length; i++) {
                erc20Balances[token][accounts[i]] += scaleAmountByPercentage(
                    amountToSplitPostFee,
                    percentAllocations[i]
                );
            }
        }
    }

    /** @notice Withdraw eth &/ ERC20 balances for account `account`
     *  @param eth Bool of whether to withdraw eth
     *  @param tokens Addresses of ERC20s to withdraw for
     */
    function withdrawFor(
        address account,
        bool eth,
        ERC20[] calldata tokens
    ) external override {
        uint256 ethUint = eth ? 1 : 0;
        uint256[] memory withdrawnAmounts = new uint256[](ethUint + tokens.length);
        if (eth) {
            withdrawnAmounts[0] = _withdrawFor(account);
        }
        // overflows should be impossible in for-loop
        unchecked {
            for (uint256 i; i < tokens.length; i++) {
                withdrawnAmounts[ethUint + i] = _withdrawERC20For(account, tokens[i]);
            }
        }
        emit Withdrawal(account, eth, tokens, withdrawnAmounts);
    }

    /**
     * FUNCTIONS - VIEWS
     */

    /** @notice Returns the current hash of split `split`
     *  @param split Split to return hash for
     */
    function getHash(address split) external view returns (bytes32) {
        return splits[split].hash;
    }

    /** @notice Returns the current owner of split `split`
     *  @param split Split to return owner for
     */
    function getOwner(address split) external view returns (address) {
        return splits[split].owner;
    }

    /** @notice Returns the current newPotentialOwner of split `split`
     *  @param split Split to return newPotentialOwner for
     */
    function getNewPotentialOwner(address split) external view returns (address) {
        return splits[split].newPotentialOwner;
    }

    /** @notice Returns the current eth balance of split `split`
     *  @param split Split to return eth balance for
     */
    function getETHBalance(address split) external view returns (uint256) {
        return ethBalances[split];
    }

    /** @notice Returns the current erc20Balance of split `split` and erc20 token `token`
     *  @param split Split to return balance for
     *  @param token Token to return balance for
     */
    function getERC20Balance(address split, ERC20 token) external view returns (uint256) {
        return erc20Balances[token][split];
    }

    /**
     * FUNCTIONS - PRIVATE & INTERNAL
     */

    /** @notice Sums array of uint32s
     *  @param numbers Array of uint32s to sum
     *  @return sum Sum of `numbers`.
     */
    function getSum(uint32[] memory numbers) internal pure returns (uint32 sum) {
        for (uint256 i; i < numbers.length; ) {
            sum += numbers[i];
            unchecked {
                i++;
            }
        }
    }

    /** @notice Hashes a split
     *  @param accounts Ordered, unique list of addresses with ownership in the split
     *  @param percentAllocations Percent allocations associated with each address
     *  @param splitterFee Keeper fee paid by split to cover gas costs of distribution
     *  @return computedHash Hash of the split.
     */
    function hashSplit(
        address[] memory accounts,
        uint32[] memory percentAllocations,
        uint32 splitterFee
    ) internal pure returns (bytes32 computedHash) {
        bytes32 accountsHash = keccak256(abi.encodePacked(accounts));
        bytes32 percentAllocationsHash = keccak256(abi.encodePacked(percentAllocations));
        computedHash = keccak256(abi.encodePacked(accountsHash, percentAllocationsHash, splitterFee));
    }

    /** @notice Multiplies an amount by a scaled percentage
     *  @param amount Amount to get `scaledPercentage` of
     *  @param scaledPercent Percent scaled by PERCENTAGE_SCALE
     *  @return scaledAmount Percent of `amount`.
     */
    function scaleAmountByPercentage(uint256 amount, uint256 scaledPercent)
        internal
        pure
        returns (uint256 scaledAmount)
    {
        // TODO: confirm safe
        // use assembly to bypass checking for overflow & division by 0
        // (percentages are pre-validated & PERCENTAGE_SCALE will never be 0)
        assembly {
            /* eg (100 * 2*1e4) / (1e6) */
            scaledAmount := div(mul(amount, scaledPercent), PERCENTAGE_SCALE)
        }
    }

    /** @notice Withdraw eth for account
     *  @param account Account to withdrawn eth for
     *  @return withdrawn Amount of eth withdrawn.
     */
    function _withdrawFor(address account) internal returns (uint256 withdrawn) {
        // leave balance of 1 for gas efficiency
        withdrawn = ethBalances[account] - 1;
        ethBalances[account] = 1;
        (bool success, ) = account.call{value: withdrawn}('');
        if (!success) revert ETHWithdrawalFailed(withdrawn);
    }

    /** @notice Withdraw eth for account
     *  @param account Account to withdrawn eth for
     *  @return withdrawn Amount of eth withdrawn.
     */
    function _withdrawERC20For(address account, ERC20 token) internal returns (uint256 withdrawn) {
        // leave balance of 1 for gas efficiency
        withdrawn = erc20Balances[token][account] - 1;
        erc20Balances[token][account] = 1;
        token.safeTransfer(account, withdrawn);
    }
}
