// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

/*
               ^###############################################&5               
               ?@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@&               
   !PPPPPPPPPPP&@@@@@@@@@@@@?!!!!!!!!!!7&@@@@@@@@@@@@@@@@@@@@@@@@BPPPPPPPPPPJ   
   B@@@@@@@@@@@@@@@@@@@@@@@&            #@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.  
   B@@@@@@@@@@@@@@@@@@@@@@@&            ~55555555555&@@@@@@@@@@@@@@@@@@@@@@@@.  
   B@@@@@@@@@@@@@@@@@@@@@@@&                        J@@@@@@@@@@@@@@@@@@@@@@@@.  
   B@@@@@@@@@@@@@@@@@@@@@@@&~::::::::::::::::::::::.~B######################P   
   B@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@7                           
   5@&&&&&&&&&&&&&&&&&&&&&&@@@@@@@@@@@@@@@@@@@@@@@@@5                           
    .......................!@@@@@@@@@@@@@@@@@@@@@@@@@&&&&&&&&&&&&&&&&&&&&&&&B   
                           .@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@&   
   7BBBBBBBBBBBBBBBBBBBBBBBY:^^^^^^^^^^^^^^^^^^^^^^^B@@@@@@@@@@@@@@@@@@@@@@@&   
   B@@@@@@@@@@@@@@@@@@@@@@@&                        Y@@@@@@@@@@@@@@@@@@@@@@@&   
   B@@@@@@@@@@@@@@@@@@@@@@@@PJYYYYYYYYY?            5@@@@@@@@@@@@@@@@@@@@@@@&   
   B@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@:           Y@@@@@@@@@@@@@@@@@@@@@@@&   
   !GGGGGGGGGGG&@@@@@@@@@@@@@@@@@@@@@@@@5~~~~~~~~~~~#@@@@@@@@@@@@BGGGGGGGGGGJ   
               J@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@G               
               ~&&&&#&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&?                 

*/

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol';
import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';

/// @title The Artist Creator factory contract
/// @author Sound.xyz - @gigamesh & @vigneshka
contract ArtistCreatorV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using ECDSAUpgradeable for bytes32;

    // ============ Storage ============

    // Typehash of the signed message provided to createArtist
    bytes32 public constant MINTER_TYPEHASH = keccak256('Deployer(address artistWallet)');
    // ID for each Artist proxy // DEPRECATED in ArtistCreatorV2
    CountersUpgradeable.Counter private atArtistId;
    // Address used for signature verification, changeable by owner
    address public admin;
    // Domain separator is used to prevent replay attacks using signatures from different networks
    bytes32 public DOMAIN_SEPARATOR;
    // The address of UpgradeableBeacon, which was deployed in the initialize function of ArtistCreator.sol
    address public beaconAddress;
    // Array of the Artist proxies // DEPRECATED in ArtistCreatorV2
    address[] public artistContracts;

    // ============ Events ============

    /// Emitted when an Artist is created
    event CreatedArtist(uint256 artistId, string name, string symbol, address indexed artistAddress);

    // ============ Functions ============

    /// @notice Creates a new artist contract as a factory with a deterministic address
    /// @param _name Name of the artist
    function createArtist(
        bytes calldata signature,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) public returns (address) {
        require((getSigner(signature) == admin), 'invalid authorization signature');

        bytes32 salt = bytes32(uint256(uint160(_msgSender())));

        // salted contract creation using create2
        BeaconProxy proxy = new BeaconProxy{salt: salt}(
            beaconAddress,
            // 0x5f1e6f6d is the initialize function selector on ArtistV5 (hash of "function initialize(address, string, string, string)")
            abi.encodeWithSelector(0x5f1e6f6d, _msgSender(), _name, _symbol, _baseURI)
        );

        // the first parameter, artistId, is deprecated
        emit CreatedArtist(0, _name, _symbol, address(proxy));

        return address(proxy);
    }

    /// @notice Gets signer address of signature
    /// @param signature Signature of the message
    function getSigner(bytes calldata signature) public view returns (address) {
        require(admin != address(0), 'whitelist not enabled');
        // Verify EIP-712 signature by recreating the data structure
        // that we signed on the client side, and then using that to recover
        // the address that signed the signature for this data.
        bytes32 digest = keccak256(
            abi.encodePacked('\x19\x01', DOMAIN_SEPARATOR, keccak256(abi.encode(MINTER_TYPEHASH, _msgSender())))
        );
        // Use the recover method to see what address was used to create
        // the signature on this data.
        // Note that if the digest doesn't exactly match what was signed we'll
        // get a random recovered address.
        address recoveredAddress = digest.recover(signature);
        return recoveredAddress;
    }

    /// @notice Sets the admin for authorizing artist deployment
    /// @param _newAdmin address of new admin
    function setAdmin(address _newAdmin) external {
        require(owner() == _msgSender() || admin == _msgSender(), 'invalid authorization');
        admin = _newAdmin;
    }

    /// @notice Authorizes upgrades
    /// @dev DO NOT REMOVE!
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
