// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.7;

import {ISplitMain} from './interfaces/ISplitMain.sol';
import {ERC20} from '@rari-capital/solmate/src/tokens/ERC20.sol';
import {SafeTransferLib} from '@rari-capital/solmate/src/utils/SafeTransferLib.sol';

/**
 * ERRORS
 */

/// @notice Unauthorized sender
error Unauthorized();

/**
 * @title SplitWallet
 * @author 0xSplits
 * @notice The implementation logic for `SplitProxy`.
 * @dev `SplitProxy` handles `receive()` itself to avoid the gas cost with `DELEGATECALL`.
 */
contract SplitWallet {
    using SafeTransferLib for ERC20;

    /**
     * EVENTS
     */

    /** @notice emitted after each successful ETH transfer to proxy
     *  @param split Address of the split that received ETH
     *  @param amount Amount of ETH received
     */
    event ReceiveETH(address indexed split, uint256 amount);

    /**
     * STORAGE
     */

    /**
     * STORAGE - CONSTANTS & IMMUTABLES
     */

    /// @notice address of SplitMain for split distributions & EOA/SC withdrawals
    ISplitMain public immutable splitMain;

    /**
     * MODIFIERS
     */

    /// @notice Reverts if the sender isn't SplitMain
    modifier onlySplitMain() {
        if (msg.sender != address(splitMain)) revert Unauthorized();
        _;
    }

    /**
     * CONSTRUCTOR
     */

    constructor() {
        splitMain = ISplitMain(msg.sender);
    }

    /**
     * FUNCTIONS - PUBLIC & EXTERNAL
     */

    /** @notice Sends eth in proxy to SplitMain
     *  @param amount Amount to send
     */
    function sendETHToMain(uint256 amount) external payable onlySplitMain {
        // can discard return value for SplitMain
        bool success;
        (success, ) = address(splitMain).call{value: amount}('');
    }

    /** @notice Sends erc20 in proxy to SplitMain
     *  @param token Token to send
     *  @param amount Amount to send
     */
    function sendERC20ToMain(ERC20 token, uint256 amount) external payable onlySplitMain {
        token.safeTransfer(address(splitMain), amount);
    }
}
