// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.7;

/*
 ██████  ██████  ██    ██ ███    ██ ██████  
██      ██    ██ ██    ██ ████   ██ ██   ██ 
███████ ██    ██ ██    ██ ██ ██  ██ ██   ██ 
     ██ ██    ██ ██    ██ ██  ██ ██ ██   ██ 
███████  ██████   ██████  ██   ████ ██████ 
*/

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol';
import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';
import '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol';
import './Artist.sol';

contract ArtistCreator is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using ECDSAUpgradeable for bytes32;

    // ============ Storage ============

    bytes32 public constant MINTER_TYPEHASH = keccak256('Deployer(address artistWallet)');
    CountersUpgradeable.Counter private atArtistId;
    // address used for signature verification, changeable by owner
    address public admin;
    bytes32 public DOMAIN_SEPARATOR;
    address public beaconAddress;
    // registry of created contracts
    address[] public artistContracts;

    // ============ Events ============

    /// Emitted when an Artist is created
    event CreatedArtist(uint256 artistId, string name, string symbol, address indexed artistAddress);

    // ============ Functions ============

    /// Initializes factory
    function initialize() public initializer {
        __Ownable_init_unchained();

        // set admin for artist deployment authorization
        admin = msg.sender;
        DOMAIN_SEPARATOR = keccak256(abi.encode(keccak256('EIP712Domain(uint256 chainId)'), block.chainid));

        // set up beacon with msg.sender as the owner
        UpgradeableBeacon _beacon = new UpgradeableBeacon(address(new Artist()));
        _beacon.transferOwnership(msg.sender);
        beaconAddress = address(_beacon);

        // Set artist id start to be 1 not 0
        atArtistId.increment();
    }

    /// Creates a new artist contract as a factory with a deterministic address
    /// Important: None of these fields (except the Url fields with the same hash) can be changed after calling
    /// @param _name Name of the artist
    function createArtist(
        bytes calldata signature,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) public returns (address) {
        require((getSigner(signature) == admin), 'invalid authorization signature');

        BeaconProxy proxy = new BeaconProxy(
            beaconAddress,
            abi.encodeWithSelector(
                Artist(address(0)).initialize.selector,
                msg.sender,
                atArtistId.current(),
                _name,
                _symbol,
                _baseURI
            )
        );

        // add to registry
        artistContracts.push(address(proxy));

        emit CreatedArtist(atArtistId.current(), _name, _symbol, address(proxy));

        atArtistId.increment();

        return address(proxy);
    }

    /// Get signer address of signature
    function getSigner(bytes calldata signature) public view returns (address) {
        require(admin != address(0), 'whitelist not enabled');
        // Verify EIP-712 signature by recreating the data structure
        // that we signed on the client side, and then using that to recover
        // the address that signed the signature for this data.
        bytes32 digest = keccak256(
            abi.encodePacked('\x19\x01', DOMAIN_SEPARATOR, keccak256(abi.encode(MINTER_TYPEHASH, msg.sender)))
        );
        // Use the recover method to see what address was used to create
        // the signature on this data.
        // Note that if the digest doesn't exactly match what was signed we'll
        // get a random recovered address.
        address recoveredAddress = digest.recover(signature);
        return recoveredAddress;
    }

    /// Sets the admin for authorizing artist deployment
    /// @param _newAdmin address of new admin
    function setAdmin(address _newAdmin) external {
        require(owner() == _msgSender() || admin == _msgSender(), 'invalid authorization');
        admin = _newAdmin;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
