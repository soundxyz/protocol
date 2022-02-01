// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.7;

import {ERC20} from '@rari-capital/solmate/src/tokens/ERC20.sol';

/**
 * @title ISplitMain
 * @author 0xSplits
 */
interface ISplitMain {
    /**
     * FUNCTIONS
     */

    function walletImplementation() external returns (address);

    function createSplit(
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee,
        address owner
    ) external returns (address);

    function predictSplitAddress(
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee
    ) external view returns (address);

    function updateSplit(
        address split,
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee
    ) external;

    function transferOwnership(address split, address newOwner) external;

    function cancelOwnershipTransfer(address split) external;

    function acceptOwnership(address split) external;

    function makeSplitImmutable(address split) external;

    function splitBalanceFor(
        address split,
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee
    ) external;

    function splitERC20BalanceFor(
        address split,
        ERC20 token,
        address[] calldata accounts,
        uint32[] calldata percentAllocations,
        uint32 splitterFee
    ) external;

    function withdrawFor(
        address account,
        bool eth,
        ERC20[] calldata tokens
    ) external;

    /**
     * EVENTS
     */

    /** @notice emitted after each successful split creation
     *  @param split Address of the created split
     */
    event CreateSplit(address indexed split);
    /** @notice emitted after each successful split update
     *  @param split Address of the updated split
     */
    event UpdateSplit(address indexed split);
    /** @notice emitted after each successful split ownership transfer
     *  @param split Address of the split ownership was transferred for
     *  @param previousOwner Address of the split's previous owner
     *  @param newOwner Address of the split's new owner
     */
    event OwnershipTransfer(address indexed split, address indexed previousOwner, address indexed newOwner);

    /** @notice emitted after each successful ETH balance split
     *  @param split Address of the split that distributed its balance
     *  @param amount Amount of ETH distributed
     */
    event SplitBalance(address indexed split, uint256 amount);
    /** @notice emitted after each successful ERC20 balance split
     *  @param split Address of the split that distributed its balance
     *  @param token Address of ERC20 distributed
     *  @param amount Amount of ERC20 distributed
     */
    event SplitERC20Balance(address indexed split, ERC20 token, uint256 amount);

    /** @notice emitted after each successful withdrawal
     *  @param account Address that funds were withdrawn to
     *  @param eth Boolean for whether ETH was distributed
     *  @param tokens Addresses of ERC20s distributed
     *  @param amounts Amounts of ETH/ERC20 distributed (if ETH was distributed (`eth`),
     *  will be first in the array Remaining array matches order of `tokens`)
     */
    event Withdrawal(address indexed account, bool eth, ERC20[] tokens, uint256[] amounts);
}
