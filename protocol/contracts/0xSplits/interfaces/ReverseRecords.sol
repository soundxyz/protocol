// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.7;

interface ReverseRecords {
    function getNames(address[] calldata addresses) external view returns (string[] memory r);
}
