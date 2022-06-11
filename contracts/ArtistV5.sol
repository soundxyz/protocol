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

import '@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import './utils/AccessManager.sol';

/// @title Artist
/// @author SoundXYZ - @gigamesh & @vigneshka
/// @notice This contract is used to create & sell song NFTs for the artist who owns the contract.
/// @dev Started as a fork of Mirror's Editions.sol https://github.com/mirror-xyz/editions-v1/blob/main/contracts/Editions.sol
contract ArtistV5 is ERC721Upgradeable, IERC2981Upgradeable, AccessManager {
    // ================================
    // STORAGE
    // ================================

    // The permissioned typehash (used for checking signature validity)
    bytes32 public constant PERMISSIONED_SALE_TYPEHASH =
        keccak256('EditionInfo(address contractAddress,address buyerAddress,uint256 editionId,uint256 ticketNumber)');
    // Domain separator - used to prevent replay attacks using signatures from different networks
    bytes32 public immutable DOMAIN_SEPARATOR;
    // The default baseURI for the contract
    string internal baseURI;

    CountersUpgradeable.Counter public atTokenId; // DEPRECATED IN V3
    CountersUpgradeable.Counter public atEditionId;

    // Mapping of edition id to descriptive data.
    mapping(uint256 => Edition) public editions;
    // <DEPRECATED IN V3> Mapping of token id to edition id.
    mapping(uint256 => uint256) public _tokenToEdition;
    // The amount of funds that have been deposited for a given edition.
    mapping(uint256 => uint256) public depositedForEdition;
    // The amount of funds that have already been withdrawn for a given edition.
    mapping(uint256 => uint256) public withdrawnForEdition;
    // Used to track which tokens have been claimed. editionId -> index -> bit array
    mapping(uint256 => mapping(uint256 => uint256)) ticketNumbers;

    // ================================
    // TYPES
    // ================================

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
        // quantity of permissioned tokens
        uint32 permissionedQuantity;
        // whitelist signer address
        address signerAddress;
        // base uri for the edition
        string baseURI;
    }

    using CountersUpgradeable for CountersUpgradeable.Counter;
    using ECDSA for bytes32;

    enum TimeType {
        START,
        END
    }

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
        uint32 permissionedQuantity,
        address signerAddress
    );

    event EditionPurchased(
        uint256 indexed editionId,
        uint256 indexed tokenId,
        // `numSold` at time of purchase represents the "serial number" of the NFT.
        uint32 numSold,
        // The account that paid for and received the NFT.
        address indexed buyer,
        uint256 ticketNumber
    );

    event AuctionTimeSet(TimeType timeType, uint256 editionId, uint32 indexed newTime);

    event SignerAddressSet(uint256 editionId, address indexed signerAddress);

    event PermissionedQuantitySet(uint256 editionId, uint32 permissionedQuantity);

    event BaseURISet(uint256 editionId, string baseURI);

    // ================================
    // PUBLIC & EXTERNAL WRITABLE FUNCTIONS
    // ================================

    /// @notice Contract constructor
    constructor() {
        DOMAIN_SEPARATOR = keccak256(abi.encode(keccak256('EIP712Domain(uint256 chainId)'), block.chainid));
    }

    /// @notice Initializes the contract
    /// @param _owner Owner of edition
    /// @param _name Name of artist
    /// @param _symbol Symbol for the artist
    /// @param _baseURI Default base URI for all editions
    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        string memory _baseURI
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __AccessManager_init();

        // Set ownership to original sender of contract call
        transferOwnership(_owner);

        // baseURI override only for testnets
        if (block.chainid != 1) {
            baseURI = _baseURI;
        }

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
    /// @param _permissionedQuantity The quantity of tokens that require a signature to buy.
    /// @param _signerAddress signer address.
    /// @param _editionId The expected edition ID
    /// @param _baseURI The base URI for the edition
    function createEdition(
        address payable _fundingRecipient,
        uint256 _price,
        uint32 _quantity,
        uint32 _royaltyBPS,
        uint32 _startTime,
        uint32 _endTime,
        uint32 _permissionedQuantity,
        address _signerAddress,
        uint256 _editionId,
        string memory _baseURI
    ) external checkPermission(ADMIN_ROLE) {
        require(_quantity > 0, 'Must set quantity');
        require(_fundingRecipient != address(0), 'Must set fundingRecipient');
        require(_endTime > _startTime, 'End time must be greater than start time');
        require(_editionId == atEditionId.current(), 'Wrong edition ID');

        if (_permissionedQuantity > 0) {
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
            permissionedQuantity: _permissionedQuantity,
            signerAddress: _signerAddress,
            baseURI: _baseURI
        });

        emit EditionCreated(
            atEditionId.current(),
            _fundingRecipient,
            _price,
            _quantity,
            _royaltyBPS,
            _startTime,
            _endTime,
            _permissionedQuantity,
            _signerAddress
        );

        atEditionId.increment();
    }

    /// @notice Creates a new token for the given edition, and assigns it to the buyer
    /// @param _editionId The id of the edition to purchase
    /// @param _signature A signed message for authorizing permissioned purchases
    /// @param _ticketNumber Ticket number required for validating this buyer hasn't already bought.
    function buyEdition(
        uint256 _editionId,
        bytes calldata _signature,
        uint256 _ticketNumber
    ) external payable {
        // Caching variables locally to reduce reads
        uint256 price = editions[_editionId].price;
        uint32 quantity = editions[_editionId].quantity;
        uint32 numSold = editions[_editionId].numSold;
        uint32 newNumSold = numSold + 1;
        uint32 startTime = editions[_editionId].startTime;
        uint32 endTime = editions[_editionId].endTime;
        uint32 permissionedQuantity = editions[_editionId].permissionedQuantity;

        // Check that the edition exists. Note: this is redundant
        // with the next check, but it is useful for clearer error messaging.
        require(quantity > 0, 'Edition does not exist');
        // Check that the sender is paying the correct amount.
        require(msg.value >= price, 'Must send enough to purchase the edition.');
        // Don't allow purchases after the end time
        require(endTime > block.timestamp, 'Auction has ended');

        // If the public auction hasn't started...
        if (startTime > block.timestamp) {
            // Check that permissioned tokens are still available
            require(numSold < permissionedQuantity, 'No permissioned tokens available & open auction not started');

            // Check that the signature is valid.
            require(
                getSigner(_signature, _editionId, _ticketNumber) == editions[_editionId].signerAddress,
                'Invalid signer'
            );
        } else {
            // Check that there are still tokens available to purchase.
            // Only need to check this for the public sale (after the start time)
            // so we can accomodate open editions
            require(numSold < quantity, 'This edition is already sold out.');
        }

        // Create the token id by packing editionId in the top bits
        uint256 tokenId;
        unchecked {
            tokenId = (_editionId << 128) | newNumSold;
            // Increment the number of tokens sold for this edition.
            editions[_editionId].numSold = newNumSold;
        }

        // If fundingRecipient is the owner (artist's wallet), update the edition's balance & don't send the funds
        if (editions[_editionId].fundingRecipient == owner()) {
            // Update the deposited total for the edition
            depositedForEdition[_editionId] += msg.value;
        } else {
            // Send funds to the funding recipient.
            _sendFunds(editions[_editionId].fundingRecipient, msg.value);
        }

        // Mint a new token for the sender, using the `tokenId`.
        _mint(msg.sender, tokenId);

        emit EditionPurchased(_editionId, tokenId, newNumSold, msg.sender, _ticketNumber);
    }

    /// @notice Withdraws from the Artist to the fundingRecipient for an edition
    /// @param _editionId The id of the edition to withdraw from
    function withdrawFunds(uint256 _editionId) external {
        // Compute the amount available for withdrawing from this edition.
        uint256 remainingForEdition = depositedForEdition[_editionId] - withdrawnForEdition[_editionId];

        // Set the amount withdrawn to the amount deposited.
        withdrawnForEdition[_editionId] = depositedForEdition[_editionId];

        // Send the amount that was remaining for the edition, to the funding recipient.
        _sendFunds(editions[_editionId].fundingRecipient, remainingForEdition);
    }

    /// @notice Sets the start time for an edition
    /// @param _editionId The id of the edition to set the start time for
    /// @param _startTime The start time to set (in seconds since unix epoch)
    function setStartTime(uint256 _editionId, uint32 _startTime) external checkPermission(ADMIN_ROLE) {
        editions[_editionId].startTime = _startTime;
        emit AuctionTimeSet(TimeType.START, _editionId, _startTime);
    }

    /// @notice Sets the end time for an edition
    /// @param _editionId The id of the edition to set the end time for
    /// @param _endTime The end time to set (in seconds since unix epoch)
    function setEndTime(uint256 _editionId, uint32 _endTime) external checkPermission(ADMIN_ROLE) {
        editions[_editionId].endTime = _endTime;
        emit AuctionTimeSet(TimeType.END, _editionId, _endTime);
    }

    /// @notice Sets the signature address of an edition
    /// @param _editionId The edition id to set the signature address for
    /// @param _newSignerAddress The address that will be used to sign purchases
    function setSignerAddress(uint256 _editionId, address _newSignerAddress) external checkPermission(ADMIN_ROLE) {
        require(_newSignerAddress != address(0), 'Signer address cannot be 0');

        editions[_editionId].signerAddress = _newSignerAddress;
        emit SignerAddressSet(_editionId, _newSignerAddress);
    }

    /// @notice Sets the permissioned quantity for an edition
    /// @param _editionId The edition id to set the permissioned quantity for
    /// @param _permissionedQuantity The new permissiond quantity
    function setPermissionedQuantity(uint256 _editionId, uint32 _permissionedQuantity)
        external
        checkPermission(ADMIN_ROLE)
    {
        // Prevent setting to permissioned quantity when there is no signer address
        require(editions[_editionId].signerAddress != address(0), 'Edition must have a signer');

        editions[_editionId].permissionedQuantity = _permissionedQuantity;
        emit PermissionedQuantitySet(_editionId, _permissionedQuantity);
    }

    /// @notice Sets a new owner, only callable by current owner or the soundRecoveryAddress (ie: gnosis safe)
    /// @param _newOwner The new owner of the contract
    function setOwnerOverride(address _newOwner) external {
        require(_msgSender() == soundRecoveryAddress() || _msgSender() == owner(), 'unauthorized');

        super._transferOwnership(_newOwner);
    }

    /// @notice Sets the base URI for an edition
    /// @param _editionId The target edition's id
    /// @param _baseURI The new base URI
    function setEditionBaseURI(uint256 _editionId, string calldata _baseURI) external checkPermission(ADMIN_ROLE) {
        require(
            editions[_editionId].quantity > 0 || editions[_editionId].permissionedQuantity > 0,
            'Nonexistent edition'
        );

        editions[_editionId].baseURI = _baseURI;

        emit BaseURISet(_editionId, _baseURI);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /// @notice Returns token URI (metadata URL). e.g. https://sound.xyz/api/metadata/[contractAddress]/[tokenId]/metadata.json
    /// @dev Concatenate the baseURI and tokenId, to create URI.
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_exists(_tokenId), 'ERC721Metadata: URI query for nonexistent token');

        uint256 editionId = tokenToEdition(_tokenId);

        string memory editionBaseURI = editions[editionId].baseURI;

        // If the edition has a baseURI, it means this edition is on permastorage
        // Using 3 as the length in case it gets accidentally set to empty space
        if (bytes(editionBaseURI).length > 3) {
            return string.concat(editionBaseURI, Strings.toString(_tokenId), '/metadata.json');
        }

        return string.concat(_contractBaseURI(), Strings.toString(_tokenId));
    }

    /// @notice Returns contract URI used by Opensea. e.g. https://sound.xyz/api/metadata/[contractAddress]/storefront
    function contractURI() public view returns (string memory) {
        return string.concat(_contractBaseURI(), 'storefront');
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
        uint256 editionId = tokenToEdition(_tokenId);
        Edition memory edition = editions[editionId];

        if (edition.fundingRecipient == address(0x0)) {
            return (edition.fundingRecipient, 0);
        }

        uint256 royaltyBPS = uint256(edition.royaltyBPS);

        return (edition.fundingRecipient, (_salePrice * royaltyBPS) / 10_000);
    }

    /// @notice The total number of tokens created by this contract
    function totalSupply() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 id = 1; id < atEditionId.current(); id++) {
            total += editions[id].numSold;
        }
        return total;
    }

    /// @notice Informs other contracts which interfaces this contract supports
    /// @param _interfaceId The interface id to check
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

    /// @notice returns the number of editions for this artist
    function editionCount() external view returns (uint256) {
        return atEditionId.current() - 1; // because atEditionId is incremented after each edition is created
    }

    /// @notice Returns the edition id for a given token id
    /// @param _tokenId token id
    function tokenToEdition(uint256 _tokenId) public view returns (uint256) {
        // Check the top bits to see if the edition id is there
        uint256 editionId = _tokenId >> 128;

        // If edition ID is 0, then this edition was created before the V3 upgrade
        if (editionId == 0) {
            // get edition ID from storage
            return _tokenToEdition[_tokenId];
        }

        return editionId;
    }

    /// @notice Returns a list of owner addresses for a given list of token ids
    /// @param _tokenIds List of token ids
    function ownersOfTokenIds(uint256[] calldata _tokenIds) external view returns (address[] memory) {
        address[] memory owners = new address[](_tokenIds.length);
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            owners[i] = ownerOf(_tokenIds[i]);
        }
        return owners;
    }

    /// @notice Returns the claimed ticket numbers for a given edition and list of ticket numbers (indexes)
    /// @param _editionId Edition id
    /// @param _ticketNumbers List of ticket numbers (indexes)
    function checkTicketNumbers(uint256 _editionId, uint256[] calldata _ticketNumbers)
        external
        view
        returns (bool[] memory)
    {
        bool[] memory claimed = new bool[](_ticketNumbers.length);

        for (uint256 i = 0; i < _ticketNumbers.length; i++) {
            (uint256 storedBit, , , ) = _getBitForTicketNumber(_editionId, _ticketNumbers[i]);
            claimed[i] = storedBit == 1;
        }

        return claimed;
    }

    /// @notice Returns the address (ie: gnosis safe) authorized to change ownership of the contract
    function soundRecoveryAddress() public view virtual returns (address) {
        if (block.chainid == 1) {
            return 0x858a92511485715Cfb754f397a7894b7724c7Abd;
        } else if (block.chainid == 4) {
            return 0xee35E946Dd73EF78d352454c3F915e2cA0a09d87;
        } else {
            revert('unsupported chain');
        }
    }

    // ================================
    // PRIVATE FUNCTIONS
    // ================================

    /// @notice Sends funds to an address
    /// @param _recipient The address to send funds to
    /// @param _amount The amount of funds to send
    function _sendFunds(address payable _recipient, uint256 _amount) private {
        require(address(this).balance >= _amount, 'Insufficient balance for send');

        (bool success, ) = _recipient.call{value: _amount}('');
        require(success, 'Unable to send value: recipient may have reverted');
    }

    /// @notice Gets signer address to validate permissioned purchase
    /// @param _signature signed message
    /// @param _editionId edition id
    /// @param _ticketNumber ticket number to check
    /// @return address of signer
    /// @dev https://eips.ethereum.org/EIPS/eip-712
    function getSigner(
        bytes calldata _signature,
        uint256 _editionId,
        uint256 _ticketNumber
    ) private returns (address) {
        // Check that the ticket number is within the reserved range for the edition
        // permissionedQuantity is uint32, so ticketNumber can't exceed max uint32
        require(_ticketNumber < 2**32, 'Ticket number exceeds max');

        // gets the stored bit
        (
            uint256 storedBit,
            uint256 localGroup,
            uint256 localGroupOffset,
            uint256 ticketNumbersIdx
        ) = _getBitForTicketNumber(_editionId, _ticketNumber);

        require(storedBit == 0, 'Invalid ticket number or NFT already claimed');

        // Flip the bit to 1 to indicate that the ticket has been claimed
        ticketNumbers[_editionId][ticketNumbersIdx] = localGroup | (uint256(1) << localGroupOffset);

        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMISSIONED_SALE_TYPEHASH, address(this), msg.sender, _editionId, _ticketNumber))
            )
        );
        return digest.recover(_signature);
    }

    /// @notice Gets the bit variables associated with a ticket number
    /// @param _editionId edition id
    /// @param _ticketNumber ticket number
    function _getBitForTicketNumber(uint256 _editionId, uint256 _ticketNumber)
        private
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        uint256 localGroup; // the bit array for this ticket number
        uint256 ticketNumbersIdx; // the index of the the local group
        uint256 localGroupOffset; // the offset/index for the ticket number in the local group
        uint256 storedBit; // the stored bit at this ticket number's index within the local group
        unchecked {
            ticketNumbersIdx = _ticketNumber / 256;
            localGroupOffset = _ticketNumber % 256;
        }

        // cache the local group for efficiency
        localGroup = ticketNumbers[_editionId][ticketNumbersIdx];

        // gets the stored bit
        storedBit = (localGroup >> localGroupOffset) & uint256(1);

        return (storedBit, localGroup, localGroupOffset, ticketNumbersIdx);
    }

    function _contractBaseURI() private view returns (string memory) {
        string memory contractAddress = Strings.toHexString(uint256(uint160(address(this))), 20);
        if (block.chainid == 1) {
            return string.concat('https://metadata.sound.xyz/v1/', contractAddress, '/');
        } else {
            return string.concat(baseURI, contractAddress, '/');
        }
    }
}
