// SPDX-License-Identifier: MIT
// An example of a consumer contract that relies on a subscription for funding.
pragma solidity ^0.8.7;

import '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import {GoldenEggInterface} from './GoldenEggInterface.sol';

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

/// @title Sound Golden Egg
/// @author sound.xyz
contract GoldenEgg is GoldenEggInterface, VRFConsumerBaseV2 {
    VRFCoordinatorV2Interface public vrfCoordinator;
    LinkTokenInterface public linkToken;

    // Your subscription ID.
    uint64 public subscriptionId;

    // Rinkeby coordinator. For other networks,
    // see https://docs.chain.link/docs/vrf-contracts/#configurations
    // address vrfCoordinator = 0x6168499c0cFfCaCD319c818142124B7A15E857ab;

    // Rinkeby LINK token contract. For other networks,
    // see https://docs.chain.link/docs/vrf-contracts/#configurations
    // address linkToken = 0x01BE23585060835E02B77ef475b0Cc51aA1e0709;

    // The gas lane to use, which specifies the maximum gas price to bump to.
    // For a list of available gas lanes on each network,
    // see https://docs.chain.link/docs/vrf-contracts/#configurations
    bytes32 gasLaneKeyHash; // = 0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc;

    // Depends on the number of requested values that you want sent to the
    // fulfillRandomWords() function. Storing each word costs about 20,000 gas,
    // so 100,000 is a safe default for this example contract. Test and adjust
    // this limit based on the network that you select, the size of the request,
    // and the processing of the callback request in the fulfillRandomWords()
    // function.
    uint32 callbackGasLimit = 100000;

    // request ID => random number
    mapping(uint256 => uint256) public randomNumbers;
    address public admin;

    constructor(
        uint64 _subscriptionId,
        address _admin,
        address _vrfCoordinator,
        address _linkToken,
        bytes32 _gasLaneKeyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        linkToken = LinkTokenInterface(_linkToken);
        admin = _admin;
        subscriptionId = _subscriptionId;
        gasLaneKeyHash = _gasLaneKeyHash;
    }

    function requestRandomNumber() external override returns (uint256) {
        require(msg.sender == admin, 'Only admin can request a number');

        // Will revert if subscription is not set and funded.
        uint256 requestId = vrfCoordinator.requestRandomWords(
            gasLaneKeyHash,
            subscriptionId,
            3, // request confirmations (default is 3)
            callbackGasLimit,
            1 // number of words being requested
        );

        return requestId;
    }

    // "Words" refers to 32-byte random numbers (ie: uint256)
    function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
        randomNumbers[_requestId] = _randomWords[0];
    }

    // TODO: make setting admin a 2-step process to avoid mistakes (grant admin + accept admin request)
    function setAdmin(address _admin) external override {
        require(msg.sender == admin, 'Only admin can call this function');

        admin = _admin;
    }
}
