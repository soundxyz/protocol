// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

/// @title AccessManager
/// @author OpenZeppelin & Sound.xyz (@gigma)
/// @notice Grants ownership to the deployer, and allows them to grant or revoke roles for other accounts.
/// @dev Forked from OpenZeppelin Contracts (OwnableUpgradeable & AccessControl)
contract AccessManager is Initializable, ContextUpgradeable {
    // The admin role identifier
    bytes32 public constant ADMIN_ROLE = keccak256('ADMIN');

    address private _owner;

    // Track registered admins
    mapping(bytes32 => mapping(address => bool)) private _roles;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    // =====================
    // Ownership functions
    // =====================

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function __AccessManager_init() internal onlyInitializing {
        __Context_init_unchained();
        __AccessManager_init_unchained();
    }

    function __AccessManager_init_unchained() internal onlyInitializing {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner() == _msgSender(), 'Ownable: caller is not the owner');
        _;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), 'Ownable: new owner is the zero address');
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // =====================
    // Role functions
    // =====================

    /// @notice Register an account as an admin
    /// @param role The role to grant to the given account
    /// @param account The account to register
    function grantRole(bytes32 role, address account) external onlyOwner {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, _msgSender());
        }
    }

    /// @notice Revoke a role from an account
    /// @param role The role to revoke
    /// @param account The account to revoke the role from
    function revokeRole(bytes32 role, address account) external onlyOwner {
        if (hasRole(role, account)) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, _msgSender());
        }
    }

    /// @notice Check if an account has a role
    /// @param role The role to check
    /// @param account The account to check
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    /// @notice Check if the given address is the owner or has the given role.
    /// @param role The role to check for.
    modifier checkPermission(bytes32 role) {
        require(_msgSender() == owner() || hasRole(role, _msgSender()), 'unauthorized');
        _;
    }

    uint256[48] private __gap;
}
