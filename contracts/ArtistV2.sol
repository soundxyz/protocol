// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.7;

/*
 ██████  ██████  ██    ██ ███    ██ ██████  
██      ██    ██ ██    ██ ████   ██ ██   ██ 
███████ ██    ██ ██    ██ ██ ██  ██ ██   ██ 
     ██ ██    ██ ██    ██ ██  ██ ██ ██   ██ 
███████  ██████   ██████  ██   ████ ██████ 
*/

import {IERC2981Upgradeable, IERC165Upgradeable} from '@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol';
import {ERC721Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {CountersUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import {ArtistCreator} from './ArtistCreator.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

/// @title Artist
/// @author SoundXYZ - @gigamesh & @vigneshka
/// @notice This contract is used to create & sell song NFTs for the artist who owns the contract.
/// @dev Started as a fork of Mirror's Editions.sol https://github.com/mirror-xyz/editions-v1/blob/main/contracts/Editions.sol
contract ArtistV2 is ERC721Upgradeable, IERC2981Upgradeable, OwnableUpgradeable {
    // ================================
    // TYPES
    // ================================

    using Strings for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using ECDSA for bytes32;

    enum TimeType {
        START,
        END
    }

    // ============ Structs ============

    struct Edition {
        // The account that will receive sales revenue.
        address payable fundingRecipient;
        // The price at which each token will be sold, in ETH.
        uint256 price;
        // The number of tokens sold so far.
        uint32 numSold;
        // The maximum number of tokens that can be sold.
        uint32 quantity;
        // Royalty amount in bps
        uint32 royaltyBPS;
        // start timestamp of auction (in seconds since unix epoch)
        uint32 startTime;
        // end timestamp of auction (in seconds since unix epoch)
        uint32 endTime;
        // quantity of presale tokens
        uint32 presaleQuantity;
        // whitelist signer address
        address signerAddress;
    }

    // ================================
    // STORAGE
    // ================================

    string internal baseURI;

    CountersUpgradeable.Counter private atTokenId;
    CountersUpgradeable.Counter private atEditionId;

    // Mapping of edition id to descriptive data.
    mapping(uint256 => Edition) public editions;
    // Mapping of token id to edition id.
    mapping(uint256 => uint256) public tokenToEdition;
    // The amount of funds that have been deposited for a given edition.
    mapping(uint256 => uint256) public depositedForEdition;
    // The amount of funds that have already been withdrawn for a given edition.
    mapping(uint256 => uint256) public withdrawnForEdition;
    // The presale typehash (used for checking signature validity)
    bytes32 public constant PRESALE_TYPEHASH =
        keccak256('EditionInfo(address contractAddress,address buyerAddress,uint256 editionId)');

    // ================================
    // EVENTS
    // ================================

    event EditionCreated(
        uint256 indexed editionId,
        address fundingRecipient,
        uint256 price,
        uint32 quantity,
        uint32 royaltyBPS,
        uint32 startTime,
        uint32 endTime,
        uint32 presaleQuantity,
        address signerAddress
    );

    event EditionPurchased(
        uint256 indexed editionId,
        uint256 indexed tokenId,
        // `numSold` at time of purchase represents the "serial number" of the NFT.
        uint32 numSold,
        // The account that paid for and received the NFT.
        address indexed buyer
    );

    event AuctionTimeSet(TimeType timeType, uint256 editionId, uint32 indexed newTime);

    // ================================
    // FUNCTIONS - PUBLIC & EXTERNAL
    // ================================

    /// @notice Initializes the contract
    /// @param _owner Owner of edition
    /// @param _name Name of artist
    function initialize(
        address _owner,
        uint256 _artistId,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init();

        // Set ownership to original sender of contract call
        transferOwnership(_owner);

        // E.g. https://sound.xyz/api/metadata/[artistId]/
        baseURI = string(abi.encodePacked(_baseURI, _artistId.toString(), '/'));

        // Set token id start to be 1 not 0
        atTokenId.increment();

        // Set edition id start to be 1 not 0
        atEditionId.increment();
    }

    /// @notice Creates a new edition.
    /// @param _fundingRecipient The account that will receive sales revenue.
    /// @param _price The price at which each token will be sold, in ETH.
    /// @param _quantity The maximum number of tokens that can be sold.
    /// @param _royaltyBPS The royalty amount in bps.
    /// @param _startTime The start time of the auction, in seconds since unix epoch.
    /// @param _endTime The end time of the auction, in seconds since unix epoch.
    /// @param _presaleQuantity The quantity of presale tokens.
    /// @param _signerAddress signer address.
    function createEdition(
        address payable _fundingRecipient,
        uint256 _price,
        uint32 _quantity,
        uint32 _royaltyBPS,
        uint32 _startTime,
        uint32 _endTime,
        uint32 _presaleQuantity,
        address _signerAddress
    ) external onlyOwner {
        require(_presaleQuantity < _quantity + 1, 'Presale quantity too big');

        if (_presaleQuantity > 0) {
            require(_signerAddress != address(0), 'Signer address cannot be 0');
        }

        editions[atEditionId.current()] = Edition({
            fundingRecipient: _fundingRecipient,
            price: _price,
            numSold: 0,
            quantity: _quantity,
            royaltyBPS: _royaltyBPS,
            startTime: _startTime,
            endTime: _endTime,
            presaleQuantity: _presaleQuantity,
            signerAddress: _signerAddress
        });

        emit EditionCreated(
            atEditionId.current(),
            _fundingRecipient,
            _price,
            _quantity,
            _royaltyBPS,
            _startTime,
            _endTime,
            _presaleQuantity,
            _signerAddress
        );

        atEditionId.increment();
    }

    /// @notice Creates a new token for the given edition, and assigns it to the buyer
    /// @param _editionId The id of the edition to purchase
    /// @param _signature A signed message for authorizing presale purchases
    function buyEdition(uint256 _editionId, bytes calldata _signature) external payable {
        // Caching variables locally to reduce reads
        uint256 price = editions[_editionId].price;
        uint32 quantity = editions[_editionId].quantity;
        uint32 numSold = editions[_editionId].numSold;
        uint32 startTime = editions[_editionId].startTime;
        uint32 endTime = editions[_editionId].endTime;
        uint32 presaleQuantity = editions[_editionId].presaleQuantity;

        // Check that the edition exists. Note: this is redundant
        // with the next check, but it is useful for clearer error messaging.
        require(quantity > 0, 'Edition does not exist');
        // Check that there are still tokens available to purchase.
        require(numSold < quantity, 'This edition is already sold out.');
        // Check that the sender is paying the correct amount.
        require(msg.value >= price, 'Must send enough to purchase the edition.');

        // If the open auction hasn't started...
        if (startTime > block.timestamp) {
            // Check that presale tokens are still available
            require(
                presaleQuantity > 0 && numSold < presaleQuantity,
                'No presale available & open auction not started'
            );

            // Check that the signature is valid.
            require(getSigner(_signature, _editionId) == editions[_editionId].signerAddress, 'Invalid signer');
        }

        // Don't allow purchases after the end time
        require(endTime > block.timestamp, 'Auction has ended');

        // Update the deposited total for the edition
        depositedForEdition[_editionId] += msg.value;

        // Increment the number of tokens sold for this edition.
        editions[_editionId].numSold++;

        // Mint a new token for the sender, using the `tokenId`.
        _mint(msg.sender, atTokenId.current());

        // Store the mapping of token id to the edition being purchased.
        tokenToEdition[atTokenId.current()] = _editionId;

        emit EditionPurchased(_editionId, atTokenId.current(), editions[_editionId].numSold, msg.sender);

        atTokenId.increment();
    }

    function withdrawFunds(uint256 _editionId) external {
        // Compute the amount available for withdrawing from this edition.
        uint256 remainingForEdition = depositedForEdition[_editionId] - withdrawnForEdition[_editionId];

        // Set the amount withdrawn to the amount deposited.
        withdrawnForEdition[_editionId] = depositedForEdition[_editionId];

        // Send the amount that was remaining for the edition, to the funding recipient.
        _sendFunds(editions[_editionId].fundingRecipient, remainingForEdition);
    }

    /// @notice Sets the start time for an edition
    function setStartTime(uint256 _editionId, uint32 _startTime) external onlyOwner {
        editions[_editionId].startTime = _startTime;
        emit AuctionTimeSet(TimeType.START, _editionId, _startTime);
    }

    /// @notice Sets the end time for an edition
    function setEndTime(uint256 _editionId, uint32 _endTime) external onlyOwner {
        editions[_editionId].endTime = _endTime;
        emit AuctionTimeSet(TimeType.END, _editionId, _endTime);
    }

    /// @notice Returns token URI (metadata URL). e.g. https://sound.xyz/api/metadata/[artistId]/[editionId]/[tokenId]
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), 'ERC721Metadata: URI query for nonexistent token');

        // Concatenate the components, baseURI, editionId and tokenId, to create URI.
        return string(abi.encodePacked(baseURI, tokenToEdition[_tokenId].toString(), '/', _tokenId.toString()));
    }

    /// @notice Returns contract URI used by Opensea. e.g. https://sound.xyz/api/metadata/[artistId]/storefront
    function contractURI() public view returns (string memory) {
        // Concatenate the components, baseURI, editionId and tokenId, to create URI.
        return string(abi.encodePacked(baseURI, 'storefront'));
    }

    /// @notice Get token ids for a given edition id
    /// @param _editionId edition id
    function getTokenIdsOfEdition(uint256 _editionId) public view returns (uint256[] memory) {
        uint256[] memory tokenIdsOfEdition = new uint256[](editions[_editionId].numSold);
        uint256 index = 0;

        for (uint256 id = 1; id < atTokenId.current(); id++) {
            if (tokenToEdition[id] == _editionId) {
                tokenIdsOfEdition[index] = id;
                index++;
            }
        }
        return tokenIdsOfEdition;
    }

    /// @notice Get owners of a given edition id
    /// @param _editionId edition id
    function getOwnersOfEdition(uint256 _editionId) public view returns (address[] memory) {
        address[] memory ownersOfEdition = new address[](editions[_editionId].numSold);
        uint256 index = 0;

        for (uint256 id = 1; id < atTokenId.current(); id++) {
            if (tokenToEdition[id] == _editionId) {
                ownersOfEdition[index] = ERC721Upgradeable.ownerOf(id);
                index++;
            }
        }
        return ownersOfEdition;
    }

    /// @notice Get royalty information for token
    /// @param _tokenId token id
    /// @param _salePrice Sale price for the token
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
        external
        view
        override
        returns (address fundingRecipient, uint256 royaltyAmount)
    {
        uint256 editionId = tokenToEdition[_tokenId];
        Edition memory edition = editions[editionId];

        if (edition.fundingRecipient == address(0x0)) {
            return (edition.fundingRecipient, 0);
        }

        uint256 royaltyBPS = uint256(edition.royaltyBPS);

        return (edition.fundingRecipient, (_salePrice * royaltyBPS) / 10_000);
    }

    /// @notice The total number of tokens created by this contract
    function totalSupply() external view returns (uint256) {
        return atTokenId.current() - 1; // because atTokenId is 1-indexed
    }

    /// @notice Informs other contracts which interfaces this contract supports
    /// @dev https://eips.ethereum.org/EIPS/eip-165
    function supportsInterface(bytes4 _interfaceId)
        public
        view
        override(ERC721Upgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return
            type(IERC2981Upgradeable).interfaceId == _interfaceId || ERC721Upgradeable.supportsInterface(_interfaceId);
    }

    // ================================
    // FUNCTIONS - PRIVATE
    // ================================

    /// @notice Sends funds to an address
    /// @param _recipient The address to send funds to
    /// @param _amount The amount of funds to send
    function _sendFunds(address payable _recipient, uint256 _amount) private {
        require(address(this).balance >= _amount, 'Insufficient balance for send');

        (bool success, ) = _recipient.call{value: _amount}('');
        require(success, 'Unable to send value: recipient may have reverted');
    }

    /// @notice Gets signer address to validate presale purchase
    /// @param _signature signed message
    /// @param _editionId edition id
    /// @return address of signer
    /// @dev https://eips.ethereum.org/EIPS/eip-712
    function getSigner(bytes calldata _signature, uint256 _editionId) private view returns (address) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                keccak256(abi.encode(keccak256('EIP712Domain(uint256 chainId)'), block.chainid)),
                keccak256(abi.encode(PRESALE_TYPEHASH, address(this), msg.sender, _editionId))
            )
        );
        address recoveredAddress = digest.recover(_signature);
        return recoveredAddress;
    }
}
